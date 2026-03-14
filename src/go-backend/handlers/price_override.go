package handlers

import (
	"net/http"
	"regexp"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/pkg/cache"
)

var validCategories = map[string]bool{
	"gold": true, "silver": true, "currency": true, "stock": true,
}

var currencyRegex = regexp.MustCompile(`^[A-Z]{3}$`)

type PriceOverrideHandler struct {
	cache *cache.PriceOverrideCache
}

func NewPriceOverrideHandler(c *cache.PriceOverrideCache) *PriceOverrideHandler {
	return &PriceOverrideHandler{cache: c}
}

type setPriceOverrideRequest struct {
	Category string `json:"category" binding:"required"`
	TypeCode string `json:"typeCode" binding:"required"`
	Currency string `json:"currency" binding:"required"`
	Buy      int64  `json:"buy" binding:"required"`
	Sell     int64  `json:"sell" binding:"required"`
	Name     string `json:"name" binding:"required"`
}

func (h *PriceOverrideHandler) SetPriceOverride(c *gin.Context) {
	var req setPriceOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request: " + err.Error()})
		return
	}

	// Validate category
	if !validCategories[req.Category] {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid category. Must be one of: gold, silver, currency, stock"})
		return
	}

	// Validate typeCode length
	if len(req.TypeCode) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "TypeCode must be 50 characters or less"})
		return
	}

	// Validate currency format
	if !currencyRegex.MatchString(req.Currency) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Currency must be a valid 3-letter ISO 4217 code"})
		return
	}

	// Validate buy/sell positive
	if req.Buy <= 0 || req.Sell <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Buy and sell must be positive values"})
		return
	}

	// Validate name length
	if len(req.Name) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Name must be 100 characters or less"})
		return
	}

	userID := c.GetInt("user_id")

	override := &cache.PriceOverride{
		TypeCode:  req.TypeCode,
		Name:      req.Name,
		Buy:       req.Buy,
		Sell:      req.Sell,
		Currency:  req.Currency,
		Category:  req.Category,
		UpdatedBy: int32(userID),
		UpdatedAt: time.Now().Unix(),
	}

	if err := h.cache.Set(c.Request.Context(), override); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "Failed to save price override"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  "Price override saved",
		"override": override,
	})
}

func (h *PriceOverrideHandler) ListPriceOverrides(c *gin.Context) {
	ctx := c.Request.Context()
	category := c.Query("category")

	var overrides []*cache.PriceOverride
	var err error

	if category != "" {
		if !validCategories[category] {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid category filter"})
			return
		}
		overrides, err = h.cache.GetAllByCategory(ctx, category)
	} else {
		overrides, err = h.cache.GetAll(ctx)
	}

	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "Failed to list price overrides"})
		return
	}

	if overrides == nil {
		overrides = []*cache.PriceOverride{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"overrides": overrides,
	})
}

type deletePriceOverrideRequest struct {
	Category string `json:"category" binding:"required"`
	TypeCode string `json:"typeCode" binding:"required"`
	Currency string `json:"currency" binding:"required"`
}

func (h *PriceOverrideHandler) DeletePriceOverride(c *gin.Context) {
	var req deletePriceOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request: " + err.Error()})
		return
	}

	if err := h.cache.Delete(c.Request.Context(), req.Category, req.TypeCode, req.Currency); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "Failed to delete price override"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Price override removed",
	})
}
