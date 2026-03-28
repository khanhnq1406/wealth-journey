package repository

import (
	"context"
	"errors"

	"wealthjourney/domain/models"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/database"

	"gorm.io/gorm"
)

// GoldDisplayConfigRepository defines the interface for gold display config data operations.
// It manages the visibility and ordering of gold type entries shown in the market prices
// dashboard and the investment selection flow.
type GoldDisplayConfigRepository interface {
	// ListAll retrieves all gold display configs ordered by display_order ASC.
	// Soft-deleted rows are excluded by GORM automatically.
	ListAll(ctx context.Context) ([]*models.GoldDisplayConfig, error)

	// ListEnabled retrieves only enabled configs ordered by display_order ASC.
	// Filtering is performed in the DB query — not in application code.
	ListEnabled(ctx context.Context) ([]*models.GoldDisplayConfig, error)

	// GetByID retrieves a single config by primary key.
	// Returns apperrors.NotFoundError if the record does not exist.
	GetByID(ctx context.Context, id int32) (*models.GoldDisplayConfig, error)

	// GetByTypeCode retrieves a config by its exact type_code value.
	// Returns nil, nil if no record matches — callers decide whether absence is an error.
	// Uses exact equality (=) only — no LIKE or partial matching.
	GetByTypeCode(ctx context.Context, typeCode string) (*models.GoldDisplayConfig, error)

	// Create inserts a new gold display config record.
	Create(ctx context.Context, config *models.GoldDisplayConfig) error

	// Update saves all fields of an existing gold display config record.
	Update(ctx context.Context, config *models.GoldDisplayConfig) error

	// Delete soft-deletes a gold display config by primary key.
	// Returns apperrors.NotFoundError if no row is affected.
	Delete(ctx context.Context, id int32) error
}

// goldDisplayConfigRepository implements GoldDisplayConfigRepository using GORM.
type goldDisplayConfigRepository struct {
	*BaseRepository
}

// NewGoldDisplayConfigRepository creates a new GoldDisplayConfigRepository backed by the given DB.
func NewGoldDisplayConfigRepository(db *database.Database) GoldDisplayConfigRepository {
	return &goldDisplayConfigRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// ListAll retrieves all non-deleted gold display configs ordered by display_order ASC.
func (r *goldDisplayConfigRepository) ListAll(ctx context.Context) ([]*models.GoldDisplayConfig, error) {
	var configs []*models.GoldDisplayConfig
	result := r.db.DB.WithContext(ctx).
		Order("display_order ASC").
		Find(&configs)
	if result.Error != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to list all gold display configs", result.Error)
	}
	return configs, nil
}

// ListEnabled retrieves only enabled, non-deleted gold display configs ordered by display_order ASC.
// The enabled filter is applied in the DB WHERE clause — not post-fetch in Go.
func (r *goldDisplayConfigRepository) ListEnabled(ctx context.Context) ([]*models.GoldDisplayConfig, error) {
	var configs []*models.GoldDisplayConfig
	result := r.db.DB.WithContext(ctx).
		Where("enabled = true").
		Order("display_order ASC").
		Find(&configs)
	if result.Error != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to list enabled gold display configs", result.Error)
	}
	return configs, nil
}

// GetByID retrieves a single gold display config by primary key.
// Returns apperrors.NotFoundError if the record does not exist.
func (r *goldDisplayConfigRepository) GetByID(ctx context.Context, id int32) (*models.GoldDisplayConfig, error) {
	var config models.GoldDisplayConfig
	result := r.db.DB.WithContext(ctx).First(&config, id)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "gold display config", "get gold display config")
	}
	return &config, nil
}

// GetByTypeCode retrieves a gold display config by its exact type_code value.
// Uses exact equality matching (WHERE type_code = ?) — never LIKE or partial match.
// Returns nil, nil when no record is found so callers can decide how to handle absence.
// Returns a wrapped internal error for any other DB failure.
func (r *goldDisplayConfigRepository) GetByTypeCode(ctx context.Context, typeCode string) (*models.GoldDisplayConfig, error) {
	var config models.GoldDisplayConfig
	result := r.db.DB.WithContext(ctx).
		Where("type_code = ?", typeCode).
		First(&config)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, apperrors.NewInternalErrorWithCause("failed to get gold display config by type code", result.Error)
	}
	return &config, nil
}

// Create inserts a new gold display config record.
func (r *goldDisplayConfigRepository) Create(ctx context.Context, config *models.GoldDisplayConfig) error {
	result := r.db.DB.WithContext(ctx).Create(config)
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to create gold display config", result.Error)
	}
	return nil
}

// Update saves all fields of an existing gold display config record.
func (r *goldDisplayConfigRepository) Update(ctx context.Context, config *models.GoldDisplayConfig) error {
	result := r.db.DB.WithContext(ctx).Save(config)
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to update gold display config", result.Error)
	}
	return nil
}

// Delete soft-deletes a gold display config by primary key.
// Returns apperrors.NotFoundError if no row was affected (record does not exist).
func (r *goldDisplayConfigRepository) Delete(ctx context.Context, id int32) error {
	result := r.db.DB.WithContext(ctx).Delete(&models.GoldDisplayConfig{}, id)
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to delete gold display config", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NewNotFoundError("gold display config")
	}
	return nil
}
