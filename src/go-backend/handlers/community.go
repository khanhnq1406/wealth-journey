package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/auth"
	"wealthjourney/domain/service"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/handler"
	pkgredis "wealthjourney/pkg/redis"
	v1 "wealthjourney/protobuf/v1"
)

// CommunityHandler handles community-related HTTP requests.
type CommunityHandler struct {
	communityService service.CommunityService
	redisClient      *pkgredis.RedisClient
	authSrv          *auth.Server
}

// NewCommunityHandler creates a new CommunityHandler instance.
func NewCommunityHandler(communityService service.CommunityService, rdb *pkgredis.RedisClient, authSrv *auth.Server) *CommunityHandler {
	return &CommunityHandler{
		communityService: communityService,
		redisClient:      rdb,
		authSrv:          authSrv,
	}
}

// CreatePost creates a new community post.
func (h *CommunityHandler) CreatePost(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req v1.CreatePostRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.communityService.CreatePost(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

// UpdatePost updates an existing post.
func (h *CommunityHandler) UpdatePost(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	postID, err := strconv.Atoi(c.Param("post_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	var req v1.UpdatePostRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}
	req.PostId = int32(postID)

	result, err := h.communityService.UpdatePost(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// DeletePost deletes a post.
func (h *CommunityHandler) DeletePost(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	postID, err := strconv.Atoi(c.Param("post_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	if err := h.communityService.DeletePost(c.Request.Context(), userID, int32(postID)); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success":   true,
		"message":   "Post deleted successfully",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// GetPost retrieves a single post.
func (h *CommunityHandler) GetPost(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	postID, err := strconv.Atoi(c.Param("post_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.communityService.GetPost(c.Request.Context(), userID, int32(postID))
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetFeed retrieves the user's feed.
func (h *CommunityHandler) GetFeed(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	req := &v1.GetFeedRequest{}

	// Parse pagination from query params
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	req.Pagination = &v1.PaginationParams{
		Page:     int32(page),
		PageSize: int32(pageSize),
	}
	req.Hashtag = c.Query("hashtag")

	result, err := h.communityService.GetFeed(c.Request.Context(), userID, req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetUserPosts retrieves posts by a specific user.
func (h *CommunityHandler) GetUserPosts(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	targetUserID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	req := &v1.GetUserPostsRequest{
		UserId: int32(targetUserID),
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	req.Pagination = &v1.PaginationParams{
		Page:     int32(page),
		PageSize: int32(pageSize),
	}

	result, err := h.communityService.GetUserPosts(c.Request.Context(), userID, int32(targetUserID), req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// LikePost likes a post.
func (h *CommunityHandler) LikePost(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	postID, err := strconv.Atoi(c.Param("post_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	if err := h.communityService.LikePost(c.Request.Context(), userID, int32(postID)); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success":   true,
		"message":   "Post liked",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// UnlikePost removes a like from a post.
func (h *CommunityHandler) UnlikePost(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	postID, err := strconv.Atoi(c.Param("post_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	if err := h.communityService.UnlikePost(c.Request.Context(), userID, int32(postID)); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success":   true,
		"message":   "Post unliked",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// CreateComment adds a comment to a post.
func (h *CommunityHandler) CreateComment(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	postID, err := strconv.Atoi(c.Param("post_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	var req v1.CreateCommentRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}
	req.PostId = int32(postID)

	result, err := h.communityService.CreateComment(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

// DeleteComment deletes a comment.
func (h *CommunityHandler) DeleteComment(c *gin.Context) {
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

	if err := h.communityService.DeleteComment(c.Request.Context(), userID, int32(commentID)); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success":   true,
		"message":   "Comment deleted successfully",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// UpdateComment handles PUT /api/v1/community/comments/:comment_id
func (h *CommunityHandler) UpdateComment(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	commentIDStr := c.Param("comment_id")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 32)
	if err != nil {
		handler.HandleError(c, apperrors.NewValidationError("invalid comment ID"))
		return
	}

	var req v1.UpdateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.HandleError(c, apperrors.NewValidationError(err.Error()))
		return
	}
	req.CommentId = int32(commentID)

	resp, err := h.communityService.UpdateComment(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, resp)
}

// GetComments retrieves comments for a post.
func (h *CommunityHandler) GetComments(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	postID, err := strconv.Atoi(c.Param("post_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	req := &v1.GetCommentsRequest{
		PostId: int32(postID),
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	req.Pagination = &v1.PaginationParams{
		Page:     int32(page),
		PageSize: int32(pageSize),
	}

	result, err := h.communityService.GetComments(c.Request.Context(), userID, int32(postID), req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// FollowUser follows a user.
func (h *CommunityHandler) FollowUser(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	targetUserID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	if err := h.communityService.FollowUser(c.Request.Context(), userID, int32(targetUserID)); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success":   true,
		"message":   "User followed",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// UnfollowUser unfollows a user.
func (h *CommunityHandler) UnfollowUser(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	targetUserID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	if err := h.communityService.UnfollowUser(c.Request.Context(), userID, int32(targetUserID)); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success":   true,
		"message":   "User unfollowed",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// GetProfile retrieves a user's community profile.
func (h *CommunityHandler) GetProfile(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	targetUserID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.communityService.GetProfile(c.Request.Context(), userID, int32(targetUserID))
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// UpdateBio updates the user's bio.
func (h *CommunityHandler) UpdateBio(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req struct {
		Bio string `json:"bio"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	if err := h.communityService.UpdateBio(c.Request.Context(), userID, req.Bio); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success":   true,
		"message":   "Bio updated successfully",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// ReportContent reports a post or comment.
func (h *CommunityHandler) ReportContent(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req v1.ReportContentRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	if err := h.communityService.ReportContent(c.Request.Context(), userID, &req); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success":   true,
		"message":   "Content reported successfully",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// UploadImage handles POST /api/v1/community/upload
// Accepts multipart form with "file" field and optional "purpose" field.
func (h *CommunityHandler) UploadImage(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Enforce 5MB limit on the request body
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 5<<20)

	file, fileHeader, err := c.Request.FormFile("file")
	if err != nil {
		handler.HandleError(c, apperrors.NewValidationError("missing file field"))
		return
	}
	defer file.Close()

	// Read file bytes
	fileData := make([]byte, fileHeader.Size)
	if _, err := file.Read(fileData); err != nil {
		handler.HandleError(c, apperrors.NewValidationError("failed to read file"))
		return
	}

	purpose := c.PostForm("purpose")
	if purpose == "" {
		purpose = "post"
	}

	imageURL, err := h.communityService.UploadImage(c.Request.Context(), userID, fileData, purpose, fileHeader.Filename)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success":   true,
		"message":   "Image uploaded successfully",
		"imageUrl":  imageURL,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// SharePost shares/reposts a post.
func (h *CommunityHandler) SharePost(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	postID, err := strconv.Atoi(c.Param("post_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	var req v1.SharePostRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}
	req.PostId = int32(postID)

	result, err := h.communityService.SharePost(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

// GetNotifications retrieves notifications for the authenticated user.
func (h *CommunityHandler) GetNotifications(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	req := &v1.GetNotificationsRequest{}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	req.Pagination = &v1.PaginationParams{
		Page:     int32(page),
		PageSize: int32(pageSize),
	}

	result, err := h.communityService.GetNotifications(c.Request.Context(), userID, req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetUnreadNotificationCount returns the count of unread notifications.
func (h *CommunityHandler) GetUnreadNotificationCount(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	result, err := h.communityService.GetUnreadNotificationCount(c.Request.Context(), userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// MarkNotificationsRead marks all notifications as read.
func (h *CommunityHandler) MarkNotificationsRead(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	if err := h.communityService.MarkNotificationsRead(c.Request.Context(), userID); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"success": true,
		"message": "Notifications marked as read",
	})
}

// SavePost saves a post to the user's saved collection.
func (h *CommunityHandler) SavePost(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	postID, err := strconv.Atoi(c.Param("post_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	if err := h.communityService.SavePost(c.Request.Context(), userID, int32(postID)); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{"success": true})
}

// UnsavePost removes a post from the user's saved collection.
func (h *CommunityHandler) UnsavePost(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	postID, err := strconv.Atoi(c.Param("post_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	if err := h.communityService.UnsavePost(c.Request.Context(), userID, int32(postID)); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{"success": true})
}

// GetSavedPosts retrieves the user's saved posts.
func (h *CommunityHandler) GetSavedPosts(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	req := &v1.GetSavedPostsRequest{}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	req.Pagination = &v1.PaginationParams{
		Page:     int32(page),
		PageSize: int32(pageSize),
	}

	result, err := h.communityService.GetSavedPosts(c.Request.Context(), userID, req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetSuggestedUsers returns a list of suggested users to follow.
func (h *CommunityHandler) GetSuggestedUsers(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	result, err := h.communityService.GetSuggestedUsers(c.Request.Context(), userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetTrendingTopics returns trending hashtags.
func (h *CommunityHandler) GetTrendingTopics(c *gin.Context) {
	result, err := h.communityService.GetTrendingTopics(c.Request.Context())
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetFollowing returns paginated list of users that a user follows.
func (h *CommunityHandler) GetFollowing(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	targetUserID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	req := &v1.GetFollowingRequest{
		UserId: int32(targetUserID),
		Pagination: &v1.PaginationParams{
			Page:     int32(page),
			PageSize: int32(pageSize),
		},
	}

	result, err := h.communityService.GetFollowing(c.Request.Context(), userID, int32(targetUserID), req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetFollowers returns paginated list of users who follow a user.
func (h *CommunityHandler) GetFollowers(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	targetUserID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	req := &v1.GetFollowersRequest{
		UserId: int32(targetUserID),
		Pagination: &v1.PaginationParams{
			Page:     int32(page),
			PageSize: int32(pageSize),
		},
	}

	result, err := h.communityService.GetFollowers(c.Request.Context(), userID, int32(targetUserID), req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// UpdateProfile updates the authenticated user's community profile fields.
func (h *CommunityHandler) UpdateProfile(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req v1.UpdateProfileRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.communityService.UpdateProfile(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetLikedPosts retrieves posts liked by a specific user.
func (h *CommunityHandler) GetLikedPosts(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	targetUserID, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		handler.HandleError(c, apperrors.NewValidationError("invalid user ID"))
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	req := &v1.GetLikedPostsRequest{
		UserId: int32(targetUserID),
		Pagination: &v1.PaginationParams{
			Page:     int32(page),
			PageSize: int32(pageSize),
		},
	}

	result, err := h.communityService.GetLikedPosts(c.Request.Context(), userID, int32(targetUserID), req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// StreamNotifications handles GET /api/v1/community/notifications/stream (SSE).
// The EventSource API cannot send custom headers, so the JWT is passed as a
// ?token= query parameter instead of the Authorization header.
func (h *CommunityHandler) StreamNotifications(c *gin.Context) {
	// Validate token from query parameter (EventSource API limitation)
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
		return
	}

	if h.authSrv == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "auth service unavailable"})
		return
	}

	// Parse and validate the JWT to extract the user ID
	claims, err := h.authSrv.ParseToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}
	userID := claims.UserID

	if h.redisClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "streaming not available"})
		return
	}

	// Set SSE response headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	// Subscribe to the user's personal notification channel
	channel := fmt.Sprintf("user:%d:notifications", userID)
	pubsub := h.redisClient.Subscribe(channel)
	defer pubsub.Close()

	// Keep-alive ticker sends a comment every 30 s to prevent proxy timeouts
	ctx := c.Request.Context()
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	c.Stream(func(w io.Writer) bool {
		select {
		case msg, ok := <-pubsub.Channel():
			if !ok {
				return false
			}
			fmt.Fprintf(w, "event: notification\ndata: %s\n\n", msg.Payload)
			return true
		case <-ticker.C:
			// SSE comment (keep-alive ping)
			fmt.Fprintf(w, ":ping\n\n")
			return true
		case <-ctx.Done():
			return false
		}
	})
}
