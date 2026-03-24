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

	if err := migrateUserPriceAlerts(db.DB); err != nil {
		log.Fatalf("User price alerts migration failed: %v", err)
	}

	log.Println("User price alerts migration completed successfully!")
}

func migrateUserPriceAlerts(db *gorm.DB) error {
	log.Println("=== User Price Alerts Migration ===")

	log.Println("Creating user_price_alert table...")
	if err := db.AutoMigrate(&models.UserPriceAlert{}); err != nil {
		return fmt.Errorf("failed to create user_price_alert table: %w", err)
	}
	log.Println("user_price_alert table created")

	log.Println("=== User Price Alerts Migration Complete ===")
	return nil
}
