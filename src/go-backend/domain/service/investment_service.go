package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	"wealthjourney/pkg/cache"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/gold"
	"wealthjourney/pkg/silver"
	"wealthjourney/pkg/types"
	"wealthjourney/pkg/units"
	"wealthjourney/pkg/validator"
	"wealthjourney/pkg/yahoo"
	v1 "wealthjourney/protobuf/v1"
)

// investmentService implements InvestmentService.
type investmentService struct {
	investmentRepo       repository.InvestmentRepository
	walletRepo           repository.WalletRepository
	txRepo               repository.InvestmentTransactionRepository
	marketDataService    MarketDataService
	userRepo             repository.UserRepository
	fxRateSvc            FXRateService
	currencyCache        *cache.CurrencyCache
	walletService        WalletService
	portfolioHistoryRepo repository.PortfolioHistoryRepository
	mapper               *InvestmentMapper
	goldConverter        *gold.Converter
	silverConverter      *silver.Converter
}

// NewInvestmentService creates a new InvestmentService.
func NewInvestmentService(
	investmentRepo repository.InvestmentRepository,
	walletRepo repository.WalletRepository,
	txRepo repository.InvestmentTransactionRepository,
	marketDataService MarketDataService,
	userRepo repository.UserRepository,
	fxRateSvc FXRateService,
	currencyCache *cache.CurrencyCache,
	walletService WalletService,
	portfolioHistoryRepo repository.PortfolioHistoryRepository,
) InvestmentService {
	return &investmentService{
		investmentRepo:       investmentRepo,
		walletRepo:           walletRepo,
		txRepo:               txRepo,
		marketDataService:    marketDataService,
		userRepo:             userRepo,
		fxRateSvc:            fxRateSvc,
		currencyCache:        currencyCache,
		walletService:        walletService,
		portfolioHistoryRepo: portfolioHistoryRepo,
		mapper:               NewInvestmentMapper(),
		goldConverter:        gold.NewGoldConverter(fxRateSvc),
		silverConverter:      silver.NewSilverConverter(fxRateSvc),
	}
}

// Helper methods for gold investment handling

//nolint:unused
// isGoldInvestment checks if an investment is a gold type
func (s *investmentService) isGoldInvestment(invType v1.InvestmentType) bool {
	return gold.IsGoldType(invType)
}

//nolint:unused
// getGoldStorageInfo returns the storage unit and native currency for a gold investment
func (s *investmentService) getGoldStorageInfo(invType v1.InvestmentType) (gold.GoldUnit, string) {
	return gold.GetNativeStorageInfo(invType)
}

// Helper methods for silver investment handling

//nolint:unused
// isSilverInvestment checks if an investment is a silver type
func (s *investmentService) isSilverInvestment(invType v1.InvestmentType) bool {
	return silver.IsSilverType(invType)
}

//nolint:unused
// getSilverStorageInfo returns the storage unit and native currency for a silver investment
func (s *investmentService) getSilverStorageInfo(invType v1.InvestmentType) (silver.SilverUnit, string) {
	return silver.GetNativeStorageInfo(invType)
}

