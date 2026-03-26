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
	"wealthjourney/pkg/pnj"
	"wealthjourney/pkg/sjc"
)

// assetPriceService implements AssetPriceService.
// It owns the price-cache lifecycle: fetch from live price services → persist to DB →
// serve cached data to callers (handlers, scheduler jobs).
//
// Depguard: no gorm.io/gorm import — all DB access goes through the repository interface.
type assetPriceService struct {
	repo        repository.AssetPriceRepository
	goldSvc     GoldPriceService
	silverSvc   SilverPriceService
	currencySvc CurrencyPriceService
	sjcClient   *sjc.Client        // nil = not configured; source skipped
	dojiClient  *doji.Client       // nil = not configured; source skipped
	btmcClient  *btmcdirect.Client // nil = not configured; source skipped
	pnjClient   *pnj.Client        // nil = not configured; source skipped
}

// NewAssetPriceService creates a new AssetPriceService with constructor injection.
// Pass nil for any of the new source clients to skip that source.
func NewAssetPriceService(
	repo repository.AssetPriceRepository,
	goldSvc GoldPriceService,
	silverSvc SilverPriceService,
	currencySvc CurrencyPriceService,
	sjcClient *sjc.Client,
	dojiClient *doji.Client,
	btmcClient *btmcdirect.Client,
	pnjClient *pnj.Client,
) AssetPriceService {
	return &assetPriceService{
		repo:        repo,
		goldSvc:     goldSvc,
		silverSvc:   silverSvc,
		currencySvc: currencySvc,
		sjcClient:   sjcClient,
		dojiClient:  dojiClient,
		btmcClient:  btmcClient,
		pnjClient:   pnjClient,
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
// Returns non-nil error only when every one of the 7 sources fails, so callers
// can decide to retry or alert.
//
// Log summary format (for observability):
//
//	"[assetPriceService] Price cache job completed: gold_waterfall=OK(25), silver_waterfall=FAIL(...), ..."
func (s *assetPriceService) RefreshAllPrices(ctx context.Context) error {
	results := make(chan refreshResult, 7)
	var wg sync.WaitGroup

	// Existing 3 waterfall sources
	wg.Add(3)
	go func() { defer wg.Done(); results <- s.refreshGold(ctx) }()
	go func() { defer wg.Done(); results <- s.refreshSilver(ctx) }()
	go func() { defer wg.Done(); results <- s.refreshCurrency(ctx) }()

	// 4 new per-source gold clients
	wg.Add(4)
	go func() { defer wg.Done(); results <- s.refreshGoldSJC(ctx) }()
	go func() { defer wg.Done(); results <- s.refreshGoldDOJI(ctx) }()
	go func() { defer wg.Done(); results <- s.refreshGoldBTMC(ctx) }()
	go func() { defer wg.Done(); results <- s.refreshGoldPNJ(ctx) }()

	// Close channel once all goroutines complete.
	go func() { wg.Wait(); close(results) }()

	// Collect results and build log summary.
	summaryParts := make([]string, 0, 7)
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
	if failCount == 7 {
		return fmt.Errorf("all price sources failed")
	}
	return nil
}

// ---------------------------------------------------------------------------
// Existing waterfall refresh methods (refactored to return refreshResult)
// ---------------------------------------------------------------------------

// refreshGold fetches gold prices from the waterfall service and upserts them.
// On failure it marks gold rows stale.
func (s *assetPriceService) refreshGold(ctx context.Context) refreshResult {
	prices, err := s.goldSvc.FetchAllPrices(ctx)
	if err != nil {
		log.Printf("[assetPriceService] gold fetch failed: %v — marking stale", err)
		if markErr := s.repo.MarkStaleByAssetType(ctx, "gold"); markErr != nil {
			log.Printf("[assetPriceService] failed to mark gold stale: %v", markErr)
		}
		return refreshResult{source: "gold_waterfall", count: 0, err: err}
	}

	// Normalization (alias → canonical) happens at the WaterfallGoldFetcher level,
	// so prices here already carry canonical TypeCodes. Deduplication handles the
	// rare case where two sources return the same canonical code; first-wins.
	seen := make(map[string]struct{}, len(prices))
	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		if _, exists := seen[p.TypeCode]; exists {
			continue // deduplicate: first-wins
		}
		seen[p.TypeCode] = struct{}{}
		batch = append(batch, &models.AssetPrice{
			TypeCode:   p.TypeCode,
			AssetType:  "gold",
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
		log.Printf("[assetPriceService] gold upsert failed: %v — marking stale", upsertErr)
		if markErr := s.repo.MarkStaleByAssetType(ctx, "gold"); markErr != nil {
			log.Printf("[assetPriceService] failed to mark gold stale after upsert failure: %v", markErr)
		}
		return refreshResult{source: "gold_waterfall", count: 0, err: upsertErr}
	}

	return refreshResult{source: "gold_waterfall", count: len(batch), err: nil}
}

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

// refreshCurrency fetches currency prices and upserts them. On failure it marks rows stale.
func (s *assetPriceService) refreshCurrency(ctx context.Context) refreshResult {
	prices, err := s.currencySvc.FetchAllPrices(ctx)
	if err != nil {
		log.Printf("[assetPriceService] currency fetch failed: %v — marking stale", err)
		if markErr := s.repo.MarkStaleByAssetType(ctx, "currency"); markErr != nil {
			log.Printf("[assetPriceService] failed to mark currency stale: %v", markErr)
		}
		return refreshResult{source: "currency_waterfall", count: 0, err: err}
	}

	batch := make([]*models.AssetPrice, 0, len(prices))
	for _, p := range prices {
		batch = append(batch, &models.AssetPrice{
			TypeCode:   p.TypeCode,
			AssetType:  "currency",
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
		log.Printf("[assetPriceService] currency upsert failed: %v — marking stale", upsertErr)
		if markErr := s.repo.MarkStaleByAssetType(ctx, "currency"); markErr != nil {
			log.Printf("[assetPriceService] failed to mark currency stale after upsert failure: %v", markErr)
		}
		return refreshResult{source: "currency_waterfall", count: 0, err: upsertErr}
	}

	return refreshResult{source: "currency_waterfall", count: len(batch), err: nil}
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

// ---------------------------------------------------------------------------
// GetAllPrices
// ---------------------------------------------------------------------------

// GetAllPrices reads all rows from the DB and groups them by asset type.
func (s *assetPriceService) GetAllPrices(ctx context.Context) (*AllAssetPrices, error) {
	rows, err := s.repo.ListAll(ctx)
	if err != nil {
		return nil, err
	}

	result := &AllAssetPrices{
		Gold:     make([]*AssetPriceDTO, 0),
		Silver:   make([]*AssetPriceDTO, 0),
		Currency: make([]*AssetPriceDTO, 0),
	}

	for _, row := range rows {
		dto := modelToDTO(row)
		switch row.AssetType {
		case "gold":
			result.Gold = append(result.Gold, dto)
		case "silver":
			result.Silver = append(result.Silver, dto)
		case "currency":
			result.Currency = append(result.Currency, dto)
		default:
			// Unknown asset type — skip silently; avoids panics on schema evolution.
			log.Printf("[assetPriceService] unknown AssetType %q for TypeCode %q — skipping", row.AssetType, row.TypeCode)
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

// GetMarketTypes reads all DB rows and returns type descriptors grouped by asset class,
// together with the freshest FetchedAt timestamp per group expressed as Unix seconds.
func (s *assetPriceService) GetMarketTypes(ctx context.Context) (*MarketTypesDTO, error) {
	rows, err := s.repo.ListAll(ctx)
	if err != nil {
		return nil, err
	}

	result := &MarketTypesDTO{
		Gold:     make([]MarketTypeItem, 0),
		Silver:   make([]MarketTypeItem, 0),
		Currency: make([]MarketTypeItem, 0),
	}

	// Track max FetchedAt per asset type to report freshness.
	var goldMax, silverMax, currencyMax time.Time

	for _, row := range rows {
		item := MarketTypeItem{
			Code:     row.TypeCode,
			Name:     row.Name,
			Currency: row.Currency,
		}
		switch row.AssetType {
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
		default:
			log.Printf("[assetPriceService] unknown AssetType %q for TypeCode %q — skipping", row.AssetType, row.TypeCode)
		}
	}

	// Convert non-zero timestamps to Unix seconds; zero time stays 0.
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
