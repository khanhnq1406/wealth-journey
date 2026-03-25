# Symbol Alias Map for Cross-Source Gold Price Lookup — Specification

## Summary

When vangsaigon.vn is down, `FetchPriceForSymbol` queries all sources via `FetchGoldPricesAllSources`. However, different sources use different TypeCodes for the same gold product (e.g., vangsaigon uses `"SJC"` for SJC gold, vang.today uses `"VNGSJC"`). The exact-match lookup fails silently. A second issue: the vangtoday classifier's `goldTypePrefixes` does not include `"MIHONG"`, so any Mi Hồng entry from vang.today is silently dropped before it reaches the lookup step. This spec addresses both issues with a **source alias map** in the service layer and a **prefix addition** in the vangtoday client.

## Issues to Fix

| # | Symptom | Root Cause | Files Affected |
|---|---------|------------|----------------|
| 1 | `SJC` not found in live price data (when vangsaigon is down) | vang.today returns TypeCode `"VNGSJC"` for SJC gold; lookup searches for exact `"SJC"` | `domain/service/gold_price_service.go`, `domain/service/price_fetcher.go` |
| 2 | `Mihong_999` not found in live price data | `goldTypePrefixes` in `pkg/vangtoday/client.go` has no `"MIHONG"` prefix; Mi Hồng entries from vang.today are classified as `""` and dropped | `pkg/vangtoday/client.go`, `domain/service/price_fetcher.go` |

## Functional Requirements

### FR-1: Symbol Alias Map

A `symbolAliasMap map[string][]string` maps each canonical TypeCode (as registered in `pkg/gold/types.go`) to all known equivalent TypeCodes returned by fallback sources.

**Initial map entries:**

| Canonical Code | Aliases |
|----------------|---------|
| `"SJC"` | `["VNGSJC"]` |

When `FetchGoldPricesAllSources` returns prices and the direct lookup for symbol `S` misses, the alias map is consulted: if any returned price has a TypeCode in `aliases[S]`, that price is returned with TypeCode **normalized back to the canonical code** `S`.

**Acceptance criteria:**
- [ ] `FetchPriceForSymbol("SJC")` returns a price from vang.today (TypeCode normalized to `"SJC"`) when vangsaigon is down
- [ ] Prices returned always have the canonical TypeCode, regardless of which source served them
- [ ] The alias map lives in `domain/service/price_fetcher.go` (or a new `symbol_aliases.go` in the same package) — not in `pkg/vangtoday`
- [ ] Tests cover: exact match found, alias match found, no match in either

### FR-2: MIHONG Prefix in vangtoday Client

Add `"MIHONG"` (or the actual vang.today prefix for Mi Hồng) to `goldTypePrefixes` in `pkg/vangtoday/client.go` so Mi Hồng entries are classified as `"gold"` and not dropped.

**Acceptance criteria:**
- [ ] Any vang.today entry with TypeCode starting with `"MIHONG"` (case-insensitive after `strings.ToUpper`) is classified as `"gold"`
- [ ] If vang.today does NOT have Mi Hồng data, the prefix change is still safe (no-op)
- [ ] Existing tests continue to pass; new test added for MIHONG classification

### FR-3: MIHONG_999 Alias (if vang.today uses a different code)

If vang.today returns Mi Hồng 999 under a code other than `"Mihong_999"` (e.g., `"MIHONG999"` or `"MIHONG_999_VND"`), add an alias entry.

**Note:** If vang.today doesn't carry Mi Hồng at all, the emergency cache path handles it gracefully — no alias needed, and the existing "not found in live price data" warning is acceptable.

**Acceptance criteria:**
- [ ] If a vang.today alias for `"Mihong_999"` exists and is known, it is added to the alias map
- [ ] If vang.today has no Mi Hồng data, the fix for Issue 2 (prefix addition) is the only change, and failure degrades gracefully to emergency cache

## Non-Functional Requirements

