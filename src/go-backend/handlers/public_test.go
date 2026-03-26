package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
)

// Note: mockAssetPriceService is defined in market_prices_test.go (same package).

// helper: execute a GET request against GetPublicMarketTypes and return status + parsed body.
func callGetPublicMarketTypes(h *PublicHandler) (int, map[string]interface{}) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/v1/public/market-types", h.GetPublicMarketTypes)

	req, _ := http.NewRequest("GET", "/api/v1/public/market-types", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	var body map[string]interface{}
	_ = json.Unmarshal(resp.Body.Bytes(), &body)
	return resp.Code, body
}

// Test 1: Returns 200 with gold/silver/currency type arrays from DB.
func TestPublicHandler_GetPublicMarketTypes_ReturnsTypesFromDB(t *testing.T) {
	svc := &mockAssetPriceService{
		getMarketTypesFunc: func(ctx context.Context) (*service.MarketTypesDTO, error) {
			return &service.MarketTypesDTO{
				Gold: []service.MarketTypeItem{
					{Code: "SJC", Name: "SJC 9999", Currency: "VND"},
					{Code: "XAUUSD", Name: "Gold World (XAU/USD)", Currency: "USD"},
				},
				Silver: []service.MarketTypeItem{
					{Code: "XAGUSD", Name: "Silver World (XAG/USD)", Currency: "USD"},
				},
				Currency: []service.MarketTypeItem{
					{Code: "USD", Name: "USD Tự Do", Currency: "VND"},
				},
				GoldUpdatedAt:     1700000001,
				SilverUpdatedAt:   1700000002,
				CurrencyUpdatedAt: 1700000003,
			}, nil
		},
	}

	h := NewPublicHandler(svc)
	status, body := callGetPublicMarketTypes(h)

	if status != http.StatusOK {
		t.Fatalf("expected 200, got %d", status)
	}

	goldRaw, ok := body["gold"].([]interface{})
	if !ok {
		t.Fatalf("gold field missing or not an array")
	}
	if len(goldRaw) != 2 {
		t.Errorf("expected 2 gold types, got %d", len(goldRaw))
	}

	gold0 := goldRaw[0].(map[string]interface{})
	if gold0["code"] != "SJC" {
		t.Errorf("expected gold[0].code=SJC, got %v", gold0["code"])
	}
	if gold0["name"] != "SJC 9999" {
		t.Errorf("expected gold[0].name='SJC 9999', got %v", gold0["name"])
	}

	silverRaw, ok := body["silver"].([]interface{})
	if !ok {
		t.Fatalf("silver field missing or not an array")
	}
	if len(silverRaw) != 1 {
		t.Errorf("expected 1 silver type, got %d", len(silverRaw))
	}

	currencyRaw, ok := body["currency"].([]interface{})
	if !ok {
		t.Fatalf("currency field missing or not an array")
	}
	if len(currencyRaw) != 1 {
		t.Errorf("expected 1 currency type, got %d", len(currencyRaw))
	}
}

// Test 2: Returns updatedAt timestamps per type.
func TestPublicHandler_GetPublicMarketTypes_ReturnsUpdatedAtTimestamps(t *testing.T) {
	goldTS := int64(1700000001)
	silverTS := int64(1700000002)
	currencyTS := int64(1700000003)

	svc := &mockAssetPriceService{
		getMarketTypesFunc: func(ctx context.Context) (*service.MarketTypesDTO, error) {
			return &service.MarketTypesDTO{
				Gold:              []service.MarketTypeItem{{Code: "SJC", Name: "SJC", Currency: "VND"}},
				Silver:            []service.MarketTypeItem{{Code: "XAGUSD", Name: "XAG", Currency: "USD"}},
				Currency:          []service.MarketTypeItem{{Code: "USD", Name: "USD", Currency: "VND"}},
				GoldUpdatedAt:     goldTS,
				SilverUpdatedAt:   silverTS,
				CurrencyUpdatedAt: currencyTS,
			}, nil
		},
	}

	h := NewPublicHandler(svc)
	status, body := callGetPublicMarketTypes(h)

	if status != http.StatusOK {
		t.Fatalf("expected 200, got %d", status)
	}

	// JSON numbers unmarshal as float64
	if got := body["goldUpdatedAt"].(float64); int64(got) != goldTS {
		t.Errorf("goldUpdatedAt: expected %d, got %v", goldTS, got)
	}
	if got := body["silverUpdatedAt"].(float64); int64(got) != silverTS {
		t.Errorf("silverUpdatedAt: expected %d, got %v", silverTS, got)
	}
	if got := body["currencyUpdatedAt"].(float64); int64(got) != currencyTS {
		t.Errorf("currencyUpdatedAt: expected %d, got %v", currencyTS, got)
	}
	if _, ok := body["timestamp"].(string); !ok {
		t.Errorf("timestamp field missing or not a string")
	}
}

