package silverprice

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const ancaratURL = "https://giabac.ancarat.com/api/price-data"

// AncaratClient fetches silver prices from Ancarat
type AncaratClient struct {
	httpClient *http.Client
}

// NewAncaratClient creates a new Ancarat client
func NewAncaratClient() *AncaratClient {
	return &AncaratClient{
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// FetchPrices fetches silver prices from Ancarat
func (c *AncaratClient) FetchPrices(ctx context.Context) ([]ExternalSilverPrice, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", ancaratURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create ancarat request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch ancarat prices: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ancarat unexpected status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1MB limit
	if err != nil {
		return nil, fmt.Errorf("read ancarat response: %w", err)
	}

	return parseAncaratJSON(body)
}

// parseAncaratJSON parses the JSON 2D array from Ancarat
// Format: [[header], [name, sell, buy, code, url?], ...]
// Note: sell comes BEFORE buy in Ancarat's format
func parseAncaratJSON(data []byte) ([]ExternalSilverPrice, error) {
	var rows [][]interface{}
	if err := json.Unmarshal(data, &rows); err != nil {
		return nil, fmt.Errorf("parse ancarat JSON: %w", err)
	}

	var prices []ExternalSilverPrice

	for i, row := range rows {
		if i == 0 {
			continue // Skip header row
		}
		if len(row) < 3 {
			continue
		}

		name, ok := row[0].(string)
		if !ok || name == "" {
			continue
		}

		// Ancarat returns [name, sell, buy, ...] — sell before buy!
		sellStr := fmt.Sprintf("%v", row[1])
		buyStr := fmt.Sprintf("%v", row[2])

		sell := parseVNDPrice(sellStr)
		buy := parseVNDPrice(buyStr)
		if buy == 0 && sell == 0 {
			continue
		}

		displayName := mapAncaratName(name)
		if displayName == "" {
			continue
		}

		prices = append(prices, ExternalSilverPrice{
			Name:   displayName,
			Buy:    buy,
			Sell:   sell,
			Source: "ancarat",
		})
	}

	return prices, nil
}

// mapAncaratName maps Ancarat product names to display names
func mapAncaratName(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.Contains(lower, "1000 gram") || strings.Contains(lower, "ancarat 999"):
		return "Ancarat thỏi 999 - 1kg"
	case strings.Contains(lower, "1 kilo"):
		return "Ancarat Ngân Long 1kg"
	case strings.Contains(lower, "5 lượng"):
		return "Ancarat Ngân Long 5L"
	case strings.Contains(lower, "1 lượng"):
		return "Ancarat Ngân Long 1L"
	default:
		return ""
	}
}
