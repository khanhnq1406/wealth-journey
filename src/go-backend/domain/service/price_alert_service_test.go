package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	pkgredis "wealthjourney/pkg/redis"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// ---------------------------------------------------------------------------
// Mock types (prefixed with mockPA to avoid conflicts)
// ---------------------------------------------------------------------------

type mockPAGoldPriceSvc struct {
	mock.Mock
}

func (m *mockPAGoldPriceSvc) FetchPriceForSymbol(ctx context.Context, symbol string) (*CachedGoldPrice, error) {
	args := m.Called(ctx, symbol)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*CachedGoldPrice), args.Error(1)
}

func (m *mockPAGoldPriceSvc) FetchAllPrices(ctx context.Context) ([]*CachedGoldPrice, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*CachedGoldPrice), args.Error(1)
}

type mockPASilverPriceSvc struct {
	mock.Mock
}

func (m *mockPASilverPriceSvc) FetchPriceForSymbol(ctx context.Context, symbol string) (*CachedSilverPrice, error) {
	args := m.Called(ctx, symbol)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*CachedSilverPrice), args.Error(1)
}

func (m *mockPASilverPriceSvc) FetchAllPrices(ctx context.Context) ([]*CachedSilverPrice, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*CachedSilverPrice), args.Error(1)
}

type mockPANotifRepo struct {
	mock.Mock
}

func (m *mockPANotifRepo) Create(ctx context.Context, notification *models.Notification) error {
	args := m.Called(ctx, notification)
	return args.Error(0)
}

func (m *mockPANotifRepo) BatchCreate(ctx context.Context, notifications []*models.Notification) error {
	args := m.Called(ctx, notifications)
	return args.Error(0)
}

func (m *mockPANotifRepo) GetByUserID(ctx context.Context, userID int32, opts repository.ListOptions) ([]*models.Notification, int, error) {
	args := m.Called(ctx, userID, opts)
	return args.Get(0).([]*models.Notification), args.Int(1), args.Error(2)
}

func (m *mockPANotifRepo) GetUnreadCount(ctx context.Context, userID int32) (int32, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int32), args.Error(1)
}

func (m *mockPANotifRepo) MarkAllRead(ctx context.Context, userID int32) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *mockPANotifRepo) MarkRead(ctx context.Context, id int32, userID int32) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

type mockPAUserRepo struct {
	mock.Mock
}

func (m *mockPAUserRepo) Create(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *mockPAUserRepo) GetByID(ctx context.Context, id int32) (*models.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *mockPAUserRepo) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *mockPAUserRepo) List(ctx context.Context, opts repository.ListOptions) ([]*models.User, int, error) {
	args := m.Called(ctx, opts)
	return args.Get(0).([]*models.User), args.Int(1), args.Error(2)
}

func (m *mockPAUserRepo) Update(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *mockPAUserRepo) Delete(ctx context.Context, id int32) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *mockPAUserRepo) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	args := m.Called(ctx, email)
	return args.Bool(0), args.Error(1)
}

func (m *mockPAUserRepo) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	args := m.Called(ctx, username)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *mockPAUserRepo) ListWithSearch(ctx context.Context, search string, opts repository.ListOptions) ([]*models.User, int, error) {
	args := m.Called(ctx, search, opts)
	return args.Get(0).([]*models.User), args.Int(1), args.Error(2)
}

func (m *mockPAUserRepo) GetAllUserIDs(ctx context.Context) ([]int32, error) {
	args := m.Called(ctx)
	return args.Get(0).([]int32), args.Error(1)
}

type mockPAPushSvc struct {
	mock.Mock
}

func (m *mockPAPushSvc) SendToUser(ctx context.Context, userID int32, title, body, url string) error {
	args := m.Called(ctx, userID, title, body, url)
	return args.Error(0)
}

func (m *mockPAPushSvc) SendToAll(ctx context.Context, title, body, url string) error {
	args := m.Called(ctx, title, body, url)
	return args.Error(0)
}

