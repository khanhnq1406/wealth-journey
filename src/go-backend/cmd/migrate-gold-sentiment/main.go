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

	if err := migrateGoldSentiment(db.DB); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Gold sentiment migration completed successfully!")
}

func migrateGoldSentiment(db *gorm.DB) error {
	log.Println("Creating gold_vote table...")
	if err := db.AutoMigrate(&models.GoldVote{}); err != nil {
		return fmt.Errorf("failed to create gold_vote table: %w", err)
	}
	log.Println("gold_vote table created")

	log.Println("Creating gold_vote_comment table...")
	if err := db.AutoMigrate(&models.GoldVoteComment{}); err != nil {
		return fmt.Errorf("failed to create gold_vote_comment table: %w", err)
	}
	log.Println("gold_vote_comment table created")

	// Add CHECK constraint for comment content length
	if err := db.Exec(`
		DO $$ BEGIN
			ALTER TABLE gold_vote_comment
			ADD CONSTRAINT chk_content_length CHECK (char_length(content) <= 500);
		EXCEPTION WHEN duplicate_object THEN NULL;
		END $$;
	`).Error; err != nil {
		log.Printf("Warning: failed to add content length constraint: %v", err)
	}

	log.Println("Gold sentiment tables created successfully")
	return nil
}
