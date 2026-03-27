package vietcombank

// CurrencyPrice represents a single exchange rate from the Vietcombank API.
type CurrencyPrice struct {
	TypeCode string // ISO code with _VCB suffix, e.g., "USD_VCB", "EUR_VCB"
	Name     string // Vietnamese display name, e.g., "USD Vietcombank"
	Buy      int64  // Transfer rate in raw VND (no multiplication)
	Sell     int64  // Sell rate in raw VND
	Currency string // Always "VND"
}

// apiExchangeRate mirrors a single entry in the Vietcombank JSON response.
type apiExchangeRate struct {
	CurrencyCode string `json:"CurrencyCode"`
	CurrencyName string `json:"CurrencyName"`
	Buy          string `json:"Buy"`
	Transfer     string `json:"Transfer"`
	Sell         string `json:"Sell"`
}
