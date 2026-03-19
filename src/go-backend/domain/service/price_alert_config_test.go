package service

import (
	"context"
	"encoding/json"
	"testing"

	pkgredis "wealthjourney/pkg/redis"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestRedis(t *testing.T) (*pkgredis.RedisClient, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)

	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = client.Close() })

	return pkgredis.NewFromClient(client), mr
}

func TestDefaultPriceAlertConfig(t *testing.T) {
	cfg := DefaultPriceAlertConfig()

	assert.Equal(t, 120, cfg.CooldownMinutes)
	assert.Equal(t, 5, cfg.TopMoversCount)
	assert.Len(t, cfg.Categories, 4)

	goldVND := cfg.Categories["gold_vnd"]
	assert.True(t, goldVND.Enabled)
	assert.Equal(t, 2.0, goldVND.ThresholdPct)
	assert.NotEmpty(t, goldVND.TitleTemplate)
	assert.NotEmpty(t, goldVND.BodyTemplate)
}

func TestValidatePriceAlertConfig_Valid(t *testing.T) {
	cfg := DefaultPriceAlertConfig()
	errs := ValidatePriceAlertConfig(cfg)
	assert.Nil(t, errs)
}

func TestValidatePriceAlertConfig_InvalidCooldown(t *testing.T) {
	cfg := DefaultPriceAlertConfig()
	cfg.CooldownMinutes = 0
	errs := ValidatePriceAlertConfig(cfg)
	assert.NotNil(t, errs)
	assert.Contains(t, errs, "cooldownMinutes")

	cfg.CooldownMinutes = 2000
	errs = ValidatePriceAlertConfig(cfg)
	assert.NotNil(t, errs)
	assert.Contains(t, errs, "cooldownMinutes")
}

func TestValidatePriceAlertConfig_InvalidThreshold(t *testing.T) {
	cfg := DefaultPriceAlertConfig()
	cfg.Categories["gold_vnd"] = PriceAlertCategoryConfig{
		Enabled:       true,
		ThresholdPct:  0.0, // below 0.1
		TitleTemplate: "test title",
		BodyTemplate:  "test body",
	}
	errs := ValidatePriceAlertConfig(cfg)
	assert.NotNil(t, errs)
	assert.Contains(t, errs, "categories.gold_vnd.thresholdPct")
}

func TestValidatePriceAlertConfig_InvalidTopMovers(t *testing.T) {
	cfg := DefaultPriceAlertConfig()
	cfg.TopMoversCount = 25
	errs := ValidatePriceAlertConfig(cfg)
	assert.NotNil(t, errs)
	assert.Contains(t, errs, "topMoversCount")
}

func TestValidatePriceAlertConfig_HTMLOnlyTemplate(t *testing.T) {
	cfg := DefaultPriceAlertConfig()
	cfg.Categories["gold_vnd"] = PriceAlertCategoryConfig{
		Enabled:       true,
		ThresholdPct:  2.0,
		TitleTemplate: "<b></b><i></i>", // HTML-only — after strip, empty
		BodyTemplate:  "valid body",
	}
	errs := ValidatePriceAlertConfig(cfg)
	assert.NotNil(t, errs)
	assert.Contains(t, errs, "categories.gold_vnd.titleTemplate")
}

func TestSanitizePriceAlertConfig(t *testing.T) {
	cfg := &PriceAlertConfig{
		Categories: map[string]PriceAlertCategoryConfig{
			"gold_vnd": {
				TitleTemplate: "Gold <b>alert</b> notification",
				BodyTemplate:  "Price <em>changed</em> by {changePct}%",
			},
		},
	}

	SanitizePriceAlertConfig(cfg)

	assert.Equal(t, "Gold alert notification", cfg.Categories["gold_vnd"].TitleTemplate)
	assert.Equal(t, "Price changed by {changePct}%", cfg.Categories["gold_vnd"].BodyTemplate)
}

func TestResolvePlaceholders(t *testing.T) {
	template := "{moverName} {direction} {changePct}%"
	values := map[string]string{
		"moverName": "SJC 1L-10L",
		"direction": "↑",
		"changePct": "2.1",
	}

	result := ResolvePlaceholders(template, values)
	assert.Equal(t, "SJC 1L-10L ↑ 2.1%", result)
}

func TestResolvePlaceholders_UnknownLeft(t *testing.T) {
	template := "{moverName} {unknownPlaceholder}"
	values := map[string]string{
		"moverName": "SJC",
	}

	result := ResolvePlaceholders(template, values)
	assert.Equal(t, "SJC {unknownPlaceholder}", result)
}

