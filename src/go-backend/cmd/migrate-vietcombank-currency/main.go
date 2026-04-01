package main

import (
	"fmt"
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

	if err := migrateVietcombankCurrency(db.DB); err != nil {
		log.Fatalf("Vietcombank currency migration failed: %v", err)
	}

	log.Println("Vietcombank currency migration completed successfully!")
}

// migrateVietcombankCurrency sets _VCB fetch codes as the default (priority 1) source
// for existing standard currency display configs seeded by migrate-asset-display-config.
//
// Standard configs use plain TypeCodes (e.g. "USD"); their fetch codes currently point to
// vangsaigon data. This migration adds the corresponding _VCB fetch code at priority 1
// (demoting the existing code to priority 2) so that Vietcombank data is used by default.
//
// The "USD Internalbank" display config is looked up by display_name and gets "USD_VCB" as
// its sole fetch code at priority 1.
//
// Idempotent: re-running produces no duplicates and only adjusts priorities.
func migrateVietcombankCurrency(db *gorm.DB) error {
	log.Println("=== Vietcombank Currency Display Config Migration ===")

	// Set _VCB fetch codes as default (priority 1) for existing standard currency display configs.
	//
	// Mapping: standard display_name → _VCB fetch code → plain fetch code to demote to priority 2.
	// Only currencies for which Vietcombank provides data are updated.
	log.Println("Setting _VCB fetch codes as default for standard currency display configs...")

	type vcbDefaultSeed struct {
		DisplayName  string // matches asset_display_config.display_name for the standard entry
		VCBFetchCode string // e.g. "USD_VCB"
		PlainCode    string // existing fetch code to demote to priority 2, e.g. "USD"
	}

	vcbDefaultSeeds := []vcbDefaultSeed{
		{DisplayName: "USD Tự Do", VCBFetchCode: "USD_VCB", PlainCode: "USD"},
		{DisplayName: "USD Internalbank", VCBFetchCode: "USD_VCB", PlainCode: "USD Internalbank"},
		{DisplayName: "EUR", VCBFetchCode: "EUR_VCB", PlainCode: "EUR"},
		{DisplayName: "GBP", VCBFetchCode: "GBP_VCB", PlainCode: "GBP"},
		{DisplayName: "JPY", VCBFetchCode: "JPY_VCB", PlainCode: "JPY"},
		{DisplayName: "CHF", VCBFetchCode: "CHF_VCB", PlainCode: "CHF"},
		{DisplayName: "AUD", VCBFetchCode: "AUD_VCB", PlainCode: "AUD"},
		{DisplayName: "CAD", VCBFetchCode: "CAD_VCB", PlainCode: "CAD"},
		{DisplayName: "SGD", VCBFetchCode: "SGD_VCB", PlainCode: "SGD"},
		{DisplayName: "HKD", VCBFetchCode: "HKD_VCB", PlainCode: "HKD"},
		{DisplayName: "TWD", VCBFetchCode: "TWD_VCB", PlainCode: "TWD"},
		{DisplayName: "KRW", VCBFetchCode: "KRW_VCB", PlainCode: "KRW"},
		{DisplayName: "THB", VCBFetchCode: "THB_VCB", PlainCode: "THB"},
		{DisplayName: "CNY", VCBFetchCode: "CNY_VCB", PlainCode: "CNY"},
	}

	for _, s := range vcbDefaultSeeds {
		// Look up the standard config by display_name.
		var configID int64
		db.Raw(
			"SELECT id FROM asset_display_config WHERE display_name = ? AND asset_type = 'currency' AND deleted_at IS NULL LIMIT 1",
			s.DisplayName,
		).Scan(&configID)

		if configID == 0 {
			log.Printf("  WARNING: standard config not found for display_name=%q — skipping", s.DisplayName)
			continue
		}

		// Demote the existing plain fetch code to priority 2 (if present).
		if err := db.Exec(
			`UPDATE asset_config_fetch_code SET priority = 2, updated_at = NOW()
			 WHERE config_id = ? AND type_code = ? AND deleted_at IS NULL`,
			configID, s.PlainCode,
		).Error; err != nil {
			return fmt.Errorf("failed to demote plain fetch code %s for %s: %w", s.PlainCode, s.DisplayName, err)
		}

		// Insert the _VCB fetch code at priority 1, or update it to priority 1 if it already exists.
		var vcbCount int64
		db.Raw(
			"SELECT COUNT(*) FROM asset_config_fetch_code WHERE config_id = ? AND type_code = ? AND deleted_at IS NULL",
			configID, s.VCBFetchCode,
		).Scan(&vcbCount)

		if vcbCount == 0 {
			if err := db.Exec(
				`INSERT INTO asset_config_fetch_code (config_id, type_code, priority, created_at, updated_at)
				 VALUES (?, ?, 1, NOW(), NOW())`,
				configID, s.VCBFetchCode,
			).Error; err != nil {
				return fmt.Errorf("failed to insert VCB fetch code %s for %s: %w", s.VCBFetchCode, s.DisplayName, err)
			}
			log.Printf("  Set VCB default: config_id=%d display=%q fetch_code=%s priority=1", configID, s.DisplayName, s.VCBFetchCode)
		} else {
			if err := db.Exec(
				`UPDATE asset_config_fetch_code SET priority = 1, updated_at = NOW()
				 WHERE config_id = ? AND type_code = ? AND deleted_at IS NULL`,
				configID, s.VCBFetchCode,
			).Error; err != nil {
				return fmt.Errorf("failed to update VCB fetch code priority for %s: %w", s.DisplayName, err)
			}
			log.Printf("  Updated VCB default: config_id=%d display=%q fetch_code=%s priority=1", configID, s.DisplayName, s.VCBFetchCode)
		}
	}

	log.Println("=== Vietcombank Currency Display Config Migration Complete ===")
	return nil
}
