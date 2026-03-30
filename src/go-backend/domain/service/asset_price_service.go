package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	"wealthjourney/pkg/btmcdirect"
	"wealthjourney/pkg/doji"
	"wealthjourney/pkg/mihong"
	"wealthjourney/pkg/pnj"
	"wealthjourney/pkg/sjc"
)

// knownAssetTypes is the fixed set of asset types served by display-facing methods.
var knownAssetTypes = []string{"gold", "silver", "currency"}

// assetPriceService implements AssetPriceService.
// It owns the price-cache lifecycle: fetch from live price services → persist to DB →
// serve cached data to callers (handlers, scheduler jobs).
//
// Depguard: no gorm.io/gorm import — all DB access goes through the repository interface.
type assetPriceService struct {
	repo                      repository.AssetPriceRepository
	configRepo                repository.AssetDisplayConfigRepository // nil = no display filter; all rows returned
	silverSvc                 SilverPriceService
	vangSaiGonFetcher         GoldPriceFetcher     // nil = not configured; source skipped
	vangTodayFetcher          GoldPriceFetcher     // nil = not configured; source skipped
	vangSaiGonCurrencyFetcher CurrencyPriceFetcher // nil = not configured; source skipped
	vangTodayCurrencyFetcher  CurrencyPriceFetcher // nil = not configured; source skipped
	vietcombankFetcher        CurrencyPriceFetcher // nil = not configured; source skipped
	sjcClient                 *sjc.Client          // nil = not configured; source skipped
	dojiClient                *doji.Client         // nil = not configured; source skipped
	btmcClient                *btmcdirect.Client   // nil = not configured; source skipped
	pnjClient                 *pnj.Client          // nil = not configured; source skipped
	mihongClient              *mihong.Client       // nil = not configured; source skipped
}

// NewAssetPriceService creates a new AssetPriceService with constructor injection.
// Pass nil for configRepo to skip display-config filtering (all prices returned).
// Pass nil for any of the fetcher or client arguments to skip that source.
func NewAssetPriceService(
	repo repository.AssetPriceRepository,
	configRepo repository.AssetDisplayConfigRepository,
	silverSvc SilverPriceService,
	vangSaiGonFetcher GoldPriceFetcher,
	vangTodayFetcher GoldPriceFetcher,
	vangSaiGonCurrencyFetcher CurrencyPriceFetcher,
	vangTodayCurrencyFetcher CurrencyPriceFetcher,
	vietcombankFetcher CurrencyPriceFetcher,
	sjcClient *sjc.Client,
	dojiClient *doji.Client,
	btmcClient *btmcdirect.Client,
	pnjClient *pnj.Client,
	mihongClient *mihong.Client,
) AssetPriceService {
	return &assetPriceService{
		repo:                      repo,
		configRepo:                configRepo,
		silverSvc:                 silverSvc,
		vangSaiGonFetcher:         vangSaiGonFetcher,
		vangTodayFetcher:          vangTodayFetcher,
		vangSaiGonCurrencyFetcher: vangSaiGonCurrencyFetcher,
		vangTodayCurrencyFetcher:  vangTodayCurrencyFetcher,
		vietcombankFetcher:        vietcombankFetcher,
		sjcClient:                 sjcClient,
		dojiClient:                dojiClient,
		btmcClient:                btmcClient,
		pnjClient:                 pnjClient,
		mihongClient:              mihongClient,
	}
}

// ---------------------------------------------------------------------------
// refreshResult — shared named type for all 7 goroutine results
// ---------------------------------------------------------------------------

// refreshResult carries the outcome of a single source refresh.
type refreshResult struct {
	source string
	count  int
	err    error
}

// ---------------------------------------------------------------------------
// RefreshAllPrices
// ---------------------------------------------------------------------------

