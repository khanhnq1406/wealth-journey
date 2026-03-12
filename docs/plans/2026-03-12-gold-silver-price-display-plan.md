# Gold & Silver Price Display Improvements — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Filter gold table to 9 types with custom names, show API timestamps in "Cập nhật dd/mm/yyyy HH:mm" format, and replace Select dropdowns with toggle buttons in charts.

**Spec:** `docs/specs/2026-03-12-gold-silver-price-display-spec.md`

**Architecture:** Display-only changes spanning backend (vnprice parsing, public handler) and frontend (4 tables, 4 charts). No new endpoints, no auth changes, no data model changes.

**Tech Stack:** Go (vnprice client, handlers), TypeScript/React (Next.js components), next-intl (i18n)

## Security Implementation Notes

- No new endpoints or auth changes
- No new user inputs — all changes are display/formatting
- Backend: Additional API array parsing (vsg_gold_table) — same trusted source
- Frontend: Gold type filtering uses strict type code matching (not index-based)
- Public endpoint enhancement: adds read-only timestamp fields, no sensitive data exposure

---

### Task 1: Parse `vsg_gold_table` in vnprice client

**Files:**
- Modify: `src/go-backend/pkg/vnprice/client.go:59-103` (add VSGGoldTable parsing after GoldNationWide loop)

**Steps:**

**Step 1:** Add VSGGoldTable parsing loop after GoldNationWide (line 103) in `FetchPrices()`:

```go
// After line 103 (end of GoldNationWide loop), add:
for _, entry := range apiResp.VSGGoldTable {
    if entry.Name == "" {
        continue
    }
    region := entry.Saigon
    if region.Buy == 0 || region.Sell == 0 {
        region = entry.Hanoi
    }
    goldPrices = append(goldPrices, GoldPrice{
        Name:       entry.Name,
        Buy:        region.Buy,
        Sell:       region.Sell,
        BuyChange:  region.BuyChange,
        SellChange: region.SellChange,
        Currency:   "VND",
        Digit:      entry.Digit,
        UpdateAt:   entry.UpdateAt,
    })
}
```

**Step 2:** Verify Go compiles:
```bash
cd src/go-backend && go build ./...
```

**Step 3:** Commit

---

### Task 2: Add `goldUpdatedAt` and `silverUpdatedAt` to public endpoint

**Files:**
- Modify: `src/go-backend/handlers/public.go` (inject price services, add timestamps)
- Modify: `src/go-backend/handlers/builder.go` (wire price services to PublicHandler)

**Steps:**

**Step 1:** Update `PublicHandler` struct to accept price services:

In `public.go`, change:
```go
type PublicHandler struct{}

func NewPublicHandler() *PublicHandler {
    return &PublicHandler{}
}
```
To:
```go
type PublicHandler struct {
    goldSvc   service.GoldPriceService
    silverSvc service.SilverPriceService
}

func NewPublicHandler(goldSvc service.GoldPriceService, silverSvc service.SilverPriceService) *PublicHandler {
    return &PublicHandler{
        goldSvc:   goldSvc,
        silverSvc: silverSvc,
    }
}
```

Add imports: `"sync"`, `"wealthjourney/domain/service"`

**Step 2:** In `GetPublicMarketTypes()`, fetch latest timestamps using parallel goroutines:

After building goldTypes and silverTypes arrays, add:
```go
// Fetch latest update timestamps (best-effort, don't fail if unavailable)
var goldUpdatedAt, silverUpdatedAt int64
var wg sync.WaitGroup
wg.Add(2)

go func() {
    defer wg.Done()
    if h.goldSvc == nil {
        return
    }
    prices, err := h.goldSvc.FetchAllPrices(c.Request.Context())
    if err != nil || len(prices) == 0 {
        return
    }
    var latest time.Time
    for _, p := range prices {
        if p.UpdateTime.After(latest) {
            latest = p.UpdateTime
        }
    }
    if !latest.IsZero() {
        goldUpdatedAt = latest.Unix()
    }
}()

go func() {
    defer wg.Done()
    if h.silverSvc == nil {
        return
    }
    prices, err := h.silverSvc.FetchAllPrices(c.Request.Context())
    if err != nil || len(prices) == 0 {
        return
    }
    var latest time.Time
    for _, p := range prices {
        if p.UpdateTime.After(latest) {
            latest = p.UpdateTime
        }
    }
    if !latest.IsZero() {
        silverUpdatedAt = latest.Unix()
    }
}()

wg.Wait()
```

