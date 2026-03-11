# Landing Page Redesign — Gold/Silver Price Teaser Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace the marketing-heavy landing page with a minimal design showcasing gold/silver price tables (with login prompts) and disabled chart shells, driving visitors to sign up.

**Spec:** `docs/specs/2026-03-11-landing-page-redesign-spec.md`

**Architecture:** New public backend endpoint returns gold/silver type names from in-memory registries (no auth, no DB). Frontend landing page replaced with price tables + disabled chart shells using existing dashboard component patterns.

**Tech Stack:** Go/Gin (backend handler), Next.js/React/Tailwind (frontend), next-intl (i18n), Recharts (chart axes)

## Security Implementation Notes

- **Authentication:** Public endpoint — NO auth required by design. Only exposes type names/currency (public knowledge).
- **Authorization:** N/A — no user-scoped data.
- **Input validation:** Endpoint accepts no input (empty GET request). No validation needed.
- **Rate limiting:** IP-based rate limiting on public route group to prevent abuse.
- **Data exposure:** Only type code, name, and currency exposed — no prices, no user data, no internal IDs.

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-backend.md` — Add `PublicHandler` component to the Handlers layer
- Update `docs/architecture/c4-component-frontend.md` — Update Landing Page component list (remove old marketing components, add new price teaser components)

---

### Task 0: Add Proto Messages & Generate Code

**Files:**
- Modify: `api/protobuf/v1/investment.proto`
- Generated: `src/go-backend/protobuf/v1/investment.pb.go` (auto)
- Generated: `src/wj-client/gen/protobuf/v1/investment.ts` (auto)
- Generated: `src/wj-client/utils/generated/hooks.ts` (auto)

**Security notes:** Proto messages expose only code, name, currency — no sensitive fields.

**Steps:**

1. Add proto messages to `api/protobuf/v1/investment.proto`:

```protobuf
// Public market type item (no prices)
message MarketTypeItem {
  string code = 1 [json_name = "code"];
  string name = 2 [json_name = "name"];
  string currency = 3 [json_name = "currency"];
}

message GetPublicMarketTypesRequest {}

message GetPublicMarketTypesResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated MarketTypeItem gold = 3 [json_name = "gold"];
  repeated MarketTypeItem silver = 4 [json_name = "silver"];
  string timestamp = 5 [json_name = "timestamp"];
}
```

Add RPC to `InvestmentService`:
```protobuf
rpc GetPublicMarketTypes(GetPublicMarketTypesRequest) returns (GetPublicMarketTypesResponse) {
  option (google.api.http) = {
    get: "/api/v1/public/market-types"
  };
}
```

2. Run code generation:
```bash
task proto:all
```

3. Verify generated code compiles:
```bash
cd src/go-backend && go build ./...
```

4. Commit: `feat(landing): add public market types proto messages`

---

### Task 1: Create Public Handler — GetPublicMarketTypes

**Files:**
- Create: `src/go-backend/handlers/public.go`
- Modify: `src/go-backend/handlers/builder.go` — Add `Public *PublicHandler` to `AllHandlers`
- Modify: `src/go-backend/handlers/routes.go` — Add public route group

**Security notes:**
- No auth middleware on this route group
- IP-based rate limiting applied
- Handler reads from in-memory registries only — no DB access, no external calls

**Step 1: Create public handler**

Create `src/go-backend/handlers/public.go`:

```go
package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/pkg/gold"
	"wealthjourney/pkg/silver"
)

// PublicHandler handles public (no auth) endpoints
type PublicHandler struct{}

// NewPublicHandler creates a new public handler
func NewPublicHandler() *PublicHandler {
	return &PublicHandler{}
}

