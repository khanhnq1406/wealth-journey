package main

import (
	"log"

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

	log.Println("Starting password auth migration...")

	// Add username column
	log.Println("Adding username column...")
	if err := db.DB.Exec(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS username VARCHAR(30)`).Error; err != nil {
		log.Fatalf("Failed to add username column: %v", err)
	}
	log.Println("✓ username column added")

	// Create partial unique index on username (only enforce uniqueness on non-null values)
	log.Println("Creating partial unique index on username...")
	if err := db.DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username ON "user"(username) WHERE username IS NOT NULL`).Error; err != nil {
		log.Fatalf("Failed to create username index: %v", err)
	}
	log.Println("✓ idx_user_username created")

	// Add password_hash column
	log.Println("Adding password_hash column...")
	if err := db.DB.Exec(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`).Error; err != nil {
		log.Fatalf("Failed to add password_hash column: %v", err)
	}
	log.Println("✓ password_hash column added")

	// Add auth_provider column with default 'google' for existing users
	log.Println("Adding auth_provider column...")
	if err := db.DB.Exec(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'google'`).Error; err != nil {
		log.Fatalf("Failed to add auth_provider column: %v", err)
	}
	log.Println("✓ auth_provider column added")

	// Verify columns exist
	var count int64
	db.DB.Raw(`SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'user' AND column_name IN ('username', 'password_hash', 'auth_provider')`).Scan(&count)
	if count == 3 {
		log.Println("✓ All 3 columns verified in database")
	} else {
		log.Fatalf("Verification failed: expected 3 columns, found %d", count)
	}

	log.Println("✓ Password auth migration completed successfully!")
}
