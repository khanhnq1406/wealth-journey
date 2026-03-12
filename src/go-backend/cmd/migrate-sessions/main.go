package main

import (
	"log"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

	log.Println("Starting session indexes migration...")

	// Note: Sessions table is already created via AutoMigrate
	// This command only creates performance indexes

	// Index on UserID for fast session lookup by user
	log.Println("Creating idx_sessions_user_id...")
	if err := db.DB.Exec("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)").Error; err != nil {
		log.Printf("Warning: Failed to create user_id index: %v", err)
	} else {
		log.Println("✓ idx_sessions_user_id created")
	}

	// Index on SessionID for fast session verification
	log.Println("Creating idx_sessions_session_id...")
	if err := db.DB.Exec("CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id)").Error; err != nil {
		log.Printf("Warning: Failed to create session_id index: %v", err)
	} else {
		log.Println("✓ idx_sessions_session_id created")
	}

	// Index on ExpiresAt for cleanup queries
	log.Println("Creating idx_sessions_expires_at...")
	if err := db.DB.Exec("CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)").Error; err != nil {
		log.Printf("Warning: Failed to create expires_at index: %v", err)
	} else {
		log.Println("✓ idx_sessions_expires_at created")
	}

	// Composite index for user session queries
	log.Println("Creating idx_sessions_user_expires...")
	if err := db.DB.Exec("CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at)").Error; err != nil {
		log.Printf("Warning: Failed to create user_expires index: %v", err)
	} else {
		log.Println("✓ idx_sessions_user_expires created")
	}

	log.Println("✓ Session indexes migration completed successfully")
}