// RefreshAllPrices fetches fresh prices from all configured price sources and
// persists them in the asset_price table.
//
// Each source runs in its own goroutine. One failure marks only that source stale
// and does not interrupt the others.
//
// Returns non-nil error only when every one of the 11 sources fails, so callers
// can decide to retry or alert.
//
// Log summary format (for observability):
//
//	"[assetPriceService] Price cache job completed: gold_vangsaigon=OK(25), gold_vangtoday=FAIL(...), currency_vangsaigon=OK(12), currency_vangtoday=OK(12), currency_vietcombank=OK(8), ..."
func (s *assetPriceService) RefreshAllPrices(ctx context.Context) error {
	results := make(chan refreshResult, 11)
	var wg sync.WaitGroup

	// 2 direct VangSaiGon / VangToday gold sources (replacing waterfall)
	wg.Add(2)
	go func() { defer wg.Done(); results <- s.refreshGoldVangSaiGon(ctx) }()
	go func() { defer wg.Done(); results <- s.refreshGoldVangToday(ctx) }()

	// 5 per-source gold clients
	wg.Add(5)
	go func() { defer wg.Done(); results <- s.refreshGoldSJC(ctx) }()
	go func() { defer wg.Done(); results <- s.refreshGoldDOJI(ctx) }()
	go func() { defer wg.Done(); results <- s.refreshGoldBTMC(ctx) }()
	go func() { defer wg.Done(); results <- s.refreshGoldPNJ(ctx) }()
	go func() { defer wg.Done(); results <- s.refreshGoldMihong(ctx) }()

	// Silver (unchanged)
	wg.Add(1)
	go func() { defer wg.Done(); results <- s.refreshSilver(ctx) }()

	// 3 parallel currency sources (replacing single waterfall refreshCurrency)
	wg.Add(3)
	go func() { defer wg.Done(); results <- s.refreshCurrencyVangSaiGon(ctx) }()
	go func() { defer wg.Done(); results <- s.refreshCurrencyVangToday(ctx) }()
	go func() { defer wg.Done(); results <- s.refreshCurrencyVietcombank(ctx) }()

	// Close channel once all goroutines complete.
	go func() { wg.Wait(); close(results) }()

	// Collect results and build log summary.
	summaryParts := make([]string, 0, 10)
	failCount := 0
	for r := range results {
		if r.err != nil {
			summaryParts = append(summaryParts, fmt.Sprintf("%s=FAIL(%v)", r.source, r.err))
			failCount++
		} else {
			summaryParts = append(summaryParts, fmt.Sprintf("%s=OK(%d)", r.source, r.count))
		}
	}
	log.Printf("[assetPriceService] Price cache job completed: %s", strings.Join(summaryParts, ", "))

	// Return error only when ALL sources failed.
	if failCount == 11 {
		return fmt.Errorf("all price sources failed")
	}
	return nil
}

// ---------------------------------------------------------------------------
// Direct-source gold refresh methods (replacing waterfall)
// ---------------------------------------------------------------------------

// refreshGoldVangSaiGon fetches gold prices directly from the VangSaiGon API (vangsaigon.vn)
// and upserts them with source="vangsaigon". TypeCodes are stored as returned by the API.
func (s *assetPriceService) refreshGoldVangSaiGon(ctx context.Context) refreshResult {
	if s.vangSaiGonFetcher == nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangsaigon")
		return refreshResult{source: "gold_vangsaigon", count: 0, err: fmt.Errorf("vangsaigon fetcher not configured")}
	}
	prices, err := s.vangSaiGonFetcher.FetchGoldPrices(ctx)
	if err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangsaigon")
		return refreshResult{source: "gold_vangsaigon", count: 0, err: err}
	}
	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		if p.Buy <= 0 && p.Sell <= 0 {
			continue
		}
		typeCode := p.TypeCode
		// No alias normalization — raw TypeCode is stored as-is.
		// Admins configure mappings via asset_config_fetch_code.
		batch = append(batch, &models.AssetPrice{
			TypeCode:   typeCode,
			AssetType:  "gold",
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  p.ChangeBuy,
			ChangeSell: p.ChangeSell,
			Currency:   p.Currency,
			Source:     "vangsaigon",
			IsStale:    false,
			FetchedAt:  time.Now(),
		})
	}
	if len(batch) == 0 {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangsaigon")
		return refreshResult{source: "gold_vangsaigon", count: 0, err: fmt.Errorf("vangsaigon: no valid prices")}
	}
	if err := s.repo.UpsertBatch(ctx, batch); err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangsaigon")
		return refreshResult{source: "gold_vangsaigon", count: 0, err: err}
	}
	return refreshResult{source: "gold_vangsaigon", count: len(batch), err: nil}
}

