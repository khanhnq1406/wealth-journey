package service

import (
	"context"
	"testing"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/types"
	"wealthjourney/pkg/yahoo"

	v1 "wealthjourney/protobuf/v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock dependencies
type MockWalletRepository struct {
	mock.Mock
}

func (m *MockWalletRepository) GetByID(ctx context.Context, id int32) (*models.Wallet, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Wallet), args.Error(1)
}

func (m *MockWalletRepository) GetByIDForUser(ctx context.Context, walletID, userID int32) (*models.Wallet, error) {
	args := m.Called(ctx, walletID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Wallet), args.Error(1)
}

func (m *MockWalletRepository) ExistsForUser(ctx context.Context, walletID, userID int32) (bool, error) {
	args := m.Called(ctx, walletID, userID)
	return args.Get(0).(bool), args.Error(1)
}

func (m *MockWalletRepository) Create(ctx context.Context, wallet *models.Wallet) error {
	args := m.Called(ctx, wallet)
	return args.Error(0)
}

func (m *MockWalletRepository) Update(ctx context.Context, wallet *models.Wallet) error {
	args := m.Called(ctx, wallet)
	return args.Error(0)
}

func (m *MockWalletRepository) Delete(ctx context.Context, id int32) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockWalletRepository) CountByUserID(ctx context.Context, userID int32) (int, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int), args.Error(1)
}

func (m *MockWalletRepository) ListByUserID(ctx context.Context, userID int32, opts repository.ListOptions) ([]*models.Wallet, int, error) {
	args := m.Called(ctx, userID, opts)
	return args.Get(0).([]*models.Wallet), args.Get(1).(int), args.Error(2)
}

func (m *MockWalletRepository) UpdateBalance(ctx context.Context, walletID int32, delta int64) (*models.Wallet, error) {
	args := m.Called(ctx, walletID, delta)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Wallet), args.Error(1)
}

func (m *MockWalletRepository) UpdateBalanceWithTx(ctx context.Context, dbTx interface{}, walletID int32, delta int64) (*models.Wallet, error) {
	args := m.Called(ctx, dbTx, walletID, delta)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Wallet), args.Error(1)
}

func (m *MockWalletRepository) GetTotalBalance(ctx context.Context, userID int32) (int64, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockWalletRepository) WithTx(tx interface{}) repository.WalletRepository {
	return m
}

type MockInvestmentRepository struct {
	mock.Mock
}

func (m *MockInvestmentRepository) Create(ctx context.Context, investment *models.Investment) error {
	args := m.Called(ctx, investment)
	return args.Error(0)
}

func (m *MockInvestmentRepository) GetByID(ctx context.Context, id int32) (*models.Investment, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Investment), args.Error(1)
}

func (m *MockInvestmentRepository) GetByIDForUser(ctx context.Context, investmentID, userID int32) (*models.Investment, error) {
	args := m.Called(ctx, investmentID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Investment), args.Error(1)
}

func (m *MockInvestmentRepository) GetByWalletAndSymbol(ctx context.Context, walletID int32, symbol string) (*models.Investment, error) {
	args := m.Called(ctx, walletID, symbol)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Investment), args.Error(1)
}

func (m *MockInvestmentRepository) ListByUserID(ctx context.Context, userID int32, opts repository.ListOptions, typeFilter v1.InvestmentType) ([]*models.Investment, int, error) {
	args := m.Called(ctx, userID, opts, typeFilter)
	return args.Get(0).([]*models.Investment), args.Get(1).(int), args.Error(2)
}

func (m *MockInvestmentRepository) ListByWalletID(ctx context.Context, walletID int32, opts repository.ListOptions, typeFilter v1.InvestmentType) ([]*models.Investment, int, error) {
	args := m.Called(ctx, walletID, opts, typeFilter)
	return args.Get(0).([]*models.Investment), args.Get(1).(int), args.Error(2)
}

func (m *MockInvestmentRepository) Update(ctx context.Context, investment *models.Investment) error {
	args := m.Called(ctx, investment)
	return args.Error(0)
}

func (m *MockInvestmentRepository) Delete(ctx context.Context, id int32) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockInvestmentRepository) UpdatePrices(ctx context.Context, updates []repository.PriceUpdate) error {
	args := m.Called(ctx, updates)
	return args.Error(0)
}

func (m *MockInvestmentRepository) GetPortfolioSummary(ctx context.Context, walletID int32) (*repository.PortfolioSummary, error) {
	args := m.Called(ctx, walletID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repository.PortfolioSummary), args.Error(1)
}

func (m *MockInvestmentRepository) GetAggregatedPortfolioSummary(ctx context.Context, userID int32, typeFilter v1.InvestmentType) (*repository.PortfolioSummary, error) {
	args := m.Called(ctx, userID, typeFilter)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repository.PortfolioSummary), args.Error(1)
}

