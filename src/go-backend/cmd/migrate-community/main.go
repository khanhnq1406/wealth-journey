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
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize database
	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run Phase 1 migration
	if err := migrateCommunity(db.DB); err != nil {
		log.Fatalf("Phase 1 migration failed: %v", err)
	}

	// Run Phase 2 migration
	if err := migrateCommunityPhase2(db.DB); err != nil {
		log.Fatalf("Phase 2 migration failed: %v", err)
	}

	log.Println("Community migration completed successfully!")
}

func migrateCommunity(db *gorm.DB) error {
	log.Println("Starting community tables migration...")

	// Add bio column to user table
	log.Println("Adding bio column to user table...")
	if err := db.Exec(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS bio VARCHAR(200)`).Error; err != nil {
		return fmt.Errorf("failed to add bio column: %w", err)
	}
	log.Println("✓ bio column added to user table")

	// Create post table
	log.Println("Creating post table...")
	if err := db.AutoMigrate(&models.Post{}); err != nil {
		return fmt.Errorf("failed to create post table: %w", err)
	}
	log.Println("✓ post table created")

	// Create comment table
	log.Println("Creating comment table...")
	if err := db.AutoMigrate(&models.Comment{}); err != nil {
		return fmt.Errorf("failed to create comment table: %w", err)
	}
	log.Println("✓ comment table created")

	// Create post_like table
	log.Println("Creating post_like table...")
	if err := db.AutoMigrate(&models.PostLike{}); err != nil {
		return fmt.Errorf("failed to create post_like table: %w", err)
	}
	log.Println("✓ post_like table created")

	// Create user_follow table
	log.Println("Creating user_follow table...")
	if err := db.AutoMigrate(&models.UserFollow{}); err != nil {
		return fmt.Errorf("failed to create user_follow table: %w", err)
	}
	log.Println("✓ user_follow table created")

	// Create content_report table
	log.Println("Creating content_report table...")
	if err := db.AutoMigrate(&models.ContentReport{}); err != nil {
		return fmt.Errorf("failed to create content_report table: %w", err)
	}
	log.Println("✓ content_report table created")

	log.Println("All community tables created successfully")
	return nil
}

func migrateCommunityPhase2(db *gorm.DB) error {
	log.Println("=== Community Phase 2 Migration ===")

	// Step 1: Add new columns to post table
	log.Println("Adding shared_post_id and share_count to post table...")
	if err := db.Exec(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS shared_post_id INTEGER`).Error; err != nil {
		return fmt.Errorf("failed to add shared_post_id: %w", err)
	}
	if err := db.Exec(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0`).Error; err != nil {
		return fmt.Errorf("failed to add share_count: %w", err)
	}
	// Index on shared_post_id
	if err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_post_shared ON "post" (shared_post_id) WHERE shared_post_id IS NOT NULL`).Error; err != nil {
		return fmt.Errorf("failed to create idx_post_shared: %w", err)
	}
	log.Println("✓ post table updated with shared_post_id and share_count")

	// Step 2: Create notification table
	log.Println("Creating notification table...")
	if err := db.AutoMigrate(&models.Notification{}); err != nil {
		return fmt.Errorf("failed to create notification table: %w", err)
	}
	log.Println("✓ notification table created")

	// Step 3: Create saved_post table
	log.Println("Creating saved_post table...")
	if err := db.AutoMigrate(&models.SavedPost{}); err != nil {
		return fmt.Errorf("failed to create saved_post table: %w", err)
	}
	log.Println("✓ saved_post table created")

	// Step 4: Create post_hashtag table
	log.Println("Creating post_hashtag table...")
	if err := db.AutoMigrate(&models.PostHashtag{}); err != nil {
		return fmt.Errorf("failed to create post_hashtag table: %w", err)
	}
	log.Println("✓ post_hashtag table created")

	log.Println("=== Community Phase 2 Migration Complete ===")
	return nil
}
