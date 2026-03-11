package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"
	"wealthjourney/pkg/config"

	"github.com/go-redis/redis/v8"
)

type RedisClient struct {
	client *redis.Client
	ctx    context.Context
}

const (
	whitelistPrefix = "whitelist"
	defaultExpiry   = 7 * 24 * time.Hour // 7 days
)

// SessionData represents metadata for a user session
type SessionData struct {
	SessionID    string    `json:"sessionId"`
	DeviceName   string    `json:"deviceName"`
	DeviceType   string    `json:"deviceType"`
	IPAddress    string    `json:"ipAddress"`
	UserAgent    string    `json:"userAgent"`
	CreatedAt    time.Time `json:"createdAt"`
	LastActiveAt time.Time `json:"lastActiveAt"`
	ExpiresAt    time.Time `json:"expiresAt"`
}

// ToJSON converts SessionData to JSON string
func (s *SessionData) ToJSON() (string, error) {
	data, err := json.Marshal(s)
	if err != nil {
		return "", fmt.Errorf("failed to marshal session data: %w", err)
	}
	return string(data), nil
}

// FromJSON parses JSON string into SessionData
func (s *SessionData) FromJSON(jsonStr string) error {
	if err := json.Unmarshal([]byte(jsonStr), s); err != nil {
		return fmt.Errorf("failed to unmarshal session data: %w", err)
	}
	return nil
}

// SessionKey returns the Redis key for user's session set
func SessionKey(email string) string {
	return fmt.Sprintf("session:%s", email)
}

// SessionMetadataKey returns the Redis key for session metadata
func SessionMetadataKey(sessionID string) string {
	return fmt.Sprintf("session_meta:%s", sessionID)
}

// New creates a new Redis client
func New(cfg *config.Config) (*RedisClient, error) {
	// Parse full Redis URI (supports redis://user:password@host:port/db)
	opt, err := redis.ParseURL(cfg.Redis.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	client := redis.NewClient(opt)

	ctx := context.Background()
	_, pingErr := client.Ping(ctx).Result()
	if pingErr != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", pingErr)
	}

	log.Println("Redis connected successfully")

	return &RedisClient{
		client: client,
		ctx:    ctx,
	}, nil
}

// Get retrieves a value from Redis
func (r *RedisClient) Get(prefix, key string) (string, error) {
	return r.client.Get(r.ctx, fmt.Sprintf("%s:%s", prefix, key)).Result()
}

// Set stores a value in Redis
func (r *RedisClient) Set(prefix, key, value string) error {
	return r.client.Set(r.ctx, fmt.Sprintf("%s:%s", prefix, key), value, 0).Err()
}

// SetWithExpiry stores a value in Redis with expiration
func (r *RedisClient) SetWithExpiry(prefix, key, value string, expiry time.Duration) error {
	return r.client.Set(r.ctx, fmt.Sprintf("%s:%s", prefix, key), value, expiry).Err()
}

// Delete removes a value from Redis
func (r *RedisClient) Delete(prefix, key string) error {
	return r.client.Del(r.ctx, fmt.Sprintf("%s:%s", prefix, key)).Err()
}

// AddToWhitelist adds a token to the whitelist
func (r *RedisClient) AddToWhitelist(email, token string) error {
	return r.SetWithExpiry(whitelistPrefix, email, token, defaultExpiry)
}

// GetFromWhitelist retrieves a token from the whitelist
func (r *RedisClient) GetFromWhitelist(email string) (string, error) {
	return r.Get(whitelistPrefix, email)
}

// RemoveFromWhitelist removes a token from the whitelist
func (r *RedisClient) RemoveFromWhitelist(email string) error {
	return r.Delete(whitelistPrefix, email)
}

// AddSession adds a new session for a user
func (r *RedisClient) AddSession(email, sessionID, token string, metadata *SessionData) error {
	// Add session ID to user's session set
	sessionKey := SessionKey(email)
	if err := r.client.SAdd(r.ctx, sessionKey, sessionID).Err(); err != nil {
		return fmt.Errorf("failed to add session to set: %w", err)
	}

	// Set expiry on the session set (will be updated on each new session)
	if err := r.client.Expire(r.ctx, sessionKey, defaultExpiry).Err(); err != nil {
		return fmt.Errorf("failed to set expiry on session set: %w", err)
	}

	// Store session metadata
	metadataKey := SessionMetadataKey(sessionID)
	metadataJSON, err := metadata.ToJSON()
	if err != nil {
		return err
	}

	if err := r.client.Set(r.ctx, metadataKey, metadataJSON, defaultExpiry).Err(); err != nil {
		return fmt.Errorf("failed to store session metadata: %w", err)
	}

	// Store token mapping: sessionID -> token
	tokenKey := fmt.Sprintf("session_token:%s", sessionID)
	if err := r.client.Set(r.ctx, tokenKey, token, defaultExpiry).Err(); err != nil {
		return fmt.Errorf("failed to store session token: %w", err)
	}

	return nil
}

