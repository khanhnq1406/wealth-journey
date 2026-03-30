# Investment Price Unification — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace static gold/silver VND type registries with admin-controlled `asset_display_config` DB queries, making the investment form, watchlist, and price alerts all driven by the same admin config.

**Spec:** `docs/specs/2026-03-30-investment-price-unification-spec.md`

**Architecture:** The gold/silver type handlers (`handlers/gold.go`, `handlers/silver.go`) currently read from static arrays in `pkg/gold/types.go` and `pkg/silver/types.go`. After this change, VND types will be sourced from the `asset_display_config` table (filtered by `show_in_investment = true`), while USD types (`XAUUSD`, `XAGUSD`) remain hardcoded. The frontend silver investment form will be migrated to use the same API-driven pattern as gold.

**Tech Stack:** Go 1.25 (Gin, GORM), Next.js 16.2 (React 19, React Query v5, TypeScript 5)

## Spec Deviations Noted During Planning

1. **FR-1 — Silver seed already exists.** The `migrate-asset-display-config` migration already seeds 13 silver configs + fetch codes. However, the TypeCodes in the DB (`PH_QU_THI_1L`, `ANCARAT_NGN_LONG_1L`, etc.) differ from the static registry (`GOLDENFUND_1L`, `ANCARAT_1L`, etc.) because the DB codes come from the silver price service's `toTypeCode()` function. The spec's table lists codes from the static registry, which are wrong. **No new seed migration needed.** Instead, a migration to update `show_in_investment = true` on all silver configs is needed.

2. **FR-3 static registry codes vs DB codes.** The spec assumes the static registry codes map 1:1 to DB. They don't. After removing VND entries, the remaining `GetGoldTypeByCode()` / `GetSilverTypeByCode()` functions need only work for USD types. Callers that referenced VND codes from the registry should now use DB configs.

3. **FR-5 frontend static arrays.** The spec's `SILVER_VND_OPTIONS` codes (`GOLDENFUND_1L`, `PHUQUY_1L`, etc.) don't match the DB silver codes (`PH_QU_THI_1L`, etc.). The frontend currently shows these hardcoded options. After this change, silver options will come from the API (same as gold), so the mismatch becomes irrelevant — both frontend and backend will use DB codes.

## Security Implementation Notes

- **Authentication**: Gold/silver type list endpoints require `AuthMiddleware` (unchanged). `AssetDisplayPrices` public endpoint remains unauthenticated.
- **Authorization**: Admin CRUD on display configs requires `AdminMiddleware` (unchanged). Type list is read-only for authenticated users.
- **Input validation**: `assetType` query param is whitelist-checked; `currency` param is validated server-side.
- **Data sanitization**: Display names are text-only, rendered as text in React (no `dangerouslySetInnerHTML`).

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `useQueryGetAssetDisplayPrices` | `utils/generated/hooks.ts` | Fetch silver VND types (same pattern as gold) |
| `Select` | `components/select/Select.tsx` | Silver type dropdown in watchlist form |
| `BasicFormSelect` | `components/forms/BasicFormSelect.tsx` | Silver type dropdown in investment form |

**New components needed:**

