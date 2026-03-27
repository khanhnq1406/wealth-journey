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

	if err := migrateAssetConfigFetchCode(db.DB); err != nil {
		log.Fatalf("Asset config fetch code migration failed: %v", err)
	}

	log.Println("Asset config fetch code migration completed successfully!")
}

func migrateAssetConfigFetchCode(db *gorm.DB) error {
	log.Println("=== Asset Config Fetch Code Migration ===")

	// Check whether asset_display_config exists — this migration depends on it.
	// Log a warning if it does not exist but do NOT fail; the table creation
	// below does not reference it at the DDL level so it can still succeed.
	var configTableExists bool
	row := db.Raw(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public'
			  AND table_name   = 'asset_display_config'
		)
	`).Row()
	if err := row.Scan(&configTableExists); err != nil {
		log.Printf("WARNING: could not check for asset_display_config table: %v", err)
	} else if !configTableExists {
		log.Println("WARNING: asset_display_config table does not exist yet — seed data will be skipped")
	}

	// -----------------------------------------------------------------------
	// 1. Create asset_config_fetch_code table
	// -----------------------------------------------------------------------
	log.Println("Creating asset_config_fetch_code table...")
	err := db.Exec(`
		CREATE TABLE IF NOT EXISTS asset_config_fetch_code (
			id         SERIAL PRIMARY KEY,
			config_id  INTEGER NOT NULL,
			type_code  VARCHAR(50) NOT NULL,
			priority   INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ,
			updated_at TIMESTAMPTZ,
			deleted_at TIMESTAMPTZ,
			CONSTRAINT idx_asset_config_fetch_code_unique UNIQUE (config_id, type_code)
		)
	`).Error
	if err != nil {
		log.Fatalf("Failed to create asset_config_fetch_code table: %v", err)
	}
	log.Println("asset_config_fetch_code table created (or already exists)")

	// -----------------------------------------------------------------------
	// 2. Add foreign key constraint referencing asset_display_config (if table
	//    exists). Wrapped in IF NOT EXISTS guard via a DO block so it is safe
	//    to re-run.
	// -----------------------------------------------------------------------
	if configTableExists {
		log.Println("Adding foreign key constraint asset_config_fetch_code.config_id → asset_display_config.id ...")
		err = db.Exec(`
			DO $$
			BEGIN
				IF NOT EXISTS (
					SELECT 1 FROM information_schema.table_constraints
					WHERE constraint_name = 'fk_asset_config_fetch_code_config'
					  AND table_name      = 'asset_config_fetch_code'
				) THEN
					ALTER TABLE asset_config_fetch_code
					ADD CONSTRAINT fk_asset_config_fetch_code_config
					FOREIGN KEY (config_id) REFERENCES asset_display_config(id) ON DELETE CASCADE;
				END IF;
			END
			$$
		`).Error
		if err != nil {
			log.Fatalf("Failed to add foreign key constraint: %v", err)
		}
		log.Println("Foreign key constraint ensured")
	}

	// -----------------------------------------------------------------------
	// 3. Add index on config_id
	// -----------------------------------------------------------------------
	log.Println("Creating index idx_asset_config_fetch_code_config_id ...")
	err = db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_asset_config_fetch_code_config_id
		ON asset_config_fetch_code(config_id)
	`).Error
	if err != nil {
		log.Fatalf("Failed to create config_id index: %v", err)
	}
	log.Println("Index idx_asset_config_fetch_code_config_id ensured")

	// -----------------------------------------------------------------------
	// 4. Seed default fetch codes — only when asset_display_config exists
	// -----------------------------------------------------------------------
	if !configTableExists {
		log.Println("Skipping seed data — asset_display_config does not exist")
		log.Println("=== Asset Config Fetch Code Migration Complete (no seed) ===")
		return nil
	}

	log.Println("Seeding default fetch codes for gold display configs...")

	// Each entry: display_name, asset_type, fetch_code, priority
	// display_name is used to look up the config_id from asset_display_config.
	// ON CONFLICT DO NOTHING makes the INSERT idempotent.
	seeds := []struct {
		DisplayName string
		AssetType   string
		FetchCode   string
		Priority    int
	}{
		// SJC
		{"SJC", "gold", "SJC", 1},
		{"SJC", "gold", "SJC_1L10", 2},
		// SJC TD
		{"SJC Tự Do", "gold", "SJC TD", 1},
		// Nhẫn SJC 9999
		{"Nhẫn SJC 9999", "gold", "Nhẫn SJC 9999", 1},
		{"Nhẫn SJC 9999", "gold", "SJC_NHAN_999", 2},
		// Nhẫn Doji 9999
		{"Nhẫn Doji 9999", "gold", "Nhẫn Doji 9999", 1},
		{"Nhẫn Doji 9999", "gold", "DOJI_NHAN_999", 2},
		// SJC Mi Hồng
		{"SJC Mi Hồng", "gold", "SJC Mi Hồng", 1},
		// Nhẫn Mi Hồng 9999
		{"Nhẫn Mi Hồng 9999", "gold", "Nhẫn Mi Hồng 9999", 1},
		// SJC BTMC
		{"SJC BTMC", "gold", "SJC BTMC", 1},
		{"SJC BTMC", "gold", "BTMC_VANG_MIENG", 2},
		// Nhẫn BTMC
		{"Nhẫn BTMC", "gold", "Nhẫn BTMC", 1},
		{"Nhẫn BTMC", "gold", "BTMC_NHAN_999", 2},
		// PNJ
		{"PNJ", "gold", "PNJ", 1},
		{"PNJ", "gold", "PNJ_SJC", 2},
	}

	for _, s := range seeds {
		result := db.Exec(`
			INSERT INTO asset_config_fetch_code (config_id, type_code, priority, created_at, updated_at)
			SELECT adc.id, ?, ?, NOW(), NOW()
			FROM asset_display_config adc
			WHERE adc.display_name = ?
			  AND adc.asset_type   = ?
			  AND adc.deleted_at IS NULL
			ON CONFLICT ON CONSTRAINT idx_asset_config_fetch_code_unique DO NOTHING
		`, s.FetchCode, s.Priority, s.DisplayName, s.AssetType)
		if result.Error != nil {
			log.Fatalf("Failed to seed fetch code '%s' for '%s': %v", s.FetchCode, s.DisplayName, result.Error)
		}
		if result.RowsAffected > 0 {
			log.Printf("  Seeded: [%s / %s] fetch_code=%s priority=%d", s.AssetType, s.DisplayName, s.FetchCode, s.Priority)
		} else {
			log.Printf("  Exists or no config found: [%s / %s] fetch_code=%s", s.AssetType, s.DisplayName, s.FetchCode)
		}
	}

	log.Println("=== Asset Config Fetch Code Migration Complete ===")
	return nil
}
