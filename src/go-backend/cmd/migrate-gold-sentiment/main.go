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
	log.Println("Creating/updating gold_vote table...")
	if err := db.AutoMigrate(&models.GoldVote{}); err != nil {
		return fmt.Errorf("failed to migrate gold_vote table: %w", err)
	}
	log.Println("gold_vote table migrated")

	// Make user_id nullable for anonymous votes
	log.Println("Making user_id nullable...")
	if err := db.Exec(`ALTER TABLE gold_vote ALTER COLUMN user_id DROP NOT NULL`).Error; err != nil {
		log.Printf("Warning: user_id may already be nullable: %v", err)
	}

	// Add anonymous_id column if not exists
	log.Println("Adding anonymous_id column...")
	if err := db.Exec(`ALTER TABLE gold_vote ADD COLUMN IF NOT EXISTS anonymous_id VARCHAR(36)`).Error; err != nil {
		log.Printf("Warning: anonymous_id column may already exist: %v", err)
	}

	// Drop old unique index (may not exist if fresh migration)
	log.Println("Dropping old unique index...")
	db.Exec(`DROP INDEX IF EXISTS idx_gold_vote_user_date`)

	// Create partial unique indexes for deduplication
	log.Println("Creating partial unique indexes...")
	if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_vote_user_date ON gold_vote(user_id, vote_date) WHERE user_id IS NOT NULL`).Error; err != nil {
		return fmt.Errorf("failed to create user partial index: %w", err)
	}
	if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_vote_anon_date ON gold_vote(anonymous_id, vote_date) WHERE anonymous_id IS NOT NULL`).Error; err != nil {
		return fmt.Errorf("failed to create anonymous partial index: %w", err)
	}

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

	// Add category column to gold_vote
	log.Println("Adding category column to gold_vote...")
	if err := db.Exec(`ALTER TABLE gold_vote ADD COLUMN IF NOT EXISTS category SMALLINT DEFAULT 0 NOT NULL`).Error; err != nil {
		log.Printf("Warning: category column may already exist on gold_vote: %v", err)
	}

	// Drop old partial unique indexes and recreate with category
	log.Println("Recreating partial unique indexes with category...")
	db.Exec(`DROP INDEX IF EXISTS idx_gold_vote_user_date`)
	db.Exec(`DROP INDEX IF EXISTS idx_gold_vote_anon_date`)
	if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_vote_user_cat_date ON gold_vote(category, user_id, vote_date) WHERE user_id IS NOT NULL`).Error; err != nil {
		return fmt.Errorf("failed to create user+category partial index: %w", err)
	}
	if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_vote_anon_cat_date ON gold_vote(category, anonymous_id, vote_date) WHERE anonymous_id IS NOT NULL`).Error; err != nil {
		return fmt.Errorf("failed to create anonymous+category partial index: %w", err)
	}

	// Add index for efficient count queries by category+date
	if err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_gold_vote_cat_date ON gold_vote(category, vote_date)`).Error; err != nil {
		log.Printf("Warning: failed to create category+date index: %v", err)
	}

	// Add category column to gold_vote_comment
	log.Println("Adding category column to gold_vote_comment...")
	if err := db.Exec(`ALTER TABLE gold_vote_comment ADD COLUMN IF NOT EXISTS category SMALLINT DEFAULT 0 NOT NULL`).Error; err != nil {
		log.Printf("Warning: category column may already exist on gold_vote_comment: %v", err)
	}

	// Add index for comment queries by category+date
	if err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_gold_vote_comment_cat_date ON gold_vote_comment(category, vote_date)`).Error; err != nil {
		log.Printf("Warning: failed to create comment category+date index: %v", err)
	}

	log.Println("Gold sentiment tables created successfully")
	return nil
}
