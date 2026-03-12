package types

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
)

var (
	// ErrInvalidAmount is returned when an amount is invalid
	ErrInvalidAmount = errors.New("invalid amount: cannot be negative")
	// ErrOverflow is returned when an operation would overflow
	ErrOverflow = errors.New("amount overflow")
	// ErrInvalidCurrency is returned when currency code is invalid
	ErrInvalidCurrency = errors.New("invalid currency code")
)

// Money represents a monetary amount using the smallest currency unit (cents).
// This avoids floating-point precision issues common with financial calculations.
// Amount is stored as int64 in cents (e.g., $10.50 = 1050 cents).
type Money struct {
	Amount   int64  `json:"amount"`   // Amount in smallest currency unit (cents)
	Currency string `json:"currency"` // ISO 4217 currency code (e.g., "USD", "EUR")
}

// NewMoney creates a new Money value from amount and currency.
// The amount should be in the smallest currency unit (cents).
func NewMoney(amount int64, currency string) Money {
	return Money{
		Amount:   amount,
		Currency: currency,
	}
}

// NewMoneyFromFloat creates a Money value from a float amount.
// For example, 10.50 USD becomes 1050 cents.
// This is useful for API input but should be avoided in internal calculations.
func NewMoneyFromFloat(amount float64, currency string) (Money, error) {
	if amount < 0 {
		return Money{}, ErrInvalidAmount
	}
	// Convert to cents and round to handle floating point precision
	cents := int64(math.Round(amount * 100))
	if cents < 0 {
		return Money{}, ErrInvalidAmount
	}
	return Money{
		Amount:   cents,
		Currency: currency,
	}, nil
}

// MustNewMoneyFromFloat creates a Money value from float, panicking on error.
// Use only for test constants where you're certain the input is valid.
func MustNewMoneyFromFloat(amount float64, currency string) Money {
	m, err := NewMoneyFromFloat(amount, currency)
	if err != nil {
		panic(err)
	}
	return m
}

// ToFloat converts Money to float representation.
// Note: This may lose precision for large amounts.
func (m Money) ToFloat() float64 {
	return float64(m.Amount) / 100
}

// String returns a formatted string representation of Money.
func (m Money) String() string {
	return fmt.Sprintf("%s %.2f", m.Currency, m.ToFloat())
}

// IsZero returns true if the amount is zero.
func (m Money) IsZero() bool {
	return m.Amount == 0
}

// IsNegative returns true if the amount is negative.
func (m Money) IsNegative() bool {
	return m.Amount < 0
}

// IsPositive returns true if the amount is positive.
func (m Money) IsPositive() bool {
	return m.Amount > 0
}

// Add adds two Money values together.
// Returns an error if currencies don't match or on overflow.
func (m Money) Add(other Money) (Money, error) {
	if m.Currency != other.Currency {
		return Money{}, fmt.Errorf("cannot add %s and %s: %w", m.Currency, other.Currency, ErrInvalidCurrency)
	}
	sum := m.Amount + other.Amount
	if sum < m.Amount {
		return Money{}, ErrOverflow
	}
	return Money{Amount: sum, Currency: m.Currency}, nil
}

// MustAdd adds two Money values, panicking on error.
func (m Money) MustAdd(other Money) Money {
	result, err := m.Add(other)
	if err != nil {
		panic(err)
	}
	return result
}

// Subtract subtracts other from m.
// Returns an error if currencies don't match or on overflow.
func (m Money) Subtract(other Money) (Money, error) {
	if m.Currency != other.Currency {
		return Money{}, fmt.Errorf("cannot subtract %s from %s: %w", other.Currency, m.Currency, ErrInvalidCurrency)
	}
	diff := m.Amount - other.Amount
	if diff > m.Amount {
		return Money{}, ErrOverflow
	}
	return Money{Amount: diff, Currency: m.Currency}, nil
}

// MustSubtract subtracts other from m, panicking on error.
func (m Money) MustSubtract(other Money) Money {
	result, err := m.Subtract(other)
	if err != nil {
		panic(err)
	}
	return result
}

// Multiply multiplies Money by a factor.
// The result is rounded to the nearest cent.
func (m Money) Multiply(factor float64) (Money, error) {
	product := int64(math.Round(float64(m.Amount) * factor))
	if m.Amount > 0 && product < 0 {
		return Money{}, ErrOverflow
	}
	return Money{Amount: product, Currency: m.Currency}, nil
}

// MustMultiply multiplies Money by a factor, panicking on error.
func (m Money) MustMultiply(factor float64) Money {
	result, err := m.Multiply(factor)
	if err != nil {
		panic(err)
	}
	return result
}

// Divide divides Money by a divisor.
// The result is rounded to the nearest cent.
func (m Money) Divide(divisor float64) (Money, error) {
	if divisor == 0 {
		return Money{}, errors.New("division by zero")
	}
	quotient := int64(math.Round(float64(m.Amount) / divisor))
	return Money{Amount: quotient, Currency: m.Currency}, nil
}

// MustDivide divides Money by a divisor, panicking on error.
func (m Money) MustDivide(divisor float64) Money {
	result, err := m.Divide(divisor)
	if err != nil {
		panic(err)
	}
	return result
}

// GreaterThan returns true if m is greater than other.
func (m Money) GreaterThan(other Money) bool {
	if m.Currency != other.Currency {
		return false
	}
	return m.Amount > other.Amount
}

// LessThan returns true if m is less than other.
func (m Money) LessThan(other Money) bool {
	if m.Currency != other.Currency {
		return false
	}
	return m.Amount < other.Amount
}

// Equal returns true if m equals other.
func (m Money) Equal(other Money) bool {
	return m.Currency == other.Currency && m.Amount == other.Amount
}

// Validate checks if the Money value is valid.
func (m Money) Validate() error {
	if m.Currency == "" {
		return ErrInvalidCurrency
	}
	// Allow negative amounts for certain use cases (like debt/credits)
	// but validate based on context in service layer
	return nil
}

// MarshalJSON implements json.Marshaler for Money.
// It marshals as a string to maintain precision in JSON.
func (m Money) MarshalJSON() ([]byte, error) {
	return json.Marshal(&struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	}{
		Amount:   m.Amount,
		Currency: m.Currency,
	})
}

// UnmarshalJSON implements json.Unmarshaler for Money.
func (m *Money) UnmarshalJSON(data []byte) error {
	aux := &struct {
		Amount   int64  `json:"amount"`
		Currency string `json:"currency"`
	}{}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	m.Amount = aux.Amount
	m.Currency = aux.Currency
	return nil
}

// Common currency constants
const (
	USD = "USD" // US Dollar
	EUR = "EUR" // Euro
	GBP = "GBP" // British Pound
	JPY = "JPY" // Japanese Yen
	VND = "VND" // Vietnamese Dong
)

// ZeroUSD returns zero money in USD.
func ZeroUSD() Money {
	return Money{Amount: 0, Currency: USD}
}

// ZeroVND returns zero money in VND.
func ZeroVND() Money {
	return Money{Amount: 0, Currency: VND}
}
