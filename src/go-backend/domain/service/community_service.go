package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"fmt"
	"regexp"
	"strings"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/imaging"
	pkgredis "wealthjourney/pkg/redis"
	"wealthjourney/pkg/storage"
	"wealthjourney/pkg/validator"
	v1 "wealthjourney/protobuf/v1"
)

// AllowedReportReasons defines the valid reasons for reporting content
var AllowedReportReasons = map[string]bool{
	"spam":        true,
	"harassment":  true,
	"misinformation": true,
	"inappropriate":  true,
	"other":       true,
}

type communityService struct {
	postRepo         repository.PostRepository
	commentRepo      repository.CommentRepository
	likeRepo         repository.LikeRepository
	followRepo       repository.FollowRepository
	reportRepo       repository.ReportRepository
	userRepo         repository.UserRepository
	notificationRepo repository.NotificationRepository
	savedPostRepo    repository.SavedPostRepository
	hashtagRepo      repository.HashtagRepository
	storageProvider  storage.StorageProvider
	redisClient      *pkgredis.RedisClient
}

// NewCommunityService creates a new community service
func NewCommunityService(
	postRepo repository.PostRepository,
	commentRepo repository.CommentRepository,
	likeRepo repository.LikeRepository,
	followRepo repository.FollowRepository,
	reportRepo repository.ReportRepository,
	userRepo repository.UserRepository,
	notificationRepo repository.NotificationRepository,
	savedPostRepo repository.SavedPostRepository,
	hashtagRepo repository.HashtagRepository,
	storageProvider storage.StorageProvider,
	redisClient *pkgredis.RedisClient,
) CommunityService {
	return &communityService{
		postRepo:         postRepo,
		commentRepo:      commentRepo,
		likeRepo:         likeRepo,
		followRepo:       followRepo,
		reportRepo:       reportRepo,
		userRepo:         userRepo,
		notificationRepo: notificationRepo,
		savedPostRepo:    savedPostRepo,
		hashtagRepo:      hashtagRepo,
		storageProvider:  storageProvider,
		redisClient:      redisClient,
	}
}

