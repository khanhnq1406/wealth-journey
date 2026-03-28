package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
)

// ---------------------------------------------------------------------------
// Mock implementations — prefixed with "adc" to avoid conflicts with other test files.
// ---------------------------------------------------------------------------

// adcConfigRepo is a stub for repository.AssetDisplayConfigRepository.
type adcConfigRepo struct {
	listAllFn                   func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error)
	listEnabledFn               func(ctx context.Context) ([]*models.AssetDisplayConfig, error)
	getByIDFn                   func(ctx context.Context, id int32) (*models.AssetDisplayConfig, error)
	getByTypeCodeFn             func(ctx context.Context, typeCode string) (*models.AssetDisplayConfig, error)
	createFn                    func(ctx context.Context, config *models.AssetDisplayConfig) error
	updateFn                    func(ctx context.Context, config *models.AssetDisplayConfig) error
	deleteFn                    func(ctx context.Context, id int32) error
	listByAssetTypeFn           func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error)
	getByTypeCodeAndAssetTypeFn           func(ctx context.Context, typeCode, assetType string) (*models.AssetDisplayConfig, error)
	listEnabledTypeCodesByAssetTypeFn func(ctx context.Context, assetType string) ([]string, error)
}

func (m *adcConfigRepo) ListAll(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
	if m.listAllFn != nil {
		return m.listAllFn(ctx, assetType)
	}
	return nil, nil
}
func (m *adcConfigRepo) ListEnabled(ctx context.Context) ([]*models.AssetDisplayConfig, error) {
	if m.listEnabledFn != nil {
		return m.listEnabledFn(ctx)
	}
	return nil, nil
}
func (m *adcConfigRepo) GetByID(ctx context.Context, id int32) (*models.AssetDisplayConfig, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, nil
}
func (m *adcConfigRepo) GetByTypeCode(ctx context.Context, typeCode string) (*models.AssetDisplayConfig, error) {
	if m.getByTypeCodeFn != nil {
		return m.getByTypeCodeFn(ctx, typeCode)
	}
	return nil, nil
}
func (m *adcConfigRepo) Create(ctx context.Context, config *models.AssetDisplayConfig) error {
	if m.createFn != nil {
		return m.createFn(ctx, config)
	}
	return nil
}
func (m *adcConfigRepo) Update(ctx context.Context, config *models.AssetDisplayConfig) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, config)
	}
	return nil
}
func (m *adcConfigRepo) Delete(ctx context.Context, id int32) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return nil
}
func (m *adcConfigRepo) ListByAssetType(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
	if m.listByAssetTypeFn != nil {
		return m.listByAssetTypeFn(ctx, assetType)
	}
	return nil, nil
}
func (m *adcConfigRepo) GetByTypeCodeAndAssetType(ctx context.Context, typeCode, assetType string) (*models.AssetDisplayConfig, error) {
	if m.getByTypeCodeAndAssetTypeFn != nil {
		return m.getByTypeCodeAndAssetTypeFn(ctx, typeCode, assetType)
	}
	return nil, nil
}
func (m *adcConfigRepo) ListEnabledTypeCodesByAssetType(ctx context.Context, assetType string) ([]string, error) {
	if m.listEnabledTypeCodesByAssetTypeFn != nil {
		return m.listEnabledTypeCodesByAssetTypeFn(ctx, assetType)
	}
	return nil, nil
}

// adcFetchCodeRepo is a stub for repository.AssetConfigFetchCodeRepository.
type adcFetchCodeRepo struct {
	listByConfigIDFn  func(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error)
	createFn          func(ctx context.Context, fc *models.AssetConfigFetchCode) error
	getByIDFn         func(ctx context.Context, id int32) (*models.AssetConfigFetchCode, error)
	updateFn          func(ctx context.Context, fc *models.AssetConfigFetchCode) error
	deleteFn          func(ctx context.Context, id int32) error
	countByConfigIDFn func(ctx context.Context, configID int32) (int64, error)
}

