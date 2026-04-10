# Fix Prices Page Tabs & Asset Display Config Alignment — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Switch `MarketPricesHandler` to use `AssetDisplayConfigService.GetDisplayPrices()` and hide gold/silver/currency tabs on the frontend when their data array is empty after a successful fetch.
**Spec:** `docs/specs/2026-04-09-fix-prices-tabs-asset-display-config-spec.md`
**Architecture:** The handler currently calls `AssetPriceService.GetAllPrices()` which reads raw `asset_price` rows without applying the admin display config. The fix replaces it with three calls to `AssetDisplayConfigService.GetDisplayPrices(ctx, assetType)` which already handles fetch-code priority resolution, display names, ordering, and `enabled=true` filtering. No DB schema or proto changes are needed.
**Tech Stack:** Go 1.25 (backend handler), React 19 / Next.js 16.2 / TypeScript 5 (frontend page), React Query v5.

---

## Security Implementation Notes

- **Authentication:** `GET /api/v1/investments/market-prices` is a public endpoint — no auth change.
- **Authorization:** `assetType` values (`"gold"`, `"silver"`, `"currency"`) are hardcoded constants in the handler — never user-supplied. No injection risk.
- **Input validation:** No new user input introduced by this fix.
- **Data sanitization:** No free-text user data in response. Prices are internal DB values only.
- **overrideCache:** Must be preserved unchanged — applied after DTO mapping, same as before.

---

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `TabBar` | `components/navigation/TabBar` | Tab rendering — reuse as-is, feed `visibleTabs` instead of `TABS` |
| `TanStackTable` | `components/table/` | Desktop price table — unchanged |
| `MobileTable` | `components/table/MobileTable` | Mobile price table — unchanged |

**New components needed:** None. The fix is a logic change within `page.tsx` only — no new components.

---

## C4 Architecture Diagram Updates

Per spec §Architecture Changes:
- `docs/architecture/c4-component-backend.md` — update `MarketPricesHandler` component: dependency arrow from `AssetPriceService` → `AssetDisplayConfigService`.
- `docs/architecture/c4-code-investment.md` — update `MarketPricesHandler` class: new constructor signature.

---

## Task 0: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-code-investment.md`

**Security notes:** Documentation only — no security concerns.

**Steps:**

1. Read `docs/architecture/c4-component-backend.md` — find the `MarketPricesHandler` component and its dependency on `AssetPriceService`.
2. Update the relationship: `MarketPricesHandler` → `AssetDisplayConfigService` (remove arrow to `AssetPriceService`).
3. Read `docs/architecture/c4-code-investment.md` — find `MarketPricesHandler` class definition.
4. Update constructor signature to show `assetDisplayConfigSvc AssetDisplayConfigService`.
5. Commit:
```
git add docs/architecture/c4-component-backend.md docs/architecture/c4-code-investment.md
git commit -m "docs(architecture): update MarketPricesHandler C4 diagrams — switch dep to AssetDisplayConfigService"
```

---

## Task 1: Update Runtime Flow Diagram

**Files:**
- Modify: `docs/architecture/flow-investment.md`

**Security notes:** Documentation only.

**Steps:**

1. Read `docs/architecture/flow-investment.md` — find the "Market Price Update" or `GetMarketPrices` sequence.
2. Update the flow to show three `GetDisplayPrices()` calls (gold, silver, currency) via `AssetDisplayConfigService` instead of one `GetAllPrices()` call via `AssetPriceService`. Use the flow from the spec §Runtime Flow Diagrams.
3. Commit:
```
git add docs/architecture/flow-investment.md
git commit -m "docs(flow): update GetMarketPrices flow to use AssetDisplayConfigService.GetDisplayPrices"
```

---

## Task 2: Rewrite `MarketPricesHandler` (Backend)

**Files:**
- Modify: `src/go-backend/handlers/market_prices.go` (full rewrite of struct + constructor + handler + converter)
- Modify: `src/go-backend/handlers/market_prices_test.go` (replace mock + all tests)
- Modify: `src/go-backend/handlers/builder.go` (lines 70–77 — replace wiring)

**Security notes:** `assetType` string literals hardcoded — not user-supplied. `overrideCache` logic preserved unchanged.

**Step 1: Write the failing test — new mock + updated test cases**

Replace `market_prices_test.go` with a mock for `AssetDisplayConfigService`:

