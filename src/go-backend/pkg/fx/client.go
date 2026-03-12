package fx

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// APIResponse represents the response from exchangerate-api.com
type APIResponse struct {
	Base  string             `json:"base"`
	Date  string             `json:"date"`
	Rates map[string]float64 `json:"rates"`
}

// Client handles communication with the exchange rate API
type Client struct {
	baseURL    string
	httpClient *http.Client
	maxRetries int
}

// NewClient creates a new FX API client
func NewClient(baseURL string, timeout time.Duration, maxRetries int) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: timeout,
		},
		maxRetries: maxRetries,
	}
}

// GetLatestRates fetches the latest exchange rates for a base currency
func (c *Client) GetLatestRates(ctx context.Context, baseCurrency string) (*APIResponse, error) {
	url := fmt.Sprintf("%s/latest/%s", c.baseURL, baseCurrency)

	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 1s, 2s, 4s
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}

		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			lastErr = err
			continue
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		defer func() { _ = resp.Body.Close() }()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			lastErr = fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
			continue
		}

		var apiResp APIResponse
		if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
			lastErr = err
			continue
		}

		return &apiResp, nil
	}

	return nil, fmt.Errorf("failed after %d retries: %w", c.maxRetries, lastErr)
}
