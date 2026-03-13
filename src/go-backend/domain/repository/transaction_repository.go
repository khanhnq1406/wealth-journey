package repository

import (
	"context"
	"errors"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
	apperrors "wealthjourney/pkg/errors"

	v1 "wealthjourney/protobuf/v1"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// transactionRepository implements TransactionRepository using GORM.
type transactionRepository struct {
	*BaseRepository
}

// NewTransactionRepository creates a new TransactionRepository.
func NewTransactionRepository(db *database.Database) TransactionRepository {
	return &transactionRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// Create creates a new transaction.
func (r *transactionRepository) Create(ctx context.Context, tx *models.Transaction) error {
	result := r.db.DB.WithContext(ctx).Create(tx)
	if result.Error != nil {
		return r.handleDBError(result.Error, "transaction", "create transaction")
	}
	return nil
}

// GetByID retrieves a transaction by ID.
func (r *transactionRepository) GetByID(ctx context.Context, id int32) (*models.Transaction, error) {
	var transaction models.Transaction
	err := r.executeGetByID(ctx, &transaction, id, "transaction")
	if err != nil {
		return nil, err
	}
	return &transaction, nil
}

// GetByIDForUser retrieves a transaction by ID, ensuring it belongs to the user's wallet.
func (r *transactionRepository) GetByIDForUser(ctx context.Context, txID, userID int32) (*models.Transaction, error) {
	var transaction models.Transaction
	result := r.db.DB.WithContext(ctx).
		Joins("JOIN wallet ON wallet.id = transaction.wallet_id").
		Where("transaction.id = ? AND wallet.user_id = ?", txID, userID).
		First(&transaction)

	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "transaction", "get transaction")
	}
	return &transaction, nil
}

// GetWithWallet retrieves a transaction with its wallet relationship.
func (r *transactionRepository) GetWithWallet(ctx context.Context, id int32) (*models.Transaction, error) {
	var transaction models.Transaction
	result := r.db.DB.WithContext(ctx).
		Preload("Wallet").
		Preload("Category").
		First(&transaction, id)

	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "transaction", "get transaction with wallet")
	}
	return &transaction, nil
}

// Update updates a transaction.
func (r *transactionRepository) Update(ctx context.Context, tx *models.Transaction) error {
	return r.executeUpdate(ctx, tx, "transaction")
}

// Delete soft deletes a transaction by ID.
func (r *transactionRepository) Delete(ctx context.Context, id int32) error {
	return r.executeDelete(ctx, &models.Transaction{}, id, "transaction")
}

// DeleteWithTx deletes a transaction within a database transaction.
func (r *transactionRepository) DeleteWithTx(ctx context.Context, dbTx interface{}, id int32) error {
	tx, ok := dbTx.(*gorm.DB)
	if !ok {
		return apperrors.NewInternalErrorWithCause("invalid transaction type", nil)
	}

	result := tx.WithContext(ctx).
		Model(&models.Transaction{}).
		Where("id = ?", id).
		Update("deleted_at", time.Now())

	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to delete transaction", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NewNotFoundError("transaction")
	}
	return nil
}

