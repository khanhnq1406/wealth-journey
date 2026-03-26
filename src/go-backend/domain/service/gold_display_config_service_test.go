package service

import (
	"context"
	"testing"
	"time"

	"wealthjourney/domain/models"
	apperrors "wealthjourney/pkg/errors"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// --- Mock: GoldDisplayConfigRepository ---

type mockGoldDisplayConfigRepo struct {
	mock.Mock
}

func (m *mockGoldDisplayConfigRepo) ListAll(ctx context.Context) ([]*models.GoldDisplayConfig, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.GoldDisplayConfig), args.Error(1)
}

func (m *mockGoldDisplayConfigRepo) ListEnabled(ctx context.Context) ([]*models.GoldDisplayConfig, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.GoldDisplayConfig), args.Error(1)
}

func (m *mockGoldDisplayConfigRepo) GetByID(ctx context.Context, id int32) (*models.GoldDisplayConfig, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.GoldDisplayConfig), args.Error(1)
}

func (m *mockGoldDisplayConfigRepo) GetByTypeCode(ctx context.Context, typeCode string) (*models.GoldDisplayConfig, error) {
	args := m.Called(ctx, typeCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.GoldDisplayConfig), args.Error(1)
}

func (m *mockGoldDisplayConfigRepo) Create(ctx context.Context, config *models.GoldDisplayConfig) error {
	args := m.Called(ctx, config)
	if args.Error(0) == nil {
		config.ID = 1
		config.CreatedAt = time.Now()
		config.UpdatedAt = time.Now()
	}
	return args.Error(0)
}

func (m *mockGoldDisplayConfigRepo) Update(ctx context.Context, config *models.GoldDisplayConfig) error {
	args := m.Called(ctx, config)
	return args.Error(0)
}

func (m *mockGoldDisplayConfigRepo) Delete(ctx context.Context, id int32) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// --- Mock: AssetPriceService (display-config scope) ---

type mockDisplayAssetPriceSvc struct {
	mock.Mock
}

func (m *mockDisplayAssetPriceSvc) RefreshAllPrices(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *mockDisplayAssetPriceSvc) GetAllPrices(ctx context.Context) (*AllAssetPrices, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*AllAssetPrices), args.Error(1)
}

func (m *mockDisplayAssetPriceSvc) GetPricesByAssetType(ctx context.Context, assetType string) ([]*AssetPriceDTO, error) {
	args := m.Called(ctx, assetType)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*AssetPriceDTO), args.Error(1)
}

func (m *mockDisplayAssetPriceSvc) GetMarketTypes(ctx context.Context) (*MarketTypesDTO, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*MarketTypesDTO), args.Error(1)
}

func (m *mockDisplayAssetPriceSvc) GetPriceByTypeCode(ctx context.Context, typeCode string) (*AssetPriceDTO, error) {
	args := m.Called(ctx, typeCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*AssetPriceDTO), args.Error(1)
}

// --- Helper: newTestGoldDisplayConfigService ---

func newTestGoldDisplayConfigService(
	repo *mockGoldDisplayConfigRepo,
	assetPriceSvc AssetPriceService,
) GoldDisplayConfigService {
	if assetPriceSvc == nil {
		assetPriceSvc = &mockDisplayAssetPriceSvc{}
	}
	return NewGoldDisplayConfigService(repo, assetPriceSvc)
}

// --- Tests: Create validation ---

func TestGoldDisplayConfigService_Create_EmptyTypeCode(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	svc := newTestGoldDisplayConfigService(repo, nil)
	ctx := context.Background()

	_, err := svc.Create(ctx, "", "SJC 1-10 Luong", 0, true, true)

	assert.Error(t, err)
	var valErr apperrors.ValidationError
	assert.ErrorAs(t, err, &valErr)
}

func TestGoldDisplayConfigService_Create_TypeCodeTooLong(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	svc := newTestGoldDisplayConfigService(repo, nil)
	ctx := context.Background()

	longCode := "ABCDEFGHIJKLMNOPQRSTUVWXYZ_ABCDEFGHIJKLMNOPQRSTUVWXYZ" // 53 chars > 50

	_, err := svc.Create(ctx, longCode, "Some Name", 0, true, true)

	assert.Error(t, err)
	var valErr apperrors.ValidationError
	assert.ErrorAs(t, err, &valErr)
}

func TestGoldDisplayConfigService_Create_EmptyDisplayName(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	svc := newTestGoldDisplayConfigService(repo, nil)
	ctx := context.Background()

	// Whitespace-only display name — should fail after trim
	_, err := svc.Create(ctx, "SJL1L10", "   ", 0, true, true)

	assert.Error(t, err)
	var valErr apperrors.ValidationError
	assert.ErrorAs(t, err, &valErr)
}