func (m *adcFetchCodeRepo) ListByConfigID(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
	if m.listByConfigIDFn != nil {
		return m.listByConfigIDFn(ctx, configID)
	}
	return nil, nil
}
func (m *adcFetchCodeRepo) Create(ctx context.Context, fc *models.AssetConfigFetchCode) error {
	if m.createFn != nil {
		return m.createFn(ctx, fc)
	}
	return nil
}
func (m *adcFetchCodeRepo) GetByID(ctx context.Context, id int32) (*models.AssetConfigFetchCode, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, id)
	}
	return nil, nil
}
func (m *adcFetchCodeRepo) Update(ctx context.Context, fc *models.AssetConfigFetchCode) error {
	if m.updateFn != nil {
		return m.updateFn(ctx, fc)
	}
	return nil
}
func (m *adcFetchCodeRepo) Delete(ctx context.Context, id int32) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return nil
}
func (m *adcFetchCodeRepo) CountByConfigID(ctx context.Context, configID int32) (int64, error) {
	if m.countByConfigIDFn != nil {
		return m.countByConfigIDFn(ctx, configID)
	}
	return 0, nil
}

// adcAssetPriceRepo is a stub for repository.AssetPriceRepository.
type adcAssetPriceRepo struct {
	listByAssetTypeFn               func(ctx context.Context, assetType string) ([]*models.AssetPrice, error)
	listAllFn                       func(ctx context.Context) ([]*models.AssetPrice, error)
	upsertBatchFn                   func(ctx context.Context, prices []*models.AssetPrice) error
	getByTypeCodeAndCurrencyFn      func(ctx context.Context, typeCode, currency string) (*models.AssetPrice, error)
	markStaleByAssetTypeFn          func(ctx context.Context, assetType string) error
	markStaleByAssetTypeAndSourceFn func(ctx context.Context, assetType, source string) error
}

func (m *adcAssetPriceRepo) ListByAssetType(ctx context.Context, assetType string) ([]*models.AssetPrice, error) {
	if m.listByAssetTypeFn != nil {
		return m.listByAssetTypeFn(ctx, assetType)
	}
	return nil, nil
}
func (m *adcAssetPriceRepo) ListAll(ctx context.Context) ([]*models.AssetPrice, error) {
	if m.listAllFn != nil {
		return m.listAllFn(ctx)
	}
	return nil, nil
}
func (m *adcAssetPriceRepo) UpsertBatch(ctx context.Context, prices []*models.AssetPrice) error {
	if m.upsertBatchFn != nil {
		return m.upsertBatchFn(ctx, prices)
	}
	return nil
}
func (m *adcAssetPriceRepo) GetByTypeCodeAndCurrency(ctx context.Context, typeCode, currency string) (*models.AssetPrice, error) {
	if m.getByTypeCodeAndCurrencyFn != nil {
		return m.getByTypeCodeAndCurrencyFn(ctx, typeCode, currency)
	}
	return nil, nil
}
func (m *adcAssetPriceRepo) MarkStaleByAssetType(ctx context.Context, assetType string) error {
	if m.markStaleByAssetTypeFn != nil {
		return m.markStaleByAssetTypeFn(ctx, assetType)
	}
	return nil
}
func (m *adcAssetPriceRepo) MarkStaleByAssetTypeAndSource(ctx context.Context, assetType, source string) error {
	if m.markStaleByAssetTypeAndSourceFn != nil {
		return m.markStaleByAssetTypeAndSourceFn(ctx, assetType, source)
	}
	return nil
}
func (m *adcAssetPriceRepo) ListByAssetTypeFiltered(_ context.Context, _ string, _ []string) ([]*models.AssetPrice, error) {
	return nil, nil
}

// Verify mocks satisfy their interfaces at compile time.
var _ repository.AssetDisplayConfigRepository = (*adcConfigRepo)(nil)
var _ repository.AssetConfigFetchCodeRepository = (*adcFetchCodeRepo)(nil)
var _ repository.AssetPriceRepository = (*adcAssetPriceRepo)(nil)

// ---------------------------------------------------------------------------
// Helper constructor
// ---------------------------------------------------------------------------

func newTestAssetDisplayConfigService(
	cfgRepo repository.AssetDisplayConfigRepository,
	fcRepo repository.AssetConfigFetchCodeRepository,
	apRepo repository.AssetPriceRepository,
) AssetDisplayConfigService {
	return NewAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
}

// ---------------------------------------------------------------------------
// ResolvePrice tests
// ---------------------------------------------------------------------------

