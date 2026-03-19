package handlers

import (
	"net/http"
	"time"

	"wealthjourney/domain/service"
	pkgredis "wealthjourney/pkg/redis"

	"github.com/gin-gonic/gin"
)

type PriceAlertConfigHandler struct {
	redisClient *pkgredis.RedisClient
}

func NewPriceAlertConfigHandler(rdb *pkgredis.RedisClient) *PriceAlertConfigHandler {
	return &PriceAlertConfigHandler{redisClient: rdb}
}

// GetConfig handles GET /api/v1/admin/price-alert-config
func (h *PriceAlertConfigHandler) GetConfig(c *gin.Context) {
	cfg := service.LoadPriceAlertConfig(c.Request.Context(), h.redisClient)

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"config":    cfg,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// UpdateConfig handles PUT /api/v1/admin/price-alert-config
func (h *PriceAlertConfigHandler) UpdateConfig(c *gin.Context) {
	var req service.PriceAlertConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request body",
			"errors":  map[string]string{"body": err.Error()},
		})
		return
	}

	// Load current config for merging (partial updates)
	current := service.LoadPriceAlertConfig(c.Request.Context(), h.redisClient)

	// Merge: only update provided fields
	merged := mergeConfig(current, req)

	// Sanitize HTML from all string fields
	service.SanitizePriceAlertConfig(&merged)

	// Validate
	if errs := service.ValidatePriceAlertConfig(merged); errs != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Validation failed",
			"errors":  errs,
		})
		return
	}

	// Save to Redis
	if err := service.SavePriceAlertConfig(c.Request.Context(), h.redisClient, merged); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "Failed to save configuration",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Price alert configuration updated",
		"config":    merged,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// mergeConfig merges a partial update into the current config.
func mergeConfig(current, update service.PriceAlertConfig) service.PriceAlertConfig {
	result := current

	if update.CooldownMinutes > 0 {
		result.CooldownMinutes = update.CooldownMinutes
	}
	if update.TopMoversCount > 0 {
		result.TopMoversCount = update.TopMoversCount
	}

	// Merge per-category settings
	for cat, catUpdate := range update.Categories {
		if existing, ok := result.Categories[cat]; ok {
			existing.Enabled = catUpdate.Enabled
			if catUpdate.ThresholdPct > 0 {
				existing.ThresholdPct = catUpdate.ThresholdPct
			}
			if catUpdate.TitleTemplate != "" {
				existing.TitleTemplate = catUpdate.TitleTemplate
			}
			if catUpdate.BodyTemplate != "" {
				existing.BodyTemplate = catUpdate.BodyTemplate
			}
			result.Categories[cat] = existing
		}
	}

	return result
}
