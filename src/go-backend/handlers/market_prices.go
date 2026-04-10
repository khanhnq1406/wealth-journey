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
// It reads from AssetDisplayConfigService.GetDisplayPrices() which applies the admin
// display config (enabled filter, display names, fetch-code priority resolution, display order).
type MarketPricesHandler struct {
	assetDisplayConfigSvc service.AssetDisplayConfigService
	overrideCache         *cache.PriceOverrideCache
}

// NewMarketPricesHandler creates a new market prices handler.
func NewMarketPricesHandler(
	assetDisplayConfigSvc service.AssetDisplayConfigService,
	overrideCache *cache.PriceOverrideCache,
) *MarketPricesHandler {
	return &MarketPricesHandler{
		assetDisplayConfigSvc: assetDisplayConfigSvc,
		overrideCache:         overrideCache,
	}
}

// GetMarketPrices returns all gold, silver, and currency prices in one call.
// GET /api/v1/investments/market-prices
func (h *MarketPricesHandler) GetMarketPrices(c *gin.Context) {
	ctx := c.Request.Context()

	goldDTOs, err := h.assetDisplayConfigSvc.GetDisplayPrices(ctx, "gold")
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	silverDTOs, err := h.assetDisplayConfigSvc.GetDisplayPrices(ctx, "silver")
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	currencyDTOs, err := h.assetDisplayConfigSvc.GetDisplayPrices(ctx, "currency")
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	// Convert DTOs to proto PriceItems
	goldItems := convertDisplayPricesToPriceItems(goldDTOs)
	silverItems := convertDisplayPricesToPriceItems(silverDTOs)
	currencyItems := convertDisplayPricesToPriceItems(currencyDTOs)

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

// convertDisplayPricesToPriceItems maps AssetDisplayPriceDTOs to proto PriceItems.
func convertDisplayPricesToPriceItems(dtos []*service.AssetDisplayPriceDTO) []*investmentv1.PriceItem {
	items := make([]*investmentv1.PriceItem, len(dtos))
	for i, d := range dtos {
		items[i] = &investmentv1.PriceItem{
			TypeCode: d.TypeCode,
			Buy:      d.Buy,
			Sell:     d.Sell,
			Currency: "VND",
			Name:     d.DisplayName,
			IsStale:  d.IsStale,
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
