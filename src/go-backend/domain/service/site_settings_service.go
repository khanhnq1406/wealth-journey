package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	"wealthjourney/pkg/cache"
)

var validSettingKeys = map[string]bool{
	"seo.title": true, "seo.description": true, "seo.keywords": true,
	"seo.og_title": true, "seo.og_description": true, "seo.og_image": true, "seo.og_url": true,
	"seo.twitter_card": true, "seo.twitter_title": true, "seo.twitter_description": true, "seo.twitter_creator": true,
	"seo.robots_index": true, "seo.robots_follow": true, "seo.canonical": true,
	"footer.brand_name": true, "footer.tagline": true, "footer.contact_info": true,
	"fab.title": true, "fab.intro_text": true, "fab.contact_info": true, "fab.enabled": true,
}

var validTwitterCards = map[string]bool{
	"summary":             true,
	"summary_large_image": true,
}

var htmlTagRegex = regexp.MustCompile("<[^>]*>")

type siteSettingsService struct {
	repo  repository.SiteSettingsRepository
	cache *cache.SiteSettingsCache
}

// NewSiteSettingsService creates a new site settings service.
func NewSiteSettingsService(repo repository.SiteSettingsRepository, cache *cache.SiteSettingsCache) SiteSettingsService {
	return &siteSettingsService{
		repo:  repo,
		cache: cache,
	}
}

func (s *siteSettingsService) GetAll(ctx context.Context) ([]*models.SiteSetting, error) {
	// Try cache first
	if s.cache != nil {
		cached, err := s.cache.Get(ctx)
		if err != nil {
			log.Printf("WARNING: site settings cache read failed: %v", err)
		} else if cached != nil {
			return cached, nil
		}
	}

	// Cache miss — fetch from DB
	settings, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	// Set cache
	if s.cache != nil {
		if err := s.cache.Set(ctx, settings); err != nil {
			log.Printf("WARNING: site settings cache write failed: %v", err)
		}
	}

	return settings, nil
}

func (s *siteSettingsService) UpdateSettings(ctx context.Context, adminUserID int32, settings []*models.SiteSetting) ([]*models.SiteSetting, error) {
	if len(settings) == 0 {
		return nil, fmt.Errorf("no settings provided")
	}

	now := time.Now()

	for _, setting := range settings {
		// Validate key
		if !validSettingKeys[setting.Key] {
			return nil, fmt.Errorf("invalid setting key: %s", setting.Key)
		}

		// Validate value length
		if len(setting.Value) == 0 {
			return nil, fmt.Errorf("setting value cannot be empty for key: %s", setting.Key)
		}
		if len(setting.Value) > 5000 {
			return nil, fmt.Errorf("setting value exceeds 5000 characters for key: %s", setting.Key)
		}

		// Key-specific validation
		if err := validateSettingValue(setting.Key, setting.Value); err != nil {
			return nil, err
		}

		// Strip HTML tags (XSS prevention)
		setting.Value = htmlTagRegex.ReplaceAllString(setting.Value, "")

		// Set audit fields
		setting.UpdatedBy = &adminUserID
		setting.UpdatedAt = now
	}

	// Persist
	if err := s.repo.BulkUpsert(ctx, settings); err != nil {
		return nil, fmt.Errorf("failed to update settings: %w", err)
	}

	// Invalidate cache
	if s.cache != nil {
		if err := s.cache.Invalidate(ctx); err != nil {
			log.Printf("WARNING: failed to invalidate site settings cache: %v", err)
		}
	}

	// Return updated settings from DB
	return s.repo.GetAll(ctx)
}

func validateSettingValue(key, value string) error {
	switch key {
	case "seo.keywords":
		var arr []string
		if err := json.Unmarshal([]byte(value), &arr); err != nil {
			return fmt.Errorf("seo.keywords must be a valid JSON array of strings: %w", err)
		}
	case "seo.robots_index", "seo.robots_follow":
		if value != "true" && value != "false" {
			return fmt.Errorf("%s must be 'true' or 'false'", key)
		}
	case "seo.twitter_card":
		if !validTwitterCards[value] {
			return fmt.Errorf("seo.twitter_card must be 'summary' or 'summary_large_image'")
		}
	case "fab.enabled":
		if value != "true" && value != "false" {
			return fmt.Errorf("%s must be 'true' or 'false'", key)
		}
	}
	return nil
}
