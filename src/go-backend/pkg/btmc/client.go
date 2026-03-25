// Package btmc provides an HTTP client for the Bao Tin Minh Chau (BTMC) gold price API.
// It is used as a tertiary fallback source for gold prices when both the primary
// (vangsaigon.vn) and secondary (vang.today) sources are unavailable.
//
// Security notes:
//   - The BTMC API endpoint uses HTTP (not HTTPS). This is a known limitation
//     of this public API; the data is non-sensitive public price information.
//   - Response body limited to 1 MB via io.LimitReader (XML bomb mitigation).
//   - The API key is read from the BTMC_API_KEY environment variable; it must
//     never be hardcoded. The key is an officially published public API key.
//   - Timeout is propagated via context; callers should use a context with deadline.
//   - Prices with zero or negative Buy/Sell values are rejected (T-1 mitigation).
package btmc

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode"
)

const (
	// DefaultBaseURL is the BTMC gold price API endpoint.
	// Note: HTTP (not HTTPS) — this API does not support HTTPS; acceptable for
	// public price data which carries no user-specific sensitive information.
	DefaultBaseURL = "http://api.btmc.vn/api/BTMCAPI/getpricebtmc"

	// MaxBodySize is the maximum allowed response body size (1 MB).
	// This prevents XML bomb / large-response attacks.
	MaxBodySize = 1 * 1024 * 1024
)

// Client is an HTTP client for the BTMC gold price API.
type Client struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
}

// NewClient creates a new BTMC client.
// apiKey must not be empty — it should come from the BTMC_API_KEY environment variable.
func NewClient(timeout time.Duration, apiKey string) (*Client, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("btmc: API key is required (set BTMC_API_KEY environment variable)")
	}
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &Client{
		httpClient: &http.Client{Timeout: timeout},
		baseURL:    DefaultBaseURL,
		apiKey:     apiKey,
	}, nil
}

// FetchGoldPrices fetches gold prices from the BTMC API and returns them as
// normalized GoldPrice entries.
//
// Type codes are mapped to match vangsaigon.vn codes where possible:
//   - SJC bars (1L, 10L, 1KG) → "SJC"
//   - SJC small pieces (5 Chỉ, 2 Chỉ, 1 Chỉ) → "SJC_5chi"
//   - BTMC gold rings → "BTMC_ring"
//   - BTMC jewelry → "BTMC_jewelry"
//   - Other BTMC products → "BTMC_<sanitized_name>"
//
// The caller should pass a context with an appropriate deadline (5 seconds recommended).
// If the response body exceeds 1 MB, an error is returned.
// Entries with zero or negative Buy or Sell are silently dropped.
func (c *Client) FetchGoldPrices(ctx context.Context) ([]*GoldPrice, error) {
	reqURL, err := url.Parse(c.baseURL)
	if err != nil {
		return nil, fmt.Errorf("btmc: parse base URL: %w", err)
	}
	q := reqURL.Query()
	q.Set("key", c.apiKey)
	reqURL.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("btmc: create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("btmc: fetch prices: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("btmc: unexpected status %d: %s", resp.StatusCode, string(body))
	}

	// Limit response to MaxBodySize to prevent unbounded memory usage / XML bombs.
	limitedReader := io.LimitReader(resp.Body, MaxBodySize+1)
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("btmc: read response: %w", err)
	}
	if int64(len(body)) > MaxBodySize {
		return nil, fmt.Errorf("btmc: response body exceeds %d bytes limit", MaxBodySize)
	}

	var btmcResp BTMCResponse
	if err := xml.Unmarshal(body, &btmcResp); err != nil {
		return nil, fmt.Errorf("btmc: parse XML response: %w", err)
	}

	prices := make([]*GoldPrice, 0, len(btmcResp.Rows))

	for _, row := range btmcResp.Rows {
		if row.Name == "" {
			continue
		}

		buy := parseBTMCPrice(row.BuyPrice)
		sell := parseBTMCPrice(row.SellPrice)

		if buy <= 0 || sell <= 0 {
			continue
		}

		updateTime := parseBTMCTimestamp(row.Timestamp)
		typeCode := mapBTMCTypeCode(row.Name)

		prices = append(prices, &GoldPrice{
			TypeCode:   typeCode,
			Name:       row.Name,
			Buy:        buy * 1000,
			Sell:       sell * 1000,
			Currency:   "VND",
			UpdateTime: updateTime,
		})
	}

	return prices, nil
}