// CreateInvestment creates a new investment holding in a wallet.
func (s *investmentService) CreateInvestment(ctx context.Context, userID int32, req *v1.CreateInvestmentRequest) (*v1.CreateInvestmentResponse, error) {
	// 1. Validate inputs
	if err := validator.ID(userID); err != nil {
		return nil, err
	}
	if req.Symbol == "" {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentSymbolRequired, "symbol is required")
	}
	if req.Name == "" {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentNameRequired, "name is required")
	}
	if err := validator.Currency(req.Currency); err != nil {
		return nil, err
	}

	// 1.5. walletId is now optional — 0 means no wallet association
	var walletIDPtr *int32
	if req.WalletId > 0 {
		// Verify wallet belongs to user
		_, err := s.walletRepo.GetByIDForUser(ctx, req.WalletId, userID)
		if err != nil {
			return nil, err
		}
		walletIDPtr = &req.WalletId
	}

	// Convert decimal inputs to integer format if provided
	// initialQuantityDecimal and initialCostDecimal take precedence over initialQuantity/initialCost
	initialQuantity := req.InitialQuantity
	initialCost := req.InitialCost

	if req.InitialQuantityDecimal > 0 {
		initialQuantity = units.QuantityToStorage(req.InitialQuantityDecimal, req.Type)
	}
	if req.InitialCostDecimal > 0 {
		// Use currency-aware conversion: VND has no cents, USD/EUR have 2 decimals
		initialCost = yahoo.ToSmallestCurrencyUnitByCurrency(req.InitialCostDecimal, req.Currency)
	}

	// Validate the converted values
	if initialQuantity <= 0 {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentQuantityPositive, "initialQuantity must be positive")
	}
	if initialCost <= 0 {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentPricePositive, "initialCost must be positive")
	}

	// Validate purchase_date if provided
	if req.PurchaseDate > 0 {
		purchaseTime := time.Unix(req.PurchaseDate, 0)
		if purchaseTime.After(time.Now()) {
			return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentTxDateFuture, "purchase date cannot be in the future")
		}
	}

	// 3. Check for duplicate symbol for user — auto-add as BUY transaction if exists
	existing, err := s.investmentRepo.GetByUserAndSymbol(ctx, userID, req.Symbol)
	if err == nil && existing != nil {
		// Validate currency matches existing investment
		if req.Currency != existing.Currency {
			return nil, apperrors.NewConflictErrorWithCodeAndParams(
				apperrors.Codes.InvestmentDuplicate,
				fmt.Sprintf("Investment %s already exists with currency %s", req.Symbol, existing.Currency),
				map[string]string{"symbol": req.Symbol, "currency": existing.Currency},
			)
		}

		// Calculate per-unit price for the AddTransaction request
		var perUnitPrice int64
		if initialQuantity > 0 {
			perUnitPrice = units.CalculateAverageCost(initialCost, initialQuantity, req.Type)
		}

		// Determine transaction date as Unix timestamp
		var txTimestamp int64
		if req.PurchaseDate > 0 {
			txTimestamp = req.PurchaseDate
		} else {
			txTimestamp = time.Now().Unix()
		}

		addReq := &v1.AddTransactionRequest{
			InvestmentId:    existing.ID,
			Type:            v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY,
			Quantity:        initialQuantity,
			Price:           perUnitPrice,
			Fees:            0,
			TransactionDate: txTimestamp,
			Notes:           "Additional purchase",
		}

		addResp, err := s.AddTransaction(ctx, userID, addReq)
		if err != nil {
			return nil, err
		}

		return &v1.CreateInvestmentResponse{
			Success:   true,
			Message:   "Transaction added to existing investment",
			Data:      addResp.UpdatedInvestment,
			Timestamp: time.Now().Format(time.RFC3339),
		}, nil
	}

	// 5. Calculate initial average cost using utility function
	// Average cost is stored as "cents per whole unit" (e.g., cents per BTC, cents per share)
	var averageCost int64 = 0
	if initialQuantity > 0 {
		averageCost = units.CalculateAverageCost(initialCost, initialQuantity, req.Type)
	}

	// 5.5. Custom investment handling
	// Custom investments (isCustom=true):
	// - Skip market data API validation
	// - Allow currentPrice = 0 (user can update manually later)
	// - Require manual currency selection
	// Market-based investments (isCustom=false):
	// - Set currentPrice to averageCost initially
	// - Fetch updates from market data APIs
	var currentPrice int64
	if req.IsCustom {
		// Custom investments: allow currentPrice = 0, skip market data validation
		currentPrice = 0
	} else {
		// Market-based investments: set currentPrice to averageCost as before
		currentPrice = averageCost
	}

	// CASH and FOREIGN_CURRENCY: seed with average cost even when custom,
	// so CurrentValue = TotalCost and UnrealizedPNL = 0 (not -100%)
	if req.Type == v1.InvestmentType_INVESTMENT_TYPE_CASH ||
		req.Type == v1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY {
		currentPrice = averageCost
	}

	// 6. Create investment model
	investment := &models.Investment{
		UserID:       userID,
		WalletID:     walletIDPtr,
		Symbol:       req.Symbol,
		Name:         req.Name,
		Type:         int32(req.Type), // Convert enum to int32 for database storage
		Quantity:     initialQuantity,
		AverageCost:  averageCost,
		TotalCost:    initialCost,
		Currency:     req.Currency,
		CurrentPrice: currentPrice, // 0 for custom investments, averageCost for market-based
		RealizedPNL:  0,
		PurchaseUnit: req.PurchaseUnit, // Store user's purchase unit for display
		IsCustom:     req.IsCustom,     // Store custom flag for filtering in auto-updates
	}

	// 7. Persist investment
	if err := s.investmentRepo.Create(ctx, investment); err != nil {
		return nil, err
	}

	// Determine transaction date
	txDate := time.Now()
	if req.PurchaseDate > 0 {
		txDate = time.Unix(req.PurchaseDate, 0)
	}

	// 8. Create initial buy transaction
	tx := &models.InvestmentTransaction{
		InvestmentID:    investment.ID,
		UserID:          userID,
		WalletID:        walletIDPtr,
		Type:            int32(v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY),
		Quantity:        initialQuantity,
		Price:           averageCost,
		Cost:            initialCost,
		Fees:            0,
		TransactionDate: txDate,
		Notes:           "Initial investment",
	}

	if err := s.txRepo.Create(ctx, tx); err != nil {
		// Rollback investment creation
		_ = s.investmentRepo.Delete(ctx, investment.ID)
		return nil, apperrors.NewInternalErrorWithCause("failed to create investment transaction", err)
	}

	// 9. Create initial lot for FIFO tracking
	lot := &models.InvestmentLot{
		InvestmentID:      investment.ID,
		Quantity:          initialQuantity,
		RemainingQuantity: initialQuantity,
		AverageCost:       averageCost,
		TotalCost:         initialCost,
		PurchasedAt:       txDate,
	}

	if err := s.txRepo.CreateLot(ctx, lot); err != nil {
		// Rollback
		_ = s.txRepo.Delete(ctx, tx.ID)
		_ = s.investmentRepo.Delete(ctx, investment.ID)
		return nil, apperrors.NewInternalErrorWithCause("failed to create investment lot", err)
	}

	// 10. Update transaction with lot ID
	tx.LotID = &lot.ID
	tx.RemainingQuantity = initialQuantity
	if err := s.txRepo.Update(ctx, tx); err != nil {
		// Log error but don't fail - transaction is created
		fmt.Printf("Warning: failed to update transaction with lot ID: %v\n", err)
	}

	// Populate currency cache
	if err := s.populateInvestmentCache(ctx, userID, investment); err != nil {
		// Log error but don't fail - cache population is not critical
		fmt.Printf("Warning: failed to populate currency cache for investment %d: %v\n", investment.ID, err)
	}

	// Invalidate wallet investment value cache (only if wallet is associated)
	if walletIDPtr != nil {
		if ws, ok := s.walletService.(*walletService); ok {
			ws.invalidateInvestmentValueCache(ctx, *walletIDPtr)
		}
	}

	// Backfill portfolio history snapshot at purchase date for period PNL accuracy.
	// When an investment is created with a past purchase date, we create a snapshot
	// so that period PNL calculations have a baseline including this investment.
	if req.PurchaseDate > 0 && walletIDPtr != nil {
		summary, err := s.GetPortfolioSummary(ctx, *walletIDPtr, userID, 0)
		if err == nil && summary.Data != nil {
			snapshot := &models.PortfolioHistory{
				UserID:     userID,
				WalletID:   *walletIDPtr,
				TotalValue: summary.Data.TotalValue,
				TotalCost:  summary.Data.TotalCost,
				TotalPnl:   summary.Data.TotalPnl,
				Currency:   summary.Data.Currency,
				Timestamp:  txDate,
			}
			if _, err := s.portfolioHistoryRepo.CreateSnapshotIfNotDuplicate(ctx, snapshot); err != nil {
				fmt.Printf("Warning: failed to backfill portfolio snapshot at purchase date: %v\n", err)
			}
		}
	}

	invProto := s.mapper.ModelToProto(investment)
	// Enrich with conversion fields
	s.enrichInvestmentProto(ctx, userID, invProto, investment)

	return &v1.CreateInvestmentResponse{
		Success:   true,
		Message:   "Investment created successfully",
		Data:      invProto,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetInvestment retrieves an investment by ID, ensuring it belongs to the user.
func (s *investmentService) GetInvestment(ctx context.Context, investmentID int32, requestingUserID int32) (*v1.GetInvestmentResponse, error) {
	if err := validator.ID(investmentID); err != nil {
		return nil, err
	}
	if err := validator.ID(requestingUserID); err != nil {
		return nil, err
	}

	investment, err := s.investmentRepo.GetByIDForUser(ctx, investmentID, requestingUserID)
	if err != nil {
		return nil, err
	}

	invProto := s.mapper.ModelToProto(investment)
	// Enrich with conversion fields
	s.enrichInvestmentProto(ctx, requestingUserID, invProto, investment)

	return &v1.GetInvestmentResponse{
		Success:   true,
		Message:   "Investment retrieved successfully",
		Data:      invProto,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ListInvestments retrieves all investments for a wallet with pagination and filtering.
func (s *investmentService) ListInvestments(ctx context.Context, userID int32, req *v1.ListInvestmentsRequest) (*v1.ListInvestmentsResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}
	if err := validator.ID(req.WalletId); err != nil {
		return nil, err
	}

	// Verify wallet belongs to user
	_, err := s.walletRepo.GetByIDForUser(ctx, req.WalletId, userID)
	if err != nil {
		return nil, err
	}

	// Parse pagination parameters from protobuf
	params := types.PaginationParams{
		Page:     int(req.Pagination.Page),
		PageSize: int(req.Pagination.PageSize),
		OrderBy:  req.Pagination.OrderBy,
		Order:    req.Pagination.Order,
	}
	params = params.Validate()

	opts := repository.ListOptions{
		Limit:   params.Limit(),
		Offset:  params.Offset(),
		OrderBy: params.OrderBy,
		Order:   params.Order,
	}

	// Get type filter
	typeFilter := v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED
	if req.TypeFilter != 0 {
		typeFilter = req.TypeFilter
	}

	// List investments
	investments, total, err := s.investmentRepo.ListByWalletID(ctx, req.WalletId, opts, typeFilter)
	if err != nil {
		return nil, err
	}

	protoInvestments := s.mapper.ModelSliceToProto(investments)
	// Enrich with conversion fields
	s.enrichInvestmentSliceProto(ctx, userID, protoInvestments, investments)

	paginationResult := types.NewPaginationResult(params.Page, params.PageSize, total)

	return &v1.ListInvestmentsResponse{
		Success:    true,
		Message:    "Investments retrieved successfully",
		Data:       protoInvestments,
		Pagination: s.mapper.PaginationResultToProto(paginationResult),
		Timestamp:  time.Now().Format(time.RFC3339),
	}, nil
}

// UpdateInvestment updates an investment's details (manual price override).
func (s *investmentService) UpdateInvestment(ctx context.Context, investmentID int32, userID int32, req *v1.UpdateInvestmentRequest) (*v1.UpdateInvestmentResponse, error) {
	if err := validator.ID(investmentID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get investment and verify ownership
	investment, err := s.investmentRepo.GetByIDForUser(ctx, investmentID, userID)
	if err != nil {
		return nil, err
	}

	// Track if we need to update the investment
	needsUpdate := false

	// Update allowed fields
	if req.Name != "" {
		investment.Name = req.Name
		needsUpdate = true
	}

	// Manual price override - use same method as auto-updates for consistency
	if req.CurrentPrice >= 0 {
		// Allow setting price to 0 (for custom investments or clearing stale prices)
		// Use UpdatePrices repository method (same as auto-update path)
		updates := []repository.PriceUpdate{
			{
				InvestmentID: investmentID,
				Price:        req.CurrentPrice,
				Timestamp:    time.Now().Unix(),
			},
		}

		if err := s.investmentRepo.UpdatePrices(ctx, updates); err != nil {
			return nil, apperrors.NewInternalErrorWithCause("failed to update investment price", err)
		}

		// Refresh investment to get recalculated values
		investment, err = s.investmentRepo.GetByIDForUser(ctx, investmentID, userID)
		if err != nil {
			return nil, err
		}

		log.Printf("Manual price update: investment %d (%s) set to %d (user %d)",
			investmentID, investment.Symbol, req.CurrentPrice, userID)
		needsUpdate = false // Price already updated via UpdatePrices
	}

	// Update other fields if changed
	if needsUpdate {
		if err := s.investmentRepo.Update(ctx, investment); err != nil {
			return nil, err
		}
	}

	// Invalidate and repopulate currency cache
	if err := s.invalidateInvestmentCache(ctx, userID, investmentID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for investment %d: %v\n", investmentID, err)
	}
	if err := s.populateInvestmentCache(ctx, userID, investment); err != nil {
		fmt.Printf("Warning: failed to populate currency cache for investment %d: %v\n", investment.ID, err)
	}

	invProto := s.mapper.ModelToProto(investment)
	// Enrich with conversion fields
	s.enrichInvestmentProto(ctx, userID, invProto, investment)

	return &v1.UpdateInvestmentResponse{
		Success:   true,
		Message:   "Investment updated successfully",
		Data:      invProto,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// DeleteInvestment deletes an investment.
func (s *investmentService) DeleteInvestment(ctx context.Context, investmentID int32, userID int32) (*v1.DeleteInvestmentResponse, error) {
	if err := validator.ID(investmentID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get investment and verify ownership
	investment, err := s.investmentRepo.GetByIDForUser(ctx, investmentID, userID)
	if err != nil {
		return nil, err
	}

	// Delete all related transactions first (cascade)
	if err := s.txRepo.DeleteByInvestmentID(ctx, investmentID); err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to delete transactions", err)
	}

	// Delete all related lots (cascade)
	if err := s.txRepo.DeleteLotsByInvestmentID(ctx, investmentID); err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to delete lots", err)
	}

	// Delete investment
	if err := s.investmentRepo.Delete(ctx, investmentID); err != nil {
		return nil, err
	}

	// Invalidate currency cache
	if err := s.invalidateInvestmentCache(ctx, userID, investmentID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for investment %d: %v\n", investmentID, err)
	}

	// Invalidate wallet investment value cache (only if wallet is associated)
	if investment.WalletID != nil {
		if ws, ok := s.walletService.(*walletService); ok {
			ws.invalidateInvestmentValueCache(ctx, *investment.WalletID)
		}
	}

	return &v1.DeleteInvestmentResponse{
		Success:   true,
		Message:   fmt.Sprintf("Investment %s deleted successfully with all related data", investment.Symbol),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// AddTransaction adds a buy/sell transaction to an investment with FIFO cost basis tracking.
func (s *investmentService) AddTransaction(ctx context.Context, userID int32, req *v1.AddTransactionRequest) (*v1.AddTransactionResponse, error) {
	// 1. Validate inputs
	if err := validator.ID(req.InvestmentId); err != nil {
		return nil, err
	}
	if req.Quantity <= 0 {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentQuantityPositive, "quantity must be positive")
	}
	if req.Price <= 0 {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentPricePositive, "price must be positive")
	}
	if req.Type == v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_UNSPECIFIED {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentTxTypeRequired, "transaction type must be specified")
	}
	// Validate transaction date is not in the future
	transactionTime := time.Unix(req.TransactionDate, 0)
	if transactionTime.After(time.Now()) {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentTxDateFuture, "transaction date cannot be in the future")
	}

	// 2. Get investment and verify ownership
	investment, err := s.investmentRepo.GetByIDForUser(ctx, req.InvestmentId, userID)
	if err != nil {
		return nil, err
	}

	// 3. Investment ownership already verified via GetByIDForUser (uses user_id directly)

	// 4. Calculate transaction cost using utility function
	cost := units.CalculateTransactionCost(req.Quantity, req.Price, v1.InvestmentType(investment.Type))
	totalCost := cost + req.Fees

	// 5. Handle transaction type
	var updatedInvestment *models.Investment
	switch req.Type {
	case v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY:
		updatedInvestment, err = s.processBuyTransaction(ctx, investment, req, cost, totalCost)
		if err != nil {
			return nil, err
		}

	case v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL:
		updatedInvestment, err = s.processSellTransaction(ctx, investment, req)
		if err != nil {
			return nil, err
		}

	case v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_DIVIDEND:
		var tx *models.InvestmentTransaction
		updatedInvestment, tx, err = s.processDividendTransaction(ctx, investment, req)
		if err != nil {
			return nil, err
		}
		// Return early with the transaction for dividend
		txProto := s.mapper.TransactionToProto(tx)
		s.enrichTransactionProto(ctx, userID, txProto, investment.Currency)
		updatedInvProto := s.mapper.ModelToProto(updatedInvestment)
		s.enrichInvestmentProto(ctx, userID, updatedInvProto, updatedInvestment)
		return &v1.AddTransactionResponse{
			Success:           true,
			Message:           "Dividend transaction added successfully",
			Data:              txProto,
			UpdatedInvestment: updatedInvProto,
			Timestamp:         time.Now().Format(time.RFC3339),
		}, nil

	default:
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentTxTypeRequired, "unsupported transaction type")
	}

	// Invalidate and repopulate currency cache
	if err := s.invalidateInvestmentCache(ctx, userID, req.InvestmentId); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for investment %d: %v\n", req.InvestmentId, err)
	}
	// Get updated investment for cache population
	updatedInv, _ := s.investmentRepo.GetByID(ctx, req.InvestmentId)
	if updatedInv != nil {
		if err := s.populateInvestmentCache(ctx, userID, updatedInv); err != nil {
			fmt.Printf("Warning: failed to populate currency cache for investment %d: %v\n", updatedInv.ID, err)
		}
	}

	// Invalidate wallet investment value cache (only if wallet is associated)
	if investment.WalletID != nil {
		if ws, ok := s.walletService.(*walletService); ok {
			ws.invalidateInvestmentValueCache(ctx, *investment.WalletID)
		}
	}

	// Get the created transaction for response
	transactions, _, err := s.txRepo.ListByInvestmentID(ctx, investment.ID, nil, repository.ListOptions{
		Limit:   1,
		OrderBy: "created_at",
		Order:   "desc",
	})
	if err != nil || len(transactions) == 0 {
		updatedInvProto := s.mapper.ModelToProto(updatedInvestment)
		s.enrichInvestmentProto(ctx, userID, updatedInvProto, updatedInvestment)
		return &v1.AddTransactionResponse{
			Success:           true,
			Message:           "Transaction added successfully",
			UpdatedInvestment: updatedInvProto,
			Timestamp:         time.Now().Format(time.RFC3339),
		}, nil
	}

	txProto := s.mapper.TransactionToProto(transactions[0])
	s.enrichTransactionProto(ctx, userID, txProto, investment.Currency)
	updatedInvProto := s.mapper.ModelToProto(updatedInvestment)
	s.enrichInvestmentProto(ctx, userID, updatedInvProto, updatedInvestment)

	return &v1.AddTransactionResponse{
		Success:           true,
		Message:           "Transaction added successfully",
		Data:              txProto,
		UpdatedInvestment: updatedInvProto,
		Timestamp:         time.Now().Format(time.RFC3339),
	}, nil
}

