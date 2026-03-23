package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Database struct {
	DB *gorm.DB
}

// New creates a new database connection with connection pooling
func New(cfg *config.Config) (*Database, error) {
	// Allow SSL mode to be configured via environment variable
	// Default to 'require' for production safety, but allow 'disable' for CI/testing
	sslMode := os.Getenv("DB_SSL_MODE")
	if sslMode == "" {
		sslMode = "require"
	}

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Name,
		sslMode,
	)

	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true, // Disable implicit prepared statement usage
	}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
		// Disable prepared statements for Supabase compatibility
		// Supabase uses PgBouncer which can have issues with prepared statements
		PrepareStmt: false,
		// Skip default transaction for better performance
		SkipDefaultTransaction: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Get underlying SQL DB to configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get SQL DB: %w", err)
	}

	// Configure connection pool
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(cfg.Database.ConnMaxLifetime)
	sqlDB.SetConnMaxIdleTime(cfg.Database.ConnMaxIdleTime)

	// Auto migrate schemas
	err = db.AutoMigrate(
		// Core
		&models.User{},
		&models.Wallet{},
		&models.Category{},
		&models.CategoryKeyword{},
		&models.UserCategoryMapping{},
		&models.Transaction{},
		&models.Budget{},
		&models.BudgetItem{},
		// Investment
		&models.Investment{},
		&models.InvestmentTransaction{},
		&models.InvestmentLot{},
		&models.MarketData{},
		&models.PortfolioHistory{},
		&models.ExchangeRate{},
		&models.FXRate{},
		// Auth & sessions
		&models.Session{},
		// Import
		&models.ImportBatch{},
		&models.BankTemplate{},
		&models.UserTemplate{},
		&models.MerchantCategoryRule{},
		// Community
		&models.Post{},
		&models.PostHashtag{},
		&models.PostLike{},
		&models.SavedPost{},
		&models.Comment{},
		&models.UserFollow{},
		&models.ContentReport{},
		// Gold sentiment
		&models.GoldVote{},
		&models.GoldVoteComment{},
		// Notifications
		&models.Notification{},
		&models.PushSubscription{},
		// Admin & settings
		&models.SiteSetting{},
		&models.Feedback{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	// Run post-migration data backfills (idempotent)
	if err := runPostMigrations(db); err != nil {
		log.Printf("Warning: post-migration failed: %v", err)
		// Don't fail startup, just log the warning
	}

	log.Printf("Database connected and migrated successfully (pool: maxOpen=%d, maxIdle=%d)",
		cfg.Database.MaxOpenConns, cfg.Database.MaxIdleConns)

	return &Database{DB: db}, nil
}

// runPostMigrations executes data backfills and index creations after schema migration
// These are idempotent and safe to run on every startup
// Optimized for Railway deployment with parallel execution and migration guards
func runPostMigrations(db *gorm.DB) error {
	startTime := time.Now()
	log.Println("Starting post-migration tasks...")

	// Check if migrations have already been completed
	// This prevents re-running expensive operations on every deployment
	if migrationsCompleted(db) {
		log.Printf("Post-migrations already completed, skipping (took %v to verify)", time.Since(startTime))
		return nil
	}

	// 1. Create performance indexes in parallel with CONCURRENTLY option
	// CONCURRENTLY allows reads/writes during index creation (non-blocking)
	// Each index creation runs in a separate goroutine for speed
	log.Println("Creating performance indexes in parallel...")
	indexStartTime := time.Now()

	indexes := []struct {
		name  string
		query string
	}{
		{
			name: "idx_portfolio_history_user_timestamp",
			query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_history_user_timestamp
				ON portfolio_history(user_id, timestamp DESC)`,
		},
		{
			name: "idx_portfolio_history_wallet_timestamp",
			query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_history_wallet_timestamp
				ON portfolio_history(wallet_id, timestamp DESC)`,
		},
		{
			name: "idx_category_user_type",
			query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_category_user_type
				ON category(user_id, type)`,
		},
		{
			name: "idx_user_email",
			query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email
				ON "user"(email)
				WHERE deleted_at IS NULL`,
		},
		{
			name: "idx_sessions_user_id",
			query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_id
				ON sessions(user_id)`,
		},
		{
			name: "idx_sessions_session_id",
			query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_session_id
				ON sessions(session_id)`,
		},
		{
			name: "idx_sessions_expires_at",
			query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expires_at
				ON sessions(expires_at)`,
		},
		{
			name: "idx_sessions_user_expires",
			query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_expires
				ON sessions(user_id, expires_at)`,
		},
	}

	// Create indexes in parallel using goroutines
	indexErrors := make(chan error, len(indexes))
	var wg sync.WaitGroup

	for _, idx := range indexes {
		wg.Add(1)
		go func(name, query string) {
			defer wg.Done()

			// CONCURRENTLY requires a separate transaction, so we can't use db.Exec directly
			// Instead, use raw SQL connection
			sqlDB, err := db.DB()
			if err != nil {
				indexErrors <- fmt.Errorf("failed to get SQL DB for index %s: %w", name, err)
				return
			}

			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
			defer cancel()

			if _, err := sqlDB.ExecContext(ctx, query); err != nil {
				// Ignore "already exists" errors (index might be in progress from another deployment)
				if !isIndexExistsError(err) {
					indexErrors <- fmt.Errorf("failed to create index %s: %w", name, err)
					return
				}
			}
			log.Printf("Index %s created or already exists", name)
		}(idx.name, idx.query)
	}

	// Wait for all index creations to complete
	wg.Wait()
	close(indexErrors)

	// Check for errors
	var indexErrList []error
	for err := range indexErrors {
		indexErrList = append(indexErrList, err)
	}
	if len(indexErrList) > 0 {
		// Log all errors but don't fail deployment
		for _, err := range indexErrList {
			log.Printf("Index creation warning: %v", err)
		}
		log.Printf("Continuing despite %d index creation warnings", len(indexErrList))
	}

	log.Printf("Index creation completed in %v", time.Since(indexStartTime))

	// 2. Backfill gold investment purchase_unit values
	// These are one-time data migrations that only affect existing records
	log.Println("Running data backfills...")
	backfillStartTime := time.Now()

	// Gold VND (type 8): default to mace (chỉ) display
	// Only update records where purchase_unit is NULL or 'gram'
	result := db.Exec(`
		UPDATE investment
		SET purchase_unit = 'mace'
		WHERE type = 8 AND (purchase_unit IS NULL OR purchase_unit = 'gram')
	`)
	if result.Error != nil {
		log.Printf("Warning: failed to backfill gold VND: %v", result.Error)
	} else {
		log.Printf("Backfilled %d gold VND records", result.RowsAffected)
	}

	// Gold USD (type 9): default to oz display
	result = db.Exec(`
		UPDATE investment
		SET purchase_unit = 'oz'
		WHERE type = 9 AND (purchase_unit IS NULL OR purchase_unit = 'gram')
	`)
	if result.Error != nil {
		log.Printf("Warning: failed to backfill gold USD: %v", result.Error)
	} else {
		log.Printf("Backfilled %d gold USD records", result.RowsAffected)
	}

	log.Printf("Data backfills completed in %v", time.Since(backfillStartTime))

	// Mark migrations as completed
	if err := markMigrationsCompleted(db); err != nil {
		log.Printf("Warning: failed to mark migrations as completed: %v", err)
	}

	log.Printf("Post-migration tasks completed successfully in %v", time.Since(startTime))
	return nil
}

// migrationsCompleted checks if post-migrations have already been run
// This prevents expensive re-runs on every deployment
func migrationsCompleted(db *gorm.DB) bool {
	// Check if the migration_status table exists and has a completed entry
	var count int64
	err := db.Raw(`
		SELECT COUNT(*)
		FROM information_schema.tables
		WHERE table_schema = 'public'
		AND table_name = 'migration_status'
	`).Scan(&count).Error

	if err != nil || count == 0 {
		return false
	}

	// Check if migrations are marked as completed
	var completed bool
	err = db.Raw(`
		SELECT completed
		FROM migration_status
		WHERE migration_name = 'post_migrations_v1'
		ORDER BY completed_at DESC
		LIMIT 1
	`).Scan(&completed).Error

	return err == nil && completed
}

// markMigrationsCompleted marks post-migrations as completed
func markMigrationsCompleted(db *gorm.DB) error {
	// Create migration_status table if it doesn't exist
	err := db.Exec(`
		CREATE TABLE IF NOT EXISTS migration_status (
			id SERIAL PRIMARY KEY,
			migration_name VARCHAR(255) NOT NULL UNIQUE,
			completed BOOLEAN NOT NULL DEFAULT false,
			completed_at TIMESTAMP NOT NULL DEFAULT NOW()
		)
	`).Error
	if err != nil {
		return fmt.Errorf("failed to create migration_status table: %w", err)
	}

	// Insert or update completion status
	return db.Exec(`
		INSERT INTO migration_status (migration_name, completed, completed_at)
		VALUES ('post_migrations_v1', true, NOW())
		ON CONFLICT (migration_name) DO UPDATE
		SET completed = true, completed_at = NOW()
	`).Error
}

// isIndexExistsError checks if an error is due to an index already existing
func isIndexExistsError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// Check for common PostgreSQL "already exists" error messages
	return containsSubstring(errStr, "already exists") ||
		   containsSubstring(errStr, "duplicate key") ||
		   containsSubstring(errStr, "relation") && containsSubstring(errStr, "already exists")
}

