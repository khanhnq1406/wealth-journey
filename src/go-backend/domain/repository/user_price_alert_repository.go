package repository

import (
	"context"
	"time"

	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
)

// UserPriceAlertRepository defines the interface for user price alert data operations.
type UserPriceAlertRepository interface {
	// Create creates a new price alert.
	Create(ctx context.Context, alert *models.UserPriceAlert) error

	// GetByIDForUser retrieves a price alert by ID, ensuring it belongs to the user.
	// ALWAYS includes WHERE id = ? AND user_id = ? to prevent IDOR.
	GetByIDForUser(ctx context.Context, id int32, userID int32) (*models.UserPriceAlert, error)

	// ListByUserID retrieves price alerts for a user with optional status filter and pagination.
	// ALWAYS scoped to the given userID.
	ListByUserID(ctx context.Context, userID int32, statusFilter string, opts ListOptions) ([]*models.UserPriceAlert, int64, error)

	// Update persists changes to an existing price alert.
	Update(ctx context.Context, alert *models.UserPriceAlert) error

	// Delete soft deletes a price alert by ID, ensuring it belongs to the user.
	// ALWAYS includes WHERE id = ? AND user_id = ? to prevent unauthorised deletion.
	Delete(ctx context.Context, id int32, userID int32) error

	// CountActiveByUserID returns the number of active (non-deleted) alerts for a user.
	CountActiveByUserID(ctx context.Context, userID int32) (int64, error)

	// ListActive returns all active (non-deleted) alerts across all users.
	// Used by the background evaluation job — no user-scoping required.
	ListActive(ctx context.Context) ([]*models.UserPriceAlert, error)

	// UpdateStatus updates the status, last_triggered_at, and trigger_count of an alert.
	UpdateStatus(ctx context.Context, id int32, status string, lastTriggeredAt *time.Time, triggerCount int32) error
}

// userPriceAlertRepository implements UserPriceAlertRepository using GORM.
type userPriceAlertRepository struct {
	*BaseRepository
}

// NewUserPriceAlertRepository creates a new UserPriceAlertRepository.
func NewUserPriceAlertRepository(db *database.Database) UserPriceAlertRepository {
	return &userPriceAlertRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// Create creates a new price alert.
func (r *userPriceAlertRepository) Create(ctx context.Context, alert *models.UserPriceAlert) error {
	result := r.db.DB.WithContext(ctx).Create(alert)
	if result.Error != nil {
		return r.handleDBError(result.Error, "user price alert", "create user price alert")
	}
	return nil
}

// GetByIDForUser retrieves a price alert by ID, ensuring it belongs to the user.
func (r *userPriceAlertRepository) GetByIDForUser(ctx context.Context, id int32, userID int32) (*models.UserPriceAlert, error) {
	var alert models.UserPriceAlert
	result := r.db.DB.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		First(&alert)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "user price alert", "get user price alert")
	}
	return &alert, nil
}

// ListByUserID retrieves price alerts for a user with optional status filter and pagination.
func (r *userPriceAlertRepository) ListByUserID(ctx context.Context, userID int32, statusFilter string, opts ListOptions) ([]*models.UserPriceAlert, int64, error) {
	var alerts []*models.UserPriceAlert
	var total int64

	query := r.db.DB.WithContext(ctx).Model(&models.UserPriceAlert{}).
		Where("user_id = ?", userID)

	if statusFilter != "" {
		query = query.Where("status = ?", statusFilter)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, r.handleDBError(err, "user price alert", "count user price alerts")
	}

	listQuery := r.db.DB.WithContext(ctx).
		Where("user_id = ?", userID)

	if statusFilter != "" {
		listQuery = listQuery.Where("status = ?", statusFilter)
	}

	listQuery = listQuery.Order("created_at DESC")
	listQuery = r.applyPagination(listQuery, opts)

	if err := listQuery.Find(&alerts).Error; err != nil {
		return nil, 0, r.handleDBError(err, "user price alert", "list user price alerts")
	}

	return alerts, total, nil
}

// Update persists changes to an existing price alert using a full model save.
func (r *userPriceAlertRepository) Update(ctx context.Context, alert *models.UserPriceAlert) error {
	return r.executeUpdate(ctx, alert, "user price alert")
}

// Delete soft deletes a price alert by ID, ensuring it belongs to the user.
func (r *userPriceAlertRepository) Delete(ctx context.Context, id int32, userID int32) error {
	result := r.db.DB.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&models.UserPriceAlert{})
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to delete user price alert", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NewNotFoundError("user price alert")
	}
	return nil
}

// CountActiveByUserID returns the number of active alerts for a user.
func (r *userPriceAlertRepository) CountActiveByUserID(ctx context.Context, userID int32) (int64, error) {
	var count int64
	result := r.db.DB.WithContext(ctx).
		Model(&models.UserPriceAlert{}).
		Where("user_id = ? AND status = 'active'", userID).
		Count(&count)
	if result.Error != nil {
		return 0, apperrors.NewInternalErrorWithCause("failed to count active user price alerts", result.Error)
	}
	return count, nil
}

// ListActive returns all active alerts across all users for the background evaluation job.
func (r *userPriceAlertRepository) ListActive(ctx context.Context) ([]*models.UserPriceAlert, error) {
	var alerts []*models.UserPriceAlert
	result := r.db.DB.WithContext(ctx).
		Where("status = 'active'").
		Find(&alerts)
	if result.Error != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to list active user price alerts", result.Error)
	}
	return alerts, nil
}

// UpdateStatus updates the status, last_triggered_at, and trigger_count of a price alert.
func (r *userPriceAlertRepository) UpdateStatus(ctx context.Context, id int32, status string, lastTriggeredAt *time.Time, triggerCount int32) error {
	updates := map[string]interface{}{
		"status":            status,
		"last_triggered_at": lastTriggeredAt,
		"trigger_count":     triggerCount,
	}
	result := r.db.DB.WithContext(ctx).
		Model(&models.UserPriceAlert{}).
		Where("id = ?", id).
		Updates(updates)
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to update user price alert status", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NewNotFoundError("user price alert")
	}
	return nil
}
