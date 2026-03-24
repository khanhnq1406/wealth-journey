# Watchlist Domain — Runtime Flows

Symbol watchlist CRUD flows: add a symbol, list with live price enrichment, drag-and-drop reorder, and check/remove. All endpoints require JWT authentication and scope data to `user_id` extracted from the token.

## Table of Contents

- [Add Symbol to Watchlist](#1-add-symbol-to-watchlist)
- [List Watchlist with Price Enrichment](#2-list-watchlist-with-price-enrichment)
- [Reorder Watchlist (Drag-and-Drop)](#3-reorder-watchlist-drag-and-drop)
- [Check and Remove Symbol](#4-check-and-remove-symbol)

---

## 1. Add Symbol to Watchlist

**Trigger:** User submits AddToWatchlistForm (3-step: category → symbol → note)
**Endpoint:** `POST /api/v1/watchlist`
**Source:** `domain/service/watchlist_service.go`, `handlers/watchlist.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as WatchlistHandler
    participant WS as WatchlistService
    participant WR as WatchlistRepository

    SPA->>H: POST /api/v1/watchlist<br/>{symbol, name, assetType, currency, note}<br/>Headers: Authorization: Bearer {jwt}
    H->>H: GetUserID(ctx) [from JWT]
    alt No/invalid JWT
        H-->>SPA: 401 Unauthorized
    end
    H->>H: BindAndValidate(req)
    alt symbol or name empty
        H-->>SPA: 400 Bad Request
    end
    H->>WS: CreateItem(userID, req)

    activate WS
    WS->>WS: Validate symbol (1-50 chars, trimmed)
    WS->>WS: Validate name (1-200 chars, trimmed)
    WS->>WS: Validate note (0-200 chars, trimmed)
    WS->>WS: Validate currency (2-3 char ISO code)

    WS->>WR: CountByUserID(userID)
    WR-->>WS: count
    alt count >= 50
        WS-->>H: 400 Validation Error "maximum watchlist limit of 50 items reached"
        H-->>SPA: {success: false, message: "..."}
    end

    WS->>WR: GetBySymbolForUser(symbol, userID)
    alt Symbol already in watchlist
        WR-->>WS: Existing item
        WS-->>H: 409 Conflict "symbol already in watchlist"
        H-->>SPA: {success: false, message: "..."}
    end

    WS->>WR: GetMaxSortOrder(userID)
    WR-->>WS: maxOrder
    WS->>WS: sortOrder = maxOrder + 1

    WS->>WR: Create(WatchlistItem{userID, symbol, name,<br/>assetType, currency, note, sortOrder})
    WR-->>WS: Item created
    deactivate WS

    H-->>SPA: 201 Created<br/>{success: true, item: {...}, timestamp}
    Note over SPA: useMutationCreateWatchlistItem<br/>→ invalidates ListWatchlist cache
```

---

## 2. List Watchlist with Price Enrichment

**Trigger:** User opens Watchlist tab on Prices page
**Endpoint:** `GET /api/v1/watchlist`
**Source:** `domain/service/watchlist_service.go`, `handlers/watchlist.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as WatchlistHandler
    participant WS as WatchlistService
    participant WR as WatchlistRepository
    participant GPS as GoldPriceService
    participant SPS as SilverPriceService
    participant MDS as MarketDataService
    participant R as Redis

    SPA->>H: GET /api/v1/watchlist<br/>Headers: Authorization: Bearer {jwt}
    H->>H: GetUserID(ctx)
    H->>WS: ListItems(userID)

    activate WS
    WS->>WR: ListByUserID(userID)
    WR-->>WS: []WatchlistItem (ordered by sort_order)

    Note over WS: Group items by price source
    WS->>WS: goldItems ← items where IsGoldType(assetType)
    WS->>WS: silverItems ← items where IsSilverType(assetType)
    WS->>WS: marketItems ← all other items

    par Parallel price fetch (sync.WaitGroup)
        alt len(goldItems) > 0
            WS->>GPS: FetchAllPrices(ctx)
            GPS->>R: GET gold_prices
            alt Cache hit
                R-->>GPS: []CachedGoldPrice
            else Cache miss
                GPS->>GPS: Fetch from vang.today API
                GPS->>R: SET gold_prices (15m TTL)
            end
            GPS-->>WS: []CachedGoldPrice {TypeCode, Buy, Sell}
            WS->>WS: Match item.Symbol → gp.TypeCode<br/>→ priceMap[symbol] = {buyPrice, sellPrice}
        end
        alt len(silverItems) > 0
            WS->>SPS: FetchAllPrices(ctx)
            SPS->>R: GET silver_prices
            SPS-->>WS: []CachedSilverPrice {TypeCode, Buy, Sell}
            WS->>WS: Match item.Symbol → sp.TypeCode<br/>→ priceMap[symbol] = {buyPrice, sellPrice}
        end
        loop Each marketItem
            WS->>MDS: GetPrice(ctx, symbol, currency, assetType, 15m TTL)
            MDS->>R: GET market_data:{symbol}
            alt Cache hit
                R-->>MDS: MarketData
            else Cache miss
                MDS->>MDS: Yahoo Finance API
                MDS->>R: SET market_data:{symbol} (15m TTL)
            end
            MDS-->>WS: MarketData {Price, Change24h}
            WS->>WS: priceMap[symbol] = {currentPrice, priceChangePercent}
        end
    end

    WS->>WS: Build proto items:<br/>for each item → merge priceMap data
    deactivate WS

    H-->>SPA: 200 OK<br/>{success: true, items: [...], total: N, timestamp}
    Note over SPA: WatchlistTab renders:<br/>- Desktop: DraggableWatchlistTable<br/>- Mobile: MobileTable
    Note over SPA: formatWatchlistPrice():<br/>Gold/Silver → buyPrice ÷ 1000 (VND)<br/>Other → currentPrice ÷ 100 (USD)
```

---

## 3. Reorder Watchlist (Drag-and-Drop)

**Trigger:** User drags a watchlist row to a new position
**Endpoint:** `PUT /api/v1/watchlist/reorder`
**Source:** `domain/service/watchlist_service.go`, `handlers/watchlist.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant WTab as WatchlistTab
    participant DWT as DraggableWatchlistTable
    participant H as WatchlistHandler
    participant WS as WatchlistService
    participant WR as WatchlistRepository

    SPA->>DWT: User drags row to new position
    DWT->>DWT: framer-motion Reorder.Group<br/>onReorder(newOrder) callback
    DWT->>WTab: onReorder(newOrderedItems)

    Note over WTab: Optimistic update
    WTab->>WTab: setOrderedItems(newOrderedItems)
    WTab->>WTab: useMutationReorderWatchlist.mutate({itemIds})

    WTab->>H: PUT /api/v1/watchlist/reorder<br/>{itemIds: [id1, id2, id3, ...]}<br/>Headers: Authorization: Bearer {jwt}
    H->>H: GetUserID(ctx)
    H->>H: BindAndValidate(req)
    alt itemIds empty
        H-->>WTab: 400 Bad Request
    end
    H->>WS: ReorderItems(userID, req)

    activate WS
    WS->>WS: Validate itemIds not empty
    WS->>WR: ReorderItems(userID, itemIds)

    Note over WR: DB transaction:<br/>for i, id := range itemIds<br/>UPDATE watchlist<br/>SET sort_order = i<br/>WHERE id = ? AND user_id = ?<br/>Check RowsAffected == 0 → ownership violation
    WR-->>WS: nil (success)
    deactivate WS

    H-->>WTab: 200 OK {success: true, timestamp}
    Note over WTab: Mutation succeeded → keep optimistic order

    alt Mutation fails (network/ownership error)
        WTab->>WTab: onError: setOrderedItems(serverItems)<br/>(revert to server order)
    end
```

---

## 4. Check and Remove Symbol

**Trigger:** User views symbol lookup result OR taps delete on a watchlist item
**Endpoints:**
- `GET /api/v1/watchlist/check?symbol=AAPL` — Check presence
- `DELETE /api/v1/watchlist/:id` — Remove item
**Source:** `domain/service/watchlist_service.go`, `handlers/watchlist.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as WatchlistHandler
    participant WS as WatchlistService
    participant WR as WatchlistRepository

    Note over SPA,WR: Check flow (used by AddToWatchlistForm)
    SPA->>H: GET /api/v1/watchlist/check?symbol=AAPL<br/>Headers: Authorization: Bearer {jwt}
    H->>H: GetUserID(ctx)
    H->>H: symbol = TrimSpace(Query("symbol"))
    alt symbol empty
        H-->>SPA: 400 Bad Request
    end
    H->>WS: CheckItem(userID, symbol)

    activate WS
    WS->>WR: GetBySymbolForUser(symbol, userID)
    alt Symbol found
        WR-->>WS: WatchlistItem
        WS-->>H: {exists: true, itemId: N}
    else Not found (NotFoundError)
        WR-->>WS: NotFoundError
        WS-->>H: {exists: false}
    else Other DB error
        WR-->>WS: Error
        WS-->>H: 500 Internal Error
    end
    deactivate WS

    H-->>SPA: 200 OK {exists: bool, itemId?: N}

    Note over SPA,WR: Delete flow
    SPA->>H: DELETE /api/v1/watchlist/:id<br/>Headers: Authorization: Bearer {jwt}
    H->>H: GetUserID(ctx)
    H->>H: parseIDParam("id")
    H->>WS: DeleteItem(itemID, userID)

    activate WS
    WS->>WR: GetByIDForUser(itemID, userID)
    alt Item not found or wrong owner
        WR-->>WS: NotFoundError
        WS-->>H: 404 Not Found
        H-->>SPA: {success: false, message: "..."}
    end
    WS->>WR: Delete(itemID)
    Note over WR: Soft delete: UPDATE SET deleted_at = NOW()
    WR-->>WS: nil
    deactivate WS

    H-->>SPA: 200 OK {success: true, timestamp}
    Note over SPA: useMutationDeleteWatchlistItem<br/>→ invalidates ListWatchlist cache
```
