# Fix Watchlist Gold/Silver Price Unit — Implementation Progress

## Metadata

- **Feature:** fix-watchlist-gold-price-unit
- **Plan file:** `docs/plans/2026-04-10-fix-watchlist-gold-price-unit-plan.md`
- **Spec file:** `docs/specs/2026-04-10-fix-watchlist-gold-price-unit-spec.md`
- **Started:** 2026-04-10T00:00:00+07:00
- **Last updated:** 2026-04-10T00:00:00+07:00
- **Current state:** completed
- **Current task:** done

## Task Progress

| #   | Task Name                                                                                          | Status      | Commit | Summary |
| --- | -------------------------------------------------------------------------------------------------- | ----------- | ------ | ------- |
| 1   | Wire AssetDisplayConfigService into WatchlistService and fix price enrichment                      | done        | 908e35b1 | Added assetDisplaySvc field; ResolvePrice() for gold/silver/currency; GetPrice() for market; 12/12 tests |
| 0   | Update Runtime Flow Diagram (flow-watchlist.md Section 2)                                          | done        | TBD    | Updated Section 2 to show direct ResolvePrice() split path |

**Status values:** `pending` | `in_progress` | `done` | `skipped`

## Skill Recovery

**MANDATORY: Re-read these files before continuing work (context compaction drops them):**

1. `.claude/skills/secure-feature-pipeline/step-3-implement.md` — coordinator protocol, two-agent model, commit checkpoint
2. `.claude/skills/secure-feature-pipeline/implementer-agent-prompt.md` — implementer template (placeholders to fill)
3. `.claude/skills/secure-feature-pipeline/reviewer-agent-prompt.md` — reviewer template (placeholders to fill)

**After re-reading, verify you can answer:**
- What are the two agents per task and what does each one do?
- Which agent commits — the implementer, the reviewer, or the coordinator?
- What is the next pending task?

## Resume Instructions

To resume this implementation after context compaction or in a new session:

1. Read this progress file completely (including the Skill Recovery section above)
2. **Re-read ALL skill files listed in Skill Recovery section above** — this is NON-NEGOTIABLE
3. Read the plan file referenced in Metadata
4. Read the spec file referenced in Metadata
5. Check `git log --oneline -10` to verify last commit matches the last `done` task
6. Check `git status` for any uncommitted work
7. Cite the three-stage review order and checkpoint protocol (proves context is recovered)
8. Continue from the next `pending` task using the same checkpoint protocol

## Notes

- Root cause: `GetPrice()` for GOLD_VND applies `ProcessMarketPrice()` which converts per-lượng → per-gram (÷37.5). Watchlist should show per-lượng market price (raw asset_price.Buy), not per-gram investment unit price.
- Fix: Add `AssetDisplayConfigService` as 4th dep to WatchlistService; call `ResolvePrice()` directly for gold/silver/currency; keep `GetPrice()` for market/stock.
- `Eximbank` zero-price is accepted as-is (legacy data, symbol ≠ TypeCode).
- Frontend `formatWatchlistPrice` divides VND by 1000 for display — expects raw per-lượng value like `171,000,000` → shows `171,000` (nghìn đồng).
