package handlers

import (
	"github.com/gin-gonic/gin"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
	v1 "wealthjourney/protobuf/v1"
)

// AdminUserHandler handles admin user management endpoints.
type AdminUserHandler struct {
	adminService service.AdminService
}

// NewAdminUserHandler creates a new AdminUserHandler.
func NewAdminUserHandler(adminService service.AdminService) *AdminUserHandler {
	return &AdminUserHandler{adminService: adminService}
}

// ListUsers handles GET /api/v1/admin/users
func (h *AdminUserHandler) ListUsers(c *gin.Context) {
	search := c.Query("search")
	params := parsePaginationParams(c)

	result, err := h.adminService.ListUsers(c.Request.Context(), search, params)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// ToggleRole handles PUT /api/v1/admin/users/:id/role
func (h *AdminUserHandler) ToggleRole(c *gin.Context) {
	adminUserID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	targetUserID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	var req v1.AdminToggleRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.BadRequest(c, err)
		return
	}
	req.UserId = targetUserID

	result, err := h.adminService.ToggleAdminRole(c.Request.Context(), adminUserID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}