func (m *MockInvestmentRepository) GetInvestmentValue(ctx context.Context, walletID int32) (int64, error) {
	args := m.Called(ctx, walletID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockInvestmentRepository) GetInvestmentValuesByWalletIDs(ctx context.Context, walletIDs []int32) (map[int32]int64, error) {
	args := m.Called(ctx, walletIDs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[int32]int64), args.Error(1)
}

type MockInvestmentTransactionRepository struct {
	mock.Mock
}

func (m *MockInvestmentTransactionRepository) Create(ctx context.Context, tx *models.InvestmentTransaction) error {
	args := m.Called(ctx, tx)
	return args.Error(0)
}

func (m *MockInvestmentTransactionRepository) GetByID(ctx context.Context, id int32) (*models.InvestmentTransaction, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.InvestmentTransaction), args.Error(1)
}

func (m *MockInvestmentTransactionRepository) GetByIDForUser(ctx context.Context, txID, userID int32) (*models.InvestmentTransaction, error) {
	args := m.Called(ctx, txID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.InvestmentTransaction), args.Error(1)
}

func (m *MockInvestmentTransactionRepository) ListByInvestmentID(ctx context.Context, investmentID int32, typeFilter *v1.InvestmentTransactionType, opts repository.ListOptions) ([]*models.InvestmentTransaction, int, error) {
	args := m.Called(ctx, investmentID, typeFilter, opts)
	return args.Get(0).([]*models.InvestmentTransaction), args.Get(1).(int), args.Error(2)
}

func (m *MockInvestmentTransactionRepository) Update(ctx context.Context, tx *models.InvestmentTransaction) error {
	args := m.Called(ctx, tx)
	return args.Error(0)
}

func (m *MockInvestmentTransactionRepository) Delete(ctx context.Context, id int32) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockInvestmentTransactionRepository) GetOpenLots(ctx context.Context, investmentID int32) ([]*models.InvestmentLot, error) {
	args := m.Called(ctx, investmentID)
	return args.Get(0).([]*models.InvestmentLot), args.Error(1)
}

func (m *MockInvestmentTransactionRepository) CreateLot(ctx context.Context, lot *models.InvestmentLot) error {
	args := m.Called(ctx, lot)
	return args.Error(0)
}

func (m *MockInvestmentTransactionRepository) UpdateLot(ctx context.Context, lot *models.InvestmentLot) error {
	args := m.Called(ctx, lot)
	return args.Error(0)
}

func (m *MockInvestmentTransactionRepository) GetLotByID(ctx context.Context, lotID int32) (*models.InvestmentLot, error) {
	args := m.Called(ctx, lotID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.InvestmentLot), args.Error(1)
}

func (m *MockInvestmentTransactionRepository) GetLotByIDForInvestment(ctx context.Context, lotID, investmentID int32) (*models.InvestmentLot, error) {
	args := m.Called(ctx, lotID, investmentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.InvestmentLot), args.Error(1)
}

func (m *MockInvestmentTransactionRepository) DeleteByInvestmentID(ctx context.Context, investmentID int32) error {
	args := m.Called(ctx, investmentID)
	return args.Error(0)
}

func (m *MockInvestmentTransactionRepository) DeleteLotsByInvestmentID(ctx context.Context, investmentID int32) error {
	args := m.Called(ctx, investmentID)
	return args.Error(0)
}

type MockMarketDataService struct {
	mock.Mock
}

func (m *MockMarketDataService) GetPrice(ctx context.Context, symbol, currency string, investmentType v1.InvestmentType, maxAge time.Duration) (*models.MarketData, error) {
	args := m.Called(ctx, symbol, currency, investmentType, maxAge)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.MarketData), args.Error(1)
}

func (m *MockMarketDataService) UpdatePricesForInvestments(ctx context.Context, investments []*models.Investment, forceRefresh bool) (map[int32]int64, error) {
	args := m.Called(ctx, investments, forceRefresh)
	return args.Get(0).(map[int32]int64), args.Error(1)
}

func (m *MockMarketDataService) SearchSymbols(ctx context.Context, query string, quotesCount int) ([]yahoo.SearchResult, error) {
	args := m.Called(ctx, query, quotesCount)
	return args.Get(0).([]yahoo.SearchResult), args.Error(1)
}

func (m *MockMarketDataService) GetPriceBatch(ctx context.Context, symbols []string) (map[string]*models.MarketData, error) {
	args := m.Called(ctx, symbols)
	return args.Get(0).(map[string]*models.MarketData), args.Error(1)
}

type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) GetByID(ctx context.Context, id int32) (*models.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) Create(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) Update(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) Delete(ctx context.Context, id int32) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) List(ctx context.Context, opts repository.ListOptions) ([]*models.User, int, error) {
	args := m.Called(ctx, opts)
	return args.Get(0).([]*models.User), args.Get(1).(int), args.Error(2)
}

func (m *MockUserRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	args := m.Called(ctx, email)
	return args.Get(0).(bool), args.Error(1)
}

type MockFXRateService struct {
	mock.Mock
}

func (m *MockFXRateService) GetRate(ctx context.Context, fromCurrency, toCurrency string) (float64, error) {
	args := m.Called(ctx, fromCurrency, toCurrency)
	return args.Get(0).(float64), args.Error(1)
}

