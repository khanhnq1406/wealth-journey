package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/gold"
	"wealthjourney/pkg/silver"
	v1 "wealthjourney/protobuf/v1"
)

const watchlistMaxItems = 50

// watchlistService implements WatchlistService.
type watchlistService struct {
	watchlistRepo  repository.WatchlistRepository
	goldPriceSvc   GoldPriceService
	silverPriceSvc SilverPriceService
	marketDataSvc  MarketDataService
}

// NewWatchlistService creates a new WatchlistService.
func NewWatchlistService(
	watchlistRepo repository.WatchlistRepository,
	goldPriceSvc GoldPriceService,
	silverPriceSvc SilverPriceService,
	marketDataSvc MarketDataService,
) WatchlistService {
	return &watchlistService{
		watchlistRepo:  watchlistRepo,
		goldPriceSvc:   goldPriceSvc,
		silverPriceSvc: silverPriceSvc,
		marketDataSvc:  marketDataSvc,
	}
}

// CreateItem adds a new symbol to the user's watchlist.
func (s *watchlistService) CreateItem(ctx context.Context, userID int32, req *v1.CreateWatchlistItemRequest) (*v1.CreateWatchlistItemResponse, error) {
	// Validate and trim symbol
	symbol := strings.TrimSpace(req.Symbol)
	if len(symbol) == 0 || len(symbol) > 50 {
		return nil, apperrors.NewValidationError("symbol must be between 1 and 50 characters")
	}

	// Validate and trim name
	name := strings.TrimSpace(req.Name)
	if len(name) == 0 || len(name) > 200 {
		return nil, apperrors.NewValidationError("name must be between 1 and 200 characters")
	}

	// Validate and trim note
	note := strings.TrimSpace(req.Note)
	if len(note) > 200 {
		return nil, apperrors.NewValidationError("note must be at most 200 characters")
	}

	// Validate currency
	currency := strings.TrimSpace(req.Currency)
	if len(currency) < 2 || len(currency) > 3 {
		return nil, apperrors.NewValidationError("currency must be a 2-3 character ISO code")
	}

	// Check 50-item limit
	count, err := s.watchlistRepo.CountByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if count >= watchlistMaxItems {
		return nil, apperrors.NewValidationError(fmt.Sprintf("maximum watchlist limit of %d items reached", watchlistMaxItems))
	}

	// Check for duplicate symbol
	existing, err := s.watchlistRepo.GetBySymbolForUser(ctx, symbol, userID)
	if err == nil && existing != nil {
		return nil, apperrors.NewConflictError("symbol already in watchlist")
	}

	// Get max sort order and increment
	maxOrder, err := s.watchlistRepo.GetMaxSortOrder(ctx, userID)
	if err != nil {
		return nil, err
	}
	sortOrder := maxOrder + 1

	// Create model
	item := &models.WatchlistItem{
		UserID:    userID,
		Symbol:    symbol,
		Name:      name,
		AssetType: int32(req.AssetType),
		Currency:  currency,
		Note:      note,
		SortOrder: sortOrder,
	}

	if err := s.watchlistRepo.Create(ctx, item); err != nil {
		return nil, err
	}

	return &v1.CreateWatchlistItemResponse{
		Success:   true,
		Message:   "Item added to watchlist",
		Item:      modelToWatchlistProto(item),
		Timestamp: fmt.Sprintf("%d", time.Now().Unix()),
	}, nil
}

// ListItems retrieves all watchlist items for the user, enriched with current prices.
func (s *watchlistService) ListItems(ctx context.Context, userID int32) (*v1.ListWatchlistResponse, error) {
	items, err := s.watchlistRepo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Group items by price source
	var goldItems []*models.WatchlistItem
	var silverItems []*models.WatchlistItem
	var marketItems []*models.WatchlistItem

	for _, item := range items {
		assetType := v1.InvestmentType(item.AssetType)
		if gold.IsGoldType(assetType) {
			goldItems = append(goldItems, item)
		} else if silver.IsSilverType(assetType) {
			silverItems = append(silverItems, item)
		} else {
			marketItems = append(marketItems, item)
		}
	}

	// Price maps keyed by symbol
	type priceInfo struct {
		currentPrice       int64
		buyPrice           int64
		sellPrice          int64
		priceChange        int64
		priceChangePercent float64
	}
	priceMap := make(map[string]*priceInfo, len(items))
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Fetch gold prices in parallel
	if len(goldItems) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			allGoldPrices, err := s.goldPriceSvc.FetchAllPrices(ctx)
			if err != nil {
				log.Printf("Warning: failed to fetch gold prices for watchlist: %v", err)
				return
			}
			// Build a lookup map by TypeCode
			goldByCode := make(map[string]*CachedGoldPrice, len(allGoldPrices))
			for _, gp := range allGoldPrices {
				goldByCode[gp.TypeCode] = gp
			}
			mu.Lock()
			defer mu.Unlock()
			for _, item := range goldItems {
				if gp, ok := goldByCode[item.Symbol]; ok {
					priceMap[item.Symbol] = &priceInfo{
						currentPrice: gp.Buy,
						buyPrice:     gp.Buy,
						sellPrice:    gp.Sell,
					}
				}
			}
		}()
	}

	// Fetch silver prices in parallel
	if len(silverItems) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			allSilverPrices, err := s.silverPriceSvc.FetchAllPrices(ctx)
			if err != nil {
				log.Printf("Warning: failed to fetch silver prices for watchlist: %v", err)
				return
			}
			silverByCode := make(map[string]*CachedSilverPrice, len(allSilverPrices))
			for _, sp := range allSilverPrices {
				silverByCode[sp.TypeCode] = sp
			}
			mu.Lock()
			defer mu.Unlock()
			for _, item := range silverItems {
				if sp, ok := silverByCode[item.Symbol]; ok {
					priceMap[item.Symbol] = &priceInfo{
						currentPrice: sp.Buy,
						buyPrice:     sp.Buy,
						sellPrice:    sp.Sell,
					}
				}
			}
		}()
	}

	// Fetch market (Yahoo Finance) prices — one goroutine per item for simplicity
	for _, item := range marketItems {
		item := item // capture loop variable
		wg.Add(1)
		go func() {
			defer wg.Done()
			md, err := s.marketDataSvc.GetPrice(ctx, item.Symbol, item.Currency, v1.InvestmentType(item.AssetType), 15*time.Minute)
			if err != nil {
				log.Printf("Warning: failed to fetch market price for %s: %v", item.Symbol, err)
				return
			}
			mu.Lock()
			defer mu.Unlock()
			priceMap[item.Symbol] = &priceInfo{
				currentPrice:       md.Price,
				buyPrice:           md.Price,
				sellPrice:          md.Price,
				priceChangePercent: md.Change24h,
			}
		}()
	}

	wg.Wait()

	// Build proto items enriched with prices
	protoItems := make([]*v1.WatchlistItem, 0, len(items))
	for _, item := range items {
		pi := modelToWatchlistProto(item)
		if info, ok := priceMap[item.Symbol]; ok {
			pi.CurrentPrice = info.currentPrice
			pi.BuyPrice = info.buyPrice
			pi.SellPrice = info.sellPrice
			pi.PriceChange = info.priceChange
			pi.PriceChangePercent = info.priceChangePercent
		}
		protoItems = append(protoItems, pi)
	}

	return &v1.ListWatchlistResponse{
		Success:   true,
		Message:   "Watchlist retrieved successfully",
		Items:     protoItems,
		Total:     int32(len(protoItems)),
		Timestamp: fmt.Sprintf("%d", time.Now().Unix()),
	}, nil
}

