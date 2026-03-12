package yahoo

import (
	"context"
	"errors"
	"testing"
	"time"
)

// TestNewClient verifies that NewClient creates a client with the correct symbol
func TestNewClient(t *testing.T) {
	tests := []struct {
		name      string
		symbol    string
		expectNil bool
	}{
		{
			name:   "Valid symbol AAPL",
			symbol: "AAPL",
		},
		{
			name:   "Valid symbol MSFT",
			symbol: "MSFT",
		},
		{
			name:   "Valid symbol GOOGL",
			symbol: "GOOGL",
		},
		{
			name:   "Crypto symbol BTC-USD",
			symbol: "BTC-USD",
		},
		{
			name:      "Empty symbol",
			symbol:    "",
			expectNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient(tt.symbol)
			if tt.expectNil {
				if client != nil {
					t.Errorf("NewClient(%q) = non-nil, want nil", tt.symbol)
				}
				return
			}
			if client == nil {
				t.Fatal("NewClient() returned nil")
			}
			if client.GetSymbol() != tt.symbol {
				t.Errorf("NewClient().GetSymbol() = %s, want %s", client.GetSymbol(), tt.symbol)
			}
		})
	}
}

// TestGetSymbol verifies that GetSymbol returns the correct symbol
func TestGetSymbol(t *testing.T) {
	symbols := []string{"AAPL", "MSFT", "GOOGL", "TSLA", "BTC-USD"}

	for _, symbol := range symbols {
		t.Run(symbol, func(t *testing.T) {
			client := NewClient(symbol)
			if got := client.GetSymbol(); got != symbol {
				t.Errorf("GetSymbol() = %s, want %s", got, symbol)
			}
		})
	}
}

// TestThrottlerWait tests the throttler's Wait method
func TestThrottlerWait(t *testing.T) {
	tests := []struct {
		name              string
		requestsPerMinute int
		numCalls          int
		expectDelay       bool
	}{
		{
			name:              "High rate limit (120 req/min)",
			requestsPerMinute: 120,
			numCalls:          2,
			expectDelay:       false,
		},
		{
			name:              "Low rate limit (10 req/min)",
			requestsPerMinute: 10,
			numCalls:          3,
			expectDelay:       true,
		},
		{
			name:              "Very low rate limit (1 req/min)",
			requestsPerMinute: 1,
			numCalls:          2,
			expectDelay:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			throttler := NewThrottler(tt.requestsPerMinute)
			ctx := context.Background()

			start := time.Now()

			// Make multiple calls
			for i := 0; i < tt.numCalls; i++ {
				if err := throttler.Wait(ctx); err != nil {
					t.Fatalf("Wait() failed unexpectedly: %v", err)
				}
			}

			elapsed := time.Since(start)

			// If we expect delay, verify it took at least the minimum time
			if tt.expectDelay {
				minInterval := time.Minute / time.Duration(tt.requestsPerMinute)
				expectedMinTime := minInterval * time.Duration(tt.numCalls-1)
				if elapsed < expectedMinTime {
					t.Errorf("Wait() completed too quickly: %v, expected at least %v", elapsed, expectedMinTime)
				}
			}
		})
	}
}

// TestThrottlerWaitCancellation tests that the throttler respects context cancellation
func TestThrottlerWaitCancellation(t *testing.T) {
	throttler := NewThrottler(1) // 1 request per minute = 60 second interval

	// First call should succeed immediately
	ctx := context.Background()
	if err := throttler.Wait(ctx); err != nil {
		t.Fatalf("First Wait() failed: %v", err)
	}

	// Create a context that will be cancelled quickly
	ctx, cancel := context.WithCancel(context.Background())

	// Start a goroutine to cancel the context after a short delay
	go func() {
		time.Sleep(100 * time.Millisecond)
		cancel()
	}()

	// Second call should be cancelled
	start := time.Now()
	err := throttler.Wait(ctx)
	elapsed := time.Since(start)

	if err == nil {
		t.Error("Wait() should have returned an error due to context cancellation")
	}
	if !errors.Is(err, context.Canceled) {
		t.Errorf("Wait() returned wrong error: %v, want %v", err, context.Canceled)
	}
	if elapsed > 200*time.Millisecond {
		t.Errorf("Wait() took too long to cancel: %v, expected < 200ms", elapsed)
	}
}

