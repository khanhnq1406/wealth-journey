package handlers

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
	v1 "wealthjourney/protobuf/v1"
)

// CommunityHandler handles community-related HTTP requests.
type CommunityHandler struct {
	communityService service.CommunityService
}

// NewCommunityHandler creates a new CommunityHandler instance.
func NewCommunityHandler(communityService service.CommunityService) *CommunityHandler {
	return &CommunityHandler{communityService: communityService}
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

	var req v1.UpdateBioRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
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

// GetUploadURL generates a signed upload URL for post images.
func (h *CommunityHandler) GetUploadURL(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req v1.GetUploadURLRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.communityService.GetUploadURL(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
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
