# Asset Price Source Fixes Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix five bugs in the asset price cache:
1. PNJ API field names changed (`buy`/`sell` → `gia_mua`/`gia_ban`) + dot as thousand separator
2. SJC API response restructured (`DataList.Data` → top-level `data` array)
3. VangToday no longer returns currency data — remove from currency refresh pipeline
4. DOJI price multiplier (× 1,000,000 → × 10)
5. Mihong SJC TypeCode collision ("SJC" → "Mihong_SJC")

**Spec:** `docs/specs/2026-04-01-asset-price-source-fixes-spec.md`
**Architecture:** Backend-only changes in isolated price client packages (`pkg/pnj/`, `pkg/sjc/`, `pkg/doji/`, `pkg/mihong/`) and service layer (`domain/service/`). No new components, no schema changes, no frontend changes. The PriceCacheJob upsert cycle auto-corrects DB values within 15 minutes.
**Tech Stack:** Go 1.25, existing unit test infrastructure (`go test`)

## Security Implementation Notes

- Authentication: N/A — all clients are internal, called only from the background scheduler
- Authorization: N/A — no user-facing endpoints affected
- Input validation: PNJ `parsePrice` must be extended to also strip dots (`.`) as thousand separators; other validation (rejects empty/dash/N/A/negative) unchanged
- Data sanitization: `gold.SanitizeTypeCode` already strips HTML and limits TypeCode length — no change needed
- VangToday currency removal: removing a source reduces log noise; no security implications

## Component Reuse Inventory (Frontend Tasks)

N/A — no frontend tasks in this plan.

## C4 Architecture Diagram Updates

None required — spec confirms no new components, services, or repositories.

## Runtime Flow Diagram Updates

None required — spec confirms no execution path changes.

---

### Task 1: Fix PNJ API field names and parsePrice dot-separator handling

**Files:**

- Modify: `src/go-backend/pkg/pnj/types.go` (apiGoldType struct JSON tags)
- Modify: `src/go-backend/pkg/pnj/client.go` (parsePrice — add dot stripping)
- Test: `src/go-backend/pkg/pnj/client_test.go`

**Root cause:** PNJ API changed field names `buy`/`sell` → `gia_mua`/`gia_ban`, and changed thousand separator from comma to dot (`"173,500"` → `"176.700"`).

**Security notes:** `parsePrice` already strips commas and rejects non-numeric input. Adding dot stripping is equivalent — same security posture.

**Step 1: Update test expectations (RED)**

In `src/go-backend/pkg/pnj/client_test.go`:
- Update the mock JSON in `TestFetchGoldPrices_ParsesJSON` to use `gia_mua`/`gia_ban` keys with dot-separated values (e.g. `"gia_mua":"173.500","gia_ban":"175.000"`)
- Add `TestParsePrice` cases: `"176.700"` → `176_700_000`, `"173.700"` → `173_700_000`
- Existing comma-based tests (`"173,500"` → `173_500_000`) must still pass (backward compat)

**Step 2: Verify RED**

```bash
cd src/go-backend && go test ./pkg/pnj/... -v
# Expected: FAIL — JSON fields not found, prices parse as 0
```

**Step 3: Fix apiGoldType JSON tags (GREEN)**

In `src/go-backend/pkg/pnj/types.go`, update `apiGoldType`:
```go
type apiGoldType struct {
    Name string `json:"name"`
    Buy  string `json:"gia_mua"`  // was json:"buy"
    Sell string `json:"gia_ban"`  // was json:"sell"
}
```

**Step 4: Fix parsePrice to strip dots (GREEN)**

In `src/go-backend/pkg/pnj/client.go` `parsePrice` function, add dot stripping alongside the existing comma stripping:
```go
s = strings.ReplaceAll(s, ",", "")
s = strings.ReplaceAll(s, ".", "")  // PNJ uses dot as thousand separator
```

Update the `parsePrice` doc comment to mention dot separators.

**Step 5: Verify GREEN**

```bash
cd src/go-backend && go test ./pkg/pnj/... -v
# Expected: PASS — all tests green
```

**Step 6: Commit**

---

### Task 2: Fix SJC API response structure

**Files:**

- Modify: `src/go-backend/pkg/sjc/types.go` (apiResponse struct)
- Modify: `src/go-backend/pkg/sjc/client.go` (loop from `apiResp.DataList.Data` to `apiResp.Data`)
- Test: `src/go-backend/pkg/sjc/client_test.go`

