package handlers

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	"wealthjourney/pkg/cache"
	investmentv1 "wealthjourney/protobuf/v1"
)

// MarketPricesHandler handles the combined gold + silver + currency prices endpoint
type MarketPricesHandler struct {
	goldSvc       service.GoldPriceService
	silverSvc     service.SilverPriceService
	currencySvc   service.CurrencyPriceService
	overrideCache *cache.PriceOverrideCache
}

// NewMarketPricesHandler creates a new market prices handler
func NewMarketPricesHandler(goldSvc service.GoldPriceService, silverSvc service.SilverPriceService, currencySvc service.CurrencyPriceService, overrideCache *cache.PriceOverrideCache) *MarketPricesHandler {
	return &MarketPricesHandler{
		goldSvc:       goldSvc,
		silverSvc:     silverSvc,
		currencySvc:   currencySvc,
		overrideCache: overrideCache,
	}
}

// GetMarketPrices returns all gold, silver, and currency prices in one call.
// GET /api/v1/investments/market-prices
func (h *MarketPricesHandler) GetMarketPrices(c *gin.Context) {
	ctx := c.Request.Context()

	var (
		goldItems     []*investmentv1.PriceItem
		silverItems   []*investmentv1.PriceItem
		currencyItems []*investmentv1.PriceItem
		goldErr       error
		silverErr     error
		currencyErr   error
		wg            sync.WaitGroup
	)

	wg.Add(3)

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

	go func() {
		defer wg.Done()
		prices, err := h.currencySvc.FetchAllPrices(ctx)
		if err != nil {
			currencyErr = err
			return
		}
		currencyItems = make([]*investmentv1.PriceItem, len(prices))
		for i, p := range prices {
			currencyItems[i] = &investmentv1.PriceItem{
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

	// Apply admin price overrides (graceful — skip if Redis fails)
	if h.overrideCache != nil {
		allOverrides, overrideErr := h.overrideCache.GetAll(ctx)
		if overrideErr == nil && len(allOverrides) > 0 {
			// Build lookup map: "typeCode:currency" -> override
			overrideMap := make(map[string]*cache.PriceOverride, len(allOverrides))
			for _, o := range allOverrides {
				overrideMap[o.TypeCode+":"+o.Currency] = o
			}
			applyOverrides(goldItems, overrideMap)
			applyOverrides(silverItems, overrideMap)
			applyOverrides(currencyItems, overrideMap)
		}
	}

	// All three failed — return error
	if goldErr != nil && silverErr != nil && currencyErr != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "Failed to fetch prices",
		})
		return
	}

	// Partial success: return empty slice (never null) for failed ones
	if goldItems == nil {
		goldItems = []*investmentv1.PriceItem{}
	}
	if silverItems == nil {
		silverItems = []*investmentv1.PriceItem{}
	}
	if currencyItems == nil {
		currencyItems = []*investmentv1.PriceItem{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Market prices retrieved successfully",
		"gold":      goldItems,
		"silver":    silverItems,
		"currency":  currencyItems,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// applyOverrides merges admin price overrides into price items.
func applyOverrides(items []*investmentv1.PriceItem, overrides map[string]*cache.PriceOverride) {
	for _, item := range items {
		key := item.TypeCode + ":" + item.Currency
		if override, ok := overrides[key]; ok {
			item.Buy = override.Buy
			item.Sell = override.Sell
			item.IsOverridden = true
		}
	}
}
