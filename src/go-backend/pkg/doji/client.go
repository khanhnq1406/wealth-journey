package doji

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"wealthjourney/pkg/gold"
)

const (
	defaultURL     = "https://giavang.doji.vn/"
	maxBodySize    = 1 << 20 // 1 MB
	requestTimeout = 5 * time.Second
)

// rowRe matches a complete table row, including multiline content.
var rowRe = regexp.MustCompile(`(?is)<tr[^>]*>(.*?)</tr>`)

// tdRe matches a table cell and captures its inner content.
var tdRe = regexp.MustCompile(`(?is)<td[^>]*>(.*?)</td>`)

// tagRe strips any remaining HTML tags from a string.
var tagRe = regexp.MustCompile(`<[^>]+>`)

// Client scrapes gold prices from the DOJI website.
type Client struct {
	httpClient *http.Client
	url        string
}

// NewClient returns a new DOJI Client with a 5-second timeout.
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: requestTimeout},
		url:        defaultURL,
	}
}

// FetchGoldPrices fetches and parses all gold prices from the DOJI website.
// The response body is limited to 1 MB. Rows with zero or negative prices
// are silently discarded. Type codes are sanitized via gold.SanitizeTypeCode.
func (c *Client) FetchGoldPrices(ctx context.Context) ([]*GoldPrice, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
	if err != nil {
		return nil, fmt.Errorf("doji: create request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("doji: fetch: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("doji: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodySize))
	if err != nil {
		return nil, fmt.Errorf("doji: read body: %w", err)
	}

	return parseHTML(string(body)), nil
}

// parseHTML extracts gold price rows from an HTML string.
// Each <tr> must contain at least 3 <td> cells: name, buy, sell.
// Prices are in "nghìn/chỉ" (thousands per mace); multiply by 1,000,000
// to convert to VND per lượng (tael).
func parseHTML(html string) []*GoldPrice {
	var results []*GoldPrice
	seen := make(map[string]bool)

	rows := rowRe.FindAllStringSubmatch(html, -1)
	for _, row := range rows {
		cells := tdRe.FindAllStringSubmatch(row[1], -1)
		if len(cells) < 3 {
			continue
		}

		name := strings.TrimSpace(tagRe.ReplaceAllString(cells[0][1], ""))
		buyStr := strings.TrimSpace(tagRe.ReplaceAllString(cells[1][1], ""))
		sellStr := strings.TrimSpace(tagRe.ReplaceAllString(cells[2][1], ""))

		if name == "" {
			continue
		}

		buy := parsePrice(buyStr)
		sell := parsePrice(sellStr)
		if buy <= 0 && sell <= 0 {
			continue
		}

		tc := gold.SanitizeTypeCode("DOJI", name)
		if seen[tc] {
			continue
		}
		seen[tc] = true

		results = append(results, &GoldPrice{
			TypeCode:   tc,
			Name:       name,
			Buy:        buy,
			Sell:       sell,
			Currency:   "VND",
			UpdateTime: time.Now(),
		})
	}
	return results
}

// parsePrice converts a price string in nghìn/chỉ (thousands per mace) to
// VND per lượng (tael) by multiplying by 1,000,000.
// Returns 0 for empty, dash, "N/A", or unparseable inputs.
// Negative values are treated as 0.
func parsePrice(s string) int64 {
	s = strings.ReplaceAll(s, ",", "")
	s = strings.TrimSpace(s)
	if s == "" || s == "-" || s == "N/A" {
		return 0
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	if v <= 0 {
		return 0
	}
	return int64(v) * 1_000_000
}
