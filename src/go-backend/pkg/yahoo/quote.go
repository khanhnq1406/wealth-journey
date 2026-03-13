package yahoo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// QuoteResult represents a comprehensive quote result from Yahoo Finance v8 chart API
type QuoteResult struct {
	Symbol                     string  `json:"symbol"`
	Currency                   string  `json:"currency"`
	RegularMarketPrice         float64 `json:"regularMarketPrice"`
	RegularMarketChange        float64 `json:"regularMarketChange"`
	RegularMarketChangePercent float64 `json:"regularMarketChangePercent"`
	RegularMarketPreviousClose float64 `json:"regularMarketPreviousClose"`
	RegularMarketTime          int64   `json:"regularMarketTime"`
	MarketState                string  `json:"marketState"`
	Exchange                   string  `json:"exchange"`
	ExchangeTimezoneName       string  `json:"exchangeTimezoneName"`
	ExchangeTimezoneShortName  string  `json:"exchangeTimezoneShortName"`
	GmtOffSetMilliseconds      int64   `json:"gmtOffSetMilliseconds"`
	PriceHint                  int     `json:"priceHint"`
	FullExchangeName           string  `json:"fullExchangeName"`
	QuoteType                  string  `json:"quoteType"`
}

// yahooChartResponse represents the response from Yahoo Finance v8 chart API
type yahooChartResponse struct {
	Chart struct {
		Result []struct {
			Meta struct {
				Currency             string  `json:"currency"`
				Symbol               string  `json:"symbol"`
				ExchangeName         string  `json:"exchangeName"`
				FullExchangeName     string  `json:"fullExchangeName"`
				InstrumentType       string  `json:"instrumentType"`
				RegularMarketPrice   float64 `json:"regularMarketPrice"`
				ChartPreviousClose   float64 `json:"chartPreviousClose"`
				PreviousClose        float64 `json:"previousClose"`
				RegularMarketTime    int64   `json:"regularMarketTime"`
				Timezone             string  `json:"timezone"`
				ExchangeTimezoneName string  `json:"exchangeTimezoneName"`
				GmtOffset            int64   `json:"gmtoffset"`
				PriceHint            int     `json:"priceHint"`
			} `json:"meta"`
		} `json:"result"`
		Error *struct {
			Code        string `json:"code"`
			Description string `json:"description"`
		} `json:"error"`
	} `json:"chart"`
}

// buildChartURL constructs the URL for Yahoo Finance v8 chart API
func buildChartURL(symbol string) string {
	baseURL := "https://query1.finance.yahoo.com/v8/finance/chart/" + url.PathEscape(symbol)
	values := url.Values{}
	values.Set("interval", "1d")
	values.Set("range", "1d")
	return fmt.Sprintf("%s?%s", baseURL, values.Encode())
}

// GetQuote fetches comprehensive quote data for a single symbol
// Uses Yahoo Finance v8 chart API with rate limiting (no authentication required)
func GetQuote(ctx context.Context, symbol string) (*QuoteResult, error) {
	symbol = strings.TrimSpace(symbol)
	if symbol == "" {
		return nil, fmt.Errorf("symbol cannot be empty")
	}

	// Respect rate limiting
	if err := GetGlobalThrottler().Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limit wait failed: %w", err)
	}

	chartURL := buildChartURL(symbol)
	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, "GET", chartURL, nil)
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
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrSymbolNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var chartResp yahooChartResponse
	if err := json.Unmarshal(body, &chartResp); err != nil {
		return nil, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	// Check for API errors
	if chartResp.Chart.Error != nil {
		return nil, fmt.Errorf("API error: %s - %s", chartResp.Chart.Error.Code, chartResp.Chart.Error.Description)
	}

	// Check if we got results
	if len(chartResp.Chart.Result) == 0 {
		return nil, ErrSymbolNotFound
	}

	meta := chartResp.Chart.Result[0].Meta

	// Calculate change percent from previous close
	var changePercent float64
	if meta.PreviousClose > 0 {
		changePercent = ((meta.RegularMarketPrice - meta.PreviousClose) / meta.PreviousClose) * 100
	}

	return &QuoteResult{
		Symbol:                     meta.Symbol,
		Currency:                   meta.Currency,
		RegularMarketPrice:         meta.RegularMarketPrice,
		RegularMarketChange:        meta.RegularMarketPrice - meta.PreviousClose,
		RegularMarketChangePercent: changePercent,
		RegularMarketPreviousClose: meta.PreviousClose,
		RegularMarketTime:          meta.RegularMarketTime,
		Exchange:                   meta.ExchangeName,
		ExchangeTimezoneName:       meta.ExchangeTimezoneName,
		GmtOffSetMilliseconds:      meta.GmtOffset * 1000,
		PriceHint:                  meta.PriceHint,
		FullExchangeName:           meta.FullExchangeName,
		QuoteType:                  meta.InstrumentType,
	}, nil
}