**Root cause:** SJC API changed `{"DataList":{"Data":[...]}}` to `{"success":true,"data":[...]}` (top-level `data` array, lowercase key).

**Security notes:** No security changes. Struct change only affects JSON unmarshaling path.

**Step 1: Update test mock data (RED)**

In `src/go-backend/pkg/sjc/client_test.go`, update all mock JSON responses from the old `DataList.Data` structure to the new format:
```json
{"success":true,"latestDate":"13:29 01/04/2026","data":[{"TypeName":"Vàng SJC 1L, 10L, 1KG","BuyValue":173700000.0,"SellValue":176700000.0,"BuyDifferValue":0,"SellDifferValue":0}]}
```

**Step 2: Verify RED**

```bash
cd src/go-backend && go test ./pkg/sjc/... -v
# Expected: FAIL — DataList.Data is empty, results empty
```

**Step 3: Fix apiResponse struct (GREEN)**

In `src/go-backend/pkg/sjc/types.go`, update:
```go
type apiResponse struct {
    Data []apiRow `json:"data"`  // was: DataList struct{ Data []apiRow `json:"Data"` } `json:"DataList"`
}
```

**Step 4: Fix client loop (GREEN)**

In `src/go-backend/pkg/sjc/client.go`, update the loop:
```go
for _, row := range apiResp.Data {  // was: apiResp.DataList.Data
```

**Step 5: Verify GREEN**

```bash
cd src/go-backend && go test ./pkg/sjc/... -v
# Expected: PASS — all tests green
```

**Step 6: Commit**

---

### Task 3: Remove VangToday currency fetcher from refresh pipeline

**Files:**

- Modify: `src/go-backend/internal/app/providers.go` — pass `nil` for `vangTodayCurrencyFetcher` in `NewAssetPriceService` call
- OR modify: `src/go-backend/domain/service/asset_price_service.go` — skip `refreshCurrencyVangToday` in `RefreshAllPrices`

**Root cause:** `vang.today/api/prices` no longer returns any currency codes. The source is dead for currency purposes; keeping it causes perpetual FAIL + stale-marking every 15 minutes.

**Decision:** Pass `nil` for `vangTodayCurrencyFetcher` in the provider, which causes `refreshCurrencyVangToday` to exit early with "fetcher not configured" (existing guard at line 339-341 of asset_price_service.go). No log noise, no stale-marking. Alternative: remove the goroutine dispatch from `RefreshAllPrices` — both approaches work; passing nil is the minimal change.

**Security notes:** No security changes. Reducing active external HTTP calls slightly reduces attack surface.

**Step 1: Check current wiring in providers.go**

Locate where `NewVangTodayCurrencyFetcher` is constructed and passed to `NewAssetPriceService`. Replace with `nil`.

**Step 2: Verify the nil guard exists**

Confirm `refreshCurrencyVangToday` has the nil-check early return (it does — line 339-341).

**Step 3: Run tests**

```bash
cd src/go-backend && go test ./domain/service/... -v
# Expected: PASS
```

**Step 4: Commit**

---

### Task 4: Fix DOJI parsePrice multiplier

**Files:**

- Modify: `src/go-backend/pkg/doji/client.go:75-76` (parseHTML comment), `src/go-backend/pkg/doji/client.go:120-137` (parsePrice function + comment)
- Test: `src/go-backend/pkg/doji/client_test.go`

**Security notes:** No security changes. `parsePrice` input validation (reject empty, dash, N/A, negative) remains untouched. Only the multiplier constant changes.

**Step 1: Update test expectations to use correct multiplier (RED)**

In `src/go-backend/pkg/doji/client_test.go`, update ALL expected values from `× 1,000,000` to `× 10`:

| Test | Old Expected | New Expected |
|------|-------------|-------------|
| `TestFetchGoldPrices_ParsesHTML` SJC Buy | `8_250_000_000` | `82_500` |
| `TestFetchGoldPrices_ParsesHTML` SJC Sell | `8_270_000_000` | `82_700` |
| `TestFetchGoldPrices_ParsesHTML` Nhan Buy | `7_800_000_000` | `78_000` |
| `TestFetchGoldPrices_ParsesHTML` Nhan Sell | `7_850_000_000` | `78_500` |
| `TestFetchGoldPrices_CommaInPrice` Buy | `8_250_000_000` | `82_500` |
| `TestParsePrice` `"8250"` | `8_250_000_000` | `82_500` |
| `TestParsePrice` `"8,250"` | `8_250_000_000` | `82_500` |
| `TestParsePrice` `"  8250  "` | `8_250_000_000` | `82_500` |