func TestResolvePrice_HappyPath_FirstNonStaleReturned(t *testing.T) {
	ctx := context.Background()
	now := time.Now()

	cfgRepo := &adcConfigRepo{
		getByTypeCodeAndAssetTypeFn: func(_ context.Context, typeCode, assetType string) (*models.AssetDisplayConfig, error) {
			return &models.AssetDisplayConfig{ID: 1, TypeCode: typeCode, AssetType: assetType}, nil
		},
	}

	fc0 := &models.AssetConfigFetchCode{ID: 1, ConfigID: 1, TypeCode: "SJC_1L", Priority: 0}
	fc1 := &models.AssetConfigFetchCode{ID: 2, ConfigID: 1, TypeCode: "SJC_10L", Priority: 1}

	fcRepo := &adcFetchCodeRepo{
		listByConfigIDFn: func(_ context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
			return []*models.AssetConfigFetchCode{fc0, fc1}, nil
		},
	}

	apRepo := &adcAssetPriceRepo{
		listByAssetTypeFn: func(_ context.Context, assetType string) ([]*models.AssetPrice, error) {
			return []*models.AssetPrice{
				{TypeCode: "SJC_1L", Buy: 9000000, Sell: 9100000, IsStale: false, FetchedAt: now},
				{TypeCode: "SJC_10L", Buy: 8900000, Sell: 9000000, IsStale: false, FetchedAt: now},
			}, nil
		},
	}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	buy, sell, isStale, err := svc.ResolvePrice(ctx, "SJC_1L", "gold")

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if isStale {
		t.Error("expected isStale=false")
	}
	if buy != 9000000 {
		t.Errorf("expected buy=9000000, got=%d", buy)
	}
	if sell != 9100000 {
		t.Errorf("expected sell=9100000, got=%d", sell)
	}
}

func TestResolvePrice_AllStale_ReturnsFreshestWithIsStaleTrue(t *testing.T) {
	ctx := context.Background()
	older := time.Now().Add(-2 * time.Hour)
	newer := time.Now().Add(-1 * time.Hour)

	cfgRepo := &adcConfigRepo{
		getByTypeCodeAndAssetTypeFn: func(_ context.Context, typeCode, assetType string) (*models.AssetDisplayConfig, error) {
			return &models.AssetDisplayConfig{ID: 1, TypeCode: typeCode, AssetType: assetType}, nil
		},
	}

	fc0 := &models.AssetConfigFetchCode{ID: 1, ConfigID: 1, TypeCode: "SJC_OLD", Priority: 0}
	fc1 := &models.AssetConfigFetchCode{ID: 2, ConfigID: 1, TypeCode: "SJC_NEW", Priority: 1}

	fcRepo := &adcFetchCodeRepo{
		listByConfigIDFn: func(_ context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
			return []*models.AssetConfigFetchCode{fc0, fc1}, nil
		},
	}

	apRepo := &adcAssetPriceRepo{
		listByAssetTypeFn: func(_ context.Context, assetType string) ([]*models.AssetPrice, error) {
			return []*models.AssetPrice{
				{TypeCode: "SJC_OLD", Buy: 8000000, IsStale: true, FetchedAt: older},
				{TypeCode: "SJC_NEW", Buy: 9000000, IsStale: true, FetchedAt: newer},
			}, nil
		},
	}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	buy, _, isStale, err := svc.ResolvePrice(ctx, "SJC_MAIN", "gold")

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if !isStale {
		t.Error("expected isStale=true when all prices are stale")
	}
	// Should return the freshest (newest FetchedAt) stale price.
	if buy != 9000000 {
		t.Errorf("expected freshest stale buy=9000000, got=%d", buy)
	}
}

func TestResolvePrice_NoAssetPriceRows_ReturnsError(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{
		getByTypeCodeAndAssetTypeFn: func(_ context.Context, typeCode, assetType string) (*models.AssetDisplayConfig, error) {
			return &models.AssetDisplayConfig{ID: 1, TypeCode: typeCode, AssetType: assetType}, nil
		},
	}

	fc0 := &models.AssetConfigFetchCode{ID: 1, ConfigID: 1, TypeCode: "SJC_MISSING", Priority: 0}

	fcRepo := &adcFetchCodeRepo{
		listByConfigIDFn: func(_ context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
			return []*models.AssetConfigFetchCode{fc0}, nil
		},
	}

	// No asset price rows at all.
	apRepo := &adcAssetPriceRepo{
		listByAssetTypeFn: func(_ context.Context, assetType string) ([]*models.AssetPrice, error) {
			return []*models.AssetPrice{}, nil
		},
	}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	_, _, _, err := svc.ResolvePrice(ctx, "SJC_MAIN", "gold")

	if err == nil {
		t.Fatal("expected error when no asset_price rows exist")
	}
}

