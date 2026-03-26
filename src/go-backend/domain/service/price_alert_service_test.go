package service

import (
	"context"
	"encoding/json"
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

type mockPAAssetPriceSvc struct {
	mock.Mock
}

func (m *mockPAAssetPriceSvc) RefreshAllPrices(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *mockPAAssetPriceSvc) GetAllPrices(ctx context.Context) (*AllAssetPrices, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*AllAssetPrices), args.Error(1)
}

func (m *mockPAAssetPriceSvc) GetPricesByAssetType(ctx context.Context, assetType string) ([]*AssetPriceDTO, error) {
	args := m.Called(ctx, assetType)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*AssetPriceDTO), args.Error(1)
}

func (m *mockPAAssetPriceSvc) GetMarketTypes(ctx context.Context) (*MarketTypesDTO, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*MarketTypesDTO), args.Error(1)
}

func (m *mockPAAssetPriceSvc) GetPriceByTypeCode(ctx context.Context, typeCode string) (*AssetPriceDTO, error) {
	args := m.Called(ctx, typeCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*AssetPriceDTO), args.Error(1)
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
	assetPriceSvc AssetPriceService,
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

	svc := NewPriceAlertService(assetPriceSvc, notifRepo, userRepo, rdb, pushSvc)
	return svc, mr
}

// setBaseline seeds a baseline key in miniredis for the given typeCode.
func setBaseline(mr *miniredis.Miniredis, typeCode string, price int64) {
	key := fmt.Sprintf("price_alert:baseline:%s", typeCode)
	_ = mr.Set(key, fmt.Sprintf("%d", price))
}

// setCooldown seeds a cooldown key in miniredis for the given category.
func setCooldown(mr *miniredis.Miniredis, category string) {
	key := fmt.Sprintf("price_alert:cooldown:%s", category)
	_ = mr.Set(key, "1")
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

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	goldPrices := []*AssetPriceDTO{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: 8500000000, Sell: 8600000000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
		{TypeCode: "XAU", Name: "Gold World", Buy: 200000, Sell: 201000, Currency: "USD", IsStale: false, FetchedAt: time.Now()},
	}
	silverPrices := []*AssetPriceDTO{
		{TypeCode: "AGV", Name: "Silver VND", Buy: 1500000, Sell: 1520000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
	}

	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(goldPrices, nil)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)

	// BatchCreate must NOT be called — no alerts on first run
	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	assetPriceSvc.AssertExpectations(t)
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

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Baseline: 8,500,000,000 VND. New price is ~3% higher → should trigger.
	baselinePrice := int64(8_500_000_000)
	newPrice := int64(8_755_000_000) // ~3% increase
	setBaseline(mr, "SJL1L10", baselinePrice)

	goldPrices := []*AssetPriceDTO{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: newPrice, Sell: newPrice + 100_000_000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
	}
	silverPrices := []*AssetPriceDTO{}

	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(goldPrices, nil)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)
	userRepo.On("GetAllUserIDs", ctx).Return([]int32{1, 2, 3}, nil)
	notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil)
	pushSvc.On("SendToAll", ctx, mock.AnythingOfType("string"), mock.AnythingOfType("string"), "/dashboard/home").Return(nil)

	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	assetPriceSvc.AssertExpectations(t)
	notifRepo.AssertExpectations(t)
	pushSvc.AssertExpectations(t)
	userRepo.AssertExpectations(t)

	// Verify that exactly 3 notifications were created (one per user)
	batchCreateCall := notifRepo.Calls[0]
	notifications := batchCreateCall.Arguments.Get(1).([]*models.Notification)
	assert.Len(t, notifications, 3, "expected one notification per user")
	for _, n := range notifications {
		assert.Equal(t, "price_alert", n.Type)
		assert.Nil(t, n.ActorID)
	}

	// Verify metadata contains resolved title and body (not raw templates)
	var meta map[string]interface{}
	err = json.Unmarshal([]byte(notifications[0].Metadata), &meta)
	assert.NoError(t, err)
	assert.Contains(t, meta, "title", "metadata must include resolved title")
	assert.Contains(t, meta, "body", "metadata must include resolved body")

	// Title should be the default template for gold_vnd
	assert.Equal(t, "Giá vàng biến động mạnh", meta["title"])
	// Body should contain the resolved mover name, not raw {moverName} placeholder
	bodyStr, _ := meta["body"].(string)
	assert.Contains(t, bodyStr, "SJC 1L-10L", "body must contain the resolved mover name")
	assert.NotContains(t, bodyStr, "{moverName}", "body must not contain unresolved placeholders")
}