// refreshGoldVangToday fetches gold prices directly from the VangToday API (vang.today)
// and upserts them with source="vangtoday". TypeCodes are already canonical from the fetcher.
func (s *assetPriceService) refreshGoldVangToday(ctx context.Context) refreshResult {
	if s.vangTodayFetcher == nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangtoday")
		return refreshResult{source: "gold_vangtoday", count: 0, err: fmt.Errorf("vangtoday fetcher not configured")}
	}
	prices, err := s.vangTodayFetcher.FetchGoldPrices(ctx)
	if err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangtoday")
		return refreshResult{source: "gold_vangtoday", count: 0, err: err}
	}
	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		if p.Buy <= 0 && p.Sell <= 0 {
			continue
		}
		batch = append(batch, &models.AssetPrice{
			TypeCode:   p.TypeCode,
			AssetType:  "gold",
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  p.ChangeBuy,
			ChangeSell: p.ChangeSell,
			Currency:   p.Currency,
			Source:     "vangtoday",
			IsStale:    false,
			FetchedAt:  time.Now(),
		})
	}
	if len(batch) == 0 {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangtoday")
		return refreshResult{source: "gold_vangtoday", count: 0, err: fmt.Errorf("vangtoday: no valid prices")}
	}
	if err := s.repo.UpsertBatch(ctx, batch); err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangtoday")
		return refreshResult{source: "gold_vangtoday", count: 0, err: err}
	}
	return refreshResult{source: "gold_vangtoday", count: len(batch), err: nil}
}

// ---------------------------------------------------------------------------
// Waterfall refresh method for silver
// ---------------------------------------------------------------------------

// refreshSilver fetches silver prices and upserts them. On failure it marks rows stale.
func (s *assetPriceService) refreshSilver(ctx context.Context) refreshResult {
	prices, err := s.silverSvc.FetchAllPrices(ctx)
	if err != nil {
		log.Printf("[assetPriceService] silver fetch failed: %v — marking stale", err)
		if markErr := s.repo.MarkStaleByAssetType(ctx, "silver"); markErr != nil {
			log.Printf("[assetPriceService] failed to mark silver stale: %v", markErr)
		}
		return refreshResult{source: "silver_waterfall", count: 0, err: err}
	}

	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		batch = append(batch, &models.AssetPrice{
			TypeCode:   p.TypeCode,
			AssetType:  "silver",
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  p.ChangeBuy,
			ChangeSell: p.ChangeSell,
			Currency:   p.Currency,
			Source:     "waterfall",
			IsStale:    false,
			FetchedAt:  time.Now(),
		})
	}

	if upsertErr := s.repo.UpsertBatch(ctx, batch); upsertErr != nil {
		log.Printf("[assetPriceService] silver upsert failed: %v — marking stale", upsertErr)
		if markErr := s.repo.MarkStaleByAssetType(ctx, "silver"); markErr != nil {
			log.Printf("[assetPriceService] failed to mark silver stale after upsert failure: %v", markErr)
		}
		return refreshResult{source: "silver_waterfall", count: 0, err: upsertErr}
	}

	return refreshResult{source: "silver_waterfall", count: len(batch), err: nil}
}

// ---------------------------------------------------------------------------
// Per-source currency refresh methods (replacing single waterfall refreshCurrency)
// ---------------------------------------------------------------------------

