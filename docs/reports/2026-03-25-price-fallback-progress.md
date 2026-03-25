# Gold & Currency Price Fallback System — Implementation Progress

## Metadata

- **Feature:** Gold & Currency Price Fallback System
- **Plan file:** docs/plans/2026-03-25-price-fallback-plan.md
- **Spec file:** docs/specs/2026-03-25-price-fallback-spec.md
- **Started:** 2026-03-25T00:00:00Z
- **Last updated:** 2026-03-25T00:00:00Z
- **Current state:** in_progress
- **Current task:** 0

## Task Progress

| #   | Task Name                                              | Status      | Commit | Summary |
| --- | ------------------------------------------------------ | ----------- | ------ | ------- |
| 0   | Update C4 Architecture Diagrams                        | done        | 0c11373 | Added vang.today & BTMC as external systems in c4-context.md; updated backend component diagram with fallback chain |
| 1   | Create PriceFetcher Interface and Source Abstraction   | done        | c8418ad | GoldPriceFetcher/CurrencyPriceFetcher interfaces + WaterfallGoldFetcher/WaterfallCurrencyFetcher with 5s timeout, health skip, last-always-tried |
| 2   | Create Source Health Tracker (Redis-backed)            | done        | c8418ad | SourceHealthCache: IsHealthy fail-open + MarkUnhealthy 2-min TTL; keys price_source_health:<source> |
| 3   | Create Emergency Cache (1-Hour Stale Data)             | done        | c8418ad | SetEmergency/GetEmergency on GoldPriceCache and CurrencyPriceCache with 1-hour TTL |
| 4   | Create vang.today Client (pkg/vangtoday)               | done        | —      | HTTPS JSON client: 1MB limit, context timeout, prefix-based gold/currency classification, zero-price filtering |
| 5   | Create BTMC Client (pkg/btmc)                          | done        | —      | HTTP XML client: 1MB limit, context timeout, type-code mapping, comma-price parsing, API key required |
| 6   | Implement vangsaigon GoldPriceFetcher Adapter          | pending     | —      | —       |
| 7   | Implement vang.today GoldPriceFetcher and Currency Adapters | pending | —      | —       |
| 8   | Implement BTMC GoldPriceFetcher Adapter                | pending     | —      | —       |
| 9   | Implement vangsaigon CurrencyPriceFetcher Adapter      | pending     | —      | —       |
| 10  | Refactor goldPriceService to Use Waterfall Fallback    | pending     | —      | —       |
| 11  | Refactor currencyPriceService to Use Waterfall Fallback| pending     | —      | —       |
| 12  | Update DI Wiring (services.go, builder.go, config.go)  | pending     | —      | —       |
| 13  | Run Full Backend Lint + Test Suite                     | pending     | —      | —       |
| 14  | Create/Update Runtime Flow Diagrams                    | pending     | —      | —       |

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

- Parallelizable groups per plan: Tasks 0,1,2,3,4,5 can run in parallel first batch; Tasks 6,7,8,9 in second batch; Tasks 10,11 in third batch; Tasks 12,13,14 sequential last.
- No frontend changes — purely backend Go implementation.
- BTMC API key read from BTMC_API_KEY env var; if absent, gold chain runs with 2 sources (no panic).
