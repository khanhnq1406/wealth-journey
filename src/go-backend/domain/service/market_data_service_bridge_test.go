package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	"wealthjourney/pkg/gold"
	"wealthjourney/pkg/silver"
	investmentv1 "wealthjourney/protobuf/v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Stubs — prefixed "mdb" to avoid collision with other test files.
// ---------------------------------------------------------------------------

// mdbMarketDataRepo is a stub for repository.MarketDataRepository.
type mdbMarketDataRepo struct {
	getBySymbolAndCurrencyFn func(ctx context.Context, symbol, currency string) (*models.MarketData, error)
	createFn                 func(ctx context.Context, data *models.MarketData) error
	updateFn                 func(ctx context.Context, data *models.MarketData) error
	deleteFn                 func(ctx context.Context, id int32) error
	listFn                   func(ctx context.Context, opts repository.ListOptions) ([]*models.MarketData, int, error)
}

func (m *mdbMarketDataRepo) GetBySymbolAndCurrency(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
	if m.getBySymbolAndCurrencyFn != nil {
		return m.getBySymbolAndCurrencyFn(ctx, symbol, currency)
	}
	return nil, errors.New("not found")
}

func (m *mdbMarketDataRepo) Create(ctx context.Context, data *models.MarketData) error {
	if m.createFn != nil {
		return m.createFn(ctx, data)
	}
	return nil
}

func (m *mdbMarketDataRepo) Update(ctx context.Context, data *models.MarketData) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, data)
	}
	return nil
}

func (m *mdbMarketDataRepo) Delete(ctx context.Context, id int32) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return nil
}

func (m *mdbMarketDataRepo) List(ctx context.Context, opts repository.ListOptions) ([]*models.MarketData, int, error) {
	if m.listFn != nil {
		return m.listFn(ctx, opts)
	}
	return nil, 0, nil
}

// mdbAssetDisplayConfigService is a stub for AssetDisplayConfigService.
// Only ResolvePrice is called by marketDataService — other methods panic to catch
// unexpected calls.
type mdbAssetDisplayConfigService struct {
	resolvePriceFn func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error)
}

func (m *mdbAssetDisplayConfigService) ResolvePrice(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
	if m.resolvePriceFn != nil {
		return m.resolvePriceFn(ctx, typeCode, assetType)
	}
	return 0, 0, false, errors.New("not configured")
}

func (m *mdbAssetDisplayConfigService) GetDisplayPrices(ctx context.Context, assetType string) ([]*AssetDisplayPriceDTO, error) {
	panic("mdbAssetDisplayConfigService.GetDisplayPrices not expected")
}
func (m *mdbAssetDisplayConfigService) ListAll(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
	panic("mdbAssetDisplayConfigService.ListAll not expected")
}
func (m *mdbAssetDisplayConfigService) Create(ctx context.Context, typeCode, displayName, assetType string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error) {
	panic("mdbAssetDisplayConfigService.Create not expected")
}
func (m *mdbAssetDisplayConfigService) Update(ctx context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error) {
	panic("mdbAssetDisplayConfigService.Update not expected")
}
func (m *mdbAssetDisplayConfigService) Delete(ctx context.Context, id int32) error {
	panic("mdbAssetDisplayConfigService.Delete not expected")
}
func (m *mdbAssetDisplayConfigService) ListFetchCodes(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
	panic("mdbAssetDisplayConfigService.ListFetchCodes not expected")
}
func (m *mdbAssetDisplayConfigService) CreateFetchCode(ctx context.Context, configID int32, typeCode string, priority int32) (*models.AssetConfigFetchCode, error) {
	panic("mdbAssetDisplayConfigService.CreateFetchCode not expected")
}
func (m *mdbAssetDisplayConfigService) UpdateFetchCode(ctx context.Context, id int32, priority int32) (*models.AssetConfigFetchCode, error) {
	panic("mdbAssetDisplayConfigService.UpdateFetchCode not expected")
}
func (m *mdbAssetDisplayConfigService) DeleteFetchCode(ctx context.Context, id int32) error {
	panic("mdbAssetDisplayConfigService.DeleteFetchCode not expected")
}
func (m *mdbAssetDisplayConfigService) ListAvailableTypeCodes(ctx context.Context, assetType string) ([]string, error) {
	panic("mdbAssetDisplayConfigService.ListAvailableTypeCodes not expected")
}

// mdbGoldPriceService is a stub for GoldPriceService (fallback path).
type mdbGoldPriceService struct {
	fetchPriceForSymbolFn func(ctx context.Context, symbol string) (*CachedGoldPrice, error)
	fetchAllPricesFn      func(ctx context.Context) ([]*CachedGoldPrice, error)
}

