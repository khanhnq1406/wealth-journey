package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	"wealthjourney/pkg/yahoo"
	v1 "wealthjourney/protobuf/v1"
)

// ---------------------------------------------------------------------------
// Mock: WatchlistRepository (minimal — only ListByUserID needed for ListItems)
// ---------------------------------------------------------------------------

type mockWatchlistRepo struct {
	items []*models.WatchlistItem
	err   error
	// For other methods not under test — all return zero values
}

func (m *mockWatchlistRepo) Create(_ context.Context, _ *models.WatchlistItem) error {
	return nil
}

func (m *mockWatchlistRepo) GetByIDForUser(_ context.Context, _, _ int32) (*models.WatchlistItem, error) {
	return nil, nil
}

func (m *mockWatchlistRepo) GetBySymbolForUser(_ context.Context, _ string, _ int32) (*models.WatchlistItem, error) {
	return nil, errors.New("not found")
}

func (m *mockWatchlistRepo) ListByUserID(_ context.Context, _ int32) ([]*models.WatchlistItem, error) {
	return m.items, m.err
}

func (m *mockWatchlistRepo) CountByUserID(_ context.Context, _ int32) (int64, error) {
	return int64(len(m.items)), nil
}

func (m *mockWatchlistRepo) Update(_ context.Context, _ *models.WatchlistItem) error {
	return nil
}

func (m *mockWatchlistRepo) Delete(_ context.Context, _ int32) error {
	return nil
}

func (m *mockWatchlistRepo) ReorderItems(_ context.Context, _ int32, _ []int32) error {
	return nil
}

func (m *mockWatchlistRepo) GetMaxSortOrder(_ context.Context, _ int32) (int32, error) {
	return 0, nil
}

// Compile-time check that mockWatchlistRepo satisfies repository.WatchlistRepository.
var _ repository.WatchlistRepository = (*mockWatchlistRepo)(nil)

// ---------------------------------------------------------------------------
// Mock: AssetPriceService (subset needed for WatchlistService tests)
// ---------------------------------------------------------------------------

type mockAssetPriceSvc struct {
	allPrices *AllAssetPrices
	err       error
}

func (m *mockAssetPriceSvc) RefreshAllPrices(_ context.Context) error { return nil }

func (m *mockAssetPriceSvc) GetAllPrices(_ context.Context) (*AllAssetPrices, error) {
	return m.allPrices, m.err
}

func (m *mockAssetPriceSvc) GetPricesByAssetType(_ context.Context, _ string) ([]*AssetPriceDTO, error) {
	return nil, nil
}

func (m *mockAssetPriceSvc) GetMarketTypes(_ context.Context) (*MarketTypesDTO, error) {
	return nil, nil
}

func (m *mockAssetPriceSvc) GetPriceByTypeCode(_ context.Context, _ string) (*AssetPriceDTO, error) {
	return nil, nil
}

// Compile-time check that mockAssetPriceSvc satisfies AssetPriceService.
var _ AssetPriceService = (*mockAssetPriceSvc)(nil)

// ---------------------------------------------------------------------------
// Mock: MarketDataService (for watchlist tests — market/stock items)
// ---------------------------------------------------------------------------

type mockWatchlistMarketDataSvc struct {
	prices map[string]*models.MarketData
	err    error
}

func (m *mockWatchlistMarketDataSvc) GetPrice(_ context.Context, symbol, _ string, _ v1.InvestmentType, _ time.Duration) (*models.MarketData, error) {
	if m.err != nil {
		return nil, m.err
	}
	if md, ok := m.prices[symbol]; ok {
		return md, nil
	}
	return nil, errors.New("price not found")
}

func (m *mockWatchlistMarketDataSvc) UpdatePricesForInvestments(_ context.Context, _ []*models.Investment, _ bool) (map[int32]int64, error) {
	return nil, nil
}

func (m *mockWatchlistMarketDataSvc) SearchSymbols(_ context.Context, _ string, _ int) ([]yahoo.SearchResult, error) {
	return nil, nil
}