Then add to response JSON:
```go
c.JSON(http.StatusOK, gin.H{
    "success":          true,
    "message":          "Market types retrieved successfully",
    "gold":             goldTypes,
    "silver":           silverTypes,
    "goldUpdatedAt":    goldUpdatedAt,
    "silverUpdatedAt":  silverUpdatedAt,
    "timestamp":        time.Now().Format(time.RFC3339),
})
```

**Step 3:** In `builder.go`, update `NewPublicHandler()` call (line 105) to pass price services:

Change:
```go
Public: NewPublicHandler(),
```
To:
```go
Public: NewPublicHandler(
    func() service.GoldPriceService {
        if deps.RDB != nil {
            return service.NewGoldPriceService(deps.RDB.GetClient())
        }
        return nil
    }(),
    func() service.SilverPriceService {
        if deps.RDB != nil {
            return service.NewSilverPriceService(deps.RDB.GetClient())
        }
        return nil
    }(),
),
```

Note: We could reuse the same service instances as `marketPricesHandler`, but creating separate instances keeps it clean. The services are stateless wrappers around shared Redis client.

**Step 4:** Verify Go compiles:
```bash
cd src/go-backend && go build ./...
```

**Step 5:** Commit

---

### Task 3: Create shared gold table filter constant (frontend)

**Files:**
- Create: `src/wj-client/features/market-prices/constants/gold-filter.ts`

**Steps:**

**Step 1:** Create the gold filter constant file:

```typescript
/**
 * Gold price table filter configuration.
 * Defines the 9 gold types to show in price tables, their display order,
 * and display name overrides.
 *
 * `apiSource` documents which API array the type comes from (informational only).
 * `apiName` is the exact Name field from the API response used for matching.
 * `displayName` is the user-facing label shown in the table.
 */
export const GOLD_TABLE_FILTER: {
  apiName: string;
  displayName: string;
}[] = [
  { apiName: "SJC", displayName: "SJC" },
  { apiName: "SJC TD", displayName: "SJC Tự Do" },
  { apiName: "Vàng nhẫn SJC", displayName: "Nhẫn SJC 9999" },
  { apiName: "Doji_24K", displayName: "Nhẫn Doji 9999" },
  { apiName: "Mi hồng", displayName: "SJC Mi Hồng" },
  { apiName: "Mihong_999", displayName: "Nhẫn Mi Hồng 9999" },
  { apiName: "BTMC", displayName: "SJC BTMC" },
  { apiName: "BTMC_24K", displayName: "Nhẫn BTMC" },
  { apiName: "PNJ HCM", displayName: "PNJ" },
];

/**
 * Filter and reorder gold prices to show only the configured types.
 * Matches by typeCode (which corresponds to API Name field).
 * Missing types are silently skipped (graceful degradation).
 */
export function filterGoldPrices<T extends { typeCode?: string; name?: string }>(
  prices: T[],
): (T & { displayName: string })[] {
  const result: (T & { displayName: string })[] = [];

  for (const filter of GOLD_TABLE_FILTER) {
    const match = prices.find(
      (p) => p.typeCode === filter.apiName || p.name === filter.apiName,
    );
    if (match) {
      result.push({ ...match, displayName: filter.displayName });
    }
  }

  return result;
}
```

**Step 2:** Commit

---

