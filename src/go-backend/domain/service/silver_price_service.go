package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/go-redis/redis/v8"

	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/vang247"
	"wealthjourney/pkg/yahoo"
)

// SilverPriceService handles fetching silver prices from vang247 and Yahoo Finance
type SilverPriceService interface {
	FetchPriceForSymbol(ctx context.Context, symbol string) (*CachedSilverPrice, error)
	FetchAllPrices(ctx context.Context) ([]*CachedSilverPrice, error)
}

// CachedSilverPrice represents a cached silver price with metadata
type CachedSilverPrice struct {
	TypeCode   string
	Name       string
	Buy        int64     // Price in smallest currency unit (VND: 1, USD: cents)
	Sell       int64     // Price in smallest currency unit
	ChangeBuy  int64     // Change in buy price in smallest currency unit
	ChangeSell int64     // Change in sell price in smallest currency unit
	Currency   string    // "VND" or "USD"
	UpdateTime time.Time
}

// silverPriceService implements SilverPriceService
type silverPriceService struct {
	client *vang247.Client
	cache  *cache.SilverPriceCache
}

// NewSilverPriceService creates a new silver price service
func NewSilverPriceService(redisClient *redis.Client) SilverPriceService {
	return &silverPriceService{
		client: vang247.NewClient(10 * time.Second),
		cache:  cache.NewSilverPriceCache(redisClient),
	}
}

// FetchPriceForSymbol fetches price for a specific silver symbol
func (s *silverPriceService) FetchPriceForSymbol(ctx context.Context, symbol string) (*CachedSilverPrice, error) {
	// For XAGUSD, use Yahoo Finance
	if symbol == "XAGUSD" || symbol == "SI=F" {
		return s.fetchUSDSilverPrice(ctx)
	}

	cacheKey := symbol

	// Try cache first
	cached, err := s.cache.Get(ctx, cacheKey, "VND")
	if err == nil && cached != nil {
		return &CachedSilverPrice{
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
	apiPrice, err := s.client.FetchSilverPrice(ctx, symbol)
	if err != nil {
		return nil, fmt.Errorf("fetch price from vang247 API: %w", err)
	}

	// Convert vang247 price format to storage format
	// VND prices are in VND x 1000, convert to VND x 1
	buy := int64(apiPrice.Buy * 1000)
	sell := int64(apiPrice.Sell * 1000)
	changeBuy := int64(apiPrice.BuyChange * 1000)
	changeSell := int64(apiPrice.SellChange * 1000)

	price := &CachedSilverPrice{
		TypeCode:   symbol,
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
		cachedPrice := &cache.CachedSilverPrice{
			TypeCode:   price.TypeCode,
			Name:       price.Name,
			Buy:        price.Buy,
			Sell:       price.Sell,
			ChangeBuy:  price.ChangeBuy,
			ChangeSell: price.ChangeSell,
			Currency:   price.Currency,
			UpdateTime: price.UpdateTime.Unix(),
		}
		if err := s.cache.Set(context.Background(), cacheKey, cachedPrice, cache.SilverPriceCacheTTL); err != nil {
			log.Printf("Warning: failed to cache silver price for %s: %v", cacheKey, err)
		}
	}()

	return price, nil
}

// fetchUSDSilverPrice fetches USD silver price from Yahoo Finance
// XAG is the silver futures symbol on Yahoo Finance
func (s *silverPriceService) fetchUSDSilverPrice(ctx context.Context) (*CachedSilverPrice, error) {
	// Try cache first
	cached, err := s.cache.Get(ctx, "XAGUSD", "USD")
	if err == nil && cached != nil {
		return &CachedSilverPrice{
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

	// Fetch from Yahoo Finance
	// SI=F is the silver futures symbol, alternatively we can use XAGUSD=X
	quote, err := yahoo.GetQuote(ctx, "SI=F")
	if err != nil {
		// Try alternative symbol
		quote, err = yahoo.GetQuote(ctx, "XAGUSD=X")
		if err != nil {
			return nil, fmt.Errorf("fetch USD silver price from Yahoo Finance: %w", err)
		}
	}

	// Convert price to cents (smallest currency unit for USD)
	priceInCents := yahoo.ToSmallestCurrencyUnitByCurrency(quote.RegularMarketPrice, "USD")

	price := &CachedSilverPrice{
		TypeCode:   "XAGUSD",
		Name:       "Silver World (XAG/USD)",
		Buy:        priceInCents,
		Sell:       priceInCents, // Use same price for sell (no spread in futures data)
		ChangeBuy:  0,
		ChangeSell: 0,
		Currency:   "USD",
		UpdateTime: time.Now(),
	}

	// Cache the result (non-blocking)
	go func() {
		cachedPrice := &cache.CachedSilverPrice{
			TypeCode:   price.TypeCode,
			Name:       price.Name,
			Buy:        price.Buy,
			Sell:       price.Sell,
			ChangeBuy:  price.ChangeBuy,
			ChangeSell: price.ChangeSell,
			Currency:   price.Currency,
			UpdateTime: price.UpdateTime.Unix(),
		}
		if err := s.cache.Set(context.Background(), "XAGUSD", cachedPrice, cache.SilverPriceCacheTTL); err != nil {
			log.Printf("Warning: failed to cache silver price for XAGUSD: %v", err)
		}
	}()

	return price, nil
}

// FetchAllPrices fetches all silver prices
func (s *silverPriceService) FetchAllPrices(ctx context.Context) ([]*CachedSilverPrice, error) {
	pricesResp, err := s.client.FetchPrices(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch prices from vang247 API: %w", err)
	}

	prices := make([]*CachedSilverPrice, 0, len(pricesResp.SilverPrices)+1)

	for _, apiPrice := range pricesResp.SilverPrices {
		// Skip XAGUSD from vang247 (will fetch from Yahoo)
		if apiPrice.Name == "XAGUSD" {
			continue
		}

		buy := int64(apiPrice.Buy * 1000)
		sell := int64(apiPrice.Sell * 1000)
		changeBuy := int64(apiPrice.BuyChange * 1000)
		changeSell := int64(apiPrice.SellChange * 1000)

		price := &CachedSilverPrice{
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

		go func(p *CachedSilverPrice) {
			cachedPrice := &cache.CachedSilverPrice{
				TypeCode:   p.TypeCode,
				Name:       p.Name,
				Buy:        p.Buy,
				Sell:       p.Sell,
				ChangeBuy:  p.ChangeBuy,
				ChangeSell: p.ChangeSell,
				Currency:   p.Currency,
				UpdateTime: p.UpdateTime.Unix(),
			}
			if err := s.cache.Set(context.Background(), p.TypeCode, cachedPrice, cache.SilverPriceCacheTTL); err != nil {
				log.Printf("Warning: failed to cache silver price for %s: %v", p.TypeCode, err)
			}
		}(price)
	}

	// Also fetch XAGUSD from Yahoo Finance
	xagPrice, err := s.fetchUSDSilverPrice(ctx)
	if err == nil {
		prices = append(prices, xagPrice)
	} else {
		log.Printf("Warning: failed to fetch XAGUSD price: %v", err)
	}

	return prices, nil
}
