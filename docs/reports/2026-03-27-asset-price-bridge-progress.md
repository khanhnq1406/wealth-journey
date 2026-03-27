# Asset Price Bridge — Implementation Progress

## Metadata

- **Feature:** Asset Price Bridge (generalize gold_display_config → asset_display_config, add fetch codes, bridge MarketDataService to DB cache)
- **Plan file:** docs/plans/2026-03-27-asset-price-bridge-plan.md
- **Spec file:** docs/specs/2026-03-27-asset-price-bridge-spec.md
- **Started:** 2026-03-27T00:00:00Z
- **Last updated:** 2026-03-27T05:00:00Z
- **Current state:** in_progress
- **Current task:** 11

## Task Progress

| #   | Task Name                                                              | Status  | Commit | Summary |
| --- | ---------------------------------------------------------------------- | ------- | ------ | ------- |
| 0   | Update C4 Architecture Diagrams                                        | done    | b80ff04d | Renamed GoldDisplayConfig*→AssetDisplayConfig* in C4 diagrams, added AssetConfigFetchCodeRepo, updated MarketDataService deps |
| 1   | DB Migration — Rename gold_display_config → asset_display_config       | done    | b80ff04d | Idempotent migration: table rename, asset_type column, composite unique index, 13 silver seed rows |
| 2   | DB Migration — Create asset_config_fetch_code table                    | done    | b80ff04d | Table + FK + index + 15 seed fetch code rows (9 gold display configs) |
| 3   | DB Migration — Add price_updated_at to investment table                | done    | b80ff04d | Nullable TIMESTAMPTZ column, idempotent ADD COLUMN IF NOT EXISTS |
| 4   | Backend Model — AssetDisplayConfig + AssetConfigFetchCode + PriceUpdatedAt | done | bc837ec6 | AssetDisplayConfig + AssetConfigFetchCode models, PriceUpdatedAt *time.Time on Investment, 13 model tests |
| 5   | Backend Repository — AssetDisplayConfigRepository                      | done    | bc837ec6 | AssetDisplayConfigRepository interface + GORM impl (9 methods), 27 sqlmock tests |
| 6   | Backend Repository — AssetConfigFetchCodeRepository                    | done    | bc837ec6 | AssetConfigFetchCodeRepository interface + GORM impl (5 methods), 15 sqlmock tests |
| 7   | Backend Repository — Update InvestmentRepository for PriceUpdatedAt    | done    | bc837ec6 | UpdatePrices sets price_updated_at; 1 new test |
| 8   | Backend Service — AssetDisplayConfigService (rename + ResolvePrice)    | done    | 66f0bde4 | AssetDisplayConfigService: GetDisplayPrices, ResolvePrice (fetch-code priority), fetch code CRUD with validation, 24 tests |
| 9   | Backend Service — Bridge MarketDataService (DB read)                   | done    | 3aed84ba | MarketDataService uses ResolvePrice (DB-first) for gold/silver; nil-guard fallback to live API; 7 tests |
| 10  | Backend DI Wiring — Update providers, services, builder                | done    | a28c46d6 | AssetDisplayConfig wired in services/providers/builder/routes; MarketDataService receives real service |
| 11  | Backend Handler — AssetDisplayConfigHandler (rename + fetch codes)     | pending | —      | —       |
| 12  | Proto — Rename messages + add new fields                               | pending | —      | —       |
| 13  | Backend — Update Investment.ToProto + PriceUpdatedAt                   | pending | —      | —       |
| 14  | Frontend — Update i18n translations                                    | pending | —      | —       |
| 15  | Frontend — Rename admin components GoldDisplayConfig → AssetDisplayConfig | pending | — | —       |
| 16  | Frontend — Update public price consumers                               | pending | —      | —       |
| 17  | Frontend — FetchCodeList component for admin form                      | pending | —      | —       |
| 18  | Frontend — Portfolio page PriceUpdatedAt staleness indicator           | pending | —      | —       |
| 19  | E2E Tests — Update Playwright specs                                    | pending | —      | —       |
| 20  | Create/Update Runtime Flow Diagrams                                    | pending | —      | —       |
| 21  | Backend CI Verification                                                | pending | —      | —       |
| 22  | Frontend CI Verification                                               | pending | —      | —       |

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

- Baseline: gold_display_config.go (model), gold_display_config_repository.go, gold_display_config_service.go, handlers/gold_display_config.go all exist
- No asset_display_config migration exists yet (only migrate-gold-display-config)
- No migrate-asset-display-config, migrate-asset-config-fetch-code, or migrate-investment-price-updated-at exist yet
- Task 0 (C4 diagrams) is independent; Tasks 1-3 (migrations) are independent of each other
- Tasks 4-7 (models/repos) can run in parallel after tasks 1-3 are done
- Tasks 8-13 are sequential chain; Tasks 14-18 can parallel after task 12
