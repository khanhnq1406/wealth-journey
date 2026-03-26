package repository

import (
	"context"
	"time"

	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"

	"gorm.io/gorm/clause"
)

// AssetPriceRepository defines the interface for asset price cache data operations.
// It stores gold and silver prices fetched from external sources so handlers can
// serve cached prices without live API calls.
type AssetPriceRepository interface {
	// UpsertBatch inserts or updates a batch of asset prices using
	// clause.OnConflict on (type_code, currency, source). No raw SQL is used.
	UpsertBatch(ctx context.Context, prices []*models.AssetPrice) error

	// ListByAssetType retrieves all non-deleted prices for the given asset type
	// (e.g. "gold", "silver").
	ListByAssetType(ctx context.Context, assetType string) ([]*models.AssetPrice, error)

	// ListAll retrieves all non-deleted asset prices.
	ListAll(ctx context.Context) ([]*models.AssetPrice, error)

	// GetByTypeCodeAndCurrency retrieves a single price row by its unique
	// (type_code, currency) pair. Returns a NotFoundError if not found.
	GetByTypeCodeAndCurrency(ctx context.Context, typeCode, currency string) (*models.AssetPrice, error)

	// MarkStaleByAssetType marks all non-deleted rows for the given asset type
	// as stale (is_stale = true). Called before a refresh so that any type code
	// that disappears from the source is automatically considered stale.
	MarkStaleByAssetType(ctx context.Context, assetType string) error
}

// assetPriceRepository implements AssetPriceRepository using GORM.
type assetPriceRepository struct {
	*BaseRepository
}

// NewAssetPriceRepository creates a new AssetPriceRepository.
func NewAssetPriceRepository(db *database.Database) AssetPriceRepository {
	return &assetPriceRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// UpsertBatch inserts or updates asset prices using ON CONFLICT (type_code, currency, source).
// Each row is processed individually so that partial failures can be diagnosed;
// the loop is intentional and mirrors UpdatePrices in investment_repository_impl.go.
func (r *assetPriceRepository) UpsertBatch(ctx context.Context, prices []*models.AssetPrice) error {
	if len(prices) == 0 {
		return nil
	}

	for _, price := range prices {
		result := r.db.DB.WithContext(ctx).
			Clauses(clause.OnConflict{
				Columns: []clause.Column{
					{Name: "type_code"},
					{Name: "currency"},
					{Name: "source"},
				},
				DoUpdates: clause.AssignmentColumns([]string{
					"name",
					"buy",
					"sell",
					"change_buy",
					"change_sell",
					"asset_type",
					"source",
					"is_stale",
					"fetched_at",
					"updated_at",
				}),
			}).
			Create(price)
		if result.Error != nil {
			return apperrors.NewInternalErrorWithCause("failed to upsert asset price", result.Error)
		}
	}

	return nil
}

// ListByAssetType retrieves all non-deleted asset prices for the given asset type.
func (r *assetPriceRepository) ListByAssetType(ctx context.Context, assetType string) ([]*models.AssetPrice, error) {
	var prices []*models.AssetPrice
	result := r.db.DB.WithContext(ctx).
		Where("asset_type = ?", assetType).
		Find(&prices)
	if result.Error != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to list asset prices by asset type", result.Error)
	}
	return prices, nil
}

// ListAll retrieves all non-deleted asset prices.
func (r *assetPriceRepository) ListAll(ctx context.Context) ([]*models.AssetPrice, error) {
	var prices []*models.AssetPrice
	result := r.db.DB.WithContext(ctx).Find(&prices)
	if result.Error != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to list all asset prices", result.Error)
	}
	return prices, nil
}

// GetByTypeCodeAndCurrency retrieves a single asset price by its unique (type_code, currency) pair.
func (r *assetPriceRepository) GetByTypeCodeAndCurrency(ctx context.Context, typeCode, currency string) (*models.AssetPrice, error) {
	var price models.AssetPrice
	result := r.db.DB.WithContext(ctx).
		Where("type_code = ? AND currency = ?", typeCode, currency).
		First(&price)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "asset price", "get asset price")
	}
	return &price, nil
}

// MarkStaleByAssetType marks all non-deleted rows for the given asset type as stale.
// Uses a GORM Model+Where+Updates call — no raw SQL.
func (r *assetPriceRepository) MarkStaleByAssetType(ctx context.Context, assetType string) error {
	result := r.db.DB.WithContext(ctx).
		Model(&models.AssetPrice{}).
		Where("asset_type = ?", assetType).
		Updates(map[string]interface{}{
			"is_stale":   true,
			"updated_at": time.Now(),
		})
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to mark asset prices as stale", result.Error)
	}
	return nil
}