// Test 3: Falls back to static registries if DB returns empty (cold start).
func TestPublicHandler_GetPublicMarketTypes_FallsBackToStaticWhenDBEmpty(t *testing.T) {
	svc := &mockAssetPriceService{
		getMarketTypesFunc: func(ctx context.Context) (*service.MarketTypesDTO, error) {
			// DB is empty — all slices empty (cold start: PriceCacheJob hasn't run yet)
			return &service.MarketTypesDTO{
				Gold:     []service.MarketTypeItem{},
				Silver:   []service.MarketTypeItem{},
				Currency: []service.MarketTypeItem{},
			}, nil
		},
	}

	h := NewPublicHandler(svc)
	status, body := callGetPublicMarketTypes(h)

	if status != http.StatusOK {
		t.Fatalf("expected 200, got %d", status)
	}

	// Static registries are non-empty
	goldRaw, ok := body["gold"].([]interface{})
	if !ok || len(goldRaw) == 0 {
		t.Errorf("expected non-empty gold fallback from static registry")
	}
	silverRaw, ok := body["silver"].([]interface{})
	if !ok || len(silverRaw) == 0 {
		t.Errorf("expected non-empty silver fallback from static registry")
	}
	currencyRaw, ok := body["currency"].([]interface{})
	if !ok || len(currencyRaw) == 0 {
		t.Errorf("expected non-empty currency fallback from static registry")
	}

	// Fallback timestamps should all be 0
	if got := body["goldUpdatedAt"].(float64); got != 0 {
		t.Errorf("expected goldUpdatedAt=0 for fallback, got %v", got)
	}
	if got := body["silverUpdatedAt"].(float64); got != 0 {
		t.Errorf("expected silverUpdatedAt=0 for fallback, got %v", got)
	}
	if got := body["currencyUpdatedAt"].(float64); got != 0 {
		t.Errorf("expected currencyUpdatedAt=0 for fallback, got %v", got)
	}
}

// Test 4: Falls back to static registries if AssetPriceService returns an error.
func TestPublicHandler_GetPublicMarketTypes_FallsBackToStaticOnError(t *testing.T) {
	svc := &mockAssetPriceService{
		getMarketTypesFunc: func(ctx context.Context) (*service.MarketTypesDTO, error) {
			return nil, errors.New("db connection failed")
		},
	}

	h := NewPublicHandler(svc)
	status, body := callGetPublicMarketTypes(h)

	if status != http.StatusOK {
		t.Fatalf("expected 200 even on error (graceful fallback), got %d", status)
	}

	// Should still return non-empty static data
	goldRaw, ok := body["gold"].([]interface{})
	if !ok || len(goldRaw) == 0 {
		t.Errorf("expected non-empty gold fallback on service error")
	}
	silverRaw, ok := body["silver"].([]interface{})
	if !ok || len(silverRaw) == 0 {
		t.Errorf("expected non-empty silver fallback on service error")
	}
	currencyRaw, ok := body["currency"].([]interface{})
	if !ok || len(currencyRaw) == 0 {
		t.Errorf("expected non-empty currency fallback on service error")
	}
}

// Test 5: Does NOT call external APIs — the mock returns in-memory data only.
// GetMarketTypes is called exactly once; no network calls occur in the mock.
func TestPublicHandler_GetPublicMarketTypes_DoesNotCallExternalAPIs(t *testing.T) {
	callCount := 0
	svc := &mockAssetPriceService{
		getMarketTypesFunc: func(ctx context.Context) (*service.MarketTypesDTO, error) {
			callCount++
			return &service.MarketTypesDTO{
				Gold:     []service.MarketTypeItem{{Code: "SJC", Name: "SJC", Currency: "VND"}},
				Silver:   []service.MarketTypeItem{{Code: "XAGUSD", Name: "XAG", Currency: "USD"}},
				Currency: []service.MarketTypeItem{{Code: "USD", Name: "USD", Currency: "VND"}},
			}, nil
		},
	}

	h := NewPublicHandler(svc)
	status, _ := callGetPublicMarketTypes(h)

	if status != http.StatusOK {
		t.Fatalf("expected 200, got %d", status)
	}
	if callCount != 1 {
		t.Errorf("expected GetMarketTypes called exactly once, got %d", callCount)
	}
}
