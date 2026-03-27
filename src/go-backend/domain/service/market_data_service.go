package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/gold"
	"wealthjourney/pkg/silver"
	"wealthjourney/pkg/validator"
	"wealthjourney/pkg/yahoo"
	investmentv1 "wealthjourney/protobuf/v1"
)

// MarketDataService handles market data operations including price fetching and caching.
type MarketDataService interface {
	// GetPrice retrieves the current price for a symbol, using cache if fresh.
	GetPrice(ctx context.Context, symbol, currency string, investmentType investmentv1.InvestmentType, maxAge time.Duration) (*models.MarketData, error)

	// UpdatePricesForInvestments updates prices for multiple investments.
	UpdatePricesForInvestments(ctx context.Context, investments []*models.Investment, forceRefresh bool) (map[int32]int64, error)

	// SearchSymbols searches for investment symbols by query.
	SearchSymbols(ctx context.Context, query string, limit int) ([]yahoo.SearchResult, error)

	// GetPriceBatch fetches prices for multiple symbols in a single API call.
	GetPriceBatch(ctx context.Context, symbols []string) (map[string]*models.MarketData, error)
}

// marketDataService implements MarketDataService.
type marketDataService struct {
	marketDataRepo            repository.MarketDataRepository
	goldPriceService          GoldPriceService          // kept for cold-start fallback
	silverPriceService        SilverPriceService        // kept for cold-start fallback
	assetDisplayConfigService AssetDisplayConfigService // primary source for gold/silver prices
	goldConverter             *gold.Converter
	silverConverter           *silver.Converter
}

// NewMarketDataService creates a new MarketDataService.
// assetDisplayConfigService is the primary source for gold and silver prices.
// goldPriceService and silverPriceService are retained as cold-start fallbacks.
func NewMarketDataService(
	marketDataRepo repository.MarketDataRepository,
	goldPriceService GoldPriceService,
	silverPriceService SilverPriceService,
	assetDisplayConfigService AssetDisplayConfigService,
) MarketDataService {
	return &marketDataService{
		marketDataRepo:            marketDataRepo,
		goldPriceService:          goldPriceService,
		silverPriceService:        silverPriceService,
		assetDisplayConfigService: assetDisplayConfigService,
		goldConverter:             gold.NewGoldConverter(nil),
		silverConverter:           silver.NewSilverConverter(nil),
	}
}

// GetPrice retrieves the current price for a symbol, using cache if fresh.
// If cached data is older than maxAge or doesn't exist, fetches from external API.
func (s *marketDataService) GetPrice(ctx context.Context, symbol, currency string, investmentType investmentv1.InvestmentType, maxAge time.Duration) (*models.MarketData, error) {
	// Validate inputs
	if symbol == "" {
		return nil, apperrors.NewValidationError("symbol is required")
	}
	if err := validator.Currency(currency); err != nil {
		return nil, err
	}

	// Try to get cached data
	cached, err := s.marketDataRepo.GetBySymbolAndCurrency(ctx, symbol, currency)
	if err == nil && !cached.IsExpired(maxAge) {
		// Cache hit and data is fresh
		return cached, nil
	}

	// Cache miss or expired data - fetch from API
	var priceData *models.MarketData

	// Check if this is a gold investment
	if gold.IsGoldType(investmentType) {
		priceData, err = s.fetchGoldPriceFromDB(ctx, symbol, currency, investmentType)
	} else if silver.IsSilverType(investmentType) {
		priceData, err = s.fetchSilverPriceFromDB(ctx, symbol, currency, investmentType)
	} else {
		priceData, err = s.fetchPriceFromAPI(ctx, symbol, currency)
	}

	if err != nil {
		// If we have expired cached data, return it as fallback
		if cached != nil {
			log.Printf("Warning: API fetch failed for %s, using stale cache: %v", symbol, err)
			return cached, nil
		}
		// Return a more user-friendly error for API failures
		return nil, fmt.Errorf("unable to fetch current price for %s. Please try again later. Error: %w", symbol, err)
	}

	// Store in cache
	priceData.Timestamp = time.Now()
	if cached != nil && cached.ID > 0 {
		priceData.ID = cached.ID
		if err := s.marketDataRepo.Update(ctx, priceData); err != nil {
			// Log error but don't fail the request
			log.Printf("Warning: failed to update cached market data: %v\n", err)
		}
	} else {
		if err := s.marketDataRepo.Create(ctx, priceData); err != nil {
			// Log error but don't fail the request
			log.Printf("Warning: failed to cache market data: %v\n", err)
		}
	}

	return priceData, nil
}

