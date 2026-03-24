# Symbol Watchlist — Implementation Report

## Summary

Implemented the Symbol Watchlist feature end-to-end: users can add symbols (stocks, crypto, ETFs, gold types, silver types) to a personal watchlist on the Prices page, view live prices, drag-and-drop to reorder, and remove items. The watchlist is the default tab on the Prices page and is accessible from desktop sidebar, mobile slide-out menu, and mobile bottom nav.

## Spec Reference

`docs/specs/2026-03-24-symbol-watchlist-spec.md`

## Plan Reference

`docs/plans/2026-03-24-symbol-watchlist-plan.md`

## Tasks Completed

| #   | Task | Status | Files Changed | Notes |
| --- | ---- | ------ | ------------- | ----- |
| 0   | Update C4 Architecture Diagrams | Done | `docs/architecture/c4-component-backend.md` | GoldPriceService, SilverPriceService, WatchlistService added |
| 1   | Define Protobuf API — watchlist.proto | Done | `api/protobuf/v1/watchlist.proto`, generated Go + TS | 7 messages, 6 RPCs, 8+ React Query hooks |
| 2   | Database Model — watchlist.go | Done | `domain/models/watchlist.go` | Soft-delete-aware unique index on (user_id, symbol) |
| 3   | Database Migration — migrate-watchlist | Done | `cmd/migrate-watchlist/main.go`, `Taskfile.yml` | AutoMigrate WatchlistItem |
| 4   | Repository Layer | Done | `domain/repository/watchlist_repository.go` | 9 methods; ReorderItems validates ownership via RowsAffected |
| 5   | Service Layer | Done | `domain/service/watchlist_service.go` | Parallel price enrichment with sync.WaitGroup; 50-item limit |
| 6   | Wire Repository + Service | Done | `domain/service/services.go`, `internal/app/providers.go` | Clean DI wiring |
| 7   | REST Handler | Done | `handlers/watchlist.go` | 6 endpoints using handler.* helpers |
| 8   | Wire Handler + Routes | Done | `handlers/builder.go`, `handlers/routes.go` | /check and /reorder before /:id to avoid routing conflicts |
| 9   | Frontend Feature Module | Done | `features/watchlist/` directory | Placeholder structure with correct ADR-003 layout |
| 10  | WatchlistTab + watchlist-helpers | Done | `features/watchlist/components/WatchlistTab.tsx`, `utils/watchlist-helpers.ts` | Desktop table + mobile MobileTable, FAB, optimistic reorder |
| 11  | AssetTypeBadge | Done | `features/watchlist/components/AssetTypeBadge.tsx` | Colored badge per asset type |
| 12  | DraggableWatchlistTable | Done | `features/watchlist/components/DraggableWatchlistTable.tsx` | framer-motion Reorder.Group/Item |
| 13  | AddToWatchlistForm | Done | `features/watchlist/forms/AddToWatchlistForm.tsx` | 3-step form; duplicate/limit error handling |
| 14  | Integrate Watchlist Tab into Prices Page | Done | `app/[locale]/dashboard/prices/page.tsx`, translation files | Watchlist as default tab; AddToWatchlistForm modal |
| 15  | Navigation Integration | Done | `DashboardLayout.tsx`, `BottomNav.tsx`, `icons/navigation.tsx` | PricesIcon; desktop sidebar, mobile slide-out, bottom nav (4 items) |
| 16  | Runtime Flow Diagram | Done | `docs/architecture/flow-watchlist.md`, `docs/architecture/README.md` | 4 flows: add, list+enrich, reorder, check/delete |
| 17  | Final Integration Testing | Done | — | go build, tsc --noEmit, npm run build all pass |

## Test Coverage Summary

| Layer | Type | Result | Notes |
| ----- | ---- | ------ | ----- |
| Go backend | `go build ./...` | Pass | Zero compilation errors |
| Go backend | `go test -short ./...` | Pass | All existing tests pass; no regressions |
| Frontend | `npx tsc --noEmit` | Pass | Zero TypeScript errors |
| Frontend | `npm run build` | Pass | Production build succeeds; prices route included |

GitNexus not indexed — manual blast radius review performed (see security review notes below).

## Security Implementation Summary