func TestFormatWithThousandSeparators(t *testing.T) {
	tests := []struct {
		input    int64
		expected string
	}{
		{0, "0"},
		{100, "100"},
		{1000, "1,000"},
		{1000000, "1,000,000"},
		{-1500000, "-1,500,000"},
		{85000000, "85,000,000"},
	}

	for _, tt := range tests {
		result := FormatWithThousandSeparators(tt.input)
		assert.Equal(t, tt.expected, result, "for input %d", tt.input)
	}
}

func TestLoadPriceAlertConfig_FromRedis(t *testing.T) {
	rdb, mr := newTestRedis(t)
	ctx := context.Background()

	cfg := PriceAlertConfig{
		CooldownMinutes: 90,
		TopMoversCount:  3,
		Categories: map[string]PriceAlertCategoryConfig{
			"gold_vnd":   {Enabled: false, ThresholdPct: 5.0, TitleTemplate: "Custom gold", BodyTemplate: "Custom body"},
			"gold_usd":   {Enabled: true, ThresholdPct: 1.5, TitleTemplate: "Gold USD", BodyTemplate: "body"},
			"silver_vnd": {Enabled: true, ThresholdPct: 3.0, TitleTemplate: "Silver VND", BodyTemplate: "body"},
			"silver_usd": {Enabled: true, ThresholdPct: 2.0, TitleTemplate: "Silver USD", BodyTemplate: "body"},
		},
	}
	data, _ := json.Marshal(cfg)
	mr.Set(priceAlertConfigKey, string(data))

	loaded := LoadPriceAlertConfig(ctx, rdb)

	assert.Equal(t, 90, loaded.CooldownMinutes)
	assert.Equal(t, 3, loaded.TopMoversCount)
	assert.False(t, loaded.Categories["gold_vnd"].Enabled)
	assert.Equal(t, 5.0, loaded.Categories["gold_vnd"].ThresholdPct)
}

func TestLoadPriceAlertConfig_Fallback(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	// No key in Redis — should return defaults
	loaded := LoadPriceAlertConfig(ctx, rdb)

	assert.Equal(t, 120, loaded.CooldownMinutes)
	assert.Equal(t, 5, loaded.TopMoversCount)
	assert.Len(t, loaded.Categories, 4)
}

func TestLoadPriceAlertConfig_NilRedis(t *testing.T) {
	ctx := context.Background()
	loaded := LoadPriceAlertConfig(ctx, nil)

	assert.Equal(t, 120, loaded.CooldownMinutes)
	assert.Len(t, loaded.Categories, 4)
}

func TestLoadPriceAlertConfig_MergesMissingCategories(t *testing.T) {
	rdb, mr := newTestRedis(t)
	ctx := context.Background()

	// Only gold_vnd stored in Redis
	cfg := PriceAlertConfig{
		CooldownMinutes: 60,
		TopMoversCount:  2,
		Categories: map[string]PriceAlertCategoryConfig{
			"gold_vnd": {Enabled: true, ThresholdPct: 1.0, TitleTemplate: "Gold", BodyTemplate: "body"},
		},
	}
	data, _ := json.Marshal(cfg)
	mr.Set(priceAlertConfigKey, string(data))

	loaded := LoadPriceAlertConfig(ctx, rdb)

	// gold_vnd should be from Redis
	assert.Equal(t, 1.0, loaded.Categories["gold_vnd"].ThresholdPct)
	// Missing categories should be filled from defaults
	assert.Contains(t, loaded.Categories, "gold_usd")
	assert.Contains(t, loaded.Categories, "silver_vnd")
	assert.Contains(t, loaded.Categories, "silver_usd")
}

func TestSavePriceAlertConfig_RoundTrip(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	cfg := PriceAlertConfig{
		CooldownMinutes: 45,
		TopMoversCount:  7,
		Categories: map[string]PriceAlertCategoryConfig{
			"gold_vnd":   {Enabled: true, ThresholdPct: 1.5, TitleTemplate: "T1", BodyTemplate: "B1"},
			"gold_usd":   {Enabled: false, ThresholdPct: 2.5, TitleTemplate: "T2", BodyTemplate: "B2"},
			"silver_vnd": {Enabled: true, ThresholdPct: 3.5, TitleTemplate: "T3", BodyTemplate: "B3"},
			"silver_usd": {Enabled: true, ThresholdPct: 4.5, TitleTemplate: "T4", BodyTemplate: "B4"},
		},
	}

	err := SavePriceAlertConfig(ctx, rdb, cfg)
	require.NoError(t, err)

	loaded := LoadPriceAlertConfig(ctx, rdb)

	assert.Equal(t, cfg.CooldownMinutes, loaded.CooldownMinutes)
	assert.Equal(t, cfg.TopMoversCount, loaded.TopMoversCount)
	assert.Equal(t, cfg.Categories["gold_usd"].Enabled, loaded.Categories["gold_usd"].Enabled)
}
