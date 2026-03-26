package service

import (
	"context"
	"testing"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/yahoo"
	v1 "wealthjourney/protobuf/v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// --- Mock: UserPriceAlertRepository ---

type mockUserPriceAlertRepo struct {
	mock.Mock
}

func (m *mockUserPriceAlertRepo) Create(ctx context.Context, alert *models.UserPriceAlert) error {
	args := m.Called(ctx, alert)
	if args.Error(0) == nil {
		alert.ID = 1
		alert.CreatedAt = time.Now()
		alert.UpdatedAt = time.Now()
	}
	return args.Error(0)
}

func (m *mockUserPriceAlertRepo) GetByIDForUser(ctx context.Context, id int32, userID int32) (*models.UserPriceAlert, error) {
	args := m.Called(ctx, id, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.UserPriceAlert), args.Error(1)
}

func (m *mockUserPriceAlertRepo) ListByUserID(ctx context.Context, userID int32, statusFilter string, opts repository.ListOptions) ([]*models.UserPriceAlert, int64, error) {
	args := m.Called(ctx, userID, statusFilter, opts)
	if args.Get(0) == nil {
		return nil, int64(args.Int(1)), args.Error(2)
	}
	return args.Get(0).([]*models.UserPriceAlert), int64(args.Int(1)), args.Error(2)
}

func (m *mockUserPriceAlertRepo) Update(ctx context.Context, alert *models.UserPriceAlert) error {
	args := m.Called(ctx, alert)
	return args.Error(0)
}

func (m *mockUserPriceAlertRepo) Delete(ctx context.Context, id int32, userID int32) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func (m *mockUserPriceAlertRepo) CountActiveByUserID(ctx context.Context, userID int32) (int64, error) {
	args := m.Called(ctx, userID)
	return int64(args.Int(0)), args.Error(1)
}

func (m *mockUserPriceAlertRepo) ListActive(ctx context.Context) ([]*models.UserPriceAlert, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.UserPriceAlert), args.Error(1)
}

func (m *mockUserPriceAlertRepo) UpdateStatus(ctx context.Context, id int32, status string, lastTriggeredAt *time.Time, triggerCount int32) error {
	args := m.Called(ctx, id, status, lastTriggeredAt, triggerCount)
	return args.Error(0)
}

// --- Mock: AssetPriceService (alert-scope) ---

type mockAlertAssetPriceSvc struct {
	mock.Mock
}

func (m *mockAlertAssetPriceSvc) RefreshAllPrices(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *mockAlertAssetPriceSvc) GetAllPrices(ctx context.Context) (*AllAssetPrices, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*AllAssetPrices), args.Error(1)
}

func (m *mockAlertAssetPriceSvc) GetPricesByAssetType(ctx context.Context, assetType string) ([]*AssetPriceDTO, error) {
	args := m.Called(ctx, assetType)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*AssetPriceDTO), args.Error(1)
}

func (m *mockAlertAssetPriceSvc) GetMarketTypes(ctx context.Context) (*MarketTypesDTO, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*MarketTypesDTO), args.Error(1)
}

func (m *mockAlertAssetPriceSvc) GetPriceByTypeCode(ctx context.Context, typeCode string) (*AssetPriceDTO, error) {
	args := m.Called(ctx, typeCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*AssetPriceDTO), args.Error(1)
}

// --- Mock: MarketDataService (alert-scope) ---

type mockAlertMarketDataSvc struct {
	mock.Mock
}

func (m *mockAlertMarketDataSvc) GetPrice(ctx context.Context, symbol, currency string, investmentType v1.InvestmentType, maxAge time.Duration) (*models.MarketData, error) {
	args := m.Called(ctx, symbol, currency, investmentType, maxAge)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.MarketData), args.Error(1)
}

func (m *mockAlertMarketDataSvc) UpdatePricesForInvestments(ctx context.Context, investments []*models.Investment, forceRefresh bool) (map[int32]int64, error) {
	args := m.Called(ctx, investments, forceRefresh)
	return args.Get(0).(map[int32]int64), args.Error(1)
}

func (m *mockAlertMarketDataSvc) SearchSymbols(ctx context.Context, query string, limit int) ([]yahoo.SearchResult, error) {
	args := m.Called(ctx, query, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]yahoo.SearchResult), args.Error(1)
}

func (m *mockAlertMarketDataSvc) GetPriceBatch(ctx context.Context, symbols []string) (map[string]*models.MarketData, error) {
	args := m.Called(ctx, symbols)
	return args.Get(0).(map[string]*models.MarketData), args.Error(1)
}

