package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/gold"
	"wealthjourney/pkg/silver"
	investmentv1 "wealthjourney/protobuf/v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestUpdatePricesForInvestments_ForeignCurrency tests that FOREIGN_CURRENCY investments
// are grouped by symbol and resolved via AssetDisplayConfigService.ResolvePrice.
func TestUpdatePricesForInvestments_ForeignCurrency(t *testing.T) {
	ctx := context.Background()

	// Track calls to ResolvePrice to verify batching
	resolveCalls := map[string]int{}

	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			assert.Equal(t, "currency", assetType, "assetType must be 'currency' for FOREIGN_CURRENCY investments")
			resolveCalls[typeCode]++
			switch typeCode {
			case "USD":
				return int64(25500000), int64(25600000), false, nil
			case "EUR":
				return int64(27800000), int64(27900000), false, nil
			default:
				return 0, 0, false, errors.New("unknown symbol")
			}
		},
	}

	svc := &marketDataService{
		marketDataRepo:            &mdbMarketDataRepo{},
		assetDisplayConfigService: adcSvc,
		goldConverter:             gold.NewGoldConverter(nil),
		silverConverter:           silver.NewSilverConverter(nil),
	}

	investments := []*models.Investment{
		{ID: 1, Symbol: "USD", Type: int32(investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY), Currency: "VND"},
		{ID: 2, Symbol: "USD", Type: int32(investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY), Currency: "VND"},
		{ID: 3, Symbol: "EUR", Type: int32(investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY), Currency: "VND"},
	}

	updates, err := svc.UpdatePricesForInvestments(ctx, investments, false)

	assert.NoError(t, err)
	assert.Equal(t, int64(25500000), updates[1], "USD investment 1 should get buy price")
	assert.Equal(t, int64(25500000), updates[2], "USD investment 2 should get same price (batched)")
	assert.Equal(t, int64(27800000), updates[3], "EUR investment 3 should get EUR buy price")

	// Verify ResolvePrice was called once per unique symbol (not once per investment)
	assert.Equal(t, 1, resolveCalls["USD"], "ResolvePrice should be called exactly once for USD")
	assert.Equal(t, 1, resolveCalls["EUR"], "ResolvePrice should be called exactly once for EUR")
}

// TestUpdatePricesForInvestments_ForeignCurrency_ResolveError tests graceful skip on error.
// When ResolvePrice fails for a symbol, affected investments are skipped (not added to updates map)
// and the outer function returns no error.
func TestUpdatePricesForInvestments_ForeignCurrency_ResolveError(t *testing.T) {
	ctx := context.Background()

	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			assert.Equal(t, "XYZ", typeCode)
			assert.Equal(t, "currency", assetType)
			return 0, 0, false, errors.New("not configured")
		},
	}

	svc := &marketDataService{
		marketDataRepo:            &mdbMarketDataRepo{},
		assetDisplayConfigService: adcSvc,
		goldConverter:             gold.NewGoldConverter(nil),
		silverConverter:           silver.NewSilverConverter(nil),
	}

	investments := []*models.Investment{
		{ID: 1, Symbol: "XYZ", Type: int32(investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY), Currency: "VND"},
	}

	updates, err := svc.UpdatePricesForInvestments(ctx, investments, false)

	assert.NoError(t, err, "outer function must not fail when ResolvePrice errors")
	assert.Empty(t, updates, "XYZ investment should be skipped when price resolution fails")
}

// TestUpdatePricesForInvestments_ForeignCurrency_StalePrice tests that stale prices
// are still used (with a warning log) rather than skipping the investment.
func TestUpdatePricesForInvestments_ForeignCurrency_StalePrice(t *testing.T) {
	ctx := context.Background()

	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			// isStale=true: price is old but still usable
			return int64(25000000), int64(25100000), true, nil
		},
	}

	svc := &marketDataService{
		marketDataRepo:            &mdbMarketDataRepo{},
		assetDisplayConfigService: adcSvc,
		goldConverter:             gold.NewGoldConverter(nil),
		silverConverter:           silver.NewSilverConverter(nil),
	}

	investments := []*models.Investment{
		{ID: 5, Symbol: "JPY", Type: int32(investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY), Currency: "VND"},
	}

	updates, err := svc.UpdatePricesForInvestments(ctx, investments, false)

	assert.NoError(t, err)
	assert.Equal(t, int64(25000000), updates[5], "stale buy price should still be used")
}

