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
	defer db.Close()

	log.Println("Starting migration: Add preferred_language column to user table")

	// Add preferred_language column (idempotent - only if column doesn't exist)
	log.Println("Adding preferred_language column...")
	err = db.DB.Exec(`
		ALTER TABLE "user"
		ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) NOT NULL DEFAULT 'vi'
	`).Error

	if err != nil {
		log.Fatalf("Failed to add preferred_language column: %v", err)
	}

	log.Println("Added preferred_language column (or already exists)")

	// Create index on preferred_language for query performance
	log.Println("Creating idx_user_preferred_language...")
	err = db.DB.Exec(`
		CREATE INDEX IF NOT EXISTS idx_user_preferred_language ON "user"(preferred_language)
	`).Error

	if err != nil {
		log.Fatalf("Failed to create preferred_language index: %v", err)
	}

	log.Println("idx_user_preferred_language created (or already exists)")

	// Verify the column was added
	var count int64
	err = db.DB.Raw(`
		SELECT COUNT(*) FROM information_schema.columns
		WHERE table_name = 'user' AND column_name = 'preferred_language'
	`).Scan(&count).Error

	if err != nil {
		log.Fatalf("Failed to verify preferred_language column: %v", err)
	}

	if count == 0 {
		log.Fatalf("Verification failed: preferred_language column not found in user table")
	}

	log.Println("Verified: preferred_language column exists in user table")
	log.Println("Migration completed successfully")
}
