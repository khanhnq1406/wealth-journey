# TradingView Chart Integration — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace Recharts-based gold/silver price charts on dashboard home and landing pages with embedded TradingView Advanced Chart widgets showing XAUUSD and XAGUSD.

**Spec:** `docs/specs/2026-03-13-tradingview-chart-integration-spec.md`

**Architecture:** Frontend-only change. Create a reusable `TradingViewChart` component in the shared charts directory. Replace 4 existing chart components (2 dashboard, 2 landing) with the new widget. No backend changes, no protobuf changes, no new npm dependencies.

**Tech Stack:** React 19, Next.js 15, TypeScript, TradingView embed script (runtime), next-intl for locale

## Security Implementation Notes

- **No authentication changes** — TradingView widgets display public market data
- **External script trust** — Loading `https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js` from TradingView CDN (trusted fintech provider)
- **No user data sent** — Only hardcoded symbol (`TVC:GOLD` / `TVC:SILVER`) and display config passed to widget
- **CSP consideration** — May need to whitelist `s3.tradingview.com` and `*.tradingview.com` in CSP headers if configured
- **Input validation** — All widget configuration is hardcoded, no user-supplied data flows into the widget

## C4 Architecture Diagram Updates

- **Modify:** `docs/architecture/c4-component-frontend.md` — Add `TradingViewChart` to the shared components layer, update Home page and Landing page descriptions to note TradingView integration

## Runtime Flow Diagrams

- **No updates needed** — TradingView widget loading is a simple client-side script injection, not a multi-step business flow. The existing flow diagrams for market price fetching remain accurate since backend APIs are unchanged.

---

### Task 1: Create TradingViewChart Shared Component

**Files:**
- Create: `src/wj-client/components/charts/TradingViewChart.tsx`

**Security notes:** Widget configuration is hardcoded. No user-supplied data. External script loaded from trusted CDN.

**Step 1: Create the TradingViewChart component**

Create `src/wj-client/components/charts/TradingViewChart.tsx`:

```typescript
"use client";

import { useEffect, useRef, memo } from "react";

interface TradingViewChartProps {
  symbol: string;           // e.g., "TVC:GOLD", "TVC:SILVER"
  height?: number;          // Default: 400
  locale?: string;          // App locale: "vi" or "en"
  theme?: "light" | "dark"; // Default: "light"
  interval?: string;        // Default: "D" (daily)
  allowSymbolChange?: boolean; // Default: false
  className?: string;
}

function TradingViewChartInner({
  symbol,
  height = 400,
  locale = "en",
  theme = "light",
  interval = "D",
  allowSymbolChange = false,
  className,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Map app locale to TradingView locale format
  const tvLocale = locale === "vi" ? "vi_VN" : "en";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = "";

    // Create widget container div (TradingView requirement)
    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "calc(100% - 32px)";
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);

    // Create attribution link (TradingView ToS requirement)
    const copyrightDiv = document.createElement("div");
    copyrightDiv.className = "tradingview-widget-copyright";
    copyrightDiv.innerHTML = `<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a>`;
    container.appendChild(copyrightDiv);

    // Create and append the embed script
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Asia/Ho_Chi_Minh",
      theme,
      style: "1", // Candlestick
      locale: tvLocale,
      allow_symbol_change: allowSymbolChange,
      hide_top_toolbar: false,
      hide_side_toolbar: true,
      hide_volume: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(script);

    return () => {
      // Clean up on unmount or prop change
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [symbol, theme, tvLocale, interval, allowSymbolChange]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: "100%" }}
      role="img"
      aria-label={`TradingView chart for ${symbol}`}
    />
  );
}

export const TradingViewChart = memo(TradingViewChartInner);
```

**Step 2: Verify component compiles**

```bash
cd src/wj-client && npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 3: Commit**

```
feat(charts): add TradingViewChart shared component

Reusable component that embeds TradingView Advanced Chart widget
via their free embed script. Supports symbol, theme, locale,
interval, and height configuration.
```

---

### Task 2: Add i18n Translation Keys for Chart Unavailable State

**Files:**
- Modify: `src/wj-client/messages/en/ui.json` — Add `chartUnavailable` key under `dashboard.home`
- Modify: `src/wj-client/messages/vi/ui.json` — Add `chartUnavailable` key under `dashboard.home`
- Modify: `src/wj-client/messages/en/nav.json` — Add `chartUnavailable` key under `landing.priceTeaser`
- Modify: `src/wj-client/messages/vi/nav.json` — Add `chartUnavailable` key under `landing.priceTeaser`

**Security notes:** No security concerns — i18n string additions only.

**Step 1: Add English translations**

In `src/wj-client/messages/en/ui.json`, inside `dashboard.home` section, after `"silverChartTitle"`:
```json
"chartUnavailable": "Chart temporarily unavailable"
```

In `src/wj-client/messages/en/nav.json`, inside `landing.priceTeaser` section, add:
```json
"chartUnavailable": "Chart temporarily unavailable"
```

**Step 2: Add Vietnamese translations**

In `src/wj-client/messages/vi/ui.json`, inside `dashboard.home` section, after `"silverChartTitle"`:
```json
"chartUnavailable": "Biểu đồ tạm thời không khả dụng"
```

In `src/wj-client/messages/vi/nav.json`, inside `landing.priceTeaser` section, add:
```json
"chartUnavailable": "Biểu đồ tạm thời không khả dụng"
```

**Step 3: Commit**

```
feat(i18n): add chartUnavailable translation keys for TradingView fallback
```

---

### Task 3: Replace Dashboard Home Gold Chart

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/GoldPriceChart.tsx` — Replace entire content with TradingView widget
- Modify: `src/wj-client/app/[locale]/dashboard/home/page.tsx` — No changes needed (import stays the same, component signature stays the same)

