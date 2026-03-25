package btmc

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// validXMLResponse mimics the BTMC API XML format.
const validXMLResponse = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <DataList>
    <Data>
      <n_1>SJC 1L, 10L, 1KG</n_1>
      <k_1>999.9</k_1>
      <h_1>99.99</h_1>
      <pb_1>87,050</pb_1>
      <ps_1>89,500</ps_1>
      <pt_1>3100</pt_1>
      <d_1>25/03/2026 10:00</d_1>
    </Data>
    <Data>
      <n_1>SJC 5 Chỉ, 2 Chỉ, 1 Chỉ</n_1>
      <k_1>999.9</k_1>
      <h_1>99.99</h_1>
      <pb_1>87,100</pb_1>
      <ps_1>89,600</ps_1>
      <pt_1>3100</pt_1>
      <d_1>25/03/2026 10:00</d_1>
    </Data>
    <Data>
      <n_1>Nhẫn BTMC 99.9%</n_1>
      <k_1>24K</k_1>
      <h_1>99.9</h_1>
      <pb_1>84,000</pb_1>
      <ps_1>86,500</ps_1>
      <pt_1>3100</pt_1>
      <d_1>25/03/2026 10:00</d_1>
    </Data>
    <Data>
      <n_1>Nữ trang BTMC 75%</n_1>
      <k_1>18K</k_1>
      <h_1>75</h_1>
      <pb_1>65,000</pb_1>
      <ps_1>67,000</ps_1>
      <pt_1>3100</pt_1>
      <d_1>25/03/2026 10:00</d_1>
    </Data>
  </DataList>
</root>`

func TestBTMCClient_ValidXMLResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, validXMLResponse)
	}))
	defer srv.Close()

	client, err := NewClient(5*time.Second, "test-api-key")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.baseURL = srv.URL

	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(prices) != 4 {
		t.Errorf("expected 4 prices, got %d", len(prices))
	}
}

func TestBTMCClient_TypeCodeMapping_SJCBar(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, validXMLResponse)
	}))
	defer srv.Close()

	client, err := NewClient(5*time.Second, "test-api-key")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.baseURL = srv.URL

	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// SJC 1L,10L,1KG → should map to "SJC"
	var sjcPrice *GoldPrice
	for _, p := range prices {
		if p.TypeCode == "SJC" {
			sjcPrice = p
			break
		}
	}
	if sjcPrice == nil {
		t.Fatal("expected SJC type code for SJC 1L/10L bar")
	}
	// 87,050 → strip comma → 87050 → * 1000 = 87050000
	if sjcPrice.Buy != 87050000 {
		t.Errorf("SJC Buy: expected 87050000, got %d", sjcPrice.Buy)
	}
	if sjcPrice.Sell != 89500000 {
		t.Errorf("SJC Sell: expected 89500000, got %d", sjcPrice.Sell)
	}
	if sjcPrice.Currency != "VND" {
		t.Errorf("SJC Currency: expected VND, got %s", sjcPrice.Currency)
	}
}

func TestBTMCClient_TypeCodeMapping_SJC5Chi(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, validXMLResponse)
	}))
	defer srv.Close()

	client, err := NewClient(5*time.Second, "test-api-key")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.baseURL = srv.URL

	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// "SJC 5 Chỉ, 2 Chỉ, 1 Chỉ" → should map to "SJC_5chi"
	var sjc5chi *GoldPrice
	for _, p := range prices {
		if p.TypeCode == "SJC_5chi" {
			sjc5chi = p
			break
		}
	}
	if sjc5chi == nil {
		t.Fatal("expected SJC_5chi type code for SJC small bar")
	}
}

func TestBTMCClient_TypeCodeMapping_BTMCRing(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, validXMLResponse)
	}))
	defer srv.Close()

	client, err := NewClient(5*time.Second, "test-api-key")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.baseURL = srv.URL

	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// "Nhẫn BTMC 99.9%" → should map to "BTMC_ring"
	var ring *GoldPrice
	for _, p := range prices {
		if p.TypeCode == "BTMC_ring" {
			ring = p
			break
		}
	}
	if ring == nil {
		t.Fatal("expected BTMC_ring type code for gold ring")
	}
}

func TestBTMCClient_TypeCodeMapping_BTMCJewelry(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, validXMLResponse)
	}))
	defer srv.Close()

	client, err := NewClient(5*time.Second, "test-api-key")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.baseURL = srv.URL

	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// "Nữ trang BTMC 75%" → should map to "BTMC_jewelry"
	var jewelry *GoldPrice
	for _, p := range prices {
		if p.TypeCode == "BTMC_jewelry" {
			jewelry = p
			break
		}
	}
	if jewelry == nil {
		t.Fatal("expected BTMC_jewelry type code for jewelry")
	}
}

func TestBTMCClient_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = fmt.Fprint(w, "service unavailable")
	}))
	defer srv.Close()

	client, err := NewClient(5*time.Second, "test-api-key")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.baseURL = srv.URL

	_, err = client.FetchGoldPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for HTTP 503, got nil")
	}
}

func TestBTMCClient_InvalidXML(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, `<root><broken`)
	}))
	defer srv.Close()

	client, err := NewClient(5*time.Second, "test-api-key")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.baseURL = srv.URL

	_, err = client.FetchGoldPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for invalid XML, got nil")
	}
}

func TestBTMCClient_ResponseTooLarge(t *testing.T) {
	// Create XML body > 1 MB
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8"?><root><DataList>`)
	row := `<Data><n_1>SJC 1L, 10L, 1KG</n_1><k_1>999.9</k_1><h_1>99.99</h_1><pb_1>87,050</pb_1><ps_1>89,500</ps_1><pt_1>3100</pt_1><d_1>25/03/2026 10:00</d_1></Data>`
	for i := 0; i < 10000; i++ {
		sb.WriteString(row)
	}
	sb.WriteString(`</DataList></root>`)
	largeXML := sb.String()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, largeXML)
	}))
	defer srv.Close()

	client, err := NewClient(5*time.Second, "test-api-key")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.baseURL = srv.URL

	_, err = client.FetchGoldPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for response > 1 MB, got nil")
	}
}