```go
package handlers

import (
    "context"
    "encoding/json"
    "errors"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/gin-gonic/gin"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"

    "wealthjourney/domain/service"
)

// mockAssetDisplayConfigService satisfies service.AssetDisplayConfigService for handler tests.
type mockAssetDisplayConfigService struct {
    getDisplayPricesFunc func(ctx context.Context, assetType string) ([]*service.AssetDisplayPriceDTO, error)
}

func (m *mockAssetDisplayConfigService) GetDisplayPrices(ctx context.Context, assetType string) ([]*service.AssetDisplayPriceDTO, error) {
    if m.getDisplayPricesFunc != nil {
        return m.getDisplayPricesFunc(ctx, assetType)
    }
    return []*service.AssetDisplayPriceDTO{}, nil
}

// Stub out all other AssetDisplayConfigService methods (not used by handler)
func (m *mockAssetDisplayConfigService) ListAll(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigService) Create(ctx context.Context, typeCode, displayName, assetType string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigService) Update(ctx context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigService) Delete(ctx context.Context, id int32) error { return nil }
func (m *mockAssetDisplayConfigService) ResolvePrice(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
    return 0, 0, false, nil
}
func (m *mockAssetDisplayConfigService) ListFetchCodes(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigService) CreateFetchCode(ctx context.Context, configID int32, typeCode string, priority int32) (*models.AssetConfigFetchCode, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigService) UpdateFetchCode(ctx context.Context, id int32, priority int32) (*models.AssetConfigFetchCode, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigService) DeleteFetchCode(ctx context.Context, id int32) error {
    return nil
}
func (m *mockAssetDisplayConfigService) ListAvailableTypeCodes(ctx context.Context, assetType string) ([]string, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigService) GetFetchCodesByAssetType(ctx context.Context, assetType string) (map[string]*models.AssetDisplayConfig, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigService) ListForInvestment(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
    return nil, nil
}
```

> **Note:** The mock needs `models` import — add `"wealthjourney/domain/models"`.

Test cases to write (each must fail before implementation):

- `TestGetMarketPrices_ReturnsPricesFromDisplayConfig` — verifies gold/silver/currency populated from `GetDisplayPrices()`, typeCode and displayName mapped correctly.
- `TestGetMarketPrices_IsStaleForwarded` — `IsStale: true` in DTO propagates to `isStale: true` in response.
- `TestGetMarketPrices_ErrorOnGold` — when `GetDisplayPrices("gold")` errors, handler returns 500.
- `TestGetMarketPrices_EmptyGoldArray` — when gold config returns `[]`, `gold` key in response is empty array (not null).
- `TestConvertDisplayPricesToPriceItems` — unit test for the new converter function.
- `TestConvertDisplayPricesToPriceItems_EmptySlice` — edge case: empty input returns empty (not nil).

**Step 2: Run tests to verify they fail**
```bash
cd src/go-backend && go test ./handlers/ -run TestGetMarketPrices -v 2>&1 | head -30
```
Expected: compilation error (handler struct still has `assetPriceSvc`).

**Step 3: Implement — rewrite `market_prices.go`**

