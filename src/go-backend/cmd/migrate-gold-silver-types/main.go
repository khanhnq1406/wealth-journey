package main

import (
	"fmt"
	"log"

	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
)

// Migration mapping for gold types (old -> new)
var goldTypeMigrations = map[string]string{
	"SJL1L10":     "SJC",
	"SJ9999":      "SJC",
	"DOHNL":       "Doji",
	"DOHCML":      "Doji",
	"DOJINHTV":    "Doji_24K",
	"BTSJC":       "BTMC",
	"BT9999NTT":   "BTMC_24K",
	"PQHNVM":      "Doji_24K",
	"PQHN24NTT":   "Doji_24K",
	"VNGSJC":      "VietinGold",
	"VIETTINMSJC": "VietinGold",
}

// Migration mapping for silver types (old -> new)
var silverTypeMigrations = map[string]string{
	"AG_VND_Tael": "ANCARAT_1L",
	"AG_VND_Kg":   "ANCARAT_1KG",
	"AG_VND":      "ANCARAT_1L",
	"XAG":         "XAGUSD",
}

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

	log.Println("Starting gold and silver investment type migration...")

	// Migrate gold investments (type 8 = GOLD_VND, type 9 = GOLD_USD)
	if err := migrateInvestments(db, []int{8, 9}, goldTypeMigrations, "gold"); err != nil {
		log.Fatalf("Gold migration failed: %v", err)
	}

	// Migrate silver investments (type 10 = SILVER_VND, type 11 = SILVER_USD)
	if err := migrateInvestments(db, []int{10, 11}, silverTypeMigrations, "silver"); err != nil {
		log.Fatalf("Silver migration failed: %v", err)
	}

	log.Println("Migration completed successfully!")
}

func migrateInvestments(db *database.Database, types []int, migrations map[string]string, label string) error {
	log.Printf("Migrating %s investments...", label)

	for oldSymbol, newSymbol := range migrations {
		if oldSymbol == newSymbol {
			continue
		}

		result := db.DB.Exec(
			"UPDATE investment SET symbol = ? WHERE symbol = ? AND type IN ?",
			newSymbol, oldSymbol, types,
		)

		if result.Error != nil {
			return fmt.Errorf("update %s -> %s: %w", oldSymbol, newSymbol, result.Error)
		}

		if result.RowsAffected > 0 {
			log.Printf("  Migrated %d %s investments: %s -> %s", result.RowsAffected, label, oldSymbol, newSymbol)
		}
	}

	return nil
}