None — all changes modify existing components and data sources.

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-backend.md`: GoldHandler + SilverHandler now depend on `AssetDisplayConfigService` for VND types.
- Update `docs/architecture/c4-component-frontend.md`: Investment feature module — silver type dropdown now API-driven.

## Runtime Flow Diagram Updates

- Update `docs/architecture/flow-investment.md` (if it exists): "Create Investment" sequence shows type resolution from `AssetDisplayConfigService` instead of static registry.

---

### Task 0: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**
1. Update GoldHandler and SilverHandler component descriptions to note they read VND types from `AssetDisplayConfigService`
2. Update investment feature module description — silver dropdown now API-driven
3. Commit diagram changes

---

### Task 1: Add `ListForInvestment` Method to Service + Repository

**Files:**
- Modify: `src/go-backend/domain/service/interfaces.go` (add method to interface)
- Modify: `src/go-backend/domain/service/asset_display_config_service.go` (implement method)
- Modify: `src/go-backend/domain/repository/asset_display_config_repository.go` (add repo method)

**Security notes:** Read-only query, no authorization change needed. Filters by `enabled = true` AND `show_in_investment = true`.

**Step 1: Add repository method**

Add to `AssetDisplayConfigRepository` interface and implementation:
```go
// ListForInvestment returns enabled configs where show_in_investment = true, ordered by display_order ASC.
ListForInvestment(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error)
```

Implementation:
```go
func (r *assetDisplayConfigRepository) ListForInvestment(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
    var configs []*models.AssetDisplayConfig
    err := r.db.GetDB().WithContext(ctx).
        Where("asset_type = ? AND enabled = ? AND show_in_investment = ?", assetType, true, true).
        Order("display_order ASC").
        Find(&configs).Error
    if err != nil {
        return nil, apperrors.InternalErrorWithCause("query asset display configs for investment", err)
    }
    return configs, nil
}
```

**Step 2: Add service method**

Add to `AssetDisplayConfigService` interface:
```go
// ListForInvestment returns enabled configs where show_in_investment = true for the given assetType.
ListForInvestment(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error)
```

Implementation delegates to repository:
```go
func (s *assetDisplayConfigService) ListForInvestment(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
    return s.configRepo.ListForInvestment(ctx, assetType)
}
```

**Step 3: Verify compilation**
```bash
cd src/go-backend && go build ./...
```

**Step 4: Commit**

---

### Task 2: Refactor Gold Handler to Read VND Types from DB

**Files:**
- Modify: `src/go-backend/handlers/gold.go` (inject service, read from DB for VND)
- Modify: `src/go-backend/handlers/builder.go` (pass AssetDisplayConfigService to GoldHandler)

**Security notes:** Endpoint auth unchanged (requires `AuthMiddleware`). Response shape must remain backward-compatible.

**Step 1: Modify GoldHandler struct to accept AssetDisplayConfigService**

```go
type GoldHandler struct {
    displayConfigSvc service.AssetDisplayConfigService
}

func NewGoldHandler(displayConfigSvc service.AssetDisplayConfigService) *GoldHandler {
    return &GoldHandler{displayConfigSvc: displayConfigSvc}
}
```

**Step 2: Refactor GetGoldTypeCodes handler**

Logic:
- If `currency=USD` → return hardcoded XAUUSD from `gold.GetGoldTypesByCurrency("USD")`
- If `currency=VND` → call `displayConfigSvc.ListForInvestment(ctx, "gold")`, map to response shape
- If no currency → merge VND from DB + USD from static
- Response fields must include: `code`, `name`, `currency`, `unit`, `unitWeight`, `type`
- For VND gold from DB: `unit = "mace"`, `unitWeight = gold.GramsPerMace`, `type = 8`

**Step 3: Update builder.go**

Change:
```go
Gold: NewGoldHandler(),
```
To:
```go
Gold: NewGoldHandler(services.AssetDisplayConfig),
```

**Step 4: Verify compilation**
```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

---

### Task 3: Refactor Silver Handler to Read VND Types from DB

**Files:**
- Modify: `src/go-backend/handlers/silver.go` (inject service, read from DB for VND)
- Modify: `src/go-backend/handlers/builder.go` (pass AssetDisplayConfigService to SilverHandler)

**Security notes:** Same as Task 2.

**Step 1: Modify SilverHandler struct**

```go
type SilverHandler struct {
    displayConfigSvc service.AssetDisplayConfigService
}

func NewSilverHandler(displayConfigSvc service.AssetDisplayConfigService) *SilverHandler {
    return &SilverHandler{displayConfigSvc: displayConfigSvc}
}
```

**Step 2: Refactor GetSilverTypeCodes handler**

Logic:
- If `currency=USD` → return hardcoded XAGUSD from `silver.GetSilverTypesByCurrency("USD")`
- If `currency=VND` → call `displayConfigSvc.ListForInvestment(ctx, "silver")`, map to response shape
- If no currency → merge VND from DB + USD from static
- Response fields: `code`, `name`, `currency`, `type` (silver has no `unit`/`unitWeight` in response)

**Step 3: Update builder.go**

Change:
```go
Silver: NewSilverHandler(),
```
To:
```go
Silver: NewSilverHandler(services.AssetDisplayConfig),
```

