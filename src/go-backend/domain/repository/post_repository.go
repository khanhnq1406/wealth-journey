package repository

import (
	"context"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"

	"gorm.io/gorm"
)

type postRepository struct {
	*BaseRepository
}

// NewPostRepository creates a new post repository
func NewPostRepository(db *database.Database) PostRepository {
	return &postRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *postRepository) Create(ctx context.Context, post *models.Post) error {
	return r.executeCreate(ctx, post, "post")
}

func (r *postRepository) GetByID(ctx context.Context, id int32) (*models.Post, error) {
	var post models.Post
	err := r.db.DB.WithContext(ctx).Preload("User").First(&post, id).Error
	if err != nil {
		return nil, r.handleDBError(err, "post", "get post")
	}
	return &post, nil
}

func (r *postRepository) Update(ctx context.Context, post *models.Post) error {
	return r.executeUpdate(ctx, post, "post")
}

func (r *postRepository) SoftDelete(ctx context.Context, id int32) error {
	return r.executeDelete(ctx, &models.Post{}, id, "post")
}

func (r *postRepository) GetFeed(ctx context.Context, userIDs []int32, topicFilter string, opts ListOptions) ([]*models.Post, int, error) {
	var posts []*models.Post
	var total int64

	query := r.db.DB.WithContext(ctx).Model(&models.Post{})

	// nil/empty userIDs means global feed (no follow filter)
	if len(userIDs) > 0 {
		query = query.Where("user_id IN ?", userIDs)
	}

	if topicFilter != "" {
		query = query.Where("topic_tag = ?", topicFilter)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, r.handleDBError(err, "post", "count feed posts")
	}

	query = query.Preload("User").Order("created_at DESC")
	query = r.applyPagination(query, opts)

	if err := query.Find(&posts).Error; err != nil {
		return nil, 0, r.handleDBError(err, "post", "get feed posts")
	}

	return posts, int(total), nil
}

func (r *postRepository) GetByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Post, int, error) {
	var posts []*models.Post
	var total int64

	query := r.db.DB.WithContext(ctx).Model(&models.Post{}).
		Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, r.handleDBError(err, "post", "count user posts")
	}

	query = r.db.DB.WithContext(ctx).
		Where("user_id = ?", userID).
		Preload("User").
		Order("created_at DESC")
	query = r.applyPagination(query, opts)

	if err := query.Find(&posts).Error; err != nil {
		return nil, 0, r.handleDBError(err, "post", "get user posts")
	}

	return posts, int(total), nil
}

func (r *postRepository) IncrementLikeCount(ctx context.Context, postID int32, delta int32) error {
	result := r.db.DB.WithContext(ctx).
		Model(&models.Post{}).
		Where("id = ?", postID).
		Update("like_count", gorm.Expr("like_count + ?", delta))
	if result.Error != nil {
		return r.handleDBError(result.Error, "post", "update like count")
	}
	return nil
}

func (r *postRepository) IncrementCommentCount(ctx context.Context, postID int32, delta int32) error {
	result := r.db.DB.WithContext(ctx).
		Model(&models.Post{}).
		Where("id = ?", postID).
		Update("comment_count", gorm.Expr("comment_count + ?", delta))
	if result.Error != nil {
		return r.handleDBError(result.Error, "post", "update comment count")
	}
	return nil
}

func (r *postRepository) CountByUserID(ctx context.Context, userID int32) (int32, error) {
	var count int64
	err := r.db.DB.WithContext(ctx).Model(&models.Post{}).
		Where("user_id = ?", userID).Count(&count).Error
	if err != nil {
		return 0, r.handleDBError(err, "post", "count posts")
	}
	return int32(count), nil
}
