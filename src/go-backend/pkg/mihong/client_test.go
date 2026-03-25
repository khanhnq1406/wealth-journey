package mihong

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestClient_FetchGoldPrices_ValidResponse(t *testing.T) {
	var receivedMarketHeader string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedMarketHeader = r.Header.Get("x-market")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[{"buyingPrice":17150000,"sellingPrice":17500000,"code":"999","dateTime":"25/03/2026 13:23","sellChange":0,"buyChange":0,"buyChangePercent":0,"sellChangePercent":0}]`))
	}))
	defer srv.Close()

	c := &Client{httpClient: &http.Client{}, baseURL: srv.URL}
	ctx := context.Background()
	prices, err := c.FetchGoldPrices(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price, got %d", len(prices))
	}

	p := prices[0]
	if p.TypeCode != "Mihong_999" {
		t.Errorf("TypeCode: want Mihong_999, got %s", p.TypeCode)
	}
	if p.Buy != 171_500_000 {
		t.Errorf("Buy: want 171500000, got %d", p.Buy)
	}
	if p.Sell != 175_000_000 {
		t.Errorf("Sell: want 175000000, got %d", p.Sell)
	}
	if p.Currency != "VND" {
		t.Errorf("Currency: want VND, got %s", p.Currency)
	}

	// Verify x-market header was sent
	if receivedMarketHeader != "mihong" {
		t.Errorf("x-market header: want mihong, got %q", receivedMarketHeader)
	}
}

func TestClient_FetchGoldPrices_HTTP500(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`internal server error`))
	}))
	defer srv.Close()

	c := &Client{httpClient: &http.Client{}, baseURL: srv.URL}
	ctx := context.Background()
	_, err := c.FetchGoldPrices(ctx)
	if err == nil {
		t.Fatal("expected non-nil error for HTTP 500, got nil")
	}
}

func TestClient_FetchGoldPrices_ZeroPriceDropped(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		// 3 items: buyingPrice=0, sellingPrice=0, one valid
		_, _ = w.Write([]byte(`[
			{"buyingPrice":0,"sellingPrice":17500000,"code":"985","dateTime":"25/03/2026 13:23","sellChange":0,"buyChange":0,"buyChangePercent":0,"sellChangePercent":0},
			{"buyingPrice":17150000,"sellingPrice":0,"code":"980","dateTime":"25/03/2026 13:23","sellChange":0,"buyChange":0,"buyChangePercent":0,"sellChangePercent":0},
			{"buyingPrice":17150000,"sellingPrice":17500000,"code":"999","dateTime":"25/03/2026 13:23","sellChange":0,"buyChange":0,"buyChangePercent":0,"sellChangePercent":0}
		]`))
	}))
	defer srv.Close()

	c := &Client{httpClient: &http.Client{}, baseURL: srv.URL}
	ctx := context.Background()
	prices, err := c.FetchGoldPrices(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Errorf("expected exactly 1 valid price, got %d", len(prices))
	}
	if len(prices) == 1 && prices[0].TypeCode != "Mihong_999" {
		t.Errorf("expected Mihong_999, got %s", prices[0].TypeCode)
	}
}

func TestClient_FetchGoldPrices_BodyExceedsLimit(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		// Write more than MaxBodySize (1 MB)
		body := strings.Repeat("x", MaxBodySize+2)
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	c := &Client{httpClient: &http.Client{}, baseURL: srv.URL}
	ctx := context.Background()
	_, err := c.FetchGoldPrices(ctx)
	if err == nil {
		t.Fatal("expected non-nil error for oversized body, got nil")
	}
}

func TestClient_FetchGoldPrices_Timeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simulate a slow server that takes 10 seconds to respond
		time.Sleep(10 * time.Second)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[]`))
	}))
	defer srv.Close()

	c := &Client{httpClient: &http.Client{}, baseURL: srv.URL}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, err := c.FetchGoldPrices(ctx)
	if err == nil {
		t.Fatal("expected non-nil error for timeout, got nil")
	}
}
