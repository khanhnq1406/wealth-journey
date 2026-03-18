package validator

import (
	"fmt"
	"math"
	"time"
)

// TransactionValidationError represents a validation error for a transaction field
type TransactionValidationError struct {
	Field    string
	Message  string
	Severity string // "error", "warning", "info"
}

// TransactionValidationConfig contains configuration for transaction validation
type TransactionValidationConfig struct {
	// ZeroAmountPolicy determines how to handle zero amounts: "error", "warning", or "ignore"
	ZeroAmountPolicy string

	// LargeAmountThreshold is the threshold for large amount warnings (in smallest currency unit)
	// Default: 10,000,000,000,000 (1 billion VND in smallest unit with 4 decimal precision)
	LargeAmountThreshold int64

	// OldDateThresholdDays is the number of days after which a date is considered old
	// Default: 365 days (1 year)
	OldDateThresholdDays int
}

// DefaultValidationConfig returns the default validation configuration
func DefaultValidationConfig() *TransactionValidationConfig {
	return &TransactionValidationConfig{
		ZeroAmountPolicy:     "error",
		LargeAmountThreshold: 10000000000000, // 1 billion VND
		OldDateThresholdDays: 365,            // 1 year
	}
}

// ISO 4217 currency codes
var validCurrencyCodes = map[string]bool{
	// Major currencies
	"VND": true, // Vietnamese Dong
	"USD": true, // US Dollar
	"EUR": true, // Euro
	"GBP": true, // British Pound
	"JPY": true, // Japanese Yen
	"CNY": true, // Chinese Yuan
	"KRW": true, // South Korean Won
	"THB": true, // Thai Baht
	"SGD": true, // Singapore Dollar
	"MYR": true, // Malaysian Ringgit
	"IDR": true, // Indonesian Rupiah
	"PHP": true, // Philippine Peso
	"INR": true, // Indian Rupee
	"AUD": true, // Australian Dollar
	"CAD": true, // Canadian Dollar
	"CHF": true, // Swiss Franc
	"SEK": true, // Swedish Krona
	"NOK": true, // Norwegian Krone
	"DKK": true, // Danish Krone
	"NZD": true, // New Zealand Dollar
	"HKD": true, // Hong Kong Dollar
	"TWD": true, // Taiwan Dollar
	"ZAR": true, // South African Rand
	"BRL": true, // Brazilian Real
	"MXN": true, // Mexican Peso
	"RUB": true, // Russian Ruble
	"TRY": true, // Turkish Lira
	"AED": true, // UAE Dirham
	"SAR": true, // Saudi Riyal
	"PLN": true, // Polish Zloty
	"CZK": true, // Czech Koruna
	"HUF": true, // Hungarian Forint
	"ILS": true, // Israeli Shekel
	"CLP": true, // Chilean Peso
	"ARS": true, // Argentine Peso
	"COP": true, // Colombian Peso
	"PEN": true, // Peruvian Sol
	"EGP": true, // Egyptian Pound
	"PKR": true, // Pakistani Rupee
	"BDT": true, // Bangladeshi Taka
	"VEF": true, // Venezuelan Bolivar
	"NGN": true, // Nigerian Naira
	"KES": true, // Kenyan Shilling
}

// ValidateAmount validates a transaction amount
func ValidateAmount(amount int64, currency string) []*TransactionValidationError {
	return ValidateAmountWithConfig(amount, currency, DefaultValidationConfig())
}

// ValidateAmountWithConfig validates a transaction amount with custom configuration
func ValidateAmountWithConfig(amount int64, currency string, config *TransactionValidationConfig) []*TransactionValidationError {
	var errors []*TransactionValidationError

	// Zero check
	if amount == 0 {
		switch config.ZeroAmountPolicy {
		case "error":
			errors = append(errors, &TransactionValidationError{
				Field:    "amount",
				Message:  "Amount cannot be zero",
				Severity: "error",
			})
		case "warning":
			errors = append(errors, &TransactionValidationError{
				Field:    "amount",
				Message:  "Amount is zero. Please verify.",
				Severity: "warning",
			})
		case "ignore":
			// Do nothing
		default:
			// Default to error
			errors = append(errors, &TransactionValidationError{
				Field:    "amount",
				Message:  "Amount cannot be zero",
				Severity: "error",
			})
		}
	}

	// Range check for VND (1 billion VND = 10,000,000,000,000 in smallest unit with 4 decimal precision)
	if currency == "VND" {
		absAmount := int64(math.Abs(float64(amount)))
		if absAmount > config.LargeAmountThreshold {
			errors = append(errors, &TransactionValidationError{
				Field:    "amount",
				Message:  "Amount is very large (>1 billion VND). Please verify.",
				Severity: "warning",
			})
		}
	}

	return errors
}

