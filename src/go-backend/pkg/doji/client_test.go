package doji

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// buildTestServer returns an httptest.Server that responds with the given status and body.
func buildTestServer(t *testing.T, status int, body string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=UTF-8")
		w.WriteHeader(status)
		_, _ = fmt.Fprint(w, body)
	}))
}

// newTestClient creates a Client pointed at the given URL.
func newTestClient(url string) *Client {
	c := NewClient()
	c.url = url
	return c
}

// TestFetchGoldPrices_ParsesHTML verifies that a well-formed HTML table is parsed
// into the correct GoldPrice structs with DOJI_ prefixed type codes and price
// values multiplied by 1,000,000.
func TestFetchGoldPrices_ParsesHTML(t *testing.T) {
	html := `<html><body>
<table>
  <tr><td>SJC Bán Lẻ</td><td>8250</td><td>8270</td></tr>
  <tr><td>Nhẫn Tròn 9999</td><td>7800</td><td>7850</td></tr>
</table>
</body></html>`

	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	prices, err := newTestClient(srv.URL).FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 2 {
		t.Fatalf("expected 2 prices, got %d", len(prices))
	}

	// Find each by type code
	find := func(tc string) *GoldPrice {
		for _, p := range prices {
			if p.TypeCode == tc {
				return p
			}
		}
		return nil
	}

	sjc := find("DOJI_SJC_BAN_LE")
	if sjc == nil {
		t.Fatalf("expected DOJI_SJC_BAN_LE, not found in results: %v", typeCodeList(prices))
	}
	// 8250 * 1_000_000 = 8_250_000_000
	if sjc.Buy != 8_250_000_000 {
		t.Errorf("SJC Buy: got %d, want 8_250_000_000", sjc.Buy)
	}
	if sjc.Sell != 8_270_000_000 {
		t.Errorf("SJC Sell: got %d, want 8_270_000_000", sjc.Sell)
	}
	if sjc.Currency != "VND" {
		t.Errorf("SJC Currency: got %q, want VND", sjc.Currency)
	}
	if sjc.Name == "" {
		t.Error("SJC Name should not be empty")
	}
	if sjc.UpdateTime.IsZero() {
		t.Error("SJC UpdateTime should not be zero")
	}

	nhan := find("DOJI_NHAN_TRON_9999")
	if nhan == nil {
		t.Fatalf("expected DOJI_NHAN_TRON_9999, not found in results: %v", typeCodeList(prices))
	}
	if nhan.Buy != 7_800_000_000 {
		t.Errorf("Nhan Buy: got %d, want 7_800_000_000", nhan.Buy)
	}
	if nhan.Sell != 7_850_000_000 {
		t.Errorf("Nhan Sell: got %d, want 7_850_000_000", nhan.Sell)
	}
}

// TestFetchGoldPrices_FiltersZeroPrices verifies that rows where both buy and sell
// parse to zero are excluded from results.
func TestFetchGoldPrices_FiltersZeroPrices(t *testing.T) {
	html := `<html><body>
<table>
  <tr><td>Vàng SJC Hợp Lệ</td><td>8000</td><td>8100</td></tr>
  <tr><td>Vàng Rác</td><td>0</td><td>0</td></tr>
  <tr><td>Giá Trống</td><td>-</td><td></td></tr>
</table>
</body></html>`

	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	prices, err := newTestClient(srv.URL).FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price after filtering zeros, got %d: %v", len(prices), typeCodeList(prices))
	}
	if prices[0].TypeCode != "DOJI_VANG_SJC_HOP_LE" {
		t.Errorf("unexpected TypeCode: %q", prices[0].TypeCode)
	}
}

// TestFetchGoldPrices_FiltersNegativePrices verifies that rows where the parsed
// price is negative are excluded.
func TestFetchGoldPrices_FiltersNegativePrices(t *testing.T) {
	html := `<table>
  <tr><td>Vàng Âm</td><td>-500</td><td>-600</td></tr>
</table>`

	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	prices, err := newTestClient(srv.URL).FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 0 {
		t.Fatalf("expected 0 prices (negative filtered), got %d", len(prices))
	}
}