// containsSubstring checks if a string contains a substring
func containsSubstring(s, substr string) bool {
	if len(substr) == 0 {
		return true
	}
	if len(s) < len(substr) {
		return false
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// Close closes the database connection
func (d *Database) Close() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// Ping checks if the database connection is alive with exponential backoff retry.
// It makes up to 3 retries with exponential backoff (500ms, 1s, 2s).
// Each individual ping attempt has a 5-second timeout.
// This handles transient network issues common on Railway's free tier.
func (d *Database) Ping() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}

	// Define the ping function with timeout
	pingFunc := func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return sqlDB.PingContext(ctx)
	}

	// Use exponential backoff: 500ms, 1s, 2s (3 retries total)
	return pingWithRetry(context.Background(), pingFunc, 3, 500*time.Millisecond)
}

// Stats returns database connection pool statistics
func (d *Database) Stats() map[string]interface{} {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return map[string]interface{}{
			"error": err.Error(),
		}
	}

	stats := sqlDB.Stats()
	return map[string]interface{}{
		"max_open_connections": stats.MaxOpenConnections,
		"open_connections":     stats.OpenConnections,
		"in_use":               stats.InUse,
		"idle":                 stats.Idle,
		"wait_count":           stats.WaitCount,
		"wait_duration":        stats.WaitDuration.String(),
		"max_idle_closed":      stats.MaxIdleClosed,
		"max_lifetime_closed":  stats.MaxLifetimeClosed,
	}
}
