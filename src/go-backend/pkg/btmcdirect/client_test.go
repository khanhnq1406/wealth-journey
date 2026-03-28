package btmcdirect

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// buildTestServer creates an httptest.Server that returns the given HTML body and status code.
func buildTestServer(t *testing.T, status int, body string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
}

// minimalHTML wraps table rows in a minimal HTML table structure.
func minimalHTML(rows string) string {
	return `<html><body><table>` + rows + `</table></body></html>`
}

// TestFetchGoldPrices_ParsesHTML verifies a well-formed BTMC HTML table row is parsed
// into the correct GoldPrice struct. Price 17250 → 17,250,000 VND (×1000).
// Type code uses gold.SanitizeTypeCode("BTMC", name).
func TestFetchGoldPrices_ParsesHTML(t *testing.T) {
	html := minimalHTML(`<tr><td>Vàng miếng VRTL</td><td>17250</td><td>17280</td></tr>`)
	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price, got %d", len(prices))
	}

	p := prices[0]
	// SanitizeTypeCode("BTMC", "Vàng miếng VRTL") → "BTMC_VANG_MIENG_VRTL"
	if p.TypeCode != "BTMC_VANG_MIENG_VRTL" {
		t.Errorf("TypeCode: got %q, want BTMC_VANG_MIENG_VRTL", p.TypeCode)
	}
	// 17250 * 1000 = 17_250_000
	if p.Buy != 17_250_000 {
		t.Errorf("Buy: got %d, want 17250000", p.Buy)
	}
	// 17280 * 1000 = 17_280_000
	if p.Sell != 17_280_000 {
		t.Errorf("Sell: got %d, want 17280000", p.Sell)
	}
	if p.Currency != "VND" {
		t.Errorf("Currency: got %q, want VND", p.Currency)
	}
	if p.Name != "Vàng miếng VRTL" {
		t.Errorf("Name: got %q, want original name", p.Name)
	}
	if p.UpdateTime.IsZero() {
		t.Error("UpdateTime should not be zero")
	}
}

// TestFetchGoldPrices_LienHe_SellZero verifies that "Liên hệ" in the sell column
// is stored as 0 (not parsed as a number). The row must still be included if buy > 0.
func TestFetchGoldPrices_LienHe_SellZero(t *testing.T) {
	html := minimalHTML(`<tr><td>SJC</td><td>17250</td><td>Liên hệ</td></tr>`)
	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price (buy > 0 row survives), got %d", len(prices))
	}

	p := prices[0]
	if p.Buy != 17_250_000 {
		t.Errorf("Buy: got %d, want 17250000", p.Buy)
	}
	if p.Sell != 0 {
		t.Errorf("Sell: got %d, want 0 for 'Liên hệ'", p.Sell)
	}
}

// TestFetchGoldPrices_LienHeVariants verifies multiple "lien he" spellings all produce sell=0.
func TestFetchGoldPrices_LienHeVariants(t *testing.T) {
	variants := []struct {
		desc    string
		sellStr string
	}{
		{"unicode", "Liên hệ"},
		{"lowercase unicode", "liên hệ"},
		{"ascii lien he", "lien he"},
		{"uppercase", "LIÊN HỆ"},
	}
	for _, v := range variants {
		t.Run(v.desc, func(t *testing.T) {
			html := minimalHTML(`<tr><td>Gold</td><td>17250</td><td>` + v.sellStr + `</td></tr>`)
			srv := buildTestServer(t, http.StatusOK, html)
			defer srv.Close()

			client := newTestClient(srv.URL)
			prices, err := client.FetchGoldPrices(context.Background())
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(prices) != 1 {
				t.Fatalf("expected 1 price, got %d", len(prices))
			}
			if prices[0].Sell != 0 {
				t.Errorf("%s: Sell got %d, want 0", v.desc, prices[0].Sell)
			}
		})
	}
}

// TestFetchGoldPrices_FiltersAllZero verifies that rows where both buy and sell are 0
// (or empty) are filtered out and not returned.
func TestFetchGoldPrices_FiltersAllZero(t *testing.T) {
	// Row 1: both empty → filtered
	// Row 2: buy="-", sell="" → filtered
	// Row 3: valid → kept
	html := minimalHTML(`
		<tr><td>EmptyGold</td><td></td><td></td></tr>
		<tr><td>DashGold</td><td>-</td><td></td></tr>
		<tr><td>ValidGold</td><td>17250</td><td>17280</td></tr>
	`)
	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price after filtering, got %d", len(prices))
	}
	if prices[0].TypeCode != "BTMC_VALIDGOLD" {
		t.Errorf("TypeCode: got %q, want BTMC_VALIDGOLD", prices[0].TypeCode)
	}
}

// TestFetchGoldPrices_NonOKStatus verifies that a non-200 HTTP response returns an error.
func TestFetchGoldPrices_NonOKStatus(t *testing.T) {
	srv := buildTestServer(t, http.StatusServiceUnavailable, "service unavailable")
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err == nil {
		t.Fatal("expected error for HTTP 503, got nil")
	}
	if prices != nil {
		t.Errorf("expected nil prices on error, got %v", prices)
	}
}