// --- Mock: NotificationRepository (alert-scope) ---

type mockAlertNotifRepo struct {
	mock.Mock
}

func (m *mockAlertNotifRepo) Create(ctx context.Context, notification *models.Notification) error {
	args := m.Called(ctx, notification)
	return args.Error(0)
}

func (m *mockAlertNotifRepo) BatchCreate(ctx context.Context, notifications []*models.Notification) error {
	args := m.Called(ctx, notifications)
	return args.Error(0)
}

func (m *mockAlertNotifRepo) GetByUserID(ctx context.Context, userID int32, opts repository.ListOptions) ([]*models.Notification, int, error) {
	args := m.Called(ctx, userID, opts)
	return args.Get(0).([]*models.Notification), args.Int(1), args.Error(2)
}

func (m *mockAlertNotifRepo) GetUnreadCount(ctx context.Context, userID int32) (int32, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int32), args.Error(1)
}

func (m *mockAlertNotifRepo) MarkAllRead(ctx context.Context, userID int32) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *mockAlertNotifRepo) MarkRead(ctx context.Context, id int32, userID int32) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

// --- Mock: PushService (alert-scope) ---

type mockAlertPushSvc struct {
	mock.Mock
}

func (m *mockAlertPushSvc) SendToUser(ctx context.Context, userID int32, title, body, url string) error {
	args := m.Called(ctx, userID, title, body, url)
	return args.Error(0)
}

func (m *mockAlertPushSvc) SendToAll(ctx context.Context, title, body, url string) error {
	args := m.Called(ctx, title, body, url)
	return args.Error(0)
}

func (m *mockAlertPushSvc) GetVAPIDPublicKey() string {
	args := m.Called()
	return args.String(0)
}

// --- Helpers ---

// newTestAlertService creates a UserPriceAlertService backed by the provided mocks.
// Passing nil for assetPriceSvc/marketSvc is fine for tests that don't need price fetching.
func newTestAlertService(
	alertRepo *mockUserPriceAlertRepo,
	assetPriceSvc AssetPriceService,
	marketSvc MarketDataService,
) UserPriceAlertService {
	ap := assetPriceSvc
	mkt := marketSvc

	if ap == nil {
		ap = &mockAlertAssetPriceSvc{}
	}
	if mkt == nil {
		mkt = &mockAlertMarketDataSvc{}
	}

	return &userPriceAlertService{
		alertRepo:     alertRepo,
		assetPriceSvc: ap,
		marketDataSvc: mkt,
		notifRepo:     &mockAlertNotifRepo{},
		pushSvc:       &mockAlertPushSvc{},
		rdb:           nil,
	}
}

// validStockCreateReq returns a minimal valid CreateUserPriceAlertRequest for a stock (non-gold/silver).
func validStockCreateReq() *v1.CreateUserPriceAlertRequest {
	return &v1.CreateUserPriceAlertRequest{
		Symbol:      "VCB",
		Name:        "Vietcombank",
		AssetType:   v1.InvestmentType_INVESTMENT_TYPE_STOCK,
		Currency:    "VND",
		PriceSide:   "buy",
		Direction:   v1.AlertDirection_ALERT_DIRECTION_ABOVE,
		TargetPrice: 100000,
		TriggerMode: v1.AlertTriggerMode_ALERT_TRIGGER_MODE_ONCE,
	}
}

// validGoldCreateReq returns a minimal valid CreateUserPriceAlertRequest for a gold asset.
func validGoldCreateReq() *v1.CreateUserPriceAlertRequest {
	return &v1.CreateUserPriceAlertRequest{
		Symbol:      "SJL1L10",
		Name:        "SJC 1-10 Luong",
		AssetType:   v1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
		Currency:    "VND",
		PriceSide:   "buy",
		Direction:   v1.AlertDirection_ALERT_DIRECTION_ABOVE,
		TargetPrice: 9000000000,
		TriggerMode: v1.AlertTriggerMode_ALERT_TRIGGER_MODE_ONCE,
	}
}