func TestResolvePrice_NoFetchCodes_ReturnsError(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{
		getByTypeCodeAndAssetTypeFn: func(_ context.Context, typeCode, assetType string) (*models.AssetDisplayConfig, error) {
			return &models.AssetDisplayConfig{ID: 1, TypeCode: typeCode, AssetType: assetType}, nil
		},
	}

	// Empty fetch codes.
	fcRepo := &adcFetchCodeRepo{
		listByConfigIDFn: func(_ context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
			return []*models.AssetConfigFetchCode{}, nil
		},
	}

	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	_, _, _, err := svc.ResolvePrice(ctx, "SJC_MAIN", "gold")

	if err == nil {
		t.Fatal("expected error when no fetch codes are configured")
	}
}

func TestResolvePrice_ConfigNotFound_ReturnsError(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{
		getByTypeCodeAndAssetTypeFn: func(_ context.Context, typeCode, assetType string) (*models.AssetDisplayConfig, error) {
			return nil, nil // not found
		},
	}

	fcRepo := &adcFetchCodeRepo{}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	_, _, _, err := svc.ResolvePrice(ctx, "SJC_MAIN", "gold")

	if err == nil {
		t.Fatal("expected error when config not found")
	}
}

// ---------------------------------------------------------------------------
// CreateFetchCode validation tests
// ---------------------------------------------------------------------------

func TestCreateFetchCode_EmptyTypeCode_ReturnsValidationError(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{
		getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
			return &models.AssetDisplayConfig{ID: id, AssetType: "gold"}, nil
		},
	}
	fcRepo := &adcFetchCodeRepo{}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	_, err := svc.CreateFetchCode(ctx, 1, "", 0)
	if err == nil {
		t.Fatal("expected validation error for empty type_code")
	}
}

func TestCreateFetchCode_TypeCodeTooLong_ReturnsValidationError(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{
		getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
			return &models.AssetDisplayConfig{ID: id, AssetType: "gold"}, nil
		},
	}
	fcRepo := &adcFetchCodeRepo{
		countByConfigIDFn: func(_ context.Context, configID int32) (int64, error) {
			return 0, nil
		},
	}
	apRepo := &adcAssetPriceRepo{
		listByAssetTypeFn: func(_ context.Context, assetType string) ([]*models.AssetPrice, error) {
			return []*models.AssetPrice{}, nil
		},
	}

	longCode := "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" // 52 chars
	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	_, err := svc.CreateFetchCode(ctx, 1, longCode, 0)
	if err == nil {
		t.Fatal("expected validation error for type_code > 50 chars")
	}
}

func TestCreateFetchCode_NegativePriority_ReturnsValidationError(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{
		getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
			return &models.AssetDisplayConfig{ID: id, AssetType: "gold"}, nil
		},
	}
	fcRepo := &adcFetchCodeRepo{}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	_, err := svc.CreateFetchCode(ctx, 1, "SJC_1L", -1)
	if err == nil {
		t.Fatal("expected validation error for negative priority")
	}
}

func TestCreateFetchCode_MaxCapExceeded_ReturnsError(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{
		getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
			return &models.AssetDisplayConfig{ID: id, AssetType: "gold"}, nil
		},
	}
	fcRepo := &adcFetchCodeRepo{
		countByConfigIDFn: func(_ context.Context, configID int32) (int64, error) {
			return 10, nil // already at max
		},
	}
	apRepo := &adcAssetPriceRepo{
		listByAssetTypeFn: func(_ context.Context, assetType string) ([]*models.AssetPrice, error) {
			return []*models.AssetPrice{
				{TypeCode: "SJC_1L"},
			}, nil
		},
	}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	_, err := svc.CreateFetchCode(ctx, 1, "SJC_1L", 0)
	if err == nil {
		t.Fatal("expected error when max 10 fetch codes per config is exceeded")
	}
}

func TestCreateFetchCode_TypeCodeNotInAssetPrice_ReturnsError(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{
		getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
			return &models.AssetDisplayConfig{ID: id, AssetType: "gold"}, nil
		},
	}
	fcRepo := &adcFetchCodeRepo{
		countByConfigIDFn: func(_ context.Context, configID int32) (int64, error) {
			return 0, nil
		},
	}
	// No asset prices — type_code not in DB.
	apRepo := &adcAssetPriceRepo{
		listByAssetTypeFn: func(_ context.Context, assetType string) ([]*models.AssetPrice, error) {
			return []*models.AssetPrice{}, nil
		},
	}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	_, err := svc.CreateFetchCode(ctx, 1, "SJC_UNKNOWN", 0)
	if err == nil {
		t.Fatal("expected error when type_code does not exist in asset_price table")
	}
}

