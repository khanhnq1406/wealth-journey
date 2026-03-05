//go:build integration
// +build integration

package auth_test

import (
	"context"
	"os"
	"testing"
	"wealthjourney/domain/auth"
	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
	"wealthjourney/pkg/redis"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupAuthTest(t *testing.T) (*auth.Server, *database.Database, *redis.RedisClient, func()) {
	// Set test JWT secret if not already set
	if os.Getenv("JWT_SECRET") == "" || os.Getenv("JWT_SECRET") == "your-secret-key" {
		os.Setenv("JWT_SECRET", "test-jwt-secret-for-integration-testing")
	}

	cfg, err := config.Load()
	require.NoError(t, err)

	db, err := database.New(cfg)
	require.NoError(t, err)

	rdb, err := redis.New(cfg)
	require.NoError(t, err)

	authServer := auth.NewServer(db, rdb, cfg, nil, nil)

	cleanup := func() {
		db.Close()
		rdb.Close()
	}

	return authServer, db, rdb, cleanup
}

func TestMultiDeviceLogin(t *testing.T) {
	authServer, db, rdb, cleanup := setupAuthTest(t)
	defer cleanup()

	// Create test user
	user := &models.User{
		Email:   "multidevice@example.com",
		Name:    "Multi Device User",
		Picture: "https://example.com/pic.jpg",
	}
	require.NoError(t, db.DB.Create(user).Error)
	defer db.DB.Delete(user) // Cleanup

	ctx := context.Background()

	// Simulate login from Device 1
	token1, sessionID1, err := authServer.LoginWithDevice(ctx, user.Email, &redis.SessionData{
		DeviceName: "iPhone 13",
		DeviceType: "mobile",
		IPAddress:  "192.168.1.1",
	})
	require.NoError(t, err)
	require.NotEmpty(t, token1)
	require.NotEmpty(t, sessionID1)

	// Simulate login from Device 2
	token2, sessionID2, err := authServer.LoginWithDevice(ctx, user.Email, &redis.SessionData{
		DeviceName: "MacBook Pro",
		DeviceType: "desktop",
		IPAddress:  "192.168.1.2",
	})
	require.NoError(t, err)
	require.NotEmpty(t, token2)
	require.NotEmpty(t, sessionID2)

	// Verify both tokens are different
	assert.NotEqual(t, token1, token2)
	assert.NotEqual(t, sessionID1, sessionID2)

	// Verify Device 1 token still valid
	_, err = authServer.VerifyAuth(token1)
	assert.NoError(t, err, "Device 1 token should still be valid")

	// Verify Device 2 token is valid
	_, err = authServer.VerifyAuth(token2)
	assert.NoError(t, err, "Device 2 token should be valid")

	// List active sessions
	sessions, err := rdb.GetUserSessions(user.Email)
	require.NoError(t, err)
	assert.Len(t, sessions, 2)
	assert.Contains(t, sessions, sessionID1)
	assert.Contains(t, sessions, sessionID2)

	// Logout from Device 1
	_, err = authServer.Logout(token1)
	require.NoError(t, err)

	// Verify Device 1 token is now invalid
	_, err = authServer.VerifyAuth(token1)
	assert.Error(t, err, "Device 1 token should be invalid after logout")

	// Verify Device 2 token still valid
	_, err = authServer.VerifyAuth(token2)
	assert.NoError(t, err, "Device 2 token should still be valid")

	// Verify only 1 session remains
	sessions, err = rdb.GetUserSessions(user.Email)
	require.NoError(t, err)
	assert.Len(t, sessions, 1)
	assert.Contains(t, sessions, sessionID2)
}