func (m *mockPAPushSvc) GetVAPIDPublicKey() string {
	args := m.Called()
	return args.String(0)
}

// ---------------------------------------------------------------------------
// Helper: create a PriceAlertService backed by an in-memory Redis (miniredis).
// Returns the service, the miniredis server (for pre-seeding keys), and a
// cleanup function.
// ---------------------------------------------------------------------------

func newPriceAlertServiceWithMiniredis(
	t *testing.T,
	goldSvc GoldPriceService,
	silverSvc SilverPriceService,
	notifRepo repository.NotificationRepository,
	userRepo repository.UserRepository,
	pushSvc PushService,
) (PriceAlertService, *miniredis.Miniredis) {
	t.Helper()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("failed to start miniredis: %v", err)
	}
	t.Cleanup(mr.Close)

	redisClient := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})
	t.Cleanup(func() { _ = redisClient.Close() })

	rdb := pkgredis.NewFromClient(redisClient)

	svc := NewPriceAlertService(goldSvc, silverSvc, notifRepo, userRepo, rdb, pushSvc)
	return svc, mr
}

// setBaseline seeds a baseline key in miniredis for the given typeCode.
func setBaseline(mr *miniredis.Miniredis, typeCode string, price int64) {
	key := fmt.Sprintf("price_alert:baseline:%s", typeCode)
	mr.Set(key, fmt.Sprintf("%d", price))
}

// setCooldown seeds a cooldown key in miniredis for the given category.
func setCooldown(mr *miniredis.Miniredis, category string) {
	key := fmt.Sprintf("price_alert:cooldown:%s", category)
	mr.Set(key, "1")
}

// baselineExists returns true when a baseline key exists in miniredis.
func baselineExists(mr *miniredis.Miniredis, typeCode string) bool {
	key := fmt.Sprintf("price_alert:baseline:%s", typeCode)
	return mr.Exists(key)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// TestPriceAlertService_FirstRun_SetsBaselines verifies that on the very first
// run (no baselines in Redis), prices are stored as baselines and no
// notifications or push alerts are sent.
func TestPriceAlertService_FirstRun_SetsBaselines(t *testing.T) {
	// Use low thresholds so any change would trigger if baselines were already set
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	goldSvc := new(mockPAGoldPriceSvc)
	silverSvc := new(mockPASilverPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, goldSvc, silverSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	goldPrices := []*CachedGoldPrice{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: 8500000000, Sell: 8600000000, Currency: "VND", UpdateTime: time.Now()},
		{TypeCode: "XAU", Name: "Gold World", Buy: 200000, Sell: 201000, Currency: "USD", UpdateTime: time.Now()},
	}
	silverPrices := []*CachedSilverPrice{
		{TypeCode: "AGV", Name: "Silver VND", Buy: 1500000, Sell: 1520000, Currency: "VND", UpdateTime: time.Now()},
	}

	goldSvc.On("FetchAllPrices", ctx).Return(goldPrices, nil)
	silverSvc.On("FetchAllPrices", ctx).Return(silverPrices, nil)

	// BatchCreate must NOT be called — no alerts on first run
	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	goldSvc.AssertExpectations(t)
	silverSvc.AssertExpectations(t)
	notifRepo.AssertNotCalled(t, "BatchCreate", mock.Anything, mock.Anything)
	pushSvc.AssertNotCalled(t, "SendToAll", mock.Anything, mock.Anything, mock.Anything, mock.Anything)

	// Baselines must be stored in Redis after first run
	assert.True(t, baselineExists(mr, "SJL1L10"), "expected baseline for SJL1L10")
	assert.True(t, baselineExists(mr, "XAU"), "expected baseline for XAU")
	assert.True(t, baselineExists(mr, "AGV"), "expected baseline for AGV")
}

// TestPriceAlertService_SignificantChange_TriggersAlert verifies that when
// a gold VND price changes by more than the configured threshold (2%), the
// service creates notifications for all users and sends a push alert.
func TestPriceAlertService_SignificantChange_TriggersAlert(t *testing.T) {
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	goldSvc := new(mockPAGoldPriceSvc)
	silverSvc := new(mockPASilverPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, goldSvc, silverSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Baseline: 8,500,000,000 VND. New price is ~3% higher → should trigger.
	baselinePrice := int64(8_500_000_000)
	newPrice := int64(8_755_000_000) // ~3% increase
	setBaseline(mr, "SJL1L10", baselinePrice)

	goldPrices := []*CachedGoldPrice{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: newPrice, Sell: newPrice + 100_000_000, Currency: "VND", UpdateTime: time.Now()},
	}
	silverPrices := []*CachedSilverPrice{}

	goldSvc.On("FetchAllPrices", ctx).Return(goldPrices, nil)
	silverSvc.On("FetchAllPrices", ctx).Return(silverPrices, nil)
	userRepo.On("GetAllUserIDs", ctx).Return([]int32{1, 2, 3}, nil)
	notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil)
	pushSvc.On("SendToAll", ctx, mock.AnythingOfType("string"), mock.AnythingOfType("string"), "/dashboard/prices").Return(nil)

	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	goldSvc.AssertExpectations(t)
	silverSvc.AssertExpectations(t)
	notifRepo.AssertExpectations(t)
	pushSvc.AssertExpectations(t)
	userRepo.AssertExpectations(t)

	// Verify that exactly 3 notifications were created (one per user)
	batchCreateCall := notifRepo.Calls[0]
	notifications := batchCreateCall.Arguments.Get(1).([]*models.Notification)
	assert.Len(t, notifications, 3, "expected one notification per user")
	for _, n := range notifications {
		assert.Equal(t, "price_alert", n.Type)
		assert.Zero(t, n.ActorID)
	}
}