func TestCreateFetchCode_Success(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{
		getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
			return &models.AssetDisplayConfig{ID: id, AssetType: "gold"}, nil
		},
	}

	var created *models.AssetConfigFetchCode
	fcRepo := &adcFetchCodeRepo{
		countByConfigIDFn: func(_ context.Context, configID int32) (int64, error) {
			return 0, nil
		},
		createFn: func(_ context.Context, fc *models.AssetConfigFetchCode) error {
			created = fc
			return nil
		},
	}
	apRepo := &adcAssetPriceRepo{
		listByAssetTypeFn: func(_ context.Context, assetType string) ([]*models.AssetPrice, error) {
			return []*models.AssetPrice{
				{TypeCode: "SJC_1L"},
			}, nil
		},
	}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	fc, err := svc.CreateFetchCode(ctx, 1, "SJC_1L", 0)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if fc == nil {
		t.Fatal("expected returned fetch code to be non-nil")
	}
	if created == nil {
		t.Fatal("expected Create to have been called on repository")
	}
	if created.TypeCode != "SJC_1L" {
		t.Errorf("expected TypeCode=SJC_1L, got=%s", created.TypeCode)
	}
}

// ---------------------------------------------------------------------------
// UpdateFetchCode validation tests
// ---------------------------------------------------------------------------

func TestUpdateFetchCode_NegativePriority_ReturnsValidationError(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{}
	fcRepo := &adcFetchCodeRepo{}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	_, err := svc.UpdateFetchCode(ctx, 1, -5)
	if err == nil {
		t.Fatal("expected validation error for negative priority")
	}
}

func TestUpdateFetchCode_NotFound_ReturnsError(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{}
	fcRepo := &adcFetchCodeRepo{
		getByIDFn: func(_ context.Context, id int32) (*models.AssetConfigFetchCode, error) {
			return nil, nil // not found
		},
	}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	_, err := svc.UpdateFetchCode(ctx, 99, 5)
	if err == nil {
		t.Fatal("expected not-found error when fetch code does not exist")
	}
}

func TestUpdateFetchCode_Success(t *testing.T) {
	ctx := context.Background()

	existing := &models.AssetConfigFetchCode{ID: 1, ConfigID: 1, TypeCode: "SJC_1L", Priority: 0}

	cfgRepo := &adcConfigRepo{}
	fcRepo := &adcFetchCodeRepo{
		getByIDFn: func(_ context.Context, id int32) (*models.AssetConfigFetchCode, error) {
			return existing, nil
		},
		updateFn: func(_ context.Context, fc *models.AssetConfigFetchCode) error {
			return nil
		},
	}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	fc, err := svc.UpdateFetchCode(ctx, 1, 5)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if fc.Priority != 5 {
		t.Errorf("expected Priority=5, got=%d", fc.Priority)
	}
}

// ---------------------------------------------------------------------------
// DeleteFetchCode tests
// ---------------------------------------------------------------------------

func TestDeleteFetchCode_Success(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{}
	deleted := false
	fcRepo := &adcFetchCodeRepo{
		deleteFn: func(_ context.Context, id int32) error {
			deleted = true
			return nil
		},
	}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	err := svc.DeleteFetchCode(ctx, 1)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if !deleted {
		t.Error("expected Delete to have been called on the repository")
	}
}

func TestDeleteFetchCode_RepositoryError_Propagated(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{}
	fcRepo := &adcFetchCodeRepo{
		deleteFn: func(_ context.Context, id int32) error {
			return errors.New("not found")
		},
	}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	err := svc.DeleteFetchCode(ctx, 99)
	if err == nil {
		t.Fatal("expected error to be propagated from repository")
	}
}

// ---------------------------------------------------------------------------
// ListAvailableTypeCodes tests
// ---------------------------------------------------------------------------

