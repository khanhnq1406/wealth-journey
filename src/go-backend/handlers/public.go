package handlers

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	"wealthjourney/pkg/gold"
	"wealthjourney/pkg/silver"
)

// PublicHandler handles public (no auth) endpoints
type PublicHandler struct {
	goldSvc   service.GoldPriceService
	silverSvc service.SilverPriceService
}

// NewPublicHandler creates a new public handler
func NewPublicHandler(goldSvc service.GoldPriceService, silverSvc service.SilverPriceService) *PublicHandler {
	return &PublicHandler{
		goldSvc:   goldSvc,
		silverSvc: silverSvc,
	}
}

// GetPublicMarketTypes returns gold/silver type names without prices
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

	// Fetch latest update timestamps (best-effort, don't fail if unavailable)
	var goldUpdatedAt, silverUpdatedAt int64
	var wg sync.WaitGroup
	wg.Add(2)

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

	wg.Wait()

	c.JSON(http.StatusOK, gin.H{
		"success":         true,
		"message":         "Market types retrieved successfully",
		"gold":            goldTypes,
		"silver":          silverTypes,
		"goldUpdatedAt":   goldUpdatedAt,
		"silverUpdatedAt": silverUpdatedAt,
		"timestamp":       time.Now().Format(time.RFC3339),
	})
}