// List retrieves transactions with filtering and pagination.
func (r *transactionRepository) List(ctx context.Context, userID int32, filter TransactionFilter, opts ListOptions) ([]*models.Transaction, int, error) {
	var transactions []*models.Transaction
	var total int64

	// Build the base query with wallet join for user ownership and active status
	query := r.db.DB.WithContext(ctx).
		Model(&models.Transaction{}).
		Joins("JOIN wallet ON wallet.id = transaction.wallet_id").
		Where("wallet.user_id = ? AND wallet.status = 1", userID)

	// Apply filters
	if len(filter.WalletIDs) > 0 {
		query = query.Where("transaction.wallet_id IN ?", filter.WalletIDs)
	} else if filter.WalletID != nil {
		query = query.Where("transaction.wallet_id = ?", *filter.WalletID)
	}

	if filter.CategoryID != nil {
		query = query.Where("transaction.category_id = ?", *filter.CategoryID)
	}

	if filter.Type != nil {
		// Filter by transaction type through category relationship
		var categoryType v1.CategoryType
		switch *filter.Type {
		case v1.TransactionType_TRANSACTION_TYPE_INCOME:
			categoryType = v1.CategoryType_CATEGORY_TYPE_INCOME
		case v1.TransactionType_TRANSACTION_TYPE_EXPENSE:
			categoryType = v1.CategoryType_CATEGORY_TYPE_EXPENSE
		default:
			categoryType = v1.CategoryType_CATEGORY_TYPE_UNSPECIFIED
		}

		if categoryType != v1.CategoryType_CATEGORY_TYPE_UNSPECIFIED {
			query = query.Joins("LEFT JOIN category ON category.id = transaction.category_id").
				Where("category.type = ?", int(categoryType))
		}
	}

	if filter.StartDate != nil {
		query = query.Where("transaction.date >= ?", *filter.StartDate)
	}

	if filter.EndDate != nil {
		query = query.Where("transaction.date <= ?", *filter.EndDate)
	}

	if filter.MinAmount != nil {
		query = query.Where("transaction.amount >= ?", *filter.MinAmount)
	}

	if filter.MaxAmount != nil {
		query = query.Where("transaction.amount <= ?", *filter.MaxAmount)
	}

	if filter.SearchNote != nil && *filter.SearchNote != "" {
		query = query.Where("transaction.note LIKE ?", "%"+*filter.SearchNote+"%")
	}

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to count transactions", err)
	}

	// Build order clause
	orderClause := r.buildOrderClause(opts)
	query = query.Order(orderClause)

	// Apply pagination
	query = r.applyPagination(query, opts)

	// Execute query with preloads
	result := query.
		Preload("Wallet").
		Preload("Category").
		Find(&transactions)

	if result.Error != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to list transactions", result.Error)
	}

	return transactions, int(total), nil
}

// ExecuteTransactionWithBalanceUpdate executes a function within a transaction,
// returning the updated wallet.
func (r *transactionRepository) ExecuteTransactionWithBalanceUpdate(ctx context.Context, walletID int32, balanceDelta int64, fn func(tx *gorm.DB) error) error {
	return r.db.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Lock the wallet row for update
		var wallet models.Wallet
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&wallet, walletID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return apperrors.NewNotFoundError("wallet")
			}
			return apperrors.NewInternalErrorWithCause("failed to get wallet", err)
		}

		// Calculate new balance
		newBalance := wallet.Balance + balanceDelta
		if newBalance < 0 {
			return apperrors.NewValidationError("Insufficient balance")
		}

		// Execute the provided function (e.g., create/update transaction)
		if err := fn(tx); err != nil {
			return err
		}

		// Update wallet balance
		if err := tx.Model(&wallet).Update("balance", newBalance).Error; err != nil {
			return apperrors.NewInternalErrorWithCause("failed to update wallet balance", err)
		}

		return nil
	})
}

// GetAvailableYears retrieves distinct years from user's transactions.
func (r *transactionRepository) GetAvailableYears(ctx context.Context, userID int32) ([]int32, error) {
	var years []int32

	query := r.db.DB.WithContext(ctx).
		Model(&models.Transaction{}).
		Joins("JOIN wallet ON wallet.id = transaction.wallet_id").
		Where("wallet.user_id = ? AND wallet.status = 1", userID).
		Select("DISTINCT EXTRACT(YEAR FROM transaction.date) as year").
		Order("year DESC")

	result := query.Pluck("year", &years)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "transaction", "get available years")
	}

	return years, nil
}

// CountByWalletID returns the number of transactions for a wallet.
func (r *transactionRepository) CountByWalletID(ctx context.Context, walletID int32) (int32, error) {
	var count int64
	result := r.db.DB.WithContext(ctx).
		Model(&models.Transaction{}).
		Where("wallet_id = ? AND deleted_at IS NULL", walletID).
		Count(&count)

	if result.Error != nil {
		return 0, apperrors.NewInternalErrorWithCause("failed to count transactions", result.Error)
	}

	return int32(count), nil
}

// GetSumAmounts returns the sum of all transaction amounts for a wallet (signed).
func (r *transactionRepository) GetSumAmounts(ctx context.Context, walletID int32) (int64, error) {
	var sum int64
	result := r.db.DB.WithContext(ctx).
		Model(&models.Transaction{}).
		Where("wallet_id = ? AND deleted_at IS NULL", walletID).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&sum)

	if result.Error != nil {
		return 0, apperrors.NewInternalErrorWithCause("failed to sum transaction amounts", result.Error)
	}

	return sum, nil
}

