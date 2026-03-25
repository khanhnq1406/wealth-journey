// Package mihong provides an HTTP client for the Mi Hồng gold price API.
//
// Security notes:
//   - Endpoint: HTTPS (api.mihong.vn) — Go default TLS certificate verification applies.
//   - Requires header: x-market: mihong (no API key — public endpoint).
//   - Response body limited to 1 MB via io.LimitReader (T-3 mitigation).
//   - Timeout propagated via context; callers must provide a context with deadline.
//   - Entries with zero or negative buyingPrice or sellingPrice are dropped (T-1 mitigation).
//   - Raw prices are per mace (chỉ); adapter multiplies by 10 to get per lượng.
package mihong

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	DefaultBaseURL = "https://api.mihong.vn/v1/gold-prices?market=domestic"
	MaxBodySize    = 1 * 1024 * 1024 // 1 MB
	xMarketHeader  = "mihong"
)

// codeToTypeCode maps Mihong API code strings to canonical TypeCodes.
var codeToTypeCode = map[string]string{
	"SJC": "SJC",
	"999": "Mihong_999",
	"985": "Mihong_985",
	"980": "Mihong_980",
	"950": "Mihong_950",
	"750": "Mihong_750",
	"680": "Mihong_680",
	"610": "Mihong_610",
	"580": "Mihong_580",
	"410": "Mihong_410",
}

// codeToName maps Mihong API code strings to display names.
var codeToName = map[string]string{
	"SJC": "SJC 9999",
	"999": "Mi Hồng 999",
	"985": "Mi Hồng 985",
	"980": "Mi Hồng 980",
	"950": "Mi Hồng 950",
	"750": "Mi Hồng 750",
	"680": "Mi Hồng 680",
	"610": "Mi Hồng 610",
	"580": "Mi Hồng 580",
	"410": "Mi Hồng 410",
}

// Client is an HTTP client for the Mihong gold price API.
type Client struct {
	httpClient *http.Client
	baseURL    string
}

// NewClient creates a new Mihong client with the given timeout.
func NewClient(timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &Client{
		httpClient: &http.Client{Timeout: timeout},
		baseURL:    DefaultBaseURL,
	}
}

// FetchGoldPrices fetches gold prices from the Mihong API.
//
// The caller should pass a context with an appropriate deadline (5 seconds recommended).
// Entries with zero or negative buyingPrice / sellingPrice are silently dropped.
// Raw prices are per mace (chỉ, 1/10 lượng); returned GoldPrice.Buy and .Sell are per lượng (×10).
func (c *Client) FetchGoldPrices(ctx context.Context) ([]*GoldPrice, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL, nil)
	if err != nil {
		return nil, fmt.Errorf("mihong: create request: %w", err)
	}
	req.Header.Set("x-market", xMarketHeader)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mihong: fetch prices: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("mihong: unexpected status %d: %s", resp.StatusCode, string(body))
	}

	limitedReader := io.LimitReader(resp.Body, MaxBodySize+1)
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("mihong: read response: %w", err)
	}
	if int64(len(body)) > MaxBodySize {
		return nil, fmt.Errorf("mihong: response body exceeds %d bytes limit", MaxBodySize)
	}

	var raw []GoldPriceResponse
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("mihong: parse JSON response: %w", err)
	}

	prices := make([]*GoldPrice, 0, len(raw))
	for _, item := range raw {
		if item.Code == "" {
			continue
		}
		if item.BuyingPrice <= 0 || item.SellingPrice <= 0 {
			continue
		}

		typeCode, ok := codeToTypeCode[item.Code]
		if !ok {
			typeCode = "Mihong_" + item.Code
		}
		name, ok := codeToName[item.Code]
		if !ok {
			name = "Mi Hồng " + item.Code
		}

		updateTime := parseMihongTimestamp(item.DateTime)

		// Raw price is per mace (chỉ, 1/10 lượng). Multiply by 10 to get per lượng,
		// matching the CachedGoldPrice.Buy convention used by the vang.today adapter.
		buy := int64(item.BuyingPrice) * 10
		sell := int64(item.SellingPrice) * 10

		prices = append(prices, &GoldPrice{
			TypeCode:   typeCode,
			Name:       name,
			Buy:        buy,
			Sell:       sell,
			Currency:   "VND",
			UpdateTime: updateTime,
		})
	}

	return prices, nil
}

// parseMihongTimestamp parses the Mihong datetime format "DD/MM/YYYY HH:MM".
// Returns the zero time if parsing fails (non-fatal).
func parseMihongTimestamp(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		loc = time.UTC
	}
	t, err := time.ParseInLocation("02/01/2006 15:04", s, loc)
	if err != nil {
		return time.Time{}
	}
	return t
}