// UpdatePricesForInvestments updates prices for multiple investments.
// Returns a map of investment ID to updated price.
// Uses batch API calls for better performance when possible.
func (s *marketDataService) UpdatePricesForInvestments(ctx context.Context, investments []*models.Investment, forceRefresh bool) (map[int32]int64, error) {
	updates := make(map[int32]int64)
	maxAge := 15 * time.Minute // Default cache age
	if forceRefresh {
		maxAge = 0 // Force refresh
	}

	// Group investments by type for batch processing
	var regularInvestments []*models.Investment    // Stocks, ETFs, crypto via Yahoo Finance
	var goldInvestments []*models.Investment       // Gold investments
	var silverInvestments []*models.Investment     // Silver investments

	for _, inv := range investments {
		invType := investmentv1.InvestmentType(inv.Type)
		if gold.IsGoldType(invType) {
			goldInvestments = append(goldInvestments, inv)
		} else if silver.IsSilverType(invType) {
			silverInvestments = append(silverInvestments, inv)
		} else {
			regularInvestments = append(regularInvestments, inv)
		}
	}

	// Process regular investments with batch API (10 symbols per batch)
	if len(regularInvestments) > 0 {
		const batchSize = 10
		for i := 0; i < len(regularInvestments); i += batchSize {
			end := i + batchSize
			if end > len(regularInvestments) {
				end = len(regularInvestments)
			}
			batch := regularInvestments[i:end]

			// Extract symbols for batch fetch
			symbols := make([]string, len(batch))
			for j, inv := range batch {
				symbols[j] = inv.Symbol
			}

			// Fetch prices in batch
			batchResults, err := s.GetPriceBatch(ctx, symbols)
			if err != nil {
				log.Printf("Warning: batch fetch failed for symbols %v: %v, falling back to individual fetch", symbols, err)
				// Fall back to individual fetches
				for _, inv := range batch {
					s.fetchAndUpdateSingle(ctx, inv, maxAge, updates)
				}
				continue
			}

			// Map batch results to investments
			for _, inv := range batch {
				if priceData, found := batchResults[inv.Symbol]; found {
					updates[inv.ID] = priceData.Price

					// Update cache
					cached, _ := s.marketDataRepo.GetBySymbolAndCurrency(ctx, inv.Symbol, inv.Currency)
					priceData.Timestamp = time.Now()
					if cached != nil && cached.ID > 0 {
						priceData.ID = cached.ID
						_ = s.marketDataRepo.Update(ctx, priceData)
					} else {
						_ = s.marketDataRepo.Create(ctx, priceData)
					}
				} else {
					log.Printf("Warning: no price data in batch for %s", inv.Symbol)
					// Try individual fetch as fallback
					s.fetchAndUpdateSingle(ctx, inv, maxAge, updates)
				}
			}
		}
	}

	// Process gold investments sequentially (specialized API)
	for _, inv := range goldInvestments {
		s.fetchAndUpdateSingle(ctx, inv, maxAge, updates)
	}

	// Process silver investments sequentially (specialized API)
	for _, inv := range silverInvestments {
		s.fetchAndUpdateSingle(ctx, inv, maxAge, updates)
	}

	return updates, nil
}

