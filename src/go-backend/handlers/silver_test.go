package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"wealthjourney/domain/models"
	"wealthjourney/domain/service"
)

// ---------------------------------------------------------------------------
// mockSilverDisplayConfigService — test double for SilverHandler
// ---------------------------------------------------------------------------

// We define a separate mock here so the silver tests are self-contained and
// don't depend on the ordering of mock additions in asset_display_config_test.go.
// This mock only needs the methods that SilverHandler actually calls.
type mockSilverDisplayConfigService struct {
	listForInvestmentFunc func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error)
}

func (m *mockSilverDisplayConfigService) GetDisplayPrices(ctx context.Context, assetType string) ([]*service.AssetDisplayPriceDTO, error) {
	return nil, nil
}

func (m *mockSilverDisplayConfigService) ListAll(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
	return nil, nil
}

func (m *mockSilverDisplayConfigService) Create(ctx context.Context, typeCode, displayName, assetType string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error) {
	return nil, nil
}

func (m *mockSilverDisplayConfigService) Update(ctx context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error) {
	return nil, nil
}

func (m *mockSilverDisplayConfigService) Delete(ctx context.Context, id int32) error {
	return nil
}

func (m *mockSilverDisplayConfigService) ResolvePrice(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
	return 0, 0, false, nil
}

func (m *mockSilverDisplayConfigService) ListFetchCodes(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
	return nil, nil
}

func (m *mockSilverDisplayConfigService) CreateFetchCode(ctx context.Context, configID int32, typeCode string, priority int32) (*models.AssetConfigFetchCode, error) {
	return nil, nil
}

func (m *mockSilverDisplayConfigService) UpdateFetchCode(ctx context.Context, id int32, priority int32) (*models.AssetConfigFetchCode, error) {
	return nil, nil
}

func (m *mockSilverDisplayConfigService) DeleteFetchCode(ctx context.Context, id int32) error {
	return nil
}

func (m *mockSilverDisplayConfigService) ListAvailableTypeCodes(ctx context.Context, assetType string) ([]string, error) {
	return nil, nil
}

func (m *mockSilverDisplayConfigService) GetFetchCodesByAssetType(ctx context.Context, assetType string) (map[string]*models.AssetDisplayConfig, error) {
	return map[string]*models.AssetDisplayConfig{}, nil
}

func (m *mockSilverDisplayConfigService) ListForInvestment(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
	if m.listForInvestmentFunc != nil {
		return m.listForInvestmentFunc(ctx, assetType)
	}
	return []*models.AssetDisplayConfig{}, nil
}

// Compile-time interface check
var _ service.AssetDisplayConfigService = (*mockSilverDisplayConfigService)(nil)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func runGetSilverTypeCodes(h *SilverHandler, currency string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	rawURL := "/api/v1/investments/silver-types"
	if currency != "" {
		rawURL += "?currency=" + url.QueryEscape(currency)
	}
	req, _ := http.NewRequest(http.MethodGet, rawURL, nil)
	c.Request = req
	h.GetSilverTypeCodes(c)
	return w
}

// ---------------------------------------------------------------------------
// Tests — currency=VND reads from DB
// ---------------------------------------------------------------------------

// TestSilverHandler_VND_ReturnsDBConfigs verifies that currency=VND calls
// displayConfigSvc.ListForInvestment("silver") and maps the configs to the
// response shape (code, name, currency, type).
func TestSilverHandler_VND_ReturnsDBConfigs(t *testing.T) {
	called := false
	mockSvc := &mockSilverDisplayConfigService{
		listForInvestmentFunc: func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			called = true
			assert.Equal(t, "silver", assetType, "assetType must be hardcoded to 'silver'")
			return []*models.AssetDisplayConfig{
				{ID: 1, TypeCode: "GOLDENFUND_1L", DisplayName: "Golden Fund 1 Lượng", AssetType: "silver", ShowInInvestment: true, Enabled: true},
				{ID: 2, TypeCode: "PHUQUY_1KG", DisplayName: "Phú Quý 1 Kg", AssetType: "silver", ShowInInvestment: true, Enabled: true},
			}, nil
		},
	}

	h := NewSilverHandler(mockSvc)
	w := runGetSilverTypeCodes(h, "VND")

	assert.True(t, called, "ListForInvestment must be called when currency=VND")
	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	data, ok := body["data"].([]interface{})
	require.True(t, ok, "response must have 'data' array")
	assert.Len(t, data, 2)

	first, ok := data[0].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "GOLDENFUND_1L", first["code"])
	assert.Equal(t, "Golden Fund 1 Lượng", first["name"])
	assert.Equal(t, "VND", first["currency"])
	assert.Equal(t, float64(10), first["type"]) // INVESTMENT_TYPE_SILVER_VND = 10
}

// TestSilverHandler_VND_EmptyDB verifies that an empty DB result returns an empty array.
func TestSilverHandler_VND_EmptyDB(t *testing.T) {
	mockSvc := &mockSilverDisplayConfigService{
		listForInvestmentFunc: func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			return []*models.AssetDisplayConfig{}, nil
		},
	}

	h := NewSilverHandler(mockSvc)
	w := runGetSilverTypeCodes(h, "VND")

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	data, ok := body["data"].([]interface{})
	require.True(t, ok, "response must have 'data' array")
	assert.Len(t, data, 0)
}

// TestSilverHandler_VND_ServiceError verifies DB errors produce a 500 response.
func TestSilverHandler_VND_ServiceError(t *testing.T) {
	mockSvc := &mockSilverDisplayConfigService{
		listForInvestmentFunc: func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			return nil, errors.New("db connection failed")
		},
	}

	h := NewSilverHandler(mockSvc)
	w := runGetSilverTypeCodes(h, "VND")

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ---------------------------------------------------------------------------
// Tests — currency=USD returns hardcoded static types
// ---------------------------------------------------------------------------

