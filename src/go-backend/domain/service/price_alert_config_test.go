package service

import (
	"context"
	"encoding/json"
	"strings"
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
	require.NoError(t, mr.Set(priceAlertConfigKey, string(data)))

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
	require.NoError(t, mr.Set(priceAlertConfigKey, string(data)))

	loaded := LoadPriceAlertConfig(ctx, rdb)

	// gold_vnd should be from Redis
	assert.Equal(t, 1.0, loaded.Categories["gold_vnd"].ThresholdPct)
	// Missing categories should be filled from defaults
	assert.Contains(t, loaded.Categories, "gold_usd")
	assert.Contains(t, loaded.Categories, "silver_vnd")
	assert.Contains(t, loaded.Categories, "silver_usd")
}

func TestPriceUnitForMover(t *testing.T) {
	tests := []struct {
		category string
		typeCode string
		expected string
	}{
		{"gold_vnd", "SJL1L10", "lượng"},
		{"gold_vnd", "SJR2", "lượng"},
		{"gold_usd", "XAU", "oz"},
		{"silver_vnd", "GOLDENFUND_1L", "lượng"},
		{"silver_vnd", "ANCARAT_5L", "lượng"},
		{"silver_vnd", "PHUQUY_1KG", "kg"},
		{"silver_vnd", "GOLDENFUND_1KG", "kg"},
		{"silver_usd", "XAGUSD", "oz"},
	}

	for _, tt := range tests {
		t.Run(tt.category+"_"+tt.typeCode, func(t *testing.T) {
			result := priceUnitForMover(tt.category, tt.typeCode)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestFormatPriceForDisplay(t *testing.T) {
	tests := []struct {
		name     string
		price    int64
		category string
		expected string
	}{
		// USD prices stored as cents (×100) — should display as dollars with 2 decimals
		{"gold_usd positive", 300050, "gold_usd", "3,000.50"},
		{"gold_usd round", 300000, "gold_usd", "3,000.00"},
		{"gold_usd small", 2850, "gold_usd", "28.50"},
		{"silver_usd", 2842, "silver_usd", "28.42"},
		{"gold_usd zero", 0, "gold_usd", "0.00"},
		{"gold_usd negative diff", -1075, "gold_usd", "-10.75"},
		// VND prices stored as raw VND — display with thousand separators (no division)
		{"gold_vnd", 85000000, "gold_vnd", "85,000,000"},
		{"gold_vnd large", 8500000000, "gold_vnd", "8,500,000,000"},
		{"silver_vnd", 2737000, "silver_vnd", "2,737,000"},
		{"gold_vnd zero", 0, "gold_vnd", "0"},
		{"gold_vnd negative diff", -1500000, "gold_vnd", "-1,500,000"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatPriceForDisplay(tt.price, tt.category)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestCategoryCurrency(t *testing.T) {
	assert.Equal(t, "VND", categoryCurrency("gold_vnd"))
	assert.Equal(t, "USD", categoryCurrency("gold_usd"))
	assert.Equal(t, "VND", categoryCurrency("silver_vnd"))
	assert.Equal(t, "USD", categoryCurrency("silver_usd"))
	assert.Equal(t, "", categoryCurrency("unknown"))
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

func TestDeletePriceAlertConfig(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	// Save a custom config first
	cfg := PriceAlertConfig{
		CooldownMinutes: 45,
		TopMoversCount:  7,
		Categories: map[string]PriceAlertCategoryConfig{
			"gold_vnd":   {Enabled: false, ThresholdPct: 9.0, TitleTemplate: "Custom", BodyTemplate: "Custom body"},
			"gold_usd":   {Enabled: false, ThresholdPct: 9.0, TitleTemplate: "Custom", BodyTemplate: "Custom body"},
			"silver_vnd": {Enabled: false, ThresholdPct: 9.0, TitleTemplate: "Custom", BodyTemplate: "Custom body"},
			"silver_usd": {Enabled: false, ThresholdPct: 9.0, TitleTemplate: "Custom", BodyTemplate: "Custom body"},
		},
	}
	require.NoError(t, SavePriceAlertConfig(ctx, rdb, cfg))

	// Verify custom config is active
	loaded := LoadPriceAlertConfig(ctx, rdb)
	assert.Equal(t, 45, loaded.CooldownMinutes)

	// Delete config
	err := DeletePriceAlertConfig(ctx, rdb)
	require.NoError(t, err)

	// Load again — should return defaults
	loaded = LoadPriceAlertConfig(ctx, rdb)
	defaults := DefaultPriceAlertConfig()
	assert.Equal(t, defaults.CooldownMinutes, loaded.CooldownMinutes)
	assert.Equal(t, defaults.TopMoversCount, loaded.TopMoversCount)
	assert.True(t, loaded.Categories["gold_vnd"].Enabled)
}

func TestDefaultPriceAlertConfig_HasUserAlertTemplates(t *testing.T) {
	cfg := DefaultPriceAlertConfig()
	assert.NotEmpty(t, cfg.UserAlertTitleTemplate)
	assert.NotEmpty(t, cfg.UserAlertAboveBodyTemplate)
	assert.NotEmpty(t, cfg.UserAlertBelowBodyTemplate)
}

func TestValidatePriceAlertConfig_UserAlertTemplates(t *testing.T) {
	cfg := DefaultPriceAlertConfig()

	// Valid defaults pass
	errs := ValidatePriceAlertConfig(cfg)
	assert.Nil(t, errs)

	// Title too long (>200 chars)
	cfg.UserAlertTitleTemplate = strings.Repeat("a", 201)
	errs = ValidatePriceAlertConfig(cfg)
	assert.NotNil(t, errs)
	assert.Contains(t, errs, "userAlertTitleTemplate")

	// Body too long (>500 chars)
	cfg2 := DefaultPriceAlertConfig()
	cfg2.UserAlertAboveBodyTemplate = strings.Repeat("b", 501)
	errs = ValidatePriceAlertConfig(cfg2)
	assert.NotNil(t, errs)
	assert.Contains(t, errs, "userAlertAboveBodyTemplate")

	// Below body too long
	cfg3 := DefaultPriceAlertConfig()
	cfg3.UserAlertBelowBodyTemplate = strings.Repeat("c", 501)
	errs = ValidatePriceAlertConfig(cfg3)
	assert.NotNil(t, errs)
	assert.Contains(t, errs, "userAlertBelowBodyTemplate")

	// HTML stripped before validation — "<b>x</b>" → "x" (1 char, valid)
	cfg4 := DefaultPriceAlertConfig()
	cfg4.UserAlertTitleTemplate = "<b>test</b>"
	SanitizePriceAlertConfig(&cfg4)
	errs = ValidatePriceAlertConfig(cfg4)
	assert.Nil(t, errs)
	assert.Equal(t, "test", cfg4.UserAlertTitleTemplate)
}

func TestSanitizePriceAlertConfig_UserAlertTemplates(t *testing.T) {
	cfg := DefaultPriceAlertConfig()
	cfg.UserAlertTitleTemplate = "<script>alert('xss')</script>Price: {name}"
	cfg.UserAlertAboveBodyTemplate = "<b>{name}</b> above <i>{price}</i>"
	cfg.UserAlertBelowBodyTemplate = "{name} below {price}"
	SanitizePriceAlertConfig(&cfg)
	assert.Equal(t, "alert('xss')Price: {name}", cfg.UserAlertTitleTemplate)
	assert.Equal(t, "{name} above {price}", cfg.UserAlertAboveBodyTemplate)
	assert.Equal(t, "{name} below {price}", cfg.UserAlertBelowBodyTemplate)
}

func TestLoadPriceAlertConfig_BackwardsCompatible(t *testing.T) {
	// JSON without user alert fields should get defaults
	oldJSON := `{"cooldownMinutes":60,"topMoversCount":3,"categories":{}}`
	var cfg PriceAlertConfig
	json.Unmarshal([]byte(oldJSON), &cfg)
	// Simulate what LoadPriceAlertConfig does post-unmarshal
	defaults := DefaultPriceAlertConfig()
	if cfg.UserAlertTitleTemplate == "" {
		cfg.UserAlertTitleTemplate = defaults.UserAlertTitleTemplate
	}
	if cfg.UserAlertAboveBodyTemplate == "" {
		cfg.UserAlertAboveBodyTemplate = defaults.UserAlertAboveBodyTemplate
	}
	if cfg.UserAlertBelowBodyTemplate == "" {
		cfg.UserAlertBelowBodyTemplate = defaults.UserAlertBelowBodyTemplate
	}
	assert.NotEmpty(t, cfg.UserAlertTitleTemplate)
	assert.NotEmpty(t, cfg.UserAlertAboveBodyTemplate)
	assert.NotEmpty(t, cfg.UserAlertBelowBodyTemplate)
}

func TestFormatUserAlertPrice(t *testing.T) {
	tests := []struct {
		price    int64
		currency string
		expected string
	}{
		{50000, "VND", "50,000 VND"},
		{1234567, "VND", "1,234,567 VND"},
		{5000000, "USD", "50,000.00 USD"},
		{5050, "USD", "50.50 USD"},
		{0, "VND", "0 VND"},
	}
	for _, tt := range tests {
		result := FormatUserAlertPrice(tt.price, tt.currency)
		assert.Equal(t, tt.expected, result, "price=%d currency=%s", tt.price, tt.currency)
	}
}

func TestPriceSideDisplayName(t *testing.T) {
	assert.Equal(t, "mua", priceSideDisplayName("buy"))
	assert.Equal(t, "bán", priceSideDisplayName("sell"))
	assert.Equal(t, "unknown", priceSideDisplayName("unknown"))
}
