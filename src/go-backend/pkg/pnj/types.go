// Package pnj provides an HTTP client for the PNJ gold price JSON API.
//
// Security notes:
//   - Endpoint: HTTPS (edge-cf-api.pnj.io) — Go default TLS certificate verification applies.
//   - Response body limited to 1 MB via io.LimitReader to prevent unbounded memory usage.
//   - HTTP client has a built-in 5-second timeout enforced at the transport level.
//   - String price fields (commas as thousand separators) are sanitized before parsing.
//   - Entries with zero or negative buy/sell prices are dropped.
//   - Type codes are sanitized via gold.SanitizeTypeCode to prevent injection of
//     arbitrary strings into the database.
//   - TPHCM region is preferred; the first region is used as fallback if not found.
//   - No user-supplied input is incorporated into requests.
package pnj

import "time"

// GoldPrice holds a normalized gold price entry from the PNJ API.
// Buy and Sell are in full VND per lượng (37.5 g).
//
// Raw PNJ prices are quoted in nghìn VND (thousands of VND) per lượng.
// The client multiplies by 1000 to convert to full VND, consistent with
// the convention used by the SJC and BTMC adapters in this codebase.
type GoldPrice struct {
	TypeCode   string
	Name       string
	Buy        int64     // VND per lượng, full VND
	Sell       int64     // VND per lượng, full VND
	Currency   string    // always "VND"
	UpdateTime time.Time
}

// apiResponse is the top-level structure of the PNJ JSON response.
type apiResponse struct {
	Regions []apiRegion `json:"regions"`
}

// apiRegion represents a city/region entry in the PNJ response.
type apiRegion struct {
	Name      string       `json:"name"`
	GoldTypes []apiGoldType `json:"gold_type"`
}

// apiGoldType represents one gold product entry within a region.
// Buy and Sell use Vietnamese field names: gia_mua (buy price), gia_ban (sell price).
// Values are quoted as string numbers with dots as thousand separators,
// e.g. "176.700" meaning 176,700 nghìn VND (176,700,000 VND).
type apiGoldType struct {
	Name string `json:"name"`
	Buy  string `json:"gia_mua"`
	Sell string `json:"gia_ban"`
}
