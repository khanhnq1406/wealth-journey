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

// alertColumns is the full list of columns returned by SELECT * on user_price_alert.
var alertColumns = []string{
	"id", "user_id", "symbol", "name", "asset_type", "currency",
	"price_side", "direction", "target_price", "trigger_mode",
	"cooldown_hours", "status", "note", "last_triggered_at",
	"trigger_count", "current_price_at_creation", "created_at", "updated_at", "deleted_at",
}

// ---- Constructor ----

func TestNewUserPriceAlertRepository(t *testing.T) {
	db, _, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)

	assert.NotNil(t, repo)
	assert.IsType(t, &userPriceAlertRepository{}, repo)
}

// ---- Create ----

func TestUserPriceAlertRepository_Create(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)
	ctx := context.Background()

	alert := &models.UserPriceAlert{
		UserID:                 1,
		Symbol:                 "VCB",
		Name:                   "Vietcombank",
		AssetType:              0,
		Currency:               "VND",
		PriceSide:              "buy",
		Direction:              "above",
		TargetPrice:            100000,
		TriggerMode:            "once",
		CooldownHours:          4,
		Status:                 "active",
		CurrentPriceAtCreation: 95000,
	}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `user_price_alert`")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Create(ctx, alert)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserPriceAlertRepository_Create_Error(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)
	ctx := context.Background()

	alert := &models.UserPriceAlert{UserID: 1, Symbol: "VCB"}

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO `user_price_alert`")).
		WillReturnError(gorm.ErrInvalidDB)
	mock.ExpectRollback()

	err := repo.Create(ctx, alert)

	assert.Error(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- GetByIDForUser ----

func TestUserPriceAlertRepository_GetByIDForUser(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)
	ctx := context.Background()

	rows := sqlmock.NewRows(alertColumns).AddRow(
		int32(1), int32(42), "VCB", "Vietcombank", int32(0), "VND",
		"buy", "above", int64(100000), "once",
		int32(4), "active", "", nil,
		int32(0), int64(95000), time.Now(), time.Now(), nil,
	)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_price_alert` WHERE (id = ? AND user_id = ?) AND `user_price_alert`.`deleted_at` IS NULL ORDER BY `user_price_alert`.`id` LIMIT ?")).
		WithArgs(int32(1), int32(42), 1).
		WillReturnRows(rows)

	alert, err := repo.GetByIDForUser(ctx, 1, 42)

	assert.NoError(t, err)
	require.NotNil(t, alert)
	assert.Equal(t, int32(1), alert.ID)
	assert.Equal(t, int32(42), alert.UserID)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserPriceAlertRepository_GetByIDForUser_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)
	ctx := context.Background()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_price_alert` WHERE (id = ? AND user_id = ?) AND `user_price_alert`.`deleted_at` IS NULL ORDER BY `user_price_alert`.`id` LIMIT ?")).
		WithArgs(int32(999), int32(42), 1).
		WillReturnError(gorm.ErrRecordNotFound)

	alert, err := repo.GetByIDForUser(ctx, 999, 42)

	assert.Error(t, err)
	assert.Nil(t, alert)

	var notFoundErr apperrors.NotFoundError
	assert.ErrorAs(t, err, &notFoundErr)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- ListByUserID ----

func TestUserPriceAlertRepository_ListByUserID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)
	ctx := context.Background()

	countRows := sqlmock.NewRows([]string{"count"}).AddRow(2)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `user_price_alert` WHERE user_id = ? AND `user_price_alert`.`deleted_at` IS NULL")).
		WithArgs(int32(5)).
		WillReturnRows(countRows)

	dataRows := sqlmock.NewRows(alertColumns).
		AddRow(
			int32(1), int32(5), "VCB", "Vietcombank", int32(0), "VND",
			"buy", "above", int64(100000), "once",
			int32(4), "active", "", nil,
			int32(0), int64(95000), time.Now(), time.Now(), nil,
		).
		AddRow(
			int32(2), int32(5), "FPT", "FPT Corp", int32(0), "VND",
			"buy", "below", int64(80000), "repeat",
			int32(4), "active", "", nil,
			int32(0), int64(90000), time.Now(), time.Now(), nil,
		)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_price_alert` WHERE user_id = ? AND `user_price_alert`.`deleted_at` IS NULL ORDER BY created_at DESC")).
		WithArgs(int32(5)).
		WillReturnRows(dataRows)

	alerts, total, err := repo.ListByUserID(ctx, 5, "", ListOptions{})

	assert.NoError(t, err)
	assert.Equal(t, int64(2), total)
	assert.Len(t, alerts, 2)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserPriceAlertRepository_ListByUserID_WithStatusFilter(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)
	ctx := context.Background()

	countRows := sqlmock.NewRows([]string{"count"}).AddRow(1)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `user_price_alert` WHERE user_id = ? AND status = ? AND `user_price_alert`.`deleted_at` IS NULL")).
		WithArgs(int32(5), "active").
		WillReturnRows(countRows)

	dataRows := sqlmock.NewRows(alertColumns).AddRow(
		int32(1), int32(5), "VCB", "Vietcombank", int32(0), "VND",
		"buy", "above", int64(100000), "once",
		int32(4), "active", "", nil,
		int32(0), int64(95000), time.Now(), time.Now(), nil,
	)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_price_alert` WHERE user_id = ? AND status = ? AND `user_price_alert`.`deleted_at` IS NULL ORDER BY created_at DESC")).
		WithArgs(int32(5), "active").
		WillReturnRows(dataRows)

	alerts, total, err := repo.ListByUserID(ctx, 5, "active", ListOptions{})

	assert.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Len(t, alerts, 1)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- Delete ----

func TestUserPriceAlertRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `user_price_alert` SET `deleted_at`=? WHERE (id = ? AND user_id = ?) AND `user_price_alert`.`deleted_at` IS NULL")).
		WithArgs(sqlmock.AnyArg(), int32(1), int32(42)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.Delete(ctx, 1, 42)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserPriceAlertRepository_Delete_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `user_price_alert` SET `deleted_at`=? WHERE (id = ? AND user_id = ?) AND `user_price_alert`.`deleted_at` IS NULL")).
		WithArgs(sqlmock.AnyArg(), int32(999), int32(42)).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()

	err := repo.Delete(ctx, 999, 42)

	assert.Error(t, err)

	var notFoundErr apperrors.NotFoundError
	assert.ErrorAs(t, err, &notFoundErr)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- CountActiveByUserID ----

func TestUserPriceAlertRepository_CountActiveByUserID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)
	ctx := context.Background()

	countRows := sqlmock.NewRows([]string{"count"}).AddRow(3)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `user_price_alert` WHERE (user_id = ? AND status = 'active') AND `user_price_alert`.`deleted_at` IS NULL")).
		WithArgs(int32(5)).
		WillReturnRows(countRows)

	count, err := repo.CountActiveByUserID(ctx, 5)

	assert.NoError(t, err)
	assert.Equal(t, int64(3), count)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- ListActive ----

func TestUserPriceAlertRepository_ListActive(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)
	ctx := context.Background()

	dataRows := sqlmock.NewRows(alertColumns).
		AddRow(
			int32(1), int32(5), "VCB", "Vietcombank", int32(0), "VND",
			"buy", "above", int64(100000), "once",
			int32(4), "active", "", nil,
			int32(0), int64(95000), time.Now(), time.Now(), nil,
		).
		AddRow(
			int32(2), int32(7), "BTC", "Bitcoin", int32(1), "USD",
			"buy", "above", int64(50000), "repeat",
			int32(4), "active", "", nil,
			int32(0), int64(45000), time.Now(), time.Now(), nil,
		)

	mock.ExpectQuery(regexp.QuoteMeta("SELECT * FROM `user_price_alert` WHERE status = 'active' AND `user_price_alert`.`deleted_at` IS NULL")).
		WillReturnRows(dataRows)

	alerts, err := repo.ListActive(ctx)

	assert.NoError(t, err)
	assert.Len(t, alerts, 2)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// ---- UpdateStatus ----

func TestUserPriceAlertRepository_UpdateStatus(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)
	ctx := context.Background()

	now := time.Now()
	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `user_price_alert`")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := repo.UpdateStatus(ctx, 1, "triggered", &now, 1)

	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserPriceAlertRepository_UpdateStatus_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping DB mock test in short mode")
	}

	db, mock, database := setupMockDB(t)
	defer func() { sqlDB, _ := db.DB(); _ = sqlDB.Close() }()

	repo := NewUserPriceAlertRepository(database)
	ctx := context.Background()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE `user_price_alert`")).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()

	err := repo.UpdateStatus(ctx, 999, "triggered", nil, 0)

	assert.Error(t, err)

	var notFoundErr apperrors.NotFoundError
	assert.ErrorAs(t, err, &notFoundErr)
	assert.NoError(t, mock.ExpectationsWereMet())
}
