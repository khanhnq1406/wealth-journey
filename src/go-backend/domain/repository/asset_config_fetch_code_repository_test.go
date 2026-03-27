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

// Compile-time interface compliance check.
var _ AssetConfigFetchCodeRepository = (*assetConfigFetchCodeRepository)(nil)

// assetConfigFetchCodeColumns is the full list of columns returned by SELECT * on asset_config_fetch_code.
var assetConfigFetchCodeColumns = []string{
	"id", "config_id", "type_code", "priority",
	"created_at", "updated_at", "deleted_at",
}

// ---- Constructor ----

func TestNewAssetConfigFetchCodeRepository(t *testing.T) {
	db, _, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)

	assert.NotNil(t, repo)
	assert.IsType(t, &assetConfigFetchCodeRepository{}, repo)
}

// ---- ListByConfigID ----

func TestAssetConfigFetchCodeRepository_ListByConfigID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(assetConfigFetchCodeColumns).
		AddRow(int32(1), int32(10), "SJC_1L", int32(0), now, now, nil).
		AddRow(int32(2), int32(10), "DOJI_1L", int32(1), now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_config_fetch_code` WHERE config_id = ? AND `asset_config_fetch_code`.`deleted_at` IS NULL ORDER BY priority ASC")).
		WithArgs(int32(10)).
		WillReturnRows(rows)

	fetchCodes, err := repo.ListByConfigID(ctx, 10)

	assert.NoError(t, err)
	require.Len(t, fetchCodes, 2)
	assert.Equal(t, "SJC_1L", fetchCodes[0].TypeCode)
	assert.Equal(t, int32(0), fetchCodes[0].Priority)
	assert.Equal(t, "DOJI_1L", fetchCodes[1].TypeCode)
	assert.Equal(t, int32(1), fetchCodes[1].Priority)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetConfigFetchCodeRepository_ListByConfigID_Empty(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_config_fetch_code` WHERE config_id = ? AND `asset_config_fetch_code`.`deleted_at` IS NULL ORDER BY priority ASC")).
		WithArgs(int32(99)).
		WillReturnRows(sqlmock.NewRows(assetConfigFetchCodeColumns))

	fetchCodes, err := repo.ListByConfigID(ctx, 99)

	assert.NoError(t, err)
	assert.Empty(t, fetchCodes)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetConfigFetchCodeRepository_ListByConfigID_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_config_fetch_code` WHERE config_id = ? AND `asset_config_fetch_code`.`deleted_at` IS NULL ORDER BY priority ASC")).
		WithArgs(int32(10)).
		WillReturnError(gorm.ErrInvalidDB)

	fetchCodes, err := repo.ListByConfigID(ctx, 10)

	assert.Error(t, err)
	assert.Nil(t, fetchCodes)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ListByConfigID_OrderedByPriority verifies the query always orders by priority ASC
// so the caller can rely on the first item being the highest-priority fetch code.
func TestAssetConfigFetchCodeRepository_ListByConfigID_OrderedByPriority(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	now := time.Now()
	// Return rows in priority order: 0, 1, 2
	rows := sqlmock.NewRows(assetConfigFetchCodeColumns).
		AddRow(int32(3), int32(5), "CODE_A", int32(0), now, now, nil).
		AddRow(int32(1), int32(5), "CODE_B", int32(1), now, now, nil).
		AddRow(int32(2), int32(5), "CODE_C", int32(2), now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_config_fetch_code` WHERE config_id = ? AND `asset_config_fetch_code`.`deleted_at` IS NULL ORDER BY priority ASC")).
		WithArgs(int32(5)).
		WillReturnRows(rows)

	fetchCodes, err := repo.ListByConfigID(ctx, 5)

	assert.NoError(t, err)
	require.Len(t, fetchCodes, 3)
	// Verify priority ordering is preserved
	assert.Equal(t, int32(0), fetchCodes[0].Priority)
	assert.Equal(t, int32(1), fetchCodes[1].Priority)
	assert.Equal(t, int32(2), fetchCodes[2].Priority)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- Create ----

func TestAssetConfigFetchCodeRepository_Create(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	fc := &models.AssetConfigFetchCode{
		ConfigID: 10,
		TypeCode: "SJC_1L",
		Priority: 0,
	}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `asset_config_fetch_code`")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Create(ctx, fc)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetConfigFetchCodeRepository_Create_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	fc := &models.AssetConfigFetchCode{ConfigID: 10, TypeCode: "SJC_1L"}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `asset_config_fetch_code`")).
		WillReturnError(gorm.ErrInvalidDB)
	mock.ExpectRollback()

	err := repo.Create(ctx, fc)

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- Update ----

