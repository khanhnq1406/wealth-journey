package vietcombank

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// newClientWithOptions creates a Client with custom baseURL and timeout — used for testing.
func newClientWithOptions(baseURL string, timeout time.Duration) *Client {
	return &Client{
		httpClient: &http.Client{Timeout: timeout},
		baseURL:    baseURL,
	}
}

func TestFetchCurrencyPrices_Success(t *testing.T) {
	body := `[
		{"CurrencyCode":"USD","CurrencyName":"US DOLLAR","Buy":"24,590","Transfer":"24,610","Sell":"24,710"},
		{"CurrencyCode":"EUR","CurrencyName":"EURO","Buy":"26,100","Transfer":"26,200","Sell":"26,400"}
	]`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	client := newClientWithOptions(srv.URL, 5*time.Second)
	prices, err := client.FetchCurrencyPrices(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if len(prices) != 2 {
		t.Fatalf("expected 2 prices, got %d", len(prices))
	}

	usd := prices[0]
	// Transfer field → Buy
	if usd.Buy != 24610 {
		t.Errorf("expected Buy=24610 (from Transfer), got %d", usd.Buy)
	}
	// Sell field → Sell
	if usd.Sell != 24710 {
		t.Errorf("expected Sell=24710, got %d", usd.Sell)
	}
	// TypeCode suffix
	if usd.TypeCode != "USD_VCB" {
		t.Errorf("expected TypeCode=USD_VCB, got %s", usd.TypeCode)
	}
	// Name mapping
	if usd.Name != "USD Vietcombank" {
		t.Errorf("expected Name='USD Vietcombank', got %s", usd.Name)
	}
	// Currency always VND
	if usd.Currency != "VND" {
		t.Errorf("expected Currency=VND, got %s", usd.Currency)
	}
}

func TestFetchCurrencyPrices_TypeCodeSuffix(t *testing.T) {
	body := `[{"CurrencyCode":"USD","CurrencyName":"US DOLLAR","Buy":"24,590","Transfer":"24,610","Sell":"24,710"}]`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	client := newClientWithOptions(srv.URL, 5*time.Second)
	prices, err := client.FetchCurrencyPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) == 0 {
		t.Fatal("expected at least one price entry")
	}
	if prices[0].TypeCode != "USD_VCB" {
		t.Errorf("TypeCode should have _VCB suffix, got %s", prices[0].TypeCode)
	}
}

func TestFetchCurrencyPrices_Non200Status(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	client := newClientWithOptions(srv.URL, 5*time.Second)
	prices, err := client.FetchCurrencyPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for non-200 status, got nil")
	}
	if prices != nil {
		t.Errorf("expected nil prices on error, got %v", prices)
	}
}

func TestFetchCurrencyPrices_MalformedJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{not valid json`))
	}))
	defer srv.Close()

	client := newClientWithOptions(srv.URL, 5*time.Second)
	prices, err := client.FetchCurrencyPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for malformed JSON, got nil")
	}
	if prices != nil {
		t.Errorf("expected nil prices on error, got %v", prices)
	}
}

func TestFetchCurrencyPrices_Timeout(t *testing.T) {
	// Slow server that delays longer than client timeout
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[]`))
	}))
	defer srv.Close()

	// Very short timeout — 10ms should always time out before 200ms sleep
	client := newClientWithOptions(srv.URL, 10*time.Millisecond)
	prices, err := client.FetchCurrencyPrices(context.Background())
	if err == nil {
		t.Fatal("expected timeout error, got nil")
	}
	if prices != nil {
		t.Errorf("expected nil prices on timeout, got %v", prices)
	}
}

func TestFetchCurrencyPrices_FilterZeroPrices(t *testing.T) {
	// Entries where both Buy (Transfer) and Sell are zero or empty should be skipped
	body := `[
		{"CurrencyCode":"USD","CurrencyName":"US DOLLAR","Buy":"24,590","Transfer":"24,610","Sell":"24,710"},
		{"CurrencyCode":"XYZ","CurrencyName":"ZERO CURRENCY","Buy":"0","Transfer":"0","Sell":"0"},
		{"CurrencyCode":"ABC","CurrencyName":"DASH CURRENCY","Buy":"-","Transfer":"-","Sell":"-"}
	]`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	client := newClientWithOptions(srv.URL, 5*time.Second)
	prices, err := client.FetchCurrencyPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Only USD should remain; XYZ and ABC are zero
	if len(prices) != 1 {
		t.Errorf("expected 1 price after filtering zeros, got %d", len(prices))
	}
	if len(prices) > 0 && prices[0].TypeCode != "USD_VCB" {
		t.Errorf("expected USD_VCB to survive filter, got %s", prices[0].TypeCode)
	}
}

func TestFetchCurrencyPrices_ResponseSizeLimit(t *testing.T) {
	// Generate a body larger than 1MB
	largeBody := "[" + strings.Repeat(`{"CurrencyCode":"X","CurrencyName":"X","Buy":"1","Transfer":"1","Sell":"1"},`, 20000) + `{"CurrencyCode":"Y","CurrencyName":"Y","Buy":"1","Transfer":"1","Sell":"1"}]`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(largeBody))
	}))
	defer srv.Close()

	client := newClientWithOptions(srv.URL, 5*time.Second)
	_, err := client.FetchCurrencyPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for response exceeding size limit, got nil")
	}
}

func TestFetchCurrencyPrices_NameMapping(t *testing.T) {
	// "US DOLLAR" in CurrencyName should not affect the lookup — we use CurrencyCode
	body := `[{"CurrencyCode":"USD","CurrencyName":"US DOLLAR","Buy":"24,590","Transfer":"24,610","Sell":"24,710"}]`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	client := newClientWithOptions(srv.URL, 5*time.Second)
	prices, err := client.FetchCurrencyPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) == 0 {
		t.Fatal("expected at least one price")
	}
	// Name should be mapped from our currencyNames map (by CurrencyCode), not from API CurrencyName
	if prices[0].Name != "USD Vietcombank" {
		t.Errorf("expected Name='USD Vietcombank', got '%s'", prices[0].Name)
	}
}

func TestFetchCurrencyPrices_UnknownCurrencyNameFallback(t *testing.T) {
	// Unknown currency code not in our map → fallback "<CODE> Vietcombank"
	body := `[{"CurrencyCode":"XYZ","CurrencyName":"MYSTERY","Buy":"0","Transfer":"1000","Sell":"1100"}]`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	client := newClientWithOptions(srv.URL, 5*time.Second)
	prices, err := client.FetchCurrencyPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) == 0 {
		t.Fatal("expected at least one price (sell > 0)")
	}
	if prices[0].Name != "XYZ Vietcombank" {
		t.Errorf("expected fallback Name='XYZ Vietcombank', got '%s'", prices[0].Name)
	}
}
