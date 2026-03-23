package service

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/shopspring/decimal"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/fx"
)

// fxRateService implements FXRateService using Yahoo Finance
type fxRateService struct {
	fxRateRepo  repository.FXRateRepository
	fxProvider  fx.Provider
	fxCache     *cache.FXRateCache
	converter   *CurrencyConverter
}

// NewFXRateService creates a new FX rate service
func NewFXRateService(
	fxRateRepo repository.FXRateRepository,
	redisClient *redis.Client,
) FXRateService {
	// Create Yahoo Finance provider
	yahooProvider := fx.NewYahooFinanceProvider()

	// Create currency converter
	converter := NewCurrencyConverter(yahooProvider)

	return &fxRateService{
		fxRateRepo:  fxRateRepo,
		fxProvider:  yahooProvider,
		fxCache:     cache.NewFXRateCache(redisClient),
		converter:   converter,
	}
}

// GetRate retrieves the latest FX rate for a currency pair
// Uses cache first, then database, then external API
func (s *fxRateService) GetRate(ctx context.Context, fromCurrency, toCurrency string) (float64, error) {
	// Validate currencies
	if err := s.validateCurrencies(fromCurrency, toCurrency); err != nil {
		return 0, err
	}

	// Normalize currency codes
	fromCurrency = normalizeCurrency(fromCurrency)
	toCurrency = normalizeCurrency(toCurrency)

	// Same currency check
	if fromCurrency == toCurrency {
		return 1.0, nil
	}

	// 1. Try Redis cache first (fastest)
	cachedRate, err := s.fxCache.Get(ctx, fromCurrency, toCurrency)
	if err == nil && cachedRate > 0 {
		return cachedRate, nil
	}

	// 2. Try database cache (second fastest)
	dbRate, err := s.fxRateRepo.GetByPair(ctx, fromCurrency, toCurrency)
	if err == nil && s.isRateFresh(dbRate.Timestamp, 15*time.Minute) {
		// Update Redis cache
		_ = s.fxCache.Set(ctx, fromCurrency, toCurrency, dbRate.Rate)
		return dbRate.Rate, nil
	}

	// 3. Fetch from external API (slowest)
	rate, err := s.fetchAndCacheRate(ctx, fromCurrency, toCurrency)
	if err != nil {
		// If we have a stale cached rate, use it as fallback
		if dbRate != nil {
			log.Printf("Warning: FX API failed for %s->%s, using stale cache: %v", fromCurrency, toCurrency, err)
			return dbRate.Rate, nil
		}
		return 0, fmt.Errorf("unable to fetch FX rate for %s->%s: %w", fromCurrency, toCurrency, err)
	}

	return rate, nil
}

// ConvertAmount converts an amount from one currency to another
// Accounts for different decimal places between currencies (e.g., USD has 2, VND has 0)
func (s *fxRateService) ConvertAmount(ctx context.Context, amount int64, fromCurrency, toCurrency string) (int64, error) {
	// Get the rate
	rate, err := s.GetRate(ctx, fromCurrency, toCurrency)
	if err != nil {
		return 0, err
	}

	// Convert using the rate with proper decimal handling
	return s.converter.ConvertAmountWithRateAndCurrencies(amount, rate, fromCurrency, toCurrency), nil
}

// ConvertAmountWithRate converts an amount using a provided FX rate (avoids fetching the rate)
// Accounts for different decimal places between currencies (e.g., USD has 2, VND has 0)
func (s *fxRateService) ConvertAmountWithRate(ctx context.Context, amount int64, rate float64, fromCurrency, toCurrency string) (int64, error) {
	// Convert using the provided rate with proper decimal handling
	return s.converter.ConvertAmountWithRateAndCurrencies(amount, rate, fromCurrency, toCurrency), nil
}

// BatchGetRates retrieves multiple FX rates in parallel for efficiency
func (s *fxRateService) BatchGetRates(ctx context.Context, pairs []CurrencyPair) (map[CurrencyPair]float64, error) {
	results := make(map[CurrencyPair]float64)
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Create error channel to collect errors
	errChan := make(chan error, len(pairs))

	for _, pair := range pairs {
		wg.Add(1)
		go func(p CurrencyPair) {
			defer wg.Done()

			rate, err := s.GetRate(ctx, p.From, p.To)
			if err != nil {
				errChan <- err
				return
			}

			mu.Lock()
			results[p] = rate
			mu.Unlock()
		}(pair)
	}

	// Wait for all goroutines to complete
	wg.Wait()
	close(errChan)

	// Check if there were any errors
	var errors []error
	for err := range errChan {
		errors = append(errors, err)
	}

	// If all requests failed, return an error
	if len(errors) == len(pairs) {
		return nil, fmt.Errorf("all FX rate requests failed: %d errors", len(errors))
	}

	// Log partial failures
	if len(errors) > 0 {
		log.Printf("Warning: %d/%d FX rate requests failed", len(errors), len(pairs))
	}

	return results, nil
}

// UpdateRate fetches and stores the latest FX rate for a currency pair
func (s *fxRateService) UpdateRate(ctx context.Context, fromCurrency, toCurrency string) error {
	_, err := s.fetchAndCacheRate(ctx, fromCurrency, toCurrency)
	return err
}

