package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/models"
	"wealthjourney/domain/service"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/handler"
)

// SiteSettingsHandler handles site settings API requests.
type SiteSettingsHandler struct {
	service service.SiteSettingsService
}

// NewSiteSettingsHandler creates a new site settings handler.
func NewSiteSettingsHandler(svc service.SiteSettingsService) *SiteSettingsHandler {
	return &SiteSettingsHandler{service: svc}
}

// SiteSettingDTO is the public-facing site setting (no updatedBy).
type SiteSettingDTO struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

func toSiteSettingDTOs(settings []*models.SiteSetting) []SiteSettingDTO {
	dtos := make([]SiteSettingDTO, len(settings))
	for i, s := range settings {
		dtos[i] = SiteSettingDTO{Key: s.Key, Value: s.Value}
	}
	return dtos
}

// GetSiteSettings handles GET /api/v1/public/site-settings (no auth).
func (h *SiteSettingsHandler) GetSiteSettings(c *gin.Context) {
	settings, err := h.service.GetAll(c.Request.Context())
	if err != nil {
		handler.InternalErrorWithCode(c, apperrors.Codes.SettingsFetchFailed, "Failed to fetch settings")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"settings": toSiteSettingDTOs(settings)},
	})
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
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.SettingsRequestInvalid, "Invalid request body"))
		return
	}

	if len(req.Settings) == 0 {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.SettingsEmpty, "No settings provided"))
		return
	}

	// Get admin user ID from auth context (consistent with other handlers)
	userID := int32(c.GetInt("user_id"))

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
		errMsg := err.Error()
		// Validation errors are safe to return; internal errors are not
		if strings.HasPrefix(errMsg, "invalid setting key:") ||
			strings.HasPrefix(errMsg, "setting value cannot be empty") ||
			strings.HasPrefix(errMsg, "setting value exceeds") ||
			strings.HasPrefix(errMsg, "seo.") ||
			strings.HasPrefix(errMsg, "no settings provided") {
			handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.SettingsRequestInvalid, errMsg))
			return
		}
		handler.InternalErrorWithCode(c, apperrors.Codes.SettingsUpdateFailed, "Failed to update settings")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Settings updated successfully",
		"data":    gin.H{"settings": toSiteSettingDTOs(updated)},
	})
}