func (m *mdbGoldPriceService) FetchPriceForSymbol(ctx context.Context, symbol string) (*CachedGoldPrice, error) {
	if m.fetchPriceForSymbolFn != nil {
		return m.fetchPriceForSymbolFn(ctx, symbol)
	}
	return nil, errors.New("gold price service unavailable")
}

func (m *mdbGoldPriceService) FetchAllPrices(ctx context.Context) ([]*CachedGoldPrice, error) {
	if m.fetchAllPricesFn != nil {
		return m.fetchAllPricesFn(ctx)
	}
	return nil, errors.New("gold price service unavailable")
}

// mdbSilverPriceService is a stub for SilverPriceService (fallback path).
type mdbSilverPriceService struct {
	fetchPriceForSymbolFn func(ctx context.Context, symbol string) (*CachedSilverPrice, error)
	fetchAllPricesFn      func(ctx context.Context) ([]*CachedSilverPrice, error)
}

func (m *mdbSilverPriceService) FetchPriceForSymbol(ctx context.Context, symbol string) (*CachedSilverPrice, error) {
	if m.fetchPriceForSymbolFn != nil {
		return m.fetchPriceForSymbolFn(ctx, symbol)
	}
	return nil, errors.New("silver price service unavailable")
}

func (m *mdbSilverPriceService) FetchAllPrices(ctx context.Context) ([]*CachedSilverPrice, error) {
	if m.fetchAllPricesFn != nil {
		return m.fetchAllPricesFn(ctx)
	}
	return nil, errors.New("silver price service unavailable")
}

// ---------------------------------------------------------------------------
// Helper: build a marketDataService wired with all stubs.
// ---------------------------------------------------------------------------

func newBridgeTestService(
	mdRepo repository.MarketDataRepository,
	goldSvc GoldPriceService,
	silverSvc SilverPriceService,
	adcSvc AssetDisplayConfigService,
) *marketDataService {
	return &marketDataService{
		marketDataRepo:            mdRepo,
		goldPriceService:          goldSvc,
		silverPriceService:        silverSvc,
		assetDisplayConfigService: adcSvc,
		goldConverter:             gold.NewGoldConverter(nil),
		silverConverter:           silver.NewSilverConverter(nil),
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// TestBridgeGoldPriceFromDB verifies that a GOLD_VND investment price is
// fetched from AssetDisplayConfigService.ResolvePrice (not the live gold API).
func TestBridgeGoldPriceFromDB(t *testing.T) {
	ctx := context.Background()

	// VND gold: API returns price per lượng (37.5g) stored as VND × 1000.
	// E.g. 8_500_000 VND/lượng (displayed as 850 in UI because ×1000).
	// ResolvePrice returns the raw DB value — which is already the per-lượng
	// price in VND smallest unit (×1) from the asset_price table.
	// ProcessMarketPrice converts lượng→gram for storage in MarketData.
	pricePerLuong := int64(8_500_000_000) // 8,500,000 VND per lượng in smallest unit (VND × 1000)

	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			assert.Equal(t, "SJC", typeCode)
			assert.Equal(t, "gold", assetType)
			return pricePerLuong, 0, false, nil
		},
	}

	// goldPriceService should NOT be called when ResolvePrice succeeds.
	goldSvc := &mdbGoldPriceService{
		fetchPriceForSymbolFn: func(ctx context.Context, symbol string) (*CachedGoldPrice, error) {
			t.Errorf("goldPriceService.FetchPriceForSymbol called unexpectedly for symbol=%s", symbol)
			return nil, errors.New("should not be called")
		},
	}

	mdRepo := &mdbMarketDataRepo{
		// Cache miss — force the service to fetch from DB.
		getBySymbolAndCurrencyFn: func(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
			return nil, errors.New("cache miss")
		},
	}

	svc := newBridgeTestService(mdRepo, goldSvc, nil, adcSvc)

	priceData, err := svc.GetPrice(ctx, "SJC", "VND", investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND, 15*time.Minute)

	require.NoError(t, err)
	require.NotNil(t, priceData)
	assert.Equal(t, "SJC", priceData.Symbol)
	assert.Equal(t, "VND", priceData.Currency)
	// Price should be normalized (lượng → gram): 8_500_000_000 / 37.5 = 226_666_667
	assert.Greater(t, priceData.Price, int64(0), "normalized price should be positive")
}

