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
var _ AssetDisplayConfigRepository = (*assetDisplayConfigRepository)(nil)

// assetDisplayConfigColumns is the full list of columns returned by SELECT * on asset_display_config.
var assetDisplayConfigColumns = []string{
	"id", "type_code", "asset_type", "display_name", "display_order",
	"enabled", "show_in_investment",
	"created_at", "updated_at", "deleted_at",
}

// ---- Constructor ----

func TestNewAssetDisplayConfigRepository(t *testing.T) {
	db, _, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)

	assert.NotNil(t, repo)
	assert.IsType(t, &assetDisplayConfigRepository{}, repo)
}

// ---- ListAll ----

func TestAssetDisplayConfigRepository_ListAll(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(assetDisplayConfigColumns).
		AddRow(int32(1), "SJC_1L", "gold", "SJC 1 Lượng", int32(1), true, true, now, now, nil).
		AddRow(int32(2), "SJC_5C", "gold", "SJC 5 Chỉ", int32(2), true, true, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE asset_type = ? AND `asset_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WithArgs("gold").
		WillReturnRows(rows)

	configs, err := repo.ListAll(ctx, "gold")

	assert.NoError(t, err)
	require.Len(t, configs, 2)
	assert.Equal(t, "SJC_1L", configs[0].TypeCode)
	assert.Equal(t, "SJC_5C", configs[1].TypeCode)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_ListAll_Empty(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE asset_type = ? AND `asset_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WithArgs("silver").
		WillReturnRows(sqlmock.NewRows(assetDisplayConfigColumns))

	configs, err := repo.ListAll(ctx, "silver")

	assert.NoError(t, err)
	assert.Empty(t, configs)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_ListAll_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE asset_type = ? AND `asset_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WithArgs("gold").
		WillReturnError(gorm.ErrInvalidDB)

	configs, err := repo.ListAll(ctx, "gold")

	assert.Error(t, err)
	assert.Nil(t, configs)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- ListEnabled ----

func TestAssetDisplayConfigRepository_ListEnabled(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(assetDisplayConfigColumns).
		AddRow(int32(1), "SJC_1L", "gold", "SJC 1 Lượng", int32(1), true, true, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE enabled = true AND `asset_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WillReturnRows(rows)

	configs, err := repo.ListEnabled(ctx)

	assert.NoError(t, err)
	require.Len(t, configs, 1)
	assert.Equal(t, "SJC_1L", configs[0].TypeCode)
	assert.True(t, configs[0].Enabled)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_ListEnabled_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE enabled = true AND `asset_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WillReturnError(gorm.ErrInvalidDB)

	configs, err := repo.ListEnabled(ctx)

	assert.Error(t, err)
	assert.Nil(t, configs)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- GetByID ----

func TestAssetDisplayConfigRepository_GetByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(assetDisplayConfigColumns).
		AddRow(int32(1), "SJC_1L", "gold", "SJC 1 Lượng", int32(1), true, true, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE `asset_display_config`.`id` = ? AND `asset_display_config`.`deleted_at` IS NULL ORDER BY `asset_display_config`.`id` LIMIT ?")).
		WithArgs(int32(1), 1).
		WillReturnRows(rows)

	config, err := repo.GetByID(ctx, 1)

	assert.NoError(t, err)
	require.NotNil(t, config)
	assert.Equal(t, int32(1), config.ID)
	assert.Equal(t, "SJC_1L", config.TypeCode)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_GetByID_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE `asset_display_config`.`id` = ? AND `asset_display_config`.`deleted_at` IS NULL ORDER BY `asset_display_config`.`id` LIMIT ?")).
		WithArgs(int32(999), 1).
		WillReturnError(gorm.ErrRecordNotFound)

	config, err := repo.GetByID(ctx, 999)

	assert.Error(t, err)
	assert.Nil(t, config)

	var notFoundErr apperrors.NotFoundError
	assert.ErrorAs(t, err, &notFoundErr)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- GetByTypeCode ----

func TestAssetDisplayConfigRepository_GetByTypeCode(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(assetDisplayConfigColumns).
		AddRow(int32(1), "SJC_1L", "gold", "SJC 1 Lượng", int32(1), true, true, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE type_code = ? AND `asset_display_config`.`deleted_at` IS NULL ORDER BY `asset_display_config`.`id` LIMIT ?")).
		WithArgs("SJC_1L", 1).
		WillReturnRows(rows)

	config, err := repo.GetByTypeCode(ctx, "SJC_1L")

	assert.NoError(t, err)
	require.NotNil(t, config)
	assert.Equal(t, "SJC_1L", config.TypeCode)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_GetByTypeCode_NotFound_ReturnsNilNil(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE type_code = ? AND `asset_display_config`.`deleted_at` IS NULL ORDER BY `asset_display_config`.`id` LIMIT ?")).
		WithArgs("NONEXISTENT", 1).
		WillReturnError(gorm.ErrRecordNotFound)

	// GetByTypeCode returns nil, nil when record not found — caller decides if missing is an error.
	config, err := repo.GetByTypeCode(ctx, "NONEXISTENT")

	assert.NoError(t, err)
	assert.Nil(t, config)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_GetByTypeCode_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE type_code = ? AND `asset_display_config`.`deleted_at` IS NULL ORDER BY `asset_display_config`.`id` LIMIT ?")).
		WithArgs("SJC_1L", 1).
		WillReturnError(gorm.ErrInvalidDB)

	config, err := repo.GetByTypeCode(ctx, "SJC_1L")

	assert.Error(t, err)
	assert.Nil(t, config)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestAssetDisplayConfigRepository_GetByTypeCode_ExactMatchOnly verifies that
// the query uses exact equality (=) for type_code — not LIKE or partial match —
// which prevents SQL injection and accidental fuzzy lookups.
func TestAssetDisplayConfigRepository_GetByTypeCode_ExactMatchOnly(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	// Expect a query with exact match (=) not LIKE.
	// The sqlmock query pattern below only matches if LIKE is NOT used.
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE type_code = ? AND `asset_display_config`.`deleted_at` IS NULL ORDER BY `asset_display_config`.`id` LIMIT ?")).
		WithArgs("SJC_1L", 1).
		WillReturnRows(sqlmock.NewRows(assetDisplayConfigColumns))

	config, err := repo.GetByTypeCode(ctx, "SJC_1L")

	assert.NoError(t, err)
	assert.Nil(t, config) // empty result rows → nil, nil
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- Create ----

func TestAssetDisplayConfigRepository_Create(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	config := &models.AssetDisplayConfig{
		TypeCode:         "SJC_1L",
		AssetType:        "gold",
		DisplayName:      "SJC 1 Lượng",
		DisplayOrder:     1,
		Enabled:          true,
		ShowInInvestment: true,
	}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `asset_display_config`")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Create(ctx, config)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_Create_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	config := &models.AssetDisplayConfig{TypeCode: "SJC_1L", AssetType: "gold", DisplayName: "SJC 1 Lượng"}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `asset_display_config`")).
		WillReturnError(gorm.ErrInvalidDB)
	mock.ExpectRollback()

	err := repo.Create(ctx, config)

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- Update ----

func TestAssetDisplayConfigRepository_Update(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	config := &models.AssetDisplayConfig{
		ID:          1,
		TypeCode:    "SJC_1L",
		AssetType:   "gold",
		DisplayName: "SJC 1 Lượng Updated",
		Enabled:     false,
	}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `asset_display_config` SET")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Update(ctx, config)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_Update_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	config := &models.AssetDisplayConfig{ID: 1, TypeCode: "SJC_1L", AssetType: "gold"}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `asset_display_config` SET")).
		WillReturnError(gorm.ErrInvalidDB)
	mock.ExpectRollback()

	err := repo.Update(ctx, config)

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- Delete ----

func TestAssetDisplayConfigRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `asset_display_config` SET `deleted_at`=? WHERE `asset_display_config`.`id` = ? AND `asset_display_config`.`deleted_at` IS NULL")).
		WithArgs(sqlmock.AnyArg(), int32(1)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Delete(ctx, 1)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_Delete_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `asset_display_config` SET `deleted_at`=? WHERE `asset_display_config`.`id` = ? AND `asset_display_config`.`deleted_at` IS NULL")).
		WithArgs(sqlmock.AnyArg(), int32(999)).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()

	err := repo.Delete(ctx, 999)

	assert.Error(t, err)

	var notFoundErr apperrors.NotFoundError
	assert.ErrorAs(t, err, &notFoundErr)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- ListByAssetType (NEW) ----

func TestAssetDisplayConfigRepository_ListByAssetType(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(assetDisplayConfigColumns).
		AddRow(int32(1), "SJC_1L", "gold", "SJC 1 Lượng", int32(1), true, true, now, now, nil).
		AddRow(int32(2), "SJC_5C", "gold", "SJC 5 Chỉ", int32(2), true, true, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE (asset_type = ? AND enabled = true) AND `asset_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WithArgs("gold").
		WillReturnRows(rows)

	configs, err := repo.ListByAssetType(ctx, "gold")

	assert.NoError(t, err)
	require.Len(t, configs, 2)
	assert.Equal(t, "SJC_1L", configs[0].TypeCode)
	assert.Equal(t, "gold", configs[0].AssetType)
	assert.True(t, configs[0].Enabled)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_ListByAssetType_Empty(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE (asset_type = ? AND enabled = true) AND `asset_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WithArgs("silver").
		WillReturnRows(sqlmock.NewRows(assetDisplayConfigColumns))

	configs, err := repo.ListByAssetType(ctx, "silver")

	assert.NoError(t, err)
	assert.Empty(t, configs)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_ListByAssetType_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE (asset_type = ? AND enabled = true) AND `asset_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WithArgs("gold").
		WillReturnError(gorm.ErrInvalidDB)

	configs, err := repo.ListByAssetType(ctx, "gold")

	assert.Error(t, err)
	assert.Nil(t, configs)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestAssetDisplayConfigRepository_ListByAssetType_ExactMatchOnly verifies that
// the asset_type filter uses exact equality (=) — preventing SQL injection.
func TestAssetDisplayConfigRepository_ListByAssetType_ExactMatchOnly(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	// Expect exact match (=) not LIKE.
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE (asset_type = ? AND enabled = true) AND `asset_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WithArgs("gold").
		WillReturnRows(sqlmock.NewRows(assetDisplayConfigColumns))

	configs, err := repo.ListByAssetType(ctx, "gold")

	assert.NoError(t, err)
	assert.Empty(t, configs)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- GetByTypeCodeAndAssetType (NEW) ----

func TestAssetDisplayConfigRepository_GetByTypeCodeAndAssetType(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(assetDisplayConfigColumns).
		AddRow(int32(1), "SJC_1L", "gold", "SJC 1 Lượng", int32(1), true, true, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE (type_code = ? AND asset_type = ?) AND `asset_display_config`.`deleted_at` IS NULL ORDER BY `asset_display_config`.`id` LIMIT ?")).
		WithArgs("SJC_1L", "gold", 1).
		WillReturnRows(rows)

	config, err := repo.GetByTypeCodeAndAssetType(ctx, "SJC_1L", "gold")

	assert.NoError(t, err)
	require.NotNil(t, config)
	assert.Equal(t, "SJC_1L", config.TypeCode)
	assert.Equal(t, "gold", config.AssetType)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_GetByTypeCodeAndAssetType_NotFound_ReturnsNilNil(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE (type_code = ? AND asset_type = ?) AND `asset_display_config`.`deleted_at` IS NULL ORDER BY `asset_display_config`.`id` LIMIT ?")).
		WithArgs("NONEXISTENT", "gold", 1).
		WillReturnError(gorm.ErrRecordNotFound)

	// Returns nil, nil when not found — caller decides if missing is an error.
	config, err := repo.GetByTypeCodeAndAssetType(ctx, "NONEXISTENT", "gold")

	assert.NoError(t, err)
	assert.Nil(t, config)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_GetByTypeCodeAndAssetType_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE (type_code = ? AND asset_type = ?) AND `asset_display_config`.`deleted_at` IS NULL ORDER BY `asset_display_config`.`id` LIMIT ?")).
		WithArgs("SJC_1L", "gold", 1).
		WillReturnError(gorm.ErrInvalidDB)

	config, err := repo.GetByTypeCodeAndAssetType(ctx, "SJC_1L", "gold")

	assert.Error(t, err)
	assert.Nil(t, config)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestAssetDisplayConfigRepository_GetByTypeCodeAndAssetType_ExactMatchOnly verifies that
// both type_code and asset_type use exact equality (=) — preventing SQL injection.
func TestAssetDisplayConfigRepository_GetByTypeCodeAndAssetType_ExactMatchOnly(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	// Expect exact match (=) on both columns, not LIKE.
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `asset_display_config` WHERE (type_code = ? AND asset_type = ?) AND `asset_display_config`.`deleted_at` IS NULL ORDER BY `asset_display_config`.`id` LIMIT ?")).
		WithArgs("SJC_1L", "gold", 1).
		WillReturnRows(sqlmock.NewRows(assetDisplayConfigColumns))

	config, err := repo.GetByTypeCodeAndAssetType(ctx, "SJC_1L", "gold")

	assert.NoError(t, err)
	assert.Nil(t, config) // empty rows → nil, nil
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- ListEnabledTypeCodesByAssetType ----

func TestAssetDisplayConfigRepository_ListEnabledTypeCodesByAssetType(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	rows := sqlmock.NewRows([]string{"type_code"}).
		AddRow("SJC_1L").
		AddRow("SJC_5C")

	mock.ExpectQuery(regexp.QuoteMeta("SELECT `type_code` FROM `asset_display_config` WHERE (asset_type = ? AND enabled = true) AND `asset_display_config`.`deleted_at` IS NULL")).
		WithArgs("gold").
		WillReturnRows(rows)

	typeCodes, err := repo.ListEnabledTypeCodesByAssetType(ctx, "gold")

	assert.NoError(t, err)
	require.Len(t, typeCodes, 2)
	assert.Equal(t, "SJC_1L", typeCodes[0])
	assert.Equal(t, "SJC_5C", typeCodes[1])
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_ListEnabledTypeCodesByAssetType_Empty(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT `type_code` FROM `asset_display_config` WHERE (asset_type = ? AND enabled = true) AND `asset_display_config`.`deleted_at` IS NULL")).
		WithArgs("currency").
		WillReturnRows(sqlmock.NewRows([]string{"type_code"}))

	typeCodes, err := repo.ListEnabledTypeCodesByAssetType(ctx, "currency")

	// Empty slice, not error — contract requirement.
	assert.NoError(t, err)
	assert.NotNil(t, typeCodes)
	assert.Empty(t, typeCodes)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestAssetDisplayConfigRepository_ListEnabledTypeCodesByAssetType_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT `type_code` FROM `asset_display_config` WHERE (asset_type = ? AND enabled = true) AND `asset_display_config`.`deleted_at` IS NULL")).
		WithArgs("gold").
		WillReturnError(gorm.ErrInvalidDB)

	typeCodes, err := repo.ListEnabledTypeCodesByAssetType(ctx, "gold")

	assert.Error(t, err)
	assert.Nil(t, typeCodes)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestAssetDisplayConfigRepository_ListEnabledTypeCodesByAssetType_ExactMatchOnly verifies that
// asset_type uses exact equality (=) — preventing SQL injection and accidental fuzzy lookups.
func TestAssetDisplayConfigRepository_ListEnabledTypeCodesByAssetType_ExactMatchOnly(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewAssetDisplayConfigRepository(database)
	ctx := context.Background()

	// The query must use exact (=) — if implementation used LIKE, sqlmock would not match this pattern.
	mock.ExpectQuery(regexp.QuoteMeta("SELECT `type_code` FROM `asset_display_config` WHERE (asset_type = ? AND enabled = true) AND `asset_display_config`.`deleted_at` IS NULL")).
		WithArgs("silver").
		WillReturnRows(sqlmock.NewRows([]string{"type_code"}))

	typeCodes, err := repo.ListEnabledTypeCodesByAssetType(ctx, "silver")

	assert.NoError(t, err)
	assert.Empty(t, typeCodes)
	assert.NoError(t, mock.ExpectationsWereMet())
}
