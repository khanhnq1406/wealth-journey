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

// SearchResult represents a symbol search result from Yahoo Finance
type SearchResult struct {
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Exchange string `json:"exchange"`
	ExchDisp string `json:"exchDisp"`
	Currency string `json:"currency"` // Trading currency (ISO 4217), derived from exchange
}

// exchangeToCurrency maps Yahoo Finance exchange codes to ISO 4217 currency codes
var exchangeToCurrency = map[string]string{
	// US Exchanges
	"NMS": "USD", // NASDAQ Global Select Market
	"NGM": "USD", // NASDAQ Global Market
	"NCM": "USD", // NASDAQ Capital Market
	"NAS": "USD", // NASDAQ (general)
	"NYQ": "USD", // NYSE
	"NYS": "USD", // NYSE (alternative code)
	"PCX": "USD", // NYSE Arca
	"ASE": "USD", // NYSE American (AMEX)
	"BTS": "USD", // BATS Exchange
	"OPR": "USD", // OPRA (options)

	// Cryptocurrency (traded in USD by default)
	"CCC": "USD", // Cryptocurrency

	// Vietnam
	"VNM": "VND", // Vietnam Stock Exchange (general)
	"HNX": "VND", // Hanoi Stock Exchange
	"HSX": "VND", // Ho Chi Minh Stock Exchange
	"UPX": "VND", // UPCoM (unlisted public companies)
	"VSE": "VND",

	// Hong Kong
	"HKG": "HKD", // Hong Kong Stock Exchange

	// Japan
	"TYO": "JPY", // Tokyo Stock Exchange
	"JPX": "JPY", // Japan Exchange Group

	// UK/Europe
	"LSE": "GBP", // London Stock Exchange
	"LON": "GBP", // London (alternative)
	"FRA": "EUR", // Frankfurt Stock Exchange
	"ETR": "EUR", // XETRA (Germany)
	"PAR": "EUR", // Euronext Paris
	"AMS": "EUR", // Euronext Amsterdam
	"BRU": "EUR", // Euronext Brussels
	"MIL": "EUR", // Borsa Italiana (Milan)

	// Asia-Pacific
	"SHH": "CNY", // Shanghai Stock Exchange
	"SHZ": "CNY", // Shenzhen Stock Exchange
	"KSC": "KRW", // Korea Stock Exchange (KOSPI)
	"KOE": "KRW", // Korea Exchange
	"TWO": "TWD", // Taiwan OTC
	"TPE": "TWD", // Taiwan Stock Exchange
	"SES": "SGD", // Singapore Exchange
	"SGX": "SGD", // Singapore Exchange (alternative)
	"ASX": "AUD", // Australian Securities Exchange
	"NSI": "INR", // National Stock Exchange of India
	"BSE": "INR", // Bombay Stock Exchange

	// Canada
	"TOR": "CAD", // Toronto Stock Exchange
	"TSX": "CAD", // TSX (alternative)
	"CVE": "CAD", // TSX Venture Exchange
	"CNQ": "CAD", // Canadian Securities Exchange

	// Other
	"SAO": "BRL", // B3 (Brazil)
	"MEX": "MXN", // Bolsa Mexicana de Valores
	"SWX": "CHF", // SIX Swiss Exchange
}

// GetCurrencyForExchange returns the currency code for a given exchange
func GetCurrencyForExchange(exchange string) string {
	if currency, ok := exchangeToCurrency[exchange]; ok {
		return currency
	}
	return "USD" // Default to USD for unknown exchanges
}

// SearchParams holds configurable parameters for Yahoo Finance search API
type SearchParams struct {
	// Core search parameters
	Query       string // Search query (symbol, company name, etc.)
	QuotesCount int    // Number of quote results to return (default: 10, max: 20)
	NewsCount   int    // Number of news results (default: 0, not needed for symbol search)
	ListsCount  int    // Number of list results (default: 0, not needed)

	// Query optimization parameters
	EnableFuzzyQuery           bool // Enable fuzzy matching (default: false for exact matching)
	EnableEnhancedTrivialQuery bool // Enable better trivial query handling (default: true)
	EnableCccBoost             bool // Enable cryptocurrency boost (default: true)
	EnablePrivateCompany       bool // Include private companies (default: true)

	// Feature flags
	EnableResearchReports bool // Enable research reports data (default: true)
	EnableCulturalAssets  bool // Enable cultural assets data (default: true)
	EnableLogoUrl         bool // Enable logo URLs (default: true)
	EnableNavLinks        bool // Enable navigation links (default: true)
	EnableCb              bool // Enable clickback (default: false)
	EnableLists           bool // Enable lists in results (default: false)

	// Query IDs (Yahoo Finance internal query routing)
	QuotesQueryId     string // Default: "tss_match_phrase_query"
	MultiQuoteQueryId string // Default: "multi_quote_single_token_query"
	NewsQueryId       string // Default: "news_cie_vespa" (not used when newsCount=0)

	// Recommendation
	RecommendCount int // Number of recommendations (default: 5)

	// Language
	Lang string // Language code (default: "en-US")
}