// TestBridgeSilverPriceFromDB verifies that a SILVER_VND investment price is
// fetched from AssetDisplayConfigService.ResolvePrice (not the live silver API).
func TestBridgeSilverPriceFromDB(t *testing.T) {
	ctx := context.Background()

	// AG_VND_Tael: price per tael in VND smallest unit.
	pricePerTael := int64(2_000_000_000) // 2,000,000 VND per tael ×1000

	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			assert.Equal(t, "AG_VND_Tael", typeCode)
			assert.Equal(t, "silver", assetType)
			return pricePerTael, 0, false, nil
		},
	}

	// silverPriceService should NOT be called when ResolvePrice succeeds.
	silverSvc := &mdbSilverPriceService{
		fetchPriceForSymbolFn: func(ctx context.Context, symbol string) (*CachedSilverPrice, error) {
			t.Errorf("silverPriceService.FetchPriceForSymbol called unexpectedly for symbol=%s", symbol)
			return nil, errors.New("should not be called")
		},
	}

	mdRepo := &mdbMarketDataRepo{
		getBySymbolAndCurrencyFn: func(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
			return nil, errors.New("cache miss")
		},
	}

	svc := newBridgeTestService(mdRepo, nil, silverSvc, adcSvc)

	priceData, err := svc.GetPrice(ctx, "AG_VND_Tael", "VND", investmentv1.InvestmentType_INVESTMENT_TYPE_SILVER_VND, 15*time.Minute)

	require.NoError(t, err)
	require.NotNil(t, priceData)
	assert.Equal(t, "AG_VND_Tael", priceData.Symbol)
	assert.Equal(t, "VND", priceData.Currency)
	// Price should be normalized (tael → gram by ProcessMarketPrice).
	assert.Greater(t, priceData.Price, int64(0), "normalized price should be positive")
}

// TestBridgeRegularInvestmentStillUsesYahoo verifies that regular investments
// (stocks, crypto, ETFs) are NOT routed through AssetDisplayConfigService.
// They should continue to use the Yahoo Finance path (or direct repo cache).
func TestBridgeRegularInvestmentStillUsesYahoo(t *testing.T) {
	ctx := context.Background()

	// adcSvc.ResolvePrice must NOT be called for a stock investment.
	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			t.Errorf("AssetDisplayConfigService.ResolvePrice called unexpectedly for typeCode=%s", typeCode)
			return 0, 0, false, errors.New("should not be called")
		},
	}

	// Provide a fresh cached entry so the service returns it directly without
	// hitting any external API.  maxAge=15min and cache is 1 min old → fresh.
	cachedPrice := &models.MarketData{
		Symbol:    "AAPL",
		Currency:  "USD",
		Price:     17500, // $175.00 in cents
		Change24h: 1.2,
		Timestamp: time.Now().Add(-1 * time.Minute),
	}

	mdRepo := &mdbMarketDataRepo{
		getBySymbolAndCurrencyFn: func(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
			return cachedPrice, nil
		},
	}

	svc := newBridgeTestService(mdRepo, nil, nil, adcSvc)

	priceData, err := svc.GetPrice(ctx, "AAPL", "USD", investmentv1.InvestmentType_INVESTMENT_TYPE_STOCK, 15*time.Minute)

	require.NoError(t, err)
	require.NotNil(t, priceData)
	assert.Equal(t, "AAPL", priceData.Symbol)
	assert.Equal(t, int64(17500), priceData.Price)
}

// TestBridgeGoldFallbackToLiveAPI verifies that when AssetDisplayConfigService.ResolvePrice
// returns an error (cold start / not configured), the service falls back to
// GoldPriceService.FetchPriceForSymbol.
func TestBridgeGoldFallbackToLiveAPI(t *testing.T) {
	ctx := context.Background()

	// ResolvePrice fails → cold start.
	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			return 0, 0, false, errors.New("cold start: no asset_price rows")
		},
	}

	// Fallback: goldPriceService returns a live price.
	livePrice := int64(8_000_000_000) // 8,000,000 VND per lượng ×1000
	goldSvc := &mdbGoldPriceService{
		fetchPriceForSymbolFn: func(ctx context.Context, symbol string) (*CachedGoldPrice, error) {
			assert.Equal(t, "SJC", symbol)
			return &CachedGoldPrice{
				TypeCode:   "SJC",
				Buy:        livePrice,
				Currency:   "VND",
				UpdateTime: time.Now(),
			}, nil
		},
	}

	mdRepo := &mdbMarketDataRepo{
		getBySymbolAndCurrencyFn: func(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
			return nil, errors.New("cache miss")
		},
	}

	svc := newBridgeTestService(mdRepo, goldSvc, nil, adcSvc)

	priceData, err := svc.GetPrice(ctx, "SJC", "VND", investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND, 15*time.Minute)

	require.NoError(t, err)
	require.NotNil(t, priceData)
	assert.Equal(t, "SJC", priceData.Symbol)
	assert.Greater(t, priceData.Price, int64(0), "fallback price should be positive")
}

