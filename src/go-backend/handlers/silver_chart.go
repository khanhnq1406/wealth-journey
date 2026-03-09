package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"

	"wealthjourney/pkg/yahoo"
)

// Allowlists for silver chart query parameter validation
var (
	validSilverMarkets = map[string]bool{"domestic": true, "global": true}
	validSilverTypes   = map[string]bool{"C": true, "L": true, "KG": true}
	validSilverDays    = map[int]bool{1: true, 7: true, 30: true, 90: true, 365: true}
)

// silverChartDataPoint is a single price history point for silver
type silverChartDataPoint struct {
	Timestamp int64   `json:"timestamp"`
	Buy       float64 `json:"buy"`
	Sell      float64 `json:"sell"`
}

// giabacSilverResponse represents the response from giabac.vn API
type giabacSilverResponse struct {
	Type           string    `json:"Type"`
	Dates          []string  `json:"Dates"`
	LastBuyPrices  []float64 `json:"LastBuyPrices"`
	LastSellPrices []float64 `json:"LastSellPrices"`
}

// SilverChartHandler handles the /investments/silver-chart endpoint
type SilverChartHandler struct {
	rdb *redis.Client
}

// NewSilverChartHandler creates a new SilverChartHandler
func NewSilverChartHandler(rdb *redis.Client) *SilverChartHandler {
	return &SilverChartHandler{rdb: rdb}
}

// GetSilverChart handles GET /investments/silver-chart
// Query params: market (domestic|global), type (C|L|KG), days (1|7|30|90|365)
func (h *SilverChartHandler) GetSilverChart(c *gin.Context) {
	market := c.DefaultQuery("market", "domestic")
	silverType := c.DefaultQuery("type", "L")
	daysStr := c.DefaultQuery("days", "7")

	// Allowlist validation
	if !validSilverMarkets[market] {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid market parameter"})
		return
	}

	days, err := strconv.Atoi(daysStr)
	if err != nil || !validSilverDays[days] {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid days parameter"})
		return
	}

	// type param only relevant for domestic
	if market == "domestic" && !validSilverTypes[silverType] {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid type parameter"})
		return
	}
	if market == "global" {
		silverType = ""
	}

	// Build cache key
	cacheKey := fmt.Sprintf("silver_chart:%s:%s:%d", market, silverType, days)
	ctx := c.Request.Context()

	// Try cache first
	if h.rdb != nil {
		if cached, err := h.rdb.Get(ctx, cacheKey).Bytes(); err == nil {
			c.Data(http.StatusOK, "application/json", cached)
			return
		}
	}

	// Fetch from external API
	var dataPoints []silverChartDataPoint
	if market == "domestic" {
		dataPoints, err = fetchDomesticSilverData(ctx, silverType, days)
	} else {
		dataPoints, err = fetchGlobalSilverData(ctx, days)
	}

	if err != nil {
		// Try stale cache as fallback
		if h.rdb != nil {
			if stale, err2 := h.rdb.Get(ctx, cacheKey+":stale").Bytes(); err2 == nil {
				c.Data(http.StatusOK, "application/json", stale)
				return
			}
		}
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "Failed to fetch silver chart data",
		})
		return
	}

	currency := "VND"
	if market == "global" {
		currency = "USD"
	}

	response := gin.H{
		"success":   true,
		"message":   "Silver chart data retrieved successfully",
		"data":      dataPoints,
		"market":    market,
		"type":      silverType,
		"days":      days,
		"currency":  currency,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	// Cache the response
	if h.rdb != nil {
		if jsonBytes, err := json.Marshal(response); err == nil {
			ttl := silverChartTTL(days)
			h.rdb.Set(ctx, cacheKey, jsonBytes, ttl)
			h.rdb.Set(ctx, cacheKey+":stale", jsonBytes, ttl*6)
		}
	}

	c.JSON(http.StatusOK, response)
}

// silverChartTTL returns the appropriate cache TTL based on days
func silverChartTTL(days int) time.Duration {
	if days == 1 {
		return 5 * time.Minute
	}
	return 15 * time.Minute
}