// TestFetchGoldPrices_NonOKStatus verifies that a non-200 HTTP status returns an error.
func TestFetchGoldPrices_NonOKStatus(t *testing.T) {
	srv := buildTestServer(t, http.StatusServiceUnavailable, "service unavailable")
	defer srv.Close()

	_, err := newTestClient(srv.URL).FetchGoldPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for HTTP 503, got nil")
	}
}

// TestFetchGoldPrices_EmptyBody verifies that an empty HTML body returns no
// prices and no error.
func TestFetchGoldPrices_EmptyBody(t *testing.T) {
	srv := buildTestServer(t, http.StatusOK, "")
	defer srv.Close()

	prices, err := newTestClient(srv.URL).FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 0 {
		t.Errorf("expected 0 prices for empty body, got %d", len(prices))
	}
}

// TestFetchGoldPrices_DeduplicatesTypeCode verifies that duplicate rows producing
// the same sanitized type code result in only one GoldPrice entry.
func TestFetchGoldPrices_DeduplicatesTypeCode(t *testing.T) {
	// Two rows with the same name after diacritic removal will collide on TypeCode.
	html := `<table>
  <tr><td>SJC 1L</td><td>8000</td><td>8100</td></tr>
  <tr><td>SJC 1L</td><td>8200</td><td>8300</td></tr>
</table>`

	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	prices, err := newTestClient(srv.URL).FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 deduplicated result, got %d", len(prices))
	}
}

// TestFetchGoldPrices_ContextCancellation verifies that a cancelled context
// causes an error to be returned.
func TestFetchGoldPrices_ContextCancellation(t *testing.T) {
	srv := buildTestServer(t, http.StatusOK, "<table></table>")
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	_, err := newTestClient(srv.URL).FetchGoldPrices(ctx)
	if err == nil {
		t.Fatal("expected error for cancelled context, got nil")
	}
}

// TestFetchGoldPrices_TypeCodeSanitization verifies that Vietnamese names with
// diacritics produce safe uppercase alphanumeric+underscore type codes.
func TestFetchGoldPrices_TypeCodeSanitization(t *testing.T) {
	html := `<table>
  <tr><td><script>alert(1)</script></td><td>8000</td><td>8100</td></tr>
  <tr><td>Vàng Nhẫn SJC 9999</td><td>7500</td><td>7600</td></tr>
</table>`

	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	prices, err := newTestClient(srv.URL).FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, p := range prices {
		if len(p.TypeCode) > 50 {
			t.Errorf("TypeCode %q exceeds 50 chars", p.TypeCode)
		}
		for _, ch := range p.TypeCode {
			validChar := (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_'
			if !validChar {
				t.Errorf("TypeCode %q contains invalid character %q", p.TypeCode, ch)
			}
		}
		if !strings.HasPrefix(p.TypeCode, "DOJI_") {
			t.Errorf("TypeCode %q should start with DOJI_", p.TypeCode)
		}
	}
}

// TestFetchGoldPrices_CommaInPrice verifies that prices with commas (e.g. "8,250")
// are parsed correctly.
func TestFetchGoldPrices_CommaInPrice(t *testing.T) {
	html := `<table>
  <tr><td>SJC Vàng</td><td>8,250</td><td>8,270</td></tr>
</table>`

	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	prices, err := newTestClient(srv.URL).FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price, got %d", len(prices))
	}
	if prices[0].Buy != 8_250_000_000 {
		t.Errorf("Buy with comma: got %d, want 8_250_000_000", prices[0].Buy)
	}
}

// TestParsePrice tests the standalone parsePrice function.
func TestParsePrice(t *testing.T) {
	tests := []struct {
		input string
		want  int64
	}{
		{"8250", 8_250_000_000},
		{"8,250", 8_250_000_000},
		{"0", 0},
		{"", 0},
		{"-", 0},
		{"N/A", 0},
		{"  8250  ", 8_250_000_000},
	}

	for _, tt := range tests {
		got := parsePrice(tt.input)
		if got != tt.want {
			t.Errorf("parsePrice(%q) = %d, want %d", tt.input, got, tt.want)
		}
	}
}

// typeCodeList is a test helper to print type codes for diagnosis.
func typeCodeList(prices []*GoldPrice) []string {
	out := make([]string, len(prices))
	for i, p := range prices {
		out[i] = p.TypeCode
	}
	return out
}
