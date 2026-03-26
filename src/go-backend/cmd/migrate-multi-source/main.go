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

	if err := migrateMultiSource(db.DB); err != nil {
		log.Fatalf("Multi-source migration failed: %v", err)
	}

	log.Println("Multi-source migration completed successfully!")
}

func migrateMultiSource(db *gorm.DB) error {
	log.Println("=== Multi-Source Asset Price Migration ===")

	return db.Transaction(func(tx *gorm.DB) error {
		// 1. Backfill existing rows with source='waterfall' where source is empty.
		//    This must happen before adding the new unique constraint so that
		//    all existing rows satisfy the NOT NULL requirement.
		log.Println("Backfilling source='waterfall' for rows where source is NULL or empty...")
		if err := tx.Exec(
			"UPDATE asset_price SET source = 'waterfall' WHERE source IS NULL OR source = ''",
		).Error; err != nil {
			return fmt.Errorf("backfill source: %w", err)
		}
		log.Println("Backfill complete")

		// 2. Drop the old two-column unique index so AutoMigrate can create
		//    the new three-column index without conflict.
		log.Println("Dropping old unique index idx_asset_price_type_code_currency...")
		if err := tx.Exec(
			"DROP INDEX IF EXISTS idx_asset_price_type_code_currency",
		).Error; err != nil {
			return fmt.Errorf("drop old index: %w", err)
		}
		log.Println("Old index dropped")

		// 3. AutoMigrate applies the new model tags:
		//    - source column becomes NOT NULL DEFAULT 'waterfall'
		//    - new unique index idx_asset_price_type_code_currency_source is created
		log.Println("Running AutoMigrate to apply new unique constraint (type_code, currency, source)...")
		if err := tx.AutoMigrate(&models.AssetPrice{}); err != nil {
			return fmt.Errorf("auto migrate: %w", err)
		}
		log.Println("AutoMigrate complete")

		log.Println("=== Multi-Source Asset Price Migration Complete ===")
		return nil
	})
}