// TransferToWallet transfers all transactions from one wallet to another.
func (r *transactionRepository) TransferToWallet(ctx context.Context, fromWalletID, toWalletID int32) error {
	result := r.db.DB.WithContext(ctx).
		Model(&models.Transaction{}).
		Where("wallet_id = ? AND deleted_at IS NULL", fromWalletID).
		Update("wallet_id", toWalletID)

	if result.Error != nil {
		return apperrors.NewInternalErrorWithCause("failed to transfer transactions", result.Error)
	}

	return nil
}

// GetCategoryBreakdown retrieves category-wise transaction summary grouped by currency
func (r *transactionRepository) GetCategoryBreakdown(ctx context.Context, userID int32, filter TransactionFilter) ([]*CategoryBreakdownByCurrency, error) {
	query := r.db.DB.WithContext(ctx).Table("transaction t").
		Select(
			"t.category_id as category_id",
			"c.name as category_name",
			"c.type as type",
			"w.currency as currency",
			"COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) as income",
			"COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) as total",
			"COUNT(t.id) as transaction_count",
		).
		Joins("JOIN category c ON t.category_id = c.id").
		Joins("JOIN wallet w ON w.id = t.wallet_id").
		Where("w.user_id = ? AND w.status = 1 AND t.deleted_at IS NULL", userID)

	// Apply wallet filter with clear precedence
	if len(filter.WalletIDs) > 0 {
		// Use WalletIDs array if provided
		query = query.Where("t.wallet_id IN ?", filter.WalletIDs)
	} else if filter.WalletID != nil {
		// Fall back to single WalletID if WalletIDs is not provided
		query = query.Where("t.wallet_id = ?", *filter.WalletID)
	}
	if filter.StartDate != nil {
		query = query.Where("t.date >= ?", *filter.StartDate)
	}
	if filter.EndDate != nil {
		query = query.Where("t.date <= ?", *filter.EndDate)
	}

	// Filter by category type if specified
	if filter.Type != nil {
		var categoryType int32
		switch *filter.Type {
		case v1.TransactionType_TRANSACTION_TYPE_INCOME:
			categoryType = int32(v1.CategoryType_CATEGORY_TYPE_INCOME)
		case v1.TransactionType_TRANSACTION_TYPE_EXPENSE:
			categoryType = int32(v1.CategoryType_CATEGORY_TYPE_EXPENSE)
		default:
			categoryType = 0
		}
		if categoryType != 0 {
			query = query.Where("c.type = ?", categoryType)
		}
	}

	// Group by category and currency to aggregate per-currency amounts
	query = query.Group("t.category_id, c.name, c.type, w.currency")

	rows, err := query.Rows()
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to get category breakdown", err)
	}
	defer func() { _ = rows.Close() }()

	// First, collect all raw breakdown items
	type rawBreakdownItem struct {
		CategoryID       int32
		CategoryName     string
		Type             int32
		Currency         string
		Income           int64
		Total            int64
		TransactionCount int32
	}

	var rawItems []rawBreakdownItem
	for rows.Next() {
		var item rawBreakdownItem
		if err := rows.Scan(&item.CategoryID, &item.CategoryName, &item.Type, &item.Currency, &item.Income, &item.Total, &item.TransactionCount); err != nil {
			return nil, apperrors.NewInternalErrorWithCause("failed to scan category breakdown", err)
		}
		rawItems = append(rawItems, item)
	}

	if err := rows.Err(); err != nil {
		return nil, apperrors.NewInternalErrorWithCause("error iterating category breakdown", err)
	}

	// Aggregate by category, combining multiple currencies into a map
	categoryMap := make(map[int32]*CategoryBreakdownByCurrency)
	for _, raw := range rawItems {
		if existing, ok := categoryMap[raw.CategoryID]; ok {
			// Add to existing category's currency map
			if existing.AmountsByCurrency == nil {
				existing.AmountsByCurrency = make(map[string]int64)
			}
			// Determine the amount based on category type
			amount := raw.Total
			if raw.Type == int32(v1.CategoryType_CATEGORY_TYPE_INCOME) {
				amount = raw.Income
			}
			existing.AmountsByCurrency[raw.Currency] += amount
			existing.TransactionCount += raw.TransactionCount
		} else {
			// Create new category entry
			amount := raw.Total
			if raw.Type == int32(v1.CategoryType_CATEGORY_TYPE_INCOME) {
				amount = raw.Income
			}
			categoryMap[raw.CategoryID] = &CategoryBreakdownByCurrency{
				CategoryID:        raw.CategoryID,
				CategoryName:      raw.CategoryName,
				Type:              raw.Type,
				AmountsByCurrency: map[string]int64{raw.Currency: amount},
				TransactionCount:  raw.TransactionCount,
			}
		}
	}

	// Convert map to slice
	results := make([]*CategoryBreakdownByCurrency, 0, len(categoryMap))
	for _, item := range categoryMap {
		results = append(results, item)
	}

	return results, nil
}