func (m *mockWatchlistMarketDataSvc) GetPriceBatch(_ context.Context, _ []string) (map[string]*models.MarketData, error) {
	return nil, nil
}

// Compile-time check that mockWatchlistMarketDataSvc satisfies MarketDataService.
var _ MarketDataService = (*mockWatchlistMarketDataSvc)(nil)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// goldWatchlistItem creates a gold-type watchlist item (InvestmentType 8 = GOLD_VND).
func goldWatchlistItem(symbol string) *models.WatchlistItem {
	return &models.WatchlistItem{
		ID:        1,
		UserID:    42,
		Symbol:    symbol,
		Name:      "Gold SJC " + symbol,
		AssetType: int32(v1.InvestmentType_INVESTMENT_TYPE_GOLD_VND),
		Currency:  "VND",
		SortOrder: 0,
		CreatedAt: time.Now(),
	}
}

// silverWatchlistItem creates a silver-type watchlist item.
func silverWatchlistItem(symbol string) *models.WatchlistItem {
	return &models.WatchlistItem{
		ID:        2,
		UserID:    42,
		Symbol:    symbol,
		Name:      "Silver " + symbol,
		AssetType: int32(v1.InvestmentType_INVESTMENT_TYPE_SILVER_VND),
		Currency:  "VND",
		SortOrder: 1,
		CreatedAt: time.Now(),
	}
}

// currencyWatchlistItem creates a foreign-currency watchlist item.
func currencyWatchlistItem(symbol string) *models.WatchlistItem {
	return &models.WatchlistItem{
		ID:        3,
		UserID:    42,
		Symbol:    symbol,
		Name:      "Currency " + symbol,
		AssetType: int32(v1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY),
		Currency:  "USD",
		SortOrder: 2,
		CreatedAt: time.Now(),
	}
}

// stockWatchlistItem creates a stock-type watchlist item (market data from Yahoo).
func stockWatchlistItem(symbol string) *models.WatchlistItem {
	return &models.WatchlistItem{
		ID:        4,
		UserID:    42,
		Symbol:    symbol,
		Name:      "Stock " + symbol,
		AssetType: int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Currency:  "VND",
		SortOrder: 3,
		CreatedAt: time.Now(),
	}
}

// emptyAllPrices returns AllAssetPrices with all empty slices (cold-start scenario).
func emptyAllPrices() *AllAssetPrices {
	return &AllAssetPrices{
		Gold:     []*AssetPriceDTO{},
		Silver:   []*AssetPriceDTO{},
		Currency: []*AssetPriceDTO{},
	}
}