**Security notes:** Removing API calls to gold-chart endpoint from this page. No new security concerns.

**Step 1: Replace GoldPriceChart component**

Replace the entire content of `src/wj-client/app/[locale]/dashboard/home/GoldPriceChart.tsx`:

```typescript
"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { TradingViewChart } from "@/components/charts/TradingViewChart";

export function GoldPriceChart() {
  const t = useTranslations("dashboard.home");
  const locale = useLocale();

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-2">
        <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
          {t("goldChartTitle")}
        </h3>
      </div>

      {/* TradingView Chart */}
      <div className="px-2 pb-2">
        <TradingViewChart
          symbol="TVC:GOLD"
          height={400}
          locale={locale}
          theme="light"
        />
      </div>
    </BaseCard>
  );
}
```

**Key changes:**
- Removed all state (`market`, `goldCode`, `selectedPeriod`)
- Removed `useQueryGetGoldChart` hook — no more API calls to `/api/v1/investments/gold-chart`
- Removed Recharts `LineChart` component
- Removed market toggle, gold code toggle, period tabs, current price display
- Removed loading/error/empty states (TradingView handles its own loading)
- Kept `BaseCard` wrapper with same styling for consistency
- Kept header with `goldChartTitle` translation
- Component signature unchanged — no changes needed in `page.tsx`

**Step 2: Verify the component compiles**

```bash
cd src/wj-client && npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 3: Commit**

```
feat(dashboard): replace gold chart with TradingView XAUUSD widget

Replace Recharts-based GoldPriceChart with embedded TradingView
Advanced Chart showing TVC:GOLD (XAUUSD). Removes market toggle,
period selector, gold code toggle — TradingView provides its own
controls. No more API calls to gold-chart endpoint from home page.
```

---

### Task 4: Replace Dashboard Home Silver Chart

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/SilverPriceChart.tsx` — Replace entire content with TradingView widget

**Security notes:** Same as Task 3 — removing API calls, no new concerns.

**Step 1: Replace SilverPriceChart component**

Replace the entire content of `src/wj-client/app/[locale]/dashboard/home/SilverPriceChart.tsx`:

```typescript
"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { TradingViewChart } from "@/components/charts/TradingViewChart";

export function SilverPriceChart() {
  const t = useTranslations("dashboard.home");
  const locale = useLocale();

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-2">
        <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
          {t("silverChartTitle")}
        </h3>
      </div>

      {/* TradingView Chart */}
      <div className="px-2 pb-2">
        <TradingViewChart
          symbol="TVC:SILVER"
          height={400}
          locale={locale}
          theme="light"
        />
      </div>
    </BaseCard>
  );
}
```

**Key changes:** Same as gold chart — removed all state, hooks, Recharts, toggles.

**Step 2: Verify the component compiles**

```bash
cd src/wj-client && npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 3: Commit**

```
feat(dashboard): replace silver chart with TradingView XAGUSD widget

Replace Recharts-based SilverPriceChart with embedded TradingView
Advanced Chart showing TVC:SILVER (XAGUSD). Removes market toggle,
period selector, unit toggle.
```

---

### Task 5: Replace Landing Page Gold Chart

**Files:**
- Modify: `src/wj-client/components/landing/LandingGoldPriceChart.tsx` — Replace mock SVG + login overlay with live TradingView widget

**Security notes:** Removing login overlay — chart is now fully interactive for unauthenticated users. This is intentional per spec (public market data, no auth needed for charts). Price tables still require auth.

**Step 1: Replace LandingGoldPriceChart component**

Replace the entire content of `src/wj-client/components/landing/LandingGoldPriceChart.tsx`:

```typescript
"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { TradingViewChart } from "@/components/charts/TradingViewChart";

export function LandingGoldPriceChart() {
  const t = useTranslations("landing.priceTeaser");
  const locale = useLocale();

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden h-full"
    >
      <div className="p-5 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("goldChartTitle")}
          </h3>
        </div>

        {/* TradingView Chart — fully interactive, no login wall */}
        <div className="flex-1 min-h-[300px]">
          <TradingViewChart
            symbol="TVC:GOLD"
            height={350}
            locale={locale}
            theme="light"
            allowSymbolChange={false}
          />
        </div>
      </div>
    </BaseCard>
  );
}
```

**Key changes:**
- Removed mock SVG axes and grid lines
- Removed disabled toggle buttons (market, gold code, period)
- Removed login overlay (`<Link href="/auth/login">`)
- Added live TradingView chart with 350px height (per spec)
- Kept `h-full` and `flex-col` layout for grid consistency with table

**Step 2: Verify the component compiles**

```bash
cd src/wj-client && npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 3: Commit**

