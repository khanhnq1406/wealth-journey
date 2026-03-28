package cache

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestSourceHealthCache creates a SourceHealthCache backed by an in-memory
// miniredis server for isolated unit tests.
func newTestSourceHealthCache(t *testing.T) (*SourceHealthCache, *miniredis.Miniredis) {
	t.Helper()

	mr, err := miniredis.Run()
	require.NoError(t, err, "failed to start miniredis")

	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})
	t.Cleanup(func() {
		_ = client.Close()
		mr.Close()
	})

	return NewSourceHealthCache(client), mr
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// TestSourceHealthCache_FreshSourceIsHealthy verifies that a source with no
// Redis entry is considered healthy (fail-open default).
func TestSourceHealthCache_FreshSourceIsHealthy(t *testing.T) {
	cache, _ := newTestSourceHealthCache(t)
	ctx := context.Background()

	healthy := cache.IsHealthy(ctx, "vangsaigon")
	assert.True(t, healthy, "a fresh source with no Redis key should be healthy")
}

// TestSourceHealthCache_AfterMarkUnhealthySourceIsUnhealthy verifies that
// MarkUnhealthy causes the source to report as unhealthy.
func TestSourceHealthCache_AfterMarkUnhealthySourceIsUnhealthy(t *testing.T) {
	cache, _ := newTestSourceHealthCache(t)
	ctx := context.Background()

	err := cache.MarkUnhealthy(ctx, "vangsaigon")
	require.NoError(t, err)

	healthy := cache.IsHealthy(ctx, "vangsaigon")
	assert.False(t, healthy, "source marked unhealthy should report as unhealthy")
}

// TestSourceHealthCache_MarkUnhealthyDoesNotAffectOtherSources verifies that
// marking one source unhealthy does not affect other sources.
func TestSourceHealthCache_MarkUnhealthyDoesNotAffectOtherSources(t *testing.T) {
	cache, _ := newTestSourceHealthCache(t)
	ctx := context.Background()

	err := cache.MarkUnhealthy(ctx, "vangsaigon")
	require.NoError(t, err)

	// A different source must still be healthy.
	healthy := cache.IsHealthy(ctx, "vangtoday")
	assert.True(t, healthy, "unrelated source should remain healthy")
}

// TestSourceHealthCache_CanOverwriteUnhealthy verifies that a subsequent
// MarkUnhealthy call is idempotent and refreshes the TTL.
func TestSourceHealthCache_CanOverwriteUnhealthy(t *testing.T) {
	cache, _ := newTestSourceHealthCache(t)
	ctx := context.Background()

	require.NoError(t, cache.MarkUnhealthy(ctx, "btmc"))
	// Second call must not error (refreshes TTL).
	require.NoError(t, cache.MarkUnhealthy(ctx, "btmc"))

	healthy := cache.IsHealthy(ctx, "btmc")
	assert.False(t, healthy, "source should still be unhealthy after second mark")
}

// TestSourceHealthCache_RedisErrorReturnsHealthy verifies that when Redis is
// unavailable the cache returns healthy (fail-open).
func TestSourceHealthCache_RedisErrorReturnsHealthy(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)

	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})
	t.Cleanup(func() { _ = client.Close() })

	cache := NewSourceHealthCache(client)

	// Close the server to force connection errors.
	mr.Close()

	ctx := context.Background()
	healthy := cache.IsHealthy(ctx, "vangsaigon")
	assert.True(t, healthy, "Redis error should result in fail-open (healthy=true)")
}

// TestSourceHealthCache_KeyFormat verifies that the Redis key is formatted
// with the expected prefix so it is easy to inspect in production.
func TestSourceHealthCache_KeyFormat(t *testing.T) {
	svc, mr := newTestSourceHealthCache(t)
	ctx := context.Background()

	require.NoError(t, svc.MarkUnhealthy(ctx, "vangsaigon"))

	expectedKey := SourceHealthKeyPrefix + ":vangsaigon"
	keys := mr.Keys()
	assert.Contains(t, keys, expectedKey, "Redis key should follow prefix:source format")
}
