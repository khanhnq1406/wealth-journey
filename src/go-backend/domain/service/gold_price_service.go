package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/go-redis/redis/v8"

	"wealthjourney/pkg/cache"
)

// GoldPriceService handles fetching gold prices from vang247
type GoldPriceService interface {
	FetchPriceForSymbol(ctx context.Context, symbol string) (*CachedGoldPrice, error)
	FetchAllPrices(ctx context.Context) ([]*CachedGoldPrice, error)
}

// CachedGoldPrice represents a cached gold price with metadata
type CachedGoldPrice struct {
	TypeCode   string
	Name       string
	Buy        int64    // Price in smallest currency unit (VND: 1, USD: cents)
	Sell       int64    // Price in smallest currency unit
	ChangeBuy  int64    // Change in smallest currency unit
	ChangeSell int64    // Change in smallest currency unit
	Currency   string   // "VND" or "USD"
	UpdateTime time.Time
}

// goldPriceService implements GoldPriceService using a waterfall of
// GoldPriceFetchers with emergency-cache fallback.
type goldPriceService struct {
	waterfall *WaterfallGoldFetcher
	cache     *cache.GoldPriceCache
}

// NewGoldPriceService creates a new gold price service backed by a
// vangsaigon → vang.today waterfall with source-health tracking.
// Pass a non-empty btmcAPIKey to enable BTMC as a tertiary fallback source.
func NewGoldPriceService(redisClient *redis.Client, btmcAPIKey string) GoldPriceService {
	fetchers := []GoldPriceFetcher{
		NewVangSaiGonGoldFetcher(5 * time.Second),
		NewVangTodayGoldFetcher(5 * time.Second),
	}
	if btmcAPIKey != "" {
		btmcFetcher, err := NewBTMCGoldFetcher(5*time.Second, btmcAPIKey)
		if err == nil {
			fetchers = append(fetchers, btmcFetcher)
		} else {
			log.Printf("[goldPriceService] Warning: BTMC fetcher disabled: %v", err)
		}
	}

	healthTracker := NewSourceHealthCacheAdapter(cache.NewSourceHealthCache(redisClient))

	return &goldPriceService{
		waterfall: NewWaterfallGoldFetcher(fetchers, healthTracker),
		cache:     cache.NewGoldPriceCache(redisClient),
	}
}

// FetchAllPrices fetches all gold prices using a waterfall of live sources,
// with a one-hour emergency cache as last resort.
//
// Flow:
//  1. Return aggregate cache hit immediately.
//  2. Try waterfall (sources in priority order, unhealthy sources skipped).
//  3. On success: write regular + emergency caches (non-blocking), return data.
//  4. On all-sources failure: serve emergency cache if valid, else error.
func (s *goldPriceService) FetchAllPrices(ctx context.Context) ([]*CachedGoldPrice, error) {
	// 1. Check aggregate cache first
	cachedAll, err := s.cache.GetAll(ctx)
	if err == nil && cachedAll != nil {
		return toGoldPrices(cachedAll), nil
	}

	// 2. Try waterfall (live sources)
	prices, err := s.waterfall.FetchGoldPrices(ctx)
	if err == nil {
		// 3. Write caches non-blocking so the response is not delayed.
		cacheList := toCacheGoldPrices(prices)
		go func(list []*cache.CachedGoldPrice) {
			bgCtx := context.Background()
			if setErr := s.cache.SetAll(bgCtx, list, cache.AllGoldPricesCacheTTL); setErr != nil {
				log.Printf("[goldPriceService] Warning: failed to set aggregate gold cache: %v", setErr)
			}
			if setErr := s.cache.SetEmergency(bgCtx, list); setErr != nil {
				log.Printf("[goldPriceService] Warning: failed to set emergency gold cache: %v", setErr)
			}
			for _, p := range list {
				if setErr := s.cache.Set(bgCtx, p.TypeCode, p, cache.GoldPriceCacheTTL); setErr != nil {
					log.Printf("[goldPriceService] Warning: failed to cache gold price for %s: %v", p.TypeCode, setErr)
				}
			}
		}(cacheList)
		return prices, nil
	}

	// 4. All live sources failed — try emergency cache.
	log.Printf("[goldPriceService] All live sources failed: %v — trying emergency cache", err)
	emergency, emergencyErr := s.cache.GetEmergency(ctx)
	if emergencyErr == nil && emergency != nil {
		log.Printf("[goldPriceService] Serving stale emergency gold cache (%d entries)", len(emergency))
		return toGoldPrices(emergency), nil
	}

	// No emergency data available — return the original error.
	return nil, err
}