| Concern | Implementation | Verified |
| ------- | -------------- | -------- |
| Authentication | JWT middleware on all `/api/v1/watchlist` endpoints | Yes |
| Authorization | `userID` from JWT context; all repo queries include `WHERE user_id = ?` | Yes |
| IDOR prevention | `GetByIDForUser(itemID, userID)` ownership check before update/delete | Yes |
| Reorder ownership | `ReorderItems` validates all item IDs belong to user via `RowsAffected == 0` | Yes |
| Input validation | Symbol (1-50), name (1-200), note (0-200), currency (2-3 ISO), all trimmed server-side | Yes |
| 50-item limit | `CountByUserID` checked in service before create | Yes |
| Duplicate check | `GetBySymbolForUser` called before create; returns 409 Conflict | Yes |
| XSS | React JSX escapes all user content; no `dangerouslySetInnerHTML` | Yes |
| SQL injection | GORM parameterized queries throughout | Yes |
| Data exposure | Error messages use typed `apperrors`; no stack traces to client | Yes |
| Price data integrity | Prices stored as `int64` (cents/milliunits); no float arithmetic | Yes |

## Review Results

### Spec Compliance

All tasks passed spec compliance review. One adaptation from plan: proto package naming was changed from plan's `wealthjourney.v1` to codebase convention `wealthjourney.watchlist.v1` — matched existing per-domain package pattern.

### Security Review

All tasks APPROVED. No critical or high severity issues found across all 17 tasks. The most significant security design choice was reorder ownership validation via `RowsAffected == 0` on per-ID UPDATE queries inside a DB transaction — avoids a separate pre-check query while preventing unauthorized reorder.

### Code Quality

Tasks 14-15 required fixes before approval:
- **PricesIcon SVG duplicated PortfolioIcon** — fixed with distinct axes + line-chart path (`M3 3v18h18M7 16l4-4 4 4 4-8`)
- **Admin NavItem animationDelay was 210ms** (conflict with Feedback item) — corrected to 270ms (proper 30ms sequence)
- **`formatWatchlistChange` returned null for 0.00% change** — fixed `if (!pct)` → `if (pct == null)`
- **`CheckWatchlistItem` used direct `c.JSON()`** — corrected to `handler.Success(c, resp)` for consistency

All other tasks approved without changes.

## Fix History

