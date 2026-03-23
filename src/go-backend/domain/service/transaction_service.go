package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/types"

	v1 "wealthjourney/protobuf/v1"
)

// transactionService implements TransactionService.
type transactionService struct {
	txRepo       repository.TransactionRepository
	walletRepo   repository.WalletRepository
	categoryRepo repository.CategoryRepository
	userRepo     repository.UserRepository
	fxRateSvc    FXRateService
	currencyCache *cache.CurrencyCache
}

// NewTransactionService creates a new TransactionService.
func NewTransactionService(
	txRepo repository.TransactionRepository,
	walletRepo repository.WalletRepository,
	categoryRepo repository.CategoryRepository,
	userRepo repository.UserRepository,
	fxRateSvc FXRateService,
	currencyCache *cache.CurrencyCache,
) TransactionService {
	return &transactionService{
		txRepo:        txRepo,
		walletRepo:    walletRepo,
		categoryRepo:  categoryRepo,
		userRepo:      userRepo,
		fxRateSvc:     fxRateSvc,
		currencyCache: currencyCache,
	}
}

// CreateTransaction creates a new transaction and updates wallet balance.
func (s *transactionService) CreateTransaction(ctx context.Context, userID int32, req *v1.CreateTransactionRequest) (*v1.CreateTransactionResponse, error) {
	// Validate amount is provided
	if req.Amount == nil {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.TransactionAmountRequired, "amount is required")
	}

	// Validate wallet belongs to user
	wallet, err := s.walletRepo.GetByIDForUser(ctx, req.WalletId, userID)
	if err != nil {
		return nil, err
	}

	// Validate category if provided
	var category *models.Category
	if req.CategoryId != nil {
		category, err = s.categoryRepo.GetByIDForUser(ctx, *req.CategoryId, userID)
		if err != nil {
			return nil, err
		}
	}

	// Calculate balance delta based on category type
	balanceDelta := s.calculateBalanceDelta(req.Amount.Amount, category)

	// Check if balance would go negative
	newBalance := wallet.Balance + balanceDelta
	if newBalance < 0 {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.TransactionInsufficientBalance, "Insufficient balance for this transaction")
	}

	// Create transaction
	transaction := &models.Transaction{
		WalletID: req.WalletId,
		Amount:   req.Amount.Amount,
	}

	if req.CategoryId != nil {
		transaction.CategoryID = req.CategoryId
	}

	if req.Note != nil {
		transaction.Note = *req.Note
	}

	if req.Date != nil && *req.Date > 0 {
		transaction.Date = time.Unix(*req.Date, 0)
	} else {
		transaction.Date = time.Now()
	}

	// Use transaction to create transaction record and update wallet balance atomically
	err = s.txRepo.Create(ctx, transaction)
	if err != nil {
		return nil, err
	}

	// Update wallet balance
	_, err = s.walletRepo.UpdateBalance(ctx, req.WalletId, balanceDelta)
	if err != nil {
		return nil, err
	}

	// Get updated wallet for response
	updatedWallet, _ := s.walletRepo.GetByID(ctx, req.WalletId)

	// Populate currency cache
	if err := s.populateTransactionCache(ctx, userID, transaction, updatedWallet.Currency); err != nil {
		// Log error but don't fail - cache population is not critical
		slog.Warn("Failed to populate currency cache",
			"transaction_id", transaction.ID,
			"user_id", userID,
			"error", err)
	}

	txProto := s.modelToProto(transaction, updatedWallet, category)
	// Enrich with conversion fields
	s.enrichTransactionProto(ctx, userID, txProto, transaction, updatedWallet.Currency)

	return &v1.CreateTransactionResponse{
		Success: true,
		Message: "Transaction created successfully",
		Data:    txProto,
		NewBalance: &v1.Money{
			Amount:   updatedWallet.Balance,
			Currency: updatedWallet.Currency,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetTransaction retrieves a transaction by ID.
func (s *transactionService) GetTransaction(ctx context.Context, transactionID int32, userID int32) (*v1.GetTransactionResponse, error) {
	transaction, err := s.txRepo.GetByIDForUser(ctx, transactionID, userID)
	if err != nil {
		return nil, err
	}

	// Load relationships
	wallet, _ := s.walletRepo.GetByID(ctx, transaction.WalletID)
	var category *models.Category
	if transaction.CategoryID != nil {
		category, _ = s.categoryRepo.GetByID(ctx, *transaction.CategoryID)
	}

	txProto := s.modelToProto(transaction, wallet, category)
	// Enrich with conversion fields
	s.enrichTransactionProto(ctx, userID, txProto, transaction, wallet.Currency)

	return &v1.GetTransactionResponse{
		Success:   true,
		Message:   "Transaction retrieved successfully",
		Data:      txProto,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ListTransactions retrieves transactions with filtering and pagination.
func (s *transactionService) ListTransactions(ctx context.Context, userID int32, req *v1.ListTransactionsRequest) (*v1.ListTransactionsResponse, error) {
	// Parse pagination params
	params := s.parsePaginationParams(req.Pagination)

	// Build filter from request
	filter := s.buildFilter(req.Filter)

	// Get transactions
	transactions, total, err := s.txRepo.List(ctx, userID, filter, repository.ListOptions{
		Limit:   params.PageSize,
		Offset:  (params.Page - 1) * params.PageSize,
		OrderBy: string(req.SortField),
		Order:   req.SortOrder,
	})
	if err != nil {
		return nil, err
	}

	// Convert to protobuf
	protoTransactions := make([]*v1.Transaction, len(transactions))
	walletCurrencies := make([]string, len(transactions))

	for i, tx := range transactions {
		protoTransactions[i] = s.modelToProtoSimple(tx)
		// Try to get wallet currency for enrichment (non-blocking)
		if wallet, err := s.walletRepo.GetByID(ctx, tx.WalletID); err == nil && wallet != nil {
			walletCurrencies[i] = wallet.Currency
		}
	}

	// Enrich with conversion fields where we have wallet currency data
	s.enrichTransactionSliceProto(ctx, userID, protoTransactions, transactions, walletCurrencies)

	// Build pagination result
	totalPages := int32(total) / int32(params.PageSize)
	if int32(total)%int32(params.PageSize) > 0 {
		totalPages++
	}

	return &v1.ListTransactionsResponse{
		Success:      true,
		Message:      "Transactions retrieved successfully",
		Transactions: protoTransactions,
		Pagination: &v1.PaginationResult{
			Page:       int32(params.Page),
			PageSize:   int32(params.PageSize),
			TotalCount: int32(total),
			TotalPages: totalPages,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// UpdateTransaction updates a transaction and adjusts wallet balance.
func (s *transactionService) UpdateTransaction(ctx context.Context, transactionID int32, userID int32, req *v1.UpdateTransactionRequest) (*v1.UpdateTransactionResponse, error) {
	// Validate amount is provided
	if req.Amount == nil {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.TransactionAmountRequired, "amount is required")
	}

	// Get existing transaction
	oldTransaction, err := s.txRepo.GetByIDForUser(ctx, transactionID, userID)
	if err != nil {
		return nil, err
	}

	// Determine which wallet to use (new wallet from request or existing)
	targetWalletID := oldTransaction.WalletID
	if req.WalletId != nil {
		// Validate new wallet belongs to user
		newWallet, err := s.walletRepo.GetByIDForUser(ctx, *req.WalletId, userID)
		if err != nil {
			return nil, err
		}
		targetWalletID = newWallet.ID
	}

	// Get target wallet
	wallet, err := s.walletRepo.GetByID(ctx, targetWalletID)
	if err != nil {
		return nil, err
	}

	// Determine category to use
	var category *models.Category
	if req.CategoryId != nil {
		category, err = s.categoryRepo.GetByIDForUser(ctx, *req.CategoryId, userID)
		if err != nil {
			return nil, err
		}
	} else if oldTransaction.CategoryID != nil {
		// Keep existing category
		category, _ = s.categoryRepo.GetByID(ctx, *oldTransaction.CategoryID)
	}

	// Handle wallet change if needed
	if req.WalletId != nil && *req.WalletId != oldTransaction.WalletID {
		// Revert old transaction's effect on old wallet
		oldBalanceDelta := s.calculateBalanceDelta(oldTransaction.Amount, category)

		// Apply new transaction's effect on new wallet
		newBalanceDelta := s.calculateBalanceDelta(req.Amount.Amount, category)

		// Check if new wallet would have sufficient balance
		newWalletBalance := wallet.Balance + newBalanceDelta
		if newWalletBalance < 0 {
			return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.TransactionTargetInsufficient, "Insufficient balance in target wallet")
		}

		// Update both wallets
		_, err = s.walletRepo.UpdateBalance(ctx, oldTransaction.WalletID, -oldBalanceDelta)
		if err != nil {
			return nil, err
		}
		_, err = s.walletRepo.UpdateBalance(ctx, targetWalletID, newBalanceDelta)
		if err != nil {
			return nil, err
		}
	} else {
		// No wallet change, just calculate delta for same wallet
		oldBalanceDelta := s.calculateBalanceDelta(oldTransaction.Amount, category)
		newBalanceDelta := s.calculateBalanceDelta(req.Amount.Amount, category)
		totalDelta := newBalanceDelta - oldBalanceDelta

		// Check if balance would go negative
		newBalance := wallet.Balance + totalDelta
		if newBalance < 0 {
			return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.TransactionUpdateInsufficient, "Insufficient balance for this transaction update")
		}

		// Update wallet balance
		_, err = s.walletRepo.UpdateBalance(ctx, targetWalletID, totalDelta)
		if err != nil {
			return nil, err
		}
	}

	// Update transaction fields
	updates := &models.Transaction{
		ID:       transactionID,
		WalletID: targetWalletID,
		Amount:   req.Amount.Amount,
	}
	if req.CategoryId != nil {
		updates.CategoryID = req.CategoryId
	}
	if req.Date != nil {
		updates.Date = time.Unix(*req.Date, 0)
	}
	if req.Note != nil {
		updates.Note = *req.Note
	}

	err = s.txRepo.Update(ctx, updates)
	if err != nil {
		return nil, err
	}

	// Get updated data
	updatedTransaction, _ := s.txRepo.GetByID(ctx, transactionID)
	updatedWallet, _ := s.walletRepo.GetByID(ctx, targetWalletID)

	// Invalidate and repopulate currency cache
	if err := s.invalidateTransactionCache(ctx, userID, transactionID); err != nil {
		slog.Warn("Failed to invalidate currency cache",
			"transaction_id", transactionID,
			"user_id", userID,
			"error", err)
	}
	if err := s.populateTransactionCache(ctx, userID, updatedTransaction, updatedWallet.Currency); err != nil {
		slog.Warn("Failed to populate currency cache",
			"transaction_id", updatedTransaction.ID,
			"user_id", userID,
			"error", err)
	}

	txProto := s.modelToProto(updatedTransaction, updatedWallet, category)
	// Enrich with conversion fields
	s.enrichTransactionProto(ctx, userID, txProto, updatedTransaction, updatedWallet.Currency)

	return &v1.UpdateTransactionResponse{
		Success: true,
		Message: "Transaction updated successfully",
		Data:    txProto,
		NewBalance: &v1.Money{
			Amount:   updatedWallet.Balance,
			Currency: updatedWallet.Currency,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// DeleteTransaction deletes a transaction and restores the wallet balance.
func (s *transactionService) DeleteTransaction(ctx context.Context, transactionID int32, userID int32) (*v1.DeleteTransactionResponse, error) {
	// Get transaction
	transaction, err := s.txRepo.GetByIDForUser(ctx, transactionID, userID)
	if err != nil {
		return nil, err
	}

	// Get category to calculate balance restoration
	var category *models.Category
	if transaction.CategoryID != nil {
		category, _ = s.categoryRepo.GetByID(ctx, *transaction.CategoryID)
	}

	// Calculate balance restoration (negative of the original delta)
	balanceDelta := s.calculateBalanceDelta(transaction.Amount, category)
	restoreDelta := -balanceDelta

	// Delete transaction
	err = s.txRepo.Delete(ctx, transactionID)
	if err != nil {
		return nil, err
	}

	// Restore wallet balance
	updatedWallet, err := s.walletRepo.UpdateBalance(ctx, transaction.WalletID, restoreDelta)
	if err != nil {
		return nil, err
	}

	// Invalidate currency cache
	if err := s.invalidateTransactionCache(ctx, userID, transactionID); err != nil {
		slog.Warn("Failed to invalidate currency cache",
			"transaction_id", transactionID,
			"user_id", userID,
			"error", err)
	}

	return &v1.DeleteTransactionResponse{
		Success: true,
		Message: "Transaction deleted successfully",
		NewBalance: &v1.Money{
			Amount:   updatedWallet.Balance,
			Currency: updatedWallet.Currency,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetAvailableYears retrieves distinct years from user's transactions.
func (s *transactionService) GetAvailableYears(ctx context.Context, userID int32) (*v1.GetAvailableYearsResponse, error) {
	years, err := s.txRepo.GetAvailableYears(ctx, userID)
	if err != nil {
		return nil, err
	}

	message := "Available years retrieved successfully"
	if len(years) == 0 {
		message = "No transactions found"
	}

	return &v1.GetAvailableYearsResponse{
		Success:   true,
		Message:   message,
		Years:     years,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetFinancialReport retrieves monthly financial breakdown for wallets in a given year.
func (s *transactionService) GetFinancialReport(ctx context.Context, userID int32, req *v1.GetFinancialReportRequest) (*v1.GetFinancialReportResponse, error) {
	// Validate year
	if req.Year <= 0 {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.TransactionYearInvalid, "Invalid year")
	}

	// Calculate date range for the requested year
	startDate := time.Date(int(req.Year), 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(int(req.Year), 12, 31, 23, 59, 59, 0, time.UTC)

	// Get user's wallets using list method
	wallets, _, err := s.walletRepo.ListByUserID(ctx, userID, repository.ListOptions{
		Limit: 100,
	})
	if err != nil {
		return nil, err
	}

	// Filter wallets based on request
	var targetWallets []*models.Wallet
	if len(req.WalletIds) > 0 {
		// Filter by specified wallet IDs
		walletIDMap := make(map[int32]bool)
		for _, id := range req.WalletIds {
			walletIDMap[id] = true
		}
		for _, wallet := range wallets {
			if walletIDMap[wallet.ID] {
				targetWallets = append(targetWallets, wallet)
			}
		}
	} else {
		// Use all wallets
		targetWallets = wallets
	}

	if len(targetWallets) == 0 {
		return &v1.GetFinancialReportResponse{
			Success:   true,
			Message:   "No wallets found",
			Year:      req.Year,
			WalletData: []*v1.WalletFinancialData{},
			Totals:    make([]*v1.MonthlyFinancialData, 12),
			Timestamp: time.Now().Format(time.RFC3339),
		}, nil
	}

	// Get transactions for the year
	var walletIDs []int32
	for _, w := range targetWallets {
		walletIDs = append(walletIDs, w.ID)
	}

	filter := repository.TransactionFilter{
		WalletIDs: walletIDs,
		StartDate: &startDate,
		EndDate:   &endDate,
	}

	transactions, _, err := s.txRepo.List(ctx, userID, filter, repository.ListOptions{
		Limit:   100000,
		Offset:  0,
		OrderBy: "date",
		Order:   "asc",
	})
	if err != nil {
		return nil, err
	}

	// Get user's preferred currency for aggregation
	user, _ := s.userRepo.GetByID(ctx, userID)
	preferredCurrency := types.VND // Default
	if user != nil && user.PreferredCurrency != "" {
		preferredCurrency = user.PreferredCurrency
	}

	// Create monthly data structure for each wallet
	walletDataMap := make(map[int32]*v1.WalletFinancialData)
	for _, wallet := range targetWallets {
		monthlyData := make([]*v1.MonthlyFinancialData, 12)
		for month := 0; month < 12; month++ {
			monthlyData[month] = &v1.MonthlyFinancialData{
				Month:         int32(month),
				Income:        &v1.Money{Amount: 0, Currency: wallet.Currency},
				Expense:       &v1.Money{Amount: 0, Currency: wallet.Currency},
				DisplayIncome: &v1.Money{Amount: 0, Currency: preferredCurrency},
				DisplayExpense: &v1.Money{Amount: 0, Currency: preferredCurrency},
			}
		}
		walletDataMap[wallet.ID] = &v1.WalletFinancialData{
			WalletId:    wallet.ID,
			WalletName:  wallet.WalletName,
			MonthlyData: monthlyData,
		}
	}

	// Build wallet currency lookup map for O(1) access
	walletCurrencyMap := make(map[int32]string)
	for _, wallet := range targetWallets {
		walletCurrencyMap[wallet.ID] = wallet.Currency
	}

	// Process transactions and aggregate by wallet and month
	for _, tx := range transactions {
		walletData := walletDataMap[tx.WalletID]
		if walletData == nil {
			continue
		}

		// Get month from transaction date
		month := int(tx.Date.Month()) - 1 // 0-11 for Jan-Dec
		if month < 0 || month >= 12 {
			continue
		}

		monthlyEntry := walletData.MonthlyData[month]

		// Get wallet currency from map (O(1) lookup)
		walletCurrency := walletCurrencyMap[tx.WalletID]
		if walletCurrency == "" {
			// Should not happen given DB constraints, but defensive programming
			walletCurrency = types.VND
		}

		// Convert amount to preferred currency for display
		convertedAmount := tx.Amount
		if walletCurrency != preferredCurrency {
			converted, err := s.fxRateSvc.ConvertAmount(ctx, tx.Amount, walletCurrency, preferredCurrency)
			if err != nil {
				// Log error but continue with original amount as fallback
				slog.Warn("Failed to convert amount for transaction",
					"transaction_id", tx.ID,
					"from_currency", walletCurrency,
					"to_currency", preferredCurrency,
					"error", err)
			} else {
				convertedAmount = converted
			}
		}

		// Add to income or expense based on signed amount
		// Amounts are signed: positive for income, negative for expense
		if tx.Amount > 0 {
			monthlyEntry.Income.Amount += tx.Amount
			monthlyEntry.DisplayIncome.Amount += convertedAmount
		} else {
			monthlyEntry.Expense.Amount += -tx.Amount  // Convert to positive for display
			monthlyEntry.DisplayExpense.Amount += -convertedAmount  // Convert to positive for display
		}
	}

	// Build response
	walletDataList := make([]*v1.WalletFinancialData, 0, len(walletDataMap))
	for _, data := range walletDataMap {
		walletDataList = append(walletDataList, data)
	}

	// Calculate totals across all wallets for each month using converted amounts
	totals := make([]*v1.MonthlyFinancialData, 12)
	for month := 0; month < 12; month++ {
		var totalIncome, totalExpense int64
		var displayIncome, displayExpense int64

		for _, walletData := range walletDataList {
			if len(walletData.MonthlyData) > month {
				monthlyData := walletData.MonthlyData[month]
				// Use native amounts for totals (may be multi-currency, shown for reference)
				totalIncome += monthlyData.Income.Amount
				totalExpense += monthlyData.Expense.Amount
				// Use converted amounts for display totals
				displayIncome += monthlyData.DisplayIncome.Amount
				displayExpense += monthlyData.DisplayExpense.Amount
			}
		}

		totals[month] = &v1.MonthlyFinancialData{
			Month:          int32(month),
			Income:         &v1.Money{Amount: totalIncome, Currency: preferredCurrency},
			Expense:        &v1.Money{Amount: totalExpense, Currency: preferredCurrency},
			DisplayIncome:  &v1.Money{Amount: displayIncome, Currency: preferredCurrency},
			DisplayExpense: &v1.Money{Amount: displayExpense, Currency: preferredCurrency},
		}
	}

	message := "Financial report retrieved successfully"
	if len(walletDataList) == 0 {
		message = "No financial data found for the specified period"
	}

	return &v1.GetFinancialReportResponse{
		Success:   true,
		Message:   message,
		Year:      req.Year,
		WalletData: walletDataList,
		Totals:    totals,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetCategoryBreakdown retrieves category-wise transaction summary for a date range.
func (s *transactionService) GetCategoryBreakdown(ctx context.Context, userID int32, req *v1.GetCategoryBreakdownRequest) (*v1.GetCategoryBreakdownResponse, error) {
	// Validate date range
	if req.StartDate <= 0 {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.TransactionStartDatePositive, "start_date must be greater than 0")
	}
	if req.EndDate <= 0 {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.TransactionEndDatePositive, "end_date must be greater than 0")
	}
	if req.StartDate > req.EndDate {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.TransactionDateRangeInvalid, "start_date must be less than or equal to end_date")
	}

	// Convert Unix timestamps to time.Time
	startDate := time.Unix(req.StartDate, 0)
	endDate := time.Unix(req.EndDate, 0)

	// Get user's preferred currency for aggregation
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	preferredCurrency := types.VND // Default
	if user != nil && user.PreferredCurrency != "" {
		preferredCurrency = user.PreferredCurrency
	}

	// Build filter
	filter := repository.TransactionFilter{
		StartDate: &startDate,
		EndDate:   &endDate,
	}

	// Apply wallet filter if provided
	if len(req.WalletIds) > 0 {
		filter.WalletIDs = req.WalletIds
	}

	// Apply category type filter if provided
	if req.CategoryType != nil {
		var txType v1.TransactionType
		switch *req.CategoryType {
		case v1.CategoryType_CATEGORY_TYPE_INCOME:
			txType = v1.TransactionType_TRANSACTION_TYPE_INCOME
		case v1.CategoryType_CATEGORY_TYPE_EXPENSE:
			txType = v1.TransactionType_TRANSACTION_TYPE_EXPENSE
		default:
			txType = v1.TransactionType_TRANSACTION_TYPE_UNSPECIFIED
		}
		if txType != v1.TransactionType_TRANSACTION_TYPE_UNSPECIFIED {
			filter.Type = &txType
		}
	}

	// Get category breakdown from repository
	breakdownItems, err := s.txRepo.GetCategoryBreakdown(ctx, userID, filter)
	if err != nil {
		return nil, err
	}

	// Build wallet currency lookup map for O(1) access
	var targetWallets []*models.Wallet
	if len(req.WalletIds) > 0 {
		// Get specified wallets
		for _, walletID := range req.WalletIds {
			if wallet, err := s.walletRepo.GetByID(ctx, walletID); err == nil && wallet != nil {
				targetWallets = append(targetWallets, wallet)
			}
		}
	} else {
		// Get all user wallets
		targetWallets, _, err = s.walletRepo.ListByUserID(ctx, userID, repository.ListOptions{
			Limit: 100,
		})
		if err != nil {
			return nil, err
		}
	}

	walletCurrencyMap := make(map[int32]string)
	for _, wallet := range targetWallets {
		walletCurrencyMap[wallet.ID] = wallet.Currency
	}

	// Convert to protobuf format with multi-currency conversion
	categories := make([]*v1.CategoryBreakdownItem, 0, len(breakdownItems))

	for _, item := range breakdownItems {
		// Aggregate amounts across all currencies, converting each to preferred currency
		var totalConvertedAmount int64

		for currency, amount := range item.AmountsByCurrency {
			// Convert to preferred currency
			if currency != preferredCurrency && amount != 0 {
				converted, err := s.fxRateSvc.ConvertAmount(ctx, amount, currency, preferredCurrency)
				if err != nil {
					// Non-critical error: continue with original amount
					// Conversion failures are handled by skipping the currency
					continue
				}
				totalConvertedAmount += converted
			} else {
				totalConvertedAmount += amount
			}
		}

		// For TotalAmount, use the first currency (or preferred if available)
		var primaryCurrency string
		var primaryAmount int64
		if len(item.AmountsByCurrency) > 0 {
			// Use the first currency in the map for native amount display
			for currency, amount := range item.AmountsByCurrency {
				primaryCurrency = currency
				primaryAmount = amount
				break
			}
		} else {
			primaryCurrency = types.VND
			primaryAmount = 0
		}

		categories = append(categories, &v1.CategoryBreakdownItem{
			CategoryId:   item.CategoryID,
			CategoryName: item.CategoryName,
			Type:         v1.CategoryType(item.Type),
			TotalAmount: &v1.Money{
				Amount:   primaryAmount,
				Currency: primaryCurrency,
			},
			DisplayAmount: &v1.Money{
				Amount:   totalConvertedAmount,
				Currency: preferredCurrency,
			},
			TransactionCount: item.TransactionCount,
		})
	}

	message := "Category breakdown retrieved successfully"
	if len(categories) == 0 {
		message = "No category data found for the specified period"
	}

	return &v1.GetCategoryBreakdownResponse{
		Success:   true,
		Message:   message,
		Categories: categories,
		Currency:  preferredCurrency,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// Helper methods

// calculateBalanceDelta calculates the balance change based on signed amount.
// Positive amounts add to balance (income), negative amounts subtract from balance (expense).
// The category parameter is kept for interface compatibility but no longer used for calculation.
func (s *transactionService) calculateBalanceDelta(amount int64, category *models.Category) int64 {
	// Simply return the amount - let the sign determine direction
	// Positive = income (adds to balance)
	// Negative = expense (subtracts from balance)
	return amount
}

// parsePaginationParams converts protobuf pagination params to internal types.
func (s *transactionService) parsePaginationParams(params *v1.PaginationParams) types.PaginationParams {
	if params == nil {
		return types.NewPaginationParams()
	}

	p := types.PaginationParams{
		Page:     int(params.Page),
		PageSize: int(params.PageSize),
		OrderBy:  params.OrderBy,
		Order:    params.Order,
	}
	return p.Validate()
}

// buildFilter converts protobuf filter to repository filter.
func (s *transactionService) buildFilter(filter *v1.TransactionFilter) repository.TransactionFilter {
	if filter == nil {
		return repository.TransactionFilter{}
	}

	repoFilter := repository.TransactionFilter{}

	if filter.WalletId != nil {
		repoFilter.WalletID = filter.WalletId
	}
	if filter.CategoryId != nil {
		repoFilter.CategoryID = filter.CategoryId
	}
	if filter.Type != nil {
		repoFilter.Type = filter.Type
	}
	if filter.StartDate != nil {
		t := time.Unix(*filter.StartDate, 0)
		repoFilter.StartDate = &t
	}
	if filter.EndDate != nil {
		t := time.Unix(*filter.EndDate, 0)
		repoFilter.EndDate = &t
	}
	if filter.MinAmount != nil {
		repoFilter.MinAmount = filter.MinAmount
	}
	if filter.MaxAmount != nil {
		repoFilter.MaxAmount = filter.MaxAmount
	}
	if filter.SearchNote != nil {
		repoFilter.SearchNote = filter.SearchNote
	}

	return repoFilter
}

// modelToProto converts a model Transaction to protobuf with full relationships.
func (s *transactionService) modelToProto(tx *models.Transaction, wallet *models.Wallet, category *models.Category) *v1.Transaction {
	proto := &v1.Transaction{
		Id:       tx.ID,
		WalletId: tx.WalletID,
		Type:     deriveTransactionType(category),
		Amount: &v1.Money{
			Amount:   tx.Amount,
			Currency: wallet.Currency,
		},
		Date:      tx.Date.Unix(),
		Note:      tx.Note,
		CreatedAt: tx.CreatedAt.Unix(),
		UpdatedAt: tx.UpdatedAt.Unix(),
		Currency:  wallet.Currency, // Set the transaction's original currency
	}

	if tx.CategoryID != nil {
		proto.CategoryId = *tx.CategoryID
	}

	return proto
}

// modelToProtoSimple converts a model Transaction to protobuf without loading relationships.
func (s *transactionService) modelToProtoSimple(tx *models.Transaction) *v1.Transaction {
	// Use transaction's currency field (inherited from wallet at creation time)
	currency := tx.Currency
	if currency == "" {
		currency = types.VND // Fallback only if not set
	}

	proto := &v1.Transaction{
		Id:       tx.ID,
		WalletId: tx.WalletID,
		Type:     deriveTransactionType(tx.Category),
		Amount: &v1.Money{
			Amount:   tx.Amount,
			Currency: currency,
		},
		Date:      tx.Date.Unix(),
		Note:      tx.Note,
		CreatedAt: tx.CreatedAt.Unix(),
		Currency:  currency,
		UpdatedAt: tx.UpdatedAt.Unix(),
	}

	if tx.CategoryID != nil {
		proto.CategoryId = *tx.CategoryID
	}

	return proto
}

// deriveTransactionType converts category type to transaction type
func deriveTransactionType(category *models.Category) v1.TransactionType {
	if category == nil {
		return v1.TransactionType_TRANSACTION_TYPE_UNSPECIFIED
	}
	switch v1.CategoryType(category.Type) {
	case v1.CategoryType_CATEGORY_TYPE_INCOME:
		return v1.TransactionType_TRANSACTION_TYPE_INCOME
	case v1.CategoryType_CATEGORY_TYPE_EXPENSE:
		return v1.TransactionType_TRANSACTION_TYPE_EXPENSE
	default:
		return v1.TransactionType_TRANSACTION_TYPE_UNSPECIFIED
	}
}

// Currency conversion helper methods

//nolint:unused
// convertTransactionAmount converts a transaction's amount to the user's preferred currency
// Uses cache for fast lookups and populates cache on misses
func (s *transactionService) convertTransactionAmount(ctx context.Context, userID int32, transaction *models.Transaction, walletCurrency string) (int64, error) {
	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return 0, err
	}

	// If same currency, no conversion needed
	if walletCurrency == user.PreferredCurrency {
		return transaction.Amount, nil
	}

	// Check cache first
	cachedValue, err := s.currencyCache.GetConvertedValue(ctx, userID, "transaction", transaction.ID, user.PreferredCurrency)
	if err == nil && cachedValue > 0 {
		return cachedValue, nil
	}

	// Cache miss - convert and cache
	convertedAmount, err := s.fxRateSvc.ConvertAmount(ctx, transaction.Amount, walletCurrency, user.PreferredCurrency)
	if err != nil {
		return 0, fmt.Errorf("failed to convert amount: %w", err)
	}

	// Store in cache (non-blocking, log errors only)
	go func() {
		if err := s.currencyCache.SetConvertedValue(context.Background(), userID, "transaction", transaction.ID, user.PreferredCurrency, convertedAmount); err != nil {
			slog.Warn("Failed to cache converted amount",
				"transaction_id", transaction.ID,
				"user_id", userID,
				"currency", user.PreferredCurrency,
				"error", err)
		}
	}()

	return convertedAmount, nil
}

// populateTransactionCache populates the currency cache for a transaction
// Called when transaction is created or updated
func (s *transactionService) populateTransactionCache(ctx context.Context, userID int32, transaction *models.Transaction, walletCurrency string) error {
	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// If same currency, no need to cache
	if walletCurrency == user.PreferredCurrency {
		return nil
	}

	// Convert and cache
	convertedAmount, err := s.fxRateSvc.ConvertAmount(ctx, transaction.Amount, walletCurrency, user.PreferredCurrency)
	if err != nil {
		return fmt.Errorf("failed to convert amount for caching: %w", err)
	}

	return s.currencyCache.SetConvertedValue(ctx, userID, "transaction", transaction.ID, user.PreferredCurrency, convertedAmount)
}

// invalidateTransactionCache removes cached conversions for a transaction
// Called when transaction is updated or deleted
func (s *transactionService) invalidateTransactionCache(ctx context.Context, userID int32, transactionID int32) error {
	return s.currencyCache.DeleteEntityCache(ctx, userID, "transaction", transactionID)
}

// enrichTransactionProto adds conversion fields to a transaction proto response
func (s *transactionService) enrichTransactionProto(ctx context.Context, userID int32, txProto *v1.Transaction, txModel *models.Transaction, walletCurrency string) {
	if s.currencyCache == nil {
		return
	}

	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return
	}

	// If same currency, no conversion needed
	if walletCurrency == user.PreferredCurrency {
		return
	}

	// Try to get from cache first
	convertedAmount, err := s.currencyCache.GetConvertedValue(ctx, userID, "transaction", txModel.ID, user.PreferredCurrency)
	if err == nil && convertedAmount > 0 {
		txProto.DisplayAmount = &v1.Money{
			Amount:   convertedAmount,
			Currency: user.PreferredCurrency,
		}
		txProto.DisplayCurrency = user.PreferredCurrency
	}
}

// enrichTransactionSliceProto adds conversion fields to a slice of transaction proto responses
func (s *transactionService) enrichTransactionSliceProto(ctx context.Context, userID int32, txProtos []*v1.Transaction, txModels []*models.Transaction, walletCurrencies []string) {
	for i, txProto := range txProtos {
		if i < len(txModels) && i < len(walletCurrencies) {
			s.enrichTransactionProto(ctx, userID, txProto, txModels[i], walletCurrencies[i])
		}
	}
}