**Step 2: Run tests to verify they fail (VERIFY RED)**

```bash
cd src/go-backend && go test ./pkg/doji/... -run TestFetchGoldPrices_ParsesHTML -v
# Expected: FAIL — tests expect 82_500 but code still returns 8_250_000_000
```

**Step 3: Fix the multiplier in parsePrice and update comments (GREEN)**

In `src/go-backend/pkg/doji/client.go`:

1. Line 75-76: Update `parseHTML` comment from:
   ```
   // Prices are in "nghìn/chỉ" (thousands per mace); multiply by 1,000,000
   // to convert to VND per lượng (tael).
   ```
   To:
   ```
   // Prices are in VND per mace (chỉ); multiply by 10 to convert to VND per
   // lượng (tael), since 1 lượng = 10 chỉ.
   ```

2. Lines 120-123: Update `parsePrice` doc comment from:
   ```
   // parsePrice converts a price string in nghìn/chỉ (thousands per mace) to
   // VND per lượng (tael) by multiplying by 1,000,000.
   ```
   To:
   ```
   // parsePrice converts a price string in VND per mace (chỉ) to VND per
   // lượng (tael) by multiplying by 10 (1 lượng = 10 chỉ).
   ```

3. Line 137: Change `return int64(v) * 1_000_000` to `return int64(v) * 10`

**Step 4: Run tests to verify they pass (VERIFY GREEN)**

```bash
cd src/go-backend && go test ./pkg/doji/... -v
# Expected: PASS — all tests green
```

**Step 5: Commit**

---

### Task 5: Fix Mihong SJC TypeCode to "Mihong_SJC"

**Files:**

- Modify: `src/go-backend/pkg/mihong/client.go:29` (codeToTypeCode map)
- Test: `src/go-backend/pkg/mihong/client_test.go`

**Security notes:** No security changes. The `codeToTypeCode` map is a static lookup — changing one value does not alter any validation or trust boundary behavior.

**Step 1: Add a test for Mihong SJC TypeCode mapping (RED)**

Add a new test `TestClient_FetchGoldPrices_SJCTypeCode` in `src/go-backend/pkg/mihong/client_test.go` that sends a response with `code: "SJC"` and asserts `TypeCode == "Mihong_SJC"`:

```go
func TestClient_FetchGoldPrices_SJCTypeCode(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[{"buyingPrice":17150000,"sellingPrice":17500000,"code":"SJC","dateTime":"01/04/2026 10:00","sellChange":0,"buyChange":0,"buyChangePercent":0,"sellChangePercent":0}]`))
	}))
	defer srv.Close()

	c := &Client{httpClient: &http.Client{}, baseURL: srv.URL}
	prices, err := c.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price, got %d", len(prices))
	}
	if prices[0].TypeCode != "Mihong_SJC" {
		t.Errorf("TypeCode: want Mihong_SJC, got %s", prices[0].TypeCode)
	}
	if prices[0].Name != "SJC 9999" {
		t.Errorf("Name: want 'SJC 9999', got %s", prices[0].Name)
	}
}
```

**Step 2: Run the new test to verify it fails (VERIFY RED)**

```bash
cd src/go-backend && go test ./pkg/mihong/... -run TestClient_FetchGoldPrices_SJCTypeCode -v
# Expected: FAIL — TypeCode: want Mihong_SJC, got SJC
```

**Step 3: Fix the codeToTypeCode map (GREEN)**

In `src/go-backend/pkg/mihong/client.go` line 29, change:
```go
"SJC": "SJC",
```
To:
```go
"SJC": "Mihong_SJC",
```

**Step 4: Run all Mihong tests to verify they pass (VERIFY GREEN)**

```bash
cd src/go-backend && go test ./pkg/mihong/... -v
# Expected: PASS — all tests green (including the new SJC test)
```

**Step 5: Commit**

---

### Task 6: Run full backend lint + test suite

**Files:** None (validation-only task)

**Security notes:** Ensures no regressions in other packages that depend on DOJI or Mihong types.

**Step 1: Run golangci-lint**

```bash
cd src/go-backend && task ci:backend-lint
# Expected: PASS
```

**Step 2: Run full backend test suite**

```bash
cd src/go-backend && go test -short ./...
# Expected: PASS — no regressions
```

**Step 3: No commit (validation only)**