func (m *MockFXRateService) ConvertAmount(ctx context.Context, amount int64, fromCurrency, toCurrency string) (int64, error) {
	args := m.Called(ctx, amount, fromCurrency, toCurrency)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockFXRateService) BatchGetRates(ctx context.Context, pairs []CurrencyPair) (map[CurrencyPair]float64, error) {
	args := m.Called(ctx, pairs)
	return args.Get(0).(map[CurrencyPair]float64), args.Error(1)
}

func (m *MockFXRateService) UpdateRate(ctx context.Context, fromCurrency, toCurrency string) error {
	args := m.Called(ctx, fromCurrency, toCurrency)
	return args.Error(0)
}

func (m *MockFXRateService) IsSupportedCurrency(currency string) bool {
	args := m.Called(currency)
	return args.Get(0).(bool)
}

func (m *MockFXRateService) GetSupportedCurrencies() []string {
	args := m.Called()
	return args.Get(0).([]string)
}

func (m *MockFXRateService) ConvertAmountWithRate(ctx context.Context, amount int64, rate float64, fromCurrency, toCurrency string) (int64, error) {
	args := m.Called(ctx, amount, rate, fromCurrency, toCurrency)
	return args.Get(0).(int64), args.Error(1)
}

type MockWalletService struct {
	mock.Mock
}

func (m *MockWalletService) CreateWallet(ctx context.Context, userID int32, req *v1.CreateWalletRequest) (*v1.CreateWalletResponse, error) {
	args := m.Called(ctx, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1.CreateWalletResponse), args.Error(1)
}

func (m *MockWalletService) GetWallet(ctx context.Context, walletID, requestingUserID int32) (*v1.GetWalletResponse, error) {
	args := m.Called(ctx, walletID, requestingUserID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1.GetWalletResponse), args.Error(1)
}

func (m *MockWalletService) ListWallets(ctx context.Context, userID int32, params types.PaginationParams) (*v1.ListWalletsResponse, error) {
	args := m.Called(ctx, userID, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1.ListWalletsResponse), args.Error(1)
}

func (m *MockWalletService) UpdateWallet(ctx context.Context, walletID, userID int32, req *v1.UpdateWalletRequest) (*v1.UpdateWalletResponse, error) {
	args := m.Called(ctx, walletID, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1.UpdateWalletResponse), args.Error(1)
}

func (m *MockWalletService) DeleteWallet(ctx context.Context, walletID, userID int32, req *v1.DeleteWalletRequest) (*v1.DeleteWalletResponse, error) {
	args := m.Called(ctx, walletID, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1.DeleteWalletResponse), args.Error(1)
}

func (m *MockWalletService) AddFunds(ctx context.Context, walletID, userID int32, req *v1.AddFundsRequest) (*v1.AddFundsResponse, error) {
	args := m.Called(ctx, walletID, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1.AddFundsResponse), args.Error(1)
}

func (m *MockWalletService) WithdrawFunds(ctx context.Context, walletID, userID int32, req *v1.WithdrawFundsRequest) (*v1.WithdrawFundsResponse, error) {
	args := m.Called(ctx, walletID, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1.WithdrawFundsResponse), args.Error(1)
}

func (m *MockWalletService) TransferFunds(ctx context.Context, userID int32, req *v1.TransferFundsRequest) (*v1.TransferFundsResponse, error) {
	args := m.Called(ctx, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1.TransferFundsResponse), args.Error(1)
}

func (m *MockWalletService) AdjustBalance(ctx context.Context, walletID, userID int32, req *v1.AdjustBalanceRequest) (*v1.AdjustBalanceResponse, error) {
	args := m.Called(ctx, walletID, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1.AdjustBalanceResponse), args.Error(1)
}

func (m *MockWalletService) GetTotalBalance(ctx context.Context, userID int32) (*v1.GetTotalBalanceResponse, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1.GetTotalBalanceResponse), args.Error(1)
}

func (m *MockWalletService) GetBalanceHistory(ctx context.Context, userID int32, req *v1.GetBalanceHistoryRequest) (*v1.GetBalanceHistoryResponse, error) {
	args := m.Called(ctx, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1.GetBalanceHistoryResponse), args.Error(1)
}

func (m *MockWalletService) GetMonthlyDominance(ctx context.Context, userID int32, req *v1.GetMonthlyDominanceRequest) (*v1.GetMonthlyDominanceResponse, error) {
	args := m.Called(ctx, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*v1.GetMonthlyDominanceResponse), args.Error(1)
}

// Test helper functions
func createTestWallet(id int32, userID int32, walletType v1.WalletType) *models.Wallet {
	return &models.Wallet{
		ID:       id,
		UserID:   userID,
		WalletName: "Test Investment Wallet",
		Type:     int32(walletType),
		Currency: "USD",
		Balance:  100000000000, // $1,000,000 in cents - enough for most tests
	}
}