// fetchAndUpdateSingle is a helper to fetch and update a single investment price
func (s *marketDataService) fetchAndUpdateSingle(ctx context.Context, investment *models.Investment, maxAge time.Duration, updates map[int32]int64) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Warning: panic while getting price for %s: %v\n", investment.Symbol, r)
		}
	}()

	// Get price for this investment
	priceData, err := s.GetPrice(ctx, investment.Symbol, investment.Currency, investmentv1.InvestmentType(investment.Type), maxAge)
	if err != nil {
		// Log error but continue with other investments
		log.Printf("Warning: failed to get price for %s: %v\n", investment.Symbol, err)
		return
	}

	updates[investment.ID] = priceData.Price
}

// fetchPriceFromAPI fetches price data from Yahoo Finance API.
// Uses the v8 chart API which provides comprehensive market data.
func (s *marketDataService) fetchPriceFromAPI(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
	// Use GetQuote function for comprehensive data
	quote, err := yahoo.GetQuote(ctx, symbol)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch quote for %s: %w", symbol, err)
	}

	// Use quote's currency if available, otherwise fall back to investment's currency
	fetchedCurrency := quote.Currency
	if fetchedCurrency == "" {
		fetchedCurrency = currency
	}

	// Convert price from float to int64 (smallest currency unit)
	// Uses currency-based decimal places: VND has 0, USD has 2, etc.
	// For VND: 69800.00 -> 69800 (no decimal places)
	// For USD: 150.25 -> 15025 (2 decimal places)
	priceInSmallestUnit := yahoo.ToSmallestCurrencyUnitByCurrency(quote.RegularMarketPrice, fetchedCurrency)

	return &models.MarketData{
		Symbol:    quote.Symbol,
		Currency:  fetchedCurrency,
		Price:     priceInSmallestUnit,
		Change24h: quote.RegularMarketChangePercent,
		Volume24h: 0,
		Timestamp: time.Now(),
	}, nil
}

// fetchGoldPriceFromDB fetches the gold price from the AssetDisplayConfigService DB cache.
// This is the primary path — reads from the asset_price table (populated by the
// PriceCacheJob) rather than calling the live gold API on every request.
//
// On cold start (ResolvePrice returns an error because the DB has no rows yet),
// or when assetDisplayConfigService is nil (pre-Task-10 wiring), it falls back
// to GoldPriceService.FetchPriceForSymbol (live API).
//
// Price normalization (per-lượng → per-gram for VND gold) is always applied
// after the price is obtained, regardless of source.
func (s *marketDataService) fetchGoldPriceFromDB(ctx context.Context, symbol, currency string, investmentType investmentv1.InvestmentType) (*models.MarketData, error) {
	// Primary: DB cache via AssetDisplayConfigService.
	if s.assetDisplayConfigService != nil {
		rawPrice, _, resolveErr := s.assetDisplayConfigService.ResolvePrice(ctx, symbol, "gold")
		if resolveErr == nil {
			// Normalize per-lượng → per-gram (VND gold) or pass-through (USD gold).
			normalizedPrice := s.goldConverter.ProcessMarketPrice(rawPrice, currency, investmentType)
			return &models.MarketData{
				Symbol:    symbol,
				Currency:  currency,
				Price:     normalizedPrice,
				Change24h: 0,
				Volume24h: 0,
				Timestamp: time.Now(),
			}, nil
		}
		// Cold-start fallback: DB cache not yet populated — call live gold API.
		log.Printf("[marketDataService] gold DB cache miss for %s (cold start): %v — falling back to live API", symbol, resolveErr)
	}

	price, err := s.goldPriceService.FetchPriceForSymbol(ctx, symbol)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch gold price: %w", err)
	}

	// Convert market price to storage format
	// Market price for VND gold is per lượng (from vang.today), need to convert to per gram for storage
	// Market price for USD gold is already per ounce
	normalizedPrice := s.goldConverter.ProcessMarketPrice(price.Buy, currency, investmentType)

	return &models.MarketData{
		Symbol:    symbol,
		Currency:  currency,
		Price:     normalizedPrice,
		Change24h: 0, // vang.today provides change in absolute value, not percent
		Volume24h: 0,
		Timestamp: price.UpdateTime,
	}, nil
}

