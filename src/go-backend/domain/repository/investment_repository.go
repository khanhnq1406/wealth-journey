package repository

import (
	"context"

	v1 "wealthjourney/protobuf/v1"
	"wealthjourney/domain/models"
)

// InvestmentRepository defines the interface for investment data operations.
type InvestmentRepository interface {
	// Create creates a new investment.
	Create(ctx context.Context, investment *models.Investment) error

	// GetByID retrieves an investment by ID.
	GetByID(ctx context.Context, id int32) (*models.Investment, error)

	// GetByIDForUser retrieves an investment by ID, ensuring it belongs to the user.
	GetByIDForUser(ctx context.Context, investmentID, userID int32) (*models.Investment, error)

	// GetByUserAndSymbol retrieves an investment by user and symbol.
	GetByUserAndSymbol(ctx context.Context, userID int32, symbol string) (*models.Investment, error)

	// ListByUserID retrieves all investments for a user directly via user_id.
	ListByUserID(ctx context.Context, userID int32, opts ListOptions, typeFilter v1.InvestmentType) ([]*models.Investment, int, error)

	// ListByWalletID retrieves all investments in a wallet.
	ListByWalletID(ctx context.Context, walletID int32, opts ListOptions, typeFilter v1.InvestmentType) ([]*models.Investment, int, error)

	// Update updates an investment.
	Update(ctx context.Context, investment *models.Investment) error

	// Delete soft deletes an investment by ID.
	Delete(ctx context.Context, id int32) error

	// CountBySymbol returns the count of non-deleted investments where symbol = the given value.
	// Uses a SQL COUNT(*) query with the GORM soft-delete scope applied automatically.
	CountBySymbol(ctx context.Context, symbol string) (int64, error)

	// UpdatePrices updates current prices for multiple investments.
	UpdatePrices(ctx context.Context, updates []PriceUpdate) error

	// GetPortfolioSummary calculates summary stats for a wallet.
	GetPortfolioSummary(ctx context.Context, walletID int32) (*PortfolioSummary, error)

	// GetAggregatedPortfolioSummary calculates summary stats across all user's investment wallets.
	GetAggregatedPortfolioSummary(ctx context.Context, userID int32, typeFilter v1.InvestmentType) (*PortfolioSummary, error)

	// GetInvestmentValue aggregates total current value of all investments in a wallet
	// Note: current_value is already calculated and stored by GORM hooks (BeforeCreate/BeforeUpdate)
	GetInvestmentValue(ctx context.Context, walletID int32) (int64, error)

	// GetInvestmentValuesByWalletIDs batch fetches investment values for multiple wallets
	GetInvestmentValuesByWalletIDs(ctx context.Context, walletIDs []int32) (map[int32]int64, error)
}

// PriceUpdate represents a price update for an investment.
type PriceUpdate struct {
	InvestmentID int32
	Price        int64
	Timestamp    int64
}

// PortfolioSummary represents aggregated portfolio statistics.
type PortfolioSummary struct {
	TotalValue            int64
	TotalCost             int64
	TotalPNL              int64
	TotalPNLPercent       float64
	RealizedPNL           int64
	UnrealizedPNL         int64
	TotalInvestments      int32
	InvestmentsByType     map[v1.InvestmentType]*TypeSummary
}

// TypeSummary represents summary statistics for a specific investment type.
type TypeSummary struct {
	TotalValue int64
	Count      int32
}