// processBuyTransaction handles a buy transaction with lot creation.
func (s *investmentService) processBuyTransaction(ctx context.Context, investment *models.Investment, req *v1.AddTransactionRequest, cost, totalCost int64) (*models.Investment, error) {
	// Get open lots to see if we can update the most recent one
	openLots, err := s.txRepo.GetOpenLots(ctx, investment.ID)
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to get open lots", err)
	}

	var lot *models.InvestmentLot
	updateExistingLot := false

	// Check if there's a recent lot we can update (same day purchase)
	if len(openLots) > 0 {
		mostRecentLot := openLots[len(openLots)-1]
		timeSincePurchase := time.Since(mostRecentLot.PurchasedAt)
		// Update lot if purchased within 24 hours (same trading day)
		if timeSincePurchase < 24*time.Hour {
			lot = mostRecentLot
			updateExistingLot = true
		}
	}

	// Create new lot if no recent lot found
	if lot == nil {
		lot = &models.InvestmentLot{
			InvestmentID: investment.ID,
			Quantity:     req.Quantity,
			TotalCost:    totalCost,
			PurchasedAt:  time.Unix(req.TransactionDate, 0),
		}
		// Calculate average cost using utility function
		// This works correctly for all investment types including gold:
		// - Gold (VND): totalCost in VND, quantity in grams×10000, returns VND per gram
		// - Gold (USD): totalCost in cents, quantity in oz×10000, returns cents per oz
		// - Stocks: totalCost in cents, quantity in shares×100, returns cents per share
		lot.AverageCost = units.CalculateAverageCost(totalCost, req.Quantity, v1.InvestmentType(investment.Type))
		lot.RemainingQuantity = req.Quantity
	} else {
		// Update existing lot
		lot.Quantity += req.Quantity
		lot.TotalCost += totalCost
		// Recalculate average cost using utility function
		lot.AverageCost = units.CalculateAverageCost(lot.TotalCost, lot.Quantity, v1.InvestmentType(investment.Type))
		lot.RemainingQuantity = lot.Quantity
	}

	// Persist lot
	var lotErr error
	if updateExistingLot {
		lotErr = s.txRepo.UpdateLot(ctx, lot)
	} else {
		lotErr = s.txRepo.CreateLot(ctx, lot)
	}
	if lotErr != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to save investment lot", lotErr)
	}

	// Create transaction record
	tx := &models.InvestmentTransaction{
		InvestmentID:      investment.ID,
		UserID:            investment.UserID,
		WalletID:          investment.WalletID, // Already *int32 after model change
		Type:              int32(v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY),
		Quantity:          req.Quantity,
		Price:             req.Price,
		Cost:              cost,
		Fees:              req.Fees,
		TransactionDate:   time.Unix(req.TransactionDate, 0),
		Notes:             req.Notes,
		LotID:             &lot.ID,
		RemainingQuantity: lot.RemainingQuantity,
	}

	if err := s.txRepo.Create(ctx, tx); err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to create transaction", err)
	}

	// Update investment
	investment.Quantity += req.Quantity
	investment.TotalCost += totalCost
	// Calculate average cost using utility function
	investment.AverageCost = units.CalculateAverageCost(investment.TotalCost, investment.Quantity, v1.InvestmentType(investment.Type))

	if err := s.investmentRepo.Update(ctx, investment); err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to update investment", err)
	}

	return investment, nil
}

// processSellTransaction handles a sell transaction with FIFO lot consumption.
func (s *investmentService) processSellTransaction(ctx context.Context, investment *models.Investment, req *v1.AddTransactionRequest) (*models.Investment, error) {
	// Validate sufficient quantity
	if investment.Quantity < req.Quantity {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentQuantityPositive, fmt.Sprintf("insufficient quantity: owned %d, trying to sell %d", investment.Quantity, req.Quantity))
	}

	// Get open lots (FIFO order by purchased_at ASC)
	openLots, err := s.txRepo.GetOpenLots(ctx, investment.ID)
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to get open lots", err)
	}

	if len(openLots) == 0 {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentQuantityPositive, "no open lots available for selling")
	}

	// Calculate total available quantity
	totalAvailable := int64(0)
	for _, lot := range openLots {
		totalAvailable += lot.RemainingQuantity
	}

	if totalAvailable < req.Quantity {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentQuantityPositive, fmt.Sprintf("insufficient quantity in lots: available %d, trying to sell %d", totalAvailable, req.Quantity))
	}

	// FIFO: Consume from oldest lots first
	quantityToSell := req.Quantity
	realizedPNL := int64(0)
	sellPrice := req.Price

	for _, lot := range openLots {
		if quantityToSell <= 0 {
			break
		}

		if lot.RemainingQuantity == 0 {
			continue
		}

		// Calculate quantity to consume from this lot
		consumeFromLot := quantityToSell
		if consumeFromLot > lot.RemainingQuantity {
			consumeFromLot = lot.RemainingQuantity
		}

		// Calculate realized PNL for this lot using utility function
		// Convert consumeFromLot from smallest units to whole units
		precision := units.GetPrecisionForInvestmentType(v1.InvestmentType(investment.Type))
		consumeFromLotWholeUnits := float64(consumeFromLot) / float64(precision)
		lotCostBasis := float64(lot.AverageCost) * consumeFromLotWholeUnits
		lotSellValue := float64(sellPrice) * consumeFromLotWholeUnits
		lotPNL := units.CalculateRealizedPNL(int64(lotCostBasis), int64(lotSellValue))
		realizedPNL += lotPNL

		// Update lot
		lot.RemainingQuantity -= consumeFromLot
		if err := s.txRepo.UpdateLot(ctx, lot); err != nil {
			return nil, apperrors.NewInternalErrorWithCause("failed to update lot", err)
		}

		quantityToSell -= consumeFromLot
	}

	// Subtract fees from realized PNL
	realizedPNL -= req.Fees

	// Calculate total proceeds (sale value) for the transaction record
	// Cost for a sell transaction represents the total sale proceeds
	totalProceeds := units.CalculateTransactionCost(req.Quantity, req.Price, v1.InvestmentType(investment.Type))

	// Create transaction record
	tx := &models.InvestmentTransaction{
		InvestmentID:    investment.ID,
		UserID:          investment.UserID,
		WalletID:        investment.WalletID,
		Type:            int32(v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL),
		Quantity:        req.Quantity,
		Price:           req.Price,
		Cost:            totalProceeds,
		Fees:            req.Fees,
		TransactionDate: time.Unix(req.TransactionDate, time.Now().Unix()%int64(time.Second)),
		Notes:           req.Notes,
	}

	if len(openLots) > 0 {
		tx.LotID = &openLots[0].ID // Track the first lot consumed
	}

	if err := s.txRepo.Create(ctx, tx); err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to create transaction", err)
	}

	// Update investment
	investment.Quantity -= req.Quantity
	investment.RealizedPNL += realizedPNL

	// CRITICAL: DO NOT recalculate TotalCost or AverageCost on sell
	// In FIFO cost basis accounting:
	// - TotalCost represents the cumulative cost of all purchases (cost basis)
	// - AverageCost is the weighted average of all buy transactions
	// - When selling, only Quantity decreases and RealizedPNL increases
	// - TotalCost and AverageCost MUST remain unchanged to maintain proper cost basis
	//
	// Example:
	//   Buy 100 shares @ $150: Quantity=100, TotalCost=$15,000, AvgCost=$150
	//   Sell 30 shares @ $170: Quantity=70, TotalCost=$15,000 (UNCHANGED), AvgCost=$150 (UNCHANGED)
	//   Realized PNL: 30 * ($170 - $150) = $600
	//
	// Edge case: If quantity reaches zero, we still preserve TotalCost and AverageCost
	// for historical tracking. They won't be used for PNL calculations when Quantity=0,
	// but they maintain accurate cost basis if more shares are purchased later.

	if err := s.investmentRepo.Update(ctx, investment); err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to update investment", err)
	}

	return investment, nil
}