func createTestInvestment(id int32, walletID int32, symbol string, quantity, averageCost, totalCost int64) *models.Investment {
	return &models.Investment{
		ID:          id,
		WalletID:    walletID,
		Symbol:      symbol,
		Name:        symbol + " Inc.",
		Type:        int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Quantity:    quantity,
		AverageCost: averageCost,
		TotalCost:   totalCost,
		Currency:    "USD",
	}
}

// Test CreateInvestment
func TestInvestmentService_CreateInvestment_Success(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	wallet := createTestWallet(walletID, userID, v1.WalletType_BASIC)

	req := &v1.CreateInvestmentRequest{
		WalletId:        walletID,
		Symbol:          "AAPL",
		Name:            "Apple Inc.",
		Type:            v1.InvestmentType_INVESTMENT_TYPE_STOCK,
		InitialQuantity: 10000, // 1 share (4 decimal places)
		InitialCost:     15000000000, // Total cost (150.00 * 10000)
		Currency:        "USD",
	}

	mockWalletRepo.On("GetByIDForUser", ctx, walletID, userID).Return(wallet, nil)
	mockInvestmentRepo.On("GetByWalletAndSymbol", ctx, walletID, "AAPL").Return(nil, nil)
	mockInvestmentRepo.On("Create", ctx, mock.AnythingOfType("*models.Investment")).Return(nil).Run(
		func(args mock.Arguments) {
			// Set the ID after creation
			inv := args.Get(1).(*models.Investment)
			inv.ID = 1
		},
	)
	mockTxRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil)
	mockTxRepo.On("CreateLot", ctx, mock.AnythingOfType("*models.InvestmentLot")).Return(nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil)
	mockUserRepo.On("GetByID", ctx, userID).Return(&models.User{ID: userID, PreferredCurrency: "USD"}, nil)

	// Execute
	response, err := service.CreateInvestment(ctx, userID, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.True(t, response.Success)
	assert.Equal(t, "Investment created successfully", response.Message)
	assert.NotNil(t, response.Data)

	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
}

func TestInvestmentService_CreateInvestment_AutoSelectsOldestWallet(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil,
		new(MockWalletService),
		nil,
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	oldestWallet := createTestWallet(5, userID, v1.WalletType_BASIC)
	oldestWallet.CreatedAt = time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	req := &v1.CreateInvestmentRequest{
		WalletId:        0, // Auto-assign
		Symbol:          "AAPL",
		Name:            "Apple Inc.",
		Type:            v1.InvestmentType_INVESTMENT_TYPE_STOCK,
		InitialQuantity: 10000,
		InitialCost:     15000000000,
		Currency:        "USD",
	}

	// Auto-select oldest wallet
	mockWalletRepo.On("ListByUserID", ctx, userID, repository.ListOptions{
		Limit:   1,
		OrderBy: "created_at",
		Order:   "asc",
	}).Return([]*models.Wallet{oldestWallet}, 1, nil)
	mockWalletRepo.On("GetByIDForUser", ctx, int32(5), userID).Return(oldestWallet, nil)
	mockInvestmentRepo.On("GetByWalletAndSymbol", ctx, int32(5), "AAPL").Return(nil, nil)
	mockInvestmentRepo.On("Create", ctx, mock.AnythingOfType("*models.Investment")).Return(nil).Run(
		func(args mock.Arguments) {
			inv := args.Get(1).(*models.Investment)
			inv.ID = 1
			// Verify auto-assigned wallet ID
			assert.Equal(t, int32(5), inv.WalletID)
		},
	)
	mockTxRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil)
	mockTxRepo.On("CreateLot", ctx, mock.AnythingOfType("*models.InvestmentLot")).Return(nil)
	mockTxRepo.On("Update", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil)
	mockUserRepo.On("GetByID", ctx, userID).Return(&models.User{ID: userID, PreferredCurrency: "USD"}, nil)

	// Execute
	response, err := service.CreateInvestment(ctx, userID, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.True(t, response.Success)

	mockWalletRepo.AssertExpectations(t)
}

func TestInvestmentService_CreateInvestment_NoWallets_ReturnsError(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil,
		new(MockWalletService),
		nil,
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)

	req := &v1.CreateInvestmentRequest{
		WalletId:        0, // Auto-assign
		Symbol:          "AAPL",
		Name:            "Apple Inc.",
		Type:            v1.InvestmentType_INVESTMENT_TYPE_STOCK,
		InitialQuantity: 10000,
		InitialCost:     15000000000,
		Currency:        "USD",
	}

	// No wallets found
	mockWalletRepo.On("ListByUserID", ctx, userID, repository.ListOptions{
		Limit:   1,
		OrderBy: "created_at",
		Order:   "asc",
	}).Return([]*models.Wallet{}, 0, nil)

	// Execute
	response, err := service.CreateInvestment(ctx, userID, req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, response)
	assert.IsType(t, apperrors.ValidationError{}, err)
	assert.Contains(t, err.Error(), "please create a wallet first")

	mockWalletRepo.AssertExpectations(t)
}

