package handlers

import (
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
)

var base64Regex = regexp.MustCompile(`^[A-Za-z0-9+/=_-]+$`)

type PushHandler struct {
	pushSvc    service.PushService
	pushSubRepo repository.PushSubscriptionRepository
}

func NewPushHandler(pushSvc service.PushService, pushSubRepo repository.PushSubscriptionRepository) *PushHandler {
	return &PushHandler{pushSvc: pushSvc, pushSubRepo: pushSubRepo}
}

// GetVAPIDKey handles GET /api/v1/push/vapid-key
func (h *PushHandler) GetVAPIDKey(c *gin.Context) {
	handler.Success(c, gin.H{
		"success":   true,
		"publicKey": h.pushSvc.GetVAPIDPublicKey(),
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// Subscribe handles POST /api/v1/push/subscribe
func (h *PushHandler) Subscribe(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req struct {
		Endpoint string `json:"endpoint" binding:"required"`
		P256dh   string `json:"p256dh" binding:"required"`
		Auth     string `json:"auth" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Validate endpoint
	if !strings.HasPrefix(req.Endpoint, "https://") {
		handler.BadRequest(c, errors.New("endpoint must use HTTPS"))
		return
	}
	if len(req.Endpoint) > 2048 {
		handler.BadRequest(c, errors.New("endpoint too long"))
		return
	}

	// Validate keys
	if len(req.P256dh) > 256 || !base64Regex.MatchString(req.P256dh) {
		handler.BadRequest(c, errors.New("invalid p256dh key"))
		return
	}
	if len(req.Auth) > 256 || !base64Regex.MatchString(req.Auth) {
		handler.BadRequest(c, errors.New("invalid auth key"))
		return
	}

	// Max 5 subscriptions per user
	count, err := h.pushSubRepo.CountByUserID(c.Request.Context(), userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}
	if count >= 5 {
		handler.BadRequest(c, errors.New("maximum 5 push subscriptions per user"))
		return
	}

	sub := &models.PushSubscription{
		UserID:   userID,
		Endpoint: req.Endpoint,
		P256dh:   req.P256dh,
		Auth:     req.Auth,
	}
	if err := h.pushSubRepo.Create(c.Request.Context(), sub); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success":   true,
		"message":   "Push subscription created",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// Unsubscribe handles DELETE /api/v1/push/subscribe
func (h *PushHandler) Unsubscribe(c *gin.Context) {
	_, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req struct {
		Endpoint string `json:"endpoint" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	if err := h.pushSubRepo.DeleteByEndpoint(c.Request.Context(), req.Endpoint); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success":   true,
		"message":   "Push subscription removed",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}
