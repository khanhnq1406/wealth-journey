package silverprice

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const dojiURL = "https://giabac.doji.vn/data/DataBac9991Luong.txt"

// DOJIClient fetches silver prices from DOJI
type DOJIClient struct {
	httpClient *http.Client
}

// NewDOJIClient creates a new DOJI client
func NewDOJIClient() *DOJIClient {
	return &DOJIClient{
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// FetchPrices fetches silver prices from DOJI
func (c *DOJIClient) FetchPrices(ctx context.Context) ([]ExternalSilverPrice, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", dojiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create doji request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch doji prices: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("doji unexpected status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1MB limit
	if err != nil {
		return nil, fmt.Errorf("read doji response: %w", err)
	}

	return parseDOJIText(string(body))
}

// parseDOJIText parses the pipe-delimited text from DOJI
// Format: buy|sell|timestamp (multi-line, use last line)
func parseDOJIText(text string) ([]ExternalSilverPrice, error) {
	lines := strings.Split(strings.TrimSpace(text), "\n")
	if len(lines) == 0 {
		return nil, fmt.Errorf("doji: empty response")
	}

	// Use the last non-empty line
	var lastLine string
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		if line != "" {
			lastLine = line
			break
		}
	}

	if lastLine == "" {
		return nil, fmt.Errorf("doji: no valid data line")
	}

	parts := strings.Split(lastLine, "|")
	if len(parts) < 2 {
		return nil, fmt.Errorf("doji: invalid format: %s", lastLine)
	}

	buy, err := strconv.ParseInt(strings.TrimSpace(parts[0]), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("doji: parse buy price: %w", err)
	}

	sell, err := strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("doji: parse sell price: %w", err)
	}

	prices := []ExternalSilverPrice{
		{
			Name:   "DOJI 99.9 1L",
			Buy:    buy,
			Sell:   sell,
			Source: "doji",
		},
		{
			Name:   "DOJI 99.9 5L",
			Buy:    buy * 5,
			Sell:   sell * 5,
			Source: "doji",
		},
	}

	return prices, nil
}
