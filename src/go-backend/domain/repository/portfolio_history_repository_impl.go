package repository

import (
	"context"
	"time"

	"gorm.io/gorm"
	"wealthjourney/domain/models"
)

type portfolioHistoryRepositoryImpl struct {
	db *gorm.DB
}

// NewPortfolioHistoryRepository creates a new PortfolioHistoryRepository
func NewPortfolioHistoryRepository(db *gorm.DB) PortfolioHistoryRepository {
	return &portfolioHistoryRepositoryImpl{db: db}
}

// Create stores a new portfolio history snapshot
func (r *portfolioHistoryRepositoryImpl) Create(ctx context.Context, history *models.PortfolioHistory) error {
	return r.db.WithContext(ctx).Create(history).Error
}

// GetLatestByWallet retrieves the most recent snapshot for a wallet
func (r *portfolioHistoryRepositoryImpl) GetLatestByWallet(ctx context.Context, userID, walletID int32) (*models.PortfolioHistory, error) {
	var history models.PortfolioHistory
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND wallet_id = ?", userID, walletID).
		Order("timestamp DESC").
		First(&history).Error
	if err != nil {
		return nil, err
	}
	return &history, nil
}

// GetHistoryByWallet retrieves historical snapshots within a time range
func (r *portfolioHistoryRepositoryImpl) GetHistoryByWallet(ctx context.Context, userID, walletID int32, from, to time.Time, limit int) ([]*models.PortfolioHistory, error) {
	var histories []*models.PortfolioHistory
	query := r.db.WithContext(ctx).
		Where("user_id = ? AND wallet_id = ?", userID, walletID).
		Where("timestamp >= ? AND timestamp <= ?", from, to).
		Order("timestamp ASC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	err := query.Find(&histories).Error
	return histories, err
}

// GetAggregatedHistory retrieves aggregated history across all investment wallets
// Returns daily aggregated snapshots
func (r *portfolioHistoryRepositoryImpl) GetAggregatedHistory(ctx context.Context, userID int32, from, to time.Time, limit int) ([]*models.PortfolioHistory, error) {
	// For now, we'll fetch all history and aggregate in memory
	// In production, consider using SQL aggregation for better performance
	var histories []*models.PortfolioHistory
	query := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Where("timestamp >= ? AND timestamp <= ?", from, to).
		Order("timestamp ASC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	err := query.Find(&histories).Error
	return histories, err
}

// DeleteOldRecords removes records older than specified duration
func (r *portfolioHistoryRepositoryImpl) DeleteOldRecords(ctx context.Context, olderThan time.Duration) error {
	cutoff := time.Now().Add(-olderThan)
	return r.db.WithContext(ctx).
		Where("timestamp < ?", cutoff).
		Delete(&models.PortfolioHistory{}).Error
}

// GetPeriodStartSnapshot retrieves the per-wallet snapshots nearest to the period start
// and aggregates them into a single synthetic PortfolioHistory representing the user's
// total portfolio state at `from`. Uses DISTINCT ON (wallet_id) to get the most recent
// snapshot per wallet at or before `from`, then sums TotalPnl and TotalValue in memory.
func (r *portfolioHistoryRepositoryImpl) GetPeriodStartSnapshot(ctx context.Context, userID int32, from time.Time) (*models.PortfolioHistory, error) {
	var snapshots []*models.PortfolioHistory

	err := r.db.WithContext(ctx).Raw(`
		SELECT DISTINCT ON (wallet_id) id, user_id, wallet_id, total_value, total_cost, total_pnl, currency, timestamp, created_at, updated_at, deleted_at
		FROM portfolio_history
		WHERE user_id = ? AND timestamp <= ? AND deleted_at IS NULL
		ORDER BY wallet_id, timestamp DESC
	`, userID, from).Scan(&snapshots).Error
	if err != nil {
		return nil, err
	}
	if len(snapshots) == 0 {
		return nil, nil
	}

	// Aggregate across wallets
	var totalPnl, totalValue int64
	for _, s := range snapshots {
		totalPnl += s.TotalPnl
		totalValue += s.TotalValue
	}

	return &models.PortfolioHistory{
		UserID:     userID,
		TotalPnl:   totalPnl,
		TotalValue: totalValue,
		Timestamp:  from,
	}, nil
}

// CreateSnapshotIfNotDuplicate creates a snapshot only if one doesn't exist recently
func (r *portfolioHistoryRepositoryImpl) CreateSnapshotIfNotDuplicate(ctx context.Context, history *models.PortfolioHistory) (*models.PortfolioHistory, error) {
	// Check for recent snapshot (within 1 hour)
	recent, err := r.GetLatestByWallet(ctx, history.UserID, history.WalletID)
	if err == nil && history.IsDuplicate(recent) {
		// Update the existing snapshot instead of creating a new one
		recent.TotalValue = history.TotalValue
		recent.TotalCost = history.TotalCost
		recent.TotalPnl = history.TotalPnl
		recent.Timestamp = history.Timestamp
		err := r.db.WithContext(ctx).Save(recent).Error
		return recent, err
	}

	// No recent snapshot, create new one
	err = r.Create(ctx, history)
	return history, err
}
