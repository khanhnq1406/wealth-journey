package main

import (
	"context"
	"flag"
	"log"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
)

func main() {
	dryRun := flag.Bool("dry-run", true, "Run without making changes")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	ctx := context.Background()

	// Find all INVESTMENT wallets (type = 1) that are not soft-deleted
	var wallets []models.Wallet
	if err := db.DB.WithContext(ctx).Where("type = ? AND deleted_at IS NULL", 1).Find(&wallets).Error; err != nil {
		log.Fatalf("Failed to query investment wallets: %v", err)
	}

	log.Printf("Found %d INVESTMENT wallets to convert to BASIC", len(wallets))
	for _, w := range wallets {
		log.Printf("  Wallet ID=%d, UserID=%d, Name=%s, Balance=%d %s",
			w.ID, w.UserID, w.WalletName, w.Balance, w.Currency)
	}

	if *dryRun {
		log.Println("\n[DRY RUN] No changes were made. Run with -dry-run=false to apply changes.")
		return
	}

	result := db.DB.WithContext(ctx).Model(&models.Wallet{}).
		Where("type = ? AND deleted_at IS NULL", 1).
		Update("type", 0)
	if result.Error != nil {
		log.Fatalf("Migration failed: %v", result.Error)
	}
	log.Printf("Successfully converted %d wallets from INVESTMENT to BASIC", result.RowsAffected)
}