**Step 4: Verify compilation**
```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

---

### Task 4: Remove VND Entries from Static Registries

**Files:**
- Modify: `src/go-backend/pkg/gold/types.go` (remove VND entries from GoldTypes, remove AliasToCanonical)
- Modify: `src/go-backend/pkg/silver/types.go` (remove VND entries from SilverTypes)

**Security notes:** No security impact — removing unused static data. Must verify no compilation errors.

**Step 1: Reduce GoldTypes to USD-only**

Replace the `GoldTypes` array with only the XAUUSD entry. Keep the `GoldType` struct, utility functions (`GetNativeStorageInfo`, `IsGoldType`, `GetPriceUnitForMarketData`), and constants.

**Step 2: Remove AliasToCanonical map**

Already deprecated per code comments (line 210). Delete the entire map.

**Step 3: Update GetGoldTypeByCode / GetGoldTypesByCurrency**

These functions still iterate `GoldTypes` — they'll now only return USD types. This is correct per spec: "GetGoldTypesByCurrency('VND') returns empty slice".

**Step 4: Reduce SilverTypes to USD-only**

Replace the `SilverTypes` array with only the XAGUSD entry.

**Step 5: Update GetSilverTypeByCode / GetSilverTypesByCurrency**

Same as gold — will now only return USD types.

**Step 6: Update public.go static fallback**

`staticGoldTypes()` and `staticSilverTypes()` use `gold.GoldTypes` / `silver.SilverTypes`. After removing VND entries, these will only return USD types on cold start. This is acceptable because:
- After first `PriceCacheJob` run (15 min), DB has all types
- The `GetPublicMarketTypes` handler's per-asset fallback will serve USD-only until DB is populated
- This is a brief cold-start-only degradation

**Alternative approach for public.go:** Instead of static fallback, read from `asset_display_config` table (which is seeded at deploy time). This is more robust. Change `staticGoldTypes()` and `staticSilverTypes()` to read from `AssetDisplayConfigService.ListForInvestment()`. However, `PublicHandler` currently only has `AssetPriceService` — would need `AssetDisplayConfigService` injected too. **Decision: Accept the cold-start-only degradation for now.** Static fallback is a safety net used for ~15 minutes on fresh deploy.

**Step 7: Verify compilation across entire codebase**
```bash
cd src/go-backend && go build ./...
```

**Step 8: Run lint**
```bash
cd src/go-backend && task ci:backend-lint
```

**Step 9: Commit**

---

### Task 5: Seed Migration — Update Silver Configs `show_in_investment = true`

**Files:**
- Create: `src/go-backend/cmd/migrate-silver-show-in-investment/main.go`
- Modify: `Taskfile.yml` (add `backend:migrate-silver-show-in-investment` task)

**Security notes:** Migration is additive (UPDATE only), idempotent, and targets only the `show_in_investment` flag.

**Step 1: Create migration**

The migration should:
1. Connect to DB
2. Execute: `UPDATE asset_display_config SET show_in_investment = true, updated_at = NOW() WHERE asset_type = 'silver' AND deleted_at IS NULL`
3. Log number of rows updated

This updates ALL silver configs to `show_in_investment = true`, matching the spec's intent that all silver types should be available for investment.

**Step 2: Add Taskfile entry**

```yaml
backend:migrate-silver-show-in-investment:
  desc: "Update all silver display configs to show_in_investment = true"
  dir: src/go-backend
  cmds:
    - go run cmd/migrate-silver-show-in-investment/main.go
