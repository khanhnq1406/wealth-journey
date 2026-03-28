package cache

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestRedisClient creates a miniredis-backed *redis.Client for tests.
func newTestRedisClient(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
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

	return client, mr
}

// ---------------------------------------------------------------------------
// GoldPriceCache emergency methods
// ---------------------------------------------------------------------------

func TestGoldPriceCache_SetEmergency_StoresData(t *testing.T) {
	client, _ := newTestRedisClient(t)
	c := NewGoldPriceCache(client)
	ctx := context.Background()

	prices := []*CachedGoldPrice{
		{TypeCode: "SJC", Name: "SJC 1L", Buy: 100_000_000, Sell: 101_000_000, Currency: "VND"},
	}

	err := c.SetEmergency(ctx, prices)
	require.NoError(t, err)

	got, err := c.GetEmergency(ctx)
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "SJC", got[0].TypeCode)
	assert.Equal(t, int64(100_000_000), got[0].Buy)
}

func TestGoldPriceCache_GetEmergency_ReturnsNilOnMiss(t *testing.T) {
	client, _ := newTestRedisClient(t)
	c := NewGoldPriceCache(client)
	ctx := context.Background()

	got, err := c.GetEmergency(ctx)
	require.NoError(t, err)
	assert.Nil(t, got, "empty cache should return nil, not an error")
}

func TestGoldPriceCache_SetEmergency_OverwritesPreviousData(t *testing.T) {
	client, _ := newTestRedisClient(t)
	c := NewGoldPriceCache(client)
	ctx := context.Background()

	first := []*CachedGoldPrice{{TypeCode: "SJC", Buy: 100_000_000}}
	second := []*CachedGoldPrice{{TypeCode: "DOJI", Buy: 200_000_000}, {TypeCode: "SJC", Buy: 105_000_000}}

	require.NoError(t, c.SetEmergency(ctx, first))
	require.NoError(t, c.SetEmergency(ctx, second))

	got, err := c.GetEmergency(ctx)
	require.NoError(t, err)
	require.Len(t, got, 2, "second write should overwrite the first")
	assert.Equal(t, "DOJI", got[0].TypeCode)
}

func TestGoldPriceCache_SetEmergency_HasOneHourTTL(t *testing.T) {
	client, mr := newTestRedisClient(t)
	c := NewGoldPriceCache(client)
	ctx := context.Background()

	prices := []*CachedGoldPrice{{TypeCode: "SJC", Buy: 100_000_000}}
	require.NoError(t, c.SetEmergency(ctx, prices))

	ttl := mr.TTL(emergencyGoldKey)
	// TTL must be set and within a 1-hour range (allow 1-second rounding).
	assert.InDelta(t, EmergencyGoldCacheTTL.Seconds(), ttl.Seconds(), 1,
		"emergency gold cache TTL should be ~1 hour")
}

func TestGoldPriceCache_GetEmergency_ReturnsNilAfterExpiry(t *testing.T) {
	client, mr := newTestRedisClient(t)
	c := NewGoldPriceCache(client)
	ctx := context.Background()

	prices := []*CachedGoldPrice{{TypeCode: "SJC", Buy: 100_000_000}}
	require.NoError(t, c.SetEmergency(ctx, prices))

	// Fast-forward miniredis time past the TTL.
	mr.FastForward(EmergencyGoldCacheTTL + 1)

	got, err := c.GetEmergency(ctx)
	require.NoError(t, err)
	assert.Nil(t, got, "data should be gone after TTL expires")
}

// ---------------------------------------------------------------------------
// CurrencyPriceCache emergency methods
// ---------------------------------------------------------------------------

func TestCurrencyPriceCache_SetEmergency_StoresData(t *testing.T) {
	client, _ := newTestRedisClient(t)
	c := NewCurrencyPriceCache(client)
	ctx := context.Background()

	prices := []*CachedCurrencyPrice{
		{TypeCode: "USD", Name: "US Dollar", Buy: 25_000, Sell: 25_500, Currency: "VND"},
	}

	err := c.SetEmergency(ctx, prices)
	require.NoError(t, err)

	got, err := c.GetEmergency(ctx)
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "USD", got[0].TypeCode)
	assert.Equal(t, int64(25_000), got[0].Buy)
}

func TestCurrencyPriceCache_GetEmergency_ReturnsNilOnMiss(t *testing.T) {
	client, _ := newTestRedisClient(t)
	c := NewCurrencyPriceCache(client)
	ctx := context.Background()

	got, err := c.GetEmergency(ctx)
	require.NoError(t, err)
	assert.Nil(t, got, "empty cache should return nil, not an error")
}

func TestCurrencyPriceCache_SetEmergency_OverwritesPreviousData(t *testing.T) {
	client, _ := newTestRedisClient(t)
	c := NewCurrencyPriceCache(client)
	ctx := context.Background()

	first := []*CachedCurrencyPrice{{TypeCode: "USD", Buy: 25_000}}
	second := []*CachedCurrencyPrice{{TypeCode: "EUR", Buy: 27_000}, {TypeCode: "USD", Buy: 25_500}}

	require.NoError(t, c.SetEmergency(ctx, first))
	require.NoError(t, c.SetEmergency(ctx, second))

	got, err := c.GetEmergency(ctx)
	require.NoError(t, err)
	require.Len(t, got, 2, "second write should overwrite the first")
	assert.Equal(t, "EUR", got[0].TypeCode)
}

func TestCurrencyPriceCache_SetEmergency_HasOneHourTTL(t *testing.T) {
	client, mr := newTestRedisClient(t)
	c := NewCurrencyPriceCache(client)
	ctx := context.Background()

	prices := []*CachedCurrencyPrice{{TypeCode: "USD", Buy: 25_000}}
	require.NoError(t, c.SetEmergency(ctx, prices))

	ttl := mr.TTL(emergencyCurrencyKey)
	assert.InDelta(t, EmergencyCurrencyCacheTTL.Seconds(), ttl.Seconds(), 1,
		"emergency currency cache TTL should be ~1 hour")
}

func TestCurrencyPriceCache_GetEmergency_ReturnsNilAfterExpiry(t *testing.T) {
	client, mr := newTestRedisClient(t)
	c := NewCurrencyPriceCache(client)
	ctx := context.Background()

	prices := []*CachedCurrencyPrice{{TypeCode: "USD", Buy: 25_000}}
	require.NoError(t, c.SetEmergency(ctx, prices))

	mr.FastForward(EmergencyCurrencyCacheTTL + 1)

	got, err := c.GetEmergency(ctx)
	require.NoError(t, err)
	assert.Nil(t, got, "data should be gone after TTL expires")
}
