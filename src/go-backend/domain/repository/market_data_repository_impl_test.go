package repository

import (
	"context"
	"testing"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// setupMockDBForMarketData creates a mock database for market data tests.
// Uses the same pattern as investment_repository_impl_test.go.
func setupMockDBForMarketData(t *testing.T) (*gorm.DB, sqlmock.Sqlmock, *database.Database) {
	sqlDB, mock, err := sqlmock.New()
	require.NoError(t, err)

	dialector := mysql.New(mysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	})

	db, err := gorm.Open(dialector, &gorm.Config{})
	require.NoError(t, err)

	dbWrapper := &database.Database{DB: db}
	return db, mock, dbWrapper
}

// TestMarketDataRepository_Create_UsesUpsertOnConflict verifies that Create uses
// INSERT ... ON CONFLICT DO UPDATE so duplicate symbol+currency rows are updated
// rather than failing with a unique-constraint violation.
//
// Regression test for: "duplicate key value violates unique constraint idx_symbol_currency"
// when Mihong price refresh races with an existing market_data row.
func TestMarketDataRepository_Create_UsesUpsertOnConflict(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, dbWrapper := setupMockDBForMarketData(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewMarketDataRepository(dbWrapper)
	ctx := context.Background()

	data := &models.MarketData{
		Symbol:    "Mihong_999",
		Currency:  "VND",
		Price:     4573333,
		Change24h: 0,
		Volume24h: 0,
		Timestamp: time.Now(),
	}

	// Expect an INSERT that includes a conflict-resolution clause. GORM generates
	// "ON DUPLICATE KEY UPDATE" for the MySQL driver used in tests; on PostgreSQL
	// (production) it generates "ON CONFLICT DO UPDATE". Both prevent constraint
	// violations — we match either form.
	mock.ExpectBegin()
	mock.ExpectExec(`(?i)INSERT.*ON DUPLICATE KEY UPDATE|INSERT.*ON CONFLICT`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Create(ctx, data)
	assert.NoError(t, err)

	// Verify all SQL expectations were met (i.e., ON CONFLICT clause was sent).
	assert.NoError(t, mock.ExpectationsWereMet(), "expected an INSERT ... ON CONFLICT statement")
}

// TestMarketDataRepository_Create_DuplicateDoesNotError verifies that calling Create
// twice for the same symbol+currency does not return an error (upsert semantics).
func TestMarketDataRepository_Create_DuplicateDoesNotError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, dbWrapper := setupMockDBForMarketData(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewMarketDataRepository(dbWrapper)
	ctx := context.Background()

	data := &models.MarketData{
		Symbol:    "Mihong_999",
		Currency:  "VND",
		Price:     4573333,
		Timestamp: time.Now(),
	}

	// First insert
	mock.ExpectBegin()
	mock.ExpectExec(`(?i)INSERT.*ON DUPLICATE KEY UPDATE|INSERT.*ON CONFLICT`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	// Second insert (same symbol+currency) — must also succeed via upsert
	mock.ExpectBegin()
	mock.ExpectExec(`(?i)INSERT.*ON DUPLICATE KEY UPDATE|INSERT.*ON CONFLICT`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	assert.NoError(t, repo.Create(ctx, data))
	assert.NoError(t, repo.Create(ctx, data), "second Create for same symbol+currency must not fail")
	assert.NoError(t, mock.ExpectationsWereMet())
}
