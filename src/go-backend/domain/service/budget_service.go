package service

import (
	"context"
	"fmt"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/types"
	"wealthjourney/pkg/validator"
	budgetv1 "wealthjourney/protobuf/v1"
)

// budgetService implements BudgetService.
type budgetService struct {
	budgetRepo     repository.BudgetRepository
	budgetItemRepo repository.BudgetItemRepository
	userRepo       repository.UserRepository
	fxRateSvc      FXRateService
	currencyCache  *cache.CurrencyCache
	mapper         *BudgetMapper
}

// NewBudgetService creates a new BudgetService.
func NewBudgetService(
	budgetRepo repository.BudgetRepository,
	budgetItemRepo repository.BudgetItemRepository,
	userRepo repository.UserRepository,
	fxRateSvc FXRateService,
	currencyCache *cache.CurrencyCache,
) BudgetService {
	return &budgetService{
		budgetRepo:     budgetRepo,
		budgetItemRepo: budgetItemRepo,
		userRepo:       userRepo,
		fxRateSvc:      fxRateSvc,
		currencyCache:  currencyCache,
		mapper:         NewBudgetMapper(),
	}
}

// GetBudget retrieves a budget by ID, ensuring it belongs to the user.
func (s *budgetService) GetBudget(ctx context.Context, budgetID int32, userID int32) (*budgetv1.GetBudgetResponse, error) {
	// Validate inputs
	if err := validator.ID(budgetID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get budget and verify ownership
	budget, err := s.budgetRepo.GetByIDForUser(ctx, budgetID, userID)
	if err != nil {
		return nil, err
	}

	budgetProto := s.mapper.ModelToProto(budget)
	// Enrich with conversion fields
	s.enrichBudgetProto(ctx, userID, budgetProto, budget)

	return &budgetv1.GetBudgetResponse{
		Success:   true,
		Message:   "Budget retrieved successfully",
		Data:      budgetProto,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ListBudgets retrieves all budgets for a user with pagination.
func (s *budgetService) ListBudgets(ctx context.Context, userID int32, params types.PaginationParams) (*budgetv1.ListBudgetsResponse, error) {
	// Validate user ID
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

	budgets, total, err := s.budgetRepo.ListByUserID(ctx, userID, opts)
	if err != nil {
		return nil, err
	}

	protoBudgets := s.mapper.ModelSliceToProto(budgets)
	// Enrich with conversion fields
	s.enrichBudgetSliceProto(ctx, userID, protoBudgets, budgets)

	paginationResult := types.NewPaginationResult(params.Page, params.PageSize, total)

	return &budgetv1.ListBudgetsResponse{
		Success:    true,
		Message:    "Budgets retrieved successfully",
		Budgets:    protoBudgets,
		Pagination: s.mapper.PaginationResultToProto(paginationResult),
		Timestamp:  time.Now().Format(time.RFC3339),
	}, nil
}

// CreateBudget creates a new budget for a user.
func (s *budgetService) CreateBudget(ctx context.Context, userID int32, req *budgetv1.CreateBudgetRequest) (*budgetv1.CreateBudgetResponse, error) {
	// Validate inputs
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Validate budget name
	if err := validateBudgetName(req.Name); err != nil {
		return nil, err
	}

	// Validate total amount
	if err := validateMoneyAmount(req.Total); err != nil {
		return nil, err
	}

	// Verify user exists (ensures userID is valid)
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperrors.NewNotFoundErrorWithCode(apperrors.Codes.UserNotFound, "user not found")
	}

	// Create budget model
	total := int64(0)
	if req.Total != nil {
		total = req.Total.Amount
	}

	budget := &models.Budget{
		UserID: userID,
		Name:   req.Name,
		Total:  total,
	}

	if err := s.budgetRepo.Create(ctx, budget); err != nil {
		return nil, err
	}

	// Create budget items if provided
	if len(req.Items) > 0 {
		for _, itemReq := range req.Items {
			// Validate item name
			if err := validateBudgetItemName(itemReq.Name); err != nil {
				return nil, err
			}

			// Validate item total
			if err := validateMoneyAmount(itemReq.Total); err != nil {
				return nil, err
			}

			itemTotal := int64(0)
			if itemReq.Total != nil {
				itemTotal = itemReq.Total.Amount
			}

			item := &models.BudgetItem{
				BudgetID: budget.ID,
				Name:     itemReq.Name,
				Total:    itemTotal,
			}

			if err := s.budgetItemRepo.Create(ctx, item); err != nil {
				return nil, apperrors.NewInternalErrorWithCodeAndCause(apperrors.Codes.BudgetItemCreateFailed, "failed to create budget item", err)
			}
		}
	}

	// Fetch budget with items for response
	budgetWithItems, err := s.budgetRepo.GetByIDForUser(ctx, budget.ID, userID)
	if err != nil {
		return nil, err
	}

	// Populate currency cache
	if err := s.populateBudgetCache(ctx, userID, budgetWithItems); err != nil {
		// Log error but don't fail - cache population is not critical
		fmt.Printf("Warning: failed to populate currency cache for budget %d: %v\n", budgetWithItems.ID, err)
	}

	return &budgetv1.CreateBudgetResponse{
		Success:   true,
		Message:   "Budget created successfully",
		Data:      s.mapper.ModelToProto(budgetWithItems),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// UpdateBudget updates a budget's information.
func (s *budgetService) UpdateBudget(ctx context.Context, budgetID int32, userID int32, req *budgetv1.UpdateBudgetRequest) (*budgetv1.UpdateBudgetResponse, error) {
	// Validate inputs
	if err := validator.ID(budgetID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Validate budget name
	if err := validateBudgetName(req.Name); err != nil {
		return nil, err
	}

	// Validate total amount if provided
	if err := validateMoneyAmount(req.Total); err != nil {
		return nil, err
	}

	// Get budget and verify ownership
	budget, err := s.budgetRepo.GetByIDForUser(ctx, budgetID, userID)
	if err != nil {
		return nil, err
	}

	// Update fields
	if req.Total != nil {
		budget.Total = req.Total.Amount
	}
	budget.Name = req.Name

	if err := s.budgetRepo.Update(ctx, budget); err != nil {
		return nil, err
	}

	// Invalidate and repopulate currency cache
	if err := s.invalidateBudgetCache(ctx, userID, budgetID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for budget %d: %v\n", budgetID, err)
	}
	if err := s.populateBudgetCache(ctx, userID, budget); err != nil {
		fmt.Printf("Warning: failed to populate currency cache for budget %d: %v\n", budget.ID, err)
	}

	return &budgetv1.UpdateBudgetResponse{
		Success:   true,
		Message:   "Budget updated successfully",
		Data:      s.mapper.ModelToProto(budget),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// DeleteBudget deletes a budget.
func (s *budgetService) DeleteBudget(ctx context.Context, budgetID int32, userID int32) (*budgetv1.DeleteBudgetResponse, error) {
	// Validate inputs
	if err := validator.ID(budgetID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Verify ownership
	_, err := s.budgetRepo.GetByIDForUser(ctx, budgetID, userID)
	if err != nil {
		return nil, err
	}

	// Delete all budget items first
	if err := s.budgetItemRepo.DeleteByBudgetID(ctx, budgetID); err != nil {
		return nil, apperrors.NewInternalErrorWithCodeAndCause(apperrors.Codes.BudgetItemsDeleteFailed, "failed to delete budget items", err)
	}

	// Delete budget
	if err := s.budgetRepo.Delete(ctx, budgetID); err != nil {
		return nil, err
	}

	// Invalidate currency cache
	if err := s.invalidateBudgetCache(ctx, userID, budgetID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for budget %d: %v\n", budgetID, err)
	}

	return &budgetv1.DeleteBudgetResponse{
		Success:   true,
		Message:   "Budget deleted successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetBudgetItems retrieves all budget items for a budget.
func (s *budgetService) GetBudgetItems(ctx context.Context, budgetID int32, userID int32) (*budgetv1.GetBudgetItemsResponse, error) {
	// Validate inputs
	if err := validator.ID(budgetID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Verify budget ownership and get budget for currency
	budget, err := s.budgetRepo.GetByIDForUser(ctx, budgetID, userID)
	if err != nil {
		return nil, err
	}

	// Get budget items
	items, err := s.budgetItemRepo.ListByBudgetID(ctx, budgetID)
	if err != nil {
		return nil, err
	}

	protoItems := s.mapper.ModelSliceToProtoItems(items)
	// Enrich with conversion fields
	s.enrichBudgetItemSliceProto(ctx, userID, protoItems, items, budget.Currency)

	return &budgetv1.GetBudgetItemsResponse{
		Success:   true,
		Message:   "Budget items retrieved successfully",
		Items:     protoItems,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// CreateBudgetItem creates a new budget item.
func (s *budgetService) CreateBudgetItem(ctx context.Context, budgetID int32, userID int32, req *budgetv1.CreateBudgetItemRequest) (*budgetv1.CreateBudgetItemResponse, error) {
	// Validate inputs
	if err := validator.ID(budgetID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Validate item name
	if err := validateBudgetItemName(req.Name); err != nil {
		return nil, err
	}

	// Validate total amount
	if err := validateMoneyAmount(req.Total); err != nil {
		return nil, err
	}

	// Verify budget ownership
	_, err := s.budgetRepo.GetByIDForUser(ctx, budgetID, userID)
	if err != nil {
		return nil, err
	}

	// Create budget item
	total := int64(0)
	if req.Total != nil {
		total = req.Total.Amount
	}

	item := &models.BudgetItem{
		BudgetID: budgetID,
		Name:     req.Name,
		Total:    total,
	}

	if err := s.budgetItemRepo.Create(ctx, item); err != nil {
		return nil, err
	}

	// Get budget to determine currency
	budget, _ := s.budgetRepo.GetByID(ctx, budgetID)

	// Populate currency cache
	if budget != nil {
		if err := s.populateBudgetItemCache(ctx, userID, item, budget.Currency); err != nil {
			// Log error but don't fail - cache population is not critical
			fmt.Printf("Warning: failed to populate currency cache for budget item %d: %v\n", item.ID, err)
		}
	}

	return &budgetv1.CreateBudgetItemResponse{
		Success:   true,
		Message:   "Budget item created successfully",
		Data:      s.mapper.ModelItemToProto(item),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// UpdateBudgetItem updates a budget item's information.
func (s *budgetService) UpdateBudgetItem(ctx context.Context, budgetID int32, itemID int32, userID int32, req *budgetv1.UpdateBudgetItemRequest) (*budgetv1.UpdateBudgetItemResponse, error) {
	// Validate inputs
	if err := validator.ID(budgetID); err != nil {
		return nil, err
	}
	if err := validator.ID(itemID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Validate item name if provided
	if req.Name != "" {
		if err := validateBudgetItemName(req.Name); err != nil {
			return nil, err
		}
	}

	// Validate total amount if provided
	if req.Total != nil {
		if err := validateMoneyAmount(req.Total); err != nil {
			return nil, err
		}
	}

	// Verify budget ownership
	_, err := s.budgetRepo.GetByIDForUser(ctx, budgetID, userID)
	if err != nil {
		return nil, err
	}

	// Get budget item and verify it belongs to the budget
	item, err := s.budgetItemRepo.GetByIDForBudget(ctx, itemID, budgetID)
	if err != nil {
		return nil, err
	}

	// Update fields if provided
	if req.Total != nil {
		item.Total = req.Total.Amount
	}
	if req.Name != "" {
		item.Name = req.Name
	}
	// Handle checked field - protobuf provides default false for bool
	item.Checked = req.Checked

	if err := s.budgetItemRepo.Update(ctx, item); err != nil {
		return nil, err
	}

	// Get budget to determine currency
	budget, _ := s.budgetRepo.GetByID(ctx, budgetID)

	// Invalidate and repopulate currency cache
	if err := s.invalidateBudgetItemCache(ctx, userID, itemID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for budget item %d: %v\n", itemID, err)
	}
	if budget != nil {
		if err := s.populateBudgetItemCache(ctx, userID, item, budget.Currency); err != nil {
			fmt.Printf("Warning: failed to populate currency cache for budget item %d: %v\n", item.ID, err)
		}
	}

	return &budgetv1.UpdateBudgetItemResponse{
		Success:   true,
		Message:   "Budget item updated successfully",
		Data:      s.mapper.ModelItemToProto(item),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// DeleteBudgetItem deletes a budget item.
func (s *budgetService) DeleteBudgetItem(ctx context.Context, budgetID int32, itemID int32, userID int32) (*budgetv1.DeleteBudgetItemResponse, error) {
	// Validate inputs
	if err := validator.ID(budgetID); err != nil {
		return nil, err
	}
	if err := validator.ID(itemID); err != nil {
		return nil, err
	}
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Verify budget ownership
	_, err := s.budgetRepo.GetByIDForUser(ctx, budgetID, userID)
	if err != nil {
		return nil, err
	}

	// Verify item belongs to budget
	_, err = s.budgetItemRepo.GetByIDForBudget(ctx, itemID, budgetID)
	if err != nil {
		return nil, err
	}

	// Delete budget item
	if err := s.budgetItemRepo.Delete(ctx, itemID); err != nil {
		return nil, err
	}

	// Invalidate currency cache
	if err := s.invalidateBudgetItemCache(ctx, userID, itemID); err != nil {
		fmt.Printf("Warning: failed to invalidate currency cache for budget item %d: %v\n", itemID, err)
	}

	return &budgetv1.DeleteBudgetItemResponse{
		Success:   true,
		Message:   "Budget item deleted successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// Helper methods for validation

// validateBudgetName validates budget name constraints.
func validateBudgetName(name string) error {
	if name == "" {
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.BudgetNameRequired, "budget name is required")
	}
	if len(name) > 100 {
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.BudgetNameTooLong, "budget name cannot exceed 100 characters")
	}
	return nil
}

// validateBudgetItemName validates budget item name constraints.
func validateBudgetItemName(name string) error {
	if name == "" {
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.BudgetItemNameRequired, "budget item name is required")
	}
	if len(name) > 100 {
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.BudgetItemNameTooLong, "budget item name cannot exceed 100 characters")
	}
	return nil
}

//nolint:unused
// validateNonNegativeAmount validates that an amount is non-negative.
func validateNonNegativeAmount(amount int64) error {
	if amount < 0 {
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.BudgetAmountNegative, "amount cannot be negative")
	}
	return nil
}

// validateMoneyAmount validates a Money protobuf message is non-negative.
func validateMoneyAmount(money *budgetv1.Money) error {
	if money == nil {
		return nil // nil is treated as zero
	}
	if money.Amount < 0 {
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.BudgetAmountNegative, "amount cannot be negative")
	}
	return nil
}

// Currency conversion helper methods

//nolint:unused
// convertBudgetTotal converts a budget's total to the user's preferred currency
// Uses cache for fast lookups and populates cache on misses
func (s *budgetService) convertBudgetTotal(ctx context.Context, userID int32, budget *models.Budget) (int64, error) {
	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return 0, err
	}

	// If same currency, no conversion needed
	if budget.Currency == user.PreferredCurrency {
		return budget.Total, nil
	}

	// Check cache first
	cachedValue, err := s.currencyCache.GetConvertedValue(ctx, userID, "budget", budget.ID, user.PreferredCurrency)
	if err == nil && cachedValue > 0 {
		return cachedValue, nil
	}

	// Cache miss - convert and cache
	convertedTotal, err := s.fxRateSvc.ConvertAmount(ctx, budget.Total, budget.Currency, user.PreferredCurrency)
	if err != nil {
		return 0, fmt.Errorf("failed to convert total: %w", err)
	}

	// Store in cache (non-blocking, log errors only)
	go func() {
		if err := s.currencyCache.SetConvertedValue(context.Background(), userID, "budget", budget.ID, user.PreferredCurrency, convertedTotal); err != nil {
			fmt.Printf("Warning: failed to cache converted total for budget %d: %v\n", budget.ID, err)
		}
	}()

	return convertedTotal, nil
}

//nolint:unused
// convertBudgetItemTotal converts a budget item's total to the user's preferred currency
func (s *budgetService) convertBudgetItemTotal(ctx context.Context, userID int32, budgetItem *models.BudgetItem, budgetCurrency string) (int64, error) {
	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return 0, err
	}

	// If same currency, no conversion needed
	if budgetCurrency == user.PreferredCurrency {
		return budgetItem.Total, nil
	}

	// Check cache first
	cachedValue, err := s.currencyCache.GetConvertedValue(ctx, userID, "budget_item", budgetItem.ID, user.PreferredCurrency)
	if err == nil && cachedValue > 0 {
		return cachedValue, nil
	}

	// Cache miss - convert and cache
	convertedTotal, err := s.fxRateSvc.ConvertAmount(ctx, budgetItem.Total, budgetCurrency, user.PreferredCurrency)
	if err != nil {
		return 0, fmt.Errorf("failed to convert item total: %w", err)
	}

	// Store in cache (non-blocking, log errors only)
	go func() {
		if err := s.currencyCache.SetConvertedValue(context.Background(), userID, "budget_item", budgetItem.ID, user.PreferredCurrency, convertedTotal); err != nil {
			fmt.Printf("Warning: failed to cache converted total for budget item %d: %v\n", budgetItem.ID, err)
		}
	}()

	return convertedTotal, nil
}

// populateBudgetCache populates the currency cache for a budget
// Called when budget is created or updated
func (s *budgetService) populateBudgetCache(ctx context.Context, userID int32, budget *models.Budget) error {
	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// If same currency, no need to cache
	if budget.Currency == user.PreferredCurrency {
		return nil
	}

	// Convert and cache
	convertedTotal, err := s.fxRateSvc.ConvertAmount(ctx, budget.Total, budget.Currency, user.PreferredCurrency)
	if err != nil {
		return fmt.Errorf("failed to convert total for caching: %w", err)
	}

	return s.currencyCache.SetConvertedValue(ctx, userID, "budget", budget.ID, user.PreferredCurrency, convertedTotal)
}

// populateBudgetItemCache populates the currency cache for a budget item
func (s *budgetService) populateBudgetItemCache(ctx context.Context, userID int32, budgetItem *models.BudgetItem, budgetCurrency string) error {
	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// If same currency, no need to cache
	if budgetCurrency == user.PreferredCurrency {
		return nil
	}

	// Convert and cache
	convertedTotal, err := s.fxRateSvc.ConvertAmount(ctx, budgetItem.Total, budgetCurrency, user.PreferredCurrency)
	if err != nil {
		return fmt.Errorf("failed to convert item total for caching: %w", err)
	}

	return s.currencyCache.SetConvertedValue(ctx, userID, "budget_item", budgetItem.ID, user.PreferredCurrency, convertedTotal)
}

// invalidateBudgetCache removes cached conversions for a budget
// Called when budget is updated or deleted
func (s *budgetService) invalidateBudgetCache(ctx context.Context, userID int32, budgetID int32) error {
	return s.currencyCache.DeleteEntityCache(ctx, userID, "budget", budgetID)
}

// invalidateBudgetItemCache removes cached conversions for a budget item
func (s *budgetService) invalidateBudgetItemCache(ctx context.Context, userID int32, budgetItemID int32) error {
	return s.currencyCache.DeleteEntityCache(ctx, userID, "budget_item", budgetItemID)
}

// enrichBudgetProto adds conversion fields to a budget proto response
func (s *budgetService) enrichBudgetProto(ctx context.Context, userID int32, budgetProto *budgetv1.Budget, budgetModel *models.Budget) {
	if s.currencyCache == nil {
		return
	}

	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return
	}

	// If same currency, no conversion needed
	if budgetModel.Currency == user.PreferredCurrency {
		return
	}

	// Try to get from cache first
	convertedTotal, err := s.currencyCache.GetConvertedValue(ctx, userID, "budget", budgetModel.ID, user.PreferredCurrency)
	if err == nil && convertedTotal > 0 {
		budgetProto.DisplayTotal = &budgetv1.Money{
			Amount:   convertedTotal,
			Currency: user.PreferredCurrency,
		}
		budgetProto.DisplayCurrency = user.PreferredCurrency
	}
}

// enrichBudgetSliceProto adds conversion fields to a slice of budget proto responses
func (s *budgetService) enrichBudgetSliceProto(ctx context.Context, userID int32, budgetProtos []*budgetv1.Budget, budgetModels []*models.Budget) {
	for i, budgetProto := range budgetProtos {
		if i < len(budgetModels) {
			s.enrichBudgetProto(ctx, userID, budgetProto, budgetModels[i])
		}
	}
}

// enrichBudgetItemProto adds conversion fields to a budget item proto response
func (s *budgetService) enrichBudgetItemProto(ctx context.Context, userID int32, itemProto *budgetv1.BudgetItem, itemModel *models.BudgetItem, budgetCurrency string) {
	if s.currencyCache == nil {
		return
	}

	// Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return
	}

	// If same currency, no conversion needed
	if budgetCurrency == user.PreferredCurrency {
		return
	}

	// Try to get from cache first
	convertedTotal, err := s.currencyCache.GetConvertedValue(ctx, userID, "budget_item", itemModel.ID, user.PreferredCurrency)
	if err == nil && convertedTotal > 0 {
		itemProto.DisplayTotal = &budgetv1.Money{
			Amount:   convertedTotal,
			Currency: user.PreferredCurrency,
		}
		itemProto.DisplayCurrency = user.PreferredCurrency
	}
}

// enrichBudgetItemSliceProto adds conversion fields to a slice of budget item proto responses
func (s *budgetService) enrichBudgetItemSliceProto(ctx context.Context, userID int32, itemProtos []*budgetv1.BudgetItem, itemModels []*models.BudgetItem, budgetCurrency string) {
	for i, itemProto := range itemProtos {
		if i < len(itemModels) {
			s.enrichBudgetItemProto(ctx, userID, itemProto, itemModels[i], budgetCurrency)
		}
	}
}

