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
var _ GoldDisplayConfigRepository = (*goldDisplayConfigRepository)(nil)

// goldDisplayConfigColumns is the full list of columns returned by SELECT * on gold_display_config.
var goldDisplayConfigColumns = []string{
	"id", "type_code", "display_name", "display_order",
	"enabled", "show_in_investment",
	"created_at", "updated_at", "deleted_at",
}

// ---- Constructor ----

func TestNewGoldDisplayConfigRepository(t *testing.T) {
	db, _, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)

	assert.NotNil(t, repo)
	assert.IsType(t, &goldDisplayConfigRepository{}, repo)
}

// ---- ListAll ----

func TestGoldDisplayConfigRepository_ListAll(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(goldDisplayConfigColumns).
		AddRow(int32(1), "SJC_1L", "SJC 1 Lượng", int32(1), true, true, now, now, nil).
		AddRow(int32(2), "SJC_5C", "SJC 5 Chỉ", int32(2), true, true, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `gold_display_config` WHERE `gold_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WillReturnRows(rows)

	configs, err := repo.ListAll(ctx)

	assert.NoError(t, err)
	require.Len(t, configs, 2)
	assert.Equal(t, "SJC_1L", configs[0].TypeCode)
	assert.Equal(t, "SJC_5C", configs[1].TypeCode)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGoldDisplayConfigRepository_ListAll_Empty(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `gold_display_config` WHERE `gold_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WillReturnRows(sqlmock.NewRows(goldDisplayConfigColumns))

	configs, err := repo.ListAll(ctx)

	assert.NoError(t, err)
	assert.Empty(t, configs)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGoldDisplayConfigRepository_ListAll_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `gold_display_config` WHERE `gold_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WillReturnError(gorm.ErrInvalidDB)

	configs, err := repo.ListAll(ctx)

	assert.Error(t, err)
	assert.Nil(t, configs)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- ListEnabled ----

func TestGoldDisplayConfigRepository_ListEnabled(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(goldDisplayConfigColumns).
		AddRow(int32(1), "SJC_1L", "SJC 1 Lượng", int32(1), true, true, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `gold_display_config` WHERE enabled = true AND `gold_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WillReturnRows(rows)

	configs, err := repo.ListEnabled(ctx)

	assert.NoError(t, err)
	require.Len(t, configs, 1)
	assert.Equal(t, "SJC_1L", configs[0].TypeCode)
	assert.True(t, configs[0].Enabled)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGoldDisplayConfigRepository_ListEnabled_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `gold_display_config` WHERE enabled = true AND `gold_display_config`.`deleted_at` IS NULL ORDER BY display_order ASC")).
		WillReturnError(gorm.ErrInvalidDB)

	configs, err := repo.ListEnabled(ctx)

	assert.Error(t, err)
	assert.Nil(t, configs)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- GetByID ----

func TestGoldDisplayConfigRepository_GetByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(goldDisplayConfigColumns).
		AddRow(int32(1), "SJC_1L", "SJC 1 Lượng", int32(1), true, true, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `gold_display_config` WHERE `gold_display_config`.`id` = ? AND `gold_display_config`.`deleted_at` IS NULL ORDER BY `gold_display_config`.`id` LIMIT ?")).
		WithArgs(int32(1), 1).
		WillReturnRows(rows)

	config, err := repo.GetByID(ctx, 1)

	assert.NoError(t, err)
	require.NotNil(t, config)
	assert.Equal(t, int32(1), config.ID)
	assert.Equal(t, "SJC_1L", config.TypeCode)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGoldDisplayConfigRepository_GetByID_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `gold_display_config` WHERE `gold_display_config`.`id` = ? AND `gold_display_config`.`deleted_at` IS NULL ORDER BY `gold_display_config`.`id` LIMIT ?")).
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

func TestGoldDisplayConfigRepository_GetByTypeCode(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	now := time.Now()
	rows := sqlmock.NewRows(goldDisplayConfigColumns).
		AddRow(int32(1), "SJC_1L", "SJC 1 Lượng", int32(1), true, true, now, now, nil)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `gold_display_config` WHERE type_code = ? AND `gold_display_config`.`deleted_at` IS NULL ORDER BY `gold_display_config`.`id` LIMIT ?")).
		WithArgs("SJC_1L", 1).
		WillReturnRows(rows)

	config, err := repo.GetByTypeCode(ctx, "SJC_1L")

	assert.NoError(t, err)
	require.NotNil(t, config)
	assert.Equal(t, "SJC_1L", config.TypeCode)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGoldDisplayConfigRepository_GetByTypeCode_NotFound_ReturnsNilNil(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `gold_display_config` WHERE type_code = ? AND `gold_display_config`.`deleted_at` IS NULL ORDER BY `gold_display_config`.`id` LIMIT ?")).
		WithArgs("NONEXISTENT", 1).
		WillReturnError(gorm.ErrRecordNotFound)

	// GetByTypeCode returns nil, nil when record not found — caller decides if missing is an error.
	config, err := repo.GetByTypeCode(ctx, "NONEXISTENT")

	assert.NoError(t, err)
	assert.Nil(t, config)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGoldDisplayConfigRepository_GetByTypeCode_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `gold_display_config` WHERE type_code = ? AND `gold_display_config`.`deleted_at` IS NULL ORDER BY `gold_display_config`.`id` LIMIT ?")).
		WithArgs("SJC_1L", 1).
		WillReturnError(gorm.ErrInvalidDB)

	config, err := repo.GetByTypeCode(ctx, "SJC_1L")

	assert.Error(t, err)
	assert.Nil(t, config)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- GetByTypeCode exact-match security: ensures no LIKE/partial match ----

// TestGoldDisplayConfigRepository_GetByTypeCode_ExactMatchOnly verifies that
// the query uses exact equality (=) for type_code — not LIKE or partial match —
// which prevents SQL injection and accidental fuzzy lookups.
func TestGoldDisplayConfigRepository_GetByTypeCode_ExactMatchOnly(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	// Expect a query with exact match (=) not LIKE.
	// The sqlmock query pattern below only matches if LIKE is NOT used.
	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `gold_display_config` WHERE type_code = ? AND `gold_display_config`.`deleted_at` IS NULL ORDER BY `gold_display_config`.`id` LIMIT ?")).
		WithArgs("SJC_1L", 1).
		WillReturnRows(sqlmock.NewRows(goldDisplayConfigColumns))

	config, err := repo.GetByTypeCode(ctx, "SJC_1L")

	assert.NoError(t, err)
	assert.Nil(t, config) // empty result rows → nil, nil
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- Create ----

func TestGoldDisplayConfigRepository_Create(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	config := &models.GoldDisplayConfig{
		TypeCode:         "SJC_1L",
		DisplayName:      "SJC 1 Lượng",
		DisplayOrder:     1,
		Enabled:          true,
		ShowInInvestment: true,
	}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `gold_display_config`")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Create(ctx, config)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGoldDisplayConfigRepository_Create_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	config := &models.GoldDisplayConfig{TypeCode: "SJC_1L", DisplayName: "SJC 1 Lượng"}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `gold_display_config`")).
		WillReturnError(gorm.ErrInvalidDB)
	mock.ExpectRollback()

	err := repo.Create(ctx, config)

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- Update ----

func TestGoldDisplayConfigRepository_Update(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	config := &models.GoldDisplayConfig{
		ID:          1,
		TypeCode:    "SJC_1L",
		DisplayName: "SJC 1 Lượng Updated",
		Enabled:     false,
	}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `gold_display_config` SET")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Update(ctx, config)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGoldDisplayConfigRepository_Update_DBError(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	config := &models.GoldDisplayConfig{ID: 1, TypeCode: "SJC_1L"}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `gold_display_config` SET")).
		WillReturnError(gorm.ErrInvalidDB)
	mock.ExpectRollback()

	err := repo.Update(ctx, config)

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- Delete ----

func TestGoldDisplayConfigRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `gold_display_config` SET `deleted_at`=? WHERE `gold_display_config`.`id` = ? AND `gold_display_config`.`deleted_at` IS NULL")).
		WithArgs(sqlmock.AnyArg(), int32(1)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Delete(ctx, 1)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGoldDisplayConfigRepository_Delete_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewGoldDisplayConfigRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `gold_display_config` SET `deleted_at`=? WHERE `gold_display_config`.`id` = ? AND `gold_display_config`.`deleted_at` IS NULL")).
		WithArgs(sqlmock.AnyArg(), int32(999)).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()

	err := repo.Delete(ctx, 999)

	assert.Error(t, err)

	var notFoundErr apperrors.NotFoundError
	assert.ErrorAs(t, err, &notFoundErr)
	assert.NoError(t, mock.ExpectationsWereMet())
}
