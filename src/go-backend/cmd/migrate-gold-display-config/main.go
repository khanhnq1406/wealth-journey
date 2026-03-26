package main

import (
	"fmt"
	"log"

	"wealthjourney/domain/models"
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

	if err := migrateGoldDisplayConfig(db.DB); err != nil {
		log.Fatalf("Gold display config migration failed: %v", err)
	}

	log.Println("Gold display config migration completed successfully!")
}

func migrateGoldDisplayConfig(db *gorm.DB) error {
	log.Println("=== Gold Display Config Migration ===")

	log.Println("Creating gold_display_config table...")
	if err := db.AutoMigrate(&models.GoldDisplayConfig{}); err != nil {
		return fmt.Errorf("failed to create gold_display_config table: %w", err)
	}
	log.Println("gold_display_config table created")

	// Seed data — matches current frontend GOLD_TABLE_FILTER constants
	seeds := []models.GoldDisplayConfig{
		{TypeCode: "SJC", DisplayName: "SJC", DisplayOrder: 1, Enabled: true, ShowInInvestment: true},
		{TypeCode: "SJC TD", DisplayName: "SJC Tự Do", DisplayOrder: 2, Enabled: true, ShowInInvestment: false},
		{TypeCode: "Vàng nhẫn SJC", DisplayName: "Nhẫn SJC 9999", DisplayOrder: 3, Enabled: true, ShowInInvestment: true},
		{TypeCode: "Doji_24K", DisplayName: "Nhẫn Doji 9999", DisplayOrder: 4, Enabled: true, ShowInInvestment: true},
		{TypeCode: "Mi hồng", DisplayName: "SJC Mi Hồng", DisplayOrder: 5, Enabled: true, ShowInInvestment: true},
		{TypeCode: "Mihong_999", DisplayName: "Nhẫn Mi Hồng 9999", DisplayOrder: 6, Enabled: true, ShowInInvestment: true},
		{TypeCode: "BTMC", DisplayName: "SJC BTMC", DisplayOrder: 7, Enabled: true, ShowInInvestment: true},
		{TypeCode: "BTMC_24K", DisplayName: "Nhẫn BTMC", DisplayOrder: 8, Enabled: true, ShowInInvestment: true},
		{TypeCode: "PNJ HCM", DisplayName: "PNJ", DisplayOrder: 9, Enabled: true, ShowInInvestment: true},
	}

	log.Println("Seeding gold display config entries...")
	for _, seed := range seeds {
		result := db.Where("type_code = ?", seed.TypeCode).FirstOrCreate(&seed)
		if result.Error != nil {
			return fmt.Errorf("failed to seed %s: %w", seed.TypeCode, result.Error)
		}
		if result.RowsAffected > 0 {
			log.Printf("  Seeded: %s (%s)", seed.TypeCode, seed.DisplayName)
		} else {
			log.Printf("  Exists: %s", seed.TypeCode)
		}
	}

	log.Println("=== Gold Display Config Migration Complete ===")
	return nil
}
