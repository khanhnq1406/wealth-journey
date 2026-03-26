package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

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

// ---------------------------------------------------------------------------
// Mock: GoldPriceService
// ---------------------------------------------------------------------------

type mockGoldPriceSvc struct {
	prices []*CachedGoldPrice
	err    error
}

func (m *mockGoldPriceSvc) FetchAllPrices(_ context.Context) ([]*CachedGoldPrice, error) {
	return m.prices, m.err
}

func (m *mockGoldPriceSvc) FetchPriceForSymbol(_ context.Context, _ string) (*CachedGoldPrice, error) {
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
// Mock: CurrencyPriceService
// ---------------------------------------------------------------------------

type mockCurrencyPriceSvc struct {
	prices []*CachedCurrencyPrice
	err    error
}

func (m *mockCurrencyPriceSvc) FetchAllPrices(_ context.Context) ([]*CachedCurrencyPrice, error) {
	return m.prices, m.err
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

func makeCurrencyPrices(n int) []*CachedCurrencyPrice {
	prices := make([]*CachedCurrencyPrice, n)
	for i := range prices {
		prices[i] = &CachedCurrencyPrice{
			TypeCode:   "USD_" + string(rune('A'+i)),
			Name:       "Dollar " + string(rune('A'+i)),
			Buy:        int64(25000 * (i + 1)),
			Sell:       int64(25200 * (i + 1)),
			ChangeBuy:  0,
			ChangeSell: 0,
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
	goldPrices := makeGoldPrices(3)
	silverPrices := makeSilverPrices(2)
	currencyPrices := makeCurrencyPrices(4)

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{prices: goldPrices},
		&mockSilverPriceSvc{prices: silverPrices},
		&mockCurrencyPriceSvc{prices: currencyPrices},
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	// Three batches should have been upserted (gold, silver, currency).
	if len(repo.upsertedBatches) != 3 {
		t.Fatalf("expected 3 upsert batches, got %d", len(repo.upsertedBatches))
	}

	// Counts must match input sizes — batches arrive in non-deterministic order,
	// so collect sizes into a set and compare.
	batchSizes := make(map[int]int)
	for _, batch := range repo.upsertedBatches {
		batchSizes[len(batch)]++
	}
	if batchSizes[3] != 1 {
		t.Errorf("gold batch: expected exactly 1 batch with 3 items; sizes=%v", batchSizes)
	}
	if batchSizes[2] != 1 {
		t.Errorf("silver batch: expected exactly 1 batch with 2 items; sizes=%v", batchSizes)
	}
	if batchSizes[4] != 1 {
		t.Errorf("currency batch: expected exactly 1 batch with 4 items; sizes=%v", batchSizes)
	}

	// No types should have been marked stale.
	if len(repo.staledTypes) != 0 {
		t.Errorf("expected no stale marks, got: %v", repo.staledTypes)
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
	currencyPrices := makeCurrencyPrices(3)

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{err: goldErr},
		&mockSilverPriceSvc{prices: silverPrices},
		&mockCurrencyPriceSvc{prices: currencyPrices},
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

	// Silver and currency should have been upserted (2 batches).
	if len(repo.upsertedBatches) != 2 {
		t.Errorf("expected 2 upsert batches (silver + currency), got %d", len(repo.upsertedBatches))
	}
}

func TestAssetPriceService_RefreshAllPrices_AllFail(t *testing.T) {
	goldErr := errors.New("gold API down")
	silverErr := errors.New("silver API down")
	currencyErr := errors.New("currency API down")

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{err: goldErr},
		&mockSilverPriceSvc{err: silverErr},
		&mockCurrencyPriceSvc{err: currencyErr},
	)

	err := svc.RefreshAllPrices(context.Background())
	if err == nil {
		t.Fatal("expected error when all price types fail, got nil")
	}

	// All three types should have been marked stale.
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
	currencyPrices := makeCurrencyPrices(1)

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{prices: goldPrices},
		&mockSilverPriceSvc{prices: silverPrices},
		&mockCurrencyPriceSvc{prices: currencyPrices},
	)

	_ = svc.RefreshAllPrices(context.Background())

	if len(repo.upsertedBatches) != 3 {
		t.Fatalf("expected 3 batches")
	}

	// Collect all items across batches — order is non-deterministic with concurrent refresh.
	seenTypes := make(map[string]int)
	for _, batch := range repo.upsertedBatches {
		for _, item := range batch {
			seenTypes[item.AssetType]++
		}
	}
	for _, expectedType := range []string{"gold", "silver", "currency"} {
		if seenTypes[expectedType] != 1 {
			t.Errorf("expected exactly 1 item with AssetType %q, got %d; seenTypes=%v", expectedType, seenTypes[expectedType], seenTypes)
		}
	}
}

// ---------------------------------------------------------------------------
// Tests: GetAllPrices
// ---------------------------------------------------------------------------

func TestAssetPriceService_GetAllPrices_GroupsByAssetType(t *testing.T) {
	now := time.Now()
	rows := []*models.AssetPrice{
		{TypeCode: "SJC", AssetType: "gold", Name: "SJC Bar", Buy: 1000, Sell: 1010, Currency: "VND", FetchedAt: now},
		{TypeCode: "DOJI", AssetType: "gold", Name: "DOJI Bar", Buy: 990, Sell: 1000, Currency: "VND", FetchedAt: now},
		{TypeCode: "SILVER_1L", AssetType: "silver", Name: "Silver 1L", Buy: 200, Sell: 210, Currency: "VND", FetchedAt: now},
		{TypeCode: "USD", AssetType: "currency", Name: "US Dollar", Buy: 25000, Sell: 25200, Currency: "VND", FetchedAt: now},
		{TypeCode: "EUR", AssetType: "currency", Name: "Euro", Buy: 27000, Sell: 27200, Currency: "VND", FetchedAt: now},
	}

	repo := &mockAssetPriceRepo{listAllResult: rows}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{},
		&mockSilverPriceSvc{},
		&mockCurrencyPriceSvc{},
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
	repo := &mockAssetPriceRepo{listAllErr: errors.New("db down")}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{},
		&mockSilverPriceSvc{},
		&mockCurrencyPriceSvc{},
	)

	_, err := svc.GetAllPrices(context.Background())
	if err == nil {
		t.Fatal("expected error from repo, got nil")
	}
}

func TestAssetPriceService_GetAllPrices_IsStaleField(t *testing.T) {
	now := time.Now()
	rows := []*models.AssetPrice{
		{TypeCode: "SJC", AssetType: "gold", Name: "SJC", Buy: 1000, Sell: 1010, Currency: "VND", IsStale: true, FetchedAt: now},
	}

	repo := &mockAssetPriceRepo{listAllResult: rows}
	svc := NewAssetPriceService(repo, &mockGoldPriceSvc{}, &mockSilverPriceSvc{}, &mockCurrencyPriceSvc{})

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

	rows := []*models.AssetPrice{
		{TypeCode: "SJC", AssetType: "gold", Name: "SJC Bar", Currency: "VND", FetchedAt: t1},
		{TypeCode: "DOJI", AssetType: "gold", Name: "DOJI", Currency: "VND", FetchedAt: t2},
		{TypeCode: "SILVER_1L", AssetType: "silver", Name: "Silver 1L", Currency: "VND", FetchedAt: t3},
		{TypeCode: "USD", AssetType: "currency", Name: "US Dollar", Currency: "VND", FetchedAt: t1},
	}

	repo := &mockAssetPriceRepo{listAllResult: rows}
	svc := NewAssetPriceService(repo, &mockGoldPriceSvc{}, &mockSilverPriceSvc{}, &mockCurrencyPriceSvc{})

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
	repo := &mockAssetPriceRepo{listAllResult: []*models.AssetPrice{}}
	svc := NewAssetPriceService(repo, &mockGoldPriceSvc{}, &mockSilverPriceSvc{}, &mockCurrencyPriceSvc{})

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