// ValidateTransactionCurrency validates a transaction currency code
func ValidateTransactionCurrency(currency string) []*TransactionValidationError {
	if currency == "" {
		return []*TransactionValidationError{{
			Field:    "currency",
			Message:  "Invalid currency code. Currency is required.",
			Severity: "error",
		}}
	}

	if !validCurrencyCodes[currency] {
		return []*TransactionValidationError{{
			Field:    "currency",
			Message:  "Invalid currency code. Must be a valid ISO 4217 code (e.g., VND, USD, EUR).",
			Severity: "error",
		}}
	}

	return nil
}

// ValidateTransactionDescription validates a transaction description
func ValidateTransactionDescription(description string) []*TransactionValidationError {
	const minLength = 2
	const maxLength = 500

	var errors []*TransactionValidationError

	// Length validation
	if len(description) < minLength {
		errors = append(errors, &TransactionValidationError{
			Field:    "description",
			Message:  fmt.Sprintf("Description must be at least %d characters", minLength),
			Severity: "error",
		})
	}

	if len(description) > maxLength {
		errors = append(errors, &TransactionValidationError{
			Field:    "description",
			Message:  fmt.Sprintf("Description must be at most %d characters", maxLength),
			Severity: "error",
		})
	}

	return errors
}

// ValidateTransactionDate validates a transaction date
func ValidateTransactionDate(date time.Time) []*TransactionValidationError {
	return ValidateTransactionDateWithConfig(date, DefaultValidationConfig())
}

// ValidateTransactionDateWithConfig validates a transaction date with custom configuration
func ValidateTransactionDateWithConfig(date time.Time, config *TransactionValidationConfig) []*TransactionValidationError {
	var errors []*TransactionValidationError

	now := time.Now()

	// Future date check
	if date.After(now) {
		errors = append(errors, &TransactionValidationError{
			Field:    "date",
			Message:  "Date cannot be in the future",
			Severity: "error",
		})
		return errors // Return early, don't check age if it's a future date
	}

	// Age validation (1 year threshold)
	// Truncate to start-of-day so comparison is date-only (parsed dates have no time component)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	threshold := today.AddDate(0, 0, -config.OldDateThresholdDays)
	dateDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	// A date is "old" if it's strictly before the threshold (not on or after)
	if dateDay.Before(threshold) {
		errors = append(errors, &TransactionValidationError{
			Field:    "date",
			Message:  "Date is older than 1 year. Please verify.",
			Severity: "warning",
		})
	}

	return errors
}

// ValidateTransaction validates all transaction fields with default configuration
func ValidateTransaction(amount int64, currency, description string, date time.Time) []*TransactionValidationError {
	return ValidateTransactionWithConfig(amount, currency, description, date, DefaultValidationConfig())
}

// ValidateTransactionWithConfig validates all transaction fields with custom configuration
func ValidateTransactionWithConfig(
	amount int64,
	currency string,
	description string,
	date time.Time,
	config *TransactionValidationConfig,
) []*TransactionValidationError {
	var allErrors []*TransactionValidationError

	// Validate amount
	allErrors = append(allErrors, ValidateAmountWithConfig(amount, currency, config)...)

	// Validate currency
	allErrors = append(allErrors, ValidateTransactionCurrency(currency)...)

	// Validate description
	allErrors = append(allErrors, ValidateTransactionDescription(description)...)

	// Validate date
	allErrors = append(allErrors, ValidateTransactionDateWithConfig(date, config)...)

	return allErrors
}
