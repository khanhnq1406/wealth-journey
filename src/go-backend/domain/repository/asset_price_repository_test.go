package repository

import (
	"context"
	"regexp"
	"testing"
	"time"

	"wealthjourney/domain/models"
	apperrors "wealthjourney/pkg/errors"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// assetPriceColumns is the full list of columns returned by SELECT * on asset_price.
var assetPriceColumns = []string{
	"id", "type_code", "asset_type", "name",
	"buy", "sell", "change_buy", "change_sell",
	"currency", "source", "is_stale", "fetched_at",
	"created_at", "updated_at", "deleted_at",
}

// ---- Constructor ----

func TestNewAssetPriceRepository(t *testing.T) {
	db, _, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetPriceRepository(database)

	assert.NotNil(t, repo)
	assert.IsType(t, &assetPriceRepository{}, repo)
}

// ---- UpsertBatch ----

func TestAssetPriceRepository_UpsertBatch_Empty(t *testing.T) {
	db, _, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetPriceRepository(database)
	ctx := context.Background()

	// No SQL expectations set — empty slice must return nil immediately.
	err := repo.UpsertBatch(ctx, []*models.AssetPrice{})
	assert.NoError(t, err)
}

func TestAssetPriceRepository_UpsertBatch_SingleRow(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetPriceRepository(database)
	ctx := context.Background()

	price := &models.AssetPrice{
		TypeCode:  "SJC_1L",
		AssetType: "gold",
		Name:      "SJC 1 Lượng",
		Buy:       8500000000,
		Sell:      8510000000,
		Currency:  "VND",
		Source:    "vang.today",
		IsStale:   false,
		FetchedAt: time.Now(),
	}

	// GORM with clause.OnConflict generates ON DUPLICATE KEY UPDATE (MySQL driver).
	mock.ExpectBegin()
	mock.ExpectExec(`(?i)INSERT.*ON DUPLICATE KEY UPDATE|INSERT.*ON CONFLICT`).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.UpsertBatch(ctx, []*models.AssetPrice{price})

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetPriceRepository_UpsertBatch_MultiplePrices(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetPriceRepository(database)
	ctx := context.Background()

	prices := []*models.AssetPrice{
		{TypeCode: "SJC_1L", AssetType: "gold", Name: "SJC 1L", Buy: 8500000000, Sell: 8510000000, Currency: "VND", FetchedAt: time.Now()},
		{TypeCode: "SJC_5C", AssetType: "gold", Name: "SJC 5C", Buy: 850000000, Sell: 851000000, Currency: "VND", FetchedAt: time.Now()},
	}

	// Two individual upserts — one per price in the loop.
	for range prices {
		mock.ExpectBegin()
		mock.ExpectExec(`(?i)INSERT.*ON DUPLICATE KEY UPDATE|INSERT.*ON CONFLICT`).
			WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()
	}

	err := repo.UpsertBatch(ctx, prices)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetPriceRepository_UpsertBatch_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetPriceRepository(database)
	ctx := context.Background()

	price := &models.AssetPrice{TypeCode: "SJC_1L", AssetType: "gold", Currency: "VND", FetchedAt: time.Now()}

	mock.ExpectBegin()
	mock.ExpectExec(`(?i)INSERT.*ON DUPLICATE KEY UPDATE|INSERT.*ON CONFLICT`).
		WillReturnError(gorm.ErrInvalidDB)
	mock.ExpectRollback()

	err := repo.UpsertBatch(ctx, []*models.AssetPrice{price})

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- ListByAssetType ----

func TestAssetPriceRepository_ListByAssetType(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetPriceRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(assetPriceColumns).
		AddRow(int32(1), "SJC_1L", "gold", "SJC 1 Lượng",
			int64(8500000000), int64(8510000000), int64(0), int64(0),
			"VND", "vang.today", false, now, now, now, nil).
		AddRow(int32(2), "SJC_5C", "gold", "SJC 5 Chỉ",
			int64(850000000), int64(851000000), int64(0), int64(0),
			"VND", "vang.today", false, now, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_price` WHERE asset_type = ? AND `asset_price`.`deleted_at` IS NULL")).
		WithArgs("gold").
		WillReturnRows(rows)

	prices, err := repo.ListByAssetType(ctx, "gold")

	assert.NoError(t, err)
	require.Len(t, prices, 2)
	assert.Equal(t, "SJC_1L", prices[0].TypeCode)
	assert.Equal(t, "SJC_5C", prices[1].TypeCode)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetPriceRepository_ListByAssetType_Empty(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetPriceRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_price` WHERE asset_type = ? AND `asset_price`.`deleted_at` IS NULL")).
		WithArgs("silver").
		WillReturnRows(sqlmock.NewRows(assetPriceColumns))

	prices, err := repo.ListByAssetType(ctx, "silver")

	assert.NoError(t, err)
	assert.Empty(t, prices)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- ListAll ----

func TestAssetPriceRepository_ListAll(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetPriceRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(assetPriceColumns).
		AddRow(int32(1), "SJC_1L", "gold", "SJC 1 Lượng",
			int64(8500000000), int64(8510000000), int64(0), int64(0),
			"VND", "vang.today", false, now, now, now, nil).
		AddRow(int32(2), "AG999", "silver", "Bạc 999",
			int64(28000000), int64(28100000), int64(0), int64(0),
			"VND", "bacsau", false, now, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_price` WHERE `asset_price`.`deleted_at` IS NULL")).
		WillReturnRows(rows)

	prices, err := repo.ListAll(ctx)

	assert.NoError(t, err)
	require.Len(t, prices, 2)
	assert.Equal(t, "gold", prices[0].AssetType)
	assert.Equal(t, "silver", prices[1].AssetType)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- GetByTypeCodeAndCurrency ----

func TestAssetPriceRepository_GetByTypeCodeAndCurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetPriceRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(assetPriceColumns).
		AddRow(int32(1), "SJC_1L", "gold", "SJC 1 Lượng",
			int64(8500000000), int64(8510000000), int64(0), int64(0),
			"VND", "vang.today", false, now, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_price` WHERE (type_code = ? AND currency = ?) AND `asset_price`.`deleted_at` IS NULL ORDER BY `asset_price`.`id` LIMIT ?")).
		WithArgs("SJC_1L", "VND", 1).
		WillReturnRows(rows)

	price, err := repo.GetByTypeCodeAndCurrency(ctx, "SJC_1L", "VND")

	assert.NoError(t, err)
	require.NotNil(t, price)
	assert.Equal(t, "SJC_1L", price.TypeCode)
	assert.Equal(t, "VND", price.Currency)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetPriceRepository_GetByTypeCodeAndCurrency_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetPriceRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_price` WHERE (type_code = ? AND currency = ?) AND `asset_price`.`deleted_at` IS NULL ORDER BY `asset_price`.`id` LIMIT ?")).
		WithArgs("NONEXISTENT", "VND", 1).
		WillReturnError(gorm.ErrRecordNotFound)

	price, err := repo.GetByTypeCodeAndCurrency(ctx, "NONEXISTENT", "VND")

	assert.Error(t, err)
	assert.Nil(t, price)

	var notFoundErr apperrors.NotFoundError
	assert.ErrorAs(t, err, &notFoundErr)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- MarkStaleByAssetType ----

func TestAssetPriceRepository_MarkStaleByAssetType(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetPriceRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `asset_price` SET")).
		WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectCommit()

	err := repo.MarkStaleByAssetType(ctx, "gold")

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetPriceRepository_MarkStaleByAssetType_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetPriceRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `asset_price` SET")).
		WillReturnError(gorm.ErrInvalidDB)
	mock.ExpectRollback()

	err := repo.MarkStaleByAssetType(ctx, "gold")

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}
