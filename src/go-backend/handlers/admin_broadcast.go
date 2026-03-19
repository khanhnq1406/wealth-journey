package handlers

import (
	"time"

	"github.com/gin-gonic/gin"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
)

type AdminBroadcastHandler struct {
	adminService service.AdminService
}

func NewAdminBroadcastHandler(adminService service.AdminService) *AdminBroadcastHandler {
	return &AdminBroadcastHandler{adminService: adminService}
}

// SendBroadcast handles POST /api/v1/admin/broadcast
func (h *AdminBroadcastHandler) SendBroadcast(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req struct {
		Title   string `json:"title"`
		Message string `json:"message" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	count, err := h.adminService.Broadcast(c.Request.Context(), userID, req.Title, req.Message)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success":        true,
		"message":        "Broadcast sent",
		"recipientCount": count,
		"timestamp":      time.Now().Format(time.RFC3339),
	})
}
