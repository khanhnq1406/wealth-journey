// Package mihong provides an HTTP client for the Mi Hồng (Mihong) gold price API.
package mihong

import "time"

// GoldPriceResponse is one entry in the array returned by
// GET https://api.mihong.vn/v1/gold-prices?market=domestic
// with header x-market: mihong.
type GoldPriceResponse struct {
	BuyingPrice       float64 `json:"buyingPrice"`
	SellingPrice      float64 `json:"sellingPrice"`
	Code              string  `json:"code"`
	SellChange        float64 `json:"sellChange"`
	BuyChange         float64 `json:"buyChange"`
	BuyChangePercent  float64 `json:"buyChangePercent"`
	SellChangePercent float64 `json:"sellChangePercent"`
	DateTime          string  `json:"dateTime"`
}

// GoldPrice is the normalized output of the Mihong client.
// Buy and Sell are in VND per lượng (10 mace = 1 lượng).
// The raw Mihong API prices are per mace; the client multiplies by 10.
type GoldPrice struct {
	TypeCode   string
	Name       string
	Buy        int64     // VND per lượng, full VND
	Sell       int64     // VND per lượng, full VND
	Currency   string    // always "VND"
	UpdateTime time.Time
}
