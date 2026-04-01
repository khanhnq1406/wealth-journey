package pnj

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// newTestClient creates a Client pointing at a test server URL, bypassing the
// built-in 5-second timeout so tests can control timing themselves.
func newTestClient(url string) *Client {
	return &Client{
		httpClient: &http.Client{},
		url:        url,
	}
}

// TestFetchGoldPrices_ParsesJSON verifies that a well-formed PNJ response is
// parsed into the correct GoldPrice structs.
//
// Price math: "173.500" (nghìn VND, dot separator) → strip dot → 173500 → × 1000 = 173_500_000 VND
// PNJ switched from comma to dot as thousand separator as of 2026-04.
// Field names changed from buy/sell to gia_mua/gia_ban (Vietnamese).
// Top-level array key changed from "regions" to "locations" as of 2026-04.
func TestFetchGoldPrices_ParsesJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"locations": [
				{
					"name": "TPHCM",
					"gold_type": [
						{"name": "999.9", "gia_mua": "173.500", "gia_ban": "175.000"}
					]
				}
			]
		}`))
	}))
	defer srv.Close()

	c := newTestClient(srv.URL)
	prices, err := c.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price, got %d", len(prices))
	}

	p := prices[0]

	// TypeCode must start with PNJ_ and contain only uppercase alphanumeric + underscore
	if !strings.HasPrefix(p.TypeCode, "PNJ_") {
		t.Errorf("TypeCode %q should start with PNJ_", p.TypeCode)
	}
	for _, ch := range p.TypeCode {
		validChar := (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_'
		if !validChar {
			t.Errorf("TypeCode %q contains invalid character %q", p.TypeCode, ch)
		}
	}
	if len(p.TypeCode) > 50 {
		t.Errorf("TypeCode %q exceeds 50 chars (len=%d)", p.TypeCode, len(p.TypeCode))
	}

	// Price: "173.500" (nghìn VND, dot separator) → strip dot → 173500 × 1000 = 173_500_000
	if p.Buy != 173_500_000 {
		t.Errorf("Buy: want 173500000, got %d", p.Buy)
	}
	if p.Sell != 175_000_000 {
		t.Errorf("Sell: want 175000000, got %d", p.Sell)
	}

	if p.Currency != "VND" {
		t.Errorf("Currency: want VND, got %s", p.Currency)
	}
	if p.Name != "999.9" {
		t.Errorf("Name: want '999.9', got %q", p.Name)
	}
	if p.UpdateTime.IsZero() {
		t.Error("UpdateTime should not be zero")
	}
}

// TestFetchGoldPrices_FallbackFirstRegion verifies that when TPHCM is not present
// the first region in the list is used as a fallback.
func TestFetchGoldPrices_FallbackFirstRegion(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"locations": [
				{
					"name": "HAN",
					"gold_type": [
						{"name": "SJC", "gia_mua": "10.000", "gia_ban": "10.500"}
					]
				}
			]
		}`))
	}))
	defer srv.Close()

	c := newTestClient(srv.URL)
	prices, err := c.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price from fallback region, got %d", len(prices))
	}
	if prices[0].Buy != 10_000_000 {
		t.Errorf("Buy from fallback region: want 10000000, got %d", prices[0].Buy)
	}
}

