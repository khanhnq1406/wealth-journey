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
	assetPriceSvc  AssetPriceService
	marketDataSvc  MarketDataService
	assetDisplaySvc AssetDisplayConfigService
}

// NewWatchlistService creates a new WatchlistService.
func NewWatchlistService(
	watchlistRepo repository.WatchlistRepository,
	assetPriceSvc AssetPriceService,
	marketDataSvc MarketDataService,
	assetDisplaySvc AssetDisplayConfigService,
) WatchlistService {
	return &watchlistService{
		watchlistRepo:  watchlistRepo,
		assetPriceSvc:  assetPriceSvc,
		marketDataSvc:  marketDataSvc,
		assetDisplaySvc: assetDisplaySvc,
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

	// Fetch all item prices in parallel. One goroutine per item (50-item cap).
	// - Gold / silver: call AssetDisplayConfigService.ResolvePrice() directly — returns raw
	//   per-lượng (or per-unit) buy/sell prices stored in asset_price table. Bypasses
	//   GetPrice() which applies ProcessMarketPrice() unit conversion causing wrong values.
	// - Currency: also routed through ResolvePrice() for the same reason.
	// - Everything else (market/stock/crypto): use MarketDataService.GetPrice() (Yahoo Finance).
	for _, item := range items {
		wg.Add(1)
		go func(it *models.WatchlistItem) {
			defer wg.Done()
			invType := v1.InvestmentType(it.AssetType)

			switch {
			case gold.IsGoldType(invType):
				buy, sell, _, err := s.assetDisplaySvc.ResolvePrice(ctx, it.Symbol, "gold")
				if err != nil {
					log.Printf("Warning: failed to resolve gold price for watchlist item %s: %v", it.Symbol, err)
					return
				}
				mu.Lock()
				defer mu.Unlock()
				priceMap[it.Symbol] = &priceInfo{
					currentPrice: buy,
					buyPrice:     buy,
					sellPrice:    sell,
				}

			case silver.IsSilverType(invType):
				buy, sell, _, err := s.assetDisplaySvc.ResolvePrice(ctx, it.Symbol, "silver")
				if err != nil {
					log.Printf("Warning: failed to resolve silver price for watchlist item %s: %v", it.Symbol, err)
					return
				}
				mu.Lock()
				defer mu.Unlock()
				priceMap[it.Symbol] = &priceInfo{
					currentPrice: buy,
					buyPrice:     buy,
					sellPrice:    sell,
				}

			case invType == v1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY:
				buy, sell, _, err := s.assetDisplaySvc.ResolvePrice(ctx, it.Symbol, "currency")
				if err != nil {
					log.Printf("Warning: failed to resolve currency price for watchlist item %s: %v", it.Symbol, err)
					return
				}
				mu.Lock()
				defer mu.Unlock()
				priceMap[it.Symbol] = &priceInfo{
					currentPrice: buy,
					buyPrice:     buy,
					sellPrice:    sell,
				}

			default:
				md, err := s.marketDataSvc.GetPrice(ctx, it.Symbol, it.Currency, invType, 15*time.Minute)
				if err != nil {
					log.Printf("Warning: failed to fetch price for watchlist item %s (type %d): %v", it.Symbol, it.AssetType, err)
					return
				}
				mu.Lock()
				defer mu.Unlock()
				priceMap[it.Symbol] = &priceInfo{
					currentPrice:       md.Price,
					buyPrice:           md.Price,
					sellPrice:          md.Price,
					priceChangePercent: md.Change24h,
				}
			}
		}(item)
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
