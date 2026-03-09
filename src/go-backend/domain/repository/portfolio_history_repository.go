package repository

import (
	"context"
	"time"

	"wealthjourney/domain/models"
)

// PortfolioHistoryRepository defines the interface for portfolio history data access
type PortfolioHistoryRepository interface {
	// Create stores a new portfolio history snapshot
	Create(ctx context.Context, history *models.PortfolioHistory) error

	// GetLatestByWallet retrieves the most recent snapshot for a wallet
	GetLatestByWallet(ctx context.Context, userID, walletID int32) (*models.PortfolioHistory, error)

	// GetHistoryByWallet retrieves historical snapshots within a time range
	GetHistoryByWallet(ctx context.Context, userID, walletID int32, from, to time.Time, limit int) ([]*models.PortfolioHistory, error)

	// GetAggregatedHistory retrieves aggregated history across all investment wallets
	GetAggregatedHistory(ctx context.Context, userID int32, from, to time.Time, limit int) ([]*models.PortfolioHistory, error)

	// DeleteOldRecords removes records older than specified duration (cleanup)
	DeleteOldRecords(ctx context.Context, olderThan time.Duration) error

	// CreateSnapshotIfNotDuplicate creates a snapshot only if one doesn't exist recently
	CreateSnapshotIfNotDuplicate(ctx context.Context, history *models.PortfolioHistory) (*models.PortfolioHistory, error)

	// GetPeriodStartSnapshot finds the per-wallet snapshots nearest to `from` for the user,
	// then aggregates them into a single synthetic snapshot (summed TotalPnl and TotalValue).
	// Returns nil, nil if no snapshots exist at or before `from`.
	GetPeriodStartSnapshot(ctx context.Context, userID int32, from time.Time) (*models.PortfolioHistory, error)
}