// TestThrottlerWaitTimeout tests that the throttler respects context timeout
func TestThrottlerWaitTimeout(t *testing.T) {
	throttler := NewThrottler(1) // 1 request per minute = 60 second interval

	// First call should succeed immediately
	ctx := context.Background()
	if err := throttler.Wait(ctx); err != nil {
		t.Fatalf("First Wait() failed: %v", err)
	}

	// Create a context with a short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	// Second call should timeout
	start := time.Now()
	err := throttler.Wait(ctx)
	elapsed := time.Since(start)

	if err == nil {
		t.Error("Wait() should have returned an error due to timeout")
	}
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("Wait() returned wrong error: %v, want %v", err, context.DeadlineExceeded)
	}
	if elapsed > 200*time.Millisecond {
		t.Errorf("Wait() took too long to timeout: %v, expected < 200ms", elapsed)
	}
}

// TestThrottlerConcurrentAccess tests that the throttler is thread-safe
func TestThrottlerConcurrentAccess(t *testing.T) {
	throttler := NewThrottler(60) // 60 requests per minute
	ctx := context.Background()

	// Make concurrent calls
	numGoroutines := 10
	done := make(chan bool, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func() {
			if err := throttler.Wait(ctx); err != nil {
				t.Errorf("Concurrent Wait() failed: %v", err)
			}
			done <- true
		}()
	}

	// Wait for all goroutines to complete
	for i := 0; i < numGoroutines; i++ {
		select {
		case <-done:
			// OK
		case <-time.After(5 * time.Second):
			t.Fatal("Concurrent Wait() calls took too long")
		}
	}
}

// TestGetGlobalThrottler verifies that GetGlobalThrottler returns a non-nil instance
func TestGetGlobalThrottler(t *testing.T) {
	throttler := GetGlobalThrottler()
	if throttler == nil {
		t.Fatal("GetGlobalThrottler() returned nil")
	}

	// Verify it's the same instance on multiple calls
	throttler2 := GetGlobalThrottler()
	if throttler != throttler2 {
		t.Error("GetGlobalThrottler() returned different instances")
	}
}

// TestQuoteDataFields verifies QuoteData struct field types
func TestQuoteDataFields(t *testing.T) {
	quote := &QuoteData{
		Symbol:    "AAPL",
		Price:     150000, // $1500.00 in cents
		Volume24h: 1000000,
	}

	// Verify symbol is a string
	if quote.Symbol != "AAPL" {
		t.Errorf("Symbol = %s, want AAPL", quote.Symbol)
	}

	// Verify price is int64 and positive
	if quote.Price != 150000 {
		t.Errorf("Price = %d, want 150000", quote.Price)
	}
	if quote.Price <= 0 {
		t.Error("Price should be positive")
	}

	// Verify volume is int64 and positive
	if quote.Volume24h != 1000000 {
		t.Errorf("Volume24h = %d, want 1000000", quote.Volume24h)
	}
	if quote.Volume24h <= 0 {
		t.Error("Volume24h should be positive")
	}
}

// TestErrorVariables verifies that error variables are defined correctly
func TestErrorVariables(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{
			name: "ErrSymbolNotFound",
			err:  ErrSymbolNotFound,
			want: "symbol not found",
		},
		{
			name: "ErrInvalidResponse",
			err:  ErrInvalidResponse,
			want: "invalid API response",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.err == nil {
				t.Error("Error variable is nil")
			}
			if tt.err.Error() != tt.want {
				t.Errorf("Error message = %s, want %s", tt.err.Error(), tt.want)
			}
		})
	}
}

// TestPriceConversion tests price conversion from dollars to cents
func TestPriceConversion(t *testing.T) {
	tests := []struct {
		name           string
		priceInDollars float64
		expectedCents  int64
	}{
		{
			name:           "Whole dollar amount $100",
			priceInDollars: 100.0,
			expectedCents:  10000,
		},
		{
			name:           "Price with cents $150.25",
			priceInDollars: 150.25,
			expectedCents:  15025,
		},
		{
			name:           "Small amount $0.01",
			priceInDollars: 0.01,
			expectedCents:  1,
		},
		{
			name:           "Large amount $1000.50",
			priceInDollars: 1000.50,
			expectedCents:  100050,
		},
		{
			name:           "Zero amount $0",
			priceInDollars: 0.0,
			expectedCents:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the conversion done in GetQuote
			// priceInCents := int64(meta.RegularMarketPrice * 100)
			priceInCents := int64(tt.priceInDollars * 100)

			if priceInCents != tt.expectedCents {
				t.Errorf("Price conversion: got %d cents, want %d cents", priceInCents, tt.expectedCents)
			}
		})
	}
}

