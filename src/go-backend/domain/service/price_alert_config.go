package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"

	pkgredis "wealthjourney/pkg/redis"
)

const priceAlertConfigKey = "price_alert:config"

// PriceAlertCategoryConfig holds per-category settings.
type PriceAlertCategoryConfig struct {
	Enabled       bool    `json:"enabled"`
	ThresholdPct  float64 `json:"thresholdPct"`
	TitleTemplate string  `json:"titleTemplate"`
	BodyTemplate  string  `json:"bodyTemplate"`
}

// PriceAlertConfig holds the full configuration.
type PriceAlertConfig struct {
	CooldownMinutes int                                 `json:"cooldownMinutes"`
	TopMoversCount  int                                 `json:"topMoversCount"`
	Categories      map[string]PriceAlertCategoryConfig `json:"categories"`
}

// DefaultPriceAlertConfig returns the default config built from env vars.
func DefaultPriceAlertConfig() PriceAlertConfig {
	return PriceAlertConfig{
		CooldownMinutes: envInt("PRICE_ALERT_COOLDOWN_MINUTES", 120),
		TopMoversCount:  5,
		Categories: map[string]PriceAlertCategoryConfig{
			"gold_vnd": {
				Enabled:       true,
				ThresholdPct:  envFloat("PRICE_ALERT_GOLD_VND_PCT", 2.0),
				TitleTemplate: "Giá vàng biến động mạnh",
				BodyTemplate:  "{moverName} {direction} {baselinePrice}->{currentPrice}",
			},
			"gold_usd": {
				Enabled:       true,
				ThresholdPct:  envFloat("PRICE_ALERT_GOLD_USD_PCT", 1.5),
				TitleTemplate: "Giá vàng biến động mạnh",
				BodyTemplate:  "{moverName} {direction} {baselinePrice}->{currentPrice}",
			},
			"silver_vnd": {
				Enabled:       true,
				ThresholdPct:  envFloat("PRICE_ALERT_SILVER_VND_PCT", 3.0),
				TitleTemplate: "Giá bạc biến động mạnh",
				BodyTemplate:  "{moverName} {direction} {baselinePrice}->{currentPrice}",
			},
			"silver_usd": {
				Enabled:       true,
				ThresholdPct:  envFloat("PRICE_ALERT_SILVER_USD_PCT", 2.0),
				TitleTemplate: "Giá bạc biến động mạnh",
				BodyTemplate:  "{moverName} {direction} {baselinePrice}->{currentPrice}",
			},
		},
	}
}

// LoadPriceAlertConfig reads config from Redis, falling back to defaults.
func LoadPriceAlertConfig(ctx context.Context, rdb *pkgredis.RedisClient) PriceAlertConfig {
	defaults := DefaultPriceAlertConfig()
	if rdb == nil {
		return defaults
	}

	val, err := rdb.GetClient().Get(ctx, priceAlertConfigKey).Result()
	if err != nil {
		// Key doesn't exist or Redis unavailable — use defaults
		return defaults
	}

	var cfg PriceAlertConfig
	if err := json.Unmarshal([]byte(val), &cfg); err != nil {
		log.Printf("Price alert config: failed to unmarshal from Redis: %v", err)
		return defaults
	}

	// Ensure all 4 categories exist (merge defaults for missing categories)
	for cat, def := range defaults.Categories {
		if _, ok := cfg.Categories[cat]; !ok {
			if cfg.Categories == nil {
				cfg.Categories = make(map[string]PriceAlertCategoryConfig)
			}
			cfg.Categories[cat] = def
		}
	}

	return cfg
}

// SavePriceAlertConfig saves config to Redis (no TTL — persistent).
func SavePriceAlertConfig(ctx context.Context, rdb *pkgredis.RedisClient, cfg PriceAlertConfig) error {
	data, err := json.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal price alert config: %w", err)
	}
	return rdb.GetClient().Set(ctx, priceAlertConfigKey, string(data), 0).Err()
}

// DeletePriceAlertConfig removes the config from Redis so defaults are used.
func DeletePriceAlertConfig(ctx context.Context, rdb *pkgredis.RedisClient) error {
	return rdb.GetClient().Del(ctx, priceAlertConfigKey).Err()
}

var htmlTagRe = regexp.MustCompile(`<[^>]*>`)

// stripHTML removes HTML tags from a string.
func stripHTML(s string) string {
	return strings.TrimSpace(htmlTagRe.ReplaceAllString(s, ""))
}