### Task 4: Create shared timestamp formatting utility (frontend)

**Files:**
- Create: `src/wj-client/features/market-prices/utils/format-update-time.ts`

**Steps:**

**Step 1:** Create the utility:

```typescript
/**
 * Format a Unix timestamp (seconds) into "Cập nhật dd/mm/yyyy HH:mm" format.
 * Falls back to current time if timestamp is invalid or zero.
 *
 * @param unixTimestamp - Unix timestamp in seconds (from API's UpdatedAt field)
 * @returns Formatted string like "12/03/2026 14:30"
 */
export function formatUpdateTimestamp(unixTimestamp: number | undefined): string {
  let date: Date;

  if (unixTimestamp && unixTimestamp > 0) {
    date = new Date(unixTimestamp * 1000);
    // Guard against invalid dates (e.g. 0001-01-01)
    if (Number.isNaN(date.getTime()) || date.getFullYear() < 2020) {
      date = new Date();
    }
  } else {
    date = new Date();
  }

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Get the most recent UpdatedAt timestamp from a list of price items.
 */
export function getLatestTimestamp(
  items: { updatedAt?: number | string }[],
): number {
  let latest = 0;
  for (const item of items) {
    const ts = typeof item.updatedAt === "string"
      ? Number(item.updatedAt)
      : (item.updatedAt ?? 0);
    if (ts > latest) {
      latest = ts;
    }
  }
  return latest;
}
```

**Step 2:** Commit

---

### Task 5: Update GoldPriceTable (home dashboard) — filter + timestamp

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/GoldPriceTable.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/home/page.tsx` (pass timestamp from API data)

**Steps:**

**Step 1:** Update `GoldPriceTable.tsx` — import filter, apply to prices, use `displayName`:

```typescript
"use client";

import { useTranslations } from "next-intl";
import { formatPriceValue } from "../prices/helpers";
import { BaseCard } from "@/components/BaseCard";
import type { PriceItem } from "@/gen/protobuf/v1/investment";
import { filterGoldPrices } from "@/features/market-prices/constants/gold-filter";

interface GoldPriceTableProps {
  prices: PriceItem[];
  updatedTime?: string;
}

