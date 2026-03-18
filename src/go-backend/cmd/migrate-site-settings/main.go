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

	if err := migrateSiteSettings(db.DB); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Site settings migration completed successfully!")
}

func migrateSiteSettings(db *gorm.DB) error {
	log.Println("Creating/updating site_settings table...")
	if err := db.AutoMigrate(&models.SiteSetting{}); err != nil {
		return fmt.Errorf("failed to migrate site_settings table: %w", err)
	}
	log.Println("site_settings table migrated")

	log.Println("Seeding initial site settings...")
	seeds := []models.SiteSetting{
		{Key: "seo.title", Value: "congdongvang.com - Track Gold & Silver Prices | Personal Finance Dashboard"},
		{Key: "seo.description", Value: "Monitor live gold and silver prices including SJC, DOJI, and world gold (XAU/USD). Track investments, manage wallets, and build wealth with congdongvang.com's all-in-one personal finance platform."},
		{Key: "seo.keywords", Value: `["gold price tracker","silver price tracker","SJC gold price","vàng SJC","giá vàng hôm nay","giá bạc hôm nay","Vietnamese gold investment","gold investment tracking","silver investment","XAU USD price","personal finance dashboard","investment portfolio tracker","multi-currency portfolio","FIFO accounting","precious metals investment","stock portfolio management","cryptocurrency portfolio","wealth management app","financial freedom tools","congdongvang.com"]`},
		{Key: "seo.og_title", Value: "congdongvang.com - Track Gold & Silver Prices | Personal Finance Dashboard"},
		{Key: "seo.og_description", Value: "Monitor live gold and silver prices including SJC, DOJI, and world gold. Track investments, manage wallets, and build wealth with congdongvang.com."},
		{Key: "seo.og_image", Value: "/og-image.svg"},
		{Key: "seo.og_url", Value: "https://congdongvang.com"},
		{Key: "seo.twitter_card", Value: "summary_large_image"},
		{Key: "seo.twitter_title", Value: "congdongvang.com - Track Gold & Silver Prices | Personal Finance Dashboard"},
		{Key: "seo.twitter_description", Value: "Monitor live gold and silver prices including SJC, DOJI, and world gold. Track investments, manage wallets, and build wealth with congdongvang.com."},
		{Key: "seo.twitter_creator", Value: "@congdongvang"},
		{Key: "seo.robots_index", Value: "true"},
		{Key: "seo.robots_follow", Value: "true"},
		{Key: "seo.canonical", Value: "https://congdongvang.com"},
		{Key: "footer.brand_name", Value: "congdongvang.com"},
		{Key: "footer.tagline", Value: "Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính"},
		{Key: "footer.contact_info", Value: "Liên hệ quảng cáo : 076.897.2512"},
	}

	for _, seed := range seeds {
		result := db.Where("key = ?", seed.Key).FirstOrCreate(&seed)
		if result.Error != nil {
			return fmt.Errorf("failed to seed setting %s: %w", seed.Key, result.Error)
		}
		if result.RowsAffected > 0 {
			log.Printf("  Seeded: %s", seed.Key)
		} else {
			log.Printf("  Already exists: %s", seed.Key)
		}
	}

	log.Printf("Seeded %d site settings", len(seeds))
	return nil
}
