package main

import (
	"fmt"
	"log"

	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
)

func main() {
	fmt.Println("Dropping template tables...")

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

	// Drop tables
	if err := db.DB.Exec("DROP TABLE IF EXISTS user_template CASCADE").Error; err != nil {
		log.Fatalf("Failed to drop user_template: %v", err)
	}
	fmt.Println("✓ Dropped user_template table")

	if err := db.DB.Exec("DROP TABLE IF EXISTS bank_template CASCADE").Error; err != nil {
		log.Fatalf("Failed to drop bank_template: %v", err)
	}
	fmt.Println("✓ Dropped bank_template table")

	fmt.Println("✅ Template tables dropped successfully!")
}
