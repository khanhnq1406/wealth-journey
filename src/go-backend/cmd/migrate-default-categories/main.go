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
		User:        repository.NewUserRepository(db),
		Wallet:      repository.NewWalletRepository(db),
		Transaction: repository.NewTransactionRepository(db),
		Category:    repository.NewCategoryRepository(db),
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
	services := service.NewServices(repos, underlyingRedisClient, nil, redisClient)

	// Run migration
	ctx := context.Background()
	if err := migrateDefaultCategories(ctx, repos, services.Category); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Migration completed successfully!")
}

func migrateDefaultCategories(ctx context.Context, repos *service.Repositories, categorySvc service.CategoryService) error {
	// Get all users
	users, _, err := repos.User.List(ctx, repository.ListOptions{
		Limit: 10000, // Large limit to get all users
	})
	if err != nil {
		return fmt.Errorf("failed to list users: %w", err)
	}

	log.Printf("Found %d users\n", len(users))

	migratedCount := 0
	skippedCount := 0

	for _, user := range users {
		// Check if user already has categories
		categoryCount, err := repos.Category.CountByUserID(ctx, user.ID)
		if err != nil {
			log.Printf("Warning: failed to count categories for user %d: %v\n", user.ID, err)
			continue
		}

		if categoryCount > 0 {
			log.Printf("Skipping user %d (%s) - already has %d categories\n", user.ID, user.Email, categoryCount)
			skippedCount++
			continue
		}

		// Create default categories for this user
		log.Printf("Creating default categories for user %d (%s)...\n", user.ID, user.Email)
		if err := categorySvc.CreateDefaultCategories(ctx, user.ID); err != nil {
			log.Printf("Error: failed to create default categories for user %d: %v\n", user.ID, err)
			continue
		}

		// Verify the categories were created
		newCount, err := repos.Category.CountByUserID(ctx, user.ID)
		if err != nil {
			log.Printf("Warning: failed to verify categories for user %d: %v\n", user.ID, err)
		} else {
			log.Printf("Successfully created %d default categories for user %d (%s)\n", newCount, user.ID, user.Email)
		}
		migratedCount++
	}

	log.Printf("\nMigration summary:\n")
	log.Printf("- Total users: %d\n", len(users))
	log.Printf("- Users migrated: %d\n", migratedCount)
	log.Printf("- Users skipped: %d\n", skippedCount)

	return nil
}
