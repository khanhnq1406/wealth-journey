package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/go-redis/redis/v8"

	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/vnprice"
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

// goldPriceService implements GoldPriceService
type goldPriceService struct {
	client *vnprice.Client
	cache  *cache.GoldPriceCache
}

// NewGoldPriceService creates a new gold price service
func NewGoldPriceService(redisClient *redis.Client) GoldPriceService {
	return &goldPriceService{
		client: vnprice.NewClient(10 * time.Second),
		cache:  cache.NewGoldPriceCache(redisClient),
	}
}

// NewGoldPriceServiceWithCache creates a gold price service with an injected cache (for testing).
func NewGoldPriceServiceWithCache(redisClient *redis.Client, goldCache *cache.GoldPriceCache) GoldPriceService {
	return &goldPriceService{
		client: vnprice.NewClient(10 * time.Second),
		cache:  goldCache,
	}
}

// FetchPriceForSymbol fetches price for a specific gold symbol
func (s *goldPriceService) FetchPriceForSymbol(ctx context.Context, symbol string) (*CachedGoldPrice, error) {
	// Try cache first
	cached, err := s.cache.Get(ctx, symbol)
	if err == nil && cached != nil {
		return &CachedGoldPrice{
			TypeCode:   cached.TypeCode,
			Name:       cached.Name,
			Buy:        cached.Buy,
			Sell:       cached.Sell,
			ChangeBuy:  cached.ChangeBuy,
			ChangeSell: cached.ChangeSell,
			Currency:   cached.Currency,
			UpdateTime: time.Unix(cached.UpdateTime, 0),
		}, nil
	}

	// Fetch from vang247 API
	apiPrice, err := s.client.FetchGoldPrice(ctx, symbol)
	if err != nil {
		return nil, fmt.Errorf("fetch price from vang247 API: %w", err)
	}

	// Convert vang247 price format to storage format
	// VND prices are in VND x 1000, need to convert to VND x 1 (smallest unit)
	// USD prices are already in USD x 1, need to convert to cents (x 100)
	var buy, sell, changeBuy, changeSell int64

	if apiPrice.Currency == "USD" {
		buy = int64(apiPrice.Buy * 100)
		sell = int64(apiPrice.Sell * 100)
		changeBuy = int64(apiPrice.BuyChange * 100)
		changeSell = int64(apiPrice.SellChange * 100)
	} else {
		buy = int64(apiPrice.Buy * 1000)
		sell = int64(apiPrice.Sell * 1000)
		changeBuy = int64(apiPrice.BuyChange * 1000)
		changeSell = int64(apiPrice.SellChange * 1000)
	}

	price := &CachedGoldPrice{
		TypeCode:   apiPrice.Name,
		Name:       apiPrice.Name,
		Buy:        buy,
		Sell:       sell,
		ChangeBuy:  changeBuy,
		ChangeSell: changeSell,
		Currency:   apiPrice.Currency,
		UpdateTime: apiPrice.UpdateAt,
	}

	// Cache the result (non-blocking)
	go func() {
		cachedPrice := &cache.CachedGoldPrice{
			TypeCode:   price.TypeCode,
			Name:       price.Name,
			Buy:        price.Buy,
			Sell:       price.Sell,
			ChangeBuy:  price.ChangeBuy,
			ChangeSell: price.ChangeSell,
			Currency:   price.Currency,
			UpdateTime: price.UpdateTime.Unix(),
		}
		if err := s.cache.Set(context.Background(), symbol, cachedPrice, cache.GoldPriceCacheTTL); err != nil {
			log.Printf("Warning: failed to cache gold price for %s: %v", symbol, err)
		}
	}()

	return price, nil
}

// FetchAllPrices fetches all gold prices, reading from the aggregate Redis cache
// before hitting the external API. The aggregate cache is written with a 5-minute TTL
// so repeated page reloads do not exhaust the external API rate limit.
func (s *goldPriceService) FetchAllPrices(ctx context.Context) ([]*CachedGoldPrice, error) {
	// Check aggregate cache first
	cachedAll, err := s.cache.GetAll(ctx)
	if err == nil && cachedAll != nil {
		result := make([]*CachedGoldPrice, len(cachedAll))
		for i, c := range cachedAll {
			result[i] = &CachedGoldPrice{
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
		return result, nil
	}

	// Cache miss — fetch from external API
	pricesResp, err := s.client.FetchPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch prices from vang247 API: %w", err)
	}

	prices := make([]*CachedGoldPrice, 0, len(pricesResp.GoldPrices))
	cacheList := make([]*cache.CachedGoldPrice, 0, len(pricesResp.GoldPrices))

	for _, apiPrice := range pricesResp.GoldPrices {
		var buy, sell, changeBuy, changeSell int64

		if apiPrice.Currency == "USD" {
			buy = int64(apiPrice.Buy * 100)
			sell = int64(apiPrice.Sell * 100)
			changeBuy = int64(apiPrice.BuyChange * 100)
			changeSell = int64(apiPrice.SellChange * 100)
		} else {
			buy = int64(apiPrice.Buy * 1000)
			sell = int64(apiPrice.Sell * 1000)
			changeBuy = int64(apiPrice.BuyChange * 1000)
			changeSell = int64(apiPrice.SellChange * 1000)
		}

		price := &CachedGoldPrice{
			TypeCode:   apiPrice.Name,
			Name:       apiPrice.Name,
			Buy:        buy,
			Sell:       sell,
			ChangeBuy:  changeBuy,
			ChangeSell: changeSell,
			Currency:   apiPrice.Currency,
			UpdateTime: apiPrice.UpdateAt,
		}
		prices = append(prices, price)

		cp := &cache.CachedGoldPrice{
			TypeCode:   price.TypeCode,
			Name:       price.Name,
			Buy:        price.Buy,
			Sell:       price.Sell,
			ChangeBuy:  price.ChangeBuy,
			ChangeSell: price.ChangeSell,
			Currency:   price.Currency,
			UpdateTime: price.UpdateTime.Unix(),
		}
		cacheList = append(cacheList, cp)

		// Also write per-symbol cache (non-blocking, keeps existing behavior)
		go func(p *cache.CachedGoldPrice) {
			if err := s.cache.Set(context.Background(), p.TypeCode, p, cache.GoldPriceCacheTTL); err != nil {
				log.Printf("Warning: failed to cache gold price for %s: %v", p.TypeCode, err)
			}
		}(cp)
	}

	// Write aggregate cache (non-blocking)
	go func(list []*cache.CachedGoldPrice) {
		if err := s.cache.SetAll(context.Background(), list, cache.AllGoldPricesCacheTTL); err != nil {
			log.Printf("Warning: failed to set aggregate gold price cache: %v", err)
		}
	}(cacheList)

	return prices, nil
}
