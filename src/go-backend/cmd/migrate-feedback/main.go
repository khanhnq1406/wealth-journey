package main

import (
	"log"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
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

	log.Println("Running feedback table migration...")

	if err := db.DB.AutoMigrate(&models.Feedback{}); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Feedback table migration completed successfully!")
}
