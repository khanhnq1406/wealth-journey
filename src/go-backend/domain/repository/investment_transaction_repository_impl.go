package repository

import (
	"context"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
	apperrors "wealthjourney/pkg/errors"
	investmentv1 "wealthjourney/protobuf/v1"
)

// investmentTransactionRepository implements InvestmentTransactionRepository using GORM.
type investmentTransactionRepository struct {
	*BaseRepository
}

// NewInvestmentTransactionRepository creates a new InvestmentTransactionRepository.
func NewInvestmentTransactionRepository(db *database.Database) InvestmentTransactionRepository {
	return &investmentTransactionRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// Create creates a new investment transaction.
func (r *investmentTransactionRepository) Create(ctx context.Context, tx *models.InvestmentTransaction) error {
	result := r.db.DB.WithContext(ctx).Create(tx)
	if result.Error != nil {
		return r.handleDBError(result.Error, "investment transaction", "create investment transaction")
	}
	return nil
}

// GetByID retrieves an investment transaction by ID.
func (r *investmentTransactionRepository) GetByID(ctx context.Context, id int32) (*models.InvestmentTransaction, error) {
	var tx models.InvestmentTransaction
	err := r.executeGetByID(ctx, &tx, id, "investment transaction")
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

// GetByIDForUser retrieves an investment transaction by ID, ensuring it belongs to the user's investment.
func (r *investmentTransactionRepository) GetByIDForUser(ctx context.Context, txID, userID int32) (*models.InvestmentTransaction, error) {
	var tx models.InvestmentTransaction
	result := r.db.DB.WithContext(ctx).
		Joins("JOIN investment ON investment_transaction.investment_id = investment.id").
		Where("investment_transaction.id = ? AND investment.user_id = ?", txID, userID).
		First(&tx)

	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "investment transaction", "get investment transaction")
	}
	return &tx, nil
}

// ListByInvestmentID retrieves all transactions for an investment with pagination.
func (r *investmentTransactionRepository) ListByInvestmentID(ctx context.Context, investmentID int32, typeFilter *investmentv1.InvestmentTransactionType, opts ListOptions) ([]*models.InvestmentTransaction, int, error) {
	var transactions []*models.InvestmentTransaction
	var total int64

	// Build base query
	query := r.db.DB.WithContext(ctx).Model(&models.InvestmentTransaction{}).Where("investment_id = ?", investmentID)

	// Apply type filter if specified
	if typeFilter != nil {
		query = query.Where("type = ?", int32(*typeFilter))
	}

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to count investment transactions", err)
	}

	// Build order clause
	orderClause := r.buildOrderClause(opts)
	query = query.Order(orderClause)

	// Apply pagination
	query = r.applyPagination(query, opts)

	// Execute query
	result := query.Find(&transactions)
	if result.Error != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to list investment transactions", result.Error)
	}

	return transactions, int(total), nil
}

// Update updates an investment transaction.
func (r *investmentTransactionRepository) Update(ctx context.Context, tx *models.InvestmentTransaction) error {
	return r.executeUpdate(ctx, tx, "investment transaction")
}

// Delete soft deletes an investment transaction by ID.
func (r *investmentTransactionRepository) Delete(ctx context.Context, id int32) error {
	return r.executeDelete(ctx, &models.InvestmentTransaction{}, id, "investment transaction")
}

// GetOpenLots retrieves all open lots for an investment (remaining_quantity > 0), ordered by purchased_at ASC (FIFO).
func (r *investmentTransactionRepository) GetOpenLots(ctx context.Context, investmentID int32) ([]*models.InvestmentLot, error) {
	var lots []*models.InvestmentLot
	result := r.db.DB.WithContext(ctx).
		Where("investment_id = ? AND remaining_quantity > 0", investmentID).
		Order("purchased_at ASC").
		Find(&lots)

	if result.Error != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to get open lots", result.Error)
	}

	return lots, nil
}

// CreateLot creates a new investment lot.
func (r *investmentTransactionRepository) CreateLot(ctx context.Context, lot *models.InvestmentLot) error {
	result := r.db.DB.WithContext(ctx).Create(lot)
	if result.Error != nil {
		return r.handleDBError(result.Error, "investment lot", "create investment lot")
	}
	return nil
}

// UpdateLot updates an investment lot.
func (r *investmentTransactionRepository) UpdateLot(ctx context.Context, lot *models.InvestmentLot) error {
	result := r.db.DB.WithContext(ctx).Save(lot)
	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to update investment lot", result.Error)
	}
	return nil
}

// GetLotByID retrieves a lot by ID.
func (r *investmentTransactionRepository) GetLotByID(ctx context.Context, lotID int32) (*models.InvestmentLot, error) {
	var lot models.InvestmentLot
	err := r.executeGetByID(ctx, &lot, lotID, "investment lot")
	if err != nil {
		return nil, err
	}
	return &lot, nil
}

// GetLotByIDForInvestment retrieves a lot by ID, ensuring it belongs to the investment.
func (r *investmentTransactionRepository) GetLotByIDForInvestment(ctx context.Context, lotID, investmentID int32) (*models.InvestmentLot, error) {
	var lot models.InvestmentLot
	result := r.db.DB.WithContext(ctx).
		Where("id = ? AND investment_id = ?", lotID, investmentID).
		First(&lot)

	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "investment lot", "get investment lot")
	}
	return &lot, nil
}

// DeleteByInvestmentID soft deletes all transactions for an investment.
func (r *investmentTransactionRepository) DeleteByInvestmentID(ctx context.Context, investmentID int32) error {
	result := r.db.DB.WithContext(ctx).
		Where("investment_id = ?", investmentID).
		Delete(&models.InvestmentTransaction{})

	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to delete investment transactions", result.Error)
	}
	return nil
}

// DeleteLotsByInvestmentID soft deletes all lots for an investment.
func (r *investmentTransactionRepository) DeleteLotsByInvestmentID(ctx context.Context, investmentID int32) error {
	result := r.db.DB.WithContext(ctx).
		Where("investment_id = ?", investmentID).
		Delete(&models.InvestmentLot{})

	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to delete investment lots", result.Error)
	}
	return nil
}
