package vangtoday

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// validJSONResponse mimics the expected vang.today API response format.
const validJSONResponse = `[
	{"type_code":"SJC","buy":87.5,"sell":89.5,"change_buy":0.1,"change_sell":0.1,"update_time":"2026-03-25T10:00:00Z"},
	{"type_code":"DOJI","buy":86.0,"sell":88.0,"change_buy":-0.2,"change_sell":-0.2,"update_time":"2026-03-25T10:00:00Z"},
	{"type_code":"XAU","buy":3100.5,"sell":3101.5,"change_buy":2.0,"change_sell":2.0,"update_time":"2026-03-25T10:00:00Z"},
	{"type_code":"USD","buy":25900,"sell":26200,"change_buy":0,"change_sell":0,"update_time":"2026-03-25T10:00:00Z"},
	{"type_code":"EUR","buy":28000,"sell":28500,"change_buy":0,"change_sell":0,"update_time":"2026-03-25T10:00:00Z"}
]`

func TestVangTodayClient_ValidResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, validJSONResponse)
	}))
	defer srv.Close()

	client := NewClient(5 * time.Second)
	client.baseURL = srv.URL

	result, err := client.FetchPrices(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}

	// Should have gold prices: SJC, DOJI, XAU
	if len(result.GoldPrices) != 3 {
		t.Errorf("expected 3 gold prices, got %d", len(result.GoldPrices))
	}

	// Should have currency prices: USD, EUR
	if len(result.CurrencyPrices) != 2 {
		t.Errorf("expected 2 currency prices, got %d", len(result.CurrencyPrices))
	}

	// Verify VND gold prices are multiplied by 1000
	var sjc *GoldPrice
	for _, gp := range result.GoldPrices {
		if gp.TypeCode == "SJC" {
			sjc = gp
			break
		}
	}
	if sjc == nil {
		t.Fatal("expected SJC in gold prices")
	}
	// 87.5 * 1000 = 87500
	if sjc.Buy != 87500 {
		t.Errorf("SJC Buy: expected 87500, got %d", sjc.Buy)
	}
	if sjc.Sell != 89500 {
		t.Errorf("SJC Sell: expected 89500, got %d", sjc.Sell)
	}
	if sjc.Currency != "VND" {
		t.Errorf("SJC Currency: expected VND, got %s", sjc.Currency)
	}
	if sjc.ChangeBuy != 100 {
		t.Errorf("SJC ChangeBuy: expected 100, got %d", sjc.ChangeBuy)
	}

	// Verify USD gold (XAU) prices are multiplied by 100
	var xau *GoldPrice
	for _, gp := range result.GoldPrices {
		if gp.TypeCode == "XAU" {
			xau = gp
			break
		}
	}
	if xau == nil {
		t.Fatal("expected XAU in gold prices")
	}
	// 3100.5 * 100 = 310050
	if xau.Buy != 310050 {
		t.Errorf("XAU Buy: expected 310050, got %d", xau.Buy)
	}
	if xau.Currency != "USD" {
		t.Errorf("XAU Currency: expected USD, got %s", xau.Currency)
	}

	// Verify currency price format
	var usd *CurrencyPrice
	for _, cp := range result.CurrencyPrices {
		if cp.TypeCode == "USD" {
			usd = cp
			break
		}
	}
	if usd == nil {
		t.Fatal("expected USD in currency prices")
	}
	// Currency prices: raw VND (no multiplication)
	if usd.Buy != 25900 {
		t.Errorf("USD Buy: expected 25900, got %d", usd.Buy)
	}
	if usd.Sell != 26200 {
		t.Errorf("USD Sell: expected 26200, got %d", usd.Sell)
	}
	if usd.Currency != "VND" {
		t.Errorf("USD Currency: expected VND, got %s", usd.Currency)
	}
}

func TestVangTodayClient_HTTP500Error(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = fmt.Fprint(w, "internal server error")
	}))
	defer srv.Close()

	client := NewClient(5 * time.Second)
	client.baseURL = srv.URL

	_, err := client.FetchPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for HTTP 500, got nil")
	}
}