// GetQuoteBatch fetches quotes for multiple symbols by making individual chart API calls.
// Returns a map of symbol to QuoteResult. Symbols that fail to fetch are silently omitted.
// The map may contain fewer entries than the number of input symbols.
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

	// Fetch each symbol individually using the chart API
	results := make(map[string]*QuoteResult)
	for _, symbol := range cleanedSymbols {
		quote, err := GetQuote(ctx, symbol)
		if err != nil {
			// Skip failed symbols but continue with others
			continue
		}
		results[quote.Symbol] = quote
	}

	return results, nil
}

// currencyDecimalPlaces maps ISO 4217 currency codes to their decimal places
var currencyDecimalPlaces = map[string]int{
	// Zero decimal currencies
	"VND": 0, // Vietnamese Dong
	"JPY": 0, // Japanese Yen
	"KRW": 0, // Korean Won
	"IDR": 0, // Indonesian Rupiah
	"CLP": 0, // Chilean Peso

	// Two decimal currencies (most common)
	"USD": 2, // US Dollar
	"EUR": 2, // Euro
	"GBP": 2, // British Pound
	"AUD": 2, // Australian Dollar
	"CAD": 2, // Canadian Dollar
	"CHF": 2, // Swiss Franc
	"CNY": 2, // Chinese Yuan
	"HKD": 2, // Hong Kong Dollar
	"SGD": 2, // Singapore Dollar
	"TWD": 2, // Taiwan Dollar
	"INR": 2, // Indian Rupee
	"MXN": 2, // Mexican Peso
	"BRL": 2, // Brazilian Real
	"THB": 2, // Thai Baht

	// Three decimal currencies
	"KWD": 3, // Kuwaiti Dinar
	"BHD": 3, // Bahraini Dinar
	"OMR": 3, // Omani Rial
}

// GetCurrencyDecimalPlaces returns the number of decimal places for a currency
func GetCurrencyDecimalPlaces(currency string) int {
	if decimals, ok := currencyDecimalPlaces[currency]; ok {
		return decimals
	}
	return 2 // Default to 2 decimal places for unknown currencies
}

// ToSmallestCurrencyUnit converts a float price to int64 in smallest currency unit.
// For example: 150.25 USD -> 15025 (cents), 69800 VND -> 69800 (no conversion needed).
// Uses currency-based decimal places (priceHint is ignored as it's for display only).
func ToSmallestCurrencyUnit(price float64, priceHint int) int64 {
	// Note: priceHint is kept for backward compatibility but ignored
	// Use ToSmallestCurrencyUnitByCurrency for currency-aware conversion
	return int64(price * 100) // Default behavior for backward compatibility
}

// ToSmallestCurrencyUnitByCurrency converts a float price to int64 based on currency.
// For example: 150.25 USD -> 15025 (cents), 69800 VND -> 69800 (no conversion).
func ToSmallestCurrencyUnitByCurrency(price float64, currency string) int64 {
	decimalPlaces := GetCurrencyDecimalPlaces(currency)

	multiplier := 1
	for i := 0; i < decimalPlaces; i++ {
		multiplier *= 10
	}

	return int64(price * float64(multiplier))
}
