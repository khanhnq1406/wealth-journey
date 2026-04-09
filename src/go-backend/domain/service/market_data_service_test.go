package service

import (
	"context"
	"errors"
	"testing"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/gold"
	"wealthjourney/pkg/silver"
	investmentv1 "wealthjourney/protobuf/v1"

	"github.com/stretchr/testify/assert"
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