func TestInvestmentService_CreateInvestment_WalletNotFound(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(999)

	req := &v1.CreateInvestmentRequest{
		WalletId:        walletID,
		Symbol:          "AAPL",
		Name:            "Apple Inc.",
		Type:            v1.InvestmentType_INVESTMENT_TYPE_STOCK,
		InitialQuantity: 10000,
		InitialCost:     15000000000,
		Currency:        "USD",
	}

	mockWalletRepo.On("GetByIDForUser", ctx, walletID, userID).Return(nil, apperrors.NewNotFoundError("wallet"))

	// Execute
	response, err := service.CreateInvestment(ctx, userID, req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, response)
	assert.IsType(t, apperrors.NotFoundError{}, err)

	mockWalletRepo.AssertExpectations(t)
}

func TestInvestmentService_CreateInvestment_DuplicateSymbol(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	wallet := createTestWallet(walletID, userID, v1.WalletType_BASIC)
	existingInvestment := createTestInvestment(1, walletID, "AAPL", 10000, 1500000, 15000000000)

	req := &v1.CreateInvestmentRequest{
		WalletId:        walletID,
		Symbol:          "AAPL",
		Name:            "Apple Inc.",
		Type:            v1.InvestmentType_INVESTMENT_TYPE_STOCK,
		InitialQuantity: 10000,
		InitialCost:     15000000000,
		Currency:        "USD",
	}

	mockWalletRepo.On("GetByIDForUser", ctx, walletID, userID).Return(wallet, nil)
	mockInvestmentRepo.On("GetByWalletAndSymbol", ctx, walletID, "AAPL").Return(existingInvestment, nil)

	// Execute
	response, err := service.CreateInvestment(ctx, userID, req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, response)
	assert.IsType(t, apperrors.ConflictError{}, err)

	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
}

// Test AddTransaction - Buy (creates lot)
func TestInvestmentService_AddTransaction_BuyCreatesLot(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	investmentID := int32(1)
	wallet := createTestWallet(walletID, userID, v1.WalletType_BASIC)
	investment := createTestInvestment(investmentID, walletID, "AAPL", 0, 0, 0)

	req := &v1.AddTransactionRequest{
		InvestmentId: investmentID,
		Type:         v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY,
		Quantity:     10000, // 1 share
		Price:        1500000, // $150.00
		Fees:         100, // $1.00 fee
		TransactionDate: time.Now().Unix(),
		Notes:        "Initial buy",
	}

	mockWalletRepo.On("GetByIDForUser", ctx, walletID, userID).Return(wallet, nil)
	mockInvestmentRepo.On("GetByIDForUser", ctx, investmentID, userID).Return(investment, nil)
	mockInvestmentRepo.On("GetByID", ctx, investmentID).Return(investment, nil)
	mockTxRepo.On("GetOpenLots", ctx, investmentID).Return([]*models.InvestmentLot{}, nil)
	mockTxRepo.On("CreateLot", ctx, mock.AnythingOfType("*models.InvestmentLot")).Return(nil)
	mockTxRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil)
	mockTxRepo.On("ListByInvestmentID", ctx, investmentID, (*v1.InvestmentTransactionType)(nil), mock.Anything).Return([]*models.InvestmentTransaction{}, 0, nil)
	mockInvestmentRepo.On("Update", ctx, mock.AnythingOfType("*models.Investment")).Return(nil)
	mockUserRepo.On("GetByID", ctx, userID).Return(&models.User{ID: userID, PreferredCurrency: "USD"}, nil)

	// Execute
	response, err := service.AddTransaction(ctx, userID, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.True(t, response.Success)

	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
	mockTxRepo.AssertExpectations(t)
}

// Test AddTransaction - Sell (FIFO - consumes from oldest lot)
func TestInvestmentService_AddTransaction_SellConsumesOldestLot(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	investmentID := int32(1)
	wallet := createTestWallet(walletID, userID, v1.WalletType_BASIC)
	investment := createTestInvestment(investmentID, walletID, "AAPL", 20000, 1500000, 30000000000)

	// Create two lots - oldest should be consumed first
	lot1 := &models.InvestmentLot{
		ID:                1,
		InvestmentID:      investmentID,
		Quantity:          10000,
		RemainingQuantity: 10000,
		AverageCost:       1500000,
		TotalCost:         15000000000,
		PurchasedAt:       time.Now().Add(-24 * time.Hour),
	}
	lot2 := &models.InvestmentLot{
		ID:                2,
		InvestmentID:      investmentID,
		Quantity:          10000,
		RemainingQuantity: 10000,
		AverageCost:       1600000,
		TotalCost:         16000000000,
		PurchasedAt:       time.Now(),
	}

	req := &v1.AddTransactionRequest{
		InvestmentId: investmentID,
		Type:         v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:     7000, // Sell 0.7 shares
		Price:        1700000, // $170.00
		Fees:         100,
		TransactionDate: time.Now().Unix(),
		Notes:        "Take profit",
	}

	mockWalletRepo.On("GetByIDForUser", ctx, walletID, userID).Return(wallet, nil)
	mockInvestmentRepo.On("GetByIDForUser", ctx, investmentID, userID).Return(investment, nil)
	mockInvestmentRepo.On("GetByID", ctx, investmentID).Return(investment, nil)
	mockTxRepo.On("GetOpenLots", ctx, investmentID).Return([]*models.InvestmentLot{lot1, lot2}, nil)
	mockTxRepo.On("UpdateLot", ctx, mock.MatchedBy(func(lot *models.InvestmentLot) bool {
		return lot.ID == 1 && lot.RemainingQuantity == 3000 // 10000 - 7000
	})).Return(nil)
	mockTxRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil)
	mockTxRepo.On("ListByInvestmentID", ctx, investmentID, (*v1.InvestmentTransactionType)(nil), mock.Anything).Return([]*models.InvestmentTransaction{}, 0, nil)
	mockInvestmentRepo.On("Update", ctx, mock.MatchedBy(func(inv *models.Investment) bool {
		return inv.Quantity == 13000 && // 20000 - 7000
		 inv.RealizedPNL > 0 // Should have realized PNL
	})).Return(nil)
	mockUserRepo.On("GetByID", ctx, userID).Return(&models.User{ID: userID, PreferredCurrency: "USD"}, nil)

	// Execute
	response, err := service.AddTransaction(ctx, userID, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.True(t, response.Success)

	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
	mockTxRepo.AssertExpectations(t)
}

