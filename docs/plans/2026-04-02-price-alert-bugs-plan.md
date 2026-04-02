# Price Alert Bugs Fix Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix two backend bugs: (1) USD price alerts show values divided by 100 in notifications, (2) Vietnamese gold symbol names rejected by ASCII-only regex.

**Spec:** `docs/specs/2026-04-02-price-alert-bugs-spec.md`

**Architecture:** Bug fixes within existing service layer. No new components, no API changes, no frontend changes. Both fixes are in `domain/service/` — `price_alert_config.go` (FR-1) and `user_price_alert_service.go` (FR-2).

**Tech Stack:** Go 1.25, GORM, PostgreSQL (UTF-8)

## Security Implementation Notes

- Authentication: No changes — existing JWT auth enforced on all price alert endpoints
- Authorization: No changes — existing ownership-based `userID` checks remain
- Input validation: FR-2 expands `symbolPattern` regex to allow Unicode letters (`\p{L}`) and spaces — still blocks special characters (`<`, `>`, `"`, `'`, `;`, `{`, `}`, etc.)
- Data sanitization: No changes — `SanitizePriceAlertConfig` already strips HTML from templates

## Component Reuse Inventory (Frontend Tasks)

No frontend tasks — both bugs are backend-only.

## C4 Architecture Diagram Updates

None — bug fixes within existing components, no new components or relationships.

---

### Task 0: Update C4 Architecture Diagrams

**Skip** — no architecture changes.

---

### Task N-1: Create/Update Runtime Flow Diagrams

**Skip** — no flow changes. The data flow and sequence remain identical; only internal formatting/validation logic changes.

---

### Task 1: Fix USD Price Formatting in FormatUserAlertPrice

**Files:**

- Modify: `src/go-backend/domain/service/price_alert_config.go:303-312`
- Test: `src/go-backend/domain/service/price_alert_config_test.go:420-436`

**Security notes:** No security concerns — this is a display formatting fix. `FormatPriceForDisplay` (system alerts, uses cents-based storage) must NOT be modified.

**Step 1: Write the failing test (update existing test with correct expectations)**

Update `TestFormatUserAlertPrice` in `price_alert_config_test.go`:

```go
func TestFormatUserAlertPrice(t *testing.T) {
	tests := []struct {
		price    int64
		currency string
		expected string
	}{
		{50000, "VND", "50,000 VND"},
		{1234567, "VND", "1,234,567 VND"},
		{50000, "USD", "50,000 USD"},      // Was: {5000000, "USD", "50,000.00 USD"} — wrong, prices stored as whole dollars
		{1234567, "USD", "1,234,567 USD"}, // Was: {5050, "USD", "50.50 USD"} — wrong, not cents
		{0, "VND", "0 VND"},
		{0, "USD", "0 USD"},
	}
	for _, tt := range tests {
		result := FormatUserAlertPrice(tt.price, tt.currency)
		assert.Equal(t, tt.expected, result, "price=%d currency=%s", tt.price, tt.currency)
	}
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test -run TestFormatUserAlertPrice ./domain/service/ -v
```

Expected: FAIL — existing `FormatUserAlertPrice(50000, "USD")` returns `"500.00 USD"` instead of `"50,000 USD"`.

**Step 3: Write minimal implementation**

In `price_alert_config.go`, replace the `FormatUserAlertPrice` function:

```go
// FormatUserAlertPrice formats a price (int64) with currency suffix for user alerts.
// User alert prices are stored as whole units (not cents) — e.g., 50000 means $50,000.
// Both VND and USD: comma thousands, no decimal division.
func FormatUserAlertPrice(price int64, currency string) string {
	return fmt.Sprintf("%s %s", FormatWithThousandSeparators(price), strings.ToUpper(currency))
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -run TestFormatUserAlertPrice ./domain/service/ -v
```

Expected: PASS

**Step 5: Verify FormatPriceForDisplay is NOT modified**

Grep to confirm `FormatPriceForDisplay` still has its `/100` logic (system alerts use cents-based storage):

```bash
grep -A5 "func FormatPriceForDisplay" src/go-backend/domain/service/price_alert_config.go
```

**Step 6: Run full price_alert_config tests**

```bash
cd src/go-backend && go test -run TestFormat ./domain/service/ -v
```

**Step 7: Commit**

```
fix(price-alert): remove incorrect /100 division in FormatUserAlertPrice for USD

User alert target prices are stored as whole dollars (not cents), so dividing
by 100 produced wrong notification values (e.g., $50,000 displayed as $500).
```

