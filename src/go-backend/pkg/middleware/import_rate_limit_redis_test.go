package middleware

import (
	"context"
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupTestRedis creates a test Redis client.
// This requires a running Redis instance for integration tests.
func setupTestRedis(t *testing.T) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Use DB 15 for tests to avoid conflicts
	})

	// Ping to verify connection
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skipf("Redis not available for testing: %v", err)
	}

	// Clean up test keys before tests
	client.FlushDB(ctx)

	return client
}

func TestRedisImportRateLimiter_UserLimit(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client := setupTestRedis(t)
	defer func() { _ = client.Close() }()

	config := ImportRateLimitConfig{
		MaxImportsPerHour:         3,
		UserWindow:                time.Hour,
		MaxImportsPerHourPerIP:    50,
		IPWindow:                  time.Hour,
		MaxImportsPerDayPerWallet: 20,
		WalletWindow:              24 * time.Hour,
		UserPrefix:                "test:ratelimit:import:user",
		IPPrefix:                  "test:ratelimit:import:ip",
		WalletPrefix:              "test:ratelimit:import:wallet",
	}

	limiter := NewRedisImportRateLimiter(client, config)
	ctx := context.Background()

	userID := int32(123)
	ipAddress := "192.168.1.100"
	walletID := int32(456)

	// First 3 requests should succeed
	for i := 0; i < 3; i++ {
		result, err := limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
		require.NoError(t, err)
		assert.True(t, result.Allowed, "Request %d should be allowed", i+1)
		assert.Equal(t, 3-i-1, result.Remaining, "Remaining should be %d", 3-i-1)

		// Increment counters to simulate actual import
		err = limiter.IncrementCounters(ctx, userID, ipAddress, walletID)
		require.NoError(t, err)
	}

	// 4th request should fail
	result, err := limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
	require.NoError(t, err)
	assert.False(t, result.Allowed, "4th request should be blocked")
	assert.Equal(t, "user", result.LimitType)
	assert.Equal(t, 3, result.Limit)
	assert.Equal(t, 0, result.Remaining)
	assert.Greater(t, result.RetryAfter, 0)
}

func TestRedisImportRateLimiter_IPLimit(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client := setupTestRedis(t)
	defer func() { _ = client.Close() }()

	config := ImportRateLimitConfig{
		MaxImportsPerHour:         100, // High user limit
		UserWindow:                time.Hour,
		MaxImportsPerHourPerIP:    2, // Low IP limit to test
		IPWindow:                  time.Hour,
		MaxImportsPerDayPerWallet: 100,
		WalletWindow:              24 * time.Hour,
		UserPrefix:                "test:ratelimit:import:user",
		IPPrefix:                  "test:ratelimit:import:ip",
		WalletPrefix:              "test:ratelimit:import:wallet",
	}

	limiter := NewRedisImportRateLimiter(client, config)
	ctx := context.Background()

	// Use different users but same IP
	ipAddress := "192.168.1.200"
	walletID := int32(789)

	// First 2 requests (different users, same IP)
	for i := 0; i < 2; i++ {
		userID := int32(100 + i)
		result, err := limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
		require.NoError(t, err)
		assert.True(t, result.Allowed, "Request %d should be allowed", i+1)

		err = limiter.IncrementCounters(ctx, userID, ipAddress, walletID)
		require.NoError(t, err)
	}

	// 3rd request from same IP should fail
	userID := int32(102)
	result, err := limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
	require.NoError(t, err)
	assert.False(t, result.Allowed, "3rd request from same IP should be blocked")
	assert.Equal(t, "ip", result.LimitType)
}

func TestRedisImportRateLimiter_WalletLimit(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client := setupTestRedis(t)
	defer func() { _ = client.Close() }()

	config := ImportRateLimitConfig{
		MaxImportsPerHour:         100,
		UserWindow:                time.Hour,
		MaxImportsPerHourPerIP:    100,
		IPWindow:                  time.Hour,
		MaxImportsPerDayPerWallet: 2, // Low wallet limit to test
		WalletWindow:              time.Hour, // Use 1 hour for faster testing
		UserPrefix:                "test:ratelimit:import:user",
		IPPrefix:                  "test:ratelimit:import:ip",
		WalletPrefix:              "test:ratelimit:import:wallet",
	}

	limiter := NewRedisImportRateLimiter(client, config)
	ctx := context.Background()

	walletID := int32(999)

	// First 2 requests (different users, different IPs, same wallet)
	for i := 0; i < 2; i++ {
		userID := int32(200 + i)
		ipAddress := "192.168.1." + string(rune(50+i))
		result, err := limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
		require.NoError(t, err)
		assert.True(t, result.Allowed, "Request %d should be allowed", i+1)

		err = limiter.IncrementCounters(ctx, userID, ipAddress, walletID)
		require.NoError(t, err)
	}

	// 3rd request to same wallet should fail
	userID := int32(202)
	ipAddress := "192.168.1.52"
	result, err := limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
	require.NoError(t, err)
	assert.False(t, result.Allowed, "3rd request to same wallet should be blocked")
	assert.Equal(t, "wallet", result.LimitType)
}

