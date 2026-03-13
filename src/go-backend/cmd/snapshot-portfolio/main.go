package main

import (
	"context"
	"fmt"
	"log"

	redisv8 "github.com/go-redis/redis/v8"

	"wealthjourney/domain/repository"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
	pkgredis "wealthjourney/pkg/redis"
	walletv1 "wealthjourney/protobuf/v1"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize database
	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

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
		PortfolioHistory:      repository.NewPortfolioHistoryRepository(db.DB),
	}

	// Initialize redis
	redisClient, err := pkgredis.New(cfg)
	if err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
	}

	// Get the underlying redis.Client for services
	var underlyingRedisClient *redisv8.Client = nil
	if redisClient != nil {
		underlyingRedisClient = redisClient.GetClient()
	}

	// Initialize services (no storage provider needed for this CLI tool)
	services := service.NewServices(repos, underlyingRedisClient, nil, nil, redisClient)

	// Run portfolio snapshot job
	ctx := context.Background()
	if err := createPortfolioSnapshots(ctx, repos, services.PortfolioHistory); err != nil {
		log.Fatalf("Portfolio snapshot failed: %v", err)
	}

	log.Println("Portfolio snapshot completed successfully!")
}

func createPortfolioSnapshots(ctx context.Context, repos *service.Repositories, portfolioHistorySvc service.PortfolioHistoryService) error {
	// Get all users
	users, _, err := repos.User.List(ctx, repository.ListOptions{
		Limit: 10000, // Large limit to get all users
	})
	if err != nil {
		return fmt.Errorf("failed to list users: %w", err)
	}

	log.Printf("Found %d users\n", len(users))

	successCount := 0
	errorCount := 0
	skippedCount := 0

	for _, user := range users {
		// Check if user has any investment wallets
		wallets, _, err := repos.Wallet.ListByUserID(ctx, user.ID, repository.ListOptions{
			Limit: 1000,
		})
		if err != nil {
			log.Printf("Warning: failed to list wallets for user %d: %v\n", user.ID, err)
			errorCount++
			continue
		}

		// Check for investment wallets
		hasInvestmentWallets := false
		for _, wallet := range wallets {
			if wallet.Type == int32(walletv1.WalletType_INVESTMENT) {
				hasInvestmentWallets = true
				break
			}
		}

		if !hasInvestmentWallets {
			log.Printf("Skipping user %d (%s) - no investment wallets\n", user.ID, user.Email)
			skippedCount++
			continue
		}

		// Create aggregated snapshot for all investment wallets
		log.Printf("Creating portfolio snapshot for user %d (%s)...\n", user.ID, user.Email)
		if err := portfolioHistorySvc.CreateAggregatedSnapshot(ctx, user.ID); err != nil {
			log.Printf("Error: failed to create portfolio snapshot for user %d: %v\n", user.ID, err)
			errorCount++
			continue
		}

		successCount++
	}

	log.Printf("\nSnapshot summary:\n")
	log.Printf("- Total users: %d\n", len(users))
	log.Printf("- Successful snapshots: %d\n", successCount)
	log.Printf("- Skipped users: %d\n", skippedCount)
	log.Printf("- Errors: %d\n", errorCount)

	return nil
}
