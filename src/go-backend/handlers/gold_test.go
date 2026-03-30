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

	"wealthjourney/domain/models"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func newGoldTestRouter(h *GoldHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/v1/investments/gold-types", h.GetGoldTypeCodes)
	return r
}

func doGoldRequest(t *testing.T, r *gin.Engine, currency string) *httptest.ResponseRecorder {
	t.Helper()
	url := "/api/v1/investments/gold-types"
	if currency != "" {
		url += "?currency=" + currency
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// TestGetGoldTypeCodes_VND_ReturnsDBConfigs verifies that currency=VND returns
// configs from AssetDisplayConfigService.ListForInvestment mapped to the correct shape.
func TestGetGoldTypeCodes_VND_ReturnsDBConfigs(t *testing.T) {
	dbConfigs := []*models.AssetDisplayConfig{
		{TypeCode: "SJC", DisplayName: "SJC 9999", AssetType: "gold", Enabled: true, ShowInInvestment: true, DisplayOrder: 1},
		{TypeCode: "DOJI_HN", DisplayName: "DOJI Hà Nội", AssetType: "gold", Enabled: true, ShowInInvestment: true, DisplayOrder: 2},
	}

	mock := &mockAssetDisplayConfigService{
		listForInvestmentFunc: func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			assert.Equal(t, "gold", assetType)
			return dbConfigs, nil
		},
	}

	h := NewGoldHandler(mock)
	w := doGoldRequest(t, newGoldTestRouter(h), "VND")

	assert.Equal(t, http.StatusOK, w.Code)

	var result []goldTypeResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))

	require.Len(t, result, 2)

	assert.Equal(t, "SJC", result[0].Code)
	assert.Equal(t, "SJC 9999", result[0].Name)
	assert.Equal(t, "VND", result[0].Currency)
	assert.Equal(t, "mace", result[0].Unit)
	assert.InDelta(t, 3.75, result[0].UnitWeight, 0.001)
	assert.Equal(t, 8, result[0].Type)

	assert.Equal(t, "DOJI_HN", result[1].Code)
	assert.Equal(t, "DOJI Hà Nội", result[1].Name)
	assert.Equal(t, "VND", result[1].Currency)
}

// TestGetGoldTypeCodes_USD_ReturnsHardcoded verifies that currency=USD returns
// the hardcoded XAUUSD entry from the static registry.
func TestGetGoldTypeCodes_USD_ReturnsHardcoded(t *testing.T) {
	mock := &mockAssetDisplayConfigService{}
	h := NewGoldHandler(mock)
	w := doGoldRequest(t, newGoldTestRouter(h), "USD")

	assert.Equal(t, http.StatusOK, w.Code)

	var result []goldTypeResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))

	// Should include XAUUSD (the only USD gold type)
	require.NotEmpty(t, result)
	var found bool
	for _, item := range result {
		if item.Code == "XAUUSD" {
			found = true
			assert.Equal(t, "USD", item.Currency)
			assert.Equal(t, "oz", item.Unit)
			assert.InDelta(t, 31.1034768, item.UnitWeight, 0.0001)
			assert.Equal(t, 9, item.Type) // INVESTMENT_TYPE_GOLD_USD
		}
	}
	assert.True(t, found, "expected XAUUSD in USD response")
}

// TestGetGoldTypeCodes_NoCurrency_ReturnsMerged verifies that no currency param
// returns VND from DB merged with USD from static registry.
func TestGetGoldTypeCodes_NoCurrency_ReturnsMerged(t *testing.T) {
	dbConfigs := []*models.AssetDisplayConfig{
		{TypeCode: "SJC", DisplayName: "SJC 9999", AssetType: "gold", Enabled: true, ShowInInvestment: true},
	}

	mock := &mockAssetDisplayConfigService{
		listForInvestmentFunc: func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			return dbConfigs, nil
		},
	}

	h := NewGoldHandler(mock)
	w := doGoldRequest(t, newGoldTestRouter(h), "")

	assert.Equal(t, http.StatusOK, w.Code)

	var result []goldTypeResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))

	// Must have at least VND + USD entries
	require.GreaterOrEqual(t, len(result), 2)

	var hasVND, hasUSD bool
	for _, item := range result {
		if item.Currency == "VND" {
			hasVND = true
		}
		if item.Currency == "USD" {
			hasUSD = true
		}
	}
	assert.True(t, hasVND, "expected VND entries in merged response")
	assert.True(t, hasUSD, "expected USD entries in merged response")
}

// TestGetGoldTypeCodes_UnknownCurrency_Returns400 verifies that an unknown
// currency value is rejected with 400 Bad Request.
func TestGetGoldTypeCodes_UnknownCurrency_Returns400(t *testing.T) {
	mock := &mockAssetDisplayConfigService{}
	h := NewGoldHandler(mock)
	w := doGoldRequest(t, newGoldTestRouter(h), "EUR")

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// TestGetGoldTypeCodes_ServiceError_Returns500 verifies that a service error
// on VND path results in 500 Internal Server Error.
func TestGetGoldTypeCodes_ServiceError_Returns500(t *testing.T) {
	mock := &mockAssetDisplayConfigService{
		listForInvestmentFunc: func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			return nil, errors.New("database unavailable")
		},
	}

	h := NewGoldHandler(mock)
	w := doGoldRequest(t, newGoldTestRouter(h), "VND")

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}
