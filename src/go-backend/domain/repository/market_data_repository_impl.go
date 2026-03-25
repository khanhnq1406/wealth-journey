package repository

import (
	"context"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
	apperrors "wealthjourney/pkg/errors"

	"gorm.io/gorm/clause"
)

// marketDataRepository implements MarketDataRepository using GORM.
type marketDataRepository struct {
	*BaseRepository
}

// NewMarketDataRepository creates a new MarketDataRepository.
func NewMarketDataRepository(db *database.Database) MarketDataRepository {
	return &marketDataRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// GetBySymbolAndCurrency retrieves the latest market data for a symbol.
func (r *marketDataRepository) GetBySymbolAndCurrency(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
	var data models.MarketData
	result := r.db.DB.WithContext(ctx).
		Where("symbol = ? AND currency = ?", symbol, currency).
		Order("timestamp DESC").
		First(&data)

	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "market data", "get market data")
	}
	return &data, nil
}

// Create upserts a market data entry. If a row for the same (symbol, currency) already
// exists it is updated in-place, preventing "duplicate key value violates unique
// constraint idx_symbol_currency" errors that occur when concurrent goroutines both
// see a cache miss and race to insert the same symbol.
func (r *marketDataRepository) Create(ctx context.Context, data *models.MarketData) error {
	result := r.db.DB.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "symbol"}, {Name: "currency"}},
			DoUpdates: clause.AssignmentColumns([]string{"price", "change24h", "volume24h", "timestamp", "updated_at"}),
		}).
		Create(data)
	if result.Error != nil {
		return r.handleDBError(result.Error, "market data", "create market data")
	}
	return nil
}

// Update updates a market data entry.
func (r *marketDataRepository) Update(ctx context.Context, data *models.MarketData) error {
	return r.executeUpdate(ctx, data, "market data")
}

// Delete deletes market data by ID.
func (r *marketDataRepository) Delete(ctx context.Context, id int32) error {
	return r.executeDelete(ctx, &models.MarketData{}, id, "market data")
}

// List retrieves all market data with pagination.
func (r *marketDataRepository) List(ctx context.Context, opts ListOptions) ([]*models.MarketData, int, error) {
	var data []*models.MarketData
	var total int64

	// Get total count
	if err := r.db.DB.WithContext(ctx).Model(&models.MarketData{}).Count(&total).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to count market data", err)
	}

	// Build order clause
	orderClause := r.buildOrderClause(opts)
	query := r.db.DB.WithContext(ctx).Model(&models.MarketData{}).Order(orderClause)

	// Apply pagination
	query = r.applyPagination(query, opts)

	// Execute query
	result := query.Find(&data)
	if result.Error != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to list market data", result.Error)
	}

	return data, int(total), nil
}

// DeleteExpired deletes all market data entries older than the specified duration.
func (r *marketDataRepository) DeleteExpired(ctx context.Context, maxAge time.Duration) error {
	cutoffTime := time.Now().Add(-maxAge)
	result := r.db.DB.WithContext(ctx).
		Where("timestamp < ?", cutoffTime).
		Delete(&models.MarketData{})

	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to delete expired market data", result.Error)
	}

	return nil
}
