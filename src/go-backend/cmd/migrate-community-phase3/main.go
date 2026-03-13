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

	log.Println("Starting community phase 3 migration...")

	if err := migrateUserTable(db.DB); err != nil {
		log.Fatalf("Failed to migrate user table: %v", err)
	}

	if err := migrateCommentTable(db.DB); err != nil {
		log.Fatalf("Failed to migrate comment table: %v", err)
	}

	log.Println("Community phase 3 migration completed successfully")
}

func migrateUserTable(db *gorm.DB) error {
	log.Println("Migrating user table...")

	if err := db.Exec(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS cover_photo_url VARCHAR(500) DEFAULT ''`).Error; err != nil {
		return err
	}
	log.Println("  Added cover_photo_url column")

	if err := db.Exec(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS location VARCHAR(100) DEFAULT ''`).Error; err != nil {
		return err
	}
	log.Println("  Added location column")

	if err := db.Exec(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS website VARCHAR(200) DEFAULT ''`).Error; err != nil {
		return err
	}
	log.Println("  Added website column")

	return nil
}

func migrateCommentTable(db *gorm.DB) error {
	log.Println("Migrating comment table...")

	if err := db.Exec(`ALTER TABLE "comment" ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER DEFAULT NULL`).Error; err != nil {
		return err
	}
	log.Println("  Added parent_comment_id column")

	if err := db.Exec(`ALTER TABLE "comment" ADD COLUMN IF NOT EXISTS reply_count INTEGER NOT NULL DEFAULT 0`).Error; err != nil {
		return err
	}
	log.Println("  Added reply_count column")

	if err := db.Exec(`ALTER TABLE "comment" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL`).Error; err != nil {
		return err
	}
	log.Println("  Added updated_at column")

	if err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_comment_parent_id ON "comment" (parent_comment_id)`).Error; err != nil {
		return err
	}
	log.Println("  Created index idx_comment_parent_id")

	if err := db.Exec(`
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.table_constraints
				WHERE constraint_name = 'fk_comment_parent'
			) THEN
				ALTER TABLE "comment"
				ADD CONSTRAINT fk_comment_parent
				FOREIGN KEY (parent_comment_id)
				REFERENCES "comment"(id)
				ON DELETE CASCADE;
			END IF;
		END $$
	`).Error; err != nil {
		return err
	}
	log.Println("  Added FK constraint fk_comment_parent")

	return nil
}