// fetchDomesticSilverData fetches domestic silver price history from giabac.vn
func fetchDomesticSilverData(ctx context.Context, silverType string, days int) ([]silverChartDataPoint, error) {
	apiURL := fmt.Sprintf("https://giabac.vn/SilverInfo/GetGoldPriceChartFromSQLData?days=%d&type=%s", days, silverType)

	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, "GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from giabac.vn: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("giabac.vn returned status %d", resp.StatusCode)
	}

	limitedReader := io.LimitReader(resp.Body, 1<<20)
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var apiResp giabacSilverResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse giabac.vn response: %w", err)
	}

	// Validate parallel arrays have matching lengths
	n := len(apiResp.Dates)
	if len(apiResp.LastBuyPrices) < n {
		n = len(apiResp.LastBuyPrices)
	}
	if len(apiResp.LastSellPrices) < n {
		n = len(apiResp.LastSellPrices)
	}

	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		loc = time.FixedZone("UTC+7", 7*3600)
	}

	dataPoints := make([]silverChartDataPoint, 0, n)
	for i := 0; i < n; i++ {
		dateStr := strings.TrimSpace(apiResp.Dates[i])
		var t time.Time

		if days == 1 {
			// ISO timestamp with time component
			t, err = time.ParseInLocation("2006-01-02T15:04:05", dateStr, loc)
			if err != nil {
				t, err = time.ParseInLocation(time.RFC3339, dateStr, loc)
				if err != nil {
					continue
				}
			}
		} else {
			// YYYY-MM-DD date string
			t, err = time.ParseInLocation("2006-01-02", dateStr, loc)
			if err != nil {
				continue
			}
		}

		dataPoints = append(dataPoints, silverChartDataPoint{
			Timestamp: t.Unix(),
			Buy:       apiResp.LastBuyPrices[i],
			Sell:      apiResp.LastSellPrices[i],
		})
	}

	return dataPoints, nil
}

// yahooFinanceChartResponse is the response from Yahoo Finance v8 chart API for historical data
type yahooFinanceChartResponse struct {
	Chart struct {
		Result []struct {
			Timestamp  []int64 `json:"timestamp"`
			Indicators struct {
				Quote []struct {
					Close []*float64 `json:"close"` // pointer to distinguish null from 0
				} `json:"quote"`
			} `json:"indicators"`
		} `json:"result"`
		Error *struct {
			Code        string `json:"code"`
			Description string `json:"description"`
		} `json:"error"`
	} `json:"chart"`
}

// silverIntervalForDays maps days to Yahoo Finance interval strings
func silverIntervalForDays(days int) string {
	switch days {
	case 1:
		return "5m"
	case 7:
		return "1h"
	case 30, 90:
		return "1d"
	case 365:
		return "1wk"
	default:
		return "1d"
	}
}

// fetchGlobalSilverData fetches SI=F (silver futures) data from Yahoo Finance
func fetchGlobalSilverData(ctx context.Context, days int) ([]silverChartDataPoint, error) {
	// Respect Yahoo Finance rate limiting
	if err := yahoo.GetGlobalThrottler().Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limit wait failed: %w", err)
	}

	now := time.Now()
	period2 := now.Unix()
	period1 := now.AddDate(0, 0, -days).Unix()
	interval := silverIntervalForDays(days)

	apiURL := fmt.Sprintf(
		"https://query2.finance.yahoo.com/v8/finance/chart/SI%%3DF?period1=%d&period2=%d&interval=%s",
		period1, period2, interval,
	)

	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, "GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from Yahoo Finance: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Yahoo Finance returned status %d", resp.StatusCode)
	}

	limitedReader := io.LimitReader(resp.Body, 1<<20)
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("failed to read Yahoo Finance response: %w", err)
	}

	var chartResp yahooFinanceChartResponse
	if err := json.Unmarshal(body, &chartResp); err != nil {
		return nil, fmt.Errorf("failed to parse Yahoo Finance response: %w", err)
	}

	if chartResp.Chart.Error != nil {
		return nil, fmt.Errorf("Yahoo Finance API error: %s", chartResp.Chart.Error.Description)
	}

	if len(chartResp.Chart.Result) == 0 {
		return nil, fmt.Errorf("no data returned from Yahoo Finance")
	}

	result := chartResp.Chart.Result[0]
	timestamps := result.Timestamp
	quotes := result.Indicators.Quote

	if len(quotes) == 0 {
		return nil, fmt.Errorf("no quote data in Yahoo Finance response")
	}

	closes := quotes[0].Close
	n := len(timestamps)
	if len(closes) < n {
		n = len(closes)
	}

	dataPoints := make([]silverChartDataPoint, 0, n)
	for i := 0; i < n; i++ {
		if closes[i] == nil {
			continue // Filter null values
		}
		price := *closes[i]
		dataPoints = append(dataPoints, silverChartDataPoint{
			Timestamp: timestamps[i],
			Buy:       price,
			Sell:      price, // No spread in futures data
		})
	}

	return dataPoints, nil
}
