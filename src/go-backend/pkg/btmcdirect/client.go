package btmcdirect

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
	// defaultURL is the BTMC gold price HTML page URL.
	defaultURL = "https://btmc.vn/Home/BGiaVang"

	// maxBodySize is the maximum allowed response body size (1 MB).
	// This prevents HTML bomb / large-response attacks from an untrusted HTML source.
	maxBodySize = 1 << 20 // 1 MB

	// requestTimeout is the default HTTP client timeout.
	requestTimeout = 5 * time.Second

	// priceMultiplier converts the scraped integer (in thousands of VND) to VND.
	// BTMC displays "17250" meaning 17,250 × 1,000 = 17,250,000 VND.
	priceMultiplier = 1000
)

// rowRe matches a single HTML <tr>...</tr> block (case-insensitive, dot-matches-newline).
var rowRe = regexp.MustCompile(`(?is)<tr[^>]*>(.*?)</tr>`)

// tdRe matches a single HTML <td>...</td> block and captures the inner content.
var tdRe = regexp.MustCompile(`(?is)<td[^>]*>(.*?)</td>`)

// tagRe strips all HTML tags from a string, leaving only text content.
var tagRe = regexp.MustCompile(`<[^>]+>`)

// Client is an HTML scraper for the BTMC gold price website.
type Client struct {
	httpClient *http.Client
	url        string
}

// NewClient returns a new BTMC direct Client with a 5-second timeout.
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: requestTimeout},
		url:        defaultURL,
	}
}

// FetchGoldPrices fetches gold prices by scraping the BTMC HTML price table.
// It enforces a 5-second request timeout and a 1 MB body read limit.
// "Liên hệ" sell prices are stored as 0. Rows where both buy and sell are 0 are filtered.
// Type codes are sanitized via gold.SanitizeTypeCode to prevent arbitrary string injection.
func (c *Client) FetchGoldPrices(ctx context.Context) ([]*GoldPrice, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
	if err != nil {
		return nil, fmt.Errorf("btmcdirect: create request: %w", err)
	}
	// Set a browser-like User-Agent to avoid being blocked by basic bot filters.
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; WealthJourney/1.0)")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("btmcdirect: fetch: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("btmcdirect: status %d", resp.StatusCode)
	}

	// Limit response body to maxBodySize to prevent unbounded memory usage.
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodySize))
	if err != nil {
		return nil, fmt.Errorf("btmcdirect: read body: %w", err)
	}

	return parseHTML(string(body)), nil
}

// parseHTML extracts gold prices from a BTMC HTML table.
// It scans all <tr> elements, extracts the first 3 <td> cells as (name, buy, sell),
// sanitizes the type code, and filters invalid/duplicate entries.
func parseHTML(html string) []*GoldPrice {
	var results []*GoldPrice
	seen := make(map[string]bool)
	now := time.Now()

	rows := rowRe.FindAllString(html, -1)
	for _, row := range rows {
		cells := tdRe.FindAllStringSubmatch(row, -1)
		if len(cells) < 3 {
			continue
		}

		// Strip HTML tags from each cell to get plain text content.
		name := strings.TrimSpace(tagRe.ReplaceAllString(cells[0][1], ""))
		buyStr := strings.TrimSpace(tagRe.ReplaceAllString(cells[1][1], ""))
		sellStr := strings.TrimSpace(tagRe.ReplaceAllString(cells[2][1], ""))

		if name == "" {
			continue
		}

		buy := parsePrice(buyStr)
		sell := parseSellPrice(sellStr)

		// Filter out rows where both prices are zero (header rows, empty rows, etc.)
		if buy <= 0 && sell <= 0 {
			continue
		}

		// Sanitize the type code to prevent injection of arbitrary strings into the DB.
		tc := gold.SanitizeTypeCode("BTMC", name)

		// Skip duplicates (keep the first occurrence).
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
			UpdateTime: now,
		})
	}
	return results
}

// parsePrice parses a BTMC price string such as "17250" or "17,250".
// Commas (thousand separators) are stripped before parsing.
// The raw integer is multiplied by priceMultiplier (1000) to convert to VND.
// Returns 0 if the string is empty, a dash placeholder, or cannot be parsed.
func parsePrice(s string) int64 {
	s = strings.ReplaceAll(s, ",", "")
	s = strings.TrimSpace(s)
	if s == "" || s == "-" || s == "--" {
		return 0
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil || v <= 0 {
		return 0
	}
	return int64(v) * priceMultiplier
}

// parseSellPrice parses a BTMC sell price, treating "Liên hệ" (contact us) as 0.
// This is a security/correctness boundary: the string "Liên hệ" must never be
// parsed as a numeric value; it explicitly means "price available on request".
func parseSellPrice(s string) int64 {
	// Normalize to lowercase ASCII for robust matching of all unicode/case variants.
	normalized := strings.ToLower(s)
	if strings.Contains(normalized, "liên hệ") || strings.Contains(normalized, "lien he") {
		return 0
	}
	return parsePrice(s)
}