// TestPriceAlertService_BelowThreshold_NoAlert verifies that price changes
// below the configured threshold do not result in notifications or push alerts.
func TestPriceAlertService_BelowThreshold_NoAlert(t *testing.T) {
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	goldSvc := new(mockPAGoldPriceSvc)
	silverSvc := new(mockPASilverPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, goldSvc, silverSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Baseline: 8,500,000,000. New price is ~0.5% higher → below 2% threshold.
	baselinePrice := int64(8_500_000_000)
	newPrice := int64(8_542_500_000) // 0.5% increase
	setBaseline(mr, "SJL1L10", baselinePrice)

	goldPrices := []*CachedGoldPrice{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: newPrice, Sell: newPrice + 50_000_000, Currency: "VND", UpdateTime: time.Now()},
	}
	silverPrices := []*CachedSilverPrice{}

	goldSvc.On("FetchAllPrices", ctx).Return(goldPrices, nil)
	silverSvc.On("FetchAllPrices", ctx).Return(silverPrices, nil)

	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	goldSvc.AssertExpectations(t)
	silverSvc.AssertExpectations(t)
	notifRepo.AssertNotCalled(t, "BatchCreate", mock.Anything, mock.Anything)
	pushSvc.AssertNotCalled(t, "SendToAll", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	userRepo.AssertNotCalled(t, "GetAllUserIDs", mock.Anything)
}

// TestPriceAlertService_Cooldown_SkipsAlert verifies that when the cooldown key
// exists in Redis, alerts are suppressed even when the price change is significant.
func TestPriceAlertService_Cooldown_SkipsAlert(t *testing.T) {
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	goldSvc := new(mockPAGoldPriceSvc)
	silverSvc := new(mockPASilverPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, goldSvc, silverSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Set baseline and a large price change (3%)
	baselinePrice := int64(8_500_000_000)
	newPrice := int64(8_755_000_000) // ~3%
	setBaseline(mr, "SJL1L10", baselinePrice)

	// Set cooldown for the gold_vnd category
	setCooldown(mr, "gold_vnd")

	goldPrices := []*CachedGoldPrice{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: newPrice, Sell: newPrice + 100_000_000, Currency: "VND", UpdateTime: time.Now()},
	}
	silverPrices := []*CachedSilverPrice{}

	goldSvc.On("FetchAllPrices", ctx).Return(goldPrices, nil)
	silverSvc.On("FetchAllPrices", ctx).Return(silverPrices, nil)

	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	goldSvc.AssertExpectations(t)
	silverSvc.AssertExpectations(t)
	// Cooldown must prevent BatchCreate and SendToAll
	notifRepo.AssertNotCalled(t, "BatchCreate", mock.Anything, mock.Anything)
	pushSvc.AssertNotCalled(t, "SendToAll", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	userRepo.AssertNotCalled(t, "GetAllUserIDs", mock.Anything)
}

// TestPriceAlertService_GoldFetchError_ContinuesToSilver verifies that when
// fetching gold prices fails, the service continues to process silver prices
// and still sends an alert when the silver change is significant.
func TestPriceAlertService_GoldFetchError_ContinuesToSilver(t *testing.T) {
	t.Setenv("PRICE_ALERT_SILVER_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	goldSvc := new(mockPAGoldPriceSvc)
	silverSvc := new(mockPASilverPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, goldSvc, silverSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Silver: 3% change above threshold
	silverBaseline := int64(1_500_000)
	silverNewPrice := int64(1_545_000) // 3% increase
	setBaseline(mr, "AGV", silverBaseline)

	goldSvc.On("FetchAllPrices", ctx).Return(nil, fmt.Errorf("upstream timeout"))
	silverSvc.On("FetchAllPrices", ctx).Return([]*CachedSilverPrice{
		{TypeCode: "AGV", Name: "Silver VND", Buy: silverNewPrice, Sell: silverNewPrice + 10_000, Currency: "VND", UpdateTime: time.Now()},
	}, nil)
	userRepo.On("GetAllUserIDs", ctx).Return([]int32{10, 20}, nil)
	notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil)
	pushSvc.On("SendToAll", ctx, mock.AnythingOfType("string"), mock.AnythingOfType("string"), "/dashboard/prices").Return(nil)

	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	goldSvc.AssertExpectations(t)
	silverSvc.AssertExpectations(t)
	// Silver alert must still be delivered
	notifRepo.AssertExpectations(t)
	pushSvc.AssertExpectations(t)
	userRepo.AssertExpectations(t)
}

// TestPriceAlertService_NoUsers_NoNotifications verifies that when
// GetAllUserIDs returns an empty slice, no notifications are created but the
// service does not return an error.
func TestPriceAlertService_NoUsers_NoNotifications(t *testing.T) {
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	goldSvc := new(mockPAGoldPriceSvc)
	silverSvc := new(mockPASilverPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, goldSvc, silverSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	baselinePrice := int64(8_500_000_000)
	newPrice := int64(8_755_000_000) // ~3% — above threshold
	setBaseline(mr, "SJL1L10", baselinePrice)

	goldSvc.On("FetchAllPrices", ctx).Return([]*CachedGoldPrice{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: newPrice, Sell: newPrice + 100_000_000, Currency: "VND", UpdateTime: time.Now()},
	}, nil)
	silverSvc.On("FetchAllPrices", ctx).Return([]*CachedSilverPrice{}, nil)

	// No users registered in the system
	userRepo.On("GetAllUserIDs", ctx).Return([]int32{}, nil)

	// The service still calls BatchCreate with an empty slice and SendToAll
	// (push is decoupled from user count). Register both as optional.
	notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil).Maybe()
	pushSvc.On("SendToAll", ctx, mock.AnythingOfType("string"), mock.AnythingOfType("string"), "/dashboard/prices").Return(nil).Maybe()

	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	goldSvc.AssertExpectations(t)
	silverSvc.AssertExpectations(t)
	userRepo.AssertExpectations(t)

	// If BatchCreate was called, it must have been with zero notifications
	// (no real users to notify).
	for _, call := range notifRepo.Calls {
		if call.Method == "BatchCreate" {
			notifications := call.Arguments.Get(1).([]*models.Notification)
			assert.Empty(t, notifications, "expected no notifications when user list is empty")
		}
	}
}
