package service

import (
	"context"
	"log"
	"time"

	"github.com/go-redis/redis/v8"

	"wealthjourney/pkg/cache"
)

// CurrencyPriceService handles fetching foreign currency prices
type CurrencyPriceService interface {
	FetchAllPrices(ctx context.Context) ([]*CachedCurrencyPrice, error)
}

// CachedCurrencyPrice represents a cached currency price with metadata
type CachedCurrencyPrice struct {
	TypeCode   string
	Name       string
	Buy        int64     // Price in VND (raw, NOT multiplied)
	Sell       int64     // Price in VND
	ChangeBuy  int64
	ChangeSell int64
	Currency   string    // Always "VND"
	UpdateTime time.Time
}

// currencyPriceService implements CurrencyPriceService using a waterfall of
// CurrencyPriceFetchers with emergency-cache fallback.
type currencyPriceService struct {
	waterfall *WaterfallCurrencyFetcher
	cache     *cache.CurrencyPriceCache
}

// NewCurrencyPriceService creates a new currency price service backed by a
// vangsaigon → vang.today waterfall with source-health tracking.
func NewCurrencyPriceService(redisClient *redis.Client) CurrencyPriceService {
	fetchers := []CurrencyPriceFetcher{
		NewVangSaiGonCurrencyFetcher(5 * time.Second),
		NewVangTodayCurrencyFetcher(5 * time.Second),
	}
	healthTracker := NewSourceHealthCacheAdapter(cache.NewSourceHealthCache(redisClient))
	return &currencyPriceService{
		waterfall: NewWaterfallCurrencyFetcher(fetchers, healthTracker),
		cache:     cache.NewCurrencyPriceCache(redisClient),
	}
}

// FetchAllPrices fetches all foreign currency prices using a waterfall of
// live sources, with a one-hour emergency cache as last resort.
//
// Flow:
//  1. Return aggregate cache hit immediately.
//  2. Try waterfall (sources in priority order, unhealthy sources skipped).
//  3. On success: write regular + emergency caches (non-blocking), return data.
//  4. On all-sources failure: serve emergency cache if valid, else error.
func (s *currencyPriceService) FetchAllPrices(ctx context.Context) ([]*CachedCurrencyPrice, error) {
	// 1. Check aggregate cache first
	cachedAll, err := s.cache.GetAll(ctx)
	if err == nil && cachedAll != nil {
		return toCurrencyPrices(cachedAll), nil
	}

	// 2. Try waterfall (live sources)
	prices, err := s.waterfall.FetchCurrencyPrices(ctx)
	if err == nil {
		// 3. Write caches non-blocking so the response is not delayed.
		cacheList := toCacheCurrencyPrices(prices)
		go func(list []*cache.CachedCurrencyPrice) {
			bgCtx := context.Background()
			if setErr := s.cache.SetAll(bgCtx, list, cache.AllCurrencyPricesCacheTTL); setErr != nil {
				log.Printf("[currencyPriceService] Warning: failed to set aggregate currency cache: %v", setErr)
			}
			if setErr := s.cache.SetEmergency(bgCtx, list); setErr != nil {
				log.Printf("[currencyPriceService] Warning: failed to set emergency currency cache: %v", setErr)
			}
			for _, p := range list {
				if setErr := s.cache.Set(bgCtx, p.TypeCode, p, cache.CurrencyPriceCacheTTL); setErr != nil {
					log.Printf("[currencyPriceService] Warning: failed to cache currency price for %s: %v", p.TypeCode, setErr)
				}
			}
		}(cacheList)
		return prices, nil
	}

	// 4. All live sources failed — try emergency cache.
	log.Printf("[currencyPriceService] All live sources failed: %v — trying emergency cache", err)
	emergency, emergencyErr := s.cache.GetEmergency(ctx)
	if emergencyErr == nil && emergency != nil {
		log.Printf("[currencyPriceService] Serving stale emergency currency cache (%d entries)", len(emergency))
		return toCurrencyPrices(emergency), nil
	}

	// No emergency data available — return the original error.
	return nil, err
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

// toCurrencyPrices converts cache layer structs to service layer structs.
func toCurrencyPrices(list []*cache.CachedCurrencyPrice) []*CachedCurrencyPrice {
	result := make([]*CachedCurrencyPrice, len(list))
	for i, c := range list {
		result[i] = &CachedCurrencyPrice{
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
	return result
}

// toCacheCurrencyPrices converts service layer structs to cache layer structs.
func toCacheCurrencyPrices(list []*CachedCurrencyPrice) []*cache.CachedCurrencyPrice {
	result := make([]*cache.CachedCurrencyPrice, len(list))
	for i, p := range list {
		result[i] = &cache.CachedCurrencyPrice{
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
