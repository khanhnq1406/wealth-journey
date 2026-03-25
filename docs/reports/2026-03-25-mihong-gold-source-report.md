# Mihong Gold Source — Implementation Report

## Summary

Added `api.mihong.vn` as a 4th gold price source in the waterfall fallback chain to resolve two recurring production warnings:

1. `gold symbol "Mihong_999" not found in live price data` — vang.today simply does not carry Mi Hồng products; the Mihong API is the only public source for these symbols.
2. `gold symbol "Vàng nhẫn SJC" not found in live price data` — vang.today returns TypeCode `SJ9999` for this product, but that alias was missing from `aliasToCanonical`.

The waterfall chain is now: **vangsaigon → vang.today → BTMC → Mihong**

## Spec Reference

`docs/specs/2026-03-25-mihong-gold-source-spec.md`

## Plan Reference

`docs/plans/2026-03-25-mihong-gold-source-plan.md`

## Tasks Completed

| #   | Task                                         | Status | Commit  | Files Changed                                                    | Tests    | TDD |
| --- | -------------------------------------------- | ------ | ------- | ---------------------------------------------------------------- | -------- | --- |
| 0   | Update C4 Architecture Diagrams              | Done   | ae5be55 | c4-context.md, c4-component-backend.md                           | N/A      | N/A |
| 1   | Fix aliasToCanonical — SJ9999 + SJL1L10      | Done   | 52e3966 | price_fetcher.go                                                 | 2/2 pass | Yes |
| 2   | Create pkg/mihong — Types                    | Done   | 6060a10 | pkg/mihong/types.go                                              | 1/1 pass | Yes |
| 3   | Create pkg/mihong — HTTP Client              | Done   | 6060a10 | pkg/mihong/client.go, client_test.go                             | 5/5 pass | Yes |
| 4   | Create gold_fetcher_mihong.go Adapter        | Done   | b65cb22 | gold_fetcher_mihong.go, gold_fetcher_mihong_test.go, price_fetcher.go | 3/3 pass | Yes |
| 5   | Wire Mihong into NewGoldPriceService + E2E   | Done   | baf18e3 | gold_price_service.go, price_fetcher_test.go                     | 1/1 pass | Yes |
| 6   | Update flow-cross-cutting.md                 | Done   | 31bb352 | flow-cross-cutting.md                                            | N/A      | N/A |
| 7   | Append Fix 5 to Implementation Report        | Done   | 31bb352 | price-fallback-report.md                                         | N/A      | N/A |

## Test Coverage Summary

| Layer          | Test File                          | Tests | Pass | Coverage Area                                           |
| -------------- | ---------------------------------- | ----- | ---- | ------------------------------------------------------- |
| pkg/mihong     | `client_test.go`                   | 5     | 5/5  | Valid response, HTTP 500, zero-price drop, body > 1MB, timeout |
| pkg/mihong     | `types_test.go` (inline)           | 1     | 1/1  | JSON unmarshal of GoldPriceResponse fields               |
| Service adapter| `gold_fetcher_mihong_test.go`      | 3     | 3/3  | Source() identity, price mapping, error propagation     |
| Service E2E    | `price_fetcher_test.go`            | 3     | 3/3  | SJ9999 alias normalization, SJL1L10 alias normalization, Mihong fallback when all other sources fail |

**Total: 12 tests, 12/12 pass**

All tests run with `go test -short` (no external dependencies required).

## Security Implementation Summary

| Concern                | Implementation                                                           | Verified |
| ---------------------- | ------------------------------------------------------------------------ | -------- |
| Untrusted external API | Response body capped at 1 MB (`io.LimitReader`)                          | Yes      |
| Slow-loris / DoS       | 5-second HTTP timeout + `context.WithTimeout` in waterfall layer         | Yes      |
| Malformed prices       | Zero/negative `buyingPrice`/`sellingPrice` dropped before entering cache | Yes      |
| Price unit correctness | ×10 mace→lượng applied exactly once in `pkg/mihong/client.go`            | Yes      |
| Float→int64 conversion | `int64(item.BuyingPrice) * 10` — truncating cast, no accumulation error  | Yes      |
| Error detail leakage   | Raw API errors logged server-side only; generic error surfaces to client | Yes      |
| No new secrets         | Mihong API is unauthenticated; `x-market: mihong` is a public routing header | Yes  |
| Architecture integrity | `pkg/mihong` imports stdlib only; `gold_fetcher_mihong.go` imports only `pkg/mihong` | Yes |
| TLS verification       | Go default `http.Client` TLS — server cert verified against system CA    | Yes      |
| Alias case sensitivity | `SJ9999` and `SJL1L10` tested against exact casing from vang.today mocks | Yes      |

## Review Results

### Spec Compliance

All per-task spec reviews returned PASS. All FR items implemented:

- **FR-1**: `pkg/mihong` HTTP client with x-market header, 1MB cap, 5s timeout, zero-price drop, dateTime parsing, ×10 conversion.
- **FR-2**: `gold_fetcher_mihong.go` adapter implementing `GoldPriceFetcher`.
- **FR-3**: Mihong wired as 4th source in `NewGoldPriceService`. `SourceMihong` constant added.
- **FR-4**: `SJ9999→Vàng nhẫn SJC` and `SJL1L10→SJC` aliases added to `aliasToCanonical`.
- **C4 diagrams**: L1 context and L3 backend component diagrams updated.
- **Flow diagrams**: `flow-cross-cutting.md` §12 updated with Mihong node and expanded alias table.

