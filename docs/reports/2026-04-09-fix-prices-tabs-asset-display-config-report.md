# Fix Prices Page Tabs & Asset Display Config Alignment — Implementation Report

## Summary

Switched `MarketPricesHandler` from `AssetPriceService.GetAllPrices()` to three sequential `AssetDisplayConfigService.GetDisplayPrices()` calls (gold, silver, currency). This fixes the root cause: the old path returned raw `asset_price` rows without applying admin display config (wrong names, wrong sort order, currency always empty, disabled items still shown). The frontend now hides gold/silver/currency tabs dynamically when the API returns empty arrays after a successful fetch.

## Spec Reference

`docs/specs/2026-04-09-fix-prices-tabs-asset-display-config-spec.md`

## Plan Reference

`docs/plans/2026-04-09-fix-prices-tabs-asset-display-config-plan.md`

## Tasks Completed

| #   | Task                                    | Status | Files Changed                                                                                                     | Tests       | TDD |
| --- | --------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- | ----------- | --- |
| 0   | Update C4 Architecture Diagrams         | Done   | `docs/architecture/c4-component-backend.md`, `c4-code-investment.md`                                             | N/A (docs)  | N/A |
| 1   | Update Runtime Flow Diagram             | Done   | `docs/architecture/flow-investment.md`                                                                            | N/A (docs)  | N/A |
| 2   | Rewrite MarketPricesHandler (Backend)   | Done   | `handlers/market_prices.go`, `market_prices_test.go`, `test_mocks_test.go`, `builder.go`, `prices-page.spec.ts`  | 107 passing | Yes |
| 3   | Frontend — Dynamic Tab Visibility       | Done   | `prices/page.tsx`, `prices/helpers.ts`, `__tests__/tab-visibility.test.tsx`, `view-prices-flow.spec.ts`           | 49 passing  | Yes |

## Test Coverage Summary

| Layer              | Test File                                        | Tests | Pass  | Coverage Area                                        |
| ------------------ | ------------------------------------------------ | ----- | ----- | ---------------------------------------------------- |
| Backend Handler    | `handlers/market_prices_test.go`                 | 6     | 6/6   | GetDisplayPrices mapping, IsStale, error 500, empty array, converter |
| Backend Handler    | `handlers/` (full package)                       | 107   | 107/107 | All handler tests including regression             |
| Frontend Unit      | `prices/__tests__/tab-visibility.test.tsx`       | 18    | 18/18 | computeVisibleTabs: all 6 visibility scenarios + edge cases |
| Frontend E2E       | `tests/e2e/prices-page.spec.ts`                  | 12    | not run | Tab visibility, loading state, mobile viewport     |
| Frontend E2E       | `tests/e2e/view-prices-flow.spec.ts`             | 5     | not run | Dynamic tab visibility, activeTab reset            |

## Security Implementation Summary

| Concern            | Implementation                                          | Verified |
| ------------------ | ------------------------------------------------------- | -------- |
| Input validation   | No new user input — `assetType` hardcoded in handler    | Yes      |
| Authorization      | Public endpoint — no change needed                      | Yes      |
| Error responses    | `handler.HandleError` used — no internal detail leakage | Yes      |
| Financial values   | `Buy`/`Sell` are `int64` throughout DTO → proto chain   | Yes      |
| No injection risk  | `assetType` values are string literals, not user input  | Yes      |

## Review Results

### Spec Compliance

All 4 tasks passed Stage 1. The handler correctly calls `GetDisplayPrices` three times, maps DTOs to proto PriceItems, preserves override cache logic, and returns `{gold, silver, currency, timestamp}`. The frontend correctly hides tabs only on `isSuccess=true` with empty arrays, always showing priceAlerts/watchlist/symbol.

### Security Review

All tasks passed Stage 2. No new attack surface introduced. assetType values are hardcoded constants. No sensitive data in error responses. No secrets in any file.

### Code Quality

All tasks passed Stage 3. Reviewer highlights:
- Backend: clean early-return error handling, context propagation correct, `handler.Success` helper used (no raw `c.JSON`)
- Frontend: `computeVisibleTabs` extracted as pure function for testability, `useMemo` dependency array complete, TypeScript types sound
- Docs: C4 and flow diagrams are syntactically valid Mermaid, style consistent with existing diagrams

## Known Issues / Technical Debt

