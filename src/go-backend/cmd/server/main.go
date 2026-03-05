package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	redisv8 "github.com/go-redis/redis/v8"

	"wealthjourney/domain/auth"
	gateway "wealthjourney/domain/gateway"
	grpcserver "wealthjourney/domain/grpcserver"
	"wealthjourney/domain/repository"
	"wealthjourney/domain/service"
	"wealthjourney/handlers"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
	"wealthjourney/pkg/fileupload"
	"wealthjourney/pkg/jobs"
	appmiddleware "wealthjourney/pkg/middleware"
	"wealthjourney/pkg/redis"
	"wealthjourney/pkg/storage"
	"wealthjourney/pkg/types"
	investmentv1 "wealthjourney/protobuf/v1"
)

const (
	dbKeepAliveInterval     = 2 * time.Minute
	dbKeepAliveStartupDelay = 10 * time.Second
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Set Gin mode based on config
	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "" {
		ginMode = gin.DebugMode
	}
	gin.SetMode(ginMode)

	// Initialize database
	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize repositories
	repos := &service.Repositories{
		User:                  repository.NewUserRepository(db),
		Wallet:                repository.NewWalletRepository(db),
		Transaction:           repository.NewTransactionRepository(db),
		Category:              repository.NewCategoryRepository(db),
		Budget:                repository.NewBudgetRepository(db),
		BudgetItem:            repository.NewBudgetItemRepository(db),
		Investment:            repository.NewInvestmentRepository(db),
		InvestmentTransaction: repository.NewInvestmentTransactionRepository(db),
		MarketData:            repository.NewMarketDataRepository(db),
		FXRate:                repository.NewFXRateRepository(db),
		ExchangeRate:          repository.NewExchangeRateRepository(db.DB),
		PortfolioHistory:      repository.NewPortfolioHistoryRepository(db.DB),
		Import:                repository.NewImportRepository(db),
		MerchantRule:          repository.NewMerchantRuleRepository(db),
		Keyword:               repository.NewKeywordRepository(db),
		UserMapping:           repository.NewUserMappingRepository(db),
	}

	// Initialize redis (single instance for both handlers and auth server)
	redisClient, err := redis.New(cfg)
	if err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
	}

	// Get the underlying redis.Client for services
	var underlyingRedisClient *redisv8.Client = nil
	if redisClient != nil {
		underlyingRedisClient = redisClient.GetClient()
	}

	// Initialize storage provider
	var storageProvider storage.StorageProvider

	if cfg.Storage.Provider == "supabase" {
		log.Println("Initializing Supabase storage...")
		storageProvider = storage.NewSupabaseStorage(
			cfg.Storage.SupabaseURL,
			cfg.Storage.SupabaseAPIKey,
			cfg.Storage.SupabaseBucket,
		)
		log.Printf("Supabase storage initialized (bucket: %s)", cfg.Storage.SupabaseBucket)
	} else {
		log.Printf("Warning: Unknown storage provider '%s', file uploads will use legacy local storage", cfg.Storage.Provider)
		// Keep storageProvider as nil to use legacy functions
	}

	// Initialize file upload service with storage provider
	if storageProvider != nil {
		fileupload.InitializeDefaultService(storageProvider)
		log.Println("File upload service initialized with external storage")
	}

	// Initialize services
	services := service.NewServices(repos, underlyingRedisClient)

	// Create context for background jobs cancellation
	backgroundCtx, backgroundCancel := context.WithCancel(context.Background())
	defer backgroundCancel()

	// Initialize import job queue and worker pool
	var importWorkerPool *jobs.WorkerPool
	if redisClient != nil {
		// Create Redis-based job queue
		jobQueue := jobs.NewRedisImportQueue(underlyingRedisClient)

		// Wrap the job queue with an adapter for the service layer
		jobQueueAdapter := jobs.NewImportQueueAdapter(jobQueue)

		// Create FX rate service for currency conversion (needed by import service)
		// Note: We reuse the existing FXRate service from services
		fxService := services.FXRate

		// Create main import service with job queue for API handlers
		mainImportService := service.NewImportService(
			db,
			repos.Import,
			repos.Transaction,
			repos.Wallet,
			repos.Category,
			repos.MerchantRule,
			repos.Keyword,
			repos.UserMapping,
			fxService,
			jobQueueAdapter, // Main service can enqueue jobs (using adapter)
		)

		// Set the import service in the services struct
		services.Import = mainImportService

		// Create dedicated import service for workers (without job queue to prevent recursion)
		workerImportService := service.NewImportService(
			db,
			repos.Import,
			repos.Transaction,
			repos.Wallet,
			repos.Category,
			repos.MerchantRule,
			repos.Keyword,
			repos.UserMapping,
			fxService,
			nil, // Workers don't queue jobs recursively
		)

		// Start worker pool with 2 workers (can be configured via environment variable)
		numWorkers := 2
		if workerCountStr := os.Getenv("IMPORT_WORKER_COUNT"); workerCountStr != "" {
			if count, err := strconv.Atoi(workerCountStr); err == nil && count > 0 {
				numWorkers = count
			}
		}

		importWorkerPool = jobs.NewWorkerPool(numWorkers, jobQueue, workerImportService)
		importWorkerPool.Start()
		log.Printf("Import worker pool started with %d workers", numWorkers)

		// Schedule job cleanup every hour
		go func() {
			ticker := time.NewTicker(1 * time.Hour)
			defer ticker.Stop()

			log.Println("INFO: Background job - job cleanup started (runs every hour)")

			for {
				select {
				case <-ticker.C:
					cleanupCtx := context.Background()
					deleted, err := jobQueue.CleanupExpiredJobs(cleanupCtx)
					if err != nil {
						log.Printf("ERROR: Job cleanup failed: %v", err)
					} else {
						log.Printf("INFO: Job cleanup completed: %d jobs deleted", deleted)
					}
				case <-backgroundCtx.Done():
					log.Println("INFO: Job cleanup stopped")
					return
				}
			}
		}()
	} else {
		// Create import service without job queue if Redis is not available
		fxService := services.FXRate
		mainImportService := service.NewImportService(
			db,
			repos.Import,
			repos.Transaction,
			repos.Wallet,
			repos.Category,
			repos.MerchantRule,
			repos.Keyword,
			repos.UserMapping,
			fxService,
			nil, // No job queue
		)
		services.Import = mainImportService
	}
	defer func() {
		if importWorkerPool != nil {
			log.Println("Stopping import worker pool...")
			importWorkerPool.Stop()
		}
	}()

	// Initialize auth server (must be before handlers so it can be injected)
	authSrv := auth.NewServer(db, redisClient, cfg)
	authSrv.SetServices(services.User, services.Category)

	// Initialize handlers with explicit dependency injection (no globals)
	h := handlers.NewHandlers(services, repos, &handlers.HandlerDeps{
		DB:      db,
		RDB:     redisClient,
		AuthSrv: authSrv,
	})

	// Initialize session cleanup job (runs every 6 hours)
	// This cleans up expired sessions from Redis and database
	if redisClient != nil {
		sessionCleanupJob := jobs.NewSessionCleanupJob(db, redisClient)
		go sessionCleanupJob.Start(backgroundCtx, 6*time.Hour)
		log.Println("Background session cleanup job started (runs every 6 hours)")
	}

	// Initialize file cleanup job (runs every hour)
	// This removes uploaded files older than 1 hour to prevent disk exhaustion
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		// Wait for server to be fully initialized
		time.Sleep(5 * time.Second)

		log.Println("Background file cleanup job started (runs every hour)")

		for {
			select {
			case <-ticker.C:
				log.Println("Running file cleanup...")

				cleanupCtx := context.Background()
				deleted, err := services.Import.CleanupExpiredFiles(cleanupCtx)
				if err != nil {
					log.Printf("ERROR: File cleanup failed: %v", err)
				} else {
					log.Printf("INFO: File cleanup completed: %d files deleted", deleted)
				}

			case <-backgroundCtx.Done():
				log.Println("Background file cleanup job stopped (shutting down)")
				return
			}
		}
	}()

	// Initialize background price update job
	// This runs every 15 minutes to update investment prices from Yahoo Finance
	// The cache duration is also 15 minutes, so this ensures fresh data
	go func() {
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()

		// Wait for server to be fully initialized
		time.Sleep(5 * time.Second)

		log.Println("Background price update job started (runs every 15 minutes)")

		for {
			select {
			case <-ticker.C:
				log.Println("Running scheduled price update...")

				ctx := context.Background()

				// Get all users from the system
				// We use a large page size to get all users in one request
				usersResp, err := services.User.ListUsers(ctx, types.PaginationParams{
					Page:     1,
					PageSize: 1000, // Adjust based on expected user count
					OrderBy:  "",
					Order:    "",
				})

				if err != nil {
					log.Printf("Error fetching users for price update: %v", err)
					continue
				}

				if !usersResp.Success || len(usersResp.Users) == 0 {
					log.Println("No users found for price update")
					continue
				}

				log.Printf("Updating prices for %d users...", len(usersResp.Users))

				successCount := 0
				errorCount := 0

				// Update prices for each user
				for _, user := range usersResp.Users {
					// Call UpdatePrices for this user
					// We don't specify investment IDs to update all investments
					// ForceRefresh=false to use cached data when available
					updateResp, err := services.Investment.UpdatePrices(ctx, user.Id, &investmentv1.UpdatePricesRequest{
						InvestmentIds: []int32{}, // Empty means update all
						ForceRefresh:  false,     // Use cache if available
					})

					if err != nil {
						log.Printf("Failed to update prices for user %d (%s): %v", user.Id, user.Email, err)
						errorCount++
						continue
					}

					if updateResp.Success {
						successCount++
						log.Printf("Updated prices for user %d (%s): %s", user.Id, user.Email, updateResp.Message)
					} else {
						log.Printf("No investments to update for user %d (%s)", user.Id, user.Email)
					}
				}

				log.Printf("Scheduled price update completed: %d users updated successfully, %d errors", successCount, errorCount)

			case <-backgroundCtx.Done():
				log.Println("Background price update job stopped (shutting down)")
				return
			}
		}
	}()

	// Initialize background portfolio snapshot job
	// This runs every hour to create portfolio value snapshots for historical charts
	// Snapshots are stored in portfolio_history table and used for sparkline charts
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		// Wait for server to be fully initialized
		time.Sleep(10 * time.Second)

		log.Println("Background portfolio snapshot job started (runs every hour)")

		for {
			select {
			case <-ticker.C:
				log.Println("Running portfolio snapshot job...")

				ctx := context.Background()

				// Get all users from the system
				users, _, err := repos.User.List(ctx, repository.ListOptions{
					Limit: 10000, // Large limit to get all users
				})

				if err != nil {
					log.Printf("Error fetching users for portfolio snapshot: %v", err)
					continue
				}

				log.Printf("Creating portfolio snapshots for %d users...", len(users))

				successCount := 0
				errorCount := 0
				skippedCount := 0

				// Create snapshot for each user
				for _, user := range users {
					// Check if user has any investment wallets
					wallets, _, err := repos.Wallet.ListByUserID(ctx, user.ID, repository.ListOptions{
						Limit: 1000,
					})
					if err != nil {
						log.Printf("Warning: failed to list wallets for user %d: %v", user.ID, err)
						errorCount++
						continue
					}

					// Check for investment wallets
					hasInvestmentWallets := false
					for _, wallet := range wallets {
						if wallet.Type == int32(investmentv1.WalletType_INVESTMENT) {
							hasInvestmentWallets = true
							break
						}
					}

					if !hasInvestmentWallets {
						skippedCount++
						continue
					}

					// Create aggregated snapshot for all investment wallets
					if err := services.PortfolioHistory.CreateAggregatedSnapshot(ctx, user.ID); err != nil {
						log.Printf("Error: failed to create portfolio snapshot for user %d: %v", user.ID, err)
						errorCount++
						continue
					}

					successCount++
				}

				log.Printf("Portfolio snapshot job completed: %d successful, %d skipped, %d errors", successCount, skippedCount, errorCount)

			case <-backgroundCtx.Done():
				log.Println("Background portfolio snapshot job stopped (shutting down)")
				return
			}
		}
	}()

	// Initialize database keep-alive job
	// This runs every 2 minutes to prevent Railway PostgreSQL from sleeping
	// Railway free tier puts idle databases to sleep after ~5 minutes of no activity
	// This lightweight query keeps the connection pool active
	go func() {
		attemptCount := 0          // Track attempts for throttled logging
		consecutiveFailures := 0   // Track consecutive failures for circuit breaker
		const maxConsecutiveFailures = 5 // Open circuit after 5 consecutive failures
		circuitOpen := false       // Circuit breaker state
		ticker := time.NewTicker(dbKeepAliveInterval)
		defer ticker.Stop()

		// Wait for server to be fully initialized
		time.Sleep(dbKeepAliveStartupDelay)

		log.Printf("Database keep-alive job started (runs every %v)", dbKeepAliveInterval)

		for {
			select {
			case <-ticker.C:
				// Skip ping if circuit breaker is open (database is persistently down)
				if circuitOpen {
					log.Printf("Database keep-alive circuit breaker OPEN - skipping ping (database is down)")
					continue
				}

				// Get connection pool stats before ping
				stats := db.Stats()

				// Execute lightweight health check query
				// This uses the existing Ping() method which executes PingContext
				if err := db.Ping(); err != nil {
					consecutiveFailures++
					log.Printf("Database keep-alive ping failed (%d/%d consecutive): %v | Pool stats: %+v",
						consecutiveFailures, maxConsecutiveFailures, err, stats)

					// Open circuit breaker after max consecutive failures
					if consecutiveFailures >= maxConsecutiveFailures {
						log.Printf("Database keep-alive circuit breaker OPENED after %d consecutive failures - pausing pings until recovery",
							maxConsecutiveFailures)
						circuitOpen = true
					}
				} else {
					// Close circuit breaker and reset failure counter on success
					if circuitOpen {
						log.Printf("Database keep-alive ping recovered - circuit breaker CLOSED")
						circuitOpen = false
					}
					if consecutiveFailures > 0 {
						log.Printf("Database keep-alive ping recovered after %d failures", consecutiveFailures)
						consecutiveFailures = 0
					}

					// Only log full stats on success every 5th attempt to reduce noise
					attemptCount++
					if attemptCount%5 == 0 {
						log.Printf("Database keep-alive ping success | Pool stats: open=%v, in_use=%v, idle=%v",
							stats["open_connections"], stats["in_use"], stats["idle"])
					} else {
						log.Printf("Database keep-alive ping success")
					}
				}

			case <-backgroundCtx.Done():
				log.Println("Database keep-alive job stopped (shutting down)")
				return
			}
		}
	}()

	// Initialize rate limiter
	rateLimiter := appmiddleware.NewRateLimiter(appmiddleware.RateLimiterConfig{
		RequestsPerMinute: cfg.RateLimit.RequestsPerMinute,
		CleanupInterval:   time.Minute,
	})

	// Initialize import rate limiter
	// Use Redis-based rate limiter if Redis is available, otherwise fall back to in-memory
	var importRateLimiter interface{}
	if underlyingRedisClient != nil {
		// Redis-based rate limiter (distributed, supports multiple instances)
		importRateLimiterConfig := appmiddleware.ImportRateLimitConfig{
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
		importRateLimiter = appmiddleware.NewRedisImportRateLimiter(underlyingRedisClient, importRateLimiterConfig)
		log.Printf("Import rate limiting enabled (Redis): user=%d/hr, ip=%d/hr, wallet=%d/day",
			cfg.Import.MaxImportsPerHour, cfg.Import.MaxImportsPerHourPerIP, cfg.Import.MaxImportsPerDayPerWallet)
	} else {
		// Fallback to in-memory rate limiter (single instance only)
		inMemoryLimiter := appmiddleware.NewImportRateLimiter(
			cfg.Import.MaxImportsPerHour,
			time.Hour,
		)
		importRateLimiter = inMemoryLimiter
		defer inMemoryLimiter.Stop()
		log.Printf("Import rate limiting enabled (in-memory): user=%d/hr (Redis unavailable, IP and wallet limits disabled)",
			cfg.Import.MaxImportsPerHour)
	}

	// Initialize Gin app
	app := gin.New()

	// Security headers middleware (must be first)
	app.Use(appmiddleware.SecurityHeaders())

	// CORS middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Error logging middleware (before error handler)
	app.Use(appmiddleware.ErrorLogger())

	// Global middleware
	app.Use(appmiddleware.Recovery())
	app.Use(appmiddleware.RequestID())
	app.Use(appmiddleware.Logger(appmiddleware.DefaultLoggerConfig()))

	// Health check endpoint (no rate limiting)
	// Uses HealthHandler to provide database connection status and uptime
	app.GET("/health", handlers.HealthHandler(db))
	app.HEAD("/health", handlers.HealthHandler(db))

	// API v1 group with rate limiting
	v1 := app.Group("/api/v1")
	v1.Use(appmiddleware.RateLimitByIP(rateLimiter))

	// Register routes
	handlers.RegisterRoutes(v1, h, authSrv, rateLimiter, importRateLimiter)

	// Global 404 handler
	app.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":       "NOT_FOUND",
				"message":    "The requested endpoint does not exist",
				"statusCode": 404,
			},
		})
	})

	// Create HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      app,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	// Start REST server in a goroutine
	go func() {
		log.Printf("Starting REST server on port %s...", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start REST server: %v", err)
		}
	}()

	// Initialize and start gRPC server (reuses authSrv created above)
	grpcSrv := grpcserver.NewServer(authSrv, services)
	grpcPort := os.Getenv("GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "50051" // Default gRPC port
	}

	// Initialize gRPC-Gateway server
	gatewayPort := os.Getenv("GATEWAY_PORT")
	if gatewayPort == "" {
		gatewayPort = "8081" // Default gateway port
	}
	gwSrv := gateway.NewServer(gateway.Config{
		GRPCPort: grpcPort,
		HTTPPort: gatewayPort,
	})

	// Register services with the gateway
	if err := gwSrv.RegisterServices(grpcSrv); err != nil {
		log.Fatalf("Failed to register gateway services: %v", err)
	}

	var wg sync.WaitGroup

	// Start gRPC server
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := grpcSrv.Start(grpcPort); err != nil {
			log.Fatalf("Failed to start gRPC server: %v", err)
		}
	}()

	// Start gRPC-Gateway server
	wg.Add(1)
	go func() {
		defer wg.Done()
		log.Printf("Starting gRPC-Gateway server on port %s...", gatewayPort)
		if err := gwSrv.Start(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start gRPC-Gateway server: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down servers...")

	// Stop background jobs
	backgroundCancel()

	ctx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer cancel()

	// Shutdown REST server
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("REST server forced to shutdown: %v", err)
	}

	// Shutdown gRPC server
	if err := grpcSrv.Stop(ctx); err != nil {
		log.Fatalf("gRPC server forced to shutdown: %v", err)
	}

	// Shutdown gRPC-Gateway server
	if err := gwSrv.Stop(ctx); err != nil {
		log.Fatalf("gRPC-Gateway server forced to shutdown: %v", err)
	}

	// Wait for all servers to stop
	wg.Wait()

	log.Println("Servers exited")
}
