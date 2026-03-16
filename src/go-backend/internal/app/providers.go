package app

import (
	"context"
	"log"
	"os"
	"strconv"
	"time"

	redisv8 "github.com/go-redis/redis/v8"

	"wealthjourney/domain/auth"
	"wealthjourney/domain/repository"
	"wealthjourney/domain/service"
	"wealthjourney/handlers"
	"wealthjourney/internal/scheduler"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
	"wealthjourney/pkg/fileupload"
	"wealthjourney/pkg/jobs"
	"wealthjourney/pkg/redis"
	"wealthjourney/pkg/storage"
)

// ProvideConfig loads application configuration.
func ProvideConfig() (*config.Config, error) {
	return config.Load()
}

// ProvideDatabase initializes the database connection.
func ProvideDatabase(cfg *config.Config) (*database.Database, func(), error) {
	db, err := database.New(cfg)
	if err != nil {
		return nil, nil, err
	}
	cleanup := func() { _ = db.Close() }
	return db, cleanup, nil
}

// ProvideRedis initializes the Redis connection.
// Returns nil client if Redis is unavailable (non-fatal).
func ProvideRedis(cfg *config.Config) *redis.RedisClient {
	client, err := redis.New(cfg)
	if err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
		return nil
	}
	return client
}

// ProvideStorage initializes the private file storage provider (financial documents).
func ProvideStorage(cfg *config.Config) storage.StorageProvider {
	if cfg.Storage.Provider == "supabase" {
		log.Println("Initializing Supabase storage (private documents bucket)...")
		provider := storage.NewSupabaseStorage(
			cfg.Storage.SupabaseURL,
			cfg.Storage.SupabaseAPIKey,
			cfg.Storage.SupabaseBucket,
		)
		fileupload.InitializeDefaultService(provider)
		log.Printf("Supabase storage initialized (bucket: %s)", cfg.Storage.SupabaseBucket)
		return provider
	}
	log.Printf("Warning: Unknown storage provider '%s', file uploads disabled", cfg.Storage.Provider)
	return nil
}

// ProvideCommunityStorage initializes the public storage provider for community images.
func ProvideCommunityStorage(cfg *config.Config) storage.StorageProvider {
	if cfg.Storage.Provider == "supabase" {
		log.Println("Initializing Supabase community storage (public bucket)...")
		provider := storage.NewSupabasePublicStorage(
			cfg.Storage.SupabaseURL,
			cfg.Storage.SupabaseAPIKey,
			cfg.Storage.SupabaseCommunityBucket,
		)
		log.Printf("Supabase community storage initialized (bucket: %s)", cfg.Storage.SupabaseCommunityBucket)
		return provider
	}
	return nil
}

// ProvideRepositories creates all repository instances.
func ProvideRepositories(db *database.Database) *service.Repositories {
	return &service.Repositories{
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
		Post:                  repository.NewPostRepository(db),
		Comment:               repository.NewCommentRepository(db),
		Like:                  repository.NewLikeRepository(db),
		Follow:                repository.NewFollowRepository(db),
		Report:                repository.NewReportRepository(db),
		Notification:          repository.NewNotificationRepository(db),
		SavedPost:             repository.NewSavedPostRepository(db),
		Hashtag:               repository.NewHashtagRepository(db),
		GoldVote:              repository.NewGoldVoteRepository(db),
		GoldVoteComment:       repository.NewGoldVoteCommentRepository(db),
	}
}

// ProvideUnderlyingRedis extracts the raw redis.Client from the wrapper.
func ProvideUnderlyingRedis(rdb *redis.RedisClient) *redisv8.Client {
	if rdb != nil {
		return rdb.GetClient()
	}
	return nil
}

// ProvideServices creates all service instances.
func ProvideServices(repos *service.Repositories, redisClient *redisv8.Client, storageProvider storage.StorageProvider, communityStorage storage.StorageProvider, rdb *redis.RedisClient) *service.Services {
	return service.NewServices(repos, redisClient, storageProvider, communityStorage, rdb)
}

