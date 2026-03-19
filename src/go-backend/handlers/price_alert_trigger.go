package handlers

import (
	"net/http"
	"time"

	"wealthjourney/domain/service"

	"github.com/gin-gonic/gin"
)

// PriceAlertTriggerHandler handles manual price alert triggering.
type PriceAlertTriggerHandler struct {
	priceAlertSvc service.PriceAlertService
}

// NewPriceAlertTriggerHandler creates a new PriceAlertTriggerHandler.
func NewPriceAlertTriggerHandler(priceAlertSvc service.PriceAlertService) *PriceAlertTriggerHandler {
	return &PriceAlertTriggerHandler{priceAlertSvc: priceAlertSvc}
}

// TriggerCheck manually triggers a price alert check cycle.
func (h *PriceAlertTriggerHandler) TriggerCheck(c *gin.Context) {
	if err := h.priceAlertSvc.CheckAndAlert(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success":   false,
			"message":   "Price alert check failed",
			"error":     err.Error(),
			"timestamp": time.Now().Unix(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Price alert check completed",
		"timestamp": time.Now().Unix(),
	})
}