export function GoldPriceTable({ prices, updatedTime }: GoldPriceTableProps) {
  const t = useTranslations("dashboard.home");

  // Filter and reorder to show only 9 configured gold types
  const filteredPrices = filterGoldPrices(prices);

  return (
    <BaseCard padding="none" className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("goldPriceTitle")}
          </h3>
          {updatedTime && (
            <span className="font-jetbrains text-[11px] text-v2-text-tertiary">
              {t("updated", { time: updatedTime })}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-v2-gold-light">
              <th className="text-left px-5 py-2.5 font-jetbrains font-semibold text-[11px] tracking-[1px] text-v2-gold-dark">
                {t("goldType")}
              </th>
              <th className="text-right px-5 py-2.5 font-jetbrains font-semibold text-[11px] tracking-[1px] text-v2-gold-dark">
                {t("buy")}
              </th>
              <th className="text-right px-5 py-2.5 font-jetbrains font-semibold text-[11px] tracking-[1px] text-v2-gold-dark">
                {t("sell")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredPrices.map((item, index) => (
              <tr
                key={item.typeCode || index}
                className={index % 2 === 0 ? "bg-white" : "bg-v2-bg-surface-tint"}
              >
                <td className="px-5 py-3 font-vietnam font-medium text-[13px] text-v2-text-primary">
                  {item.displayName}
                </td>
                <td className="px-5 py-3 text-right font-jetbrains font-medium text-[13px] text-v2-text-primary">
                  {formatPriceValue(item.buy, item.currency || "VND")}
                </td>
                <td className="px-5 py-3 text-right font-jetbrains font-medium text-[13px] text-v2-text-primary">
                  {formatPriceValue(item.sell, item.currency || "VND")}
                </td>
              </tr>
            ))}
            {filteredPrices.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center font-vietnam text-[13px] text-v2-text-tertiary">
                  {t("comingSoon")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </BaseCard>
  );
}
```

**Step 2:** Update `page.tsx` — replace `formatUpdateTime()` with API-sourced timestamp:

Replace the `formatUpdateTime` function (lines 108-111) and its usage with:

```typescript
import { formatUpdateTimestamp, getLatestTimestamp } from "@/features/market-prices/utils/format-update-time";
```

Remove the `formatUpdateTime` function entirely. Then change the GoldPriceTable/SilverPriceTable usages:

```typescript
// Gold/silver prices
const goldPrices = marketPrices?.gold ?? [];
const silverPrices = marketPrices?.silver ?? [];

// Update timestamps from API data
const goldUpdatedTime = formatUpdateTimestamp(getLatestTimestamp(goldPrices));
const silverUpdatedTime = formatUpdateTimestamp(getLatestTimestamp(silverPrices));
```

Then in both mobile and desktop layouts, replace `updatedTime={formatUpdateTime()}` with:
- GoldPriceTable: `updatedTime={goldUpdatedTime}`
- SilverPriceTable: `updatedTime={silverUpdatedTime}`

**Step 3:** Commit

---

### Task 6: Update SilverPriceTable (home dashboard) — timestamp only

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/SilverPriceTable.tsx` — no filtering needed (spec says show all silver types)

**Note:** No changes needed to SilverPriceTable.tsx itself — the timestamp update was handled in Task 5 via page.tsx. Silver table already uses `updatedTime` prop correctly.

**Skip this task** — already handled in Task 5.

---

### Task 7: Update LandingGoldPriceTable — filter + timestamp

**Files:**
- Modify: `src/wj-client/components/landing/LandingGoldPriceTable.tsx`
- Modify: `src/wj-client/features/market-prices/hooks/usePublicMarketTypes.ts` (add timestamp fields to response type)
- Modify: `src/wj-client/app/[locale]/landing/page.tsx` (pass timestamps to tables)

**Steps:**

**Step 1:** Update `usePublicMarketTypes.ts` — add timestamp fields to response type:

```typescript
export interface PublicMarketTypesResponse {
  success: boolean;
  message: string;
  gold: MarketTypeItem[];
  silver: MarketTypeItem[];
  goldUpdatedAt: number;     // Unix timestamp
  silverUpdatedAt: number;   // Unix timestamp
  timestamp: string;
}
```

**Step 2:** Update `LandingGoldPriceTable.tsx` — add filtering and timestamp display:

Add props:
```typescript
interface LandingGoldPriceTableProps {
  types: MarketTypeItem[];
  isLoading?: boolean;
  updatedTime?: string;
}
```

Import filter:
```typescript
import { GOLD_TABLE_FILTER } from "@/features/market-prices/constants/gold-filter";
```

Inside the component, filter types:
```typescript
const filteredTypes = GOLD_TABLE_FILTER
  .map((filter) => {
    const match = types.find((t) => t.code === filter.apiName || t.name === filter.apiName);
    return match ? { ...match, displayName: filter.displayName } : null;
  })
  .filter(Boolean) as (MarketTypeItem & { displayName: string })[];
```

Add timestamp display in header (same pattern as dashboard version):
```typescript
{updatedTime && (
  <span className="font-jetbrains text-[11px] text-v2-text-tertiary">
    {updatedTime}
  </span>
)}
```

Use `filteredTypes` for rendering and show `item.displayName` instead of `item.name`.

**Step 3:** Update `LandingSilverPriceTable.tsx` — add timestamp prop and display:

Add `updatedTime?: string` to props. Add timestamp display in header.

**Step 4:** Update `landing/page.tsx` — pass timestamps to tables:

```typescript
import { formatUpdateTimestamp } from "@/features/market-prices/utils/format-update-time";

// After data fetch:
const goldUpdatedTime = data?.goldUpdatedAt
  ? formatUpdateTimestamp(data.goldUpdatedAt)
  : undefined;
const silverUpdatedTime = data?.silverUpdatedAt
  ? formatUpdateTimestamp(data.silverUpdatedAt)
  : undefined;

// Pass to components:
<LandingGoldPriceTable types={goldTypes} isLoading={isLoading} updatedTime={goldUpdatedTime} />
<LandingSilverPriceTable types={silverTypes} isLoading={isLoading} updatedTime={silverUpdatedTime} />
```

**Step 5:** Commit

---

### Task 8: Replace Select dropdown with toggle in GoldPriceChart (home)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/GoldPriceChart.tsx`

**Steps:**

**Step 1:** Remove the Select import and GOLD_CODE_OPTIONS constant:

Remove:
```typescript
import { Select } from "@/components/select/Select";
import type { SelectOption } from "@/components/select/Select";

const GOLD_CODE_OPTIONS: SelectOption<string>[] = [
  { value: "SJC", label: "SJC" },
  { value: "999", label: "999" },
];
```

**Step 2:** Replace the Select component (lines 148-159) with toggle buttons matching the market toggle pattern:

Replace:
```tsx
{!isGlobal && (
  <Select<string>
    options={GOLD_CODE_OPTIONS}
    value={goldCode}
    onChange={setGoldCode}
    disableInput
    disableFilter
    clearable={false}
    className="w-24"
  />
)}
```

With:
```tsx
{!isGlobal && (
  <div className="flex bg-v2-bg-primary rounded-lg p-0.5">
    {[
      { value: "SJC", label: "SJC" },
      { value: "999", label: "999" },
    ].map((opt) => (
      <button
        key={opt.value}
        onClick={() => setGoldCode(opt.value)}
        className={`px-2.5 py-1 rounded-md text-[11px] font-vietnam font-medium transition-colors ${
          goldCode === opt.value
            ? "bg-white shadow-sm text-v2-text-primary"
            : "text-v2-text-secondary"
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
)}
```

**Step 3:** Commit

---

### Task 9: Replace Select dropdown with toggle in SilverPriceChart (home)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/SilverPriceChart.tsx`

**Steps:**

**Step 1:** Remove the Select import:

Remove:
```typescript
import { Select } from "@/components/select/Select";
import type { SelectOption } from "@/components/select/Select";
```

**Step 2:** Replace the Select component (lines 148-161) with toggle buttons:

Replace:
```tsx
{!isGlobal && (
  <Select<"C" | "L" | "KG">
    options={unitOptions.map((u): SelectOption<"C" | "L" | "KG"> => ({
      value: u.key,
      label: u.label,
    }))}
    value={silverUnit}
    onChange={setSilverUnit}
    disableInput
    disableFilter
    clearable={false}
    className="w-24"
  />
)}
```

With:
```tsx
{!isGlobal && (
  <div className="flex bg-v2-bg-primary rounded-lg p-0.5">
    {unitOptions.map((opt) => (
      <button
        key={opt.key}
        onClick={() => setSilverUnit(opt.key)}
        className={`px-2.5 py-1 rounded-md text-[11px] font-vietnam font-medium transition-colors ${
          silverUnit === opt.key
            ? "bg-white shadow-sm text-v2-text-primary"
            : "text-v2-text-secondary"
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
)}
```

**Step 3:** Commit

---

### Task 10: Update LandingGoldPriceChart — toggle for gold code selector

**Files:**
- Modify: `src/wj-client/components/landing/LandingGoldPriceChart.tsx`

**Steps:**

**Step 1:** Replace the placeholder div (line 38) with a toggle button group:

Replace:
```tsx
{/* Gold code selector placeholder */}
<div className="w-24 h-7 bg-v2-bg-surface-tint rounded-md" />
```

With:
```tsx
{/* Gold code toggle placeholder */}
<div className="flex items-center bg-v2-bg-surface-tint rounded-lg p-0.5">
  <button className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white shadow-sm text-v2-text-primary">
    SJC
  </button>
  <button className="px-2.5 py-1 rounded-md text-[11px] font-medium text-v2-text-secondary">
    999
  </button>
</div>
```

**Step 2:** Commit

---

### Task 11: Update i18n translations

**Files:**
- Modify: `src/wj-client/messages/vi/ui.json` (dashboard.home section)
- Modify: `src/wj-client/messages/en/ui.json` (dashboard.home section)
- Modify: `src/wj-client/messages/vi/nav.json` (landing.priceTeaser section)
- Modify: `src/wj-client/messages/en/nav.json` (landing.priceTeaser section)

**Steps:**

**Step 1:** Update `vi/ui.json` — change the `updated` key format in dashboard.home:

The current value is `"updated": "Cập nhật {time}"` which already works — the `{time}` placeholder now receives a `dd/mm/yyyy HH:mm` formatted string instead of just `HH:mm`. No change needed.

**Step 2:** Update `en/ui.json` — same, current value is `"updated": "Updated {time}"` — no change needed.

**Step 3:** Add `updatedTime` translation key to landing page translations in `vi/nav.json` and `en/nav.json`:

In `landing.priceTeaser` section, add:
```json
"updatedTime": "Cập nhật {time}"  // vi
"updatedTime": "Updated {time}"   // en
```

**Step 4:** Commit

---

### Task 12: Verify and test

**Steps:**

**Step 1:** Build backend:
```bash
cd src/go-backend && go build ./...
```

**Step 2:** Build frontend:
```bash
cd src/wj-client && npm run build
```

**Step 3:** Visual verification checklist:
- [ ] Gold table shows 9 rows in correct order with custom display names
- [ ] Silver table shows all types (no filtering)
- [ ] Both tables show "Cập nhật dd/mm/yyyy HH:mm" from API timestamp
- [ ] Landing page tables also show timestamps and gold filtering
- [ ] Gold chart has SJC|999 toggle (not dropdown)
- [ ] Silver chart has C|L|KG toggle (not dropdown)
- [ ] Landing gold chart shows SJC|999 toggle placeholder (not grey box)
- [ ] All toggles match market domestic/global toggle styling
- [ ] Mobile layouts work correctly

**Step 4:** Commit final

---

## Task Summary

| # | Task | Files Changed | Estimated Effort |
|---|------|---------------|-----------------|
| 1 | Parse vsg_gold_table in vnprice client | client.go | Small |
| 2 | Add timestamps to public endpoint | public.go, builder.go | Medium |
| 3 | Create gold filter constant | gold-filter.ts (new) | Small |
| 4 | Create timestamp formatting utility | format-update-time.ts (new) | Small |
| 5 | Update GoldPriceTable + page.tsx | GoldPriceTable.tsx, page.tsx | Medium |
| 6 | ~~Update SilverPriceTable~~ | ~~(handled in T5)~~ | Skipped |
| 7 | Update landing tables + hook + page | LandingGoldPriceTable.tsx, LandingSilverPriceTable.tsx, usePublicMarketTypes.ts, landing/page.tsx | Medium |
| 8 | Gold chart toggle (home) | GoldPriceChart.tsx | Small |
| 9 | Silver chart toggle (home) | SilverPriceChart.tsx | Small |
| 10 | Landing gold chart toggle | LandingGoldPriceChart.tsx | Small |
| 11 | i18n translations | nav.json (vi/en) | Small |
| 12 | Build verification | — | Small |

**Dependencies:** Tasks 1-2 (backend) are independent from Tasks 3-4 (frontend utilities). Tasks 5, 7-11 depend on Tasks 3-4. Task 12 depends on all.

**Parallel execution:** Tasks 1+2 can run in parallel. Tasks 3+4 can run in parallel. Tasks 8+9+10 can run in parallel.