// GetSession retrieves session metadata
func (r *RedisClient) GetSession(sessionID string) (*SessionData, error) {
	metadataKey := SessionMetadataKey(sessionID)
	metadataJSON, err := r.client.Get(r.ctx, metadataKey).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("failed to get session metadata: %w", err)
	}

	var metadata SessionData
	if err := metadata.FromJSON(metadataJSON); err != nil {
		return nil, err
	}

	return &metadata, nil
}

// GetSessionToken retrieves the token for a session
func (r *RedisClient) GetSessionToken(sessionID string) (string, error) {
	tokenKey := fmt.Sprintf("session_token:%s", sessionID)
	token, err := r.client.Get(r.ctx, tokenKey).Result()
	if err != nil {
		if err == redis.Nil {
			return "", fmt.Errorf("session token not found")
		}
		return "", fmt.Errorf("failed to get session token: %w", err)
	}
	return token, nil
}

// GetUserSessions retrieves all session IDs for a user
func (r *RedisClient) GetUserSessions(email string) ([]string, error) {
	sessionKey := SessionKey(email)
	sessions, err := r.client.SMembers(r.ctx, sessionKey).Result()
	if err != nil {
		if err == redis.Nil {
			return []string{}, nil
		}
		return nil, fmt.Errorf("failed to get user sessions: %w", err)
	}
	return sessions, nil
}

// RemoveSession removes a specific session for a user
func (r *RedisClient) RemoveSession(email, sessionID string) error {
	// Remove from session set
	sessionKey := SessionKey(email)
	if err := r.client.SRem(r.ctx, sessionKey, sessionID).Err(); err != nil {
		return fmt.Errorf("failed to remove session from set: %w", err)
	}

	// Delete session metadata
	metadataKey := SessionMetadataKey(sessionID)
	if err := r.client.Del(r.ctx, metadataKey).Err(); err != nil {
		return fmt.Errorf("failed to delete session metadata: %w", err)
	}

	// Delete session token
	tokenKey := fmt.Sprintf("session_token:%s", sessionID)
	if err := r.client.Del(r.ctx, tokenKey).Err(); err != nil {
		return fmt.Errorf("failed to delete session token: %w", err)
	}

	return nil
}

// RemoveAllSessions removes all sessions for a user
func (r *RedisClient) RemoveAllSessions(email string) error {
	// Get all session IDs first
	sessions, err := r.GetUserSessions(email)
	if err != nil {
		return err
	}

	// Remove each session
	for _, sessionID := range sessions {
		if err := r.RemoveSession(email, sessionID); err != nil {
			// Log error but continue removing other sessions
			log.Printf("Error removing session %s: %v", sessionID, err)
		}
	}

	// Delete the session set itself
	sessionKey := SessionKey(email)
	if err := r.client.Del(r.ctx, sessionKey).Err(); err != nil {
		return fmt.Errorf("failed to delete session set: %w", err)
	}

	return nil
}

// SessionExists checks if a session exists for a user
func (r *RedisClient) SessionExists(email, sessionID string) (bool, error) {
	sessionKey := SessionKey(email)
	exists, err := r.client.SIsMember(r.ctx, sessionKey, sessionID).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check session existence: %w", err)
	}
	return exists, nil
}

// UpdateSessionActivity updates the last active timestamp for a session
func (r *RedisClient) UpdateSessionActivity(sessionID string) error {
	// Get existing metadata
	metadata, err := r.GetSession(sessionID)
	if err != nil {
		return err
	}

	// Update last active time
	metadata.LastActiveAt = time.Now()

	// Save back to Redis
	metadataKey := SessionMetadataKey(sessionID)
	metadataJSON, err := metadata.ToJSON()
	if err != nil {
		return err
	}

	if err := r.client.Set(r.ctx, metadataKey, metadataJSON, defaultExpiry).Err(); err != nil {
		return fmt.Errorf("failed to update session metadata: %w", err)
	}

	return nil
}

// Close closes the Redis connection
func (r *RedisClient) Close() error {
	return r.client.Close()
}

// GetClient returns the underlying redis.Client for advanced use cases
func (r *RedisClient) GetClient() *redis.Client {
	return r.client
}

// Publish publishes a message to a Redis channel.
func (r *RedisClient) Publish(channel string, message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}
	return r.client.Publish(r.ctx, channel, data).Err()
}

// Subscribe returns a PubSub subscription for the given channel.
func (r *RedisClient) Subscribe(channel string) *redis.PubSub {
	return r.client.Subscribe(r.ctx, channel)
}
