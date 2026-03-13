package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	"wealthjourney/pkg/cache"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/types"
	"wealthjourney/pkg/validator"
	v1 "wealthjourney/protobuf/v1"

	"github.com/go-redis/redis/v8"
)

// walletService implements WalletService.
type walletService struct {
	walletRepo      repository.WalletRepository
	userRepo        repository.UserRepository
	txRepo          repository.TransactionRepository
	categoryRepo    repository.CategoryRepository
	categoryService CategoryService
	fxRateSvc       FXRateService
	currencyCache   *cache.CurrencyCache
	investmentRepo  repository.InvestmentRepository
	redisCache      *redis.Client
	mapper          *WalletMapper
}

// NewWalletService creates a new WalletService.
func NewWalletService(
	walletRepo repository.WalletRepository,
	userRepo repository.UserRepository,
	txRepo repository.TransactionRepository,
	categoryRepo repository.CategoryRepository,
	categoryService CategoryService,
	fxRateSvc FXRateService,
	currencyCache *cache.CurrencyCache,
	investmentRepo repository.InvestmentRepository,
	redisCache *redis.Client,
) WalletService {
	return &walletService{
		walletRepo:      walletRepo,
		userRepo:        userRepo,
		txRepo:          txRepo,
		categoryRepo:    categoryRepo,
		categoryService: categoryService,
		fxRateSvc:       fxRateSvc,
		currencyCache:   currencyCache,
		investmentRepo:  investmentRepo,
		redisCache:      redisCache,
		mapper:          NewWalletMapper(),
	}
}

