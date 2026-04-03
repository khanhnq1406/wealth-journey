package auth_test

import (
	"context"
	"testing"
	"wealthjourney/domain/auth"
	"wealthjourney/pkg/database"
	apperrors "wealthjourney/pkg/errors"
	pkgredis "wealthjourney/pkg/redis"

	"github.com/DATA-DOG/go-sqlmock"
	goredis "github.com/go-redis/redis/v8"
	"github.com/alicebob/miniredis/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// setupAuthServerWithMockDB creates an auth.Server backed by a sqlmock database.
// Pass a non-nil rdb for tests that exercise invalidateOtherSessions.
func setupAuthServerWithMockDB(t *testing.T) (*auth.Server, sqlmock.Sqlmock, func()) {
	t.Helper()

	sqlDB, mock, err := sqlmock.New()
	require.NoError(t, err)

	dialector := mysql.New(mysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	})
	db, err := gorm.Open(dialector, &gorm.Config{})
	require.NoError(t, err)

	dbWrapper := &database.Database{DB: db}
	server := auth.NewServer(dbWrapper, nil, nil, nil, nil)

	cleanup := func() {
		rawDB, _ := db.DB()
		_ = rawDB.Close()
	}
	return server, mock, cleanup
}

// setupAuthServerWithMockDBAndRedis creates an auth.Server with both sqlmock and miniredis.
func setupAuthServerWithMockDBAndRedis(t *testing.T) (*auth.Server, sqlmock.Sqlmock, *miniredis.Miniredis, func()) {
	t.Helper()

	sqlDB, mock, err := sqlmock.New()
	require.NoError(t, err)

	dialector := mysql.New(mysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	})
	db, err := gorm.Open(dialector, &gorm.Config{})
	require.NoError(t, err)

	mr, err := miniredis.Run()
	require.NoError(t, err)

	redisClient := goredis.NewClient(&goredis.Options{Addr: mr.Addr()})
	rdb := pkgredis.NewFromClient(redisClient)

	dbWrapper := &database.Database{DB: db}
	server := auth.NewServer(dbWrapper, rdb, nil, nil, nil)

	cleanup := func() {
		rawDB, _ := db.DB()
		_ = rawDB.Close()
		_ = redisClient.Close()
		mr.Close()
	}
	return server, mock, mr, cleanup
}

// userColumns is the list of columns returned for models.User SELECT queries.
var userColumns = []string{
	"id", "email", "name", "picture",
	"created_at", "updated_at", "deleted_at",
	"preferred_currency", "conversion_in_progress", "preferred_language",
	"bio", "cover_photo_url", "location", "website", "is_admin",
	"username", "password_hash", "auth_provider",
}

// TestUnlinkGoogle_NoGoogleLinked verifies that UnlinkGoogle returns a
// ValidationError when the user does not have Google linked.
func TestUnlinkGoogle_NoGoogleLinked(t *testing.T) {
	server, mock, cleanup := setupAuthServerWithMockDB(t)
	defer cleanup()

	userID := int32(1)
	passwordHash := "bcrypthash"

	// Expect: SELECT * FROM `user` WHERE ... LIMIT 1
	rows := sqlmock.NewRows(userColumns).
		AddRow(userID, "test@example.com", "Test User", "",
			nil, nil, nil,
			"VND", false, "vi",
			"", "", "", "", false,
			nil, passwordHash, "password") // AuthProvider = "password", no google
	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	resp, err := server.UnlinkGoogle(context.Background(), userID, "session-abc")

	assert.Nil(t, resp)
	require.Error(t, err)

	var validationErr apperrors.ValidationError
	assert.ErrorAs(t, err, &validationErr, "expected ValidationError")
	assert.Contains(t, err.Error(), "Google account is not linked")
}