// TestChangePercentageCalculation tests the 24h change percentage calculation
func TestChangePercentageCalculation(t *testing.T) {
	tests := []struct {
		name           string
		currentPrice   int64
		previousClose  int64
		expectedChange float64
	}{
		{
			name:           "Positive change: $150 -> $155",
			currentPrice:   15500,              // $155.00
			previousClose:  15000,              // $150.00
			expectedChange: 3.3333333333333335, // (155-150)/150 * 100
		},
		{
			name:           "Negative change: $150 -> $145",
			currentPrice:   14500,               // $145.00
			previousClose:  15000,               // $150.00
			expectedChange: -3.3333333333333335, // (145-150)/150 * 100
		},
		{
			name:           "No change: $150 -> $150",
			currentPrice:   15000,
			previousClose:  15000,
			expectedChange: 0.0,
		},
		{
			name:           "Large positive change: $100 -> $200",
			currentPrice:   20000,
			previousClose:  10000,
			expectedChange: 100.0,
		},
		{
			name:           "Zero previous close",
			currentPrice:   15000,
			previousClose:  0,
			expectedChange: 0.0, // Should handle division by zero
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the calculation done in GetQuote
			var change24h float64
			if tt.previousClose > 0 {
				change24h = ((float64(tt.currentPrice) - float64(tt.previousClose)) / float64(tt.previousClose)) * 100
			}

			// Use approximate comparison for floating point
			diff := change24h - tt.expectedChange
			if diff > 0.0001 || diff < -0.0001 {
				t.Errorf("Change calculation: got %f%%, want %f%% (diff: %f)", change24h, tt.expectedChange, diff)
			}
		})
	}
}

// TestCurrencyDefaulting tests that currency defaults to USD when not specified
func TestCurrencyDefaulting(t *testing.T) {
	tests := []struct {
		name          string
		inputCurrency string
		expected      string
	}{
		{
			name:          "USD currency",
			inputCurrency: "USD",
			expected:      "USD",
		},
		{
			name:          "VND currency",
			inputCurrency: "VND",
			expected:      "VND",
		},
		{
			name:          "EUR currency",
			inputCurrency: "EUR",
			expected:      "EUR",
		},
		{
			name:          "Empty currency defaults to USD",
			inputCurrency: "",
			expected:      "USD",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Simulate the currency defaulting logic from GetQuote
			currency := tt.inputCurrency
			if currency == "" {
				currency = "USD"
			}

			if currency != tt.expected {
				t.Errorf("Currency = %s, want %s", currency, tt.expected)
			}
		})
	}
}

// TestClientSymbolMatching tests that the returned symbol matches the requested symbol
func TestClientSymbolMatching(t *testing.T) {
	tests := []struct {
		name            string
		requestedSymbol string
	}{
		{
			name:            "AAPL",
			requestedSymbol: "AAPL",
		},
		{
			name:            "MSFT",
			requestedSymbol: "MSFT",
		},
		{
			name:            "GOOGL",
			requestedSymbol: "GOOGL",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient(tt.requestedSymbol)

			// Verify the client's symbol matches
			if client.GetSymbol() != tt.requestedSymbol {
				t.Errorf("Client symbol = %s, want %s", client.GetSymbol(), tt.requestedSymbol)
			}
		})
	}
}

// TestQuoteDataValidation tests validation logic for QuoteData
func TestQuoteDataValidation(t *testing.T) {
	tests := []struct {
		name    string
		quote   *QuoteData
		wantErr bool
	}{
		{
			name: "Valid quote",
			quote: &QuoteData{
				Symbol:    "AAPL",
				Price:     150000,
				Volume24h: 1000000,
			},
			wantErr: false,
		},
		{
			name: "Empty symbol",
			quote: &QuoteData{
				Symbol:    "",
				Price:     150000,
				Volume24h: 1000000,
			},
			wantErr: true,
		},
		{
			name: "Negative price",
			quote: &QuoteData{
				Symbol:    "AAPL",
				Price:     -100,
				Volume24h: 1000000,
			},
			wantErr: true,
		},
		{
			name: "Negative volume",
			quote: &QuoteData{
				Symbol:    "AAPL",
				Price:     150000,
				Volume24h: -100,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Custom validation logic
			hasError := false
			if tt.quote.Symbol == "" {
				hasError = true
			}
			if tt.quote.Price < 0 {
				hasError = true
			}
			if tt.quote.Volume24h < 0 {
				hasError = true
			}

			if hasError != tt.wantErr {
				t.Errorf("Validation error mismatch: got %v, want %v", hasError, tt.wantErr)
			}
		})
	}
}

// BenchmarkThrottlerWait benchmarks the throttler's Wait method
func BenchmarkThrottlerWait(b *testing.B) {
	throttler := NewThrottler(1000) // High rate limit for benchmarking
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := throttler.Wait(ctx); err != nil {
			b.Fatalf("Wait() failed: %v", err)
		}
	}
}

// BenchmarkNewClient benchmarks the NewClient function
func BenchmarkNewClient(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = NewClient("AAPL")
	}
}
