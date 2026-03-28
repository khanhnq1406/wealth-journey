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

// migrateVietcombankCurrency seeds asset_display_config and asset_config_fetch_code
// entries for Vietcombank direct-API currency sources.
//
// Each entry uses a _VCB-suffixed TypeCode (e.g., "USD_VCB") so it occupies a distinct
// row in the (type_code, asset_type) unique index alongside the existing "USD" (Tự Do) entry.
// The fetch code matches the TypeCode exactly — the Vietcombank fetcher stores rows with
// type_code="USD_VCB" in asset_price, which this fetch code resolves to.
//
// Idempotent: existence is checked before each INSERT; re-running produces no duplicates.
func migrateVietcombankCurrency(db *gorm.DB) error {
	log.Println("=== Vietcombank Currency Display Config Migration ===")

	type vcbSeed struct {
		TypeCode     string
		DisplayName  string
		DisplayOrder int32
		Enabled      bool
	}

	vcbSeeds := []vcbSeed{
		{TypeCode: "USD_VCB", DisplayName: "USD Vietcombank (Official)", DisplayOrder: 2, Enabled: true},
		{TypeCode: "EUR_VCB", DisplayName: "EUR Vietcombank", DisplayOrder: 20, Enabled: true},
		{TypeCode: "GBP_VCB", DisplayName: "GBP Vietcombank", DisplayOrder: 21, Enabled: true},
		{TypeCode: "JPY_VCB", DisplayName: "JPY Vietcombank", DisplayOrder: 22, Enabled: true},
		{TypeCode: "CHF_VCB", DisplayName: "CHF Vietcombank", DisplayOrder: 23, Enabled: true},
		{TypeCode: "AUD_VCB", DisplayName: "AUD Vietcombank", DisplayOrder: 24, Enabled: true},
		{TypeCode: "CAD_VCB", DisplayName: "CAD Vietcombank", DisplayOrder: 25, Enabled: true},
		{TypeCode: "SGD_VCB", DisplayName: "SGD Vietcombank", DisplayOrder: 26, Enabled: true},
		{TypeCode: "HKD_VCB", DisplayName: "HKD Vietcombank", DisplayOrder: 27, Enabled: true},
		{TypeCode: "TWD_VCB", DisplayName: "TWD Vietcombank", DisplayOrder: 28, Enabled: true},
		{TypeCode: "KRW_VCB", DisplayName: "KRW Vietcombank", DisplayOrder: 29, Enabled: true},
		{TypeCode: "THB_VCB", DisplayName: "THB Vietcombank", DisplayOrder: 30, Enabled: true},
		{TypeCode: "CNY_VCB", DisplayName: "CNY Vietcombank", DisplayOrder: 31, Enabled: true},
	}

	// Step 1: Seed asset_display_config entries.
	log.Println("Step 1: Seeding asset_display_config entries...")
	for _, seed := range vcbSeeds {
		var count int64
		db.Raw(
			"SELECT COUNT(*) FROM asset_display_config WHERE type_code = ? AND asset_type = 'currency' AND deleted_at IS NULL",
			seed.TypeCode,
		).Scan(&count)

		if count == 0 {
			if err := db.Exec(
				`INSERT INTO asset_display_config (type_code, display_name, display_order, enabled, show_in_investment, asset_type, created_at, updated_at)
				 VALUES (?, ?, ?, ?, false, 'currency', NOW(), NOW())`,
				seed.TypeCode, seed.DisplayName, seed.DisplayOrder, seed.Enabled,
			).Error; err != nil {
				return fmt.Errorf("failed to seed display config for %s: %w", seed.TypeCode, err)
			}
			log.Printf("  Seeded: %s (%s)", seed.TypeCode, seed.DisplayName)
		} else {
			log.Printf("  Exists: %s", seed.TypeCode)
		}
	}

	// Step 2: Seed asset_config_fetch_code entries (one per display config, fetch_code = type_code).
	log.Println("Step 2: Seeding asset_config_fetch_code entries...")
	for _, seed := range vcbSeeds {
		// Look up the config ID for this type_code.
		var configID int64
		db.Raw(
			"SELECT id FROM asset_display_config WHERE type_code = ? AND asset_type = 'currency' AND deleted_at IS NULL LIMIT 1",
			seed.TypeCode,
		).Scan(&configID)

		if configID == 0 {
			log.Printf("  WARNING: no config row found for %s — skipping fetch code", seed.TypeCode)
			continue
		}

		// Check if fetch code already exists.
		var fcCount int64
		db.Raw(
			"SELECT COUNT(*) FROM asset_config_fetch_code WHERE config_id = ? AND type_code = ? AND deleted_at IS NULL",
			configID, seed.TypeCode,
		).Scan(&fcCount)

		if fcCount == 0 {
			if err := db.Exec(
				`INSERT INTO asset_config_fetch_code (config_id, type_code, priority, created_at, updated_at)
				 VALUES (?, ?, 1, NOW(), NOW())`,
				configID, seed.TypeCode,
			).Error; err != nil {
				return fmt.Errorf("failed to seed fetch code for %s: %w", seed.TypeCode, err)
			}
			log.Printf("  Seeded fetch code: config_id=%d type_code=%s", configID, seed.TypeCode)
		} else {
			log.Printf("  Exists fetch code: config_id=%d type_code=%s", configID, seed.TypeCode)
		}
	}

	// Step 3: Set _VCB fetch codes as default (priority 1) for existing standard currency display configs.
	//
	// Standard currency configs seeded by migrate-asset-display-config use plain TypeCodes (e.g. "USD").
	// Their fetch codes currently point to vangsaigon data (e.g. fetch_code="USD").
	// This step adds the corresponding _VCB fetch code at priority 1 (demoting the existing code to
	// priority 2) so that Vietcombank data is used as the default source for those display entries.
	//
	// Mapping: standard display_name → _VCB fetch code
	// Only currencies for which Vietcombank provides data are updated.
	log.Println("Step 3: Setting _VCB fetch codes as default for standard currency display configs...")

	type vcbDefaultSeed struct {
		DisplayName string // matches asset_display_config.display_name for the standard (non-VCB) entry
		VCBFetchCode string // e.g. "USD_VCB"
		PlainCode    string // existing fetch code to demote to priority 2, e.g. "USD"
	}

	vcbDefaultSeeds := []vcbDefaultSeed{
		{DisplayName: "USD Tự Do", VCBFetchCode: "USD_VCB", PlainCode: "USD"},
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
