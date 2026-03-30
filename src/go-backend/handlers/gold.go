package handlers

import (
	"github.com/gin-gonic/gin"

	"wealthjourney/domain/models"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/gold"
	handler "wealthjourney/pkg/handler"
)

// goldTypeResponse is the JSON shape returned per gold type.
// Remains backward-compatible with existing frontend consumers.
type goldTypeResponse struct {
	Code       string  `json:"code"`
	Name       string  `json:"name"`
	Currency   string  `json:"currency"`
	Unit       string  `json:"unit"`
	UnitWeight float64 `json:"unitWeight"`
	Type       int     `json:"type"`
}

// GoldHandler handles gold-related endpoints
type GoldHandler struct {
	displayConfigSvc service.AssetDisplayConfigService
}

// NewGoldHandler creates a new gold handler with AssetDisplayConfigService for DB-backed VND type lookup.
func NewGoldHandler(displayConfigSvc service.AssetDisplayConfigService) *GoldHandler {
	return &GoldHandler{displayConfigSvc: displayConfigSvc}
}

// mapVNDConfigsToResponse maps AssetDisplayConfig rows to the goldTypeResponse shape.
func mapVNDConfigsToResponse(configs []*models.AssetDisplayConfig) []goldTypeResponse {
	result := make([]goldTypeResponse, 0, len(configs))
	for _, cfg := range configs {
		result = append(result, goldTypeResponse{
			Code:       cfg.TypeCode,
			Name:       cfg.DisplayName,
			Currency:   "VND",
			Unit:       "mace",
			UnitWeight: gold.GramsPerMace,
			Type:       8, // investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND
		})
	}
	return result
}

// mapUSDStaticToResponse maps the static USD gold types to the goldTypeResponse shape.
func mapUSDStaticToResponse() []goldTypeResponse {
	usdTypes := gold.GetGoldTypesByCurrency("USD")
	result := make([]goldTypeResponse, 0, len(usdTypes))
	for _, gt := range usdTypes {
		result = append(result, goldTypeResponse{
			Code:       gt.Code,
			Name:       gt.Name,
			Currency:   gt.Currency,
			Unit:       string(gt.Unit),
			UnitWeight: gt.UnitWeight,
			Type:       int(gt.Type),
		})
	}
	return result
}

// GetGoldTypeCodes returns available gold type codes for investment creation.
// GET /api/v1/investments/gold-types
//
// Query params:
//   - currency (optional): "VND" → DB configs, "USD" → static registry, empty → both merged.
//     Any other value returns 400 Bad Request.
func (h *GoldHandler) GetGoldTypeCodes(c *gin.Context) {
	currency := c.Query("currency")

	// Whitelist: only VND, USD, or empty are accepted.
	if currency != "" && currency != "VND" && currency != "USD" {
		handler.BadRequest(c, &badCurrencyError{currency: currency})
		return
	}

	var result []goldTypeResponse

	switch currency {
	case "USD":
		result = mapUSDStaticToResponse()

	case "VND":
		configs, err := h.displayConfigSvc.ListForInvestment(c.Request.Context(), "gold")
		if err != nil {
			handler.HandleError(c, err)
			return
		}
		result = mapVNDConfigsToResponse(configs)

	default:
		// Merge: VND from DB + USD from static registry
		configs, err := h.displayConfigSvc.ListForInvestment(c.Request.Context(), "gold")
		if err != nil {
			handler.HandleError(c, err)
			return
		}
		result = append(mapVNDConfigsToResponse(configs), mapUSDStaticToResponse()...)
	}

	handler.Success(c, result)
}

// badCurrencyError is a simple error used for invalid currency param validation.
type badCurrencyError struct {
	currency string
}

func (e *badCurrencyError) Error() string {
	return "invalid currency '" + e.currency + "': must be VND, USD, or omitted"
}