// UpdateItem updates the note of a watchlist item.
func (s *watchlistService) UpdateItem(ctx context.Context, itemID int32, userID int32, req *v1.UpdateWatchlistItemRequest) (*v1.UpdateWatchlistItemResponse, error) {
	// Ownership check
	item, err := s.watchlistRepo.GetByIDForUser(ctx, itemID, userID)
	if err != nil {
		return nil, err
	}

	// Validate and trim note
	note := strings.TrimSpace(req.Note)
	if len(note) > 200 {
		return nil, apperrors.NewValidationError("note must be at most 200 characters")
	}

	item.Note = note

	if err := s.watchlistRepo.Update(ctx, item); err != nil {
		return nil, err
	}

	return &v1.UpdateWatchlistItemResponse{
		Success:   true,
		Message:   "Watchlist item updated",
		Item:      modelToWatchlistProto(item),
		Timestamp: fmt.Sprintf("%d", time.Now().Unix()),
	}, nil
}

// DeleteItem soft-deletes a watchlist item.
func (s *watchlistService) DeleteItem(ctx context.Context, itemID int32, userID int32) (*v1.DeleteWatchlistItemResponse, error) {
	// Ownership check
	_, err := s.watchlistRepo.GetByIDForUser(ctx, itemID, userID)
	if err != nil {
		return nil, err
	}

	if err := s.watchlistRepo.Delete(ctx, itemID); err != nil {
		return nil, err
	}

	return &v1.DeleteWatchlistItemResponse{
		Success:   true,
		Message:   "Watchlist item deleted",
		Timestamp: fmt.Sprintf("%d", time.Now().Unix()),
	}, nil
}

// ReorderItems updates the sort order of watchlist items.
func (s *watchlistService) ReorderItems(ctx context.Context, userID int32, req *v1.ReorderWatchlistRequest) (*v1.ReorderWatchlistResponse, error) {
	if len(req.ItemIds) == 0 {
		return nil, apperrors.NewValidationError("itemIds must not be empty")
	}

	if err := s.watchlistRepo.ReorderItems(ctx, userID, req.ItemIds); err != nil {
		return nil, err
	}

	return &v1.ReorderWatchlistResponse{
		Success:   true,
		Message:   "Watchlist reordered",
		Timestamp: fmt.Sprintf("%d", time.Now().Unix()),
	}, nil
}

// CheckItem checks whether a symbol is already in the user's watchlist.
func (s *watchlistService) CheckItem(ctx context.Context, userID int32, symbol string) (*v1.CheckWatchlistItemResponse, error) {
	item, err := s.watchlistRepo.GetBySymbolForUser(ctx, symbol, userID)
	if err != nil {
		// "not found" is the normal case — symbol is not in the watchlist
		var notFoundErr apperrors.NotFoundError
		if errors.As(err, &notFoundErr) {
			return &v1.CheckWatchlistItemResponse{
				Exists: false,
			}, nil
		}
		return nil, err
	}

	return &v1.CheckWatchlistItemResponse{
		Exists: true,
		ItemId: item.ID,
	}, nil
}

// modelToWatchlistProto converts a WatchlistItem model to its proto representation.
func modelToWatchlistProto(item *models.WatchlistItem) *v1.WatchlistItem {
	return &v1.WatchlistItem{
		Id:        item.ID,
		Symbol:    item.Symbol,
		Name:      item.Name,
		AssetType: v1.InvestmentType(item.AssetType),
		Currency:  item.Currency,
		Note:      item.Note,
		SortOrder: item.SortOrder,
		CreatedAt: item.CreatedAt.Unix(),
	}
}
