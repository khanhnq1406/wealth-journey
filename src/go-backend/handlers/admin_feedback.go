package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
	v1 "wealthjourney/protobuf/v1"
)

// AdminFeedbackHandler handles admin feedback management endpoints.
type AdminFeedbackHandler struct {
	adminService service.AdminService
}

// NewAdminFeedbackHandler creates a new AdminFeedbackHandler.
func NewAdminFeedbackHandler(adminService service.AdminService) *AdminFeedbackHandler {
	return &AdminFeedbackHandler{adminService: adminService}
}

// ListFeedback handles GET /api/v1/admin/feedback
func (h *AdminFeedbackHandler) ListFeedback(c *gin.Context) {
	statusFilter := int32(0)
	if s := c.Query("status"); s != "" {
		if v, err := strconv.ParseInt(s, 10, 32); err == nil {
			statusFilter = int32(v)
		}
	}

	params := parsePaginationParams(c)

	result, err := h.adminService.ListFeedback(c.Request.Context(), statusFilter, params)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// UpdateFeedback handles PUT /api/v1/admin/feedback/:id
func (h *AdminFeedbackHandler) UpdateFeedback(c *gin.Context) {
	feedbackID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	var req v1.AdminUpdateFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.BadRequest(c, err)
		return
	}
	req.FeedbackId = feedbackID

	result, err := h.adminService.UpdateFeedback(c.Request.Context(), feedbackID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// DeleteFeedback handles DELETE /api/v1/admin/feedback/:id
func (h *AdminFeedbackHandler) DeleteFeedback(c *gin.Context) {
	feedbackID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.adminService.DeleteFeedback(c.Request.Context(), feedbackID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}
