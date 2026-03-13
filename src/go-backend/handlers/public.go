package handlers

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	"wealthjourney/pkg/currency"
	"wealthjourney/pkg/gold"
	"wealthjourney/pkg/silver"
)

// PublicHandler handles public (no auth) endpoints
type PublicHandler struct {
	goldSvc     service.GoldPriceService
	silverSvc   service.SilverPriceService
	currencySvc service.CurrencyPriceService
}

// NewPublicHandler creates a new public handler
func NewPublicHandler(goldSvc service.GoldPriceService, silverSvc service.SilverPriceService, currencySvc service.CurrencyPriceService) *PublicHandler {
	return &PublicHandler{
		goldSvc:     goldSvc,
		silverSvc:   silverSvc,
		currencySvc: currencySvc,
	}
}

// GetPublicMarketTypes returns gold/silver/currency type names without prices
// GET /api/v1/public/market-types
func (h *PublicHandler) GetPublicMarketTypes(c *gin.Context) {
	// Build gold types (code, name, currency only — no prices)
	goldTypes := make([]gin.H, len(gold.GoldTypes))
	for i, gt := range gold.GoldTypes {
		goldTypes[i] = gin.H{
			"code":     gt.Code,
			"name":     gt.Name,
			"currency": gt.Currency,
		}
	}

	// Build silver types (code, name, currency only — no prices)
	silverTypes := make([]gin.H, len(silver.SilverTypes))
	for i, st := range silver.SilverTypes {
		silverTypes[i] = gin.H{
			"code":     st.Code,
			"name":     st.Name,
			"currency": st.Currency,
		}
	}

	// Build currency types from static list (no API call needed)
	currencyTypes := make([]gin.H, len(currency.CurrencyTypes))
	for i, ct := range currency.CurrencyTypes {
		currencyTypes[i] = gin.H{
			"code":     ct.Code,
			"name":     ct.Name,
			"currency": ct.Currency,
		}
	}

	// Fetch latest update timestamps (best-effort, don't fail if unavailable)
	var goldUpdatedAt, silverUpdatedAt, currencyUpdatedAt int64
	var wg sync.WaitGroup
	wg.Add(3)

	go func() {
		defer wg.Done()
		if h.goldSvc == nil {
			return
		}
		prices, err := h.goldSvc.FetchAllPrices(c.Request.Context())
		if err != nil || len(prices) == 0 {
			return
		}
		var latest time.Time
		for _, p := range prices {
			if p.UpdateTime.After(latest) {
				latest = p.UpdateTime
			}
		}
		if !latest.IsZero() {
			goldUpdatedAt = latest.Unix()
		}
	}()

	go func() {
		defer wg.Done()
		if h.silverSvc == nil {
			return
		}
		prices, err := h.silverSvc.FetchAllPrices(c.Request.Context())
		if err != nil || len(prices) == 0 {
			return
		}
		var latest time.Time
		for _, p := range prices {
			if p.UpdateTime.After(latest) {
				latest = p.UpdateTime
			}
		}
		if !latest.IsZero() {
			silverUpdatedAt = latest.Unix()
		}
	}()

	go func() {
		defer wg.Done()
		if h.currencySvc == nil {
			return
		}
		prices, err := h.currencySvc.FetchAllPrices(c.Request.Context())
		if err != nil || len(prices) == 0 {
			return
		}
		var latest time.Time
		for _, p := range prices {
			if p.UpdateTime.After(latest) {
				latest = p.UpdateTime
			}
		}
		if !latest.IsZero() {
			currencyUpdatedAt = latest.Unix()
		}
	}()

	wg.Wait()

	c.JSON(http.StatusOK, gin.H{
		"success":            true,
		"message":            "Market types retrieved successfully",
		"gold":               goldTypes,
		"silver":             silverTypes,
		"currency":           currencyTypes,
		"goldUpdatedAt":      goldUpdatedAt,
		"silverUpdatedAt":    silverUpdatedAt,
		"currencyUpdatedAt":  currencyUpdatedAt,
		"timestamp":          time.Now().Format(time.RFC3339),
	})
}
