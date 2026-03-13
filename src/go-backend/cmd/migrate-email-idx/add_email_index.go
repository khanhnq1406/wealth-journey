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

	// Add index on user.email for faster auth lookups
	err = db.DB.Exec(`
		CREATE INDEX IF NOT EXISTS idx_user_email
		ON "user"(email)
		WHERE deleted_at IS NULL
	`).Error

	if err != nil {
		log.Fatalf("Failed to create email index: %v", err)
	}

	log.Println("Email index created successfully")
}