// TestPriceAlertService_BelowThreshold_NoAlert verifies that price changes
// below the configured threshold do not result in notifications or push alerts.
func TestPriceAlertService_BelowThreshold_NoAlert(t *testing.T) {
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Baseline: 8,500,000,000. New price is ~0.5% higher → below 2% threshold.
	baselinePrice := int64(8_500_000_000)
	newPrice := int64(8_542_500_000) // 0.5% increase
	setBaseline(mr, "SJL1L10", baselinePrice)

	goldPrices := []*AssetPriceDTO{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: newPrice, Sell: newPrice + 50_000_000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
	}
	silverPrices := []*AssetPriceDTO{}

	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(goldPrices, nil)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)

	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	assetPriceSvc.AssertExpectations(t)
	notifRepo.AssertNotCalled(t, "BatchCreate", mock.Anything, mock.Anything)
	pushSvc.AssertNotCalled(t, "SendToAll", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	userRepo.AssertNotCalled(t, "GetAllUserIDs", mock.Anything)
}

// TestPriceAlertService_Cooldown_SkipsAlert verifies that when the cooldown key
// exists in Redis, alerts are suppressed even when the price change is significant.
func TestPriceAlertService_Cooldown_SkipsAlert(t *testing.T) {
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Set baseline and a large price change (3%)
	baselinePrice := int64(8_500_000_000)
	newPrice := int64(8_755_000_000) // ~3%
	setBaseline(mr, "SJL1L10", baselinePrice)

	// Set cooldown for the gold_vnd category
	setCooldown(mr, "gold_vnd")

	goldPrices := []*AssetPriceDTO{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: newPrice, Sell: newPrice + 100_000_000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
	}
	silverPrices := []*AssetPriceDTO{}

	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(goldPrices, nil)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)

	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	assetPriceSvc.AssertExpectations(t)
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

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Silver: 3% change above threshold
	silverBaseline := int64(1_500_000)
	silverNewPrice := int64(1_545_000) // 3% increase
	setBaseline(mr, "AGV", silverBaseline)

	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(nil, fmt.Errorf("upstream timeout"))
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return([]*AssetPriceDTO{
		{TypeCode: "AGV", Name: "Silver VND", Buy: silverNewPrice, Sell: silverNewPrice + 10_000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
	}, nil)
	userRepo.On("GetAllUserIDs", ctx).Return([]int32{10, 20}, nil)
	notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil)
	pushSvc.On("SendToAll", ctx, mock.AnythingOfType("string"), mock.AnythingOfType("string"), "/dashboard/home").Return(nil)

	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	assetPriceSvc.AssertExpectations(t)
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

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	baselinePrice := int64(8_500_000_000)
	newPrice := int64(8_755_000_000) // ~3% — above threshold
	setBaseline(mr, "SJL1L10", baselinePrice)

	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return([]*AssetPriceDTO{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: newPrice, Sell: newPrice + 100_000_000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
	}, nil)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return([]*AssetPriceDTO{}, nil)

	// No users registered in the system
	userRepo.On("GetAllUserIDs", ctx).Return([]int32{}, nil)

	// The service still calls BatchCreate with an empty slice and SendToAll
	// (push is decoupled from user count). Register both as optional.
	notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil).Maybe()
	pushSvc.On("SendToAll", ctx, mock.AnythingOfType("string"), mock.AnythingOfType("string"), "/dashboard/home").Return(nil).Maybe()

	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	assetPriceSvc.AssertExpectations(t)
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

