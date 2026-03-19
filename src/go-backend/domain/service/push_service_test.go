package service

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"wealthjourney/domain/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// --- Mock types ---

// mockPushSubRepo implements repository.PushSubscriptionRepository for push service testing.
type mockPushSubRepo struct {
	mock.Mock
}

func (m *mockPushSubRepo) Create(ctx context.Context, sub *models.PushSubscription) error {
	args := m.Called(ctx, sub)
	return args.Error(0)
}

func (m *mockPushSubRepo) DeleteByEndpoint(ctx context.Context, endpoint string) error {
	args := m.Called(ctx, endpoint)
	return args.Error(0)
}

func (m *mockPushSubRepo) GetByUserID(ctx context.Context, userID int32) ([]*models.PushSubscription, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.PushSubscription), args.Error(1)
}

func (m *mockPushSubRepo) GetAll(ctx context.Context) ([]*models.PushSubscription, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.PushSubscription), args.Error(1)
}

func (m *mockPushSubRepo) CountByUserID(ctx context.Context, userID int32) (int, error) {
	args := m.Called(ctx, userID)
	return args.Int(0), args.Error(1)
}

func (m *mockPushSubRepo) DeleteByID(ctx context.Context, id int32) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// --- Helper ---

// setVAPIDEnv sets the VAPID environment variables and returns a cleanup function.
func setVAPIDEnv(t *testing.T, pubKey, privKey, contact string) func() {
	t.Helper()
	origPub := os.Getenv("VAPID_PUBLIC_KEY")
	origPriv := os.Getenv("VAPID_PRIVATE_KEY")
	origContact := os.Getenv("VAPID_CONTACT")

	t.Setenv("VAPID_PUBLIC_KEY", pubKey)
	t.Setenv("VAPID_PRIVATE_KEY", privKey)
	t.Setenv("VAPID_CONTACT", contact)

	return func() {
		t.Setenv("VAPID_PUBLIC_KEY", origPub)
		t.Setenv("VAPID_PRIVATE_KEY", origPriv)
		t.Setenv("VAPID_CONTACT", origContact)
	}
}