// validSilverCreateReq returns a minimal valid CreateUserPriceAlertRequest for a silver asset.
func validSilverCreateReq() *v1.CreateUserPriceAlertRequest {
	return &v1.CreateUserPriceAlertRequest{
		Symbol:      "AG_VND",
		Name:        "Silver VND",
		AssetType:   v1.InvestmentType_INVESTMENT_TYPE_SILVER_VND,
		Currency:    "VND",
		PriceSide:   "sell",
		Direction:   v1.AlertDirection_ALERT_DIRECTION_BELOW,
		TargetPrice: 2000000,
		TriggerMode: v1.AlertTriggerMode_ALERT_TRIGGER_MODE_ONCE,
	}
}

// --- Tests: CreateAlert ---

func TestUserPriceAlertService_CreateAlert_Success(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	marketSvc := new(mockAlertMarketDataSvc)
	svc := newTestAlertService(alertRepo, nil, marketSvc)
	ctx := context.Background()

	alertRepo.On("CountActiveByUserID", ctx, int32(1)).Return(0, nil)
	// Price fetch is best-effort; return a price
	marketSvc.On("GetPrice", mock.Anything, "VCB", "VND", v1.InvestmentType_INVESTMENT_TYPE_STOCK, mock.AnythingOfType("time.Duration")).
		Return(&models.MarketData{Price: 90000}, nil)
	alertRepo.On("Create", ctx, mock.AnythingOfType("*models.UserPriceAlert")).Return(nil)

	resp, err := svc.CreateAlert(ctx, 1, validStockCreateReq())

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.NotNil(t, resp.Alert)
	assert.Equal(t, "VCB", resp.Alert.Symbol)
	assert.Equal(t, int64(100000), resp.Alert.TargetPrice)
	assert.Equal(t, v1.AlertDirection_ALERT_DIRECTION_ABOVE, resp.Alert.Direction)
	assert.Equal(t, v1.AlertStatus_ALERT_STATUS_ACTIVE, resp.Alert.Status)
	alertRepo.AssertExpectations(t)
}

func TestUserPriceAlertService_CreateAlert_MaxAlertsReached(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	alertRepo.On("CountActiveByUserID", ctx, int32(1)).Return(30, nil)

	resp, err := svc.CreateAlert(ctx, 1, validStockCreateReq())

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Maximum of 30 alerts")
	alertRepo.AssertExpectations(t)
}

func TestUserPriceAlertService_CreateAlert_InvalidTargetPrice(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	req := validStockCreateReq()
	req.TargetPrice = 0

	resp, err := svc.CreateAlert(ctx, 1, req)

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "target price must be greater than 0")
	alertRepo.AssertNotCalled(t, "CountActiveByUserID")
}

func TestUserPriceAlertService_CreateAlert_InvalidDirection(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	req := validStockCreateReq()
	req.Direction = v1.AlertDirection_ALERT_DIRECTION_UNSPECIFIED

	resp, err := svc.CreateAlert(ctx, 1, req)

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "direction must be")
}

func TestUserPriceAlertService_CreateAlert_EmptySymbol(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	req := validStockCreateReq()
	req.Symbol = ""

	resp, err := svc.CreateAlert(ctx, 1, req)

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "symbol must be between 1 and 50 characters")
}

func TestUserPriceAlertService_CreateAlert_RepeatMode_CooldownTooShort(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	req := validStockCreateReq()
	req.TriggerMode = v1.AlertTriggerMode_ALERT_TRIGGER_MODE_REPEAT
	req.CooldownHours = 1 // below minimum of 2

	resp, err := svc.CreateAlert(ctx, 1, req)

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cooldown hours must be between")
}

func TestUserPriceAlertService_CreateAlert_RepeatMode_CooldownTooLong(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	req := validStockCreateReq()
	req.TriggerMode = v1.AlertTriggerMode_ALERT_TRIGGER_MODE_REPEAT
	req.CooldownHours = 200 // above maximum of 168

	resp, err := svc.CreateAlert(ctx, 1, req)

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cooldown hours must be between")
}

func TestUserPriceAlertService_CreateAlert_PriceFetchFails_StillCreates(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	marketSvc := new(mockAlertMarketDataSvc)
	svc := newTestAlertService(alertRepo, nil, marketSvc)
	ctx := context.Background()

	alertRepo.On("CountActiveByUserID", ctx, int32(1)).Return(0, nil)
	// Price fetch fails — alert should still be created with currentPriceAtCreation = 0
	marketSvc.On("GetPrice", mock.Anything, "VCB", "VND", v1.InvestmentType_INVESTMENT_TYPE_STOCK, mock.AnythingOfType("time.Duration")).
		Return(nil, apperrors.NewValidationError("symbol not found"))
	alertRepo.On("Create", ctx, mock.AnythingOfType("*models.UserPriceAlert")).Return(nil)

	resp, err := svc.CreateAlert(ctx, 1, validStockCreateReq())

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Equal(t, int64(0), resp.Alert.CurrentPriceAtCreation)
	alertRepo.AssertExpectations(t)
}

