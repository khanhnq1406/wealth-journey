# Price Alert Bugs Fix Specification

## Summary

Two bugs in the user price alert system prevent correct operation: (1) USD price alerts show values divided by 100 in notifications because `FormatUserAlertPrice` incorrectly assumes cents-based storage, and (2) Vietnamese gold symbol names like "Vàng nhẫn SJC" are rejected by the symbol validation regex which only allows ASCII alphanumeric characters. Both bugs are backend-only fixes with no API or frontend changes required.

## User Stories

- As a user with a BTC price alert at $50,000, I want my notification to display "$50,000" (not "$500"), so that I can trust the alert information.
- As a Vietnamese user, I want to create price alerts for gold assets with Vietnamese names like "Vàng nhẫn SJC", so that I can monitor gold prices I care about.

## Functional Requirements

### FR-1: Fix USD Price Formatting in Notifications

**Root cause:** `FormatUserAlertPrice()` in `price_alert_config.go:303-312` divides USD prices by 100, assuming they are stored in cents. But `TargetPrice` is stored as the raw value from the frontend (e.g., `50000` for $50,000 — NOT `5000000` for 50,000 cents).

The existing test at line 420-436 is also wrong — it validates the buggy behavior:
```go
{5000000, "USD", "50,000.00 USD"},  // Test assumes 5,000,000 cents = $50,000
{5050, "USD", "50.50 USD"},         // Test assumes 5,050 cents = $50.50
```

In reality, the frontend sends whole-dollar amounts (confirmed by `CreatePriceAlertForm.tsx:349` and `PriceAlertList.tsx:39-54` which formats USD directly without division).

**Fix:** Remove the `price / 100` division in `FormatUserAlertPrice`. USD values should be formatted the same as VND — with thousand separators and no decimal division.

**Acceptance criteria:**
- [ ] `FormatUserAlertPrice(50000, "USD")` returns `"50,000 USD"` (not `"500.00 USD"`)
- [ ] `FormatUserAlertPrice(1234567, "VND")` returns `"1,234,567 VND"` (unchanged)
- [ ] Existing test `TestFormatUserAlertPrice` updated with correct expectations
- [ ] Notification title/body for USD alerts displays correct values
- [ ] `FormatPriceForDisplay` (system alerts, uses category-based formatting with actual cents storage) is NOT modified — only `FormatUserAlertPrice` changes

### FR-2: Allow Vietnamese Characters and Spaces in Symbol Validation

**Root cause:** `symbolPattern` in `user_price_alert_service.go:32` is `^[a-zA-Z0-9.\-_]+$` which rejects:
- Accented Vietnamese characters (à, ă, â, ê, ô, ơ, ư, etc.)
- Spaces (used in gold names like "Vàng nhẫn SJC")

Vietnamese gold type codes from the `asset_display_config` system use descriptive Vietnamese names as identifiers.

**Fix:** Expand the regex to allow Unicode letters and spaces:
```go
var symbolPattern = regexp.MustCompile(`^[\p{L}\p{N}.\-_ ]+$`)
```

Where `\p{L}` matches any Unicode letter and `\p{N}` matches any Unicode digit.

