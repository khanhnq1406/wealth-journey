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

// FetchAllPrices fetches all foreign currency prices from vangsaigon API
func (s *currencyPriceService) FetchAllPrices(ctx context.Context) ([]*CachedCurrencyPrice, error) {
	pricesResp, err := s.client.FetchPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch prices from vangsaigon API: %w", err)
	}

	prices := make([]*CachedCurrencyPrice, 0, len(pricesResp.CurrencyPrices))

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

		// Cache each price (non-blocking)
		go func(p *CachedCurrencyPrice) {
			cachedPrice := &cache.CachedCurrencyPrice{
				TypeCode:   p.TypeCode,
				Name:       p.Name,
				Buy:        p.Buy,
				Sell:       p.Sell,
				ChangeBuy:  p.ChangeBuy,
				ChangeSell: p.ChangeSell,
				Currency:   p.Currency,
				UpdateTime: p.UpdateTime.Unix(),
			}
			if err := s.cache.Set(context.Background(), p.TypeCode, cachedPrice, cache.CurrencyPriceCacheTTL); err != nil {
				log.Printf("Warning: failed to cache currency price for %s: %v", p.TypeCode, err)
			}
		}(price)
	}

	return prices, nil
}
