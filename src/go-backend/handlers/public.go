package handlers

import (
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	"wealthjourney/pkg/currency"
	"wealthjourney/pkg/gold"
	handler "wealthjourney/pkg/handler"
	"wealthjourney/pkg/silver"
)

// PublicHandler handles public (no auth) endpoints.
// It reads market type data from the DB-backed AssetPriceService and falls back
// to static registries on cold start (before the first PriceCacheJob run).
type PublicHandler struct {
	assetPriceSvc service.AssetPriceService
}

// NewPublicHandler creates a new public handler.
func NewPublicHandler(assetPriceSvc service.AssetPriceService) *PublicHandler {
	return &PublicHandler{assetPriceSvc: assetPriceSvc}
}

// GetPublicMarketTypes returns gold/silver/currency type names without prices.
// Reads from the DB-backed AssetPriceService so the landing page shows the
// same items as the authenticated dashboard. Falls back to static registries
// on cold start (when DB cache is empty) or on service error.
// GET /api/v1/public/market-types
func (h *PublicHandler) GetPublicMarketTypes(c *gin.Context) {
	ctx := c.Request.Context()

	marketTypes, err := h.assetPriceSvc.GetMarketTypes(ctx)
	if err != nil || marketTypes == nil {
		// Fallback to static registries on error (cold start or service unavailable)
		h.fallbackStaticTypes(c)
		return
	}

	// Convert to response arrays
	goldTypes := convertMarketTypeItems(marketTypes.Gold)
	silverTypes := convertMarketTypeItems(marketTypes.Silver)
	currencyTypes := convertMarketTypeItems(marketTypes.Currency)

	// If all empty, fallback to static (cold start: PriceCacheJob hasn't run yet)
	if len(goldTypes) == 0 && len(silverTypes) == 0 && len(currencyTypes) == 0 {
		h.fallbackStaticTypes(c)
		return
	}

	handler.Success(c, gin.H{
		"gold":              goldTypes,
		"silver":            silverTypes,
		"currency":          currencyTypes,
		"goldUpdatedAt":     marketTypes.GoldUpdatedAt,
		"silverUpdatedAt":   marketTypes.SilverUpdatedAt,
		"currencyUpdatedAt": marketTypes.CurrencyUpdatedAt,
		"timestamp":         time.Now().Format(time.RFC3339),
	})
}

// convertMarketTypeItems converts service-layer MarketTypeItem slice to gin.H slice
// for JSON serialization.
func convertMarketTypeItems(items []service.MarketTypeItem) []gin.H {
	result := make([]gin.H, len(items))
	for i, item := range items {
		result[i] = gin.H{
			"code":     item.Code,
			"name":     item.Name,
			"currency": item.Currency,
		}
	}
	return result
}

// fallbackStaticTypes serves market types from static registries.
// Used when the DB cache is empty (cold start before first PriceCacheJob run)
// or when AssetPriceService returns an error.
func (h *PublicHandler) fallbackStaticTypes(c *gin.Context) {
	goldTypes := make([]gin.H, len(gold.GoldTypes))
	for i, gt := range gold.GoldTypes {
		goldTypes[i] = gin.H{
			"code":     gt.Code,
			"name":     gt.Name,
			"currency": gt.Currency,
		}
	}

	silverTypes := make([]gin.H, len(silver.SilverTypes))
	for i, st := range silver.SilverTypes {
		silverTypes[i] = gin.H{
			"code":     st.Code,
			"name":     st.Name,
			"currency": st.Currency,
		}
	}

	currencyTypes := make([]gin.H, len(currency.CurrencyTypes))
	for i, ct := range currency.CurrencyTypes {
		currencyTypes[i] = gin.H{
			"code":     ct.Code,
			"name":     ct.Name,
			"currency": ct.Currency,
		}
	}

	handler.Success(c, gin.H{
		"gold":              goldTypes,
		"silver":            silverTypes,
		"currency":          currencyTypes,
		"goldUpdatedAt":     int64(0),
		"silverUpdatedAt":   int64(0),
		"currencyUpdatedAt": int64(0),
		"timestamp":         time.Now().Format(time.RFC3339),
	})
}