// GetPublicMarketTypes returns gold/silver type names without prices
// GET /api/v1/public/market-types
func (h *PublicHandler) GetPublicMarketTypes(c *gin.Context) {
	// Build gold types (code, name, currency only)
	goldTypes := make([]gin.H, len(gold.GoldTypes))
	for i, gt := range gold.GoldTypes {
		goldTypes[i] = gin.H{
			"code":     gt.Code,
			"name":     gt.Name,
			"currency": gt.Currency,
		}
	}

	// Build silver types (code, name, currency only)
	silverTypes := make([]gin.H, len(silver.SilverTypes))
	for i, st := range silver.SilverTypes {
		silverTypes[i] = gin.H{
			"code":     st.Code,
			"name":     st.Name,
			"currency": st.Currency,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Market types retrieved successfully",
		"gold":      goldTypes,
		"silver":    silverTypes,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}
```

**Step 2: Wire handler in builder.go**

Add `Public *PublicHandler` field to `AllHandlers` struct (after `Community`).

In `NewHandlers()`, add:
```go
Public: NewPublicHandler(),
```

**Step 3: Register public route in routes.go**

Add a new public route group BEFORE the auth group (at the top of `RegisterRoutes`):

```go
// Public routes (no auth required)
publicGroup := v1.Group("/public")
if rateLimiter != nil {
    publicGroup.Use(appmiddleware.RateLimitByIP(rateLimiter))
}
{
    publicGroup.GET("/market-types", h.Public.GetPublicMarketTypes)
}
```

**Step 4: Verify backend builds and endpoint works**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

`feat(landing): add public market types endpoint`

---

### Task 2: Add i18n Translation Keys

**Files:**
- Modify: `src/wj-client/messages/en/nav.json` — Add landing price teaser keys
- Modify: `src/wj-client/messages/vi/nav.json` — Add Vietnamese translations

**Security notes:** None — translation files only.

**Step 1: Add English translation keys**

Add to the `landing` namespace in `messages/en/nav.json`:

```json
"priceTeaser": {
  "goldTableTitle": "Gold Prices",
  "silverTableTitle": "Silver Prices",
  "goldType": "GOLD TYPE",
  "silverType": "SILVER TYPE",
  "buy": "BUY",
  "sell": "SELL",
  "loginPrompt": "Please {loginLink} to view prices",
  "loginLink": "sign in",
  "goldChartTitle": "Gold Price Chart",
  "silverChartTitle": "Silver Price Chart",
  "chartLoginPrompt": "Sign in to view chart",
  "domesticMarket": "Domestic",
  "globalMarket": "Global",
  "period24h": "24h",
  "periodWeek": "Week",
  "periodMonth": "Month",
  "periodYear": "Year",
  "loadingTypes": "Loading market types...",
  "errorLoadingTypes": "Could not load market data",
  "retry": "Retry",
  "noData": "No data available"
}
```

**Step 2: Add Vietnamese translation keys**

Add to the `landing` namespace in `messages/vi/nav.json`:

```json
"priceTeaser": {
  "goldTableTitle": "Giá Vàng",
  "silverTableTitle": "Giá Bạc",
  "goldType": "LOẠI VÀNG",
  "silverType": "LOẠI BẠC",
  "buy": "MUA",
  "sell": "BÁN",
  "loginPrompt": "Vui lòng {loginLink} để xem giá",
  "loginLink": "đăng nhập",
  "goldChartTitle": "Biểu Đồ Giá Vàng",
  "silverChartTitle": "Biểu Đồ Giá Bạc",
  "chartLoginPrompt": "Đăng nhập để xem biểu đồ",
  "domesticMarket": "Trong nước",
  "globalMarket": "Thế giới",
  "period24h": "24h",
  "periodWeek": "Tuần",
  "periodMonth": "Tháng",
  "periodYear": "Năm",
  "loadingTypes": "Đang tải dữ liệu...",
  "errorLoadingTypes": "Không thể tải dữ liệu thị trường",
  "retry": "Thử lại",
  "noData": "Không có dữ liệu"
}
```

**Step 3: Commit**

`feat(landing): add i18n translation keys for price teaser`

---

### Task 3: Create Frontend API Hook for Public Market Types

**Files:**
- Create: `src/wj-client/features/market-prices/hooks/usePublicMarketTypes.ts`

**Security notes:** This hook calls a public endpoint — no auth token sent. Ensure it does NOT attach auth headers.

**Step 1: Create custom hook**

Since the public endpoint is outside the standard proto-generated auth flow, create a manual hook using React Query:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";

export interface MarketTypeItem {
  code: string;
  name: string;
  currency: string;
}

export interface PublicMarketTypesResponse {
  success: boolean;
  message: string;
  gold: MarketTypeItem[];
  silver: MarketTypeItem[];
  timestamp: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchPublicMarketTypes(): Promise<PublicMarketTypesResponse> {
  const res = await fetch(`${API_BASE}/api/v1/public/market-types`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    // No Authorization header — public endpoint
  });

  if (!res.ok) {
    throw new Error("Failed to fetch market types");
  }

  return res.json();
}

export function usePublicMarketTypes() {
  return useQuery<PublicMarketTypesResponse>({
    queryKey: ["public-market-types"],
    queryFn: fetchPublicMarketTypes,
    staleTime: 30 * 60 * 1000, // 30 minutes — types rarely change
    refetchOnWindowFocus: false,
  });
}
```

**Step 2: Commit**

`feat(landing): add public market types API hook`

---

### Task 4: Create LandingGoldPriceTable Component

**Files:**
- Create: `src/wj-client/components/landing/LandingGoldPriceTable.tsx`

**Security notes:** No sensitive data rendered. Login link uses Next.js `Link` — no open redirect risk.

**Step 1: Create the gold price table component**

Pattern follows dashboard `GoldPriceTable` but replaces price cells with login links.

```typescript
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import type { MarketTypeItem } from "@/features/market-prices/hooks/usePublicMarketTypes";

interface LandingGoldPriceTableProps {
  types: MarketTypeItem[];
  isLoading?: boolean;
}

export function LandingGoldPriceTable({ types, isLoading }: LandingGoldPriceTableProps) {
  const t = useTranslations("landing.priceTeaser");

  if (isLoading) {
    return (
      <BaseCard padding="none" className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden">
        <div className="p-5 pb-3">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("goldTableTitle")}
          </h3>
        </div>
        <div className="px-5 py-8 text-center font-vietnam text-[13px] text-v2-text-tertiary animate-pulse">
          {t("loadingTypes")}
        </div>
      </BaseCard>
    );
  }

  return (
    <BaseCard padding="none" className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-3">
        <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
          {t("goldTableTitle")}
        </h3>
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
            {types.map((item, index) => (
              <tr
                key={item.code}
                className={index % 2 === 0 ? "bg-white" : "bg-v2-bg-surface-tint"}
              >
                <td className="px-5 py-3 font-vietnam font-medium text-[13px] text-v2-text-primary">
                  {item.name || item.code}
                </td>
                <td className="px-5 py-3 text-right font-vietnam text-[12px] text-v2-text-secondary">
                  {t.rich("loginPrompt", {
                    loginLink: (chunks) => (
                      <Link
                        href="/auth/login"
                        className="font-semibold text-v2-red-primary hover:underline"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </td>
                <td className="px-5 py-3 text-right font-vietnam text-[12px] text-v2-text-secondary">
                  {t.rich("loginPrompt", {
                    loginLink: (chunks) => (
                      <Link
                        href="/auth/login"
                        className="font-semibold text-v2-red-primary hover:underline"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </td>
              </tr>
            ))}
            {types.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center font-vietnam text-[13px] text-v2-text-tertiary">
                  {t("noData")}
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

**Step 2: Commit**

`feat(landing): create LandingGoldPriceTable component`

---

### Task 5: Create LandingSilverPriceTable Component

**Files:**
- Create: `src/wj-client/components/landing/LandingSilverPriceTable.tsx`

**Security notes:** Same as Task 4 — no sensitive data, safe login links.

**Step 1: Create the silver price table component**

Same pattern as `LandingGoldPriceTable` with silver theming:

- Header title: `t("silverTableTitle")`
- Table header bg: `bg-v2-silver-light`
- Table header text: `text-v2-silver-dark`
- Column: `t("silverType")` instead of `t("goldType")`
- Login link pattern identical

**Step 2: Commit**

`feat(landing): create LandingSilverPriceTable component`

---

### Task 6: Create LandingGoldPriceChart Component (Disabled Shell)

**Files:**
- Create: `src/wj-client/components/landing/LandingGoldPriceChart.tsx`

**Security notes:** No data fetching — purely presentational. Login link uses Next.js `Link`.

**Step 1: Create the disabled gold chart shell**

Replicates the structure of dashboard `GoldPriceChart` but:
- All controls (market toggle, gold code selector, period tabs) rendered with `opacity-50 pointer-events-none`
- Chart area shows SVG with X/Y axes only (no Recharts — just simple SVG lines)
- Centered login button/link in chart area

```typescript
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BaseCard } from "@/components/BaseCard";

export function LandingGoldPriceChart() {
  const t = useTranslations("landing.priceTeaser");

  const periods = ["period24h", "periodWeek", "periodMonth", "periodYear"] as const;

  return (
    <BaseCard padding="none" className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("goldChartTitle")}
          </h3>
        </div>

        {/* Market toggle — disabled */}
        <div className="flex items-center gap-2 mb-3 opacity-50 pointer-events-none">
          <div className="flex items-center bg-v2-bg-surface-tint rounded-lg p-0.5">
            <button className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white shadow-sm text-v2-red-primary">
              {t("domesticMarket")}
            </button>
            <button className="px-2.5 py-1 rounded-md text-[11px] font-medium text-v2-text-secondary">
              {t("globalMarket")}
            </button>
          </div>
          {/* Gold code selector placeholder */}
          <div className="w-24 h-7 bg-v2-bg-surface-tint rounded-md" />
        </div>

        {/* Period tabs — disabled */}
        <div className="flex items-center gap-1 mb-4 opacity-50 pointer-events-none">
          {periods.map((period, i) => (
            <button
              key={period}
              className={`px-4 py-1.5 rounded-[10px] text-[12px] font-medium ${
                i === 0
                  ? "bg-v2-red-primary text-white"
                  : "bg-v2-bg-surface-tint text-v2-text-secondary"
              }`}
            >
              {t(period)}
            </button>
          ))}
        </div>

        {/* Chart area — axes only + login prompt */}
        <div className="relative" style={{ height: 400 }}>
          {/* SVG axes */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            {/* Y axis */}
            <line x1="40" y1="10" x2="40" y2="370" stroke="#e5e7eb" strokeWidth="1" />
            {/* X axis */}
            <line x1="40" y1="370" x2="100%" y2="370" stroke="#e5e7eb" strokeWidth="1" />
            {/* Grid lines (horizontal) */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={i}
                x1="40"
                y1={10 + i * 90}
                x2="100%"
                y2={10 + i * 90}
                stroke="#f3f4f6"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            ))}
          </svg>

          {/* Login overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Link
              href="/auth/login"
              className="px-6 py-3 bg-v2-red-primary text-white font-vietnam font-semibold text-[14px] rounded-xl hover:bg-v2-red-dark transition-colors shadow-lg"
            >
              {t("chartLoginPrompt")}
            </Link>
          </div>
        </div>
      </div>
    </BaseCard>
  );
}
```

**Step 2: Commit**

`feat(landing): create LandingGoldPriceChart disabled shell`

---

### Task 7: Create LandingSilverPriceChart Component (Disabled Shell)

**Files:**
- Create: `src/wj-client/components/landing/LandingSilverPriceChart.tsx`

**Security notes:** Same as Task 6 — purely presentational.

**Step 1: Create the disabled silver chart shell**

Same pattern as `LandingGoldPriceChart` with differences:
- Title: `t("silverChartTitle")`
- Active period tab color: `bg-v2-silver-dark text-white` (instead of `bg-v2-red-primary`)
- Chart height: `200` (instead of 400, matching dashboard SilverPriceChart)
- Market toggle uses same pattern
- Unit selector placeholder instead of gold code selector (labels: C, L, KG)
- SVG grid lines adjusted for shorter height

**Step 2: Commit**

`feat(landing): create LandingSilverPriceChart disabled shell`

---

### Task 8: Rewrite Landing Page

**Files:**
- Modify: `src/wj-client/app/[locale]/landing/page.tsx`

**Security notes:** No sensitive data. Page is public.

**Step 1: Replace landing page content**

Replace the current landing page with the new price teaser layout:

```typescript
"use client";

import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingErrorBoundary from "@/components/landing/LandingErrorBoundary";
import { LandingGoldPriceTable } from "@/components/landing/LandingGoldPriceTable";
import { LandingGoldPriceChart } from "@/components/landing/LandingGoldPriceChart";
import { LandingSilverPriceTable } from "@/components/landing/LandingSilverPriceTable";
import { LandingSilverPriceChart } from "@/components/landing/LandingSilverPriceChart";
import { usePublicMarketTypes } from "@/features/market-prices/hooks/usePublicMarketTypes";
import { useTranslations } from "next-intl";

export default function LandingPage() {
  const { data, isLoading, isError, refetch } = usePublicMarketTypes();
  const t = useTranslations("landing.priceTeaser");

  const goldTypes = data?.gold ?? [];
  const silverTypes = data?.silver ?? [];

  return (
    <LandingErrorBoundary>
      <div className="landing-scroll-container min-h-screen bg-neutral-50">
        <LandingNavbar />
        <main id="main-content" className="pt-14 sm:pt-16">
          {/* Error state */}
          {isError && (
            <div className="px-4 sm:px-8 py-8 text-center">
              <p className="font-vietnam text-v2-text-secondary mb-3">
                {t("errorLoadingTypes")}
              </p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-v2-red-primary text-white rounded-lg font-vietnam text-[13px] hover:bg-v2-red-dark transition-colors"
              >
                {t("retry")}
              </button>
            </div>
          )}

          {/* Mobile Layout */}
          <div className="sm:hidden px-4 py-4 pb-24 space-y-6">
            <LandingGoldPriceTable types={goldTypes} isLoading={isLoading} />
            <LandingGoldPriceChart />
            <LandingSilverPriceTable types={silverTypes} isLoading={isLoading} />
            <LandingSilverPriceChart />
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:block px-8 py-6 space-y-6">
            {/* Row 1: Gold Table + Gold Chart */}
            <div className="grid grid-cols-2 gap-6">
              <LandingGoldPriceTable types={goldTypes} isLoading={isLoading} />
              <LandingGoldPriceChart />
            </div>
            {/* Row 2: Silver Table + Silver Chart */}
            <div className="grid grid-cols-2 gap-6">
              <LandingSilverPriceTable types={silverTypes} isLoading={isLoading} />
              <LandingSilverPriceChart />
            </div>
          </div>
        </main>
      </div>
    </LandingErrorBoundary>
  );
}
```

**Key changes from current landing page:**
- Remove all old component imports (LandingHero, LandingFeatures, etc.)
- Remove LandingFooter, PWAInstallPrompt
- Add data fetching via `usePublicMarketTypes` hook
- Add mobile-first layout with responsive grid
- Keep LandingNavbar and LandingErrorBoundary

**Step 2: Commit**

`feat(landing): replace marketing landing with price teaser layout`

---

### Task 9: Update SEO Meta Tags

**Files:**
- Modify: `src/wj-client/app/[locale]/landing/page.tsx` or the layout file

**Security notes:** None — meta tags only.

**Step 1: Check current meta tag setup**

Determine if landing page has a `metadata` export or uses `generateMetadata`. Update to reflect new content focus:

- Title: Keep app name, adjust subtitle to reference gold/silver price tracking
- Description: Update to describe the price monitoring feature

**Step 2: Commit**

`feat(landing): update SEO meta tags for price teaser`

---

### Task 10: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md` — Add PublicHandler component
- Modify: `docs/architecture/c4-component-frontend.md` — Update landing page components