// ---------------------------------------------------------------------------
// GetPrice — FOREIGN_CURRENCY routing tests (Task 1)
// ---------------------------------------------------------------------------

// TestGetPrice_ForeignCurrency_UsesResolvePrice verifies that GetPrice routes
// FOREIGN_CURRENCY investments to AssetDisplayConfigService.ResolvePrice with
// assetType="currency" and returns the buy price.
func TestGetPrice_ForeignCurrency_UsesResolvePrice(t *testing.T) {
	ctx := context.Background()

	const expectedBuy = int64(25_500_000) // 25,500 VND per 1 USD unit (×1000)

	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			assert.Equal(t, "USD_VCB", typeCode, "symbol must be passed as typeCode")
			assert.Equal(t, "currency", assetType, "assetType must be 'currency'")
			return expectedBuy, int64(25_600_000), false, nil
		},
	}

	mdRepo := &mdbMarketDataRepo{
		// Cache miss — force service to fetch fresh price.
		getBySymbolAndCurrencyFn: func(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
			return nil, errors.New("cache miss")
		},
	}

	svc := newBridgeTestService(mdRepo, nil, nil, adcSvc)

	priceData, err := svc.GetPrice(ctx, "USD_VCB", "VND", investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY, 15*time.Minute)

	require.NoError(t, err)
	require.NotNil(t, priceData)
	assert.Equal(t, "USD_VCB", priceData.Symbol)
	assert.Equal(t, "VND", priceData.Currency)
	assert.Equal(t, expectedBuy, priceData.Price, "GetPrice should return the buy price from ResolvePrice")
	assert.Equal(t, float64(0), priceData.Change24h, "Change24h should be 0 for currency prices")
	assert.Equal(t, int64(0), priceData.Volume24h, "Volume24h should be 0 for currency prices")
}

// TestGetPrice_ForeignCurrency_StalePrice_ReturnedWithWarning verifies that when
// ResolvePrice returns isStale=true, GetPrice still returns the price (not an error).
func TestGetPrice_ForeignCurrency_StalePrice_ReturnedWithWarning(t *testing.T) {
	ctx := context.Background()

	const stalePrice = int64(25_000_000)

	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			// isStale=true: price data is old but still available
			return stalePrice, int64(25_100_000), true, nil
		},
	}

	mdRepo := &mdbMarketDataRepo{
		getBySymbolAndCurrencyFn: func(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
			return nil, errors.New("cache miss")
		},
	}

	svc := newBridgeTestService(mdRepo, nil, nil, adcSvc)

	priceData, err := svc.GetPrice(ctx, "EUR_VCB", "VND", investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY, 15*time.Minute)

	// Stale price must still be returned — not an error
	require.NoError(t, err, "stale price should not result in an error")
	require.NotNil(t, priceData)
	assert.Equal(t, stalePrice, priceData.Price, "stale buy price should still be returned")
}

// TestGetPrice_ForeignCurrency_UnknownSymbol_ReturnsError verifies that when
// ResolvePrice returns an error (unknown symbol / not configured), GetPrice
// propagates the error.
func TestGetPrice_ForeignCurrency_UnknownSymbol_ReturnsError(t *testing.T) {
	ctx := context.Background()

	adcSvc := &mdbAssetDisplayConfigService{
		resolvePriceFn: func(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
			return 0, 0, false, errors.New("symbol not configured")
		},
	}

	mdRepo := &mdbMarketDataRepo{
		// Cache miss — no fallback available
		getBySymbolAndCurrencyFn: func(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
			return nil, errors.New("cache miss")
		},
	}

	svc := newBridgeTestService(mdRepo, nil, nil, adcSvc)

	priceData, err := svc.GetPrice(ctx, "UNKNOWN_VCB", "VND", investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY, 15*time.Minute)

	assert.Error(t, err, "unknown symbol should result in an error")
	assert.Nil(t, priceData, "no price data should be returned on error")
}