| Date       | Fix                                                                                 | Severity | Files Changed |
| ---------- | ----------------------------------------------------------------------------------- | -------- | ------------- |
| 2026-03-24 | Center market price title + "last updated" timestamp on Prices page                | Minor    | `prices/page.tsx` |
| 2026-03-24 | Replace mobile FAB with inline "Add Symbol" button above table to eliminate overlap | Minor    | `WatchlistTab.tsx` |
| 2026-03-24 | Add `useTranslations` i18n to WatchlistTab and AddToWatchlistForm; add translation keys (EN + VI) | Minor | `WatchlistTab.tsx`, `AddToWatchlistForm.tsx`, `messages/en/investment.json`, `messages/vi/investment.json` |
| 2026-03-24 | Symbol search dropdown in AddToWatchlistForm now renders via portal (escapes modal overflow clipping); fixed portal click-outside to include `portalRef` so option clicks are not intercepted | Minor | `Select.tsx`, `SymbolAutocomplete.tsx`, `AddToWatchlistForm.tsx` |
| 2026-03-24 | "Add to Watchlist" in Symbol Lookup tab now adds directly without opening modal; inline success/error feedback | Minor | `prices/page.tsx`, `messages/en/investment.json`, `messages/vi/investment.json` |
| 2026-03-24 | Fix drag overlap: replace framer-motion `Reorder.Group/Item` with `@dnd-kit/sortable` — framer-motion v12 resets gesture origin on every `values` update during drag causing offset jump and visual overlap; dnd-kit uses `DragOverlay` portal so dragged item never re-renders mid-gesture | Minor | `DraggableWatchlistTable.tsx`, `package.json` |
| 2026-03-24 | Star icon (unfilled/not-in-watchlist) color changed from `text-v2-text-tertiary` (#fcf2e0, near-white — invisible on light background) to `text-gray-400`; hover remains `text-v2-gold-accent` | Minor | `prices/page.tsx` |

## Known Issues / Technical Debt

- No unit tests written for watchlist service or handler (consistent with project's current "limited test coverage" state per CLAUDE.md — not a regression)
- `DraggableWatchlistTable` shows drag handle on desktop only; touch drag on mobile relies on framer-motion's `touchAction: none` — manual mobile testing recommended
- 50-item limit checked before duplicate check in service; race condition possible under concurrent requests (same user adding 50th item simultaneously). Acceptable risk given user-scoped watchlists and low likelihood of concurrent add from same user.

## Files Changed

### Backend
- `api/protobuf/v1/watchlist.proto` (new)
- `src/go-backend/protobuf/v1/watchlist.pb.go` (generated)
- `src/go-backend/protobuf/v1/watchlist.pb.gw.go` (generated)
- `src/go-backend/protobuf/v1/watchlist_grpc.pb.go` (generated)
- `src/go-backend/domain/models/watchlist.go` (new)
- `src/go-backend/domain/repository/watchlist_repository.go` (new)
- `src/go-backend/domain/repository/interfaces.go` (modified — added WatchlistRepository)
- `src/go-backend/domain/service/watchlist_service.go` (new)
- `src/go-backend/domain/service/interfaces.go` (modified — added WatchlistService)
- `src/go-backend/domain/service/services.go` (modified — Repositories + Services structs, NewServices)
- `src/go-backend/internal/app/providers.go` (modified — ProvideRepositories)
- `src/go-backend/handlers/watchlist.go` (new)
- `src/go-backend/handlers/builder.go` (modified — AllHandlers struct, NewHandlers)
- `src/go-backend/handlers/routes.go` (modified — /watchlist routes)
- `src/go-backend/cmd/migrate-watchlist/main.go` (new)
- `Taskfile.yml` (modified — backend:migrate-watchlist task)

### Frontend
- `src/wj-client/gen/protobuf/v1/watchlist.ts` (generated)
- `src/wj-client/utils/generated/hooks.ts` (updated by proto:all — 8+ new watchlist hooks)
- `src/wj-client/features/watchlist/components/WatchlistTab.tsx` (new)
- `src/wj-client/features/watchlist/components/AssetTypeBadge.tsx` (new)
- `src/wj-client/features/watchlist/components/DraggableWatchlistTable.tsx` (new)
- `src/wj-client/features/watchlist/forms/AddToWatchlistForm.tsx` (new)
- `src/wj-client/features/watchlist/utils/watchlist-helpers.ts` (new)
- `src/wj-client/app/[locale]/dashboard/prices/page.tsx` (modified — watchlist tab default + modal)
- `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx` (modified — Prices navitem)
- `src/wj-client/components/navigation/BottomNav.tsx` (modified — 4-item nav with Prices)
- `src/wj-client/components/icons/navigation.tsx` (modified — PricesIcon added)
- `src/wj-client/components/icons/index.ts` (modified — PricesIcon exported)
- `src/wj-client/messages/en/investment.json` (modified — watchlist tab/addToWatchlist keys)
- `src/wj-client/messages/vi/investment.json` (modified — watchlist tab/addToWatchlist keys)

### Documentation
- `docs/architecture/c4-component-backend.md` (modified)
- `docs/architecture/flow-watchlist.md` (new — 4 runtime flows)
- `docs/architecture/README.md` (modified — watchlist row in table)
- `docs/reports/2026-03-24-symbol-watchlist-progress.md` (updated throughout)

## How to Test

### Automated Tests

```bash
# Backend compile + unit tests
cd src/go-backend
go build ./...
go test -short ./...

# Frontend TypeScript check + build
cd src/wj-client
npx tsc --noEmit
npm run build
```

### Database Migration

```bash
task backend:migrate-watchlist
```

### Manual Testing Steps

1. **Open Prices page** → Watchlist tab should be selected by default
2. **Empty state** → Should show "Your watchlist is empty. Add symbols to track their prices." with Add button
3. **Add a stock** → Click Add → select "Other Asset" → search "AAPL" → set note → Submit → item appears in list
4. **Duplicate check** → Try adding AAPL again → should show "Already in your watchlist" error
5. **Add gold** → Click Add → select "Gold" → pick a gold type → Submit → appears with buy/sell prices
6. **Add silver** → Similar to gold flow
7. **Drag reorder** → Desktop: grab drag handle and drag row to new position → order persists on refresh
8. **Delete** → Click trash icon → item removed immediately
9. **Symbol Lookup tab** → Search any symbol → "Add to Watchlist" button appears in result card → clicking opens same modal
10. **Navigation** → Prices icon visible in desktop sidebar, mobile slide-out (Finance section), and mobile bottom nav
11. **50-item limit** → Difficult to test manually; service enforces with validation error
