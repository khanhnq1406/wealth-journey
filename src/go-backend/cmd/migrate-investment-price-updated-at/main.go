package main

import (
	"log"

	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
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

	log.Println("Starting migration: Add price_updated_at column to investment table")

	// Add price_updated_at column (idempotent - only if column doesn't exist)
	// Nullable with no default — existing rows get NULL (indicating "never updated from market data")
	err = db.DB.Exec(`
		ALTER TABLE investment
		ADD COLUMN IF NOT EXISTS price_updated_at TIMESTAMPTZ
	`).Error

	if err != nil {
		log.Fatalf("Failed to add price_updated_at column: %v", err)
	}

	log.Println("Added price_updated_at column (or already exists)")

	// Add comment to the column (PostgreSQL syntax)
	err = db.DB.Exec(`
		COMMENT ON COLUMN investment.price_updated_at IS 'Timestamp of last successful market price update for this investment; NULL means never updated from market data'
	`).Error

	if err != nil {
		log.Fatalf("Failed to add comment to price_updated_at column: %v", err)
	}

	log.Println("Added comment to price_updated_at column")
	log.Println("Migration completed successfully")
}
