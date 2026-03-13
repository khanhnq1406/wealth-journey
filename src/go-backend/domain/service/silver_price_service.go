package service

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"

	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/silverprice"
	"wealthjourney/pkg/vnprice"
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
	client        *vnprice.Client
	cache         *cache.SilverPriceCache
	phuquyClient  *silverprice.PhuQuyClient
	ancaratClient *silverprice.AncaratClient
	dojiClient    *silverprice.DOJIClient
}

// NewSilverPriceService creates a new silver price service
func NewSilverPriceService(redisClient *redis.Client) SilverPriceService {
	return &silverPriceService{
		client:        vnprice.NewClient(10 * time.Second),
		cache:         cache.NewSilverPriceCache(redisClient),
		phuquyClient:  silverprice.NewPhuQuyClient(),
		ancaratClient: silverprice.NewAncaratClient(),
		dojiClient:    silverprice.NewDOJIClient(),
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

// FetchAllPrices fetches silver prices from multiple sources in parallel:
// Phú Quý, Ancarat, DOJI, and SBJ (static entries).
func (s *silverPriceService) FetchAllPrices(ctx context.Context) ([]*CachedSilverPrice, error) {
	var (
		phuquyPrices  []silverprice.ExternalSilverPrice
		ancaratPrices []silverprice.ExternalSilverPrice
		dojiPrices    []silverprice.ExternalSilverPrice
		mu            sync.Mutex
		wg            sync.WaitGroup
	)

	// Fetch from all sources in parallel
	wg.Add(3)

	go func() {
		defer wg.Done()
		prices, err := s.phuquyClient.FetchPrices(ctx)
		if err != nil {
			log.Printf("Warning: failed to fetch Phú Quý silver prices: %v", err)
			return
		}
		mu.Lock()
		phuquyPrices = prices
		mu.Unlock()
	}()

	go func() {
		defer wg.Done()
		prices, err := s.ancaratClient.FetchPrices(ctx)
		if err != nil {
			log.Printf("Warning: failed to fetch Ancarat silver prices: %v", err)
			return
		}
		mu.Lock()
		ancaratPrices = prices
		mu.Unlock()
	}()

	go func() {
		defer wg.Done()
		prices, err := s.dojiClient.FetchPrices(ctx)
		if err != nil {
			log.Printf("Warning: failed to fetch DOJI silver prices: %v", err)
			return
		}
		mu.Lock()
		dojiPrices = prices
		mu.Unlock()
	}()

	wg.Wait()

	// Build ordered result (12 rows as per spec)
	// Order: Phú Quý (4), Ancarat (4), SBJ (2), DOJI (2)
	orderedNames := []struct {
		name   string
		source string
	}{
		{"Phú Quý thỏi 1L", "phuquy"},
		{"Phú Quý thỏi 5L,10L", "phuquy"},
		{"Phú Quý 999 - 1Kg", "phuquy"},
		{"Bạc Mỹ nghệ Phú Quý", "phuquy"},
		{"Ancarat Ngân Long 1L", "ancarat"},
		{"Ancarat Ngân Long 5L", "ancarat"},
		{"Ancarat Ngân Long 1kg", "ancarat"},
		{"Ancarat thỏi 999 - 1kg", "ancarat"},
		{"SBJ 1L,10L,50L", "sbj"},
		{"SBJ 1kg", "sbj"},
		{"DOJI 99.9 1L", "doji"},
		{"DOJI 99.9 5L", "doji"},
	}

	// Build lookup maps by name
	allExternal := make(map[string]silverprice.ExternalSilverPrice)
	for _, p := range phuquyPrices {
		allExternal[p.Name] = p
	}
	for _, p := range ancaratPrices {
		allExternal[p.Name] = p
	}
	for _, p := range dojiPrices {
		allExternal[p.Name] = p
	}

	prices := make([]*CachedSilverPrice, 0, len(orderedNames))
	now := time.Now()

	for _, entry := range orderedNames {
		if entry.source == "sbj" {
			// SBJ: static entries with zero prices (displayed as "--" on frontend)
			prices = append(prices, &CachedSilverPrice{
				TypeCode:   toTypeCode(entry.name),
				Name:       entry.name,
				Buy:        0,
				Sell:       0,
				ChangeBuy:  0,
				ChangeSell: 0,
				Currency:   "VND",
				UpdateTime: now,
			})
			continue
		}

		ext, ok := allExternal[entry.name]
		if !ok {
			// Source failed or type not found — skip
			continue
		}

		price := &CachedSilverPrice{
			TypeCode:   toTypeCode(entry.name),
			Name:       ext.Name,
			Buy:        ext.Buy,
			Sell:       ext.Sell,
			ChangeBuy:  0,
			ChangeSell: 0,
			Currency:   "VND",
			UpdateTime: now,
		}
		prices = append(prices, price)

		// Cache each price (non-blocking)
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

	return prices, nil
}

// toTypeCode converts a display name to a type code (replace spaces with underscores, uppercase)
func toTypeCode(name string) string {
	code := ""
	for _, c := range name {
		switch {
		case c == ' ' || c == ',':
			code += "_"
		case c == '-' || c == '.':
			code += string(c)
		case c >= 'a' && c <= 'z':
			code += string(c - 32)
		case c >= 'A' && c <= 'Z' || c >= '0' && c <= '9':
			code += string(c)
		}
	}
	return code
}