// TestFetchGoldPrices_PrefersTphcmOverOtherRegions verifies that when multiple
// regions exist, TPHCM is selected over others.
func TestFetchGoldPrices_PrefersTphcmOverOtherRegions(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"locations": [
				{
					"name": "HAN",
					"gold_type": [
						{"name": "HAN_GOLD", "gia_mua": "1.000", "gia_ban": "1.050"}
					]
				},
				{
					"name": "TPHCM",
					"gold_type": [
						{"name": "HCM_GOLD", "gia_mua": "2.000", "gia_ban": "2.050"}
					]
				}
			]
		}`))
	}))
	defer srv.Close()

	c := newTestClient(srv.URL)
	prices, err := c.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price from TPHCM region, got %d", len(prices))
	}
	if prices[0].Buy != 2_000_000 {
		t.Errorf("Buy: want 2000000 (TPHCM), got %d", prices[0].Buy)
	}
}

// TestFetchGoldPrices_FiltersZeroPrices verifies that gold types with gia_mua="0" gia_ban="0"
// are filtered out and not returned.
func TestFetchGoldPrices_FiltersZeroPrices(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"locations": [
				{
					"name": "TPHCM",
					"gold_type": [
						{"name": "ZeroGold", "gia_mua": "0", "gia_ban": "0"},
						{"name": "ValidGold", "gia_mua": "10.000", "gia_ban": "10.500"}
					]
				}
			]
		}`))
	}))
	defer srv.Close()

	c := newTestClient(srv.URL)
	prices, err := c.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price after filtering zeros, got %d", len(prices))
	}
	if strings.Contains(prices[0].TypeCode, "ZEROGOLD") {
		t.Errorf("zero-priced entry should have been filtered, got TypeCode %s", prices[0].TypeCode)
	}
}

// TestFetchGoldPrices_DeduplicatesTypeCode verifies that two gold types that produce
// the same sanitized TypeCode are deduplicated (first one wins).
func TestFetchGoldPrices_DeduplicatesTypeCode(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		// Both "999.9" entries will sanitize to the same TypeCode
		_, _ = w.Write([]byte(`{
			"locations": [
				{
					"name": "TPHCM",
					"gold_type": [
						{"name": "999.9", "gia_mua": "10.000", "gia_ban": "10.500"},
						{"name": "999.9", "gia_mua": "11.000", "gia_ban": "11.500"}
					]
				}
			]
		}`))
	}))
	defer srv.Close()

	c := newTestClient(srv.URL)
	prices, err := c.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Errorf("expected 1 deduplicated price, got %d", len(prices))
	}
	if len(prices) == 1 && prices[0].Buy != 10_000_000 {
		t.Errorf("first entry should win on deduplication: want Buy=10000000, got %d", prices[0].Buy)
	}
}

// TestFetchGoldPrices_NonOKStatus verifies that a non-200 HTTP status returns an error.
func TestFetchGoldPrices_NonOKStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`internal server error`))
	}))
	defer srv.Close()

	c := newTestClient(srv.URL)
	_, err := c.FetchGoldPrices(context.Background())
	if err == nil {
		t.Fatal("expected non-nil error for HTTP 500, got nil")
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("error should mention status 500, got: %v", err)
	}
}

// TestFetchGoldPrices_InvalidJSON verifies that malformed JSON returns a parse error.
func TestFetchGoldPrices_InvalidJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{not valid json`))
	}))
	defer srv.Close()

	c := newTestClient(srv.URL)
	_, err := c.FetchGoldPrices(context.Background())
	if err == nil {
		t.Fatal("expected non-nil error for invalid JSON, got nil")
	}
}

// TestFetchGoldPrices_EmptyRegions verifies that a response with no regions returns
// an empty slice (not an error). PNJ may legitimately return no regions during off-hours
// or maintenance windows — returning empty is more resilient than failing the source.
func TestFetchGoldPrices_EmptyRegions(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"locations": []}`))
	}))
	defer srv.Close()

	c := newTestClient(srv.URL)
	prices, err := c.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("expected nil error for empty regions, got: %v", err)
	}
	if len(prices) != 0 {
		t.Errorf("expected empty slice for empty regions, got %d items", len(prices))
	}
}

// TestFetchGoldPrices_NullRegions verifies that a response with null regions field
// returns an empty slice (not an error).
func TestFetchGoldPrices_NullRegions(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	c := newTestClient(srv.URL)
	prices, err := c.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("expected nil error for null regions, got: %v", err)
	}
	if len(prices) != 0 {
		t.Errorf("expected empty slice for null regions, got %d items", len(prices))
	}
}