// TestSilverHandler_USD_ReturnsStaticTypes verifies that currency=USD returns
// the hardcoded XAGUSD entry from the silver package (not from DB).
func TestSilverHandler_USD_ReturnsStaticTypes(t *testing.T) {
	called := false
	mockSvc := &mockSilverDisplayConfigService{
		listForInvestmentFunc: func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			called = true // Should NOT be called for USD
			return []*models.AssetDisplayConfig{}, nil
		},
	}

	h := NewSilverHandler(mockSvc)
	w := runGetSilverTypeCodes(h, "USD")

	assert.False(t, called, "ListForInvestment must NOT be called when currency=USD")
	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	data, ok := body["data"].([]interface{})
	require.True(t, ok, "response must have 'data' array")
	assert.NotEmpty(t, data, "USD silver types should not be empty")

	// Verify the XAGUSD entry is present
	found := false
	for _, item := range data {
		entry, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if entry["code"] == "XAGUSD" {
			found = true
			assert.Equal(t, "USD", entry["currency"])
		}
	}
	assert.True(t, found, "XAGUSD should be present in USD silver types")
}

// ---------------------------------------------------------------------------
// Tests — no currency param returns merged result
// ---------------------------------------------------------------------------

// TestSilverHandler_NoCurrency_ReturnsMerged verifies that when no currency
// param is provided, the response merges VND from DB and USD from static.
func TestSilverHandler_NoCurrency_ReturnsMerged(t *testing.T) {
	called := false
	mockSvc := &mockSilverDisplayConfigService{
		listForInvestmentFunc: func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			called = true
			assert.Equal(t, "silver", assetType)
			return []*models.AssetDisplayConfig{
				{ID: 1, TypeCode: "ANCARAT_1L", DisplayName: "Ancarat 1 Lượng", AssetType: "silver"},
			}, nil
		},
	}

	h := NewSilverHandler(mockSvc)
	w := runGetSilverTypeCodes(h, "") // no currency param

	assert.True(t, called, "ListForInvestment must be called when no currency param")
	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	data, ok := body["data"].([]interface{})
	require.True(t, ok, "response must have 'data' array")

	// Should have at least 1 VND (from DB) + 1 USD (from static)
	assert.GreaterOrEqual(t, len(data), 2, "merged result should have VND + USD entries")

	// Verify both currencies appear
	hasCurrencyVND := false
	hasCurrencyUSD := false
	for _, item := range data {
		entry, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if entry["currency"] == "VND" {
			hasCurrencyVND = true
		}
		if entry["currency"] == "USD" {
			hasCurrencyUSD = true
		}
	}
	assert.True(t, hasCurrencyVND, "merged result should include VND entries from DB")
	assert.True(t, hasCurrencyUSD, "merged result should include USD entries from static")
}

// TestSilverHandler_NoCurrency_DBError verifies that when no currency param is
// given and the DB call fails, the handler returns 500 instead of a partial result.
func TestSilverHandler_NoCurrency_DBError(t *testing.T) {
	mockSvc := &mockSilverDisplayConfigService{
		listForInvestmentFunc: func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			return nil, errors.New("db error")
		},
	}

	h := NewSilverHandler(mockSvc)
	w := runGetSilverTypeCodes(h, "")

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ---------------------------------------------------------------------------
// Tests — currency param whitelisting (security)
// ---------------------------------------------------------------------------

// TestSilverHandler_InvalidCurrency_ReturnsBadRequest verifies that an unknown
// currency query param returns 400 Bad Request (currency whitelist enforced).
func TestSilverHandler_InvalidCurrency_ReturnsBadRequest(t *testing.T) {
	mockSvc := &mockSilverDisplayConfigService{}

	h := NewSilverHandler(mockSvc)
	w := runGetSilverTypeCodes(h, "GBP") // not in whitelist

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// TestSilverHandler_InvalidCurrency_Injection verifies that a malicious currency
// value is rejected with 400 Bad Request.
func TestSilverHandler_InvalidCurrency_Injection(t *testing.T) {
	mockSvc := &mockSilverDisplayConfigService{}

	h := NewSilverHandler(mockSvc)
	w := runGetSilverTypeCodes(h, "'; DROP TABLE asset_price;--")

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ---------------------------------------------------------------------------
// Tests — VND mapping: type field is INVESTMENT_TYPE_SILVER_VND = 10
// ---------------------------------------------------------------------------

// TestSilverHandler_VND_TypeFieldMapping verifies the 'type' field in the response
// is set to 10 (INVESTMENT_TYPE_SILVER_VND enum value) for all VND entries from DB.
func TestSilverHandler_VND_TypeFieldMapping(t *testing.T) {
	mockSvc := &mockSilverDisplayConfigService{
		listForInvestmentFunc: func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			return []*models.AssetDisplayConfig{
				{ID: 1, TypeCode: "PHUQUY_5L", DisplayName: "Phú Quý 5 Lượng", AssetType: "silver"},
				{ID: 2, TypeCode: "ANCARAT_5L", DisplayName: "Ancarat 5 Lượng", AssetType: "silver"},
			}, nil
		},
	}

	h := NewSilverHandler(mockSvc)
	w := runGetSilverTypeCodes(h, "VND")

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	data, ok := body["data"].([]interface{})
	require.True(t, ok)

	for _, item := range data {
		entry, ok := item.(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, float64(10), entry["type"], "VND silver type must be 10 (INVESTMENT_TYPE_SILVER_VND)")
		assert.Equal(t, "VND", entry["currency"])
	}
}
