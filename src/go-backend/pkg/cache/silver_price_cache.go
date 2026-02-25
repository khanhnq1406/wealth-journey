package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

const (
	// SilverPriceKeyPrefix is the prefix for silver price cache keys
	SilverPriceKeyPrefix = "silver_price"
	// SilverPriceCacheTTL is the time-to-live for silver price cache entries
	SilverPriceCacheTTL = 15 * time.Minute
)

// SilverPriceCache handles caching of silver prices from ancarat in Redis
type SilverPriceCache struct {
	client *redis.Client
}

// NewSilverPriceCache creates a new silver price cache
func NewSilverPriceCache(client *redis.Client) *SilverPriceCache {
	return &SilverPriceCache{
		client: client,
	}
}

// CachedSilverPrice represents a cached silver price
type CachedSilverPrice struct {
	TypeCode   string `json:"type_code"`
	Name       string `json:"name"`
	Buy        int64  `json:"buy"`
	Sell       int64  `json:"sell"`
	ChangeBuy  int64  `json:"change_buy"`
	ChangeSell int64  `json:"change_sell"`
	Currency   string `json:"currency"`
	UpdateTime int64  `json:"update_time"`
}

// buildKey builds the cache key for a silver symbol and currency
func (c *SilverPriceCache) buildKey(symbol, currency string) string {
	return fmt.Sprintf("%s:%s:%s", SilverPriceKeyPrefix, symbol, currency)
}

// Set stores a silver price in cache
func (c *SilverPriceCache) Set(ctx context.Context, symbol string, price *CachedSilverPrice, ttl time.Duration) error {
	key := c.buildKey(symbol, price.Currency)
	data, err := json.Marshal(price)
	if err != nil {
		return fmt.Errorf("marshal silver price: %w", err)
	}

	return c.client.Set(ctx, key, data, ttl).Err()
}

// Get retrieves a cached silver price
func (c *SilverPriceCache) Get(ctx context.Context, symbol, currency string) (*CachedSilverPrice, error) {
	key := c.buildKey(symbol, currency)
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			// Cache miss
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get silver price from cache: %w", err)
	}

	var price CachedSilverPrice
	if err := json.Unmarshal(data, &price); err != nil {
		return nil, fmt.Errorf("unmarshal silver price: %w", err)
	}

	return &price, nil
}

// Delete removes a silver price from cache
func (c *SilverPriceCache) Delete(ctx context.Context, symbol, currency string) error {
	key := c.buildKey(symbol, currency)
	return c.client.Del(ctx, key).Err()
}