// CreateWallet creates a new wallet for a user.
// If initialBalance is provided, it creates a transaction with "Initial Balance" category.
func (s *walletService) CreateWallet(ctx context.Context, userID int32, req *v1.CreateWalletRequest) (*v1.CreateWalletResponse, error) {
	// Validate inputs
	if err := validator.ID(userID); err != nil {
		return nil, err
	}
	if err := validator.WalletName(req.WalletName); err != nil {
		return nil, err
	}

	// Verify user exists
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperrors.NewNotFoundError("user")
	}

	// Validate initial balance
	initialBalance := int64(0)
	currency := types.USD
	if req.InitialBalance != nil {
		initialBalance = req.InitialBalance.Amount
		currency = req.InitialBalance.Currency
		if initialBalance < 0 {
			return nil, apperrors.NewValidationError("initial balance cannot be negative")
		}
	}

	// Create wallet model with zero balance initially
	wallet := &models.Wallet{
		UserID:     userID,
		WalletName: req.WalletName,
		Balance:    0,
		Currency:   currency,
		Type:       int32(req.Type),
	}

	if err := s.walletRepo.Create(ctx, wallet); err != nil {
		return nil, err
	}

	// If initial balance is provided, create a transaction for it
	if initialBalance > 0 {
		// Get or create the Initial Balance category
		category, err := s.categoryService.GetOrCreateInitialBalanceCategory(ctx, userID)
		if err != nil {
			// Rollback wallet creation on failure
			_ = s.walletRepo.Delete(ctx, wallet.ID)
			return nil, apperrors.NewInternalErrorWithCause("failed to get initial balance category", err)
		}

		// Create initial balance transaction
		initialBalanceTx := &models.Transaction{
			WalletID:   wallet.ID,
			CategoryID: &category.ID,
			Amount:     initialBalance,
			Date:       time.Now(),
			Note:       "Initial balance",
		}

		if err := s.txRepo.Create(ctx, initialBalanceTx); err != nil {
			// Rollback wallet creation on failure
			_ = s.walletRepo.Delete(ctx, wallet.ID)
			return nil, apperrors.NewInternalErrorWithCause("failed to create initial balance transaction", err)
		}

		// Update wallet balance to reflect the initial balance
		updatedWallet, err := s.walletRepo.UpdateBalance(ctx, wallet.ID, initialBalance)
		if err != nil {
			// Rollback: delete transaction and wallet
			_ = s.txRepo.Delete(ctx, initialBalanceTx.ID)
			_ = s.walletRepo.Delete(ctx, wallet.ID)
			return nil, apperrors.NewInternalErrorWithCause("failed to update wallet balance", err)
		}

		wallet = updatedWallet
	}

	// Populate currency cache
	if err := s.populateWalletCache(ctx, userID, wallet); err != nil {
		// Log error but don't fail - cache population is not critical
		fmt.Printf("Warning: failed to populate currency cache for wallet %d: %v\n", wallet.ID, err)
	}

	walletProto := s.mapper.ModelToProto(wallet)
	// Enrich with conversion fields
	_ = s.enrichWalletProto(ctx, userID, walletProto, wallet)

	return &v1.CreateWalletResponse{
		Success:   true,
		Message:   "Wallet created successfully",
		Data:      walletProto,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetWallet retrieves a wallet by ID, ensuring it belongs to the user.
func (s *walletService) GetWallet(ctx context.Context, walletID int32, requestingUserID int32) (*v1.GetWalletResponse, error) {
	if err := validator.ID(walletID); err != nil {
		return nil, err
	}
	if err := validator.ID(requestingUserID); err != nil {
		return nil, err
	}

	wallet, err := s.walletRepo.GetByIDForUser(ctx, walletID, requestingUserID)
	if err != nil {
		return nil, err
	}

	// Calculate investment value for INVESTMENT wallets
	var investmentValue int64 = 0
	if v1.WalletType(wallet.Type) == v1.WalletType_INVESTMENT {
		// Use the new function that properly converts investment values to wallet currency
		investmentValue, err = s.getInvestmentValueInWalletCurrency(ctx, walletID, wallet.Currency)
		if err != nil {
			// Log error but don't fail the request
			log.Printf("Error calculating investment value for wallet %d: %v", walletID, err)
			// Return wallet with 0 investment value
			investmentValue = 0
		}
	}

	// Calculate total value (both are now in wallet.Currency)
	totalValue := wallet.Balance + investmentValue

	// Get user for currency conversion
	user, err := s.userRepo.GetByID(ctx, requestingUserID)
	if err != nil {
		return nil, err
	}
	userCurrency := user.PreferredCurrency

	// Convert values to user's preferred currency
	displayInvestmentValue := s.convertToUserCurrency(investmentValue, wallet.Currency, userCurrency)
	displayTotalValue := s.convertToUserCurrency(totalValue, wallet.Currency, userCurrency)

	walletProto := s.mapper.ModelToProto(wallet)
	// Enrich with conversion fields
	_ = s.enrichWalletProto(ctx, requestingUserID, walletProto, wallet)

	// Set investment value fields
	walletProto.InvestmentValue = &v1.Money{Amount: investmentValue, Currency: wallet.Currency}
	walletProto.DisplayInvestmentValue = displayInvestmentValue
	walletProto.TotalValue = &v1.Money{Amount: totalValue, Currency: wallet.Currency}
	walletProto.DisplayTotalValue = displayTotalValue

	return &v1.GetWalletResponse{
		Success:   true,
		Message:   "Wallet retrieved successfully",
		Data:      walletProto,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ListWallets retrieves all wallets for a user with pagination.
func (s *walletService) ListWallets(ctx context.Context, userID int32, params types.PaginationParams) (*v1.ListWalletsResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	params = params.Validate()

	opts := repository.ListOptions{
		Limit:   params.Limit(),
		Offset:  params.Offset(),
		OrderBy: params.OrderBy,
		Order:   params.Order,
	}

	wallets, total, err := s.walletRepo.ListByUserID(ctx, userID, opts)
	if err != nil {
		return nil, err
	}

	// Get user for currency conversion
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	userCurrency := user.PreferredCurrency

	// Collect investment wallet IDs
	investmentWalletIDs := []int32{}
	for _, wallet := range wallets {
		if v1.WalletType(wallet.Type) == v1.WalletType_INVESTMENT {
			investmentWalletIDs = append(investmentWalletIDs, wallet.ID)
		}
	}

	// Calculate investment values for each wallet (with proper currency conversion)
	investmentValueMap := make(map[int32]int64)
	for _, walletID := range investmentWalletIDs {
		// Find the wallet to get its currency
		var walletCurrency string
		for _, w := range wallets {
			if w.ID == walletID {
				walletCurrency = w.Currency
				break
			}
		}
		if walletCurrency == "" {
			walletCurrency = "USD" // Default fallback
		}

		// Calculate investment value in the wallet's currency
		value, err := s.getInvestmentValueInWalletCurrency(ctx, walletID, walletCurrency)
		if err != nil {
			log.Printf("Error calculating investment value for wallet %d: %v", walletID, err)
			value = 0
		}
		investmentValueMap[walletID] = value
	}

	// Build response with investment values
	protoWallets := make([]*v1.Wallet, len(wallets))
	for i, wallet := range wallets {
		investmentValue := investmentValueMap[wallet.ID]
		totalValue := wallet.Balance + investmentValue

		// Convert values to user's preferred currency
		displayInvestmentValue := s.convertToUserCurrency(investmentValue, wallet.Currency, userCurrency)
		displayTotalValue := s.convertToUserCurrency(totalValue, wallet.Currency, userCurrency)

		protoWallets[i] = s.mapper.ModelToProto(wallet)
		// Enrich with conversion fields
		_ = s.enrichWalletProto(ctx, userID, protoWallets[i], wallet)

		// Set investment value fields
		protoWallets[i].InvestmentValue = &v1.Money{Amount: investmentValue, Currency: wallet.Currency}
		protoWallets[i].DisplayInvestmentValue = displayInvestmentValue
		protoWallets[i].TotalValue = &v1.Money{Amount: totalValue, Currency: wallet.Currency}
		protoWallets[i].DisplayTotalValue = displayTotalValue
	}

	paginationResult := types.NewPaginationResult(params.Page, params.PageSize, total)

	return &v1.ListWalletsResponse{
		Success:    true,
		Message:    "Wallets retrieved successfully",
		Wallets:    protoWallets,
		Pagination: s.mapper.PaginationResultToProto(paginationResult),
		Timestamp:  time.Now().Format(time.RFC3339),
	}, nil
}

// UpdateWallet updates a wallet's name.
func (s *walletService) UpdateWallet(ctx context.Context, walletID int32, userID int32, req *v1.UpdateWalletRequest) (*v1.UpdateWalletResponse, error) {
	if err := validator.ID(walletID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}
	if err := validator.WalletName(req.WalletName); err != nil {
		return nil, err
	}

	// Get wallet and verify ownership
	wallet, err := s.walletRepo.GetByIDForUser(ctx, walletID, userID)
	if err != nil {
		return nil, err
	}

	// Update name
	wallet.WalletName = req.WalletName

	if err := s.walletRepo.Update(ctx, wallet); err != nil {
		return nil, err
	}

	// Invalidate and repopulate currency cache
	if err := s.invalidateWalletCache(ctx, userID, walletID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for wallet %d: %v\n", walletID, err)
	}
	if err := s.populateWalletCache(ctx, userID, wallet); err != nil {
		fmt.Printf("Warning: failed to populate currency cache for wallet %d: %v\n", wallet.ID, err)
	}

	// Enrich wallet proto with display fields
	walletProto := s.mapper.ModelToProto(wallet)
	_ = s.enrichWalletProto(ctx, userID, walletProto, wallet)

	return &v1.UpdateWalletResponse{
		Success:   true,
		Message:   "Wallet updated successfully",
		Data:      walletProto,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// DeleteWallet deletes a wallet with options for handling related transactions.
func (s *walletService) DeleteWallet(ctx context.Context, walletID int32, userID int32, req *v1.DeleteWalletRequest) (*v1.DeleteWalletResponse, error) {
	if err := validator.ID(walletID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Verify ownership
	wallet, err := s.walletRepo.GetByIDForUser(ctx, walletID, userID)
	if err != nil {
		return nil, err
	}

	// Get transaction count for response
	txCount, err := s.txRepo.CountByWalletID(ctx, walletID)
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to count transactions", err)
	}

	// Handle based on deletion option
	switch req.Option {
	case v1.WalletDeletionOption_WALLET_DELETION_OPTION_ARCHIVE:
		// Archive wallet - set status to ARCHIVED
		wallet.Status = int32(v1.WalletStatus_WALLET_STATUS_ARCHIVED)
		if err := s.walletRepo.Update(ctx, wallet); err != nil {
			return nil, err
		}
		// Invalidate currency cache
		_ = s.invalidateWalletCache(ctx, userID, walletID)
		return &v1.DeleteWalletResponse{
			Success:              true,
			Message:              "Wallet archived successfully",
			Timestamp:            time.Now().Format(time.RFC3339),
			TransactionsAffected: txCount,
		}, nil

	case v1.WalletDeletionOption_WALLET_DELETION_OPTION_TRANSFER:
		// Transfer transactions to another wallet
		if req.TargetWalletId == 0 {
			return nil, apperrors.NewValidationError("target wallet required for transfer option")
		}

		// Validate target wallet
		targetWallet, err := s.walletRepo.GetByIDForUser(ctx, req.TargetWalletId, userID)
		if err != nil {
			return nil, err
		}

		// Check currency match
		if targetWallet.Currency != wallet.Currency {
			return nil, apperrors.NewValidationError("target wallet must have same currency")
		}

		// Get the sum of transaction amounts from source wallet before transfer
		// Since transactions are signed (+income, -expense), this gives us the net balance change
		txSum, err := s.txRepo.GetSumAmounts(ctx, walletID)
		if err != nil {
			return nil, apperrors.NewInternalErrorWithCause("failed to calculate transaction sum", err)
		}

		// Transfer all transactions
		if err := s.txRepo.TransferToWallet(ctx, walletID, req.TargetWalletId); err != nil {
			return nil, err
		}

		// Update target wallet balance by adding the transaction sum
		// This ensures the target wallet's balance reflects the transferred transactions
		if txSum != 0 {
			_, err = s.walletRepo.UpdateBalance(ctx, req.TargetWalletId, txSum)
			if err != nil {
				// Rollback: reverse the transfer
				_ = s.txRepo.TransferToWallet(ctx, req.TargetWalletId, walletID)
				return nil, apperrors.NewInternalErrorWithCause("failed to update target wallet balance", err)
			}
		}

		// Soft delete source wallet
		if err := s.walletRepo.Delete(ctx, walletID); err != nil {
			return nil, err
		}

		// Invalidate currency cache for both wallets
		_ = s.invalidateWalletCache(ctx, userID, walletID)
		_ = s.invalidateWalletCache(ctx, userID, req.TargetWalletId)

		return &v1.DeleteWalletResponse{
			Success:              true,
			Message:              fmt.Sprintf("Transferred %d transactions and deleted wallet", txCount),
			Timestamp:            time.Now().Format(time.RFC3339),
			TransactionsAffected: txCount,
		}, nil

	case v1.WalletDeletionOption_WALLET_DELETION_OPTION_DELETE_ONLY:
		// Current behavior - soft delete only
		if err := s.walletRepo.Delete(ctx, walletID); err != nil {
			return nil, err
		}
		// Invalidate currency cache
		_ = s.invalidateWalletCache(ctx, userID, walletID)
		return &v1.DeleteWalletResponse{
			Success:              true,
			Message:              fmt.Sprintf("Wallet deleted. %d transactions will be preserved but inaccessible", txCount),
			Timestamp:            time.Now().Format(time.RFC3339),
			TransactionsAffected: txCount,
		}, nil

	default:
		return nil, apperrors.NewValidationError("invalid deletion option")
	}
}

// AddFunds adds funds to a wallet.
func (s *walletService) AddFunds(ctx context.Context, walletID int32, userID int32, req *v1.AddFundsRequest) (*v1.AddFundsResponse, error) {
	if err := validator.ID(walletID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Verify ownership
	wallet, err := s.walletRepo.GetByIDForUser(ctx, walletID, userID)
	if err != nil {
		return nil, err
	}

	// Validate amount
	if req.Amount == nil || req.Amount.Amount <= 0 {
		return nil, apperrors.NewValidationError("amount must be positive")
	}
	if req.Amount.Currency != wallet.Currency {
		return nil, apperrors.NewValidationError("currency mismatch")
	}

	// Update balance
	updated, err := s.walletRepo.UpdateBalance(ctx, walletID, req.Amount.Amount)
	if err != nil {
		return nil, err
	}

	// Invalidate and repopulate currency cache
	if err := s.invalidateWalletCache(ctx, userID, walletID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for wallet %d: %v\n", walletID, err)
	}
	if err := s.populateWalletCache(ctx, userID, updated); err != nil {
		fmt.Printf("Warning: failed to populate currency cache for wallet %d: %v\n", updated.ID, err)
	}

	// Enrich wallet proto with display fields
	walletProto := s.mapper.ModelToProto(updated)
	_ = s.enrichWalletProto(ctx, userID, walletProto, updated)

	return &v1.AddFundsResponse{
		Success:   true,
		Message:   "Funds added successfully",
		Data:      walletProto,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// WithdrawFunds withdraws funds from a wallet.
func (s *walletService) WithdrawFunds(ctx context.Context, walletID int32, userID int32, req *v1.WithdrawFundsRequest) (*v1.WithdrawFundsResponse, error) {
	if err := validator.ID(walletID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Verify ownership
	wallet, err := s.walletRepo.GetByIDForUser(ctx, walletID, userID)
	if err != nil {
		return nil, err
	}

	// Validate amount
	if req.Amount == nil || req.Amount.Amount <= 0 {
		return nil, apperrors.NewValidationError("amount must be positive")
	}
	if req.Amount.Currency != wallet.Currency {
		return nil, apperrors.NewValidationError("currency mismatch")
	}

	// Check sufficient balance
	if wallet.Balance < req.Amount.Amount {
		return nil, apperrors.NewValidationError("Insufficient balance")
	}

	// Update balance (negative delta for withdrawal)
	updated, err := s.walletRepo.UpdateBalance(ctx, walletID, -req.Amount.Amount)
	if err != nil {
		return nil, err
	}

	// Invalidate and repopulate currency cache
	if err := s.invalidateWalletCache(ctx, userID, walletID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for wallet %d: %v\n", walletID, err)
	}
	if err := s.populateWalletCache(ctx, userID, updated); err != nil {
		fmt.Printf("Warning: failed to populate currency cache for wallet %d: %v\n", updated.ID, err)
	}

	// Enrich wallet proto with display fields
	walletProto := s.mapper.ModelToProto(updated)
	_ = s.enrichWalletProto(ctx, userID, walletProto, updated)

	return &v1.WithdrawFundsResponse{
		Success:   true,
		Message:   "Funds withdrawn successfully",
		Data:      walletProto,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// TransferFunds transfers funds between two wallets belonging to the same user.
// It also creates two transactions: one for the outgoing transfer (expense) and one for the incoming transfer (income).
func (s *walletService) TransferFunds(ctx context.Context, userID int32, req *v1.TransferFundsRequest) (*v1.TransferFundsResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}
	if req.FromWalletId == req.ToWalletId {
		return nil, apperrors.NewValidationError("source and destination wallets cannot be the same")
	}

	// Verify both wallets exist and belong to user
	fromWallet, err := s.walletRepo.GetByIDForUser(ctx, req.FromWalletId, userID)
	if err != nil {
		return nil, err
	}

	toWallet, err := s.walletRepo.GetByIDForUser(ctx, req.ToWalletId, userID)
	if err != nil {
		return nil, err
	}

	// Validate amount
	if req.Amount == nil || req.Amount.Amount <= 0 {
		return nil, apperrors.NewValidationError("amount must be positive")
	}
	if req.Amount.Currency != fromWallet.Currency {
		return nil, apperrors.NewValidationError("currency mismatch with source wallet")
	}
	if toWallet.Currency != fromWallet.Currency {
		return nil, apperrors.NewValidationError("wallets must have the same currency")
	}

	// Check sufficient balance
	if fromWallet.Balance < req.Amount.Amount {
		return nil, apperrors.NewValidationError("Insufficient balance")
	}

	// Find or create "Outgoing Transfer" category (expense)
	outgoingCategory, err := s.categoryRepo.GetByNameAndType(ctx, userID, "Outgoing Transfer", v1.CategoryType_CATEGORY_TYPE_EXPENSE)
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to get outgoing transfer category", err)
	}

	// Find or create "Incoming Transfer" category (income)
	incomingCategory, err := s.categoryRepo.GetByNameAndType(ctx, userID, "Incoming Transfer", v1.CategoryType_CATEGORY_TYPE_INCOME)
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to get incoming transfer category", err)
	}

	// Create outgoing transaction (expense) for source wallet - negative amount
	outgoingTx := &models.Transaction{
		WalletID:   req.FromWalletId,
		CategoryID: &outgoingCategory.ID,
		Amount:     -req.Amount.Amount, // Negative for expense
		Date:       time.Now(),
		Note:       fmt.Sprintf("Transfer to wallet: %s", toWallet.WalletName),
	}

	// Create incoming transaction (income) for destination wallet - positive amount
	incomingTx := &models.Transaction{
		WalletID:   req.ToWalletId,
		CategoryID: &incomingCategory.ID,
		Amount:     req.Amount.Amount, // Positive for income
		Date:       time.Now(),
		Note:       fmt.Sprintf("Transfer from wallet: %s", fromWallet.WalletName),
	}

	// Create both transactions
	if err := s.txRepo.Create(ctx, outgoingTx); err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to create outgoing transaction", err)
	}

	if err := s.txRepo.Create(ctx, incomingTx); err != nil {
		// Attempt to rollback by deleting the outgoing transaction
		_ = s.txRepo.Delete(ctx, outgoingTx.ID)
		return nil, apperrors.NewInternalErrorWithCause("failed to create incoming transaction", err)
	}

	// Withdraw from source
	_, err = s.walletRepo.UpdateBalance(ctx, req.FromWalletId, -req.Amount.Amount)
	if err != nil {
		// Attempt to rollback by refunding source and deleting transactions
		_, _ = s.walletRepo.UpdateBalance(ctx, req.FromWalletId, req.Amount.Amount)
		_ = s.txRepo.Delete(ctx, outgoingTx.ID)
		_ = s.txRepo.Delete(ctx, incomingTx.ID)
		return nil, err
	}

	// Add to destination
	_, err = s.walletRepo.UpdateBalance(ctx, req.ToWalletId, req.Amount.Amount)
	if err != nil {
		// Attempt to rollback by refunding source and deleting transactions
		_, _ = s.walletRepo.UpdateBalance(ctx, req.FromWalletId, req.Amount.Amount)
		_ = s.txRepo.Delete(ctx, outgoingTx.ID)
		_ = s.txRepo.Delete(ctx, incomingTx.ID)
		return nil, err
	}

	// Invalidate and repopulate currency cache for both wallets
	_ = s.invalidateWalletCache(ctx, userID, req.FromWalletId)
	_ = s.populateWalletCache(ctx, userID, fromWallet)
	_ = s.invalidateWalletCache(ctx, userID, req.ToWalletId)
	_ = s.populateWalletCache(ctx, userID, toWallet)

	return &v1.TransferFundsResponse{
		Success:   true,
		Message:   "Funds transferred successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// AdjustBalance adjusts a wallet's balance and creates a transaction for audit trail.
// The amount is always positive; adjustmentType determines if it's added or removed.
func (s *walletService) AdjustBalance(ctx context.Context, walletID int32, userID int32, req *v1.AdjustBalanceRequest) (*v1.AdjustBalanceResponse, error) {
	if err := validator.ID(walletID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Verify wallet ownership
	wallet, err := s.walletRepo.GetByIDForUser(ctx, walletID, userID)
	if err != nil {
		return nil, err
	}

	// Validate amount
	if req.Amount == nil || req.Amount.Amount <= 0 {
		return nil, apperrors.NewValidationError("adjustment amount must be positive")
	}
	if req.Amount.Currency != wallet.Currency {
		return nil, apperrors.NewValidationError("currency mismatch")
	}

	// Validate adjustment type
	if req.AdjustmentType == v1.AdjustmentType_ADJUSTMENT_TYPE_UNSPECIFIED {
		return nil, apperrors.NewValidationError("adjustment type must be specified")
	}

	// Determine if this is an add (income) or remove (expense) operation
	isAddOperation := req.AdjustmentType == v1.AdjustmentType_ADJUSTMENT_TYPE_ADD

	// Check sufficient balance for remove operations
	if !isAddOperation && wallet.Balance < req.Amount.Amount {
		return nil, apperrors.NewValidationError("Insufficient balance for this adjustment")
	}

	// Get or create balance adjustment category using CategoryService
	category, err := s.categoryService.GetOrCreateBalanceAdjustmentCategory(ctx, userID, isAddOperation)
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to get balance adjustment category", err)
	}

	// Calculate the signed amount based on adjustment type
	// ADD = positive (income), REMOVE = negative (expense)
	signedAmount := req.Amount.Amount
	if !isAddOperation {
		signedAmount = -signedAmount
	}

	// Create adjustment transaction with signed amount
	adjustmentTx := &models.Transaction{
		WalletID:   walletID,
		CategoryID: &category.ID,
		Amount:     signedAmount, // Signed amount: positive for ADD, negative for REMOVE
		Date:       time.Now(),
		Note:       req.Reason,
	}

	if err := s.txRepo.Create(ctx, adjustmentTx); err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to create adjustment transaction", err)
	}

	// Update wallet balance using signed amount
	updatedWallet, err := s.walletRepo.UpdateBalance(ctx, walletID, signedAmount)
	if err != nil {
		// Rollback: delete transaction if balance update fails
		_ = s.txRepo.Delete(ctx, adjustmentTx.ID)
		return nil, err
	}

	// Invalidate and repopulate currency cache
	if err := s.invalidateWalletCache(ctx, userID, walletID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for wallet %d: %v\n", walletID, err)
	}
	if err := s.populateWalletCache(ctx, userID, updatedWallet); err != nil {
		fmt.Printf("Warning: failed to populate currency cache for wallet %d: %v\n", updatedWallet.ID, err)
	}

	// Enrich wallet proto with display fields
	walletProto := s.mapper.ModelToProto(updatedWallet)
	_ = s.enrichWalletProto(ctx, userID, walletProto, updatedWallet)

	return &v1.AdjustBalanceResponse{
		Success:   true,
		Message:   "Balance adjusted successfully",
		Data:      walletProto,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *walletService) GetTotalBalance(ctx context.Context, userID int32) (*v1.GetTotalBalanceResponse, error) {
	// Validate user ID
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get user to determine preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return nil, apperrors.NewNotFoundError("user")
	}

	// Get all active wallets for the user
	wallets, _, err := s.walletRepo.ListByUserID(ctx, userID, repository.ListOptions{
		Limit:  1000, // Get all wallets
		Offset: 0,
	})
	if err != nil {
		return nil, err
	}

	preferredCurrency := user.PreferredCurrency
	if preferredCurrency == "" {
		preferredCurrency = types.VND // Default to VND if not set
	}

	var totalCash int64 = 0
	var totalInvestments int64 = 0
	baseCurrency := types.VND // Default base currency

	// Collect investment wallet IDs
	investmentWalletIDs := []int32{}
	for _, wallet := range wallets {
		// Skip inactive wallets
		if v1.WalletStatus(wallet.Status) != v1.WalletStatus_WALLET_STATUS_ACTIVE {
			continue
		}

		// Convert to base currency if needed
		if wallet.Currency == baseCurrency {
			totalCash += wallet.Balance
		} else {
			converted := s.convertToUserCurrency(wallet.Balance, wallet.Currency, baseCurrency)
			totalCash += converted.Amount
		}

		if v1.WalletType(wallet.Type) == v1.WalletType_INVESTMENT {
			investmentWalletIDs = append(investmentWalletIDs, wallet.ID)
		}
	}

	// Fetch and aggregate investment values, converting to base currency
	if len(investmentWalletIDs) > 0 {
		for _, walletID := range investmentWalletIDs {
			// Find the wallet to get its currency
			var walletCurrency string
			for _, w := range wallets {
				if w.ID == walletID {
					walletCurrency = w.Currency
					break
				}
			}
			if walletCurrency == "" {
				walletCurrency = "USD" // Default fallback
			}

			// Get investment value in the wallet's currency
			investmentValueInWalletCurrency, err := s.getInvestmentValueInWalletCurrency(ctx, walletID, walletCurrency)
			if err != nil {
				log.Printf("Error calculating investment value for wallet %d: %v", walletID, err)
				continue
			}

			// Convert to base currency before summing
			if walletCurrency == baseCurrency {
				totalInvestments += investmentValueInWalletCurrency
			} else {
				converted := s.convertToUserCurrency(investmentValueInWalletCurrency, walletCurrency, baseCurrency)
				totalInvestments += converted.Amount
			}
		}
	}

	// Calculate net worth
	netWorth := totalCash + totalInvestments

	// Convert to user's preferred currency
	displayCash := s.convertToUserCurrency(totalCash, baseCurrency, preferredCurrency)
	displayInvestments := s.convertToUserCurrency(totalInvestments, baseCurrency, preferredCurrency)
	displayNetWorth := s.convertToUserCurrency(netWorth, baseCurrency, preferredCurrency)

	// Return response with display values
	return &v1.GetTotalBalanceResponse{
		Success: true,
		Message: "Total balance retrieved successfully",
		Data: &v1.Money{
			Amount:   totalCash,
			Currency: baseCurrency,
		},
		Currency: baseCurrency,
		DisplayValue: &v1.Money{
			Amount:   displayCash.Amount,
			Currency: displayCash.Currency,
		},
		DisplayCurrency: preferredCurrency,
		TotalInvestments: &v1.Money{
			Amount:   totalInvestments,
			Currency: baseCurrency,
		},
		DisplayTotalInvestments: &v1.Money{
			Amount:   displayInvestments.Amount,
			Currency: displayInvestments.Currency,
		},
		NetWorth: &v1.Money{
			Amount:   netWorth,
			Currency: baseCurrency,
		},
		DisplayNetWorth: &v1.Money{
			Amount:   displayNetWorth.Amount,
			Currency: displayNetWorth.Currency,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetBalanceHistory retrieves balance history for chart visualization.
func (s *walletService) GetBalanceHistory(ctx context.Context, userID int32, req *v1.GetBalanceHistoryRequest) (*v1.GetBalanceHistoryResponse, error) {
	// Validate user ID
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Set default year to current year if not provided
	year := req.Year
	if year == 0 {
		year = int32(time.Now().Year())
	}

	// Determine the time range based on request
	var startTime, endTime time.Time
	if req.Month > 0 && req.Month <= 12 {
		// Daily data for specific month
		startTime = time.Date(int(year), time.Month(req.Month), 1, 0, 0, 0, 0, time.UTC)
		endTime = startTime.AddDate(0, 1, 0)
	} else {
		// Monthly data for entire year
		startTime = time.Date(int(year), 1, 1, 0, 0, 0, 0, time.UTC)
		endTime = startTime.AddDate(1, 0, 0)
	}

	// Get wallet IDs to query
	var walletIDs []int32
	if req.WalletId > 0 {
		// Verify wallet belongs to user
		_, err := s.walletRepo.GetByIDForUser(ctx, req.WalletId, userID)
		if err != nil {
			return nil, err
		}
		walletIDs = []int32{req.WalletId}
	} else {
		// Get all user wallets
		wallets, _, err := s.walletRepo.ListByUserID(ctx, userID, repository.ListOptions{
			Limit: 1000, // No practical limit for this use case
		})
		if err != nil {
			return nil, err
		}
		for _, w := range wallets {
			walletIDs = append(walletIDs, w.ID)
		}
	}

	if len(walletIDs) == 0 {
		return &v1.GetBalanceHistoryResponse{
			Success:   true,
			Message:   "No wallets found",
			Data:      []*v1.BalanceDataPoint{},
			Timestamp: time.Now().Format(time.RFC3339),
		}, nil
	}

	// Get transactions for the period
	txFilter := repository.TransactionFilter{
		WalletIDs: walletIDs,
		StartDate: &startTime,
		EndDate:   &endTime,
	}

	transactions, _, err := s.txRepo.List(ctx, userID, txFilter, repository.ListOptions{
		Limit:   10000,
		OrderBy: "date",
		Order:   "asc",
	})
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to fetch transactions", err)
	}

	// Get initial balance before the period
	// Calculate by summing all transactions BEFORE the period start
	initialBalance := int64(0)
	for _, walletID := range walletIDs {
		// Get all transactions before the period start
		beforeFilter := repository.TransactionFilter{
			WalletIDs: []int32{walletID},
			EndDate:   &startTime, // All transactions before startTime
		}
		beforeTxs, _, err := s.txRepo.List(ctx, userID, beforeFilter, repository.ListOptions{
			Limit: 10000, // Get all historical transactions
		})
		if err != nil {
			log.Printf("Error fetching historical transactions for wallet %d: %v", walletID, err)
			continue
		}

		// Sum all transactions before the period
		// Amounts are signed: positive for income, negative for expense
		for _, tx := range beforeTxs {
			initialBalance += tx.Amount
		}
	}

	// Generate data points
	var dataPoints []*v1.BalanceDataPoint

	if req.Month > 0 && req.Month <= 12 {
		// Daily data for month
		daysInMonth := int(endTime.Sub(startTime).Hours() / 24)
		currentBalance := initialBalance

		for day := 0; day < daysInMonth; day++ {
			dayStart := startTime.AddDate(0, 0, day)
			dayEnd := dayStart.AddDate(0, 0, 1)

			dailyIncome := int64(0)
			dailyExpense := int64(0)

			for _, tx := range transactions {
				if (tx.Date.Equal(dayStart) || tx.Date.After(dayStart)) && tx.Date.Before(dayEnd) {
					// Amounts are signed: positive for income, negative for expense
					if tx.Amount > 0 {
						dailyIncome += tx.Amount
					} else {
						dailyExpense += -tx.Amount // Convert to positive for display
					}
					currentBalance += tx.Amount // Add signed amount directly
				}
			}

			dataPoints = append(dataPoints, &v1.BalanceDataPoint{
				Timestamp: dayStart.Unix(),
				Label:     fmt.Sprintf("%d %d", day+1, req.Month),
				Balance:   currentBalance,
				Income:    dailyIncome,
				Expense:   dailyExpense,
			})
		}
	} else {
		// Monthly data for year
		monthNames := []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}
		currentBalance := initialBalance

		for month := 1; month <= 12; month++ {
			monthStart := time.Date(int(year), time.Month(month), 1, 0, 0, 0, 0, time.UTC)
			monthEnd := monthStart.AddDate(0, 1, 0)

			monthlyIncome := int64(0)
			monthlyExpense := int64(0)

			for _, tx := range transactions {
				if (tx.Date.Equal(monthStart) || tx.Date.After(monthStart)) && tx.Date.Before(monthEnd) {
					// Amounts are signed: positive for income, negative for expense
					if tx.Amount > 0 {
						monthlyIncome += tx.Amount
					} else {
						monthlyExpense += -tx.Amount // Convert to positive for display
					}
					currentBalance += tx.Amount // Add signed amount directly
				}
			}

			dataPoints = append(dataPoints, &v1.BalanceDataPoint{
				Timestamp: monthStart.Unix(),
				Label:     monthNames[month-1],
				Balance:   currentBalance,
				Income:    monthlyIncome,
				Expense:   monthlyExpense,
			})
		}
	}

	return &v1.GetBalanceHistoryResponse{
		Success:   true,
		Message:   "Balance history retrieved successfully",
		Data:      dataPoints,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetMonthlyDominance retrieves monthly balance data for all wallets.
func (s *walletService) GetMonthlyDominance(ctx context.Context, userID int32, req *v1.GetMonthlyDominanceRequest) (*v1.GetMonthlyDominanceResponse, error) {
	// Validate user ID
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Set default year to current year if not provided
	year := req.Year
	if year == 0 {
		year = int32(time.Now().Year())
	}

	// Get all user wallets
	wallets, _, err := s.walletRepo.ListByUserID(ctx, userID, repository.ListOptions{
		Limit: 1000,
	})
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to fetch wallets", err)
	}

	if len(wallets) == 0 {
		return &v1.GetMonthlyDominanceResponse{
			Success:   true,
			Message:   "No wallets found",
			Data:      []*v1.WalletMonthlyData{},
			Timestamp: time.Now().Format(time.RFC3339),
		}, nil
	}

	// Define the time range for the year
	startTime := time.Date(int(year), 1, 1, 0, 0, 0, 0, time.UTC)
	endTime := startTime.AddDate(1, 0, 0)

	// Get all wallet IDs
	walletIDs := make([]int32, len(wallets))
	for i, w := range wallets {
		walletIDs[i] = w.ID
	}

	// Get transactions for the period for all wallets
	txFilter := repository.TransactionFilter{
		WalletIDs: walletIDs,
		StartDate: &startTime,
		EndDate:   &endTime,
	}

	transactions, _, err := s.txRepo.List(ctx, userID, txFilter, repository.ListOptions{
		Limit:   10000,
		OrderBy: "date",
		Order:   "asc",
	})
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to fetch transactions", err)
	}

	// Calculate initial balance for each wallet before the period
	// Sum all transactions BEFORE the period start
	initialBalances := make(map[int32]int64)
	for _, wallet := range wallets {
		// Get all transactions before the period start
		beforeFilter := repository.TransactionFilter{
			WalletIDs: []int32{wallet.ID},
			EndDate:   &startTime, // All transactions before startTime
		}
		beforeTxs, _, err := s.txRepo.List(ctx, userID, beforeFilter, repository.ListOptions{
			Limit: 10000, // Get all historical transactions
		})
		if err != nil {
			log.Printf("Error fetching historical transactions for wallet %d: %v", wallet.ID, err)
			initialBalances[wallet.ID] = 0
			continue
		}

		// Sum all transactions before the period
		// Transaction amounts are signed: positive for income, negative for expense
		walletInitialBalance := int64(0)
		for _, tx := range beforeTxs {
			walletInitialBalance += tx.Amount
		}
		initialBalances[wallet.ID] = walletInitialBalance
	}

	// Build response with monthly data for each wallet
	var result []*v1.WalletMonthlyData

	for _, wallet := range wallets {
		monthlyBalances := make([]int64, 12)
		currentBalance := initialBalances[wallet.ID]

		for month := 1; month <= 12; month++ {
			monthStart := time.Date(int(year), time.Month(month), 1, 0, 0, 0, 0, time.UTC)
			monthEnd := monthStart.AddDate(0, 1, 0)

			// Calculate balance change for this month
			// Transaction amounts are signed: positive for income, negative for expense
			for _, tx := range transactions {
				if tx.WalletID == wallet.ID &&
					(tx.Date.Equal(monthStart) || tx.Date.After(monthStart)) &&
					tx.Date.Before(monthEnd) {
					currentBalance += tx.Amount // Add signed amount directly
				}
			}

			// Store balance at end of month
			monthlyBalances[month-1] = currentBalance
		}

		result = append(result, &v1.WalletMonthlyData{
			WalletId:        wallet.ID,
			WalletName:      wallet.WalletName,
			MonthlyBalances: monthlyBalances,
		})
	}

	return &v1.GetMonthlyDominanceResponse{
		Success:   true,
		Message:   "Monthly dominance data retrieved successfully",
		Data:      result,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// Currency conversion helper methods

//nolint:unused
// convertWalletBalance converts a wallet's balance to the user's preferred currency
// Uses cache for fast lookups and populates cache on misses
func (s *walletService) convertWalletBalance(ctx context.Context, userID int32, wallet *models.Wallet) (int64, error) {
	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return 0, err
	}

	// If same currency, no conversion needed
	if wallet.Currency == user.PreferredCurrency {
		return wallet.Balance, nil
	}

	// Check cache first
	cachedValue, err := s.currencyCache.GetConvertedValue(ctx, userID, "wallet", wallet.ID, user.PreferredCurrency)
	if err == nil && cachedValue > 0 {
		return cachedValue, nil
	}

	// Cache miss - convert and cache
	convertedBalance, err := s.fxRateSvc.ConvertAmount(ctx, wallet.Balance, wallet.Currency, user.PreferredCurrency)
	if err != nil {
		return 0, fmt.Errorf("failed to convert balance: %w", err)
	}

	// Store in cache (non-blocking, log errors only)
	go func() {
		if err := s.currencyCache.SetConvertedValue(context.Background(), userID, "wallet", wallet.ID, user.PreferredCurrency, convertedBalance); err != nil {
			fmt.Printf("Warning: failed to cache converted balance for wallet %d: %v\n", wallet.ID, err)
		}
	}()

	return convertedBalance, nil
}

// populateWalletCache populates the currency cache for a wallet
// Called when wallet is created or updated
func (s *walletService) populateWalletCache(ctx context.Context, userID int32, wallet *models.Wallet) error {
	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// If same currency, no need to cache
	if wallet.Currency == user.PreferredCurrency {
		return nil
	}

	// Convert and cache
	convertedBalance, err := s.fxRateSvc.ConvertAmount(ctx, wallet.Balance, wallet.Currency, user.PreferredCurrency)
	if err != nil {
		return fmt.Errorf("failed to convert balance for caching: %w", err)
	}

	return s.currencyCache.SetConvertedValue(ctx, userID, "wallet", wallet.ID, user.PreferredCurrency, convertedBalance)
}

// invalidateWalletCache removes cached conversions for a wallet
// Called when wallet is updated or deleted
func (s *walletService) invalidateWalletCache(ctx context.Context, userID int32, walletID int32) error {
	return s.currencyCache.DeleteEntityCache(ctx, userID, "wallet", walletID)
}

// enrichWalletProto adds conversion fields to a wallet proto response
// This fetches the user's preferred currency and gets the converted balance from cache
// If cache is empty, performs on-the-fly conversion
func (s *walletService) enrichWalletProto(ctx context.Context, userID int32, walletProto *v1.Wallet, walletModel *models.Wallet) error {
	if s.currencyCache == nil {
		return nil
	}

	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return nil // Don't fail if user lookup fails
	}

	// If same currency, no conversion needed
	if walletModel.Currency == user.PreferredCurrency {
		return nil
	}

	// Try to get from cache first
	convertedBalance, err := s.currencyCache.GetConvertedValue(ctx, userID, "wallet", walletModel.ID, user.PreferredCurrency)
	if err != nil || convertedBalance == 0 {
		// Cache miss - perform on-the-fly conversion
		convertedBalance, err = s.fxRateSvc.ConvertAmount(ctx, walletModel.Balance, walletModel.Currency, user.PreferredCurrency)
		if err != nil {
			// Still don't fail - just skip the conversion
			return nil
		}
		// Cache the converted value for future requests
		_ = s.currencyCache.SetConvertedValue(ctx, userID, "wallet", walletModel.ID, user.PreferredCurrency, convertedBalance)
	}

	walletProto.DisplayBalance = &v1.Money{
		Amount:   convertedBalance,
		Currency: user.PreferredCurrency,
	}
	walletProto.DisplayCurrency = user.PreferredCurrency

	return nil
}

//nolint:unused
// enrichWalletSliceProto adds conversion fields to a slice of wallet proto responses
func (s *walletService) enrichWalletSliceProto(ctx context.Context, userID int32, walletProtos []*v1.Wallet, walletModels []*models.Wallet) {
	for i, walletProto := range walletProtos {
		if i < len(walletModels) {
			_ = s.enrichWalletProto(ctx, userID, walletProto, walletModels[i])
		}
	}
}

//nolint:unused
// getInvestmentValueWithCache retrieves investment value from cache or database
func (s *walletService) getInvestmentValueWithCache(ctx context.Context, walletID int32) (int64, error) {
	// Try cache first
	cacheKey := cache.GetInvestmentValueCacheKey(walletID)
	cachedValue, err := s.redisCache.Get(ctx, cacheKey).Int64()
	if err == nil {
		return cachedValue, nil
	}

	// Cache miss - fetch from database
	value, err := s.investmentRepo.GetInvestmentValue(ctx, walletID)
	if err != nil {
		return 0, err
	}

	// Store in cache
	s.redisCache.Set(ctx, cacheKey, value, time.Duration(cache.InvestmentValueCacheTTL)*time.Second)

	return value, nil
}

// getInvestmentValueInWalletCurrency calculates the total investment value for a wallet,
// converting each investment's value to the wallet's currency before summing.
// This ensures that the returned value is in a consistent currency matching the wallet.
func (s *walletService) getInvestmentValueInWalletCurrency(ctx context.Context, walletID int32, walletCurrency string) (int64, error) {
	// Fetch all investments for the wallet
	investments, _, err := s.investmentRepo.ListByWalletID(ctx, walletID, repository.ListOptions{
		Limit:  1000, // Get all investments
		Offset: 0,
	}, v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED)
	if err != nil {
		return 0, err
	}

	var totalValueInWalletCurrency int64 = 0

	// Sum each investment's value, converting to wallet currency if needed
	for _, inv := range investments {
		invValue := inv.CurrentValue
		invCurrency := inv.Currency
		if invCurrency == "" {
			invCurrency = "USD" // Default fallback
		}

		// Convert to wallet currency if different
		if invCurrency != walletCurrency {
			convertedValue, convErr := s.fxRateSvc.ConvertAmount(ctx, invValue, invCurrency, walletCurrency)
			if convErr != nil {
				// Log error but use original value to avoid losing data
				log.Printf("Warning: Failed to convert investment %d value from %s to %s: %v",
					inv.ID, invCurrency, walletCurrency, convErr)
				// Use original value (this will cause incorrect totals, but better than 0)
			} else {
				invValue = convertedValue
			}
		}

		totalValueInWalletCurrency += invValue
	}

	return totalValueInWalletCurrency, nil
}

// invalidateInvestmentValueCache clears the cached investment value for a wallet
func (s *walletService) invalidateInvestmentValueCache(ctx context.Context, walletID int32) {
	cacheKey := cache.GetInvestmentValueCacheKey(walletID)
	s.redisCache.Del(ctx, cacheKey)
}

//nolint:unused
// getInvestmentValuesForWallets batch fetches investment values for multiple wallets (with caching)
func (s *walletService) getInvestmentValuesForWallets(ctx context.Context, walletIDs []int32) (map[int32]int64, error) {
	if len(walletIDs) == 0 {
		return make(map[int32]int64), nil
	}

	valueMap := make(map[int32]int64, len(walletIDs))
	uncachedIDs := []int32{}

	// Try to get values from cache
	for _, walletID := range walletIDs {
		cacheKey := cache.GetInvestmentValueCacheKey(walletID)
		cachedValue, err := s.redisCache.Get(ctx, cacheKey).Int64()
		if err == nil {
			valueMap[walletID] = cachedValue
		} else {
			uncachedIDs = append(uncachedIDs, walletID)
		}
	}

	// Fetch uncached values from database
	if len(uncachedIDs) > 0 {
		dbValues, err := s.investmentRepo.GetInvestmentValuesByWalletIDs(ctx, uncachedIDs)
		if err != nil {
			return nil, err
		}

		// Merge and cache
		for walletID, value := range dbValues {
			valueMap[walletID] = value
			cacheKey := cache.GetInvestmentValueCacheKey(walletID)
			s.redisCache.Set(ctx, cacheKey, value, time.Duration(cache.InvestmentValueCacheTTL)*time.Second)
		}
	}

	return valueMap, nil
}

// convertToUserCurrency converts an amount from wallet currency to user's preferred currency
// Uses the FXRateService which properly handles decimal differences between currencies
func (s *walletService) convertToUserCurrency(amount int64, fromCurrency, toCurrency string) *v1.Money {
	if fromCurrency == toCurrency {
		return &v1.Money{Amount: amount, Currency: toCurrency}
	}

	// Use FXRateService.ConvertAmount which properly handles decimal multipliers
	// Example: VND (0 decimals) to USD (2 decimals) - rate is applied with proper scaling
	convertedAmount, err := s.fxRateSvc.ConvertAmount(context.Background(), amount, fromCurrency, toCurrency)
	if err != nil {
		// Return original amount if conversion fails
		return &v1.Money{Amount: amount, Currency: fromCurrency}
	}

	return &v1.Money{Amount: convertedAmount, Currency: toCurrency}
}