func TestRedisImportRateLimiter_SlidingWindow(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client := setupTestRedis(t)
	defer func() { _ = client.Close() }()

	config := ImportRateLimitConfig{
		MaxImportsPerHour:         2,
		UserWindow:                2 * time.Second, // Short window for testing
		MaxImportsPerHourPerIP:    100,
		IPWindow:                  time.Hour,
		MaxImportsPerDayPerWallet: 100,
		WalletWindow:              24 * time.Hour,
		UserPrefix:                "test:ratelimit:import:user",
		IPPrefix:                  "test:ratelimit:import:ip",
		WalletPrefix:              "test:ratelimit:import:wallet",
	}

	limiter := NewRedisImportRateLimiter(client, config)
	ctx := context.Background()

	userID := int32(300)
	ipAddress := "192.168.1.100"
	walletID := int32(400)

	// First 2 requests
	for i := 0; i < 2; i++ {
		result, err := limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
		require.NoError(t, err)
		assert.True(t, result.Allowed, "Request %d should be allowed", i+1)

		err = limiter.IncrementCounters(ctx, userID, ipAddress, walletID)
		require.NoError(t, err)
	}

	// 3rd request should fail
	result, err := limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
	require.NoError(t, err)
	assert.False(t, result.Allowed, "3rd request should be blocked")

	// Wait for window to expire
	time.Sleep(2100 * time.Millisecond)

	// Request should succeed after window expires
	result, err = limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
	require.NoError(t, err)
	assert.True(t, result.Allowed, "Request should be allowed after window expires")
}

func TestRedisImportRateLimiter_ResetTime(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client := setupTestRedis(t)
	defer func() { _ = client.Close() }()

	config := ImportRateLimitConfig{
		MaxImportsPerHour:         1,
		UserWindow:                time.Hour,
		MaxImportsPerHourPerIP:    100,
		IPWindow:                  time.Hour,
		MaxImportsPerDayPerWallet: 100,
		WalletWindow:              24 * time.Hour,
		UserPrefix:                "test:ratelimit:import:user",
		IPPrefix:                  "test:ratelimit:import:ip",
		WalletPrefix:              "test:ratelimit:import:wallet",
	}

	limiter := NewRedisImportRateLimiter(client, config)
	ctx := context.Background()

	userID := int32(400)
	ipAddress := "192.168.1.150"
	walletID := int32(500)

	// First request
	result, err := limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
	require.NoError(t, err)
	assert.True(t, result.Allowed)

	err = limiter.IncrementCounters(ctx, userID, ipAddress, walletID)
	require.NoError(t, err)

	// Second request should fail and return reset time
	result, err = limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
	require.NoError(t, err)
	assert.False(t, result.Allowed)
	assert.NotZero(t, result.ResetAt)
	assert.Greater(t, result.RetryAfter, 0)
	assert.WithinDuration(t, time.Now().Add(time.Hour), result.ResetAt, 5*time.Second)
}

func TestRedisImportRateLimiter_MultipleUsers(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client := setupTestRedis(t)
	defer func() { _ = client.Close() }()

	config := DefaultImportRateLimitConfig()
	config.UserPrefix = "test:ratelimit:import:user"
	config.IPPrefix = "test:ratelimit:import:ip"
	config.WalletPrefix = "test:ratelimit:import:wallet"

	limiter := NewRedisImportRateLimiter(client, config)
	ctx := context.Background()

	// Multiple users should have independent rate limits
	for userID := int32(500); userID < 510; userID++ {
		ipAddress := "192.168.2." + string(rune(100+int(userID-500)))
		walletID := int32(600 + userID)

		result, err := limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
		require.NoError(t, err)
		assert.True(t, result.Allowed, "User %d should be allowed", userID)

		err = limiter.IncrementCounters(ctx, userID, ipAddress, walletID)
		require.NoError(t, err)
	}
}