// --- Tests: fetchCurrentPrice with DB-backed AssetPriceService ---

func TestUserPriceAlertService_CreateAlert_GoldPrice_NonStale_ReturnsBuy(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	assetPriceSvc := new(mockAlertAssetPriceSvc)
	svc := newTestAlertService(alertRepo, assetPriceSvc, nil)
	ctx := context.Background()

	alertRepo.On("CountActiveByUserID", ctx, int32(1)).Return(0, nil)
	// DB returns a non-stale gold price
	assetPriceSvc.On("GetPriceByTypeCode", mock.Anything, "SJL1L10").
		Return(&AssetPriceDTO{
			TypeCode: "SJL1L10",
			Name:     "SJC 1-10 Luong",
			Buy:      9200000000,
			Sell:     9300000000,
			IsStale:  false,
		}, nil)
	alertRepo.On("Create", ctx, mock.AnythingOfType("*models.UserPriceAlert")).Return(nil)

	resp, err := svc.CreateAlert(ctx, 1, validGoldCreateReq())

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	// buy price should be set at creation time
	assert.Equal(t, int64(9200000000), resp.Alert.CurrentPriceAtCreation)
	alertRepo.AssertExpectations(t)
	assetPriceSvc.AssertExpectations(t)
}

func TestUserPriceAlertService_CreateAlert_GoldPrice_SellSide(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	assetPriceSvc := new(mockAlertAssetPriceSvc)
	svc := newTestAlertService(alertRepo, assetPriceSvc, nil)
	ctx := context.Background()

	req := validGoldCreateReq()
	req.PriceSide = "sell"

	alertRepo.On("CountActiveByUserID", ctx, int32(1)).Return(0, nil)
	assetPriceSvc.On("GetPriceByTypeCode", mock.Anything, "SJL1L10").
		Return(&AssetPriceDTO{
			TypeCode: "SJL1L10",
			Buy:      9200000000,
			Sell:     9300000000,
			IsStale:  false,
		}, nil)
	alertRepo.On("Create", ctx, mock.AnythingOfType("*models.UserPriceAlert")).Return(nil)

	resp, err := svc.CreateAlert(ctx, 1, req)

	assert.NoError(t, err)
	// sell price should be returned
	assert.Equal(t, int64(9300000000), resp.Alert.CurrentPriceAtCreation)
	alertRepo.AssertExpectations(t)
}

func TestUserPriceAlertService_CreateAlert_GoldPrice_Stale_ReturnsZero(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	assetPriceSvc := new(mockAlertAssetPriceSvc)
	svc := newTestAlertService(alertRepo, assetPriceSvc, nil)
	ctx := context.Background()

	alertRepo.On("CountActiveByUserID", ctx, int32(1)).Return(0, nil)
	// DB returns a stale price — should return 0
	assetPriceSvc.On("GetPriceByTypeCode", mock.Anything, "SJL1L10").
		Return(&AssetPriceDTO{
			TypeCode: "SJL1L10",
			Buy:      9200000000,
			Sell:     9300000000,
			IsStale:  true,
		}, nil)
	alertRepo.On("Create", ctx, mock.AnythingOfType("*models.UserPriceAlert")).Return(nil)

	resp, err := svc.CreateAlert(ctx, 1, validGoldCreateReq())

	assert.NoError(t, err)
	// stale price → 0
	assert.Equal(t, int64(0), resp.Alert.CurrentPriceAtCreation)
	alertRepo.AssertExpectations(t)
}

func TestUserPriceAlertService_CreateAlert_GoldPrice_NotFound_ReturnsZero(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	assetPriceSvc := new(mockAlertAssetPriceSvc)
	svc := newTestAlertService(alertRepo, assetPriceSvc, nil)
	ctx := context.Background()

	alertRepo.On("CountActiveByUserID", ctx, int32(1)).Return(0, nil)
	// DB returns nil (not found)
	assetPriceSvc.On("GetPriceByTypeCode", mock.Anything, "SJL1L10").
		Return(nil, nil)
	alertRepo.On("Create", ctx, mock.AnythingOfType("*models.UserPriceAlert")).Return(nil)

	resp, err := svc.CreateAlert(ctx, 1, validGoldCreateReq())

	assert.NoError(t, err)
	// not found → 0
	assert.Equal(t, int64(0), resp.Alert.CurrentPriceAtCreation)
	alertRepo.AssertExpectations(t)
}