- **Backward compatibility**: `FetchAllPrices` is unaffected — it still uses the waterfall stop-at-first-success path. Only `FetchPriceForSymbol` uses the alias-aware lookup.
- **Zero performance cost**: Alias map lookup is O(n_aliases) — negligible; runs only when direct match fails.
- **No new external dependencies**: Pure in-memory map; no new packages.

## Architecture Changes (C4)

### Diagrams to Update

- **`flow-cross-cutting.md` §12** — Update the `FetchPriceForSymbol` flowchart to show the alias-map fallback step after the direct-match miss.

No new diagrams needed.

## Data Model Changes

None — no DB changes, no proto changes.

## API Changes

None — response format is unchanged; callers always see the canonical TypeCode.

## UI/UX Changes

None.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | vang.today API | Gold price (TypeCode, Buy, Sell) | Yes: Internet → App | WaterfallGoldFetcher | Same as existing fallback path |
| 2 | In-memory alias map | TypeCode normalization | No | FetchPriceForSymbol | Static constant, no external input |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | vang.today → App | Internet → App | Tampering | Manipulated price returned under aliased TypeCode | Low | Already mitigated: zero/negative price rejection in vangtoday client; no change to existing guard |
| T-2 | Alias map lookup | Internal | Elevation of Privilege | Alias entry maps an unexpected canonical code | Low | Alias map is a compile-time constant; no user input involved |

### Authorization Rules

No change — price fetching is public / not user-specific.

### Input Validation Rules

No new user input. Alias map values are compile-time constants.

### External Dependency Risks

- vang.today's type codes can change (as seen with Fix 1). If they rename `"VNGSJC"` to something else, the alias breaks silently. **Mitigation**: The direct lookup still runs first; alias miss degrades to emergency cache with a warning.

### Issues & Risks Summary

1. **Alias staleness**: If vang.today renames a type code, the alias silently misses. The fallback chain (emergency cache) prevents user-visible error.
2. **Unknown Mi Hồng code**: If the actual vang.today code for Mi Hồng 999 is unknown, Fix 2 only adds the prefix classifier — the alias entry can't be added without knowing the live code. Acceptable: `Mihong_999` continues to fail over to emergency cache.
3. **MIHONG prefix scope**: Adding `"MIHONG"` prefix may classify unexpected entries. Risk is very low — any such entry gets a price record that callers must look up by TypeCode; unknown TypeCodes are simply cached and harmless.

## Implementation Tasks

| # | Task | File | Notes |
|---|------|------|-------|
| 1 | Add `"MIHONG"` to `goldTypePrefixes` | `pkg/vangtoday/client.go` | Append to the new-API-codes list |
| 2 | Add `symbolAliasMap` constant | `domain/service/price_fetcher.go` | `"SJC": {"VNGSJC"}` initial entry |
| 3 | Update `FetchGoldPricesAllSources` to apply alias normalization | `domain/service/price_fetcher.go` | After merging, normalize alias TypeCodes to canonical |
| 4 | Update `FetchPriceForSymbol` alias-aware lookup | `domain/service/gold_price_service.go` | After direct miss, search by alias then normalize |
| 5 | Unit tests | `pkg/vangtoday/client_test.go`, `domain/service/price_fetcher_test.go`, `domain/service/gold_price_service_test.go` | MIHONG prefix test; alias-match test; normalization test |
| 6 | Update `flow-cross-cutting.md` §12 | `docs/architecture/flow-cross-cutting.md` | Add alias-map step to FetchPriceForSymbol flowchart |

## Edge Cases & Error Handling

- **Both direct match AND alias match exist**: Direct match wins (exact TypeCode lookup runs first).
- **Multiple aliases**: Alias map supports multiple alternative codes per canonical. First match wins.
- **Symbol in alias map but not in any source response**: Falls through to emergency cache — same behavior as before.
- **Canonical code not in alias map**: Falls through to emergency cache — same behavior as before.

## Out of Scope

- Currency price alias mapping (not needed — currency codes are ISO 4217 and consistent across sources)
- Alias mapping for silver prices
- Dynamic alias updates (aliases are compile-time constants, not runtime-configurable)
- Discovering the actual vang.today type code for `Mihong_999` at runtime (must be identified from live API observation or documentation)