// fetchSilverPriceFromDB fetches the silver price from the AssetDisplayConfigService DB cache.
// This is the primary path — reads from the asset_price table (populated by the
// PriceCacheJob) rather than calling the live silver API on every request.
//
// On cold start (ResolvePrice returns an error), it falls back to
// SilverPriceService.FetchPriceForSymbol (live API).
//
// Price normalization (per-tael/kg → per-gram for VND silver, pass-through for USD) is
// always applied after the price is obtained, regardless of source.
func (s *marketDataService) fetchSilverPriceFromDB(ctx context.Context, symbol, currency string, investmentType investmentv1.InvestmentType) (*models.MarketData, error) {
	// Primary: DB cache via AssetDisplayConfigService.
	if s.assetDisplayConfigService != nil {
		rawPrice, _, resolveErr := s.assetDisplayConfigService.ResolvePrice(ctx, symbol, "silver")
		if resolveErr == nil {
			// Normalize unit (per-tael → per-gram for VND silver, pass-through for USD).
			normalizedPrice := s.silverConverter.ProcessMarketPrice(rawPrice, currency, investmentType, symbol)
			return &models.MarketData{
				Symbol:    symbol,
				Currency:  currency,
				Price:     normalizedPrice,
				Change24h: 0,
				Volume24h: 0,
				Timestamp: time.Now(),
			}, nil
		}
		// Cold-start fallback: DB cache not yet populated — call live silver API.
		log.Printf("[marketDataService] silver DB cache miss for %s (cold start): %v — falling back to live API", symbol, resolveErr)
	}

	price, err := s.silverPriceService.FetchPriceForSymbol(ctx, symbol)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch silver price from ancarat: %w", err)
	}

	// Convert market price to storage format
	// Market prices depend on symbol:
	// - AG_VND_Tael: price per tael, need to convert to per gram for storage
	// - AG_VND_Kg: price per kg, need to convert to per gram for storage
	// - XAG: price per ounce, already in storage format
	normalizedPrice := s.silverConverter.ProcessMarketPrice(price.Buy, currency, investmentType, symbol)

	return &models.MarketData{
		Symbol:    symbol,
		Currency:  currency,
		Price:     normalizedPrice,
		Change24h: 0, // ancarat API doesn't provide change percent
		Volume24h: 0,
		Timestamp: price.UpdateTime,
	}, nil
}

// SearchSymbols searches for investment symbols by query.
func (s *marketDataService) SearchSymbols(ctx context.Context, query string, limit int) ([]yahoo.SearchResult, error) {
	return yahoo.SearchSymbols(ctx, query, limit)
}

// GetPriceBatch fetches prices for multiple symbols in a single API call.
// Returns a map of symbol to MarketData.
func (s *marketDataService) GetPriceBatch(ctx context.Context, symbols []string) (map[string]*models.MarketData, error) {
	if len(symbols) == 0 {
		return nil, apperrors.NewValidationError("symbols list cannot be empty")
	}

	// Use batch quote API
	quotes, err := yahoo.GetQuoteBatch(ctx, symbols)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch batch quotes: %w", err)
	}

	// Convert to MarketData
	results := make(map[string]*models.MarketData)
	for _, quote := range quotes {
		priceInSmallestUnit := yahoo.ToSmallestCurrencyUnitByCurrency(quote.RegularMarketPrice, quote.Currency)
		results[quote.Symbol] = &models.MarketData{
			Symbol:    quote.Symbol,
			Currency:  quote.Currency,
			Price:     priceInSmallestUnit,
			Change24h: quote.RegularMarketChangePercent,
			Volume24h: 0,
			Timestamp: time.Now(),
		}
	}

	return results, nil
}
