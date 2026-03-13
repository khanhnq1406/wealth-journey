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

	log.Println("Starting profile URL size migration...")

	if err := migrateProfileURLSize(db.DB); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Profile URL size migration completed successfully")
}

func migrateProfileURLSize(db *gorm.DB) error {
	log.Println("Expanding picture column from VARCHAR(255) to VARCHAR(2048)...")
	if err := db.Exec(`ALTER TABLE "user" ALTER COLUMN picture TYPE VARCHAR(2048)`).Error; err != nil {
		return err
	}
	log.Println("  picture column expanded to VARCHAR(2048)")

	log.Println("Expanding cover_photo_url column from VARCHAR(500) to VARCHAR(2048)...")
	if err := db.Exec(`ALTER TABLE "user" ALTER COLUMN cover_photo_url TYPE VARCHAR(2048)`).Error; err != nil {
		return err
	}
	log.Println("  cover_photo_url column expanded to VARCHAR(2048)")

	return nil
}
