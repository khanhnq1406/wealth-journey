# C4 Level 4: Investment Domain Code

Class-level detail of the investment bounded context — the most complex domain in WealthJourney.

```mermaid
classDiagram
    direction TB

    class InvestmentService {
        <<interface>>
        +CreateInvestment(ctx, userID, req) (*CreateInvestmentResponse, error)
        +GetInvestment(ctx, userID, id) (*Investment, error)
        +ListInvestments(ctx, userID, walletID, pagination) ([]*Investment, error)
        +ListUserInvestments(ctx, userID, pagination) ([]*Investment, error)
        +UpdateInvestment(ctx, userID, req) (*Investment, error)
        +DeleteInvestment(ctx, userID, id) error
        +AddTransaction(ctx, userID, investmentID, req) (*InvestmentTransaction, error)
        +EditTransaction(ctx, userID, txnID, req) (*InvestmentTransaction, error)
        +DeleteTransaction(ctx, userID, txnID) error
        +ListTransactions(ctx, userID, investmentID, pagination) ([]*InvestmentTransaction, error)
        +GetPortfolioSummary(ctx, userID, walletID) (*PortfolioSummary, error)
        +GetAggregatedPortfolioSummary(ctx, userID) (*AggregatedPortfolioSummary, error)
        +UpdatePrices(ctx, userID, investments) error
        +SearchSymbols(ctx, query, limit) ([]*SymbolSearchResult, error)
        +GetMarketPrice(ctx, symbol, exchange) (*MarketPrice, error)
    }

    class investmentService {
        -investmentRepo InvestmentRepository
        -walletRepo WalletRepository
        -investmentTxnRepo InvestmentTransactionRepository
        -marketDataSvc MarketDataService
        -userRepo UserRepository
        -fxRateSvc FXRateService
        -currencyCache *CurrencyCache
        -walletSvc WalletService
    }

    class InvestmentRepository {
        <<interface>>
        +Create(ctx, investment) error
        +GetByID(ctx, id) (*Investment, error)
        +GetByIDAndUserID(ctx, id, userID) (*Investment, error)
        +ListByWalletID(ctx, walletID, pagination) ([]*Investment, int64, error)
        +ListByUserID(ctx, userID, pagination) ([]*Investment, int64, error)
        +Update(ctx, investment) error
        +Delete(ctx, id) error
        +GetLots(ctx, investmentID) ([]*InvestmentLot, error)
        +CreateLot(ctx, lot) error
        +UpdateLot(ctx, lot) error
        +DeleteLot(ctx, id) error
    }

    class InvestmentTransactionRepository {
        <<interface>>
        +Create(ctx, txn) error
        +GetByID(ctx, id) (*InvestmentTransaction, error)
        +GetByIDAndUserID(ctx, id, userID) (*InvestmentTransaction, error)
        +ListByInvestmentID(ctx, investmentID, pagination) ([]*InvestmentTransaction, int64, error)
        +Update(ctx, txn) error
        +Delete(ctx, id) error
    }

    class MarketDataService {
        <<interface>>
        +GetPrice(ctx, symbol, exchange) (*MarketPrice, error)
        +GetPriceForInvestment(ctx, investment) (*MarketPrice, error)
        +UpdatePrice(ctx, symbol, exchange, price) error
        +SearchSymbols(ctx, query, limit) ([]*SymbolSearchResult, error)
    }

    class marketDataService {
        -marketDataRepo MarketDataRepository
        -goldPriceSvc GoldPriceService
        -silverPriceSvc SilverPriceService
    }

    class GoldPriceService {
        <<interface>>
        +FetchAllPrices() ([]*CachedGoldPrice, error)
        +GetPrice(typeCode string) (*CachedGoldPrice, error)
    }

    class SilverPriceService {
        <<interface>>
        +FetchAllPrices() ([]*CachedSilverPrice, error)
        +GetPrice(typeCode string) (*CachedSilverPrice, error)
    }

    class PortfolioHistoryService {
        <<interface>>
        +RecordSnapshot(ctx, userID) error
        +GetHistoricalValues(ctx, userID, from, to) ([]*PortfolioHistoryEntry, error)
    }

    class FXRateService {
        <<interface>>
        +GetRate(ctx, from, to string) (float64, error)
        +Convert(ctx, amount int64, from, to string) (int64, error)
    }

    class Investment {
        +ID int32
        +UserID int32
        +WalletID int32
        +Symbol string
        +Name string
        +Type InvestmentType
        +Exchange string
        +Currency string
        +Quantity int64
        +AveragePrice int64
        +TotalCost int64
        +CurrentPrice int64
        +IsCustom bool
        +InvestmentTypeCode string
        +CreatedAt time.Time
        +UpdatedAt time.Time
    }

    class InvestmentTransaction {
        +ID int32
        +InvestmentID int32
        +UserID int32
        +Type TransactionType
        +Quantity int64
        +PricePerUnit int64
        +TotalAmount int64
        +Fee int64
        +Notes string
        +TransactionDate time.Time
        +CreatedAt time.Time
    }

    class InvestmentLot {
        +ID int32
        +InvestmentID int32
        +TransactionID int32
        +PurchasePrice int64
        +Quantity int64
        +RemainingQuantity int64
        +CostBasis int64
        +PurchaseDate time.Time
    }

    class MarketData {
        +ID int32
        +Symbol string
        +Exchange string
        +Price int64
        +Currency string
        +Volume int64
        +UpdatedAt time.Time
    }

    class PortfolioHistory {
        +ID int32
        +UserID int32
        +TotalValue int64
        +TotalCost int64
        +Currency string
        +SnapshotDate time.Time
    }

    InvestmentService <|.. investmentService : implements
    investmentService --> InvestmentRepository : uses
    investmentService --> InvestmentTransactionRepository : uses
    investmentService --> MarketDataService : uses
    investmentService --> FXRateService : uses
    investmentService --> WalletService : uses

    MarketDataService <|.. marketDataService : implements
    marketDataService --> GoldPriceService : uses
    marketDataService --> SilverPriceService : uses

    PortfolioHistoryService --> InvestmentService : uses
    PortfolioHistoryService --> FXRateService : uses

    InvestmentRepository --> Investment : manages
    InvestmentRepository --> InvestmentLot : manages
    InvestmentTransactionRepository --> InvestmentTransaction : manages
    MarketDataService --> MarketData : caches
    PortfolioHistoryService --> PortfolioHistory : records
```

