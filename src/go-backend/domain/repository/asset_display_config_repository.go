package repository

import (
	"context"
	"errors"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
	apperrors "wealthjourney/pkg/errors"

	"gorm.io/gorm"
)

// AssetDisplayConfigRepository defines the interface for asset display config data operations.
// It manages the visibility and ordering of asset type entries shown in the market prices
// dashboard and the investment selection flow. This repository replaces the older
// GoldDisplayConfigRepository and adds support for multiple asset types (gold, silver, etc.).
type AssetDisplayConfigRepository interface {
	// ListAll retrieves all asset display configs ordered by display_order ASC.
	// Soft-deleted rows are excluded by GORM automatically.
	ListAll(ctx context.Context) ([]*models.AssetDisplayConfig, error)

	// ListEnabled retrieves only enabled configs ordered by display_order ASC.
	// Filtering is performed in the DB query — not in application code.
	ListEnabled(ctx context.Context) ([]*models.AssetDisplayConfig, error)

	// GetByID retrieves a single config by primary key.
	// Returns apperrors.NotFoundError if the record does not exist.
	GetByID(ctx context.Context, id int32) (*models.AssetDisplayConfig, error)

	// GetByTypeCode retrieves a config by its exact type_code value.
	// Returns nil, nil if no record matches — callers decide whether absence is an error.
	// Uses exact equality (=) only — no LIKE or partial matching.
	GetByTypeCode(ctx context.Context, typeCode string) (*models.AssetDisplayConfig, error)

	// Create inserts a new asset display config record.
	Create(ctx context.Context, config *models.AssetDisplayConfig) error

	// Update saves all fields of an existing asset display config record.
	Update(ctx context.Context, config *models.AssetDisplayConfig) error

	// Delete soft-deletes an asset display config by primary key.
	// Returns apperrors.NotFoundError if no row is affected.
	Delete(ctx context.Context, id int32) error

	// ListByAssetType retrieves only enabled configs for a given asset type,
	// ordered by display_order ASC. Filtering is applied in the DB query.
	// Uses exact equality (=) — no LIKE or partial matching.
	ListByAssetType(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error)

	// GetByTypeCodeAndAssetType retrieves a config by its exact type_code and asset_type pair.
	// Returns nil, nil if no record matches — callers decide whether absence is an error.
	// Uses exact equality (=) on both columns — no LIKE or partial matching.
	GetByTypeCodeAndAssetType(ctx context.Context, typeCode, assetType string) (*models.AssetDisplayConfig, error)
}

// assetDisplayConfigRepository implements AssetDisplayConfigRepository using GORM.
type assetDisplayConfigRepository struct {
	*BaseRepository
}

// NewAssetDisplayConfigRepository creates a new AssetDisplayConfigRepository backed by the given DB.
func NewAssetDisplayConfigRepository(db *database.Database) AssetDisplayConfigRepository {
	return &assetDisplayConfigRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// ListAll retrieves all non-deleted asset display configs ordered by display_order ASC.
func (r *assetDisplayConfigRepository) ListAll(ctx context.Context) ([]*models.AssetDisplayConfig, error) {
	var configs []*models.AssetDisplayConfig
	result := r.db.DB.WithContext(ctx).
		Order("display_order ASC").
		Find(&configs)
	if result.Error != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to list all asset display configs", result.Error)
	}
	return configs, nil
}

// ListEnabled retrieves only enabled, non-deleted asset display configs ordered by display_order ASC.
// The enabled filter is applied in the DB WHERE clause — not post-fetch in Go.
func (r *assetDisplayConfigRepository) ListEnabled(ctx context.Context) ([]*models.AssetDisplayConfig, error) {
	var configs []*models.AssetDisplayConfig
	result := r.db.DB.WithContext(ctx).
		Where("enabled = true").
		Order("display_order ASC").
		Find(&configs)
	if result.Error != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to list enabled asset display configs", result.Error)
	}
	return configs, nil
}

// GetByID retrieves a single asset display config by primary key.
// Returns apperrors.NotFoundError if the record does not exist.
func (r *assetDisplayConfigRepository) GetByID(ctx context.Context, id int32) (*models.AssetDisplayConfig, error) {
	var config models.AssetDisplayConfig
	result := r.db.DB.WithContext(ctx).First(&config, id)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "asset display config", "get asset display config")
	}
	return &config, nil
}

// GetByTypeCode retrieves an asset display config by its exact type_code value.
// Uses exact equality matching (WHERE type_code = ?) — never LIKE or partial match.
// Returns nil, nil when no record is found so callers can decide how to handle absence.
// Returns a wrapped internal error for any other DB failure.
func (r *assetDisplayConfigRepository) GetByTypeCode(ctx context.Context, typeCode string) (*models.AssetDisplayConfig, error) {
	var config models.AssetDisplayConfig
	result := r.db.DB.WithContext(ctx).
		Where("type_code = ?", typeCode).
		First(&config)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, apperrors.NewInternalErrorWithCause("failed to get asset display config by type code", result.Error)
	}
	return &config, nil
}

// Create inserts a new asset display config record.
func (r *assetDisplayConfigRepository) Create(ctx context.Context, config *models.AssetDisplayConfig) error {
	result := r.db.DB.WithContext(ctx).Create(config)
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to create asset display config", result.Error)
	}
	return nil
}

// Update saves all fields of an existing asset display config record.
func (r *assetDisplayConfigRepository) Update(ctx context.Context, config *models.AssetDisplayConfig) error {
	result := r.db.DB.WithContext(ctx).Save(config)
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to update asset display config", result.Error)
	}
	return nil
}

// Delete soft-deletes an asset display config by primary key.
// Returns apperrors.NotFoundError if no row was affected (record does not exist).
func (r *assetDisplayConfigRepository) Delete(ctx context.Context, id int32) error {
	result := r.db.DB.WithContext(ctx).Delete(&models.AssetDisplayConfig{}, id)
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to delete asset display config", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NewNotFoundError("asset display config")
	}
	return nil
}

// ListByAssetType retrieves enabled, non-deleted asset display configs for a specific asset type,
// ordered by display_order ASC. Both filters are applied in the DB WHERE clause.
// Uses exact equality matching (WHERE asset_type = ?) — never LIKE or partial match.
func (r *assetDisplayConfigRepository) ListByAssetType(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
	var configs []*models.AssetDisplayConfig
	result := r.db.DB.WithContext(ctx).
		Where("asset_type = ? AND enabled = true", assetType).
		Order("display_order ASC").
		Find(&configs)
	if result.Error != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to list asset display configs by asset type", result.Error)
	}
	return configs, nil
}

// GetByTypeCodeAndAssetType retrieves an asset display config by the exact type_code + asset_type pair.
// Uses exact equality matching on both columns — never LIKE or partial match.
// Returns nil, nil when no record is found so callers can decide how to handle absence.
// Returns a wrapped internal error for any other DB failure.
func (r *assetDisplayConfigRepository) GetByTypeCodeAndAssetType(ctx context.Context, typeCode, assetType string) (*models.AssetDisplayConfig, error) {
	var config models.AssetDisplayConfig
	result := r.db.DB.WithContext(ctx).
		Where("type_code = ? AND asset_type = ?", typeCode, assetType).
		First(&config)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, apperrors.NewInternalErrorWithCause("failed to get asset display config by type code and asset type", result.Error)
	}
	return &config, nil
}
