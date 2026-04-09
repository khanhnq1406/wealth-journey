package main

import (
	"log"

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

	if err := migrateCurrencyInvestment(db.DB); err != nil {
		log.Fatalf("Currency show_in_investment migration failed: %v", err)
	}

	log.Println("Currency show_in_investment migration completed successfully!")
}

// migrateCurrencyInvestment sets show_in_investment = true for all enabled currency
// asset_display_config rows so that currency assets appear in the investment form dropdown.
//
// Idempotent: UPDATE WHERE is naturally safe to run multiple times.
// Running on a fresh DB (no currency rows) results in 0 rows updated — no error.
func migrateCurrencyInvestment(db *gorm.DB) error {
	log.Println("=== Currency show_in_investment Migration ===")
	log.Println("Setting show_in_investment = true for all enabled currency display configs...")

	result := db.Exec(
		"UPDATE asset_display_config SET show_in_investment = true, updated_at = NOW() WHERE asset_type = 'currency' AND enabled = true AND deleted_at IS NULL",
	)
	if result.Error != nil {
		return result.Error
	}

	log.Printf("  Rows updated: %d", result.RowsAffected)
	log.Println("=== Currency show_in_investment Migration Complete ===")
	return nil
}
