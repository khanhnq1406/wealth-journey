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
    participant MDS as MarketDataService
    participant ADCS as AssetDisplayConfigService
    participant DB as PostgreSQL
    participant YF as YahooFinance
    participant R as Redis

    SPA->>H: GET /api/v1/watchlist<br/>Headers: Authorization: Bearer {jwt}
    H->>H: GetUserID(ctx)
    H->>WS: ListItems(userID)

    activate WS
    WS->>WR: ListByUserID(userID)
    WR-->>WS: []WatchlistItem (ordered by sort_order)

    Note over WS: Goroutine loop — split by asset type
    loop Each item [parallel goroutine]
        alt gold (GOLD_VND | GOLD_USD) or silver (SILVER_VND | SILVER_USD)
            Note over WS: Direct ResolvePrice() — bypasses ProcessMarketPrice()<br/>conversion to preserve raw per-lượng market price
            WS->>ADCS: ResolvePrice(ctx, symbol, "gold"|"silver")
            ADCS->>DB: SELECT asset_price WHERE fetch_code matches (parameterized)
            DB-->>ADCS: buy, sell int64
            ADCS-->>WS: buy, sell, isStale
            Note over WS: priceMap[symbol] = {buy, sell}<br/>isStale ignored (frontend shows whatever is available)
        else currency (FOREIGN_CURRENCY)
            WS->>ADCS: ResolvePrice(ctx, symbol, "currency")
            ADCS->>DB: SELECT asset_price (parameterized)
            DB-->>ADCS: buy, sell int64
            ADCS-->>WS: buy, sell, isStale
        else market/stock/crypto
            WS->>MDS: GetPrice(ctx, symbol, currency, assetType, 15m)
            MDS->>R: GET market_data:{symbol}
            alt Cache hit
                R-->>MDS: MarketData
            else Cache miss
                MDS->>YF: fetch live price
                MDS->>R: SET market_data:{symbol} (15m TTL)
            end
            MDS-->>WS: MarketData {Price, Change24h}
        end
        alt ResolvePrice or GetPrice error
            WS->>WS: log warning, skip (zero prices)
        end
    end

    WS->>WS: Build proto items:<br/>for each item → merge priceMap data
    deactivate WS

    H-->>SPA: 200 OK<br/>{success: true, items: [...], total: N, timestamp}
    Note over SPA: WatchlistTab renders:<br/>- Desktop: DraggableWatchlistTable<br/>- Mobile: MobileTable
    Note over SPA: formatWatchlistPrice():<br/>Gold/Silver/Currency → buyPrice ÷ 1000 (VND)<br/>Other → currentPrice ÷ 100 (USD)
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

---

## 5. Quick-Add via Star Icon (Gold/Silver/Currency Table)

**Trigger:** User clicks empty star on a price table row (Gold, Silver, or Currency tab)
**Endpoint:** `POST /api/v1/watchlist`
**Source:** `src/wj-client/app/[locale]/dashboard/prices/page.tsx` — `StarToggleButton`

```mermaid
sequenceDiagram
    participant User
    participant PricesPage as PricesPage (StarToggleButton)
    participant ReactQuery as React Query Cache
    participant API as REST API

    User->>PricesPage: click empty star (row: typeCode, currency)
    Note over PricesPage: assetType hardcoded per tab<br/>gold=GOLD_VND, silver=SILVER_VND, currency=OTHER<br/>note always ""
    PricesPage->>PricesPage: addMutation.mutate({symbol, name, assetType, currency, note:""})
    PricesPage->>API: POST /api/v1/watchlist<br/>Authorization: Bearer {jwt}
    Note over API: JWT auth check<br/>symbol 1-50 chars<br/>50-item limit check<br/>duplicate check
    alt success (201)
        API-->>PricesPage: {success: true, item: {...}}
        PricesPage->>ReactQuery: invalidate EVENT_WatchlistListWatchlist
        ReactQuery->>API: GET /api/v1/watchlist (refetch)
        API-->>ReactQuery: updated list
        ReactQuery-->>PricesPage: watchedSymbolToId updated
        PricesPage-->>User: star fills (amber)
    else duplicate (409)
        API-->>PricesPage: error "already in watchlist"
        PricesPage-->>User: warning toast
    else limit reached (400)
        API-->>PricesPage: error "maximum 50 items"
        PricesPage-->>User: warning toast
    else network error
        API-->>PricesPage: error
        PricesPage-->>User: error toast
    end
```

**Key Invariants:**
- `symbol` and `name` values originate from server-returned `PriceItem` — never user-typed text
- `assetType` is hardcoded per tab (not user-controlled)
- `note` is always empty string — no user input in quick-add flow
- Star button disabled while `isPending` — prevents double-submission

**Error Paths:**

| Condition | Response | User Feedback |
|-----------|----------|---------------|
| 409 Duplicate | `alreadyInWatchlist` error | Warning toast |
| 400 Limit reached | `limitReached` error | Warning toast |
| Network error | Generic error | Error toast |

---

## 6. Quick-Remove via Star Icon (Gold/Silver/Currency Table)

**Trigger:** User clicks filled star on a price table row
**Endpoint:** `DELETE /api/v1/watchlist/:id`
**Source:** `src/wj-client/app/[locale]/dashboard/prices/page.tsx` — `StarToggleButton`

```mermaid
sequenceDiagram
    participant User
    participant PricesPage as PricesPage (StarToggleButton)
    participant ReactQuery as React Query Cache
    participant API as REST API

    User->>PricesPage: click filled star
    Note over PricesPage: watchlistItemId from watchedSymbolToId Map<br/>(server-returned ID, not user input)
    PricesPage->>PricesPage: removeMutation.mutate({id: watchlistItemId})
    PricesPage->>API: DELETE /api/v1/watchlist/{id}<br/>Authorization: Bearer {jwt}
    Note over API: JWT auth check<br/>GetByIDForUser ownership check
    alt success (200)
        API-->>PricesPage: {success: true}
        PricesPage->>ReactQuery: invalidate EVENT_WatchlistListWatchlist
        ReactQuery->>API: GET /api/v1/watchlist (refetch)
        API-->>ReactQuery: updated list (item removed)
        ReactQuery-->>PricesPage: watchedSymbolToId updated (symbol removed)
        PricesPage-->>User: star empties (outline)
    else not found / unauthorized (404)
        API-->>PricesPage: error
        PricesPage-->>User: error toast
    else network error
        API-->>PricesPage: error
        PricesPage-->>User: error toast
    end
```

**Key Invariants:**
- `id` is sourced from server-returned watchlist data — never user-supplied
- Server performs `GetByIDForUser` ownership check before deletion
- Star button disabled while `isPending` — prevents double-submission

**Error Paths:**

| Condition | Response | User Feedback |
|-----------|----------|---------------|
| 404 Not found | Error | Error toast |
| Network error | Generic error | Error toast |