// ValidatePriceAlertConfig validates config fields. Returns field-specific errors or nil.
func ValidatePriceAlertConfig(cfg PriceAlertConfig) map[string]string {
	errors := make(map[string]string)

	if cfg.CooldownMinutes < 1 || cfg.CooldownMinutes > 1440 {
		errors["cooldownMinutes"] = "must be between 1 and 1440"
	}
	if cfg.TopMoversCount < 1 || cfg.TopMoversCount > 20 {
		errors["topMoversCount"] = "must be between 1 and 20"
	}

	validCategories := map[string]bool{
		"gold_vnd": true, "gold_usd": true,
		"silver_vnd": true, "silver_usd": true,
	}

	for cat, catCfg := range cfg.Categories {
		if !validCategories[cat] {
			errors[fmt.Sprintf("categories.%s", cat)] = "unknown category"
			continue
		}
		if catCfg.ThresholdPct < 0.1 || catCfg.ThresholdPct > 50.0 {
			errors[fmt.Sprintf("categories.%s.thresholdPct", cat)] = "must be between 0.1 and 50.0"
		}
		tt := stripHTML(catCfg.TitleTemplate)
		if len(tt) == 0 || len(tt) > 200 {
			errors[fmt.Sprintf("categories.%s.titleTemplate", cat)] = "must be 1-200 characters (no HTML)"
		}
		bodyText := stripHTML(catCfg.BodyTemplate)
		if len(bodyText) == 0 || len(bodyText) > 500 {
			errors[fmt.Sprintf("categories.%s.bodyTemplate", cat)] = "must be 1-500 characters (no HTML)"
		}
	}

	if len(errors) > 0 {
		return errors
	}
	return nil
}

// SanitizePriceAlertConfig strips HTML from all string fields in-place.
func SanitizePriceAlertConfig(cfg *PriceAlertConfig) {
	for cat, catCfg := range cfg.Categories {
		catCfg.TitleTemplate = stripHTML(catCfg.TitleTemplate)
		catCfg.BodyTemplate = stripHTML(catCfg.BodyTemplate)
		cfg.Categories[cat] = catCfg
	}
}

// ResolvePlaceholders replaces {placeholder} tokens in a template string.
func ResolvePlaceholders(template string, values map[string]string) string {
	result := template
	for key, val := range values {
		result = strings.ReplaceAll(result, "{"+key+"}", val)
	}
	return result
}

// FormatPriceForDisplay converts a stored price to display format.
// USD categories: stored as cents (×100) → display as dollars with 2 decimals.
// VND categories: stored as raw VND → display with thousand separators (no division).
func FormatPriceForDisplay(price int64, category string) string {
	switch category {
	case "gold_usd", "silver_usd":
		negative := price < 0
		if negative {
			price = -price
		}
		dollars := price / 100
		cents := price % 100
		result := fmt.Sprintf("%s.%02d", FormatWithThousandSeparators(dollars), cents)
		if negative {
			return "-" + result
		}
		return result
	default:
		return FormatWithThousandSeparators(price)
	}
}

// FormatWithThousandSeparators formats an int64 with comma separators.
func FormatWithThousandSeparators(n int64) string {
	negative := n < 0
	if negative {
		n = -n
	}
	s := fmt.Sprintf("%d", n)
	// Insert commas from right
	var result []byte
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			result = append(result, ',')
		}
		result = append(result, byte(c))
	}
	if negative {
		return "-" + string(result)
	}
	return string(result)
}

func directionSymbol(dir string) string {
	if dir == "up" {
		return "↑"
	}
	return "↓"
}

func directionText(dir string) string {
	if dir == "up" {
		return "tăng"
	}
	return "giảm"
}

func categoryDisplayName(cat string) string {
	names := map[string]string{
		"gold_vnd":   "Vàng trong nước",
		"gold_usd":   "Vàng thế giới",
		"silver_vnd": "Bạc trong nước",
		"silver_usd": "Bạc thế giới",
	}
	if name, ok := names[cat]; ok {
		return name
	}
	return cat
}

// categoryCurrency returns the currency code for a given category.
func categoryCurrency(cat string) string {
	switch cat {
	case "gold_vnd", "silver_vnd":
		return "VND"
	case "gold_usd", "silver_usd":
		return "USD"
	default:
		return ""
	}
}

// priceUnitForMover returns the display unit label for the top mover's price.
// For gold_vnd, the vang.today API returns prices per lượng.
// For gold_usd, prices are per ounce.
// For silver_vnd, the unit depends on the item type code (tael-based ending in "L" vs kg-based ending in "KG").
// For silver_usd, prices are per ounce.
func priceUnitForMover(category, typeCode string) string {
	switch category {
	case "gold_vnd":
		return "lượng"
	case "gold_usd":
		return "oz"
	case "silver_vnd":
		if len(typeCode) >= 2 && typeCode[len(typeCode)-2:] == "KG" {
			return "kg"
		}
		return "lượng"
	case "silver_usd":
		return "oz"
	default:
		return ""
	}
}
