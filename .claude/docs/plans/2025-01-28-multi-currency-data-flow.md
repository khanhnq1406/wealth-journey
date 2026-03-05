# Multi-Currency System Data Flow

**Date:** 2025-01-28
**Related:** [Multi-Currency System Design](./2025-01-28-multi-currency-system-design.md)

---

## Table of Contents

1. [Overview](#overview)
2. [User Creates Wallet](#user-creates-wallet)
3. [User Views Dashboard](#user-views-dashboard)
4. [User Changes Currency](#user-changes-currency)
5. [Investment Creation with Currency Selection](#investment-creation-with-currency-selection)
6. [FX Rate Fetching](#fx-rate-fetching)
7. [Cache Operations](#cache-operations)

---

## Overview

The multi-currency system uses a **pre-conversion strategy** where converted values are cached in Redis when users change their currency preference. All monetary values are stored in their original currency, and conversion happens on-demand with aggressive caching.

**Key Principles:**
1. **Original data never changes** - always stored in entity's native currency
2. **Conversion happens once** - when currency preference changes
3. **Redis cache for speed** - ~1ms read time vs 50ms MySQL joins
4. **Batch processing** - minimize FX rate API calls
5. **Race condition prevention** - `conversion_in_progress` flag

---

## User Creates Wallet

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/v1/wallets
                              │ Body: { walletName: "My USD Wallet", initialBalance: { amount: 10000, currency: "USD" } }
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                                │
│  wallet_v2.go: CreateWallet()                                   │
│  - Validates request                                            │
│  - Checks wallet type                                           │
│  - Passes to service                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                               │
│  wallet_service.go: CreateWallet()                              │
│  - Validates user exists                                         │
│  - Creates wallet with ORIGINAL currency                        │
│  - Gets user's preferred currency                                │
│  - Converts initial balance if needed                           │
│  - Populates Redis cache                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────────┴──────────────┐
                    ▼                            ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│      MYSQL DATABASE       │    │         REDIS                 │
│  wallet table             │    │  Currency Cache                │
│  ┌─────────────────────┐ │    │  Key: user:123:entity:wallet:1:VND│
│  │ id: 1                │ │    │  Value: 250000000               │
│  │ user_id: 123         │ │    │  TTL: 24 hours                  │
│  │ wallet_name: "USD..."│ │    │                                 │
│  │ balance: 10000       │ │    │  (100 USD converted to VND)      │
│  │ currency: "USD"      │◄─┼────┤  Set after creation              │
│  │ type: 2              │ │    │                                 │
│  └─────────────────────┘ │    └──────────────────────────────────┘
└──────────────────────────┘
```

### Step-by-Step Details

#### 1. Frontend Request

```typescript
// POST /api/v1/wallets
{
  "walletName": "My USD Wallet",
  "initialBalance": {
    "amount": 10000,      // $100.00 in cents
    "currency": "USD"
  },
  "type": "BASIC"
}
```

#### 2. API Handler

```go
// api/handlers/wallet_v2.go
func (h *WalletHandler) CreateWallet(c *gin.Context) {
    var req CreateWalletRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    userID := auth.GetUserID(c)
    wallet, err := h.walletSvc.CreateWallet(c, userID, &req)

    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }

    c.JSON(200, gin.H{
        "success": true,
        "data": wallet.ToProtoWithConversion(),
    })
}
```

#### 3. Service Layer

```go
// domain/service/wallet_service.go
func (s *walletService) CreateWallet(ctx context.Context, userID int32, req *CreateWalletRequest) (*models.Wallet, error) {
    // 1. Validate user exists
    user, err := s.userRepo.GetByID(ctx, userID)
    if err != nil {
        return nil, err
    }

    // 2. Create wallet with ORIGINAL currency (from request)
    wallet := &models.Wallet{
        UserID:     userID,
        WalletName:  req.WalletName,
        Balance:     req.InitialBalance.Amount,
        Currency:    req.InitialBalance.Currency, // "USD"
        Type:        req.Type,
    }

    if err := s.walletRepo.Create(ctx, wallet); err != nil {
        return nil, err
    }

    // 3. Get user's preferred currency
    userCurrency := user.PreferredCurrency // "VND"

    // 4. Convert initial balance if different from wallet currency
    convertedBalance := wallet.Balance
    if wallet.Currency != userCurrency {
        rate, err := s.fxRateSvc.GetRate(ctx, wallet.Currency, userCurrency)
        if err != nil {
            log.Printf("Failed to get FX rate: %v", err)
            // Continue without conversion - will be cached later
        } else {
            convertedBalance = s.converter.ConvertAmount(wallet.Balance, rate)
        }
    }

    // 5. Populate Redis cache with converted value
    s.currencyCache.SetConvertedValue(ctx, userID, "wallet", wallet.ID, userCurrency, convertedBalance)

    return wallet, nil
}
```

#### 4. Database Storage

**MySQL - wallet table:**
```sql
INSERT INTO wallet (user_id, wallet_name, balance, currency, type)
VALUES (123, "My USD Wallet", 10000, "USD", 2);
```

**Redis - currency cache:**
```
SET user:123:entity:wallet:1:VND 250000000 EX 86400
```

#### 5. Response to Frontend

```json
{
  "success": true,
  "data": {
    "id": 1,
    "walletName": "My USD Wallet",
    "originalBalance": 10000,
    "originalCurrency": "USD",
    "displayBalance": 250000000,
    "displayCurrency": "VND"
  }
}
```

---

## User Views Dashboard

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  Dashboard Page Loads                                             │
│  - Gets user's preferred currency from Redux                     │
│  - Fetches wallet, transaction, investment data                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌───────────┴───────────────┐
                    ▼                           ▼
         GET /api/v1/wallets              GET /api/v1/transactions
                    │                           │
                    ▼                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                               │
│  wallet_service.go: ListWalletsForUser()                        │
│  transaction_service.go: ListTransactionsForUser()              │
│                                                                  │
│  For each service:                                               │
│  1. Get user's preferred currency                                │
│  2. Check if conversion_in_progress (skip if true)               │
│  3. Get entities from database                                    │
│  4. Try Redis cache (batch get)                                  │
│  5. Convert missing items                                        │
│  6. Return converted values                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌───────────┴───────────────┐
                    ▼                           ▼
         REDIS (Cache Check)          MySQL (Original Data)
                    │                           │
                    │  Cache Miss?               │
                    ▼                           │
         FX Rate Service (Get USD→VND)         │
                    │                           │
                    ▼                           │
         Convert Amounts                      │
                    │                           │
                    ▼                           │
         REDIS (Cache Miss → Cache Hit)         │
                    │                           │
                    └───────────┬───────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RESPONSE                                   │
│  {                                                              │
│    wallets: [                                                  │
│      {                                                           │
│        id: 1,                                                   │
│        originalBalance: 10000,  // $100 USD                    │
│        originalCurrency: "USD",                                 │
│        displayBalance: 250000000, // ₫250,000 VND              │
│        displayCurrency: "VND"                                   │
│      }                                                           │
│    ]                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Details

#### 1. Service Layer - Wallet List

```go
// domain/service/wallet_service.go
func (s *walletService) ListWalletsForUser(ctx context.Context, userID int32) ([]*WalletWithConversion, error) {
    // 1. Get user's preferred currency
    user, err := s.userRepo.GetByID(ctx, userID)
    if err != nil {
        return nil, err
    }
    userCurrency := user.PreferredCurrency // "VND"

    // 2. Check if conversion is in progress
    if user.ConversionInProgress {
        // Return original values with indicator
        return s.getOriginalWallets(ctx, userID)
    }

    // 3. Get wallets from database
    wallets, err := s.walletRepo.ListByUserID(ctx, userID)
    if err != nil {
        return nil, err
    }

    // 4. Try to get from Redis cache (batch)
    entityIDs := make([]int64, len(wallets))
    for i, w := range wallets {
        entityIDs[i] = int64(w.ID)
    }

    cached, err := s.currencyCache.GetMultiConvertedValues(
        ctx, userID, "wallet", entityIDs, userCurrency,
    )

    // 5. Build results and identify missing cache entries
    results := make([]*WalletWithConversion, len(wallets))
    missing := []currency.MonetaryEntity{}

    for i, wallet := range wallets {
        convertedValue, found := cached[int64(wallet.ID)]

        if !found {
            // Not in cache - need to convert
            missing = append(missing, currency.MonetaryEntity{
                ID:       int64(wallet.ID),
                Amount:   wallet.Balance,
                Currency: wallet.Currency, // "USD"
            })
        }

        results[i] = &WalletWithConversion{
            Wallet:           wallet,
            OriginalBalance:  wallet.Balance,
            OriginalCurrency: wallet.Currency,
            ConvertedBalance: convertedValue,
            DisplayCurrency:  userCurrency,
        }
    }

    // 6. Convert missing items and cache them
    if len(missing) > 0 {
        // Batch convert all missing items
        converted, err := s.converter.ConvertBatch(ctx, missing, userCurrency)
        if err != nil {
            log.Printf("Failed to convert some wallets: %v", err)
        } else {
            // Update results
            for i, wallet := range wallets {
                if val, ok := converted[int64(wallet.ID)]; ok {
                    results[i].ConvertedBalance = val

                    // Cache for next time
                    s.currencyCache.SetConvertedValue(
                        ctx, userID, "wallet", int64(wallet.ID), userCurrency, val,
                    )
                }
            }
        }
    }

    return results, nil
}
```

#### 2. Redis Cache Operations

**Cache Check (Batch):**
```bash
# Redis MGET for all wallet IDs in one call
MGET user:123:entity:wallet:1:VND user:123:entity:wallet:2:VND

# Returns (example with partial cache hit):
# 1) "250000000"  <- cache hit
# 2) (nil)        <- cache miss, need to convert
```

**Cache Miss → FX Rate Service:**
```go
// pkg/fx/yahoo_provider.go
func (p *YahooProvider) GetRate(ctx context.Context, from, to string) (float64, error) {
    // Construct FX pair symbol
    symbol := fmt.Sprintf("%s%s=X", from, to) // "USDX=X"

    // Check Redis cache first
    cached, err := p.redis.Get(ctx, fmt.Sprintf("fx:%s:%s", from, to)).Float64()
    if err == nil {
        return cached, nil // Cache hit
    }

    // Fetch from Yahoo Finance
    quote, err := yahoo.GetQuote(ctx, symbol)
    if err != nil {
        return 0, err
    }

    // Validate rate
    if err := p.validator.ValidateRate(from, to, quote.RegularMarketPrice); err != nil {
        return 0, err
    }

    // Cache in Redis (15 min TTL)
    p.redis.Set(ctx, fmt.Sprintf("fx:%s:%s", from, to), quote.RegularMarketPrice, 15*time.Minute)

    return quote.RegularMarketPrice, nil
}
```

**Cache Population:**
```bash
# After conversion, set in Redis
SET user:123:entity:wallet:2:VND 5000000 EX 86400
```

#### 3. Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "walletName": "My USD Wallet",
      "originalBalance": 10000,
      "originalCurrency": "USD",
      "displayBalance": 250000000,
      "displayCurrency": "VND"
    },
    {
      "id": 2,
      "walletName": "My VND Wallet",
      "originalBalance": 5000000,
      "originalCurrency": "VND",
      "displayBalance": 5000000,
      "displayCurrency": "VND"
    }
  ]
}
```

---

## User Changes Currency

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  1. User clicks currency selector                                │
│  2. Selects new currency (USD → VND)                             │
│  3. Confirmation dialog appears                                    │
│  4. User confirms                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ PUT /api/v1/users/preferences
                              │ Body: { preferences: { preferredCurrency: "VND" } }
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                                │
│  user.go: UpdatePreferences()                                    │
│  - Validates currency is supported                               │
│  - Passes to service                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                               │
│  user_service.go: UpdateUserPreferences()                       │
│  1. Validates currency whitelist                                   │
│  2. Updates user.preferred_currency in database                  │
│  3. Sets user.conversion_in_progress = TRUE                       │
│  4. Deletes old Redis cache for user                             │
│  5. Spawns background job for conversion                         │
│  6. Returns immediately (async processing)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────────┴──────────────┐
                    ▼                            ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│      MYSQL DATABASE       │    │         REDIS                 │
│  UPDATE user SET            │    │  DELETE user:123:*            │
│    preferred_currency = 'VND'│    │  (Clear old cache)              │
│  WHERE id = 123              │    │                                 │
│                            │    │                                 │
│  UPDATE user SET            │    └──────────────────────────────────┘
│    conversion_in_progress = 1│
│  WHERE id = 123              │
│                            │
└──────────────────────────┘
                              │
                    ┌───────────┴──────────────────┐
                    ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BACKGROUND JOB (Goroutine)                      │
│  convertUserCurrency(userID=123, from="USD", to="VND")          │
│                                                                  │
│  Phase 1: Count total entities                                   │
│    - SELECT COUNT(*) FROM wallet WHERE user_id = 123            │
│    - SELECT COUNT(*) FROM transaction WHERE user_id = 123       │
│    - SELECT COUNT(*) FROM investment WHERE user_id = 123        │
│    - total = 150                                                │
│                                                                  │
│  Phase 2: Convert wallets (batch size: 100)                     │
│    FOR offset = 0; offset < total; offset += 100                   │
│      - Get batch of wallets                                      │
│      - Group by original currency                                │
│      - Fetch FX rates in parallel                                │
│      - Convert amounts                                           │
│      - Store in Redis cache                                      │
│      - Update progress table                                     │
│    END FOR                                                        │
│                                                                  │
│  Phase 3: Convert transactions (same batch process)              │
│  Phase 4: Convert investments                                    │
│  Phase 5: Convert investment lots                                │
│  Phase 6: Mark conversion complete                               │
│    - UPDATE user SET conversion_in_progress = 0                  │
│    - DELETE FROM currency_conversion_progress                     │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Details

#### 1. Frontend Confirmation

```typescript
// components/CurrencySelector.tsx
const handleConfirm = async () => {
  setShowConfirmation(false);
  setIsConverting(true);

  try {
    await updatePrefs.mutateAsync({
      preferences: { preferredCurrency: "VND" }
    });

    // Show loading state
    toast.success("Currency changed to VND. Converting your data...");

    // Start polling for progress
    startPolling();

  } catch (error) {
    toast.error("Failed to change currency. Please try again.");
    setIsConverting(false);
  }
};
```

#### 2. Backend Service

```go
// domain/service/user_service.go
func (s *userService) UpdateUserPreferences(ctx context.Context, userID int32, prefs *UserPreferences) error {
    // 1. Validate currency is supported
    if !currency.SupportedCurrencies[prefs.PreferredCurrency] {
        return apperrors.NewValidationError("unsupported currency: " + prefs.PreferredCurrency)
    }

    // 2. Get current user state
    user, err := s.userRepo.GetByID(ctx, userID)
    if err != nil {
        return err
    }

    oldCurrency := user.PreferredCurrency
    newCurrency := prefs.PreferredCurrency

    // Skip if same currency
    if oldCurrency == newCurrency {
        return nil
    }

    // 3. Update user preference
    user.PreferredCurrency = newCurrency
    if err := s.userRepo.Update(ctx, user); err != nil {
        return err
    }

    // 4. Set conversion in progress flag
    user.ConversionInProgress = true
    s.userRepo.Update(ctx, user)

    // 5. Delete old Redis cache
    s.currencyCache.DeleteUserCache(ctx, userID)

    // 6. Spawn background conversion (non-blocking)
    go s.convertUserCurrency(context.Background(), userID, oldCurrency, newCurrency)

    return nil
}
```

#### 3. Background Conversion

```go
// domain/service/user_service.go
func (s *userService) convertUserCurrency(ctx context.Context, userID int32, fromCurrency, toCurrency string) error {
    log.Printf("Starting currency conversion for user %d: %s → %s", userID, fromCurrency, toCurrency)

    // Phase 1: Count total entities
    walletCount := s.countWallets(ctx, userID)
    txCount := s.countTransactions(ctx, userID)
    investmentCount := s.countInvestments(ctx, userID)
    lotCount := s.countInvestmentLots(ctx, userID)

    totalEntities := walletCount + txCount + investmentCount + lotCount

    // Initialize progress tracking
    progress := &models.ConversionProgress{
        UserID:           userID,
        FromCurrency:     fromCurrency,
        ToCurrency:       toCurrency,
        Status:           "in_progress",
        TotalEntities:    totalEntities,
        ProcessedEntities: 0,
        CurrentStep:      "Initializing...",
        StartedAt:        time.Now(),
    }
    s.progressRepo.Create(ctx, progress)

    processed := int32(0)

    // Phase 2: Convert wallets (batch processing)
    progress.CurrentStep = "Converting wallets..."
    s.progressRepo.Update(ctx, progress)

    s.convertWalletsBatch(ctx, userID, toCurrency, &processed, progress)

    // Phase 3: Convert transactions
    progress.CurrentStep = "Converting transactions..."
    s.progressRepo.Update(ctx, progress)

    s.convertTransactionsBatch(ctx, userID, toCurrency, &processed, progress)

    // Phase 4: Convert investments
    progress.CurrentStep = "Converting investments..."
    s.progressRepo.Update(ctx, progress)

    s.convertInvestmentsBatch(ctx, userID, toCurrency, &processed, progress)

    // Phase 5: Convert investment lots
    progress.CurrentStep = "Converting investment lots..."
    s.progressRepo.Update(ctx, progress)

    s.convertInvestmentLotsBatch(ctx, userID, toCurrency, &processed, progress)

    // Phase 6: Mark complete
    progress.Status = "completed"
    progress.CurrentStep = "Conversion complete!"
    progress.ProcessedEntities = processed
    completedAt := time.Now()
    progress.CompletedAt = &completedAt
    s.progressRepo.Update(ctx, progress)

    // Clear conversion in progress flag
    user, _ := s.userRepo.GetByID(ctx, userID)
    user.ConversionInProgress = false
    s.userRepo.Update(ctx, user)

    log.Printf("Completed currency conversion for user %d in %v",
        userID, completedAt.Sub(progress.StartedAt))

    return nil
}
```

#### 4. Batch Conversion (Wallets Example)

```go
func (s *userService) convertWalletsBatch(ctx context.Context, userID int32, toCurrency string, processed *int32, progress *models.ConversionProgress) error {
    const batchSize = 100
    offset := 0

    for {
        // Get batch of wallets
        wallets, err := s.walletRepo.ListByUserIDBatch(ctx, userID, batchSize, offset)
        if err != nil {
            log.Printf("Failed to get wallet batch: %v", err)
            break
        }

        if len(wallets) == 0 {
            break // Done
        }

        // Group by original currency
        grouped := make(map[string][]*models.Wallet)
        for _, w := range wallets {
            grouped[w.Currency] = append(grouped[w.Currency], w)
        }

        // Fetch FX rates in parallel
        rates := make(map[string]float64)
        var mu sync.Mutex
        var wg sync.WaitGroup

        for fromCurrency := range grouped {
            if fromCurrency == toCurrency {
                rates[fromCurrency] = 1.0
                continue
            }

            wg.Add(1)
            go func(from string) {
                defer wg.Done()

                rate, err := s.fxRateSvc.GetRate(ctx, from, toCurrency)
                if err != nil {
                    log.Printf("Failed to get rate %s→%s: %v", from, toCurrency, err)
                    return
                }

                mu.Lock()
                rates[from] = rate
                mu.Unlock()
            }(fromCurrency)
        }

        wg.Wait()

        // Convert and cache each wallet
        for _, wallet := range wallets {
            rate := rates[wallet.Currency]
            converted := int64(float64(wallet.Balance) * rate)

            // Cache in Redis
            s.currencyCache.SetConvertedValue(
                ctx, userID, "wallet", wallet.ID, toCurrency, converted,
            )

            // Update progress
            *processed++
            progress.ProcessedEntities = *processed
            s.progressRepo.Update(ctx, progress)
        }

        offset += batchSize
    }

    return nil
}
```

#### 5. Database Changes During Conversion

**Progress Tracking:**
```sql
-- Initial
INSERT INTO currency_conversion_progress (user_id, from_currency, to_currency, status, total_entities, processed_entities, current_step, started_at)
VALUES (123, 'USD', 'VND', 'in_progress', 150, 0, 'Initializing...', NOW());

-- During wallet conversion
UPDATE currency_conversion_progress
SET processed_entities = 5, current_step = 'Converting wallets...'
WHERE user_id = 123;

-- During transaction conversion
UPDATE currency_conversion_progress
SET processed_entities = 55, current_step = 'Converting transactions...'
WHERE user_id = 123;

-- Final
UPDATE currency_conversion_progress
SET status = 'completed', processed_entities = 150, current_step = 'Conversion complete!', completed_at = NOW()
WHERE user_id = 123;

-- Cleanup conversion flag
UPDATE user
SET conversion_in_progress = 0
WHERE id = 123;

DELETE FROM currency_conversion_progress WHERE user_id = 123;
```

**Redis Cache Population:**
```bash
# Batch 1: Wallets
SET user:123:entity:wallet:1:VND 250000000 EX 86400
SET user:123:entity:wallet:2:VND 5000000 EX 86400
SET user:123:entity:wallet:3:VND 15000000 EX 86400

# Batch 2: Transactions
SET user:123:entity:transaction:456:VND 250000 EX 86400
SET user:123:entity:transaction:457:VND 500000 EX 86400
...

# Batch 3: Investments
SET user:123:entity:investment:789:VND 50000000 EX 86400
...

# Batch 4: Investment Lots
SET user:123:entity:investment_lot:101:VND 30000000 EX 86400
...
```

---

## Investment Creation with Currency Selection

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  CreateInvestmentForm Component                                 │
│  1. User enters symbol: "AAPL"                                   │
│  2. User selects currency from dropdown: "USD"                    │
│  3. User enters quantity and cost                                 │
│  4. Submits form                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/v1/investments
                              │ Body: {
                              │   walletId: 1,                                                 │
                              │   symbol: "AAPL",                                              │
                              │   currency: "USD",  <-- User selected                         │
                              │   initialQuantity: 100,                                        │
                              │   initialCost: 1500000,                                       │
                              │ }                                                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                                │
│  investment.go: CreateInvestment()                               │
│  - Validates request                                              │
│  - Passes to service                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                               │
│  investment_service.go: CreateInvestment()                      │
│  1. Get market data from Yahoo to verify symbol                 │
│  2. Extract ACTUAL currency from market data                     │
│  3. Log if different from user selection                           │
│  4. Create investment with MARKET DATA currency                   │
│  5. Create initial investment lot (FIFO)                         │
│  6. Cache converted value for user                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────────┴──────────────┐
                    ▼                            ▼
         YAHOO FINANCE API           MYSQL DATABASE
│  GetQuote("AAPL")            │  investment table
│  Returns:                   │  ┌─────────────────────┐
│  {                            │  │ id: 1                  │
│    symbol: "AAPL",           │  │ wallet_id: 1           │
│    regularMarketPrice: 150.25│  │ symbol: "AAPL"          │
│    currency: "USD",  ◄────────┼──┤ currency: "USD"        │ <-- Uses Yahoo's currency
│    priceHint: 2              │  │ quantity: 10000         │
│  }                           │  │ average_cost: 15000     │
│                             │  └─────────────────────┘
└─────────────────────────────┘
                              │
                              ▼
                    REDIS (Cache)
│  user:123:entity:investment:1:VND = 37537500
│  (100 shares * $150.25 * 25000 = ₫37,537,500)
```

### Step-by-Step Details

#### 1. Frontend Form with Currency Selector

```typescript
// app/dashboard/portfolio/modals/forms/CreateInvestmentForm.tsx
export function CreateInvestmentForm({ onSuccess }: CreateInvestmentFormProps) {
  const { currency } = useCurrency(); // User's display currency

  const [formData, setFormData] = useState({
    walletId: 0,
    symbol: "",
    currency: "USD", // User can select
    initialQuantity: 0,
    initialCost: 0,
  });

  const createMutation = useMutationCreateInvestment({
    onSuccess: (data) => {
      setShowSuccess(true);
      onSuccess?.();
    },
    });

  return (
    <form onSubmit={handleSubmit(createMutation.mutate)}>
      {/* Symbol Input */}
      <SymbolAutocomplete
        value={formData.symbol}
        onChange={(val) => setFormData({...formData, symbol: val})}
      />

      {/* Currency Selector - NEW! */}
      <CurrencySelect
        value={formData.currency}
        onChange={(val) => setFormData({...formData, currency: val})}
      />

      {/* Quantity Input */}
      <FormInput
        type="number"
        label="Quantity"
        value={formData.initialQuantity}
        onChange={(e) => setFormData({...formData, initialQuantity: parseInt(e.target.value)})}
      />

      {/* Cost Input */}
      <FormInput
        type="number"
        label="Total Cost (cents)"
        value={formData.initialCost}
        onChange={(e) => setFormData({...formData, initialCost: parseInt(e.target.value)})}
      />

      <Button type="submit" loading={createMutation.isPending}>
        Add Investment
      </Button>
    </form>
  );
}
```

#### 2. Backend Currency Validation

```go
// domain/service/investment_service.go
func (s *investmentService) CreateInvestment(ctx context.Context, req *CreateInvestmentRequest) (*models.Investment, error) {
    // 1. Verify wallet exists and user owns it
    wallet, err := s.walletRepo.GetByID(ctx, req.WalletId)
    if err != nil {
        return nil, err
    }

    // 2. Get market data from Yahoo to verify symbol and get ACTUAL currency
    marketData, err := s.marketDataSvc.GetPrice(ctx, req.Symbol, req.Currency, 15*time.Minute)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch market data for %s: %w", req.Symbol, err)
    }

    // 3. Extract actual currency from market data
    actualCurrency := marketData.Currency

    // 4. Log if different from user selection
    if actualCurrency != req.Currency {
        log.Printf("Currency mismatch for %s: user selected %s but market data is %s. Using market data currency.",
            req.Symbol, req.Currency, actualCurrency)
    }

    // 5. Create investment with MARKET DATA currency (not user's selection)
    investment := &models.Investment{
        WalletID:     req.WalletId,
        Symbol:       req.Symbol,
        Name:         marketData.MarketName, // From Yahoo if available
        Type:         req.Type,
        Quantity:     req.InitialQuantity,
        AverageCost:  req.InitialCost / req.InitialQuantity,
        TotalCost:    req.InitialCost,
        Currency:     actualCurrency, // Use Yahoo's currency!
        CurrentPrice: marketData.Price,
        CurrentValue: calculateCurrentValue(req.InitialQuantity, marketData.Price),
    }

    // 6. Save to database
    if err := s.investmentRepo.Create(ctx, investment); err != nil {
        return nil, err
    }

    // 7. Create initial investment lot (FIFO)
    lot := &models.InvestmentLot{
        InvestmentID: investment.ID,
        WalletID:     req.WalletId,
        Quantity:     req.InitialQuantity,
        AverageCost:  investment.AverageCost,
        TotalCost:    req.InitialCost,
        Currency:     actualCurrency, // Match investment currency
    }

    if err := s.lotRepo.Create(ctx, lot); err != nil {
        return nil, err
    }

    // 8. Cache converted value for user
    user, _ := s.userRepo.GetByID(ctx, wallet.UserID)
    userCurrency := user.PreferredCurrency

    if actualCurrency != userCurrency {
        rate, _ := s.fxRateSvc.GetRate(ctx, actualCurrency, userCurrency)
        convertedValue := s.converter.ConvertAmount(investment.CurrentValue, rate)

        s.currencyCache.SetConvertedValue(
            ctx, wallet.UserID, "investment", investment.ID, userCurrency, convertedValue,
        )
    }

    return investment, nil
}
```

#### 3. Yahoo Finance API Call

```go
// pkg/yahoo/quote.go
func GetQuote(ctx context.Context, symbol string) (*QuoteResult, error) {
    // ... API call to Yahoo Finance ...

    // Returns:
    // &QuoteResult{
    //     Symbol: "AAPL",
    //     Currency: "USD",  <-- This is the authoritative currency
    //     RegularMarketPrice: 150.25,
    //     PriceHint: 2,
    //     // ...
    // }
}
```

#### 4. Database Storage

**investment table:**
```sql
INSERT INTO investment (
    wallet_id, symbol, name, type,
    quantity, average_cost, total_cost,
    currency,  -- "USD" from Yahoo Finance
    current_price, current_value
) VALUES (
    1, 'AAPL', 'Apple Inc.', 2,
    10000, 1500, 1500000,
    'USD',     -- Uses Yahoo's currency, not user's selection
    15025, 1502500
);
```

**investment_lot table:**
```sql
INSERT INTO investment_lot (
    investment_id, wallet_id,
    quantity, average_cost, total_cost,
    currency  -- "USD" (matches investment)
) VALUES (
    1, 1,
    10000, 1500, 1500000,
    'USD'
);
```

#### 5. Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "walletId": 1,
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "type": 2,
    "quantity": 10000,
    "averageCost": 1500,
    "totalCost": 1500000,
    "currency": "USD",  // From Yahoo Finance
    "currentPrice": 15025,
    "currentValue": 1502500,
    "unrealizedPnl": 2500,
    "originalCurrency": "USD",
    "originalPrice": 15025,
    "displayCurrency": "VND",  // User's preferred currency
    "displayPrice": 375625000,
    "displayValue": 375625000
  }
}
```

---

## FX Rate Fetching

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST FOR CONVERSION                       │
│  Converter needs to convert $100 USD to VND                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FXRateService.GetRate()                       │
│  1. Check Redis cache for FX rate                                │
│     Key: "fx:USD:VND"                                            │
│  2. If cache hit → return cached rate                            │
│  3. If cache miss → fetch from Yahoo Finance                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────────┴──────────────┐
                    ▼                            ▼
         REDIS (FX Rate Cache)    YAHOO FINANCE API
│  GET fx:USD:VND          │  GetQuote("USDX=X")
│  Returns: 25000          │  Returns: {
│  (cache hit)             │    regularMarketPrice: 25000,
│                         │    currency: "USD",
│                         │  }
│                         │
└─────────────────────────┴──────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VALIDATION LAYER                            │
│  validateRate("USD", "VND", 25000)                             │
│  - Checks if rate is within reasonable range                    │
│  - USD→VND: must be between 20,000 and 30,000                    │
│  - If invalid: return error                                     │
│  - If valid: continue                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CACHE & RETURN                              │
│  SET fx:USD:VND 25000 EX 900  (15 min TTL)                     │
│  Return 25000 to caller                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Code Implementation

```go
// domain/service/fx_rate_service.go
func (s *fxRateService) GetRate(ctx context.Context, fromCurrency, toCurrency string) (float64, error) {
    // 1. Same currency check
    if fromCurrency == toCurrency {
        return 1.0, nil
    }

    // 2. Check Redis cache
    cacheKey := fmt.Sprintf("fx:%s:%s", fromCurrency, toCurrency)
    cached, err := s.redis.Get(ctx, cacheKey).Float64()
    if err == nil {
        // Cache hit
        s.metrics.CacheHit()
        return cached, nil
    }

    s.metrics.CacheMiss()

    // 3. Fetch from Yahoo Finance
    rate, err := s.fxProvider.GetRate(ctx, fromCurrency, toCurrency)
    if err != nil {
        // Try fallback to stale cache
        if cached, err := s.getStaleRate(ctx, fromCurrency, toCurrency); err == nil {
            log.Printf("FX API failed, using stale rate: %v", err)
            return cached, nil
        }
        return 0, err
    }

    // 4. Validate rate
    if err := s.validator.ValidateRate(fromCurrency, toCurrency, rate); err != nil {
        return 0, err
    }

    // 5. Cache in Redis (15 min TTL)
    s.redis.Set(ctx, cacheKey, rate, 15*time.Minute)

    s.metrics.Success()

    return rate, nil
}
```

### Yahoo Finance FX Provider

```go
// pkg/fx/yahoo_provider.go
func (p *YahooProvider) GetRate(ctx context.Context, from, to string) (float64, error) {
    // Construct FX pair symbol
    symbol := fmt.Sprintf("%s%s=X", from, to) // "USDX=X"

    // Get quote from Yahoo Finance
    quote, err := yahoo.GetQuote(ctx, symbol)
    if err != nil {
        return 0, err
    }

    // Extract rate
    rate := quote.RegularMarketPrice

    return rate, nil
}
```

### FX Rate Validation

```go
// pkg/fx/validator.go
func (v *FXValidator) ValidateRate(from, to string, rate float64) error {
    // Define reasonable ranges for common pairs
    ranges := map[string]struct{ min, max float64}{
        "USD:VND": {20000, 30000},
        "VND:USD": {0.000033, 0.00005},
        "EUR:USD": {1.0, 1.3},
        "USD:EUR": {0.7, 1.0},
        "GBP:USD": {1.2, 1.6},
        "USD:GBP": {0.6, 0.85},
        "USD:JPY": {140, 160},
        "JPY:USD": {0.006, 0.007},
    }

    key := fmt.Sprintf("%s:%s", from, to)
    if r, ok := ranges[key]; ok {
        if rate < r.min || rate > r.max {
            return fmt.Errorf("FX rate %s out of range: %f (expected %f-%f)",
                key, rate, r.min, r.max)
        }
    }

    // Additional sanity checks
    if rate <= 0 {
        return fmt.Errorf("FX rate must be positive, got: %f", rate)
    }
    if rate > 1000000 {
        return fmt.Errorf("FX rate suspiciously high: %f", rate)
    }

    return nil
}
```

---

## Cache Operations

### Redis Key Patterns

``┌─────────────────────────────────────────────────────────────────┐
│                      CURRENCY CACHE KEYS                          │
├─────────────────────────────────────────────────────────────────┤
│  Pattern: user:{userID}:entity:{type}:{id}:{currency}             │
│                                                                  │
│  Examples:                                                        │
│  - user:123:entity:wallet:1:VND = 250000000                       │
│  - user:123:entity:wallet:1:USD = 10000                          │
│  - user:123:entity:transaction:456:VND = 500000                     │
│  - user:123:entity:investment:789:VND = 375625000                   │
│  - user:123:entity:investment_lot:101:VND = 30000000                 │
│                                                                  │
│  TTL: 24 hours                                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      FX RATE CACHE KEYS                            │
├─────────────────────────────────────────────────────────────────┤
│  Pattern: fx:{fromCurrency}:{toCurrency}                          │
│                                                                  │
│  Examples:                                                        │
│  - fx:USD:VND = 25000                                            │
│  - fx:VND:USD = 0.00004                                          │
│  - fx:EUR:USD = 1.08                                             │
│                                                                  │
│  TTL: 15 minutes                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Cache Miss Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST: Get Wallet 1 for User 123              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    GET user:123:entity:wallet:1:VND
                              │
                    ┌─────────┴─────────┐
                    │                   │
                  MISS                   HIT (return value)
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONVERSION FLOW                             │
│  1. Get wallet from database (original currency: USD)            │
│  2. Get FX rate: USD → VND                                    │
│  3. Convert: 10000 * 25000 = 250000000                          │
│  4. Cache result: SET user:123:entity:wallet:1:VND 250000000    │
│  5. Return converted value                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Cache Invalidation

```
┌─────────────────────────────────────────────────────────────────┐
│              EVENT: User Changes Currency (USD → VND)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    DELETE user:123:*
                    (Remove all old cache entries)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKGROUND: Re-populate cache                        │
│  - Convert all wallets to VND                                   │
│  - Convert all transactions to VND                                │
│  - Convert all investments to VND                                │
│  - Convert all investment lots to VND                            │
│  - Set new cache entries with VND values                         │
└─────────────────────────────────────────────────────────────────┘
```

### Cache Warming Strategies

**1. Lazy Caching (Default):**
- Cache populated on first access
- Trade-off: Slightly slower first request, faster subsequent requests

**2. Pre-warming (After Currency Change):**
- All entities converted and cached in background
- Trade-off: Faster first request, slower currency change

**3. Hybrid (Recommended):**
- Pre-warm after currency change
- Cache new entities immediately on creation
- Lazy cache for cache misses (should be rare)

---

## Summary of Data Flows

| Flow | Key Operations | Cache Strategy | Performance |
|------|----------------|-----------------|-------------|
| **Create Wallet** | 1 DB write, 1 FX rate fetch, 1 Redis write | Immediate cache | ~50ms |
| **View Dashboard** | N cache reads, M cache misses → N FX rate fetches | Lazy + pre-warm | ~20ms (cached), ~100ms (miss) |
| **Change Currency** | 1 DB update, 1 Redis delete, Background job: M conversions | Full re-cache | ~200ms (API), 2-5min (background) |
| **Create Investment** | 1 Yahoo API call, 1 DB write, 1 FX rate fetch, 1 Redis write | Market data currency | ~100ms |
| **FX Rate Fetch** | 1 Redis read, 1 Yahoo API call (if miss), 1 validation, 1 Redis write | 15 min TTL | ~1ms (hit), ~500ms (miss) |

**Performance Notes:**
- Cache hit rate should be >95% after warmup
- Batch operations minimize FX rate API calls
- Redis provides ~1ms read times vs 50ms for MySQL
- Background processing prevents blocking user actions

---

**Document Version:** 1.0
**Last Updated:** 2025-01-28
**Author:** Claude (with user input)
