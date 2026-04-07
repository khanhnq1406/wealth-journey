# Domain Reference

## Business Domains

### Wallet
- Models: `domain/models/wallet.go`
- Service: `domain/service/wallet_service.go`
- Repo: `domain/repository/wallet_repository.go`
- Proto: `api/protobuf/v1/wallet.proto`
- Types: BASIC, INVESTMENT

### Transaction & Category
- Proto: `api/protobuf/v1/transaction.proto` — categories are here, NOT a separate file
- Service: `transaction_service.go`, `category_service.go`
- Supports: income/expense, custom categories, CSV export, bank import

### Authentication
- Service: `domain/auth/auth.go`
- Proto: `auth.proto`, `session.proto`
- JWT tokens with Redis whitelist; Google OAuth; device-tracked sessions

### Investment Portfolio
- Proto: `api/protobuf/v1/investment.proto` — also contains price alert RPCs + asset display config RPCs
- Models: `investment.go`, `investment_transaction.go`, `investment_lot.go`, `market_data.go`, `portfolio_history.go`
- FIFO cost basis accounting; realized + unrealized PNL
- `isCustom: true` on create for non-market assets with manual price override

### User Price Alerts
- Model: `domain/models/user_price_alert.go`
- Service: `domain/service/user_price_alert_service.go`
- Handler: `handlers/user_price_alert.go`
- Frontend: `features/price-alert/` (AlertStatusBadge, PriceAlertList, CreatePriceAlertForm)
- Settings page: `/dashboard/settings/alerts`
- Migration: `task backend:migrate-user-price-alerts`
- AlertStatus enum: `UNSPECIFIED`, `ACTIVE`, `TRIGGERED`, `PAUSED`

### Asset Price Cache
- Model: `domain/models/asset_price.go` — `asset_price` table, unique `(type_code, currency, source)`
- Service: `domain/service/asset_price_service.go`
- Repo: `domain/repository/asset_price_repository.go`
- Migrations: `task backend:migrate-asset-prices`, `task backend:migrate-vietcombank-currency`

### Asset Display Configuration
- Models: `asset_display_config.go`, `asset_config_fetch_code.go`
- Service: `domain/service/asset_display_config_service.go`
- Handler: `handlers/asset_display_config.go` — 10 endpoints
- Migrations: `task backend:migrate-asset-display-config`, `task backend:migrate-asset-config-fetch-code`
- Public: `GET /api/v1/public/asset-display-prices?assetType=gold`
- Hook: `useQueryGetAssetDisplayPrices({ assetType: "gold" })` → `data?.prices`

### Gold Investment
- Gold types in proto: `GOLD_VND` (value 8, VND, grams), `GOLD_USD` (value 9, USD, ounces)
- Storage: × 10000 (4 decimal precision)
- Frontend utils: `features/investment/utils/gold-calculator.ts` — `convertGoldQuantity()`, `calculateGoldFromUserInput()`
- Endpoint: `GET /api/v1/investments/gold-types`

### Silver Investment
- Same patterns as gold
- Frontend utils: `features/investment/utils/silver-calculator.ts`

### Market Data & Yahoo Finance
- Config env vars: `YAHOO_FINANCE_ENABLED` (true), `YAHOO_FINANCE_TIMEOUT` (10s), `YAHOO_FINANCE_REQUESTS_PER_MIN` (120), `YAHOO_FINANCE_CACHE_MAX_AGE` (15m)
- Symbol search: `yahoo.SearchSymbols(ctx, "AAPL", 10)` — `SymbolAutocomplete` component, 300ms debounce, min 2 chars

### Bank Statement Import
- Proto: `api/protobuf/v1/import.proto`
- Service: `domain/service/import_service.go`
- Endpoints: `POST /api/v1/import/upload`, `POST /api/v1/import/process`, `GET/POST /api/v1/import/templates`
- Settings: `/dashboard/settings/import-templates`

### FX Rates
- Model: `domain/models/fx_rate.go`
- Service: `domain/service/fx_rate_service.go`

## Architecture Documentation

Full C4 diagrams in `docs/architecture/`:
- `c4-context.md` — L1 system context
- `c4-container.md` — L2 containers + trust boundaries
- `c4-component-backend.md` — L3 backend
- `c4-component-frontend.md` — L3 frontend
- `c4-code-investment.md` — L4 investment domain
- `flow-*.md` — 5 dynamic flow diagrams
- `adr-*.md` — 3 ADRs (Manual DI, Constructor Injection, Feature-based Frontend)

## Investment Detail Modal Tabs
Overview → Transactions → Add Transaction → Set Price (via `UpdateInvestmentPriceForm`)

## FIFO Example
```
Buy 100 VCB @ 85,000 → cost 8,500,000
Sell 30 VCB @ 90,000 → proceeds 2,700,000; cost basis 2,550,000; realized PNL 150,000
Remaining: 70 shares @ 85,000 avg
```