// TestPriceAlertService_ForceCheck_AlwaysSendsAlert verifies that
// ForceCheckAndAlert always sends notifications with current prices,
// bypassing threshold checks, cooldown, and missing baselines.
func TestPriceAlertService_ForceCheck_AlwaysSendsAlert(t *testing.T) {
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Set baseline with only 0.5% change — below threshold for normal check
	baselinePrice := int64(8_500_000_000)
	newPrice := int64(8_542_500_000) // 0.5% increase — would NOT trigger CheckAndAlert
	setBaseline(mr, "SJL1L10", baselinePrice)

	// Also set cooldown — would block normal CheckAndAlert
	setCooldown(mr, "gold_vnd")

	goldPrices := []*AssetPriceDTO{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: newPrice, Sell: newPrice + 50_000_000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
	}
	silverPrices := []*AssetPriceDTO{}

	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(goldPrices, nil)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)
	userRepo.On("GetAllUserIDs", ctx).Return([]int32{1, 2}, nil)
	notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil)
	pushSvc.On("SendToAll", ctx, mock.AnythingOfType("string"), mock.AnythingOfType("string"), "/dashboard/home").Return(nil)

	// Force check must always send, regardless of threshold and cooldown
	err := svc.ForceCheckAndAlert(ctx)

	assert.NoError(t, err)
	assetPriceSvc.AssertExpectations(t)
	notifRepo.AssertExpectations(t)
	pushSvc.AssertExpectations(t)
	userRepo.AssertExpectations(t)

	// Verify 2 notifications created (one per user)
	batchCreateCall := notifRepo.Calls[0]
	notifications := batchCreateCall.Arguments.Get(1).([]*models.Notification)
	assert.Len(t, notifications, 2, "expected one notification per user")

	// Verify metadata has current price values
	var meta map[string]interface{}
	err = json.Unmarshal([]byte(notifications[0].Metadata), &meta)
	assert.NoError(t, err)
	assert.Contains(t, meta, "title")
	assert.Contains(t, meta, "body")

	// Verify baselines were NOT updated (force check should not affect baselines)
	baselineKey := fmt.Sprintf("price_alert:baseline:%s", "SJL1L10")
	val, _ := mr.Get(baselineKey)
	assert.Equal(t, fmt.Sprintf("%d", baselinePrice), val, "baseline should not be updated by force check")
}

// TestPriceAlertService_ForceCheck_RateLimit verifies that calling
// ForceCheckAndAlert twice in rapid succession returns an error on the second call.
func TestPriceAlertService_ForceCheck_RateLimit(t *testing.T) {
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	setBaseline(mr, "SJL1L10", 8_500_000_000)

	goldPrices := []*AssetPriceDTO{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: 8_600_000_000, Sell: 8_700_000_000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
	}
	silverPrices := []*AssetPriceDTO{}

	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(goldPrices, nil)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)
	userRepo.On("GetAllUserIDs", ctx).Return([]int32{1}, nil)
	notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil)
	pushSvc.On("SendToAll", ctx, mock.AnythingOfType("string"), mock.AnythingOfType("string"), "/dashboard/home").Return(nil)

	// First call should succeed
	err := svc.ForceCheckAndAlert(ctx)
	assert.NoError(t, err)

	// Second immediate call should be rate-limited
	err = svc.ForceCheckAndAlert(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "please wait")
}

// TestPriceAlertService_ForceCheck_NoBaseline_StillSendsAlert verifies that
// ForceCheckAndAlert sends alerts even when there is no baseline (first run),
// unlike normal CheckAndAlert which only stores baselines on first run.
func TestPriceAlertService_ForceCheck_NoBaseline_StillSendsAlert(t *testing.T) {
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, _ := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// NO baseline set — first run scenario
	goldPrices := []*AssetPriceDTO{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: 8500000000, Sell: 8600000000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
	}
	silverPrices := []*AssetPriceDTO{}

	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(goldPrices, nil)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)
	userRepo.On("GetAllUserIDs", ctx).Return([]int32{1}, nil)
	notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil)
	pushSvc.On("SendToAll", ctx, mock.AnythingOfType("string"), mock.AnythingOfType("string"), "/dashboard/home").Return(nil)

	// Force check must send even with no baselines
	err := svc.ForceCheckAndAlert(ctx)

	assert.NoError(t, err)
	// Must have created notifications — unlike normal CheckAndAlert first run
	notifRepo.AssertExpectations(t)
	pushSvc.AssertExpectations(t)
	userRepo.AssertExpectations(t)

	// Verify metadata
	batchCreateCall := notifRepo.Calls[0]
	notifications := batchCreateCall.Arguments.Get(1).([]*models.Notification)
	assert.Len(t, notifications, 1)

	var meta map[string]interface{}
	err = json.Unmarshal([]byte(notifications[0].Metadata), &meta)
	assert.NoError(t, err)
	// changePct should be 0 since no baseline existed
	movers, ok := meta["movers"].([]interface{})
	assert.True(t, ok)
	assert.Len(t, movers, 1)
	mover := movers[0].(map[string]interface{})
	assert.Equal(t, float64(0), mover["changePct"])
}

