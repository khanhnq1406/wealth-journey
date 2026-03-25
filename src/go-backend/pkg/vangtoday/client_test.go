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

// validJSONResponse mimics the vang.today API response format (new object format as of 2026-03).
const validJSONResponse = `{
	"success": true,
	"timestamp": 1774400000,
	"prices": {
		"VNGSJC": {"name":"VN Gold SJC","buy":172000000,"sell":175000000,"change_buy":4800000,"change_sell":4800000,"currency":"VND"},
		"DOHNL":  {"name":"DOJI Hanoi","buy":170500000,"sell":172500000,"change_buy":-1500000,"change_sell":-2500000,"currency":"VND"},
		"XAUUSD": {"name":"World Gold (XAU/USD)","buy":4566.7,"sell":4570.0,"change_buy":27.9,"change_sell":28.0,"currency":"USD"},
		"USD":    {"name":"USD","buy":25900,"sell":26200,"change_buy":0,"change_sell":0,"currency":"VND"},
		"EUR":    {"name":"EUR","buy":28000,"sell":28500,"change_buy":0,"change_sell":0,"currency":"VND"}
	}
}`

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

	// Should have gold prices: VNGSJC, DOHNL, XAUUSD
	if len(result.GoldPrices) != 3 {
		t.Errorf("expected 3 gold prices, got %d", len(result.GoldPrices))
	}

	// Should have currency prices: USD, EUR
	if len(result.CurrencyPrices) != 2 {
		t.Errorf("expected 2 currency prices, got %d", len(result.CurrencyPrices))
	}

	// Verify VND gold prices are stored as-is (no multiplication needed)
	var sjc *GoldPrice
	for _, gp := range result.GoldPrices {
		if gp.TypeCode == "VNGSJC" {
			sjc = gp
			break
		}
	}
	if sjc == nil {
		t.Fatal("expected VNGSJC in gold prices")
	}
	// 172000000 stored as-is
	if sjc.Buy != 172000000 {
		t.Errorf("VNGSJC Buy: expected 172000000, got %d", sjc.Buy)
	}
	if sjc.Sell != 175000000 {
		t.Errorf("VNGSJC Sell: expected 175000000, got %d", sjc.Sell)
	}
	if sjc.Currency != "VND" {
		t.Errorf("VNGSJC Currency: expected VND, got %s", sjc.Currency)
	}
	if sjc.ChangeBuy != 4800000 {
		t.Errorf("VNGSJC ChangeBuy: expected 4800000, got %d", sjc.ChangeBuy)
	}
	if sjc.Name != "VN Gold SJC" {
		t.Errorf("VNGSJC Name: expected 'VN Gold SJC', got %s", sjc.Name)
	}

	// Verify USD gold (XAUUSD) prices are converted to cents (×100)
	var xau *GoldPrice
	for _, gp := range result.GoldPrices {
		if gp.TypeCode == "XAUUSD" {
			xau = gp
			break
		}
	}
	if xau == nil {
		t.Fatal("expected XAUUSD in gold prices")
	}
	// 4566.7 * 100 = 456670
	if xau.Buy != 456670 {
		t.Errorf("XAUUSD Buy: expected 456670, got %d", xau.Buy)
	}
	if xau.Currency != "USD" {
		t.Errorf("XAUUSD Currency: expected USD, got %s", xau.Currency)
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
	jsonWithZero := `{
		"success": true,
		"timestamp": 1774400000,
		"prices": {
			"VNGSJC":  {"name":"SJC zero buy","buy":0,"sell":175000000,"change_buy":0,"change_sell":0,"currency":"VND"},
			"DOHNL":   {"name":"DOJI zero sell","buy":170500000,"sell":0,"change_buy":0,"change_sell":0,"currency":"VND"},
			"PQHNVM":  {"name":"PNJ valid","buy":170500000,"sell":173500000,"change_buy":0,"change_sell":0,"currency":"VND"}
		}
	}`

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

	// VNGSJC (buy=0) and DOHNL (sell=0) should be filtered out; only PQHNVM should remain
	if len(result.GoldPrices) != 1 {
		t.Errorf("expected 1 gold price (PQHNVM), got %d", len(result.GoldPrices))
	}
	if len(result.GoldPrices) > 0 && result.GoldPrices[0].TypeCode != "PQHNVM" {
		t.Errorf("expected PQHNVM, got %s", result.GoldPrices[0].TypeCode)
	}
}

func TestVangTodayClient_NegativePriceFiltered(t *testing.T) {
	jsonWithNegative := `{
		"success": true,
		"timestamp": 1774400000,
		"prices": {
			"VNGSJC": {"name":"SJC negative buy","buy":-172000000,"sell":175000000,"change_buy":0,"change_sell":0,"currency":"VND"}
		}
	}`

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
	// Generate a response larger than 1 MB using the new object format.
	// Each entry is ~100 bytes; 11000 entries ≈ 1.1 MB.
	entry := `{"name":"padding","buy":1.0,"sell":1.0,"change_buy":0,"change_sell":0,"currency":"VND"}`
	var sb strings.Builder
	sb.WriteString(`{"success":true,"timestamp":1774400000,"prices":{`)
	for i := 0; i < 11000; i++ {
		if i > 0 {
			sb.WriteByte(',')
		}
		sb.WriteString(`"PAD`)
		fmt.Fprintf(&sb, "%06d", i)
		sb.WriteString(`":`)
		sb.WriteString(entry)
	}
	sb.WriteString(`}}`)
	largeBody := sb.String()

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
