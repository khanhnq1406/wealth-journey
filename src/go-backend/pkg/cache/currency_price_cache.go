package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

const (
	// CurrencyPriceKeyPrefix is the prefix for currency price cache keys
	CurrencyPriceKeyPrefix = "currency_price"
	// CurrencyPriceCacheTTL is the time-to-live for individual currency price cache entries
	CurrencyPriceCacheTTL = 15 * time.Minute
	// AllCurrencyPricesCacheTTL is the time-to-live for the aggregate currency prices cache
	AllCurrencyPricesCacheTTL = 5 * time.Minute

	currencyAllKey = "currency_price:all"
)

// CurrencyPriceCache handles caching of currency prices in Redis
type CurrencyPriceCache struct {
	client *redis.Client
}

// NewCurrencyPriceCache creates a new currency price cache
func NewCurrencyPriceCache(client *redis.Client) *CurrencyPriceCache {
	return &CurrencyPriceCache{
		client: client,
	}
}

// CachedCurrencyPrice represents a cached currency price
type CachedCurrencyPrice struct {
	TypeCode   string `json:"type_code"`
	Name       string `json:"name"`
	Buy        int64  `json:"buy"`
	Sell       int64  `json:"sell"`
	ChangeBuy  int64  `json:"change_buy"`
	ChangeSell int64  `json:"change_sell"`
	Currency   string `json:"currency"`
	UpdateTime int64  `json:"update_time"`
}

// buildKey builds the cache key for a currency symbol
func (c *CurrencyPriceCache) buildKey(symbol string) string {
	return fmt.Sprintf("%s:%s", CurrencyPriceKeyPrefix, symbol)
}

// Set stores a currency price in cache
func (c *CurrencyPriceCache) Set(ctx context.Context, symbol string, price *CachedCurrencyPrice, ttl time.Duration) error {
	key := c.buildKey(symbol)
	data, err := json.Marshal(price)
	if err != nil {
		return fmt.Errorf("marshal currency price: %w", err)
	}

	return c.client.Set(ctx, key, data, ttl).Err()
}

// Get retrieves a cached currency price
func (c *CurrencyPriceCache) Get(ctx context.Context, symbol string) (*CachedCurrencyPrice, error) {
	key := c.buildKey(symbol)
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			// Cache miss
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get currency price from cache: %w", err)
	}

	var price CachedCurrencyPrice
	if err := json.Unmarshal(data, &price); err != nil {
		return nil, fmt.Errorf("unmarshal currency price: %w", err)
	}

	return &price, nil
}

// Delete removes a currency price from cache
func (c *CurrencyPriceCache) Delete(ctx context.Context, symbol string) error {
	key := c.buildKey(symbol)
	return c.client.Del(ctx, key).Err()
}

// SetAll stores the full list of currency prices under the aggregate cache key.
func (c *CurrencyPriceCache) SetAll(ctx context.Context, prices []*CachedCurrencyPrice, ttl time.Duration) error {
	data, err := json.Marshal(prices)
	if err != nil {
		return fmt.Errorf("marshal currency prices: %w", err)
	}
	return c.client.Set(ctx, currencyAllKey, data, ttl).Err()
}

// GetAll retrieves the full list of currency prices from the aggregate cache key.
// Returns nil, nil on cache miss.
func (c *CurrencyPriceCache) GetAll(ctx context.Context) ([]*CachedCurrencyPrice, error) {
	data, err := c.client.Get(ctx, currencyAllKey).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, fmt.Errorf("get all currency prices from cache: %w", err)
	}
	var prices []*CachedCurrencyPrice
	if err := json.Unmarshal(data, &prices); err != nil {
		return nil, fmt.Errorf("unmarshal currency prices: %w", err)
	}
	return prices, nil
}
