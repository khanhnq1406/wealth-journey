# TradingView Chart Integration Specification

## Summary

Replace the existing Recharts-based gold and silver price charts on both the landing page and dashboard home page with TradingView Advanced Chart widgets. The landing page currently shows mock SVG placeholder charts; the dashboard home shows interactive LineChart components fetching data from our gold-chart/silver-chart backend APIs. Both will be replaced with embedded TradingView Advanced Chart widgets showing XAUUSD (gold) and XAGUSD (silver) — two separate widgets. The existing gold/silver price **tables** (SJC domestic prices from vang.today) remain untouched. Backend chart APIs are kept but no longer consumed by these pages.

## User Stories

- As a user, I want to see professional, real-time gold and silver charts powered by TradingView so I can analyze market trends with candlesticks, indicators, and drawing tools.
- As a visitor (unauthenticated), I want to see live TradingView gold/silver charts on the landing page so I can evaluate the app's market data capabilities before signing up.
- As a user, I want the charts to support dark mode and match the app's theme.

## Functional Requirements

### FR-1: TradingView Advanced Chart Widget Component

**Description:** Create a reusable React component that embeds the TradingView Advanced Chart widget via their free embed script (`https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js`).

**Component API:**
```typescript
interface TradingViewChartProps {
  symbol: string;           // e.g., "TVC:GOLD", "TVC:SILVER"
  height?: number;          // Default: 400
  locale?: string;          // Default: from app locale ("vi_VN" or "en")
  theme?: "light" | "dark"; // Default: "light"
  interval?: string;        // Default: "D" (daily)
  allowSymbolChange?: boolean; // Default: false
  className?: string;
}
```