func TestBTMCClient_ZeroPriceFiltered(t *testing.T) {
	xmlWithZero := `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <DataList>
    <Data>
      <n_1>SJC 1L, 10L, 1KG</n_1>
      <k_1>999.9</k_1>
      <h_1>99.99</h_1>
      <pb_1>0</pb_1>
      <ps_1>89,500</ps_1>
      <pt_1>3100</pt_1>
      <d_1>25/03/2026 10:00</d_1>
    </Data>
    <Data>
      <n_1>Nhẫn BTMC 99.9%</n_1>
      <k_1>24K</k_1>
      <h_1>99.9</h_1>
      <pb_1>84,000</pb_1>
      <ps_1>86,500</ps_1>
      <pt_1>3100</pt_1>
      <d_1>25/03/2026 10:00</d_1>
    </Data>
  </DataList>
</root>`

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, xmlWithZero)
	}))
	defer srv.Close()

	client, err := NewClient(5*time.Second, "test-api-key")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.baseURL = srv.URL

	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// SJC has buy=0, should be filtered out; only BTMC ring should remain
	if len(prices) != 1 {
		t.Errorf("expected 1 price (BTMC ring), got %d", len(prices))
	}
	if len(prices) > 0 && prices[0].TypeCode != "BTMC_ring" {
		t.Errorf("expected BTMC_ring, got %s", prices[0].TypeCode)
	}
}

func TestBTMCClient_TypeCodeMapping_BTMC24K(t *testing.T) {
	// BTMC returns "Vàng 24K BTMC" for their pure 24K gold product.
	// This must map to the canonical TypeCode "BTMC_24K" registered in pkg/gold/types.go.
	xml24K := `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <DataList>
    <Data>
      <n_1>Vàng 24K BTMC</n_1>
      <k_1>24K</k_1>
      <h_1>99.99</h_1>
      <pb_1>90,000</pb_1>
      <ps_1>92,000</ps_1>
      <pt_1>3100</pt_1>
      <d_1>25/03/2026 10:00</d_1>
    </Data>
  </DataList>
</root>`

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, xml24K)
	}))
	defer srv.Close()

	client, err := NewClient(5*time.Second, "test-api-key")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.baseURL = srv.URL

	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(prices) != 1 {
		t.Fatalf("expected 1 price, got %d", len(prices))
	}
	if prices[0].TypeCode != "BTMC_24K" {
		t.Errorf("expected TypeCode 'BTMC_24K', got %q", prices[0].TypeCode)
	}
}

func TestBTMCClient_EmptyAPIKey(t *testing.T) {
	_, err := NewClient(5*time.Second, "")
	if err == nil {
		t.Fatal("expected error for empty API key, got nil")
	}
}

func TestBTMCClient_PriceParsingCommaThousandSeparator(t *testing.T) {
	// BTMC returns prices like "87,050" — comma is thousand separator
	xmlWithCommas := `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <DataList>
    <Data>
      <n_1>SJC 1L, 10L, 1KG</n_1>
      <k_1>999.9</k_1>
      <h_1>99.99</h_1>
      <pb_1>1,234,567</pb_1>
      <ps_1>1,345,678</ps_1>
      <pt_1>3100</pt_1>
      <d_1>25/03/2026 10:00</d_1>
    </Data>
  </DataList>
</root>`

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, xmlWithCommas)
	}))
	defer srv.Close()

	client, err := NewClient(5*time.Second, "test-api-key")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.baseURL = srv.URL

	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(prices) != 1 {
		t.Fatalf("expected 1 price, got %d", len(prices))
	}
	// 1234567 * 1000 = 1234567000
	if prices[0].Buy != 1234567000 {
		t.Errorf("Buy: expected 1234567000, got %d", prices[0].Buy)
	}
	if prices[0].Sell != 1345678000 {
		t.Errorf("Sell: expected 1345678000, got %d", prices[0].Sell)
	}
}

func TestBTMCClient_Timeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, validXMLResponse)
	}))
	defer srv.Close()

	client, err := NewClient(5*time.Second, "test-api-key")
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	client.baseURL = srv.URL

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, err = client.FetchGoldPrices(ctx)
	if err == nil {
		t.Fatal("expected context deadline error, got nil")
	}
}
