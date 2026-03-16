package redis_test

import (
	"testing"
	"time"
	"wealthjourney/pkg/redis"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Note: These are unit tests that will use mock Redis or test Redis instance
// Integration tests should be in a separate file with build tag

func TestSessionKey(t *testing.T) {
	var userID int32 = 123
	expected := "session:user:123"

	key := redis.SessionKey(userID)
	assert.Equal(t, expected, key)
}

func TestSessionMetadataKey(t *testing.T) {
	sessionID := "session-123"
	expected := "session_meta:session-123"

	key := redis.SessionMetadataKey(sessionID)
	assert.Equal(t, expected, key)
}

func TestSessionData_ToJSON(t *testing.T) {
	now := time.Now()
	data := &redis.SessionData{
		SessionID:    "session-123",
		DeviceName:   "iPhone 13",
		DeviceType:   "mobile",
		IPAddress:    "192.168.1.1",
		UserAgent:    "Mozilla/5.0...",
		CreatedAt:    now,
		LastActiveAt: now,
		ExpiresAt:    now.Add(7 * 24 * time.Hour),
	}

	jsonStr, err := data.ToJSON()
	require.NoError(t, err)
	assert.Contains(t, jsonStr, "session-123")
	assert.Contains(t, jsonStr, "iPhone 13")
}

func TestSessionData_FromJSON(t *testing.T) {
	jsonStr := `{
		"sessionId": "session-123",
		"deviceName": "iPhone 13",
		"deviceType": "mobile",
		"ipAddress": "192.168.1.1",
		"userAgent": "Mozilla/5.0...",
		"createdAt": "2024-01-01T00:00:00Z",
		"lastActiveAt": "2024-01-01T00:00:00Z",
		"expiresAt": "2024-01-08T00:00:00Z"
	}`

	var data redis.SessionData
	err := data.FromJSON(jsonStr)
	require.NoError(t, err)
	assert.Equal(t, "session-123", data.SessionID)
	assert.Equal(t, "iPhone 13", data.DeviceName)
	assert.Equal(t, "mobile", data.DeviceType)
}
