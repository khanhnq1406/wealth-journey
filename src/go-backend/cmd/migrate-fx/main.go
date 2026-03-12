package main

import (
	"log"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

	log.Println("Starting FX (currency conversion) migration...")

	// Create exchange_rate table
	if err := db.DB.AutoMigrate(&models.ExchangeRate{}); err != nil {
		log.Fatalf("Failed to create exchange_rate table: %v", err)
	}
	log.Println("✓ exchange_rate table created/updated")

	// Add currency conversion columns to transaction table
	// Note: GORM's AutoMigrate will handle adding new columns automatically
	if err := db.DB.AutoMigrate(&models.Transaction{}); err != nil {
		log.Fatalf("Failed to update transaction table: %v", err)
	}
	log.Println("✓ Transaction table updated with currency conversion columns")

	// Create composite index for efficient exchange rate lookups
	if err := db.DB.Exec(`
		CREATE INDEX IF NOT EXISTS idx_fx_rate
		ON exchange_rate(from_currency, to_currency, rate_date)
	`).Error; err != nil {
		log.Fatalf("Failed to create index: %v", err)
	}
	log.Println("✓ Created composite index idx_fx_rate")

	log.Println("✓ FX migration completed successfully")
}