// BulkCreate creates multiple transactions atomically with wallet balance updates
func (r *transactionRepository) BulkCreate(ctx context.Context, transactions []*models.Transaction) ([]int32, error) {
	// Start database transaction
	tx := r.db.DB.WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Group transactions by wallet for balance updates
	walletDeltas := make(map[int32]int64)
	for _, t := range transactions {
		walletDeltas[t.WalletID] += t.Amount
	}

	// Lock wallets and validate balances
	for walletID, delta := range walletDeltas {
		var wallet models.Wallet
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", walletID).
			First(&wallet).Error; err != nil {
			tx.Rollback()
			return nil, apperrors.NewInternalErrorWithCause("failed to lock wallet", err)
		}

		newBalance := wallet.Balance + delta
		if newBalance < 0 {
			tx.Rollback()
			return nil, apperrors.NewValidationError("Insufficient balance in wallet")
		}
	}

	// Insert transactions in batches
	const batchSize = 100
	var createdIDs []int32

	for i := 0; i < len(transactions); i += batchSize {
		end := i + batchSize
		if end > len(transactions) {
			end = len(transactions)
		}

		batch := transactions[i:end]
		if err := tx.CreateInBatches(batch, batchSize).Error; err != nil {
			tx.Rollback()
			return nil, apperrors.NewInternalErrorWithCause("failed to create transaction batch", err)
		}

		for _, t := range batch {
			createdIDs = append(createdIDs, t.ID)
		}
	}

	// Update wallet balances
	for walletID, delta := range walletDeltas {
		if err := tx.Model(&models.Wallet{}).
			Where("id = ?", walletID).
			Update("balance", gorm.Expr("balance + ?", delta)).Error; err != nil {
			tx.Rollback()
			return nil, apperrors.NewInternalErrorWithCause("failed to update wallet balance", err)
		}
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to commit transaction", err)
	}

	return createdIDs, nil
}

// FindByWalletAndDateRange retrieves transactions for a wallet within a date range.
// Uses composite index (wallet_id, date, amount) for optimal performance.
func (r *transactionRepository) FindByWalletAndDateRange(ctx context.Context, walletID int32, startDate, endDate time.Time) ([]*models.Transaction, error) {
	var transactions []*models.Transaction

	result := r.db.DB.WithContext(ctx).
		Where("wallet_id = ? AND date >= ? AND date <= ? AND deleted_at IS NULL",
			walletID, startDate, endDate).
		Find(&transactions)

	if result.Error != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to find transactions by date range", result.Error)
	}

	return transactions, nil
}

// FindByExternalID retrieves a transaction by its external reference ID.
// Uses composite index (wallet_id, external_id) for optimal performance.
func (r *transactionRepository) FindByExternalID(ctx context.Context, walletID int32, externalID string) (*models.Transaction, error) {
	var transaction models.Transaction

	result := r.db.DB.WithContext(ctx).
		Where("wallet_id = ? AND external_id = ? AND deleted_at IS NULL",
			walletID, externalID).
		First(&transaction)

	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, nil // Not found is not an error for duplicate detection
		}
		return nil, apperrors.NewInternalErrorWithCause("failed to find transaction by external ID", result.Error)
	}

	return &transaction, nil
}
