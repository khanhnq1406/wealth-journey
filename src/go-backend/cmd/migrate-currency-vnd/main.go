package main

import (
	"context"
	"fmt"
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

	// Initialize database
	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

	// Run migration
	ctx := context.Background()
	if err := migrateCurrencyToVND(ctx, db); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Migration completed successfully!")
}

func migrateCurrencyToVND(ctx context.Context, db *database.Database) error {
	log.Println("Starting currency migration to VND...")
	log.Println("WARNING: This will convert all wallet currencies from USD to VND")
	log.Println("Note: Amount values will NOT be converted - only the currency code will change")

	// Get all wallets
	var wallets []models.Wallet
	if err := db.DB.WithContext(ctx).Find(&wallets).Error; err != nil {
		return fmt.Errorf("failed to fetch wallets: %w", err)
	}

	log.Printf("Found %d wallets\n", len(wallets))

	updatedCount := 0
	skippedCount := 0

	for _, wallet := range wallets {
		if wallet.Currency == "VND" {
			log.Printf("Skipping wallet %d (%s) - already VND\n", wallet.ID, wallet.WalletName)
			skippedCount++
			continue
		}

		oldCurrency := wallet.Currency
		log.Printf("Updating wallet %d (%s): %s -> VND (balance: %d)\n",
			wallet.ID, wallet.WalletName, oldCurrency, wallet.Balance)

		// Update currency to VND
		if err := db.DB.WithContext(ctx).
			Model(&models.Wallet{}).
			Where("id = ?", wallet.ID).
			Update("currency", "VND").Error; err != nil {
			log.Printf("Error: failed to update wallet %d: %v\n", wallet.ID, err)
			continue
		}

		updatedCount++
	}

	log.Printf("\nMigration summary:\n")
	log.Printf("- Total wallets: %d\n", len(wallets))
	log.Printf("- Wallets updated: %d\n", updatedCount)
	log.Printf("- Wallets skipped: %d\n", skippedCount)

	log.Println("\nIMPORTANT: Balance amounts were NOT converted.")
	log.Println("If you need to convert the actual monetary values, you will need to:")
	log.Println("1. Back up your data")
	log.Println("2. Apply the appropriate exchange rate multiplication")
	log.Println("3. Update transactions accordingly")

	return nil
}
