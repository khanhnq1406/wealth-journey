package repository

import (
	"context"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
	apperrors "wealthjourney/pkg/errors"
)

type feedbackRepository struct {
	*BaseRepository
}

func NewFeedbackRepository(db *database.Database) FeedbackRepository {
	return &feedbackRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *feedbackRepository) Create(ctx context.Context, feedback *models.Feedback) error {
	result := r.db.DB.WithContext(ctx).Create(feedback)
	if result.Error != nil {
		return r.handleDBError(result.Error, "feedback", "create feedback")
	}
	return nil
}

func (r *feedbackRepository) ListByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Feedback, int, error) {
	var feedbacks []*models.Feedback
	var total int64

	if err := r.db.DB.WithContext(ctx).Model(&models.Feedback{}).
		Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to count feedback", err)
	}

	orderClause := r.buildOrderClause(opts)
	if orderClause == "" {
		orderClause = "created_at DESC"
	}

	query := r.db.DB.WithContext(ctx).
		Where("user_id = ?", userID).
		Order(orderClause)
	query = r.applyPagination(query, opts)

	if err := query.Find(&feedbacks).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to list feedback", err)
	}

	return feedbacks, int(total), nil
}

func (r *feedbackRepository) CountRecentByUserID(ctx context.Context, userID int32, since time.Time) (int, error) {
	var count int64
	if err := r.db.DB.WithContext(ctx).Model(&models.Feedback{}).
		Where("user_id = ? AND created_at >= ?", userID, since).
		Count(&count).Error; err != nil {
		return 0, apperrors.NewInternalErrorWithCause("failed to count recent feedback", err)
	}
	return int(count), nil
}

func (r *feedbackRepository) GetByID(ctx context.Context, id int32) (*models.Feedback, error) {
	var feedback models.Feedback
	if err := r.db.DB.WithContext(ctx).Preload("User").First(&feedback, id).Error; err != nil {
		return nil, r.handleDBError(err, "feedback", "get feedback by ID")
	}
	return &feedback, nil
}

func (r *feedbackRepository) ListAll(ctx context.Context, statusFilter int16, opts ListOptions) ([]*models.Feedback, int, error) {
	var feedbacks []*models.Feedback
	var total int64

	countQuery := r.db.DB.WithContext(ctx).Model(&models.Feedback{})
	if statusFilter > 0 {
		countQuery = countQuery.Where("status = ?", statusFilter)
	}
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to count feedback", err)
	}

	orderClause := r.buildOrderClause(opts)
	if orderClause == "" {
		orderClause = "created_at DESC"
	}

	dataQuery := r.db.DB.WithContext(ctx).Preload("User")
	if statusFilter > 0 {
		dataQuery = dataQuery.Where("status = ?", statusFilter)
	}
	dataQuery = dataQuery.Order(orderClause)
	dataQuery = r.applyPagination(dataQuery, opts)

	if err := dataQuery.Find(&feedbacks).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to list feedback", err)
	}

	return feedbacks, int(total), nil
}

func (r *feedbackRepository) Update(ctx context.Context, feedback *models.Feedback) error {
	if err := r.db.DB.WithContext(ctx).Save(feedback).Error; err != nil {
		return r.handleDBError(err, "feedback", "update feedback")
	}
	return nil
}

func (r *feedbackRepository) Delete(ctx context.Context, id int32) error {
	return r.executeDelete(ctx, &models.Feedback{}, id, "feedback")
}