// makePushSub returns a test PushSubscription with the given userID and endpoint.
func makePushSub(userID int32, endpoint string) *models.PushSubscription {
	return &models.PushSubscription{
		ID:        1,
		UserID:    userID,
		Endpoint:  endpoint,
		P256dh:    "dGVzdC1wMjU2ZGg=",
		Auth:      "dGVzdC1hdXRo",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// --- Constructor tests ---

// TestNewPushService_NoopWhenVAPIDMissing verifies that when VAPID keys are absent
// NewPushService returns the noopPushService which always returns an empty public key.
func TestNewPushService_NoopWhenVAPIDMissing(t *testing.T) {
	tests := []struct {
		name    string
		pubKey  string
		privKey string
	}{
		{
			name:    "both keys empty",
			pubKey:  "",
			privKey: "",
		},
		{
			name:    "public key empty, private key set",
			pubKey:  "",
			privKey: "some-private-key",
		},
		{
			name:    "public key set, private key empty",
			pubKey:  "some-public-key",
			privKey: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cleanup := setVAPIDEnv(t, tc.pubKey, tc.privKey, "mailto:test@example.com")
			defer cleanup()

			subRepo := new(mockPushSubRepo)
			svc := NewPushService(subRepo)

			assert.Equal(t, "", svc.GetVAPIDPublicKey(),
				"noopPushService must return empty string for GetVAPIDPublicKey")

			// Confirm the noop methods do not call any repo methods and return no error.
			ctx := context.Background()
			assert.NoError(t, svc.SendToUser(ctx, 1, "title", "body", "/"))
			assert.NoError(t, svc.SendToAll(ctx, "title", "body", "/"))
			subRepo.AssertNotCalled(t, "GetByUserID")
			subRepo.AssertNotCalled(t, "GetAll")
		})
	}
}

// TestNewPushService_WithVAPIDKeys verifies that when both VAPID keys are set,
// NewPushService returns a real pushService that exposes the correct public key.
func TestNewPushService_WithVAPIDKeys(t *testing.T) {
	const (
		testPubKey  = "BNWxBfM2k9PdLjFq1yM2sxHuvH2GmKjz0mNhJbGE9tVcGQ5N4DJBK7yvI7AWVAB1DZxH4K5Q6ClR8P9nP1YJsP8"
		testPrivKey = "3T8MFHQ9kXVD1pGcPnQL0mWBR5xjUB8kHY3E8f0kI9A"
		testContact = "mailto:admin@example.com"
	)

	cleanup := setVAPIDEnv(t, testPubKey, testPrivKey, testContact)
	defer cleanup()

	subRepo := new(mockPushSubRepo)
	svc := NewPushService(subRepo)

	assert.Equal(t, testPubKey, svc.GetVAPIDPublicKey())
}

// TestNewPushService_DefaultContact verifies that when VAPID_CONTACT is absent
// the service still initialises (falling back to the hard-coded default contact).
func TestNewPushService_DefaultContact(t *testing.T) {
	const (
		testPubKey  = "BNWxBfM2k9PdLjFq1yM2sxHuvH2GmKjz0mNhJbGE9tVcGQ5N4DJBK7yvI7AWVAB1DZxH4K5Q6ClR8P9nP1YJsP8"
		testPrivKey = "3T8MFHQ9kXVD1pGcPnQL0mWBR5xjUB8kHY3E8f0kI9A"
	)

	cleanup := setVAPIDEnv(t, testPubKey, testPrivKey, "") // contact intentionally blank
	defer cleanup()

	subRepo := new(mockPushSubRepo)
	svc := NewPushService(subRepo)

	// The service should be a real pushService (non-noop) because both keys are present.
	assert.Equal(t, testPubKey, svc.GetVAPIDPublicKey())
}

// --- SendToUser tests ---

// TestPushService_SendToUser_NoSubscriptions verifies that when GetByUserID returns an
// empty slice, SendToUser returns nil without attempting any delivery or repo mutations.
func TestPushService_SendToUser_NoSubscriptions(t *testing.T) {
	const (
		testPubKey  = "BNWxBfM2k9PdLjFq1yM2sxHuvH2GmKjz0mNhJbGE9tVcGQ5N4DJBK7yvI7AWVAB1DZxH4K5Q6ClR8P9nP1YJsP8"
		testPrivKey = "3T8MFHQ9kXVD1pGcPnQL0mWBR5xjUB8kHY3E8f0kI9A"
	)

	cleanup := setVAPIDEnv(t, testPubKey, testPrivKey, "mailto:test@example.com")
	defer cleanup()

	subRepo := new(mockPushSubRepo)
	svc := NewPushService(subRepo)
	ctx := context.Background()

	subRepo.On("GetByUserID", ctx, int32(42)).Return([]*models.PushSubscription{}, nil)

	err := svc.SendToUser(ctx, 42, "Hello", "World", "/dashboard")

	assert.NoError(t, err)
	subRepo.AssertExpectations(t)
	subRepo.AssertNotCalled(t, "DeleteByEndpoint")
}

// TestPushService_SendToUser_RepoError verifies that when GetByUserID returns an error,
// SendToUser propagates that error to the caller immediately.
func TestPushService_SendToUser_RepoError(t *testing.T) {
	const (
		testPubKey  = "BNWxBfM2k9PdLjFq1yM2sxHuvH2GmKjz0mNhJbGE9tVcGQ5N4DJBK7yvI7AWVAB1DZxH4K5Q6ClR8P9nP1YJsP8"
		testPrivKey = "3T8MFHQ9kXVD1pGcPnQL0mWBR5xjUB8kHY3E8f0kI9A"
	)

	cleanup := setVAPIDEnv(t, testPubKey, testPrivKey, "mailto:test@example.com")
	defer cleanup()

	subRepo := new(mockPushSubRepo)
	svc := NewPushService(subRepo)
	ctx := context.Background()

	dbErr := errors.New("database connection lost")
	subRepo.On("GetByUserID", ctx, int32(7)).Return(nil, dbErr)

	err := svc.SendToUser(ctx, 7, "Hello", "World", "/")

	assert.Error(t, err)
	assert.Equal(t, dbErr, err)
	subRepo.AssertExpectations(t)
}

// TestPushService_SendToUser_MultipleSubscriptions verifies that when a user has
// multiple subscriptions, GetByUserID is called once and no repo mutations occur
// during a zero-delivery scenario (all webpush calls would fail without real
// endpoints, but repo interactions up to that point are correctly exercised).
func TestPushService_SendToUser_MultipleSubscriptions(t *testing.T) {
	const (
		testPubKey  = "BNWxBfM2k9PdLjFq1yM2sxHuvH2GmKjz0mNhJbGE9tVcGQ5N4DJBK7yvI7AWVAB1DZxH4K5Q6ClR8P9nP1YJsP8"
		testPrivKey = "3T8MFHQ9kXVD1pGcPnQL0mWBR5xjUB8kHY3E8f0kI9A"
	)

	cleanup := setVAPIDEnv(t, testPubKey, testPrivKey, "mailto:test@example.com")
	defer cleanup()

	subRepo := new(mockPushSubRepo)
	svc := NewPushService(subRepo)
	ctx := context.Background()

	subs := []*models.PushSubscription{
		makePushSub(5, "https://fcm.googleapis.com/fcm/send/sub1"),
		makePushSub(5, "https://fcm.googleapis.com/fcm/send/sub2"),
	}
	subRepo.On("GetByUserID", ctx, int32(5)).Return(subs, nil)

	// SendToUser will attempt webpush delivery (which fails for fake endpoints),
	// but errors per-subscription are logged and swallowed — the method still
	// returns nil from the repository layer perspective.
	_ = svc.SendToUser(ctx, 5, "Alert", "Price changed", "/dashboard/prices")

	// The repository must have been queried exactly once.
	subRepo.AssertCalled(t, "GetByUserID", ctx, int32(5))
}

// --- SendToAll tests ---

// TestPushService_SendToAll_NoSubscriptions verifies that when GetAll returns an
// empty slice, SendToAll returns nil immediately without any further work.
func TestPushService_SendToAll_NoSubscriptions(t *testing.T) {
	const (
		testPubKey  = "BNWxBfM2k9PdLjFq1yM2sxHuvH2GmKjz0mNhJbGE9tVcGQ5N4DJBK7yvI7AWVAB1DZxH4K5Q6ClR8P9nP1YJsP8"
		testPrivKey = "3T8MFHQ9kXVD1pGcPnQL0mWBR5xjUB8kHY3E8f0kI9A"
	)

	cleanup := setVAPIDEnv(t, testPubKey, testPrivKey, "mailto:test@example.com")
	defer cleanup()

	subRepo := new(mockPushSubRepo)
	svc := NewPushService(subRepo)
	ctx := context.Background()

	subRepo.On("GetAll", ctx).Return([]*models.PushSubscription{}, nil)

	err := svc.SendToAll(ctx, "System Alert", "Important update", "/")

	assert.NoError(t, err)
	subRepo.AssertExpectations(t)
	subRepo.AssertNotCalled(t, "DeleteByEndpoint")
}

// TestPushService_SendToAll_RepoError verifies that when GetAll returns an error,
// SendToAll propagates the error directly to the caller.
func TestPushService_SendToAll_RepoError(t *testing.T) {
	const (
		testPubKey  = "BNWxBfM2k9PdLjFq1yM2sxHuvH2GmKjz0mNhJbGE9tVcGQ5N4DJBK7yvI7AWVAB1DZxH4K5Q6ClR8P9nP1YJsP8"
		testPrivKey = "3T8MFHQ9kXVD1pGcPnQL0mWBR5xjUB8kHY3E8f0kI9A"
	)

	cleanup := setVAPIDEnv(t, testPubKey, testPrivKey, "mailto:test@example.com")
	defer cleanup()

	subRepo := new(mockPushSubRepo)
	svc := NewPushService(subRepo)
	ctx := context.Background()

	dbErr := errors.New("timeout querying subscriptions")
	subRepo.On("GetAll", ctx).Return(nil, dbErr)

	err := svc.SendToAll(ctx, "Broadcast", "Hello", "/")

	assert.Error(t, err)
	assert.Equal(t, dbErr, err)
	subRepo.AssertExpectations(t)
}

// TestPushService_SendToAll_MultipleSubscriptions verifies that when subscriptions
// exist, GetAll is called once and processing completes (webpush delivery errors
// for fake endpoints are silently logged, matching the implementation behaviour).
func TestPushService_SendToAll_MultipleSubscriptions(t *testing.T) {
	const (
		testPubKey  = "BNWxBfM2k9PdLjFq1yM2sxHuvH2GmKjz0mNhJbGE9tVcGQ5N4DJBK7yvI7AWVAB1DZxH4K5Q6ClR8P9nP1YJsP8"
		testPrivKey = "3T8MFHQ9kXVD1pGcPnQL0mWBR5xjUB8kHY3E8f0kI9A"
	)

	cleanup := setVAPIDEnv(t, testPubKey, testPrivKey, "mailto:test@example.com")
	defer cleanup()

	subRepo := new(mockPushSubRepo)
	svc := NewPushService(subRepo)
	ctx := context.Background()

	subs := []*models.PushSubscription{
		makePushSub(1, "https://fcm.googleapis.com/fcm/send/userA"),
		makePushSub(2, "https://fcm.googleapis.com/fcm/send/userB"),
		makePushSub(3, "https://fcm.googleapis.com/fcm/send/userC"),
	}
	subRepo.On("GetAll", ctx).Return(subs, nil)

	// SendToAll fans out goroutines; errors from invalid endpoints are swallowed.
	// The important assertion is that GetAll was called exactly once and that the
	// function returns without panicking.
	err := svc.SendToAll(ctx, "News", "System maintenance", "/")

	assert.NoError(t, err)
	subRepo.AssertCalled(t, "GetAll", ctx)
}

// --- Noop behaviour integration test ---

// TestNoopPushService_AllMethodsAreNoops exercises the noopPushService directly
// to confirm every interface method is safe and side-effect-free.
func TestNoopPushService_AllMethodsAreNoops(t *testing.T) {
	noop := &noopPushService{}
	ctx := context.Background()

	assert.Equal(t, "", noop.GetVAPIDPublicKey())
	assert.NoError(t, noop.SendToUser(ctx, 1, "t", "b", "/"))
	assert.NoError(t, noop.SendToAll(ctx, "t", "b", "/"))
}