func TestGoldDisplayConfigService_Create_DisplayNameTooLong(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	svc := newTestGoldDisplayConfigService(repo, nil)
	ctx := context.Background()

	longName := "ABCDEFGHIJKLMNOPQRSTUVWXYZ_ABCDEFGHIJKLMNOPQRSTUVWXYZ_ABCDEFGHIJKLMNOPQRSTUVWXYZ_ABCDEFGHIJKLMNOPQRSTUVWXYZ" // >100 chars

	_, err := svc.Create(ctx, "SJL1L10", longName, 0, true, true)

	assert.Error(t, err)
	var valErr apperrors.ValidationError
	assert.ErrorAs(t, err, &valErr)
}

func TestGoldDisplayConfigService_Create_NegativeDisplayOrder(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	svc := newTestGoldDisplayConfigService(repo, nil)
	ctx := context.Background()

	_, err := svc.Create(ctx, "SJL1L10", "SJC 1-10 Luong", -1, true, true)

	assert.Error(t, err)
	var valErr apperrors.ValidationError
	assert.ErrorAs(t, err, &valErr)
}

func TestGoldDisplayConfigService_Create_DuplicateTypeCode(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	svc := newTestGoldDisplayConfigService(repo, nil)
	ctx := context.Background()

	existing := &models.GoldDisplayConfig{
		ID:          1,
		TypeCode:    "SJL1L10",
		DisplayName: "SJC 1-10 Luong",
	}
	repo.On("GetByTypeCode", ctx, "SJL1L10").Return(existing, nil)

	_, err := svc.Create(ctx, "SJL1L10", "SJC 1-10 Luong", 0, true, true)

	assert.Error(t, err)
	var conflictErr apperrors.ConflictError
	assert.ErrorAs(t, err, &conflictErr)
	repo.AssertExpectations(t)
}

func TestGoldDisplayConfigService_Create_Success(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	svc := newTestGoldDisplayConfigService(repo, nil)
	ctx := context.Background()

	repo.On("GetByTypeCode", ctx, "SJL1L10").Return(nil, nil)
	repo.On("Create", ctx, mock.AnythingOfType("*models.GoldDisplayConfig")).Return(nil)

	result, err := svc.Create(ctx, "SJL1L10", "SJC 1-10 Luong", 1, true, true)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, "SJL1L10", result.TypeCode)
	assert.Equal(t, "SJC 1-10 Luong", result.DisplayName)
	assert.Equal(t, int32(1), result.DisplayOrder)
	assert.True(t, result.Enabled)
	assert.True(t, result.ShowInInvestment)
	repo.AssertExpectations(t)
}

// --- Tests: Update ---

func TestGoldDisplayConfigService_Update_NotFound(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	svc := newTestGoldDisplayConfigService(repo, nil)
	ctx := context.Background()

	repo.On("GetByID", ctx, int32(99)).Return(nil, apperrors.NewNotFoundError("gold display config"))

	_, err := svc.Update(ctx, 99, "New Name", 0, true, true)

	assert.Error(t, err)
	var notFoundErr apperrors.NotFoundError
	assert.ErrorAs(t, err, &notFoundErr)
	repo.AssertExpectations(t)
}

func TestGoldDisplayConfigService_Update_Success(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	svc := newTestGoldDisplayConfigService(repo, nil)
	ctx := context.Background()

	existing := &models.GoldDisplayConfig{
		ID:               1,
		TypeCode:         "SJL1L10",
		DisplayName:      "Old Name",
		DisplayOrder:     0,
		Enabled:          false,
		ShowInInvestment: false,
	}
	repo.On("GetByID", ctx, int32(1)).Return(existing, nil)
	repo.On("Update", ctx, mock.AnythingOfType("*models.GoldDisplayConfig")).Return(nil)

	result, err := svc.Update(ctx, 1, "New Name", 5, true, true)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, "New Name", result.DisplayName)
	assert.Equal(t, int32(5), result.DisplayOrder)
	assert.True(t, result.Enabled)
	assert.True(t, result.ShowInInvestment)
	repo.AssertExpectations(t)
}

func TestGoldDisplayConfigService_Update_EmptyDisplayName(t *testing.T) {
	svc := newTestGoldDisplayConfigService(new(mockGoldDisplayConfigRepo), nil)
	_, err := svc.Update(context.Background(), 1, "   ", 0, true, true)
	assert.Error(t, err)
	var valErr apperrors.ValidationError
	assert.ErrorAs(t, err, &valErr)
}

func TestGoldDisplayConfigService_Update_DisplayNameTooLong(t *testing.T) {
	svc := newTestGoldDisplayConfigService(new(mockGoldDisplayConfigRepo), nil)
	long := make([]byte, 101)
	for i := range long {
		long[i] = 'a'
	}
	_, err := svc.Update(context.Background(), 1, string(long), 0, true, true)
	assert.Error(t, err)
	var valErr apperrors.ValidationError
	assert.ErrorAs(t, err, &valErr)
}

