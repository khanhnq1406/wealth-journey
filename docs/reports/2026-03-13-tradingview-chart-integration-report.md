# TradingView Chart Integration — Implementation Report

## Summary

Replaced all 4 Recharts-based gold/silver price charts (2 dashboard, 2 landing) with embedded TradingView Advanced Chart widgets showing XAUUSD and XAGUSD live data. Created a reusable `TradingViewChart` component in the shared charts directory.

## Spec Reference
`docs/specs/2026-03-13-tradingview-chart-integration-spec.md`

## Plan Reference
`docs/plans/2026-03-13-tradingview-chart-integration-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Commit |
|---|------|--------|---------------|--------|
| 1 | Create TradingViewChart shared component | Done | 1 created | 4495ee7 |
| 2 | Add i18n translation keys | Done | 4 modified | ce31a89 |
| 3 | Replace dashboard gold chart | Done | 1 modified | abd76da |
| 4 | Replace dashboard silver chart | Done | 1 modified | 3203aa2 |
| 5 | Replace landing gold chart | Done | 1 modified | 172fa01 |
| 6 | Replace landing silver chart | Done | 1 modified | 6448bd9 |
| 7 | Update C4 frontend architecture diagram | Done | 1 modified | d58ebbe |
| 8 | Final verification and build check | Done | — | — |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| No authentication changes | TradingView widgets display public market data | Yes |
| External script trust | Loading from `s3.tradingview.com` (trusted fintech CDN) | Yes |
| No user data sent | Only hardcoded symbols (TVC:GOLD, TVC:SILVER) and display config | Yes |
| Input validation | All widget config is hardcoded, no user-supplied data flows into widget | Yes |

## Files Changed

### Created
- `src/wj-client/components/charts/TradingViewChart.tsx` — Reusable TradingView Advanced Chart embed component

### Modified
- `src/wj-client/app/[locale]/dashboard/home/GoldPriceChart.tsx` — Replaced with TradingView TVC:GOLD (+15/-253 lines)
- `src/wj-client/app/[locale]/dashboard/home/SilverPriceChart.tsx` — Replaced with TradingView TVC:SILVER (+16/-256 lines)
- `src/wj-client/components/landing/LandingGoldPriceChart.tsx` — Replaced mock SVG + login overlay (+13/-99 lines)
- `src/wj-client/components/landing/LandingSilverPriceChart.tsx` — Replaced mock SVG + login overlay (+17/-109 lines)
- `src/wj-client/messages/en/ui.json` — Added `chartUnavailable` key under `dashboard.home`
- `src/wj-client/messages/vi/ui.json` — Added `chartUnavailable` key under `dashboard.home`
- `src/wj-client/messages/en/nav.json` — Added `chartUnavailable` key under `landing.priceTeaser`
- `src/wj-client/messages/vi/nav.json` — Added `chartUnavailable` key under `landing.priceTeaser`
- `docs/architecture/c4-component-frontend.md` — Added TradingViewChart, updated page descriptions

**Total: 1 created + 9 modified = 10 files**
**Net lines: ~717 lines removed (massive simplification)**

## Build Verification

- TypeScript compilation: **PASS** (0 errors)
- Next.js production build: **PASS** (compiled in 73s, all routes generated)

## How to Test

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

## Known Issues / Technical Debt

- CSP headers may need `s3.tradingview.com` and `*.tradingview.com` whitelisted if Content Security Policy is configured
- The `useQueryGetGoldChart` and `useQueryGetSilverChart` hooks are no longer used by the home page charts — they remain available for other consumers (e.g., prices page) but could be cleaned up if no longer needed elsewhere

## Fix History

| Date | Fix | Severity | Commit |
|------|-----|----------|--------|
| 2026-03-13 | Fix chart layout (widget div height 100%), add loading spinner, remove copyright text | Minor | — |
| 2026-03-13 | Add Dollar Index (DXY) TradingView chart beside currency price table on dashboard + landing | Minor | — |