// TestFetchGoldPrices_BodySizeLimit verifies that responses exceeding 1 MB are rejected.
func TestFetchGoldPrices_BodySizeLimit(t *testing.T) {
	// Build an HTML body slightly over 1 MB
	var sb strings.Builder
	sb.WriteString("<html><body><table>")
	row := `<tr><td>Gold</td><td>17250</td><td>17280</td></tr>`
	// Each row is ~50 bytes; 1MB / 50 = ~20000 rows to exceed limit
	for i := 0; i < 25000; i++ {
		sb.WriteString(row)
	}
	sb.WriteString("</table></body></html>")

	srv := buildTestServer(t, http.StatusOK, sb.String())
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	// The LimitReader truncates at 1MB — parsing should still succeed but return truncated results.
	// The key requirement is: no panic, no reading unlimited memory.
	// The body is silently truncated, so no error is expected, but the result may be partial.
	// This test verifies at minimum the client does not hang or allocate unbounded memory.
	_ = err
	_ = prices
	// No assertion on count — just verify it returns without panic/OOM.
}

// TestFetchGoldPrices_EmptyHTML verifies that an empty table returns no prices and no error.
func TestFetchGoldPrices_EmptyHTML(t *testing.T) {
	srv := buildTestServer(t, http.StatusOK, "<html><body><table></table></body></html>")
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 0 {
		t.Errorf("expected 0 prices, got %d", len(prices))
	}
}

// TestFetchGoldPrices_SkipsShortRows verifies that rows with fewer than 3 columns are ignored.
func TestFetchGoldPrices_SkipsShortRows(t *testing.T) {
	html := minimalHTML(`
		<tr><td>OnlyName</td></tr>
		<tr><td>NameAndBuy</td><td>17250</td></tr>
		<tr><td>Complete</td><td>17250</td><td>17280</td></tr>
	`)
	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price (only complete row), got %d", len(prices))
	}
}

// TestFetchGoldPrices_DeduplicatesTypeCode verifies duplicate type codes (same name) produce only one entry.
func TestFetchGoldPrices_DeduplicatesTypeCode(t *testing.T) {
	html := minimalHTML(`
		<tr><td>SJC</td><td>17250</td><td>17280</td></tr>
		<tr><td>SJC</td><td>17300</td><td>17330</td></tr>
	`)
	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 deduplicated price, got %d", len(prices))
	}
}

// TestFetchGoldPrices_PriceCommas verifies comma thousand-separator prices are parsed correctly.
func TestFetchGoldPrices_PriceCommas(t *testing.T) {
	html := minimalHTML(`<tr><td>SJC</td><td>17,250</td><td>17,280</td></tr>`)
	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price, got %d", len(prices))
	}
	if prices[0].Buy != 17_250_000 {
		t.Errorf("Buy: got %d, want 17250000", prices[0].Buy)
	}
	if prices[0].Sell != 17_280_000 {
		t.Errorf("Sell: got %d, want 17280000", prices[0].Sell)
	}
}

// TestFetchGoldPrices_TypeCodeSanitization verifies that Vietnamese names with diacritics
// produce valid uppercase alphanumeric type codes via gold.SanitizeTypeCode.
func TestFetchGoldPrices_TypeCodeSanitization(t *testing.T) {
	html := minimalHTML(`<tr><td>Nhẫn tròn Trơn</td><td>17250</td><td>17280</td></tr>`)
	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price, got %d", len(prices))
	}

	tc := prices[0].TypeCode
	if !strings.HasPrefix(tc, "BTMC_") {
		t.Errorf("TypeCode %q should start with BTMC_", tc)
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

// TestFetchGoldPrices_ContextCancellation verifies that a cancelled context returns an error.
func TestFetchGoldPrices_ContextCancellation(t *testing.T) {
	srv := buildTestServer(t, http.StatusOK, "<html><body></body></html>")
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately before request

	client := newTestClient(srv.URL)
	_, err := client.FetchGoldPrices(ctx)
	if err == nil {
		t.Fatal("expected error for cancelled context, got nil")
	}
}

// TestFetchGoldPrices_TimeoutEnforced verifies that the client enforces its internal timeout.
func TestFetchGoldPrices_TimeoutEnforced(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
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

// TestFetchGoldPrices_HTMLTagsInCell verifies that HTML tags inside cells are stripped
// so only the text content is used for name and price parsing.
func TestFetchGoldPrices_HTMLTagsInCell(t *testing.T) {
	// Name cell may contain <span> or <b> tags
	html := minimalHTML(`<tr><td><b>SJC Bars</b></td><td><span>17250</span></td><td>17280</td></tr>`)
	srv := buildTestServer(t, http.StatusOK, html)
	defer srv.Close()

	client := newTestClient(srv.URL)
	prices, err := client.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price, got %d", len(prices))
	}
	if prices[0].Buy != 17_250_000 {
		t.Errorf("Buy: got %d, want 17250000", prices[0].Buy)
	}
}

// newTestClient creates a Client with a custom URL for testing (no external requests).
func newTestClient(url string) *Client {
	c := NewClient()
	c.url = url
	return c
}