// refreshCurrencyVangSaiGon fetches currency prices directly from the VangSaiGon API (vangsaigon.vn)
// and upserts them with source="vangsaigon". Marks stale independently on any failure.
func (s *assetPriceService) refreshCurrencyVangSaiGon(ctx context.Context) refreshResult {
	if s.vangSaiGonCurrencyFetcher == nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vangsaigon")
		return refreshResult{source: "currency_vangsaigon", count: 0, err: fmt.Errorf("vangsaigon currency fetcher not configured")}
	}
	prices, err := s.vangSaiGonCurrencyFetcher.FetchCurrencyPrices(ctx)
	if err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vangsaigon")
		return refreshResult{source: "currency_vangsaigon", count: 0, err: err}
	}
	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		if p.Buy <= 0 && p.Sell <= 0 {
			continue
		}
		batch = append(batch, &models.AssetPrice{
			TypeCode:   p.TypeCode,
			AssetType:  "currency",
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  p.ChangeBuy,
			ChangeSell: p.ChangeSell,
			Currency:   p.Currency,
			Source:     "vangsaigon",
			IsStale:    false,
			FetchedAt:  time.Now(),
		})
	}
	if len(batch) == 0 {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vangsaigon")
		return refreshResult{source: "currency_vangsaigon", count: 0, err: fmt.Errorf("vangsaigon currency: no valid prices")}
	}
	if err := s.repo.UpsertBatch(ctx, batch); err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vangsaigon")
		return refreshResult{source: "currency_vangsaigon", count: 0, err: err}
	}
	return refreshResult{source: "currency_vangsaigon", count: len(batch), err: nil}
}

// refreshCurrencyVangToday fetches currency prices directly from the VangToday API (vang.today)
// and upserts them with source="vangtoday". Marks stale independently on any failure.
func (s *assetPriceService) refreshCurrencyVangToday(ctx context.Context) refreshResult {
	if s.vangTodayCurrencyFetcher == nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vangtoday")
		return refreshResult{source: "currency_vangtoday", count: 0, err: fmt.Errorf("vangtoday currency fetcher not configured")}
	}
	prices, err := s.vangTodayCurrencyFetcher.FetchCurrencyPrices(ctx)
	if err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vangtoday")
		return refreshResult{source: "currency_vangtoday", count: 0, err: err}
	}
	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		if p.Buy <= 0 && p.Sell <= 0 {
			continue
		}
		batch = append(batch, &models.AssetPrice{
			TypeCode:   p.TypeCode,
			AssetType:  "currency",
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  p.ChangeBuy,
			ChangeSell: p.ChangeSell,
			Currency:   p.Currency,
			Source:     "vangtoday",
			IsStale:    false,
			FetchedAt:  time.Now(),
		})
	}
	if len(batch) == 0 {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vangtoday")
		return refreshResult{source: "currency_vangtoday", count: 0, err: fmt.Errorf("vangtoday currency: no valid prices")}
	}
	if err := s.repo.UpsertBatch(ctx, batch); err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vangtoday")
		return refreshResult{source: "currency_vangtoday", count: 0, err: err}
	}
	return refreshResult{source: "currency_vangtoday", count: len(batch), err: nil}
}

// refreshCurrencyVietcombank fetches currency prices from the Vietcombank public API
// and upserts them with source="vietcombank". TypeCodes already carry _VCB suffix from
// the fetcher adapter (e.g. "USD_VCB"). Marks stale independently on any failure.
func (s *assetPriceService) refreshCurrencyVietcombank(ctx context.Context) refreshResult {
	if s.vietcombankFetcher == nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vietcombank")
		return refreshResult{source: "currency_vietcombank", count: 0, err: fmt.Errorf("vietcombank currency fetcher not configured")}
	}
	prices, err := s.vietcombankFetcher.FetchCurrencyPrices(ctx)
	if err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vietcombank")
		return refreshResult{source: "currency_vietcombank", count: 0, err: err}
	}
	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		if p.Buy <= 0 && p.Sell <= 0 {
			continue
		}
		batch = append(batch, &models.AssetPrice{
			TypeCode:   p.TypeCode,
			AssetType:  "currency",
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  p.ChangeBuy,
			ChangeSell: p.ChangeSell,
			Currency:   p.Currency,
			Source:     "vietcombank",
			IsStale:    false,
			FetchedAt:  time.Now(),
		})
	}
	if len(batch) == 0 {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vietcombank")
		return refreshResult{source: "currency_vietcombank", count: 0, err: fmt.Errorf("vietcombank currency: no valid prices")}
	}
	if err := s.repo.UpsertBatch(ctx, batch); err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vietcombank")
		return refreshResult{source: "currency_vietcombank", count: 0, err: err}
	}
	return refreshResult{source: "currency_vietcombank", count: len(batch), err: nil}
}