func TestListAvailableTypeCodes_ReturnsDistinctTypeCodes(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{}
	fcRepo := &adcFetchCodeRepo{}
	apRepo := &adcAssetPriceRepo{
		listByAssetTypeFn: func(_ context.Context, assetType string) ([]*models.AssetPrice, error) {
			return []*models.AssetPrice{
				{TypeCode: "SJC_1L"},
				{TypeCode: "SJC_10L"},
				{TypeCode: "SJC_1L"}, // duplicate
			}, nil
		},
	}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	codes, err := svc.ListAvailableTypeCodes(ctx, "gold")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if len(codes) != 2 {
		t.Errorf("expected 2 distinct type codes, got=%d", len(codes))
	}
}

// ---------------------------------------------------------------------------
// GetDisplayPrices tests
// ---------------------------------------------------------------------------

func TestGetDisplayPrices_MergesConfigAndPrice(t *testing.T) {
	ctx := context.Background()
	now := time.Now()

	cfgRepo := &adcConfigRepo{
		listByAssetTypeFn: func(_ context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			return []*models.AssetDisplayConfig{
				{ID: 1, TypeCode: "SJC_1L", AssetType: "gold", DisplayName: "SJC 1 Lạng", DisplayOrder: 0, Enabled: true},
			}, nil
		},
		getByTypeCodeAndAssetTypeFn: func(_ context.Context, typeCode, assetType string) (*models.AssetDisplayConfig, error) {
			return &models.AssetDisplayConfig{ID: 1, TypeCode: typeCode, AssetType: assetType}, nil
		},
	}
	fcRepo := &adcFetchCodeRepo{
		listByConfigIDFn: func(_ context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
			return []*models.AssetConfigFetchCode{
				{ID: 1, ConfigID: 1, TypeCode: "SJC_1L", Priority: 0},
			}, nil
		},
	}
	apRepo := &adcAssetPriceRepo{
		listByAssetTypeFn: func(_ context.Context, assetType string) ([]*models.AssetPrice, error) {
			return []*models.AssetPrice{
				{TypeCode: "SJC_1L", Buy: 9000000, Sell: 9100000, IsStale: false, FetchedAt: now},
			}, nil
		},
	}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	dtos, err := svc.GetDisplayPrices(ctx, "gold")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if len(dtos) != 1 {
		t.Fatalf("expected 1 DTO, got=%d", len(dtos))
	}
	if dtos[0].TypeCode != "SJC_1L" {
		t.Errorf("expected TypeCode=SJC_1L, got=%s", dtos[0].TypeCode)
	}
	if dtos[0].Buy != 9000000 {
		t.Errorf("expected Buy=9000000, got=%d", dtos[0].Buy)
	}
	if dtos[0].Sell != 9100000 {
		t.Errorf("expected Sell=9100000, got=%d", dtos[0].Sell)
	}
	if dtos[0].IsStale {
		t.Error("expected IsStale=false")
	}
}

func TestGetDisplayPrices_ResolveFails_SetsIsStale(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{
		listByAssetTypeFn: func(_ context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			return []*models.AssetDisplayConfig{
				{ID: 1, TypeCode: "SJC_1L", AssetType: "gold", DisplayName: "SJC 1 Lạng", DisplayOrder: 0, Enabled: true},
			}, nil
		},
		getByTypeCodeAndAssetTypeFn: func(_ context.Context, typeCode, assetType string) (*models.AssetDisplayConfig, error) {
			return &models.AssetDisplayConfig{ID: 1, TypeCode: typeCode, AssetType: assetType}, nil
		},
	}
	fcRepo := &adcFetchCodeRepo{
		// No fetch codes — ResolvePrice will fail.
		listByConfigIDFn: func(_ context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
			return []*models.AssetConfigFetchCode{}, nil
		},
	}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	dtos, err := svc.GetDisplayPrices(ctx, "gold")
	// GetDisplayPrices should not fail even if ResolvePrice fails for one item — it should use default stale zero.
	if err != nil {
		t.Fatalf("expected GetDisplayPrices to succeed even when price resolution fails, got: %v", err)
	}
	if len(dtos) != 1 {
		t.Fatalf("expected 1 DTO, got=%d", len(dtos))
	}
	// Should default to IsStale=true when resolution fails.
	if !dtos[0].IsStale {
		t.Error("expected IsStale=true when price resolution fails")
	}
	if dtos[0].Buy != 0 {
		t.Errorf("expected Buy=0 on failure, got=%d", dtos[0].Buy)
	}
}

// ---------------------------------------------------------------------------
// ListAll tests
// ---------------------------------------------------------------------------

