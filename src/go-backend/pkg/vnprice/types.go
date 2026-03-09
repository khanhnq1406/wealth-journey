package vnprice

import "time"

// APIResponse represents the complete vang247 API response
type APIResponse struct {
	SJCNationWide      []PriceEntry `json:"sjcNationWide"`
	GoldNationWide     []PriceEntry `json:"goldNationWide"`
	SilverPrice        []PriceEntry `json:"silver_price"`
	CurrencyNationWide []PriceEntry `json:"currencyNationWide"`
	GoldenFund95       *PriceEntry  `json:"goldenFund95"`
	GoldenFund99       *PriceEntry  `json:"goldenFund99"`
	VSGGoldTable       []PriceEntry `json:"vsg_gold_table"`
	ContentNew         []any        `json:"ContentNew"`
	Calendars          []any        `json:"Calendars"`
}

// PriceEntry represents a single price entry in the API response
type PriceEntry struct {
	Name     string      `json:"name"`
	Hanoi    RegionPrice `json:"hanoi"`
	Saigon   RegionPrice `json:"saigon"`
	Rate     float64     `json:"rate"`
	Digit    int         `json:"digit"`
	Gap      float64     `json:"gap"`
	UpdateAt time.Time   `json:"update_at"`
}

// RegionPrice represents price data for a specific region
type RegionPrice struct {
	Name       string  `json:"name"`
	Buy        float64 `json:"buy"`
	Sell       float64 `json:"sell"`
	BuyChange  float64 `json:"buy_change"`
	SellChange float64 `json:"sell_change"`
}

// GoldPrice represents a processed gold price (internal format)
type GoldPrice struct {
	Name       string
	Buy        float64
	Sell       float64
	BuyChange  float64
	SellChange float64
	Currency   string
	Digit      int
	UpdateAt   time.Time
}

// SilverPrice represents a processed silver price (internal format)
type SilverPrice struct {
	Name       string
	Buy        float64
	Sell       float64
	BuyChange  float64
	SellChange float64
	Currency   string
	Digit      int
	UpdateAt   time.Time
}

// PricesResponse represents the processed prices
type PricesResponse struct {
	GoldPrices   []GoldPrice
	SilverPrices []SilverPrice
}