// ---------------------------------------------------------------------------
// New per-source gold refresh methods
// ---------------------------------------------------------------------------

// refreshGoldSJC fetches gold prices directly from the SJC API and upserts them.
// Returns an error result when client is nil (not configured) without panicking.
func (s *assetPriceService) refreshGoldSJC(ctx context.Context) refreshResult {
	if s.sjcClient == nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "sjc")
		return refreshResult{source: "gold_sjc", count: 0, err: fmt.Errorf("sjc client not configured")}
	}
	prices, err := s.sjcClient.FetchGoldPrices(ctx)
	if err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "sjc")
		return refreshResult{source: "gold_sjc", count: 0, err: err}
	}
	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		if p.Buy <= 0 && p.Sell <= 0 {
			continue
		}
		batch = append(batch, &models.AssetPrice{
			TypeCode:   p.TypeCode,
			AssetType:  "gold",
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  p.ChangeBuy,
			ChangeSell: p.ChangeSell,
			Currency:   p.Currency,
			Source:     "sjc",
			IsStale:    false,
			FetchedAt:  time.Now(),
		})
	}
	if len(batch) == 0 {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "sjc")
		return refreshResult{source: "gold_sjc", count: 0, err: fmt.Errorf("sjc: no valid prices")}
	}
	if err := s.repo.UpsertBatch(ctx, batch); err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "sjc")
		return refreshResult{source: "gold_sjc", count: 0, err: err}
	}
	return refreshResult{source: "gold_sjc", count: len(batch), err: nil}
}

// refreshGoldDOJI fetches gold prices from the DOJI website and upserts them.
// DOJI GoldPrice does not have ChangeBuy/ChangeSell fields; those default to 0.
func (s *assetPriceService) refreshGoldDOJI(ctx context.Context) refreshResult {
	if s.dojiClient == nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "doji")
		return refreshResult{source: "gold_doji", count: 0, err: fmt.Errorf("doji client not configured")}
	}
	prices, err := s.dojiClient.FetchGoldPrices(ctx)
	if err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "doji")
		return refreshResult{source: "gold_doji", count: 0, err: err}
	}
	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		if p.Buy <= 0 && p.Sell <= 0 {
			continue
		}
		batch = append(batch, &models.AssetPrice{
			TypeCode:   p.TypeCode,
			AssetType:  "gold",
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  0,
			ChangeSell: 0,
			Currency:   p.Currency,
			Source:     "doji",
			IsStale:    false,
			FetchedAt:  time.Now(),
		})
	}
	if len(batch) == 0 {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "doji")
		return refreshResult{source: "gold_doji", count: 0, err: fmt.Errorf("doji: no valid prices")}
	}
	if err := s.repo.UpsertBatch(ctx, batch); err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "doji")
		return refreshResult{source: "gold_doji", count: 0, err: err}
	}
	return refreshResult{source: "gold_doji", count: len(batch), err: nil}
}

// refreshGoldBTMC fetches gold prices from the BTMC website and upserts them.
// BTMC GoldPrice does not have ChangeBuy/ChangeSell fields; those default to 0.
func (s *assetPriceService) refreshGoldBTMC(ctx context.Context) refreshResult {
	if s.btmcClient == nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "btmc")
		return refreshResult{source: "gold_btmc", count: 0, err: fmt.Errorf("btmc client not configured")}
	}
	prices, err := s.btmcClient.FetchGoldPrices(ctx)
	if err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "btmc")
		return refreshResult{source: "gold_btmc", count: 0, err: err}
	}
	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		if p.Buy <= 0 && p.Sell <= 0 {
			continue
		}
		batch = append(batch, &models.AssetPrice{
			TypeCode:   p.TypeCode,
			AssetType:  "gold",
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  0,
			ChangeSell: 0,
			Currency:   p.Currency,
			Source:     "btmc",
			IsStale:    false,
			FetchedAt:  time.Now(),
		})
	}
	if len(batch) == 0 {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "btmc")
		return refreshResult{source: "gold_btmc", count: 0, err: fmt.Errorf("btmc: no valid prices")}
	}
	if err := s.repo.UpsertBatch(ctx, batch); err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "btmc")
		return refreshResult{source: "gold_btmc", count: 0, err: err}
	}
	return refreshResult{source: "gold_btmc", count: len(batch), err: nil}
}