### Security Review

All per-task security reviews returned APPROVED.

Final cross-cutting review identified:
- **MEDIUM (pre-existing, not introduced)**: `gold_price_service.go` imports `github.com/go-redis/redis/v8` at the service layer. The depguard config bans only `go-redis/redis/v8/internal/*` in services, not the top-level package — so this does **not** fail lint. It is a pre-existing architectural pattern that predates this feature and is acceptable per current lint rules.
- **LOW (mitigated)**: `aliasToCanonical` entries depend on exact case from vang.today. Two TDD tests (`TestWaterfallGoldFetcher_AllSources_SJ9999AliasNormalization`, `TestWaterfallGoldFetcher_AllSources_SJL1L10AliasNormalization`) exercise the exact casing used by vang.today, providing regression protection.

### Code Quality

All per-task quality reviews returned APPROVED. Notable observations:
- The spec's FR-1 acceptance criteria states "×1000" but the spec's own Dependencies section resolves to ×10 (mace→lượng). The ×10 implementation is correct; the spec wording was inconsistent.
- The `mihongGoldFetcher` uses a function-pointer field (`fetchMihongFn`) for testability without interface indirection — consistent with the existing `waterfallGoldFetcher` pattern.

## Known Issues / Technical Debt

1. **Mihong purity-code rings (985–410) not in `pkg/gold/types.go`** — the Mihong fetcher returns `Mihong_985`–`Mihong_410` TypeCodes but these are not registered investment types. Users cannot currently create investments with those symbols. Out of scope; deferred to a separate feature.
2. **§11 sequence diagram in `flow-cross-cutting.md`** — still shows 3 participants (vangsaigon, vang.today, BTMC). Mihong is not shown. Out of scope for this feature per spec.
3. **Mihong API is undocumented** — discovered via JS bundle analysis. Could change without notice. Mitigated by graceful failure (last in chain), error logging, and no user-facing breakage beyond "price unavailable."

## Files Changed

### Created
- `src/go-backend/pkg/mihong/types.go`
- `src/go-backend/pkg/mihong/client.go`
- `src/go-backend/pkg/mihong/client_test.go`
- `src/go-backend/domain/service/gold_fetcher_mihong.go`
- `src/go-backend/domain/service/gold_fetcher_mihong_test.go`

### Modified
- `src/go-backend/domain/service/price_fetcher.go` — added `SJ9999`, `SJL1L10` aliases; added `SourceMihong` constant
- `src/go-backend/domain/service/gold_price_service.go` — appended Mihong fetcher to waterfall; updated doc comment
- `src/go-backend/domain/service/price_fetcher_test.go` — added 3 new tests (SJ9999, SJL1L10, Mihong fallback)
- `docs/architecture/c4-context.md` — added Mi Hồng Price API external system
- `docs/architecture/c4-component-backend.md` — added pkg/mihong component; updated GoldPriceService description
- `docs/architecture/flow-cross-cutting.md` — §12 waterfall node + alias table updated
- `docs/reports/2026-03-25-price-fallback-report.md` — Fix 5 appended

## How to Test

### Unit & Integration Tests

```bash
# From src/go-backend/
go test -short ./pkg/mihong/...          # 6 tests — HTTP client
go test -short ./domain/service/...     # Includes 6 Mihong-related tests
go test -short ./...                     # All tests
```

Expected output:
```
ok  wealthjourney/pkg/mihong        ~0.1s
ok  wealthjourney/domain/service    ~0.2s
```

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed.

| Changed Symbol                       | d=1 Dependents                        | Tested? | Notes                                          |
| ------------------------------------ | ------------------------------------- | ------- | ---------------------------------------------- |
| `NewGoldPriceService`                | `internal/app/providers.go`           | Yes     | Build passes; function signature unchanged     |
| `FetchGoldPricesAllSources`          | `GoldPriceService.FetchPriceForSymbol` | Yes     | Mihong fallback E2E test exercises this path  |
| `aliasToCanonical`                   | `FetchGoldPricesAllSources`           | Yes     | Two alias normalization tests                  |
| `WaterfallGoldFetcher.FetchGoldPricesAllSources` | `GoldPriceService` | Yes | E2E test covers fallback chain              |

### Manual Testing Steps

1. Start the backend with `task backend:dev`
2. Observe logs: the recurring warnings `gold symbol "Mihong_999" not found` and `gold symbol "Vàng nhẫn SJC" not found` should no longer appear
3. Trigger a portfolio price refresh for a `Mihong_999` holding — should succeed even if vangsaigon/vang.today are unavailable
4. Check `Vàng nhẫn SJC` — should now resolve from vang.today's `SJ9999` TypeCode without stale-cache fallback

## Fix History

| Date       | Fix                                                                              | Severity | Commit    |
| ---------- | -------------------------------------------------------------------------------- | -------- | --------- |
| 2026-03-25 | Replace plain `INSERT` in `marketDataRepository.Create` with upsert (`INSERT … ON CONFLICT DO UPDATE`) to eliminate `idx_symbol_currency` duplicate-key errors caused by concurrent cache-miss goroutines. Adds 2 regression tests. | Minor    | 49ae762   |
