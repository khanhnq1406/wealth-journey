package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	handler "wealthjourney/pkg/handler"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/silver"
)

// SilverHandler handles silver-related endpoints
type SilverHandler struct {
	displayConfigSvc service.AssetDisplayConfigService
}

// NewSilverHandler creates a new silver handler
func NewSilverHandler(displayConfigSvc service.AssetDisplayConfigService) *SilverHandler {
	return &SilverHandler{displayConfigSvc: displayConfigSvc}
}

// GetSilverTypeCodes returns available silver type codes for investment creation.
// GET /api/v1/investments/silver-types
//
// Query params:
//   - currency: optional filter — "VND", "USD", or empty for all.
//
// Behaviour:
//   - currency=USD  → static registry (silver package)
//   - currency=VND  → DB via AssetDisplayConfigService.ListForInvestment("silver")
//   - (empty)       → VND from DB merged with USD from static
//
// Currency is whitelisted to "VND", "USD", or empty; any other value returns 400.
func (h *SilverHandler) GetSilverTypeCodes(c *gin.Context) {
	currency := c.Query("currency")

	// Whitelist currency param (security: prevent arbitrary values reaching service layer)
	if currency != "" && currency != "VND" && currency != "USD" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid currency parameter: must be 'VND', 'USD', or empty",
		})
		return
	}

	var result []map[string]interface{}

	switch currency {
	case "USD":
		// USD silver — always from the static registry (Yahoo Finance symbols)
		usdTypes := silver.GetSilverTypesByCurrency("USD")
		result = make([]map[string]interface{}, len(usdTypes))
		for i, st := range usdTypes {
			result[i] = map[string]interface{}{
				"code":     st.Code,
				"name":     st.Name,
				"currency": st.Currency,
				"type":     int32(st.Type),
			}
		}

	case "VND":
		// VND silver — sourced from DB (admin-configurable via AssetDisplayConfig)
		configs, err := h.displayConfigSvc.ListForInvestment(c.Request.Context(), "silver")
		if err != nil {
			handler.HandleError(c, err)
			return
		}
		result = make([]map[string]interface{}, len(configs))
		for i, cfg := range configs {
			result[i] = map[string]interface{}{
				"code":     cfg.TypeCode,
				"name":     cfg.DisplayName,
				"currency": "VND",
				"type":     int32(10), // INVESTMENT_TYPE_SILVER_VND enum value
			}
		}

	default: // empty — merge VND from DB + USD from static
		configs, err := h.displayConfigSvc.ListForInvestment(c.Request.Context(), "silver")
		if err != nil {
			handler.HandleError(c, err)
			return
		}

		vndItems := make([]map[string]interface{}, len(configs))
		for i, cfg := range configs {
			vndItems[i] = map[string]interface{}{
				"code":     cfg.TypeCode,
				"name":     cfg.DisplayName,
				"currency": "VND",
				"type":     int32(10), // INVESTMENT_TYPE_SILVER_VND
			}
		}

		usdTypes := silver.GetSilverTypesByCurrency("USD")
		usdItems := make([]map[string]interface{}, len(usdTypes))
		for i, st := range usdTypes {
			usdItems[i] = map[string]interface{}{
				"code":     st.Code,
				"name":     st.Name,
				"currency": st.Currency,
				"type":     int32(st.Type),
			}
		}

		result = append(vndItems, usdItems...)
	}

	handler.Success(c, gin.H{
		"data": result,
	})
}