```
feat(landing): replace gold chart placeholder with live TradingView XAUUSD

Replace mock SVG chart with login overlay with a fully interactive
TradingView Advanced Chart. No authentication required to view
the chart — major improvement to landing page value proposition.
```

---

### Task 6: Replace Landing Page Silver Chart

**Files:**
- Modify: `src/wj-client/components/landing/LandingSilverPriceChart.tsx` — Replace mock SVG + login overlay with live TradingView widget

**Security notes:** Same as Task 5 — removing login overlay for public chart data.

**Step 1: Replace LandingSilverPriceChart component**

Replace the entire content of `src/wj-client/components/landing/LandingSilverPriceChart.tsx`:

```typescript
"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { TradingViewChart } from "@/components/charts/TradingViewChart";

export function LandingSilverPriceChart() {
  const t = useTranslations("landing.priceTeaser");
  const locale = useLocale();

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden h-full"
    >
      <div className="p-5 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("silverChartTitle")}
          </h3>
        </div>

        {/* TradingView Chart — fully interactive, no login wall */}
        <div className="flex-1 min-h-[300px]">
          <TradingViewChart
            symbol="TVC:SILVER"
            height={350}
            locale={locale}
            theme="light"
            allowSymbolChange={false}
          />
        </div>
      </div>
    </BaseCard>
  );
}
```

**Step 2: Verify the component compiles**

```bash
cd src/wj-client && npx tsc --noEmit --pretty 2>&1 | head -20
```

**Step 3: Commit**

```
feat(landing): replace silver chart placeholder with live TradingView XAGUSD

Replace mock SVG chart with login overlay with a fully interactive
TradingView Advanced Chart for silver (XAGUSD).
```

---

### Task 7: Update C4 Frontend Architecture Diagram

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md`

**Security notes:** Documentation only.

**Step 1: Update the C4 frontend component diagram**

In `docs/architecture/c4-component-frontend.md`:

1. Add `TradingViewChart` to the shared components section:
   - Description: "Embeds TradingView Advanced Chart widget for XAUUSD/XAGUSD"
   - Technology: "React, TradingView embed script"

2. Update Home page component description to note:
   - "Gold/Silver charts use TradingView Advanced Chart widgets (XAUUSD, XAGUSD)"

3. Update Landing page component description to note:
   - "Live TradingView gold/silver charts (no login required)"

**Step 2: Commit**

```
docs(architecture): update C4 frontend diagram for TradingView integration
```

---

### Task 8: Final Verification and Build Check

**Files:** None (verification only)

**Step 1: Run TypeScript compilation check**

```bash
cd src/wj-client && npx tsc --noEmit --pretty
```

**Step 2: Run Next.js build to verify no SSR issues**

```bash
cd src/wj-client && npx next build
```

**Step 3: Visual verification checklist**

Manual testing steps:
- [ ] `/dashboard/home` — Gold chart shows TradingView XAUUSD candlestick chart
- [ ] `/dashboard/home` — Silver chart shows TradingView XAGUSD candlestick chart
- [ ] `/dashboard/home` — Gold/silver price tables are unchanged and functional
- [ ] `/landing` — Gold chart shows live TradingView XAUUSD (no login overlay)
- [ ] `/landing` — Silver chart shows live TradingView XAGUSD (no login overlay)
- [ ] `/landing` — Price tables still show login wall for prices
- [ ] Charts are responsive on mobile viewport
- [ ] Charts load without blocking page render
- [ ] No console errors related to TradingView script loading
- [ ] Locale switches between vi and en reflect in chart language

**Step 4: Commit build verification results to report**

---

## Task Dependency Graph

```
Task 1 (TradingViewChart component) ──┬── Task 3 (Dashboard Gold)
                                      ├── Task 4 (Dashboard Silver)
                                      ├── Task 5 (Landing Gold)
                                      └── Task 6 (Landing Silver)

Task 2 (i18n keys) ── independent, can run in parallel with Task 1

Tasks 3-6 ── independent of each other (different files), can run in parallel after Task 1

Task 7 (C4 docs) ── after Tasks 3-6

Task 8 (Verification) ── after all tasks
```

## Summary

| Task | Description | Files | Dependencies |
|------|-------------|-------|-------------|
| 1 | Create TradingViewChart component | 1 new file | None |
| 2 | Add i18n translation keys | 4 files modified | None |
| 3 | Replace dashboard gold chart | 1 file modified | Task 1 |
| 4 | Replace dashboard silver chart | 1 file modified | Task 1 |
| 5 | Replace landing gold chart | 1 file modified | Task 1 |
| 6 | Replace landing silver chart | 1 file modified | Task 1 |
| 7 | Update C4 frontend diagram | 1 file modified | Tasks 3-6 |
| 8 | Final verification & build | None | All tasks |

**Total files changed:** 6 modified + 1 created = 7 files
**No backend changes. No protobuf changes. No new npm dependencies.**