```

**Step 3: Verify compilation**
```bash
cd src/go-backend && go build ./cmd/migrate-silver-show-in-investment/...
```

**Step 4: Commit**

---

### Task 6: Frontend — Silver Investment Form Reads from Admin Config API

**Files:**
- Modify: `src/wj-client/features/investment/forms/AddInvestmentForm.tsx` (silver options from API)

**Security notes:** No sensitive data; read-only API call. Graceful fallback if API unavailable.

**Step 0: Component inventory check**
- Reusing: `useQueryGetAssetDisplayPrices` (already imported and used for gold)
- Reusing: `BasicFormSelect` for dropdown
- No new components needed

**Step 1: Add silver API fetch (same pattern as gold, line ~257)**

Add alongside the existing `goldDisplayPricesQuery`:
```typescript
const silverDisplayPricesQuery = useQueryGetAssetDisplayPrices(
  { assetType: "silver" },
  {
    enabled: isSilverInvestment,
    staleTime: 5 * 60 * 1000,
  },
);
```

**Step 2: Build silver type options from API data**

Replace the hardcoded `getSilverTypeOptions()` call (line ~283-287) with:
```typescript
const silverTypeOptions = useMemo((): SilverTypeOption[] => {
  if (!isSilverInvestment) return [];
  const vndOptions: SilverTypeOption[] = (silverDisplayPricesQuery.data?.prices ?? [])
    .filter((p) => p.showInInvestment)
    .map((p) => ({
      value: p.typeCode,
      label: p.displayName,
      currency: "VND",
      type: 10, // InvestmentType.INVESTMENT_TYPE_SILVER_VND
      availableUnits: inferSilverUnits(p.typeCode), // derive from typeCode suffix
    }));
  return [...vndOptions, ...SILVER_USD_OPTIONS];
}, [isSilverInvestment, silverDisplayPricesQuery.data]);
```

**Step 3: Add helper to infer silver units from typeCode**

```typescript
function inferSilverUnits(typeCode: string): SilverUnit[] {
  if (typeCode.endsWith("KG") || typeCode.includes("1KG")) return ["kg"];
  if (typeCode.endsWith("L") || typeCode.includes("_1L") || typeCode.includes("_5L")) return ["tael"];
  return ["tael"]; // default
}
```

This matches the existing `silver.GetPriceUnitForMarketData()` logic in Go.

**Step 4: Verify TypeScript compilation**
```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 5: Commit**

---

### Task 7: Frontend — Remove Hardcoded VND Option Arrays

**Files:**
- Modify: `src/wj-client/features/investment/utils/gold-calculator.ts` (remove `GOLD_VND_OPTIONS`, update `getGoldTypeOptions`)
- Modify: `src/wj-client/features/investment/utils/silver-calculator.ts` (remove `SILVER_VND_OPTIONS`, update `getSilverTypeOptions`)

**Security notes:** No security impact — removing unused static data.

**Step 1: Remove `GOLD_VND_OPTIONS` from gold-calculator.ts (lines 23-42)**

Delete the array. Update `getGoldTypeOptions()` to return only USD:
```typescript
export function getGoldTypeOptions(currency?: string): GoldTypeOption[] {
  if (currency === 'USD' || !currency) {
    return GOLD_USD_OPTIONS;
  }
  return []; // VND options now come from API
}
```

Keep `GOLD_USD_OPTIONS` unchanged.

**Step 2: Remove `SILVER_VND_OPTIONS` from silver-calculator.ts (lines 35-49)**

Delete the array. Update `getSilverTypeOptions()` to return only USD:
```typescript
export function getSilverTypeOptions(currency?: string): SilverTypeOption[] {
  if (currency === 'USD' || !currency) {
    return SILVER_USD_OPTIONS;
  }
  return []; // VND options now come from API
}
```

Keep `SILVER_USD_OPTIONS` unchanged.

**Step 3: Verify no other consumers break**

Check for imports of `GOLD_VND_OPTIONS` and `SILVER_VND_OPTIONS`:
- `AddToWatchlistForm.tsx` — addressed in Task 8
- `price-alert-validation.ts` — addressed in Task 8
- Any test files — update as needed

**Step 4: Verify TypeScript compilation**
```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 5: Commit**

---

### Task 8: Frontend — Watchlist and Price Alert Forms Use Admin Config

**Files:**
- Modify: `src/wj-client/features/watchlist/forms/AddToWatchlistForm.tsx`
- Modify: `src/wj-client/features/price-alert/utils/price-alert-validation.ts`

**Security notes:** Read-only API calls. Fallback to empty list if API unavailable (not broken UI).

**Step 1: Update AddToWatchlistForm**

Replace imports of `GOLD_VND_OPTIONS` and `SILVER_VND_OPTIONS` with `useQueryGetAssetDisplayPrices` hooks:

```typescript
const goldQuery = useQueryGetAssetDisplayPrices({ assetType: "gold" });
const silverQuery = useQueryGetAssetDisplayPrices({ assetType: "silver" });

