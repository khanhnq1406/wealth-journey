package vangtoday

import "time"

// APIPrice represents a single price entry in the vang.today API response.
// The API returns a JSON object keyed by type_code, where each entry contains
// name, buy, sell, change_buy, change_sell, and currency.
type APIPrice struct {
	Name       string  `json:"name"`
	Buy        float64 `json:"buy"`
	Sell       float64 `json:"sell"`
	ChangeBuy  float64 `json:"change_buy"`
	ChangeSell float64 `json:"change_sell"`
	Currency   string  `json:"currency"`
}

// APIResponse is the top-level JSON structure returned by the vang.today API.
// Prices is a map from type_code to price entry.
type APIResponse struct {
	Success   bool                `json:"success"`
	Timestamp int64               `json:"timestamp"`
	Prices    map[string]APIPrice `json:"prices"`
}

// GoldPrice is the normalized output type for a gold price from vang.today.
// Buy and Sell are in the smallest currency unit:
//   - VND gold (SJC, DOJI, PNJ, etc.): multiplied by 1000  (matches vnprice convention)
//   - USD gold (XAU):                   multiplied by 100   (cents)
type GoldPrice struct {
	TypeCode   string
	Name       string
	Buy        int64
	Sell       int64
	ChangeBuy  int64
	ChangeSell int64
	Currency   string    // "VND" or "USD"
	UpdateTime time.Time
}

// CurrencyPrice is the normalized output type for a foreign currency price from vang.today.
// Buy and Sell are raw VND values (no multiplication applied).
type CurrencyPrice struct {
	TypeCode   string
	Name       string
	Buy        int64
	Sell       int64
	Currency   string    // always "VND"
	UpdateTime time.Time
}

// PricesResponse is the top-level output from the vang.today client.
type PricesResponse struct {
	GoldPrices     []*GoldPrice
	CurrencyPrices []*CurrencyPrice
}
