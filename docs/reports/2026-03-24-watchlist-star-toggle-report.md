# Watchlist Star Toggle in Price Tables — Implementation Report

## Summary

Added a star icon toggle to every row in the Gold, Silver, and Currency price tables on the Prices page. Clicking an empty star instantly adds the item to the user's watchlist (no modal, no note). Clicking a filled/amber star instantly removes it. Star state is derived from a single `useQueryListWatchlist` call at page level that builds an O(1) `Map<symbol, watchlistItemId>`. All errors surface via the existing toast notification system.

## Spec Reference

`docs/specs/2026-03-24-watchlist-star-toggle-spec.md`

## Plan Reference

`docs/plans/2026-03-24-watchlist-star-toggle-plan.md`

## Tasks Completed

| #   | Task | Status | Files Changed | Notes |
| --- | ---- | ------ | ------------- | ----- |
| 0   | Add translation keys | Done | `en/investment.json`, `vi/investment.json` | 4 new keys (starAdd, starRemove, addedToWatchlist, removedFromWatchlist) + failedToRemove error key |
| 1   | StarToggleButton + watchlist state in PricesPage | Done | `app/[locale]/dashboard/prices/page.tsx` | Main implementation — 325 lines added |
| 2   | Update runtime flow diagrams | Done | `docs/architecture/flow-watchlist.md` | Added flows 5 (quick-add) and 6 (quick-remove) |
| 3   | Final verification | Done | — | `npx tsc --noEmit`: 0 errors; `npm run build`: success |

## Test Coverage Summary

| Layer | Type | Result | Notes |
| ----- | ---- | ------ | ----- |
| Frontend | `npx tsc --noEmit` | Pass | Zero TypeScript errors |
| Frontend | `npm run build` | Pass | Production build succeeds; prices route included |

GitNexus not indexed — manual blast radius review performed (see security review notes below).

## Security Implementation Summary

| Concern | Implementation | Verified |
| ------- | -------------- | -------- |
| Authentication | JWT middleware on all `/api/v1/watchlist` endpoints (pre-existing) | Yes |
| Authorization | User ID from JWT context; all repo queries include `WHERE user_id = ?` | Yes |
| IDOR prevention | Delete uses `id` from server-returned watchlist data; `GetByIDForUser` ownership check on backend | Yes |
| Input safety | `symbol`/`name`/`currency` come from server-returned `PriceItem` — never user-typed text | Yes |
| assetType safety | Hardcoded per tab in TypeScript — not user-controlled | Yes |
| Double-click protection | Star button `disabled={isPending}` + early-return guard | Yes |
| XSS | React JSX escapes all content; no `dangerouslySetInnerHTML` | Yes |
| No new endpoints | Feature reuses existing watchlist CRUD endpoints | Yes |

## Review Results

### Spec Compliance

All functional requirements implemented. One intentional deviation from spec FR-6 (WatchlistTab refactoring to receive props): per the plan, `WatchlistTab` retains its own `useQueryListWatchlist` call because React Query deduplicates in-flight requests — avoiding the risky props refactoring while achieving the same deduplication behavior.

### Security Review

APPROVED. No critical or high severity issues. All mutation inputs originate from server-returned data. Backend authorization is unchanged and already verified.

### Code Quality

Review found 4 issues, all fixed before commit:
- **`handleStarSuccess` not memoized** — fixed with `useCallback([queryClient])`; removed eslint suppression comments
- **Remove error showed wrong toast key** — fixed by adding `failedToRemove` translation key to both locales and updating `removeMutation.onError`
- **Star mobile column missing `showInCollapsed: true`** — fixed so star is always visible in MobileTable collapsed state
- **Wrong toast message for remove failure** — fixed (same as above)

All other checks passed (accessible aria-label/aria-pressed, 44px tap target, no barrel imports, inline SVG pattern consistent with codebase, no component duplication).

## Known Issues / Technical Debt

- No unit tests written for `StarToggleButton` (consistent with project's current "limited test coverage" state per CLAUDE.md)
- `WatchlistTab` still calls `useQueryListWatchlist` with `refetchOnMount: "always"` while the page-level call uses `staleTime: 60s` — two queries with different behavior. React Query deduplicates in-flight requests but does not merge option sets. Acceptable given the low fetch frequency; can be unified in a future WatchlistTab refactor.

## Files Changed

### Frontend
- `src/wj-client/app/[locale]/dashboard/prices/page.tsx` (modified — StarToggleButton, watchedSymbolToId, star columns)
- `src/wj-client/messages/en/investment.json` (modified — 5 new translation keys)
- `src/wj-client/messages/vi/investment.json` (modified — 5 new translation keys)

### Documentation
- `docs/architecture/flow-watchlist.md` (modified — flows 5+6: quick-add/remove via star icon)
- `docs/specs/2026-03-24-watchlist-star-toggle-spec.md` (new)
- `docs/plans/2026-03-24-watchlist-star-toggle-plan.md` (new)
- `docs/reports/2026-03-24-watchlist-star-toggle-progress.md` (new)

## How to Test

### Automated Tests

```bash
# Frontend TypeScript check + build
cd src/wj-client
npx tsc --noEmit
npm run build
```

### Manual Testing Steps

1. **Open Prices page** → Gold tab
2. **Empty star**: Click star on any gold row → star fills amber after list refetch
3. **Filled star**: Click same star → star empties after list refetch
4. **Silver tab**: Same behavior
5. **Currency tab**: Same behavior (typeCode = currency code, e.g. "USD")
6. **Watchlist tab**: No star shown (WatchlistTab renders its own delete UI)
7. **Symbol Lookup tab**: No star shown (has existing "Add to Watchlist" button)
8. **Loading state**: Click star → button shows spinner, is disabled until mutation resolves
9. **50-item limit**: At 50 items, clicking empty star shows "Maximum of 50 items reached" warning toast
10. **Duplicate**: Adding already-tracked item shows "Already in your watchlist" toast

## Fix History

*(For future fixes to this feature, append here)*
