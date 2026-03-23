package handlers

import (
	"net/http"
	"regexp"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/pkg/cache"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/handler"
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
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.PriceOverrideRequestInvalid, "Invalid request body"))
		return
	}

	// Validate category
	if !validCategories[req.Category] {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.PriceOverrideCategoryInvalid, "Invalid category. Must be one of: gold, silver, currency, stock"))
		return
	}

	// Validate typeCode length
	if len(req.TypeCode) > 50 {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.PriceOverrideTypeCodeTooLong, "TypeCode must be 50 characters or less"))
		return
	}

	// Validate currency format
	if !currencyRegex.MatchString(req.Currency) {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.PriceOverrideCurrencyInvalid, "Currency must be a valid 3-letter ISO 4217 code"))
		return
	}

	// Validate buy/sell positive
	if req.Buy <= 0 || req.Sell <= 0 {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.PriceOverridePricePositive, "Buy and sell must be positive values"))
		return
	}

	// Validate name length
	if len(req.Name) > 100 {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.PriceOverrideNameTooLong, "Name must be 100 characters or less"))
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
		handler.InternalErrorWithCode(c, apperrors.Codes.PriceOverrideSaveFailed, "Failed to save price override")
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
			handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.PriceOverrideFilterInvalid, "Invalid category filter"))
			return
		}
		overrides, err = h.cache.GetAllByCategory(ctx, category)
	} else {
		overrides, err = h.cache.GetAll(ctx)
	}

	if err != nil {
		handler.InternalErrorWithCode(c, apperrors.Codes.PriceOverrideListFailed, "Failed to list price overrides")
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
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.PriceOverrideRequestInvalid, "Invalid request body"))
		return
	}

	if err := h.cache.Delete(c.Request.Context(), req.Category, req.TypeCode, req.Currency); err != nil {
		handler.InternalErrorWithCode(c, apperrors.Codes.PriceOverrideDeleteFailed, "Failed to delete price override")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Price override removed",
	})
}
