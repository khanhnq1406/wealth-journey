package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/go-redis/redis/v8"
	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/types"
	"wealthjourney/pkg/validator"
	v1 "wealthjourney/protobuf/v1"
)

const (
	// batchSize is the number of entities to process in a single transaction during currency conversion
	batchSize = 100
	// conversionTimeout is the maximum time allowed for currency conversion
	conversionTimeout = 30 * time.Minute
)

// userService implements UserService.
type userService struct {
	userRepo         repository.UserRepository
	categorySvc      CategoryService
	walletRepo       repository.WalletRepository
	transactionRepo  repository.TransactionRepository
	budgetRepo       repository.BudgetRepository
	budgetItemRepo   repository.BudgetItemRepository
	investmentRepo   repository.InvestmentRepository
	fxRateSvc        FXRateService
	currencyCache    *cache.CurrencyCache
	redisCache       *redis.Client
	mapper           *UserMapper
}

// NewUserService creates a new UserService with all dependencies.
func NewUserService(
	userRepo repository.UserRepository,
	categorySvc CategoryService,
	walletRepo repository.WalletRepository,
	transactionRepo repository.TransactionRepository,
	budgetRepo repository.BudgetRepository,
	budgetItemRepo repository.BudgetItemRepository,
	investmentRepo repository.InvestmentRepository,
	fxRateSvc FXRateService,
	currencyCache *cache.CurrencyCache,
	redisCache *redis.Client,
) UserService {
	return &userService{
		userRepo:        userRepo,
		categorySvc:     categorySvc,
		walletRepo:      walletRepo,
		transactionRepo: transactionRepo,
		budgetRepo:      budgetRepo,
		budgetItemRepo:  budgetItemRepo,
		investmentRepo:  investmentRepo,
		fxRateSvc:       fxRateSvc,
		currencyCache:   currencyCache,
		redisCache:      redisCache,
		mapper:          NewUserMapper(),
	}
}

