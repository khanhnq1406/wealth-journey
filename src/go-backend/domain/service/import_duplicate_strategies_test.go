package service

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
	v1 "wealthjourney/protobuf/v1"
)

// TestExecuteImport_ReviewEachStrategy_MERGE tests MERGE action for duplicate handling
func TestExecuteImport_ReviewEachStrategy_MERGE(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	ctx := context.Background()
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Setup repositories and services
	userRepo, walletRepo, categoryRepo, transactionRepo, importRepo := setupRepositories(db)
	importService := setupImportService(importRepo, transactionRepo, walletRepo, categoryRepo, db)

	// Create test user, wallet, and category
	user, wallet, category := setupTestUserWalletCategory(t, ctx, userRepo, walletRepo, categoryRepo)

	// Create an existing transaction (potential duplicate)
	// Note: Description must have >80% similarity with parsed transaction for duplicate detection
	existingDate := time.Now().AddDate(0, 0, -1)
	existingTx := &models.Transaction{
		WalletID:   wallet.ID,
		Amount:     -500000, // 500K VND expense (negative)
		Date:       existingDate,
		CategoryID: &category.ID,
		Note:       "STARBUCKS COFFEE", // Exact match for duplicate detection
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	err := transactionRepo.Create(ctx, existingTx)
	require.NoError(t, err)

	// Prepare imported transactions with one duplicate
	parsedTransactions := []*v1.ParsedTransaction{
		{
			RowNumber:   1,
			Date:        existingDate.Unix(),
			Description: "STARBUCKS COFFEE", // Exact match for duplicate detection (>80% similarity required)
			Amount: &v1.Money{
				Amount:   -500000,
				Currency: "VND",
			},
			Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
			SuggestedCategoryId: category.ID,
			IsValid:             true,
		},
		{
			RowNumber:   2,
			Date:        time.Now().Unix(),
			Description: "New Restaurant",
			Amount: &v1.Money{
				Amount:   -300000,
				Currency: "VND",
			},
			Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
			SuggestedCategoryId: category.ID,
			IsValid:             true,
		},
	}

	// User chooses to MERGE the duplicate
	duplicateActions := []*v1.DuplicateAction{
		{
			ImportedRowNumber:     1,
			ExistingTransactionId: existingTx.ID,
			Action:                v1.DuplicateActionType_DUPLICATE_ACTION_MERGE,
		},
	}

	req := &v1.ExecuteImportRequest{
		FileId:           "test-file-review-merge",
		WalletId:         wallet.ID,
		Transactions:     parsedTransactions,
		Strategy:         v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_REVIEW_EACH,
		DuplicateActions: duplicateActions,
	}

	resp, err := importService.ExecuteImport(ctx, user.ID, req)
	require.NoError(t, err)
	require.True(t, resp.Success)

	// Should import 1 new transaction and merge 1
	assert.Equal(t, int32(1), resp.Summary.TotalImported)
	assert.Equal(t, int32(1), resp.Summary.DuplicatesMerged)

	// Verify existing transaction was updated
	updatedTx, err := transactionRepo.GetByID(ctx, existingTx.ID)
	require.NoError(t, err)
	assert.Equal(t, "STARBUCKS COFFEE", updatedTx.Note)
}

// TestExecuteImport_ReviewEachStrategy_KEEP_BOTH tests KEEP_BOTH action for duplicate handling
func TestExecuteImport_ReviewEachStrategy_KEEP_BOTH(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	ctx := context.Background()
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Setup repositories and services
	userRepo, walletRepo, categoryRepo, transactionRepo, importRepo := setupRepositories(db)
	importService := setupImportService(importRepo, transactionRepo, walletRepo, categoryRepo, db)

	// Create test user, wallet, and category
	user, wallet, category := setupTestUserWalletCategory(t, ctx, userRepo, walletRepo, categoryRepo)

	// Create an existing transaction (potential duplicate)
	existingDate := time.Now().AddDate(0, 0, -1)
	existingTx := &models.Transaction{
		WalletID:   wallet.ID,
		Amount:     -500000,
		Date:       existingDate,
		CategoryID: &category.ID,
		Note:       "STARBUCKS COFFEE",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	err := transactionRepo.Create(ctx, existingTx)
	require.NoError(t, err)

	// Prepare imported transactions with one duplicate
	parsedTransactions := []*v1.ParsedTransaction{
		{
			RowNumber:   1,
			Date:        existingDate.Unix(),
			Description: "STARBUCKS COFFEE",
			Amount: &v1.Money{
				Amount:   -500000,
				Currency: "VND",
			},
			Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
			SuggestedCategoryId: category.ID,
			IsValid:             true,
		},
		{
			RowNumber:   2,
			Date:        time.Now().Unix(),
			Description: "New Restaurant",
			Amount: &v1.Money{
				Amount:   -300000,
				Currency: "VND",
			},
			Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
			SuggestedCategoryId: category.ID,
			IsValid:             true,
		},
	}

	// User chooses to KEEP_BOTH
	duplicateActions := []*v1.DuplicateAction{
		{
			ImportedRowNumber:     1,
			ExistingTransactionId: existingTx.ID,
			Action:                v1.DuplicateActionType_DUPLICATE_ACTION_KEEP_BOTH,
		},
	}

	req := &v1.ExecuteImportRequest{
		FileId:           "test-file-review-keep-both",
		WalletId:         wallet.ID,
		Transactions:     parsedTransactions,
		Strategy:         v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_REVIEW_EACH,
		DuplicateActions: duplicateActions,
	}

	resp, err := importService.ExecuteImport(ctx, user.ID, req)
	require.NoError(t, err)
	require.True(t, resp.Success)

	// Should import 2 new transactions
	assert.Equal(t, int32(2), resp.Summary.TotalImported)
	assert.Equal(t, int32(0), resp.Summary.DuplicatesMerged)
}

// TestExecuteImport_ReviewEachStrategy_SKIP tests SKIP action for duplicate handling
func TestExecuteImport_ReviewEachStrategy_SKIP(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	ctx := context.Background()
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Setup repositories and services
	userRepo, walletRepo, categoryRepo, transactionRepo, importRepo := setupRepositories(db)
	importService := setupImportService(importRepo, transactionRepo, walletRepo, categoryRepo, db)

	// Create test user, wallet, and category
	user, wallet, category := setupTestUserWalletCategory(t, ctx, userRepo, walletRepo, categoryRepo)

	// Create an existing transaction (potential duplicate)
	existingDate := time.Now().AddDate(0, 0, -1)
	existingTx := &models.Transaction{
		WalletID:   wallet.ID,
		Amount:     -500000,
		Date:       existingDate,
		CategoryID: &category.ID,
		Note:       "STARBUCKS COFFEE",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	err := transactionRepo.Create(ctx, existingTx)
	require.NoError(t, err)

	// Prepare imported transactions with one duplicate
	parsedTransactions := []*v1.ParsedTransaction{
		{
			RowNumber:   1,
			Date:        existingDate.Unix(),
			Description: "STARBUCKS COFFEE",
			Amount: &v1.Money{
				Amount:   -500000,
				Currency: "VND",
			},
			Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
			SuggestedCategoryId: category.ID,
			IsValid:             true,
		},
		{
			RowNumber:   2,
			Date:        time.Now().Unix(),
			Description: "New Restaurant",
			Amount: &v1.Money{
				Amount:   -300000,
				Currency: "VND",
			},
			Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
			SuggestedCategoryId: category.ID,
			IsValid:             true,
		},
	}

	// User chooses to SKIP
	duplicateActions := []*v1.DuplicateAction{
		{
			ImportedRowNumber:     1,
			ExistingTransactionId: existingTx.ID,
			Action:                v1.DuplicateActionType_DUPLICATE_ACTION_SKIP,
		},
	}

	req := &v1.ExecuteImportRequest{
		FileId:           "test-file-review-skip",
		WalletId:         wallet.ID,
		Transactions:     parsedTransactions,
		Strategy:         v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_REVIEW_EACH,
		DuplicateActions: duplicateActions,
	}

	resp, err := importService.ExecuteImport(ctx, user.ID, req)
	require.NoError(t, err)
	require.True(t, resp.Success)

	// Should import 1 new transaction and skip 1
	assert.Equal(t, int32(1), resp.Summary.TotalImported)
	assert.Equal(t, int32(1), resp.Summary.DuplicatesSkipped)
}

// TestExecuteImport_ReviewEachStrategy_NOT_DUPLICATE tests NOT_DUPLICATE action for duplicate handling
func TestExecuteImport_ReviewEachStrategy_NOT_DUPLICATE(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	ctx := context.Background()
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Setup repositories and services
	userRepo, walletRepo, categoryRepo, transactionRepo, importRepo := setupRepositories(db)
	importService := setupImportService(importRepo, transactionRepo, walletRepo, categoryRepo, db)

	// Create test user, wallet, and category
	user, wallet, category := setupTestUserWalletCategory(t, ctx, userRepo, walletRepo, categoryRepo)

	// Create an existing transaction (potential duplicate)
	existingDate := time.Now().AddDate(0, 0, -1)
	existingTx := &models.Transaction{
		WalletID:   wallet.ID,
		Amount:     -500000,
		Date:       existingDate,
		CategoryID: &category.ID,
		Note:       "STARBUCKS COFFEE",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	err := transactionRepo.Create(ctx, existingTx)
	require.NoError(t, err)

	// Prepare imported transactions with one duplicate
	parsedTransactions := []*v1.ParsedTransaction{
		{
			RowNumber:   1,
			Date:        existingDate.Unix(),
			Description: "STARBUCKS COFFEE",
			Amount: &v1.Money{
				Amount:   -500000,
				Currency: "VND",
			},
			Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
			SuggestedCategoryId: category.ID,
			IsValid:             true,
		},
		{
			RowNumber:   2,
			Date:        time.Now().Unix(),
			Description: "New Restaurant",
			Amount: &v1.Money{
				Amount:   -300000,
				Currency: "VND",
			},
			Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
			SuggestedCategoryId: category.ID,
			IsValid:             true,
		},
	}

	// User marks as false positive
	duplicateActions := []*v1.DuplicateAction{
		{
			ImportedRowNumber:     1,
			ExistingTransactionId: existingTx.ID,
			Action:                v1.DuplicateActionType_DUPLICATE_ACTION_NOT_DUPLICATE,
		},
	}

	req := &v1.ExecuteImportRequest{
		FileId:           "test-file-review-not-dup",
		WalletId:         wallet.ID,
		Transactions:     parsedTransactions,
		Strategy:         v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_REVIEW_EACH,
		DuplicateActions: duplicateActions,
	}

	resp, err := importService.ExecuteImport(ctx, user.ID, req)
	require.NoError(t, err)
	require.True(t, resp.Success)

	// Should import 2 new transactions
	assert.Equal(t, int32(2), resp.Summary.TotalImported)
}

// TestExecuteImport_KeepAllStrategy tests the KEEP_ALL duplicate handling strategy
func TestExecuteImport_KeepAllStrategy(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	ctx := context.Background()
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Setup repositories and services
	userRepo, walletRepo, categoryRepo, transactionRepo, importRepo := setupRepositories(db)
	importService := setupImportService(importRepo, transactionRepo, walletRepo, categoryRepo, db)

	// Create test user, wallet, and category
	user, wallet, category := setupTestUserWalletCategory(t, ctx, userRepo, walletRepo, categoryRepo)

	// Create existing transactions (potential duplicates)
	existingDate := time.Now().AddDate(0, 0, -1)
	existingTx1 := &models.Transaction{
		WalletID:   wallet.ID,
		Amount:     -500000, // Expense (negative)
		Date:       existingDate,
		CategoryID: &category.ID,
		Note:       "STARBUCKS COFFEE",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	err := transactionRepo.Create(ctx, existingTx1)
	require.NoError(t, err)

	existingTx2 := &models.Transaction{
		WalletID:   wallet.ID,
		Amount:     -300000, // Expense (negative)
		Date:       existingDate,
		CategoryID: &category.ID,
		Note:       "RESTAURANT LUNCH",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	err = transactionRepo.Create(ctx, existingTx2)
	require.NoError(t, err)

	// Prepare imported transactions (2 potential duplicates)
	parsedTransactions := []*v1.ParsedTransaction{
		{
			RowNumber:   1,
			Date:        existingDate.Unix(),
			Description: "STARBUCKS COFFEE",
			Amount: &v1.Money{
				Amount:   -500000,
				Currency: "VND",
			},
			Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
			SuggestedCategoryId: category.ID,
			IsValid:             true,
		},
		{
			RowNumber:   2,
			Date:        existingDate.Unix(),
			Description: "RESTAURANT LUNCH",
			Amount: &v1.Money{
				Amount:   -300000,
				Currency: "VND",
			},
			Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
			SuggestedCategoryId: category.ID,
			IsValid:             true,
		},
	}

	req := &v1.ExecuteImportRequest{
		FileId:       "test-file-keep-all",
		WalletId:     wallet.ID,
		Transactions: parsedTransactions,
		Strategy:     v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_KEEP_ALL,
	}

	resp, err := importService.ExecuteImport(ctx, user.ID, req)
	require.NoError(t, err)
	require.True(t, resp.Success)

	// Should import all 2 transactions
	assert.Equal(t, int32(2), resp.Summary.TotalImported)
	assert.Equal(t, int32(0), resp.Summary.DuplicatesSkipped)
	assert.Equal(t, int32(0), resp.Summary.DuplicatesMerged)

	// Verify transactions were created
	filter := repository.TransactionFilter{
		WalletID: &wallet.ID,
	}
	allTxs, _, err := transactionRepo.List(ctx, user.ID, filter, repository.ListOptions{
		Limit:  100,
		Offset: 0,
	})
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(allTxs), 4) // 2 existing + 2 new
}

// TestExecuteImport_RejectsZeroAmount tests that zero-amount transactions are rejected
func TestExecuteImport_RejectsZeroAmount(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	ctx := context.Background()
	db, cleanup := setupTestDB(t)
	defer cleanup()

	// Setup repositories and services
	userRepo, walletRepo, categoryRepo, transactionRepo, importRepo := setupRepositories(db)
	importService := setupImportService(importRepo, transactionRepo, walletRepo, categoryRepo, db)

	// Create test user, wallet, and category
	user, wallet, category := setupTestUserWalletCategory(t, ctx, userRepo, walletRepo, categoryRepo)

	t.Run("Zero-amount transactions are skipped", func(t *testing.T) {
		// Prepare transactions including zero-amount ones
		parsedTransactions := []*v1.ParsedTransaction{
			{
				RowNumber:   1,
				Date:        time.Now().Unix(),
				Description: "Valid transaction",
				Amount: &v1.Money{
					Amount:   -100000, // Valid amount
					Currency: "VND",
				},
				Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
				SuggestedCategoryId: category.ID,
				IsValid:             true,
			},
			{
				RowNumber:   2,
				Date:        time.Now().Unix(),
				Description: "Zero amount transaction",
				Amount: &v1.Money{
					Amount:   0, // Zero amount - should be rejected
					Currency: "VND",
				},
				Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
				SuggestedCategoryId: category.ID,
				IsValid:             true,
			},
			{
				RowNumber:   3,
				Date:        time.Now().Unix(),
				Description: "Another valid transaction",
				Amount: &v1.Money{
					Amount:   50000, // Valid amount
					Currency: "VND",
				},
				Type:                v1.TransactionType_TRANSACTION_TYPE_INCOME,
				SuggestedCategoryId: category.ID,
				IsValid:             true,
			},
		}

		req := &v1.ExecuteImportRequest{
			FileId:       "test-file-zero-amount",
			WalletId:     wallet.ID,
			Transactions: parsedTransactions,
			Strategy:     v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_KEEP_ALL,
		}

		resp, err := importService.ExecuteImport(ctx, user.ID, req)
		require.NoError(t, err)
		require.True(t, resp.Success)

		// Should only import 2 transactions (skip the zero-amount one)
		assert.Equal(t, int32(2), resp.Summary.TotalImported, "Should import only 2 valid transactions")

		// Verify the correct transactions were imported
		filter := repository.TransactionFilter{
			WalletID: &wallet.ID,
		}
		importedTxs, _, err := transactionRepo.List(ctx, user.ID, filter, repository.ListOptions{
			Limit:  100,
			Offset: 0,
		})
		require.NoError(t, err)
		assert.Equal(t, 2, len(importedTxs), "Should have exactly 2 transactions in database")

		// Verify amounts are correct (not zero)
		for _, tx := range importedTxs {
			assert.NotEqual(t, int64(0), tx.Amount, "Imported transaction should not have zero amount")
		}

		// Verify expense and income totals don't include zero-amount transaction
		// Amounts are divided by 10000 in import_service.go before storage
		// -100000 / 10000 = -10 (expense), 50000 / 10000 = 5 (income)
		assert.Equal(t, int64(10), resp.Summary.TotalExpenses, "Total expenses should be 10 VND")
		assert.Equal(t, int64(5), resp.Summary.TotalIncome, "Total income should be 5 VND")
	})

	t.Run("All zero-amount transactions results in no imports", func(t *testing.T) {
		// Create a new wallet for this sub-test to ensure isolation
		wallet2 := &models.Wallet{
			UserID:     user.ID,
			WalletName: "Test Wallet 2",
			Balance:    1000000,
			Currency:   "VND",
			Status:     1,
			Type:       int32(v1.WalletType_BASIC),
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}
		err := walletRepo.Create(ctx, wallet2)
		require.NoError(t, err)

		// Prepare only zero-amount transactions
		parsedTransactions := []*v1.ParsedTransaction{
			{
				RowNumber:   1,
				Date:        time.Now().Unix(),
				Description: "Zero amount 1",
				Amount: &v1.Money{
					Amount:   0,
					Currency: "VND",
				},
				Type:                v1.TransactionType_TRANSACTION_TYPE_EXPENSE,
				SuggestedCategoryId: category.ID,
				IsValid:             true,
			},
			{
				RowNumber:   2,
				Date:        time.Now().Unix(),
				Description: "Zero amount 2",
				Amount: &v1.Money{
					Amount:   0,
					Currency: "VND",
				},
				Type:                v1.TransactionType_TRANSACTION_TYPE_INCOME,
				SuggestedCategoryId: category.ID,
				IsValid:             true,
			},
		}

		req := &v1.ExecuteImportRequest{
			FileId:       "test-file-all-zero",
			WalletId:     wallet2.ID,
			Transactions: parsedTransactions,
			Strategy:     v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_KEEP_ALL,
		}

		resp, err := importService.ExecuteImport(ctx, user.ID, req)
		require.NoError(t, err)
		require.True(t, resp.Success)

		// Should import 0 transactions
		assert.Equal(t, int32(0), resp.Summary.TotalImported, "Should import 0 transactions")
		assert.Equal(t, int64(0), resp.Summary.TotalExpenses, "Total expenses should be 0")
		assert.Equal(t, int64(0), resp.Summary.TotalIncome, "Total income should be 0")
	})
}

// Helper functions for test setup
func setupRepositories(db *database.Database) (
	userRepo repository.UserRepository,
	walletRepo repository.WalletRepository,
	categoryRepo repository.CategoryRepository,
	transactionRepo repository.TransactionRepository,
	importRepo repository.ImportRepository,
) {
	userRepo = repository.NewUserRepository(db)
	walletRepo = repository.NewWalletRepository(db)
	categoryRepo = repository.NewCategoryRepository(db)
	transactionRepo = repository.NewTransactionRepository(db)
	importRepo = repository.NewImportRepository(db)
	return
}

func setupImportService(
	importRepo repository.ImportRepository,
	transactionRepo repository.TransactionRepository,
	walletRepo repository.WalletRepository,
	categoryRepo repository.CategoryRepository,
	db *database.Database,
) ImportService {
	merchantRepo := repository.NewMerchantRuleRepository(db)
	keywordRepo := repository.NewKeywordRepository(db)
	userMappingRepo := repository.NewUserMappingRepository(db)
	fxService := &mockFXService{}

	return NewImportService(
		db,
		importRepo,
		transactionRepo,
		walletRepo,
		categoryRepo,
		merchantRepo,
		keywordRepo,
		userMappingRepo,
		fxService,
		nil, // jobQueue - not needed for tests
	)
}

func setupTestUserWalletCategory(
	t *testing.T,
	ctx context.Context,
	userRepo repository.UserRepository,
	walletRepo repository.WalletRepository,
	categoryRepo repository.CategoryRepository,
) (user *models.User, wallet *models.Wallet, category *models.Category) {
	// Use t.Name() to generate a unique email per test to avoid unique constraint violations
	// when multiple tests share the same database.
	safeName := strings.ToLower(strings.ReplaceAll(t.Name(), "/", "-"))
	if len(safeName) > 40 {
		safeName = safeName[:40]
	}
	email := fmt.Sprintf("%s@example.com", safeName)

	// Create test user
	user = &models.User{
		Email:             email,
		Name:              "Test User",
		PreferredCurrency: "VND",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
	err := userRepo.Create(ctx, user)
	require.NoError(t, err)

	// Create test wallet
	wallet = &models.Wallet{
		UserID:     user.ID,
		WalletName: "Test Wallet",
		Balance:    10000000, // 100,000 VND
		Currency:   "VND",
		Status:     1,
		Type:       int32(v1.WalletType_BASIC),
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	err = walletRepo.Create(ctx, wallet)
	require.NoError(t, err)

	// Create test category
	category = &models.Category{
		UserID:    user.ID,
		Name:      "Food & Dining",
		Type:      int32(v1.CategoryType_CATEGORY_TYPE_EXPENSE),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	err = categoryRepo.Create(ctx, category)
	require.NoError(t, err)

	return
}

func setupTestDB(t *testing.T) (db *database.Database, cleanup func()) {
	cfg, err := config.Load()
	require.NoError(t, err)

	db, err = database.New(cfg)
	require.NoError(t, err)

	cleanup = func() {
		_ = db.Close()
	}
	return
}

// mockFXService is a mock implementation of ImportFXService for testing
type mockFXService struct{}

func (m *mockFXService) GetRate(ctx context.Context, fromCurrency, toCurrency string) (float64, error) {
	// Return 1:1 rate for testing
	return 1.0, nil
}

func (m *mockFXService) ConvertAmount(ctx context.Context, amount int64, fromCurrency, toCurrency string) (int64, error) {
	// Simple 1:1 conversion for testing
	return amount, nil
}
