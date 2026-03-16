# Investment Domain — Runtime Flows

Investment portfolio management flows covering the most complex business logic in the system. Includes FIFO cost basis accounting, multi-source market price updates, and portfolio aggregation with FX conversion.

## Table of Contents

- [Create Investment (incl. Gold/Silver)](#1-create-investment-incl-goldsilver)
- [Buy Transaction with Lot Merging](#2-buy-transaction-with-lot-merging)
- [FIFO Sell Transaction](#3-fifo-sell-transaction)
- [Dividend Processing](#4-dividend-processing)
- [Market Price Update Pipeline](#5-market-price-update-pipeline)
- [Portfolio Summary Calculation](#6-portfolio-summary-calculation)

---

## 1. Create Investment (incl. Gold/Silver)

**Trigger:** User adds a new investment holding (wallet auto-selected by backend)
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

    SPA->>H: POST /api/v1/investments<br/>{walletId: 0, symbol, name, type, currency,<br/>initialQuantity, initialCost, isCustom}
    H->>IS: CreateInvestment(userID, req)

    activate IS

    alt walletId == 0 (auto-select)
        IS->>WR: ListByUserID(userID) — oldest active wallet
        WR-->>IS: Selected wallet
    else walletId provided
        IS->>WR: GetByIDForUser(walletId, userID)
    end

    IS->>IS: Validate symbol not already in wallet

    Note over IS,Units: Unit conversion for gold/silver
    IS->>Units: QuantityToStorage(quantity, type)
    Note over IS,Units: Gold VND: grams × 10000<br/>Gold USD: ounces × 10000<br/>Stocks: shares × 100
    IS->>Units: ToSmallestCurrencyUnit(cost, currency)
    Note over IS,Units: VND: ×1, USD: ×100

    IS->>Units: CalculateAverageCost(totalCost, quantity, type)

    IS->>IR: Create(Investment{symbol, name, type, currency,<br/>quantity, averageCost, totalCost, isCustom})
    IR-->>IS: Investment created

    IS->>ITR: Create(InvestmentTx{type: BUY, quantity, price, cost})
    alt Transaction creation fails
        ITR-->>IS: Error
        IS->>IR: Delete(investmentID)
        Note over IS,IR: ROLLBACK: delete investment
        IS-->>H: Error
    end

    IS->>LR: Create(Lot{quantity, remainingQty: quantity,<br/>averageCost, totalCost, purchasedAt: now})
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
| Gold (VND) | Grams | ×10,000 | 75g (2 taels) = 750,000 |
| Gold (USD) | Ounces | ×10,000 | 1 oz = 10,000 |
| Silver (VND) | Grams | ×10,000 | Same as gold |
| Silver (USD) | Ounces | ×10,000 | Same as gold |

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| No active wallet found (auto-select) | 400 Validation | None |
| Wallet not found or not owned | 404 | None |
| Symbol already exists in wallet | 400 Validation | None |
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
**Source:** `domain/service/market_data_service.go`, `domain/service/gold_price_service.go`, `domain/service/silver_price_service.go`

```mermaid
flowchart TD
    A["UpdatePrices(userID)\nFetch all user wallets"] --> B["List all investments\nacross wallets"]
    B --> C["Filter out isCustom=true\n(manual price only)"]
    C --> D["Categorize by type"]
    D --> E["Return immediately to client\n'Price update started for N investments'"]
    E --> F["Run in background goroutine\n(5-minute timeout)"]

    F --> G{Investment type?}

    G -- "Stocks / ETFs / Crypto" --> H["Batch by 10 symbols"]
    H --> I["yahoo.GetQuoteBatch()"]
    I --> J["For each quote:\nToSmallestCurrencyUnit(price, currency)"]
    J --> K["Create/update MarketData\n{symbol, price, change24h}"]

    G -- "Gold (VND/USD)" --> L["goldPriceService.FetchPriceForSymbol()"]
    L --> M["vang.today API\nGold prices by type code"]
    M --> N{"Gold type?"}
    N -- "VND" --> O["Price per tael →\ngoldConverter.ProcessMarketPrice()\n→ price per gram (storage format)"]
    N -- "USD" --> P["Price per ounce × 100\n(convert to cents)"]
    O --> K
    P --> K

    G -- "Silver (VND)" --> Q["silverPriceService.FetchPriceForSymbol()"]
    Q --> R["vang.today API\nSilver prices"]
    R --> S["silverConverter.ProcessMarketPrice()\n→ price per gram (storage format)"]
    S --> K

    G -- "Silver (USD)" --> T["Fallback to Yahoo Finance\nSI=F or XAGUSD=X"]
    T --> U["ToSmallestCurrencyUnit(price, 'USD')"]
    U --> K

    K --> V["investmentRepo.UpdatePrices()\nBatch SQL update of current_price"]
    V --> W["Invalidate wallet investment\nvalue cache per wallet"]

    subgraph CacheFallback["Cache + Fallback Logic"]
        direction TB
        CF1["Check MarketData cache\n(symbol + currency)"] --> CF2{Fresh < 15 min?}
        CF2 -- Yes --> CF3["Return cached price"]
        CF2 -- No --> CF4["Fetch from API"]
        CF4 --> CF5{API success?}
        CF5 -- Yes --> CF6["Update cache + return"]
        CF5 -- No --> CF7{Stale cache exists?}
        CF7 -- Yes --> CF8["Log warning\nReturn stale price"]
        CF7 -- No --> CF9["Return error"]:::error
    end

    classDef error fill:#fee,stroke:#c00,color:#900
```

### Key Invariants

- Custom investments (`isCustom: true`) are excluded from automatic price updates — they use manual price via `UpdateInvestmentPriceForm`
- Price update runs asynchronously to avoid HTTP timeouts; client is notified immediately
- Stale cache is preferred over no data — API failures gracefully degrade
- Gold VND prices require tael-to-gram normalization before storage
- Silver USD uses Yahoo Finance as a fallback since the primary silver API only covers VND

### Price Sources by Type

| Investment Type | Primary Source | Fallback | Cache TTL |
|----------------|---------------|----------|-----------|
| Stocks / ETFs | Yahoo Finance | Stale cache | 15 min |
| Crypto | Yahoo Finance | Stale cache | 15 min |
| Gold (VND) | vang.today | Redis gold cache | 15 min |
| Gold (USD) | vang.today | Redis gold cache | 15 min |
| Silver (VND) | vang.today | Redis silver cache | 15 min |
| Silver (USD) | Yahoo Finance (`SI=F`) | Stale cache | 15 min |
| Custom | Manual only | N/A | N/A |

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