// TestUnlinkGoogle_NoPasswordSet verifies that UnlinkGoogle returns a
// ValidationError when the user has Google linked but no password set.
func TestUnlinkGoogle_NoPasswordSet(t *testing.T) {
	server, mock, cleanup := setupAuthServerWithMockDB(t)
	defer cleanup()

	userID := int32(2)

	// User has google linked but empty password hash
	rows := sqlmock.NewRows(userColumns).
		AddRow(userID, "test@example.com", "Test User", "",
			nil, nil, nil,
			"VND", false, "vi",
			"", "", "", "", false,
			nil, "", "google") // PasswordHash = "", AuthProvider = "google"
	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	resp, err := server.UnlinkGoogle(context.Background(), userID, "session-abc")

	assert.Nil(t, resp)
	require.Error(t, err)

	var validationErr apperrors.ValidationError
	assert.ErrorAs(t, err, &validationErr, "expected ValidationError")
	assert.Contains(t, err.Error(), "Please set a password before disconnecting Google")
}

// TestUnlinkGoogle_ProviderFormats verifies that all AuthProvider format variants
// are correctly stripped of "google" (and any "+" separator).
func TestUnlinkGoogle_ProviderFormats(t *testing.T) {
	cases := []struct {
		name            string
		inputProvider   string
		expectedProvider string
	}{
		{
			name:            "google+password",
			inputProvider:   "google+password",
			expectedProvider: "password",
		},
		{
			name:            "password+google",
			inputProvider:   "password+google",
			expectedProvider: "password",
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			server, mock, mr, cleanup := setupAuthServerWithMockDBAndRedis(t)
			defer cleanup()

			userID := int32(10)
			_ = mr // miniredis available — GetUserSessions returns empty set (no sessions to invalidate)

			// Expect SELECT for user lookup
			rows := sqlmock.NewRows(userColumns).
				AddRow(userID, "test@example.com", "Test User", "",
					nil, nil, nil,
					"VND", false, "vi",
					"", "", "", "", false,
					nil, "bcrypthash", tc.inputProvider)
			mock.ExpectQuery("SELECT").WillReturnRows(rows)

			// Expect UPDATE to set new auth_provider (GORM wraps in transaction)
			mock.ExpectBegin()
			mock.ExpectExec("UPDATE").WillReturnResult(sqlmock.NewResult(1, 1))
			mock.ExpectCommit()

			// Expect DELETE for invalidateOtherSessions DB cleanup (GORM wraps in transaction)
			mock.ExpectBegin()
			mock.ExpectExec("DELETE").WillReturnResult(sqlmock.NewResult(0, 0))
			mock.ExpectCommit()

			resp, err := server.UnlinkGoogle(context.Background(), userID, "session-keep")

			require.NoError(t, err)
			assert.NotNil(t, resp)
			assert.True(t, resp.Success)

			// Verify all expected DB interactions happened
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

// TestUnlinkGoogle_Success_InvalidatesOtherSessions verifies that on success,
// invalidateOtherSessions is called (DB DELETE for other sessions is expected).
func TestUnlinkGoogle_Success_InvalidatesOtherSessions(t *testing.T) {
	server, mock, mr, cleanup := setupAuthServerWithMockDBAndRedis(t)
	defer cleanup()

	userID := int32(5)
	keepSession := "session-current"

	// Pre-seed another session in miniredis so invalidation has something to remove
	sessionKey := pkgredis.SessionKey(userID)
	_, err := mr.SAdd(sessionKey, "session-other")
	require.NoError(t, err)
	_, err = mr.SAdd(sessionKey, keepSession)
	require.NoError(t, err)

	// Expect SELECT for user lookup
	rows := sqlmock.NewRows(userColumns).
		AddRow(userID, "test@example.com", "Test User", "",
			nil, nil, nil,
			"VND", false, "vi",
			"", "", "", "", false,
			nil, "bcrypthash", "google+password")
	mock.ExpectQuery("SELECT").WillReturnRows(rows)

	// Expect UPDATE auth_provider (GORM wraps in transaction)
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	// Expect DELETE for invalidateOtherSessions DB cleanup (GORM wraps in transaction)
	mock.ExpectBegin()
	mock.ExpectExec("DELETE").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	resp, err := server.UnlinkGoogle(context.Background(), userID, keepSession)

	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.True(t, resp.Success)
	assert.Equal(t, "Google account disconnected successfully", resp.Message)

	assert.NoError(t, mock.ExpectationsWereMet())
}
