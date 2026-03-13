package repository

import (
	"context"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
	apperrors "wealthjourney/pkg/errors"
)

type goldVoteCommentRepository struct {
	*BaseRepository
}

func NewGoldVoteCommentRepository(db *database.Database) GoldVoteCommentRepository {
	return &goldVoteCommentRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *goldVoteCommentRepository) Create(ctx context.Context, comment *models.GoldVoteComment) error {
	result := r.db.DB.WithContext(ctx).Create(comment)
	if result.Error != nil {
		return r.handleDBError(result.Error, "gold_vote_comment", "create comment")
	}
	return nil
}

func (r *goldVoteCommentRepository) GetByID(ctx context.Context, id int32) (*models.GoldVoteComment, error) {
	var comment models.GoldVoteComment
	result := r.db.DB.WithContext(ctx).First(&comment, id)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "gold_vote_comment", "get comment")
	}
	return &comment, nil
}

func (r *goldVoteCommentRepository) ListByDate(ctx context.Context, voteDate time.Time, limit, offset int) ([]*models.GoldVoteComment, int, error) {
	var comments []*models.GoldVoteComment
	var total int64

	baseQuery := r.db.DB.WithContext(ctx).
		Model(&models.GoldVoteComment{}).
		Where("vote_date = ?", voteDate)

	if err := baseQuery.Count(&total).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to count comments", err)
	}

	result := r.db.DB.WithContext(ctx).
		Where("vote_date = ?", voteDate).
		Preload("User").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&comments)

	if result.Error != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to list comments", result.Error)
	}

	return comments, int(total), nil
}

func (r *goldVoteCommentRepository) Delete(ctx context.Context, id int32) error {
	result := r.db.DB.WithContext(ctx).Delete(&models.GoldVoteComment{}, id)
	if result.Error != nil {
		return r.handleDBError(result.Error, "gold_vote_comment", "delete comment")
	}
	if result.RowsAffected == 0 {
		return apperrors.NewNotFoundError("comment")
	}
	return nil
}

func (r *goldVoteCommentRepository) CountByUserAndDate(ctx context.Context, userID int32, voteDate time.Time) (int, error) {
	var count int64
	err := r.db.DB.WithContext(ctx).
		Model(&models.GoldVoteComment{}).
		Where("user_id = ? AND vote_date = ?", userID, voteDate).
		Count(&count).Error
	if err != nil {
		return 0, apperrors.NewInternalErrorWithCause("failed to count user comments", err)
	}
	return int(count), nil
}
