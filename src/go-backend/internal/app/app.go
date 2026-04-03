package app

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"wealthjourney/domain/auth"
	gateway "wealthjourney/domain/gateway"
	grpcserver "wealthjourney/domain/grpcserver"
	"wealthjourney/handlers"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
	appmiddleware "wealthjourney/pkg/middleware"
	"wealthjourney/pkg/redis"
)

// Run is the application entry point. It initializes all dependencies,
// starts servers, and handles graceful shutdown.
func Run() {
	// --- Phase 1: Provision all dependencies ---

	cfg, err := ProvideConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "" {
		ginMode = gin.DebugMode
	}
	gin.SetMode(ginMode)

	db, dbCleanup, err := ProvideDatabase(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbCleanup()

	rdb := ProvideRedis(cfg)
	storageProvider := ProvideStorage(cfg)          // private bucket — financial documents
	communityStorage := ProvideCommunityStorage(cfg) // public bucket — community images

	repos := ProvideRepositories(db)
	redisClient := ProvideUnderlyingRedis(rdb)
	services := ProvideServices(repos, redisClient, storageProvider, communityStorage, rdb)

	// Import system (must be after services for FXRate dependency)
	workerPool := ProvideImportSystem(db, repos, services, rdb)
	defer func() {
		if workerPool != nil {
			log.Println("Stopping import worker pool...")
			workerPool.Stop()
		}
	}()

	authSrv := ProvideAuthServer(db, rdb, cfg, services)
	deps := ProvideHandlerDeps(db, rdb, authSrv)
	h := ProvideHandlers(services, repos, deps)

	// --- Phase 2: Background scheduler ---

	backgroundCtx, backgroundCancel := context.WithCancel(context.Background())
	defer backgroundCancel()

	sched := ProvideScheduler(db, rdb, repos, services)
	sched.Start(backgroundCtx)
	defer sched.Stop()

	// --- Phase 3: Rate limiters ---

	rateLimiter := appmiddleware.NewRateLimiter(appmiddleware.RateLimiterConfig{
		RequestsPerMinute: cfg.RateLimit.RequestsPerMinute,
		CleanupInterval:   time.Minute,
	})

	importRateLimiter, importRateLimiterCleanup := ProvideImportRateLimiter(cfg, rdb)
	defer importRateLimiterCleanup()

	// --- Phase 4: HTTP server (Gin) ---

	app := setupGinEngine(cfg, db, h, authSrv, rateLimiter, importRateLimiter)

	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      app,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	go func() {
		log.Printf("Starting REST server on port %s...", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start REST server: %v", err)
		}
	}()

	// --- Phase 5: gRPC + Gateway servers ---

	grpcSrv := grpcserver.NewServer(authSrv, services)

	grpcPort := os.Getenv("GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "50051"
	}

	gatewayPort := os.Getenv("GATEWAY_PORT")
	if gatewayPort == "" {
		gatewayPort = "8081"
	}

	gwSrv := gateway.NewServer(gateway.Config{
		GRPCPort: grpcPort,
		HTTPPort: gatewayPort,
	})
	if err := gwSrv.RegisterServices(grpcSrv); err != nil {
		log.Fatalf("Failed to register gateway services: %v", err)
	}

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := grpcSrv.Start(grpcPort); err != nil {
			log.Fatalf("Failed to start gRPC server: %v", err)
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		log.Printf("Starting gRPC-Gateway server on port %s...", gatewayPort)
		if err := gwSrv.Start(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start gRPC-Gateway server: %v", err)
		}
	}()

	// --- Phase 6: Graceful shutdown ---

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down servers...")
	backgroundCancel()

	ctx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("REST server forced to shutdown: %v", err)
	}
	if err := grpcSrv.Stop(ctx); err != nil {
		log.Fatalf("gRPC server forced to shutdown: %v", err)
	}
	if err := gwSrv.Stop(ctx); err != nil {
		log.Fatalf("gRPC-Gateway server forced to shutdown: %v", err)
	}

	wg.Wait()
	log.Println("Servers exited")
}

// ProvideImportRateLimiter creates the appropriate import rate limiter
// based on Redis availability. Returns the limiter and an optional cleanup function.
func ProvideImportRateLimiter(
	cfg *config.Config,
	rdb *redis.RedisClient,
) (interface{}, func()) {
	if rdb != nil {
		importCfg := appmiddleware.ImportRateLimitConfig{
			MaxImportsPerHour:         cfg.Import.MaxImportsPerHour,
			UserWindow:                time.Hour,
			MaxImportsPerHourPerIP:    cfg.Import.MaxImportsPerHourPerIP,
			IPWindow:                  time.Hour,
			MaxImportsPerDayPerWallet: cfg.Import.MaxImportsPerDayPerWallet,
			WalletWindow:              24 * time.Hour,
			UserPrefix:                "ratelimit:import:user",
			IPPrefix:                  "ratelimit:import:ip",
			WalletPrefix:              "ratelimit:import:wallet",
		}
		limiter := appmiddleware.NewRedisImportRateLimiter(rdb.GetClient(), importCfg)
		log.Printf("Import rate limiting enabled (Redis): user=%d/hr, ip=%d/hr, wallet=%d/day",
			cfg.Import.MaxImportsPerHour, cfg.Import.MaxImportsPerHourPerIP, cfg.Import.MaxImportsPerDayPerWallet)
		return limiter, func() {}
	}

	limiter := appmiddleware.NewImportRateLimiter(
		cfg.Import.MaxImportsPerHour,
		time.Hour,
	)
	log.Printf("Import rate limiting enabled (in-memory): user=%d/hr (Redis unavailable, IP and wallet limits disabled)",
		cfg.Import.MaxImportsPerHour)
	return limiter, func() { limiter.Stop() }
}

// setupGinEngine creates and configures the Gin HTTP engine.
func setupGinEngine(
	cfg *config.Config,
	db *database.Database,
	h *handlers.AllHandlers,
	authSrv *auth.Server,
	rateLimiter *appmiddleware.RateLimiter,
	importRateLimiter interface{},
) *gin.Engine {
	app := gin.New()

	app.Use(appmiddleware.SecurityHeaders())
	// Log CORS allowlist at startup for operator audit
	log.Printf("CORS AllowedOrigins: %v", cfg.CORS.AllowedOrigins)
	for _, origin := range cfg.CORS.AllowedOrigins {
		if origin == "*" {
			log.Printf("WARNING: CORS_ALLOWED_ORIGINS contains '*' — this is insecure with AllowCredentials: true and will be rejected by browsers")
		}
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORS.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
	app.Use(appmiddleware.ErrorLogger())
	app.Use(appmiddleware.Recovery())
	app.Use(appmiddleware.RequestID())
	app.Use(appmiddleware.Logger(appmiddleware.DefaultLoggerConfig()))

	app.GET("/health", handlers.HealthHandler(db))
	app.HEAD("/health", handlers.HealthHandler(db))

	v1 := app.Group("/api/v1")
	v1.Use(appmiddleware.RateLimitByIP(rateLimiter))

	handlers.RegisterRoutes(v1, h, authSrv, rateLimiter, importRateLimiter)

	app.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":       "NOT_FOUND",
				"message":    "The requested endpoint does not exist",
				"statusCode": 404,
			},
		})
	})

	return app
}