// newWatchlistSvc is a test constructor convenience wrapper.
func newWatchlistSvc(repo repository.WatchlistRepository, assetSvc AssetPriceService, mktSvc MarketDataService) WatchlistService {
	return NewWatchlistService(repo, assetSvc, mktSvc)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// TestWatchlistService_ListItems_GoldFromDB verifies that gold watchlist items
// receive prices via MarketDataService.GetPrice() (which routes to DB cache internally).
func TestWatchlistService_ListItems_GoldFromDB(t *testing.T) {
	const symbol = "SJC_1L"
	const wantPrice int64 = 8_500_000_000

	repo := &mockWatchlistRepo{items: []*models.WatchlistItem{goldWatchlistItem(symbol)}}
	assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
	mktSvc := &mockWatchlistMarketDataSvc{
		prices: map[string]*models.MarketData{
			symbol: {Symbol: symbol, Price: wantPrice, Change24h: 0},
		},
	}

	svc := newWatchlistSvc(repo, assetSvc, mktSvc)

	resp, err := svc.ListItems(context.Background(), 42)
	if err != nil {
		t.Fatalf("ListItems returned unexpected error: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}

	item := resp.Items[0]
	if item.BuyPrice != wantPrice {
		t.Errorf("BuyPrice: got %d, want %d", item.BuyPrice, wantPrice)
	}
	if item.CurrentPrice != wantPrice {
		t.Errorf("CurrentPrice: got %d, want %d", item.CurrentPrice, wantPrice)
	}
}

// TestWatchlistService_ListItems_SilverFromDB verifies that silver watchlist items
// receive prices via MarketDataService.GetPrice() (which routes to DB cache internally).
func TestWatchlistService_ListItems_SilverFromDB(t *testing.T) {
	const symbol = "SILVER_VND_1"
	const wantPrice int64 = 950_000

	repo := &mockWatchlistRepo{items: []*models.WatchlistItem{silverWatchlistItem(symbol)}}
	assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
	mktSvc := &mockWatchlistMarketDataSvc{
		prices: map[string]*models.MarketData{
			symbol: {Symbol: symbol, Price: wantPrice, Change24h: 0},
		},
	}

	svc := newWatchlistSvc(repo, assetSvc, mktSvc)

	resp, err := svc.ListItems(context.Background(), 42)
	if err != nil {
		t.Fatalf("ListItems returned unexpected error: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}

	item := resp.Items[0]
	if item.BuyPrice != wantPrice {
		t.Errorf("BuyPrice: got %d, want %d", item.BuyPrice, wantPrice)
	}
}

// TestWatchlistService_ListItems_CurrencyFromDB verifies that foreign-currency watchlist
// items receive prices via MarketDataService.GetPrice() (which routes to DB cache internally).
func TestWatchlistService_ListItems_CurrencyFromDB(t *testing.T) {
	const symbol = "USD"
	const wantPrice int64 = 25_000_000

	repo := &mockWatchlistRepo{items: []*models.WatchlistItem{currencyWatchlistItem(symbol)}}
	assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
	mktSvc := &mockWatchlistMarketDataSvc{
		prices: map[string]*models.MarketData{
			symbol: {Symbol: symbol, Price: wantPrice, Change24h: 0},
		},
	}

	svc := newWatchlistSvc(repo, assetSvc, mktSvc)

	resp, err := svc.ListItems(context.Background(), 42)
	if err != nil {
		t.Fatalf("ListItems returned unexpected error: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}

	item := resp.Items[0]
	if item.BuyPrice != wantPrice {
		t.Errorf("BuyPrice: got %d, want %d", item.BuyPrice, wantPrice)
	}
}

// TestWatchlistService_ListItems_MarketFromYahoo verifies that stock/market-type watchlist
// items still get prices from Yahoo Finance (MarketDataService), not the DB cache.
func TestWatchlistService_ListItems_MarketFromYahoo(t *testing.T) {
	const symbol = "VCB"
	const wantPrice int64 = 90_000_00 // stored as int64 cents

	repo := &mockWatchlistRepo{items: []*models.WatchlistItem{stockWatchlistItem(symbol)}}
	// DB cache has no stock entries — should not be consulted for stock items.
	assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
	mktSvc := &mockWatchlistMarketDataSvc{
		prices: map[string]*models.MarketData{
			symbol: {Symbol: symbol, Price: wantPrice, Change24h: 1.5},
		},
	}

	svc := newWatchlistSvc(repo, assetSvc, mktSvc)

	resp, err := svc.ListItems(context.Background(), 42)
	if err != nil {
		t.Fatalf("ListItems returned unexpected error: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}

	item := resp.Items[0]
	if item.CurrentPrice != wantPrice {
		t.Errorf("CurrentPrice: got %d, want %d", item.CurrentPrice, wantPrice)
	}
	if item.BuyPrice != wantPrice {
		t.Errorf("BuyPrice: got %d, want %d", item.BuyPrice, wantPrice)
	}
	if item.PriceChangePercent != 1.5 {
		t.Errorf("PriceChangePercent: got %f, want 1.5", item.PriceChangePercent)
	}
}

// TestWatchlistService_ListItems_DBEmptyReturnsZeroPrices verifies that when the
// price service returns no price for a symbol (cold start / cache miss), items are
// returned with zero prices rather than an error (graceful degradation).
func TestWatchlistService_ListItems_DBEmptyReturnsZeroPrices(t *testing.T) {
	const symbol = "SJC_1L"

	repo := &mockWatchlistRepo{items: []*models.WatchlistItem{goldWatchlistItem(symbol)}}
	assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
	// mktSvc has no entry for symbol → GetPrice returns "price not found" error → zero prices.
	mktSvc := &mockWatchlistMarketDataSvc{}

	svc := newWatchlistSvc(repo, assetSvc, mktSvc)

	resp, err := svc.ListItems(context.Background(), 42)
	if err != nil {
		t.Fatalf("ListItems returned unexpected error (expected graceful degradation): %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}

	item := resp.Items[0]
	// No price → prices should remain zero (frontend shows "--").
	if item.BuyPrice != 0 {
		t.Errorf("BuyPrice: got %d, want 0 (no price entry)", item.BuyPrice)
	}
	if item.SellPrice != 0 {
		t.Errorf("SellPrice: got %d, want 0 (no price entry)", item.SellPrice)
	}
}

// TestWatchlistService_ListItems_GoldViaGetPrice verifies that a gold watchlist item
// with a symbol that does NOT match a TypeCode directly (e.g. "Eximbank") still
// resolves prices through MarketDataService.GetPrice() rather than a direct TypeCode map.
func TestWatchlistService_ListItems_GoldViaGetPrice(t *testing.T) {
	const symbol = "Eximbank"
	const wantBuy int64 = 9_200_000_000

	repo := &mockWatchlistRepo{items: []*models.WatchlistItem{goldWatchlistItem(symbol)}}
	// Old path: assetSvc returns no entry for "Eximbank" TypeCode — this was the bug.
	assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
	// New path: marketDataSvc.GetPrice resolves via ResolvePrice.
	mktSvc := &mockWatchlistMarketDataSvc{
		prices: map[string]*models.MarketData{
			symbol: {Symbol: symbol, Price: wantBuy, Change24h: 0},
		},
	}

	svc := newWatchlistSvc(repo, assetSvc, mktSvc)

	resp, err := svc.ListItems(context.Background(), 42)
	if err != nil {
		t.Fatalf("ListItems returned unexpected error: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}
	got := resp.Items[0]
	if got.BuyPrice != wantBuy {
		t.Errorf("BuyPrice: got %d, want %d", got.BuyPrice, wantBuy)
	}
}

// TestWatchlistService_ListItems_CurrencyViaGetPrice verifies that a currency item
// ("USD") resolves prices through MarketDataService.GetPrice() not a direct TypeCode map.
func TestWatchlistService_ListItems_CurrencyViaGetPrice(t *testing.T) {
	const symbol = "USD"
	const wantBuy int64 = 25_800_000

	repo := &mockWatchlistRepo{items: []*models.WatchlistItem{currencyWatchlistItem(symbol)}}
	assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
	mktSvc := &mockWatchlistMarketDataSvc{
		prices: map[string]*models.MarketData{
			symbol: {Symbol: symbol, Price: wantBuy, Change24h: 0},
		},
	}

	svc := newWatchlistSvc(repo, assetSvc, mktSvc)

	resp, err := svc.ListItems(context.Background(), 42)
	if err != nil {
		t.Fatalf("ListItems returned unexpected error: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}
	item := resp.Items[0]
	if item.BuyPrice != wantBuy {
		t.Errorf("BuyPrice: got %d, want %d", item.BuyPrice, wantBuy)
	}
}

// TestWatchlistService_ListItems_GetPriceFailureReturnsZeroPrices verifies that a
// GetPrice() failure for one item does NOT return an error — it logs and returns zero prices.
func TestWatchlistService_ListItems_GetPriceFailureReturnsZeroPrices(t *testing.T) {
	const symbol = "Eximbank"

	repo := &mockWatchlistRepo{items: []*models.WatchlistItem{goldWatchlistItem(symbol)}}
	assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
	mktSvc := &mockWatchlistMarketDataSvc{err: errors.New("price service unavailable")}

	svc := newWatchlistSvc(repo, assetSvc, mktSvc)

	resp, err := svc.ListItems(context.Background(), 42)
	if err != nil {
		t.Fatalf("ListItems must not return error when GetPrice fails: %v", err)
	}
	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}
	item := resp.Items[0]
	if item.BuyPrice != 0 {
		t.Errorf("BuyPrice: got %d, want 0 (GetPrice failed → zero)", item.BuyPrice)
	}
}

// TestWatchlistService_ListItems_MixedAssetTypes verifies that a watchlist containing
// gold, silver, currency, and stock items all receive prices via MarketDataService.GetPrice().
func TestWatchlistService_ListItems_MixedAssetTypes(t *testing.T) {
	const (
		goldSymbol     = "SJC_1L"
		silverSymbol   = "SILVER_SJC"
		currencySymbol = "USD"
		stockSymbol    = "VHM"
	)

	items := []*models.WatchlistItem{
		goldWatchlistItem(goldSymbol),
		silverWatchlistItem(silverSymbol),
		currencyWatchlistItem(currencySymbol),
		stockWatchlistItem(stockSymbol),
	}
	// Adjust IDs to be unique
	items[0].ID = 1
	items[1].ID = 2
	items[2].ID = 3
	items[3].ID = 4

	repo := &mockWatchlistRepo{items: items}
	assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}

	// All prices now served via mktSvc.GetPrice(), which routes gold/silver/currency
	// to the DB cache and market/stock to Yahoo Finance.
	mktSvc := &mockWatchlistMarketDataSvc{
		prices: map[string]*models.MarketData{
			goldSymbol:     {Symbol: goldSymbol, Price: 8_500_000_000, Change24h: 0},
			silverSymbol:   {Symbol: silverSymbol, Price: 900_000, Change24h: 0},
			currencySymbol: {Symbol: currencySymbol, Price: 25_000_000, Change24h: 0},
			stockSymbol:    {Symbol: stockSymbol, Price: 55_000_00, Change24h: -0.5},
		},
	}

	svc := newWatchlistSvc(repo, assetSvc, mktSvc)

	resp, err := svc.ListItems(context.Background(), 42)
	if err != nil {
		t.Fatalf("ListItems returned unexpected error: %v", err)
	}
	if len(resp.Items) != 4 {
		t.Fatalf("expected 4 items, got %d", len(resp.Items))
	}
	if int(resp.Total) != 4 {
		t.Errorf("Total: got %d, want 4", resp.Total)
	}

	// Build symbol → item map for order-independent assertions.
	bySymbol := make(map[string]*v1.WatchlistItem, 4)
	for _, pi := range resp.Items {
		bySymbol[pi.Symbol] = pi
	}

	gold := bySymbol[goldSymbol]
	if gold == nil {
		t.Fatal("gold item missing from response")
	}
	if gold.BuyPrice != 8_500_000_000 {
		t.Errorf("gold BuyPrice: got %d, want 8500000000", gold.BuyPrice)
	}

	silver := bySymbol[silverSymbol]
	if silver == nil {
		t.Fatal("silver item missing from response")
	}
	if silver.BuyPrice != 900_000 {
		t.Errorf("silver BuyPrice: got %d, want 900000", silver.BuyPrice)
	}

	currency := bySymbol[currencySymbol]
	if currency == nil {
		t.Fatal("currency item missing from response")
	}
	if currency.BuyPrice != 25_000_000 {
		t.Errorf("currency BuyPrice: got %d, want 25000000", currency.BuyPrice)
	}

	stock := bySymbol[stockSymbol]
	if stock == nil {
		t.Fatal("stock item missing from response")
	}
	if stock.CurrentPrice != 55_000_00 {
		t.Errorf("stock CurrentPrice: got %d, want 5500000", stock.CurrentPrice)
	}
}
