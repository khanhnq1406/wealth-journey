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
	defer db.Close()

	if err := dropTopicTag(db.DB); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Drop topic_tag migration completed successfully!")
}

func dropTopicTag(db *gorm.DB) error {
	log.Println("Dropping topic_tag column from post table...")
	if err := db.Exec(`ALTER TABLE post DROP COLUMN IF EXISTS topic_tag`).Error; err != nil {
		return fmt.Errorf("failed to drop topic_tag column: %w", err)
	}
	log.Println("✓ topic_tag column removed from post table")
	return nil
}
