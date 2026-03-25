package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"wealthjourney/pkg/cache"
)

// PriceSource identifies a price data source.
type PriceSource string

const (
	SourceVangSaiGon PriceSource = "vangsaigon"
	SourceVangToday  PriceSource = "vangtoday"
	SourceBTMC       PriceSource = "btmc"

	// waterfallSourceTimeout is the per-source fetch timeout used by the waterfall fetchers.
	waterfallSourceTimeout = 5 * time.Second
)

// GoldPriceFetcher abstracts fetching gold prices from a single source.
type GoldPriceFetcher interface {
	FetchGoldPrices(ctx context.Context) ([]*CachedGoldPrice, error)
	Source() PriceSource
}

// CurrencyPriceFetcher abstracts fetching currency prices from a single source.
type CurrencyPriceFetcher interface {
	FetchCurrencyPrices(ctx context.Context) ([]*CachedCurrencyPrice, error)
	Source() PriceSource
}

// SourceHealthTracker tracks which price sources are healthy.
// Implementations must be safe for concurrent use.
type SourceHealthTracker interface {
	// IsHealthy returns true when the source is not currently flagged as unhealthy.
	// Implementations must return true on any internal error (fail-open).
	IsHealthy(ctx context.Context, source PriceSource) bool
	// MarkUnhealthy flags a source as unhealthy for a short TTL.
	MarkUnhealthy(ctx context.Context, source PriceSource) error
}

// ---------------------------------------------------------------------------
// WaterfallGoldFetcher
// ---------------------------------------------------------------------------

// WaterfallGoldFetcher tries multiple GoldPriceFetchers in priority order,
// falling back to the next source whenever one returns an error.
type WaterfallGoldFetcher struct {
	fetchers      []GoldPriceFetcher
	healthTracker SourceHealthTracker
}

// NewWaterfallGoldFetcher creates a WaterfallGoldFetcher with the given priority-ordered fetchers.
func NewWaterfallGoldFetcher(fetchers []GoldPriceFetcher, healthTracker SourceHealthTracker) *WaterfallGoldFetcher {
	return &WaterfallGoldFetcher{
		fetchers:      fetchers,
		healthTracker: healthTracker,
	}
}

// FetchGoldPrices iterates sources in priority order, skipping unhealthy ones
// (unless it is the last remaining source), and returns the first successful result.
// If all sources fail, it returns a combined error.
func (w *WaterfallGoldFetcher) FetchGoldPrices(ctx context.Context) ([]*CachedGoldPrice, error) {
	var errs []string

	for i, f := range w.fetchers {
		src := f.Source()
		isLast := i == len(w.fetchers)-1

		// Skip unhealthy sources, but always try the last one.
		if !isLast && !w.healthTracker.IsHealthy(ctx, src) {
			log.Printf("[WaterfallGoldFetcher] skipping unhealthy source %q", src)
			continue
		}

		fetchCtx, cancel := context.WithTimeout(ctx, waterfallSourceTimeout)
		start := time.Now()
		prices, err := f.FetchGoldPrices(fetchCtx)
		elapsed := time.Since(start)
		cancel()

		if err != nil {
			log.Printf("[WaterfallGoldFetcher] source %q failed after %v: %v", src, elapsed, err)
			errs = append(errs, fmt.Sprintf("%s: %v", src, err))
			if markErr := w.healthTracker.MarkUnhealthy(ctx, src); markErr != nil {
				log.Printf("[WaterfallGoldFetcher] failed to mark source %q unhealthy: %v", src, markErr)
			}
			continue
		}

		return prices, nil
	}

	return nil, fmt.Errorf("all gold price sources failed: [%s]", strings.Join(errs, "; "))
}

// ---------------------------------------------------------------------------
// WaterfallCurrencyFetcher
// ---------------------------------------------------------------------------

// WaterfallCurrencyFetcher tries multiple CurrencyPriceFetchers in priority order,
// falling back to the next source whenever one returns an error.
type WaterfallCurrencyFetcher struct {
	fetchers      []CurrencyPriceFetcher
	healthTracker SourceHealthTracker
}

// NewWaterfallCurrencyFetcher creates a WaterfallCurrencyFetcher with the given priority-ordered fetchers.
func NewWaterfallCurrencyFetcher(fetchers []CurrencyPriceFetcher, healthTracker SourceHealthTracker) *WaterfallCurrencyFetcher {
	return &WaterfallCurrencyFetcher{
		fetchers:      fetchers,
		healthTracker: healthTracker,
	}
}

// FetchCurrencyPrices iterates sources in priority order, skipping unhealthy ones
// (unless it is the last remaining source), and returns the first successful result.
// If all sources fail, it returns a combined error.
func (w *WaterfallCurrencyFetcher) FetchCurrencyPrices(ctx context.Context) ([]*CachedCurrencyPrice, error) {
	var errs []string

	for i, f := range w.fetchers {
		src := f.Source()
		isLast := i == len(w.fetchers)-1

		// Skip unhealthy sources, but always try the last one.
		if !isLast && !w.healthTracker.IsHealthy(ctx, src) {
			log.Printf("[WaterfallCurrencyFetcher] skipping unhealthy source %q", src)
			continue
		}

		fetchCtx, cancel := context.WithTimeout(ctx, waterfallSourceTimeout)
		start := time.Now()
		prices, err := f.FetchCurrencyPrices(fetchCtx)
		elapsed := time.Since(start)
		cancel()

		if err != nil {
			log.Printf("[WaterfallCurrencyFetcher] source %q failed after %v: %v", src, elapsed, err)
			errs = append(errs, fmt.Sprintf("%s: %v", src, err))
			if markErr := w.healthTracker.MarkUnhealthy(ctx, src); markErr != nil {
				log.Printf("[WaterfallCurrencyFetcher] failed to mark source %q unhealthy: %v", src, markErr)
			}
			continue
		}

		return prices, nil
	}

	return nil, fmt.Errorf("all currency price sources failed: [%s]", strings.Join(errs, "; "))
}

// ---------------------------------------------------------------------------
// sourceHealthCacheAdapter
// ---------------------------------------------------------------------------

// sourceHealthCacheAdapter bridges *cache.SourceHealthCache (which uses plain
// string source identifiers) to the SourceHealthTracker interface (which uses
// the PriceSource type alias). This adapter allows the service layer to use
// the Redis-backed SourceHealthCache without coupling pkg/cache to the
// PriceSource type defined in the service package.
type sourceHealthCacheAdapter struct {
	inner *cache.SourceHealthCache
}

// NewSourceHealthCacheAdapter wraps a *cache.SourceHealthCache so it satisfies
// the SourceHealthTracker interface expected by the waterfall fetchers.
func NewSourceHealthCacheAdapter(inner *cache.SourceHealthCache) SourceHealthTracker {
	return &sourceHealthCacheAdapter{inner: inner}
}

// IsHealthy converts PriceSource to string and delegates to the inner cache.
func (a *sourceHealthCacheAdapter) IsHealthy(ctx context.Context, source PriceSource) bool {
	return a.inner.IsHealthy(ctx, string(source))
}

// MarkUnhealthy converts PriceSource to string and delegates to the inner cache.
func (a *sourceHealthCacheAdapter) MarkUnhealthy(ctx context.Context, source PriceSource) error {
	return a.inner.MarkUnhealthy(ctx, string(source))
}
