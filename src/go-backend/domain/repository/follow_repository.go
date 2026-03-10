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

func (r *followRepository) GetFollowedAuthorIDs(ctx context.Context, followerID int32, authorIDs []int32) ([]int32, error) {
	if len(authorIDs) == 0 {
		return nil, nil
	}
	var ids []int32
	err := r.db.DB.WithContext(ctx).Model(&models.UserFollow{}).
		Where("follower_id = ? AND following_id IN ?", followerID, authorIDs).
		Pluck("following_id", &ids).Error
	if err != nil {
		return nil, r.handleDBError(err, "follow", "get followed author IDs")
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

func (r *followRepository) GetFriendsOfFriends(ctx context.Context, userID int32, excludeIDs []int32, limit int) ([]FriendOfFriend, error) {
	var results []FriendOfFriend

	// Build exclusion list (must include self)
	excluded := append(excludeIDs, userID)

	err := r.db.DB.WithContext(ctx).Raw(`
		SELECT uf2.following_id as user_id, COUNT(*) as mutual_count
		FROM user_follow uf1
		JOIN user_follow uf2 ON uf1.following_id = uf2.follower_id
		WHERE uf1.follower_id = ?
		  AND uf2.following_id != ?
		  AND uf2.following_id NOT IN (?)
		GROUP BY uf2.following_id
		ORDER BY mutual_count DESC
		LIMIT ?
	`, userID, userID, excluded, limit).Scan(&results).Error

	if err != nil {
		return nil, r.handleDBError(err, "follow", "get friends of friends")
	}
	return results, nil
}

func (r *followRepository) GetTopUsersByFollowers(ctx context.Context, excludeIDs []int32, limit int) ([]UserFollowerCount, error) {
	var results []UserFollowerCount

	query := r.db.DB.WithContext(ctx).Raw(`
		SELECT uf.following_id as user_id, COUNT(*) as follower_count
		FROM user_follow uf
		WHERE uf.following_id NOT IN (?)
		  AND EXISTS (SELECT 1 FROM post p WHERE p.user_id = uf.following_id AND p.deleted_at IS NULL)
		GROUP BY uf.following_id
		ORDER BY follower_count DESC
		LIMIT ?
	`, excludeIDs, limit)

	if len(excludeIDs) == 0 {
		query = r.db.DB.WithContext(ctx).Raw(`
			SELECT uf.following_id as user_id, COUNT(*) as follower_count
			FROM user_follow uf
			WHERE EXISTS (SELECT 1 FROM post p WHERE p.user_id = uf.following_id AND p.deleted_at IS NULL)
			GROUP BY uf.following_id
			ORDER BY follower_count DESC
			LIMIT ?
		`, limit)
	}

	if err := query.Scan(&results).Error; err != nil {
		return nil, r.handleDBError(err, "follow", "get top users by followers")
	}
	return results, nil
}

func (r *followRepository) GetRecentUsers(ctx context.Context, excludeIDs []int32, limit int) ([]int32, error) {
	var ids []int32
	query := r.db.DB.WithContext(ctx).Model(&models.User{})
	if len(excludeIDs) > 0 {
		query = query.Where("id NOT IN ?", excludeIDs)
	}
	err := query.Order("created_at DESC").Limit(limit).Pluck("id", &ids).Error
	if err != nil {
		return nil, r.handleDBError(err, "user", "get recent users")
	}
	return ids, nil
}
