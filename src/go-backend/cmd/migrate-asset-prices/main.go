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

	if err := migrateAssetPrices(db.DB); err != nil {
		log.Fatalf("Asset prices migration failed: %v", err)
	}

	log.Println("Asset prices migration completed successfully!")
}

func migrateAssetPrices(db *gorm.DB) error {
	log.Println("=== Asset Price Migration ===")

	log.Println("Creating asset_price table...")
	if err := db.AutoMigrate(&models.AssetPrice{}); err != nil {
		return fmt.Errorf("failed to create asset_price table: %w", err)
	}
	log.Println("asset_price table created")

	log.Println("=== Asset Price Migration Complete ===")
	return nil
}
