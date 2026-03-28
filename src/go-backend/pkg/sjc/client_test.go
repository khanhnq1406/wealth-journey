package sjc

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// buildTestServer creates an httptest.Server that returns the given JSON body and status code.
func buildTestServer(t *testing.T, status int, body string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
}

// sjcJSON builds a minimal SJC-like JSON payload with the given rows.
func sjcJSON(rows []apiRow) string {
	type wrapper struct {
		DataList struct {
			Data []apiRow `json:"Data"`
		} `json:"DataList"`
	}
	w := wrapper{}
	w.DataList.Data = rows
	b, _ := json.Marshal(w)
	return string(b)
}

func newTestClient(url string) *Client {
	c := NewClient()
	c.url = url
	return c
}

// TestFetchGoldPrices_ParsesJSON verifies that a well-formed SJC response is
// parsed into the correct GoldPrice structs, with type codes carrying the SJC_ prefix.
func TestFetchGoldPrices_ParsesJSON(t *testing.T) {
	rows := []apiRow{
		{
			TypeName:        "Vàng SJC 1L, 10L, 1KG",
			BuyValue:        8250000,
			SellValue:       8350000,
			BuyDifferValue:  50000,
			SellDifferValue: -30000,
		},
	}
	srv := buildTestServer(t, http.StatusOK, sjcJSON(rows))
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 result, got %d", len(prices))
	}

	p := prices[0]

	// Type code must start with SJC_
	if !strings.HasPrefix(p.TypeCode, "SJC_") {
		t.Errorf("TypeCode %q does not start with SJC_", p.TypeCode)
	}

	if p.Buy != 8250000 {
		t.Errorf("Buy: got %d, want 8250000", p.Buy)
	}
	if p.Sell != 8350000 {
		t.Errorf("Sell: got %d, want 8350000", p.Sell)
	}
	if p.ChangeBuy != 50000 {
		t.Errorf("ChangeBuy: got %d, want 50000", p.ChangeBuy)
	}
	if p.ChangeSell != -30000 {
		t.Errorf("ChangeSell: got %d, want -30000", p.ChangeSell)
	}
	if p.Currency != "VND" {
		t.Errorf("Currency: got %q, want VND", p.Currency)
	}
	if p.Name != "Vàng SJC 1L, 10L, 1KG" {
		t.Errorf("Name: got %q, want original TypeName", p.Name)
	}
	if p.UpdateTime.IsZero() {
		t.Error("UpdateTime should not be zero")
	}
}

// TestFetchGoldPrices_NonOKStatus verifies that a non-200 HTTP status returns an error.
func TestFetchGoldPrices_NonOKStatus(t *testing.T) {
	srv := buildTestServer(t, http.StatusInternalServerError, `{"error":"server error"}`)
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for non-200 status, got nil")
	}
	if prices != nil {
		t.Errorf("expected nil prices on error, got %v", prices)
	}
}

// TestFetchGoldPrices_InvalidJSON verifies that malformed JSON returns a parse error.
func TestFetchGoldPrices_InvalidJSON(t *testing.T) {
	srv := buildTestServer(t, http.StatusOK, `{not valid json`)
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for invalid JSON, got nil")
	}
	if prices != nil {
		t.Errorf("expected nil prices on JSON error, got %v", prices)
	}
}

// TestFetchGoldPrices_FiltersZeroPrices verifies rows with buy=0 and sell=0 are filtered out.
func TestFetchGoldPrices_FiltersZeroPrices(t *testing.T) {
	rows := []apiRow{
		{TypeName: "ValidGold", BuyValue: 8000000, SellValue: 8100000},
		{TypeName: "ZeroGold", BuyValue: 0, SellValue: 0},
		{TypeName: "NegativeGold", BuyValue: -100, SellValue: -200},
	}
	srv := buildTestServer(t, http.StatusOK, sjcJSON(rows))
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 result after filtering, got %d", len(prices))
	}
	if prices[0].TypeCode != "SJC_VALIDGOLD" {
		t.Errorf("unexpected TypeCode: %q", prices[0].TypeCode)
	}
}

// TestFetchGoldPrices_DeduplicatesTypeCode verifies that two rows producing the same
// sanitized type code result in only one GoldPrice entry.
func TestFetchGoldPrices_DeduplicatesTypeCode(t *testing.T) {
	// Both names sanitize to the same type code because they differ only in diacritics/spaces
	rows := []apiRow{
		{TypeName: "SJC 1L", BuyValue: 8000000, SellValue: 8100000},
		{TypeName: "SJC 1L", BuyValue: 8200000, SellValue: 8300000}, // duplicate name
	}
	srv := buildTestServer(t, http.StatusOK, sjcJSON(rows))
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 deduplicated result, got %d", len(prices))
	}
}

// TestFetchGoldPrices_EmptyDataList verifies that an empty DataList returns no error and empty slice.
func TestFetchGoldPrices_EmptyDataList(t *testing.T) {
	rows := []apiRow{}
	srv := buildTestServer(t, http.StatusOK, sjcJSON(rows))
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 0 {
		t.Errorf("expected 0 results, got %d", len(prices))
	}
}

// TestFetchGoldPrices_ContextCancellation verifies that a cancelled context returns an error.
func TestFetchGoldPrices_ContextCancellation(t *testing.T) {
	srv := buildTestServer(t, http.StatusOK, sjcJSON([]apiRow{}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	client := newTestClient(srv.URL)
	_, err := client.FetchGoldPrices(ctx)
	if err == nil {
		t.Fatal("expected error for cancelled context, got nil")
	}
}

// TestFetchGoldPrices_TimeoutEnforced verifies that a context deadline causes FetchGoldPrices
// to return an error rather than hanging when the server is slow.
func TestFetchGoldPrices_TimeoutEnforced(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
		case <-time.After(10 * time.Second):
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	client := newTestClient(srv.URL)
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, err := client.FetchGoldPrices(ctx)
	if err == nil {
		t.Fatal("expected timeout error, got nil")
	}
}

// TestFetchGoldPrices_TypeCodeSanitization verifies that Vietnamese names with
// diacritics produce proper uppercase alphanumeric type codes.
func TestFetchGoldPrices_TypeCodeSanitization(t *testing.T) {
	rows := []apiRow{
		{TypeName: "Vàng nhẫn SJC 1-2-5 chỉ, vàng đúc sợi", BuyValue: 7500000, SellValue: 7600000},
	}
	srv := buildTestServer(t, http.StatusOK, sjcJSON(rows))
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 result, got %d", len(prices))
	}

	tc := prices[0].TypeCode
	if !strings.HasPrefix(tc, "SJC_") {
		t.Errorf("TypeCode %q should start with SJC_", tc)
	}
	// Must contain only uppercase letters, digits and underscores
	for _, ch := range tc {
		validChar := (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_'
		if !validChar {
			t.Errorf("TypeCode %q contains invalid character %q", tc, ch)
		}
	}
	if len(tc) > 50 {
		t.Errorf("TypeCode %q exceeds 50 chars (len=%d)", tc, len(tc))
	}
}