// TestFetchGoldPrices_ContextCancellation verifies that a cancelled context returns an error.
func TestFetchGoldPrices_ContextCancellation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"locations": []}`))
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	c := newTestClient(srv.URL)
	_, err := c.FetchGoldPrices(ctx)
	if err == nil {
		t.Fatal("expected non-nil error for cancelled context, got nil")
	}
}

// TestFetchGoldPrices_Timeout verifies that a slow server triggers a timeout error
// when the context has a short deadline.
func TestFetchGoldPrices_Timeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Use a select with a channel so the handler returns promptly when
		// the test server closes, avoiding the 5-second httptest.Server.Close() block.
		select {
		case <-r.Context().Done():
			return
		case <-time.After(10 * time.Second):
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"locations": []}`))
		}
	}))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	c := newTestClient(srv.URL)
	_, err := c.FetchGoldPrices(ctx)
	if err == nil {
		t.Fatal("expected non-nil error for timeout, got nil")
	}
}

// TestSelectRegion_WithTphcm verifies TPHCM region is selected when present.
func TestSelectRegion_WithTphcm(t *testing.T) {
	regions := []apiRegion{
		{Name: "HAN", GoldTypes: []apiGoldType{{Name: "HAN_GOLD", Buy: "1.000", Sell: "1.050"}}},
		{Name: "TPHCM", GoldTypes: []apiGoldType{{Name: "HCM_GOLD", Buy: "2.000", Sell: "2.050"}}},
	}
	r := selectRegion(regions)
	if r == nil {
		t.Fatal("expected non-nil region")
	}
	if r.Name != "TPHCM" {
		t.Errorf("expected TPHCM, got %s", r.Name)
	}
}

// TestSelectRegion_FallbackFirst verifies the first region is returned when TPHCM is absent.
func TestSelectRegion_FallbackFirst(t *testing.T) {
	regions := []apiRegion{
		{Name: "HAN", GoldTypes: []apiGoldType{{Name: "HAN_GOLD", Buy: "1.000", Sell: "1.050"}}},
		{Name: "DN", GoldTypes: []apiGoldType{{Name: "DN_GOLD", Buy: "900", Sell: "950"}}},
	}
	r := selectRegion(regions)
	if r == nil {
		t.Fatal("expected non-nil region")
	}
	if r.Name != "HAN" {
		t.Errorf("expected HAN (first), got %s", r.Name)
	}
}

// TestSelectRegion_Empty verifies nil is returned for an empty slice.
func TestSelectRegion_Empty(t *testing.T) {
	r := selectRegion([]apiRegion{})
	if r != nil {
		t.Errorf("expected nil for empty regions, got %+v", r)
	}
}

// TestSelectRegion_CaseInsensitiveTphcm verifies TPHCM matching is case-insensitive.
func TestSelectRegion_CaseInsensitiveTphcm(t *testing.T) {
	regions := []apiRegion{
		{Name: "tphcm", GoldTypes: []apiGoldType{{Name: "GOLD", Buy: "5.000", Sell: "5.500"}}},
	}
	r := selectRegion(regions)
	if r == nil {
		t.Fatal("expected non-nil region for lowercase 'tphcm'")
	}
	if r.Name != "tphcm" {
		t.Errorf("expected tphcm, got %s", r.Name)
	}
}

// TestParsePrice verifies various price string formats are parsed correctly.
// PNJ switched from comma to dot as thousand separator as of 2026-04.
// Both formats must work for backward compatibility.
func TestParsePrice(t *testing.T) {
	tests := []struct {
		input string
		want  int64
	}{
		{"176.700", 176_700_000},  // new PNJ format: dot separator, nghìn VND × 1000
		{"173.700", 173_700_000},  // new PNJ format
		{"173,500", 173_500_000},  // old PNJ format: comma separator (backward compat)
		{"10,000", 10_000_000},
		{"10.000", 10_000_000},    // dot separator equivalent
		{"0", 0},
		{"", 0},
		{"abc", 0},
		{"1000", 1_000_000},       // no separator: still multiplied by 1000
		{" 5.000 ", 5_000_000},    // whitespace trimmed, dot separator
		{"-1", 0},                  // negative → treated as 0
	}

	for _, tc := range tests {
		got := parsePrice(tc.input)
		if got != tc.want {
			t.Errorf("parsePrice(%q) = %d, want %d", tc.input, got, tc.want)
		}
	}
}
