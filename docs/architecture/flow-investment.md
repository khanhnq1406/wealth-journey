# Investment Domain — Runtime Flows

Investment portfolio management flows covering the most complex business logic in the system. Includes FIFO cost basis accounting, multi-source market price updates, and portfolio aggregation with FX conversion.

## Table of Contents

- [Create Investment (incl. Gold/Silver)](#1-create-investment-incl-goldsilver)
- [Buy Transaction with Lot Merging](#2-buy-transaction-with-lot-merging)
- [FIFO Sell Transaction](#3-fifo-sell-transaction)
- [Dividend Processing](#4-dividend-processing)
- [Market Price Update Pipeline](#5-market-price-update-pipeline)
- [Portfolio Summary Calculation](#6-portfolio-summary-calculation)
- [Period PnL Calculation](#7-period-pnl-calculation)
- [Gold/Silver Chart Data Flow](#8-goldsilver-chart-data-flow)
- [Edit Transaction (Delete-and-Recreate)](#9-edit-transaction-delete-and-recreate)
- [Gold/Silver Price Resolution via Fetch Codes](#10-goldsilver-price-resolution-via-fetch-codes)
- [Gold/Silver VND Investment Type Selection (Admin Config–Driven)](#11-goldsilver-vnd-investment-type-selection-admin-configdriven)
- [Currency Investment Price Refresh](#12-currency-investment-price-refresh)
- [Get Market Prices (Prices Page)](#13-get-market-prices-prices-page)

---

## 1. Create Investment (incl. Gold/Silver)

**Trigger:** User adds a new investment holding (owned directly by user_id; wallet is optional)
**Endpoint:** `POST /api/v1/investments`
**Source:** `domain/service/investment_service.go`, `handlers/investment.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as InvestmentHandler
    participant IS as InvestmentService
    participant WR as WalletRepository
    participant IR as InvestmentRepository
    participant ITR as InvestmentTxRepository
    participant LR as LotRepository
    participant Units as units Package

    SPA->>H: POST /api/v1/investments<br/>{walletId: 0, symbol, name, type, currency,<br/>initialQuantity, initialCost, isCustom, purchaseDate}
    H->>IS: CreateInvestment(userID, req)

    activate IS

    alt walletId > 0 (wallet association requested)
        IS->>WR: GetByIDForUser(walletId, userID)
        WR-->>IS: Verified wallet
        IS->>IS: walletIDPtr = &walletId
    else walletId == 0 (no wallet association)
        IS->>IS: walletIDPtr = nil
    end

    alt purchaseDate > 0
        IS->>IS: Validate purchaseDate ≤ now<br/>(reject future dates)
    end

    IS->>IR: GetByUserAndSymbol(userID, symbol)
    alt Symbol already exists (duplicate detection)
        IR-->>IS: Existing investment
        alt req.Currency != existing.Currency
            IS-->>H: 400 Validation Error<br/>"Investment {symbol} already exists<br/>with currency {existingCurrency}"
        else Currency matches
            IS->>IS: Auto-create BUY transaction<br/>on existing investment
            IS-->>H: 200 OK (transaction added)
        end
    end

    Note over IS,Units: Unit conversion for gold/silver
    IS->>Units: QuantityToStorage(quantity, type)
    Note over IS,Units: Gold VND: grams × 10000<br/>Gold USD: ounces × 10000<br/>Stocks: shares × 100
    IS->>Units: ToSmallestCurrencyUnit(cost, currency)
    Note over IS,Units: VND: ×1, USD: ×100

    IS->>Units: CalculateAverageCost(totalCost, quantity, type)

    Note over IS: Determine txDate
    alt purchaseDate > 0
        IS->>IS: txDate = time.Unix(purchaseDate, 0)
    else purchaseDate == 0
        IS->>IS: txDate = time.Now()
    end

    IS->>IR: Create(Investment{userID, walletIDPtr,<br/>symbol, name, type, currency,<br/>quantity, averageCost, totalCost, isCustom})
    IR-->>IS: Investment created

    IS->>ITR: Create(InvestmentTx{type: BUY, quantity, price, cost,<br/>transactionDate: txDate})
    alt Transaction creation fails
        ITR-->>IS: Error
        IS->>IR: Delete(investmentID)
        Note over IS,IR: ROLLBACK: delete investment
        IS-->>H: Error
    end

    IS->>LR: Create(Lot{quantity, remainingQty: quantity,<br/>averageCost, totalCost, purchasedAt: txDate})
    alt Lot creation fails
        LR-->>IS: Error
        IS->>ITR: Delete(txID)
        IS->>IR: Delete(investmentID)
        Note over IS,LR: ROLLBACK: delete tx + investment
        IS-->>H: Error
    end

    IS->>IS: enrichInvestmentProto()
    deactivate IS

    IS-->>H: CreateInvestmentResponse
    H-->>SPA: 201 Created
```

### Storage Formats by Type

| Investment Type | Quantity Unit | Storage Multiplier | Example |
|----------------|-------------|-------------------|---------|
| Stocks, ETFs, Crypto | Shares | ×100 | 10 shares = 1000 |
| Gold (VND) | Grams | ×10,000 | 75g (20 chỉ) = 750,000 |
| Gold (USD) | Ounces | ×10,000 | 1 oz = 10,000 |
| Silver (VND) | Grams | ×10,000 | Same as gold |
| Silver (USD) | Ounces | ×10,000 | Same as gold |

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Wallet not found or not owned (when walletId > 0) | 404 | None |
| Duplicate symbol + currency mismatch | 400 Validation: "Investment {symbol} already exists with currency {currency}" | None |
| Duplicate symbol + currency match | 200 OK: auto-creates BUY transaction on existing investment | None |
| Transaction creation fails | 500 | Delete investment |
| Lot creation fails | 500 | Delete tx + investment |

---

## 2. Buy Transaction with Lot Merging

**Trigger:** User buys more of an existing investment holding
**Endpoint:** `POST /api/v1/investments/:id/transactions`
**Source:** `domain/service/investment_service.go` — `processBuyTransaction()`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant IS as InvestmentService
    participant LR as LotRepository
    participant ITR as InvestmentTxRepository
    participant IR as InvestmentRepository
    participant Units as units Package

    SPA->>IS: AddTransaction(investmentId,<br/>{type: BUY, quantity, price, fees, date})

    activate IS
    IS->>IS: Validate quantity > 0, price > 0
    IS->>Units: CalculateTransactionCost(quantity, price, type)
    IS->>IS: totalCost = cost + fees

    IS->>LR: GetOpenLots(investmentId, order: purchasedAt ASC)
    LR-->>IS: Open lots

    IS->>IS: Check most recent lot's purchasedAt

    alt Last lot within 24 hours (merge)
        Note over IS,LR: Merge into existing lot
        IS->>IS: lot.Quantity += req.Quantity
        IS->>IS: lot.TotalCost += totalCost
        IS->>Units: CalculateAverageCost(lot.TotalCost, lot.Quantity, type)
        IS->>IS: lot.RemainingQuantity = lot.Quantity
        IS->>LR: Update(lot)
    else No recent lot or > 24 hours (new lot)
        Note over IS,LR: Create new lot
        IS->>Units: CalculateAverageCost(totalCost, quantity, type)
        IS->>LR: Create(Lot{quantity, remainingQty, avgCost, purchasedAt})
    end
    LR-->>IS: Lot saved

    IS->>ITR: Create(InvestmentTx{BUY, quantity, price, cost, fees, lotID})
    ITR-->>IS: Transaction created

    IS->>IS: investment.Quantity += quantity
    IS->>IS: investment.TotalCost += totalCost
    IS->>Units: CalculateAverageCost(investment.TotalCost, investment.Quantity, type)
    IS->>IR: Update(investment)
    deactivate IS

    IS-->>SPA: Transaction + updated investment
```

### Lot Merge Decision (24-Hour Window)

```
Most recent lot purchased at: 2025-03-05 10:00
Current purchase at:          2025-03-05 14:00  → MERGE (4h < 24h)
Current purchase at:          2025-03-06 12:00  → NEW LOT (26h > 24h)
```

### Key Invariants

- Lot merging prevents excessive lot fragmentation for same-day purchases
- Average cost is recalculated at both the lot and investment level after each buy
- Fees are included in total cost but tracked separately on the transaction
- No wallet balance deduction — investments are decoupled from wallet balances

---

## 3. FIFO Sell Transaction

**Trigger:** User sells shares/units of an investment
**Endpoint:** `POST /api/v1/investments/:id/transactions`
**Source:** `domain/service/investment_service.go` — `processSellTransaction()`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant IS as InvestmentService
    participant LR as LotRepository
    participant Units as units Package
    participant ITR as InvestmentTxRepository
    participant IR as InvestmentRepository

    SPA->>IS: AddTransaction(investmentId,<br/>{type: SELL, quantity, price, fees})

    activate IS
    IS->>IS: Verify investment.Quantity >= req.Quantity

    IS->>LR: GetOpenLots(investmentId, order: purchasedAt ASC)
    LR-->>IS: Lots in FIFO order

    IS->>IS: Verify total remainingQuantity >= req.Quantity

    Note over IS: FIFO Consumption Loop
    IS->>IS: quantityToSell = req.Quantity<br/>realizedPNL = 0

    loop For each lot (oldest first) while quantityToSell > 0
        IS->>IS: consumeFromLot = min(quantityToSell, lot.RemainingQuantity)

        IS->>Units: GetPrecision(type)
        Note over IS,Units: precision: stocks=100, gold=10000

        IS->>IS: consumeWholeUnits = consumeFromLot / precision
        IS->>IS: lotCostBasis = lot.AverageCost × consumeWholeUnits
        IS->>IS: lotSellValue = sellPrice × consumeWholeUnits

        IS->>Units: CalculateRealizedPNL(costBasis, sellValue)
        IS->>IS: realizedPNL += lotPNL

        IS->>IS: lot.RemainingQuantity -= consumeFromLot
        IS->>LR: Update(lot)

        IS->>IS: quantityToSell -= consumeFromLot
    end

    IS->>IS: realizedPNL -= req.Fees

    IS->>Units: CalculateTransactionCost(quantity, price, type)
    IS->>ITR: Create(InvestmentTx{SELL, quantity, price, proceeds, fees, lotID})

    IS->>IS: investment.Quantity -= req.Quantity
    IS->>IS: investment.RealizedPNL += realizedPNL
    Note over IS: TotalCost and AverageCost unchanged<br/>(preserves cost basis history)
    IS->>IR: Update(investment)
    deactivate IS

    IS-->>SPA: Transaction + updated investment
```

### FIFO Consumption Example

```
Lot 1: 100 shares @ $85 (purchased Jan 1) — remainingQty: 100
Lot 2: 50 shares  @ $90 (purchased Feb 1) — remainingQty: 50

Sell 120 shares @ $95:
  → Lot 1: consume 100, costBasis = 100 × $85 = $8,500, sellValue = 100 × $95 = $9,500, PNL = +$1,000
  → Lot 2: consume 20,  costBasis = 20 × $90  = $1,800, sellValue = 20 × $95  = $1,900, PNL = +$100
  → Total realizedPNL = $1,100 (before fees)
  → Lot 1 remainingQty: 0 (fully consumed)
  → Lot 2 remainingQty: 30
```

### Key Invariants

- Lots are consumed strictly in FIFO order (oldest `purchasedAt` first)
- Per-lot PNL is calculated individually, not using a blended average
- `TotalCost` and `AverageCost` on the investment are **not** modified during sells — they represent the historical cost basis
- Only `Quantity` and `RealizedPNL` are updated on the investment
- Fees are subtracted from realized PNL, not from the sell proceeds calculation

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Insufficient quantity to sell | 400 Validation | None |
| Total remaining lots < sell quantity | 400 Validation | None |
| Lot update fails mid-loop | 500 | Earlier lots already consumed (inconsistency risk) |
| Transaction creation fails | 500 | Lots consumed but no tx record |

---

## 4. Dividend Processing

**Trigger:** User records a dividend payment
**Endpoint:** `POST /api/v1/investments/:id/transactions`
**Source:** `domain/service/investment_service.go` — `processDividendTransaction()`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant IS as InvestmentService
    participant Units as units Package
    participant ITR as InvestmentTxRepository
    participant IR as InvestmentRepository

    SPA->>IS: AddTransaction(investmentId,<br/>{type: DIVIDEND, quantity: sharesAtDividend,<br/>price: dividendPerShare})

    activate IS
    IS->>Units: CalculateTransactionCost(quantity, price, type)
    Note over IS,Units: totalDividend = shares × dividendPerShare

    IS->>ITR: Create(InvestmentTx{DIVIDEND,<br/>quantity, price, cost: totalDividend, fees: 0})
    ITR-->>IS: Transaction created

    IS->>IS: investment.TotalDividends += totalDividend
    Note over IS: No change to Quantity, TotalCost, or AverageCost
    IS->>IR: Update(investment)
    deactivate IS

    IS-->>SPA: Transaction + updated investment
```

### Key Invariants

- Dividends do **not** affect position size (Quantity unchanged)
- Dividends do **not** affect cost basis (TotalCost, AverageCost unchanged)
- No lot interaction — dividends are independent of FIFO tracking
- `quantity` field represents shares held at dividend date (for per-share calculation), not shares bought/sold

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Transaction creation fails | 500 | None |
| Investment update fails | 500 | Delete tx |

---

## 5. Market Price Update Pipeline

**Trigger:** Scheduled job (every 15 min) or manual `PUT /api/v1/investments/market-price`
**Source:** `domain/service/investment_service.go`, `domain/service/market_data_service.go`, `domain/service/asset_display_config_service.go`

```mermaid
flowchart TD
    A["InvestmentService.UpdatePrices(userID)\nList all investments by user_id"] --> B["investmentRepo.ListByUserID(userID)"]
    B --> C["Filter out isCustom=true\n(manual price only)"]
    C --> D["Categorize by type"]
    D --> E["Return immediately to client\n'Price update started for N investments'"]
    E --> F["Run in background goroutine\n(5-minute timeout)"]

    F --> G["MarketDataService\n.UpdatePricesForInvestments()"]
    G --> H{Investment type?}

    H -- "Stocks / ETFs / Crypto" --> I["Batch by 10 symbols"]
    I --> J["yahoo.GetQuoteBatch()"]
    J --> K["For each quote:\nToSmallestCurrencyUnit(price, currency)"]
    K --> L["Update MarketData cache\n{symbol, price, change24h}"]

    H -- "Gold (VND/USD)" --> M["fetchGoldPriceFromDB()\n→ AssetDisplayConfigService\n.ResolvePrice(symbol, 'gold')"]
    M --> N{DB price\navailable?}
    N -- "Yes (non-stale)" --> O["goldConverter.ProcessMarketPrice()\nper-lượng → per-gram (VND)\nor pass-through (USD)"]
    N -- "No (cold start\nor no fetch codes)" --> P["Fallback: goldPriceService\n.FetchPriceForSymbol()\n(live API)"]
    P --> O
    O --> L

    H -- "Silver (VND/USD)" --> Q["fetchSilverPriceFromDB()\n→ AssetDisplayConfigService\n.ResolvePrice(symbol, 'silver')"]
    Q --> R{DB price\navailable?}
    R -- "Yes (non-stale)" --> S["silverConverter.ProcessMarketPrice()\nper-tael/kg → per-gram (VND)\nor pass-through (USD)"]
    R -- "No (cold start\nor no fetch codes)" --> T["Fallback: silverPriceService\n.FetchPriceForSymbol()\n(live API)"]
    T --> S
    S --> L

    H -- "FOREIGN_CURRENCY" --> V["fetchCurrencyPriceFromDB()\n→ AssetDisplayConfigService\n.ResolvePrice(symbol, 'currency')"]
    V --> W{DB price\navailable?}
    W -- "Yes" --> X["Return buy price in VND int64\n(no unit conversion needed)"]
    W -- "No / error" --> Y["Log warning, skip investment\n(non-fatal — other types continue)"]
    X --> L

    L --> U["investmentRepo.UpdatePrices()\nBatch SQL update:\ncurrent_price + price_updated_at"]

    subgraph CacheFallback["MarketData Cache Layer (stocks/ETFs/crypto only)"]
        direction TB
        CF1["Check marketDataRepo\n(symbol + currency)"] --> CF2{Fresh < 15 min?}
        CF2 -- Yes --> CF3["Return cached price\n(skip API call)"]
        CF2 -- No --> CF4["Fetch from Yahoo Finance API"]
        CF4 --> CF5{API success?}
        CF5 -- Yes --> CF6["Update marketDataRepo + return"]
        CF5 -- No --> CF7{Stale cache\nexists?}
        CF7 -- Yes --> CF8["Log warning\nReturn stale price"]
        CF7 -- No --> CF9["Return error"]:::error
    end

    classDef error fill:#fee,stroke:#c00,color:#900
```

### Key Invariants

- Custom investments (`isCustom: true`) are excluded from automatic price updates — they use manual price via `UpdateInvestmentPriceForm`
- Price update runs asynchronously to avoid HTTP timeouts; client is notified immediately
- **Gold, silver, and FOREIGN_CURRENCY prices are read from the `asset_price` DB table** (written by `PriceCacheJob` every 15 min), not from live APIs
- Cold-start fallback: if `ResolvePrice` fails (DB empty, no fetch codes configured), `GoldPriceService`/`SilverPriceService` live APIs are called — no equivalent fallback for FOREIGN_CURRENCY (error is non-fatal and logged)
- `investmentRepo.UpdatePrices()` also writes `price_updated_at` timestamp for every successfully resolved price (including FOREIGN_CURRENCY), enabling staleness indicators on the frontend
- Gold VND prices require lượng-to-gram normalization before storage (applied in both DB and live-fallback paths)
- Silver USD normalization depends on the symbol: per-tael (`AG_VND_Tael`), per-kg (`AG_VND_Kg`), or pass-through (`XAG`)
- FOREIGN_CURRENCY investments are grouped by symbol — price lookup is O(unique currencies), not O(investments)

### Price Sources by Type

| Investment Type | Primary Source | Fallback | Notes |
|----------------|---------------|----------|-------|
| Stocks / ETFs / Crypto | Yahoo Finance (batch, 10/req) | Stale MarketData cache | Live API per request |
| Gold (VND/USD) | `asset_price` DB via `ResolvePrice()` | Live `GoldPriceService` (cold start only) | DB written by `PriceCacheJob` |
| Silver (VND/USD) | `asset_price` DB via `ResolvePrice()` | Live `SilverPriceService` (cold start only) | DB written by `PriceCacheJob` |
| FOREIGN_CURRENCY | `asset_price` DB via `ResolvePrice(symbol, "currency")` | None — error logged and skipped | DB written by `CurrencyPriceService` via `PriceCacheJob` |
| Custom | Manual only (`UpdateInvestmentPriceForm`) | N/A | Excluded from job |

---

## 6. Portfolio Summary Calculation

**Trigger:** User navigates to the Portfolio page
**Endpoint:** `GET /api/v1/wallets/:walletId/portfolio-summary`
**Source:** `domain/service/investment_service.go` — `GetPortfolioSummary()`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant IS as InvestmentService
    participant IR as InvestmentRepository
    participant FX as FXRateService
    participant MDS as MarketDataService

    SPA->>IS: GetPortfolioSummary(walletId)

    activate IS
    IS->>IR: ListByWalletID(walletId)
    IR-->>IS: All investments

    IS->>IS: Check stale data<br/>(any investment.UpdatedAt > 15 min ago?)

    opt Stale data detected
        IS->>MDS: UpdatePrices(userID) [async, don't wait]
        Note over IS,MDS: Trigger background refresh<br/>Continue with available data
    end

    IS->>IS: Get user's PreferredCurrency

    Note over IS: Aggregate with FX conversion

    loop For each investment
        alt investmentCurrency == preferredCurrency
            IS->>IS: Use values as-is<br/>currentValue, totalCost, unrealizedPNL, realizedPNL
        else Different currency
            IS->>FX: ConvertAmount(currentValue, invCurrency, preferred)
            IS->>FX: ConvertAmount(totalCost, invCurrency, preferred)
            IS->>FX: ConvertAmount(realizedPNL, invCurrency, preferred)
            IS->>FX: ConvertAmount(unrealizedPNL, invCurrency, preferred)
            FX-->>IS: Converted values
        end

        IS->>IS: Accumulate totals<br/>Group by InvestmentType
    end

    IS->>IS: Calculate total PNL<br/>totalPNL = unrealized + realized<br/>totalPNLPercent = totalPNL / totalCost × 100

    IS->>IS: calculatePerformers()<br/>Top 5 + Worst 5 by unrealizedPNL %

    deactivate IS

    IS-->>SPA: PortfolioSummary{<br/>totalValue, totalCost, totalPNL,<br/>realizedPNL, unrealizedPNL,<br/>investmentsByType, topPerformers, worstPerformers}
```

### Key Invariants

- `CurrentValue` and `UnrealizedPNL` are recalculated by GORM hooks on every read (`AfterFind`)
- Stale detection triggers a background price refresh but does **not** block the response
- All monetary aggregation happens in the user's preferred currency via FX conversion
- Performers are ranked by percentage (PNL / cost × 100), not absolute value
- Division-by-zero protection: investments with zero TotalCost are excluded from PNL % calculation

### Portfolio Summary Fields

| Field | Calculation | Currency |
|-------|------------|----------|
| `totalValue` | Sum of `currentPrice × quantity` per investment | Preferred |
| `totalCost` | Sum of all purchase costs | Preferred |
| `unrealizedPNL` | `totalValue - totalCost` | Preferred |
| `realizedPNL` | Sum of profits from sell transactions | Preferred |
| `totalPNL` | `unrealizedPNL + realizedPNL` | Preferred |
| `totalPNLPercent` | `totalPNL / totalCost × 100` | Percentage |
| `investmentsByType` | Grouped value + count per type | Preferred |
| `topPerformers` | Best 5 by unrealized PNL % | Preferred |
| `worstPerformers` | Worst 5 by unrealized PNL % | Preferred |

---

## 7. Period PnL Calculation

**Trigger:** User selects a period tab (1D/1W/1M/ALL) on PNLCard or PortfolioSummaryEnhanced
**Endpoint:** `GET /api/v1/portfolio-summary/aggregated?period=2` (aggregated) or `GET /api/v1/wallets/:walletId/portfolio-summary?period=2` (per wallet)
**Source:** `domain/service/investment_service.go` — `computePeriodPnl()`, `domain/repository/portfolio_history_repository_impl.go` — `GetPeriodStartSnapshot()`

```mermaid
sequenceDiagram
    participant FE as Frontend (PNLCard)
    participant H as InvestmentHandler
    participant S as InvestmentService
    participant PHR as PortfolioHistoryRepo
    participant DB as PostgreSQL

    FE->>H: GET /api/v1/portfolio-summary/aggregated?period=2 (1W)
    H->>S: GetAggregatedPortfolioSummary(ctx, userID, req{period=1W})
    S->>S: computeCurrentTotalPnl() (existing logic)
    S->>PHR: GetPeriodStartSnapshot(ctx, userID, from=now-7d)
    PHR->>DB: SELECT DISTINCT ON (wallet_id) ...<br/>FROM portfolio_history<br/>WHERE user_id=? AND timestamp <= ? AND deleted_at IS NULL<br/>ORDER BY wallet_id, timestamp DESC
    DB-->>PHR: per-wallet snapshots nearest to period start (or empty)
    PHR-->>S: aggregated synthetic snapshot (or nil)
    alt snapshot found
        S->>S: periodPnl = currentTotalPnl - snapshot.TotalPnl
        S->>S: periodPnlPercent = periodPnl / snapshot.TotalValue * 100 (if TotalValue > 0)
    else no snapshot (new user or period > history)
        S->>S: periodPnl = totalPnl (fallback to all-time)
        S->>S: periodPnlPercent = totalPnlPercent
    end
    S-->>H: GetPortfolioSummaryResponse{..., periodPnl, periodPnlPercent, period}
    H-->>FE: 200 OK {data: {totalPnl, periodPnl, periodPnlPercent, period, ...}}
```

### Key Invariants

- `periodPnl` is always in `int64` (no float intermediaries for the snapshot delta)
- Fallback to all-time when no snapshot exists for the period (new user or sparse history)
- `DISTINCT ON (wallet_id)` ensures one snapshot per wallet, reducing multi-wallet users to their per-wallet period baseline
- Snapshots are aggregated in memory: sum `TotalPnl` and `TotalValue` across all wallets
- `PNL_PERIOD_ALL` (value=4) and `PNL_PERIOD_UNSPECIFIED` (value=0) both skip the snapshot query and mirror all-time PnL

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| `period` out of range (< 0 or > 4) | Default to `PERIOD_UNSPECIFIED` (all-time), no error | N/A |
| `portfolio_history` query fails | Non-fatal: log warning, fall back to all-time PnL | N/A |
| `snapshotTotalValue = 0` | `periodPnlPercent = 0` (no division) | N/A |
| No snapshots in DB for period | `periodPnl = totalPnl` (all-time fallback) | N/A |

---

## 8. Gold/Silver Chart Data Flow

**Trigger:** User opens the Gold or Silver price chart on the Market Prices page
**Endpoints:** `GET /api/v1/investments/gold-chart`, `GET /api/v1/investments/silver-chart`
**Source:** `handlers/gold.go`, `handlers/silver.go`

```mermaid
sequenceDiagram
    participant Browser
    participant H as GoldChartHandler<br/>/ SilverChartHandler
    participant Redis
    participant Ext as ExternalAPI<br/>(mihong.vn / giabac.vn<br/>/ Yahoo Finance)

    Note over Browser,Ext: Happy Path — Cache Hit

    Browser->>H: GET /api/v1/investments/gold-chart<br/>?market=domestic&goldCode=SJC&period=24h
    H->>H: Validate query params<br/>(allowlist: market, goldCode, period)
    H->>Redis: GET gold_chart:domestic:SJC:24h
    Redis-->>H: Cached JSON payload
    H-->>Browser: 200 OK — cached data

    Note over Browser,Ext: Happy Path — Cache Miss

    Browser->>H: GET /api/v1/investments/gold-chart<br/>?market=domestic&goldCode=SJC&period=24h
    H->>H: Validate query params<br/>(allowlist check)
    H->>Redis: GET gold_chart:domestic:SJC:24h
    Redis-->>H: (nil) — key not found
    H->>Ext: Fetch price history (10s timeout)
    Ext-->>H: Raw price array<br/>{timestamp: "DD/MM/YYYY HH:mm", buy, sell}[]
    H->>H: Parse timestamps<br/>DD/MM/YYYY HH:mm → Unix epoch
    H->>H: Normalize to ChartDataPoint[]<br/>{time: int64, buy: int64, sell: int64}
    alt market=global AND period=24h
        H->>H: Downsample to ≤100 points<br/>(evenly spaced by index)
    end
    H->>Redis: SET gold_chart:domestic:SJC:24h<br/>TTL: 5 min (24h period) / 15 min (longer periods)
    H->>Redis: SET gold_chart:domestic:SJC:24h:stale<br/>TTL: 6× primary TTL (stale fallback)
    H-->>Browser: 200 OK — fresh data

    Note over Browser,Ext: Error Path — External API Failure

    Browser->>H: GET /api/v1/investments/gold-chart<br/>?market=domestic&goldCode=SJC&period=24h
    H->>H: Validate query params
    H->>Redis: GET gold_chart:domestic:SJC:24h
    Redis-->>H: (nil) — key not found
    H->>Ext: Fetch price history (10s timeout)
    Ext-->>H: Timeout / 5xx error
    H->>Redis: GET gold_chart:domestic:SJC:24h:stale
    alt Stale cache hit
        Redis-->>H: Stale JSON payload
        H-->>Browser: 200 OK — stale data
    else No stale cache
        Redis-->>H: (nil)
        H-->>Browser: 503 Service Unavailable<br/>"Failed to fetch chart data"
    end
```

### Key Invariants

| Rule | Detail |
|------|--------|
| Cache key format | `gold_chart:{market}:{goldCode}:{period}` / `silver_chart:{market}:{silverCode}:{period}` |
| TTL — 24h period | 5 minutes (primary), 30 minutes (stale fallback) |
| TTL — longer periods (7d, 30d, 90d) | 15 minutes (primary), 90 minutes (stale fallback) |
| Stale TTL multiplier | Always 6× the primary TTL |
| Downsampling rule | Applied only when `market=global` AND `period=24h`; reduces array to ≤100 evenly spaced points |
| Size limit | Response payload must not exceed 100 data points after normalization/downsampling |
| Timestamp parsing | Input format `DD/MM/YYYY HH:mm` (local time, Asia/Ho_Chi_Minh); stored as Unix seconds |
| Monetary values | `buy` and `sell` stored in smallest currency unit (VND ×1, USD ×100) — consistent with investment storage |
| Param allowlist | `market`: `domestic` or `global`; `goldCode`/`silverCode`: registered type codes only; `period`: `24h`, `7d`, `30d`, `90d` |

### Error Paths

| Condition | Response | Fallback |
|-----------|----------|----------|
| Invalid `market`, `goldCode`/`silverCode`, or `period` param | 400 Bad Request | None |
| External API timeout (>10s) | Check stale cache | Stale data if available |
| External API 5xx | Check stale cache | Stale data if available |
| Stale cache also missing | 503 Service Unavailable | None |
| Timestamp parse failure on individual point | Skip point, continue | Partial dataset returned |
| Redis write failure (SET) | Log warning, continue | Fresh data still returned to client; next request will refetch |

---

## 9. Edit Transaction (Delete-and-Recreate)

**Trigger:** User clicks "Edit" on an existing investment transaction in the portfolio modal.
**Endpoint:** `PUT /api/v1/investment-transactions/{id}`
**Source:** `domain/service/investment_service.go` — `EditTransaction()`, `reverseBuyTransaction()`, `reverseSellTransaction()`, `reverseDividendTransaction()`, `processBuyTransaction()`, `processSellTransaction()`, `processDividendTransaction()`

**Strategy:** Atomic reverse-then-recreate — the old transaction is reversed and soft-deleted, then a new transaction is created with the updated values. This reuses the battle-tested `reverseBuyTransaction`/`reverseSellTransaction`/`reverseDividendTransaction` and `processBuyTransaction`/`processSellTransaction`/`processDividendTransaction` methods.

### Sequence Diagram

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as InvestmentHandler
    participant IS as InvestmentService
    participant ITR as InvestmentTxRepository
    participant IR as InvestmentRepository
    participant LR as LotRepository
    participant Cache as Redis Cache

    SPA->>H: PUT /api/v1/investment-transactions/{id}<br/>{type, quantity, price, fees, transactionDate}
    H->>IS: EditTransaction(userID, txID, request)

    activate IS

    IS->>ITR: GetByIDForUser(txID, userID)
    alt Transaction not found or not owned by user
        ITR-->>IS: nil / error
        IS-->>H: 404 Not Found
    end
    ITR-->>IS: Existing transaction + investment

    IS->>IS: Validate request<br/>(type enum, quantity > 0, price > 0,<br/>transactionDate ≤ now)

    alt type == BUY and newQty < oldQty (quantity reduction)
        IS->>IS: validateBuyQuantityReduction(investment, oldTx, newQty)<br/>ensure no sold lots depend on reduced quantity
        alt Reduction would orphan sold lots
            IS-->>H: 400 Bad Request (ValidationError)
        end
    end

    alt oldType == BUY and newType == SELL
        Note over IS: Step 5b — Pre-flight viability check (no DB writes)
        IS->>IS: quantityAfterReversal = investment.Quantity - oldTx.Quantity
        alt quantityAfterReversal < req.Quantity
            IS-->>H: 400 Bad Request (INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY)<br/>No DB mutations — prevents data corruption
        end
    end

    Note over IS: Reverse old transaction

    alt oldTx.Type == BUY
        IS->>IS: reverseBuyTransaction(investment, oldTx)
        IS->>LR: Update lot (restore RemainingQty or delete lot)
        IS->>IS: investment.Quantity -= oldTx.Quantity<br/>investment.TotalCost -= oldTx.Cost
    else oldTx.Type == SELL
        IS->>IS: reverseSellTransaction(investment, oldTx)
        IS->>LR: Restore lot RemainingQty consumed by sell
        IS->>IS: investment.Quantity += oldTx.Quantity<br/>investment.RealizedPNL -= oldTx.RealizedPNL
    else oldTx.Type == DIVIDEND
        IS->>IS: reverseDividendTransaction(investment, oldTx)
        IS->>IS: investment.TotalDividends -= oldTx.Cost
    end

    IS->>ITR: Delete(oldTx) [soft delete]
    ITR-->>IS: Old transaction soft-deleted

    IS->>IR: GetByID(investment.ID)
    Note over IS,IR: Re-fetch investment state from DB<br/>(not using in-memory stale state)
    IR-->>IS: Fresh investment record

    Note over IS: Process new transaction

    alt newTx.Type == BUY
        IS->>IS: processBuyTransaction(investment, request)
        IS->>LR: Create or merge lot
        IS->>IS: investment.Quantity += newQty<br/>investment.TotalCost += newCost
    else newTx.Type == SELL
        IS->>IS: processSellTransaction(investment, request)
        IS->>LR: Consume lots (FIFO)
        IS->>IS: investment.Quantity -= newQty<br/>investment.RealizedPNL += realizedPNL
    else newTx.Type == DIVIDEND
        IS->>IS: processDividendTransaction(investment, request)
        IS->>IS: investment.TotalDividends += newCost
    end

    IS->>IR: Update(investment)
    IR-->>IS: Investment updated

    IS->>Cache: Invalidate wallet investment value cache
    Note over IS,Cache: nil-guarded; skipped if investment<br/>has no associated wallet

    deactivate IS

    IS-->>H: EditTransactionResponse{transaction, investment}
    H-->>SPA: 200 OK {transaction, investment}
```

### Key Invariants

- Ownership is verified (`GetByIDForUser`) before any mutation — a missing or unowned transaction returns 404
- Buy quantity reduction guard: cannot reduce a buy quantity below units already sold from the lot (`validateBuyQuantityReduction`)
- Type change from BUY with consumed lot is rejected before any mutation begins — no partial state is written
- BUY→SELL pre-flight guard: `quantityAfterReversal = investment.Quantity - oldTx.Quantity` must be ≥ `req.Quantity` before any DB mutation — prevents investment.Quantity corruption when reversing the only BUY lot leaves nothing to sell (`INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY`)
- Transaction date must not be in the future (`transactionDate ≤ now`)
- After reversal, investment state is re-fetched from DB (`IR.GetByID`) — never uses in-memory stale state from prior operations
- Cache is invalidated after successful edit so portfolio summary reflects the change immediately
- Original transaction is soft-deleted (preserved in DB for audit trail); new transaction is a fresh record

### Error Paths

| Condition | Error Response |
|-----------|---------------|
| Transaction not owned by user | 404 Not Found |
| Invalid type enum value | 400 Bad Request (`INVESTMENT_TX_TYPE_INVALID`) |
| Buy quantity below already-sold amount | 400 Bad Request (`ValidationError`) |
| BUY→SELL or BUY→DIVIDEND with consumed lot | 400 Bad Request (`ValidationError`) |
| Transaction date in the future | 400 Bad Request (`InvestmentTxDateFuture`) |
| BUY→SELL where qty after reversal < requested sell qty | 400 Bad Request (`INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY`) — no DB writes |
| Reversal failure (lot update or delete) | 500 Internal Server Error (no partial state committed) |
| New transaction processing failure | 500 Internal Server Error (reversal already applied — inconsistency risk logged) |

---

## 10. Gold/Silver Price Resolution via Fetch Codes

**Trigger:** `PriceUpdateJob` calls `InvestmentService.UpdatePrices()` → `MarketDataService.UpdatePricesForInvestments()` → `fetchGoldPriceFromDB()` / `fetchSilverPriceFromDB()`
**Source:** `domain/service/market_data_service.go`, `domain/service/asset_display_config_service.go`, `domain/repository/asset_config_fetch_code_repository.go`, `domain/repository/asset_price_repository.go`

This sequence describes the internal resolution logic that `AssetDisplayConfigService.ResolvePrice()` uses to find the best available price for a gold or silver investment symbol. It reads exclusively from the `asset_price` DB table (populated by `PriceCacheJob`). The live gold/silver APIs are only contacted as a cold-start fallback when no DB rows exist.

```mermaid
sequenceDiagram
    participant PUJ as PriceUpdateJob
    participant IS as InvestmentService
    participant MDS as MarketDataService
    participant ADCS as AssetDisplayConfigService
    participant FCDB as asset_config_fetch_code<br/>(DB table)
    participant APDB as asset_price<br/>(DB table)
    participant GPS as GoldPriceService<br/>(live API — fallback only)

    PUJ->>IS: UpdatePrices(userID)
    IS->>IS: ListByUserID + filter isCustom=true
    IS->>MDS: UpdatePricesForInvestments(investments, forceRefresh=false)

    Note over MDS: Gold investments processed sequentially

    loop For each gold/silver investment
        MDS->>MDS: fetchGoldPriceFromDB(ctx, symbol, currency, type)<br/>or fetchSilverPriceFromDB(...)

        MDS->>ADCS: ResolvePrice(ctx, symbol, "gold")

        activate ADCS
        ADCS->>ADCS: configRepo.GetByTypeCodeAndAssetType(symbol, "gold")
        Note over ADCS: Lookup asset_display_config row

        ADCS->>FCDB: fetchCodeRepo.ListByConfigID(configID)<br/>ORDER BY priority ASC
        FCDB-->>ADCS: []AssetConfigFetchCode (ordered by priority)

        alt No fetch codes configured
            ADCS-->>MDS: error "no fetch codes configured"
            Note over MDS: Falls through to live API fallback
        end

        ADCS->>APDB: assetPriceRepo.ListByAssetType("gold")
        APDB-->>ADCS: []AssetPrice rows for this assetType
        Note over ADCS: Build priceMap[typeCode]→AssetPrice<br/>(keep most recently fetched per typeCode)

        loop For each fetch code (priority order)
            ADCS->>ADCS: Look up priceMap[fetchCode.TypeCode]
            alt Price row found AND not stale
                ADCS-->>MDS: return price.Buy, isStale=false, nil
                Note over MDS: Returns immediately — first non-stale hit wins
            else Price row found but stale
                ADCS->>ADCS: Track as freshestStale candidate
            else Price row not found
                Note over ADCS: Skip, try next fetch code
            end
        end

        alt All fetch codes stale (freshestStale != nil)
            ADCS-->>MDS: return freshestStale.Buy, isStale=true, nil
        else No matching asset_price rows at all
            ADCS-->>MDS: error "no asset price found"
        end
        deactivate ADCS

        alt ResolvePrice succeeded (no error)
            MDS->>MDS: goldConverter.ProcessMarketPrice(rawPrice, currency, type)<br/>VND gold: per-lượng → per-gram<br/>USD gold: pass-through (already per-ounce)
            MDS-->>IS: &MarketData{Symbol, Currency, Price: normalizedPrice}
        else ResolvePrice error (cold start or no fetch codes)
            Note over MDS,GPS: Cold-start fallback — DB not yet populated by PriceCacheJob
            MDS->>GPS: goldPriceService.FetchPriceForSymbol(ctx, symbol)
            GPS-->>MDS: &CachedGoldPrice{Buy, UpdateTime}
            MDS->>MDS: goldConverter.ProcessMarketPrice(price.Buy, currency, type)
            MDS-->>IS: &MarketData{Symbol, Currency, Price: normalizedPrice}
        end
    end

    IS->>IS: Collect priceUpdates map[investmentID]price
    IS->>IS: investmentRepo.UpdatePrices([]PriceUpdate{...})<br/>Batch SQL: current_price + price_updated_at
```

### ResolvePrice Algorithm Summary

```
Input:  typeCode (investment symbol), assetType ("gold" or "silver")
Output: (price int64, isStale bool, err error)

1. configRepo.GetByTypeCodeAndAssetType(typeCode, assetType)
   → 404 if no config row → caller falls back to live API

2. fetchCodeRepo.ListByConfigID(configID) ORDER BY priority ASC
   → validation error if empty → caller falls back to live API

3. assetPriceRepo.ListByAssetType(assetType)
   → build priceMap[typeCode] → most recently fetched per typeCode

4. Iterate fetch codes (priority order):
   → non-stale match found → return (price.Buy, false, nil)  ← early exit
   → stale match → record as freshestStale candidate

5. If freshestStale != nil → return (freshestStale.Buy, true, nil)

6. If no matching rows at all → return (0, false, error) → caller falls back to live API
```

### Producer-Consumer Relationship

| Role | Component | Frequency | Direction |
|------|-----------|-----------|-----------|
| **Writer (producer)** | `PriceCacheJob` → `AssetPriceService.RefreshAllPrices()` | Every 15 min | Writes `asset_price` table |
| **Reader (consumer)** | `PriceUpdateJob` → `MarketDataService` → `AssetDisplayConfigService.ResolvePrice()` | Every 15 min | Reads `asset_price` table |

`PriceCacheJob` is the **sole writer** to `asset_price`. `PriceUpdateJob` never writes to `asset_price` — it reads prices from it to update the `investment.current_price` column.

### Key Invariants

- **Priority order is respected**: fetch codes are ordered by `priority ASC` — lower number = higher priority (tried first)
- **First non-stale price wins**: the loop returns immediately on the first fetch code whose `asset_price` row has `is_stale = false`
- **Freshest stale fallback**: if all fetch codes resolve to stale rows, the most recently fetched stale price is returned (with `isStale=true`) rather than an error
- **Single DB read for all fetch codes**: `ListByAssetType` loads all prices for the asset type once and builds an in-memory map — not one query per fetch code
- **Cold-start safety**: if `ResolvePrice` returns any error, `MarketDataService` falls back to the live gold/silver API. This prevents portfolio prices from being blank on the very first run before `PriceCacheJob` has populated the table
- **Normalization is always applied**: `goldConverter.ProcessMarketPrice()` is called regardless of whether the price came from the DB or the live API fallback

### Error Paths

| Condition | Response | Caller Action |
|-----------|----------|--------------|
| No `asset_display_config` row for typeCode | `NotFoundError` | Fall back to live `GoldPriceService` |
| No fetch codes configured for config | `ValidationError` "no fetch codes configured" | Fall back to live `GoldPriceService` |
| All fetch codes stale | Returns `(price, isStale=true, nil)` | Uses stale price (no fallback — still a valid price) |
| No `asset_price` rows match any fetch code | `NotFoundError` "no asset price found" | Fall back to live `GoldPriceService` |
| Live API fallback also fails | `fmt.Errorf("failed to fetch gold price: ...")` | `fetchAndUpdateSingle` logs warning, skips investment |

---

## 11. Gold/Silver VND Investment Type Selection (Admin Config–Driven)

**Trigger:** User opens the Add Investment modal and selects "Gold (VND)" or "Silver (VND)" as the investment type.
**Source:** `handlers/gold.go`, `handlers/silver.go`, `domain/service/asset_display_config_service.go`, `domain/repository/asset_display_config_repository.go`

This flow replaces the former static registry approach where `GoldTypes` and `SilverTypes` arrays hardcoded all VND type options. VND types are now served dynamically from the `asset_display_config` table, controlled by admins. USD types remain statically registered (`XAUUSD` / `XAGUSD`).

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA<br/>(AddInvestmentForm)
    participant GH as GoldHandler<br/>/ SilverHandler
    participant ADCS as AssetDisplayConfigService
    participant ADCR as AssetDisplayConfigRepository<br/>(asset_display_config table)

    Note over SPA: User selects "Gold VND" or "Silver VND"<br/>form mounts, enabled=true triggers query

    SPA->>GH: GET /api/v1/investments/gold-types?currency=VND
    GH->>GH: Whitelist check: VND | USD | "" accepted<br/>any other value → 400 Bad Request

    GH->>ADCS: ListForInvestment(ctx, "gold")
    ADCS->>ADCR: ListForInvestment(ctx, "gold")<br/>WHERE asset_type='gold'<br/>AND enabled=true<br/>AND show_in_investment=true<br/>ORDER BY display_order ASC
    ADCR-->>ADCS: []AssetDisplayConfig
    ADCS-->>GH: []AssetDisplayConfig

    GH->>GH: mapVNDConfigsToResponse():<br/>each → {code: TypeCode, name: DisplayName,<br/>currency: "VND", unit: "mace",<br/>unitWeight: 3.75, type: 8}

    GH-->>SPA: 200 OK — []goldTypeResponse

    Note over SPA: silverTypeOptions useMemo merges:<br/>API VND types + static SILVER_USD_OPTIONS

    SPA->>SPA: Render dropdown with admin-controlled VND types

    Note over SPA,GH: Parallel call for USD (if needed)

    SPA->>GH: GET /api/v1/investments/gold-types?currency=USD
    GH->>GH: gold.GetGoldTypesByCurrency("USD")<br/>returns only XAUUSD (static registry)
    GH->>GH: mapUSDStaticToResponse():<br/>{code: "XAUUSD", currency: "USD",<br/>unit: "oz", unitWeight: 31.1034768, type: 9}
    GH-->>SPA: 200 OK — []goldTypeResponse (USD only)
```

### Key Invariants

- **VND types are admin-controlled**: adding/removing/reordering VND gold or silver investment options requires no code change — admins update `asset_display_config` rows via the admin panel
- **USD types remain static**: `XAUUSD` (gold) and `XAGUSD` (silver) are hardcoded; they do not appear in `GoldTypes`/`SilverTypes` static arrays and are not managed via admin config
- **Currency whitelist**: `GoldHandler` and `SilverHandler` reject any `currency` param that is not `"VND"`, `"USD"`, or empty — returning `400 Bad Request`
- **Empty currency = merged**: omitting `?currency` returns VND (from DB) + USD (static) concatenated, in that order
- **show_in_investment flag**: `AssetDisplayConfigRepository.ListForInvestment()` requires both `enabled = true` AND `show_in_investment = true` — investment forms and the prices page use different flags; a config shown in prices but not investments will not appear here
- **display_order controls sort**: returned types appear in `display_order ASC` sequence, matching the admin-configured ordering

### Frontend Integration

| Form | Hook | Behavior |
|------|------|----------|
| `AddInvestmentForm` | `useQueryGetAssetDisplayPrices({ assetType: "silver" })` | Enabled only when Silver VND selected; `inferSilverUnits(typeCode)` maps type to unit array |
| `AddToWatchlistForm` | `useQueryGetAssetDisplayPrices({ assetType: "gold|silver" })` | Both hooks always active; VND options populated from API response |
| `CreatePriceAlertForm` | `useQueryGetAssetDisplayPrices({ assetType: "gold|silver" })` | API-driven select options; `useRef` one-shot init prevents infinite re-render |
| Gold investment type (USD) | Static `GOLD_USD_OPTIONS` | Not API-driven; `XAUUSD` only |
| Silver investment type (USD) | Static `SILVER_USD_OPTIONS` | Not API-driven; `XAGUSD` only |

### Error Paths

| Condition | Response | Caller Action |
|-----------|----------|--------------|
| Unknown `currency` param (e.g. `EUR`) | `400 Bad Request` "invalid currency 'EUR': must be VND, USD, or omitted" | Frontend shows validation error |
| `ListForInvestment` DB error | `500 Internal Server Error` | Frontend shows generic error state |
| Admin config empty (no matching rows) | `200 OK — []` (empty array) | Dropdown shows no VND options; user can still select USD |

---

## 12. Currency Investment Price Refresh

**Trigger:** Background scheduler every 15 minutes, or manual `PUT /api/v1/investments/market-price`
**Source:** `domain/service/investment_service.go`, `domain/service/market_data_service.go`, `domain/service/asset_display_config_service.go`

This flow documents how `FOREIGN_CURRENCY` investments receive automatic price updates — the same pipeline as gold/silver, using `AssetDisplayConfigService.ResolvePrice` with `assetType="currency"` to read buy prices from the `asset_price` DB table populated by `CurrencyPriceService`.

```mermaid
sequenceDiagram
    participant Scheduler as Background Scheduler (15m)
    participant InvSvc as InvestmentService
    participant MktSvc as MarketDataService
    participant AssetSvc as AssetDisplayConfigService
    participant DB as PostgreSQL

    Scheduler->>InvSvc: UpdatePrices(ctx, userID)
    InvSvc->>DB: ListByUserID (filter isCustom=false)
    DB-->>InvSvc: [investments incl. FOREIGN_CURRENCY]
    InvSvc->>MktSvc: UpdatePricesForInvestments(investments)

    Note over MktSvc: Group by type

    loop per unique currency symbol
        MktSvc->>AssetSvc: ResolvePrice(symbol, "currency")
        AssetSvc->>DB: SELECT asset_price WHERE type_code=symbol AND asset_type="currency"
        DB-->>AssetSvc: price rows ordered by priority
        AssetSvc-->>MktSvc: (buy, sell, isStale, err)
    end

    MktSvc-->>InvSvc: map[investmentID]→buy price
    InvSvc->>InvSvc: investment.Recalculate() per updated investment
    InvSvc->>DB: UpdatePrices(PriceUpdate{CurrentPrice, priceUpdatedAt})
```

### Key Invariants

- FOREIGN_CURRENCY investments are grouped by symbol — price lookup is O(unique currencies), not O(investments)
- Error per symbol is non-fatal — logged and skipped; other investment types and other currency symbols continue unaffected
- `isStale=true` prices are still stored (stale price > 0 is better than no update); staleness is surfaced to the frontend via the `priceUpdatedAt` timestamp
- `priceUpdatedAt` is always written on successful price resolution — enables frontend staleness indicators

### Price Data Path

```
CurrencyPriceService (3 parallel sources: vangsaigon.vn, vang.today, Vietcombank)
    → asset_price table (upserted every 15 min by PriceCacheJob)
    → AssetDisplayConfigService.ResolvePrice(symbol, "currency")
    → MarketDataService.UpdatePricesForInvestments()
    → investmentRepo.UpdatePrices() [current_price + price_updated_at]
```

---

## 13. Get Market Prices (Prices Page)

**Trigger:** User opens `/dashboard/prices` — browser fetches `GET /api/v1/investments/market-prices`
**Endpoint:** `GET /api/v1/investments/market-prices`
**Source:** `handlers/market_prices.go`, `domain/service/asset_display_config_service.go`

This flow documents how the Prices page fetches display prices for gold, silver, and currency tabs. `MarketPricesHandler` calls `AssetDisplayConfigService.GetDisplayPrices()` three times (once per asset type) and combines the results. Each call returns only enabled configs ordered by `display_order`, with prices resolved via the fetch-code priority chain from the `asset_price` DB table.

```mermaid
sequenceDiagram
    participant Browser as Browser (Prices Page)
    participant H as MarketPricesHandler
    participant ADCS as AssetDisplayConfigService
    participant ADCR as AssetDisplayConfigRepository<br/>(asset_display_config table)
    participant APR as AssetPriceRepository<br/>(asset_price table)
    participant Redis as Redis (overrideCache)

    Browser->>H: GET /api/v1/investments/market-prices

    Note over H: Call GetDisplayPrices for each asset type sequentially

    H->>ADCS: GetDisplayPrices(ctx, "gold")
    activate ADCS
    ADCS->>ADCR: ListByAssetType(ctx, "gold")<br/>WHERE enabled=true ORDER BY display_order ASC
    ADCR-->>ADCS: []AssetDisplayConfig (gold configs)
    loop For each gold config
        ADCS->>APR: ListByAssetType("gold")<br/>build priceMap[typeCode]→AssetPrice
        APR-->>ADCS: []AssetPrice rows
        ADCS->>ADCS: Iterate fetch codes (priority ASC)<br/>→ first non-stale hit wins<br/>→ stale fallback if all stale
        ADCS->>ADCS: Assemble AssetDisplayPriceDTO{<br/>TypeCode, DisplayName, Buy, Sell,<br/>ChangeBuy, ChangeSell, Currency,<br/>UpdatedAt, IsStale}
    end
    ADCS-->>H: []*AssetDisplayPriceDTO (gold)
    deactivate ADCS

    H->>ADCS: GetDisplayPrices(ctx, "silver")
    activate ADCS
    ADCS->>ADCR: ListByAssetType(ctx, "silver")<br/>WHERE enabled=true ORDER BY display_order ASC
    ADCR-->>ADCS: []AssetDisplayConfig (silver configs)
    loop For each silver config
        ADCS->>APR: ListByAssetType("silver")
        APR-->>ADCS: []AssetPrice rows
        ADCS->>ADCS: Resolve via fetch-code priority
        ADCS->>ADCS: Assemble AssetDisplayPriceDTO
    end
    ADCS-->>H: []*AssetDisplayPriceDTO (silver)
    deactivate ADCS

    H->>ADCS: GetDisplayPrices(ctx, "currency")
    activate ADCS
    ADCS->>ADCR: ListByAssetType(ctx, "currency")<br/>WHERE enabled=true ORDER BY display_order ASC
    ADCR-->>ADCS: []AssetDisplayConfig (currency configs)
    loop For each currency config
        ADCS->>APR: ListByAssetType("currency")
        APR-->>ADCS: []AssetPrice rows
        ADCS->>ADCS: Resolve via fetch-code priority
        ADCS->>ADCS: Assemble AssetDisplayPriceDTO
    end
    ADCS-->>H: []*AssetDisplayPriceDTO (currency)
    deactivate ADCS

    Note over H: Map each AssetDisplayPriceDTO → PriceItem proto<br/>TypeCode→typeCode, DisplayName→name,<br/>Buy→buy, Sell→sell, Currency→currency,<br/>UpdatedAt.Unix()→updatedAt, IsStale→isStale

    loop For each PriceItem (all asset types)
        H->>Redis: overrideCache.Get(typeCode)
        alt Override exists in Redis
            Redis-->>H: overridden buy/sell prices
            H->>H: Apply override: item.Buy=override.Buy<br/>item.Sell=override.Sell<br/>item.IsOverridden=true
        else No override
            Redis-->>H: cache miss
        end
    end

    H-->>Browser: 200 OK<br/>{gold: [PriceItem,...], silver: [PriceItem,...],<br/>currency: [PriceItem,...], timestamp}
```

### Key Invariants

- **Three sequential calls, not one**: `GetDisplayPrices()` is called separately for `"gold"`, `"silver"`, and `"currency"` — each returns only its own asset type's configs
- **`enabled=true` filter**: only active configs are returned; if all gold configs are disabled, `gold: []` is returned and the frontend hides the gold tab
- **`display_order` controls sort**: items within each asset type appear in `display_order ASC` sequence, matching admin configuration
- **Fetch-code priority chain**: for each config, `ResolvePrice()` checks fetch codes in priority order — first non-stale match wins; freshest stale used as fallback if all stale
- **`asset_price` table is pre-populated**: prices are read from the DB (written by `PriceCacheJob` every 15 min), never from live APIs at request time — no latency spike
- **`overrideCache` preserved**: Redis admin price overrides are applied after DTO mapping, same as before the refactor
- **No auth required**: endpoint is public; `assetType` values are internal constants, never user-supplied

### Data Sources by Asset Type

| Asset Type | Config Source | Price Source | Write Frequency |
|------------|--------------|--------------|-----------------|
| `"gold"` | `asset_display_config WHERE asset_type='gold' AND enabled=true` | `asset_price` via fetch-code priority | Every 15 min (PriceCacheJob → GoldPriceService) |
| `"silver"` | `asset_display_config WHERE asset_type='silver' AND enabled=true` | `asset_price` via fetch-code priority | Every 15 min (PriceCacheJob → SilverPriceService) |
| `"currency"` | `asset_display_config WHERE asset_type='currency' AND enabled=true` | `asset_price` via fetch-code priority | Every 15 min (PriceCacheJob → CurrencyPriceService) |

### Field Mapping: AssetDisplayPriceDTO → PriceItem

| `AssetDisplayPriceDTO` field | `PriceItem` proto field | Notes |
|------------------------------|------------------------|-------|
| `TypeCode` | `typeCode` | Config type_code, not fetch type_code |
| `DisplayName` | `name` | Admin-controlled display name |
| `Buy` | `buy` | int64, smallest currency unit |
| `Sell` | `sell` | int64, smallest currency unit |
| `ChangeBuy` | `changeBuy` | int64, price delta |
| `ChangeSell` | `changeSell` | int64, price delta |
| `Currency` | `currency` | ISO 4217 (e.g. `"VND"`, `"USD"`) |
| `UpdatedAt.Unix()` | `updatedAt` | Unix timestamp (seconds) |
| `IsStale` | `isStale` | True if all fetch codes returned stale prices |
| Redis override | `isOverridden` | True if admin override applied from cache |

### Frontend Tab Visibility (driven by this response)

```
isSuccess && data?.gold?.length === 0   → gold tab hidden
isSuccess && data?.silver?.length === 0 → silver tab hidden
isSuccess && data?.currency?.length === 0 → currency tab hidden
isLoading || isError                    → all tabs shown (no flicker)
activeTab no longer visible             → reset to first visible tab
```
