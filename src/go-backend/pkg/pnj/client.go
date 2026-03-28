package pnj

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"wealthjourney/pkg/gold"
)

const (
	// defaultURL is the PNJ gold price JSON API endpoint.
	defaultURL = "https://edge-cf-api.pnj.io/ecom-frontend/v3/get-gold-price"

	// maxBodySize is the maximum response body allowed (1 MB).
	// Prevents unbounded memory usage from malformed or malicious responses.
	maxBodySize = 1 << 20 // 1 MB

	// requestTimeout is the built-in HTTP client timeout enforced at transport level.
	// Callers should also pass a context with a deadline; this acts as a hard cap.
	requestTimeout = 5 * time.Second

	// tphcmRegion is the preferred city region name in PNJ responses.
	// Comparison is case-insensitive via strings.EqualFold.
	tphcmRegion = "TPHCM"
)

// Client fetches gold prices from the PNJ JSON API.
type Client struct {
	httpClient *http.Client
	url        string
}

// NewClient returns a new PNJ Client with a built-in 5-second timeout.
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: requestTimeout},
		url:        defaultURL,
	}
}

// FetchGoldPrices fetches gold prices from the PNJ API.
//
// Security:
//   - Body read is capped at 1 MB.
//   - String prices are sanitized (commas stripped) before numeric parsing.
//   - Entries with zero or negative prices are dropped.
//   - Type codes are sanitized via gold.SanitizeTypeCode.
//
// Price unit: PNJ quotes prices in nghìn VND (thousands of VND) per lượng.
// The returned GoldPrice.Buy and .Sell values are in full VND (multiplied by 1000),
// matching the convention used by the SJC and BTMC adapters.
//
// Region selection: TPHCM is preferred; the first region is used as fallback.
func (c *Client) FetchGoldPrices(ctx context.Context) ([]*GoldPrice, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
	if err != nil {
		return nil, fmt.Errorf("pnj: create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pnj: fetch: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pnj: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodySize))
	if err != nil {
		return nil, fmt.Errorf("pnj: read body: %w", err)
	}

	var apiResp apiResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("pnj: parse JSON: %w", err)
	}

	region := selectRegion(apiResp.Regions)
	if region == nil {
		// PNJ may return an empty regions array during off-hours or maintenance windows.
		// Treat as "no data available" — return empty slice so the caller can mark stale
		// rather than surfacing a hard error.
		return []*GoldPrice{}, nil
	}

	var results []*GoldPrice
	seen := make(map[string]bool)
	for _, gt := range region.GoldTypes {
		buy := parsePrice(gt.Buy)
		sell := parsePrice(gt.Sell)
		if buy <= 0 && sell <= 0 {
			continue
		}
		tc := gold.SanitizeTypeCode("PNJ", gt.Name)
		if seen[tc] {
			continue
		}
		seen[tc] = true
		results = append(results, &GoldPrice{
			TypeCode:   tc,
			Name:       gt.Name,
			Buy:        buy,
			Sell:       sell,
			Currency:   "VND",
			UpdateTime: time.Now(),
		})
	}
	return results, nil
}

// selectRegion returns the TPHCM region if present (case-insensitive), otherwise
// returns the first region in the slice. Returns nil if the slice is empty.
func selectRegion(regions []apiRegion) *apiRegion {
	for i := range regions {
		if strings.EqualFold(regions[i].Name, tphcmRegion) {
			return &regions[i]
		}
	}
	if len(regions) > 0 {
		return &regions[0]
	}
	return nil
}

// parsePrice parses a PNJ price string such as "173,500" (nghìn VND per lượng).
//
// The string may contain commas as thousand separators. After stripping commas
// and whitespace the value is parsed as a float64. Non-positive values return 0.
//
// The parsed value is multiplied by 1000 to convert from nghìn VND to full VND,
// consistent with the price scale used by other adapters (SJC, BTMC) in this codebase.
func parsePrice(s string) int64 {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ",", "")
	if s == "" || s == "0" {
		return 0
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil || v <= 0 {
		return 0
	}
	return int64(v) * 1_000
}
