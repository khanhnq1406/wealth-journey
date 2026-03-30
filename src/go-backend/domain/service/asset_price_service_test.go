package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wealthjourney/domain/models"
)

// ---------------------------------------------------------------------------
// Mock: AssetPriceRepository
// ---------------------------------------------------------------------------

type mockAssetPriceRepo struct {
	mu                sync.Mutex
	upsertedBatches   [][]*models.AssetPrice
	staledTypes       []string
	listAllResult     []*models.AssetPrice
	listAllErr        error
	listByTypeResults map[string][]*models.AssetPrice
	listByTypeErr     error
	upsertErr         error
	markStaleErr      error
}

func (m *mockAssetPriceRepo) UpsertBatch(_ context.Context, prices []*models.AssetPrice) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.upsertErr != nil {
		return m.upsertErr
	}
	m.upsertedBatches = append(m.upsertedBatches, prices)
	return nil
}

func (m *mockAssetPriceRepo) MarkStaleByAssetType(_ context.Context, assetType string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.markStaleErr != nil {
		return m.markStaleErr
	}
	m.staledTypes = append(m.staledTypes, assetType)
	return nil
}

func (m *mockAssetPriceRepo) MarkStaleByAssetTypeAndSource(_ context.Context, assetType string, _ string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.markStaleErr != nil {
		return m.markStaleErr
	}
	m.staledTypes = append(m.staledTypes, assetType)
	return nil
}

func (m *mockAssetPriceRepo) ListAll(_ context.Context) ([]*models.AssetPrice, error) {
	return m.listAllResult, m.listAllErr
}

func (m *mockAssetPriceRepo) ListByAssetType(_ context.Context, assetType string) ([]*models.AssetPrice, error) {
	if m.listByTypeErr != nil {
		return nil, m.listByTypeErr
	}
	if m.listByTypeResults != nil {
		return m.listByTypeResults[assetType], nil
	}
	return nil, nil
}

func (m *mockAssetPriceRepo) GetByTypeCodeAndCurrency(_ context.Context, _, _ string) (*models.AssetPrice, error) {
	return nil, nil
}

func (m *mockAssetPriceRepo) ListByAssetTypeFiltered(_ context.Context, assetType string, enabledTypeCodes []string) ([]*models.AssetPrice, error) {
	if len(enabledTypeCodes) == 0 {
		return []*models.AssetPrice{}, nil
	}
	if m.listByTypeErr != nil {
		return nil, m.listByTypeErr
	}
	// Build a set for O(1) lookups
	allowed := make(map[string]struct{}, len(enabledTypeCodes))
	for _, tc := range enabledTypeCodes {
		allowed[tc] = struct{}{}
	}
	var result []*models.AssetPrice
	if m.listByTypeResults != nil {
		for _, p := range m.listByTypeResults[assetType] {
			if _, ok := allowed[p.TypeCode]; ok {
				result = append(result, p)
			}
		}
	}
	return result, nil
}

// ---------------------------------------------------------------------------
// Mock: AssetDisplayConfigRepository
// ---------------------------------------------------------------------------

// mockAssetDisplayConfigRepo is a simple test double for AssetDisplayConfigRepository.
// Set enabledCodes to control which type codes are returned per asset type.
// Set enabledCodesErr to simulate a ListEnabledTypeCodesByAssetType failure.
type mockAssetDisplayConfigRepo struct {
	// enabledCodes maps assetType → []typeCode returned by ListEnabledTypeCodesByAssetType.
	enabledCodes    map[string][]string
	enabledCodesErr error
}

func (m *mockAssetDisplayConfigRepo) ListEnabledTypeCodesByAssetType(_ context.Context, assetType string) ([]string, error) {
	if m.enabledCodesErr != nil {
		return nil, m.enabledCodesErr
	}
	if m.enabledCodes != nil {
		return m.enabledCodes[assetType], nil
	}
	return []string{}, nil
}

// Stub all other interface methods to satisfy the interface.
func (m *mockAssetDisplayConfigRepo) ListAll(_ context.Context, _ string) ([]*models.AssetDisplayConfig, error) {
	return nil, nil
}
func (m *mockAssetDisplayConfigRepo) ListEnabled(_ context.Context) ([]*models.AssetDisplayConfig, error) {
	return nil, nil
}
func (m *mockAssetDisplayConfigRepo) GetByID(_ context.Context, _ int32) (*models.AssetDisplayConfig, error) {
	return nil, nil
}
func (m *mockAssetDisplayConfigRepo) GetByTypeCode(_ context.Context, _ string) (*models.AssetDisplayConfig, error) {
	return nil, nil
}
func (m *mockAssetDisplayConfigRepo) Create(_ context.Context, _ *models.AssetDisplayConfig) error {
	return nil
}
func (m *mockAssetDisplayConfigRepo) Update(_ context.Context, _ *models.AssetDisplayConfig) error {
	return nil
}
func (m *mockAssetDisplayConfigRepo) Delete(_ context.Context, _ int32) error {
	return nil
}
func (m *mockAssetDisplayConfigRepo) ListByAssetType(_ context.Context, _ string) ([]*models.AssetDisplayConfig, error) {
	return nil, nil
}
func (m *mockAssetDisplayConfigRepo) GetByTypeCodeAndAssetType(_ context.Context, _, _ string) (*models.AssetDisplayConfig, error) {
	return nil, nil
}

// ---------------------------------------------------------------------------
// Mock: SilverPriceService
// ---------------------------------------------------------------------------

type mockSilverPriceSvc struct {
	prices []*CachedSilverPrice
	err    error
}

func (m *mockSilverPriceSvc) FetchAllPrices(_ context.Context) ([]*CachedSilverPrice, error) {
	return m.prices, m.err
}

func (m *mockSilverPriceSvc) FetchPriceForSymbol(_ context.Context, _ string) (*CachedSilverPrice, error) {
	return nil, nil
}

// ---------------------------------------------------------------------------
// Mock: GoldPriceFetcher (simple stub — no testify/mock dependency)
// ---------------------------------------------------------------------------

// mockSimpleGoldPriceFetcher is a simple test double implementing GoldPriceFetcher.
// Named "Simple" to avoid collision with the testify/mock-based mockGoldPriceFetcher
// declared in price_fetcher_test.go (same package).
type mockSimpleGoldPriceFetcher struct {
	prices []*CachedGoldPrice
	err    error
	source PriceSource
}

func (m *mockSimpleGoldPriceFetcher) FetchGoldPrices(_ context.Context) ([]*CachedGoldPrice, error) {
	return m.prices, m.err
}

