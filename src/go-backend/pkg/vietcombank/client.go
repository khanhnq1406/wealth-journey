package vietcombank

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	defaultBaseURL  = "https://www.vietcombank.com.vn/api/exchangerates"
	maxResponseSize = 1 << 20 // 1MB
	defaultTimeout  = 5 * time.Second
)

// currencyNames maps ISO currency codes to their display names used in WealthJourney.
var currencyNames = map[string]string{
	"USD": "USD Vietcombank",
	"EUR": "EUR Vietcombank",
	"GBP": "GBP Vietcombank",
	"JPY": "JPY Vietcombank",
	"CHF": "CHF Vietcombank",
	"AUD": "AUD Vietcombank",
	"CAD": "CAD Vietcombank",
	"SGD": "SGD Vietcombank",
	"HKD": "HKD Vietcombank",
	"TWD": "TWD Vietcombank",
	"KRW": "KRW Vietcombank",
	"THB": "THB Vietcombank",
	"CNY": "CNY Vietcombank",
}

// Client fetches currency exchange rates from the Vietcombank public API.
type Client struct {
	httpClient *http.Client
	baseURL    string
}

// NewClient returns a Client with default timeout and the production Vietcombank base URL.
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: defaultTimeout},
		baseURL:    defaultBaseURL,
	}
}

// FetchCurrencyPrices retrieves currency exchange rates from Vietcombank.
// It maps the Transfer field to Buy (standard bank transfer rate) and filters
// entries where both Buy and Sell are zero. TypeCodes are suffixed with "_VCB"
// to differentiate from other price sources in the asset_price table.
func (c *Client) FetchCurrencyPrices(ctx context.Context) ([]*CurrencyPrice, error) {
	url := fmt.Sprintf("%s?date=%s", c.baseURL, time.Now().Format("2006-01-02"))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	// Limit body to maxResponseSize to guard against unexpectedly large responses.
	limitedReader := io.LimitReader(resp.Body, maxResponseSize+1)
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	if int64(len(body)) > maxResponseSize {
		return nil, fmt.Errorf("response exceeds %d bytes", maxResponseSize)
	}

	var rates []apiExchangeRate
	if err := json.Unmarshal(body, &rates); err != nil {
		return nil, fmt.Errorf("parse json: %w", err)
	}

	result := make([]*CurrencyPrice, 0, len(rates))
	for _, rate := range rates {
		// Transfer rate is the standard bank-to-bank rate; we expose it as Buy.
		buy := parseVND(rate.Transfer)
		sell := parseVND(rate.Sell)
		if buy <= 0 && sell <= 0 {
			continue
		}

		code := strings.TrimSpace(rate.CurrencyCode)
		name, ok := currencyNames[code]
		if !ok {
			name = code + " Vietcombank"
		}

		result = append(result, &CurrencyPrice{
			TypeCode: code + "_VCB",
			Name:     name,
			Buy:      buy,
			Sell:     sell,
			Currency: "VND",
		})
	}

	return result, nil
}

// parseVND parses a Vietnamese-formatted price string (e.g., "24,610") into int64.
// Returns 0 for empty, dash, or unparseable values.
func parseVND(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" || s == "-" {
		return 0
	}
	s = strings.ReplaceAll(s, ",", "")
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return int64(f)
}
