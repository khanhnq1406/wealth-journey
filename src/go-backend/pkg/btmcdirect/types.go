// Package btmcdirect provides an HTML scraper client for BTMC (Bao Tin Minh Chau) gold prices.
// It scrapes the public HTML table at btmc.vn/Home/BGiaVang.
//
// Security notes:
//   - HTML is parsed from an untrusted external source; all cell content is treated as untrusted input.
//   - Response body is limited to 1 MB via io.LimitReader (HTML bomb mitigation).
//   - Request timeout is 5 seconds (enforced via http.Client.Timeout and context propagation).
//   - "Liên hệ" (contact us) sell prices are stored as 0, not parsed as a number.
//   - Type codes are sanitized via gold.SanitizeTypeCode to prevent injection of arbitrary strings into the DB.
//   - Prices with zero or negative Buy and Sell values are rejected.
//   - No user input touches this package; all data originates from the external website.
package btmcdirect

import "time"

// GoldPrice is the normalized output type from the BTMC direct client.
// Buy and Sell are in the smallest VND unit (raw scraped number × 1000),
// matching the convention used by other gold price clients in this project.
type GoldPrice struct {
	TypeCode   string    // Sanitized type code with BTMC_ prefix, e.g. "BTMC_VANG_MIENG_VRTL"
	Name       string    // Original product name from the HTML table
	Buy        int64     // Buy price in VND (scraped value × 1000)
	Sell       int64     // Sell price in VND (scraped value × 1000); 0 if "Liên hệ"
	Currency   string    // Always "VND" for BTMC prices
	UpdateTime time.Time // Time the prices were fetched
}