func TestListAll_DelegatesToRepoWithAssetType(t *testing.T) {
	ctx := context.Background()
	capturedAssetType := ""

	cfgRepo := &adcConfigRepo{
		listAllFn: func(_ context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			capturedAssetType = assetType
			return []*models.AssetDisplayConfig{
				{ID: 1, TypeCode: "SJC_1L", AssetType: assetType},
			}, nil
		},
	}
	fcRepo := &adcFetchCodeRepo{}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)

	// Verify gold tab passes "gold" to repo
	configs, err := svc.ListAll(ctx, "gold")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if len(configs) != 1 {
		t.Errorf("expected 1 config, got=%d", len(configs))
	}
	if capturedAssetType != "gold" {
		t.Errorf("expected assetType=gold to be passed to repo, got=%q", capturedAssetType)
	}

	// Verify silver tab passes "silver" to repo
	configs, err = svc.ListAll(ctx, "silver")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if len(configs) != 1 {
		t.Errorf("expected 1 config, got=%d", len(configs))
	}
	if capturedAssetType != "silver" {
		t.Errorf("expected assetType=silver to be passed to repo, got=%q", capturedAssetType)
	}
}

// ---------------------------------------------------------------------------
// Create / Update / Delete delegate tests
// ---------------------------------------------------------------------------

func TestCreate_ValidationAndDelegate(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{
		getByTypeCodeFn: func(_ context.Context, typeCode string) (*models.AssetDisplayConfig, error) {
			return nil, nil // no duplicate
		},
		createFn: func(_ context.Context, config *models.AssetDisplayConfig) error {
			return nil
		},
	}
	fcRepo := &adcFetchCodeRepo{}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)

	// Empty typeCode should fail.
	_, err := svc.Create(ctx, "", "Display Name", "gold", 0, true, false)
	if err == nil {
		t.Fatal("expected error for empty typeCode")
	}

	// Empty displayName should fail.
	_, err = svc.Create(ctx, "SJC_1L", "", "gold", 0, true, false)
	if err == nil {
		t.Fatal("expected error for empty displayName")
	}

	// Valid create should succeed.
	cfg, err := svc.Create(ctx, "SJC_1L", "SJC 1 Lạng", "gold", 0, true, false)
	if err != nil {
		t.Fatalf("expected success, got: %v", err)
	}
	if cfg == nil {
		t.Fatal("expected non-nil config returned")
	}
}

func TestUpdate_ValidationAndDelegate(t *testing.T) {
	ctx := context.Background()

	existing := &models.AssetDisplayConfig{ID: 1, TypeCode: "SJC_1L", DisplayName: "Old", DisplayOrder: 0}
	cfgRepo := &adcConfigRepo{
		getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
			return existing, nil
		},
		updateFn: func(_ context.Context, config *models.AssetDisplayConfig) error {
			return nil
		},
	}
	fcRepo := &adcFetchCodeRepo{}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)

	// Empty displayName should fail.
	_, err := svc.Update(ctx, 1, "", 0, true, false)
	if err == nil {
		t.Fatal("expected validation error for empty displayName")
	}

	// Valid update should succeed.
	cfg, err := svc.Update(ctx, 1, "New Name", 1, true, false)
	if err != nil {
		t.Fatalf("expected success, got: %v", err)
	}
	if cfg.DisplayName != "New Name" {
		t.Errorf("expected DisplayName=New Name, got=%s", cfg.DisplayName)
	}
}

func TestUpdate_ConfigNotFound_ReturnsNotFoundError(t *testing.T) {
	ctx := context.Background()

	cfgRepo := &adcConfigRepo{
		getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
			return nil, nil // simulate not found (repository returns nil, nil)
		},
	}
	fcRepo := &adcFetchCodeRepo{}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	_, err := svc.Update(ctx, 99, "New Name", 0, true, false)
	if err == nil {
		t.Fatal("expected not-found error when config is missing")
	}
}

func TestDelete_DelegatesToRepo(t *testing.T) {
	ctx := context.Background()

	deleted := false
	cfgRepo := &adcConfigRepo{
		deleteFn: func(_ context.Context, id int32) error {
			deleted = true
			return nil
		},
	}
	fcRepo := &adcFetchCodeRepo{}
	apRepo := &adcAssetPriceRepo{}

	svc := newTestAssetDisplayConfigService(cfgRepo, fcRepo, apRepo)
	err := svc.Delete(ctx, 1)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if !deleted {
		t.Error("expected Delete to have been called on repo")
	}
}
