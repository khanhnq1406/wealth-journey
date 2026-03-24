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

// --- Mock: GoldPriceService (alert-scope) ---

type mockAlertGoldPriceSvc struct {
	mock.Mock
}

func (m *mockAlertGoldPriceSvc) FetchPriceForSymbol(ctx context.Context, symbol string) (*CachedGoldPrice, error) {
	args := m.Called(ctx, symbol)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*CachedGoldPrice), args.Error(1)
}

func (m *mockAlertGoldPriceSvc) FetchAllPrices(ctx context.Context) ([]*CachedGoldPrice, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*CachedGoldPrice), args.Error(1)
}

// --- Mock: SilverPriceService (alert-scope) ---

type mockAlertSilverPriceSvc struct {
	mock.Mock
}

func (m *mockAlertSilverPriceSvc) FetchPriceForSymbol(ctx context.Context, symbol string) (*CachedSilverPrice, error) {
	args := m.Called(ctx, symbol)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*CachedSilverPrice), args.Error(1)
}

func (m *mockAlertSilverPriceSvc) FetchAllPrices(ctx context.Context) ([]*CachedSilverPrice, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*CachedSilverPrice), args.Error(1)
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
// Passing nil for goldSvc/silverSvc/marketSvc is fine for tests that don't need price fetching.
func newTestAlertService(
	alertRepo *mockUserPriceAlertRepo,
	goldSvc GoldPriceService,
	silverSvc SilverPriceService,
	marketSvc MarketDataService,
) UserPriceAlertService {
	var g GoldPriceService = goldSvc
	var sv SilverPriceService = silverSvc
	var mkt MarketDataService = marketSvc

	if g == nil {
		g = &mockAlertGoldPriceSvc{}
	}
	if sv == nil {
		sv = &mockAlertSilverPriceSvc{}
	}
	if mkt == nil {
		mkt = &mockAlertMarketDataSvc{}
	}

	return &userPriceAlertService{
		alertRepo:      alertRepo,
		goldPriceSvc:   g,
		silverPriceSvc: sv,
		marketDataSvc:  mkt,
		notifRepo:      &mockAlertNotifRepo{},
		pushSvc:        &mockAlertPushSvc{},
		rdb:            nil,
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

// --- Tests: CreateAlert ---

func TestUserPriceAlertService_CreateAlert_Success(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	marketSvc := new(mockAlertMarketDataSvc)
	svc := newTestAlertService(alertRepo, nil, nil, marketSvc)
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
	svc := newTestAlertService(alertRepo, nil, nil, nil)
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
	svc := newTestAlertService(alertRepo, nil, nil, nil)
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
	svc := newTestAlertService(alertRepo, nil, nil, nil)
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
	svc := newTestAlertService(alertRepo, nil, nil, nil)
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
	svc := newTestAlertService(alertRepo, nil, nil, nil)
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
	svc := newTestAlertService(alertRepo, nil, nil, nil)
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
	svc := newTestAlertService(alertRepo, nil, nil, marketSvc)
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

// --- Tests: ListAlerts ---

func TestUserPriceAlertService_ListAlerts_Success(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	marketSvc := new(mockAlertMarketDataSvc)
	svc := newTestAlertService(alertRepo, nil, nil, marketSvc)
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
	svc := newTestAlertService(alertRepo, nil, nil, nil)
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

// --- Tests: UpdateAlert ---

func TestUserPriceAlertService_UpdateAlert_Success(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil, nil)
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
	svc := newTestAlertService(alertRepo, nil, nil, nil)
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
	svc := newTestAlertService(alertRepo, nil, nil, nil)
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
	svc := newTestAlertService(alertRepo, nil, nil, nil)
	ctx := context.Background()

	alertRepo.On("Delete", ctx, int32(1), int32(1)).Return(nil)

	resp, err := svc.DeleteAlert(ctx, 1, 1)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	alertRepo.AssertExpectations(t)
}

func TestUserPriceAlertService_DeleteAlert_NotFound(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil, nil)
	ctx := context.Background()

	alertRepo.On("Delete", ctx, int32(99), int32(1)).
		Return(apperrors.NewNotFoundError("user price alert"))

	resp, err := svc.DeleteAlert(ctx, 99, 1)

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Equal(t, 404, apperrors.GetStatusCode(err))
	alertRepo.AssertExpectations(t)
}

// --- Security checks ---

func TestUserPriceAlertService_CreateAlert_InvalidUserID(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil, nil)
	ctx := context.Background()

	resp, err := svc.CreateAlert(ctx, 0, validStockCreateReq())

	assert.Nil(t, resp)
	assert.Error(t, err)
	alertRepo.AssertNotCalled(t, "CountActiveByUserID")
}

func TestUserPriceAlertService_DeleteAlert_InvalidUserID(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil, nil)
	ctx := context.Background()

	resp, err := svc.DeleteAlert(ctx, 1, 0)

	assert.Nil(t, resp)
	assert.Error(t, err)
	alertRepo.AssertNotCalled(t, "Delete")
}

func TestUserPriceAlertService_UpdateAlert_InvalidUserID(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	svc := newTestAlertService(alertRepo, nil, nil, nil)
	ctx := context.Background()

	resp, err := svc.UpdateAlert(ctx, 1, 0, &v1.UpdateUserPriceAlertRequest{
		TargetPrice: 100000,
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
	alertRepo.AssertNotCalled(t, "GetByIDForUser")
}