- `convertDisplayPricesToPriceItems` hardcodes `Currency: "VND"` because `AssetDisplayPriceDTO` has no `Currency` field. Price overrides for USD-denominated assets may not apply (override key uses `TypeCode:VND` instead of `TypeCode:USD`). Requires a service-layer change to add `Currency` to the DTO if this matters in future.
- The `useEffect` tab reset fires one render cycle after `visibleTabs` changes (standard React pattern) — one frame may briefly show hidden-tab content before resetting. Acceptable UX trade-off.

## Files Changed

**Documentation:**
- `docs/architecture/c4-component-backend.md` — `price_h` relationship updated to `AssetDisplayConfigService`
- `docs/architecture/c4-code-investment.md` — `MarketPricesHandler` class added with new constructor field
- `docs/architecture/flow-investment.md` — Flow 13 added: GetMarketPrices HTTP endpoint sequence

**Backend:**
- `src/go-backend/handlers/market_prices.go` — full rewrite: new struct, constructor, handler, converter
- `src/go-backend/handlers/market_prices_test.go` — all tests replaced: 6 new tests for new dependency
- `src/go-backend/handlers/test_mocks_test.go` — created: `mockAssetPriceService` extracted here (was in market_prices_test.go, needed by public_test.go)
- `src/go-backend/handlers/builder.go` — guard `services.AssetDisplayConfig`, constructor updated

**Frontend:**
- `src/wj-client/app/[locale]/dashboard/prices/helpers.ts` — `computeVisibleTabs` pure function added
- `src/wj-client/app/[locale]/dashboard/prices/page.tsx` — `isSuccess`, `visibleTabs`, `useEffect` reset added; TabBar uses `visibleTabs`
- `src/wj-client/app/[locale]/dashboard/prices/__tests__/tab-visibility.test.tsx` — created: 18 unit tests
- `src/wj-client/tests/e2e/prices-page.spec.ts` — created: 12 Playwright E2E tests
- `src/wj-client/tests/e2e/view-prices-flow.spec.ts` — updated: 5 new dynamic tab visibility E2E tests

**Progress / Reports:**
- `docs/reports/2026-04-09-fix-prices-tabs-asset-display-config-progress.md`
- `docs/reports/2026-04-09-fix-prices-tabs-asset-display-config-report.md`

## How to Test

### Unit & Integration Tests

```bash
# Backend handler tests
cd src/go-backend && go test ./handlers/ -v -count=1

# Frontend unit tests
cd src/wj-client && npm test -- --testPathPatterns="prices/__tests__/tab-visibility" --watchAll=false

# Frontend CI
cd src/wj-client && npm run build
```

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed:
- `MarketPricesHandler` — only used in `builder.go` and `routes.go`. No other callers.
- `builder.go` wiring change — only affects `NewHandlers()` function. No test for `NewHandlers` itself (integration-level); handler-level tests cover the behavior.
- `computeVisibleTabs` in `helpers.ts` — only used in `page.tsx`. Directly tested in `tab-visibility.test.tsx`.

### Manual Testing Steps

#### Scenario: Happy path — all asset types enabled
**Preconditions:** Logged in, admin has gold/silver/currency configs with `enabled=true`
1. Navigate to `/dashboard/prices`
2. Wait for page to load → Expected: all 6 tabs visible (Price Alerts, Watchlist, Gold, Silver, Currency, Symbol)
3. Click Gold tab → Expected: gold price table renders with admin-configured display names and sort order
4. Click Currency tab → Expected: currency prices appear (was previously always empty)

#### Scenario: Admin disables all gold configs
**Preconditions:** Admin sets all gold display configs to `enabled=false`
1. Navigate to `/dashboard/prices`
2. After successful load → Expected: Gold tab is hidden; priceAlerts/watchlist/symbol remain
3. If Gold was previously active → Expected: active tab resets to Price Alerts automatically

#### Scenario: Loading state — tabs not hidden prematurely
**Preconditions:** Slow network (throttle to Slow 3G)
1. Navigate to `/dashboard/prices`
2. While loading (spinner visible) → Expected: all 6 tabs remain visible (no flicker/hide during load)
3. After load completes → Expected: correct tabs shown based on data

#### Scenario: Mobile viewport (375px)
**Preconditions:** DevTools mobile emulation, 375px width
1. Navigate to `/dashboard/prices`
2. Expected: tabs render in scrollable TabBar, no horizontal overflow on page
3. Tap a tab → Expected: content switches correctly

#### Scenario: Error state
**Preconditions:** Backend unreachable or returns 500
1. Navigate to `/dashboard/prices`
2. Expected: all 6 tabs remain visible (isSuccess=false → no tab hiding)
3. Expected: error UI shown in tab content area
