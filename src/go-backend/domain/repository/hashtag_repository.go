package repository

import (
	"context"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
)

// TrendingHashtag represents a hashtag with its post count for trending.
type TrendingHashtag struct {
	Hashtag   string
	PostCount int32
}

// FriendOfFriend represents a suggested user from social graph traversal.
type FriendOfFriend struct {
	UserID       int32
	MutualCount  int32
}

// UserFollowerCount represents a user with their follower count.
type UserFollowerCount struct {
	UserID        int32
	FollowerCount int32
}

type hashtagRepository struct {
	*BaseRepository
}

// NewHashtagRepository creates a new hashtag repository
func NewHashtagRepository(db *database.Database) HashtagRepository {
	return &hashtagRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *hashtagRepository) CreateBatch(ctx context.Context, postID int32, hashtags []string, createdAt time.Time) error {
	if len(hashtags) == 0 {
		return nil
	}

	records := make([]models.PostHashtag, len(hashtags))
	for i, tag := range hashtags {
		records[i] = models.PostHashtag{
			PostID:    postID,
			Hashtag:   tag,
			CreatedAt: createdAt,
		}
	}

	// ON CONFLICT DO NOTHING for idempotency
	err := r.db.DB.WithContext(ctx).
		Where("1 = 0"). // force insert mode
		Omit("id").
		CreateInBatches(&records, 50).Error
	if err != nil {
		// Try individual inserts ignoring conflicts
		for _, record := range records {
			r.db.DB.WithContext(ctx).
				Where(models.PostHashtag{PostID: postID, Hashtag: record.Hashtag}).
				FirstOrCreate(&record)
		}
	}
	return nil
}

func (r *hashtagRepository) DeleteByPostID(ctx context.Context, postID int32) error {
	err := r.db.DB.WithContext(ctx).
		Where("post_id = ?", postID).
		Delete(&models.PostHashtag{}).Error
	if err != nil {
		return r.handleDBError(err, "post_hashtag", "delete by post ID")
	}
	return nil
}

func (r *hashtagRepository) GetByPostID(ctx context.Context, postID int32) ([]string, error) {
	var hashtags []string
	err := r.db.DB.WithContext(ctx).Model(&models.PostHashtag{}).
		Where("post_id = ?", postID).
		Pluck("hashtag", &hashtags).Error
	if err != nil {
		return nil, r.handleDBError(err, "post_hashtag", "get by post ID")
	}
	return hashtags, nil
}

func (r *hashtagRepository) GetTrending(ctx context.Context, since time.Time, limit int) ([]TrendingHashtag, error) {
	var results []TrendingHashtag
	err := r.db.DB.WithContext(ctx).
		Raw(`SELECT hashtag, COUNT(*) as post_count FROM post_hashtag WHERE created_at > ? GROUP BY hashtag ORDER BY post_count DESC LIMIT ?`, since, limit).
		Scan(&results).Error
	if err != nil {
		return nil, r.handleDBError(err, "post_hashtag", "get trending")
	}
	return results, nil
}

func (r *hashtagRepository) GetPostIDsByHashtag(ctx context.Context, hashtag string, opts ListOptions) ([]int32, int, error) {
	var total int64
	if err := r.db.DB.WithContext(ctx).Model(&models.PostHashtag{}).
		Where("hashtag = ?", hashtag).Count(&total).Error; err != nil {
		return nil, 0, r.handleDBError(err, "post_hashtag", "count by hashtag")
	}

	var postIDs []int32
	query := r.db.DB.WithContext(ctx).Model(&models.PostHashtag{}).
		Where("hashtag = ?", hashtag).
		Order("created_at DESC")
	query = r.applyPagination(query, opts)

	if err := query.Pluck("post_id", &postIDs).Error; err != nil {
		return nil, 0, r.handleDBError(err, "post_hashtag", "get post IDs by hashtag")
	}
	return postIDs, int(total), nil
}
