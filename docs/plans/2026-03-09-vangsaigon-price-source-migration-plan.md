# vangsaigon.vn Price Source Migration — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix broken gold/silver price fetching by migrating from the dead `vang247.vn` API to `vangsaigon.vn`, and rename the `vang247` package to `vnprice` to decouple from any specific vendor.
**Spec:** `docs/specs/2026-03-09-vangsaigon-price-source-migration-spec.md`
**Architecture:** The `pkg/vang247` package is a thin HTTP client called by `GoldPriceService` and `SilverPriceService`. The fix is: (1) change the `BaseURL` constant, (2) rename the package directory and all references from `vang247` → `vnprice`. No proto, service interface, or handler changes needed.
**Tech Stack:** Go 1.23, `net/http`, Redis

## Security Implementation Notes

- No auth tokens involved — outbound HTTPS GET to public price API
- Price data is display-only — no monetary calculations are triggered automatically
- No user-controlled input in this flow
- Existing JWT middleware on the inbound endpoint is unchanged

## C4 Architecture Diagram Updates

Update `docs/architecture/c4-component-backend.md`:
- Change `Component(vang_client, "vang.today Client", "pkg/gold + pkg/silver", ...)` → `"vangsaigon.vn Client", "pkg/vnprice", ...`
- Update trust boundary comment and relationship label referencing `vang.today`

---

### Task 1: Change BaseURL constant and verify test passes

**Files:**
- Modify: `src/go-backend/pkg/vang247/client.go` (line 14)

**Security notes:** None — pure configuration change. HTTPS is already used.

**Step 1: Update the constant**

In `src/go-backend/pkg/vang247/client.go`, change line 14:
```go
// Before
BaseURL = "https://services.vang247.vn/ws-prices/api/v1/c_prices"

// After
BaseURL = "https://vangsaigon.vn/ws-prices/api/v1/c_prices"
```

**Step 2: Run the existing test to verify it now passes**
```bash
cd src/go-backend && go test ./pkg/vang247/... -v -timeout 15s
```
Expected: `TestClient_FetchPrices` PASS — gold prices non-empty, silver prices non-empty, XAUUSD present.

**Step 3: Commit**
```
fix(prices): migrate price source from vang247.vn to vangsaigon.vn
```

---

### Task 2: Rename package `vang247` → `vnprice`

**Files:**
- Rename directory: `src/go-backend/pkg/vang247/` → `src/go-backend/pkg/vnprice/`
- Modify: `src/go-backend/pkg/vnprice/client.go` — change `package vang247` → `package vnprice`
- Modify: `src/go-backend/pkg/vnprice/types.go` — change `package vang247` → `package vnprice`
- Modify: `src/go-backend/pkg/vnprice/client_test.go` — change `package vang247` → `package vnprice`
- Modify: `src/go-backend/domain/service/gold_price_service.go` — update import + usage
- Modify: `src/go-backend/domain/service/silver_price_service.go` — update import + usage

**Security notes:** Pure refactor — no logic changes. No security impact.

**Step 1: Rename the directory**
```bash
mv src/go-backend/pkg/vang247 src/go-backend/pkg/vnprice
```

**Step 2: Update the package declaration in all 3 files**

`src/go-backend/pkg/vnprice/client.go` line 1:
```go
package vnprice
```

`src/go-backend/pkg/vnprice/types.go` line 1:
```go
package vnprice
```

`src/go-backend/pkg/vnprice/client_test.go` line 1:
```go
package vnprice
```

**Step 3: Update import in `gold_price_service.go`**

Change:
```go
"wealthjourney/pkg/vang247"
```
to:
```go
"wealthjourney/pkg/vnprice"
```

And update all usages: `vang247.Client` → `vnprice.Client`, `vang247.NewClient(...)` → `vnprice.NewClient(...)`

Full diff for `gold_price_service.go`:
```go
// Line 12: import
"wealthjourney/pkg/vnprice"

// Line 35: struct field
client *vnprice.Client

// Line 42: constructor
client: vnprice.NewClient(10 * time.Second),
```

**Step 4: Update import in `silver_price_service.go`**

Same pattern:
```go
// Line 12: import
"wealthjourney/pkg/vnprice"

// Line 36: struct field
client *vnprice.Client

// Line 43: constructor
client: vnprice.NewClient(10 * time.Second),
```

**Step 5: Verify the build compiles**
```bash
cd src/go-backend && go build ./...
```
Expected: No errors.

**Step 6: Run all affected tests**
```bash
cd src/go-backend && go test ./pkg/vnprice/... ./domain/service/... -v -timeout 30s 2>&1 | grep -E "PASS|FAIL|---"
```
Expected: All tests PASS.

**Step 7: Commit**
```
refactor(prices): rename vang247 package to vnprice for vendor independence
```

---

### Task 3: Update C4 architecture diagram

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`

**Security notes:** Documentation only — no security impact.

**Step 1: Update the component definition**

Find:
```
Component(vang_client, "vang.today Client", "pkg/gold + pkg/silver", "Vietnamese gold/silver price fetching")
```
Replace with:
```
Component(vang_client, "vangsaigon.vn Client", "pkg/vnprice", "Vietnamese gold/silver price fetching via vangsaigon.vn REST API")
```

**Step 2: Update the trust boundary comment** (line ~139)

Find:
```
| **Service → External APIs** | Outbound to Yahoo/vang.today/Google |
```
Replace with:
```
| **Service → External APIs** | Outbound to Yahoo/vangsaigon.vn/Google |
```

**Step 3: Update the data flow description** (line ~188)

Find:
```
→ vang.today (gold/silver)
```
Replace with:
```
→ vangsaigon.vn (gold/silver)
```

**Step 4: Commit**
```
docs(architecture): update C4 diagram to reflect vnprice/vangsaigon.vn migration
```