// TestPriceAlertService_ForceCheck_SilverUSD_IncludedInAlert verifies that
// when GetPricesByAssetType returns a USD-denominated silver price (XAGUSD),
// ForceCheckAndAlert creates a silver_usd category alert.
func TestPriceAlertService_ForceCheck_SilverUSD_IncludedInAlert(t *testing.T) {
	t.Setenv("PRICE_ALERT_SILVER_USD_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, _ := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Gold: empty (we only care about silver_usd here)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return([]*AssetPriceDTO{}, nil)

	// Silver: include both VND and USD prices
	silverPrices := []*AssetPriceDTO{
		{TypeCode: "PHU_QUY_THOI_1L", Name: "Phú Quý thỏi 1L", Buy: 1_500_000, Sell: 1_520_000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
		{TypeCode: "XAGUSD", Name: "Silver World (XAG/USD)", Buy: 3200, Sell: 3200, Currency: "USD", IsStale: false, FetchedAt: time.Now()},
	}
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)
	userRepo.On("GetAllUserIDs", ctx).Return([]int32{1}, nil)
	notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil)
	pushSvc.On("SendToAll", ctx, mock.AnythingOfType("string"), mock.AnythingOfType("string"), "/dashboard/home").Return(nil)

	err := svc.ForceCheckAndAlert(ctx)
	assert.NoError(t, err)

	// Must have created notifications — at minimum for silver_usd and silver_vnd
	notifRepo.AssertCalled(t, "BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification"))

	// Find the silver_usd notification by checking metadata category
	found := false
	for _, call := range notifRepo.Calls {
		if call.Method == "BatchCreate" {
			notifications := call.Arguments.Get(1).([]*models.Notification)
			for _, n := range notifications {
				var meta map[string]interface{}
				_ = json.Unmarshal([]byte(n.Metadata), &meta)
				if meta["category"] == "silver_usd" {
					found = true
					movers, ok := meta["movers"].([]interface{})
					assert.True(t, ok)
					assert.GreaterOrEqual(t, len(movers), 1)
					mover := movers[0].(map[string]interface{})
					assert.Equal(t, "XAGUSD", mover["typeCode"])
				}
			}
		}
	}
	assert.True(t, found, "expected a silver_usd category notification with XAGUSD mover")
}

// ---------------------------------------------------------------------------
// New tests: Stale price handling (security requirement)
// ---------------------------------------------------------------------------

// TestPriceAlertService_StaleGoldPrices_NoAlert verifies that when all gold
// prices are stale (IsStale == true), no alert is triggered even if the price
// moved significantly. Stale prices must never trigger phantom alerts.
func TestPriceAlertService_StaleGoldPrices_NoAlert(t *testing.T) {
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Set baseline and a large price change — but price is stale
	baselinePrice := int64(8_500_000_000)
	newPrice := int64(8_755_000_000) // ~3% change — would trigger if non-stale
	setBaseline(mr, "SJL1L10", baselinePrice)

	goldPrices := []*AssetPriceDTO{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: newPrice, Sell: newPrice + 100_000_000, Currency: "VND", IsStale: true, FetchedAt: time.Now()},
	}
	silverPrices := []*AssetPriceDTO{}

	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(goldPrices, nil)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)

	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	assetPriceSvc.AssertExpectations(t)
	// Stale prices must NEVER trigger notifications
	notifRepo.AssertNotCalled(t, "BatchCreate", mock.Anything, mock.Anything)
	pushSvc.AssertNotCalled(t, "SendToAll", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	userRepo.AssertNotCalled(t, "GetAllUserIDs", mock.Anything)
}

