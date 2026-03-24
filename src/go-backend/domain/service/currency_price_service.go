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

// currencyPriceService implements CurrencyPriceService
type currencyPriceService struct {
	client *vnprice.Client
	cache  *cache.CurrencyPriceCache
}

// NewCurrencyPriceService creates a new currency price service
func NewCurrencyPriceService(redisClient *redis.Client) CurrencyPriceService {
	return &currencyPriceService{
		client: vnprice.NewClient(10 * time.Second),
		cache:  cache.NewCurrencyPriceCache(redisClient),
	}
}

// NewCurrencyPriceServiceWithCache creates a currency price service with an injected cache (for testing).
func NewCurrencyPriceServiceWithCache(redisClient *redis.Client, currCache *cache.CurrencyPriceCache) CurrencyPriceService {
	return &currencyPriceService{
		client: vnprice.NewClient(10 * time.Second),
		cache:  currCache,
	}
}

// FetchAllPrices fetches all foreign currency prices from vangsaigon API, reading
// from the aggregate Redis cache before hitting the external API to limit external
// API calls when users reload the Prices page.
func (s *currencyPriceService) FetchAllPrices(ctx context.Context) ([]*CachedCurrencyPrice, error) {
	// Check aggregate cache first
	cachedAll, err := s.cache.GetAll(ctx)
	if err == nil && cachedAll != nil {
		result := make([]*CachedCurrencyPrice, len(cachedAll))
		for i, c := range cachedAll {
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
		return result, nil
	}

	// Cache miss — fetch from external API
	pricesResp, err := s.client.FetchPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch prices from vangsaigon API: %w", err)
	}

	prices := make([]*CachedCurrencyPrice, 0, len(pricesResp.CurrencyPrices))
	cacheList := make([]*cache.CachedCurrencyPrice, 0, len(pricesResp.CurrencyPrices))

	for _, apiPrice := range pricesResp.CurrencyPrices {
		// Currency prices from vangsaigon are already in raw VND — no multiplication needed
		buy := int64(apiPrice.Buy)
		sell := int64(apiPrice.Sell)
		changeBuy := int64(apiPrice.BuyChange)
		changeSell := int64(apiPrice.SellChange)

		price := &CachedCurrencyPrice{
			TypeCode:   apiPrice.Code,
			Name:       apiPrice.Name,
			Buy:        buy,
			Sell:       sell,
			ChangeBuy:  changeBuy,
			ChangeSell: changeSell,
			Currency:   "VND",
			UpdateTime: apiPrice.UpdateAt,
		}
		prices = append(prices, price)

		cp := &cache.CachedCurrencyPrice{
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
		go func(p *cache.CachedCurrencyPrice) {
			if err := s.cache.Set(context.Background(), p.TypeCode, p, cache.CurrencyPriceCacheTTL); err != nil {
				log.Printf("Warning: failed to cache currency price for %s: %v", p.TypeCode, err)
			}
		}(cp)
	}

	// Write aggregate cache (non-blocking)
	go func(list []*cache.CachedCurrencyPrice) {
		if err := s.cache.SetAll(context.Background(), list, cache.AllCurrencyPricesCacheTTL); err != nil {
			log.Printf("Warning: failed to set aggregate currency price cache: %v", err)
		}
	}(cacheList)

	return prices, nil
}
