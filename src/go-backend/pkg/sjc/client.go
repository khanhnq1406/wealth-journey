package sjc

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"wealthjourney/pkg/gold"
)

const (
	defaultURL     = "https://sjc.com.vn/GoldPrice/Services/PriceService.ashx"
	maxBodySize    = 1 << 20 // 1 MB
	// requestTimeout is set to 15 seconds to accommodate the slow response times
	// observed on sjc.com.vn (the 5 s default triggered context deadline exceeded
	// in production). The caller also passes a context with its own deadline;
	// this acts as a hard upper bound.
	requestTimeout = 15 * time.Second
)

// Client fetches gold prices from the SJC official JSON API.
type Client struct {
	httpClient *http.Client
	url        string
}

// NewClient returns a new SJC Client with a 15-second timeout.
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: requestTimeout},
		url:        defaultURL,
	}
}

// FetchGoldPrices fetches all gold prices from the SJC API.
// It enforces a 1 MB body read limit and filters out entries with
// zero or negative prices. Type codes are sanitized via gold.SanitizeTypeCode.
func (c *Client) FetchGoldPrices(ctx context.Context) ([]*GoldPrice, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
	if err != nil {
		return nil, fmt.Errorf("sjc: create request: %w", err)
	}
	q := req.URL.Query()
	q.Set("method", "AllBranch")
	q.Set("LocationId", "2") // Ho Chi Minh
	req.URL.RawQuery = q.Encode()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sjc: fetch: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sjc: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodySize))
	if err != nil {
		return nil, fmt.Errorf("sjc: read body: %w", err)
	}

	var apiResp apiResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("sjc: parse JSON: %w", err)
	}

	var results []*GoldPrice
	seen := make(map[string]bool)
	for _, row := range apiResp.DataList.Data {
		buy := int64(row.BuyValue)
		sell := int64(row.SellValue)
		if buy <= 0 && sell <= 0 {
			continue
		}
		tc := gold.SanitizeTypeCode("SJC", row.TypeName)
		if seen[tc] {
			continue
		}
		seen[tc] = true
		results = append(results, &GoldPrice{
			TypeCode:   tc,
			Name:       row.TypeName,
			Buy:        buy,
			Sell:       sell,
			ChangeBuy:  row.BuyDifferValue,
			ChangeSell: row.SellDifferValue,
			Currency:   "VND",
			UpdateTime: time.Now(),
		})
	}
	return results, nil
}