**Acceptance criteria:**
- [ ] `"Vàng nhẫn SJC"` is accepted as a valid symbol
- [ ] `"SJL1L10"` is still accepted (ASCII symbols unchanged)
- [ ] `"XAU"` is still accepted
- [ ] `"Bạc Phú Quý 1L"` is accepted
- [ ] Empty string and strings > 50 chars are still rejected
- [ ] HTML/script injection attempts are still rejected (the `validator.SanitizeStringField` on the `name` field handles this, and symbols don't reach HTML rendering)
- [ ] Test coverage for Vietnamese symbol validation added

## Non-Functional Requirements

- **Performance:** No impact — regex change is trivial.
- **Security:** The expanded regex still blocks special characters (`<`, `>`, `"`, `'`, `;`, `{`, `}`, etc.) — only Unicode letters, digits, dots, dashes, underscores, and spaces are allowed. See Security section for detailed analysis.
- **Backwards compatibility:** Existing alerts with ASCII symbols are unaffected. No migration needed.

## Architecture Changes (C4)

### Diagrams to Update

None — these are bug fixes within existing components, no new components or relationships.

### New Diagrams

None needed.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — the data flow and sequence remain identical. Only the internal logic of validation and formatting changes.

### New Flow Diagrams

None needed.

## Data Model Changes

None — no schema changes required. The `symbol` column (`size:50`) already supports Unicode strings in PostgreSQL.

## API Changes

None — the API contract is unchanged. The same `CreateUserPriceAlertRequest` and notification metadata structure is used.

## UI/UX Changes

None — these are backend-only fixes. The frontend already displays prices correctly (via `PriceAlertList.formatPrice`) and sends Vietnamese symbols without issue.

### Existing Component Inventory (REQUIRED)

No new components needed.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | Symbol string (Vietnamese) | Yes: Internet → App | REST Handler | Previously rejected; now accepted |
| 2 | REST Handler | Validated symbol | No (same tier) | Service Layer | Regex validated |
| 3 | Service Layer | Symbol as TypeCode | Yes: App → DB | PostgreSQL | Used in `WHERE type_code = ?` (parameterized) |
| 4 | Service Layer | Formatted price string | No (same tier) | Notification Metadata | Was incorrectly formatted; now fixed |
| 5 | Background Job | Notification JSON | Yes: App → Push | Firebase/SSE | Contains resolved title/body |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → Application | Symbol string with Vietnamese chars | Regex validation (`[\p{L}\p{N}.\-_ ]+`), length check (1-50), JWT auth |
| Application → Database | Symbol as query parameter | GORM parameterized queries — no injection risk |
| Application → Push Service | Formatted notification text | HTML stripped by `SanitizePriceAlertConfig`, no user-controlled HTML in push |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Tampering | Inject malicious Unicode (RTL override, zero-width chars) | Low | Regex `\p{L}` only matches letters, not control chars; `\p{N}` only digits |
| T-2 | 3 | App → DB | Injection | SQL injection via Unicode symbol | Low | GORM parameterized queries — symbol is never interpolated into SQL |
| T-3 | 5 | App → Push | Info Disclosure | Incorrect price in notification leaks financial info | Low | Fixed by FR-1 — correct formatting |

### Authorization Rules

No changes — existing ownership-based authorization (JWT → `userID`) remains enforced for all CRUD operations.

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| `symbol` | string | 1-50 chars, Unicode letters/digits/dots/dashes/underscores/spaces | `symbolPattern` regex + `strings.TrimSpace` |

### External Dependency Risks

None — no new dependencies introduced.

### Sensitive Data Handling

No change — price alerts contain financial preferences (not financial data). The fix corrects display formatting only.

### Issues & Risks Summary

1. **Low risk:** Expanded regex accepts broader character set — mitigated by keeping strict allowlist (only `\p{L}\p{N}.\-_ `)
2. **Low risk:** Changing `FormatUserAlertPrice` affects all future USD notifications — but the current behavior is definitively wrong (dividing by 100 when values aren't in cents)
3. **No risk:** `FormatPriceForDisplay` (system alerts) is NOT modified — it correctly handles cents-based storage for `gold_usd`/`silver_usd` categories

## Edge Cases & Error Handling

| Case | Expected Behavior |
|------|------------------|
| Symbol with only spaces (after trim) | Rejected — length check catches empty string |
| Symbol with mixed Vietnamese + ASCII ("Vàng SJC 9999") | Accepted — regex allows the mix |
| USD targetPrice = 0 | Rejected by existing `TargetPrice > 0` check |
| FormatUserAlertPrice with negative price | Returns formatted negative (e.g., "-50,000 USD") — same as VND path |
| Existing triggered notifications with wrong USD formatting | Not retroactively fixable — stored in notification metadata as resolved strings |

## Dependencies & Assumptions

- PostgreSQL `varchar(50)` supports UTF-8 Vietnamese characters (confirmed — PostgreSQL uses UTF-8 by default)
- Frontend `CreatePriceAlertForm` already sends Vietnamese symbols without client-side rejection (the form uses a select/autocomplete from the asset display config, not free-text)
- The `FormatPriceForDisplay` function (used for system price alerts with category-based `gold_usd`/`silver_usd`) correctly divides by 100 because those prices **are** stored in cents — this function must NOT be changed

## Out of Scope

- Retroactive fix of existing notification records with wrong USD formatting
- Frontend price formatting changes (frontend already handles this correctly)
- Changes to `FormatPriceForDisplay` (system alert formatter — separate concern, correctly implemented)
- Adding decimal support for USD user alert prices (current int64 storage is sufficient for whole-dollar alerts)
