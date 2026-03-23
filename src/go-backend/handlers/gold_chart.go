package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"

	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/handler"
)

// Allowlists for query parameter validation
var (
	validGoldMarkets = map[string]bool{"domestic": true, "global": true}
	validGoldCodes   = map[string]bool{"SJC": true, "999": true}
	validGoldPeriods = map[string]bool{"24h": true, "15d": true, "1M": true, "6M": true, "1y": true}
)

// goldChartDataPoint is a single price history point
type goldChartDataPoint struct {
	Timestamp int64   `json:"timestamp"`
	Buy       float64 `json:"buy"`
	Sell      float64 `json:"sell"`
}

// mihongGoldPriceItem represents one item in the mihong.vn API response
type mihongGoldPriceItem struct {
	BuyingPrice  float64 `json:"buyingPrice"`
	SellingPrice float64 `json:"sellingPrice"`
	Code         string  `json:"code"`
	DateTime     string  `json:"dateTime"` // "DD/MM/YYYY HH:mm" format, UTC+7
}

// GoldChartHandler handles the /investments/gold-chart endpoint
type GoldChartHandler struct {
	rdb *redis.Client
}

// NewGoldChartHandler creates a new GoldChartHandler
func NewGoldChartHandler(rdb *redis.Client) *GoldChartHandler {
	return &GoldChartHandler{rdb: rdb}
}

// GetGoldChart handles GET /investments/gold-chart
// Query params: market (domestic|global), goldCode (SJC|999), period (24h|15d|1m|6m|1y)
func (h *GoldChartHandler) GetGoldChart(c *gin.Context) {
	market := c.DefaultQuery("market", "domestic")
	goldCode := c.DefaultQuery("goldCode", "SJC")
	period := c.DefaultQuery("period", "24h")

	// Allowlist validation
	if !validGoldMarkets[market] {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.ChartMarketInvalid, "invalid market parameter"))
		return
	}
	if !validGoldPeriods[period] {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.ChartPeriodInvalid, "invalid period parameter"))
		return
	}
	// goldCode only relevant for domestic; for global we fix it to ""
	if market == "domestic" && !validGoldCodes[goldCode] {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.ChartGoldCodeInvalid, "invalid goldCode parameter"))
		return
	}
	if market == "global" {
		goldCode = ""
	}

	// Build cache key
	cacheKey := fmt.Sprintf("gold_chart:%s:%s:%s", market, goldCode, period)
	ctx := c.Request.Context()

	// Try cache first
	if h.rdb != nil {
		if cached, err := h.rdb.Get(ctx, cacheKey).Bytes(); err == nil {
			c.Data(http.StatusOK, "application/json", cached)
			return
		}
	}

	// Fetch from external API
	dataPoints, err := fetchGoldChartData(ctx, market, goldCode, period)
	if err != nil {
		// Try stale cache as fallback
		if h.rdb != nil {
			if stale, err2 := h.rdb.Get(ctx, cacheKey+":stale").Bytes(); err2 == nil {
				c.Data(http.StatusOK, "application/json", stale)
				return
			}
		}
		handler.HandleError(c, apperrors.NewServiceUnavailableErrorWithCode(apperrors.Codes.InternalError, "Failed to fetch gold chart data"))
		return
	}

	currency := "VND"
	if market == "global" {
		currency = "USD"
	}

	response := gin.H{
		"success":   true,
		"message":   "Gold chart data retrieved successfully",
		"data":      dataPoints,
		"market":    market,
		"goldCode":  goldCode,
		"period":    period,
		"currency":  currency,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	// Cache the response
	if h.rdb != nil {
		if jsonBytes, err := json.Marshal(response); err == nil {
			ttl := goldChartTTL(period)
			h.rdb.Set(ctx, cacheKey, jsonBytes, ttl)
			// Also persist as stale fallback (longer TTL)
			h.rdb.Set(ctx, cacheKey+":stale", jsonBytes, ttl*6)
		}
	}

	c.JSON(http.StatusOK, response)
}

// goldChartTTL returns the appropriate cache TTL based on period
func goldChartTTL(period string) time.Duration {
	if period == "24h" {
		return 5 * time.Minute
	}
	return 15 * time.Minute
}

// fetchGoldChartData fetches price history from mihong.vn
func fetchGoldChartData(ctx context.Context, market, goldCode, period string) ([]goldChartDataPoint, error) {
	var apiURL string
	if market == "domestic" {
		apiURL = fmt.Sprintf("https://api.mihong.vn/v1/gold-prices?market=domestic&goldCode=%s&last=%s", goldCode, period)
	} else {
		apiURL = fmt.Sprintf("https://api.mihong.vn/v1/gold-prices?market=global&last=%s", period)
	}

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
		return nil, fmt.Errorf("failed to fetch from mihong.vn: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mihong.vn returned status %d", resp.StatusCode)
	}

	// Size limit: 1MB
	limitedReader := io.LimitReader(resp.Body, 1<<20)
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var items []mihongGoldPriceItem
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, fmt.Errorf("failed to parse mihong.vn response: %w", err)
	}

	// Parse location for UTC+7
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		// Fallback to fixed offset if timezone data not available
		loc = time.FixedZone("UTC+7", 7*3600)
	}

	dataPoints := make([]goldChartDataPoint, 0, len(items))
	for _, item := range items {
		// Parse DD/MM/YYYY HH:mm format
		t, err := time.ParseInLocation("02/01/2006 15:04", item.DateTime, loc)
		if err != nil {
			// Try alternative format
			t, err = time.ParseInLocation("2006-01-02T15:04:05", item.DateTime, loc)
			if err != nil {
				continue // Skip unparseable timestamps
			}
		}
		dataPoints = append(dataPoints, goldChartDataPoint{
			Timestamp: t.Unix(),
			Buy:       item.BuyingPrice,
			Sell:      item.SellingPrice,
		})
	}

	// For global 24h data: downsample to ~100 points max
	if market == "global" && period == "24h" && len(dataPoints) > 100 {
		dataPoints = downsamplePoints(dataPoints, 100)
	}

	return dataPoints, nil
}

// downsamplePoints reduces dataPoints to at most maxPoints by taking every Nth point
func downsamplePoints(points []goldChartDataPoint, maxPoints int) []goldChartDataPoint {
	if len(points) <= maxPoints {
		return points
	}
	step := len(points) / maxPoints
	result := make([]goldChartDataPoint, 0, maxPoints)
	for i := 0; i < len(points); i += step {
		result = append(result, points[i])
	}
	return result
}