func (m *mockSimpleGoldPriceFetcher) Source() PriceSource {
	return m.source
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func makeGoldPrices(n int) []*CachedGoldPrice {
	prices := make([]*CachedGoldPrice, n)
	for i := range prices {
		prices[i] = &CachedGoldPrice{
			TypeCode:  "GOLD_TYPE_" + string(rune('A'+i)),
			Name:      "Gold " + string(rune('A'+i)),
			Buy:       int64(1000000 * (i + 1)),
			Sell:      int64(1010000 * (i + 1)),
			Currency:  "VND",
			UpdateTime: time.Now(),
		}
	}
	return prices
}

func makeSilverPrices(n int) []*CachedSilverPrice {
	prices := make([]*CachedSilverPrice, n)
	for i := range prices {
		prices[i] = &CachedSilverPrice{
			TypeCode:   "SILVER_TYPE_" + string(rune('A'+i)),
			Name:       "Silver " + string(rune('A'+i)),
			Buy:        int64(20000 * (i + 1)),
			Sell:       int64(20500 * (i + 1)),
			ChangeBuy:  int64(100 * (i + 1)),
			ChangeSell: int64(50 * (i + 1)),
			Currency:   "VND",
			UpdateTime: time.Now(),
		}
	}
	return prices
}

// ---------------------------------------------------------------------------
// Tests: RefreshAllPrices
// ---------------------------------------------------------------------------

func TestAssetPriceService_RefreshAllPrices_AllSucceed(t *testing.T) {
	vsgPrices := makeGoldPrices(3)
	silverPrices := makeSilverPrices(2)

	repo := &mockAssetPriceRepo{}
	vsgFetcher := &mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, prices: vsgPrices}
	vtFetcher := &mockSimpleGoldPriceFetcher{source: SourceVangToday, prices: makeGoldPrices(2)}
	svc := NewAssetPriceService(repo,
		nil,
		&mockSilverPriceSvc{prices: silverPrices},
		vsgFetcher, vtFetcher,
		nil, nil, nil, // currency fetchers: vsg, vt, vcb (nil → fail)
		nil, nil, nil, nil, nil,
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	// Three batches: vangsaigon gold, vangtoday gold, silver.
	// Nil currency fetchers + nil gold clients each fail, but 3/10 succeed → no error.
	if len(repo.upsertedBatches) != 3 {
		t.Fatalf("expected 3 upsert batches (vangsaigon gold + vangtoday gold + silver), got %d", len(repo.upsertedBatches))
	}

	// Nil clients (sjc/doji/btmc/pnj/mihong) call MarkStaleByAssetTypeAndSource("gold", <source>)
	// which records "gold" in staledTypes. Exactly 5 such marks expected (one per nil gold client).
	// Nil currency fetchers (3) also call MarkStaleByAssetTypeAndSource("currency", <source>).
	goldStaleCount := 0
	for _, st := range repo.staledTypes {
		if st == "gold" {
			goldStaleCount++
		}
	}
	if goldStaleCount != 5 {
		t.Errorf("expected 5 stale marks from nil gold clients (gold×5), got: %v", repo.staledTypes)
	}

	// All items should have is_stale = false.
	for _, batch := range repo.upsertedBatches {
		for _, p := range batch {
			if p.IsStale {
				t.Errorf("price %q should not be stale after successful upsert", p.TypeCode)
			}
		}
	}
}

func TestAssetPriceService_RefreshAllPrices_GoldFails(t *testing.T) {
	goldErr := errors.New("gold timeout")
	silverPrices := makeSilverPrices(2)

	repo := &mockAssetPriceRepo{}
	// Both gold fetchers fail; silver succeeds; currency fetchers are nil (also fail).
	svc := NewAssetPriceService(repo,
		nil,
		&mockSilverPriceSvc{prices: silverPrices},
		&mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, err: goldErr},
		&mockSimpleGoldPriceFetcher{source: SourceVangToday, err: goldErr},
		nil, nil, nil, // currency fetchers: vsg, vt, vcb (nil → fail)
		nil, nil, nil, nil, nil,
	)

	// Partial failure should not return an error (only all-fail does).
	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("expected no error on partial failure, got: %v", err)
	}

	// Gold should have been marked stale.
	if !contains(repo.staledTypes, "gold") {
		t.Errorf("gold should be marked stale; staledTypes=%v", repo.staledTypes)
	}

	// Only silver should have been upserted (1 batch); currency fetchers are nil so currency fails.
	if len(repo.upsertedBatches) != 1 {
		t.Errorf("expected 1 upsert batch (silver only), got %d", len(repo.upsertedBatches))
	}
}

func TestAssetPriceService_RefreshAllPrices_AllFail(t *testing.T) {
	goldErr := errors.New("gold API down")
	silverErr := errors.New("silver API down")

	repo := &mockAssetPriceRepo{}
	// Both gold fetchers fail + nil clients (4) + silver fails + nil currency fetchers (3) = 10 total failures.
	svc := NewAssetPriceService(repo,
		nil,
		&mockSilverPriceSvc{err: silverErr},
		&mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, err: goldErr},
		&mockSimpleGoldPriceFetcher{source: SourceVangToday, err: goldErr},
		nil, nil, nil, // currency fetchers: vsg, vt, vcb (nil → fail)
		nil, nil, nil, nil, nil, // nil gold clients also fail → total 11 failures
	)

	err := svc.RefreshAllPrices(context.Background())
	if err == nil {
		t.Fatal("expected error when all price types fail, got nil")
	}

	// Gold, silver, currency types should have been marked stale.
	for _, typ := range []string{"gold", "silver", "currency"} {
		if !contains(repo.staledTypes, typ) {
			t.Errorf("%q should be marked stale; staledTypes=%v", typ, repo.staledTypes)
		}
	}

	// No upserts should have happened.
	if len(repo.upsertedBatches) != 0 {
		t.Errorf("expected 0 upsert batches when all fail, got %d", len(repo.upsertedBatches))
	}
}

func TestAssetPriceService_RefreshAllPrices_AssetTypeFields(t *testing.T) {
	// Verify that the AssetType field is correctly set per source type.
	goldPrices := makeGoldPrices(1)
	silverPrices := makeSilverPrices(1)

	repo := &mockAssetPriceRepo{}
	// Use vsgFetcher for gold; vtFetcher fails so only one gold batch.
	// Currency fetchers are nil so no currency batches.
	svc := NewAssetPriceService(repo,
		nil,
		&mockSilverPriceSvc{prices: silverPrices},
		&mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, prices: goldPrices},
		&mockSimpleGoldPriceFetcher{source: SourceVangToday, err: errors.New("vangtoday off")},
		nil, nil, nil, // currency fetchers: vsg, vt, vcb (nil → fail)
		nil, nil, nil, nil, nil,
	)

	_ = svc.RefreshAllPrices(context.Background())

	// Collect all items across batches — order is non-deterministic with concurrent refresh.
	seenTypes := make(map[string]int)
	for _, batch := range repo.upsertedBatches {
		for _, item := range batch {
			seenTypes[item.AssetType]++
		}
	}
	// gold: 1 item (from vangsaigon), silver: 1; currency: 0 (nil fetchers)
	if seenTypes["gold"] != 1 {
		t.Errorf("expected exactly 1 gold item, got %d; seenTypes=%v", seenTypes["gold"], seenTypes)
	}
	if seenTypes["silver"] != 1 {
		t.Errorf("expected exactly 1 silver item, got %d; seenTypes=%v", seenTypes["silver"], seenTypes)
	}
	if seenTypes["currency"] != 0 {
		t.Errorf("expected 0 currency items (nil fetchers), got %d; seenTypes=%v", seenTypes["currency"], seenTypes)
	}
}

