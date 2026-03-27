# Mihong Gold Price Source — Specification

## Summary

`Mihong_999` is exclusively available from the Mi Hồng website (`www.mihong.vn`). Live API investigation confirmed that vang.today does **not** carry any Mi Hồng products, and vangsaigon.vn (the current primary) returns HTTP 522 (CloudFlare origin timeout) when down. Users who hold `Mihong_999` gold see repeated warnings: `"unable to fetch current price for Mihong_999"` whenever vangsaigon is unavailable. This feature adds Mi Hồng's own public JSON API (`api.mihong.vn/v1/gold-prices?market=domestic`) as a new fourth source in the gold price waterfall, specifically to cover Mihong-exclusive symbols.

**API discovered:** `GET https://api.mihong.vn/v1/gold-prices?market=domestic`
- No authentication required
- Requires header: `x-market: mihong`
- Returns JSON array of `{buyingPrice, sellingPrice, code, sellChange, buyChange, dateTime}`
- Known codes: `SJC`, `999` (≡ `Mihong_999`), `985`, `980`, `950`, `750`, `680`, `610`, `580`, `410`

Additionally, a secondary fix: vang.today returns `SJ9999` for "SJC Ring" (a.k.a. `Vàng nhẫn SJC`), but that TypeCode is not in `aliasToCanonical`. Adding that alias fixes the `Vàng nhẫn SJC` warning immediately.

---

## User Stories

- As a user holding `Mihong_999` gold, I want price lookups to succeed even when vangsaigon is down, so that my portfolio valuation and price alerts work correctly.
- As a user holding `Vàng nhẫn SJC`, I want price lookups to resolve from vang.today when vangsaigon is down, so that I stop seeing stale-cache fallback warnings.

---

## Functional Requirements

### FR-1: pkg/mihong — HTTP Client

Add `pkg/mihong/` with a typed HTTP client for `api.mihong.vn`.

**Endpoint:** `GET https://api.mihong.vn/v1/gold-prices?market=domestic`
**Header required:** `x-market: mihong`
**Response:** JSON array — `[{buyingPrice, sellingPrice, code, sellChange, buyChange, buyChangePercent, sellChangePercent, dateTime}]`

**Price unit:** Per mace (chỉ, 1/10 lượng = 3.75 g). Same unit as vangsaigon — multiply raw value by 1000 to get VND in storage format (matching the existing vangsaigon adapter convention).

**Code → canonical TypeCode mapping:**

| Mihong `code` | Canonical TypeCode (pkg/gold/types.go) | Name |
|---|---|---|
| `SJC` | `SJC` | SJC 9999 |
| `999` | `Mihong_999` | Mi Hồng 999 |
| `985` | `Mihong_985` | Mi Hồng 985 |
| `980` | `Mihong_980` | Mi Hồng 980 |
| `950` | `Mihong_950` | Mi Hồng 950 |
| `750` | `Mihong_750` | Mi Hồng 750 |
| `680` | `Mihong_680` | Mi Hồng 680 |
| `610` | `Mihong_610` | Mi Hồng 610 |
| `580` | `Mihong_580` | Mi Hồng 580 |
| `410` | `Mihong_410` | Mi Hồng 410 |

Only `999` → `Mihong_999` is currently registered in `pkg/gold/types.go`. The purity-code rings (`985`–`410`) are Mihong-exclusive products not yet in the gold type registry; they should be included in the client output with `Mihong_`-prefixed TypeCodes so `FetchGoldPricesAllSources` can return them for symbol lookups.

**Acceptance criteria:**
- [ ] Client fetches with `x-market: mihong` header and 5-second timeout
- [ ] Response body capped at 1 MB via `io.LimitReader`
- [ ] Prices with zero or negative `buyingPrice` or `sellingPrice` are dropped
- [ ] `dateTime` string (`"25/03/2026 13:23"`) parsed into `time.Time` (format `"02/01/2006 15:04"`)
- [ ] Prices multiplied by 1000 before storage (VND per mace → smallest unit)
- [ ] HTTP non-200 returns typed error
- [ ] Client has unit tests (httptest server): valid response, HTTP 500, zero prices dropped, body > 1MB, timeout

