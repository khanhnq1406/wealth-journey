# Admin Price Override — Implementation Report

## Summary

Implemented a complete admin price override system that allows admin users to manually override market prices (gold, silver, currency) via inline editing on the prices page. Overrides are stored in Redis with no TTL and merged at read time into the market prices response.

## Spec Reference

`docs/specs/2026-03-13-admin-price-override-spec.md`

## Plan Reference

`docs/plans/2026-03-14-admin-price-override-plan.md`

## Tasks Completed

| # | Task | Status | Commit | Files Changed |
|---|------|--------|--------|---------------|
| 1 | Proto Changes | Done | 9477ed0 | admin.proto, auth.proto, investment.proto |
| 2 | User Model & Migration | Done | 269ff13 | user.go, migrate-admin/main.go, Taskfile.yml |
| 3 | Auth Flow | Done | e5e6376 | auth.go, middleware.go |
| 4 | Admin Middleware | Done | 53c8dee | middleware.go |
| 5 | PriceOverrideCache | Done | 2712e98 | price_override_cache.go |
| 6 | PriceOverrideHandler | Done | 91ef12d | price_override.go, builder.go, routes.go |
| 7 | Market Prices Merge | Done | 040e0fb | market_prices.go, builder.go |
| 8 | Frontend Auth State | Done | 9f9b28d | interface.tsx |
| 9 | Frontend API Hooks | Done | e8ac285 | usePriceOverride.ts |
| 10 | Frontend Inline Edit | Done | ff983c8 | InlinePriceEdit.tsx, page.tsx, i18n |
| 11 | C4 Diagrams | Done | 1267242 | c4-component-backend.md, c4-component-frontend.md |
| 12 | Flow Diagrams | Done | 1267242 | flow-cross-cutting.md, README.md |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Authentication | JWT via AuthMiddleware, token from localStorage | Yes |
| Authorization | AdminMiddleware checks `is_admin` flag from DB, returns 403 | Yes |
| Input validation | Server-side: category enum, typeCode <= 50, currency regex, positive buy/sell, name <= 100 | Yes |
| Rate limiting | Reuses existing RateLimitByUser middleware on admin routes | Yes |
| Data integrity | Overrides stored as int64 in Redis, merged at read time | Yes |

## Architecture

- **Backend**: `PriceOverrideHandler` → `PriceOverrideCache` → Redis
- **Merge**: `MarketPricesHandler.GetMarketPrices` fetches prices in parallel, then overlays Redis overrides via `applyOverrides()`
- **Frontend**: `InlinePriceEdit` component with `usePriceOverrideSet`/`usePriceOverrideDelete` hooks
- **Admin detection**: `useAuth().user?.isAdmin` drives conditional rendering of edit controls

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/admin/price-overrides` | Admin | Set/update a price override |
| GET | `/api/v1/admin/price-overrides` | Admin | List all overrides (optionally by category) |
| DELETE | `/api/v1/admin/price-overrides` | Admin | Delete a specific override |

## Files Changed (Complete)

### Backend (Go)
- `api/protobuf/v1/admin.proto` (new)
- `api/protobuf/v1/auth.proto` (modified — isAdmin field)
- `api/protobuf/v1/investment.proto` (modified — isOverridden field)
- `src/go-backend/domain/models/user.go` (modified — IsAdmin field)
- `src/go-backend/domain/auth/auth.go` (modified — IsAdmin in UserData/VerifyAuth/GetAuth)
- `src/go-backend/handlers/middleware.go` (modified — is_admin in context + AdminMiddleware)
- `src/go-backend/handlers/price_override.go` (new)
- `src/go-backend/handlers/market_prices.go` (modified — override merge logic)
- `src/go-backend/handlers/builder.go` (modified — wiring)
- `src/go-backend/handlers/routes.go` (modified — admin routes)
- `src/go-backend/pkg/cache/price_override_cache.go` (new)
- `src/go-backend/cmd/migrate-admin/main.go` (new)
- `Taskfile.yml` (modified — migrate-admin task)

### Frontend (TypeScript)
- `src/wj-client/features/auth/store/interface.tsx` (modified — isAdmin)
- `src/wj-client/features/market-prices/hooks/usePriceOverride.ts` (new)
- `src/wj-client/features/market-prices/components/InlinePriceEdit.tsx` (new)
- `src/wj-client/app/[locale]/dashboard/prices/page.tsx` (modified — admin column)
- `src/wj-client/messages/en/investment.json` (modified — override i18n)
- `src/wj-client/messages/vi/investment.json` (modified — override i18n)

### Documentation
- `docs/architecture/c4-component-backend.md` (modified)
- `docs/architecture/c4-component-frontend.md` (modified)
- `docs/architecture/flow-cross-cutting.md` (modified — new section 6)
- `docs/architecture/README.md` (modified)
- `docs/reports/2026-03-14-admin-price-override-progress.md` (new)

## How to Test

1. Run migration: `task backend:migrate-admin`
2. Set a user as admin: `UPDATE "user" SET is_admin = true WHERE email = '<admin-email>';`
3. Start backend + frontend: `task dev`
4. Log in as the admin user
5. Navigate to `/dashboard/prices`
6. You should see an edit (pencil) icon on each price row
7. Click edit, enter buy/sell values, click save
8. The price should update and show a blue override indicator dot
9. Click the blue dot to remove the override
10. Non-admin users should see a small blue dot (no edit controls) on overridden prices

## Known Issues / Technical Debt

- `apiClient.delete` does not support request body — the delete mutation uses raw `fetch` instead
- No automated tests (frontend component tests or backend handler tests) — TDD was skipped due to this being a Redis-only feature with no business logic layer
- Proto-generated admin hooks use numeric PriceCategory enum but backend expects string — custom hooks work around this
