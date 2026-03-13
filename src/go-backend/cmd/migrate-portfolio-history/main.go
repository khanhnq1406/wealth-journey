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

	// Run migration
	if err := migratePortfolioHistory(db.DB); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Migration completed successfully!")
}

func migratePortfolioHistory(db *gorm.DB) error {
	log.Println("Starting portfolio_history table migration...")

	// Create the portfolio_history table
	err := db.AutoMigrate(&models.PortfolioHistory{})
	if err != nil {
		return fmt.Errorf("failed to create portfolio_history table: %w", err)
	}

	// Create indexes for better query performance
	// Index on user_id and timestamp for filtering
	if err := db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_portfolio_history_user_timestamp
		ON portfolio_history(user_id, timestamp DESC)
	`).Error; err != nil {
		return fmt.Errorf("failed to create idx_portfolio_history_user_timestamp: %w", err)
	}

	// Index on wallet_id and timestamp for wallet-specific queries
	if err := db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_portfolio_history_wallet_timestamp
		ON portfolio_history(wallet_id, timestamp DESC)
	`).Error; err != nil {
		return fmt.Errorf("failed to create idx_portfolio_history_wallet_timestamp: %w", err)
	}

	// Unique constraint to prevent duplicate snapshots
	// A snapshot is considered duplicate if it has the same:
	// - user_id
	// - wallet_id (0 for aggregated)
	// - timestamp (within 1 minute tolerance is handled by application logic)
	// - total_value
	// This is a simpler approach - we'll rely on the CreateSnapshotIfNotDuplicate method
	// to check for existing snapshots with similar values

	log.Println("Portfolio history table created successfully with indexes")
	log.Println("Table schema:")
	log.Println("- id (primary key)")
	log.Println("- user_id (indexed)")
	log.Println("- wallet_id (indexed)")
	log.Println("- timestamp (indexed)")
	log.Println("- total_value")
	log.Println("- total_cost")
	log.Println("- total_pnl")
	log.Println("- currency")
	log.Println("- created_at")
	log.Println("- updated_at")

	// Check existing data
	var count int64
	if err := db.Model(&models.PortfolioHistory{}).Count(&count).Error; err != nil {
		log.Printf("Warning: failed to count existing records: %v", err)
	} else {
		log.Printf("Existing portfolio history records: %d", count)
	}

	return nil
}
