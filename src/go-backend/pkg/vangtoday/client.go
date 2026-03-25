// Package vangtoday provides an HTTP client for the vang.today price API.
// It is used as a secondary fallback source for gold and currency prices
// when the primary vangsaigon.vn API is unavailable.
//
// Security notes:
//   - HTTPS enforced via DefaultBaseURL; Go's default TLS verification applies.
//   - Response body limited to 1 MB via io.LimitReader to mitigate large-response attacks.
//   - Prices with zero or negative Buy/Sell values are rejected (T-1 mitigation).
//   - Timeout propagated through context; callers should pass a context with deadline.
package vangtoday

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	// DefaultBaseURL is the vang.today public price API endpoint (HTTPS).
	DefaultBaseURL = "https://www.vang.today/api/prices"

	// MaxBodySize is the maximum allowed response body size (1 MB).
	MaxBodySize = 1 * 1024 * 1024
)

// goldTypePrefixes are known Vietnamese and world gold brand prefixes.
// Any type_code that starts with one of these is classified as gold.
var goldTypePrefixes = []string{
	"SJC", "DOJI", "PNJ", "BTMC", "BAOTINMINH", "XAU",
	"NHAN", "VSG", "AAA", "AGJ",
}

// knownCurrencyCodes are ISO 4217 currency codes returned by vang.today.
var knownCurrencyCodes = map[string]string{
	"USD": "USD",
	"EUR": "EUR",
	"GBP": "GBP",
	"JPY": "JPY",
	"CNY": "CNY",
	"SGD": "SGD",
	"KRW": "KRW",
	"THB": "THB",
	"CHF": "CHF",
	"AUD": "AUD",
	"CAD": "CAD",
	"HKD": "HKD",
	"TWD": "TWD",
	"MYR": "MYR",
	"NZD": "NZD",
}

// Client is an HTTP client for the vang.today price API.
type Client struct {
	httpClient *http.Client
	baseURL    string
}

// NewClient creates a new vang.today client with the given request timeout.
// A timeout of 5 seconds is recommended for use in a waterfall fallback chain.
func NewClient(timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &Client{
		httpClient: &http.Client{Timeout: timeout},
		baseURL:    DefaultBaseURL,
	}
}

// FetchPrices fetches all prices from the vang.today API and classifies them
// into gold prices and currency prices.
//
// The caller is responsible for passing a context with an appropriate deadline.
// If the response body exceeds 1 MB, an error is returned.
// Entries with zero or negative Buy or Sell are silently dropped.
func (c *Client) FetchPrices(ctx context.Context) (*PricesResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL, nil)
	if err != nil {
		return nil, fmt.Errorf("vangtoday: create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("vangtoday: fetch prices: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("vangtoday: unexpected status %d: %s", resp.StatusCode, string(body))
	}

	// Limit response to MaxBodySize to prevent unbounded memory usage.
	limitedReader := io.LimitReader(resp.Body, MaxBodySize+1)
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("vangtoday: read response: %w", err)
	}
	if int64(len(body)) > MaxBodySize {
		return nil, fmt.Errorf("vangtoday: response body exceeds %d bytes limit", MaxBodySize)
	}

	var apiPrices []APIPrice
	if err := json.Unmarshal(body, &apiPrices); err != nil {
		return nil, fmt.Errorf("vangtoday: parse response: %w", err)
	}

	result := &PricesResponse{
		GoldPrices:     make([]*GoldPrice, 0),
		CurrencyPrices: make([]*CurrencyPrice, 0),
	}

	for _, ap := range apiPrices {
		if ap.TypeCode == "" {
			continue
		}

		updateTime := parseUpdateTime(ap.UpdateTime)

		typeCodeUpper := strings.ToUpper(ap.TypeCode)

		switch classifyTypeCode(typeCodeUpper) {
		case "gold":
			if ap.Buy <= 0 || ap.Sell <= 0 {
				continue
			}
			gp := convertGoldPrice(ap, typeCodeUpper, updateTime)
			result.GoldPrices = append(result.GoldPrices, gp)

		case "currency":
			if ap.Buy <= 0 || ap.Sell <= 0 {
				continue
			}
			cp := &CurrencyPrice{
				TypeCode:   typeCodeUpper,
				Name:       typeCodeUpper,
				Buy:        int64(ap.Buy),
				Sell:       int64(ap.Sell),
				Currency:   "VND",
				UpdateTime: updateTime,
			}
			result.CurrencyPrices = append(result.CurrencyPrices, cp)
		}
	}

	return result, nil
}

// classifyTypeCode returns "gold", "currency", or "" (unknown/skip).
func classifyTypeCode(code string) string {
	for _, prefix := range goldTypePrefixes {
		if strings.HasPrefix(code, prefix) {
			return "gold"
		}
	}
	if _, ok := knownCurrencyCodes[code]; ok {
		return "currency"
	}
	return ""
}

// convertGoldPrice normalises an APIPrice entry into a GoldPrice.
// VND gold (all except XAU): multiply by 1000 to reach smallest VND unit.
// USD gold (XAU):            multiply by 100 to reach cents.
func convertGoldPrice(ap APIPrice, typeCode string, updateTime time.Time) *GoldPrice {
	var buy, sell, changeBuy, changeSell int64
	var currency string

	if typeCode == "XAU" {
		// World gold priced in USD per ounce — convert to cents.
		buy = int64(ap.Buy * 100)
		sell = int64(ap.Sell * 100)
		changeBuy = int64(ap.ChangeBuy * 100)
		changeSell = int64(ap.ChangeSell * 100)
		currency = "USD"
	} else {
		// Vietnamese gold priced in VND per tael — multiply by 1000.
		buy = int64(ap.Buy * 1000)
		sell = int64(ap.Sell * 1000)
		changeBuy = int64(ap.ChangeBuy * 1000)
		changeSell = int64(ap.ChangeSell * 1000)
		currency = "VND"
	}

	return &GoldPrice{
		TypeCode:   typeCode,
		Name:       typeCode,
		Buy:        buy,
		Sell:       sell,
		ChangeBuy:  changeBuy,
		ChangeSell: changeSell,
		Currency:   currency,
		UpdateTime: updateTime,
	}
}

// parseUpdateTime attempts to parse the update_time field from the API response.
// Returns the zero time if parsing fails (callers should treat this as "unknown").
func parseUpdateTime(raw string) time.Time {
	if raw == "" {
		return time.Time{}
	}
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	}
	for _, f := range formats {
		t, err := time.Parse(f, raw)
		if err == nil {
			return t
		}
	}
	return time.Time{}
}