// ---------------------------------------------------------------------------
// Tests: GetAllPrices
// ---------------------------------------------------------------------------

func TestAssetPriceService_GetAllPrices_GroupsByAssetType(t *testing.T) {
	now := time.Now()
	repo := &mockAssetPriceRepo{
		listByTypeResults: map[string][]*models.AssetPrice{
			"gold": {
				{TypeCode: "SJC", AssetType: "gold", Name: "SJC Bar", Buy: 1000, Sell: 1010, Currency: "VND", FetchedAt: now},
				{TypeCode: "DOJI", AssetType: "gold", Name: "DOJI Bar", Buy: 990, Sell: 1000, Currency: "VND", FetchedAt: now},
			},
			"silver": {
				{TypeCode: "SILVER_1L", AssetType: "silver", Name: "Silver 1L", Buy: 200, Sell: 210, Currency: "VND", FetchedAt: now},
			},
			"currency": {
				{TypeCode: "USD", AssetType: "currency", Name: "US Dollar", Buy: 25000, Sell: 25200, Currency: "VND", FetchedAt: now},
				{TypeCode: "EUR", AssetType: "currency", Name: "Euro", Buy: 27000, Sell: 27200, Currency: "VND", FetchedAt: now},
			},
		},
	}
	configRepo := &mockAssetDisplayConfigRepo{
		enabledCodes: map[string][]string{
			"gold":     {"SJC", "DOJI"},
			"silver":   {"SILVER_1L"},
			"currency": {"USD", "EUR"},
		},
	}
	svc := NewAssetPriceService(repo,
		configRepo,
		&mockSilverPriceSvc{},
		nil, nil,
		nil, nil, nil, // currency fetchers: vsg, vt, vcb
		nil, nil, nil, nil, nil,
	)

	result, err := svc.GetAllPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.Gold) != 2 {
		t.Errorf("expected 2 gold prices, got %d", len(result.Gold))
	}
	if len(result.Silver) != 1 {
		t.Errorf("expected 1 silver price, got %d", len(result.Silver))
	}
	if len(result.Currency) != 2 {
		t.Errorf("expected 2 currency prices, got %d", len(result.Currency))
	}

	// Spot-check DTO field mapping.
	if result.Gold[0].TypeCode != "SJC" {
		t.Errorf("expected gold[0].TypeCode=SJC, got %q", result.Gold[0].TypeCode)
	}
	if result.Currency[1].Buy != 27000 {
		t.Errorf("expected currency[1].Buy=27000, got %d", result.Currency[1].Buy)
	}
}

func TestAssetPriceService_GetAllPrices_RepoError(t *testing.T) {
	// Error can come from configRepo (called first) — simulate a config repo failure.
	repo := &mockAssetPriceRepo{}
	configRepo := &mockAssetDisplayConfigRepo{enabledCodesErr: errors.New("db down")}
	svc := NewAssetPriceService(repo,
		configRepo,
		&mockSilverPriceSvc{},
		nil, nil,
		nil, nil, nil, // currency fetchers: vsg, vt, vcb
		nil, nil, nil, nil, nil,
	)

	_, err := svc.GetAllPrices(context.Background())
	if err == nil {
		t.Fatal("expected error from repo, got nil")
	}
}

