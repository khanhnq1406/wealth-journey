package repository

import (
	"context"

	"wealthjourney/domain/models"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/database"
)

type followRepository struct {
	*BaseRepository
}

// NewFollowRepository creates a new follow repository
func NewFollowRepository(db *database.Database) FollowRepository {
	return &followRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *followRepository) Create(ctx context.Context, follow *models.UserFollow) error {
	return r.executeCreate(ctx, follow, "follow")
}

func (r *followRepository) Delete(ctx context.Context, followerID, followingID int32) error {
	result := r.db.DB.WithContext(ctx).
		Where("follower_id = ? AND following_id = ?", followerID, followingID).
		Delete(&models.UserFollow{})
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to delete follow", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NewNotFoundError("follow relationship")
	}
	return nil
}

func (r *followRepository) Exists(ctx context.Context, followerID, followingID int32) (bool, error) {
	var count int64
	err := r.db.DB.WithContext(ctx).Model(&models.UserFollow{}).
		Where("follower_id = ? AND following_id = ?", followerID, followingID).
		Count(&count).Error
	if err != nil {
		return false, r.handleDBError(err, "follow", "check follow exists")
	}
	return count > 0, nil
}

func (r *followRepository) GetFollowingIDs(ctx context.Context, userID int32) ([]int32, error) {
	var ids []int32
	err := r.db.DB.WithContext(ctx).Model(&models.UserFollow{}).
		Where("follower_id = ?", userID).
		Pluck("following_id", &ids).Error
	if err != nil {
		return nil, r.handleDBError(err, "follow", "get following IDs")
	}
	return ids, nil
}

func (r *followRepository) GetFollowerCount(ctx context.Context, userID int32) (int32, error) {
	var count int64
	err := r.db.DB.WithContext(ctx).Model(&models.UserFollow{}).
		Where("following_id = ?", userID).Count(&count).Error
	if err != nil {
		return 0, r.handleDBError(err, "follow", "count followers")
	}
	return int32(count), nil
}

func (r *followRepository) GetFollowingCount(ctx context.Context, userID int32) (int32, error) {
	var count int64
	err := r.db.DB.WithContext(ctx).Model(&models.UserFollow{}).
		Where("follower_id = ?", userID).Count(&count).Error
	if err != nil {
		return 0, r.handleDBError(err, "follow", "count following")
	}
	return int32(count), nil
}