**Security notes:** None — documentation only.

**Steps:**

1. In `c4-component-backend.md`:
   - Add `PublicHandler` to the Handlers layer
   - Show it reading from Gold/Silver type registries
   - Note: no auth middleware, IP-rate-limited

2. In `c4-component-frontend.md`:
   - Update Landing Page section: remove old marketing components (LandingHero, LandingFeatures, etc.)
   - Add new components: LandingGoldPriceTable, LandingGoldPriceChart, LandingSilverPriceTable, LandingSilverPriceChart
   - Add `usePublicMarketTypes` hook in market-prices feature module

3. Commit: `docs(architecture): update C4 diagrams for landing page redesign`

---

## Task Dependency Graph

```
Task 0 (Proto) ─┬─→ Task 1 (Backend Handler)
                 │
                 └─→ Task 3 (API Hook) ─┬─→ Task 4 (Gold Table)
                                         ├─→ Task 5 (Silver Table)
                                         │
Task 2 (i18n) ──────────────────────────┼─→ Task 6 (Gold Chart)
                                         ├─→ Task 7 (Silver Chart)
                                         │
                                         └─→ Task 8 (Landing Page) ─→ Task 9 (SEO)

Task 10 (C4 Diagrams) — independent, can run in parallel
```

**Parallel groups:**
- **Group A** (serial): Task 0 → Task 1
- **Group B** (serial): Task 0 → Task 3
- **Group C** (parallel after A+B+Task 2): Tasks 4, 5, 6, 7
- **Group D** (after C): Task 8 → Task 9
- **Group E** (independent): Task 2, Task 10

## Estimated Scope

- **Backend:** 1 new file (~50 lines), 2 modified files (~10 lines each)
- **Frontend:** 5 new files (~150 lines each), 1 modified file (landing page), 2 translation files
- **Proto:** 1 modified file (~15 lines)
- **Docs:** 2 modified files (C4 diagrams)
- **Total:** ~900 lines new code + minor modifications
