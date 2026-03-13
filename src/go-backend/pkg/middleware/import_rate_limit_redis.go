package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"

	apperrors "wealthjourney/pkg/errors"
)

// ImportRateLimitConfig holds configuration for import rate limiting.
type ImportRateLimitConfig struct {
	// User-based limits
	MaxImportsPerHour int // Max imports per user per hour (default: 10)
	UserWindow        time.Duration

	// IP-based limits
	MaxImportsPerHourPerIP int // Max imports per IP per hour (default: 50)
	IPWindow               time.Duration

	// Wallet-based limits
	MaxImportsPerDayPerWallet int // Max imports per wallet per day (default: 20)
	WalletWindow              time.Duration

	// Redis key prefixes
	UserPrefix   string
	IPPrefix     string
	WalletPrefix string
}

// DefaultImportRateLimitConfig returns the default import rate limiting configuration.
func DefaultImportRateLimitConfig() ImportRateLimitConfig {
	return ImportRateLimitConfig{
		MaxImportsPerHour:         10,
		UserWindow:                time.Hour,
		MaxImportsPerHourPerIP:    50,
		IPWindow:                  time.Hour,
		MaxImportsPerDayPerWallet: 20,
		WalletWindow:              24 * time.Hour,
		UserPrefix:                "ratelimit:import:user",
		IPPrefix:                  "ratelimit:import:ip",
		WalletPrefix:              "ratelimit:import:wallet",
	}
}

// RedisImportRateLimiter implements distributed rate limiting using Redis.
type RedisImportRateLimiter struct {
	client *redis.Client
	config ImportRateLimitConfig
}

// NewRedisImportRateLimiter creates a new Redis-based import rate limiter.
func NewRedisImportRateLimiter(client *redis.Client, config ImportRateLimitConfig) *RedisImportRateLimiter {
	return &RedisImportRateLimiter{
		client: client,
		config: config,
	}
}

// RateLimitResult contains rate limit check results and metadata.
type RateLimitResult struct {
	Allowed       bool
	LimitType     string // "user", "ip", or "wallet"
	Limit         int
	Remaining     int
	ResetAt       time.Time
	RetryAfter    int // Seconds until retry
	ErrorMessage  string
}

// CheckRateLimit checks all rate limits (user, IP, wallet) and returns the first violation.
func (rl *RedisImportRateLimiter) CheckRateLimit(ctx context.Context, userID int32, ipAddress string, walletID int32) (*RateLimitResult, error) {
	// Check user-based rate limit
	userResult, err := rl.checkLimit(ctx, rl.config.UserPrefix, fmt.Sprintf("%d", userID), rl.config.MaxImportsPerHour, rl.config.UserWindow)
	if err != nil {
		return nil, fmt.Errorf("failed to check user rate limit: %w", err)
	}
	if !userResult.Allowed {
		userResult.LimitType = "user"
		userResult.ErrorMessage = fmt.Sprintf("Maximum %d imports per hour per user exceeded. Try again in %d seconds.",
			rl.config.MaxImportsPerHour, userResult.RetryAfter)
		return userResult, nil
	}

	// Check IP-based rate limit
	ipResult, err := rl.checkLimit(ctx, rl.config.IPPrefix, ipAddress, rl.config.MaxImportsPerHourPerIP, rl.config.IPWindow)
	if err != nil {
		return nil, fmt.Errorf("failed to check IP rate limit: %w", err)
	}
	if !ipResult.Allowed {
		ipResult.LimitType = "ip"
		ipResult.ErrorMessage = fmt.Sprintf("Maximum %d imports per hour per IP address exceeded. Try again in %d seconds.",
			rl.config.MaxImportsPerHourPerIP, ipResult.RetryAfter)
		return ipResult, nil
	}

	// Check wallet-based rate limit
	walletResult, err := rl.checkLimit(ctx, rl.config.WalletPrefix, fmt.Sprintf("%d", walletID), rl.config.MaxImportsPerDayPerWallet, rl.config.WalletWindow)
	if err != nil {
		return nil, fmt.Errorf("failed to check wallet rate limit: %w", err)
	}
	if !walletResult.Allowed {
		walletResult.LimitType = "wallet"
		walletResult.ErrorMessage = fmt.Sprintf("Maximum %d imports per day per wallet exceeded. Try again in %d seconds.",
			rl.config.MaxImportsPerDayPerWallet, walletResult.RetryAfter)
		return walletResult, nil
	}

	// All checks passed - return the user result (most restrictive typically)
	return userResult, nil
}