func (s *communityService) CreatePost(ctx context.Context, userID int32, req *v1.CreatePostRequest) (*v1.CreatePostResponse, error) {
	// Validate content
	content, err := validator.SanitizeStringField(req.Content, 2000)
	if err != nil {
		return nil, err
	}
	if err := validator.Length("content", content, 1, 2000); err != nil {
		return nil, err
	}

	// Validate image URL if provided
	if req.ImageUrl != "" {
		if err := validator.URL(req.ImageUrl); err != nil {
			return nil, err
		}
	}

	// Get user for response enrichment
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	post := &models.Post{
		UserID:   userID,
		Content:  content,
		ImageURL: req.ImageUrl,
	}

	if err := s.postRepo.Create(ctx, post); err != nil {
		return nil, err
	}

	// Extract and store hashtags (Phase 2)
	s.extractAndStoreHashtags(ctx, post.ID, content, post.CreatedAt)

	return &v1.CreatePostResponse{
		Success: true,
		Message: "Post created successfully",
		Data:    s.postToProto(post, user, false, true, false, false),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) UpdatePost(ctx context.Context, userID int32, req *v1.UpdatePostRequest) (*v1.UpdatePostResponse, error) {
	post, err := s.postRepo.GetByID(ctx, req.PostId)
	if err != nil {
		return nil, err
	}

	// Authorization: only post owner can update
	if post.UserID != userID {
		return nil, apperrors.NewForbiddenError("you can only edit your own posts")
	}

	// Validate content
	content, err := validator.SanitizeStringField(req.Content, 2000)
	if err != nil {
		return nil, err
	}
	if err := validator.Length("content", content, 1, 2000); err != nil {
		return nil, err
	}

	if req.ImageUrl != "" {
		if err := validator.URL(req.ImageUrl); err != nil {
			return nil, err
		}
	}

	post.Content = content
	post.ImageURL = req.ImageUrl

	if err := s.postRepo.Update(ctx, post); err != nil {
		return nil, err
	}

	// Update hashtags (Phase 2): delete old, re-extract
	s.hashtagRepo.DeleteByPostID(ctx, post.ID)
	s.extractAndStoreHashtags(ctx, post.ID, content, post.CreatedAt)

	return &v1.UpdatePostResponse{
		Success: true,
		Message: "Post updated successfully",
		Data:    s.postToProto(post, post.User, false, true, false, false),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) DeletePost(ctx context.Context, userID int32, postID int32) error {
	post, err := s.postRepo.GetByID(ctx, postID)
	if err != nil {
		return err
	}

	if post.UserID != userID {
		return apperrors.NewForbiddenError("you can only delete your own posts")
	}

	if err := s.postRepo.SoftDelete(ctx, postID); err != nil {
		return err
	}

	// Clean up hashtags (Phase 2)
	s.hashtagRepo.DeleteByPostID(ctx, postID)
	return nil
}

func (s *communityService) GetPost(ctx context.Context, userID int32, postID int32) (*v1.GetPostResponse, error) {
	post, err := s.postRepo.GetByID(ctx, postID)
	if err != nil {
		return nil, err
	}

	// Check if user liked this post
	isLiked, err := s.likeRepo.Exists(ctx, userID, postID)
	if err != nil {
		return nil, err
	}

	// Check if user follows the post author
	isFollowing, err := s.followRepo.Exists(ctx, userID, post.UserID)
	if err != nil {
		return nil, err
	}

	// Check if user saved this post
	savedIDs, _ := s.savedPostRepo.GetSavedPostIDs(ctx, userID, []int32{postID})
	isSaved := len(savedIDs) > 0

	return &v1.GetPostResponse{
		Success: true,
		Message: "Post retrieved successfully",
		Data:    s.postToProto(post, post.User, isLiked, post.UserID == userID, isFollowing, isSaved),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) GetFeed(ctx context.Context, userID int32, req *v1.GetFeedRequest) (*v1.GetFeedResponse, error) {
	// Get followed user IDs
	followingIDs, err := s.followRepo.GetFollowingIDs(ctx, userID)
	if err != nil {
		return nil, err
	}

	// If the user follows nobody, show all posts (global feed for discovery).
	// Otherwise, show posts from followed users + own posts.
	var userIDs []int32
	if len(followingIDs) > 0 {
		userIDs = append(followingIDs, userID)
	}

	// Parse pagination
	opts := s.parsePagination(req.Pagination)

	posts, total, err := s.postRepo.GetFeed(ctx, userIDs, opts, req.Hashtag)
	if err != nil {
		return nil, err
	}

	// Batch check liked status
	postIDs := make([]int32, len(posts))
	authorIDs := make([]int32, len(posts))
	for i, p := range posts {
		postIDs[i] = p.ID
		authorIDs[i] = p.UserID
	}
	likedIDs, err := s.likeRepo.GetLikedPostIDs(ctx, userID, postIDs)
	if err != nil {
		return nil, err
	}
	likedSet := make(map[int32]bool, len(likedIDs))
	for _, id := range likedIDs {
		likedSet[id] = true
	}

	// Batch check follow status for post authors
	followedIDs, err := s.followRepo.GetFollowedAuthorIDs(ctx, userID, authorIDs)
	if err != nil {
		return nil, err
	}
	followedSet := make(map[int32]bool, len(followedIDs))
	for _, id := range followedIDs {
		followedSet[id] = true
	}

	// Batch check saved status
	savedIDs, err := s.savedPostRepo.GetSavedPostIDs(ctx, userID, postIDs)
	if err != nil {
		return nil, err
	}
	savedSet := make(map[int32]bool, len(savedIDs))
	for _, id := range savedIDs {
		savedSet[id] = true
	}

	// Convert to proto
	protoPosts := make([]*v1.PostItem, len(posts))
	for i, post := range posts {
		protoPosts[i] = s.postToProto(post, post.User, likedSet[post.ID], post.UserID == userID, followedSet[post.UserID], savedSet[post.ID])
	}

	page, pageSize := s.getPageParams(req.Pagination)
	totalPages := int32(0)
	if pageSize > 0 {
		totalPages = (int32(total) + pageSize - 1) / pageSize
	}

	return &v1.GetFeedResponse{
		Success: true,
		Message: "Feed retrieved successfully",
		Posts:   protoPosts,
		Pagination: &v1.PaginationResult{
			Page:       page,
			PageSize:   pageSize,
			TotalCount: int32(total),
			TotalPages: totalPages,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) GetUserPosts(ctx context.Context, userID int32, targetUserID int32, req *v1.GetUserPostsRequest) (*v1.GetUserPostsResponse, error) {
	opts := s.parsePagination(req.Pagination)

	posts, total, err := s.postRepo.GetByUserID(ctx, targetUserID, opts)
	if err != nil {
		return nil, err
	}

	// Batch check liked status
	postIDs := make([]int32, len(posts))
	for i, p := range posts {
		postIDs[i] = p.ID
	}
	likedIDs, err := s.likeRepo.GetLikedPostIDs(ctx, userID, postIDs)
	if err != nil {
		return nil, err
	}
	likedSet := make(map[int32]bool, len(likedIDs))
	for _, id := range likedIDs {
		likedSet[id] = true
	}

	// Check if the current user follows the target user (all posts share the same author)
	isFollowingTarget, err := s.followRepo.Exists(ctx, userID, targetUserID)
	if err != nil {
		return nil, err
	}

	// Batch check saved status
	savedIDs, err := s.savedPostRepo.GetSavedPostIDs(ctx, userID, postIDs)
	if err != nil {
		return nil, err
	}
	savedSet := make(map[int32]bool, len(savedIDs))
	for _, id := range savedIDs {
		savedSet[id] = true
	}

	protoPosts := make([]*v1.PostItem, len(posts))
	for i, post := range posts {
		protoPosts[i] = s.postToProto(post, post.User, likedSet[post.ID], post.UserID == userID, isFollowingTarget, savedSet[post.ID])
	}

	page, pageSize := s.getPageParams(req.Pagination)
	totalPages := int32(0)
	if pageSize > 0 {
		totalPages = (int32(total) + pageSize - 1) / pageSize
	}

	return &v1.GetUserPostsResponse{
		Success: true,
		Message: "User posts retrieved successfully",
		Posts:   protoPosts,
		Pagination: &v1.PaginationResult{
			Page:       page,
			PageSize:   pageSize,
			TotalCount: int32(total),
			TotalPages: totalPages,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) LikePost(ctx context.Context, userID int32, postID int32) error {
	// Check post exists
	if _, err := s.postRepo.GetByID(ctx, postID); err != nil {
		return err
	}

	// Check if already liked
	exists, err := s.likeRepo.Exists(ctx, userID, postID)
	if err != nil {
		return err
	}
	if exists {
		return apperrors.NewConflictError("post already liked")
	}

	like := &models.PostLike{
		UserID: userID,
		PostID: postID,
	}
	if err := s.likeRepo.Create(ctx, like); err != nil {
		return err
	}

	if err := s.postRepo.IncrementLikeCount(ctx, postID, 1); err != nil {
		return err
	}

	// Create notification for post owner (Phase 2)
	if post, err := s.postRepo.GetByID(ctx, postID); err == nil {
		s.createNotification(ctx, post.UserID, userID, "like", &postID)
	}
	return nil
}

func (s *communityService) UnlikePost(ctx context.Context, userID int32, postID int32) error {
	if err := s.likeRepo.Delete(ctx, userID, postID); err != nil {
		return err
	}

	return s.postRepo.IncrementLikeCount(ctx, postID, -1)
}

func (s *communityService) CreateComment(ctx context.Context, userID int32, req *v1.CreateCommentRequest) (*v1.CreateCommentResponse, error) {
	// Validate content
	content, err := validator.SanitizeStringField(req.Content, 500)
	if err != nil {
		return nil, err
	}
	if err := validator.Length("content", content, 1, 500); err != nil {
		return nil, err
	}

	// Check post exists
	if _, err := s.postRepo.GetByID(ctx, req.PostId); err != nil {
		return nil, err
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Handle reply threading
	var parentCommentID *int32
	if req.ParentCommentId > 0 {
		parentComment, err := s.commentRepo.GetByID(ctx, req.ParentCommentId)
		if err != nil {
			return nil, apperrors.NewValidationError("parent comment not found")
		}
		// Validate parent belongs to same post
		if parentComment.PostID != req.PostId {
			return nil, apperrors.NewValidationError("parent comment does not belong to this post")
		}
		// Flatten nesting: if parent is itself a reply, use its parent
		actualParentID := parentComment.ID
		if parentComment.ParentCommentID != nil {
			actualParentID = *parentComment.ParentCommentID
		}
		parentCommentID = &actualParentID
	}

	comment := &models.Comment{
		PostID:          req.PostId,
		UserID:          userID,
		Content:         content,
		ParentCommentID: parentCommentID,
	}

	if err := s.commentRepo.Create(ctx, comment); err != nil {
		return nil, err
	}

	// Increment reply count on parent, or post comment count for root comments
	if parentCommentID != nil {
		_ = s.commentRepo.IncrementReplyCount(ctx, *parentCommentID, 1)
	} else {
		// Increment post comment count only for root comments
		if err := s.postRepo.IncrementCommentCount(ctx, req.PostId, 1); err != nil {
			return nil, err
		}
	}

	// Create notification for post owner (Phase 2)
	if post, err := s.postRepo.GetByID(ctx, req.PostId); err == nil {
		s.createNotification(ctx, post.UserID, userID, "comment", &req.PostId)
	}

	return &v1.CreateCommentResponse{
		Success: true,
		Message: "Comment created successfully",
		Data:    s.commentToProto(comment, user, true),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) DeleteComment(ctx context.Context, userID int32, commentID int32) error {
	comment, err := s.commentRepo.GetByID(ctx, commentID)
	if err != nil {
		return err
	}

	if comment.UserID != userID {
		return apperrors.NewForbiddenError("you can only delete your own comments")
	}

	if err := s.commentRepo.SoftDelete(ctx, commentID); err != nil {
		return err
	}

	// If this is a reply, decrement parent's reply count only.
	// Replies never increment post.comment_count, so don't decrement it here.
	if comment.ParentCommentID != nil {
		_ = s.commentRepo.IncrementReplyCount(ctx, *comment.ParentCommentID, -1)
	} else {
		// Root comment — decrement post comment count by 1
		_ = s.postRepo.IncrementCommentCount(ctx, comment.PostID, -1)
	}

	return nil
}

func (s *communityService) GetComments(ctx context.Context, userID int32, postID int32, req *v1.GetCommentsRequest) (*v1.GetCommentsResponse, error) {
	opts := s.parsePagination(req.Pagination)

	comments, total, err := s.commentRepo.GetByPostID(ctx, postID, opts)
	if err != nil {
		return nil, err
	}

	protoComments := make([]*v1.CommentItem, len(comments))
	for i, comment := range comments {
		protoComments[i] = s.commentToProto(comment, comment.User, comment.UserID == userID)
	}

	page, pageSize := s.getPageParams(req.Pagination)
	totalPages := int32(0)
	if pageSize > 0 {
		totalPages = (int32(total) + pageSize - 1) / pageSize
	}

	return &v1.GetCommentsResponse{
		Success:  true,
		Message:  "Comments retrieved successfully",
		Comments: protoComments,
		Pagination: &v1.PaginationResult{
			Page:       page,
			PageSize:   pageSize,
			TotalCount: int32(total),
			TotalPages: totalPages,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) GetReplies(ctx context.Context, viewerUserID int32, commentID int32, req *v1.GetRepliesRequest) (*v1.GetRepliesResponse, error) {
	// Validate comment exists
	if _, err := s.commentRepo.GetByID(ctx, commentID); err != nil {
		return nil, err
	}

	opts := s.parsePagination(req.Pagination)

	replies, total, err := s.commentRepo.GetByParentID(ctx, commentID, opts)
	if err != nil {
		return nil, err
	}

	replyItems := make([]*v1.CommentItem, len(replies))
	for i, reply := range replies {
		replyItems[i] = s.commentToProto(reply, reply.User, reply.UserID == viewerUserID)
	}

	page, pageSize := s.getPageParams(req.Pagination)
	totalPages := int32(0)
	if pageSize > 0 {
		totalPages = (int32(total) + pageSize - 1) / pageSize
	}

	return &v1.GetRepliesResponse{
		Success: true,
		Message: "Replies retrieved successfully",
		Replies: replyItems,
		Pagination: &v1.PaginationResult{
			Page:       page,
			PageSize:   pageSize,
			TotalCount: int32(total),
			TotalPages: totalPages,
		},
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func (s *communityService) FollowUser(ctx context.Context, followerID int32, followingID int32) error {
	if followerID == followingID {
		return apperrors.NewValidationError("you cannot follow yourself")
	}

	// Check target user exists
	if _, err := s.userRepo.GetByID(ctx, followingID); err != nil {
		return err
	}

	// Check if already following
	exists, err := s.followRepo.Exists(ctx, followerID, followingID)
	if err != nil {
		return err
	}
	if exists {
		return apperrors.NewConflictError("already following this user")
	}

	follow := &models.UserFollow{
		FollowerID:  followerID,
		FollowingID: followingID,
	}
	if err := s.followRepo.Create(ctx, follow); err != nil {
		return err
	}

	// Create notification for the followed user (Phase 2)
	s.createNotification(ctx, followingID, followerID, "follow", nil)
	return nil
}

func (s *communityService) UnfollowUser(ctx context.Context, followerID int32, followingID int32) error {
	return s.followRepo.Delete(ctx, followerID, followingID)
}

func (s *communityService) GetProfile(ctx context.Context, userID int32, targetUserID int32) (*v1.GetCommunityProfileResponse, error) {
	user, err := s.userRepo.GetByID(ctx, targetUserID)
	if err != nil {
		return nil, err
	}

	postCount, err := s.postRepo.CountByUserID(ctx, targetUserID)
	if err != nil {
		return nil, err
	}

	followerCount, err := s.followRepo.GetFollowerCount(ctx, targetUserID)
	if err != nil {
		return nil, err
	}

	followingCount, err := s.followRepo.GetFollowingCount(ctx, targetUserID)
	if err != nil {
		return nil, err
	}

	isFollowing := false
	if userID != targetUserID {
		isFollowing, err = s.followRepo.Exists(ctx, userID, targetUserID)
		if err != nil {
			return nil, err
		}
	}

	return &v1.GetCommunityProfileResponse{
		Success: true,
		Message: "Profile retrieved successfully",
		Data: &v1.CommunityProfile{
			UserId:         targetUserID,
			UserName:       user.Name,
			UserPicture:    user.Picture,
			Bio:            user.Bio,
			PostCount:      postCount,
			FollowerCount:  followerCount,
			FollowingCount: followingCount,
			IsFollowing:    isFollowing,
			IsOwnProfile:   userID == targetUserID,
			CoverPhotoUrl:  user.CoverPhotoURL,
			Location:       user.Location,
			Website:        user.Website,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) ReportContent(ctx context.Context, userID int32, req *v1.ReportContentRequest) error {
	// Validate target type
	targetType := strings.ToLower(req.TargetType)
	if targetType != "post" && targetType != "comment" {
		return apperrors.NewValidationError("target type must be 'post' or 'comment'")
	}

	// Validate reason
	if !AllowedReportReasons[req.Reason] {
		return apperrors.NewValidationError("invalid report reason")
	}

	// Check target exists and user is not reporting own content
	if targetType == "post" {
		post, err := s.postRepo.GetByID(ctx, req.TargetId)
		if err != nil {
			return err
		}
		if post.UserID == userID {
			return apperrors.NewValidationError("you cannot report your own content")
		}
	} else {
		comment, err := s.commentRepo.GetByID(ctx, req.TargetId)
		if err != nil {
			return err
		}
		if comment.UserID == userID {
			return apperrors.NewValidationError("you cannot report your own content")
		}
	}

	// Check if already reported
	exists, err := s.reportRepo.ExistsByUser(ctx, userID, targetType, req.TargetId)
	if err != nil {
		return err
	}
	if exists {
		return apperrors.NewConflictError("you have already reported this content")
	}

	// Sanitize details
	details, err := validator.SanitizeStringField(req.Details, 500)
	if err != nil {
		return err
	}

	report := &models.ContentReport{
		ReporterID: userID,
		TargetType: targetType,
		TargetID:   req.TargetId,
		Reason:     req.Reason,
		Details:    details,
	}

	return s.reportRepo.Create(ctx, report)
}

func (s *communityService) UploadImage(ctx context.Context, userID int32, fileData []byte, purpose string, filename string) (string, error) {
	// Validate purpose whitelist
	validPurposes := map[string]bool{"post": true, "avatar": true, "cover": true}
	if !validPurposes[purpose] {
		return "", apperrors.NewValidationError("invalid purpose: must be 'post', 'avatar', or 'cover'")
	}

	// Validate magic bytes
	mimeType, err := imaging.ValidateMagicBytes(fileData)
	if err != nil {
		return "", apperrors.NewValidationError("invalid image: " + err.Error())
	}

	// Validate size (5MB max)
	if len(fileData) > 5*1024*1024 {
		return "", apperrors.NewValidationError("image too large: maximum size is 5MB")
	}

	// Determine max width by purpose
	maxWidth := map[string]int{
		"avatar": 400,
		"cover":  1920,
		"post":   2048,
	}[purpose]

	// Resize and strip EXIF
	processed, err := imaging.ResizeImage(fileData, mimeType, maxWidth)
	if err != nil {
		return "", apperrors.NewValidationError("failed to process image: " + err.Error())
	}

	// Check storage provider is available
	if s.storageProvider == nil {
		return "", fmt.Errorf("storage provider not configured")
	}

	// Generate storage key: community/{purpose}/{userId}/{uuid}.{ext}
	ext := imaging.MimeTypeToExtension(mimeType)
	key := fmt.Sprintf("community/%s/%d/%s.%s", purpose, userID, generateUUID(), ext)

	// Upload via storage provider
	result, err := s.storageProvider.Upload(ctx, bytes.NewReader(processed), key, mimeType)
	if err != nil {
		return "", fmt.Errorf("failed to upload image: %w", err)
	}

	return result.URL, nil
}

// generateUUID generates a simple UUID v4.
func generateUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// --- Helpers ---

func (s *communityService) postToProto(post *models.Post, user *models.User, isLiked, isOwnPost, isFollowing, isSaved bool) *v1.PostItem {
	item := &v1.PostItem{
		Id:           post.ID,
		UserId:       post.UserID,
		Content:      post.Content,
		ImageUrl:     post.ImageURL,
		LikeCount:    post.LikeCount,
		CommentCount: post.CommentCount,
		ShareCount:   post.ShareCount,
		IsLiked:      isLiked,
		IsOwnPost:    isOwnPost,
		IsFollowing:  isFollowing,
		IsSaved:      isSaved,
		IsShared:     post.SharedPostID != nil,
		CreatedAt:    post.CreatedAt.Unix(),
		UpdatedAt:    post.UpdatedAt.Unix(),
	}
	if user != nil {
		item.UserName = user.Name
		item.UserPicture = user.Picture
	}
	if post.SharedPost != nil {
		item.SharedPost = s.postToProto(post.SharedPost, post.SharedPost.User, false, false, false, false)
	}
	return item
}

func (s *communityService) commentToProto(comment *models.Comment, user *models.User, isOwnComment bool) *v1.CommentItem {
	item := &v1.CommentItem{
		Id:           comment.ID,
		PostId:       comment.PostID,
		UserId:       comment.UserID,
		Content:      comment.Content,
		IsOwnComment: isOwnComment,
		CreatedAt:    comment.CreatedAt.Unix(),
		ReplyCount:   comment.ReplyCount,
		IsEdited:     comment.UpdatedAt != nil && comment.UpdatedAt.Unix() > comment.CreatedAt.Unix(),
	}
	if comment.ParentCommentID != nil {
		item.ParentCommentId = *comment.ParentCommentID
	}
	if comment.UpdatedAt != nil {
		item.UpdatedAt = comment.UpdatedAt.Unix()
	}
	if user != nil {
		item.UserName = user.Name
		item.UserPicture = user.Picture
	}
	return item
}

func (s *communityService) UpdateComment(ctx context.Context, userID int32, req *v1.UpdateCommentRequest) (*v1.UpdateCommentResponse, error) {
	comment, err := s.commentRepo.GetByID(ctx, req.CommentId)
	if err != nil {
		return nil, err
	}

	// Authorization: only comment owner can edit
	if comment.UserID != userID {
		return nil, apperrors.NewForbiddenError("you can only edit your own comments")
	}

	// Validate content
	content, err := validator.SanitizeStringField(req.Content, 500)
	if err != nil {
		return nil, err
	}
	if err := validator.Length("content", content, 1, 500); err != nil {
		return nil, err
	}

	// Update comment
	now := time.Now().UTC()
	comment.Content = content
	comment.UpdatedAt = &now

	if err := s.commentRepo.Update(ctx, comment); err != nil {
		return nil, err
	}

	return &v1.UpdateCommentResponse{
		Success:   true,
		Message:   "Comment updated successfully",
		Data:      s.commentToProto(comment, comment.User, true),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func (s *communityService) parsePagination(params *v1.PaginationParams) repository.ListOptions {
	opts := repository.ListOptions{
		Limit:  20,
		Offset: 0,
	}
	if params != nil {
		if params.PageSize > 0 && params.PageSize <= 50 {
			opts.Limit = int(params.PageSize)
		}
		if params.Page > 0 {
			opts.Offset = (int(params.Page) - 1) * opts.Limit
		}
	}
	return opts
}

func (s *communityService) getPageParams(params *v1.PaginationParams) (int32, int32) {
	page := int32(1)
	pageSize := int32(20)
	if params != nil {
		if params.Page > 0 {
			page = params.Page
		}
		if params.PageSize > 0 && params.PageSize <= 50 {
			pageSize = params.PageSize
		}
	}
	return page, pageSize
}

// --- Phase 2: Social Features ---

// hashtagRegex matches hashtags in post content (supports Vietnamese diacritics).
var hashtagRegex = regexp.MustCompile(`#([a-zA-Z0-9_\x{00C0}-\x{024F}]+)`)

func extractHashtags(content string) []string {
	matches := hashtagRegex.FindAllStringSubmatch(content, -1)
	seen := make(map[string]bool)
	var hashtags []string
	for _, match := range matches {
		tag := strings.ToLower(match[1])
		if !seen[tag] && len(tag) <= 100 {
			seen[tag] = true
			hashtags = append(hashtags, tag)
			if len(hashtags) >= 10 {
				break
			}
		}
	}
	return hashtags
}

func (s *communityService) extractAndStoreHashtags(ctx context.Context, postID int32, content string, createdAt time.Time) {
	hashtags := extractHashtags(content)
	if len(hashtags) > 0 {
		s.hashtagRepo.CreateBatch(ctx, postID, hashtags, createdAt)
	}
}

func (s *communityService) createNotification(ctx context.Context, userID, actorID int32, notifType string, postID *int32) {
	if userID == actorID {
		return // No self-notifications
	}
	s.notificationRepo.Create(ctx, &models.Notification{
		UserID:  userID,
		ActorID: actorID,
		Type:    notifType,
		PostID:  postID,
	})

	// Publish real-time notification to Redis Pub/Sub if client is available
	if s.redisClient != nil {
		notificationPayload := map[string]interface{}{
			"type":    notifType,
			"actorId": actorID,
			"userId":  userID,
		}
		if postID != nil {
			notificationPayload["postId"] = *postID
		}
		channel := fmt.Sprintf("user:%d:notifications", userID)
		_ = s.redisClient.Publish(channel, notificationPayload)
	}
}

func (s *communityService) SharePost(ctx context.Context, userID int32, req *v1.SharePostRequest) (*v1.SharePostResponse, error) {
	// Validate content (0-2000 chars, HTML stripped)
	content, err := validator.SanitizeStringField(req.Content, 2000)
	if err != nil {
		return nil, err
	}

	// Get original post
	originalPost, err := s.postRepo.GetByID(ctx, req.PostId)
	if err != nil || originalPost == nil {
		return nil, apperrors.NewNotFoundError("post")
	}

	// Cannot share own post
	if originalPost.UserID == userID {
		return nil, apperrors.NewValidationError("cannot share your own post")
	}

	// Resolve to root original (prevent recursive embedding)
	rootPostID := originalPost.ID
	if originalPost.SharedPostID != nil {
		rootPostID = *originalPost.SharedPostID
	}

	// Create shared post
	post := &models.Post{
		UserID:       userID,
		Content:      content,
		SharedPostID: &rootPostID,
	}
	if err := s.postRepo.Create(ctx, post); err != nil {
		return nil, err
	}

	// Increment share count on original
	s.postRepo.IncrementShareCount(ctx, rootPostID, 1)

	// Fetch root post for notification
	rootPost, _ := s.postRepo.GetByID(ctx, rootPostID)
	if rootPost != nil {
		s.createNotification(ctx, rootPost.UserID, userID, "share", &rootPostID)
	}

	// Extract hashtags from commentary
	s.extractAndStoreHashtags(ctx, post.ID, content, post.CreatedAt)

	// Build response
	user, _ := s.userRepo.GetByID(ctx, userID)
	protoPost := s.postToProto(post, user, false, true, false, false)

	if rootPost != nil {
		rootUser := rootPost.User
		if rootUser == nil {
			rootUser, _ = s.userRepo.GetByID(ctx, rootPost.UserID)
		}
		protoPost.SharedPost = s.postToProto(rootPost, rootUser, false, false, false, false)
		protoPost.IsShared = true
	}

	return &v1.SharePostResponse{
		Success:   true,
		Message:   "Post shared successfully",
		Data:      protoPost,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) GetNotifications(ctx context.Context, userID int32, req *v1.GetNotificationsRequest) (*v1.GetNotificationsResponse, error) {
	opts := s.parsePagination(req.Pagination)
	if opts.Limit > 50 {
		opts.Limit = 50
	}

	notifications, total, err := s.notificationRepo.GetByUserID(ctx, userID, opts)
	if err != nil {
		return nil, err
	}

	// Batch-fetch referenced posts for preview
	postIDSet := make(map[int32]bool)
	for _, n := range notifications {
		if n.PostID != nil {
			postIDSet[*n.PostID] = true
		}
	}
	postIDs := make([]int32, 0, len(postIDSet))
	for id := range postIDSet {
		postIDs = append(postIDs, id)
	}
	postMap := make(map[int32]*models.Post)
	if len(postIDs) > 0 {
		if posts, err := s.postRepo.GetByIDs(ctx, postIDs); err == nil {
			for _, p := range posts {
				postMap[p.ID] = p
			}
		}
	}

	items := make([]*v1.NotificationItem, len(notifications))
	for i, n := range notifications {
		item := &v1.NotificationItem{
			Id:        n.ID,
			Type:      n.Type,
			ActorId:   n.ActorID,
			IsRead:    n.IsRead,
			CreatedAt: n.CreatedAt.Unix(),
		}
		if n.Actor != nil {
			item.ActorName = n.Actor.Name
			item.ActorPicture = n.Actor.Picture
		}
		if n.PostID != nil {
			item.PostId = *n.PostID
			if post, ok := postMap[*n.PostID]; ok {
				preview := post.Content
				if len(preview) > 100 {
					preview = preview[:100]
				}
				item.PostPreview = preview
			}
		}
		items[i] = item
	}

	page, pageSize := s.getPageParams(req.Pagination)
	totalPages := int32(0)
	if pageSize > 0 {
		totalPages = (int32(total) + pageSize - 1) / pageSize
	}

	return &v1.GetNotificationsResponse{
		Success:       true,
		Message:       "Notifications retrieved successfully",
		Notifications: items,
		Pagination: &v1.PaginationResult{
			Page:       page,
			PageSize:   pageSize,
			TotalCount: int32(total),
			TotalPages: totalPages,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) GetUnreadNotificationCount(ctx context.Context, userID int32) (*v1.GetUnreadNotificationCountResponse, error) {
	count, err := s.notificationRepo.GetUnreadCount(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &v1.GetUnreadNotificationCountResponse{
		Success:   true,
		Message:   "Unread count retrieved",
		Count:     count,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) MarkNotificationsRead(ctx context.Context, userID int32) error {
	return s.notificationRepo.MarkAllRead(ctx, userID)
}

func (s *communityService) SavePost(ctx context.Context, userID int32, postID int32) error {
	// Validate post exists
	if _, err := s.postRepo.GetByID(ctx, postID); err != nil {
		return apperrors.NewNotFoundError("post")
	}

	savedPost := &models.SavedPost{
		UserID: userID,
		PostID: postID,
	}
	return s.savedPostRepo.Create(ctx, savedPost)
}

func (s *communityService) UnsavePost(ctx context.Context, userID int32, postID int32) error {
	// Idempotent: return success even if not found
	return s.savedPostRepo.Delete(ctx, userID, postID)
}

func (s *communityService) GetSavedPosts(ctx context.Context, userID int32, req *v1.GetSavedPostsRequest) (*v1.GetSavedPostsResponse, error) {
	opts := s.parsePagination(req.Pagination)

	savedPosts, total, err := s.savedPostRepo.GetByUserID(ctx, userID, opts)
	if err != nil {
		return nil, err
	}

	// Collect post IDs for batch enrichment
	posts := make([]*models.Post, 0, len(savedPosts))
	for _, sp := range savedPosts {
		if sp.Post != nil {
			posts = append(posts, sp.Post)
		}
	}

	postIDs := make([]int32, len(posts))
	for i, p := range posts {
		postIDs[i] = p.ID
	}

	likedIDs, _ := s.likeRepo.GetLikedPostIDs(ctx, userID, postIDs)
	likedSet := make(map[int32]bool)
	for _, id := range likedIDs {
		likedSet[id] = true
	}

	protoPosts := make([]*v1.PostItem, len(posts))
	for i, post := range posts {
		protoPosts[i] = s.postToProto(post, post.User, likedSet[post.ID], post.UserID == userID, false, true)
	}

	page, pageSize := s.getPageParams(req.Pagination)
	totalPages := int32(0)
	if pageSize > 0 {
		totalPages = (int32(total) + pageSize - 1) / pageSize
	}

	return &v1.GetSavedPostsResponse{
		Success: true,
		Message: "Saved posts retrieved successfully",
		Posts:   protoPosts,
		Pagination: &v1.PaginationResult{
			Page:       page,
			PageSize:   pageSize,
			TotalCount: int32(total),
			TotalPages: totalPages,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) GetSuggestedUsers(ctx context.Context, userID int32) (*v1.GetSuggestedUsersResponse, error) {
	// Get user's following IDs (to exclude)
	followingIDs, err := s.followRepo.GetFollowingIDs(ctx, userID)
	if err != nil {
		return nil, err
	}

	excludeIDs := append(followingIDs, userID)

	// Get friends-of-friends (up to 5)
	fofs, err := s.followRepo.GetFriendsOfFriends(ctx, userID, excludeIDs, 5)
	if err != nil {
		return nil, err
	}

	// Build result user IDs and mutual count map
	suggestedIDs := make([]int32, 0, 5)
	mutualCounts := make(map[int32]int32)
	for _, fof := range fofs {
		suggestedIDs = append(suggestedIDs, fof.UserID)
		mutualCounts[fof.UserID] = fof.MutualCount
	}

	// Fill remaining with top users by follower count
	if len(suggestedIDs) < 5 {
		needed := 5 - len(suggestedIDs)
		// Exclude already suggested
		newExclude := append(excludeIDs, suggestedIDs...)
		topUsers, err := s.followRepo.GetTopUsersByFollowers(ctx, newExclude, needed)
		if err == nil {
			for _, tu := range topUsers {
				suggestedIDs = append(suggestedIDs, tu.UserID)
			}
		}
	}

	// Cold-start fallback: if still no suggestions (empty social graph), show recently-joined users
	if len(suggestedIDs) < 5 {
		needed := 5 - len(suggestedIDs)
		newExclude := append(excludeIDs, suggestedIDs...)
		recentIDs, err := s.followRepo.GetRecentUsers(ctx, newExclude, needed)
		if err == nil {
			suggestedIDs = append(suggestedIDs, recentIDs...)
		}
	}

	if len(suggestedIDs) == 0 {
		return &v1.GetSuggestedUsersResponse{
			Success:   true,
			Message:   "No suggestions available",
			Users:     []*v1.SuggestedUserItem{},
			Timestamp: time.Now().Format(time.RFC3339),
		}, nil
	}

	// Fetch user details
	users := make([]*v1.SuggestedUserItem, 0, len(suggestedIDs))
	for _, uid := range suggestedIDs {
		user, err := s.userRepo.GetByID(ctx, uid)
		if err != nil || user == nil {
			continue
		}
		followerCount, _ := s.followRepo.GetFollowerCount(ctx, uid)

		bio := user.Bio
		if len(bio) > 60 {
			bio = bio[:60]
		}

		users = append(users, &v1.SuggestedUserItem{
			UserId:           uid,
			UserName:         user.Name,
			UserPicture:      user.Picture,
			BioSnippet:       bio,
			MutualFollowCount: mutualCounts[uid],
			FollowerCount:    followerCount,
		})
	}

	return &v1.GetSuggestedUsersResponse{
		Success:   true,
		Message:   "Suggested users retrieved successfully",
		Users:     users,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) GetFollowing(ctx context.Context, userID int32, targetUserID int32, req *v1.GetFollowingRequest) (*v1.GetFollowingResponse, error) {
	opts := s.parsePagination(req.Pagination)

	follows, total, err := s.followRepo.GetFollowing(ctx, targetUserID, opts)
	if err != nil {
		return nil, err
	}

	// Collect user IDs to batch check follow status
	userIDs := make([]int32, 0, len(follows))
	for _, f := range follows {
		if f.Following != nil {
			userIDs = append(userIDs, f.Following.ID)
		}
	}

	// Batch check which of these users the requesting user follows
	followedIDs, err := s.followRepo.GetFollowedAuthorIDs(ctx, userID, userIDs)
	if err != nil {
		return nil, err
	}
	followedSet := make(map[int32]bool, len(followedIDs))
	for _, id := range followedIDs {
		followedSet[id] = true
	}

	items := make([]*v1.FollowUserItem, 0, len(follows))
	for _, f := range follows {
		if f.Following == nil {
			continue
		}
		u := f.Following
		bio := u.Bio
		if len(bio) > 60 {
			bio = bio[:60]
		}
		items = append(items, &v1.FollowUserItem{
			UserId:      u.ID,
			UserName:    u.Name,
			UserPicture: u.Picture,
			BioSnippet:  bio,
			IsFollowing: followedSet[u.ID],
		})
	}

	page, pageSize := s.getPageParams(req.Pagination)
	totalPages := int32(0)
	if pageSize > 0 {
		totalPages = (int32(total) + pageSize - 1) / pageSize
	}

	return &v1.GetFollowingResponse{
		Success: true,
		Message: "Following list retrieved successfully",
		Users:   items,
		Pagination: &v1.PaginationResult{
			Page:       page,
			PageSize:   pageSize,
			TotalCount: int32(total),
			TotalPages: totalPages,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) GetFollowers(ctx context.Context, userID int32, targetUserID int32, req *v1.GetFollowersRequest) (*v1.GetFollowersResponse, error) {
	opts := s.parsePagination(req.Pagination)

	follows, total, err := s.followRepo.GetFollowers(ctx, targetUserID, opts)
	if err != nil {
		return nil, err
	}

	// Collect user IDs to batch check follow status
	userIDs := make([]int32, 0, len(follows))
	for _, f := range follows {
		if f.Follower != nil {
			userIDs = append(userIDs, f.Follower.ID)
		}
	}

	// Batch check which of these users the requesting user follows
	followedIDs, err := s.followRepo.GetFollowedAuthorIDs(ctx, userID, userIDs)
	if err != nil {
		return nil, err
	}
	followedSet := make(map[int32]bool, len(followedIDs))
	for _, id := range followedIDs {
		followedSet[id] = true
	}

	items := make([]*v1.FollowUserItem, 0, len(follows))
	for _, f := range follows {
		if f.Follower == nil {
			continue
		}
		u := f.Follower
		bio := u.Bio
		if len(bio) > 60 {
			bio = bio[:60]
		}
		items = append(items, &v1.FollowUserItem{
			UserId:      u.ID,
			UserName:    u.Name,
			UserPicture: u.Picture,
			BioSnippet:  bio,
			IsFollowing: followedSet[u.ID],
		})
	}

	page, pageSize := s.getPageParams(req.Pagination)
	totalPages := int32(0)
	if pageSize > 0 {
		totalPages = (int32(total) + pageSize - 1) / pageSize
	}

	return &v1.GetFollowersResponse{
		Success: true,
		Message: "Followers list retrieved successfully",
		Users:   items,
		Pagination: &v1.PaginationResult{
			Page:       page,
			PageSize:   pageSize,
			TotalCount: int32(total),
			TotalPages: totalPages,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *communityService) GetTrendingTopics(ctx context.Context) (*v1.GetTrendingTopicsResponse, error) {
	since := time.Now().Add(-24 * time.Hour)
	trending, err := s.hashtagRepo.GetTrending(ctx, since, 10)
	if err != nil {
		return nil, err
	}

	items := make([]*v1.TrendingTopicItem, len(trending))
	for i, t := range trending {
		items[i] = &v1.TrendingTopicItem{
			Hashtag:   t.Hashtag,
			PostCount: t.PostCount,
		}
	}

	return &v1.GetTrendingTopicsResponse{
		Success:   true,
		Message:   "Trending topics retrieved successfully",
		Topics:    items,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// isValidURL validates that a string is a valid HTTP/HTTPS URL.
var validURLPattern = regexp.MustCompile(`^https?://[^\s/$.?#].[^\s]*$`)

func isValidURL(u string) bool {
	return validURLPattern.MatchString(u)
}

// UpdateProfile updates the authenticated user's profile fields.
func (s *communityService) UpdateProfile(ctx context.Context, userID int32, req *v1.UpdateProfileRequest) (*v1.UpdateProfileResponse, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Validate and sanitize bio (0-200 chars)
	if req.Bio != "" {
		bio, err := validator.SanitizeStringField(req.Bio, 200)
		if err != nil {
			return nil, err
		}
		user.Bio = bio
	}

	// Validate and sanitize location (0-100 chars)
	if req.Location != "" {
		location, err := validator.SanitizeStringField(req.Location, 100)
		if err != nil {
			return nil, err
		}
		user.Location = location
	}

	// Validate and sanitize website (0-200 chars, URL pattern)
	if req.Website != "" {
		website, err := validator.SanitizeStringField(req.Website, 200)
		if err != nil {
			return nil, err
		}
		if !isValidURL(website) {
			return nil, apperrors.NewValidationError("website must be a valid URL (http:// or https://)")
		}
		user.Website = website
	}

	// Update picture if provided (max 2048 chars for signed URLs)
	if req.Picture != "" {
		picture, err := validator.SanitizeStringField(req.Picture, 2048)
		if err != nil {
			return nil, err
		}
		user.Picture = picture
	}

	// Update cover photo if provided (max 2048 chars for signed URLs)
	if req.CoverPhotoUrl != "" {
		coverPhoto, err := validator.SanitizeStringField(req.CoverPhotoUrl, 2048)
		if err != nil {
			return nil, err
		}
		user.CoverPhotoURL = coverPhoto
	}

	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}

	profile, err := s.GetProfile(ctx, userID, userID)
	if err != nil {
		return nil, err
	}

	return &v1.UpdateProfileResponse{
		Success:   true,
		Message:   "Profile updated successfully",
		Data:      profile.Data,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetLikedPosts returns a paginated list of posts liked by a target user.
func (s *communityService) GetLikedPosts(ctx context.Context, viewerUserID int32, targetUserID int32, req *v1.GetLikedPostsRequest) (*v1.GetLikedPostsResponse, error) {
	opts := s.parsePagination(req.Pagination)

	postIDs, total, err := s.likeRepo.GetLikedPostsByUser(ctx, targetUserID, opts)
	if err != nil {
		return nil, err
	}

	// Batch-fetch liked status for the viewer
	viewerLikedIDs, err := s.likeRepo.GetLikedPostIDs(ctx, viewerUserID, postIDs)
	if err != nil {
		return nil, err
	}
	viewerLikedSet := make(map[int32]bool, len(viewerLikedIDs))
	for _, id := range viewerLikedIDs {
		viewerLikedSet[id] = true
	}

	// Batch-fetch saved status for the viewer
	savedIDs, _ := s.savedPostRepo.GetSavedPostIDs(ctx, viewerUserID, postIDs)
	savedSet := make(map[int32]bool, len(savedIDs))
	for _, id := range savedIDs {
		savedSet[id] = true
	}

	var posts []*v1.PostItem
	for _, postID := range postIDs {
		post, err := s.postRepo.GetByID(ctx, postID)
		if err != nil {
			continue // skip posts that may have been deleted
		}
		isOwnPost := post.UserID == viewerUserID
		posts = append(posts, s.postToProto(post, post.User, viewerLikedSet[postID], isOwnPost, false, savedSet[postID]))
	}

	page, pageSize := s.getPageParams(req.Pagination)
	totalPages := int32(0)
	if pageSize > 0 {
		totalPages = (int32(total) + pageSize - 1) / pageSize
	}

	return &v1.GetLikedPostsResponse{
		Success: true,
		Message: "Liked posts retrieved successfully",
		Posts:   posts,
		Pagination: &v1.PaginationResult{
			Page:       page,
			PageSize:   pageSize,
			TotalCount: int32(total),
			TotalPages: totalPages,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