const goldVndOptions = useMemo(() =>
  (goldQuery.data?.prices ?? [])
    .filter(p => p.showInInvestment)
    .map(p => ({ value: p.typeCode, label: p.displayName })),
  [goldQuery.data]
);

const silverVndOptions = useMemo(() =>
  (silverQuery.data?.prices ?? [])
    .filter(p => p.showInInvestment)
    .map(p => ({ value: p.typeCode, label: p.displayName })),
  [silverQuery.data]
);
```

Update all references from `GOLD_VND_OPTIONS` → `goldVndOptions` and `SILVER_VND_OPTIONS` → `silverVndOptions`.

Handle loading states: show a loading indicator or disabled dropdown while queries are in-flight.

**Step 2: Update price-alert-validation.ts**

Remove the duplicated `GOLD_VND_ALERT_OPTIONS` and `SILVER_VND_ALERT_OPTIONS` arrays. Since this is a utils file (not a component), it can't use hooks directly. Options:

Option A: Make the validation schema accept dynamic options (pass options as parameter).
Option B: Keep a minimal static fallback and note that runtime validation happens server-side.

**Recommended: Option A** — change the Zod schema to not validate against a static symbol list. The server already validates that the symbol exists. The client-side Zod schema should validate format (non-empty string, max length) but not the exact symbol values. Remove the hardcoded arrays.

**Step 3: Verify TypeScript compilation**
```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 4: Commit**

---

### Task 9: Backend Lint + Frontend Lint + Full Build Verification

**Files:** None (verification only)

**Step 1: Backend lint**
```bash
cd src/go-backend && task ci:backend-lint
```

**Step 2: Frontend lint**
```bash
cd src/wj-client && npm run lint
```

**Step 3: Backend build**
```bash
cd src/go-backend && go build ./...
```

**Step 4: Frontend build**
```bash
cd src/wj-client && npm run build
```

**Step 5: Commit any lint fixes**

---

### Task 10: Create/Update Runtime Flow Diagrams

**Files:**
- Modify: `docs/architecture/flow-investment.md` (if exists)

**Steps:**
1. Read the implemented gold/silver handler code to trace the actual runtime flow
2. Update the "Create Investment" sequence diagram to show type resolution from `AssetDisplayConfigService.ListForInvestment()` instead of static registry lookup
3. Add note about USD types remaining hardcoded
4. Update `docs/architecture/README.md` if needed
5. Commit

**When to skip:** If `flow-investment.md` doesn't exist and the change is a simple data-source swap (which it is), this can be a brief update or skip.

---

## Task Dependency Order

```
Task 0 (C4 diagrams)         — independent, can run first or parallel
Task 1 (ListForInvestment)    — MUST be first (backend foundation)
Task 2 (Gold handler)         — depends on Task 1
Task 3 (Silver handler)       — depends on Task 1, parallel with Task 2
Task 4 (Remove static VND)    — depends on Task 2 + Task 3
Task 5 (Silver seed migration) — independent of code changes
Task 6 (Frontend silver form) — depends on Task 3 (backend API available)
Task 7 (Remove FE arrays)     — depends on Task 6
Task 8 (Watchlist + alerts)   — depends on Task 7
Task 9 (Full verification)    — depends on all above
Task 10 (Flow diagrams)       — depends on Task 4 (final backend shape)
```

**Parallel-safe groups:**
- Task 0 + Task 1 + Task 5 (all independent)
- Task 2 + Task 3 (both depend only on Task 1)
- Task 6 can start after Task 3
- Task 7 + Task 8 are sequential (Task 8 depends on removal of arrays in Task 7)

## Security-Specific Validation

All tasks in this plan are read-path changes (query existing DB, remove static arrays). No new write endpoints, no new input validation paths, no new authorization rules. The only security-relevant consideration:

- **T-4 from spec (info disclosure):** `ListForInvestment` filters by `enabled=true` AND `show_in_investment=true` — disabled configs are never exposed to users. This is enforced in the repository query, not post-fetch filtering.