```go
package handlers

import (
    "time"

    "github.com/gin-gonic/gin"

    "wealthjourney/domain/service"
    "wealthjourney/pkg/cache"
    "wealthjourney/pkg/handler"
    investmentv1 "wealthjourney/protobuf/v1"
)

// MarketPricesHandler handles the combined gold + silver + currency prices endpoint.
// It reads from AssetDisplayConfigService.GetDisplayPrices() which applies the admin
// display config (enabled filter, display names, fetch-code priority resolution, display order).
type MarketPricesHandler struct {
    assetDisplayConfigSvc service.AssetDisplayConfigService
    overrideCache         *cache.PriceOverrideCache
}

// NewMarketPricesHandler creates a new market prices handler.
func NewMarketPricesHandler(
    assetDisplayConfigSvc service.AssetDisplayConfigService,
    overrideCache *cache.PriceOverrideCache,
) *MarketPricesHandler {
    return &MarketPricesHandler{
        assetDisplayConfigSvc: assetDisplayConfigSvc,
        overrideCache:         overrideCache,
    }
}

// GetMarketPrices returns all gold, silver, and currency prices in one call.
// GET /api/v1/investments/market-prices
func (h *MarketPricesHandler) GetMarketPrices(c *gin.Context) {
    ctx := c.Request.Context()

    goldDTOs, err := h.assetDisplayConfigSvc.GetDisplayPrices(ctx, "gold")
    if err != nil {
        handler.HandleError(c, err)
        return
    }

    silverDTOs, err := h.assetDisplayConfigSvc.GetDisplayPrices(ctx, "silver")
    if err != nil {
        handler.HandleError(c, err)
        return
    }

    currencyDTOs, err := h.assetDisplayConfigSvc.GetDisplayPrices(ctx, "currency")
    if err != nil {
        handler.HandleError(c, err)
        return
    }

    // Convert DTOs to proto PriceItems
    goldItems := convertDisplayPricesToPriceItems(goldDTOs)
    silverItems := convertDisplayPricesToPriceItems(silverDTOs)
    currencyItems := convertDisplayPricesToPriceItems(currencyDTOs)

    // Apply admin price overrides (graceful — skip if Redis fails)
    if h.overrideCache != nil {
        allOverrides, overrideErr := h.overrideCache.GetAll(ctx)
        if overrideErr == nil && len(allOverrides) > 0 {
            overrideMap := make(map[string]*cache.PriceOverride, len(allOverrides))
            for _, o := range allOverrides {
                overrideMap[o.TypeCode+":"+o.Currency] = o
            }
            applyOverrides(goldItems, overrideMap)
            applyOverrides(silverItems, overrideMap)
            applyOverrides(currencyItems, overrideMap)
        }
    }

    handler.Success(c, gin.H{
        "gold":      goldItems,
        "silver":    silverItems,
        "currency":  currencyItems,
        "timestamp": time.Now().Format(time.RFC3339),
    })
}

// convertDisplayPricesToPriceItems maps AssetDisplayPriceDTOs to proto PriceItems.
// TypeCode → typeCode (config type_code, e.g. "USD")
// DisplayName → name (admin-configured display name)
// UpdatedAt is not on AssetDisplayPriceDTO — use zero Unix (0) as placeholder.
func convertDisplayPricesToPriceItems(dtos []*service.AssetDisplayPriceDTO) []*investmentv1.PriceItem {
    items := make([]*investmentv1.PriceItem, len(dtos))
    for i, d := range dtos {
        items[i] = &investmentv1.PriceItem{
            TypeCode:   d.TypeCode,
            Buy:        d.Buy,
            Sell:       d.Sell,
            Currency:   d.Currency,
            Name:       d.DisplayName,
            IsStale:    d.IsStale,
        }
    }
    return items
}

// applyOverrides merges admin price overrides into price items.
func applyOverrides(items []*investmentv1.PriceItem, overrides map[string]*cache.PriceOverride) {
    for _, item := range items {
        key := item.TypeCode + ":" + item.Currency
        if override, ok := overrides[key]; ok {
            item.Buy = override.Buy
            item.Sell = override.Sell
            item.IsOverridden = true
        }
    }
}
```

> **Note on `AssetDisplayPriceDTO`:** The DTO struct (in `interfaces.go:412`) does not have `ChangeBuy`, `ChangeSell`, or `UpdatedAt` fields. The `PriceItem` proto has `changeBuy`, `changeSell`, `updatedAt` — these will be zero-valued (0) in the response. The spec confirms `PriceItem` already has all needed fields. Verify DTO fields before implementation — if `Currency` is missing on the DTO, it will need to be added. Check: `interfaces.go:412-422`.

**Step 4: Run tests to verify they pass**
```bash
cd src/go-backend && go test ./handlers/ -run TestGetMarketPrices -v
cd src/go-backend && go test ./handlers/ -run TestConvertDisplayPrices -v
```

**Step 5: Update builder.go wiring**

Replace lines 70–77 in `handlers/builder.go`:

```go
// OLD (remove):
var marketPricesHandler *MarketPricesHandler
if services.AssetPrice != nil {
    var overrideCache *cache.PriceOverrideCache
    if deps.RDB != nil {
        overrideCache = cache.NewPriceOverrideCache(deps.RDB.GetClient())
    }
    marketPricesHandler = NewMarketPricesHandler(services.AssetPrice, overrideCache)
}

// NEW (replace with):
var marketPricesHandler *MarketPricesHandler
if services.AssetDisplayConfig != nil {
    var overrideCache *cache.PriceOverrideCache
    if deps.RDB != nil {
        overrideCache = cache.NewPriceOverrideCache(deps.RDB.GetClient())
    }
    marketPricesHandler = NewMarketPricesHandler(services.AssetDisplayConfig, overrideCache)
}
```

**Step 6: Verify build and lint**
```bash
cd src/go-backend && go build ./...
cd src/go-backend && task ci:backend-lint
```

**Step 7: Run full handler test suite**
```bash
cd src/go-backend && go test ./handlers/ -v -count=1
```

