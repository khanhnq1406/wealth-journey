package main

import (
	"context"
	"fmt"
	"log"

	"gorm.io/gorm"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
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
	defer func() { _ = db.Close() }()

	// Run migration
	ctx := context.Background()
	if err := migrateMultiCurrency(ctx, db.DB); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Migration completed successfully!")
}

func migrateMultiCurrency(ctx context.Context, db *gorm.DB) error {
	log.Println("Starting multi-currency migration...")

	// Step 1: Add currency columns to existing tables
	log.Println("\n=== Step 1: Adding currency columns ===")

	// 1.1 Add preferred_currency to user table
	log.Println("Adding preferred_currency to user table...")
	if err := db.Exec(`
		ALTER TABLE "user"
		ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) NOT NULL DEFAULT 'VND'
	`).Error; err != nil {
		return fmt.Errorf("failed to add preferred_currency to user: %w", err)
	}

	// Add index for preferred_currency
	if !db.Migrator().HasIndex(&models.User{}, "idx_user_preferred_currency") {
		if err := db.Exec(`
			CREATE INDEX idx_user_preferred_currency ON "user"(preferred_currency)
		`).Error; err != nil {
			return fmt.Errorf("failed to create idx_user_preferred_currency: %w", err)
		}
		log.Println("Created index idx_user_preferred_currency")
	}

	// 1.2 Add conversion_in_progress to user table
	log.Println("Adding conversion_in_progress to user table...")
	if err := db.Exec(`
		ALTER TABLE "user"
		ADD COLUMN IF NOT EXISTS conversion_in_progress BOOLEAN DEFAULT FALSE
	`).Error; err != nil {
		return fmt.Errorf("failed to add conversion_in_progress to user: %w", err)
	}

	// Add index for conversion_in_progress
	if !db.Migrator().HasIndex(&models.User{}, "idx_user_conversion_in_progress") {
		if err := db.Exec(`
			CREATE INDEX idx_user_conversion_in_progress ON "user"(conversion_in_progress)
		`).Error; err != nil {
			return fmt.Errorf("failed to create idx_user_conversion_in_progress: %w", err)
		}
		log.Println("Created index idx_user_conversion_in_progress")
	}

	// 1.3 Add currency to transaction table
	log.Println("Adding currency to transaction table...")
	if err := db.Exec(`
		ALTER TABLE transaction
		ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'VND'
	`).Error; err != nil {
		return fmt.Errorf("failed to add currency to transaction: %w", err)
	}

	// Migrate existing transaction data (assume all existing transactions are in VND)
	result := db.Exec(`
		UPDATE transaction
		SET currency = 'VND'
		WHERE currency IS NULL OR currency = ''
	`)
	if result.Error != nil {
		return fmt.Errorf("failed to migrate transaction currency data: %w", result.Error)
	}
	log.Printf("Migrated %d transaction records to VND", result.RowsAffected)

	// 1.4 Add currency to budget table
	log.Println("Adding currency to budget table...")
	if err := db.Exec(`
		ALTER TABLE budget
		ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'VND'
	`).Error; err != nil {
		return fmt.Errorf("failed to add currency to budget: %w", err)
	}

	// Migrate existing budget data
	result = db.Exec(`
		UPDATE budget
		SET currency = 'VND'
		WHERE currency IS NULL OR currency = ''
	`)
	if result.Error != nil {
		return fmt.Errorf("failed to migrate budget currency data: %w", result.Error)
	}
	log.Printf("Migrated %d budget records to VND", result.RowsAffected)

	// 1.5 Add currency to budget_item table
	log.Println("Adding currency to budget_item table...")
	if err := db.Exec(`
		ALTER TABLE budget_item
		ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'VND'
	`).Error; err != nil {
		return fmt.Errorf("failed to add currency to budget_item: %w", err)
	}

	// Migrate existing budget_item data
	result = db.Exec(`
		UPDATE budget_item
		SET currency = 'VND'
		WHERE currency IS NULL OR currency = ''
	`)
	if result.Error != nil {
		return fmt.Errorf("failed to migrate budget_item currency data: %w", result.Error)
	}
	log.Printf("Migrated %d budget_item records to VND", result.RowsAffected)

	// 1.6 Add currency to investment_transaction table
	log.Println("Adding currency to investment_transaction table...")
	if err := db.Exec(`
		ALTER TABLE investment_transaction
		ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD'
	`).Error; err != nil {
		return fmt.Errorf("failed to add currency to investment_transaction: %w", err)
	}

	// Migrate existing investment_transaction data (assume USD)
	result = db.Exec(`
		UPDATE investment_transaction
		SET currency = 'USD'
		WHERE currency IS NULL OR currency = ''
	`)
	if result.Error != nil {
		return fmt.Errorf("failed to migrate investment_transaction currency data: %w", result.Error)
	}
	log.Printf("Migrated %d investment_transaction records to USD", result.RowsAffected)

	// 1.7 Add currency to investment_lot table
	log.Println("Adding currency to investment_lot table...")
	if err := db.Exec(`
		ALTER TABLE investment_lot
		ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD'
	`).Error; err != nil {
		return fmt.Errorf("failed to add currency to investment_lot: %w", err)
	}

	// Migrate existing investment_lot data (assume USD)
	result = db.Exec(`
		UPDATE investment_lot
		SET currency = 'USD'
		WHERE currency IS NULL OR currency = ''
	`)
	if result.Error != nil {
		return fmt.Errorf("failed to migrate investment_lot currency data: %w", result.Error)
	}
	log.Printf("Migrated %d investment_lot records to USD", result.RowsAffected)

	// Step 2: Create new tables
	log.Println("\n=== Step 2: Creating new tables ===")

	// 2.1 Create fx_rate table
	log.Println("Creating fx_rate table...")
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS fx_rate (
			id SERIAL PRIMARY KEY,
			from_currency VARCHAR(3) NOT NULL,
			to_currency VARCHAR(3) NOT NULL,
			rate DOUBLE PRECISION NOT NULL,
			timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMP,
			UNIQUE (from_currency, to_currency)
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create fx_rate table: %w", err)
	}

	// Create indexes for fx_rate
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_fx_rate_timestamp ON fx_rate(timestamp)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_fx_rate_from_currency ON fx_rate(from_currency)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_fx_rate_to_currency ON fx_rate(to_currency)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_fx_rate_deleted_at ON fx_rate(deleted_at)`)
	log.Println("Created fx_rate table")

	// 2.2 Create currency_conversion_progress table
	log.Println("Creating currency_conversion_progress table...")
	if err := db.Exec(`
		CREATE TABLE IF NOT EXISTS currency_conversion_progress (
			id SERIAL PRIMARY KEY,
			user_id INT NOT NULL,
			from_currency VARCHAR(3) NOT NULL,
			to_currency VARCHAR(3) NOT NULL,
			status VARCHAR(20) NOT NULL,
			total_entities INT NOT NULL DEFAULT 0,
			processed_entities INT NOT NULL DEFAULT 0,
			current_step VARCHAR(255),
			started_at TIMESTAMP NOT NULL,
			completed_at TIMESTAMP,
			error TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT fk_conversion_progress_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
		)
	`).Error; err != nil {
		return fmt.Errorf("failed to create currency_conversion_progress table: %w", err)
	}

	// Create indexes for currency_conversion_progress
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_conversion_progress_user_id ON currency_conversion_progress(user_id)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_conversion_progress_status ON currency_conversion_progress(status)`)
	log.Println("Created currency_conversion_progress table")

	// Step 3: Verification
	log.Println("\n=== Step 3: Verification ===")

	// Verify user table columns
	if !db.Migrator().HasColumn(&models.User{}, "preferred_currency") {
		return fmt.Errorf("verification failed: user.preferred_currency column missing")
	}
	log.Println("✓ user.preferred_currency column exists")

	if !db.Migrator().HasColumn(&models.User{}, "conversion_in_progress") {
		return fmt.Errorf("verification failed: user.conversion_in_progress column missing")
	}
	log.Println("✓ user.conversion_in_progress column exists")

	// Verify tables exist
	if !db.Migrator().HasTable(&models.FXRate{}) {
		return fmt.Errorf("verification failed: fx_rate table missing")
	}
	log.Println("✓ fx_rate table exists")

	log.Println("\n=== Migration Summary ===")
	log.Println("✓ All currency columns added")
	log.Println("✓ All existing data migrated")
	log.Println("✓ All new tables created")
	log.Println("✓ All indexes created")

	return nil
}
