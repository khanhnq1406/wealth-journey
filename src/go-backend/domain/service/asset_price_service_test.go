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
		nil, nil, nil, nil,
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	// Three batches should have been upserted (gold, silver, currency).
	// Nil clients skip UpsertBatch; their errors count as failures but 3/7 succeed → no error.
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

	// Nil clients (sjc/doji/btmc/pnj) call MarkStaleByAssetTypeAndSource("gold", <source>)
	// which records "gold" in staledTypes. Exactly 4 such marks expected (one per nil client).
	goldStaleCount := 0
	for _, st := range repo.staledTypes {
		if st == "gold" {
			goldStaleCount++
		}
	}
	if goldStaleCount != 4 {
		t.Errorf("expected 4 stale marks from nil clients (gold×4), got: %v", repo.staledTypes)
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
		nil, nil, nil, nil,
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
		nil, nil, nil, nil, // nil clients also fail → total 7 failures
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
	currencyPrices := makeCurrencyPrices(1)

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{prices: goldPrices},
		&mockSilverPriceSvc{prices: silverPrices},
		&mockCurrencyPriceSvc{prices: currencyPrices},
		nil, nil, nil, nil,
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
		nil, nil, nil, nil,
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
		nil, nil, nil, nil,
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
	svc := NewAssetPriceService(repo, &mockGoldPriceSvc{}, &mockSilverPriceSvc{}, &mockCurrencyPriceSvc{}, nil, nil, nil, nil)

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
	svc := NewAssetPriceService(repo, &mockGoldPriceSvc{}, &mockSilverPriceSvc{}, &mockCurrencyPriceSvc{}, nil, nil, nil, nil)

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
	svc := NewAssetPriceService(repo, &mockGoldPriceSvc{}, &mockSilverPriceSvc{}, &mockCurrencyPriceSvc{}, nil, nil, nil, nil)

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
	svc := NewAssetPriceService(repo, &mockGoldPriceSvc{}, &mockSilverPriceSvc{}, &mockCurrencyPriceSvc{}, nil, nil, nil, nil)

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
	svc := NewAssetPriceService(repo, &mockGoldPriceSvc{}, &mockSilverPriceSvc{}, &mockCurrencyPriceSvc{}, nil, nil, nil, nil)

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
	svc := NewAssetPriceService(repo, &mockGoldPriceSvc{}, &mockSilverPriceSvc{}, &mockCurrencyPriceSvc{}, nil, nil, nil, nil)

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
// Tests: refreshGold deduplication (normalization is handled upstream by WaterfallGoldFetcher)
// ---------------------------------------------------------------------------

func TestAssetPriceService_RefreshGold_DeduplicatesCanonicalCodes(t *testing.T) {
	// Normalization (alias → canonical) now happens in WaterfallGoldFetcher.FetchGoldPrices,
	// so prices arriving at refreshGold are already canonical.
	// This test verifies that refreshGold correctly deduplicates identical canonical codes
	// (first-wins) and passes all unique codes through to the DB unchanged.
	canonicalPrices := []*CachedGoldPrice{
		{TypeCode: "SJC", Name: "SJC 9999", Buy: 8500000, Sell: 8600000, Currency: "VND", UpdateTime: time.Now()},
		{TypeCode: "Vàng nhẫn SJC", Name: "Nhẫn SJC 9999", Buy: 8000000, Sell: 8100000, Currency: "VND", UpdateTime: time.Now()},
		{TypeCode: "Mihong_999", Name: "Mi Hồng 999", Buy: 7900000, Sell: 8000000, Currency: "VND", UpdateTime: time.Now()},
		// Duplicate SJC — first-wins, this one should be dropped.
		{TypeCode: "SJC", Name: "SJC 9999 duplicate", Buy: 8550000, Sell: 8650000, Currency: "VND", UpdateTime: time.Now()},
		{TypeCode: "BTMC_24K", Name: "Bảo Tín 24K", Buy: 7800000, Sell: 7900000, Currency: "VND", UpdateTime: time.Now()},
	}

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{prices: canonicalPrices},
		&mockSilverPriceSvc{},
		&mockCurrencyPriceSvc{},
		nil, nil, nil, nil,
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Find the gold batch.
	var goldBatch []*models.AssetPrice
	for _, batch := range repo.upsertedBatches {
		if len(batch) > 0 && batch[0].AssetType == "gold" {
			goldBatch = batch
			break
		}
	}
	if goldBatch == nil {
		t.Fatal("no gold batch was upserted")
	}

	// Build a map typeCode → item for easy assertions.
	byCode := make(map[string]*models.AssetPrice)
	for _, item := range goldBatch {
		byCode[item.TypeCode] = item
	}

	// All canonical codes must be present.
	for _, code := range []string{"SJC", "Vàng nhẫn SJC", "Mihong_999", "BTMC_24K"} {
		if _, ok := byCode[code]; !ok {
			t.Errorf("expected canonical TypeCode %q in batch; got codes: %v", code, keys(byCode))
		}
	}

	// Duplicate SJC must be deduplicated — exactly 1 SJC row, with first-seen price.
	sjcCount := 0
	for _, item := range goldBatch {
		if item.TypeCode == "SJC" {
			sjcCount++
		}
	}
	if sjcCount != 1 {
		t.Errorf("expected exactly 1 row with TypeCode=SJC (deduplication), got %d", sjcCount)
	}
	if sjc, ok := byCode["SJC"]; ok && sjc.Buy != 8500000 {
		t.Errorf("expected first-seen SJC Buy=8500000, got %d", sjc.Buy)
	}

	// Total: 4 unique codes (5 inputs minus 1 duplicate).
	if len(goldBatch) != 4 {
		t.Errorf("expected 4 unique gold rows, got %d: %v", len(goldBatch), keys(byCode))
	}
}

func keys(m map[string]*models.AssetPrice) []string {
	result := make([]string, 0, len(m))
	for k := range m {
		result = append(result, k)
	}
	return result
}

// ---------------------------------------------------------------------------
// Tests: Source="waterfall" field set in all refresh methods
// ---------------------------------------------------------------------------

func TestRefreshGold_SetsSourceWaterfall(t *testing.T) {
	goldPrices := makeGoldPrices(3)

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{prices: goldPrices},
		&mockSilverPriceSvc{},
		&mockCurrencyPriceSvc{},
		nil, nil, nil, nil,
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Find the gold batch.
	var goldBatch []*models.AssetPrice
	for _, batch := range repo.upsertedBatches {
		if len(batch) > 0 && batch[0].AssetType == "gold" {
			goldBatch = batch
			break
		}
	}
	if goldBatch == nil {
		t.Fatal("no gold batch was upserted")
	}

	// Every item in the gold batch must have Source="waterfall".
	for _, item := range goldBatch {
		if item.Source != "waterfall" {
			t.Errorf("gold item TypeCode=%q: expected Source=%q, got %q", item.TypeCode, "waterfall", item.Source)
		}
	}
}

func TestRefreshSilver_SetsSourceWaterfall(t *testing.T) {
	silverPrices := makeSilverPrices(2)

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{},
		&mockSilverPriceSvc{prices: silverPrices},
		&mockCurrencyPriceSvc{},
		nil, nil, nil, nil,
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

func TestRefreshCurrency_SetsSourceWaterfall(t *testing.T) {
	currencyPrices := makeCurrencyPrices(4)

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{},
		&mockSilverPriceSvc{},
		&mockCurrencyPriceSvc{prices: currencyPrices},
		nil, nil, nil, nil,
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Find the currency batch.
	var currencyBatch []*models.AssetPrice
	for _, batch := range repo.upsertedBatches {
		if len(batch) > 0 && batch[0].AssetType == "currency" {
			currencyBatch = batch
			break
		}
	}
	if currencyBatch == nil {
		t.Fatal("no currency batch was upserted")
	}

	// Every item in the currency batch must have Source="waterfall".
	for _, item := range currencyBatch {
		if item.Source != "waterfall" {
			t.Errorf("currency item TypeCode=%q: expected Source=%q, got %q", item.TypeCode, "waterfall", item.Source)
		}
	}
}

// ---------------------------------------------------------------------------
// Tests: New per-source gold refresh (SJC, DOJI, BTMC, PNJ)
// ---------------------------------------------------------------------------


func TestRefreshAllPrices_IncludesNewSources(t *testing.T) {
	goldPrices := makeGoldPrices(2)
	silverPrices := makeSilverPrices(1)
	currencyPrices := makeCurrencyPrices(1)

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{prices: goldPrices},
		&mockSilverPriceSvc{prices: silverPrices},
		&mockCurrencyPriceSvc{prices: currencyPrices},
		nil, // sjcClient — will be wired in Task 10; nil = skipped
		nil, // dojiClient
		nil, // btmcClient
		nil, // pnjClient
	)

	err := svc.RefreshAllPrices(context.Background())
	// With nil clients, their refresh methods return errors but other 3 sources succeed.
	// failCount = 4 (nil clients) < 7 → should not return error.
	if err != nil {
		t.Fatalf("expected no error when 3/7 sources succeed, got: %v", err)
	}

	// Three batches should have been upserted (waterfall gold, silver, currency).
	// Nil clients skip UpsertBatch.
	if len(repo.upsertedBatches) != 3 {
		t.Fatalf("expected 3 upsert batches (waterfall gold + silver + currency), got %d", len(repo.upsertedBatches))
	}
}

func TestRefreshAllPrices_SourceFailureIndependent(t *testing.T) {
	// With nil SJC client: sjc refresh returns "not configured" error
	// other sources succeed.
	goldPrices := makeGoldPrices(2)
	silverPrices := makeSilverPrices(1)
	currencyPrices := makeCurrencyPrices(1)

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{prices: goldPrices},
		&mockSilverPriceSvc{prices: silverPrices},
		&mockCurrencyPriceSvc{prices: currencyPrices},
		nil, // sjcClient nil — triggers "not configured" failure
		nil, // dojiClient nil
		nil, // btmcClient nil
		nil, // pnjClient nil
	)

	err := svc.RefreshAllPrices(context.Background())
	// 4 nil-client failures + 3 successes → failCount=4 < 7 → no error.
	if err != nil {
		t.Fatalf("expected no error with partial failure, got: %v", err)
	}

	// Nil clients return "not configured" errors → call MarkStaleByAssetTypeAndSource.
	// The mock records the assetType; check it was called for expected types.
	// With nil clients for sjc/doji/btmc/pnj they all call MarkStaleByAssetTypeAndSource("gold", <source>).
	// staledTypes collects "gold" 4 times.
	goldStaleCount := 0
	for _, st := range repo.staledTypes {
		if st == "gold" {
			goldStaleCount++
		}
	}
	if goldStaleCount != 4 {
		t.Errorf("expected 4 gold stale marks (one per nil client), got %d; staledTypes=%v", goldStaleCount, repo.staledTypes)
	}

	// Waterfall gold, silver, currency should still upsert.
	if len(repo.upsertedBatches) != 3 {
		t.Errorf("expected 3 upsert batches, got %d", len(repo.upsertedBatches))
	}
}

func TestRefreshAllPrices_AllFailIncludingNilClients(t *testing.T) {
	// All 3 waterfall sources fail + 4 nil clients = 7 total failures → must return error.
	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(repo,
		&mockGoldPriceSvc{err: errTest},
		&mockSilverPriceSvc{err: errTest},
		&mockCurrencyPriceSvc{err: errTest},
		nil, nil, nil, nil,
	)

	err := svc.RefreshAllPrices(context.Background())
	if err == nil {
		t.Fatal("expected error when all 7 sources fail, got nil")
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
	svc := NewAssetPriceService(repo, &mockGoldPriceSvc{}, &mockSilverPriceSvc{}, &mockCurrencyPriceSvc{}, nil, nil, nil, nil)

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
