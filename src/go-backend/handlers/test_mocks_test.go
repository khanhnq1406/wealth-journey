package handlers

import (
	"context"

	"wealthjourney/domain/service"
)

// ---------------------------------------------------------------------------
// mockAssetPriceService — shared test double for AssetPriceService
// Used by public_test.go and any other tests that need this service mock.
// ---------------------------------------------------------------------------

type mockAssetPriceService struct {
	getAllPricesFunc          func(ctx context.Context) (*service.AllAssetPrices, error)
	refreshAllPricesFunc     func(ctx context.Context) error
	getPricesByAssetTypeFunc func(ctx context.Context, assetType string) ([]*service.AssetPriceDTO, error)
	getMarketTypesFunc       func(ctx context.Context) (*service.MarketTypesDTO, error)
}

func (m *mockAssetPriceService) GetAllPrices(ctx context.Context) (*service.AllAssetPrices, error) {
	if m.getAllPricesFunc != nil {
		return m.getAllPricesFunc(ctx)
	}
	return &service.AllAssetPrices{
		Gold:     make([]*service.AssetPriceDTO, 0),
		Silver:   make([]*service.AssetPriceDTO, 0),
		Currency: make([]*service.AssetPriceDTO, 0),
	}, nil
}

func (m *mockAssetPriceService) RefreshAllPrices(ctx context.Context) error {
	if m.refreshAllPricesFunc != nil {
		return m.refreshAllPricesFunc(ctx)
	}
	return nil
}

func (m *mockAssetPriceService) GetPricesByAssetType(ctx context.Context, assetType string) ([]*service.AssetPriceDTO, error) {
	if m.getPricesByAssetTypeFunc != nil {
		return m.getPricesByAssetTypeFunc(ctx, assetType)
	}
	return nil, nil
}

func (m *mockAssetPriceService) GetMarketTypes(ctx context.Context) (*service.MarketTypesDTO, error) {
	if m.getMarketTypesFunc != nil {
		return m.getMarketTypesFunc(ctx)
	}
	return &service.MarketTypesDTO{}, nil
}

func (m *mockAssetPriceService) GetPriceByTypeCode(_ context.Context, _ string) (*service.AssetPriceDTO, error) {
	return nil, nil
}
