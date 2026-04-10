package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"wealthjourney/domain/service"
)

// Note: mockAssetDisplayConfigService is defined in asset_display_config_test.go
// and is shared across handler tests in this package.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func newTestMarketPricesHandler(svc service.AssetDisplayConfigService) *MarketPricesHandler {
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

// TestGetMarketPrices_ReturnsPricesFromDisplayConfig verifies that the handler calls
// AssetDisplayConfigService.GetDisplayPrices for each asset type and returns grouped items.
func TestGetMarketPrices_ReturnsPricesFromDisplayConfig(t *testing.T) {
	mockSvc := &mockAssetDisplayConfigService{
		getDisplayPricesFunc: func(_ context.Context, assetType string) ([]*service.AssetDisplayPriceDTO, error) {
			switch assetType {
			case "gold":
				return []*service.AssetDisplayPriceDTO{
					{TypeCode: "SJC", DisplayName: "SJC Vàng", Buy: 95500000, Sell: 97500000, IsStale: false},
				}, nil
			case "silver":
				return []*service.AssetDisplayPriceDTO{
					{TypeCode: "PHU_QUY", DisplayName: "Phú Quý thỏi 1L", Buy: 1150000, Sell: 1250000, IsStale: false},
				}, nil
			case "currency":
				return []*service.AssetDisplayPriceDTO{
					{TypeCode: "USD", DisplayName: "USD Tự Do", Buy: 25800, Sell: 25900, IsStale: false},
				}, nil
			}
			return []*service.AssetDisplayPriceDTO{}, nil
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

	firstGold, ok := gold[0].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "SJC", firstGold["typeCode"])
	assert.Equal(t, "SJC Vàng", firstGold["name"])

	silver, ok := body["silver"].([]interface{})
	require.True(t, ok, "silver should be an array")
	assert.Len(t, silver, 1)

	currency, ok := body["currency"].([]interface{})
	require.True(t, ok, "currency should be an array")
	assert.Len(t, currency, 1)

	assert.NotEmpty(t, body["timestamp"], "timestamp should be present")
}

// TestGetMarketPrices_IsStaleForwarded verifies that IsStale: true in DTO propagates
// to isStale: true in the response PriceItem.
func TestGetMarketPrices_IsStaleForwarded(t *testing.T) {
	mockSvc := &mockAssetDisplayConfigService{
		getDisplayPricesFunc: func(_ context.Context, assetType string) ([]*service.AssetDisplayPriceDTO, error) {
			if assetType == "gold" {
				return []*service.AssetDisplayPriceDTO{
					{TypeCode: "SJC", DisplayName: "SJC", Buy: 0, Sell: 0, IsStale: true},
				}, nil
			}
			return []*service.AssetDisplayPriceDTO{}, nil
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
	// isStale: true should be serialized
	isStale, exists := firstItem["isStale"]
	assert.True(t, exists, "isStale field should be present when true")
	assert.Equal(t, true, isStale)
}

// TestGetMarketPrices_ErrorOnGold verifies that when GetDisplayPrices("gold") errors,
// the handler returns HTTP 500.
func TestGetMarketPrices_ErrorOnGold(t *testing.T) {
	mockSvc := &mockAssetDisplayConfigService{
		getDisplayPricesFunc: func(_ context.Context, assetType string) ([]*service.AssetDisplayPriceDTO, error) {
			if assetType == "gold" {
				return nil, errors.New("db connection error")
			}
			return []*service.AssetDisplayPriceDTO{}, nil
		},
	}

	h := newTestMarketPricesHandler(mockSvc)
	w := runMarketPricesRequest(h)

	// handler.HandleError maps unknown errors to 500
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// TestGetMarketPrices_EmptyGoldArray verifies that when gold config returns [],
// the "gold" key in response is an empty array (not null).
func TestGetMarketPrices_EmptyGoldArray(t *testing.T) {
	mockSvc := &mockAssetDisplayConfigService{
		getDisplayPricesFunc: func(_ context.Context, _ string) ([]*service.AssetDisplayPriceDTO, error) {
			return []*service.AssetDisplayPriceDTO{}, nil
		},
	}

	h := newTestMarketPricesHandler(mockSvc)
	w := runMarketPricesRequest(h)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	gold, ok := body["gold"].([]interface{})
	require.True(t, ok, "gold should be an empty array (not null)")
	assert.Len(t, gold, 0)
}

// TestConvertDisplayPricesToPriceItems verifies the new converter function maps DTO fields correctly.
func TestConvertDisplayPricesToPriceItems(t *testing.T) {
	dtos := []*service.AssetDisplayPriceDTO{
		{
			TypeCode:    "SJC",
			DisplayName: "SJC Vàng 1L-10L",
			Buy:         95500000,
			Sell:        97500000,
			IsStale:     true,
		},
	}

	items := convertDisplayPricesToPriceItems(dtos)

	require.Len(t, items, 1)
	assert.Equal(t, "SJC", items[0].TypeCode)
	assert.Equal(t, int64(95500000), items[0].Buy)
	assert.Equal(t, int64(97500000), items[0].Sell)
	assert.Equal(t, "SJC Vàng 1L-10L", items[0].Name)
	assert.True(t, items[0].IsStale)
}

// TestConvertDisplayPricesToPriceItems_EmptySlice verifies empty input returns empty (not nil) slice.
func TestConvertDisplayPricesToPriceItems_EmptySlice(t *testing.T) {
	items := convertDisplayPricesToPriceItems([]*service.AssetDisplayPriceDTO{})
	assert.NotNil(t, items)
	assert.Len(t, items, 0)
}
