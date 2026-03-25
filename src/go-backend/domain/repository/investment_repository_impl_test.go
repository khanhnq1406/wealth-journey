package repository

import (
	"context"
	"regexp"
	"testing"
	"time"

	"wealthjourney/domain/models"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/database"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func int32Ptr(v int32) *int32 { return &v }

// Helper function to create a mock database
func setupMockDB(t *testing.T) (*gorm.DB, sqlmock.Sqlmock, *database.Database) {
	sqlDB, mock, err := sqlmock.New()
	require.NoError(t, err)

	dialector := mysql.New(mysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	})

	db, err := gorm.Open(dialector, &gorm.Config{})
	require.NoError(t, err)

	database := &database.Database{DB: db}

	return db, mock, database
}

func TestNewInvestmentRepository(t *testing.T) {
	db, _, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)

	assert.NotNil(t, repo)
	assert.IsType(t, &investmentRepository{}, repo)
}

func TestInvestmentRepository_Create(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	investment := &models.Investment{
		WalletID:    int32Ptr(1),
		Symbol:      "AAPL",
		Name:        "Apple Inc.",
		Type:        0, // STOCK
		Quantity:    10000,
		AverageCost: 150000,
		TotalCost:   150000,
		Currency:    "USD",
	}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `investment`")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Create(ctx, investment)

	assert.NoError(t, err)
	assert.Equal(t, int32(1), investment.ID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_Create_Error(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	investment := &models.Investment{
		WalletID:    int32Ptr(1),
		Symbol:      "AAPL",
		Name:        "Apple Inc.",
		Type:        0,
		Quantity:    10000,
		AverageCost: 150000,
		TotalCost:   150000,
		Currency:    "USD",
	}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `investment`")).
		WillReturnError(gorm.ErrInvalidDB)
	mock.ExpectRollback()

	err := repo.Create(ctx, investment)

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_GetByID(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	rows := sqlmock.NewRows([]string{
		"id", "wallet_id", "symbol", "name", "type", "quantity",
		"average_cost", "total_cost", "currency", "current_price",
		"current_value", "unrealized_pnl", "unrealized_pnl_percent",
		"realized_pnl", "created_at", "updated_at",
	}).AddRow(
		1, 1, "AAPL", "Apple Inc.", 0, 10000,
		150000, 150000, "USD", 175000,
		175000, 25000, 16.67,
		0, time.Now(), time.Now(),
	)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `investment` WHERE `investment`.`id` = ? AND `investment`.`deleted_at` IS NULL ORDER BY `investment`.`id` LIMIT ?")).
		WithArgs(1, 1).
		WillReturnRows(rows)

	investment, err := repo.GetByID(ctx, 1)

	assert.NoError(t, err)
	assert.NotNil(t, investment)
	assert.Equal(t, int32(1), investment.ID)
	assert.Equal(t, "AAPL", investment.Symbol)
	assert.Equal(t, "Apple Inc.", investment.Name)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_GetByID_NotFound(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `investment` WHERE `investment`.`id` = ? AND `investment`.`deleted_at` IS NULL ORDER BY `investment`.`id` LIMIT ?")).
		WithArgs(999, 1).
		WillReturnError(gorm.ErrRecordNotFound)

	investment, err := repo.GetByID(ctx, 999)

	assert.Error(t, err)
	assert.Nil(t, investment)
	var notFoundErr apperrors.NotFoundError
	assert.ErrorAs(t, err, &notFoundErr)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_GetByUserAndSymbol(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	rows := sqlmock.NewRows([]string{
		"id", "user_id", "wallet_id", "symbol", "name", "type", "quantity",
		"average_cost", "total_cost", "currency", "current_price",
		"current_value", "unrealized_pnl", "unrealized_pnl_percent",
		"realized_pnl", "created_at", "updated_at",
	}).AddRow(
		1, 5, nil, "BTC", "Bitcoin", 1, 100000000,
		50000000000, 50000000000, "USD", 60000000000,
		60000000000, 10000000000, 20.0,
		0, time.Now(), time.Now(),
	)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `investment` WHERE (user_id = ? AND symbol = ?) AND `investment`.`deleted_at` IS NULL ORDER BY `investment`.`id` LIMIT ?")).
		WithArgs(5, "BTC", 1).
		WillReturnRows(rows)

	investment, err := repo.GetByUserAndSymbol(ctx, 5, "BTC")

	assert.NoError(t, err)
	assert.NotNil(t, investment)
	assert.Equal(t, "BTC", investment.Symbol)
	assert.Equal(t, int32(5), investment.UserID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_GetByUserAndSymbol_NotFound(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `investment` WHERE (user_id = ? AND symbol = ?) AND `investment`.`deleted_at` IS NULL ORDER BY `investment`.`id` LIMIT ?")).
		WithArgs(5, "ETH", 1).
		WillReturnError(gorm.ErrRecordNotFound)

	investment, err := repo.GetByUserAndSymbol(ctx, 5, "ETH")

	assert.NoError(t, err) // Returns nil, not error
	assert.Nil(t, investment)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_ListByWalletID(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	rows := sqlmock.NewRows([]string{
		"id", "wallet_id", "symbol", "name", "type", "quantity",
		"average_cost", "total_cost", "currency", "current_price",
		"current_value", "unrealized_pnl", "unrealized_pnl_percent",
		"realized_pnl", "created_at", "updated_at",
	}).
		AddRow(1, 5, "AAPL", "Apple", 0, 10000, 150000, 150000, "USD", 175000, 175000, 25000, 16.67, 0, time.Now(), time.Now()).
		AddRow(2, 5, "MSFT", "Microsoft", 0, 5000, 250000, 250000, "USD", 300000, 300000, 50000, 20.0, 0, time.Now(), time.Now())

	// ListByWalletID first runs COUNT(*) then SELECT * ORDER BY created_at desc (default order, no limit)
	countRows := sqlmock.NewRows([]string{"count"}).AddRow(2)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `investment` WHERE wallet_id = ? AND `investment`.`deleted_at` IS NULL")).
		WithArgs(5).
		WillReturnRows(countRows)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `investment` WHERE wallet_id = ? AND `investment`.`deleted_at` IS NULL ORDER BY created_at desc")).
		WithArgs(5).
		WillReturnRows(rows)

	investments, total, err := repo.ListByWalletID(ctx, 5, ListOptions{}, 0)

	assert.NoError(t, err)
	assert.Len(t, investments, 2)
	assert.Equal(t, 2, total)
	assert.Equal(t, "AAPL", investments[0].Symbol)
	assert.Equal(t, "MSFT", investments[1].Symbol)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_Update(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	investment := &models.Investment{
		ID:           1,
		WalletID:     int32Ptr(1),
		Symbol:       "AAPL",
		Name:         "Apple Inc.",
		Type:         0,
		Quantity:     10000,
		AverageCost:  150000,
		TotalCost:    150000,
		Currency:     "USD",
		CurrentPrice: 180000, // Updated price
	}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `investment`")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Update(ctx, investment)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_Delete(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `investment` SET `deleted_at`=? WHERE `investment`.`id` = ? AND `investment`.`deleted_at` IS NULL")).
		WithArgs(sqlmock.AnyArg(), 1).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Delete(ctx, 1)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_Delete_NotFound(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `investment` SET `deleted_at`=? WHERE `investment`.`id` = ? AND `investment`.`deleted_at` IS NULL")).
		WithArgs(sqlmock.AnyArg(), 999).
		WillReturnResult(sqlmock.NewResult(0, 0)) // No rows affected
	mock.ExpectCommit()

	err := repo.Delete(ctx, 999)

	assert.Error(t, err)
	var notFoundErr apperrors.NotFoundError
	assert.ErrorAs(t, err, &notFoundErr)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_UpdatePrices(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	updates := []PriceUpdate{
		{InvestmentID: 1, Price: 180000, Timestamp: time.Now().Unix()},
		{InvestmentID: 2, Price: 310000, Timestamp: time.Now().Unix()},
	}

	// No BEGIN/COMMIT — UpdatePrices runs each update independently (no
	// wrapping transaction) to prevent cross-goroutine deadlocks on the
	// investment table.

	// First investment fetch
	rows1 := sqlmock.NewRows([]string{
		"id", "wallet_id", "symbol", "name", "type", "quantity",
		"average_cost", "total_cost", "currency", "current_price",
		"current_value", "unrealized_pnl", "unrealized_pnl_percent",
		"realized_pnl", "created_at", "updated_at",
	}).AddRow(1, 5, "AAPL", "Apple", 0, 10000, 150000, 150000, "USD", 175000, 175000, 25000, 16.67, 0, time.Now(), time.Now())
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `investment` WHERE id = ? AND `investment`.`deleted_at` IS NULL ORDER BY `investment`.`id` LIMIT ?")).
		WithArgs(1, 1).
		WillReturnRows(rows1)

	// First investment UPDATE (auto-wrapped by GORM in its own implicit tx)
	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `investment`")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	// Second investment fetch
	rows2 := sqlmock.NewRows([]string{
		"id", "wallet_id", "symbol", "name", "type", "quantity",
		"average_cost", "total_cost", "currency", "current_price",
		"current_value", "unrealized_pnl", "unrealized_pnl_percent",
		"realized_pnl", "created_at", "updated_at",
	}).AddRow(2, 5, "BTC", "Bitcoin", 1, 100000000, 50000000000, 50000000000, "USD", 60000000000, 60000000000, 10000000000, 20.0, 0, time.Now(), time.Now())
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `investment` WHERE id = ? AND `investment`.`deleted_at` IS NULL ORDER BY `investment`.`id` LIMIT ?")).
		WithArgs(2, 1).
		WillReturnRows(rows2)

	// Second investment UPDATE
	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `investment`")).
		WillReturnResult(sqlmock.NewResult(2, 1))
	mock.ExpectCommit()

	err := repo.UpdatePrices(ctx, updates)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestInvestmentRepository_UpdatePrices_EmptyUpdates verifies early return on
// an empty update slice.
func TestInvestmentRepository_UpdatePrices_EmptyUpdates(t *testing.T) {
	db, _, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	err := repo.UpdatePrices(ctx, []PriceUpdate{})

	assert.NoError(t, err)
}

func TestInvestmentRepository_GetPortfolioSummary(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	// Mock listing investments: COUNT first, then SELECT
	countRows := sqlmock.NewRows([]string{"count"}).AddRow(2)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `investment` WHERE wallet_id = ? AND `investment`.`deleted_at` IS NULL")).
		WithArgs(5).
		WillReturnRows(countRows)

	rows := sqlmock.NewRows([]string{
		"id", "wallet_id", "symbol", "name", "type", "quantity",
		"average_cost", "total_cost", "currency", "current_price",
		"current_value", "unrealized_pnl", "unrealized_pnl_percent",
		"realized_pnl", "created_at", "updated_at",
	}).
		AddRow(1, 5, "AAPL", "Apple", 0, 10000, 150000, 150000, "USD", 175000, 175000, 25000, 16.67, 0, time.Now(), time.Now()).
		AddRow(2, 5, "BTC", "Bitcoin", 1, 100000000, 50000000000, 50000000000, "USD", 60000000000, 60000000000, 10000000000, 20.0, 0, time.Now(), time.Now())

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `investment` WHERE wallet_id = ? AND `investment`.`deleted_at` IS NULL ORDER BY created_at desc")).
		WithArgs(5).
		WillReturnRows(rows)

	summary, err := repo.GetPortfolioSummary(ctx, 5)

	assert.NoError(t, err)
	assert.NotNil(t, summary)
	assert.Equal(t, int32(2), summary.TotalInvestments)
	assert.True(t, summary.TotalValue > 0)
	assert.True(t, summary.TotalCost > 0)
	assert.Equal(t, 2, len(summary.InvestmentsByType))
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_GetPortfolioSummary_Empty(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	// Mock empty result: COUNT first, then SELECT
	countRows := sqlmock.NewRows([]string{"count"}).AddRow(0)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `investment` WHERE wallet_id = ? AND `investment`.`deleted_at` IS NULL")).
		WithArgs(5).
		WillReturnRows(countRows)

	rows := sqlmock.NewRows([]string{
		"id", "wallet_id", "symbol", "name", "type", "quantity",
		"average_cost", "total_cost", "currency", "current_price",
		"current_value", "unrealized_pnl", "unrealized_pnl_percent",
		"realized_pnl", "created_at", "updated_at",
	})

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `investment` WHERE wallet_id = ? AND `investment`.`deleted_at` IS NULL ORDER BY created_at desc")).
		WithArgs(5).
		WillReturnRows(rows)

	summary, err := repo.GetPortfolioSummary(ctx, 5)

	assert.NoError(t, err)
	assert.NotNil(t, summary)
	assert.Equal(t, int32(0), summary.TotalInvestments)
	assert.Equal(t, int64(0), summary.TotalValue)
	assert.Equal(t, int64(0), summary.TotalCost)
	assert.Equal(t, int64(0), summary.TotalPNL)
	assert.Equal(t, int64(0), summary.RealizedPNL)
	assert.Equal(t, int64(0), summary.UnrealizedPNL)
	assert.Equal(t, 0, len(summary.InvestmentsByType))
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_ListByUserID(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	// Mock investment query: COUNT first, then SELECT (direct user_id filter)
	countRows := sqlmock.NewRows([]string{"count"}).AddRow(2)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `investment` WHERE user_id = ? AND `investment`.`deleted_at` IS NULL")).
		WithArgs(10).
		WillReturnRows(countRows)

	investmentRows := sqlmock.NewRows([]string{
		"id", "user_id", "wallet_id", "symbol", "name", "type", "quantity",
		"average_cost", "total_cost", "currency", "current_price",
		"current_value", "unrealized_pnl", "unrealized_pnl_percent",
		"realized_pnl", "created_at", "updated_at",
	}).
		AddRow(1, 10, 1, "AAPL", "Apple", 0, 10000, 150000, 150000, "USD", 175000, 175000, 25000, 16.67, 0, time.Now(), time.Now()).
		AddRow(2, 10, 2, "BTC", "Bitcoin", 1, 100000000, 50000000000, 50000000000, "USD", 60000000000, 60000000000, 10000000000, 20.0, 0, time.Now(), time.Now())

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `investment` WHERE user_id = ? AND `investment`.`deleted_at` IS NULL ORDER BY created_at desc")).
		WithArgs(10).
		WillReturnRows(investmentRows)

	investments, total, err := repo.ListByUserID(ctx, 10, ListOptions{}, 0)

	assert.NoError(t, err)
	assert.Len(t, investments, 2)
	assert.Equal(t, 2, total)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_ListByUserID_Empty(t *testing.T) {
	db, mock, database := setupMockDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	}()

	repo := NewInvestmentRepository(database)
	ctx := context.Background()

	// Mock empty result with direct user_id query
	countRows := sqlmock.NewRows([]string{"count"}).AddRow(0)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `investment` WHERE user_id = ? AND `investment`.`deleted_at` IS NULL")).
		WithArgs(10).
		WillReturnRows(countRows)

	investmentRows := sqlmock.NewRows([]string{
		"id", "user_id", "wallet_id", "symbol", "name", "type", "quantity",
		"average_cost", "total_cost", "currency", "current_price",
		"current_value", "unrealized_pnl", "unrealized_pnl_percent",
		"realized_pnl", "created_at", "updated_at",
	})

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `investment` WHERE user_id = ? AND `investment`.`deleted_at` IS NULL ORDER BY created_at desc")).
		WithArgs(10).
		WillReturnRows(investmentRows)

	investments, total, err := repo.ListByUserID(ctx, 10, ListOptions{}, 0)

	assert.NoError(t, err)
	assert.Len(t, investments, 0)
	assert.Equal(t, 0, total)
	assert.NoError(t, mock.ExpectationsWereMet())
}
