package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

const (
	// GoldPriceKeyPrefix is the prefix for gold price cache keys
	GoldPriceKeyPrefix = "gold_price"
	// GoldPriceCacheTTL is the time-to-live for individual gold price cache entries
	GoldPriceCacheTTL = 15 * time.Minute
	// AllGoldPricesCacheTTL is the time-to-live for the aggregate gold prices cache
	AllGoldPricesCacheTTL = 5 * time.Minute

	goldAllKey = "gold_price:all"
)

// GoldPriceCache handles caching of gold prices from vang.today in Redis
type GoldPriceCache struct {
	client *redis.Client
}

// NewGoldPriceCache creates a new gold price cache
func NewGoldPriceCache(client *redis.Client) *GoldPriceCache {
	return &GoldPriceCache{
		client: client,
	}
}

// CachedGoldPrice represents a cached gold price
type CachedGoldPrice struct {
	TypeCode   string `json:"type_code"`
	Name       string `json:"name"`
	Buy        int64  `json:"buy"`
	Sell       int64  `json:"sell"`
	ChangeBuy  int64  `json:"change_buy"`
	ChangeSell int64  `json:"change_sell"`
	Currency   string `json:"currency"`
	UpdateTime int64  `json:"update_time"`
}

// buildKey builds the cache key for a gold symbol
func (c *GoldPriceCache) buildKey(symbol string) string {
	return fmt.Sprintf("%s:%s", GoldPriceKeyPrefix, symbol)
}

// Set stores a gold price in cache
func (c *GoldPriceCache) Set(ctx context.Context, symbol string, price *CachedGoldPrice, ttl time.Duration) error {
	key := c.buildKey(symbol)
	data, err := json.Marshal(price)
	if err != nil {
		return fmt.Errorf("marshal gold price: %w", err)
	}

	return c.client.Set(ctx, key, data, ttl).Err()
}

// Get retrieves a cached gold price
func (c *GoldPriceCache) Get(ctx context.Context, symbol string) (*CachedGoldPrice, error) {
	key := c.buildKey(symbol)
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			// Cache miss
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get gold price from cache: %w", err)
	}

	var price CachedGoldPrice
	if err := json.Unmarshal(data, &price); err != nil {
		return nil, fmt.Errorf("unmarshal gold price: %w", err)
	}

	return &price, nil
}

// Delete removes a gold price from cache
func (c *GoldPriceCache) Delete(ctx context.Context, symbol string) error {
	key := c.buildKey(symbol)
	return c.client.Del(ctx, key).Err()
}

// SetAll stores the full list of gold prices under the aggregate cache key.
func (c *GoldPriceCache) SetAll(ctx context.Context, prices []*CachedGoldPrice, ttl time.Duration) error {
	data, err := json.Marshal(prices)
	if err != nil {
		return fmt.Errorf("marshal gold prices: %w", err)
	}
	return c.client.Set(ctx, goldAllKey, data, ttl).Err()
}

// GetAll retrieves the full list of gold prices from the aggregate cache key.
// Returns nil, nil on cache miss.
func (c *GoldPriceCache) GetAll(ctx context.Context) ([]*CachedGoldPrice, error) {
	data, err := c.client.Get(ctx, goldAllKey).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, fmt.Errorf("get all gold prices from cache: %w", err)
	}
	var prices []*CachedGoldPrice
	if err := json.Unmarshal(data, &prices); err != nil {
		return nil, fmt.Errorf("unmarshal gold prices: %w", err)
	}
	return prices, nil
}

const (
	// EmergencyGoldCacheTTL is the TTL for the emergency gold price cache.
	// Stale data is served for up to 1 hour when all live sources are unavailable.
	EmergencyGoldCacheTTL = 1 * time.Hour

	emergencyGoldKey = "gold_price:emergency"
)

// SetEmergency stores the full list of gold prices under a long-lived emergency
// cache key (1-hour TTL). This is refreshed after every successful live fetch
// so that stale-but-valid data is available as a last resort.
func (c *GoldPriceCache) SetEmergency(ctx context.Context, prices []*CachedGoldPrice) error {
	data, err := json.Marshal(prices)
	if err != nil {
		return fmt.Errorf("marshal emergency gold prices: %w", err)
	}
	return c.client.Set(ctx, emergencyGoldKey, data, EmergencyGoldCacheTTL).Err()
}

// GetEmergency retrieves gold prices from the emergency cache.
// Returns nil, nil on cache miss (key absent or expired).
func (c *GoldPriceCache) GetEmergency(ctx context.Context) ([]*CachedGoldPrice, error) {
	data, err := c.client.Get(ctx, emergencyGoldKey).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, fmt.Errorf("get emergency gold prices from cache: %w", err)
	}
	var prices []*CachedGoldPrice
	if err := json.Unmarshal(data, &prices); err != nil {
		return nil, fmt.Errorf("unmarshal emergency gold prices: %w", err)
	}
	return prices, nil
}