## FIFO Cost Basis Algorithm

The investment service uses First-In, First-Out (FIFO) for cost basis accounting:

```
Buy 100 shares @ $10 → Lot A: qty=100, price=$10, cost=$1000
Buy  50 shares @ $12 → Lot B: qty=50,  price=$12, cost=$600

Sell 120 shares @ $15:
  1. Consume Lot A: 100 shares @ $10 = $1000 cost basis
  2. Consume Lot B:  20 shares @ $12 = $240  cost basis
  Total cost basis: $1240
  Proceeds: 120 × $15 = $1800
  Realized PNL: $1800 - $1240 = $560

Remaining: Lot B: qty=30, price=$12, cost=$360
```

## Investment Types

| Type | Value | Currency | Storage Unit | Market Price Unit |
|------|-------|----------|-------------|-------------------|
| STOCK | 1 | Any | shares × 10000 | per share |
| ETF | 2 | Any | shares × 10000 | per share |
| CRYPTO | 3 | Any | units × 10000 | per unit |
| BOND | 4 | Any | units × 10000 | per unit |
| MUTUAL_FUND | 5 | Any | units × 10000 | per unit |
| COMMODITY | 6 | Any | units × 10000 | per unit |
| OTHER | 7 | Any | units × 10000 | per unit |
| GOLD_VND | 8 | VND | grams × 10000 | per mace (convert) |
| GOLD_USD | 9 | USD | ounces × 10000 | per ounce |
| SILVER_VND | 10 | VND | grams × 10000 | per tael (convert) |
| SILVER_USD | 11 | USD | ounces × 10000 | per ounce |

## Key Design Decisions

1. **All quantities stored as int64 × 10000**: Avoids floating-point precision issues
2. **FIFO lot tracking**: Each buy creates a lot; sells consume oldest lots first
3. **Market data cached in both Redis (15min TTL) and PostgreSQL (permanent)**
4. **Gold/silver prices normalized**: VND prices converted from per-lượng to per-gram for storage
5. **Custom investments**: `isCustom=true` skips market data lookup, uses manual price updates
6. **Portfolio snapshots**: Hourly snapshots enable historical performance charts without recalculating