// IncrementCounters increments all rate limit counters after a successful import.
func (rl *RedisImportRateLimiter) IncrementCounters(ctx context.Context, userID int32, ipAddress string, walletID int32) error {
	// Increment user counter
	if err := rl.incrementCounter(ctx, rl.config.UserPrefix, fmt.Sprintf("%d", userID), rl.config.UserWindow); err != nil {
		return fmt.Errorf("failed to increment user counter: %w", err)
	}

	// Increment IP counter
	if err := rl.incrementCounter(ctx, rl.config.IPPrefix, ipAddress, rl.config.IPWindow); err != nil {
		return fmt.Errorf("failed to increment IP counter: %w", err)
	}

	// Increment wallet counter
	if err := rl.incrementCounter(ctx, rl.config.WalletPrefix, fmt.Sprintf("%d", walletID), rl.config.WalletWindow); err != nil {
		return fmt.Errorf("failed to increment wallet counter: %w", err)
	}

	return nil
}

// checkLimit checks a single rate limit using sliding window algorithm.
func (rl *RedisImportRateLimiter) checkLimit(ctx context.Context, prefix, key string, maxRequests int, window time.Duration) (*RateLimitResult, error) {
	redisKey := fmt.Sprintf("%s:%s", prefix, key)
	now := time.Now()
	windowStart := now.Add(-window)

	// Use Lua script for atomic operations
	// This script:
	// 1. Removes expired entries (outside window)
	// 2. Counts remaining entries
	// 3. Gets the oldest timestamp (for calculating retry-after)
	script := redis.NewScript(`
		local key = KEYS[1]
		local window_start = tonumber(ARGV[1])
		local now = tonumber(ARGV[2])
		local window_ms = tonumber(ARGV[3])

		-- Remove expired entries
		redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

		-- Count remaining entries
		local count = redis.call('ZCARD', key)

		-- Get oldest timestamp for retry-after calculation
		local oldest = nil
		if count > 0 then
			local range = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
			if #range > 0 then
				oldest = tonumber(range[2])
			end
		end

		-- Set expiry on key to prevent memory leaks
		if count > 0 then
			redis.call('EXPIRE', key, math.ceil(window_ms / 1000))
		end

		return {count, oldest}
	`)

	result, err := script.Run(ctx, rl.client, []string{redisKey},
		windowStart.UnixMilli(),
		now.UnixMilli(),
		window.Milliseconds(),
	).Result()

	if err != nil && err != redis.Nil {
		return nil, fmt.Errorf("failed to execute rate limit check: %w", err)
	}

	// Parse result
	var count int64
	var oldestTimestamp int64

	if result != nil {
		resultSlice, ok := result.([]interface{})
		if ok && len(resultSlice) >= 2 {
			count = resultSlice[0].(int64)
			if resultSlice[1] != nil {
				oldestTimestamp = resultSlice[1].(int64)
			}
		}
	}

	remaining := maxRequests - int(count) - 1
	if remaining < 0 {
		remaining = 0
	}

	// Calculate reset time and retry-after
	var resetAt time.Time
	var retryAfter int

	if count >= int64(maxRequests) {
		// Rate limit exceeded
		if oldestTimestamp > 0 {
			oldestTime := time.UnixMilli(oldestTimestamp)
			resetAt = oldestTime.Add(window)
			retryAfter = int(time.Until(resetAt).Seconds())
			if retryAfter < 1 {
				retryAfter = 1
			}
		} else {
			resetAt = now.Add(window)
			retryAfter = int(window.Seconds())
		}

		return &RateLimitResult{
			Allowed:    false,
			Limit:      maxRequests,
			Remaining:  0,
			ResetAt:    resetAt,
			RetryAfter: retryAfter,
		}, nil
	}

	// Rate limit not exceeded
	resetAt = now.Add(window)
	return &RateLimitResult{
		Allowed:    true,
		Limit:      maxRequests,
		Remaining:  remaining,
		ResetAt:    resetAt,
		RetryAfter: 0,
	}, nil
}

// incrementCounter adds the current timestamp to the sorted set.
func (rl *RedisImportRateLimiter) incrementCounter(ctx context.Context, prefix, key string, window time.Duration) error {
	redisKey := fmt.Sprintf("%s:%s", prefix, key)
	now := time.Now()

	// Use pipeline for efficiency
	pipe := rl.client.Pipeline()

	// Add current timestamp to sorted set
	pipe.ZAdd(ctx, redisKey, &redis.Z{
		Score:  float64(now.UnixMilli()),
		Member: now.UnixNano(), // Use nanoseconds as unique member
	})

	// Set expiry to prevent memory leaks
	pipe.Expire(ctx, redisKey, window+time.Minute) // Add buffer to window

	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to increment counter: %w", err)
	}

	return nil
}