func TestUserPriceAlertService_CreateAlert_GoldPrice_DBError_ReturnsZero(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	assetPriceSvc := new(mockAlertAssetPriceSvc)
	svc := newTestAlertService(alertRepo, assetPriceSvc, nil)
	ctx := context.Background()

	alertRepo.On("CountActiveByUserID", ctx, int32(1)).Return(0, nil)
	// DB returns an error — should return 0 (best-effort)
	assetPriceSvc.On("GetPriceByTypeCode", mock.Anything, "SJL1L10").
		Return(nil, apperrors.NewValidationError("db error"))
	alertRepo.On("Create", ctx, mock.AnythingOfType("*models.UserPriceAlert")).Return(nil)

	resp, err := svc.CreateAlert(ctx, 1, validGoldCreateReq())

	assert.NoError(t, err)
	// db error → 0, alert still created
	assert.Equal(t, int64(0), resp.Alert.CurrentPriceAtCreation)
	alertRepo.AssertExpectations(t)
}

func TestUserPriceAlertService_CreateAlert_SilverPrice_NonStale_ReturnsSell(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	assetPriceSvc := new(mockAlertAssetPriceSvc)
	svc := newTestAlertService(alertRepo, assetPriceSvc, nil)
	ctx := context.Background()

	alertRepo.On("CountActiveByUserID", ctx, int32(1)).Return(0, nil)
	assetPriceSvc.On("GetPriceByTypeCode", mock.Anything, "AG_VND").
		Return(&AssetPriceDTO{
			TypeCode: "AG_VND",
			Buy:      1800000,
			Sell:     1900000,
			IsStale:  false,
		}, nil)
	alertRepo.On("Create", ctx, mock.AnythingOfType("*models.UserPriceAlert")).Return(nil)

	resp, err := svc.CreateAlert(ctx, 1, validSilverCreateReq())

	assert.NoError(t, err)
	// validSilverCreateReq uses priceSide "sell"
	assert.Equal(t, int64(1900000), resp.Alert.CurrentPriceAtCreation)
	alertRepo.AssertExpectations(t)
}

func TestUserPriceAlertService_CreateAlert_SilverPrice_Stale_ReturnsZero(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	assetPriceSvc := new(mockAlertAssetPriceSvc)
	svc := newTestAlertService(alertRepo, assetPriceSvc, nil)
	ctx := context.Background()

	alertRepo.On("CountActiveByUserID", ctx, int32(1)).Return(0, nil)
	assetPriceSvc.On("GetPriceByTypeCode", mock.Anything, "AG_VND").
		Return(&AssetPriceDTO{
			TypeCode: "AG_VND",
			Buy:      1800000,
			Sell:     1900000,
			IsStale:  true,
		}, nil)
	alertRepo.On("Create", ctx, mock.AnythingOfType("*models.UserPriceAlert")).Return(nil)

	resp, err := svc.CreateAlert(ctx, 1, validSilverCreateReq())

	assert.NoError(t, err)
	assert.Equal(t, int64(0), resp.Alert.CurrentPriceAtCreation)
	alertRepo.AssertExpectations(t)
}

// --- Tests: ListAlerts ---