// DefaultSearchParams creates a SearchParams with sensible defaults for symbol search
func DefaultSearchParams(query string, quotesCount int) SearchParams {
	return SearchParams{
		Query:                      query,
		QuotesCount:                quotesCount,
		NewsCount:                  0,
		ListsCount:                 0,
		EnableFuzzyQuery:           false,
		EnableEnhancedTrivialQuery: true,
		EnableCccBoost:             true,
		EnablePrivateCompany:       true,
		EnableResearchReports:      true,
		EnableCulturalAssets:       true,
		EnableLogoUrl:              true,
		EnableNavLinks:             true,
		EnableCb:                   false,
		EnableLists:                false,
		QuotesQueryId:              "tss_match_phrase_query",
		MultiQuoteQueryId:          "multi_quote_single_token_query",
		NewsQueryId:                "news_cie_vespa",
		RecommendCount:             5,
		Lang:                       "en-US",
	}
}

type yahooSearchResponse struct {
	Quotes []struct {
		Symbol    string `json:"symbol"`
		ShortName string `json:"shortname"`
		LongName  string `json:"longname"`
		QuoteType string `json:"quoteType"`
		Exchange  string `json:"exchange"`
		ExchDisp  string `json:"exchDisp"`
	} `json:"quotes"`
}

func buildSearchURL(params SearchParams) string {
	baseURL := "https://query1.finance.yahoo.com/v1/finance/search"
	values := url.Values{}
	values.Set("q", params.Query)
	values.Set("lang", params.Lang)
	values.Set("quotesCount", fmt.Sprintf("%d", params.QuotesCount))
	values.Set("newsCount", fmt.Sprintf("%d", params.NewsCount))
	values.Set("listsCount", fmt.Sprintf("%d", params.ListsCount))
	values.Set("enableFuzzyQuery", fmt.Sprintf("%t", params.EnableFuzzyQuery))
	values.Set("quotesQueryId", params.QuotesQueryId)
	values.Set("multiQuoteQueryId", params.MultiQuoteQueryId)
	values.Set("enableCb", fmt.Sprintf("%t", params.EnableCb))
	values.Set("enableNavLinks", fmt.Sprintf("%t", params.EnableNavLinks))
	values.Set("enableEnhancedTrivialQuery", fmt.Sprintf("%t", params.EnableEnhancedTrivialQuery))
	values.Set("enableResearchReports", fmt.Sprintf("%t", params.EnableResearchReports))
	values.Set("enableCulturalAssets", fmt.Sprintf("%t", params.EnableCulturalAssets))
	values.Set("enableLogoUrl", fmt.Sprintf("%t", params.EnableLogoUrl))
	values.Set("enableLists", fmt.Sprintf("%t", params.EnableLists))
	values.Set("recommendCount", fmt.Sprintf("%d", params.RecommendCount))
	values.Set("enableCccBoost", fmt.Sprintf("%t", params.EnableCccBoost))
	values.Set("enablePrivateCompany", fmt.Sprintf("%t", params.EnablePrivateCompany))
	if params.NewsQueryId != "" {
		values.Set("newsQueryId", params.NewsQueryId)
	}
	return fmt.Sprintf("%s?%s", baseURL, values.Encode())
}

// SearchSymbols performs a symbol search with default parameters
func SearchSymbols(ctx context.Context, query string, limit int) ([]SearchResult, error) {
	params := DefaultSearchParams(query, limit)
	return SearchSymbolsWithOptions(ctx, params)
}

// SearchSymbolsWithOptions performs a symbol search with custom parameters
func SearchSymbolsWithOptions(ctx context.Context, params SearchParams) ([]SearchResult, error) {
	params.Query = strings.TrimSpace(params.Query)
	if params.Query == "" {
		return nil, fmt.Errorf("query cannot be empty")
	}
	if params.QuotesCount <= 0 {
		params.QuotesCount = 10
	}
	if params.QuotesCount > 20 {
		params.QuotesCount = 20
	}

	// Respect rate limiting
	if err := GetGlobalThrottler().Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limit wait failed: %w", err)
	}

	searchURL := buildSearchURL(params)
	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, "GET", searchURL, nil)
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

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var yahooResp yahooSearchResponse
	if err := json.Unmarshal(body, &yahooResp); err != nil {
		return nil, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	results := make([]SearchResult, 0, len(yahooResp.Quotes))
	for _, quote := range yahooResp.Quotes {
		name := quote.ShortName
		if name == "" {
			name = quote.LongName
		}
		results = append(results, SearchResult{
			Symbol:   quote.Symbol,
			Name:     name,
			Type:     quote.QuoteType,
			Exchange: quote.Exchange,
			ExchDisp: quote.ExchDisp,
			Currency: GetCurrencyForExchange(quote.Exchange),
		})
	}

	return results, nil
}