func TestAssetPriceService_GetAllPrices_IsStaleField(t *testing.T) {
	now := time.Now()
	repo := &mockAssetPriceRepo{
		listByTypeResults: map[string][]*models.AssetPrice{
			"gold": {
				{TypeCode: "SJC", AssetType: "gold", Name: "SJC", Buy: 1000, Sell: 1010, Currency: "VND", IsStale: true, FetchedAt: now},
			},
		},
	}
	configRepo := &mockAssetDisplayConfigRepo{
		enabledCodes: map[string][]string{
			"gold":     {"SJC"},
			"silver":   {},
			"currency": {},
		},
	}
	svc := NewAssetPriceService(repo, configRepo, &mockSilverPriceSvc{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	result, _ := svc.GetAllPrices(context.Background())
	if !result.Gold[0].IsStale {
		t.Error("expected IsStale=true to be forwarded from model")
	}
}

// ---------------------------------------------------------------------------
// Tests: GetMarketTypes
// ---------------------------------------------------------------------------

func TestAssetPriceService_GetMarketTypes_ExtractsTypes(t *testing.T) {
	t1 := time.Unix(1700000000, 0)
	t2 := time.Unix(1700001000, 0) // later
	t3 := time.Unix(1700002000, 0) // even later

	repo := &mockAssetPriceRepo{
		listByTypeResults: map[string][]*models.AssetPrice{
			"gold": {
				{TypeCode: "SJC", AssetType: "gold", Name: "SJC Bar", Currency: "VND", FetchedAt: t1},
				{TypeCode: "DOJI", AssetType: "gold", Name: "DOJI", Currency: "VND", FetchedAt: t2},
			},
			"silver": {
				{TypeCode: "SILVER_1L", AssetType: "silver", Name: "Silver 1L", Currency: "VND", FetchedAt: t3},
			},
			"currency": {
				{TypeCode: "USD", AssetType: "currency", Name: "US Dollar", Currency: "VND", FetchedAt: t1},
			},
		},
	}
	configRepo := &mockAssetDisplayConfigRepo{
		enabledCodes: map[string][]string{
			"gold":     {"SJC", "DOJI"},
			"silver":   {"SILVER_1L"},
			"currency": {"USD"},
		},
	}
	svc := NewAssetPriceService(repo, configRepo, &mockSilverPriceSvc{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	result, err := svc.GetMarketTypes(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.Gold) != 2 {
		t.Errorf("expected 2 gold types, got %d", len(result.Gold))
	}
	if len(result.Silver) != 1 {
		t.Errorf("expected 1 silver type, got %d", len(result.Silver))
	}
	if len(result.Currency) != 1 {
		t.Errorf("expected 1 currency type, got %d", len(result.Currency))
	}

	// GoldUpdatedAt should be max of t1 and t2 = t2.
	if result.GoldUpdatedAt != t2.Unix() {
		t.Errorf("expected GoldUpdatedAt=%d, got %d", t2.Unix(), result.GoldUpdatedAt)
	}
	// SilverUpdatedAt = t3.
	if result.SilverUpdatedAt != t3.Unix() {
		t.Errorf("expected SilverUpdatedAt=%d, got %d", t3.Unix(), result.SilverUpdatedAt)
	}
	// CurrencyUpdatedAt = t1.
	if result.CurrencyUpdatedAt != t1.Unix() {
		t.Errorf("expected CurrencyUpdatedAt=%d, got %d", t1.Unix(), result.CurrencyUpdatedAt)
	}

	// Verify MarketTypeItem fields.
	if result.Gold[0].Code != "SJC" {
		t.Errorf("expected Gold[0].Code=SJC, got %q", result.Gold[0].Code)
	}
	if result.Currency[0].Code != "USD" {
		t.Errorf("expected Currency[0].Code=USD, got %q", result.Currency[0].Code)
	}
}

func TestAssetPriceService_GetMarketTypes_EmptyDB(t *testing.T) {
	// When configRepo returns empty type codes, ListByAssetTypeFiltered short-circuits to empty.
	repo := &mockAssetPriceRepo{}
	configRepo := &mockAssetDisplayConfigRepo{} // returns [] for all asset types
	svc := NewAssetPriceService(repo, configRepo, &mockSilverPriceSvc{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	result, err := svc.GetMarketTypes(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Gold) != 0 || len(result.Silver) != 0 || len(result.Currency) != 0 {
		t.Error("expected empty slices for all types")
	}
	if result.GoldUpdatedAt != 0 || result.SilverUpdatedAt != 0 || result.CurrencyUpdatedAt != 0 {
		t.Error("expected zero timestamps when DB is empty")
	}
}

// ---------------------------------------------------------------------------
// Tests: GetPriceByTypeCode
// ---------------------------------------------------------------------------

func TestAssetPriceService_GetPriceByTypeCode_Found(t *testing.T) {
	now := time.Now()
	rows := []*models.AssetPrice{
		{TypeCode: "SJC_1L", AssetType: "gold", Name: "SJC 1 Luong", Buy: 8500000, Sell: 8600000, Currency: "VND", IsStale: false, FetchedAt: now},
		{TypeCode: "DOJI", AssetType: "gold", Name: "DOJI Bar", Buy: 8400000, Sell: 8500000, Currency: "VND", IsStale: false, FetchedAt: now},
		{TypeCode: "SILVER_1L", AssetType: "silver", Name: "Silver 1L", Buy: 200000, Sell: 210000, Currency: "VND", IsStale: false, FetchedAt: now},
	}

	repo := &mockAssetPriceRepo{listAllResult: rows}
	svc := NewAssetPriceService(repo, nil, &mockSilverPriceSvc{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	dto, err := svc.GetPriceByTypeCode(context.Background(), "SJC_1L")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if dto == nil {
		t.Fatal("expected DTO to be returned, got nil")
	}
	if dto.TypeCode != "SJC_1L" {
		t.Errorf("expected TypeCode=SJC_1L, got %q", dto.TypeCode)
	}
	if dto.Buy != 8500000 {
		t.Errorf("expected Buy=8500000, got %d", dto.Buy)
	}
	if dto.Sell != 8600000 {
		t.Errorf("expected Sell=8600000, got %d", dto.Sell)
	}
	if dto.Currency != "VND" {
		t.Errorf("expected Currency=VND, got %q", dto.Currency)
	}
	if dto.IsStale {
		t.Error("expected IsStale=false")
	}
}

func TestAssetPriceService_GetPriceByTypeCode_NotFound(t *testing.T) {
	now := time.Now()
	rows := []*models.AssetPrice{
		{TypeCode: "SJC_1L", AssetType: "gold", Name: "SJC 1 Luong", Buy: 8500000, Sell: 8600000, Currency: "VND", FetchedAt: now},
		{TypeCode: "DOJI", AssetType: "gold", Name: "DOJI Bar", Buy: 8400000, Sell: 8500000, Currency: "VND", FetchedAt: now},
	}

	repo := &mockAssetPriceRepo{listAllResult: rows}
	svc := NewAssetPriceService(repo, nil, &mockSilverPriceSvc{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	dto, err := svc.GetPriceByTypeCode(context.Background(), "NONEXISTENT")
	if err != nil {
		t.Fatalf("expected no error for missing typeCode, got: %v", err)
	}
	if dto != nil {
		t.Errorf("expected nil DTO for missing typeCode, got: %+v", dto)
	}
}

func TestAssetPriceService_GetPriceByTypeCode_RepoError(t *testing.T) {
	repoErr := errors.New("db connection refused")
	repo := &mockAssetPriceRepo{listAllErr: repoErr}
	svc := NewAssetPriceService(repo, nil, &mockSilverPriceSvc{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	dto, err := svc.GetPriceByTypeCode(context.Background(), "SJC_1L")
	if err == nil {
		t.Fatal("expected error from repo, got nil")
	}
	if dto != nil {
		t.Errorf("expected nil DTO on error, got: %+v", dto)
	}
	if err.Error() != repoErr.Error() {
		t.Errorf("expected error %q, got %q", repoErr.Error(), err.Error())
	}
}

// ---------------------------------------------------------------------------
// Tests: refreshGoldVangSaiGon alias normalization
// (deduplication within a single source is no longer needed — the 3-column
// unique index (type_code, source) handles collisions at the DB level)
// ---------------------------------------------------------------------------

func TestAssetPriceService_RefreshGoldVangSaiGon_AliasNormalization(t *testing.T) {
	// VangSaiGon may return alias TypeCodes that map to canonical codes.
	// refreshGoldVangSaiGon must normalize them before upsert.
	aliasPrices := []*CachedGoldPrice{
		{TypeCode: "SJC", Name: "Vàng SJC 9999", Buy: 8500000, Sell: 8600000, Currency: "VND", UpdateTime: time.Now()},
		{TypeCode: "BTMC_24K", Name: "Bảo Tín 24K", Buy: 7800000, Sell: 7900000, Currency: "VND", UpdateTime: time.Now()},
	}

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		nil,
		&mockSilverPriceSvc{},
		&mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, prices: aliasPrices},
		&mockSimpleGoldPriceFetcher{source: SourceVangToday, err: errors.New("vangtoday off")},
		nil, nil, nil, // currency fetchers: vsg, vt, vcb
		nil, nil, nil, nil, nil,
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Find the vangsaigon gold batch.
	var goldBatch []*models.AssetPrice
	for _, batch := range repo.upsertedBatches {
		if len(batch) > 0 && batch[0].Source == "vangsaigon" {
			goldBatch = batch
			break
		}
	}
	if goldBatch == nil {
		t.Fatal("no vangsaigon gold batch was upserted")
	}

	// Verify source tag.
	for _, item := range goldBatch {
		if item.Source != "vangsaigon" {
			t.Errorf("expected Source=vangsaigon, got %q", item.Source)
		}
		if item.AssetType != "gold" {
			t.Errorf("expected AssetType=gold, got %q", item.AssetType)
		}
	}
}

// ---------------------------------------------------------------------------
// Tests: Source="waterfall" field set in all refresh methods
// ---------------------------------------------------------------------------

func TestRefreshSilver_SetsSourceWaterfall(t *testing.T) {
	silverPrices := makeSilverPrices(2)

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		nil,
		&mockSilverPriceSvc{prices: silverPrices},
		nil, nil,
		nil, nil, nil, // currency fetchers: vsg, vt, vcb
		nil, nil, nil, nil, nil,
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Find the silver batch.
	var silverBatch []*models.AssetPrice
	for _, batch := range repo.upsertedBatches {
		if len(batch) > 0 && batch[0].AssetType == "silver" {
			silverBatch = batch
			break
		}
	}
	if silverBatch == nil {
		t.Fatal("no silver batch was upserted")
	}

	// Every item in the silver batch must have Source="waterfall".
	for _, item := range silverBatch {
		if item.Source != "waterfall" {
			t.Errorf("silver item TypeCode=%q: expected Source=%q, got %q", item.TypeCode, "waterfall", item.Source)
		}
	}
}

// TestRefreshCurrency_NilFetchersNoUpsert verifies that with nil currency fetchers,
// no currency batches are upserted (each nil fetcher marks stale and returns error).
// This replaces the old TestRefreshCurrency_SetsSourceWaterfall test which verified
// the now-removed waterfall single-source currency path.
func TestRefreshCurrency_NilFetchersNoUpsert(t *testing.T) {
	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		nil,
		&mockSilverPriceSvc{},
		nil, nil,
		nil, nil, nil, // currency fetchers: vsg, vt, vcb (all nil)
		nil, nil, nil, nil, nil,
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error (not all sources should fail): %v", err)
	}

	// No currency batches should have been upserted.
	for _, batch := range repo.upsertedBatches {
		if len(batch) > 0 && batch[0].AssetType == "currency" {
			t.Errorf("expected no currency batch with nil fetchers, got a batch of %d items", len(batch))
		}
	}

	// "currency" should appear in staledTypes 3 times (one per nil fetcher).
	currencyStaleCount := 0
	for _, st := range repo.staledTypes {
		if st == "currency" {
			currencyStaleCount++
		}
	}
	if currencyStaleCount != 3 {
		t.Errorf("expected 3 currency stale marks (one per nil fetcher), got %d; staledTypes=%v", currencyStaleCount, repo.staledTypes)
	}
}

// ---------------------------------------------------------------------------
// Tests: New per-source gold refresh (SJC, DOJI, BTMC, PNJ)
// ---------------------------------------------------------------------------


func TestRefreshAllPrices_IncludesNewSources(t *testing.T) {
	goldPrices := makeGoldPrices(2)
	silverPrices := makeSilverPrices(1)

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		nil,
		&mockSilverPriceSvc{prices: silverPrices},
		&mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, prices: goldPrices},
		&mockSimpleGoldPriceFetcher{source: SourceVangToday, err: errors.New("vangtoday off")},
		nil, nil, nil, // currency fetchers: vsg, vt, vcb (nil → fail)
		nil, // sjcClient nil = skipped
		nil, // dojiClient
		nil, // btmcClient
		nil, // pnjClient
		nil, // mihongClient
	)

	err := svc.RefreshAllPrices(context.Background())
	// With nil currency fetchers + vangtoday failure + nil gold clients, failCount = 8 < 10 → no error.
	if err != nil {
		t.Fatalf("expected no error when 2/10 sources succeed, got: %v", err)
	}

	// Two batches: vangsaigon gold, silver. vangtoday, nil currency fetchers, and nil gold clients skip UpsertBatch.
	if len(repo.upsertedBatches) != 2 {
		t.Fatalf("expected 2 upsert batches (vangsaigon gold + silver), got %d", len(repo.upsertedBatches))
	}
}

func TestRefreshAllPrices_SourceFailureIndependent(t *testing.T) {
	// With nil SJC/DOJI/BTMC/PNJ clients and nil currency fetchers:
	// their refresh methods return "not configured" error.
	// vangsaigon gold + vangtoday gold + silver succeed; currency fetchers are nil (all fail).
	goldPrices := makeGoldPrices(2)
	silverPrices := makeSilverPrices(1)

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		nil,
		&mockSilverPriceSvc{prices: silverPrices},
		&mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, prices: goldPrices},
		&mockSimpleGoldPriceFetcher{source: SourceVangToday, prices: goldPrices},
		nil, nil, nil, // currency fetchers: vsg, vt, vcb (nil → fail)
		nil, // sjcClient nil — triggers "not configured" failure
		nil, // dojiClient nil
		nil, // btmcClient nil
		nil, // pnjClient nil
		nil, // mihongClient nil
	)

	err := svc.RefreshAllPrices(context.Background())
	// 5 nil gold-client failures + 3 nil currency fetcher failures = 8 < 11 → no error.
	if err != nil {
		t.Fatalf("expected no error with partial failure, got: %v", err)
	}

	// Nil gold clients call MarkStaleByAssetTypeAndSource("gold", <source>) → "gold" 5 times.
	// Nil currency fetchers call MarkStaleByAssetTypeAndSource("currency", <source>) → "currency" 3 times.
	goldStaleCount := 0
	for _, st := range repo.staledTypes {
		if st == "gold" {
			goldStaleCount++
		}
	}
	if goldStaleCount != 5 {
		t.Errorf("expected 5 gold stale marks (one per nil client), got %d; staledTypes=%v", goldStaleCount, repo.staledTypes)
	}

	// vangsaigon gold, vangtoday gold, silver should upsert (3 batches); no currency batches.
	if len(repo.upsertedBatches) != 3 {
		t.Errorf("expected 3 upsert batches (vangsaigon + vangtoday + silver), got %d", len(repo.upsertedBatches))
	}
}

func TestRefreshAllPrices_AllFailIncludingNilClients(t *testing.T) {
	// Both gold fetchers fail + 4 nil clients + silver fails + currency fails = 8 total failures → must return error.
	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		nil,
		&mockSilverPriceSvc{err: errTest},
		&mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, err: errTest},
		&mockSimpleGoldPriceFetcher{source: SourceVangToday, err: errTest},
		nil, nil, nil, // currency fetchers: vsg, vt, vcb
		nil, nil, nil, nil, nil,
	)

	err := svc.RefreshAllPrices(context.Background())
	if err == nil {
		t.Fatal("expected error when all 8 sources fail, got nil")
	}
}

var errTest = errors.New("test error")

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

func contains(slice []string, s string) bool {
	for _, v := range slice {
		if v == s {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// Tests: GetPriceByTypeCode — no collision between waterfall and source-prefixed codes
// ---------------------------------------------------------------------------

// TestGetPriceByTypeCode_NoCollisionWithSourcePrefixedCodes verifies that
// GetPriceByTypeCode performs exact string matching and never confuses a
// short waterfall code (e.g. "SJC") with a longer source-prefixed code
// (e.g. "SJC_1L").  The two rows coexist in the DB because the unique
// index is (type_code, source), so "SJC"/waterfall and "SJC_1L"/sjc are
// separate rows.  GetPriceByTypeCode("SJC") must return only the waterfall
// row; GetPriceByTypeCode("SJC_1L") must return only the sjc row.
func TestGetPriceByTypeCode_NoCollisionWithSourcePrefixedCodes(t *testing.T) {
	now := time.Now()
	rows := []*models.AssetPrice{
		// Waterfall canonical row — short code "SJC"
		{TypeCode: "SJC", AssetType: "gold", Name: "SJC 9999 (waterfall)", Buy: 8500000, Sell: 8600000, Currency: "VND", IsStale: false, FetchedAt: now},
		// SJC-source-prefixed row — longer code "SJC_1L"
		{TypeCode: "SJC_1L", AssetType: "gold", Name: "SJC 1 Luong (sjc direct)", Buy: 8510000, Sell: 8610000, Currency: "VND", IsStale: false, FetchedAt: now},
		// Unrelated rows that must not interfere.
		{TypeCode: "DOJI_1L", AssetType: "gold", Name: "DOJI 1 Luong", Buy: 8400000, Sell: 8500000, Currency: "VND", IsStale: false, FetchedAt: now},
	}

	repo := &mockAssetPriceRepo{listAllResult: rows}
	svc := NewAssetPriceService(repo, nil, &mockSilverPriceSvc{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	// GetPriceByTypeCode("SJC") must return only the waterfall row, not "SJC_1L".
	t.Run("waterfall code returns waterfall row only", func(t *testing.T) {
		dto, err := svc.GetPriceByTypeCode(context.Background(), "SJC")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if dto == nil {
			t.Fatal("expected DTO for 'SJC', got nil")
		}
		if dto.TypeCode != "SJC" {
			t.Errorf("expected TypeCode='SJC', got %q", dto.TypeCode)
		}
		if dto.Buy != 8500000 {
			t.Errorf("expected waterfall Buy=8500000, got %d (collision with SJC_1L?)", dto.Buy)
		}
	})

	// GetPriceByTypeCode("SJC_1L") must return only the source-prefixed row, not "SJC".
	t.Run("source-prefixed code returns source row only", func(t *testing.T) {
		dto, err := svc.GetPriceByTypeCode(context.Background(), "SJC_1L")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if dto == nil {
			t.Fatal("expected DTO for 'SJC_1L', got nil")
		}
		if dto.TypeCode != "SJC_1L" {
			t.Errorf("expected TypeCode='SJC_1L', got %q", dto.TypeCode)
		}
		if dto.Buy != 8510000 {
			t.Errorf("expected sjc-source Buy=8510000, got %d (collision with SJC?)", dto.Buy)
		}
	})

	// Neither "SJC" nor "SJC_1L" should match "DOJI_1L".
	t.Run("unrelated code not matched by prefix lookup", func(t *testing.T) {
		dto, err := svc.GetPriceByTypeCode(context.Background(), "DOJI")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if dto != nil {
			t.Errorf("expected nil DTO for 'DOJI' (not in DB), but got TypeCode=%q", dto.TypeCode)
		}
	})
}

// ---------------------------------------------------------------------------
// Tests: VangSaiGon / VangToday goroutines (TDD — will compile once Task 1
// changes NewAssetPriceService to accept vsgFetcher and vtFetcher)
// ---------------------------------------------------------------------------

func TestRefreshAllPrices_VangSaiGonSuccess(t *testing.T) {
	repo := &mockAssetPriceRepo{}
	vsgFetcher := &mockSimpleGoldPriceFetcher{
		source: SourceVangSaiGon,
		prices: []*CachedGoldPrice{
			{TypeCode: "SJC", Name: "Vàng SJC", Buy: 90_000_000, Sell: 92_000_000, Currency: "VND"},
		},
	}
	vtFetcher := &mockSimpleGoldPriceFetcher{source: SourceVangToday, err: fmt.Errorf("vangtoday down")}
	silverSvc := &mockSilverPriceSvc{}
	svc := NewAssetPriceService(repo, nil, silverSvc, vsgFetcher, vtFetcher, nil, nil, nil, nil, nil, nil, nil, nil)
	err := svc.RefreshAllPrices(context.Background())
	// Should not error (not all 8 failed)
	require.NoError(t, err)
	repo.mu.Lock()
	defer repo.mu.Unlock()
	var vsgBatch []*models.AssetPrice
	for _, batch := range repo.upsertedBatches {
		for _, p := range batch {
			if p.Source == "vangsaigon" {
				vsgBatch = append(vsgBatch, p)
			}
		}
	}
	require.NotEmpty(t, vsgBatch, "expected at least one upserted row with source=vangsaigon")
	assert.Equal(t, "SJC", vsgBatch[0].TypeCode)
	assert.Equal(t, "vangsaigon", vsgBatch[0].Source)
	assert.Equal(t, "gold", vsgBatch[0].AssetType)
}

func TestRefreshAllPrices_VangTodaySuccess(t *testing.T) {
	repo := &mockAssetPriceRepo{}
	vsgFetcher := &mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, err: fmt.Errorf("vangsaigon down")}
	vtFetcher := &mockSimpleGoldPriceFetcher{
		source: SourceVangToday,
		prices: []*CachedGoldPrice{
			{TypeCode: "DOJI", Name: "Vàng DOJI", Buy: 88_000_000, Sell: 90_000_000, Currency: "VND"},
		},
	}
	silverSvc := &mockSilverPriceSvc{}
	svc := NewAssetPriceService(repo, nil, silverSvc, vsgFetcher, vtFetcher, nil, nil, nil, nil, nil, nil, nil, nil)
	err := svc.RefreshAllPrices(context.Background())
	require.NoError(t, err)
	repo.mu.Lock()
	defer repo.mu.Unlock()
	var vtBatch []*models.AssetPrice
	for _, batch := range repo.upsertedBatches {
		for _, p := range batch {
			if p.Source == "vangtoday" {
				vtBatch = append(vtBatch, p)
			}
		}
	}
	require.NotEmpty(t, vtBatch, "expected at least one upserted row with source=vangtoday")
	assert.Equal(t, "DOJI", vtBatch[0].TypeCode)
	assert.Equal(t, "vangtoday", vtBatch[0].Source)
}

func TestRefreshAllPrices_VangSaiGonFail_MarksStale(t *testing.T) {
	repo := &mockAssetPriceRepo{}
	vsgFetcher := &mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, err: fmt.Errorf("vangsaigon timeout")}
	vtFetcher := &mockSimpleGoldPriceFetcher{
		source: SourceVangToday,
		prices: []*CachedGoldPrice{
			{TypeCode: "SJC", Name: "SJC", Buy: 90_000_000, Sell: 92_000_000, Currency: "VND"},
		},
	}
	silverSvc := &mockSilverPriceSvc{}
	svc := NewAssetPriceService(repo, nil, silverSvc, vsgFetcher, vtFetcher, nil, nil, nil, nil, nil, nil, nil, nil)
	err := svc.RefreshAllPrices(context.Background())
	require.NoError(t, err)
	// vangsaigon failure should trigger MarkStaleByAssetTypeAndSource for gold
	repo.mu.Lock()
	defer repo.mu.Unlock()
	found := false
	for _, st := range repo.staledTypes {
		if st == "gold" {
			found = true
			break
		}
	}
	assert.True(t, found, "expected gold to be marked stale after vangsaigon failure")
}

func TestRefreshAllPrices_VangSaiGonEmptyPrices_MarksStale(t *testing.T) {
	repo := &mockAssetPriceRepo{}
	// VangSaiGon returns empty slice — no valid prices
	vsgFetcher := &mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, prices: []*CachedGoldPrice{}}
	vtFetcher := &mockSimpleGoldPriceFetcher{
		source: SourceVangToday,
		prices: []*CachedGoldPrice{
			{TypeCode: "BTMC", Name: "BTMC", Buy: 87_000_000, Sell: 89_000_000, Currency: "VND"},
		},
	}
	silverSvc := &mockSilverPriceSvc{}
	svc := NewAssetPriceService(repo, nil, silverSvc, vsgFetcher, vtFetcher, nil, nil, nil, nil, nil, nil, nil, nil)
	err := svc.RefreshAllPrices(context.Background())
	require.NoError(t, err) // not all sources failed
	// Empty result should still mark stale
	repo.mu.Lock()
	defer repo.mu.Unlock()
	found := false
	for _, st := range repo.staledTypes {
		if st == "gold" {
			found = true
			break
		}
	}
	assert.True(t, found, "expected gold to be marked stale when vangsaigon returns empty prices")
}

// ---------------------------------------------------------------------------
// Tests: refreshGoldVangSaiGon — raw TypeCode stored as-is (no normalization)
// ---------------------------------------------------------------------------

// TestRefreshGoldVangSaiGon_StoresRawTypeCode verifies that raw TypeCodes returned
// by the vangsaigon fetcher are written as-is to the asset_price table —
// NOT normalized through AliasToCanonical.
func TestRefreshGoldVangSaiGon_StoresRawTypeCode(t *testing.T) {
	// "VNGSJC" is in AliasToCanonical (maps to "SJC").
	// Before this fix, refreshGoldVangSaiGon would normalize it to "SJC".
	// After the fix, it must be stored as raw "VNGSJC".
	rawTypeCode := "VNGSJC"
	repo := &mockAssetPriceRepo{}
	svc := &assetPriceService{
		repo: repo,
		vangSaiGonFetcher: &mockSimpleGoldPriceFetcher{
			source: SourceVangSaiGon,
			prices: []*CachedGoldPrice{
				{TypeCode: rawTypeCode, Name: "Vàng SJC VNG", Buy: 172_000_000, Sell: 175_000_000, Currency: "VND"},
			},
		},
	}

	result := svc.refreshGoldVangSaiGon(context.Background())

	if result.err != nil {
		t.Fatalf("unexpected error: %v", result.err)
	}
	if len(repo.upsertedBatches) != 1 {
		t.Fatalf("expected 1 upsert batch, got %d", len(repo.upsertedBatches))
	}
	if len(repo.upsertedBatches[0]) != 1 {
		t.Fatalf("expected 1 row upserted, got %d", len(repo.upsertedBatches[0]))
	}
	if got := repo.upsertedBatches[0][0].TypeCode; got != rawTypeCode {
		t.Errorf("TypeCode: expected raw %q, got %q (normalization should be removed)", rawTypeCode, got)
	}
}

// ---------------------------------------------------------------------------
// Tests: mockAssetPriceRepo.ListByAssetTypeFiltered behavior contract
// These tests verify the contract that will be relied upon by the service layer.
// ---------------------------------------------------------------------------

// TestListByAssetTypeFiltered_ReturnsMatchingRows verifies that only prices
// whose TypeCode is in enabledTypeCodes are returned.
func TestListByAssetTypeFiltered_ReturnsMatchingRows(t *testing.T) {
	ctx := context.Background()
	repo := &mockAssetPriceRepo{
		listByTypeResults: map[string][]*models.AssetPrice{
			"gold": {
				{TypeCode: "SJC", AssetType: "gold", Buy: 1000000, Sell: 1010000},
				{TypeCode: "DOJI", AssetType: "gold", Buy: 990000, Sell: 1005000},
				{TypeCode: "PNJ", AssetType: "gold", Buy: 985000, Sell: 1000000},
			},
		},
	}

	prices, err := repo.ListByAssetTypeFiltered(ctx, "gold", []string{"SJC", "PNJ"})

	require.NoError(t, err)
	require.Len(t, prices, 2)
	typeCodes := make(map[string]bool)
	for _, p := range prices {
		typeCodes[p.TypeCode] = true
	}
	assert.True(t, typeCodes["SJC"], "SJC should be included")
	assert.True(t, typeCodes["PNJ"], "PNJ should be included")
	assert.False(t, typeCodes["DOJI"], "DOJI should be excluded")
}

// TestListByAssetTypeFiltered_EmptyAllowlist_ReturnsImmediately verifies that
// when enabledTypeCodes is empty, an empty slice is returned without touching
// the underlying data source (early-return / no DB query path).
func TestListByAssetTypeFiltered_EmptyAllowlist_ReturnsImmediately(t *testing.T) {
	ctx := context.Background()
	// listByTypeErr is set — if a DB call were made, it would propagate the error.
	// The early-return must happen BEFORE any data access.
	repo := &mockAssetPriceRepo{
		listByTypeErr: fmt.Errorf("should not be called"),
		listByTypeResults: map[string][]*models.AssetPrice{
			"gold": {
				{TypeCode: "SJC", AssetType: "gold", Buy: 1000000, Sell: 1010000},
			},
		},
	}

	prices, err := repo.ListByAssetTypeFiltered(ctx, "gold", []string{})

	require.NoError(t, err, "empty allowlist must early-return with no error, even when DB would fail")
	assert.Empty(t, prices, "empty allowlist must return empty slice")
}

// TestListByAssetTypeFiltered_DBError_Propagated verifies that errors from the
// underlying store are propagated to the caller.
func TestListByAssetTypeFiltered_DBError_Propagated(t *testing.T) {
	ctx := context.Background()
	dbErr := fmt.Errorf("connection refused")
	repo := &mockAssetPriceRepo{
		listByTypeErr: dbErr,
	}

	prices, err := repo.ListByAssetTypeFiltered(ctx, "gold", []string{"SJC"})

	require.Error(t, err)
	assert.Nil(t, prices)
	assert.Contains(t, err.Error(), "connection refused")
}

// ---------------------------------------------------------------------------
// Tests: GetAllPrices + GetMarketTypes filtering via configRepo
// ---------------------------------------------------------------------------

// TestAssetPriceService_GetAllPrices_FiltersDisabledConfigs verifies that only
// type codes enabled in the display config are returned in GetAllPrices.
func TestAssetPriceService_GetAllPrices_FiltersDisabledConfigs(t *testing.T) {
	now := time.Now()
	repo := &mockAssetPriceRepo{
		listByTypeResults: map[string][]*models.AssetPrice{
			"gold": {
				{TypeCode: "SJC_1L", AssetType: "gold", Name: "SJC 1 Lượng", Buy: 8500000, Sell: 8600000, Currency: "VND", FetchedAt: now},
				{TypeCode: "DOJI", AssetType: "gold", Name: "DOJI", Buy: 8400000, Sell: 8500000, Currency: "VND", FetchedAt: now},
			},
		},
	}
	// Only SJC_1L is enabled; DOJI is disabled.
	configRepo := &mockAssetDisplayConfigRepo{
		enabledCodes: map[string][]string{
			"gold":     {"SJC_1L"},
			"silver":   {},
			"currency": {},
		},
	}
	svc := NewAssetPriceService(repo, configRepo, &mockSilverPriceSvc{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	result, err := svc.GetAllPrices(context.Background())
	require.NoError(t, err)

	// Only SJC_1L should appear; DOJI is excluded.
	require.Len(t, result.Gold, 1, "expected 1 gold price (SJC_1L only)")
	assert.Equal(t, "SJC_1L", result.Gold[0].TypeCode)
	assert.Empty(t, result.Silver)
	assert.Empty(t, result.Currency)
}

// TestAssetPriceService_GetAllPrices_EmptyDisplayConfig verifies that when
// display config returns no enabled codes, all asset type slices are empty.
func TestAssetPriceService_GetAllPrices_EmptyDisplayConfig(t *testing.T) {
	now := time.Now()
	repo := &mockAssetPriceRepo{
		listByTypeResults: map[string][]*models.AssetPrice{
			"gold": {
				{TypeCode: "SJC", AssetType: "gold", Buy: 8500000, Sell: 8600000, Currency: "VND", FetchedAt: now},
			},
		},
	}
	// configRepo returns empty slice for all types → no prices shown.
	configRepo := &mockAssetDisplayConfigRepo{} // default: returns [] for all
	svc := NewAssetPriceService(repo, configRepo, &mockSilverPriceSvc{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	result, err := svc.GetAllPrices(context.Background())
	require.NoError(t, err)

	assert.Empty(t, result.Gold)
	assert.Empty(t, result.Silver)
	assert.Empty(t, result.Currency)
}

// TestAssetPriceService_GetAllPrices_ConfigRepoError verifies that a configRepo error
// is propagated immediately from GetAllPrices.
func TestAssetPriceService_GetAllPrices_ConfigRepoError(t *testing.T) {
	configErr := fmt.Errorf("config DB down")
	repo := &mockAssetPriceRepo{}
	configRepo := &mockAssetDisplayConfigRepo{enabledCodesErr: configErr}
	svc := NewAssetPriceService(repo, configRepo, &mockSilverPriceSvc{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	_, err := svc.GetAllPrices(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "config DB down")
}

// TestAssetPriceService_GetMarketTypes_FiltersDisabledConfigs verifies that only
// type codes enabled in the display config appear in GetMarketTypes results.
func TestAssetPriceService_GetMarketTypes_FiltersDisabledConfigs(t *testing.T) {
	t1 := time.Unix(1700000000, 0)
	t2 := time.Unix(1700001000, 0)
	repo := &mockAssetPriceRepo{
		listByTypeResults: map[string][]*models.AssetPrice{
			"gold": {
				{TypeCode: "SJC", AssetType: "gold", Name: "SJC", Currency: "VND", FetchedAt: t1},
				{TypeCode: "DOJI", AssetType: "gold", Name: "DOJI", Currency: "VND", FetchedAt: t2},
			},
		},
	}
	// Only SJC is enabled; DOJI is disabled.
	configRepo := &mockAssetDisplayConfigRepo{
		enabledCodes: map[string][]string{
			"gold":     {"SJC"},
			"silver":   {},
			"currency": {},
		},
	}
	svc := NewAssetPriceService(repo, configRepo, &mockSilverPriceSvc{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	result, err := svc.GetMarketTypes(context.Background())
	require.NoError(t, err)

	require.Len(t, result.Gold, 1, "expected 1 gold type (SJC only)")
	assert.Equal(t, "SJC", result.Gold[0].Code)
	assert.Empty(t, result.Silver)
	assert.Empty(t, result.Currency)
	// GoldUpdatedAt = t1 (only SJC row).
	assert.Equal(t, t1.Unix(), result.GoldUpdatedAt)
}

// TestAssetPriceService_GetMarketTypes_EmptyDisplayConfig_AllZero verifies that when
// display config returns no enabled codes, all slices are empty and all timestamps are 0.
func TestAssetPriceService_GetMarketTypes_EmptyDisplayConfig_AllZero(t *testing.T) {
	repo := &mockAssetPriceRepo{}
	configRepo := &mockAssetDisplayConfigRepo{} // returns [] for all asset types
	svc := NewAssetPriceService(repo, configRepo, &mockSilverPriceSvc{}, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	result, err := svc.GetMarketTypes(context.Background())
	require.NoError(t, err)

	assert.Empty(t, result.Gold)
	assert.Empty(t, result.Silver)
	assert.Empty(t, result.Currency)
	assert.Zero(t, result.GoldUpdatedAt)
	assert.Zero(t, result.SilverUpdatedAt)
	assert.Zero(t, result.CurrencyUpdatedAt)
}
