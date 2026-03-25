package vangtoday

import "time"

// APIPrice represents a single price entry in the vang.today API response.
// The API returns a flat JSON array where each entry can be a gold or currency type.
type APIPrice struct {
	TypeCode   string  `json:"type_code"`
	Buy        float64 `json:"buy"`
	Sell       float64 `json:"sell"`
	ChangeBuy  float64 `json:"change_buy"`
	ChangeSell float64 `json:"change_sell"`
	UpdateTime string  `json:"update_time"`
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
