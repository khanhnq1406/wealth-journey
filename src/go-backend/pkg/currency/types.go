package currency

// CurrencyType represents a foreign currency type for display
type CurrencyType struct {
	Code     string // Original API name from vangsaigon
	Name     string // Display name
	Currency string // Always "VND"
}

// CurrencyTypes lists all expected currency types from the vangsaigon API
var CurrencyTypes = []CurrencyType{
	{Code: "USD", Name: "USD Tự Do", Currency: "VND"},
	{Code: "USD Internalbank", Name: "USD Vietcombank", Currency: "VND"},
	{Code: "EUR", Name: "EUR", Currency: "VND"},
	{Code: "GBP", Name: "GBP", Currency: "VND"},
	{Code: "JPY", Name: "JPY", Currency: "VND"},
	{Code: "CHF", Name: "CHF", Currency: "VND"},
	{Code: "AUD", Name: "AUD", Currency: "VND"},
	{Code: "CAD", Name: "CAD", Currency: "VND"},
	{Code: "SGD", Name: "SGD", Currency: "VND"},
	{Code: "HKD", Name: "HKD", Currency: "VND"},
	{Code: "TWD", Name: "TWD", Currency: "VND"},
	{Code: "KRW", Name: "KRW", Currency: "VND"},
	{Code: "THB", Name: "THB", Currency: "VND"},
	{Code: "CNY", Name: "CNY", Currency: "VND"},
	{Code: "MYR", Name: "MYR", Currency: "VND"},
	{Code: "SEK", Name: "SEK", Currency: "VND"},
	{Code: "DKK", Name: "DKK", Currency: "VND"},
	{Code: "INR", Name: "INR", Currency: "VND"},
}