// RedisImportRateLimitMiddleware creates a Gin middleware for Redis-based import rate limiting.
// This middleware checks rate limits before the request is processed.
func RedisImportRateLimitMiddleware(limiter *RedisImportRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract user ID from context (set by auth middleware)
		userIDInterface, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "Unauthorized",
			})
			c.Abort()
			return
		}

		userID, ok := userIDInterface.(int32)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Invalid user ID format",
			})
			c.Abort()
			return
		}

		// Get IP address
		ipAddress := c.ClientIP()

		// Get wallet ID from request (if present)
		// For import endpoints, wallet ID might be in query params
		// Note: We don't read from body to avoid consuming it before the handler
		// Wallet-based rate limiting only applies when walletId is in query params
		var walletID int32
		if walletIDStr := c.Query("walletId"); walletIDStr != "" {
			if wid, err := strconv.ParseInt(walletIDStr, 10, 32); err == nil {
				walletID = int32(wid)
			}
		}

		// If no wallet ID found, skip wallet-based rate limiting
		// This is acceptable for some endpoints like /upload that don't specify a wallet yet
		if walletID == 0 {
			// Only check user and IP limits
			ctx := c.Request.Context()

			// Check user limit
			userResult, err := limiter.checkLimit(ctx, limiter.config.UserPrefix, fmt.Sprintf("%d", userID),
				limiter.config.MaxImportsPerHour, limiter.config.UserWindow)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "Failed to check rate limit",
				})
				c.Abort()
				return
			}

			// Add rate limit headers
			c.Header("X-RateLimit-Limit", strconv.Itoa(userResult.Limit))
			c.Header("X-RateLimit-Remaining", strconv.Itoa(userResult.Remaining))
			c.Header("X-RateLimit-Reset", strconv.FormatInt(userResult.ResetAt.Unix(), 10))

			if !userResult.Allowed {
				c.Header("Retry-After", strconv.Itoa(userResult.RetryAfter))
				c.JSON(http.StatusTooManyRequests, gin.H{
					"success": false,
					"message": userResult.ErrorMessage,
					"error": map[string]interface{}{
						"code":       "RATE_LIMIT_EXCEEDED",
						"limitType":  "user",
						"limit":      userResult.Limit,
						"retryAfter": userResult.RetryAfter,
					},
				})
				c.Abort()
				return
			}

			// Check IP limit
			ipResult, err := limiter.checkLimit(ctx, limiter.config.IPPrefix, ipAddress,
				limiter.config.MaxImportsPerHourPerIP, limiter.config.IPWindow)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"message": "Failed to check rate limit",
				})
				c.Abort()
				return
			}

			if !ipResult.Allowed {
				c.Header("Retry-After", strconv.Itoa(ipResult.RetryAfter))
				c.JSON(http.StatusTooManyRequests, gin.H{
					"success": false,
					"message": ipResult.ErrorMessage,
					"error": map[string]interface{}{
						"code":       "RATE_LIMIT_EXCEEDED",
						"limitType":  "ip",
						"limit":      ipResult.Limit,
						"retryAfter": ipResult.RetryAfter,
					},
				})
				c.Abort()
				return
			}

			c.Next()
			return
		}

		// Check all rate limits (user, IP, wallet)
		ctx := c.Request.Context()
		result, err := limiter.CheckRateLimit(ctx, userID, ipAddress, walletID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to check rate limit",
			})
			c.Abort()
			return
		}

		// Add rate limit headers
		c.Header("X-RateLimit-Limit", strconv.Itoa(result.Limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(result.Remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(result.ResetAt.Unix(), 10))

		if !result.Allowed {
			c.Header("Retry-After", strconv.Itoa(result.RetryAfter))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"message": result.ErrorMessage,
				"error": map[string]interface{}{
					"code":       "RATE_LIMIT_EXCEEDED",
					"limitType":  result.LimitType,
					"limit":      result.Limit,
					"retryAfter": result.RetryAfter,
				},
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimitError creates a rate limit exceeded error.
func RateLimitError(limitType string, limit int, retryAfter int) error {
	message := fmt.Sprintf("Rate limit exceeded: %s limit of %d per window. Retry in %d seconds", limitType, limit, retryAfter)
	return apperrors.NewError("RATE_LIMIT_EXCEEDED", message, http.StatusTooManyRequests)
}
