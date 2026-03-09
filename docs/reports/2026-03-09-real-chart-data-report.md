# Real Chart Data (Gold, Silver, PNL) — Implementation Report

## Summary

Replaced three "Coming soon" placeholder charts on the V2 home dashboard with real, interactive Recharts area charts powered by live data:

1. **Gold Price Chart** — fetches historical prices from mihong.vn (domestic SJC/999 or global XAU/USD), renders dual buy/sell area series for domestic and single price series for global
2. **Silver Price Chart** — fetches from giabac.vn (domestic, Chỉ/Lượng/KG units) and Yahoo Finance SI=F futures (global), same dual/single series pattern
3. **PNL Chart** — uses existing `/portfolio/historical-values` endpoint, renders dynamic green/red area chart based on portfolio trend over 7d/30d

## Spec Reference
`docs/specs/2026-03-09-real-chart-data-spec.md`

## Plan Reference
`docs/plans/2026-03-09-real-chart-data-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Notes |
|---|------|--------|---------------|-------|
| 0 | Add Protobuf Types | Done | `investment.proto` + auto-gen | ChartDataPoint, GetGoldChart/SilverChart RPCs |
| 1 | Gold Chart Backend | Done | `gold_chart.go`, `builder.go`, `routes.go` | mihong.vn proxy with Redis cache |
| 2 | Silver Chart Backend | Done | `silver_chart.go`, `builder.go`, `routes.go` | giabac.vn + Yahoo Finance SI=F |
| 3 | i18n Keys | Done | `en/ui.json`, `vi/ui.json` | 11 new keys under `dashboard.home` |
| 4 | Gold Frontend | Done | `GoldPriceChart.tsx` | Market toggle, type selector, area chart |
| 5 | Silver Frontend | Done | `SilverPriceChart.tsx` | Market toggle, unit selector, area chart |
| 6 | PNL Frontend | Done | `PNLCard.tsx` | Portfolio history, dynamic color |
| 7 | C4 Diagrams | Done | `c4-component-backend.md`, `c4-component-frontend.md` | New handlers + frontend chart usage |
| 8 | Flow Diagram | Done | `flow-investment.md` | Section 7: cache hit/miss/stale-fallback |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Input validation | Allowlist maps for market/goldCode/period/type/days in both handlers | Yes |
| Response size limit | `io.LimitReader(resp.Body, 1<<20)` — 1MB cap | Yes |
| External API timeout | `context.WithTimeout(ctx, 10*time.Second)` | Yes |
| Rate limiting | Yahoo Finance: `yahoo.GetGlobalThrottler().Wait(ctx)` | Yes |
| Cache poisoning | Cache written only after successful parse; stale key written separately | Yes |
| Auth on endpoints | Routes registered inside `investments` group which uses `AuthMiddleware` | Yes |
| Error message sanitization | Generic "Failed to fetch..." messages returned to client, not raw errors | Yes |

## Architecture

### New Backend Endpoints
- `GET /api/v1/investments/gold-chart?market=domestic|global&goldCode=SJC|999&period=24h|15d|1m|6m|1y`
- `GET /api/v1/investments/silver-chart?market=domestic|global&type=C|L|KG&days=1|7|30|90|365`

Both endpoints: JWT-authenticated, Redis-cached (5/15-min TTL), stale fallback on failure, 503 if no stale available.

### Cache Key Format
- Gold: `gold_chart:{market}:{goldCode}:{period}` + `:stale` suffix
- Silver: `silver_chart:{market}:{type}:{days}` + `:stale` suffix

### Frontend Data Flow
```
GoldPriceChart → useQueryGetGoldChart → /api/v1/investments/gold-chart
SilverPriceChart → useQueryGetSilverChart → /api/v1/investments/silver-chart
PNLCard → useQueryGetHistoricalPortfolioValues → /api/v1/portfolio/historical-values
```

## Files Changed (Complete List)

**Backend:**
- `src/go-backend/handlers/gold_chart.go` — NEW
- `src/go-backend/handlers/silver_chart.go` — NEW
- `src/go-backend/handlers/builder.go` — wired GoldChart + SilverChart
- `src/go-backend/handlers/routes.go` — registered /gold-chart + /silver-chart

**Protobuf + Generated:**
- `api/protobuf/v1/investment.proto` — added ChartDataPoint, GetGoldChart/SilverChart messages + RPCs
- `src/go-backend/protobuf/v1/` — regenerated
- `src/wj-client/gen/protobuf/v1/` — regenerated
- `src/wj-client/utils/generated/api.ts` — regenerated
- `src/wj-client/utils/generated/hooks.ts` — regenerated (useQueryGetGoldChart, useQueryGetSilverChart added)

**Frontend:**
- `src/wj-client/app/[locale]/dashboard/home/GoldPriceChart.tsx`
- `src/wj-client/app/[locale]/dashboard/home/SilverPriceChart.tsx`
- `src/wj-client/app/[locale]/dashboard/home/PNLCard.tsx`

**i18n:**
- `src/wj-client/messages/en/ui.json`
- `src/wj-client/messages/vi/ui.json`

**Documentation:**
- `docs/architecture/c4-component-backend.md`
- `docs/architecture/c4-component-frontend.md`
- `docs/architecture/flow-investment.md`
- `docs/reports/2026-03-09-real-chart-data-progress.md`

## How to Test

1. **Backend gold chart:** `GET /api/v1/investments/gold-chart?market=domestic&goldCode=SJC&period=24h` with JWT header → should return `{success: true, data: [{timestamp, buy, sell}, ...]}`
2. **Backend silver chart:** `GET /api/v1/investments/silver-chart?market=domestic&type=L&days=7` → similar response
3. **Frontend gold chart:** Dashboard home → Gold Price Chart card → click period tabs / switch type → chart animates with real data
4. **Frontend silver chart:** Same card → toggle Domestic/Global → chart updates; Domestic shows unit selector (Chỉ/Lượng/KG)
5. **PNL chart:** Portfolio must have history snapshots (via portfolio_snapshot_job running) → 7d/30d period toggle shows area chart
6. **Error state:** Temporarily set invalid goldCode → card shows "Failed to load chart data" with Retry button
7. **Validation:** `GET /gold-chart?market=invalid` → HTTP 400 with `{success: false, message: "invalid market parameter"}`

## Commits

| Hash | Message |
|------|---------|
| `39251b9` | feat(chart): add protobuf types for gold/silver chart endpoints |
| `4965b4b` | feat(chart): implement gold/silver chart backend handlers and i18n keys |
| `ab404b3` | feat(chart): implement gold, silver, and PNL chart frontends |
| `46dcc81` | docs(chart): update C4 architecture diagrams and add chart data flow |
