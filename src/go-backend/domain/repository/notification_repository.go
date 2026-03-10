package repository

import (
	"context"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
)

type notificationRepository struct {
	*BaseRepository
}

// NewNotificationRepository creates a new notification repository
func NewNotificationRepository(db *database.Database) NotificationRepository {
	return &notificationRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *notificationRepository) Create(ctx context.Context, notification *models.Notification) error {
	return r.executeCreate(ctx, notification, "notification")
}

func (r *notificationRepository) GetByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Notification, int, error) {
	var notifications []*models.Notification
	var total int64

	query := r.db.DB.WithContext(ctx).Model(&models.Notification{}).
		Where("user_id = ?", userID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, r.handleDBError(err, "notification", "count notifications")
	}

	query = r.db.DB.WithContext(ctx).
		Where("user_id = ?", userID).
		Preload("Actor").
		Order("created_at DESC")
	query = r.applyPagination(query, opts)

	if err := query.Find(&notifications).Error; err != nil {
		return nil, 0, r.handleDBError(err, "notification", "get notifications")
	}

	return notifications, int(total), nil
}

func (r *notificationRepository) GetUnreadCount(ctx context.Context, userID int32) (int32, error) {
	var count int64
	err := r.db.DB.WithContext(ctx).Model(&models.Notification{}).
		Where("user_id = ? AND is_read = false", userID).
		Count(&count).Error
	if err != nil {
		return 0, r.handleDBError(err, "notification", "count unread")
	}
	return int32(count), nil
}

func (r *notificationRepository) MarkAllRead(ctx context.Context, userID int32) error {
	err := r.db.DB.WithContext(ctx).Model(&models.Notification{}).
		Where("user_id = ? AND is_read = false", userID).
		Update("is_read", true).Error
	if err != nil {
		return r.handleDBError(err, "notification", "mark all read")
	}
	return nil
}

func (r *notificationRepository) MarkRead(ctx context.Context, id int32, userID int32) error {
	err := r.db.DB.WithContext(ctx).Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true).Error
	if err != nil {
		return r.handleDBError(err, "notification", "mark read")
	}
	return nil
}