// TestPriceAlertService_PartialStale_NonStaleFiresAlert verifies that when
// some gold prices are stale and some are not, only non-stale prices produce
// movers. The non-stale silver price should still trigger an alert while
// the stale gold price is silently skipped.
func TestPriceAlertService_PartialStale_NonStaleFiresAlert(t *testing.T) {
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_SILVER_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Gold: stale — significant price change should be ignored
	goldBaseline := int64(8_500_000_000)
	goldNewPrice := int64(8_755_000_000) // ~3% change — stale, must be ignored
	setBaseline(mr, "SJL1L10", goldBaseline)

	// Silver: non-stale — significant price change should trigger
	silverBaseline := int64(1_500_000)
	silverNewPrice := int64(1_545_000) // 3% change — non-stale, must trigger
	setBaseline(mr, "AGV", silverBaseline)

	goldPrices := []*AssetPriceDTO{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: goldNewPrice, Sell: goldNewPrice + 100_000_000, Currency: "VND", IsStale: true, FetchedAt: time.Now()},
	}
	silverPrices := []*AssetPriceDTO{
		{TypeCode: "AGV", Name: "Silver VND", Buy: silverNewPrice, Sell: silverNewPrice + 10_000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
	}

	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(goldPrices, nil)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)
	userRepo.On("GetAllUserIDs", ctx).Return([]int32{1, 2}, nil)
	notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil)
	pushSvc.On("SendToAll", ctx, mock.AnythingOfType("string"), mock.AnythingOfType("string"), "/dashboard/home").Return(nil)

	err := svc.CheckAndAlert(ctx)

	assert.NoError(t, err)
	assetPriceSvc.AssertExpectations(t)
	// Silver alert must have fired (non-stale)
	notifRepo.AssertExpectations(t)
	pushSvc.AssertExpectations(t)
	userRepo.AssertExpectations(t)

	// Verify the notification is for silver_vnd (not gold_vnd)
	batchCreateCall := notifRepo.Calls[0]
	notifications := batchCreateCall.Arguments.Get(1).([]*models.Notification)
	assert.NotEmpty(t, notifications)
	var meta map[string]interface{}
	err = json.Unmarshal([]byte(notifications[0].Metadata), &meta)
	assert.NoError(t, err)
	assert.Equal(t, "silver_vnd", meta["category"], "alert must be for silver_vnd, not stale gold_vnd")
}

// TestPriceAlertService_ForceCheck_StaleSkipped verifies that ForceCheckAndAlert
// also skips stale prices — force mode does not bypass the stale check.
func TestPriceAlertService_ForceCheck_StaleSkipped(t *testing.T) {
	t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
	t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

	assetPriceSvc := new(mockPAAssetPriceSvc)
	notifRepo := new(mockPANotifRepo)
	userRepo := new(mockPAUserRepo)
	pushSvc := new(mockPAPushSvc)

	svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc)
	ctx := context.Background()

	// Set a baseline — force check would normally fire but price is stale
	setBaseline(mr, "SJL1L10", 8_500_000_000)

	// All gold prices are stale
	goldPrices := []*AssetPriceDTO{
		{TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: 8_600_000_000, Sell: 8_700_000_000, Currency: "VND", IsStale: true, FetchedAt: time.Now()},
	}
	silverPrices := []*AssetPriceDTO{}

	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(goldPrices, nil)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)

	err := svc.ForceCheckAndAlert(ctx)

	assert.NoError(t, err)
	assetPriceSvc.AssertExpectations(t)
	// Force mode must also skip stale prices — no phantom alerts
	notifRepo.AssertNotCalled(t, "BatchCreate", mock.Anything, mock.Anything)
	pushSvc.AssertNotCalled(t, "SendToAll", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	userRepo.AssertNotCalled(t, "GetAllUserIDs", mock.Anything)
}