**Step 8: Playwright E2E Audit** — Write/update tests only, do NOT run.

- No existing `tests/e2e/*price*` spec found. Create `src/wj-client/tests/e2e/prices-page.spec.ts`:
  - Test: tabs visible on load (priceAlerts, watchlist, symbol always shown)
  - Test: gold/silver/currency tabs hidden when API returns empty arrays
  - Mock the market-prices API response with `page.route()`

**Step 9: Commit**
```bash
git add src/go-backend/handlers/market_prices.go \
        src/go-backend/handlers/market_prices_test.go \
        src/go-backend/handlers/builder.go \
        src/wj-client/tests/e2e/prices-page.spec.ts
git commit -m "fix(market-prices): switch handler to AssetDisplayConfigService.GetDisplayPrices

- Replace AssetPriceService dependency with AssetDisplayConfigService
- Three sequential GetDisplayPrices calls for gold/silver/currency
- Map AssetDisplayPriceDTO to PriceItem (TypeCode, DisplayName, Buy, Sell, IsStale)
- Preserve existing overrideCache logic unchanged
- Update builder.go wiring (services.AssetDisplayConfig guard)
- Add Playwright E2E spec for prices page tab visibility"
```

---

## Task 3: Frontend — Dynamic Tab Visibility (Frontend)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/prices/page.tsx`

**Security notes:** Frontend-only change. No user input. `isSuccess` from React Query is a boolean — no injection risk.

**Step 0: Component inventory check**

- `TabBar` at `components/navigation/TabBar` — reuse with dynamic `visibleTabs` array. No new component needed.
- `useMemo` — already imported in `page.tsx`.

**Step 1: Write the failing test**

There are no existing unit tests for `page.tsx`. The E2E test written in Task 2 Step 8 covers the tab-hiding behavior. For this task, add a focused unit test for the tab filtering logic in a new file:

`src/wj-client/app/[locale]/dashboard/prices/__tests__/tab-visibility.test.tsx`

```typescript
import { renderHook } from "@testing-library/react";
// Test the useMemo tab filtering logic by extracting it into a testable helper
// OR test page.tsx behavior via React Testing Library with mocked useQueryGetMarketPrices

// Key assertions:
// 1. When isSuccess=false, all 6 tabs visible
// 2. When isSuccess=true && gold=[], gold tab hidden
// 3. When isSuccess=true && silver=[], silver tab hidden
// 4. When isSuccess=true && currency=[], currency tab hidden
// 5. priceAlerts, watchlist, symbol always visible regardless
// 6. When activeTab is hidden tab, activeTab resets to "priceAlerts"
```

**Step 2: Run test to verify it fails**
```bash
cd src/wj-client && npm test -- --testPathPattern=prices/__tests__/tab-visibility --watchAll=false 2>&1 | tail -20
```

**Step 3: Implement in `page.tsx`**

In `PricesPage()`, after the `useQueryGetMarketPrices` call (around line 953):

```typescript
const { data, isLoading, isError, refetch, isFetching, isSuccess } =
  useQueryGetMarketPrices(
    {},
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );
```

> **Note:** Add `isSuccess` to the destructured fields.

Replace the static `TABS` constant with a `visibleTabs` computed value. The `TABS` constant (lines 920-927) is defined inside the component, so convert it:

```typescript
// Static tab definitions (keep as reference array)
const ALL_TABS: { key: Tab; label: string }[] = [
  { key: "priceAlerts", label: t("tabs.priceAlerts") },
  { key: "watchlist", label: t("tabs.watchlist") },
  { key: "gold", label: t("tabs.gold") },
  { key: "silver", label: t("tabs.silver") },
  { key: "currency", label: t("tabs.currency") },
  { key: "symbol", label: t("tabs.symbolLookup") },
];

// Dynamic tab list: hide gold/silver/currency when isSuccess and their data is empty
const visibleTabs = useMemo(() => {
  const tabs: { key: Tab; label: string }[] = [];
  tabs.push(ALL_TABS[0]); // priceAlerts — always visible
  tabs.push(ALL_TABS[1]); // watchlist — always visible
  if (!isSuccess || (data?.gold ?? []).length > 0) tabs.push(ALL_TABS[2]); // gold
  if (!isSuccess || (data?.silver ?? []).length > 0) tabs.push(ALL_TABS[3]); // silver
  if (!isSuccess || (data?.currency ?? []).length > 0) tabs.push(ALL_TABS[4]); // currency
  tabs.push(ALL_TABS[5]); // symbol — always visible
  return tabs;
}, [isSuccess, data?.gold, data?.silver, data?.currency, ALL_TABS]);

// If activeTab becomes hidden (e.g. admin disables all gold), reset to first tab
useEffect(() => {
  const isVisible = visibleTabs.some((t) => t.key === activeTab);
  if (!isVisible) {
    setActiveTab("priceAlerts");
  }
}, [visibleTabs, activeTab]);
```