**Widget configuration:**
- `symbol`: Passed via props
- `interval`: "D" (daily) default
- `theme`: Synced with app theme (light/dark)
- `locale`: Synced with app locale (vi_VN / en)
- `style`: "1" (candlestick)
- `allow_symbol_change`: false (users shouldn't navigate away from gold/silver)
- `hide_top_toolbar`: false (keep toolbar for indicators/timeframe)
- `hide_side_toolbar`: true (hide drawing tools to save space)
- `hide_volume`: false
- `save_image`: false
- `autosize`: true (width 100%, height from props)
- `backgroundColor`: Match app background
- `gridColor`: Match app grid

**Implementation approach:**
- Use `useRef` for the container div and `useEffect` to dynamically create and append the `<script>` tag with JSON configuration
- Requires `"use client"` directive (browser DOM APIs)
- Clean up script on unmount/prop change to prevent memory leaks
- Use Next.js `dynamic()` import with `{ ssr: false }` if needed for server component compatibility

**Acceptance criteria:**
- [ ] Component renders TradingView Advanced Chart for any given symbol
- [ ] Chart is interactive (candlesticks, zoom, pan, indicators)
- [ ] Chart respects theme prop (light/dark)
- [ ] Chart respects locale prop (vi_VN/en)
- [ ] Component cleans up properly on unmount
- [ ] No console errors or script loading failures
- [ ] Responsive — fills container width on mobile and desktop

### FR-2: Replace Dashboard Home Gold Chart

**Description:** Replace the existing `GoldPriceChart` component on the dashboard home page with the TradingView widget showing `TVC:GOLD` (XAUUSD).

**Current component:** `src/wj-client/app/[locale]/dashboard/home/GoldPriceChart.tsx`
- Uses `useQueryGetGoldChart()` hook, Recharts `LineChart`, market/period/goldCode toggles

**New behavior:**
- Replace the entire `GoldPriceChart` component content with a `TradingViewChart` widget
- Symbol: `TVC:GOLD`
- Remove the market toggle (domestic/global), period selector, and goldCode toggle — TradingView provides its own timeframe controls
- Keep the section header/title styling consistent with the existing card design
- Height: 400px (matching current chart area)

**Layout impact:** The gold chart section on the home page becomes simpler — just a card with a TradingView embed. The `GoldPriceTable` below it remains unchanged.

**Acceptance criteria:**
- [ ] Dashboard home shows TradingView XAUUSD chart instead of Recharts gold chart
- [ ] No more API calls to `/api/v1/investments/gold-chart` from the home page
- [ ] Gold price table (SJC domestic prices) remains visible and functional
- [ ] Chart loads without blocking the rest of the page

### FR-3: Replace Dashboard Home Silver Chart

**Description:** Replace the existing `SilverPriceChart` component on the dashboard home page with the TradingView widget showing `TVC:SILVER` (XAGUSD).

**Current component:** `src/wj-client/app/[locale]/dashboard/home/SilverPriceChart.tsx`
- Uses `useQueryGetSilverChart()` hook, Recharts `LineChart`, market/period/unit toggles

**New behavior:**
- Replace the entire `SilverPriceChart` component content with a `TradingViewChart` widget
- Symbol: `TVC:SILVER`
- Remove the market toggle, period selector, and unit toggle
- Height: 400px

**Acceptance criteria:**
- [ ] Dashboard home shows TradingView XAGUSD chart instead of Recharts silver chart
- [ ] No more API calls to `/api/v1/investments/silver-chart` from the home page
- [ ] Silver price table (domestic prices) remains visible and functional
- [ ] Chart loads without blocking the rest of the page

### FR-4: Replace Landing Page Gold Chart

**Description:** Replace the `LandingGoldPriceChart` placeholder (mock SVG chart with login overlay) with a live TradingView chart.

**Current component:** `src/wj-client/components/landing/LandingGoldPriceChart.tsx`
- Mock SVG axes, disabled controls, login button overlay

**New behavior:**
- Replace with a `TradingViewChart` widget showing `TVC:GOLD`
- No login overlay — chart is fully interactive for unauthenticated users
- Height: 350px (slightly shorter than dashboard to fit landing layout)
- `allowSymbolChange`: false

**Acceptance criteria:**
- [ ] Landing page shows live TradingView XAUUSD chart
- [ ] Chart is fully interactive (no login wall)
- [ ] Landing gold price table remains with "Login to see prices" pattern
- [ ] No authentication required to view the chart

### FR-5: Replace Landing Page Silver Chart

**Description:** Replace the `LandingSilverPriceChart` placeholder with a live TradingView chart.

**Current component:** `src/wj-client/components/landing/LandingSilverPriceChart.tsx`
- Mock SVG axes, disabled unit toggles, login button overlay

**New behavior:**
- Replace with a `TradingViewChart` widget showing `TVC:SILVER`
- No login overlay
- Height: 350px

**Acceptance criteria:**
- [ ] Landing page shows live TradingView XAGUSD chart
- [ ] Chart is fully interactive (no login wall)
- [ ] Landing silver price table remains
- [ ] No authentication required

## Non-Functional Requirements

- **Performance:** TradingView widget loads asynchronously via external script; must not block page rendering or other components. Use lazy loading.
- **Bundle size:** No new npm dependencies required — TradingView embed uses a runtime script tag, not a bundled library.
- **Availability:** TradingView widget is externally hosted. If TradingView CDN is down, the chart section should show a graceful fallback (e.g., "Chart unavailable" message), not break the page.
- **Security:** The embed script is loaded from `https://s3.tradingview.com` — a trusted CDN. No user data is sent to TradingView.
- **Accessibility:** TradingView widgets have their own accessibility support. Our wrapper should include appropriate ARIA labels.

## Architecture Changes (C4)

### Diagrams to Update

**L3 Frontend (`c4-component-frontend.md`):**
- Add `TradingViewChart` component to the shared components layer
- Update the Home page description to note TradingView integration for gold/silver charts
- Update the Landing page description to note live TradingView charts replacing placeholders

### New Diagrams

No new L4 diagrams needed — this is a frontend-only component replacement, not a new bounded context.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — the existing flow diagrams for market price fetching remain accurate since the backend APIs are unchanged. The frontend simply stops calling the gold-chart/silver-chart endpoints from the home page.

### New Flow Diagrams

None needed — TradingView widget loading is a simple client-side script injection, not a multi-step business flow.

## Data Model Changes

None. No database or backend changes.

## API Changes

None. Backend gold-chart/silver-chart APIs are kept as-is but are no longer consumed by the home page or landing page. They may still be used by other pages (e.g., prices page) or future features.

## UI/UX Changes

### Dashboard Home Page (`/dashboard/home`)

**Before (mobile):**
```
Net Worth → PNL → Gold Table → Gold Chart (Recharts, toggles) → Silver Table → Silver Chart (Recharts, toggles) → Wallets
```

**After (mobile):**
```
Net Worth → PNL → Gold Table → Gold Chart (TradingView XAUUSD) → Silver Table → Silver Chart (TradingView XAGUSD) → Wallets
```

**Key visual changes:**
- Market/period/goldCode toggles removed — TradingView has its own toolbar
- Chart appearance changes from simple line chart to professional candlestick chart
- Chart is more interactive (drawing tools, indicators, timeframe selector built-in)

**Desktop layout:** Same structure, TradingView charts fill the chart column.

### Landing Page (`/landing`)

**Before:**
```
Gold Table (login wall) → Gold Chart (mock SVG + login overlay) → Silver Table (login wall) → Silver Chart (mock SVG + login overlay)
```

**After:**
```
Gold Table (login wall) → Gold Chart (LIVE TradingView XAUUSD) → Silver Table (login wall) → Silver Chart (LIVE TradingView XAGUSD)
```

**Key visual changes:**
- Charts go from empty SVG placeholders to fully interactive live charts
- Login overlay removed from charts (tables still have login wall for prices)
- Major improvement in landing page value proposition

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | TradingView CDN (s3.tradingview.com) | Widget JS + market data | Yes: External CDN → Browser | User's browser | Third-party script execution |
| 2 | TradingView servers | Real-time price data | Yes: External API → Widget | TradingView widget in browser | Widget fetches its own data |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| External CDN → Browser | TradingView embed script | HTTPS, trusted domain (s3.tradingview.com), CSP header |
| External API → Widget | TradingView market data | Handled by TradingView internally |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | CDN → Browser | Tampering | Compromised TradingView CDN serves malicious script | Low | TradingView is a major fintech platform with robust CDN security; use Subresource Integrity (SRI) if hash is available; CSP whitelist `s3.tradingview.com` |
| T-2 | 1 | CDN → Browser | Spoofing | Man-in-the-middle replacing TradingView script | Very Low | HTTPS enforced by CDN |
| T-3 | 1 | CDN → Browser | DoS | TradingView CDN is unavailable | Low | Graceful fallback UI ("Chart unavailable"), page remains functional without chart |
| T-4 | 2 | External → Widget | Info Disclosure | TradingView tracks user behavior via widget | Low | No user PII is sent to TradingView; widget only receives symbol and display config |

### Authorization Rules

- No authorization needed for TradingView charts — they display public market data
- Landing page: Charts are fully public (no auth), price tables still require auth for values
- Dashboard: Page requires auth (existing middleware), but chart content itself is public data

### Input Validation Rules

- `symbol` prop: Must be a valid TradingView symbol string (hardcoded to `TVC:GOLD` / `TVC:SILVER`)
- `height` prop: Must be a positive number
- `theme` prop: Must be "light" or "dark"
- No user-supplied data flows into the widget configuration

### External Dependency Risks

| Dependency | Risk | Mitigation |
|-----------|------|------------|
| TradingView embed script (s3.tradingview.com) | CDN downtime, script URL change, breaking API changes | Graceful fallback UI, monitor for errors, pin to known working version if possible |
| TradingView free widget terms | TradingView may change free widget availability or add restrictions | Low risk — widgets are a core TradingView product for site embedding; keep attribution per their terms |

### Sensitive Data Handling

No sensitive data involved. TradingView widgets display public market data. No user PII, authentication tokens, or financial data is sent to TradingView.

### Issues & Risks Summary

1. **Third-party script execution** — Loading external JavaScript is inherently a trust decision. TradingView is a well-established fintech company, making this acceptable risk.
2. **CDN availability** — If TradingView CDN goes down, charts won't render. Mitigated by graceful fallback.
3. **Content Security Policy** — May need to update CSP headers to allow `s3.tradingview.com` script source and `*.tradingview.com` for iframe/connect sources.
4. **Widget terms of service** — TradingView free widgets require attribution (typically a small "Powered by TradingView" link). This is acceptable.

## Edge Cases & Error Handling

- **TradingView script fails to load:** Show fallback message "Chart temporarily unavailable" with a retry button
- **Slow network:** Chart container shows a loading skeleton/spinner until the widget initializes
- **Multiple chart instances on same page:** Each widget needs a unique container ID — use React `useId()` or random suffix
- **Theme mismatch:** If user toggles dark mode after chart loads, the chart should re-render with new theme
- **Mobile viewport:** TradingView widget is responsive by default with `autosize: true`; verify it works within our mobile layout constraints
- **Ad blockers:** Some ad blockers may block TradingView scripts — show fallback message

## Dependencies & Assumptions

- TradingView Advanced Chart widget remains free for embedding (currently free with attribution)
- TradingView CDN (`s3.tradingview.com`) is reliable and fast
- `TVC:GOLD` maps to XAUUSD and `TVC:SILVER` maps to XAGUSD on TradingView
- The app's CSP headers (if any) can be updated to allow TradingView domains
- No npm package needed — direct script embedding

## Out of Scope

- Replacing charts on the prices page (`/dashboard/prices`) — those may use different visualization
- Removing backend gold-chart/silver-chart API endpoints
- TradingView Charting Library (paid/licensed product) — we use the free embed widget
- Custom data feeds into TradingView — we use TradingView's built-in data
- Other TradingView widgets (watchlist, ticker, screener, etc.)
- Dark mode implementation (if not already present — just wire existing theme)
