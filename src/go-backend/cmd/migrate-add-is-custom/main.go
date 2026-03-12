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

	log.Println("Starting migration: Add is_custom column to investment table")

	// Add is_custom column (idempotent - only if column doesn't exist)
	err = db.DB.Exec(`
		ALTER TABLE investment
		ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE
	`).Error

	if err != nil {
		log.Fatalf("Failed to add is_custom column: %v", err)
	}

	log.Println("✓ Added is_custom column (or already exists)")

	// Add comment to the column (PostgreSQL syntax)
	err = db.DB.Exec(`
		COMMENT ON COLUMN investment.is_custom IS 'True if investment was created with isCustom=true (manual entry, no market data validation)'
	`).Error

	if err != nil {
		log.Fatalf("Failed to add comment to is_custom column: %v", err)
	}

	log.Println("✓ Added comment to is_custom column")
	log.Println("Migration completed successfully")
}
