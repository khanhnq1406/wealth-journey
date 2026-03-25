package cache

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/go-redis/redis/v8"
)

const (
	// SourceHealthKeyPrefix is the Redis key prefix for source health flags.
	// Full key format: price_source_health:<source>
	SourceHealthKeyPrefix = "price_source_health"

	// SourceHealthTTL is the time after which an unhealthy flag expires and
	// the source is automatically considered healthy again (self-healing).
	SourceHealthTTL = 2 * time.Minute
)

// SourceHealthCache tracks price-source health using short-lived Redis keys.
// A source is considered unhealthy when a key exists for it.
// The TTL of 2 minutes ensures automatic recovery without manual intervention.
type SourceHealthCache struct {
	client *redis.Client
}

// NewSourceHealthCache creates a SourceHealthCache backed by the given Redis client.
func NewSourceHealthCache(client *redis.Client) *SourceHealthCache {
	return &SourceHealthCache{client: client}
}

// buildKey constructs the Redis key for a given source identifier.
func (c *SourceHealthCache) buildKey(source string) string {
	return fmt.Sprintf("%s:%s", SourceHealthKeyPrefix, source)
}

// IsHealthy returns true when the source is NOT currently flagged as unhealthy.
// On any Redis error it returns true (fail-open) to prevent blocking all sources.
func (c *SourceHealthCache) IsHealthy(ctx context.Context, source string) bool {
	key := c.buildKey(source)
	_, err := c.client.Get(ctx, key).Result()
	if err == nil {
		// Key exists → source is marked unhealthy.
		return false
	}
	if err == redis.Nil {
		// Key absent → source is healthy.
		return true
	}
	// Unexpected Redis error — fail-open: treat as healthy so we don't lock out all sources.
	log.Printf("[SourceHealthCache] Redis error checking health for %q (fail-open): %v", source, err)
	return true
}

// MarkUnhealthy writes a short-lived flag to Redis indicating the source is
// unhealthy. The key expires automatically after SourceHealthTTL (2 minutes),
// allowing the source to recover without any manual intervention.
func (c *SourceHealthCache) MarkUnhealthy(ctx context.Context, source string) error {
	key := c.buildKey(source)
	if err := c.client.Set(ctx, key, "1", SourceHealthTTL).Err(); err != nil {
		return fmt.Errorf("mark source %q unhealthy in Redis: %w", source, err)
	}
	return nil
}
