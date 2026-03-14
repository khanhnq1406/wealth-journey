package cache

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/go-redis/redis/v8"
)

const (
	PriceOverrideKeyPrefix = "price_override"
)

type PriceOverride struct {
	TypeCode  string `json:"type_code"`
	Name      string `json:"name"`
	Buy       int64  `json:"buy"`
	Sell      int64  `json:"sell"`
	Currency  string `json:"currency"`
	Category  string `json:"category"`
	UpdatedBy int32  `json:"updated_by"`
	UpdatedAt int64  `json:"updated_at"`
}

type PriceOverrideCache struct {
	client *redis.Client
}

func NewPriceOverrideCache(client *redis.Client) *PriceOverrideCache {
	return &PriceOverrideCache{client: client}
}

func (c *PriceOverrideCache) buildKey(category, typeCode, currency string) string {
	return fmt.Sprintf("%s:%s:%s:%s", PriceOverrideKeyPrefix, category, typeCode, currency)
}

func (c *PriceOverrideCache) Set(ctx context.Context, override *PriceOverride) error {
	key := c.buildKey(override.Category, override.TypeCode, override.Currency)
	data, err := json.Marshal(override)
	if err != nil {
		return fmt.Errorf("marshal price override: %w", err)
	}
	return c.client.Set(ctx, key, data, 0).Err() // No TTL
}

func (c *PriceOverrideCache) Get(ctx context.Context, category, typeCode, currency string) (*PriceOverride, error) {
	key := c.buildKey(category, typeCode, currency)
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, fmt.Errorf("get price override: %w", err)
	}
	var override PriceOverride
	if err := json.Unmarshal(data, &override); err != nil {
		return nil, fmt.Errorf("unmarshal price override: %w", err)
	}
	return &override, nil
}

func (c *PriceOverrideCache) Delete(ctx context.Context, category, typeCode, currency string) error {
	key := c.buildKey(category, typeCode, currency)
	return c.client.Del(ctx, key).Err()
}

func (c *PriceOverrideCache) GetAllByCategory(ctx context.Context, category string) ([]*PriceOverride, error) {
	pattern := fmt.Sprintf("%s:%s:*", PriceOverrideKeyPrefix, category)
	return c.scanAndGet(ctx, pattern)
}

func (c *PriceOverrideCache) GetAll(ctx context.Context) ([]*PriceOverride, error) {
	pattern := fmt.Sprintf("%s:*", PriceOverrideKeyPrefix)
	return c.scanAndGet(ctx, pattern)
}

func (c *PriceOverrideCache) scanAndGet(ctx context.Context, pattern string) ([]*PriceOverride, error) {
	var overrides []*PriceOverride
	var cursor uint64
	for {
		keys, nextCursor, err := c.client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return nil, fmt.Errorf("scan price overrides: %w", err)
		}
		for _, key := range keys {
			data, err := c.client.Get(ctx, key).Bytes()
			if err != nil {
				if err == redis.Nil {
					continue
				}
				return nil, fmt.Errorf("get price override %s: %w", key, err)
			}
			var override PriceOverride
			if err := json.Unmarshal(data, &override); err != nil {
				continue // Skip corrupted entries
			}
			overrides = append(overrides, &override)
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return overrides, nil
}
