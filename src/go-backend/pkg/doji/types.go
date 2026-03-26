// Package doji provides an HTML scraping client for gold prices from the
// DOJI website (giavang.doji.vn).
//
// Security notes:
//   - HTTPS enforced; Go's default TLS verification applies.
//   - HTTP timeout set to 5 seconds via the embedded http.Client.
//   - Response body limited to 1 MB via io.LimitReader.
//   - All type codes are sanitized through gold.SanitizeTypeCode to prevent
//     injection of arbitrary strings into the database.
//   - Rows where both buy and sell parse to zero or negative are discarded.
//   - No user-supplied input reaches this package.
package doji

import "time"

// GoldPrice holds a parsed gold price entry from the DOJI website.
type GoldPrice struct {
	TypeCode   string
	Name       string
	Buy        int64
	Sell       int64
	Currency   string
	UpdateTime time.Time
}