// mapBTMCTypeCode maps a BTMC product name to a normalized type code.
// SJC bars use "SJC" to match vangsaigon.vn codes; other types use BTMC-prefixed codes.
func mapBTMCTypeCode(name string) string {
	lower := strings.ToLower(name)

	// SJC bars: 1L, 10L, 1KG — large SJC formats
	if strings.Contains(lower, "sjc") {
		// Small pieces: 5 chỉ, 2 chỉ, 1 chỉ, 0.5L, 5chi, 5 chỉ
		if strings.Contains(lower, "5 ch") || strings.Contains(lower, "2 ch") ||
			strings.Contains(lower, "1 ch") || strings.Contains(lower, "5chi") ||
			strings.Contains(lower, "0.5l") || strings.Contains(lower, "0.5 l") {
			return "SJC_5chi"
		}
		// Large bars: 1L, 10L, 1KG, thỏi, etc.
		return "SJC"
	}

	// Gold rings (nhẫn / nhan)
	if strings.Contains(lower, "nhẫn") || strings.Contains(lower, "nhan") {
		return "BTMC_ring"
	}

	// Jewelry (nữ trang / nu trang / trang sức)
	if strings.Contains(lower, "nữ trang") || strings.Contains(lower, "nu trang") ||
		strings.Contains(lower, "trang sức") || strings.Contains(lower, "trang suc") {
		return "BTMC_jewelry"
	}

	// Fallback: sanitize name to produce a BTMC-prefixed code
	return "BTMC_" + sanitizeName(name)
}

// sanitizeName converts a product name to a lowercase underscore-separated identifier.
// Only ASCII alphanumeric characters are kept; others become underscores.
// Leading/trailing underscores are trimmed.
func sanitizeName(name string) string {
	var sb strings.Builder
	prevUnderscore := true // avoid leading underscores
	for _, r := range name {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			sb.WriteRune(r)
			prevUnderscore = false
		} else if r >= 'A' && r <= 'Z' {
			sb.WriteRune(unicode.ToLower(r))
			prevUnderscore = false
		} else if !prevUnderscore {
			sb.WriteRune('_')
			prevUnderscore = true
		}
	}
	result := strings.TrimRight(sb.String(), "_")
	if result == "" {
		return "unknown"
	}
	return result
}

// parseBTMCPrice parses a BTMC price string such as "87,050" or "1,234,567".
// Commas are thousand separators and are stripped before parsing.
// Returns 0 if the string is empty, a dash placeholder, or cannot be parsed.
func parseBTMCPrice(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" || s == "-" || s == "--" || s == "0" {
		return 0
	}
	// Remove thousand-separator commas
	s = strings.ReplaceAll(s, ",", "")
	// Remove any remaining non-digit characters (spaces, dots used as separators)
	var sb strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			sb.WriteRune(r)
		}
	}
	clean := sb.String()
	if clean == "" {
		return 0
	}
	v, err := strconv.ParseInt(clean, 10, 64)
	if err != nil {
		return 0
	}
	return v
}

// parseBTMCTimestamp parses the BTMC timestamp format "DD/MM/YYYY HH:MM".
// Returns the zero time if parsing fails.
func parseBTMCTimestamp(s string) time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}
	}
	formats := []string{
		"02/01/2006 15:04",
		"02/01/2006 15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
	}
	for _, f := range formats {
		t, err := time.Parse(f, s)
		if err == nil {
			return t
		}
	}
	return time.Time{}
}
