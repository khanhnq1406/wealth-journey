package fx

import (
	"fmt"
	"math"
	"strings"
)

// SupportedCurrencies defines the list of supported ISO 4217 currency codes
var SupportedCurrencies = map[string]bool{
	// Major currencies
	"USD": true, // US Dollar
	"EUR": true, // Euro
	"GBP": true, // British Pound
	"JPY": true, // Japanese Yen
	"CHF": true, // Swiss Franc
	"CAD": true, // Canadian Dollar
	"AUD": true, // Australian Dollar
	"NZD": true, // New Zealand Dollar

	// Asian currencies
	"VND": true, // Vietnamese Dong
	"CNY": true, // Chinese Yuan
	"HKD": true, // Hong Kong Dollar
	"SGD": true, // Singapore Dollar
	"KRW": true, // South Korean Won
	"MYR": true, // Malaysian Ringgit
	"THB": true, // Thai Baht
	"IDR": true, // Indonesian Rupiah
	"PHP": true, // Philippine Peso
	"INR": true, // Indian Rupee

	// Other currencies
	"SEK": true, // Swedish Krona
	"NOK": true, // Norwegian Krone
	"DKK": true, // Danish Krone
	"MXN": true, // Mexican Peso
	"BRL": true, // Brazilian Real
	"ZAR": true, // South African Rand
	"RUB": true, // Russian Ruble
}

// FxRange defines valid min/max ranges for common currency pairs
// Used to validate rates before caching them
var FxRanges = map[string]struct{ Min, Max float64 }{
	"USD:VND": {Min: 20000, Max: 30000},
	"VND:USD": {Min: 0.000033, Max: 0.00005},
	"EUR:USD": {Min: 1.0, Max: 1.3},
	"USD:EUR": {Min: 0.7, Max: 1.0},
	"GBP:USD": {Min: 1.2, Max: 1.6},
	"USD:GBP": {Min: 0.6, Max: 0.85},
	"USD:JPY": {Min: 100, Max: 160},
	"JPY:USD": {Min: 0.006, Max: 0.01},
	"USD:CNY": {Min: 6.5, Max: 8.0},
	"CNY:USD": {Min: 0.125, Max: 0.154},
	"EUR:VND": {Min: 25000, Max: 35000},
	"VND:EUR": {Min: 0.000028, Max: 0.00004},
	"GBP:VND": {Min: 30000, Max: 40000},
	"VND:GBP": {Min: 0.000025, Max: 0.000033},
}

// ValidateCurrency checks if a currency code is supported
func ValidateCurrency(currency string) error {
	normalized := normalizeCurrency(currency)
	if !SupportedCurrencies[normalized] {
		return fmt.Errorf("unsupported currency: %s", currency)
	}
	return nil
}

// IsSupportedCurrency checks if a currency code is supported
func IsSupportedCurrency(currency string) bool {
	normalized := normalizeCurrency(currency)
	return SupportedCurrencies[normalized]
}

// GetSupportedCurrencies returns a list of all supported currency codes
func GetSupportedCurrencies() []string {
	currencies := make([]string, 0, len(SupportedCurrencies))
	for currency := range SupportedCurrencies {
		currencies = append(currencies, currency)
	}
	return currencies
}

// ValidateRate checks if an FX rate is within a reasonable range
func ValidateRate(fromCurrency, toCurrency string, rate float64) error {
	if math.IsNaN(rate) {
		return fmt.Errorf("FX rate must be a valid number, got: NaN")
	}
	if rate <= 0 {
		return fmt.Errorf("FX rate must be positive, got: %f", rate)
	}

	// Normalize currency codes
	fromCurrency = normalizeCurrency(fromCurrency)
	toCurrency = normalizeCurrency(toCurrency)

	// Check if we have a specific range for this pair
	key := fmt.Sprintf("%s:%s", fromCurrency, toCurrency)
	if rng, ok := FxRanges[key]; ok {
		if rate < rng.Min || rate > rng.Max {
			return fmt.Errorf("FX rate out of range for %s->%s: %f (expected %f-%f)",
				fromCurrency, toCurrency, rate, rng.Min, rng.Max)
		}
	}

	return nil
}

// normalizeCurrency normalizes a currency code to uppercase and trimmed
func normalizeCurrency(currency string) string {
	return strings.ToUpper(strings.TrimSpace(currency))
}

// CurrencyDecimalPlaces defines the number of decimal places for each currency
// This is used for proper currency conversion accounting for different smallest units
var CurrencyDecimalPlaces = map[string]int{
	// 2 decimal places (standard)
	"USD": 2, "EUR": 2, "GBP": 2, "CHF": 2, "CAD": 2, "AUD": 2, "NZD": 2,
	"CNY": 2, "HKD": 2, "SGD": 2, "MYR": 2, "THB": 2, "PHP": 2, "INR": 2,
	"SEK": 2, "NOK": 2, "DKK": 2, "MXN": 2, "BRL": 2, "ZAR": 2, "RUB": 2,

	// 0 decimal places (no cents/subunits commonly used)
	"VND": 0, "JPY": 0, "KRW": 0, "IDR": 0,
}

// GetDecimalPlaces returns the number of decimal places for a currency
// Defaults to 2 if the currency is not explicitly defined
func GetDecimalPlaces(currency string) int {
	normalized := normalizeCurrency(currency)
	if places, ok := CurrencyDecimalPlaces[normalized]; ok {
		return places
	}
	return 2 // Default to 2 decimal places
}

// GetDecimalMultiplier returns the multiplier for converting to/from smallest units
// For USD (2 decimals): 100 (1 dollar = 100 cents)
// For VND (0 decimals): 1 (1 dong = 1 dong)
func GetDecimalMultiplier(currency string) int64 {
	places := GetDecimalPlaces(currency)
	multiplier := int64(1)
	for i := 0; i < places; i++ {
		multiplier *= 10
	}
	return multiplier
}
