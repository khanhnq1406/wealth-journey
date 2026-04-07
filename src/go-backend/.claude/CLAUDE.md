# Go Backend Guide

## Structure

```
go-backend/
├── internal/
│   ├── app/           # app.go (lifecycle), providers.go (manual DI)
│   └── scheduler/     # Background jobs
├── domain/
│   ├── models/        # GORM models
│   ├── repository/    # Data access (interfaces + impl)
│   ├── service/       # Business logic
│   ├── auth/          # Auth service
│   ├── grpcserver/    # gRPC implementations
│   └── gateway/       # gRPC-Gateway proxy
├── handlers/          # REST handlers + builder.go + routes.go
├── pkg/               # Shared: yahoo, gold, silver, cache, config, price clients
└── cmd/               # main.go, migrate-*/
```

## Architecture Rules (ADR-001, ADR-002)

- **Manual DI**: wire providers in `internal/app/providers.go` — no Google Wire
- **Constructor injection**: all deps passed upfront, no `Set*()` methods
- **Wire new handlers**: add to `AllHandlers` struct + `NewHandlers()` in `handlers/builder.go`, register routes in `handlers/routes.go`
- **Depguard**: domain/service layer cannot import `gorm.io/gorm`, `go-redis`, `gin-gonic/gin` — violations fail lint

## Adding a Feature

1. Edit `.proto` in `api/protobuf/v1/` → `task proto:all`
2. Add method to `domain/service/interfaces.go`
3. Implement in `domain/service/<name>_service.go`
4. Add handler in `handlers/<name>.go`
5. Wire in `handlers/builder.go` → register in `handlers/routes.go`

## Key Files

| File | Purpose |
|------|---------|
| `internal/app/providers.go` | DI wiring |
| `handlers/builder.go` | Handler struct + constructor |
| `handlers/routes.go` | Route registration |
| `domain/service/interfaces.go` | Service interfaces |

## Background Scheduler (`internal/scheduler/`)

| Job | Interval | Purpose |
|-----|----------|---------|
| `price_cache_job.go` | 15m (10s delay) | Refresh asset prices to DB |
| `price_update_job.go` | 15m | Market price refresh |
| `portfolio_snapshot_job.go` | 1h | Portfolio history |
| `user_price_alert_job.go` | scheduled | Evaluate user price alerts |
| `session_cleanup_adapter.go` | 6h | Expire sessions |
| `file_cleanup_job.go` | 1h | Orphaned uploads |
| `db_keepalive_job.go` | 2m | Connection keepalive |

## Asset Price Cache (Non-Obvious)

**Pattern**: background-job-driven DB cache — HTTP handlers NEVER call external APIs directly.

1. `PriceCacheJob` → `AssetPriceService.RefreshAllPrices()` every 15m
2. 10 parallel goroutines: 6 gold (VangSaiGon, VangToday, SJC, DOJI, BTMC, PNJ), 1 silver, 3 currency
3. On failure: `MarkStaleByAssetTypeAndSource(ctx, assetType, source)` — only that source goes stale
4. `GetMarketPrices` / `GetPublicMarketTypes` read from DB; return empty arrays (not error) on cold start
5. Frontend shows `"--"` when `buy/sell === 0` OR `isStale === true`

**Currency source gotcha — Vietcombank `_VCB` suffix:**
- `vangsaigon` / `vangtoday` TypeCodes: `"USD"`, `"EUR"` (free-market)
- `vietcombank` TypeCodes: `"USD_VCB"`, `"EUR_VCB"` — suffix avoids collision in `(type_code, currency, source)` unique index
- Feature flag: `VIETCOMBANK_FX_ENABLED=false` disables it (default: enabled)

## Asset Display Config (ResolvePrice Algorithm)

For each display config, picks best price from DB fetch codes (ordered by `priority` ASC):
1. If no fetch codes → error (fallback to live API)
2. If no asset_price rows → error (fallback on cold start)
3. Skip fetch codes with no matching price row
4. Return first **non-stale** price; track `freshestStale` as backup
5. All stale → return `freshestStale` with `isStale=true`

**Public endpoint**: `GET /api/v1/public/asset-display-prices?assetType=gold` — no auth required.

## Gold & Silver Storage Format (Non-Obvious)

| Type | Value | Storage | Example |
|------|-------|---------|---------|
| GOLD_VND | 8 | grams × 10000 | 75g = 750000 |
| GOLD_USD | 9 | ounces × 10000 | 1oz = 10000 |
| Silver | — | same × 10000 pattern | |

VND market prices (per tael) normalized via `goldConverter.ProcessMarketPrice()` before storage.

**GoldPriceService / SilverPriceService** are NOT in the `Services` struct — instantiate directly:
```go
service.NewGoldPriceService(deps.RDB.GetClient())
```

`GoldPriceService.FetchAllPrices()` → `[]*CachedGoldPrice` (has `ChangeBuy`, `ChangeSell`)
`SilverPriceService.FetchAllPrices()` → `[]*CachedSilverPrice` (NO `ChangeBuy`/`ChangeSell`)

## GORM Model Conventions

```go
type Wallet struct {
    ID        int32          `gorm:"primaryKey;autoIncrement"`
    UserID    int32          `gorm:"not null;index"`
    Balance   int64          `gorm:"type:bigint;default:0;not null"`  // always int64 for money
    DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`                  // soft delete
}
func (Wallet) TableName() string { return "wallet" }
```

- Always `int64` for money; always explicit `TableName()`
- Soft deletes with `gorm.DeletedAt`
- Foreign keys via `gorm:"foreignKey:XID"`

## Testing

```bash
go test -short ./...                              # Unit (no external deps)
go test -tags=integration ./domain/service/...   # Requires: task docker:up
task ci:backend-lint                              # Lint + build (no DB)
task ci:backend                                  # Full CI
```

## Linting

```bash
cd src/go-backend && task ci:backend-lint   # golangci-lint
cd src/go-backend && gofmt -w .
```
