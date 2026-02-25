package handlers

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	investmentv1 "wealthjourney/protobuf/v1"
)

// MarketPricesHandler handles the combined gold + silver prices endpoint
type MarketPricesHandler struct {
	goldSvc   service.GoldPriceService
	silverSvc service.SilverPriceService
}

// NewMarketPricesHandler creates a new market prices handler
func NewMarketPricesHandler(goldSvc service.GoldPriceService, silverSvc service.SilverPriceService) *MarketPricesHandler {
	return &MarketPricesHandler{
		goldSvc:   goldSvc,
		silverSvc: silverSvc,
	}
}

// GetMarketPrices returns all gold and silver prices in one call.
// GET /api/v1/investments/market-prices
func (h *MarketPricesHandler) GetMarketPrices(c *gin.Context) {
	ctx := c.Request.Context()

	var (
		goldItems   []*investmentv1.PriceItem
		silverItems []*investmentv1.PriceItem
		goldErr     error
		silverErr   error
		wg          sync.WaitGroup
	)

	wg.Add(2)

	go func() {
		defer wg.Done()
		prices, err := h.goldSvc.FetchAllPrices(ctx)
		if err != nil {
			goldErr = err
			return
		}
		goldItems = make([]*investmentv1.PriceItem, len(prices))
		for i, p := range prices {
			goldItems[i] = &investmentv1.PriceItem{
				TypeCode:   p.TypeCode,
				Buy:        p.Buy,
				Sell:       p.Sell,
				ChangeBuy:  p.ChangeBuy,
				ChangeSell: p.ChangeSell,
				Currency:   p.Currency,
				UpdatedAt:  p.UpdateTime.Unix(),
				Name:       p.Name,
			}
		}
	}()

	go func() {
		defer wg.Done()
		prices, err := h.silverSvc.FetchAllPrices(ctx)
		if err != nil {
			silverErr = err
			return
		}
		silverItems = make([]*investmentv1.PriceItem, len(prices))
		for i, p := range prices {
			silverItems[i] = &investmentv1.PriceItem{
				TypeCode:   p.TypeCode,
				Buy:        p.Buy,
				Sell:       p.Sell,
				ChangeBuy:  p.ChangeBuy,
				ChangeSell: p.ChangeSell,
				Currency:   p.Currency,
				UpdatedAt:  p.UpdateTime.Unix(),
				Name:       p.Name,
			}
		}
	}()

	wg.Wait()

	// Both failed — return error
	if goldErr != nil && silverErr != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "Failed to fetch prices",
		})
		return
	}

	// Partial success: return empty slice (never null) for failed one
	if goldItems == nil {
		goldItems = []*investmentv1.PriceItem{}
	}
	if silverItems == nil {
		silverItems = []*investmentv1.PriceItem{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Market prices retrieved successfully",
		"gold":      goldItems,
		"silver":    silverItems,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}