// processDividendTransaction handles dividend transactions
// Dividend calculation: totalDividend = quantity × price
// - quantity = number of shares at dividend date
// - price = dividend per share (e.g., $0.50 per share)
func (s *investmentService) processDividendTransaction(ctx context.Context, investment *models.Investment, req *v1.AddTransactionRequest) (*models.Investment, *models.InvestmentTransaction, error) {
	// Calculate total dividend amount
	totalDividend := units.CalculateTransactionCost(req.Quantity, req.Price, v1.InvestmentType(investment.Type))

	// Create dividend transaction record
	tx := &models.InvestmentTransaction{
		InvestmentID:    investment.ID,
		UserID:          investment.UserID,
		WalletID:        investment.WalletID,
		Type:            int32(v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_DIVIDEND),
		Quantity:        req.Quantity,
		Price:           req.Price,
		Cost:            totalDividend,
		Fees:            0, // Dividends typically have no fees
		TransactionDate: time.Unix(req.TransactionDate, 0),
		Notes:           req.Notes,
	}

	if err := s.txRepo.Create(ctx, tx); err != nil {
		return nil, nil, apperrors.NewInternalErrorWithCause("failed to create dividend transaction", err)
	}

	// Update investment's total dividends
	investment.TotalDividends += totalDividend
	if err := s.investmentRepo.Update(ctx, investment); err != nil {
		// Rollback: delete transaction
		_ = s.txRepo.Delete(ctx, tx.ID)
		return nil, nil, apperrors.NewInternalErrorWithCause("failed to update investment dividends", err)
	}

	return investment, tx, nil
}

// ListTransactions retrieves transactions for an investment.
func (s *investmentService) ListTransactions(ctx context.Context, userID int32, req *v1.ListInvestmentTransactionsRequest) (*v1.ListInvestmentTransactionsResponse, error) {
	if err := validator.ID(req.InvestmentId); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get investment and verify ownership
	investment, err := s.investmentRepo.GetByIDForUser(ctx, req.InvestmentId, userID)
	if err != nil {
		return nil, err
	}
	_ = investment // Used for ownership verification

	// Parse pagination parameters from protobuf
	params := types.PaginationParams{
		Page:     int(req.Pagination.Page),
		PageSize: int(req.Pagination.PageSize),
		OrderBy:  req.Pagination.OrderBy,
		Order:    req.Pagination.Order,
	}
	params = params.Validate()

	opts := repository.ListOptions{
		Limit:   params.Limit(),
		Offset:  params.Offset(),
		OrderBy: params.OrderBy,
		Order:   params.Order,
	}

	// Get type filter
	var typeFilter *v1.InvestmentTransactionType
	if req.TypeFilter != 0 {
		typeFilter = &req.TypeFilter
	}

	// List transactions
	transactions, total, err := s.txRepo.ListByInvestmentID(ctx, req.InvestmentId, typeFilter, opts)
	if err != nil {
		return nil, err
	}

	protoTransactions := s.mapper.TransactionSliceToProto(transactions)
	// Enrich with conversion fields
	s.enrichTransactionSliceProto(ctx, userID, protoTransactions, investment.Currency)
	paginationResult := types.NewPaginationResult(params.Page, params.PageSize, total)

	return &v1.ListInvestmentTransactionsResponse{
		Success:    true,
		Message:    "Transactions retrieved successfully",
		Data:       protoTransactions,
		Pagination: s.mapper.PaginationResultToProto(paginationResult),
		Timestamp:  time.Now().Format(time.RFC3339),
	}, nil
}