// GetUser retrieves a user by ID.
func (s *userService) GetUser(ctx context.Context, userID int32) (*v1.GetUserResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &v1.GetUserResponse{
		Success:   true,
		Message:   "User retrieved successfully",
		Data:      s.mapper.ModelToProto(user),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetUserByEmail retrieves a user by email.
func (s *userService) GetUserByEmail(ctx context.Context, email string) (*v1.GetUserByEmailResponse, error) {
	if err := validator.Email(email); err != nil {
		return nil, err
	}

	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	return &v1.GetUserByEmailResponse{
		Success:   true,
		Message:   "User retrieved successfully",
		Data:      s.mapper.ModelToProto(user),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ListUsers retrieves all users with pagination.
func (s *userService) ListUsers(ctx context.Context, params types.PaginationParams) (*v1.ListUsersResponse, error) {
	params = params.Validate()

	opts := repository.ListOptions{
		Limit:   params.Limit(),
		Offset:  params.Offset(),
		OrderBy: params.OrderBy,
		Order:   params.Order,
	}

	users, total, err := s.userRepo.List(ctx, opts)
	if err != nil {
		return nil, err
	}

	pagination := types.NewPaginationResult(params.Page, params.PageSize, total)

	return &v1.ListUsersResponse{
		Success:    true,
		Message:    "Users retrieved successfully",
		Users:      s.mapper.ModelSliceToProto(users),
		Pagination: s.mapper.PaginationResultToProto(pagination),
		Timestamp:  time.Now().Format(time.RFC3339),
	}, nil
}

// CreateUser creates a new user.
func (s *userService) CreateUser(ctx context.Context, email, name, picture string) (*v1.CreateUserResponse, error) {
	// Validate inputs
	if err := validator.Email(email); err != nil {
		return nil, err
	}
	if name != "" {
		if err := validator.Name(name); err != nil {
			return nil, err
		}
	}

	// Check if user already exists
	exists, err := s.userRepo.ExistsByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, apperrors.NewConflictError("user with this email already exists")
	}

	// Create user model
	user := &models.User{
		Email:   email,
		Name:    name,
		Picture: picture,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	// Create default categories for the new user
	if s.categorySvc != nil {
		if err := s.categorySvc.CreateDefaultCategories(ctx, user.ID); err != nil {
			// Log the error but don't fail the user creation
			// The categories can be created manually later
			log.Printf("Warning: Failed to create default categories for user %d: %v", user.ID, err)
		}
	}

	return &v1.CreateUserResponse{
		Success:   true,
		Message:   "User created successfully",
		Data:      s.mapper.ModelToProto(user),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// UpdateUser updates a user's information.
func (s *userService) UpdateUser(ctx context.Context, userID int32, email, name, picture string) (*v1.UpdateUserResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get existing user
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Validate and update email if provided
	if email != "" && email != user.Email {
		if err := validator.Email(email); err != nil {
			return nil, err
		}
		// Check if email is already taken
		exists, err := s.userRepo.ExistsByEmail(ctx, email)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, apperrors.NewConflictError("email already in use")
		}
		user.Email = email
	}

	// Validate and update name if provided
	if name != "" {
		if err := validator.Name(name); err != nil {
			return nil, err
		}
		user.Name = name
	}

	// Update picture if provided
	if picture != "" {
		user.Picture = picture
	}

	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}

	return &v1.UpdateUserResponse{
		Success:   true,
		Message:   "User updated successfully",
		Data:      s.mapper.ModelToProto(user),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// DeleteUser deletes a user.
func (s *userService) DeleteUser(ctx context.Context, userID int32) (*v1.DeleteUserResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	if err := s.userRepo.Delete(ctx, userID); err != nil {
		return nil, err
	}

	return &v1.DeleteUserResponse{
		Success:   true,
		Message:   "User deleted successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ExistsByEmail checks if a user exists by email.
func (s *userService) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	if err := validator.Email(email); err != nil {
		return false, err
	}
	return s.userRepo.ExistsByEmail(ctx, email)
}

// UpdateUserPreferences updates a user's preferences, including currency.
// If currency is changed, it triggers a background job to convert all monetary values.
func (s *userService) UpdateUserPreferences(ctx context.Context, userID int32, preferredCurrency string) (*v1.UpdateUserResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Validate the new currency
	if preferredCurrency != "" && !s.fxRateSvc.IsSupportedCurrency(preferredCurrency) {
		return nil, apperrors.NewValidationError(fmt.Sprintf("unsupported currency: %s", preferredCurrency))
	}

	// Get existing user
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Check if currency is actually changing
	oldCurrency := user.PreferredCurrency
	if oldCurrency == preferredCurrency || preferredCurrency == "" {
		return &v1.UpdateUserResponse{
			Success:   true,
			Message:   "No currency change needed",
			Data:      s.mapper.ModelToProto(user),
			Timestamp: time.Now().Format(time.RFC3339),
		}, nil
	}

	// Check if a conversion is already in progress
	if user.ConversionInProgress {
		return nil, apperrors.NewConflictError("currency conversion already in progress")
	}

	// Validate that we can get the FX rate for this pair
	rate, err := s.fxRateSvc.GetRate(ctx, oldCurrency, preferredCurrency)
	if err != nil {
		return nil, apperrors.NewValidationError(fmt.Sprintf("cannot get exchange rate from %s to %s: %v", oldCurrency, preferredCurrency, err))
	}
	if rate == 0 {
		return nil, apperrors.NewValidationError("invalid exchange rate returned")
	}

	// Update user's preferred currency and set conversion flag
	user.PreferredCurrency = preferredCurrency
	user.ConversionInProgress = true

	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update user preferences: %w", err)
	}

	// Trigger background job for currency conversion
	// In production, this should be handled by a proper job queue (e.g., Redis Queue, RabbitMQ)
	// For now, we'll run it in a goroutine with proper error handling
	go s.convertUserCurrency(context.Background(), userID, oldCurrency, preferredCurrency)

	return &v1.UpdateUserResponse{
		Success:   true,
		Message:   fmt.Sprintf("Currency conversion from %s to %s has started. You will be notified when complete.", oldCurrency, preferredCurrency),
		Data:      s.mapper.ModelToProto(user),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// convertUserCurrency is a background job that converts all monetary values for a user.
// It processes wallets, transactions, budgets, and investments in batches.
func (s *userService) convertUserCurrency(ctx context.Context, userID int32, fromCurrency, toCurrency string) {
	log.Printf("Starting currency conversion for user %d: %s -> %s", userID, fromCurrency, toCurrency)

	// Create a timeout context for the entire conversion process
	timeoutCtx, cancel := context.WithTimeout(ctx, conversionTimeout)
	defer cancel()

	// Track any errors that occur during conversion
	var conversionErrors []error

	// Step 1: Convert all wallet balances
	if err := s.convertWalletCurrencies(timeoutCtx, userID, fromCurrency, toCurrency); err != nil {
		log.Printf("Error converting wallet currencies for user %d: %v", userID, err)
		conversionErrors = append(conversionErrors, fmt.Errorf("wallets: %w", err))
	}

	// Step 2: Convert all transactions
	if err := s.convertTransactionCurrencies(timeoutCtx, userID, fromCurrency, toCurrency); err != nil {
		log.Printf("Error converting transaction currencies for user %d: %v", userID, err)
		conversionErrors = append(conversionErrors, fmt.Errorf("transactions: %w", err))
	}

	// Step 3: Convert all budgets and budget items
	if err := s.convertBudgetCurrencies(timeoutCtx, userID, fromCurrency, toCurrency); err != nil {
		log.Printf("Error converting budget currencies for user %d: %v", userID, err)
		conversionErrors = append(conversionErrors, fmt.Errorf("budgets: %w", err))
	}

	// NOTE: We do NOT convert investments to user's preferred currency
	// Investments should maintain their native currency (e.g., AAPL in USD, VCB in VND)
	// The enrichInvestmentProto() and GetAggregatedPortfolioSummary() functions
	// handle on-the-fly conversion for display purposes only.

	// Step 4: Clear all currency cache for this user
	if s.currencyCache != nil {
		if err := s.currencyCache.DeleteUserCache(timeoutCtx, userID); err != nil {
			log.Printf("Error clearing currency cache for user %d: %v", userID, err)
			// Don't fail the conversion if cache cleanup fails
		} else {
			log.Printf("Cleared currency cache for user %d", userID)
		}
	}

	// Final step: Clear the conversion in progress flag
	user, err := s.userRepo.GetByID(timeoutCtx, userID)
	if err != nil {
		log.Printf("Error getting user %d to clear conversion flag: %v", userID, err)
		return
	}

	user.ConversionInProgress = false
	if err := s.userRepo.Update(timeoutCtx, user); err != nil {
		log.Printf("Error clearing conversion in progress flag for user %d: %v", userID, err)
		return
	}

	// Log completion status
	if len(conversionErrors) > 0 {
		log.Printf("Currency conversion for user %d completed with %d error(s): %v", userID, len(conversionErrors), conversionErrors)
	} else {
		log.Printf("Currency conversion for user %d completed successfully", userID)
	}
}

// convertWalletCurrencies converts all wallet balances for a user in batches.
func (s *userService) convertWalletCurrencies(ctx context.Context, userID int32, fromCurrency, toCurrency string) error {
	if s.walletRepo == nil {
		return fmt.Errorf("wallet repository not available")
	}

	// IMPORTANT: Invalidate investment value caches BEFORE converting wallet currencies
	// This ensures that cached values (calculated in old wallet currency) are not used
	// after the wallet currency changes. The cache will be repopulated on next access.
	if s.redisCache != nil {
		if err := s.invalidateInvestmentValueCachesForUser(ctx, userID); err != nil {
			log.Printf("Error invalidating investment value caches for user %d: %v", userID, err)
			// Don't fail - this is just cache invalidation
		} else {
			log.Printf("Invalidated investment value caches for user %d before currency conversion", userID)
		}
	}

	offset := 0
	totalProcessed := 0

	for {
		// Fetch a batch of wallets
		wallets, _, err := s.walletRepo.ListByUserID(ctx, userID, repository.ListOptions{
			Limit:  batchSize,
			Offset: offset,
		})
		if err != nil {
			return fmt.Errorf("failed to list wallets: %w", err)
		}

		if len(wallets) == 0 {
			break
		}

		// Convert each wallet in the batch
		for _, wallet := range wallets {
			// Convert the balance using the FX rate service
			convertedBalance, err := s.fxRateSvc.ConvertAmount(ctx, wallet.Balance, fromCurrency, toCurrency)
			if err != nil {
				log.Printf("Error converting wallet %d balance: %v", wallet.ID, err)
				continue // Continue with next wallet instead of failing entire batch
			}

			// Update wallet balance and currency
			wallet.Balance = convertedBalance
			wallet.Currency = toCurrency

			if err := s.walletRepo.Update(ctx, wallet); err != nil {
				log.Printf("Error updating wallet %d: %v", wallet.ID, err)
				continue
			}

			totalProcessed++
		}

		// Move to next batch
		offset += len(wallets)
	}

	log.Printf("Converted %d wallet(s) for user %d", totalProcessed, userID)

	return nil
}

// invalidateInvestmentValueCachesForUser clears all investment value caches for a user's wallets
func (s *userService) invalidateInvestmentValueCachesForUser(ctx context.Context, userID int32) error {
	if s.walletRepo == nil || s.redisCache == nil {
		return nil // Nothing to do if dependencies not available
	}

	// Get all wallets for the user
	wallets, _, err := s.walletRepo.ListByUserID(ctx, userID, repository.ListOptions{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		return fmt.Errorf("failed to list wallets: %w", err)
	}

	// Clear investment value cache for all wallets
	for _, wallet := range wallets {
		cacheKey := cache.GetInvestmentValueCacheKey(wallet.ID)
		s.redisCache.Del(ctx, cacheKey)
	}

	return nil
}

// convertTransactionCurrencies converts all transaction amounts for a user in batches.
func (s *userService) convertTransactionCurrencies(ctx context.Context, userID int32, fromCurrency, toCurrency string) error {
	if s.transactionRepo == nil {
		return fmt.Errorf("transaction repository not available")
	}

	// Get all wallet IDs for the user to fetch transactions
	wallets, _, err := s.walletRepo.ListByUserID(ctx, userID, repository.ListOptions{
		Limit:  1000, // Large limit to get all wallets
		Offset: 0,
	})
	if err != nil {
		return fmt.Errorf("failed to list wallets: %w", err)
	}

	totalProcessed := 0

	// Process transactions for each wallet
	for _, wallet := range wallets {
		offset := 0

		for {
			// Use List with filter for wallet ID
			transactions, _, err := s.transactionRepo.List(ctx, userID, repository.TransactionFilter{
				WalletID: &wallet.ID,
			}, repository.ListOptions{
				Limit:  batchSize,
				Offset: offset,
			})
			if err != nil {
				log.Printf("Error listing transactions for wallet %d: %v", wallet.ID, err)
				break
			}

			if len(transactions) == 0 {
				break
			}

			// Convert each transaction in the batch
			for _, transaction := range transactions {
				// Convert the amount using the FX rate service
				convertedAmount, err := s.fxRateSvc.ConvertAmount(ctx, transaction.Amount, fromCurrency, toCurrency)
				if err != nil {
					log.Printf("Error converting transaction %d amount: %v", transaction.ID, err)
					continue
				}

				// Update transaction amount and currency
				transaction.Amount = convertedAmount
				transaction.Currency = toCurrency

				if err := s.transactionRepo.Update(ctx, transaction); err != nil {
					log.Printf("Error updating transaction %d: %v", transaction.ID, err)
					continue
				}

				totalProcessed++
			}

			offset += len(transactions)
		}
	}

	log.Printf("Converted %d transaction(s) for user %d", totalProcessed, userID)
	return nil
}

// convertBudgetCurrencies converts all budgets and budget items for a user in batches.
func (s *userService) convertBudgetCurrencies(ctx context.Context, userID int32, fromCurrency, toCurrency string) error {
	if s.budgetRepo == nil || s.budgetItemRepo == nil {
		return fmt.Errorf("budget repository not available")
	}

	offset := 0
	totalBudgetsProcessed := 0
	totalItemsProcessed := 0

	for {
		// Fetch a batch of budgets
		budgets, _, err := s.budgetRepo.ListByUserID(ctx, userID, repository.ListOptions{
			Limit:  batchSize,
			Offset: offset,
		})
		if err != nil {
			return fmt.Errorf("failed to list budgets: %w", err)
		}

		if len(budgets) == 0 {
			break
		}

		// Convert each budget in the batch
		for _, budget := range budgets {
			// Convert the total amount
			convertedTotal, err := s.fxRateSvc.ConvertAmount(ctx, budget.Total, fromCurrency, toCurrency)
			if err != nil {
				log.Printf("Error converting budget %d total: %v", budget.ID, err)
				continue
			}

			budget.Total = convertedTotal
			budget.Currency = toCurrency

			// Convert budget items using budgetItemRepo
			items, err := s.budgetItemRepo.ListByBudgetID(ctx, budget.ID)
			if err != nil {
				log.Printf("Error getting items for budget %d: %v", budget.ID, err)
			} else {
				for _, item := range items {
					convertedItemAmount, err := s.fxRateSvc.ConvertAmount(ctx, item.Total, fromCurrency, toCurrency)
					if err != nil {
						log.Printf("Error converting budget item %d amount: %v", item.ID, err)
						continue
					}

					item.Total = convertedItemAmount

					if err := s.budgetItemRepo.Update(ctx, item); err != nil {
						log.Printf("Error updating budget item %d: %v", item.ID, err)
						continue
					}

					totalItemsProcessed++
				}
			}

			if err := s.budgetRepo.Update(ctx, budget); err != nil {
				log.Printf("Error updating budget %d: %v", budget.ID, err)
				continue
			}

			totalBudgetsProcessed++
		}

		offset += len(budgets)
	}

	log.Printf("Converted %d budget(s) and %d budget item(s) for user %d", totalBudgetsProcessed, totalItemsProcessed, userID)
	return nil
}

// supportedLanguages is the allowlist for language preferences.
var supportedLanguages = map[string]bool{
	"en": true,
	"vi": true,
}

// UpdatePreferences updates a user's preferences, including currency and language.
// This is the handler for the UpdatePreferences RPC call.
func (s *userService) UpdatePreferences(ctx context.Context, userID int32, req *v1.UpdatePreferencesRequest) (*v1.UpdatePreferencesResponse, error) {
	// Extract fields from request
	var preferredCurrency string
	var language string
	if req.Preferences != nil {
		preferredCurrency = req.Preferences.PreferredCurrency
		language = req.Preferences.Language
	}

	// Validate language if provided
	if language != "" {
		if len(language) > 5 {
			return nil, apperrors.NewValidationError("unsupported language; valid values: en, vi")
		}
		if !supportedLanguages[language] {
			return nil, apperrors.NewValidationError("unsupported language; valid values: en, vi")
		}
	}

	// Handle currency update (existing logic via UpdateUserPreferences)
	var updateResp *v1.UpdateUserResponse
	var err error

	if preferredCurrency != "" {
		updateResp, err = s.UpdateUserPreferences(ctx, userID, preferredCurrency)
		if err != nil {
			return nil, err
		}
	} else {
		// No currency change — get current user state for response
		user, err := s.userRepo.GetByID(ctx, userID)
		if err != nil {
			return nil, err
		}
		updateResp = &v1.UpdateUserResponse{
			Success:   true,
			Message:   "Preferences updated",
			Data:      s.mapper.ModelToProto(user),
			Timestamp: time.Now().Format(time.RFC3339),
		}
	}

	// Handle language update (simple, no background job)
	if language != "" {
		user, err := s.userRepo.GetByID(ctx, userID)
		if err != nil {
			return nil, err
		}
		if user.PreferredLanguage != language {
			user.PreferredLanguage = language
			if err := s.userRepo.Update(ctx, user); err != nil {
				return nil, fmt.Errorf("failed to update language preference: %w", err)
			}
			updateResp.Data = s.mapper.ModelToProto(user)
			updateResp.Message = "Preferences updated"
		}
	}

	// Convert response to UpdatePreferencesResponse format
	return &v1.UpdatePreferencesResponse{
		Success:   updateResp.Success,
		Message:   updateResp.Message,
		Data:      updateResp.Data,
		Timestamp: updateResp.Timestamp,
	}, nil
}
