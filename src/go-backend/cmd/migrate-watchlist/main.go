package main

import (
	"fmt"
	"log"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"

	"gorm.io/gorm"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

	if err := migrateWatchlist(db.DB); err != nil {
		log.Fatalf("Watchlist migration failed: %v", err)
	}

	log.Println("Watchlist migration completed successfully!")
}

func migrateWatchlist(db *gorm.DB) error {
	log.Println("=== Watchlist Migration ===")

	// Create watchlist table with all constraints and indexes
	log.Println("Creating watchlist table...")
	if err := db.AutoMigrate(&models.WatchlistItem{}); err != nil {
		return fmt.Errorf("failed to create watchlist table: %w", err)
	}
	log.Println("watchlist table created")

	log.Println("=== Watchlist Migration Complete ===")
	return nil
}