// Test AddTransaction - Sell (partial lot consumption)
func TestInvestmentService_AddTransaction_SellConsumesMultipleLots(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	investmentID := int32(1)
	wallet := createTestWallet(walletID, userID, v1.WalletType_BASIC)
	investment := createTestInvestment(investmentID, walletID, "AAPL", 20000, 1500000, 30000000000)

	// Create two lots with small quantities
	lot1 := &models.InvestmentLot{
		ID:                1,
		InvestmentID:      investmentID,
		Quantity:          3000,
		RemainingQuantity: 3000,
		AverageCost:       1500000,
		TotalCost:         4500000000,
		PurchasedAt:       time.Now().Add(-24 * time.Hour),
	}
	lot2 := &models.InvestmentLot{
		ID:                2,
		InvestmentID:      investmentID,
		Quantity:          10000,
		RemainingQuantity: 10000,
		AverageCost:       1600000,
		TotalCost:         16000000000,
		PurchasedAt:       time.Now(),
	}

	req := &v1.AddTransactionRequest{
		InvestmentId: investmentID,
		Type:         v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:     5000, // Should consume all of lot1 (3000) and 2000 from lot2
		Price:        1700000,
		Fees:         100,
		TransactionDate: time.Now().Unix(),
		Notes:        "Take profit",
	}

	mockWalletRepo.On("GetByIDForUser", ctx, walletID, userID).Return(wallet, nil)
	mockInvestmentRepo.On("GetByIDForUser", ctx, investmentID, userID).Return(investment, nil)
	mockInvestmentRepo.On("GetByID", ctx, investmentID).Return(investment, nil)
	mockTxRepo.On("GetOpenLots", ctx, investmentID).Return([]*models.InvestmentLot{lot1, lot2}, nil)
	// Both lots should be updated
	mockTxRepo.On("UpdateLot", ctx, mock.AnythingOfType("*models.InvestmentLot")).Return(nil).Times(2)
	mockTxRepo.On("Create", ctx, mock.AnythingOfType("*models.InvestmentTransaction")).Return(nil)
	mockTxRepo.On("ListByInvestmentID", ctx, investmentID, (*v1.InvestmentTransactionType)(nil), mock.Anything).Return([]*models.InvestmentTransaction{}, 0, nil)
	mockInvestmentRepo.On("Update", ctx, mock.AnythingOfType("*models.Investment")).Return(nil)
	mockUserRepo.On("GetByID", ctx, userID).Return(&models.User{ID: userID, PreferredCurrency: "USD"}, nil)

	// Execute
	response, err := service.AddTransaction(ctx, userID, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.True(t, response.Success)

	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
	mockTxRepo.AssertExpectations(t)
}

// Test AddTransaction - Cannot sell more than owned
func TestInvestmentService_AddTransaction_SellExceedsQuantity(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	investmentID := int32(1)
	wallet := createTestWallet(walletID, userID, v1.WalletType_BASIC)
	investment := createTestInvestment(investmentID, walletID, "AAPL", 5000, 1500000, 7500000000)

	req := &v1.AddTransactionRequest{
		InvestmentId: investmentID,
		Type:         v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL,
		Quantity:     10000, // Trying to sell more than owned
		Price:        1700000,
		Fees:         100,
		TransactionDate: time.Now().Unix(),
		Notes:        "Excessive sell",
	}

	mockWalletRepo.On("GetByIDForUser", ctx, walletID, userID).Return(wallet, nil)
	mockInvestmentRepo.On("GetByIDForUser", ctx, investmentID, userID).Return(investment, nil)

	// Execute
	response, err := service.AddTransaction(ctx, userID, req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, response)
	assert.IsType(t, apperrors.ValidationError{}, err)
	assert.Contains(t, err.Error(), "quantity")

	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
}

// Test GetPortfolioSummary
func TestInvestmentService_GetPortfolioSummary_Success(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	wallet := createTestWallet(walletID, userID, v1.WalletType_BASIC)

	// GetPortfolioSummary aggregates from investments in-memory.
	// Create 5 investments (3 STOCK, 2 CRYPTO) with known values in USD (matches preferred currency).
	stockInvestment := func(id int32, currentValue, totalCost, realizedPNL, unrealizedPNL int64) *models.Investment {
		return &models.Investment{
			ID:            id,
			WalletID:      walletID,
			Symbol:        "TEST",
			Type:          int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
			Currency:      "USD",
			CurrentValue:  currentValue,
			TotalCost:     totalCost,
			RealizedPNL:   realizedPNL,
			UnrealizedPNL: unrealizedPNL,
			UpdatedAt:     time.Now(), // fresh — no auto-refresh triggered
		}
	}
	cryptoInvestment := func(id int32, currentValue, totalCost, realizedPNL, unrealizedPNL int64) *models.Investment {
		return &models.Investment{
			ID:            id,
			WalletID:      walletID,
			Symbol:        "BTC",
			Type:          int32(v1.InvestmentType_INVESTMENT_TYPE_CRYPTOCURRENCY),
			Currency:      "USD",
			CurrentValue:  currentValue,
			TotalCost:     totalCost,
			RealizedPNL:   realizedPNL,
			UnrealizedPNL: unrealizedPNL,
			UpdatedAt:     time.Now(),
		}
	}

	investments := []*models.Investment{
		stockInvestment(1, 30000000000, 25000000000, 1000000000, 4000000000),  // stock 1
		stockInvestment(2, 25000000000, 20000000000, 2000000000, 5000000000),  // stock 2
		stockInvestment(3, 15000000000, 12000000000, 500000000, 2500000000),   // stock 3
		cryptoInvestment(4, 20000000000, 15000000000, 1000000000, 4000000000), // crypto 1
		cryptoInvestment(5, 10000000000, 8000000000, 500000000, 2000000000),   // crypto 2
	}
	// Expected totals (all USD == preferred currency, no FX conversion):
	// TotalValue  = 30+25+15+20+10 billion = 100 billion
	// TotalCost   = 25+20+12+15+8 billion  = 80 billion
	// RealizedPNL = 1+2+0.5+1+0.5 billion  = 5 billion
	// UnrealizedPNL = 4+5+2.5+4+2 billion  = 17.5 billion
	// TotalPNL    = 5 + 17.5 = 22.5 billion
	// TotalInvestments = 5

	// GetPortfolioSummary calls userRepo.GetByID first to get preferred currency
	mockUserRepo.On("GetByID", ctx, userID).Return(&models.User{ID: userID, PreferredCurrency: "USD"}, nil)
	mockWalletRepo.On("GetByIDForUser", ctx, walletID, userID).Return(wallet, nil)
	// ListByWalletID returns investments (fresh timestamps → no auto-refresh triggered)
	mockInvestmentRepo.On("ListByWalletID", ctx, walletID, mock.MatchedBy(func(opts repository.ListOptions) bool {
		return opts.Limit == 1000
	}), v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED).Return(investments, len(investments), nil)

	// Execute
	response, err := service.GetPortfolioSummary(ctx, walletID, userID, v1.PnlPeriod_PNL_PERIOD_UNSPECIFIED)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.True(t, response.Success)
	assert.Equal(t, int64(100000000000), response.Data.TotalValue)
	assert.Equal(t, int64(22500000000), response.Data.TotalPnl)
	assert.Equal(t, int32(5), response.Data.TotalInvestments)
	assert.Len(t, response.Data.InvestmentsByType, 2)

	mockUserRepo.AssertExpectations(t)
	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
}

// Test UpdatePrices
func TestInvestmentService_UpdatePrices_Success(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	investment1 := createTestInvestment(1, 1, "AAPL", 10000, 1500000, 15000000000)
	investment2 := createTestInvestment(2, 1, "BTC", 100000000, 50000000000, 5000000000000000)

	req := &v1.UpdatePricesRequest{
		InvestmentIds: []int32{1, 2},
		ForceRefresh:   false,
	}

	mockWalletRepo.On("ListByUserID", ctx, userID, mock.Anything).Return([]*models.Wallet{
		{ID: 1, UserID: userID, Type: int32(v1.WalletType_BASIC)},
	}, 1, nil)
	mockInvestmentRepo.On("ListByWalletID", ctx, int32(1), mock.Anything, v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED).Return([]*models.Investment{investment1, investment2}, 2, nil)
	// UpdatePrices runs async in a goroutine with its own timeout context — use mock.Anything + Maybe()
	mockMarketDataService.On("UpdatePricesForInvestments", mock.Anything, mock.Anything, false).Return(map[int32]int64{
		1: 16000,   // AAPL @ $160 (in cents)
		2: 5100000, // BTC @ $51,000 (in cents)
	}, nil).Maybe()
	mockInvestmentRepo.On("UpdatePrices", mock.Anything, mock.Anything).Return(nil).Maybe()
	// Goroutine also calls GetByID per investment for cache invalidation
	mockInvestmentRepo.On("GetByID", mock.Anything, mock.AnythingOfType("int32")).Return(investment1, nil).Maybe()

	// Execute
	response, err := service.UpdatePrices(ctx, userID, req)

	// Assert — UpdatePrices returns immediately with empty list (async background update)
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.True(t, response.Success)
	assert.Empty(t, response.UpdatedInvestments)

	// Only assert expectations on mocks that run synchronously
	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
}

// Test UpdatePrices - Custom investments should be skipped
func TestInvestmentService_UpdatePrices_SkipsCustomInvestments(t *testing.T) {
	ctx := context.Background()
	userID := int32(1)

	// Setup mocks
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockWalletRepo := new(MockWalletRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	// Create test wallets
	wallet1 := &models.Wallet{ID: 1, UserID: userID, Type: int32(v1.WalletType_BASIC), Currency: "USD"}
	mockWalletRepo.On("ListByUserID", ctx, userID, mock.Anything).Return([]*models.Wallet{wallet1}, 1, nil)

	// Create mixed investments (1 market-based, 1 custom)
	marketInv := &models.Investment{ID: 1, WalletID: 1, Symbol: "AAPL", Currency: "USD", Type: int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK), IsCustom: false}
	customInv := &models.Investment{ID: 2, WalletID: 1, Symbol: "MY-CUSTOM", Currency: "USD", Type: int32(v1.InvestmentType_INVESTMENT_TYPE_OTHER), IsCustom: true}
	mockInvestmentRepo.On("ListByWalletID", ctx, int32(1), mock.Anything, v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED).
		Return([]*models.Investment{marketInv, customInv}, 2, nil)

	req := &v1.UpdatePricesRequest{
		InvestmentIds: []int32{}, // Empty = update all
		ForceRefresh:  false,
	}

	// Async goroutine will call these — register with Maybe() so they don't panic
	mockMarketDataService.On("UpdatePricesForInvestments", mock.Anything, mock.Anything, false).
		Return(map[int32]int64{1: 16000}, nil).Maybe()
	mockInvestmentRepo.On("UpdatePrices", mock.Anything, mock.Anything).Return(nil).Maybe()
	// Goroutine also calls GetByID per updated investment for cache invalidation
	mockInvestmentRepo.On("GetByID", mock.Anything, mock.AnythingOfType("int32")).Return(marketInv, nil).Maybe()

	// Execute
	response, err := service.UpdatePrices(ctx, userID, req)

	// Verify - The function returns immediately with a message indicating how many investments are being updated
	// The actual price updates happen asynchronously in a goroutine
	assert.NoError(t, err)
	assert.True(t, response.Success)
	assert.Contains(t, response.Message, "1 investments") // Only 1 market-based investment queued for update
	assert.NotContains(t, response.Message, "2 investments") // Should NOT show 2 (which would include custom)

	// Verify only the synchronous repository calls were made (before goroutine)
	mockWalletRepo.AssertExpectations(t)
	mockInvestmentRepo.AssertExpectations(t)
}

func TestInvestmentService_DeleteInvestment_Success(t *testing.T) {
	// Setup
	mockWalletRepo := new(MockWalletRepository)
	mockInvestmentRepo := new(MockInvestmentRepository)
	mockTxRepo := new(MockInvestmentTransactionRepository)
	mockMarketDataService := new(MockMarketDataService)
	mockUserRepo := new(MockUserRepository)
	mockFXRateSvc := new(MockFXRateService)

	service := NewInvestmentService(
		mockInvestmentRepo,
		mockWalletRepo,
		mockTxRepo,
		mockMarketDataService,
		mockUserRepo,
		mockFXRateSvc,
		nil, // currencyCache not needed for this test
		new(MockWalletService),
		nil, // portfolioHistoryRepo not needed for this test
	).(*investmentService)

	ctx := context.Background()
	userID := int32(1)
	walletID := int32(1)
	investmentID := int32(1)

	investment := createTestInvestment(investmentID, walletID, "AAPL", 10000, 1500000, 15000000000)
	investment.Currency = "USD"

	// Mock expectations — no wallet balance operations (decoupled)
	mockInvestmentRepo.On("GetByIDForUser", ctx, investmentID, userID).Return(investment, nil)
	mockTxRepo.On("DeleteByInvestmentID", ctx, investmentID).Return(nil)
	mockTxRepo.On("DeleteLotsByInvestmentID", ctx, investmentID).Return(nil)
	mockInvestmentRepo.On("Delete", ctx, investmentID).Return(nil)

	// Execute
	response, err := service.DeleteInvestment(ctx, investmentID, userID)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, response)
	assert.True(t, response.Success)
	assert.Contains(t, response.Message, "deleted successfully")

	mockInvestmentRepo.AssertExpectations(t)
	mockTxRepo.AssertExpectations(t)
}
