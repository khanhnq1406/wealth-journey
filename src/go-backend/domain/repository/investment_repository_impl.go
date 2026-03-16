package repository

import (
	"context"
	"errors"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
	apperrors "wealthjourney/pkg/errors"

	v1 "wealthjourney/protobuf/v1"

	"gorm.io/gorm"
)

// investmentRepository implements InvestmentRepository using GORM.
type investmentRepository struct {
	*BaseRepository
}

// NewInvestmentRepository creates a new InvestmentRepository.
func NewInvestmentRepository(db *database.Database) InvestmentRepository {
	return &investmentRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// Create creates a new investment.
func (r *investmentRepository) Create(ctx context.Context, investment *models.Investment) error {
	result := r.db.DB.WithContext(ctx).Create(investment)
	if result.Error != nil {
		return r.handleDBError(result.Error, "investment", "create investment")
	}
	return nil
}

// GetByID retrieves an investment by ID.
func (r *investmentRepository) GetByID(ctx context.Context, id int32) (*models.Investment, error) {
	var investment models.Investment
	err := r.executeGetByID(ctx, &investment, id, "investment")
	if err != nil {
		return nil, err
	}
	return &investment, nil
}

// GetByIDForUser retrieves an investment by ID, ensuring it belongs to the user's wallet.
func (r *investmentRepository) GetByIDForUser(ctx context.Context, investmentID, userID int32) (*models.Investment, error) {
	var investment models.Investment
	result := r.db.DB.WithContext(ctx).
		Joins("JOIN wallet ON wallet.id = investment.wallet_id").
		Where("investment.id = ? AND wallet.user_id = ?", investmentID, userID).
		First(&investment)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "investment", "get investment")
	}
	return &investment, nil
}

// GetByWalletAndSymbol retrieves an investment by wallet and symbol.
// Returns nil if not found (no error).
func (r *investmentRepository) GetByWalletAndSymbol(ctx context.Context, walletID int32, symbol string) (*models.Investment, error) {
	var investment models.Investment
	result := r.db.DB.WithContext(ctx).
		Where("wallet_id = ? AND symbol = ?", walletID, symbol).
		First(&investment)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, nil // Not found is not an error for this method
		}
		return nil, r.handleDBError(result.Error, "investment", "get investment by wallet and symbol")
	}
	return &investment, nil
}

// ListByUserID retrieves all investments for a user (via their wallets).
func (r *investmentRepository) ListByUserID(ctx context.Context, userID int32, opts ListOptions, typeFilter v1.InvestmentType) ([]*models.Investment, int, error) {
	// First, get all active wallet IDs for the user (any type can hold investments)
	var walletIDs []int32
	err := r.db.DB.WithContext(ctx).
		Model(&models.Wallet{}).
		Where("user_id = ? AND status = 1", userID).
		Pluck("id", &walletIDs).Error
	if err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to get user wallets", err)
	}

	// If no wallets, return empty result
	if len(walletIDs) == 0 {
		return []*models.Investment{}, 0, nil
	}

	// Build base query
	query := r.db.DB.WithContext(ctx).Model(&models.Investment{}).Where("wallet_id IN ?", walletIDs)

	// Apply type filter if specified
	if typeFilter != v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED && typeFilter != 0 {
		query = query.Where("type = ?", int32(typeFilter))
	}

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to count investments", err)
	}

	// Build query with pagination
	orderClause := r.buildOrderClause(opts)
	query = query.Order(orderClause)
	query = r.applyPagination(query, opts)

	// Execute query
	var investments []*models.Investment
	err = query.Find(&investments).Error
	if err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to list investments", err)
	}

	return investments, int(total), nil
}

// ListByWalletID retrieves all investments in a wallet.
func (r *investmentRepository) ListByWalletID(ctx context.Context, walletID int32, opts ListOptions, typeFilter v1.InvestmentType) ([]*models.Investment, int, error) {
	// Build base query
	query := r.db.DB.WithContext(ctx).Model(&models.Investment{}).Where("wallet_id = ?", walletID)

	// Apply type filter if specified (0 is unspecified, so we don't filter on it)
	if typeFilter != v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED && typeFilter != 0 {
		query = query.Where("type = ?", int32(typeFilter))
	}

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to count investments", err)
	}

	// Apply ordering and pagination
	orderClause := r.buildOrderClause(opts)
	query = query.Order(orderClause)
	query = r.applyPagination(query, opts)

	// Execute query
	var investments []*models.Investment
	if err := query.Find(&investments).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to list investments", err)
	}

	return investments, int(total), nil
}