func TestUserPriceAlertService_ListAlerts_Success(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	marketSvc := new(mockAlertMarketDataSvc)
	svc := newTestAlertService(alertRepo, nil, marketSvc)
	ctx := context.Background()

	now := time.Now()
	alerts := []*models.UserPriceAlert{
		{
			ID:          1,
			UserID:      1,
			Symbol:      "VCB",
			Name:        "Vietcombank",
			AssetType:   int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
			Currency:    "VND",
			PriceSide:   "buy",
			Direction:   "above",
			TargetPrice: 100000,
			TriggerMode: "once",
			Status:      "active",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}

	alertRepo.On("ListByUserID", ctx, int32(1), "", mock.AnythingOfType("repository.ListOptions")).
		Return(alerts, 1, nil)
	marketSvc.On("GetPrice", mock.Anything, "VCB", "VND", v1.InvestmentType_INVESTMENT_TYPE_STOCK, mock.AnythingOfType("time.Duration")).
		Return(&models.MarketData{Price: 95000}, nil)

	resp, err := svc.ListAlerts(ctx, 1, &v1.ListUserPriceAlertsRequest{})

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Len(t, resp.Alerts, 1)
	assert.Equal(t, int32(1), resp.Total)
	assert.Equal(t, "VCB", resp.Alerts[0].Symbol)
	assert.Equal(t, int64(95000), resp.Alerts[0].CurrentPrice)
	alertRepo.AssertExpectations(t)
}

func TestUserPriceAlertService_ListAlerts_WithStatusFilter(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	alertRepo.On("ListByUserID", ctx, int32(1), "active", mock.AnythingOfType("repository.ListOptions")).
		Return([]*models.UserPriceAlert{}, 0, nil)

	resp, err := svc.ListAlerts(ctx, 1, &v1.ListUserPriceAlertsRequest{
		StatusFilter: v1.AlertStatus_ALERT_STATUS_ACTIVE,
	})

	assert.NoError(t, err)
	assert.Len(t, resp.Alerts, 0)
	assert.Equal(t, int32(0), resp.Total)
	alertRepo.AssertExpectations(t)
}

// --- Tests: fetchPricesForAlerts with DB-backed AssetPriceService ---

func TestUserPriceAlertService_ListAlerts_GoldPrices_FromDB_NonStale(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	assetPriceSvc := new(mockAlertAssetPriceSvc)
	svc := newTestAlertService(alertRepo, assetPriceSvc, nil)
	ctx := context.Background()

	now := time.Now()
	alerts := []*models.UserPriceAlert{
		{
			ID:        1,
			UserID:    1,
			Symbol:    "SJL1L10",
			AssetType: int32(v1.InvestmentType_INVESTMENT_TYPE_GOLD_VND),
			Currency:  "VND",
			PriceSide: "buy",
			Status:    "active",
			CreatedAt: now,
			UpdatedAt: now,
		},
	}

	alertRepo.On("ListByUserID", ctx, int32(1), "", mock.AnythingOfType("repository.ListOptions")).
		Return(alerts, 1, nil)
	// GetPricesByAssetType for gold returns non-stale data
	assetPriceSvc.On("GetPricesByAssetType", mock.Anything, "gold").
		Return([]*AssetPriceDTO{
			{TypeCode: "SJL1L10", Buy: 9100000000, Sell: 9200000000, IsStale: false},
		}, nil)

	resp, err := svc.ListAlerts(ctx, 1, &v1.ListUserPriceAlertsRequest{})

	assert.NoError(t, err)
	assert.Len(t, resp.Alerts, 1)
	assert.Equal(t, int64(9100000000), resp.Alerts[0].CurrentPrice)
	assetPriceSvc.AssertExpectations(t)
}

func TestUserPriceAlertService_ListAlerts_GoldPrices_Stale_ExcludedFromPriceMap(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	assetPriceSvc := new(mockAlertAssetPriceSvc)
	svc := newTestAlertService(alertRepo, assetPriceSvc, nil)
	ctx := context.Background()

	now := time.Now()
	alerts := []*models.UserPriceAlert{
		{
			ID:        1,
			UserID:    1,
			Symbol:    "SJL1L10",
			AssetType: int32(v1.InvestmentType_INVESTMENT_TYPE_GOLD_VND),
			Currency:  "VND",
			PriceSide: "buy",
			Status:    "active",
			CreatedAt: now,
			UpdatedAt: now,
		},
	}

	alertRepo.On("ListByUserID", ctx, int32(1), "", mock.AnythingOfType("repository.ListOptions")).
		Return(alerts, 1, nil)
	// DB returns stale price — should NOT appear in price map
	assetPriceSvc.On("GetPricesByAssetType", mock.Anything, "gold").
		Return([]*AssetPriceDTO{
			{TypeCode: "SJL1L10", Buy: 9100000000, Sell: 9200000000, IsStale: true},
		}, nil)

	resp, err := svc.ListAlerts(ctx, 1, &v1.ListUserPriceAlertsRequest{})

	assert.NoError(t, err)
	assert.Len(t, resp.Alerts, 1)
	// stale price excluded → CurrentPrice not populated
	assert.Equal(t, int64(0), resp.Alerts[0].CurrentPrice)
	assetPriceSvc.AssertExpectations(t)
}

func TestUserPriceAlertService_ListAlerts_SilverPrices_FromDB_NonStale(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	assetPriceSvc := new(mockAlertAssetPriceSvc)
	svc := newTestAlertService(alertRepo, assetPriceSvc, nil)
	ctx := context.Background()

	now := time.Now()
	alerts := []*models.UserPriceAlert{
		{
			ID:        2,
			UserID:    1,
			Symbol:    "AG_VND",
			AssetType: int32(v1.InvestmentType_INVESTMENT_TYPE_SILVER_VND),
			Currency:  "VND",
			PriceSide: "sell",
			Status:    "active",
			CreatedAt: now,
			UpdatedAt: now,
		},
	}

	alertRepo.On("ListByUserID", ctx, int32(1), "", mock.AnythingOfType("repository.ListOptions")).
		Return(alerts, 1, nil)
	assetPriceSvc.On("GetPricesByAssetType", mock.Anything, "silver").
		Return([]*AssetPriceDTO{
			{TypeCode: "AG_VND", Buy: 1800000, Sell: 1900000, IsStale: false},
		}, nil)

	resp, err := svc.ListAlerts(ctx, 1, &v1.ListUserPriceAlertsRequest{})

	assert.NoError(t, err)
	assert.Len(t, resp.Alerts, 1)
	// sell side price
	assert.Equal(t, int64(1900000), resp.Alerts[0].CurrentPrice)
	assetPriceSvc.AssertExpectations(t)
}

// --- Tests: UpdateAlert ---

func TestUserPriceAlertService_UpdateAlert_Success(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	existing := &models.UserPriceAlert{
		ID:            1,
		UserID:        1,
		Symbol:        "VCB",
		Name:          "Vietcombank",
		TargetPrice:   100000,
		TriggerMode:   "once",
		CooldownHours: 4,
		Status:        "active",
	}

	alertRepo.On("GetByIDForUser", ctx, int32(1), int32(1)).Return(existing, nil)
	alertRepo.On("Update", ctx, mock.AnythingOfType("*models.UserPriceAlert")).Return(nil)

	resp, err := svc.UpdateAlert(ctx, 1, 1, &v1.UpdateUserPriceAlertRequest{
		Id:          1,
		TargetPrice: 120000,
		Note:        "updated note",
	})

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Equal(t, int64(120000), resp.Alert.TargetPrice)
	alertRepo.AssertExpectations(t)
}

func TestUserPriceAlertService_UpdateAlert_NotFound(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	alertRepo.On("GetByIDForUser", ctx, int32(99), int32(1)).
		Return(nil, apperrors.NewNotFoundError("user price alert"))

	resp, err := svc.UpdateAlert(ctx, 99, 1, &v1.UpdateUserPriceAlertRequest{
		Id:          99,
		TargetPrice: 120000,
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Equal(t, 404, apperrors.GetStatusCode(err))
	alertRepo.AssertExpectations(t)
}

func TestUserPriceAlertService_UpdateAlert_RepeatMode_CooldownInvalid(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	existing := &models.UserPriceAlert{
		ID:            1,
		UserID:        1,
		TriggerMode:   "once",
		CooldownHours: 4,
		Status:        "active",
	}

	alertRepo.On("GetByIDForUser", ctx, int32(1), int32(1)).Return(existing, nil)

	resp, err := svc.UpdateAlert(ctx, 1, 1, &v1.UpdateUserPriceAlertRequest{
		Id:            1,
		TriggerMode:   v1.AlertTriggerMode_ALERT_TRIGGER_MODE_REPEAT,
		CooldownHours: 1, // below minimum
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cooldown hours must be between")
}

// --- Tests: DeleteAlert ---

func TestUserPriceAlertService_DeleteAlert_Success(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	alertRepo.On("Delete", ctx, int32(1), int32(1)).Return(nil)

	resp, err := svc.DeleteAlert(ctx, 1, 1)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	alertRepo.AssertExpectations(t)
}

func TestUserPriceAlertService_DeleteAlert_NotFound(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	alertRepo.On("Delete", ctx, int32(99), int32(1)).
		Return(apperrors.NewNotFoundError("user price alert"))

	resp, err := svc.DeleteAlert(ctx, 99, 1)

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Equal(t, 404, apperrors.GetStatusCode(err))
	alertRepo.AssertExpectations(t)
}

// --- Tests: EvaluateAlerts with DB-backed prices ---

func TestUserPriceAlertService_EvaluateAlerts_GoldAlert_TriggeredFromDB(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	assetPriceSvc := new(mockAlertAssetPriceSvc)
	notifRepo := new(mockAlertNotifRepo)
	pushSvc := new(mockAlertPushSvc)
	svc := &userPriceAlertService{
		alertRepo:     alertRepo,
		assetPriceSvc: assetPriceSvc,
		marketDataSvc: &mockAlertMarketDataSvc{},
		notifRepo:     notifRepo,
		pushSvc:       pushSvc,
		rdb:           nil,
	}
	ctx := context.Background()

	now := time.Now()
	activeAlerts := []*models.UserPriceAlert{
		{
			ID:          10,
			UserID:      1,
			Symbol:      "SJL1L10",
			Name:        "SJC Gold",
			AssetType:   int32(v1.InvestmentType_INVESTMENT_TYPE_GOLD_VND),
			Currency:    "VND",
			PriceSide:   "buy",
			Direction:   "above",
			TargetPrice: 9000000000,
			TriggerMode: "once",
			Status:      "active",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}

	alertRepo.On("ListActive", ctx).Return(activeAlerts, nil)
	// DB returns non-stale price above target → alert should trigger
	assetPriceSvc.On("GetPricesByAssetType", mock.Anything, "gold").
		Return([]*AssetPriceDTO{
			{TypeCode: "SJL1L10", Buy: 9100000000, Sell: 9200000000, IsStale: false},
		}, nil)
	notifRepo.On("Create", mock.Anything, mock.AnythingOfType("*models.Notification")).Return(nil)
	pushSvc.On("SendToUser", mock.Anything, int32(1), mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil)
	alertRepo.On("UpdateStatus", mock.Anything, int32(10), "triggered", mock.Anything, int32(1)).Return(nil)

	err := svc.EvaluateAlerts(ctx)

	assert.NoError(t, err)
	alertRepo.AssertExpectations(t)
	assetPriceSvc.AssertExpectations(t)
	notifRepo.AssertExpectations(t)
	pushSvc.AssertExpectations(t)
}

func TestUserPriceAlertService_EvaluateAlerts_GoldAlert_StalePrice_NotTriggered(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	assetPriceSvc := new(mockAlertAssetPriceSvc)
	svc := &userPriceAlertService{
		alertRepo:     alertRepo,
		assetPriceSvc: assetPriceSvc,
		marketDataSvc: &mockAlertMarketDataSvc{},
		notifRepo:     &mockAlertNotifRepo{},
		pushSvc:       &mockAlertPushSvc{},
		rdb:           nil,
	}
	ctx := context.Background()

	now := time.Now()
	activeAlerts := []*models.UserPriceAlert{
		{
			ID:          11,
			UserID:      1,
			Symbol:      "SJL1L10",
			AssetType:   int32(v1.InvestmentType_INVESTMENT_TYPE_GOLD_VND),
			Currency:    "VND",
			PriceSide:   "buy",
			Direction:   "above",
			TargetPrice: 9000000000,
			TriggerMode: "once",
			Status:      "active",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}

	alertRepo.On("ListActive", ctx).Return(activeAlerts, nil)
	// DB returns stale price — should be excluded from price map, alert skipped
	assetPriceSvc.On("GetPricesByAssetType", mock.Anything, "gold").
		Return([]*AssetPriceDTO{
			{TypeCode: "SJL1L10", Buy: 9100000000, Sell: 9200000000, IsStale: true},
		}, nil)

	err := svc.EvaluateAlerts(ctx)

	assert.NoError(t, err)
	// No notification, no status update — alert skipped due to missing/stale price
	alertRepo.AssertNotCalled(t, "UpdateStatus")
}

// --- Security checks ---

func TestUserPriceAlertService_CreateAlert_InvalidUserID(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	resp, err := svc.CreateAlert(ctx, 0, validStockCreateReq())

	assert.Nil(t, resp)
	assert.Error(t, err)
	alertRepo.AssertNotCalled(t, "CountActiveByUserID")
}

func TestUserPriceAlertService_DeleteAlert_InvalidUserID(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	resp, err := svc.DeleteAlert(ctx, 1, 0)

	assert.Nil(t, resp)
	assert.Error(t, err)
	alertRepo.AssertNotCalled(t, "Delete")
}

func TestUserPriceAlertService_UpdateAlert_InvalidUserID(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil)
	ctx := context.Background()

	resp, err := svc.UpdateAlert(ctx, 1, 0, &v1.UpdateUserPriceAlertRequest{
		TargetPrice: 100000,
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
	alertRepo.AssertNotCalled(t, "GetByIDForUser")
}
