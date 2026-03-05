# Yahoo Finance Quote API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a new quote method using Yahoo Finance's v7 quote API that provides richer market data (currency, change percentages, previous close, etc.) to replace the current limited quote functionality.

**Architecture:** Add a new `GetQuote` function to the `yahoo` package that calls Yahoo Finance's v7 quote API directly (similar to the existing `SearchSymbols` pattern). The method will parse the JSON response into a new `QuoteResult` struct with comprehensive market data fields. This will be integrated into the `MarketDataService` to replace the current limited quote fetch.

**Tech Stack:** Go 1.23, Yahoo Finance v7 API (https://query2.finance.yahoo.com/v7/finance/quote), existing throttler for rate limiting

---

## Background Context

**Current State:**

- The existing `Client.GetQuote()` in `client.go` uses the `github.com/oscarli916/yahoo-finance-api` package
- It only returns: `Symbol`, `Price` (in cents), `Volume24h`
- Missing: currency, change percent, previous close, market state, exchange info, etc.

**Target State:**

- New `GetQuote()` function in `search.go` (or new `quote.go`) that calls Yahoo Finance v7 API directly
- Returns comprehensive data: price, currency, change, change percent, previous close, market state, exchange timezone, etc.
- Uses same patterns as `SearchSymbols`: rate limiting, context timeout, HTTP client with proper headers

**API Endpoint:**

```
https://query2.finance.yahoo.com/v7/finance/quote?symbols={SYMBOL}&fields=...
```

**Response Structure:**

```json
{
  "quoteResponse": {
    "result": [
      {
        "currency": "VND",
        "regularMarketPrice": 69600,
        "regularMarketChange": -1000,
        "regularMarketChangePercent": -1.4164306,
        "regularMarketPreviousClose": 70600,
        "regularMarketTime": 1769586317,
        "marketState": "POST",
        "exchange": "VSE",
        "exchangeTimezoneName": "Asia/Bangkok",
        "symbol": "VCB.VN"
      }
    ],
    "error": null
  }
}
```

---

## Task 1: Add QuoteResult Struct

**Files:**

- Create: `src/go-backend/pkg/yahoo/quote.go`

**Step 1: Create the file and add QuoteResult struct**

```go
package yahoo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// QuoteResult represents a comprehensive quote result from Yahoo Finance v7 API
type QuoteResult struct {
	Symbol                    string  `json:"symbol"`
	Currency                  string  `json:"currency"`
	RegularMarketPrice        float64 `json:"regularMarketPrice"`
	RegularMarketChange       float64 `json:"regularMarketChange"`
	RegularMarketChangePercent float64 `json:"regularMarketChangePercent"`
	RegularMarketPreviousClose float64 `json:"regularMarketPreviousClose"`
	RegularMarketTime         int64   `json:"regularMarketTime"`
	MarketState               string  `json:"marketState"`
	Exchange                  string  `json:"exchange"`
	ExchangeTimezoneName      string  `json:"exchangeTimezoneName"`
	ExchangeTimezoneShortName string  `json:"exchangeTimezoneShortName"`
	GmtOffSetMilliseconds     int64   `json:"gmtOffSetMilliseconds"`
	PriceHint                 int     `json:"priceHint"`
	FullExchangeName          string  `json:"fullExchangeName"`
	QuoteType                 string  `json:"quoteType"`
}

type yahooQuoteResponse struct {
	QuoteResponse struct {
		Result []json.RawMessage `json:"result"`
		Error  *struct {
			Code        string `json:"code"`
			Description string `json:"description"`
		} `json:"error"`
	} `json:"quoteResponse"`
}
```

**Step 2: Run gofmt to verify formatting**

```bash
cd /Users/admin/Desktop/khanh/workspace/Personal_Financial_Management/src/go-backend && gofmt -l pkg/yahoo/quote.go
```

Expected: No output (file is properly formatted)

---

## Task 2: Implement buildQuoteURL Function

**Files:**

- Modify: `src/go-backend/pkg/yahoo/quote.go`

**Step 1: Add the buildQuoteURL function**

```go
// Add after the struct definitions

// buildQuoteURL constructs the URL for Yahoo Finance v7 quote API
func buildQuoteURL(symbol string) string {
	baseURL := "https://query2.finance.yahoo.com/v7/finance/quote"
	values := url.Values{}

	// Fields to request - comprehensive list for market data
	fields := []string{
		"currency",
		"fromCurrency",
		"toCurrency",
		"exchangeTimezoneName",
		"exchangeTimezoneShortName",
		"gmtOffSetMilliseconds",
		"regularMarketChange",
		"regularMarketChangePercent",
		"regularMarketPrice",
		"regularMarketTime",
		"preMarketChange",
		"preMarketChangePercent",
		"preMarketPrice",
		"preMarketTime",
		"priceHint",
		"postMarketChange",
		"postMarketChangePercent",
		"postMarketPrice",
		"postMarketTime",
		"extendedMarketChange",
		"extendedMarketChangePercent",
		"extendedMarketPrice",
		"extendedMarketTime",
		"overnightMarketChange",
		"overnightMarketChangePercent",
		"overnightMarketPrice",
		"overnightMarketTime",
	}

	values.Set("symbols", symbol)
	values.Set("fields", strings.Join(fields, ","))
	values.Set("formatted", "false")
	values.Set("region", "US")
	values.Set("lang", "en-US")

	return fmt.Sprintf("%s?%s", baseURL, values.Encode())
}
```

**Step 2: Run gofmt**

```bash
cd /Users/admin/Desktop/khanh/workspace/Personal_Financial_Management/src/go-backend && gofmt -w pkg/yahoo/quote.go
```

---

## Task 3: Implement GetQuote Function

**Files:**

- Modify: `src/go-backend/pkg/yahoo/quote.go`

**Step 1: Add the GetQuote function**

```go
// Add after buildQuoteURL function

// GetQuote fetches comprehensive quote data for a single symbol
// Uses Yahoo Finance v7 quote API with rate limiting
func GetQuote(ctx context.Context, symbol string) (*QuoteResult, error) {
	symbol = strings.TrimSpace(symbol)
	if symbol == "" {
		return nil, fmt.Errorf("symbol cannot be empty")
	}

	// Respect rate limiting
	if err := GetGlobalThrottler().Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limit wait failed: %w", err)
	}

	quoteURL := buildQuoteURL(symbol)
	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, "GET", quoteURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var yahooResp yahooQuoteResponse
	if err := json.Unmarshal(body, &yahooResp); err != nil {
		return nil, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	// Check for API errors
	if yahooResp.QuoteResponse.Error != nil {
		return nil, fmt.Errorf("API error: %s - %s", yahooResp.QuoteResponse.Error.Code, yahooResp.QuoteResponse.Error.Description)
	}

	// Check if we got results
	if len(yahooResp.QuoteResponse.Result) == 0 {
		return nil, ErrSymbolNotFound
	}

	// Parse the first result
	var result QuoteResult
	if err := json.Unmarshal(yahooResp.QuoteResponse.Result[0], &result); err != nil {
		return nil, fmt.Errorf("failed to parse quote result: %w", err)
	}

	return &result, nil
}
```

**Step 2: Run gofmt**

```bash
cd /Users/admin/Desktop/khanh/workspace/Personal_Financial_Management/src/go-backend && gofmt -w pkg/yahoo/quote.go
```

**Step 2: Verify no compilation errors**

```bash
cd /Users/admin/Desktop/khanh/workspace/Personal_Financial_Management/src/go-backend && go build -o /dev/null ./pkg/yahoo/...
```

Expected: No errors

---

## Task 4: Add GetQuoteBatch Function for Multiple Symbols

**Files:**

- Modify: `src/go-backend/pkg/yahoo/quote.go`

**Step 1: Add the GetQuoteBatch function**

```go
// Add after GetQuote function

// buildQuoteURLForMultiple constructs URL for multiple symbols
func buildQuoteURLForMultiple(symbols []string) string {
	baseURL := "https://query2.finance.yahoo.com/v7/finance/quote"
	values := url.Values{}

	// Same fields as single quote
	fields := []string{
		"currency",
		"fromCurrency",
		"toCurrency",
		"exchangeTimezoneName",
		"exchangeTimezoneShortName",
		"gmtOffSetMilliseconds",
		"regularMarketChange",
		"regularMarketChangePercent",
		"regularMarketPrice",
		"regularMarketTime",
		"preMarketChange",
		"preMarketChangePercent",
		"preMarketPrice",
		"preMarketTime",
		"priceHint",
		"postMarketChange",
		"postMarketChangePercent",
		"postMarketPrice",
		"postMarketTime",
		"extendedMarketChange",
		"extendedMarketChangePercent",
		"extendedMarketPrice",
		"extendedMarketTime",
		"overnightMarketChange",
		"overnightMarketChangePercent",
		"overnightMarketPrice",
		"overnightMarketTime",
	}

	values.Set("symbols", strings.Join(symbols, ","))
	values.Set("fields", strings.Join(fields, ","))
	values.Set("formatted", "false")
	values.Set("region", "US")
	values.Set("lang", "en-US")

	return fmt.Sprintf("%s?%s", baseURL, values.Encode())
}

// GetQuoteBatch fetches quotes for multiple symbols in a single API call
// Returns a map of symbol to QuoteResult
func GetQuoteBatch(ctx context.Context, symbols []string) (map[string]*QuoteResult, error) {
	if len(symbols) == 0 {
		return nil, fmt.Errorf("symbols list cannot be empty")
	}

	// Clean and validate symbols
	var cleanedSymbols []string
	for _, s := range symbols {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		cleanedSymbols = append(cleanedSymbols, s)
	}

	if len(cleanedSymbols) == 0 {
		return nil, fmt.Errorf("no valid symbols provided")
	}

	// Respect rate limiting
	if err := GetGlobalThrottler().Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limit wait failed: %w", err)
	}

	quoteURL := buildQuoteURLForMultiple(cleanedSymbols)
	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, "GET", quoteURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var yahooResp yahooQuoteResponse
	if err := json.Unmarshal(body, &yahooResp); err != nil {
		return nil, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	// Check for API errors
	if yahooResp.QuoteResponse.Error != nil {
		return nil, fmt.Errorf("API error: %s - %s", yahooResp.QuoteResponse.Error.Code, yahooResp.QuoteResponse.Error.Description)
	}

	// Parse results into a map
	results := make(map[string]*QuoteResult)
	for _, rawResult := range yahooResp.QuoteResponse.Result {
		var quote QuoteResult
		if err := json.Unmarshal(rawResult, &quote); err != nil {
			// Skip invalid results but continue parsing others
			continue
		}
		results[quote.Symbol] = &quote
	}

	return results, nil
}
```

**Step 2: Run gofmt**

```bash
cd /Users/admin/Desktop/khanh/workspace/Personal_Financial_Management/src/go-backend && gofmt -w pkg/yahoo/quote.go
```

**Step 2: Verify no compilation errors**

```bash
go build -o /dev/null ./pkg/yahoo/...
```

---

## Task 5: Write Unit Tests for buildQuoteURL

**Files:**

- Create: `src/go-backend/pkg/yahoo/quote_test.go`

**Step 1: Write the failing test**

```go
package yahoo

import (
	"net/url"
	"strings"
	"testing"
)

func TestBuildQuoteURL(t *testing.T) {
	tests := []struct {
		name           string
		symbol         string
		expectedSymbol string
		hasFields      bool
	}{
		{
			name:           "Valid symbol AAPL",
			symbol:         "AAPL",
			expectedSymbol: "AAPL",
			hasFields:      true,
		},
		{
			name:           "Vietnamese stock VCB.VN",
			symbol:         "VCB.VN",
			expectedSymbol: "VCB.VN",
			hasFields:      true,
		},
		{
			name:           "Crypto BTC-USD",
			symbol:         "BTC-USD",
			expectedSymbol: "BTC-USD",
			hasFields:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			urlStr := buildQuoteURL(tt.symbol)

			// Parse URL to verify components
			parsedURL, err := url.Parse(urlStr)
			if err != nil {
				t.Fatalf("Failed to parse URL: %v", err)
			}

			// Check base URL
			if parsedURL.Host != "query2.finance.yahoo.com" {
				t.Errorf("Host = %s, want query2.finance.yahoo.com", parsedURL.Host)
			}
			if parsedURL.Path != "/v7/finance/quote" {
				t.Errorf("Path = %s, want /v7/finance/quote", parsedURL.Path)
			}

			// Check symbols parameter
			symbols := parsedURL.Query().Get("symbols")
			if symbols != tt.expectedSymbol {
				t.Errorf("symbols = %s, want %s", symbols, tt.expectedSymbol)
			}

			// Check fields parameter
			fields := parsedURL.Query().Get("fields")
			if tt.hasFields && fields == "" {
				t.Error("fields parameter should not be empty")
			}
			if tt.hasFields && !strings.Contains(fields, "regularMarketPrice") {
				t.Error("fields should contain regularMarketPrice")
			}
			if tt.hasFields && !strings.Contains(fields, "regularMarketChange") {
				t.Error("fields should contain regularMarketChange")
			}

			// Check other parameters
			formatted := parsedURL.Query().Get("formatted")
			if formatted != "false" {
				t.Errorf("formatted = %s, want false", formatted)
			}

			region := parsedURL.Query().Get("region")
			if region != "US" {
				t.Errorf("region = %s, want US", region)
			}

			lang := parsedURL.Query().Get("lang")
			if lang != "en-US" {
				t.Errorf("lang = %s, want en-US", lang)
			}
		})
	}
}
```

**Step 2: Run test to verify it passes**

```bash
go test -v ./pkg/yahoo/ -run TestBuildQuoteURL
```

Expected: PASS

---

## Task 6: Write Integration Tests for GetQuote

**Files:**

- Modify: `src/go-backend/pkg/yahoo/quote_test.go`

**Step 1: Write the failing test (skip with -short flag)**

```go
// Add to quote_test.go

func TestGetQuote_ValidSymbol(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()

	tests := []struct {
		name   string
		symbol string
	}{
		{
			name:   "Apple stock",
			symbol: "AAPL",
		},
		{
			name:   "Vietnamese stock VCB",
			symbol: "VCB.VN",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			quote, err := GetQuote(ctx, tt.symbol)
			if err != nil {
				t.Fatalf("GetQuote() error = %v", err)
			}

			// Verify required fields
			if quote.Symbol != tt.symbol {
				t.Errorf("Symbol = %s, want %s", quote.Symbol, tt.symbol)
			}

			if quote.RegularMarketPrice == 0 {
				t.Error("RegularMarketPrice should not be zero")
			}

			if quote.Currency == "" {
				t.Error("Currency should not be empty")
			}
		})
	}
}

func TestGetQuote_EmptySymbol(t *testing.T) {
	ctx := context.Background()
	_, err := GetQuote(ctx, "")
	if err == nil {
		t.Error("GetQuote() should return error for empty symbol")
	}
}

func TestGetQuote_InvalidSymbol(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	_, err := GetQuote(ctx, "INVALIDSYMBOL123XYZ")
	if err == nil {
		t.Error("GetQuote() should return error for invalid symbol")
	}
	if err != ErrSymbolNotFound {
		t.Errorf("Expected ErrSymbolNotFound, got: %v", err)
	}
}
```

**Step 2: Run test with -short to verify skip works**

```bash
go test -v -short ./pkg/yahoo/ -run TestGetQuote
```

Expected: Tests are skipped

**Step 2: Run integration test (make sure you have internet)**

```bash
go test -v ./pkg/yahoo/ -run TestGetQuote
```

Expected: Tests pass (may take a few seconds)

---

## Task 7: Write Tests for GetQuoteBatch

**Files:**

- Modify: `src/go-backend/pkg/yahoo/quote_test.go`

**Step 1: Write the failing test**

```go
// Add to quote_test.go

func TestGetQuoteBatch_ValidSymbols(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	symbols := []string{"AAPL", "MSFT", "GOOGL"}

	results, err := GetQuoteBatch(ctx, symbols)
	if err != nil {
		t.Fatalf("GetQuoteBatch() error = %v", err)
	}

	// Verify we got results for all symbols
	for _, symbol := range symbols {
		quote, exists := results[symbol]
		if !exists {
			t.Errorf("Missing result for symbol %s", symbol)
			continue
		}

		if quote.Symbol != symbol {
			t.Errorf("Result symbol = %s, want %s", quote.Symbol, symbol)
		}

		if quote.RegularMarketPrice == 0 {
			t.Errorf("RegularMarketPrice should not be zero for %s", symbol)
		}
	}
}

func TestGetQuoteBatch_EmptyList(t *testing.T) {
	ctx := context.Background()
	_, err := GetQuoteBatch(ctx, []string{})
	if err == nil {
		t.Error("GetQuoteBatch() should return error for empty list")
	}
}

func TestGetQuoteBatch_OnlyEmptyStrings(t *testing.T) {
	ctx := context.Background()
	_, err := GetQuoteBatch(ctx, []string{"", "  ", ""})
	if err == nil {
		t.Error("GetQuoteBatch() should return error for list with only empty strings")
	}
}
```

**Step 2: Run test with -short**

```bash
go test -v -short ./pkg/yahoo/ -run TestGetQuoteBatch
```

Expected: Tests are skipped

**Step 2: Run integration test**

```bash
go test -v ./pkg/yahoo/ -run TestGetQuoteBatch
```

Expected: Tests pass

---

## Task 8: Update MarketDataService to Use New GetQuote

**Files:**

- Modify: `src/go-backend/domain/service/market_data_service.go`

**Step 1: Update fetchPriceFromAPI to use new GetQuote**

Find the `fetchPriceFromAPI` function and replace it with:

```go
// fetchPriceFromAPI fetches price data from Yahoo Finance API.
// Uses the new v7 quote API which provides comprehensive market data.
func (s *marketDataService) fetchPriceFromAPI(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
	// Use new GetQuote function for comprehensive data
	quote, err := yahoo.GetQuote(ctx, symbol)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch quote for %s: %w", symbol, err)
	}

	// Convert price from float to int64 (smallest currency unit)
	// For VND: 69600.00 -> 6960000 (multiply by 100 for 2 decimal places)
	// For USD: 150.25 -> 15025
	priceInSmallestUnit := int64(quote.RegularMarketPrice * 100)

	// Use quote's currency if available, otherwise fall back to investment's currency
	fetchedCurrency := quote.Currency
	if fetchedCurrency == "" {
		fetchedCurrency = currency
	}

	return &models.MarketData{
		Symbol:    quote.Symbol,
		Currency:  fetchedCurrency,
		Price:     priceInSmallestUnit,
		Change24h: quote.RegularMarketChangePercent,
		Volume24h: 0, // Not provided by v7 quote API in current field set
		Timestamp: time.Now(),
	}, nil
}
```

**Step 2: Verify compilation**

```bash
go build -o /dev/null ./domain/service/...
```

---

## Task 9: Add Batch Quote Fetching to MarketDataService

**Files:**

- Modify: `src/go-backend/domain/service/market_data_service.go`

**Step 1: Add new method to MarketDataService interface**

Update the interface:

```go
type MarketDataService interface {
	// GetPrice retrieves the current price for a symbol, using cache if fresh.
	GetPrice(ctx context.Context, symbol, currency string, maxAge time.Duration) (*models.MarketData, error)

	// UpdatePricesForInvestments updates prices for multiple investments.
	UpdatePricesForInvestments(ctx context.Context, investments []*models.Investment, forceRefresh bool) (map[int32]int64, error)

	// SearchSymbols searches for investment symbols by query.
	SearchSymbols(ctx context.Context, query string, limit int) ([]yahoo.SearchResult, error)

	// GetPriceBatch fetches prices for multiple symbols in a single API call.
	GetPriceBatch(ctx context.Context, symbols []string) (map[string]*models.MarketData, error)
}
```

**Step 2: Implement GetPriceBatch**

Add to marketDataService:

```go
// GetPriceBatch fetches prices for multiple symbols in a single API call.
// Returns a map of symbol to MarketData.
func (s *marketDataService) GetPriceBatch(ctx context.Context, symbols []string) (map[string]*models.MarketData, error) {
	if len(symbols) == 0 {
		return nil, apperrors.NewValidationError("symbols list cannot be empty")
	}

	// Use batch quote API
	quotes, err := yahoo.GetQuoteBatch(ctx, symbols)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch batch quotes: %w", err)
	}

	// Convert to MarketData
	results := make(map[string]*models.MarketData)
	for _, quote := range quotes {
		priceInSmallestUnit := int64(quote.RegularMarketPrice * 100)
		results[quote.Symbol] = &models.MarketData{
			Symbol:    quote.Symbol,
			Currency:  quote.Currency,
			Price:     priceInSmallestUnit,
			Change24h: quote.RegularMarketChangePercent,
			Volume24h: 0,
			Timestamp: time.Now(),
		}
	}

	return results, nil
}
```

**Step 2: Verify compilation**

```bash
go build -o /dev/null ./domain/service/...
```

---

## Task 10: Update service/interfaces.go

**Files:**

- Modify: `src/go-backend/domain/service/interfaces.go`

**Step 1: Check if MarketDataService interface needs updating**

```bash
grep -n "MarketDataService" src/go-backend/domain/service/interfaces.go
```

If the interface exists there, update it to match the new method.

**Step 2: Verify compilation**

```bash
go build -o /dev/null ./domain/service/...
```

---

## Task 11: Add Helper Function for Price Conversion

**Files:**

- Modify: `src/go-backend/pkg/yahoo/quote.go`

**Step 1: Add ToSmallestCurrencyUnit helper**

```go
// Add after GetQuoteBatch function

// ToSmallestCurrencyUnit converts a float price to int64 in smallest currency unit.
// For example: 150.25 USD -> 15025 (cents), 69600 VND -> 6960000 (smallest unit).
// Uses the priceHint field from Yahoo Finance to determine decimal places.
func ToSmallestCurrencyUnit(price float64, priceHint int) int64 {
	// priceHint indicates the number of decimal places
	// 2 = 2 decimal places (cents), 0 = whole numbers
	decimalPlaces := 2 // default to 2 decimal places
	if priceHint > 0 && priceHint <= 8 {
		decimalPlaces = priceHint
	}

	multiplier := 1
	for i := 0; i < decimalPlaces; i++ {
		multiplier *= 10
	}

	return int64(price * float64(multiplier))
}
```

**Step 2: Add test for the helper**

```go
// Add to quote_test.go

func TestToSmallestCurrencyUnit(t *testing.T) {
	tests := []struct {
		name       string
		price      float64
		priceHint  int
		expected   int64
	}{
		{
			name:      "USD price $150.25 with 2 decimals",
			price:     150.25,
			priceHint: 2,
			expected:  15025,
		},
		{
			name:      "VND price 69600 with 2 decimals",
			price:     69600.00,
			priceHint: 2,
			expected:  6960000,
		},
		{
			name:      "Whole number price 100 with 2 decimals",
			price:     100.00,
			priceHint: 2,
			expected:  10000,
		},
		{
			name:      "Price with 4 decimal places (crypto)",
			price:     1.2345,
			priceHint: 4,
			expected:  12345,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ToSmallestCurrencyUnit(tt.price, tt.priceHint)
			if result != tt.expected {
				t.Errorf("ToSmallestCurrencyUnit() = %d, want %d", result, tt.expected)
			}
		})
	}
}
```

**Step 2: Run tests**

```bash
go test -v ./pkg/yahoo/ -run TestToSmallestCurrencyUnit
```

---

## Task 12: Update MarketDataService to Use Helper Function

**Files:**

- Modify: `src/go-backend/domain/service/market_data_service.go`

**Step 1: Update fetchPriceFromAPI and GetPriceBatch**

Replace manual price conversion with the helper function:

```go
// In fetchPriceFromAPI
priceInSmallestUnit := yahoo.ToSmallestCurrencyUnit(quote.RegularMarketPrice, quote.PriceHint)

// In GetPriceBatch
priceInSmallestUnit := yahoo.ToSmallestCurrencyUnit(quote.RegularMarketPrice, quote.PriceHint)
```

**Step 2: Verify compilation**

```bash
go build -o /dev/null ./domain/service/...
```

---

## Task 13: Run All Tests

**Files:** N/A (validation step)

**Step 1: Run all yahoo package tests**

```bash
go test -v ./pkg/yahoo/...
```

Expected: All tests pass

**Step 2: Run service tests**

```bash
go test -v ./domain/service/...
```

Expected: All tests pass

**Step 2: Run integration tests (if you have internet)**

```bash
go test -v -tags=integration ./pkg/yahoo/...
go test -v -tags=integration ./domain/service/...
```

Expected: Integration tests pass

---

## Task 14: Update Documentation

**Files:**

- Modify: `docs/plans/2026-01-28-yahoo-finance-quote-api.md` (this file)
- Create: `src/go-backend/pkg/yahoo/README.md` (if it doesn't exist)

**Step 1: Create/update README for yahoo package**

````bash
cat > src/go-backend/pkg/yahoo/README.md << 'EOF'
# Yahoo Finance API Package

This package provides integration with Yahoo Finance's public APIs for financial market data.

## Features

- **Symbol Search**: Search for stocks, ETFs, crypto, and more by symbol or company name
- **Quote Fetching**: Get comprehensive quote data including price, change, volume, etc.
- **Batch Quotes**: Fetch multiple symbols in a single API call
- **Rate Limiting**: Built-in throttler to respect API limits (120 req/min)

## Usage

### Search for Symbols

```go
import "wealthjourney/pkg/yahoo"

results, err := yahoo.SearchSymbols(ctx, "AAPL", 10)
````

### Get Single Quote

```go
quote, err := yahoo.GetQuote(ctx, "VCB.VN")
// Returns: price, currency, change percent, market state, etc.
```

### Get Multiple Quotes

```go
symbols := []string{"AAPL", "MSFT", "GOOGL"}
quotes, err := yahoo.GetQuoteBatch(ctx, symbols)
// Returns: map[symbol]*QuoteResult
```

## Data Structures

### SearchResult

- Symbol, Name, Type, Exchange

### QuoteResult

- Symbol, Currency
- RegularMarketPrice, RegularMarketChange, RegularMarketChangePercent
- RegularMarketPreviousClose, RegularMarketTime
- MarketState, Exchange, ExchangeTimezoneName

## Configuration

Rate limiting is handled automatically via the global throttler:

- Default: 120 requests per minute
- Configurable via environment: `YAHOO_FINANCE_REQUESTS_PER_MIN`

## Testing

```bash
# Unit tests only (fast)
go test -short ./pkg/yahoo/...

# Integration tests (requires internet)
go test ./pkg/yahoo/...
```

EOF

````

---

## Task 15: Verify Full Build

**Files:** N/A (validation step)

**Step 1: Build the entire backend**

```bash
cd src/go-backend
go build -o /dev/null ./...
````

Expected: No compilation errors

**Step 2: Run all tests**

```bash
go test -short ./...
```

Expected: All tests pass

---

## Summary

This implementation adds comprehensive quote functionality using Yahoo Finance's v7 quote API:

1. **New QuoteResult struct** with comprehensive market data fields
2. **GetQuote()** function for single symbol quotes
3. **GetQuoteBatch()** function for efficient multi-symbol quotes
4. **Proper rate limiting** using existing global throttler
5. **Error handling** for invalid symbols and API errors
6. **Helper functions** for price conversion
7. **Integration** with existing MarketDataService
8. **Comprehensive tests** including unit and integration tests

The implementation follows the existing patterns in the `yahoo` package (similar to `SearchSymbols`) and integrates seamlessly with the current architecture.