// FetchPriceForSymbol fetches the price for a specific gold symbol.
//
// Flow:
//  1. Try per-symbol cache → return if hit.
//  2. Try waterfall to fetch all prices → filter by TypeCode → cache result.
//  3. On waterfall failure, try emergency cache → filter by TypeCode.
//  4. Return error if symbol not found anywhere.
func (s *goldPriceService) FetchPriceForSymbol(ctx context.Context, symbol string) (*CachedGoldPrice, error) {
	// 1. Try per-symbol cache first.
	cached, err := s.cache.Get(ctx, symbol)
	if err == nil && cached != nil {
		return fromCacheGoldPrice(cached), nil
	}

	// 2. Try waterfall (live sources).
	allPrices, waterfallErr := s.waterfall.FetchGoldPrices(ctx)
	if waterfallErr == nil {
		// Cache all fetched prices non-blocking.
		go func(list []*CachedGoldPrice) {
			bgCtx := context.Background()
			cacheList := toCacheGoldPrices(list)
			for _, p := range cacheList {
				if setErr := s.cache.Set(bgCtx, p.TypeCode, p, cache.GoldPriceCacheTTL); setErr != nil {
					log.Printf("[goldPriceService] Warning: failed to cache gold price for %s: %v", p.TypeCode, setErr)
				}
			}
		}(allPrices)

		// Return the requested symbol from the fresh list.
		for _, p := range allPrices {
			if p.TypeCode == symbol {
				return p, nil
			}
		}
		return nil, fmt.Errorf("gold symbol %q not found in live price data", symbol)
	}

	// 3. Waterfall failed — try emergency cache for this symbol.
	emergency, emergencyErr := s.cache.GetEmergency(ctx)
	if emergencyErr == nil && emergency != nil {
		for _, ep := range emergency {
			if ep.TypeCode == symbol {
				log.Printf("[goldPriceService] Serving stale emergency price for symbol %q", symbol)
				return fromCacheGoldPrice(ep), nil
			}
		}
	}

	// 4. Symbol not found anywhere.
	return nil, fmt.Errorf("fetch gold price for symbol %q: %w", symbol, waterfallErr)
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

// toGoldPrices converts cache layer structs to service layer structs.
func toGoldPrices(list []*cache.CachedGoldPrice) []*CachedGoldPrice {
	result := make([]*CachedGoldPrice, len(list))
	for i, c := range list {
		result[i] = fromCacheGoldPrice(c)
	}
	return result
}

// fromCacheGoldPrice converts a single cache layer struct to a service layer struct.
func fromCacheGoldPrice(c *cache.CachedGoldPrice) *CachedGoldPrice {
	return &CachedGoldPrice{
		TypeCode:   c.TypeCode,
		Name:       c.Name,
		Buy:        c.Buy,
		Sell:       c.Sell,
		ChangeBuy:  c.ChangeBuy,
		ChangeSell: c.ChangeSell,
		Currency:   c.Currency,
		UpdateTime: time.Unix(c.UpdateTime, 0),
	}
}

// toCacheGoldPrices converts service layer structs to cache layer structs.
func toCacheGoldPrices(list []*CachedGoldPrice) []*cache.CachedGoldPrice {
	result := make([]*cache.CachedGoldPrice, len(list))
	for i, p := range list {
		result[i] = &cache.CachedGoldPrice{
			TypeCode:   p.TypeCode,
			Name:       p.Name,
			Buy:        p.Buy,
			Sell:       p.Sell,
			ChangeBuy:  p.ChangeBuy,
			ChangeSell: p.ChangeSell,
			Currency:   p.Currency,
			UpdateTime: p.UpdateTime.Unix(),
		}
	}
	return result
}
