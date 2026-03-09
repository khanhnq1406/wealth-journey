package vang247

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	DefaultTimeout = 10 * time.Second
	BaseURL        = "https://vangsaigon.vn/ws-prices/api/v1/c_prices"
)

type Client struct {
	httpClient *http.Client
	baseURL    string
}

func NewClient(timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	return &Client{
		httpClient: &http.Client{Timeout: timeout},
		baseURL:    BaseURL,
	}
}

func (c *Client) FetchPrices(ctx context.Context) (*PricesResponse, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch prices: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var apiResp APIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	goldPrices := make([]GoldPrice, 0)

	for _, entry := range apiResp.SJCNationWide {
		if entry.Name == "" {
			continue
		}
		region := entry.Saigon
		if region.Buy == 0 || region.Sell == 0 {
			region = entry.Hanoi
		}
		currency := "VND"
		if entry.Name == "XAUUSD" {
			currency = "USD"
		}
		goldPrices = append(goldPrices, GoldPrice{
			Name:       entry.Name,
			Buy:        region.Buy,
			Sell:       region.Sell,
			BuyChange:  region.BuyChange,
			SellChange: region.SellChange,
			Currency:   currency,
			Digit:      entry.Digit,
			UpdateAt:   entry.UpdateAt,
		})
	}

	for _, entry := range apiResp.GoldNationWide {
		if entry.Name == "" || entry.Name == "XAUUSD" {
			continue
		}
		region := entry.Saigon
		if region.Buy == 0 || region.Sell == 0 {
			region = entry.Hanoi
		}
		goldPrices = append(goldPrices, GoldPrice{
			Name:       entry.Name,
			Buy:        region.Buy,
			Sell:       region.Sell,
			BuyChange:  region.BuyChange,
			SellChange: region.SellChange,
			Currency:   "VND",
			Digit:      entry.Digit,
			UpdateAt:   entry.UpdateAt,
		})
	}

	silverPrices := make([]SilverPrice, 0)
	for _, entry := range apiResp.SilverPrice {
		if entry.Name == "" {
			continue
		}
		region := entry.Saigon
		if region.Buy == 0 || region.Sell == 0 {
			region = entry.Hanoi
		}
		currency := "VND"
		if entry.Name == "XAGUSD" {
			currency = "USD"
		}
		if entry.Name == "XAGUSD" && region.Buy < 1 {
			continue
		}
		silverPrices = append(silverPrices, SilverPrice{
			Name:       entry.Name,
			Buy:        region.Buy,
			Sell:       region.Sell,
			BuyChange:  region.BuyChange,
			SellChange: region.SellChange,
			Currency:   currency,
			Digit:      entry.Digit,
			UpdateAt:   entry.UpdateAt,
		})
	}

	return &PricesResponse{
		GoldPrices:   goldPrices,
		SilverPrices: silverPrices,
	}, nil
}

func (c *Client) FetchGoldPrice(ctx context.Context, typeCode string) (*GoldPrice, error) {
	prices, err := c.FetchPrices(ctx)
	if err != nil {
		return nil, err
	}
	for _, gp := range prices.GoldPrices {
		if gp.Name == typeCode {
			return &gp, nil
		}
	}
	return nil, fmt.Errorf("gold type not found: %s", typeCode)
}

func (c *Client) FetchSilverPrice(ctx context.Context, typeCode string) (*SilverPrice, error) {
	prices, err := c.FetchPrices(ctx)
	if err != nil {
		return nil, err
	}
	for _, sp := range prices.SilverPrices {
		if sp.Name == typeCode {
			return &sp, nil
		}
	}
	return nil, fmt.Errorf("silver type not found: %s", typeCode)
}