func TestGoldDisplayConfigService_Update_NegativeDisplayOrder(t *testing.T) {
	svc := newTestGoldDisplayConfigService(new(mockGoldDisplayConfigRepo), nil)
	_, err := svc.Update(context.Background(), 1, "Valid Name", -1, true, true)
	assert.Error(t, err)
	var valErr apperrors.ValidationError
	assert.ErrorAs(t, err, &valErr)
}

// --- Tests: Delete ---

func TestGoldDisplayConfigService_Delete_DelegatesToRepository(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	svc := newTestGoldDisplayConfigService(repo, nil)
	ctx := context.Background()

	repo.On("Delete", ctx, int32(1)).Return(nil)

	err := svc.Delete(ctx, 1)

	assert.NoError(t, err)
	repo.AssertExpectations(t)
}

// --- Tests: ListAll ---

func TestGoldDisplayConfigService_ListAll_DelegatesToRepository(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	svc := newTestGoldDisplayConfigService(repo, nil)
	ctx := context.Background()

	configs := []*models.GoldDisplayConfig{
		{ID: 1, TypeCode: "SJL1L10", DisplayName: "SJC 1-10 Luong"},
		{ID: 2, TypeCode: "DOJI_1L", DisplayName: "DOJI 1 Luong"},
	}
	repo.On("ListAll", ctx).Return(configs, nil)

	result, err := svc.ListAll(ctx)

	assert.NoError(t, err)
	assert.Len(t, result, 2)
	repo.AssertExpectations(t)
}

// --- Tests: GetDisplayPrices ---

func TestGoldDisplayConfigService_GetDisplayPrices_JoinsWithPrices(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	assetPriceSvc := new(mockDisplayAssetPriceSvc)
	svc := newTestGoldDisplayConfigService(repo, assetPriceSvc)
	ctx := context.Background()

	configs := []*models.GoldDisplayConfig{
		{
			ID:               1,
			TypeCode:         "SJL1L10",
			DisplayName:      "SJC 1-10 Luong",
			DisplayOrder:     0,
			Enabled:          true,
			ShowInInvestment: true,
		},
		{
			ID:               2,
			TypeCode:         "DOJI_1L",
			DisplayName:      "DOJI 1 Luong",
			DisplayOrder:     1,
			Enabled:          true,
			ShowInInvestment: false,
		},
	}
	repo.On("ListEnabled", ctx).Return(configs, nil)

	fetchedAt := time.Now()
	prices := []*AssetPriceDTO{
		{
			TypeCode:   "SJL1L10",
			Name:       "SJC 1-10 Luong",
			Buy:        9200000000,
			Sell:       9300000000,
			ChangeBuy:  50000000,
			ChangeSell: 50000000,
			Currency:   "VND",
			IsStale:    false,
			FetchedAt:  fetchedAt,
		},
		// DOJI_1L has no matching price (simulates missing price)
	}
	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(prices, nil)

	result, err := svc.GetDisplayPrices(ctx)

	assert.NoError(t, err)
	assert.Len(t, result, 2)

	// First item (SJL1L10) should have price data
	assert.Equal(t, "SJL1L10", result[0].TypeCode)
	assert.Equal(t, int64(9200000000), result[0].Buy)
	assert.Equal(t, int64(9300000000), result[0].Sell)
	assert.False(t, result[0].IsStale)
	assert.True(t, result[0].ShowInInvestment)

	// Second item (DOJI_1L) should have zero prices and IsStale=true
	assert.Equal(t, "DOJI_1L", result[1].TypeCode)
	assert.Equal(t, int64(0), result[1].Buy)
	assert.Equal(t, int64(0), result[1].Sell)
	assert.True(t, result[1].IsStale)
	assert.False(t, result[1].ShowInInvestment)

	repo.AssertExpectations(t)
	assetPriceSvc.AssertExpectations(t)
}

func TestGoldDisplayConfigService_GetDisplayPrices_AllStaleOnPriceError(t *testing.T) {
	repo := new(mockGoldDisplayConfigRepo)
	assetPriceSvc := new(mockDisplayAssetPriceSvc)
	svc := newTestGoldDisplayConfigService(repo, assetPriceSvc)
	ctx := context.Background()

	configs := []*models.GoldDisplayConfig{
		{
			ID:           1,
			TypeCode:     "SJL1L10",
			DisplayName:  "SJC 1-10 Luong",
			DisplayOrder: 0,
			Enabled:      true,
		},
	}
	repo.On("ListEnabled", ctx).Return(configs, nil)
	assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(nil, nil)

	result, err := svc.GetDisplayPrices(ctx)

	assert.NoError(t, err)
	assert.Len(t, result, 1)
	assert.Equal(t, int64(0), result[0].Buy)
	assert.Equal(t, int64(0), result[0].Sell)
	assert.True(t, result[0].IsStale)

	repo.AssertExpectations(t)
	assetPriceSvc.AssertExpectations(t)
}
