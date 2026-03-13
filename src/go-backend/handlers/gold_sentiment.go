package handlers

import (
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/auth"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
	v1 "wealthjourney/protobuf/v1"
)

// GoldSentimentHandler handles gold sentiment voting and comments.
type GoldSentimentHandler struct {
	service service.GoldSentimentService
	authSrv *auth.Server
}

func NewGoldSentimentHandler(svc service.GoldSentimentService, authSrv *auth.Server) *GoldSentimentHandler {
	return &GoldSentimentHandler{service: svc, authSrv: authSrv}
}

// tryGetUserID attempts to extract user ID from optional auth header.
// Returns 0 if no valid token is present (does not reject the request).
func (h *GoldSentimentHandler) tryGetUserID(c *gin.Context) int32 {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return 0
	}
	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == authHeader {
		return 0
	}
	result, err := h.authSrv.VerifyAuth(token)
	if err != nil {
		return 0
	}
	return result.Data.Id
}

// GetGoldSentiment returns today's vote counts and percentages.
// Public endpoint with optional auth for user_vote field.
func (h *GoldSentimentHandler) GetGoldSentiment(c *gin.Context) {
	userID := h.tryGetUserID(c)

	result, err := h.service.GetSentiment(c.Request.Context(), userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetGoldSentimentComments returns paginated comments for today.
// Public endpoint with optional auth for is_own_comment field.
func (h *GoldSentimentHandler) GetGoldSentimentComments(c *gin.Context) {
	userID := h.tryGetUserID(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

	req := &v1.GetGoldSentimentCommentsRequest{
		Page:     int32(page),
		PageSize: int32(pageSize),
	}

	result, err := h.service.GetComments(c.Request.Context(), userID, req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// CastGoldVote creates or updates a user's vote for today.
// Protected endpoint — requires auth.
func (h *GoldSentimentHandler) CastGoldVote(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req v1.CastGoldVoteRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.service.CastVote(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// PostGoldSentimentComment creates a comment for today's vote thread.
// Protected endpoint — requires auth.
func (h *GoldSentimentHandler) PostGoldSentimentComment(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req v1.PostGoldSentimentCommentRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.service.PostComment(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

// DeleteGoldSentimentComment deletes a user's own comment.
// Protected endpoint — requires auth.
func (h *GoldSentimentHandler) DeleteGoldSentimentComment(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	commentID, err := strconv.Atoi(c.Param("comment_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	if err := h.service.DeleteComment(c.Request.Context(), userID, int32(commentID)); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.NoContent(c)
}
