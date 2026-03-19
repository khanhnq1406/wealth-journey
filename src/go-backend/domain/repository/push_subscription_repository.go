package repository

import (
	"context"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
)

type pushSubscriptionRepository struct {
	*BaseRepository
}

func NewPushSubscriptionRepository(db *database.Database) PushSubscriptionRepository {
	return &pushSubscriptionRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *pushSubscriptionRepository) Create(ctx context.Context, sub *models.PushSubscription) error {
	return r.executeCreate(ctx, sub, "push_subscription")
}

func (r *pushSubscriptionRepository) DeleteByEndpoint(ctx context.Context, endpoint string) error {
	result := r.db.DB.WithContext(ctx).Where("endpoint = ?", endpoint).Delete(&models.PushSubscription{})
	if result.Error != nil {
		return r.handleDBError(result.Error, "push_subscription", "delete by endpoint")
	}
	return nil
}

func (r *pushSubscriptionRepository) GetByUserID(ctx context.Context, userID int32) ([]*models.PushSubscription, error) {
	var subs []*models.PushSubscription
	err := r.db.DB.WithContext(ctx).Where("user_id = ?", userID).Find(&subs).Error
	if err != nil {
		return nil, r.handleDBError(err, "push_subscription", "get by user ID")
	}
	return subs, nil
}

func (r *pushSubscriptionRepository) GetAll(ctx context.Context) ([]*models.PushSubscription, error) {
	var subs []*models.PushSubscription
	err := r.db.DB.WithContext(ctx).Find(&subs).Error
	if err != nil {
		return nil, r.handleDBError(err, "push_subscription", "get all")
	}
	return subs, nil
}

func (r *pushSubscriptionRepository) CountByUserID(ctx context.Context, userID int32) (int, error) {
	var count int64
	err := r.db.DB.WithContext(ctx).Model(&models.PushSubscription{}).
		Where("user_id = ?", userID).Count(&count).Error
	if err != nil {
		return 0, r.handleDBError(err, "push_subscription", "count by user ID")
	}
	return int(count), nil
}

func (r *pushSubscriptionRepository) DeleteByID(ctx context.Context, id int32) error {
	return r.executeDelete(ctx, &models.PushSubscription{}, id, "push_subscription")
}