func TestAssetConfigFetchCodeRepository_Update(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	fc := &models.AssetConfigFetchCode{
		ID:       1,
		ConfigID: 10,
		TypeCode: "SJC_1L",
		Priority: 2, // priority changed
	}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `asset_config_fetch_code` SET")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Update(ctx, fc)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetConfigFetchCodeRepository_Update_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	fc := &models.AssetConfigFetchCode{ID: 1, ConfigID: 10, TypeCode: "SJC_1L", Priority: 1}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `asset_config_fetch_code` SET")).
		WillReturnError(gorm.ErrInvalidDB)
	mock.ExpectRollback()

	err := repo.Update(ctx, fc)

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- Delete ----

func TestAssetConfigFetchCodeRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `asset_config_fetch_code` SET `deleted_at`=? WHERE `asset_config_fetch_code`.`id` = ? AND `asset_config_fetch_code`.`deleted_at` IS NULL")).
		WithArgs(sqlmock.AnyArg(), int32(1)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Delete(ctx, 1)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetConfigFetchCodeRepository_Delete_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `asset_config_fetch_code` SET `deleted_at`=? WHERE `asset_config_fetch_code`.`id` = ? AND `asset_config_fetch_code`.`deleted_at` IS NULL")).
		WithArgs(sqlmock.AnyArg(), int32(999)).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()

	err := repo.Delete(ctx, 999)

	assert.Error(t, err)

	var notFoundErr apperrors.NotFoundError
	assert.ErrorAs(t, err, &notFoundErr)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetConfigFetchCodeRepository_Delete_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `asset_config_fetch_code` SET `deleted_at`=? WHERE `asset_config_fetch_code`.`id` = ? AND `asset_config_fetch_code`.`deleted_at` IS NULL")).
		WithArgs(sqlmock.AnyArg(), int32(1)).
		WillReturnError(gorm.ErrInvalidDB)
	mock.ExpectRollback()

	err := repo.Delete(ctx, 1)

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- CountByConfigID ----

func TestAssetConfigFetchCodeRepository_CountByConfigID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	countRows := sqlmock.NewRows([]string{"count"}).AddRow(int64(3))

	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `asset_config_fetch_code` WHERE config_id = ? AND `asset_config_fetch_code`.`deleted_at` IS NULL")).
		WithArgs(int32(10)).
		WillReturnRows(countRows)

	count, err := repo.CountByConfigID(ctx, 10)

	assert.NoError(t, err)
	assert.Equal(t, int64(3), count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetConfigFetchCodeRepository_CountByConfigID_Zero(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	countRows := sqlmock.NewRows([]string{"count"}).AddRow(int64(0))

	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `asset_config_fetch_code` WHERE config_id = ? AND `asset_config_fetch_code`.`deleted_at` IS NULL")).
		WithArgs(int32(99)).
		WillReturnRows(countRows)

	count, err := repo.CountByConfigID(ctx, 99)

	assert.NoError(t, err)
	assert.Equal(t, int64(0), count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetConfigFetchCodeRepository_CountByConfigID_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetConfigFetchCodeRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `asset_config_fetch_code` WHERE config_id = ? AND `asset_config_fetch_code`.`deleted_at` IS NULL")).
		WithArgs(int32(10)).
		WillReturnError(gorm.ErrInvalidDB)

	count, err := repo.CountByConfigID(ctx, 10)

	assert.Error(t, err)
	assert.Equal(t, int64(0), count)
	assert.NoError(t, mock.ExpectationsWereMet())
}
