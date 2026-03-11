# Landing Page Redesign — Implementation Report

## Summary

Replaced the marketing-heavy landing page with a minimal price teaser design showing gold/silver type tables (with login prompts in Buy/Sell cells) and disabled chart shells (with X/Y axes only + centered login button). Added a new public backend endpoint that returns gold/silver type names from in-memory registries with no authentication required.

## Spec Reference

`docs/specs/2026-03-11-landing-page-redesign-spec.md`

## Plan Reference

`docs/plans/2026-03-11-landing-page-redesign-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | TDD |
|---|------|--------|---------------|-----|
| 0 | Add Proto Messages & Generate Code | Done | `api/protobuf/v1/investment.proto`, generated files | N/A (codegen) |
| 1 | Create Public Backend Handler | Done | `handlers/public.go`, `handlers/builder.go`, `handlers/routes.go` | Build verified |
| 2 | Add i18n Translation Keys | Done | `messages/en/nav.json`, `messages/vi/nav.json` | N/A |
| 3 | Create usePublicMarketTypes Hook | Done | `features/market-prices/hooks/usePublicMarketTypes.ts` | TypeScript verified |
| 4 | Create LandingGoldPriceTable | Done | `components/landing/LandingGoldPriceTable.tsx` | TypeScript verified |
| 5 | Create LandingSilverPriceTable | Done | `components/landing/LandingSilverPriceTable.tsx` | TypeScript verified |
| 6 | Create LandingGoldPriceChart | Done | `components/landing/LandingGoldPriceChart.tsx` | TypeScript verified |
| 7 | Create LandingSilverPriceChart | Done | `components/landing/LandingSilverPriceChart.tsx` | TypeScript verified |
| 8 | Rewrite Landing Page | Done | `app/[locale]/landing/page.tsx` | TypeScript verified |
| 9 | Update SEO Meta Tags | Done | `app/[locale]/landing/layout.tsx` | N/A |
| 10 | Update C4 Architecture Diagrams | Done | `docs/architecture/c4-component-backend.md`, `docs/architecture/c4-component-frontend.md` | N/A |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Public endpoint — no auth | `routes.go` registers `/api/v1/public/market-types` outside all auth middleware groups | Yes |
| IP-based rate limiting | Public route group uses `appmiddleware.RateLimitByIP(rateLimiter)` | Yes |
| No sensitive data exposure | Handler returns only code, name, currency from in-memory registries — no prices, user data, or internal IDs | Yes |
| Login link safety | All login links use Next.js `Link` component with hardcoded `/auth/login` path — no open redirect | Yes |
| No auth headers in public hook | `usePublicMarketTypes` uses plain `fetch()` with no Authorization header | Yes |

## Files Changed

### Backend
- `src/go-backend/handlers/public.go` — New `PublicHandler` with `GetPublicMarketTypes`
- `src/go-backend/handlers/builder.go` — Added `Public *PublicHandler` field + initialization
- `src/go-backend/handlers/routes.go` — Added `/public` route group before auth routes
- `src/go-backend/protobuf/v1/investment.pb.go` — Regenerated (auto)
- `src/go-backend/protobuf/v1/investment.pb.gw.go` — Regenerated (auto)
- `src/go-backend/protobuf/v1/investment_grpc.pb.go` — Regenerated (auto)

### Proto
- `api/protobuf/v1/investment.proto` — Added `MarketTypeItem`, `GetPublicMarketTypesRequest/Response`, `GetPublicMarketTypes` RPC

### Frontend
- `src/wj-client/app/[locale]/landing/page.tsx` — Rewritten with price teaser layout
- `src/wj-client/app/[locale]/landing/layout.tsx` — Updated SEO meta tags
- `src/wj-client/components/landing/LandingGoldPriceTable.tsx` — New component
- `src/wj-client/components/landing/LandingSilverPriceTable.tsx` — New component
- `src/wj-client/components/landing/LandingGoldPriceChart.tsx` — New component
- `src/wj-client/components/landing/LandingSilverPriceChart.tsx` — New component
- `src/wj-client/features/market-prices/hooks/usePublicMarketTypes.ts` — New hook
- `src/wj-client/messages/en/nav.json` — Added `priceTeaser` keys
- `src/wj-client/messages/vi/nav.json` — Added `priceTeaser` Vietnamese keys
- `src/wj-client/gen/protobuf/v1/investment.ts` — Regenerated (auto)
- `src/wj-client/utils/generated/api.ts` — Regenerated (auto)
- `src/wj-client/utils/generated/hooks.ts` — Regenerated (auto)

### Docs
- `docs/architecture/c4-component-backend.md` — Added `PublicHandler` component
- `docs/architecture/c4-component-frontend.md` — Updated landing page + market-prices descriptions
- `docs/reports/2026-03-11-landing-page-redesign-progress.md` — Progress tracking

## How to Test

### Backend
```bash
# Start backend
task backend:dev

# Test public endpoint (no auth needed)
curl http://localhost:8080/api/v1/public/market-types
# Expected: JSON with gold (18 types) and silver (11 types)
```

### Frontend
```bash
# Start frontend
task frontend:dev

# Visit http://localhost:3000/en/landing
# - Should show Gold Prices table with all 18 gold types
# - Buy/Sell cells should show "Please sign in to view prices" with login link
# - Below: disabled Gold Price Chart with axes and "Sign in to view chart" button
# - Same for silver below
# - Mobile (< 800px): stacked layout
# - Desktop (>= 800px): 2-column grid
```

## Known Issues / Technical Debt

None. The implementation matches all acceptance criteria from the spec.

## Commits

| Commit | Description |
|--------|-------------|
| 9924685 | feat(landing): add public market types proto messages |
| 0b27c84 | feat(landing): add public market types endpoint |
| 05f9a0b | feat(landing): add i18n keys and public market types hook |
| 5c13e76 | feat(landing): create landing price table and chart components |
| cb14ffd | feat(landing): replace marketing landing with price teaser layout |
| d0bf1d8 | docs(architecture): update C4 diagrams for landing page redesign |