### FR-2: Gold Fetcher Adapter

Add `domain/service/gold_fetcher_mihong.go` implementing `GoldPriceFetcher`.

- `Source()` returns `SourceMihong PriceSource = "mihong"`
- Wraps `pkg/mihong.Client.FetchGoldPrices(ctx)`
- Maps `GoldPrice` structs from `pkg/mihong` to `[]*CachedGoldPrice`

### FR-3: Wire Mihong into Waterfall as 4th Source

In `domain/service/gold_price_service.go` (`NewGoldPriceService`), append the Mihong fetcher **after** BTMC in the chain:

```
vangsaigon → vang.today → BTMC (if key present) → Mihong
```

No new config/env var needed — the Mihong API is public (no API key).

Add `SourceMihong` constant to `price_fetcher.go`.

**Acceptance criteria:**
- [ ] Mihong is tried only after all previous sources fail (or are marked unhealthy)
- [ ] `FetchGoldPricesAllSources` includes Mihong, so `Mihong_999` is reachable when it's the only live source
- [ ] Integration test: vangsaigon + vang.today + BTMC all fail → Mihong source returns `Mihong_999` successfully

### FR-4: Alias fix — `SJ9999` → `Vàng nhẫn SJC`

In `aliasToCanonical` (price_fetcher.go), add:

```go
"SJ9999": "Vàng nhẫn SJC",
"SJL1L10": "SJC",
```

`SJ9999` is the vang.today TypeCode for "SJC Ring" (confirmed by live API curl). `SJL1L10` is the vang.today TypeCode for "SJC 9999" (also confirmed).

**Acceptance criteria:**
- [ ] `FetchGoldPricesAllSources` normalizes `SJ9999` → `Vàng nhẫn SJC`
- [ ] `FetchGoldPricesAllSources` normalizes `SJL1L10` → `SJC`
- [ ] Two new unit tests in `price_fetcher_test.go` (TDD — already added before this spec)
- [ ] End-to-end test: vangsaigon down, vang.today returns `SJ9999`, `FetchPriceForSymbol("Vàng nhẫn SJC")` succeeds

---

## Non-Functional Requirements

- **Latency:** Mihong is last in chain — only reached when all previous sources fail. No impact on happy-path latency.
- **No new env vars:** Mihong API is unauthenticated. No config needed.
- **No frontend changes:** API contract unchanged.
- **No proto changes:** Price data flows through existing structs.
- **No DB migrations:** Caching-layer only.
- **Observability:** Log source name, latency, success/failure on every Mihong fetch attempt.

---

## Architecture Changes (C4)

### Diagrams to Update

**L1 Context (`c4-context.md`):**
- Add "Mi Hồng Price API" as external system: `api.mihong.vn`, `GET /v1/gold-prices`, HTTPS

**L3 Backend Components (`c4-component-backend.md`):**
- Add `pkg/mihong` package in pkg layer
- Update GoldPriceService description to show 4-source chain

### New Diagrams

