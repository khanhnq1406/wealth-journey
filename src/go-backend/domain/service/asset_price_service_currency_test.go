package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"wealthjourney/domain/models"
)

// ---------------------------------------------------------------------------
// Mock: CurrencyPriceFetcher (simple stub — no external mock libraries)
// ---------------------------------------------------------------------------

type mockSimpleCurrencyFetcher struct {
	prices []*CachedCurrencyPrice
	err    error
	source PriceSource
}

func (m *mockSimpleCurrencyFetcher) FetchCurrencyPrices(_ context.Context) ([]*CachedCurrencyPrice, error) {
	return m.prices, m.err
}

func (m *mockSimpleCurrencyFetcher) Source() PriceSource {
	return m.source
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func makeCurrencyPricesForFetcher(n int, suffix string) []*CachedCurrencyPrice {
	prices := make([]*CachedCurrencyPrice, n)
	for i := range prices {
		prices[i] = &CachedCurrencyPrice{
			TypeCode:   "USD_" + suffix + string(rune('A'+i)),
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

// newTestAssetPriceServiceCurrency creates a service for currency-focused tests.
// Gold sources (vangsaigon + vangtoday) and silver use nil/noop stubs so that
// only currency goroutines produce meaningful results.
func newTestAssetPriceServiceCurrency(
	repo *mockAssetPriceRepo,
	vsgCurrency CurrencyPriceFetcher,
	vtCurrency CurrencyPriceFetcher,
	vcbCurrency CurrencyPriceFetcher,
) AssetPriceService {
	return NewAssetPriceService(
		repo,
		nil, // configRepo — not needed for refresh tests
		&mockSilverPriceSvc{prices: makeSilverPrices(1)}, // silver succeeds so failCount stays low
		&mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, prices: makeGoldPrices(1)}, // vsg gold succeeds
		&mockSimpleGoldPriceFetcher{source: SourceVangToday, prices: makeGoldPrices(1)},  // vt gold succeeds
		vsgCurrency,
		vtCurrency,
		vcbCurrency,
		nil, nil, nil, nil, // sjc/doji/btmc/pnj nil — each fails independently
	)
}

// ---------------------------------------------------------------------------
// Tests: refreshCurrencyVangSaiGon
// ---------------------------------------------------------------------------

func TestRefreshCurrencyVangSaiGon_Success(t *testing.T) {
	prices := makeCurrencyPricesForFetcher(2, "VSG")
	repo := &mockAssetPriceRepo{}

	svc := newTestAssetPriceServiceCurrency(repo,
		&mockSimpleCurrencyFetcher{source: SourceVangSaiGon, prices: prices},
		&mockSimpleCurrencyFetcher{source: SourceVangToday, err: errors.New("vangtoday off")},
		nil, // vcb nil — marks stale
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("expected no error (partial failure OK), got: %v", err)
	}

	// Find the vangsaigon currency batch.
	var vsgBatch []*models.AssetPrice
	for _, batch := range repo.upsertedBatches {
		if len(batch) > 0 && batch[0].AssetType == "currency" && batch[0].Source == "vangsaigon" {
			vsgBatch = batch
			break
		}
	}
	if vsgBatch == nil {
		t.Fatal("no vangsaigon currency batch was upserted")
	}

	if len(vsgBatch) != 2 {
		t.Errorf("expected 2 prices in vangsaigon currency batch, got %d", len(vsgBatch))
	}

	for _, item := range vsgBatch {
		if item.AssetType != "currency" {
			t.Errorf("expected AssetType=currency, got %q", item.AssetType)
		}
		if item.Source != "vangsaigon" {
			t.Errorf("expected Source=vangsaigon, got %q", item.Source)
		}
		if item.IsStale {
			t.Errorf("price %q should not be stale after successful upsert", item.TypeCode)
		}
	}
}

func TestRefreshCurrencyVangSaiGon_FetchError(t *testing.T) {
	fetchErr := errors.New("vangsaigon currency API timeout")
	repo := &mockAssetPriceRepo{}

	svc := newTestAssetPriceServiceCurrency(repo,
		&mockSimpleCurrencyFetcher{source: SourceVangSaiGon, err: fetchErr},
		&mockSimpleCurrencyFetcher{source: SourceVangToday, prices: makeCurrencyPricesForFetcher(2, "VT")},
		nil, // vcb nil
	)

	err := svc.RefreshAllPrices(context.Background())
	// Partial failure: vangsaigon currency fails but others succeed → no overall error
	if err != nil {
		t.Fatalf("expected no error on partial failure, got: %v", err)
	}

	// "currency" must appear in staledTypes (vangsaigon currency marks stale on fetch error)
	currencyStaleCount := 0
	for _, st := range repo.staledTypes {
		if st == "currency" {
			currencyStaleCount++
		}
	}
	if currencyStaleCount == 0 {
		t.Errorf("expected currency to be marked stale on vangsaigon fetch error; staledTypes=%v", repo.staledTypes)
	}
}

func TestRefreshCurrencyVangSaiGon_NilFetcher(t *testing.T) {
	repo := &mockAssetPriceRepo{}

	svc := newTestAssetPriceServiceCurrency(repo,
		nil, // vsg nil — marks stale + returns error
		&mockSimpleCurrencyFetcher{source: SourceVangToday, prices: makeCurrencyPricesForFetcher(2, "VT")},
		nil, // vcb nil
	)

	err := svc.RefreshAllPrices(context.Background())
	// Partial failure: nil fetcher fails but others succeed → no overall error
	if err != nil {
		t.Fatalf("expected no error on partial failure (nil fetcher), got: %v", err)
	}

	// "currency" must appear in staledTypes at least once (from nil vangsaigon fetcher)
	found := false
	for _, st := range repo.staledTypes {
		if st == "currency" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected currency to be marked stale for nil vangsaigon fetcher; staledTypes=%v", repo.staledTypes)
	}
}

func TestRefreshCurrencyVangSaiGon_EmptyPrices(t *testing.T) {
	// Fetcher returns empty slice → marks stale
	repo := &mockAssetPriceRepo{}

	svc := newTestAssetPriceServiceCurrency(repo,
		&mockSimpleCurrencyFetcher{source: SourceVangSaiGon, prices: []*CachedCurrencyPrice{}},
		&mockSimpleCurrencyFetcher{source: SourceVangToday, prices: makeCurrencyPricesForFetcher(2, "VT")},
		nil, // vcb nil
	)

	err := svc.RefreshAllPrices(context.Background())
	// Partial failure → no overall error
	if err != nil {
		t.Fatalf("expected no error on partial failure (empty prices), got: %v", err)
	}

	// "currency" must appear in staledTypes (from empty-prices vangsaigon)
	found := false
	for _, st := range repo.staledTypes {
		if st == "currency" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected currency to be marked stale for empty vangsaigon prices; staledTypes=%v", repo.staledTypes)
	}

	// No vangsaigon currency batch should have been upserted
	for _, batch := range repo.upsertedBatches {
		if len(batch) > 0 && batch[0].AssetType == "currency" && batch[0].Source == "vangsaigon" {
			t.Error("expected no vangsaigon currency batch when prices are empty")
			break
		}
	}
}

// ---------------------------------------------------------------------------
// Tests: refreshCurrencyVietcombank
// ---------------------------------------------------------------------------

func TestRefreshCurrencyVietcombank_Success(t *testing.T) {
	// VCB TypeCodes already have _VCB suffix from the fetcher adapter.
	vcbPrices := []*CachedCurrencyPrice{
		{TypeCode: "USD_VCB", Name: "USD Vietcombank", Buy: 25100, Sell: 25300, ChangeBuy: 0, ChangeSell: 0, Currency: "VND", UpdateTime: time.Now()},
		{TypeCode: "EUR_VCB", Name: "EUR Vietcombank", Buy: 27000, Sell: 27200, ChangeBuy: 0, ChangeSell: 0, Currency: "VND", UpdateTime: time.Now()},
	}

	repo := &mockAssetPriceRepo{}

	svc := newTestAssetPriceServiceCurrency(repo,
		&mockSimpleCurrencyFetcher{source: SourceVangSaiGon, err: errors.New("vangsaigon off")},
		&mockSimpleCurrencyFetcher{source: SourceVangToday, err: errors.New("vangtoday off")},
		&mockSimpleCurrencyFetcher{source: SourceVietcombank, prices: vcbPrices},
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("expected no error (partial failure OK), got: %v", err)
	}

	// Find the vietcombank currency batch.
	var vcbBatch []*models.AssetPrice
	for _, batch := range repo.upsertedBatches {
		if len(batch) > 0 && batch[0].AssetType == "currency" && batch[0].Source == "vietcombank" {
			vcbBatch = batch
			break
		}
	}
	if vcbBatch == nil {
		t.Fatal("no vietcombank currency batch was upserted")
	}

	if len(vcbBatch) != 2 {
		t.Errorf("expected 2 prices in vietcombank currency batch, got %d", len(vcbBatch))
	}

	for _, item := range vcbBatch {
		if item.AssetType != "currency" {
			t.Errorf("expected AssetType=currency, got %q", item.AssetType)
		}
		if item.Source != "vietcombank" {
			t.Errorf("expected Source=vietcombank, got %q", item.Source)
		}
		if item.IsStale {
			t.Errorf("price %q should not be stale after successful upsert", item.TypeCode)
		}
	}

	// TypeCodes must carry the _VCB suffix (preserved from fetcher adapter).
	codes := make(map[string]bool)
	for _, item := range vcbBatch {
		codes[item.TypeCode] = true
	}
	if !codes["USD_VCB"] {
		t.Errorf("expected USD_VCB TypeCode in vietcombank batch, got codes: %v", codes)
	}
	if !codes["EUR_VCB"] {
		t.Errorf("expected EUR_VCB TypeCode in vietcombank batch, got codes: %v", codes)
	}
}

func TestRefreshCurrencyVietcombank_FetchError(t *testing.T) {
	// VCB fails; vangsaigon and vangtoday currency succeed.
	// Only "currency"/"vietcombank" should be marked stale — not vangsaigon or vangtoday.
	vsgPrices := makeCurrencyPricesForFetcher(2, "VSG")
	vtPrices := makeCurrencyPricesForFetcher(2, "VT")

	repo := &mockAssetPriceRepo{}

	svc := newTestAssetPriceServiceCurrency(repo,
		&mockSimpleCurrencyFetcher{source: SourceVangSaiGon, prices: vsgPrices},
		&mockSimpleCurrencyFetcher{source: SourceVangToday, prices: vtPrices},
		&mockSimpleCurrencyFetcher{source: SourceVietcombank, err: errors.New("vcb API timeout")},
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("expected no error on partial failure, got: %v", err)
	}

	// "currency" must be marked stale at least once (from VCB failure).
	found := false
	for _, st := range repo.staledTypes {
		if st == "currency" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected currency to be marked stale on vietcombank fetch error; staledTypes=%v", repo.staledTypes)
	}

	// vangsaigon and vangtoday currency batches must still have been upserted.
	vsgFound := false
	vtFound := false
	for _, batch := range repo.upsertedBatches {
		if len(batch) > 0 && batch[0].AssetType == "currency" {
			if batch[0].Source == "vangsaigon" {
				vsgFound = true
			}
			if batch[0].Source == "vangtoday" {
				vtFound = true
			}
		}
	}
	if !vsgFound {
		t.Error("expected vangsaigon currency batch to be upserted even when VCB fails")
	}
	if !vtFound {
		t.Error("expected vangtoday currency batch to be upserted even when VCB fails")
	}
}

// ---------------------------------------------------------------------------
// Tests: RefreshAllPrices with 10 sources
// ---------------------------------------------------------------------------

func TestRefreshAllPrices_10Sources(t *testing.T) {
	// All 10 sources succeed: 2 gold fetchers + 4 nil gold clients (fail) + 1 silver + 3 currency.
	// Actually: 2 gold fetchers succeed + 4 nil gold clients fail + 1 silver succeed + 3 currency succeed.
	// Total successes: 2+1+3=6; total failures: 4 (nil clients).
	// failCount=4 < 10 → no error.
	goldPrices := makeGoldPrices(2)
	silverPrices := makeSilverPrices(1)
	vsgCurrencyPrices := makeCurrencyPricesForFetcher(2, "VSG")
	vtCurrencyPrices := makeCurrencyPricesForFetcher(2, "VT")
	vcbPrices := []*CachedCurrencyPrice{
		{TypeCode: "USD_VCB", Name: "USD VCB", Buy: 25100, Sell: 25300, Currency: "VND", UpdateTime: time.Now()},
	}

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(
		repo,
		nil,
		&mockSilverPriceSvc{prices: silverPrices},
		&mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, prices: goldPrices},
		&mockSimpleGoldPriceFetcher{source: SourceVangToday, prices: goldPrices},
		&mockSimpleCurrencyFetcher{source: SourceVangSaiGon, prices: vsgCurrencyPrices},
		&mockSimpleCurrencyFetcher{source: SourceVangToday, prices: vtCurrencyPrices},
		&mockSimpleCurrencyFetcher{source: SourceVietcombank, prices: vcbPrices},
		nil, nil, nil, nil, // sjc/doji/btmc/pnj nil
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("expected no error when 6/10 sources succeed, got: %v", err)
	}

	// Expect 6 batches: vsg gold, vt gold, silver, vsg currency, vt currency, vcb currency.
	if len(repo.upsertedBatches) != 6 {
		t.Errorf("expected 6 upsert batches, got %d", len(repo.upsertedBatches))
	}
}

func TestRefreshAllPrices_AllFail_10Sources(t *testing.T) {
	// All 10 sources fail → returns error "all price sources failed".
	// 2 gold fetchers fail + 4 nil gold clients fail + 1 silver fail + 3 currency fail = 10.
	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(
		repo,
		nil,
		&mockSilverPriceSvc{err: errTest},
		&mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, err: errTest},
		&mockSimpleGoldPriceFetcher{source: SourceVangToday, err: errTest},
		&mockSimpleCurrencyFetcher{source: SourceVangSaiGon, err: errTest},
		&mockSimpleCurrencyFetcher{source: SourceVangToday, err: errTest},
		&mockSimpleCurrencyFetcher{source: SourceVietcombank, err: errTest},
		nil, nil, nil, nil, // sjc/doji/btmc/pnj nil — also fail
	)

	err := svc.RefreshAllPrices(context.Background())
	if err == nil {
		t.Fatal("expected error when all 10 sources fail, got nil")
	}
	if err.Error() != "all price sources failed" {
		t.Errorf("expected 'all price sources failed', got: %q", err.Error())
	}
}

func TestRefreshAllPrices_VCBFailOthersSucceed(t *testing.T) {
	// VCB currency fails; 9 others (2 gold fetchers + 4 nil gold clients fail + 1 silver + 2 currency) succeed partially.
	// Actually: 2 gold fetchers succeed + 4 nil gold clients fail + 1 silver succeed + 2 currency succeed + 1 vcb fail.
	// failCount = 4 + 1 = 5 < 10 → returns nil.
	goldPrices := makeGoldPrices(1)
	silverPrices := makeSilverPrices(1)
	vsgCurrencyPrices := makeCurrencyPricesForFetcher(2, "VSG")
	vtCurrencyPrices := makeCurrencyPricesForFetcher(2, "VT")

	repo := &mockAssetPriceRepo{}
	svc := NewAssetPriceService(
		repo,
		nil,
		&mockSilverPriceSvc{prices: silverPrices},
		&mockSimpleGoldPriceFetcher{source: SourceVangSaiGon, prices: goldPrices},
		&mockSimpleGoldPriceFetcher{source: SourceVangToday, prices: goldPrices},
		&mockSimpleCurrencyFetcher{source: SourceVangSaiGon, prices: vsgCurrencyPrices},
		&mockSimpleCurrencyFetcher{source: SourceVangToday, prices: vtCurrencyPrices},
		&mockSimpleCurrencyFetcher{source: SourceVietcombank, err: errors.New("vcb down")},
		nil, nil, nil, nil, // sjc/doji/btmc/pnj nil
	)

	err := svc.RefreshAllPrices(context.Background())
	if err != nil {
		t.Fatalf("expected nil (VCB failure is partial, not all-fail), got: %v", err)
	}

	// VCB failure should mark currency stale once.
	found := false
	for _, st := range repo.staledTypes {
		if st == "currency" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected currency to be marked stale on VCB failure; staledTypes=%v", repo.staledTypes)
	}
}
