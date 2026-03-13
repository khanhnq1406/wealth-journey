package repository

import (
	"context"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"

	"gorm.io/gorm/clause"
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
	result := r.db.DB.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "vote_date"}},
			DoUpdates: clause.AssignmentColumns([]string{"direction", "updated_at"}),
		}).
		Create(vote)
	if result.Error != nil {
		return r.handleDBError(result.Error, "gold_vote", "upsert vote")
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
