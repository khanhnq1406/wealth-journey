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
	"math"
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
// Updated to match the new vang.today API type codes (as of 2026-03).
var goldTypePrefixes = []string{
	// New API codes
	"XAUUSD", "DOHN", "DOHCM", "DOJI", "VNGSJC", "PQHN", "BTSJC", "BT9999", "VIETTINM", "SJ",
	// Legacy codes (kept for compatibility if API reverts)
	"SJC", "PNJ", "BTMC", "BAOTINMINH", "XAU", "NHAN", "VSG", "AAA", "AGJ",
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

	var apiResp APIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("vangtoday: parse response: %w", err)
	}
	if !apiResp.Success {
		return nil, fmt.Errorf("vangtoday: API returned success=false")
	}

	updateTime := time.Unix(apiResp.Timestamp, 0)
	if apiResp.Timestamp == 0 {
		updateTime = time.Time{}
	}

	result := &PricesResponse{
		GoldPrices:     make([]*GoldPrice, 0),
		CurrencyPrices: make([]*CurrencyPrice, 0),
	}

	for typeCode, ap := range apiResp.Prices {
		if typeCode == "" {
			continue
		}

		typeCodeUpper := strings.ToUpper(typeCode)

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
				Name:       ap.Name,
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
// The new vang.today API returns prices already in their smallest unit:
//   - VND gold: full VND (e.g., 172,000,000) — stored as-is.
//   - USD gold (currency=="USD"): USD value — converted to cents (×100).
func convertGoldPrice(ap APIPrice, typeCode string, updateTime time.Time) *GoldPrice {
	var buy, sell, changeBuy, changeSell int64
	var currency string

	if strings.EqualFold(ap.Currency, "USD") {
		// World gold priced in USD — convert to cents using Round to avoid float64 truncation.
		buy = int64(math.Round(ap.Buy * 100))
		sell = int64(math.Round(ap.Sell * 100))
		changeBuy = int64(math.Round(ap.ChangeBuy * 100))
		changeSell = int64(math.Round(ap.ChangeSell * 100))
		currency = "USD"
	} else {
		// Vietnamese gold priced in full VND — stored as-is.
		buy = int64(ap.Buy)
		sell = int64(ap.Sell)
		changeBuy = int64(ap.ChangeBuy)
		changeSell = int64(ap.ChangeSell)
		currency = "VND"
	}

	name := ap.Name
	if name == "" {
		name = typeCode
	}

	return &GoldPrice{
		TypeCode:   typeCode,
		Name:       name,
		Buy:        buy,
		Sell:       sell,
		ChangeBuy:  changeBuy,
		ChangeSell: changeSell,
		Currency:   currency,
		UpdateTime: updateTime,
	}
}
