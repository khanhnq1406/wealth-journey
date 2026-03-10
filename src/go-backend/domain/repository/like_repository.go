package repository

import (
	"context"

	"wealthjourney/domain/models"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/database"
)

type likeRepository struct {
	*BaseRepository
}

// NewLikeRepository creates a new like repository
func NewLikeRepository(db *database.Database) LikeRepository {
	return &likeRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *likeRepository) Create(ctx context.Context, like *models.PostLike) error {
	return r.executeCreate(ctx, like, "like")
}

func (r *likeRepository) Delete(ctx context.Context, userID, postID int32) error {
	result := r.db.DB.WithContext(ctx).
		Where("user_id = ? AND post_id = ?", userID, postID).
		Delete(&models.PostLike{})
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to delete like", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NewNotFoundError("like")
	}
	return nil
}

func (r *likeRepository) Exists(ctx context.Context, userID, postID int32) (bool, error) {
	var count int64
	err := r.db.DB.WithContext(ctx).Model(&models.PostLike{}).
		Where("user_id = ? AND post_id = ?", userID, postID).
		Count(&count).Error
	if err != nil {
		return false, r.handleDBError(err, "like", "check like exists")
	}
	return count > 0, nil
}

func (r *likeRepository) GetLikedPostIDs(ctx context.Context, userID int32, postIDs []int32) ([]int32, error) {
	if len(postIDs) == 0 {
		return nil, nil
	}

	var likedIDs []int32
	err := r.db.DB.WithContext(ctx).Model(&models.PostLike{}).
		Where("user_id = ? AND post_id IN ?", userID, postIDs).
		Pluck("post_id", &likedIDs).Error
	if err != nil {
		return nil, r.handleDBError(err, "like", "get liked post IDs")
	}
	return likedIDs, nil
}
