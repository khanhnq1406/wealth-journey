package repository

import (
	"context"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
)

type goldVoteRepository struct {
	*BaseRepository
}

func NewGoldVoteRepository(db *database.Database) GoldVoteRepository {
	return &goldVoteRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *goldVoteRepository) Upsert(ctx context.Context, vote *models.GoldVote) error {
	result := r.db.DB.WithContext(ctx).Exec(`
		INSERT INTO gold_vote (user_id, vote_date, direction, created_at, updated_at)
		VALUES (?, ?, ?, NOW(), NOW())
		ON CONFLICT (user_id, vote_date) WHERE user_id IS NOT NULL
		DO UPDATE SET direction = EXCLUDED.direction, updated_at = NOW()
	`, vote.UserID, vote.VoteDate, vote.Direction)
	if result.Error != nil {
		return r.handleDBError(result.Error, "gold_vote", "upsert vote")
	}
	return nil
}

func (r *goldVoteRepository) UpsertAnonymous(ctx context.Context, vote *models.GoldVote) error {
	result := r.db.DB.WithContext(ctx).Exec(`
		INSERT INTO gold_vote (anonymous_id, vote_date, direction, created_at, updated_at)
		VALUES (?, ?, ?, NOW(), NOW())
		ON CONFLICT (anonymous_id, vote_date) WHERE anonymous_id IS NOT NULL
		DO UPDATE SET direction = EXCLUDED.direction, updated_at = NOW()
	`, vote.AnonymousID, vote.VoteDate, vote.Direction)
	if result.Error != nil {
		return r.handleDBError(result.Error, "gold_vote", "upsert anonymous vote")
	}
	return nil
}

func (r *goldVoteRepository) GetByUserAndDate(ctx context.Context, userID int32, voteDate time.Time) (*models.GoldVote, error) {
	var vote models.GoldVote
	result := r.db.DB.WithContext(ctx).
		Where("user_id = ? AND vote_date = ?", userID, voteDate).
		First(&vote)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "gold_vote", "get vote")
	}
	return &vote, nil
}

func (r *goldVoteRepository) GetByAnonymousIDAndDate(ctx context.Context, anonymousID string, voteDate time.Time) (*models.GoldVote, error) {
	var vote models.GoldVote
	result := r.db.DB.WithContext(ctx).
		Where("anonymous_id = ? AND vote_date = ?", anonymousID, voteDate).
		First(&vote)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "gold_vote", "get anonymous vote")
	}
	return &vote, nil
}

func (r *goldVoteRepository) DeleteByAnonymousIDAndDate(ctx context.Context, anonymousID string, voteDate time.Time) error {
	result := r.db.DB.WithContext(ctx).
		Where("anonymous_id = ? AND vote_date = ?", anonymousID, voteDate).
		Delete(&models.GoldVote{})
	if result.Error != nil {
		return r.handleDBError(result.Error, "gold_vote", "delete anonymous vote")
	}
	return nil
}

func (r *goldVoteRepository) CountByDate(ctx context.Context, voteDate time.Time) (bullish int32, bearish int32, err error) {
	type countResult struct {
		Direction int32
		Count     int32
	}
	var results []countResult

	err = r.db.DB.WithContext(ctx).
		Model(&models.GoldVote{}).
		Select("direction, count(*) as count").
		Where("vote_date = ?", voteDate).
		Group("direction").
		Scan(&results).Error
	if err != nil {
		return 0, 0, err
	}

	for _, r := range results {
		switch r.Direction {
		case 1: // BULLISH
			bullish = r.Count
		case 2: // BEARISH
			bearish = r.Count
		}
	}
	return bullish, bearish, nil
}