// IsSupportedCurrency checks if a currency code is supported
func (s *fxRateService) IsSupportedCurrency(currency string) bool {
	return fx.IsSupportedCurrency(currency)
}

// GetSupportedCurrencies returns the list of supported currency codes
func (s *fxRateService) GetSupportedCurrencies() []string {
	return fx.GetSupportedCurrencies()
}

// fetchAndCacheRate fetches a rate from the API and caches it in both Redis and database
func (s *fxRateService) fetchAndCacheRate(ctx context.Context, fromCurrency, toCurrency string) (float64, error) {
	// Fetch from external API
	rate, err := s.fxProvider.GetRate(ctx, fromCurrency, toCurrency)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch FX rate from API: %w", err)
	}

	// Validate the rate
	if err := fx.ValidateRate(fromCurrency, toCurrency, rate); err != nil {
		return 0, fmt.Errorf("invalid FX rate: %w", err)
	}

	// Store in Redis cache (non-blocking, log errors)
	if err := s.fxCache.Set(ctx, fromCurrency, toCurrency, rate); err != nil {
		log.Printf("Warning: failed to cache FX rate in Redis: %v\n", err)
	}

	// Store in database cache (non-blocking, log errors)
	now := time.Now()
	fxRate := &models.FXRate{
		FromCurrency: fromCurrency,
		ToCurrency:   toCurrency,
		Rate:         rate,
		Timestamp:    now,
	}

	// Try to update existing record or create new one
	existing, err := s.fxRateRepo.GetByPair(ctx, fromCurrency, toCurrency)
	if err == nil && existing != nil {
		fxRate.ID = existing.ID
		if err := s.fxRateRepo.Update(ctx, fxRate); err != nil {
			log.Printf("Warning: failed to update FX rate in database: %v\n", err)
		}
	} else {
		if err := s.fxRateRepo.Create(ctx, fxRate); err != nil {
			log.Printf("Warning: failed to create FX rate in database: %v\n", err)
		}
	}

	return rate, nil
}

// validateCurrencies validates that both currencies are supported
func (s *fxRateService) validateCurrencies(fromCurrency, toCurrency string) error {
	if fromCurrency == "" || toCurrency == "" {
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.FxCurrencyEmpty, "currency codes cannot be empty")
	}

	if !s.IsSupportedCurrency(fromCurrency) {
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.FxFromCurrencyUnsupported, fmt.Sprintf("unsupported from currency: %s", fromCurrency))
	}

	if !s.IsSupportedCurrency(toCurrency) {
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.FxToCurrencyUnsupported, fmt.Sprintf("unsupported to currency: %s", toCurrency))
	}

	return nil
}

// isRateFresh checks if a cached rate is still fresh
func (s *fxRateService) isRateFresh(timestamp time.Time, maxAge time.Duration) bool {
	return time.Since(timestamp) < maxAge
}

// normalizeCurrency normalizes a currency code to uppercase
func normalizeCurrency(currency string) string {
	if len(currency) == 3 {
		return currency
	}
	return currency
}

// CurrencyConverter wraps the currency converter for use in services
type CurrencyConverter struct {
	rateProvider fx.Provider
}

// NewCurrencyConverter creates a new currency converter
func NewCurrencyConverter(rateProvider fx.Provider) *CurrencyConverter {
	return &CurrencyConverter{
		rateProvider: rateProvider,
	}
}

// ConvertAmountWithRate converts an amount using a provided rate
// DEPRECATED: Use ConvertAmountWithRateAndCurrencies for proper decimal handling
// This is used when we already have the rate and don't want to fetch it again
func (c *CurrencyConverter) ConvertAmountWithRate(amount int64, rate float64) int64 {
	// Use decimal for precision
	amountDecimal := decimal.NewFromInt(amount)
	rateDecimal := decimal.NewFromFloat(rate)
	convertedDecimal := amountDecimal.Mul(rateDecimal)
	return convertedDecimal.IntPart()
}

// ConvertAmountWithRateAndCurrencies converts an amount using a provided rate
// while accounting for different decimal places between currencies
// Example: 42 cents USD to VND at rate 25850 = 10857 dong (not 1085700)
func (c *CurrencyConverter) ConvertAmountWithRateAndCurrencies(amount int64, rate float64, fromCurrency, toCurrency string) int64 {
	// Get decimal multipliers for both currencies
	fromMultiplier := fx.GetDecimalMultiplier(fromCurrency)
	toMultiplier := fx.GetDecimalMultiplier(toCurrency)

	// Use decimal for precision
	amountDecimal := decimal.NewFromInt(amount)
	fromMultiplierDecimal := decimal.NewFromInt(fromMultiplier)
	toMultiplierDecimal := decimal.NewFromInt(toMultiplier)
	rateDecimal := decimal.NewFromFloat(rate)

	// Formula: (amount / fromMultiplier) * rate * toMultiplier
	convertedDecimal := amountDecimal.
		Div(fromMultiplierDecimal).
		Mul(rateDecimal).
		Mul(toMultiplierDecimal)

	return convertedDecimal.Round(0).IntPart()
}