// TestBridgeSilverFallbackToLiveAPI verifies that when ResolvePrice fails for a
// silver investment, the service falls back to SilverPriceService.FetchPriceForSymbol.
func TestBridgeSilverFallbackToLiveAPI(t *testing.T) {
	ctx := context.Background()

	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			return 0, 0, false, errors.New("cold start: no asset_price rows")
		},
	}

	// Fallback: silverPriceService returns a live price.
	livePrice := int64(1_800_000_000) // 1,800,000 VND per tael ×1000
	silverSvc := &mdbSilverPriceService{
		fetchPriceForSymbolFn: func(ctx context.Context, symbol string) (*CachedSilverPrice, error) {
			assert.Equal(t, "AG_VND_Tael", symbol)
			return &CachedSilverPrice{
				TypeCode:   "AG_VND_Tael",
				Buy:        livePrice,
				Currency:   "VND",
				UpdateTime: time.Now(),
			}, nil
		},
	}

	mdRepo := &mdbMarketDataRepo{
		getBySymbolAndCurrencyFn: func(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
			return nil, errors.New("cache miss")
		},
	}

	svc := newBridgeTestService(mdRepo, nil, silverSvc, adcSvc)

	priceData, err := svc.GetPrice(ctx, "AG_VND_Tael", "VND", investmentv1.InvestmentType_INVESTMENT_TYPE_SILVER_VND, 15*time.Minute)

	require.NoError(t, err)
	require.NotNil(t, priceData)
	assert.Equal(t, "AG_VND_Tael", priceData.Symbol)
	assert.Greater(t, priceData.Price, int64(0), "fallback price should be positive")
}

// TestBridgeGoldPriceNormalizationApplied verifies that ProcessMarketPrice
// (tael/lượng → gram) is applied after reading from DB.
// For GOLD_VND the DB stores per-lượng price (37.5g). The stored MarketData
// price must be per-gram so that portfolio PNL calculation is correct.
func TestBridgeGoldPriceNormalizationApplied(t *testing.T) {
	ctx := context.Background()

	// 37_500_000 VND per lượng in smallest VND unit (×1)
	// After normalization: 37_500_000 / 37.5 = 1_000_000 VND per gram
	pricePerLuongVND := int64(37_500_000)

	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			return pricePerLuongVND, 0, false, nil
		},
	}

	mdRepo := &mdbMarketDataRepo{
		getBySymbolAndCurrencyFn: func(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
			return nil, errors.New("cache miss")
		},
	}

	svc := newBridgeTestService(mdRepo, nil, nil, adcSvc)

	priceData, err := svc.GetPrice(ctx, "SJC", "VND", investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND, 15*time.Minute)

	require.NoError(t, err)
	require.NotNil(t, priceData)

	// Verify normalization: 37_500_000 / 37.5 = 1_000_000
	assert.Equal(t, int64(1_000_000), priceData.Price, "price should be normalized from per-lượng to per-gram")
}

// TestBridgeCacheHitSkipsResolvePrice verifies that when the MarketData cache
// is fresh, neither ResolvePrice nor the live API is invoked.
func TestBridgeCacheHitSkipsResolvePrice(t *testing.T) {
	ctx := context.Background()

	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			t.Errorf("ResolvePrice called unexpectedly (should be cache hit)")
			return 0, 0, false, errors.New("should not be called")
		},
	}

	goldSvc := &mdbGoldPriceService{
		fetchPriceForSymbolFn: func(ctx context.Context, symbol string) (*CachedGoldPrice, error) {
			t.Errorf("goldPriceService.FetchPriceForSymbol called unexpectedly (should be cache hit)")
			return nil, errors.New("should not be called")
		},
	}

	cachedPrice := &models.MarketData{
		Symbol:    "SJC",
		Currency:  "VND",
		Price:     1_000_000,
		Timestamp: time.Now().Add(-5 * time.Minute), // 5 min old, within 15 min maxAge
	}

	mdRepo := &mdbMarketDataRepo{
		getBySymbolAndCurrencyFn: func(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
			return cachedPrice, nil
		},
	}

	svc := newBridgeTestService(mdRepo, goldSvc, nil, adcSvc)

	priceData, err := svc.GetPrice(ctx, "SJC", "VND", investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND, 15*time.Minute)

	require.NoError(t, err)
	require.NotNil(t, priceData)
	assert.Equal(t, int64(1_000_000), priceData.Price)
}