// Update updates an investment.
func (r *investmentRepository) Update(ctx context.Context, investment *models.Investment) error {
	// Use Select to specify which fields to update, avoiding enum serialization issues
	// Include all updatable fields except the Type enum which causes serialization errors
	result := r.db.DB.WithContext(ctx).Select(
		"symbol",
		"name",
		"quantity",
		"average_cost",
		"total_cost",
		"currency",
		"current_price",
		"current_value",
		"unrealized_pnl",
		"unrealized_pnl_percent",
		"realized_pnl",
		"total_dividends",
	).Save(investment)
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to update investment", result.Error)
	}
	return nil
}

// Delete soft deletes an investment by ID.
func (r *investmentRepository) Delete(ctx context.Context, id int32) error {
	return r.executeDelete(ctx, &models.Investment{}, id, "investment")
}

// UpdatePrices updates current prices for multiple investments.
// This method fetches each investment, updates its current_price, and saves it
// to ensure GORM hooks (BeforeUpdate) are triggered for recalculating
// current_value, unrealized_pnl, and unrealized_pnl_percent.
func (r *investmentRepository) UpdatePrices(ctx context.Context, updates []PriceUpdate) error {
	if len(updates) == 0 {
		return nil
	}

	// Use a transaction for batch updates
	err := r.db.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, update := range updates {
			// Fetch the investment first
			var investment models.Investment
			if err := tx.Where("id = ?", update.InvestmentID).First(&investment).Error; err != nil {
				return apperrors.NewInternalErrorWithCause("failed to fetch investment", err)
			}

			// Update the current_price field
			investment.CurrentPrice = update.Price

			// Manually trigger recalculation to set derived fields
			investment.Recalculate()

			// Update only the specific fields we need to change (avoid enum serialization)
			if err := tx.Model(&models.Investment{}).
				Where("id = ?", update.InvestmentID).
				Updates(map[string]interface{}{
					"current_price":          investment.CurrentPrice,
					"current_value":          investment.CurrentValue,
					"unrealized_pnl":         investment.UnrealizedPNL,
					"unrealized_pnl_percent": investment.UnrealizedPNLPercent,
				}).Error; err != nil {
				return apperrors.NewInternalErrorWithCause("failed to update investment price", err)
			}
		}
		return nil
	})

	if err != nil {
		return err
	}

	return nil
}

// GetPortfolioSummary calculates summary stats for a wallet.
func (r *investmentRepository) GetPortfolioSummary(ctx context.Context, walletID int32) (*PortfolioSummary, error) {
	// Get all investments for the wallet
	investments, _, err := r.ListByWalletID(ctx, walletID, ListOptions{}, v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED)
	if err != nil {
		return nil, err
	}

	// Initialize summary
	summary := &PortfolioSummary{
		TotalValue:        0,
		TotalCost:         0,
		TotalPNL:          0,
		TotalPNLPercent:   0,
		RealizedPNL:       0,
		UnrealizedPNL:     0,
		TotalInvestments:  int32(len(investments)),
		InvestmentsByType: make(map[v1.InvestmentType]*TypeSummary),
	}

	// Handle empty portfolio
	if len(investments) == 0 {
		return summary, nil
	}

	// Calculate totals by iterating through investments
	for _, inv := range investments {
		summary.TotalValue += inv.CurrentValue
		summary.TotalCost += inv.TotalCost
		summary.UnrealizedPNL += inv.UnrealizedPNL
		summary.RealizedPNL += inv.RealizedPNL

		// Update type-specific totals
		typeEnum := v1.InvestmentType(inv.Type)
		if _, exists := summary.InvestmentsByType[typeEnum]; !exists {
			summary.InvestmentsByType[typeEnum] = &TypeSummary{
				TotalValue: 0,
				Count:      0,
			}
		}
		summary.InvestmentsByType[typeEnum].TotalValue += inv.CurrentValue
		summary.InvestmentsByType[typeEnum].Count++
	}

	// Calculate total PNL
	summary.TotalPNL = summary.UnrealizedPNL + summary.RealizedPNL

	// Calculate total PNL percent
	if summary.TotalCost > 0 {
		summary.TotalPNLPercent = (float64(summary.TotalPNL) / float64(summary.TotalCost)) * 100
	}

	return summary, nil
}