// refreshGoldPNJ fetches gold prices from the PNJ API and upserts them.
// PNJ GoldPrice does not have ChangeBuy/ChangeSell fields; those default to 0.
func (s *assetPriceService) refreshGoldPNJ(ctx context.Context) refreshResult {
	if s.pnjClient == nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "pnj")
		return refreshResult{source: "gold_pnj", count: 0, err: fmt.Errorf("pnj client not configured")}
	}
	prices, err := s.pnjClient.FetchGoldPrices(ctx)
	if err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "pnj")
		return refreshResult{source: "gold_pnj", count: 0, err: err}
	}
	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		if p.Buy <= 0 && p.Sell <= 0 {
			continue
		}
		batch = append(batch, &models.AssetPrice{
			TypeCode:   p.TypeCode,
			AssetType:  "gold",
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  0,
			ChangeSell: 0,
			Currency:   p.Currency,
			Source:     "pnj",
			IsStale:    false,
			FetchedAt:  time.Now(),
		})
	}
	if len(batch) == 0 {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "pnj")
		return refreshResult{source: "gold_pnj", count: 0, err: fmt.Errorf("pnj: no valid prices")}
	}
	if err := s.repo.UpsertBatch(ctx, batch); err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "pnj")
		return refreshResult{source: "gold_pnj", count: 0, err: err}
	}
	return refreshResult{source: "gold_pnj", count: len(batch), err: nil}
}

// refreshGoldMihong fetches gold prices from the Mihong (Mi Hồng) API and upserts them.
// Mihong GoldPrice does not have ChangeBuy/ChangeSell fields; those default to 0.
func (s *assetPriceService) refreshGoldMihong(ctx context.Context) refreshResult {
	if s.mihongClient == nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "mihong")
		return refreshResult{source: "gold_mihong", count: 0, err: fmt.Errorf("mihong client not configured")}
	}
	prices, err := s.mihongClient.FetchGoldPrices(ctx)
	if err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "mihong")
		return refreshResult{source: "gold_mihong", count: 0, err: err}
	}
	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		if p.Buy <= 0 && p.Sell <= 0 {
			continue
		}
		batch = append(batch, &models.AssetPrice{
			TypeCode:   p.TypeCode,
			AssetType:  "gold",
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  0,
			ChangeSell: 0,
			Currency:   p.Currency,
			Source:     "mihong",
			IsStale:    false,
			FetchedAt:  time.Now(),
		})
	}
	if len(batch) == 0 {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "mihong")
		return refreshResult{source: "gold_mihong", count: 0, err: fmt.Errorf("mihong: no valid prices")}
	}
	if err := s.repo.UpsertBatch(ctx, batch); err != nil {
		_ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "mihong")
		return refreshResult{source: "gold_mihong", count: 0, err: err}
	}
	return refreshResult{source: "gold_mihong", count: len(batch), err: nil}
}

// ---------------------------------------------------------------------------
// GetAllPrices
// ---------------------------------------------------------------------------

// GetAllPrices reads enabled rows from the DB (filtered by display config) and groups them by asset type.
// For each known asset type, it fetches the enabled type codes from configRepo, then reads only matching
// rows from the price store. This ensures disabled configs are excluded from display-facing responses.
func (s *assetPriceService) GetAllPrices(ctx context.Context) (*AllAssetPrices, error) {
	result := &AllAssetPrices{
		Gold:     make([]*AssetPriceDTO, 0),
		Silver:   make([]*AssetPriceDTO, 0),
		Currency: make([]*AssetPriceDTO, 0),
	}

	for _, assetType := range knownAssetTypes {
		enabledCodes, err := s.configRepo.ListEnabledTypeCodesByAssetType(ctx, assetType)
		if err != nil {
			return nil, err
		}
		rows, err := s.repo.ListByAssetTypeFiltered(ctx, assetType, enabledCodes)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			dto := modelToDTO(row)
			switch assetType {
			case "gold":
				result.Gold = append(result.Gold, dto)
			case "silver":
				result.Silver = append(result.Silver, dto)
			case "currency":
				result.Currency = append(result.Currency, dto)
			}
		}
	}
	return result, nil
}

