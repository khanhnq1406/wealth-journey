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

	if err := migrateAssetDisplayConfig(db.DB); err != nil {
		log.Fatalf("Asset display config migration failed: %v", err)
	}

	log.Println("Asset display config migration completed successfully!")
}

func migrateAssetDisplayConfig(db *gorm.DB) error {
	log.Println("=== Asset Display Config Migration ===")

	// Step 1: Rename table gold_display_config → asset_display_config (idempotent)
	log.Println("Step 1: Renaming table gold_display_config → asset_display_config (if needed)...")
	var oldTableExists int64
	db.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'gold_display_config'").Scan(&oldTableExists)
	var newTableExists int64
	db.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'asset_display_config'").Scan(&newTableExists)

	if oldTableExists > 0 && newTableExists == 0 {
		if err := db.Exec("ALTER TABLE gold_display_config RENAME TO asset_display_config").Error; err != nil {
			return fmt.Errorf("failed to rename table: %w", err)
		}
		log.Println("  Table renamed: gold_display_config → asset_display_config")
	} else if newTableExists > 0 {
		log.Println("  Table asset_display_config already exists, skipping rename")
	} else {
		// Neither table exists — create asset_display_config fresh
		log.Println("  Neither table exists; creating asset_display_config fresh...")
		createSQL := `
			CREATE TABLE asset_display_config (
				id SERIAL PRIMARY KEY,
				type_code VARCHAR(50) NOT NULL,
				display_name VARCHAR(100) NOT NULL,
				display_order INTEGER NOT NULL DEFAULT 0,
				enabled BOOLEAN NOT NULL DEFAULT TRUE,
				show_in_investment BOOLEAN NOT NULL DEFAULT TRUE,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				deleted_at TIMESTAMPTZ
			)
		`
		if err := db.Exec(createSQL).Error; err != nil {
			return fmt.Errorf("failed to create asset_display_config table: %w", err)
		}
		log.Println("  Table asset_display_config created")
	}

	// Step 2: Add asset_type column if it doesn't exist
	log.Println("Step 2: Adding asset_type column (if needed)...")
	var colExists int64
	db.Raw("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'asset_display_config' AND column_name = 'asset_type'").Scan(&colExists)
	if colExists == 0 {
		if err := db.Exec("ALTER TABLE asset_display_config ADD COLUMN asset_type VARCHAR(20) NOT NULL DEFAULT 'gold'").Error; err != nil {
			return fmt.Errorf("failed to add asset_type column: %w", err)
		}
		log.Println("  Column asset_type added with DEFAULT 'gold'")
	} else {
		log.Println("  Column asset_type already exists, skipping")
	}

	// Step 3: Drop old unique index idx_gold_display_config_type_code (if it exists)
	log.Println("Step 3: Dropping old unique index idx_gold_display_config_type_code (if needed)...")
	var oldIdxExists int64
	db.Raw("SELECT COUNT(*) FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'asset_display_config' AND indexname = 'idx_gold_display_config_type_code'").Scan(&oldIdxExists)
	if oldIdxExists > 0 {
		if err := db.Exec("DROP INDEX IF EXISTS idx_gold_display_config_type_code").Error; err != nil {
			return fmt.Errorf("failed to drop old unique index: %w", err)
		}
		log.Println("  Index idx_gold_display_config_type_code dropped")
	} else {
		log.Println("  Old index not found, skipping drop")
	}

	// Step 4: Create new composite unique index on (type_code, asset_type)
	log.Println("Step 4: Creating composite unique index idx_asset_display_config_type_code_asset_type (if needed)...")
	var newIdxExists int64
	db.Raw("SELECT COUNT(*) FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'asset_display_config' AND indexname = 'idx_asset_display_config_type_code_asset_type'").Scan(&newIdxExists)
	if newIdxExists == 0 {
		if err := db.Exec("CREATE UNIQUE INDEX idx_asset_display_config_type_code_asset_type ON asset_display_config (type_code, asset_type) WHERE deleted_at IS NULL").Error; err != nil {
			return fmt.Errorf("failed to create composite unique index: %w", err)
		}
		log.Println("  Index idx_asset_display_config_type_code_asset_type created")
	} else {
		log.Println("  Index already exists, skipping")
	}

	// Step 5: Seed silver display entries (if not exists)
	log.Println("Step 5: Seeding silver display config entries...")
	type seedEntry struct {
		TypeCode         string
		DisplayName      string
		DisplayOrder     int32
		Enabled          bool
		ShowInInvestment bool
		AssetType        string
	}

	// Silver type codes derived from silver_price_service.go toTypeCode() function
	// applied to the orderedNames list in FetchAllPrices().
	// Vietnamese characters are dropped by toTypeCode (only ASCII a-z/A-Z/0-9 kept).
	silverSeeds := []seedEntry{
		{TypeCode: "PH_QU_THI_1L", DisplayName: "Phú Quý thỏi 1L", DisplayOrder: 1, Enabled: true, ShowInInvestment: true, AssetType: "silver"},
		{TypeCode: "PH_QU_THI_5L_10L", DisplayName: "Phú Quý thỏi 5L,10L", DisplayOrder: 2, Enabled: true, ShowInInvestment: false, AssetType: "silver"},
		{TypeCode: "PH_QU_999_-_1KG", DisplayName: "Phú Quý 999 - 1Kg", DisplayOrder: 3, Enabled: true, ShowInInvestment: false, AssetType: "silver"},
		{TypeCode: "BC_M_NGH_PH_QU", DisplayName: "Bạc Mỹ nghệ Phú Quý", DisplayOrder: 4, Enabled: true, ShowInInvestment: false, AssetType: "silver"},
		{TypeCode: "ANCARAT_NGN_LONG_1L", DisplayName: "Ancarat Ngân Long 1L", DisplayOrder: 5, Enabled: true, ShowInInvestment: true, AssetType: "silver"},
		{TypeCode: "ANCARAT_NGN_LONG_5L", DisplayName: "Ancarat Ngân Long 5L", DisplayOrder: 6, Enabled: true, ShowInInvestment: false, AssetType: "silver"},
		{TypeCode: "ANCARAT_NGN_LONG_1KG", DisplayName: "Ancarat Ngân Long 1kg", DisplayOrder: 7, Enabled: true, ShowInInvestment: false, AssetType: "silver"},
		{TypeCode: "ANCARAT_THI_999_-_1KG", DisplayName: "Ancarat thỏi 999 - 1kg", DisplayOrder: 8, Enabled: true, ShowInInvestment: false, AssetType: "silver"},
		{TypeCode: "SBJ_1L_10L_50L", DisplayName: "SBJ 1L,10L,50L", DisplayOrder: 9, Enabled: true, ShowInInvestment: false, AssetType: "silver"},
		{TypeCode: "SBJ_1KG", DisplayName: "SBJ 1kg", DisplayOrder: 10, Enabled: true, ShowInInvestment: false, AssetType: "silver"},
		{TypeCode: "DOJI_99.9_1L", DisplayName: "DOJI 99.9 1L", DisplayOrder: 11, Enabled: true, ShowInInvestment: true, AssetType: "silver"},
		{TypeCode: "DOJI_99.9_5L", DisplayName: "DOJI 99.9 5L", DisplayOrder: 12, Enabled: true, ShowInInvestment: false, AssetType: "silver"},
		{TypeCode: "XAGUSD", DisplayName: "Silver World (XAG/USD)", DisplayOrder: 13, Enabled: true, ShowInInvestment: true, AssetType: "silver"},
	}

	for _, seed := range silverSeeds {
		var count int64
		db.Raw(
			"SELECT COUNT(*) FROM asset_display_config WHERE type_code = ? AND asset_type = ? AND deleted_at IS NULL",
			seed.TypeCode, seed.AssetType,
		).Scan(&count)

		if count == 0 {
			err := db.Exec(
				`INSERT INTO asset_display_config (type_code, display_name, display_order, enabled, show_in_investment, asset_type, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
				seed.TypeCode, seed.DisplayName, seed.DisplayOrder, seed.Enabled, seed.ShowInInvestment, seed.AssetType,
			).Error
			if err != nil {
				return fmt.Errorf("failed to seed silver entry %s: %w", seed.TypeCode, err)
			}
			log.Printf("  Seeded: %s (%s) [%s]", seed.TypeCode, seed.DisplayName, seed.AssetType)
		} else {
			log.Printf("  Exists: %s [%s]", seed.TypeCode, seed.AssetType)
		}
	}

	log.Println("=== Asset Display Config Migration Complete ===")
	return nil
}
