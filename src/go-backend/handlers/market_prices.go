package handlers

import (
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/handler"
	investmentv1 "wealthjourney/protobuf/v1"
)

// MarketPricesHandler handles the combined gold + silver + currency prices endpoint.
// It reads from the DB-backed asset price cache via AssetPriceService instead of
// calling live price APIs directly.
type MarketPricesHandler struct {
	assetPriceSvc service.AssetPriceService
	overrideCache *cache.PriceOverrideCache
}

// NewMarketPricesHandler creates a new market prices handler.
func NewMarketPricesHandler(
	assetPriceSvc service.AssetPriceService,
	overrideCache *cache.PriceOverrideCache,
) *MarketPricesHandler {
	return &MarketPricesHandler{
		assetPriceSvc: assetPriceSvc,
		overrideCache: overrideCache,
	}
}

// GetMarketPrices returns all gold, silver, and currency prices in one call.
// GET /api/v1/investments/market-prices
func (h *MarketPricesHandler) GetMarketPrices(c *gin.Context) {
	ctx := c.Request.Context()

	allPrices, err := h.assetPriceSvc.GetAllPrices(ctx)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	// Convert DTOs to proto PriceItems
	goldItems := convertToPriceItems(allPrices.Gold)
	silverItems := convertToPriceItems(allPrices.Silver)
	currencyItems := convertToPriceItems(allPrices.Currency)

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

	handler.Success(c, gin.H{
		"gold":      goldItems,
		"silver":    silverItems,
		"currency":  currencyItems,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// convertToPriceItems converts a slice of AssetPriceDTOs to proto PriceItems.
func convertToPriceItems(dtos []*service.AssetPriceDTO) []*investmentv1.PriceItem {
	items := make([]*investmentv1.PriceItem, len(dtos))
	for i, d := range dtos {
		items[i] = &investmentv1.PriceItem{
			TypeCode:   d.TypeCode,
			Buy:        d.Buy,
			Sell:       d.Sell,
			ChangeBuy:  d.ChangeBuy,
			ChangeSell: d.ChangeSell,
			Currency:   d.Currency,
			UpdatedAt:  d.FetchedAt.Unix(),
			Name:       d.Name,
			IsStale:    d.IsStale,
		}
	}
	return items
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
