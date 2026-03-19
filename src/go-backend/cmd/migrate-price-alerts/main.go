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

	if err := migratePriceAlerts(db.DB); err != nil {
		log.Fatalf("Price alerts migration failed: %v", err)
	}

	log.Println("Price alerts migration completed successfully!")
}

func migratePriceAlerts(db *gorm.DB) error {
	log.Println("=== Price Alerts Migration ===")

	// Step 1: Add metadata column to notification table
	log.Println("Adding metadata column to notification table...")
	if err := db.Exec(`ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS metadata JSONB`).Error; err != nil {
		return fmt.Errorf("failed to add metadata column: %w", err)
	}
	log.Println("metadata column added to notification table")

	// Step 2: Create push_subscription table
	log.Println("Creating push_subscription table...")
	if err := db.AutoMigrate(&models.PushSubscription{}); err != nil {
		return fmt.Errorf("failed to create push_subscription table: %w", err)
	}
	log.Println("push_subscription table created")

	log.Println("=== Price Alerts Migration Complete ===")
	return nil
}
