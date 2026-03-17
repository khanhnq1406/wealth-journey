package handlers

import (
	"net/http"

	"wealthjourney/domain/models"
	"wealthjourney/domain/service"

	"github.com/gin-gonic/gin"
)

// SiteSettingsHandler handles site settings API requests.
type SiteSettingsHandler struct {
	service service.SiteSettingsService
}

// NewSiteSettingsHandler creates a new site settings handler.
func NewSiteSettingsHandler(svc service.SiteSettingsService) *SiteSettingsHandler {
	return &SiteSettingsHandler{service: svc}
}

// GetSiteSettings handles GET /api/v1/public/site-settings (no auth).
func (h *SiteSettingsHandler) GetSiteSettings(c *gin.Context) {
	settings, err := h.service.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to fetch settings"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "settings": settings})
}

type updateSiteSettingsRequest struct {
	Settings []struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	} `json:"settings"`
}

// UpdateSiteSettings handles PUT /api/v1/admin/site-settings (admin only).
func (h *SiteSettingsHandler) UpdateSiteSettings(c *gin.Context) {
	var req updateSiteSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request body"})
		return
	}

	if len(req.Settings) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "No settings provided"})
		return
	}

	// Get admin user ID from auth context
	adminUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	userID, ok := adminUserID.(int32)
	if !ok {
		// Try int conversion
		if intID, ok := adminUserID.(int); ok {
			userID = int32(intID)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Invalid user context"})
			return
		}
	}

	// Convert to models
	settingsModels := make([]*models.SiteSetting, len(req.Settings))
	for i, s := range req.Settings {
		settingsModels[i] = &models.SiteSetting{
			Key:   s.Key,
			Value: s.Value,
		}
	}

	updated, err := h.service.UpdateSettings(c.Request.Context(), userID, settingsModels)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  "Settings updated successfully",
		"settings": updated,
	})
}
