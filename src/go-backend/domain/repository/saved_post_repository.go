package repository

import (
	"context"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
)

type savedPostRepository struct {
	*BaseRepository
}

// NewSavedPostRepository creates a new saved post repository
func NewSavedPostRepository(db *database.Database) SavedPostRepository {
	return &savedPostRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *savedPostRepository) Create(ctx context.Context, savedPost *models.SavedPost) error {
	// ON CONFLICT DO NOTHING for idempotency
	err := r.db.DB.WithContext(ctx).
		Where(models.SavedPost{UserID: savedPost.UserID, PostID: savedPost.PostID}).
		FirstOrCreate(savedPost).Error
	if err != nil {
		return r.handleDBError(err, "saved_post", "create saved post")
	}
	return nil
}

func (r *savedPostRepository) Delete(ctx context.Context, userID, postID int32) error {
	// Idempotent: no error if not found
	err := r.db.DB.WithContext(ctx).
		Where("user_id = ? AND post_id = ?", userID, postID).
		Delete(&models.SavedPost{}).Error
	if err != nil {
		return r.handleDBError(err, "saved_post", "delete saved post")
	}
	return nil
}

func (r *savedPostRepository) Exists(ctx context.Context, userID, postID int32) (bool, error) {
	var count int64
	err := r.db.DB.WithContext(ctx).Model(&models.SavedPost{}).
		Where("user_id = ? AND post_id = ?", userID, postID).
		Count(&count).Error
	if err != nil {
		return false, r.handleDBError(err, "saved_post", "check exists")
	}
	return count > 0, nil
}

func (r *savedPostRepository) GetByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.SavedPost, int, error) {
	var savedPosts []*models.SavedPost
	var total int64

	query := r.db.DB.WithContext(ctx).Model(&models.SavedPost{}).
		Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, r.handleDBError(err, "saved_post", "count saved posts")
	}

	query = r.db.DB.WithContext(ctx).
		Where("user_id = ?", userID).
		Preload("Post.User").
		Order("saved_post.created_at DESC")
	query = r.applyPagination(query, opts)

	if err := query.Find(&savedPosts).Error; err != nil {
		return nil, 0, r.handleDBError(err, "saved_post", "get saved posts")
	}

	return savedPosts, int(total), nil
}

func (r *savedPostRepository) GetSavedPostIDs(ctx context.Context, userID int32, postIDs []int32) ([]int32, error) {
	if len(postIDs) == 0 {
		return nil, nil
	}

	var savedIDs []int32
	err := r.db.DB.WithContext(ctx).Model(&models.SavedPost{}).
		Where("user_id = ? AND post_id IN ?", userID, postIDs).
		Pluck("post_id", &savedIDs).Error
	if err != nil {
		return nil, r.handleDBError(err, "saved_post", "get saved post IDs")
	}
	return savedIDs, nil
}
