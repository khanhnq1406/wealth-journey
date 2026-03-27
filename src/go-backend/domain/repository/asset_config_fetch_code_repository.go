package repository

import (
	"context"

	"wealthjourney/domain/models"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/database"
)

// assetConfigFetchCodeRepository implements AssetConfigFetchCodeRepository using GORM.
type assetConfigFetchCodeRepository struct {
	*BaseRepository
}

// NewAssetConfigFetchCodeRepository creates a new AssetConfigFetchCodeRepository backed by the given DB.
func NewAssetConfigFetchCodeRepository(db *database.Database) AssetConfigFetchCodeRepository {
	return &assetConfigFetchCodeRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// ListByConfigID retrieves all non-deleted fetch codes for a config, ordered by priority ASC.
// Parameterized query — configID is never interpolated into SQL directly.
func (r *assetConfigFetchCodeRepository) ListByConfigID(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
	var fetchCodes []*models.AssetConfigFetchCode
	result := r.db.DB.WithContext(ctx).
		Where("config_id = ?", configID).
		Order("priority ASC").
		Find(&fetchCodes)
	if result.Error != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to list fetch codes by config id", result.Error)
	}
	return fetchCodes, nil
}

// Create inserts a new fetch code record.
func (r *assetConfigFetchCodeRepository) Create(ctx context.Context, fc *models.AssetConfigFetchCode) error {
	result := r.db.DB.WithContext(ctx).Create(fc)
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to create asset config fetch code", result.Error)
	}
	return nil
}

// Update saves all fields of an existing fetch code record.
func (r *assetConfigFetchCodeRepository) Update(ctx context.Context, fc *models.AssetConfigFetchCode) error {
	result := r.db.DB.WithContext(ctx).Save(fc)
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to update asset config fetch code", result.Error)
	}
	return nil
}

// Delete soft-deletes a fetch code by primary key.
// Returns apperrors.NotFoundError if no row was affected (record does not exist).
func (r *assetConfigFetchCodeRepository) Delete(ctx context.Context, id int32) error {
	result := r.db.DB.WithContext(ctx).Delete(&models.AssetConfigFetchCode{}, id)
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to delete asset config fetch code", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NewNotFoundError("asset config fetch code")
	}
	return nil
}

// CountByConfigID returns the count of active (non-deleted) fetch codes for a config.
// Parameterized query — configID is never interpolated into SQL directly.
func (r *assetConfigFetchCodeRepository) CountByConfigID(ctx context.Context, configID int32) (int64, error) {
	var count int64
	result := r.db.DB.WithContext(ctx).
		Model(&models.AssetConfigFetchCode{}).
		Where("config_id = ?", configID).
		Count(&count)
	if result.Error != nil {
		return 0, apperrors.NewInternalErrorWithCause("failed to count fetch codes by config id", result.Error)
	}
	return count, nil
}
