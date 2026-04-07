package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
	v1 "wealthjourney/protobuf/v1"
)

// UserPriceAlertHandlers handles price alert HTTP requests.
type UserPriceAlertHandlers struct {
	alertService service.UserPriceAlertService
}

// NewUserPriceAlertHandlers creates a new UserPriceAlertHandlers instance.
func NewUserPriceAlertHandlers(alertService service.UserPriceAlertService) *UserPriceAlertHandlers {
	return &UserPriceAlertHandlers{alertService: alertService}
}

// CreateAlert creates a new price alert for the authenticated user.
func (h *UserPriceAlertHandlers) CreateAlert(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req v1.CreateUserPriceAlertRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.alertService.CreateAlert(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

// ListAlerts lists all price alerts for the authenticated user.
func (h *UserPriceAlertHandlers) ListAlerts(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse status_filter manually: ShouldBindQuery cannot bind proto enums
	// because proto-generated structs have json:"" tags but NOT form:"" tags.
	// Gin's query binding uses form tags; without them, the param is silently ignored.
	var req v1.ListUserPriceAlertsRequest
	if statusStr := c.Query("status_filter"); statusStr != "" {
		if statusInt, err := strconv.Atoi(statusStr); err == nil {
			req.StatusFilter = v1.AlertStatus(statusInt)
		}
		// On Atoi error (non-numeric): StatusFilter stays 0 (UNSPECIFIED = all). Safe.
	}

	// Bind remaining params (pagination) via ShouldBindQuery.
	// Pagination sub-fields (pagination.page, pagination.page_size) use dot-notation
	// which Gin does not support for nested proto structs without form tags.
	// The service's buildListOptions falls back to defaults when Pagination is nil — safe.
	if err := c.ShouldBindQuery(&req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.alertService.ListAlerts(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// UpdateAlert updates an existing price alert owned by the authenticated user.
func (h *UserPriceAlertHandlers) UpdateAlert(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	alertIDStr := c.Param("id")
	alertIDInt, err := strconv.Atoi(alertIDStr)
	if err != nil || alertIDInt <= 0 {
		handler.BadRequest(c, err)
		return
	}
	alertID := int32(alertIDInt)

	var req v1.UpdateUserPriceAlertRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.alertService.UpdateAlert(c.Request.Context(), alertID, userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// DeleteAlert deletes a price alert owned by the authenticated user.
func (h *UserPriceAlertHandlers) DeleteAlert(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	alertIDStr := c.Param("id")
	alertIDInt, err := strconv.Atoi(alertIDStr)
	if err != nil || alertIDInt <= 0 {
		handler.BadRequest(c, err)
		return
	}
	alertID := int32(alertIDInt)

	result, err := h.alertService.DeleteAlert(c.Request.Context(), alertID, userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}
