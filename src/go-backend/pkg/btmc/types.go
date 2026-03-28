package btmc

import (
	"encoding/xml"
	"time"
)

// BTMCResponse is the top-level XML envelope returned by the BTMC API.
type BTMCResponse struct {
	XMLName xml.Name   `xml:"root"`
	Rows    []BTMCRow  `xml:"DataList>Data"`
}

// BTMCRow represents a single row in the BTMC price table.
// Field names are from the BTMC API specification.
type BTMCRow struct {
	Name       string `xml:"n_1"`   // Product name (e.g. "SJC 1L, 10L, 1KG")
	Karat      string `xml:"k_1"`   // Karat/fineness label (e.g. "999.9")
	Purity     string `xml:"h_1"`   // Purity percentage (e.g. "99.99")
	BuyPrice   string `xml:"pb_1"`  // Buy price as string with comma separators (e.g. "87,050")
	SellPrice  string `xml:"ps_1"`  // Sell price as string with comma separators
	WorldPrice string `xml:"pt_1"`  // Reference world gold price
	Timestamp  string `xml:"d_1"`   // Last update timestamp
}

// GoldPrice is the normalized output type from the BTMC client.
// Buy and Sell are in the smallest VND unit (multiplied by 1000 from tael price),
// matching the convention used by pkg/vnprice.
type GoldPrice struct {
	TypeCode   string    // Mapped type code (e.g. "SJC", "SJC_5chi", "BTMC_ring")
	Name       string    // Original product name from BTMC
	Buy        int64     // Buy price in smallest VND unit
	Sell       int64     // Sell price in smallest VND unit
	Currency   string    // Always "VND" for BTMC
	UpdateTime time.Time // Last update time parsed from API response
}
