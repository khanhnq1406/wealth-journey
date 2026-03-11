package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/pkg/gold"
	"wealthjourney/pkg/silver"
)

// PublicHandler handles public (no auth) endpoints
type PublicHandler struct{}

// NewPublicHandler creates a new public handler
func NewPublicHandler() *PublicHandler {
	return &PublicHandler{}
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

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Market types retrieved successfully",
		"gold":      goldTypes,
		"silver":    silverTypes,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}