// ProvideImportSystem sets up the import service and worker pool.
// Must be called after ProvideServices to wire import into services.
func ProvideImportSystem(
	db *database.Database,
	repos *service.Repositories,
	services *service.Services,
	rdb *redis.RedisClient,
) *jobs.WorkerPool {
	if rdb == nil {
		fxService := services.FXRate
		services.Import = service.NewImportService(
			db, repos.Import, repos.Transaction, repos.Wallet,
			repos.Category, repos.MerchantRule, repos.Keyword,
			repos.UserMapping, fxService, nil,
		)
		return nil
	}

	underlyingRedis := rdb.GetClient()
	jobQueue := jobs.NewRedisImportQueue(underlyingRedis)
	jobQueueAdapter := jobs.NewImportQueueAdapter(jobQueue)
	fxService := services.FXRate

	mainImportService := service.NewImportService(
		db, repos.Import, repos.Transaction, repos.Wallet,
		repos.Category, repos.MerchantRule, repos.Keyword,
		repos.UserMapping, fxService, jobQueueAdapter,
	)
	services.Import = mainImportService

	workerImportService := service.NewImportService(
		db, repos.Import, repos.Transaction, repos.Wallet,
		repos.Category, repos.MerchantRule, repos.Keyword,
		repos.UserMapping, fxService, nil,
	)

	numWorkers := 2
	if s := os.Getenv("IMPORT_WORKER_COUNT"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			numWorkers = n
		}
	}

	workerPool := jobs.NewWorkerPool(numWorkers, jobQueue, workerImportService)
	workerPool.Start()
	log.Printf("Import worker pool started with %d workers", numWorkers)

	// Schedule job cleanup in background
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			cleanupCtx := context.Background()
			if deleted, err := jobQueue.CleanupExpiredJobs(cleanupCtx); err != nil {
				log.Printf("ERROR: Job cleanup failed: %v", err)
			} else {
				log.Printf("INFO: Job cleanup: %d jobs deleted", deleted)
			}
		}
	}()

	return workerPool
}

// ProvideAuthServer creates and configures the auth server.
func ProvideAuthServer(
	db *database.Database,
	rdb *redis.RedisClient,
	cfg *config.Config,
	services *service.Services,
) *auth.Server {
	return auth.NewServer(db, rdb, cfg, services.User, services.Category)
}

// ProvideHandlerDeps creates the handler dependencies struct.
func ProvideHandlerDeps(
	db *database.Database,
	rdb *redis.RedisClient,
	authSrv *auth.Server,
) *handlers.HandlerDeps {
	return &handlers.HandlerDeps{
		DB:      db,
		RDB:     rdb,
		AuthSrv: authSrv,
	}
}

// ProvideHandlers creates all HTTP handlers.
func ProvideHandlers(
	services *service.Services,
	repos *service.Repositories,
	deps *handlers.HandlerDeps,
) *handlers.AllHandlers {
	return handlers.NewHandlers(services, repos, deps)
}

// ProvideScheduler creates the background job scheduler.
func ProvideScheduler(
	db *database.Database,
	rdb *redis.RedisClient,
	repos *service.Repositories,
	services *service.Services,
) *scheduler.Scheduler {
	var backgroundJobs []scheduler.Job

	backgroundJobs = append(backgroundJobs, scheduler.NewDBKeepAliveJob(db))

	if rdb != nil {
		backgroundJobs = append(backgroundJobs, scheduler.NewSessionCleanupJobAdapter(db, rdb))
	}

	if services.Import != nil {
		backgroundJobs = append(backgroundJobs, scheduler.NewFileCleanupJob(services.Import))
	}

	backgroundJobs = append(backgroundJobs,
		scheduler.NewPriceUpdateJob(services.User, services.Investment),
		scheduler.NewPortfolioSnapshotJob(repos.User, services.PortfolioHistory),
	)

	return scheduler.New(backgroundJobs...)
}
