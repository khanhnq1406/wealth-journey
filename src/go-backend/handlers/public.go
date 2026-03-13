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

// GetPublicMarketTypes returns gold/silver/currency type names without prices.
// Derives type lists from live price services so the landing page shows the
// same items as the authenticated dashboard. Falls back to static registries
// when a service is unavailable.
// GET /api/v1/public/market-types
func (h *PublicHandler) GetPublicMarketTypes(c *gin.Context) {
	ctx := c.Request.Context()

	var (
		goldTypes, silverTypes, currencyTypes []gin.H
		goldUpdatedAt, silverUpdatedAt, currencyUpdatedAt int64
		wg sync.WaitGroup
		mu sync.Mutex
	)

	wg.Add(3)

	// Gold: derive from live prices, fallback to static registry
	go func() {
		defer wg.Done()
		if h.goldSvc != nil {
			prices, err := h.goldSvc.FetchAllPrices(ctx)
			if err == nil && len(prices) > 0 {
				mu.Lock()
				goldTypes = make([]gin.H, len(prices))
				for i, p := range prices {
					goldTypes[i] = gin.H{
						"code":     p.TypeCode,
						"name":     p.Name,
						"currency": p.Currency,
					}
					if p.UpdateTime.Unix() > goldUpdatedAt {
						goldUpdatedAt = p.UpdateTime.Unix()
					}
				}
				mu.Unlock()
				return
			}
		}
		// Fallback to static registry
		mu.Lock()
		goldTypes = make([]gin.H, len(gold.GoldTypes))
		for i, gt := range gold.GoldTypes {
			goldTypes[i] = gin.H{
				"code":     gt.Code,
				"name":     gt.Name,
				"currency": gt.Currency,
			}
		}
		mu.Unlock()
	}()

	// Silver: derive from live prices, fallback to static registry
	go func() {
		defer wg.Done()
		if h.silverSvc != nil {
			prices, err := h.silverSvc.FetchAllPrices(ctx)
			if err == nil && len(prices) > 0 {
				mu.Lock()
				silverTypes = make([]gin.H, len(prices))
				for i, p := range prices {
					silverTypes[i] = gin.H{
						"code":     p.TypeCode,
						"name":     p.Name,
						"currency": p.Currency,
					}
					if p.UpdateTime.Unix() > silverUpdatedAt {
						silverUpdatedAt = p.UpdateTime.Unix()
					}
				}
				mu.Unlock()
				return
			}
		}
		// Fallback to static registry
		mu.Lock()
		silverTypes = make([]gin.H, len(silver.SilverTypes))
		for i, st := range silver.SilverTypes {
			silverTypes[i] = gin.H{
				"code":     st.Code,
				"name":     st.Name,
				"currency": st.Currency,
			}
		}
		mu.Unlock()
	}()

	// Currency: derive from live prices, fallback to static registry
	go func() {
		defer wg.Done()
		if h.currencySvc != nil {
			prices, err := h.currencySvc.FetchAllPrices(ctx)
			if err == nil && len(prices) > 0 {
				mu.Lock()
				currencyTypes = make([]gin.H, len(prices))
				for i, p := range prices {
					currencyTypes[i] = gin.H{
						"code":     p.TypeCode,
						"name":     p.Name,
						"currency": p.Currency,
					}
					if p.UpdateTime.Unix() > currencyUpdatedAt {
						currencyUpdatedAt = p.UpdateTime.Unix()
					}
				}
				mu.Unlock()
				return
			}
		}
		// Fallback to static registry
		mu.Lock()
		currencyTypes = make([]gin.H, len(currency.CurrencyTypes))
		for i, ct := range currency.CurrencyTypes {
			currencyTypes[i] = gin.H{
				"code":     ct.Code,
				"name":     ct.Name,
				"currency": ct.Currency,
			}
		}
		mu.Unlock()
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