// EditTransaction edits an existing transaction.
func (s *investmentService) EditTransaction(ctx context.Context, transactionID int32, userID int32, req *v1.EditInvestmentTransactionRequest) (*v1.EditInvestmentTransactionResponse, error) {
	if err := validator.ID(transactionID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get transaction and verify ownership
	tx, err := s.txRepo.GetByIDForUser(ctx, transactionID, userID)
	if err != nil {
		return nil, err
	}

	// Get the parent investment for currency information
	investment, err := s.investmentRepo.GetByID(ctx, tx.InvestmentID)
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to get parent investment", err)
	}

	// Note: Editing transactions is complex with FIFO tracking
	// For now, we only allow editing notes
	if req.Notes != "" {
		tx.Notes = req.Notes
	}

	if err := s.txRepo.Update(ctx, tx); err != nil {
		return nil, err
	}

	txProto := s.mapper.TransactionToProto(tx)
	s.enrichTransactionProto(ctx, userID, txProto, investment.Currency)

	return &v1.EditInvestmentTransactionResponse{
		Success:   true,
		Message:   "Transaction updated successfully",
		Data:      txProto,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// DeleteTransaction deletes a transaction and recalculates the parent investment.
func (s *investmentService) DeleteTransaction(ctx context.Context, transactionID int32, userID int32) (*v1.DeleteInvestmentTransactionResponse, error) {
	if err := validator.ID(transactionID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get transaction and verify ownership
	tx, err := s.txRepo.GetByIDForUser(ctx, transactionID, userID)
	if err != nil {
		return nil, err
	}

	// Get the parent investment
	investment, err := s.investmentRepo.GetByID(ctx, tx.InvestmentID)
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to get parent investment", err)
	}

	// Handle based on transaction type
	switch v1.InvestmentTransactionType(tx.Type) {
	case v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY:
		if err := s.reverseBuyTransaction(ctx, investment, tx); err != nil {
			return nil, err
		}
	case v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL:
		if err := s.reverseSellTransaction(ctx, investment, tx); err != nil {
			return nil, err
		}
	case v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_DIVIDEND:
		if err := s.reverseDividendTransaction(ctx, investment, tx); err != nil {
			return nil, err
		}
	default:
		// For split and other types, just delete the transaction without recalculation
	}

	// Delete transaction
	if err := s.txRepo.Delete(ctx, transactionID); err != nil {
		return nil, err
	}

	// Invalidate currency cache
	if err := s.invalidateInvestmentCache(ctx, userID, tx.InvestmentID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for investment %d: %v\n", tx.InvestmentID, err)
	}

	// Invalidate wallet investment value cache (only if wallet is associated)
	if investment.WalletID != nil {
		if ws, ok := s.walletService.(*walletService); ok {
			ws.invalidateInvestmentValueCache(ctx, *investment.WalletID)
		}
	}

	return &v1.DeleteInvestmentTransactionResponse{
		Success:   true,
		Message:   "Transaction deleted successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// reverseBuyTransaction reverses a buy transaction by updating the lot and investment.
func (s *investmentService) reverseBuyTransaction(ctx context.Context, investment *models.Investment, tx *models.InvestmentTransaction) error {
	// If transaction has a LotID, update that specific lot
	if tx.LotID != nil {
		lot, err := s.txRepo.GetLotByID(ctx, *tx.LotID)
		if err != nil {
			return apperrors.NewInternalErrorWithCause("failed to get lot", err)
		}

		// Reduce lot quantity
		lot.Quantity -= tx.Quantity
		lot.RemainingQuantity -= tx.Quantity
		if lot.RemainingQuantity < 0 {
			lot.RemainingQuantity = 0
		}
		lot.TotalCost -= tx.Cost

		// Recalculate average cost if still has quantity
		if lot.Quantity > 0 {
			lot.AverageCost = units.CalculateAverageCost(lot.TotalCost, lot.Quantity, v1.InvestmentType(investment.Type))
		} else {
			lot.AverageCost = 0
		}

		if err := s.txRepo.UpdateLot(ctx, lot); err != nil {
			return apperrors.NewInternalErrorWithCause("failed to update lot", err)
		}
	}

	// Update investment totals
	investment.Quantity -= tx.Quantity
	investment.TotalCost -= tx.Cost

	// Recalculate average cost if still has quantity
	if investment.Quantity > 0 {
		investment.AverageCost = units.CalculateAverageCost(investment.TotalCost, investment.Quantity, v1.InvestmentType(investment.Type))
	} else {
		investment.AverageCost = 0
		investment.TotalCost = 0
	}

	if err := s.investmentRepo.Update(ctx, investment); err != nil {
		return apperrors.NewInternalErrorWithCause("failed to update investment", err)
	}

	return nil
}

// reverseSellTransaction reverses a sell transaction by restoring the lot and investment.
func (s *investmentService) reverseSellTransaction(ctx context.Context, investment *models.Investment, tx *models.InvestmentTransaction) error {
	// If transaction has a LotID, restore quantity to that lot
	if tx.LotID != nil {
		lot, err := s.txRepo.GetLotByID(ctx, *tx.LotID)
		if err != nil {
			return apperrors.NewInternalErrorWithCause("failed to get lot", err)
		}

		// Restore lot quantity
		lot.RemainingQuantity += tx.Quantity

		if err := s.txRepo.UpdateLot(ctx, lot); err != nil {
			return apperrors.NewInternalErrorWithCause("failed to update lot", err)
		}
	}

	// Update investment - add back the sold quantity
	investment.Quantity += tx.Quantity

	// Calculate the realized PNL that was recorded for this sell
	// We need to reverse it from the investment's realized PNL
	// The realized PNL for this sale = sell proceeds - cost basis
	// Cost basis = tx.Quantity * lot.AverageCost (at time of sale)
	// Since we don't have the exact cost basis stored, we approximate
	// by calculating from the sale: sell_value - realized_pnl = cost_basis
	// For now, we recalculate from remaining lots

	// Get total cost from remaining open lots
	openLots, err := s.txRepo.GetOpenLots(ctx, investment.ID)
	if err == nil && len(openLots) > 0 {
		totalCost := int64(0)
		totalQty := int64(0)
		precision := int64(units.GetPrecisionForInvestmentType(v1.InvestmentType(investment.Type)))
		for _, lot := range openLots {
			if lot.RemainingQuantity > 0 {
				// Calculate cost for remaining quantity in this lot
				lotCost := lot.AverageCost * lot.RemainingQuantity / precision
				totalCost += lotCost
				totalQty += lot.RemainingQuantity
			}
		}
		if totalQty > 0 {
			investment.TotalCost = totalCost
			investment.AverageCost = units.CalculateAverageCost(totalCost, totalQty, v1.InvestmentType(investment.Type))
		}
	}

	if err := s.investmentRepo.Update(ctx, investment); err != nil {
		return apperrors.NewInternalErrorWithCause("failed to update investment", err)
	}

	return nil
}

// reverseDividendTransaction reverses a dividend transaction when deleted
func (s *investmentService) reverseDividendTransaction(ctx context.Context, investment *models.Investment, tx *models.InvestmentTransaction) error {
	// Reduce investment's total dividends
	investment.TotalDividends -= tx.Cost
	if investment.TotalDividends < 0 {
		investment.TotalDividends = 0 // Safety guard
	}

	if err := s.investmentRepo.Update(ctx, investment); err != nil {
		return apperrors.NewInternalErrorWithCause("failed to update investment dividends", err)
	}

	return nil
}

// GetPortfolioSummary retrieves portfolio summary for a wallet.
// For mixed-currency portfolios, all values are converted to user's preferred currency.
func (s *investmentService) GetPortfolioSummary(ctx context.Context, walletID int32, userID int32, period v1.PnlPeriod) (*v1.GetPortfolioSummaryResponse, error) {
	if err := validator.ID(walletID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	preferredCurrency := user.PreferredCurrency
	if preferredCurrency == "" {
		preferredCurrency = "USD" // Default fallback
	}

	// Verify wallet ownership
	wallet, err := s.walletRepo.GetByIDForUser(ctx, walletID, userID)
	if err != nil {
		return nil, err
	}
	_ = wallet // Used for ownership verification

	// Get investments for wallet to check if prices need refresh
	investments, _, err := s.investmentRepo.ListByWalletID(ctx, walletID, repository.ListOptions{
		Limit: 1000,
	}, v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED)
	if err != nil {
		return nil, err
	}

	// Check if prices need refresh (any investment updated > 15 min ago)
	needsRefresh := false
	for _, inv := range investments {
		if time.Since(inv.UpdatedAt) > 15*time.Minute {
			needsRefresh = true
			break
		}
	}

	// Auto-refresh if stale
	if needsRefresh {
		log.Printf("Auto-refreshing prices for wallet %d", walletID)
		_, err = s.UpdatePrices(ctx, userID, &v1.UpdatePricesRequest{
			InvestmentIds: []int32{}, // Empty = update all
			ForceRefresh:  false,     // Use cache if fresh
		})
		if err != nil {
			log.Printf("Warning: failed to auto-refresh prices: %v", err)
			// Don't fail - continue with stale prices
		} else {
			// Re-fetch investments with updated prices
			investments, _, err = s.investmentRepo.ListByWalletID(ctx, walletID, repository.ListOptions{
				Limit: 1000,
			}, v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED)
			if err != nil {
				log.Printf("Warning: failed to re-fetch investments: %v", err)
			}
		}
	}

	// Calculate portfolio summary with currency conversion
	// All values are converted to user's preferred currency before summing
	var totalValueInPreferred int64 = 0
	var totalCostInPreferred int64 = 0
	var realizedPNLInPreferred int64 = 0
	var unrealizedPNLInPreferred int64 = 0
	investmentsByType := make(map[v1.InvestmentType]*v1.InvestmentByType)

	for _, inv := range investments {
		invCurrency := inv.Currency
		if invCurrency == "" {
			invCurrency = "USD"
		}

		// Convert values to preferred currency if different
		var currentValue, totalCost, realizedPNL, unrealizedPNL int64
		if invCurrency == preferredCurrency {
			currentValue = inv.CurrentValue
			totalCost = inv.TotalCost
			realizedPNL = inv.RealizedPNL
			unrealizedPNL = inv.UnrealizedPNL
		} else {
			// Convert each value
			var err error
			currentValue, err = s.fxRateSvc.ConvertAmount(ctx, inv.CurrentValue, invCurrency, preferredCurrency)
			if err != nil {
				log.Printf("Warning: FX conversion failed for investment %d: %v, using original value", inv.ID, err)
				currentValue = inv.CurrentValue
			}
			totalCost, err = s.fxRateSvc.ConvertAmount(ctx, inv.TotalCost, invCurrency, preferredCurrency)
			if err != nil {
				totalCost = inv.TotalCost
			}
			realizedPNL, err = s.fxRateSvc.ConvertAmount(ctx, inv.RealizedPNL, invCurrency, preferredCurrency)
			if err != nil {
				realizedPNL = inv.RealizedPNL
			}
			unrealizedPNL, err = s.fxRateSvc.ConvertAmount(ctx, inv.UnrealizedPNL, invCurrency, preferredCurrency)
			if err != nil {
				unrealizedPNL = inv.UnrealizedPNL
			}
		}

		// Aggregate totals
		totalValueInPreferred += currentValue
		totalCostInPreferred += totalCost
		realizedPNLInPreferred += realizedPNL
		unrealizedPNLInPreferred += unrealizedPNL

		// Update type-specific totals (in preferred currency)
		invType := v1.InvestmentType(inv.Type)
		if _, exists := investmentsByType[invType]; !exists {
			investmentsByType[invType] = &v1.InvestmentByType{
				Type:       invType,
				TotalValue: 0,
				Count:      0,
			}
		}
		investmentsByType[invType].TotalValue += currentValue
		investmentsByType[invType].Count++
	}

	// Calculate total PNL
	totalPNL := unrealizedPNLInPreferred + realizedPNLInPreferred

	// Calculate total PNL percent
	var totalPNLPercent float64
	if totalCostInPreferred > 0 {
		totalPNLPercent = (float64(totalPNL) / float64(totalCostInPreferred)) * 100
	}

	// Convert map to slice
	investmentsByTypeSlice := make([]*v1.InvestmentByType, 0, len(investmentsByType))
	for _, typeSummary := range investmentsByType {
		investmentsByTypeSlice = append(investmentsByTypeSlice, typeSummary)
	}

	// Compute period-scoped PnL
	periodPnl, periodPnlPercent, periodApprox, _ := s.computePeriodPnl(ctx, userID, period, totalPNL, totalPNLPercent)

	// Calculate top and worst performers
	topPerformers, worstPerformers, err := s.calculatePerformers(ctx, userID, investments, preferredCurrency)
	if err != nil {
		log.Printf("Warning: failed to calculate performers: %v", err)
		// Don't fail - continue with empty performers
		topPerformers = []*v1.InvestmentPerformance{}
		worstPerformers = []*v1.InvestmentPerformance{}
	}

	return &v1.GetPortfolioSummaryResponse{
		Success: true,
		Message: "Portfolio summary retrieved successfully",
		Data: &v1.PortfolioSummary{
			TotalValue:           totalValueInPreferred,
			TotalCost:            totalCostInPreferred,
			TotalPnl:             totalPNL,
			TotalPnlPercent:      totalPNLPercent,
			RealizedPnl:          realizedPNLInPreferred,
			UnrealizedPnl:        unrealizedPNLInPreferred,
			TotalInvestments:     int32(len(investments)),
			InvestmentsByType:    investmentsByTypeSlice,
			Currency:             preferredCurrency,
			DisplayCurrency:      preferredCurrency,
			TopPerformers:        topPerformers,
			WorstPerformers:      worstPerformers,
			PeriodPnl:            periodPnl,
			PeriodPnlPercent:     periodPnlPercent,
			Period:               period,
			PeriodPnlApproximate: periodApprox,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// UpdatePrices updates current prices for investments.
// This operation runs asynchronously to avoid frontend timeouts.
func (s *investmentService) UpdatePrices(ctx context.Context, userID int32, req *v1.UpdatePricesRequest) (*v1.UpdatePricesResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get all investments for the user directly via user_id
	allInvestments, _, err := s.investmentRepo.ListByUserID(ctx, userID, repository.ListOptions{
		Limit: 10000,
	}, v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED)
	if err != nil {
		return nil, err
	}

	// Filter by investment IDs if specified, and count custom investments
	var investmentsToUpdate []*models.Investment
	customCount := 0

	if len(req.InvestmentIds) > 0 {
		investmentIDMap := make(map[int32]bool)
		for _, id := range req.InvestmentIds {
			investmentIDMap[id] = true
		}
		for _, inv := range allInvestments {
			if inv.IsCustom {
				customCount++
				continue
			}
			if investmentIDMap[inv.ID] {
				investmentsToUpdate = append(investmentsToUpdate, inv)
			}
		}
	} else {
		// Filter out custom investments from all investments
		for _, inv := range allInvestments {
			if inv.IsCustom {
				customCount++
				continue
			}
			investmentsToUpdate = append(investmentsToUpdate, inv)
		}
	}

	if customCount > 0 {
		log.Printf("UpdatePrices: Skipping %d custom investments, updating %d market-based investments (user %d)",
			customCount, len(investmentsToUpdate), userID)
	}

	if len(investmentsToUpdate) == 0 {
		log.Printf("No market-based investments to update (user %d). %d custom investments were skipped.", userID, customCount)
		return &v1.UpdatePricesResponse{
			Success:            true,
			Message:            "No market-based investments to update",
			UpdatedInvestments: []*v1.Investment{},
			Timestamp:          time.Now().Format(time.RFC3339),
		}, nil
	}

	// Run price updates asynchronously in background
	// This prevents frontend timeout for large portfolios
	go func() {
		// Create a new context with timeout for background operation
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		log.Printf("Starting async price update for %d investments (user %d)", len(investmentsToUpdate), userID)

		// Update prices using market data service
		priceUpdates, err := s.marketDataService.UpdatePricesForInvestments(bgCtx, investmentsToUpdate, req.ForceRefresh)
		if err != nil {
			log.Printf("Error updating prices: %v", err)
			return
		}

		// Prepare updates for repository
		updates := make([]repository.PriceUpdate, 0, len(priceUpdates))
		for investmentID, price := range priceUpdates {
			updates = append(updates, repository.PriceUpdate{
				InvestmentID: investmentID,
				Price:        price,
				Timestamp:    time.Now().Unix(),
			})
		}

		// Batch update prices in repository
		if err := s.investmentRepo.UpdatePrices(bgCtx, updates); err != nil {
			log.Printf("Error saving price updates: %v", err)
			return
		}

		// Invalidate wallet investment value cache for all affected wallets
		// Collect unique wallet IDs (skip investments with no wallet)
		walletIDMap := make(map[int32]bool)
		for investmentID := range priceUpdates {
			inv, err := s.investmentRepo.GetByID(bgCtx, investmentID)
			if err != nil {
				log.Printf("Warning: failed to fetch investment %d for cache invalidation: %v", investmentID, err)
				continue
			}
			if inv.WalletID != nil {
				walletIDMap[*inv.WalletID] = true
			}
		}

		// Invalidate cache for each wallet
		if ws, ok := s.walletService.(*walletService); ok {
			for walletID := range walletIDMap {
				ws.invalidateInvestmentValueCache(bgCtx, walletID)
			}
		}

		log.Printf("Completed async price update: %d/%d investments updated successfully", len(priceUpdates), len(investmentsToUpdate))
	}()

	// Return immediately with accepted status
	return &v1.UpdatePricesResponse{
		Success:            true,
		Message:            fmt.Sprintf("Price update started for %d investments. Refresh the page in a few seconds to see updated prices.", len(investmentsToUpdate)),
		UpdatedInvestments: []*v1.Investment{},
		Timestamp:          time.Now().Format(time.RFC3339),
	}, nil
}

// SearchSymbols searches for investment symbols by query using Yahoo Finance search API.
func (s *investmentService) SearchSymbols(ctx context.Context, query string, limit int) (*v1.SearchSymbolsResponse, error) {
	// 1. Validate query
	if strings.TrimSpace(query) == "" {
		return nil, apperrors.NewValidationErrorWithCode(apperrors.Codes.InvestmentQueryRequired, "query is required")
	}

	// 2. Call Yahoo Finance search
	results, err := s.marketDataService.SearchSymbols(ctx, query, limit)
	if err != nil {
		return nil, err
	}

	// 3. Convert to protobuf format
	data := make([]*v1.SearchResult, 0, len(results))
	for _, r := range results {
		data = append(data, &v1.SearchResult{
			Symbol:   r.Symbol,
			Name:     r.Name,
			Type:     r.Type,
			Exchange: r.Exchange,
			ExchDisp: r.ExchDisp,
			Currency: r.Currency,
		})
	}

	// 4. Return response
	return &v1.SearchSymbolsResponse{
		Success:   true,
		Message:   fmt.Sprintf("found %d symbols", len(data)),
		Data:      data,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// Currency conversion helper methods

//nolint:unused
// convertInvestmentValues converts investment values to the user's preferred currency
// Converts: TotalCost, CurrentValue, RealizedPNL
// Uses cache for fast lookups and populates cache on misses
func (s *investmentService) convertInvestmentValues(ctx context.Context, userID int32, investment *models.Investment) (totalCost, currentValue, realizedPNL int64, err error) {
	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return 0, 0, 0, err
	}

	// If same currency, no conversion needed
	if investment.Currency == user.PreferredCurrency {
		return investment.TotalCost, investment.CurrentValue, investment.RealizedPNL, nil
	}

	// Cache miss - convert all values
	var convertedTotalCost, convertedCurrentValue, convertedRealizedPNL int64

	convertedTotalCost, err = s.fxRateSvc.ConvertAmount(ctx, investment.TotalCost, investment.Currency, user.PreferredCurrency)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("failed to convert total cost: %w", err)
	}

	convertedCurrentValue, err = s.fxRateSvc.ConvertAmount(ctx, investment.CurrentValue, investment.Currency, user.PreferredCurrency)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("failed to convert current value: %w", err)
	}

	convertedRealizedPNL, err = s.fxRateSvc.ConvertAmount(ctx, investment.RealizedPNL, investment.Currency, user.PreferredCurrency)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("failed to convert realized PNL: %w", err)
	}

	// Store total cost in cache (non-blocking, log errors only)
	go func() {
		if s.currencyCache != nil {
			if err := s.currencyCache.SetConvertedValue(context.Background(), userID, "investment", investment.ID, user.PreferredCurrency, convertedTotalCost); err != nil {
				fmt.Printf("Warning: failed to cache converted values for investment %d: %v\n", investment.ID, err)
			}
		}
	}()

	return convertedTotalCost, convertedCurrentValue, convertedRealizedPNL, nil
}

// populateInvestmentCache populates the currency cache for an investment
// Called when investment is created or updated
func (s *investmentService) populateInvestmentCache(ctx context.Context, userID int32, investment *models.Investment) error {
	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// If same currency, no need to cache
	if investment.Currency == user.PreferredCurrency {
		return nil
	}

	// Convert and cache total cost
	convertedTotalCost, err := s.fxRateSvc.ConvertAmount(ctx, investment.TotalCost, investment.Currency, user.PreferredCurrency)
	if err != nil {
		return fmt.Errorf("failed to convert total cost for caching: %w", err)
	}

	return s.currencyCache.SetConvertedValue(ctx, userID, "investment", investment.ID, user.PreferredCurrency, convertedTotalCost)
}

// invalidateInvestmentCache removes cached conversions for an investment
// Called when investment is updated or deleted
func (s *investmentService) invalidateInvestmentCache(ctx context.Context, userID int32, investmentID int32) error {
	if s.currencyCache == nil {
		return nil
	}
	return s.currencyCache.DeleteEntityCache(ctx, userID, "investment", investmentID)
}

// enrichInvestmentProto adds conversion fields to an investment proto response
func (s *investmentService) enrichInvestmentProto(ctx context.Context, userID int32, invProto *v1.Investment, invModel *models.Investment) {
	if s.currencyCache == nil {
		return
	}

	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return
	}

	// If same currency, no conversion needed
	if invModel.Currency == user.PreferredCurrency {
		return
	}

	// Try to get converted total cost from cache
	convertedTotalCost, err := s.currencyCache.GetConvertedValue(ctx, userID, "investment", invModel.ID, user.PreferredCurrency)
	if err == nil && convertedTotalCost > 0 {
		invProto.DisplayTotalCost = &v1.Money{
			Amount:   convertedTotalCost,
			Currency: user.PreferredCurrency,
		}
	}

	// For current value and PNL, we need to convert on-the-fly since they change frequently
	convertedCurrentValue, _ := s.fxRateSvc.ConvertAmount(ctx, invModel.CurrentValue, invModel.Currency, user.PreferredCurrency)
	invProto.DisplayCurrentValue = &v1.Money{
		Amount:   convertedCurrentValue,
		Currency: user.PreferredCurrency,
	}

	convertedUnrealizedPNL, _ := s.fxRateSvc.ConvertAmount(ctx, invModel.UnrealizedPNL, invModel.Currency, user.PreferredCurrency)
	invProto.DisplayUnrealizedPnl = &v1.Money{
		Amount:   convertedUnrealizedPNL,
		Currency: user.PreferredCurrency,
	}

	convertedRealizedPNL, _ := s.fxRateSvc.ConvertAmount(ctx, invModel.RealizedPNL, invModel.Currency, user.PreferredCurrency)
	invProto.DisplayRealizedPnl = &v1.Money{
		Amount:   convertedRealizedPNL,
		Currency: user.PreferredCurrency,
	}

	// Convert current price for display (important for gold/silver when currency differs)
	if invModel.CurrentPrice > 0 {
		convertedCurrentPrice, _ := s.fxRateSvc.ConvertAmount(ctx, invModel.CurrentPrice, invModel.Currency, user.PreferredCurrency)
		invProto.DisplayCurrentPrice = &v1.Money{
			Amount:   convertedCurrentPrice,
			Currency: user.PreferredCurrency,
		}
	}

	// Convert average cost for display (for consistency with current price)
	if invModel.AverageCost > 0 {
		convertedAverageCost, _ := s.fxRateSvc.ConvertAmount(ctx, invModel.AverageCost, invModel.Currency, user.PreferredCurrency)
		invProto.DisplayAverageCost = &v1.Money{
			Amount:   convertedAverageCost,
			Currency: user.PreferredCurrency,
		}
	}

	invProto.DisplayCurrency = user.PreferredCurrency
}

// enrichInvestmentSliceProto adds conversion fields to a slice of investment proto responses
func (s *investmentService) enrichInvestmentSliceProto(ctx context.Context, userID int32, invProtos []*v1.Investment, invModels []*models.Investment) {
	for i, invProto := range invProtos {
		if i < len(invModels) {
			s.enrichInvestmentProto(ctx, userID, invProto, invModels[i])
		}
	}
}

// enrichTransactionProto adds conversion fields to an investment transaction proto response
func (s *investmentService) enrichTransactionProto(ctx context.Context, userID int32, txProto *v1.InvestmentTransaction, investmentCurrency string) {
	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return
	}

	// If same currency, no conversion needed
	if investmentCurrency == user.PreferredCurrency {
		return
	}

	// Convert price, cost, and fees to user's preferred currency
	if txProto.Price > 0 {
		convertedPrice, _ := s.fxRateSvc.ConvertAmount(ctx, txProto.Price, investmentCurrency, user.PreferredCurrency)
		txProto.DisplayPrice = &v1.Money{
			Amount:   convertedPrice,
			Currency: user.PreferredCurrency,
		}
	}

	if txProto.Cost > 0 {
		convertedCost, _ := s.fxRateSvc.ConvertAmount(ctx, txProto.Cost, investmentCurrency, user.PreferredCurrency)
		txProto.DisplayCost = &v1.Money{
			Amount:   convertedCost,
			Currency: user.PreferredCurrency,
		}
	}

	if txProto.Fees > 0 {
		convertedFees, _ := s.fxRateSvc.ConvertAmount(ctx, txProto.Fees, investmentCurrency, user.PreferredCurrency)
		txProto.DisplayFees = &v1.Money{
			Amount:   convertedFees,
			Currency: user.PreferredCurrency,
		}
	}

	txProto.DisplayCurrency = user.PreferredCurrency
}

// enrichTransactionSliceProto adds conversion fields to a slice of transaction proto responses
func (s *investmentService) enrichTransactionSliceProto(ctx context.Context, userID int32, txProtos []*v1.InvestmentTransaction, investmentCurrency string) {
	for _, txProto := range txProtos {
		s.enrichTransactionProto(ctx, userID, txProto, investmentCurrency)
	}
}

// ListUserInvestments retrieves investments across all user's investment wallets or filtered by specific wallet.
func (s *investmentService) ListUserInvestments(ctx context.Context, userID int32, req *v1.ListUserInvestmentsRequest) (*v1.ListUserInvestmentsResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Parse pagination parameters from protobuf
	params := types.PaginationParams{
		Page:     1,
		PageSize: 100,
		OrderBy:  "symbol",
		Order:    "asc",
	}
	if req.Pagination != nil {
		params.Page = int(req.Pagination.Page)
		params.PageSize = int(req.Pagination.PageSize)
		if req.Pagination.OrderBy != "" {
			params.OrderBy = req.Pagination.OrderBy
		}
		if req.Pagination.Order != "" {
			params.Order = req.Pagination.Order
		}
	}
	params = params.Validate()

	opts := repository.ListOptions{
		Limit:   params.Limit(),
		Offset:  params.Offset(),
		OrderBy: params.OrderBy,
		Order:   params.Order,
	}

	// Get type filter
	typeFilter := v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED
	if req.TypeFilter != 0 {
		typeFilter = req.TypeFilter
	}

	var investments []*models.Investment
	var total int
	var err error

	if req.WalletId != 0 {
		// Specific wallet requested - validate ownership
		_, err := s.walletRepo.GetByIDForUser(ctx, req.WalletId, userID)
		if err != nil {
			return nil, err
		}
		investments, total, err = s.investmentRepo.ListByWalletID(ctx, req.WalletId, opts, typeFilter)
		if err != nil {
			return nil, err
		}
	} else {
		// All investment wallets
		investments, total, err = s.investmentRepo.ListByUserID(ctx, userID, opts, typeFilter)
		if err != nil {
			return nil, err
		}
	}

	// Build response with wallet names
	protoInvestments := make([]*v1.Investment, 0, len(investments))
	for _, inv := range investments {
		proto := s.mapper.ModelToProto(inv)
		// Fetch wallet name for display (only if wallet is associated)
		if inv.WalletID != nil {
			wallet, _ := s.walletRepo.GetByID(ctx, *inv.WalletID)
			if wallet != nil {
				proto.WalletName = wallet.WalletName
			}
		}
		// Enrich with conversion fields
		s.enrichInvestmentProto(ctx, userID, proto, inv)
		protoInvestments = append(protoInvestments, proto)
	}

	paginationResult := types.NewPaginationResult(params.Page, params.PageSize, total)

	return &v1.ListUserInvestmentsResponse{
		Success:     true,
		Message:     "Investments retrieved successfully",
		Investments: protoInvestments,
		TotalCount:  int32(total),
		Pagination:  s.mapper.PaginationResultToProto(paginationResult),
		Timestamp:   time.Now().Format(time.RFC3339),
	}, nil
}

// GetAggregatedPortfolioSummary retrieves portfolio summary aggregated across all investment wallets or for specific wallet.
func (s *investmentService) GetAggregatedPortfolioSummary(ctx context.Context, userID int32, req *v1.GetAggregatedPortfolioSummaryRequest) (*v1.GetPortfolioSummaryResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// If specific wallet requested, delegate to existing GetPortfolioSummary
	if req.WalletId != 0 {
		return s.GetPortfolioSummary(ctx, req.WalletId, userID, req.Period)
	}

	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	preferredCurrency := user.PreferredCurrency
	if preferredCurrency == "" {
		preferredCurrency = "USD" // Default fallback
	}

	// Get type filter
	typeFilter := v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED
	if req.TypeFilter != 0 {
		typeFilter = req.TypeFilter
	}

	// Get all investments for the user across all investment wallets
	investments, _, err := s.investmentRepo.ListByUserID(ctx, userID, repository.ListOptions{
		Limit:  10000, // Large enough to get all investments
		Offset: 0,
	}, typeFilter)
	if err != nil {
		return nil, err
	}

	// Check if prices need refresh (any investment updated > 15 min ago)
	needsRefresh := false
	for _, inv := range investments {
		if time.Since(inv.UpdatedAt) > 15*time.Minute {
			needsRefresh = true
			break
		}
	}

	// Auto-refresh if stale
	if needsRefresh && len(investments) > 0 {
		log.Printf("Auto-refreshing prices for aggregated portfolio")
		_, err = s.UpdatePrices(ctx, userID, &v1.UpdatePricesRequest{
			InvestmentIds: []int32{}, // Empty = update all
			ForceRefresh:  false,     // Use cache if fresh
		})
		if err != nil {
			log.Printf("Warning: failed to auto-refresh prices: %v", err)
			// Don't fail - continue with stale prices
		} else {
			// Re-fetch investments with updated prices
			investments, _, err = s.investmentRepo.ListByUserID(ctx, userID, repository.ListOptions{
				Limit:  10000,
				Offset: 0,
			}, typeFilter)
			if err != nil {
				log.Printf("Warning: failed to re-fetch investments: %v", err)
			}
		}
	}

	// Calculate portfolio summary with currency conversion
	// All values are converted to user's preferred currency before summing
	var totalValueInPreferred int64 = 0
	var totalCostInPreferred int64 = 0
	var realizedPNLInPreferred int64 = 0
	var unrealizedPNLInPreferred int64 = 0
	investmentsByType := make(map[v1.InvestmentType]*v1.InvestmentByType)

	for _, inv := range investments {
		invCurrency := inv.Currency
		if invCurrency == "" {
			invCurrency = "USD"
		}

		// Convert values to preferred currency if different
		var currentValue, totalCost, realizedPNL, unrealizedPNL int64
		if invCurrency == preferredCurrency {
			currentValue = inv.CurrentValue
			totalCost = inv.TotalCost
			realizedPNL = inv.RealizedPNL
			unrealizedPNL = inv.UnrealizedPNL
		} else {
			// Convert each value
			var convErr error
			currentValue, convErr = s.fxRateSvc.ConvertAmount(ctx, inv.CurrentValue, invCurrency, preferredCurrency)
			if convErr != nil {
				log.Printf("Warning: FX conversion failed for investment %d: %v, using original value", inv.ID, convErr)
				currentValue = inv.CurrentValue
			}
			totalCost, convErr = s.fxRateSvc.ConvertAmount(ctx, inv.TotalCost, invCurrency, preferredCurrency)
			if convErr != nil {
				totalCost = inv.TotalCost
			}
			realizedPNL, convErr = s.fxRateSvc.ConvertAmount(ctx, inv.RealizedPNL, invCurrency, preferredCurrency)
			if convErr != nil {
				realizedPNL = inv.RealizedPNL
			}
			unrealizedPNL, convErr = s.fxRateSvc.ConvertAmount(ctx, inv.UnrealizedPNL, invCurrency, preferredCurrency)
			if convErr != nil {
				unrealizedPNL = inv.UnrealizedPNL
			}
		}

		// Aggregate totals
		totalValueInPreferred += currentValue
		totalCostInPreferred += totalCost
		realizedPNLInPreferred += realizedPNL
		unrealizedPNLInPreferred += unrealizedPNL

		// Update type-specific totals (in preferred currency)
		invType := v1.InvestmentType(inv.Type)
		if _, exists := investmentsByType[invType]; !exists {
			investmentsByType[invType] = &v1.InvestmentByType{
				Type:       invType,
				TotalValue: 0,
				Count:      0,
			}
		}
		investmentsByType[invType].TotalValue += currentValue
		investmentsByType[invType].Count++
	}

	// Calculate total PNL
	totalPNL := unrealizedPNLInPreferred + realizedPNLInPreferred

	// Calculate total PNL percent
	var totalPNLPercent float64
	if totalCostInPreferred > 0 {
		totalPNLPercent = (float64(totalPNL) / float64(totalCostInPreferred)) * 100
	}

	// Convert map to slice
	investmentsByTypeSlice := make([]*v1.InvestmentByType, 0, len(investmentsByType))
	for _, typeSummary := range investmentsByType {
		investmentsByTypeSlice = append(investmentsByTypeSlice, typeSummary)
	}

	// Compute period-scoped PnL
	periodPnlAgg, periodPnlPercentAgg, periodApproxAgg, _ := s.computePeriodPnl(ctx, userID, req.Period, totalPNL, totalPNLPercent)

	// Calculate top and worst performers
	topPerformers, worstPerformers, err := s.calculatePerformers(ctx, userID, investments, preferredCurrency)
	if err != nil {
		log.Printf("Warning: failed to calculate performers: %v", err)
		// Don't fail - continue with empty performers
		topPerformers = []*v1.InvestmentPerformance{}
		worstPerformers = []*v1.InvestmentPerformance{}
	}

	return &v1.GetPortfolioSummaryResponse{
		Success: true,
		Message: "Aggregated portfolio summary retrieved successfully",
		Data: &v1.PortfolioSummary{
			TotalValue:           totalValueInPreferred,
			TotalCost:            totalCostInPreferred,
			TotalPnl:             totalPNL,
			TotalPnlPercent:      totalPNLPercent,
			RealizedPnl:          realizedPNLInPreferred,
			UnrealizedPnl:        unrealizedPNLInPreferred,
			TotalInvestments:     int32(len(investments)),
			InvestmentsByType:    investmentsByTypeSlice,
			Currency:             preferredCurrency,
			DisplayCurrency:      preferredCurrency,
			TopPerformers:        topPerformers,
			WorstPerformers:      worstPerformers,
			PeriodPnl:            periodPnlAgg,
			PeriodPnlPercent:     periodPnlPercentAgg,
			Period:               req.Period,
			PeriodPnlApproximate: periodApproxAgg,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ListInvestmentWallets retrieves all active wallets for a user.
// Investments are no longer tied to a specific wallet type — any wallet can hold investments.
func (s *investmentService) ListInvestmentWallets(ctx context.Context, userID int32) ([]*models.Wallet, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	wallets, _, err := s.walletRepo.ListByUserID(ctx, userID, repository.ListOptions{
		Limit: 1000,
	})
	if err != nil {
		return nil, err
	}

	return wallets, nil
}

// calculatePerformers computes top and worst performing investments based on unrealized PNL percentage.
// Returns top 3 and worst 3 performers.
func (s *investmentService) calculatePerformers(ctx context.Context, userID int32, investments []*models.Investment, preferredCurrency string) (topPerformers, worstPerformers []*v1.InvestmentPerformance, err error) {
	// Build list of investments with their performance
	type investmentPerformance struct {
		investment           *models.Investment
		unrealizedPNL        int64
		unrealizedPNLPercent float64
	}

	var performances []investmentPerformance

	for _, inv := range investments {
		// Skip investments with zero cost (no PNL calculation possible)
		if inv.TotalCost == 0 {
			continue
		}

		// Calculate PNL percentage using original currency values
		// This ensures percentage is accurate regardless of currency conversion
		unrealizedPNLPercent := (float64(inv.UnrealizedPNL) / float64(inv.TotalCost)) * 100

		// Convert unrealized PNL to preferred currency for display (but percentage already calculated)
		unrealizedPNL := inv.UnrealizedPNL
		if inv.Currency != preferredCurrency {
			var err error
			unrealizedPNL, err = s.fxRateSvc.ConvertAmount(ctx, inv.UnrealizedPNL, inv.Currency, preferredCurrency)
			if err != nil {
				// Use original value if conversion fails
				unrealizedPNL = inv.UnrealizedPNL
			}
		}

		performances = append(performances, investmentPerformance{
			investment:           inv,
			unrealizedPNL:        unrealizedPNL,
			unrealizedPNLPercent: unrealizedPNLPercent,
		})
	}

	// Sort by PNL percentage (descending for top performers, ascending for worst)
	// For top performers: highest PNL first
	// For worst performers: lowest PNL first (most negative)

	// Separate positive and negative performers
	var positivePerformers []investmentPerformance
	var negativePerformers []investmentPerformance

	for _, p := range performances {
		if p.unrealizedPNLPercent >= 0 {
			positivePerformers = append(positivePerformers, p)
		} else {
			negativePerformers = append(negativePerformers, p)
		}
	}

	// Sort positive performers by PNL percent descending
	for i := 0; i < len(positivePerformers); i++ {
		for j := i + 1; j < len(positivePerformers); j++ {
			if positivePerformers[j].unrealizedPNLPercent > positivePerformers[i].unrealizedPNLPercent {
				positivePerformers[i], positivePerformers[j] = positivePerformers[j], positivePerformers[i]
			}
		}
	}

	// Sort negative performers by PNL percent ascending (most negative first)
	for i := 0; i < len(negativePerformers); i++ {
		for j := i + 1; j < len(negativePerformers); j++ {
			if negativePerformers[j].unrealizedPNLPercent < negativePerformers[i].unrealizedPNLPercent {
				negativePerformers[i], negativePerformers[j] = negativePerformers[j], negativePerformers[i]
			}
		}
	}

	// Take top 3 from each list
	maxPerfomers := 3
	if len(positivePerformers) > maxPerfomers {
		positivePerformers = positivePerformers[:maxPerfomers]
	}
	if len(negativePerformers) > maxPerfomers {
		negativePerformers = negativePerformers[:maxPerfomers]
	}

	// Convert to protobuf format
	topPerformers = make([]*v1.InvestmentPerformance, 0, len(positivePerformers))
	for _, p := range positivePerformers {
		displayUnrealizedPNL := p.unrealizedPNL
		displayCurrency := preferredCurrency

		// If investment currency differs from preferred, convert for display
		if p.investment.Currency != preferredCurrency {
			converted, err := s.fxRateSvc.ConvertAmount(ctx, p.investment.UnrealizedPNL, p.investment.Currency, preferredCurrency)
			if err == nil {
				displayUnrealizedPNL = converted
			}
		}

		topPerformers = append(topPerformers, &v1.InvestmentPerformance{
			InvestmentId:         p.investment.ID,
			Symbol:               p.investment.Symbol,
			Name:                 p.investment.Name,
			Type:                 v1.InvestmentType(p.investment.Type),
			UnrealizedPnl:        p.unrealizedPNL,
			UnrealizedPnlPercent: p.unrealizedPNLPercent,
			DisplayUnrealizedPnl: &v1.Money{
				Amount:   displayUnrealizedPNL,
				Currency: displayCurrency,
			},
			DisplayCurrency: displayCurrency,
		})
	}

	worstPerformers = make([]*v1.InvestmentPerformance, 0, len(negativePerformers))
	for _, p := range negativePerformers {
		displayUnrealizedPNL := p.unrealizedPNL
		displayCurrency := preferredCurrency

		// If investment currency differs from preferred, convert for display
		if p.investment.Currency != preferredCurrency {
			converted, err := s.fxRateSvc.ConvertAmount(ctx, p.investment.UnrealizedPNL, p.investment.Currency, preferredCurrency)
			if err == nil {
				displayUnrealizedPNL = converted
			}
		}

		worstPerformers = append(worstPerformers, &v1.InvestmentPerformance{
			InvestmentId:         p.investment.ID,
			Symbol:               p.investment.Symbol,
			Name:                 p.investment.Name,
			Type:                 v1.InvestmentType(p.investment.Type),
			UnrealizedPnl:        p.unrealizedPNL,
			UnrealizedPnlPercent: p.unrealizedPNLPercent,
			DisplayUnrealizedPnl: &v1.Money{
				Amount:   displayUnrealizedPNL,
				Currency: displayCurrency,
			},
			DisplayCurrency: displayCurrency,
		})
	}

	return topPerformers, worstPerformers, nil
}

// validateBuyQuantityReduction checks if reducing a buy transaction's quantity
// would conflict with lots already consumed by sells.
// Returns error if new quantity < (original lot quantity - remaining quantity on lot).
// This prevents lot.RemainingQuantity from going negative, which would corrupt
// FIFO cost-basis accounting.
func (s *investmentService) validateBuyQuantityReduction(ctx context.Context, tx *models.InvestmentTransaction, newQuantity int64) error {
	if tx.LotID == nil {
		return nil // No lot tracking, nothing to validate
	}

	lot, err := s.txRepo.GetLotByID(ctx, *tx.LotID)
	if err != nil {
		return apperrors.NewInternalErrorWithCause("failed to get lot for validation", err)
	}

	// Amount already sold from this lot = original lot quantity - remaining
	alreadySold := lot.Quantity - lot.RemainingQuantity
	if alreadySold > 0 && newQuantity < alreadySold {
		return apperrors.NewValidationError(
			fmt.Sprintf("Cannot reduce quantity below %d units (%d already sold from this lot)", alreadySold, alreadySold),
		)
	}

	return nil
}
