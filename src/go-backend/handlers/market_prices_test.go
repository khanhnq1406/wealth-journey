package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"wealthjourney/domain/service"
)

// ---------------------------------------------------------------------------
// mockAssetPriceService
// ---------------------------------------------------------------------------

// mockAssetPriceService is a test double that satisfies service.AssetPriceService.
type mockAssetPriceService struct {
	getAllPricesFunc         func(ctx context.Context) (*service.AllAssetPrices, error)
	refreshAllPricesFunc    func(ctx context.Context) error
	getPricesByAssetTypeFunc func(ctx context.Context, assetType string) ([]*service.AssetPriceDTO, error)
	getMarketTypesFunc      func(ctx context.Context) (*service.MarketTypesDTO, error)
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func newTestMarketPricesHandler(svc service.AssetPriceService) *MarketPricesHandler {
	// nil overrideCache — graceful skip in handler
	return NewMarketPricesHandler(svc, nil)
}

func runMarketPricesRequest(h *MarketPricesHandler) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/investments/market-prices", nil)
	c.Request = req
	h.GetMarketPrices(c)
	return w
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// TestGetMarketPrices_ReturnsPricesFromDB verifies that the handler calls
// AssetPriceService.GetAllPrices and returns the grouped items in the response.
func TestGetMarketPrices_ReturnsPricesFromDB(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	mockSvc := &mockAssetPriceService{
		getAllPricesFunc: func(ctx context.Context) (*service.AllAssetPrices, error) {
			return &service.AllAssetPrices{
				Gold: []*service.AssetPriceDTO{
					{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: 95500000, Sell: 97500000, Currency: "VND", FetchedAt: now},
				},
				Silver: []*service.AssetPriceDTO{
					{TypeCode: "PHU_QUY_THOI_1L", Name: "Phú Quý thỏi 1L", Buy: 1150000, Sell: 1250000, Currency: "VND", FetchedAt: now},
				},
				Currency: []*service.AssetPriceDTO{
					{TypeCode: "USD", Name: "USD Tự Do", Buy: 25800, Sell: 25900, Currency: "VND", FetchedAt: now},
				},
			}, nil
		},
	}

	h := newTestMarketPricesHandler(mockSvc)
	w := runMarketPricesRequest(h)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	gold, ok := body["gold"].([]interface{})
	require.True(t, ok, "gold should be an array")
	assert.Len(t, gold, 1)

	silver, ok := body["silver"].([]interface{})
	require.True(t, ok, "silver should be an array")
	assert.Len(t, silver, 1)

	currency, ok := body["currency"].([]interface{})
	require.True(t, ok, "currency should be an array")
	assert.Len(t, currency, 1)

	assert.NotEmpty(t, body["timestamp"], "timestamp should be present")
}

// TestGetMarketPrices_IsStaleForwarded verifies that the IsStale flag from the
// AssetPriceDTO is propagated to the proto PriceItem in the response.
func TestGetMarketPrices_IsStaleForwarded(t *testing.T) {
	now := time.Now()

	mockSvc := &mockAssetPriceService{
		getAllPricesFunc: func(ctx context.Context) (*service.AllAssetPrices, error) {
			return &service.AllAssetPrices{
				Gold: []*service.AssetPriceDTO{
					{TypeCode: "SJL1L10", Name: "SJC", Buy: 0, Sell: 0, Currency: "VND", IsStale: true, FetchedAt: now},
				},
				Silver:   []*service.AssetPriceDTO{},
				Currency: []*service.AssetPriceDTO{},
			}, nil
		},
	}

	h := newTestMarketPricesHandler(mockSvc)
	w := runMarketPricesRequest(h)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	gold, ok := body["gold"].([]interface{})
	require.True(t, ok)
	require.Len(t, gold, 1)

	firstItem, ok := gold[0].(map[string]interface{})
	require.True(t, ok)
	// isStale: true should be serialized (handler uses json.Marshal for gin.H containing proto structs)
	isStale, exists := firstItem["isStale"]
	assert.True(t, exists, "isStale field should be present when true")
	assert.Equal(t, true, isStale)
}

// TestGetMarketPrices_DoesNotCallLivePriceServices verifies the handler depends
// only on AssetPriceService and not on GoldPriceService/SilverPriceService/CurrencyPriceService.
// This is enforced by the struct definition — the test confirms compilation and wiring.
func TestGetMarketPrices_DoesNotCallLivePriceServices(t *testing.T) {
	called := false
	mockSvc := &mockAssetPriceService{
		getAllPricesFunc: func(ctx context.Context) (*service.AllAssetPrices, error) {
			called = true
			return &service.AllAssetPrices{
				Gold:     []*service.AssetPriceDTO{},
				Silver:   []*service.AssetPriceDTO{},
				Currency: []*service.AssetPriceDTO{},
			}, nil
		},
	}

	h := newTestMarketPricesHandler(mockSvc)

	// Verify struct has no goldSvc/silverSvc/currencySvc fields — confirmed by compilation.
	// The only service dep is assetPriceSvc.
	var _ service.AssetPriceService = h.assetPriceSvc // assert field type

	w := runMarketPricesRequest(h)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, called, "AssetPriceService.GetAllPrices should have been called")
}

// TestGetMarketPrices_ErrorCallsHandleError verifies that when AssetPriceService returns
// an error, the handler responds with a non-200 status (handler.HandleError behavior).
func TestGetMarketPrices_ErrorCallsHandleError(t *testing.T) {
	mockSvc := &mockAssetPriceService{
		getAllPricesFunc: func(ctx context.Context) (*service.AllAssetPrices, error) {
			return nil, errors.New("db connection error")
		},
	}

	h := newTestMarketPricesHandler(mockSvc)
	w := runMarketPricesRequest(h)

	// handler.HandleError maps unknown errors to 500
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// TestConvertToPriceItems verifies the helper function converts DTOs correctly.
func TestConvertToPriceItems(t *testing.T) {
	now := time.Now()
	dtos := []*service.AssetPriceDTO{
		{
			TypeCode:   "SJL1L10",
			Name:       "SJC 1L-10L",
			Buy:        95500000,
			Sell:       97500000,
			ChangeBuy:  500000,
			ChangeSell: 500000,
			Currency:   "VND",
			IsStale:    true,
			FetchedAt:  now,
		},
	}

	items := convertToPriceItems(dtos)

	require.Len(t, items, 1)
	assert.Equal(t, "SJL1L10", items[0].TypeCode)
	assert.Equal(t, int64(95500000), items[0].Buy)
	assert.Equal(t, int64(97500000), items[0].Sell)
	assert.Equal(t, int64(500000), items[0].ChangeBuy)
	assert.Equal(t, int64(500000), items[0].ChangeSell)
	assert.Equal(t, "VND", items[0].Currency)
	assert.Equal(t, now.Unix(), items[0].UpdatedAt)
	assert.Equal(t, "SJC 1L-10L", items[0].Name)
	assert.True(t, items[0].IsStale)
}

// TestConvertToPriceItems_EmptySlice verifies empty input returns empty (not nil) slice.
func TestConvertToPriceItems_EmptySlice(t *testing.T) {
	items := convertToPriceItems([]*service.AssetPriceDTO{})
	assert.NotNil(t, items)
	assert.Len(t, items, 0)
}