// GetAggregatedPortfolioSummary calculates summary stats across all user's investment wallets.
func (r *investmentRepository) GetAggregatedPortfolioSummary(ctx context.Context, userID int32, typeFilter v1.InvestmentType) (*PortfolioSummary, error) {
	// Get all investments for the user across all investment wallets
	investments, _, err := r.ListByUserID(ctx, userID, ListOptions{
		Limit:  10000, // Large enough to get all investments
		Offset: 0,
	}, typeFilter)
	if err != nil {
		return nil, err
	}

	// Initialize summary
	summary := &PortfolioSummary{
		TotalValue:        0,
		TotalCost:         0,
		TotalPNL:          0,
		TotalPNLPercent:   0,
		RealizedPNL:       0,
		UnrealizedPNL:     0,
		TotalInvestments:  int32(len(investments)),
		InvestmentsByType: make(map[v1.InvestmentType]*TypeSummary),
	}

	// Handle empty portfolio
	if len(investments) == 0 {
		return summary, nil
	}

	// Calculate totals by iterating through investments
	for _, inv := range investments {
		summary.TotalValue += inv.CurrentValue
		summary.TotalCost += inv.TotalCost
		summary.UnrealizedPNL += inv.UnrealizedPNL
		summary.RealizedPNL += inv.RealizedPNL

		// Update type-specific totals
		typeEnum := v1.InvestmentType(inv.Type)
		if _, exists := summary.InvestmentsByType[typeEnum]; !exists {
			summary.InvestmentsByType[typeEnum] = &TypeSummary{
				TotalValue: 0,
				Count:      0,
			}
		}
		summary.InvestmentsByType[typeEnum].TotalValue += inv.CurrentValue
		summary.InvestmentsByType[typeEnum].Count++
	}

	// Calculate total PNL
	summary.TotalPNL = summary.UnrealizedPNL + summary.RealizedPNL

	// Calculate total PNL percent
	if summary.TotalCost > 0 {
		summary.TotalPNLPercent = (float64(summary.TotalPNL) / float64(summary.TotalCost)) * 100
	}

	return summary, nil
}

// GetInvestmentValue aggregates total current value of all investments in a wallet.
//
// IMPORTANT: We simply SUM the stored current_value field, which is auto-maintained by GORM hooks.
// The Investment model's BeforeCreate and BeforeUpdate hooks call recalculate() which updates:
//   CurrentValue = (Quantity / divisor) * CurrentPrice
//
// This means we don't need to recalculate on every query - just SUM the pre-calculated values.
func (r *investmentRepository) GetInvestmentValue(ctx context.Context, walletID int32) (int64, error) {
	var totalValue int64

	// Simple SUM query - current_value is already calculated and stored
	err := r.db.DB.WithContext(ctx).
		Model(&models.Investment{}).
		Where("wallet_id = ? AND deleted_at IS NULL", walletID).
		Select("COALESCE(SUM(current_value), 0)").
		Scan(&totalValue).Error

	if err != nil {
		return 0, r.handleDBError(err, "investment", "get investment value")
	}

	return totalValue, nil
}

// GetInvestmentValuesByWalletIDs batch fetches investment values for multiple wallets.
// Uses a single GROUP BY query for efficiency.
func (r *investmentRepository) GetInvestmentValuesByWalletIDs(ctx context.Context, walletIDs []int32) (map[int32]int64, error) {
	if len(walletIDs) == 0 {
		return make(map[int32]int64), nil
	}

	type Result struct {
		WalletID int32
		Total    int64
	}

	var results []Result
	err := r.db.DB.WithContext(ctx).
		Model(&models.Investment{}).
		Where("wallet_id IN ? AND deleted_at IS NULL", walletIDs).
		Select("wallet_id, COALESCE(SUM(current_value), 0) as total").
		Group("wallet_id").
		Scan(&results).Error

	if err != nil {
		return nil, r.handleDBError(err, "investment", "get investment values")
	}

	// Convert to map
	valueMap := make(map[int32]int64, len(walletIDs))
	for _, r := range results {
		valueMap[r.WalletID] = r.Total
	}

	// Ensure all requested wallets have an entry (0 if no investments)
	for _, walletID := range walletIDs {
		if _, exists := valueMap[walletID]; !exists {
			valueMap[walletID] = 0
		}
	}

	return valueMap, nil
}
