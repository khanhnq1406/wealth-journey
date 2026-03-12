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

	log.Println("Starting migration: Add purchase_unit column to investment table")

	// Add purchase_unit column (idempotent - only if column doesn't exist)
	err = db.DB.Exec(`
		ALTER TABLE investment
		ADD COLUMN IF NOT EXISTS purchase_unit VARCHAR(10) DEFAULT 'gram'
	`).Error

	if err != nil {
		log.Fatalf("Failed to add purchase_unit column: %v", err)
	}

	log.Println("✓ Added purchase_unit column (or already exists)")

	// Backfill existing gold investments
	// Gold VND: default to tael display
	err = db.DB.Exec(`
		UPDATE investment
		SET purchase_unit = 'tael'
		WHERE type = 8 AND (purchase_unit IS NULL OR purchase_unit = 'gram')
	`).Error

	if err != nil {
		log.Fatalf("Failed to backfill gold VND: %v", err)
	}

	log.Println("✓ Backfilled gold VND investments with 'tael'")

	// Gold USD: default to oz display
	err = db.DB.Exec(`
		UPDATE investment
		SET purchase_unit = 'oz'
		WHERE type = 9 AND (purchase_unit IS NULL OR purchase_unit = 'gram')
	`).Error

	if err != nil {
		log.Fatalf("Failed to backfill gold USD: %v", err)
	}

	log.Println("✓ Backfilled gold USD investments with 'oz'")

	log.Println("Migration completed successfully")
}