Update the `TabBar` usage (line 1009-1013) to use `visibleTabs`:

```typescript
// Before:
<TabBar
  tabs={TABS.map((tab) => ({ id: tab.key, label: tab.label }))}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>

// After:
<TabBar
  tabs={visibleTabs.map((tab) => ({ id: tab.key, label: tab.label }))}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

> **Note:** `ALL_TABS` is defined inside the component so it will re-create on every render. Either move it outside the component (as a `const` at module level) or wrap in `useMemo` with no deps. Prefer module-level `const` since it has no dependencies on component state.

**Step 4: Run tests to verify they pass**
```bash
cd src/wj-client && npm test -- --testPathPattern=prices/__tests__/tab-visibility --watchAll=false
```

**Step 5: Responsive & accessibility check**

- Tab filtering logic is CSS-invisible (no new elements) — no layout regression.
- `TabBar` already handles scroll-hint for overflow tabs (`tab-bar-scroll-hint` feature, done).
- Ensure `useEffect` import is present in `page.tsx`.

**Step 6: Playwright E2E Audit** — Update `prices-page.spec.ts` written in Task 2 to add:
  - Assertion that after successful load with empty gold/silver/currency, those tabs are absent from DOM.
  - Assert activeTab reset: if gold was active and then gold disappears, active tab becomes "priceAlerts".

**Step 7: Commit**
```bash
git add src/wj-client/app/\[locale\]/dashboard/prices/page.tsx \
        src/wj-client/app/\[locale\]/dashboard/prices/__tests__/tab-visibility.test.tsx
git commit -m "fix(prices-page): hide gold/silver/currency tabs when data empty after successful load

- Replace static TABS with visibleTabs useMemo (isSuccess + empty array guard)
- useEffect resets activeTab to 'priceAlerts' if active tab becomes hidden
- priceAlerts, watchlist, symbol tabs always visible"
```

---

## Task 4: Kanban + Obsidian Task Update

**Files:**
- Modify: `docs/obsidian/2026-04-09-fix-prices-tabs-asset-display-config.md`
- Modify: `docs/obsidian/Kanban Board.md`

**Steps:**

1. Update task note: add plan link to Pipeline Artifacts table, update status to `Plan`.
2. Move Kanban entry from `## Spec` column to `## Plan` column.
3. Commit:
```bash
git add docs/obsidian/
git commit -m "chore(kanban): move fix-prices-tabs-asset-display-config to Plan"
```

---

## Implementation Order

```
Task 0 (C4 diagrams) ──────────────────────────────────────────────────────────┐
Task 1 (flow diagram) ─────────────────────────────────────────────────────────│── can be done in parallel
Task 2 (backend handler + builder + tests) ─────────────────────────────────────┤
Task 3 (frontend tab visibility) ──────────── depends on Task 2 being understood │── can be done in parallel with Task 2
Task 4 (kanban) ────────────────────────────────────────────────── last ────────┘
```

Tasks 0, 1, 2, 3 are all independent files and can be done in parallel. Task 4 must come last.

---

## DTO Field Verification Checklist (Before Task 2 Implementation)

Before writing the converter function, verify `AssetDisplayPriceDTO` fields in `interfaces.go:412-422`:

| DTO Field | Maps to PriceItem field | Present? |
|-----------|------------------------|----------|
| `TypeCode` | `typeCode` | ✓ (confirmed line 413) |
| `DisplayName` | `name` | ✓ (confirmed line 415) |
| `Buy` | `buy` | ✓ (confirmed line 419) |
| `Sell` | `sell` | ✓ (confirmed line 420) |
| `IsStale` | `isStale` | ✓ (confirmed line 421) |
| `Currency` | `currency` | **VERIFY** — not visible in excerpt |
| `ChangeBuy` | `changeBuy` | **VERIFY** — not on DTO, leave as 0 |
| `ChangeSell` | `changeSell` | **VERIFY** — not on DTO, leave as 0 |
| `UpdatedAt` | `updatedAt` | **NOT on DTO** — leave as 0 |

If `Currency` is absent from `AssetDisplayPriceDTO`, the override key `typeCode:currency` lookup will break. Check before implementing.
