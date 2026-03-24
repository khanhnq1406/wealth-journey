package repository

import (
	"context"
	"fmt"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"

	apperrors "wealthjourney/pkg/errors"

	"gorm.io/gorm"
)

// watchlistRepository implements WatchlistRepository using GORM.
type watchlistRepository struct {
	*BaseRepository
}

// NewWatchlistRepository creates a new WatchlistRepository.
func NewWatchlistRepository(db *database.Database) WatchlistRepository {
	return &watchlistRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// Create creates a new watchlist item.
func (r *watchlistRepository) Create(ctx context.Context, item *models.WatchlistItem) error {
	result := r.db.DB.WithContext(ctx).Create(item)
	if result.Error != nil {
		return r.handleDBError(result.Error, "watchlist item", "create watchlist item")
	}
	return nil
}

// GetByIDForUser retrieves a watchlist item by ID, ensuring it belongs to the user.
func (r *watchlistRepository) GetByIDForUser(ctx context.Context, itemID, userID int32) (*models.WatchlistItem, error) {
	var item models.WatchlistItem
	result := r.db.DB.WithContext(ctx).
		Where("id = ? AND user_id = ?", itemID, userID).
		First(&item)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "watchlist item", "get watchlist item")
	}
	return &item, nil
}

// GetBySymbolForUser retrieves a watchlist item by symbol for a user.
func (r *watchlistRepository) GetBySymbolForUser(ctx context.Context, symbol string, userID int32) (*models.WatchlistItem, error) {
	var item models.WatchlistItem
	result := r.db.DB.WithContext(ctx).
		Where("symbol = ? AND user_id = ?", symbol, userID).
		First(&item)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "watchlist item", "get watchlist item by symbol")
	}
	return &item, nil
}

// ListByUserID retrieves all watchlist items for a user, ordered by sort_order ASC, created_at ASC.
func (r *watchlistRepository) ListByUserID(ctx context.Context, userID int32) ([]*models.WatchlistItem, error) {
	var items []*models.WatchlistItem
	result := r.db.DB.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("sort_order ASC, created_at ASC").
		Find(&items)
	if result.Error != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to list watchlist items", result.Error)
	}
	return items, nil
}

// CountByUserID returns the number of watchlist items for a user.
func (r *watchlistRepository) CountByUserID(ctx context.Context, userID int32) (int64, error) {
	var count int64
	result := r.db.DB.WithContext(ctx).
		Model(&models.WatchlistItem{}).
		Where("user_id = ?", userID).
		Count(&count)
	if result.Error != nil {
		return 0, apperrors.NewInternalErrorWithCause("failed to count watchlist items", result.Error)
	}
	return count, nil
}

// Update updates a watchlist item using a full model save.
func (r *watchlistRepository) Update(ctx context.Context, item *models.WatchlistItem) error {
	return r.executeUpdate(ctx, item, "watchlist item")
}

// Delete soft deletes a watchlist item by ID.
func (r *watchlistRepository) Delete(ctx context.Context, itemID int32) error {
	return r.executeDelete(ctx, &models.WatchlistItem{}, itemID, "watchlist item")
}

// ReorderItems updates the sort_order for each item ID in order within a transaction.
// All IDs must belong to the given user; ownership is validated inside the UPDATE WHERE clause.
func (r *watchlistRepository) ReorderItems(ctx context.Context, userID int32, itemIDs []int32) error {
	return r.db.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for i, id := range itemIDs {
			result := tx.Model(&models.WatchlistItem{}).
				Where("id = ? AND user_id = ?", id, userID).
				Update("sort_order", i)
			if result.Error != nil {
				return apperrors.NewInternalErrorWithCause("failed to reorder watchlist items", result.Error)
			}
			if result.RowsAffected == 0 {
				return fmt.Errorf("item %d not found or does not belong to user", id)
			}
		}
		return nil
	})
}

// GetMaxSortOrder returns the maximum sort_order value for a user's watchlist,
// or -1 if the watchlist is empty.
func (r *watchlistRepository) GetMaxSortOrder(ctx context.Context, userID int32) (int32, error) {
	var maxOrder int32
	result := r.db.DB.WithContext(ctx).
		Model(&models.WatchlistItem{}).
		Where("user_id = ?", userID).
		Select("COALESCE(MAX(sort_order), -1)").
		Scan(&maxOrder)
	if result.Error != nil {
		return 0, apperrors.NewInternalErrorWithCause("failed to get max sort order", result.Error)
	}
	return maxOrder, nil
}