---

### Task 2: Allow Vietnamese Characters and Spaces in Symbol Validation

**Files:**

- Modify: `src/go-backend/domain/service/user_price_alert_service.go:32`
- Modify: `src/go-backend/domain/service/user_price_alert_service.go:75-76` (error message)
- Test: `src/go-backend/domain/service/user_price_alert_service_test.go` (add new test)

**Security notes:**
- Expanded regex uses `\p{L}` (Unicode letters only) — does NOT match control characters, RTL overrides, or zero-width chars
- `\p{N}` matches Unicode digits only
- Spaces are explicitly allowed (gold names like "Vàng nhẫn SJC")
- Special characters (`<`, `>`, `"`, `'`, `;`, `{`, `}`) remain blocked
- Symbol values are used in GORM parameterized queries — no SQL injection risk
- `SanitizePriceAlertConfig` already strips HTML from notification templates

**Step 1: Write the failing test (Vietnamese symbol validation)**

Add to `user_price_alert_service_test.go`:

```go
func TestSymbolPattern_VietnameseCharacters(t *testing.T) {
	tests := []struct {
		symbol string
		valid  bool
	}{
		// Vietnamese gold names (must pass)
		{"Vàng nhẫn SJC", true},
		{"SJL1L10", true},
		{"XAU", true},
		{"Bạc Phú Quý 1L", true},
		{"Vàng SJC 9999", true},

		// Existing valid patterns (unchanged)
		{"BTC-USD", true},
		{"GOLD.VN", true},
		{"my_symbol", true},

		// Invalid patterns (must fail)
		{"", false},                             // empty after trim handled by length check, but regex won't match empty
		{"<script>alert(1)</script>", false},     // injection attempt
		{"symbol;DROP TABLE", false},             // SQL-like injection
		{"name\"with'quotes", false},             // quotes
	}
	for _, tt := range tests {
		result := symbolPattern.MatchString(tt.symbol)
		assert.Equal(t, tt.valid, result, "symbol=%q", tt.symbol)
	}
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test -run TestSymbolPattern_VietnameseCharacters ./domain/service/ -v
```

Expected: FAIL — `"Vàng nhẫn SJC"` fails because `à`, `ẫ`, and space are not matched by `[a-zA-Z0-9.\-_]+`.

**Step 3: Write minimal implementation**

In `user_price_alert_service.go`, change line 32:

```go
// symbolPattern validates alert symbols: Unicode letters, digits, dots, dashes, underscores, spaces.
var symbolPattern = regexp.MustCompile(`^[\p{L}\p{N}.\-_ ]+$`)
```

Also update the error message at line 75-76 to reflect the expanded allowlist:

```go
return nil, apperrors.NewValidationError("symbol contains invalid characters")
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -run TestSymbolPattern_VietnameseCharacters ./domain/service/ -v
```

Expected: PASS

**Step 5: Run existing CreateAlert tests to verify no regression**

```bash
cd src/go-backend && go test -run TestUserPriceAlertService_CreateAlert ./domain/service/ -v
```

**Step 6: Run full service test suite**

```bash
cd src/go-backend && go test ./domain/service/ -v -count=1
```

**Step 7: Commit**

```
fix(price-alert): allow Vietnamese characters and spaces in symbol validation

Gold type codes from asset_display_config use Vietnamese names like
"Vàng nhẫn SJC" which were rejected by the ASCII-only regex.
Expanded to \p{L}\p{N} (Unicode letters/digits) plus dots, dashes,
underscores, and spaces.
```

---

### Task 3: Final Verification — Lint & Build

**Files:** None (verification only)

**Step 1: Run golangci-lint**

```bash
cd src/go-backend && task ci:backend-lint
```

**Step 2: Run all backend tests**

```bash
cd src/go-backend && go test -short ./...
```

**Step 3: Verify no Playwright E2E needed**

These are backend-only changes — no frontend test updates required. The existing `price-alerts-settings-flow.spec.ts` E2E test does not exercise notification formatting or Vietnamese symbol creation from the backend.

**Step 4: Commit (if any lint fixes needed)**

---

## Task Dependencies

```
Task 1 (USD formatting) ──┐
                           ├──→ Task 3 (Final verification)
Task 2 (Vietnamese regex) ─┘
```

Tasks 1 and 2 are independent and can be implemented in parallel. Task 3 depends on both.
