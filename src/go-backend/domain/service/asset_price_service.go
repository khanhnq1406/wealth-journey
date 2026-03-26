package service

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
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
}

// NewAssetPriceService creates a new AssetPriceService with constructor injection.
func NewAssetPriceService(
	repo repository.AssetPriceRepository,
	goldSvc GoldPriceService,
	silverSvc SilverPriceService,
	currencySvc CurrencyPriceService,
) AssetPriceService {
	return &assetPriceService{
		repo:        repo,
		goldSvc:     goldSvc,
		silverSvc:   silverSvc,
		currencySvc: currencySvc,
	}
}

// ---------------------------------------------------------------------------
// RefreshAllPrices
// ---------------------------------------------------------------------------

// RefreshAllPrices fetches fresh prices from all three live price services and
// persists them in the asset_price table.
//
// Each asset type is handled independently: a failure for one type marks that
// type's rows stale but does not interrupt the other two types.
//
// Log summary format (for observability):
//
//	"Price cache job completed: gold=OK(25 items), silver=FAIL(error: ...), currency=OK(12 items)"
func (s *assetPriceService) RefreshAllPrices(ctx context.Context) error {
	now := time.Now()

	type result struct {
		count int
		err   error
	}

	var (
		goldResult, silverResult, currencyResult result
		wg                                       sync.WaitGroup
	)

	wg.Add(3)
	go func() {
		defer wg.Done()
		goldResult = s.refreshGold(ctx, now)
	}()
	go func() {
		defer wg.Done()
		silverResult = s.refreshSilver(ctx, now)
	}()
	go func() {
		defer wg.Done()
		currencyResult = s.refreshCurrency(ctx, now)
	}()
	wg.Wait()

	// Build log summary.
	goldStr := formatRefreshResult(goldResult.count, goldResult.err)
	silverStr := formatRefreshResult(silverResult.count, silverResult.err)
	currencyStr := formatRefreshResult(currencyResult.count, currencyResult.err)

	log.Printf("[assetPriceService] Price cache job completed: gold=%s, silver=%s, currency=%s",
		goldStr, silverStr, currencyStr)

	// Return combined error only if ALL three failed so callers can decide to retry.
	if goldResult.err != nil && silverResult.err != nil && currencyResult.err != nil {
		return fmt.Errorf("all price types failed: gold: %w; silver: %v; currency: %v",
			goldResult.err, silverResult.err, currencyResult.err)
	}
	return nil
}

// refreshGold fetches gold prices and upserts them. On failure it marks rows stale.
func (s *assetPriceService) refreshGold(ctx context.Context, now time.Time) struct {
	count int
	err   error
} {
	prices, err := s.goldSvc.FetchAllPrices(ctx)
	if err != nil {
		log.Printf("[assetPriceService] gold fetch failed: %v — marking stale", err)
		if markErr := s.repo.MarkStaleByAssetType(ctx, "gold"); markErr != nil {
			log.Printf("[assetPriceService] failed to mark gold stale: %v", markErr)
		}
		return struct {
			count int
			err   error
		}{0, err}
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
			IsStale:    false,
			FetchedAt:  now,
		})
	}

	if upsertErr := s.repo.UpsertBatch(ctx, batch); upsertErr != nil {
		log.Printf("[assetPriceService] gold upsert failed: %v — marking stale", upsertErr)
		if markErr := s.repo.MarkStaleByAssetType(ctx, "gold"); markErr != nil {
			log.Printf("[assetPriceService] failed to mark gold stale after upsert failure: %v", markErr)
		}
		return struct {
			count int
			err   error
		}{0, upsertErr}
	}

	return struct {
		count int
		err   error
	}{len(batch), nil}
}

// refreshSilver fetches silver prices and upserts them. On failure it marks rows stale.
func (s *assetPriceService) refreshSilver(ctx context.Context, now time.Time) struct {
	count int
	err   error
} {
	prices, err := s.silverSvc.FetchAllPrices(ctx)
	if err != nil {
		log.Printf("[assetPriceService] silver fetch failed: %v — marking stale", err)
		if markErr := s.repo.MarkStaleByAssetType(ctx, "silver"); markErr != nil {
			log.Printf("[assetPriceService] failed to mark silver stale: %v", markErr)
		}
		return struct {
			count int
			err   error
		}{0, err}
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
			IsStale:    false,
			FetchedAt:  now,
		})
	}

	if upsertErr := s.repo.UpsertBatch(ctx, batch); upsertErr != nil {
		log.Printf("[assetPriceService] silver upsert failed: %v — marking stale", upsertErr)
		if markErr := s.repo.MarkStaleByAssetType(ctx, "silver"); markErr != nil {
			log.Printf("[assetPriceService] failed to mark silver stale after upsert failure: %v", markErr)
		}
		return struct {
			count int
			err   error
		}{0, upsertErr}
	}

	return struct {
		count int
		err   error
	}{len(batch), nil}
}

// refreshCurrency fetches currency prices and upserts them. On failure it marks rows stale.
func (s *assetPriceService) refreshCurrency(ctx context.Context, now time.Time) struct {
	count int
	err   error
} {
	prices, err := s.currencySvc.FetchAllPrices(ctx)
	if err != nil {
		log.Printf("[assetPriceService] currency fetch failed: %v — marking stale", err)
		if markErr := s.repo.MarkStaleByAssetType(ctx, "currency"); markErr != nil {
			log.Printf("[assetPriceService] failed to mark currency stale: %v", markErr)
		}
		return struct {
			count int
			err   error
		}{0, err}
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
			IsStale:    false,
			FetchedAt:  now,
		})
	}

	if upsertErr := s.repo.UpsertBatch(ctx, batch); upsertErr != nil {
		log.Printf("[assetPriceService] currency upsert failed: %v — marking stale", upsertErr)
		if markErr := s.repo.MarkStaleByAssetType(ctx, "currency"); markErr != nil {
			log.Printf("[assetPriceService] failed to mark currency stale after upsert failure: %v", markErr)
		}
		return struct {
			count int
			err   error
		}{0, upsertErr}
	}

	return struct {
		count int
		err   error
	}{len(batch), nil}
}

// formatRefreshResult returns a human-readable summary fragment like "OK(25 items)" or "FAIL(error: timeout)".
func formatRefreshResult(count int, err error) string {
	if err != nil {
		return fmt.Sprintf("FAIL(error: %v)", err)
	}
	return fmt.Sprintf("OK(%d items)", count)
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
