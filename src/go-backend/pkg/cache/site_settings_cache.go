package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"wealthjourney/domain/models"

	"github.com/go-redis/redis/v8"
)

const (
	siteSettingsCacheKey = "site_settings:all"
	siteSettingsCacheTTL = 5 * time.Minute
)

// SiteSettingsCache handles caching of site settings in Redis.
type SiteSettingsCache struct {
	client *redis.Client
}

// NewSiteSettingsCache creates a new site settings cache.
func NewSiteSettingsCache(client *redis.Client) *SiteSettingsCache {
	return &SiteSettingsCache{client: client}
}

// Get returns cached settings or nil on cache miss.
func (c *SiteSettingsCache) Get(ctx context.Context) ([]*models.SiteSetting, error) {
	data, err := c.client.Get(ctx, siteSettingsCacheKey).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get site settings from cache: %w", err)
	}

	var settings []*models.SiteSetting
	if err := json.Unmarshal(data, &settings); err != nil {
		return nil, fmt.Errorf("unmarshal site settings: %w", err)
	}

	return settings, nil
}

// Set caches settings with 5-minute TTL.
func (c *SiteSettingsCache) Set(ctx context.Context, settings []*models.SiteSetting) error {
	data, err := json.Marshal(settings)
	if err != nil {
		return fmt.Errorf("marshal site settings: %w", err)
	}

	return c.client.Set(ctx, siteSettingsCacheKey, data, siteSettingsCacheTTL).Err()
}

// Invalidate deletes the cache key.
func (c *SiteSettingsCache) Invalidate(ctx context.Context) error {
	return c.client.Del(ctx, siteSettingsCacheKey).Err()
}