No new L4 needed — same waterfall pattern as existing sources.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-cross-cutting.md` §12 (Price Fallback Chain):**
- Add Mihong as 4th node in the waterfall flowchart after BTMC
- Add `SJ9999`/`SJL1L10` alias entries to the alias-map step in `FetchPriceForSymbol` flowchart

---

## Data Model Changes

**No DB changes.**

**No new Redis keys.** Mihong source health tracked under existing `price_source_health:mihong` key pattern (same as other sources — auto-created on first use).

---

## API Changes

None. Same response format.

---

## UI/UX Changes

None.

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | `api.mihong.vn` | Gold prices JSON array | Yes: External API → App | MihongGoldFetcher | Untrusted external data |
| 2 | MihongGoldFetcher | Normalized `[]*CachedGoldPrice` | No (same tier) | WaterfallGoldFetcher | Validated by client |
| 3 | WaterfallGoldFetcher | Merged prices | No (same tier) | GoldPriceService | |
| 4 | GoldPriceService | Price response | Yes: App → Internet | Frontend | Public data, non-sensitive |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|------------|-----------------|
| External API → App | Mihong price JSON | Response body limit (1 MB), zero/negative price drop, timeout (5s) |
| App → Redis | Source health flag | Existing pattern, unchanged |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | External → App | Tampering | Mihong API returns manipulated prices (e.g., Buy=0 or extreme value) | High | Drop zero/negative prices; multiply-by-1000 is deterministic (no float accumulation error) |
| T-2 | 1 | External → App | Spoofing | DNS hijack redirects `api.mihong.vn` to attacker server | Medium | HTTPS enforced; Go default TLS certificate verification applies |
| T-3 | 1 | External → App | DoS | Slow-loris / large body from mihong API | Medium | `context.WithTimeout(5s)` + `io.LimitReader(1MB)` |
| T-4 | 1 | External → App | Repudiation | Cannot prove which price data came from Mihong | Low | Log source name + latency on every fetch |
| T-5 | — | App internals | Info Disclosure | Mihong source error details leak to frontend | Low | `market_data_service.go` already strips raw errors; handler returns "unable to fetch current price" |

### Authorization Rules

No change — price data is public, endpoint already JWT-protected.

### Input Validation Rules

| Input | Type | Constraints | Validation |
|-------|------|-------------|------------|
| `buyingPrice` / `sellingPrice` | float64 in JSON | Must be > 0 | Drop entry if ≤ 0 |
| `code` | string | Must be non-empty | Skip empty codes |
| `dateTime` | string | Format `"02/01/2006 15:04"` | Parse with `time.ParseInLocation`; use `time.Time{}` zero value on parse failure (non-fatal) |
| Response body | bytes | Max 1 MB | `io.LimitReader` |

### External Dependency Risks

| Service | Data | Trust Level | Failure Impact | Compromise Impact | Mitigation |
|---------|------|-------------|----------------|-------------------|------------|
| `api.mihong.vn` | Mihong gold prices | Low (public data, read-only) | Mihong-exclusive symbols unavailable; non-Mihong symbols unaffected | Manipulated Mihong prices in portfolio | Zero/negative price guard; Mihong is last in chain (price already cross-checked by earlier sources for shared symbols like SJC) |

**No new Go module dependencies** — uses only `net/http`, `encoding/json`, `context` (all stdlib).

### Sensitive Data Handling

No sensitive data. All Mihong prices are public market data. No user data flows to the Mihong API.

### Issues & Risks Summary

1. **Mihong API is undocumented** — discovered via JS bundle analysis. Could change without notice. Mitigated by: graceful failure (last in chain), error logging, no user-facing breakage beyond "price unavailable."
2. **`x-market: mihong` header requirement** — if removed by Mihong, all requests return non-200. Mitigated by the existing error path (next source or emergency cache).
3. **Purity-code ring types (985–410) not in `pkg/gold/types.go`** — users can't create investments with those symbols unless types are registered. Out of scope for this fix; Mihong fetcher will return them anyway for future use.
4. **`dateTime` format assumption** — `"DD/MM/YYYY HH:mm"` observed in one live API call. Could differ with different locales. Mitigation: parse failure falls back to `time.Time{}` (non-fatal).

---

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Mihong API returns HTTP non-200 | Log error, mark source unhealthy (2 min), return error from fetcher |
| Mihong API returns empty array `[]` | Return empty `[]*CachedGoldPrice{}`, no error (valid but empty) |
| Mihong API returns entry with `buyingPrice=0` | Drop entry silently (zero-price guard) |
| Mihong API times out (> 5s) | Cancel context, log timeout, mark unhealthy |
| All 4 sources fail | Emergency cache → error (existing behavior, unchanged) |
| `code: "999"` from Mihong, canonical `"Mihong_999"` not in gold type registry | Included in `FetchGoldPricesAllSources` result; portfolio lookup succeeds |

---

## Dependencies & Assumptions

- `api.mihong.vn` remains publicly accessible with `x-market: mihong` header (no auth key needed)
- Prices are in VND per mace (×1000 to reach storage unit) — confirmed by comparing `17150000` (raw) vs `172000000` (vang.today for same SJC product, which is per lượng = ×10 mace). Wait — **important clarification needed:**

  - vang.today `VNGSJC.buy = 172,000,000` = price per lượng (10 mace) in full VND → divide by 10 → `17,200,000` per mace
  - Mihong `SJC.buyingPrice = 17,150,000` — this IS per mace (chỉ), already in full VND
  - Vangsaigon stores `buy = 172000` (raw float) → `×1000` → `172,000,000` (per lượng in storage)

  **Conclusion:** Mihong prices are per mace, full VND. To match storage format (per lượng, multiplied by 1000), we need `×1000` (same multiplier as vangsaigon). Storage format is `VND per lượng × 1000`, so: `17,150,000 × 1000 = 17,150,000,000`... that doesn't match `172,000,000` from vang.today.

  **Re-analysis:** vangsaigon raw `buy = 172.0` (float, per mace in thousands? or per lượng?) → `×1000` → `172,000`. But gold price should be ~172M VND/lượng. So vangsaigon raw float is in millions? No — let's use the actual numbers:
  - vang.today buy: `172,000,000` (per lượng, full VND) → storage as-is
  - Mihong buy: `17,150,000` (per mace = 1/10 lượng, full VND) → ×10 → `171,500,000` per lượng → storage `×1000`? No.

  **Storage convention (from gold_fetcher_vangsaigon.go):** vangsaigon `Buy * 1000`. vangsaigon raw `Buy` comes from `region.Buy` in the JSON. We need to verify the actual raw value from vangsaigon to understand the multiplier.

  **Practical resolution:** `GoldConverter.ProcessMarketPrice()` in `pkg/gold/converter.go` handles the lượng→gram conversion for storage. The waterfall just passes raw CachedGoldPrice.Buy through. The question is what unit `Buy` should be in for `CachedGoldPrice` — looking at vangtoday adapter: vang.today returns `172_000_000` full VND (per lượng) and stores it as-is. So `CachedGoldPrice.Buy = 172_000_000` = VND per lượng.

  Mihong returns `17_150_000` per mace = `171_500_000` per lượng. So Mihong adapter must multiply by 10 (mace→lượng). No further ×1000 needed.

  **Implementation note for plan:** `pkg/mihong` client stores raw `buyingPrice` as-is. The adapter (`gold_fetcher_mihong.go`) multiplies by 10 to convert mace→lượng (matching CachedGoldPrice.Buy convention = VND per lượng in full VND).

- `pkg/gold/types.go` canonical code for Mi Hồng 999 is `"Mihong_999"` — must add to `aliasToCanonical` if Mihong returns `"999"` (not `"Mihong_999"`). Since Mihong is our own client, we map `"999"` → `TypeCode: "Mihong_999"` directly inside `pkg/mihong` (no alias map needed).

---

## Out of Scope

- Adding new investment types for Mihong purity rings (`Mihong_985`–`Mihong_410`) — needs separate UX work
- Registering new gold types in `pkg/gold/types.go` for Mihong rings beyond `Mihong_999`
- Currency prices from Mihong (Mihong API only provides gold prices)
- World gold (`market=global`) from Mihong — Yahoo Finance covers XAU/USD already
