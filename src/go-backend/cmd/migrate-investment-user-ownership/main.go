package main

import (
	"context"
	"flag"
	"log"

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
	sqlDB := db.DB.WithContext(ctx)

	log.Println("=== Investment User Ownership Migration ===")
	if *dryRun {
		log.Println("[DRY RUN] No changes will be made.")
	}

	// ========== INVESTMENT TABLE ==========
	log.Println("\n--- Phase 1: Add user_id column to investment table ---")
	var investmentCount int64
	sqlDB.Raw("SELECT COUNT(*) FROM investment WHERE deleted_at IS NULL").Scan(&investmentCount)
	log.Printf("Total active investments: %d", investmentCount)

	if !*dryRun {
		if err := sqlDB.Exec("ALTER TABLE investment ADD COLUMN IF NOT EXISTS user_id INT NOT NULL DEFAULT 0").Error; err != nil {
			log.Fatalf("Failed to add user_id column to investment: %v", err)
		}
		log.Println("Added user_id column to investment table")
	}

	log.Println("\n--- Phase 2: Backfill user_id from wallet relationship ---")
	var backfillCount int64
	sqlDB.Raw("SELECT COUNT(*) FROM investment i JOIN wallet w ON w.id = i.wallet_id WHERE i.user_id = 0 AND i.deleted_at IS NULL").Scan(&backfillCount)
	log.Printf("Investments to backfill: %d", backfillCount)

	if !*dryRun {
		result := sqlDB.Exec("UPDATE investment SET user_id = w.user_id FROM wallet w WHERE w.id = investment.wallet_id AND investment.user_id = 0")
		if result.Error != nil {
			log.Fatalf("Failed to backfill user_id on investment: %v", result.Error)
		}
		log.Printf("Backfilled %d investments with user_id", result.RowsAffected)
	}

	log.Println("\n--- Phase 3: Verify no orphaned investments ---")
	var orphanedCount int64
	sqlDB.Raw("SELECT COUNT(*) FROM investment WHERE user_id = 0 AND deleted_at IS NULL").Scan(&orphanedCount)
	log.Printf("Investments with user_id=0 (should be 0): %d", orphanedCount)
	if orphanedCount > 0 && !*dryRun {
		log.Fatalf("ABORT: %d investments still have user_id=0 after backfill. Manual intervention required.", orphanedCount)
	}

	log.Println("\n--- Phase 4: Make wallet_id nullable on investment ---")
	if !*dryRun {
		if err := sqlDB.Exec("ALTER TABLE investment ALTER COLUMN wallet_id DROP NOT NULL").Error; err != nil {
			log.Printf("Warning: wallet_id may already be nullable: %v", err)
		} else {
			log.Println("Made wallet_id nullable on investment table")
		}
	}

	log.Println("\n--- Phase 5: Create indexes on investment ---")
	if !*dryRun {
		if err := sqlDB.Exec("CREATE INDEX IF NOT EXISTS idx_investment_user ON investment(user_id)").Error; err != nil {
			log.Printf("Warning: index may already exist: %v", err)
		}
		if err := sqlDB.Exec("CREATE INDEX IF NOT EXISTS idx_investment_user_type ON investment(user_id, type)").Error; err != nil {
			log.Printf("Warning: index may already exist: %v", err)
		}
		log.Println("Created indexes on investment table")
	}

	// ========== INVESTMENT_TRANSACTION TABLE ==========
	log.Println("\n--- Phase 6: Add user_id column to investment_transaction table ---")
	var txCount int64
	sqlDB.Raw("SELECT COUNT(*) FROM investment_transaction WHERE deleted_at IS NULL").Scan(&txCount)
	log.Printf("Total active investment transactions: %d", txCount)

	if !*dryRun {
		if err := sqlDB.Exec("ALTER TABLE investment_transaction ADD COLUMN IF NOT EXISTS user_id INT NOT NULL DEFAULT 0").Error; err != nil {
			log.Fatalf("Failed to add user_id column to investment_transaction: %v", err)
		}
		log.Println("Added user_id column to investment_transaction table")
	}

	log.Println("\n--- Phase 7: Backfill user_id on investment_transaction from wallet ---")
	var txBackfillCount int64
	sqlDB.Raw("SELECT COUNT(*) FROM investment_transaction it JOIN wallet w ON w.id = it.wallet_id WHERE it.user_id = 0 AND it.deleted_at IS NULL").Scan(&txBackfillCount)
	log.Printf("Investment transactions to backfill: %d", txBackfillCount)

	if !*dryRun {
		result := sqlDB.Exec("UPDATE investment_transaction SET user_id = w.user_id FROM wallet w WHERE w.id = investment_transaction.wallet_id AND investment_transaction.user_id = 0")
		if result.Error != nil {
			log.Fatalf("Failed to backfill user_id on investment_transaction: %v", result.Error)
		}
		log.Printf("Backfilled %d investment transactions with user_id", result.RowsAffected)
	}

	log.Println("\n--- Phase 8: Verify no orphaned investment transactions ---")
	var txOrphanedCount int64
	sqlDB.Raw("SELECT COUNT(*) FROM investment_transaction WHERE user_id = 0 AND deleted_at IS NULL").Scan(&txOrphanedCount)
	log.Printf("Investment transactions with user_id=0 (should be 0): %d", txOrphanedCount)
	if txOrphanedCount > 0 && !*dryRun {
		log.Fatalf("ABORT: %d investment transactions still have user_id=0 after backfill.", txOrphanedCount)
	}

	log.Println("\n--- Phase 9: Make wallet_id nullable on investment_transaction ---")
	if !*dryRun {
		if err := sqlDB.Exec("ALTER TABLE investment_transaction ALTER COLUMN wallet_id DROP NOT NULL").Error; err != nil {
			log.Printf("Warning: wallet_id may already be nullable: %v", err)
		} else {
			log.Println("Made wallet_id nullable on investment_transaction table")
		}
	}

	log.Println("\n--- Phase 10: Create indexes on investment_transaction ---")
	if !*dryRun {
		if err := sqlDB.Exec("CREATE INDEX IF NOT EXISTS idx_investment_tx_user ON investment_transaction(user_id)").Error; err != nil {
			log.Printf("Warning: index may already exist: %v", err)
		}
		log.Println("Created indexes on investment_transaction table")
	}

	log.Println("\n=== Migration Summary ===")
	log.Printf("Investment: %d total, %d backfilled, %d orphaned", investmentCount, backfillCount, orphanedCount)
	log.Printf("InvestmentTransaction: %d total, %d backfilled, %d orphaned", txCount, txBackfillCount, txOrphanedCount)

	if *dryRun {
		log.Println("\n[DRY RUN] No changes were made. Run with -dry-run=false to apply changes.")
	} else {
		log.Println("\nMigration completed successfully!")
	}
}