// ---------------------------------------------------------------------------
// GetPricesByAssetType
// ---------------------------------------------------------------------------

// GetPricesByAssetType reads DB rows for a single asset type.
func (s *assetPriceService) GetPricesByAssetType(ctx context.Context, assetType string) ([]*AssetPriceDTO, error) {
	rows, err := s.repo.ListByAssetType(ctx, assetType)
	if err != nil {
		return nil, err
	}

	dtos := make([]*AssetPriceDTO, 0, len(rows))
	for _, row := range rows {
		dtos = append(dtos, modelToDTO(row))
	}
	return dtos, nil
}

// ---------------------------------------------------------------------------
// GetMarketTypes
// ---------------------------------------------------------------------------

// GetMarketTypes reads enabled DB rows (filtered by display config) and returns type descriptors
// grouped by asset class, together with the freshest FetchedAt timestamp per group as Unix seconds.
// Only type codes enabled in the display config are included.
func (s *assetPriceService) GetMarketTypes(ctx context.Context) (*MarketTypesDTO, error) {
	result := &MarketTypesDTO{
		Gold:     make([]MarketTypeItem, 0),
		Silver:   make([]MarketTypeItem, 0),
		Currency: make([]MarketTypeItem, 0),
	}
	var goldMax, silverMax, currencyMax time.Time

	for _, assetType := range knownAssetTypes {
		enabledCodes, err := s.configRepo.ListEnabledTypeCodesByAssetType(ctx, assetType)
		if err != nil {
			return nil, err
		}
		rows, err := s.repo.ListByAssetTypeFiltered(ctx, assetType, enabledCodes)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			item := MarketTypeItem{
				Code:     row.TypeCode,
				Name:     row.Name,
				Currency: row.Currency,
			}
			switch assetType {
			case "gold":
				result.Gold = append(result.Gold, item)
				if row.FetchedAt.After(goldMax) {
					goldMax = row.FetchedAt
				}
			case "silver":
				result.Silver = append(result.Silver, item)
				if row.FetchedAt.After(silverMax) {
					silverMax = row.FetchedAt
				}
			case "currency":
				result.Currency = append(result.Currency, item)
				if row.FetchedAt.After(currencyMax) {
					currencyMax = row.FetchedAt
				}
			}
		}
	}

	if !goldMax.IsZero() {
		result.GoldUpdatedAt = goldMax.Unix()
	}
	if !silverMax.IsZero() {
		result.SilverUpdatedAt = silverMax.Unix()
	}
	if !currencyMax.IsZero() {
		result.CurrencyUpdatedAt = currencyMax.Unix()
	}

	return result, nil
}

// ---------------------------------------------------------------------------
// GetPriceByTypeCode
// ---------------------------------------------------------------------------

// GetPriceByTypeCode scans ListAll results for a matching typeCode.
// Returns nil, nil when not found.
func (s *assetPriceService) GetPriceByTypeCode(ctx context.Context, typeCode string) (*AssetPriceDTO, error) {
	rows, err := s.repo.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if row.TypeCode == typeCode {
			return modelToDTO(row), nil
		}
	}
	return nil, nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// modelToDTO converts a models.AssetPrice row to an AssetPriceDTO.
func modelToDTO(row *models.AssetPrice) *AssetPriceDTO {
	return &AssetPriceDTO{
		TypeCode:   row.TypeCode,
		Name:       row.Name,
		Buy:        row.Buy,
		Sell:       row.Sell,
		ChangeBuy:  row.ChangeBuy,
		ChangeSell: row.ChangeSell,
		Currency:   row.Currency,
		IsStale:    row.IsStale,
		FetchedAt:  row.FetchedAt,
	}
}
