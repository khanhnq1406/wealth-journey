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

	log.Println("Starting email nullable migration...")

	// Step 1: Remove NOT NULL constraint from email
	log.Println("Removing NOT NULL constraint from email...")
	if err := db.DB.Exec(`ALTER TABLE "user" ALTER COLUMN email DROP NOT NULL`).Error; err != nil {
		log.Fatalf("Failed to drop NOT NULL on email: %v", err)
	}
	log.Println("✓ email NOT NULL constraint removed")

	// Step 2: Drop existing unique index on email (GORM-generated)
	log.Println("Dropping existing email unique index...")
	if err := db.DB.Exec(`DROP INDEX IF EXISTS idx_users_email`).Error; err != nil {
		log.Printf("Note: idx_users_email not found, trying alternates...")
	}
	// Try alternate GORM index names
	db.DB.Exec(`DROP INDEX IF EXISTS uni_user_email`)
	db.DB.Exec(`DROP INDEX IF EXISTS idx_user_email`)
	log.Println("✓ old email indexes dropped")

	// Step 3: Create partial unique index (only enforces uniqueness on non-NULL values)
	log.Println("Creating partial unique index on email...")
	if err := db.DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON "user" (email) WHERE email IS NOT NULL`).Error; err != nil {
		log.Fatalf("Failed to create partial email index: %v", err)
	}
	log.Println("✓ idx_user_email partial index created")

	// Verify
	var count int64
	db.DB.Raw(`SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'email' AND is_nullable = 'YES'`).Scan(&count)
	if count == 1 {
		log.Println("✓ email column verified as nullable")
	} else {
		log.Fatalf("Verification failed: email column is not nullable")
	}

	log.Println("✓ Email nullable migration completed successfully!")
}