func TestVangTodayClient_InvalidJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, `{invalid json}`)
	}))
	defer srv.Close()

	client := NewClient(5 * time.Second)
	client.baseURL = srv.URL

	_, err := client.FetchPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}
}

func TestVangTodayClient_Timeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Block for 200ms to simulate a slow server
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, validJSONResponse)
	}))
	defer srv.Close()

	client := NewClient(5 * time.Second)
	client.baseURL = srv.URL

	// Use a context that expires before the server responds
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, err := client.FetchPrices(ctx)
	if err == nil {
		t.Fatal("expected context deadline error, got nil")
	}
}

func TestVangTodayClient_ZeroPriceFiltered(t *testing.T) {
	jsonWithZero := `[
		{"type_code":"SJC","buy":0,"sell":89.5,"change_buy":0,"change_sell":0,"update_time":"2026-03-25T10:00:00Z"},
		{"type_code":"DOJI","buy":86.0,"sell":0,"change_buy":0,"change_sell":0,"update_time":"2026-03-25T10:00:00Z"},
		{"type_code":"PNJ","buy":85.0,"sell":87.0,"change_buy":0,"change_sell":0,"update_time":"2026-03-25T10:00:00Z"}
	]`

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, jsonWithZero)
	}))
	defer srv.Close()

	client := NewClient(5 * time.Second)
	client.baseURL = srv.URL

	result, err := client.FetchPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// SJC (buy=0) and DOJI (sell=0) should be filtered out; only PNJ should remain
	if len(result.GoldPrices) != 1 {
		t.Errorf("expected 1 gold price (PNJ), got %d", len(result.GoldPrices))
	}
	if len(result.GoldPrices) > 0 && result.GoldPrices[0].TypeCode != "PNJ" {
		t.Errorf("expected PNJ, got %s", result.GoldPrices[0].TypeCode)
	}
}

func TestVangTodayClient_NegativePriceFiltered(t *testing.T) {
	jsonWithNegative := `[
		{"type_code":"SJC","buy":-87.5,"sell":89.5,"change_buy":0,"change_sell":0,"update_time":"2026-03-25T10:00:00Z"}
	]`

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, jsonWithNegative)
	}))
	defer srv.Close()

	client := NewClient(5 * time.Second)
	client.baseURL = srv.URL

	result, err := client.FetchPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.GoldPrices) != 0 {
		t.Errorf("expected 0 gold prices (negative price filtered), got %d", len(result.GoldPrices))
	}
}

func TestVangTodayClient_ResponseTooLarge(t *testing.T) {
	// Generate a response larger than 1 MB
	largeBody := `[{"type_code":"SJC","buy":87.5,"sell":89.5,"change_buy":0,"change_sell":0,"update_time":"2026-03-25T10:00:00Z"},` +
		strings.Repeat(`{"type_code":"PADDING","buy":1.0,"sell":1.0,"change_buy":0,"change_sell":0,"update_time":"2026-03-25T10:00:00Z"},`, 15000) +
		`{"type_code":"END","buy":1.0,"sell":1.0,"change_buy":0,"change_sell":0,"update_time":"2026-03-25T10:00:00Z"}]`

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, largeBody)
	}))
	defer srv.Close()

	client := NewClient(5 * time.Second)
	client.baseURL = srv.URL

	// Large response should be truncated and fail to parse as valid JSON or be rejected
	_, err := client.FetchPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for response > 1 MB, got nil")
	}
}

func TestVangTodayClient_UpdateTimePresent(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, validJSONResponse)
	}))
	defer srv.Close()

	client := NewClient(5 * time.Second)
	client.baseURL = srv.URL

	result, err := client.FetchPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, gp := range result.GoldPrices {
		if gp.UpdateTime.IsZero() {
			t.Errorf("GoldPrice %s has zero UpdateTime", gp.TypeCode)
		}
	}
	for _, cp := range result.CurrencyPrices {
		if cp.UpdateTime.IsZero() {
			t.Errorf("CurrencyPrice %s has zero UpdateTime", cp.TypeCode)
		}
	}
}
