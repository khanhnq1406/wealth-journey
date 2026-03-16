# PNL Chart & Portfolio History Fixes — Specification

## Summary

Fix four issues in the PNL chart (PNLCard on homepage) and portfolio history system: (1) aggregated history chart shows per-wallet values instead of summed totals, (2) no historical snapshot backfill when investments are created with past purchase dates, (3) silent fallback to all-time PNL when period snapshots are missing, (4) CASH investments with `CurrentPrice=0` show -100% unrealized PNL.

## User Stories

- As a user with multiple investment wallets, I want the PNL chart to show my **total** portfolio value over time, not individual wallet values interleaved.
- As a user adding a historical investment (e.g., gold bought 3 months ago), I want the period PNL to correctly reflect that I owned it during the period.
- As a user viewing 1D/1W/1M PNL, I want to know if the data is approximate or unavailable, not silently shown as all-time PNL.
- As a user tracking cash holdings, I want them to not drag my portfolio PNL to -100%.

## Functional Requirements

### FR-1: Aggregate Historical Portfolio Values by Timestamp

**Current behavior:** `GetAggregatedHistory()` returns raw per-wallet rows ordered by timestamp. `sampleData()` picks every Nth row, grabbing individual wallet entries.

**Required behavior:** Group per-wallet snapshots by timestamp (rounded to the nearest hour), sum `TotalValue`, `TotalCost`, `TotalPnl` across wallets within each group, then return one aggregated row per time bucket.

**Acceptance criteria:**
- [ ] For a user with 2 wallets (100M + 50M), the chart shows ~150M data points, not alternating 100M/50M
- [ ] Single-wallet users see no behavior change
- [ ] `sampleData()` operates on already-aggregated rows

### FR-2: Backfill Snapshot on Investment Creation with Past Purchase Date

**Current behavior:** `CreateInvestment()` creates the investment and transaction but no portfolio history snapshot. The hourly scheduler captures the first snapshot 0–60 minutes later.

**Required behavior:** After creating an investment with `purchaseDate > 0` (a past date), create an additional portfolio history snapshot timestamped at the purchase date. This ensures period PNL calculations have a baseline that includes the new investment.

**Acceptance criteria:**
- [ ] Creating an investment with `purchaseDate` 2 months ago triggers a snapshot at that date
- [ ] The snapshot reflects the portfolio state *after* adding the new investment
- [ ] Investments created without `purchaseDate` (or `purchaseDate=0`) still behave as before (no extra snapshot)
- [ ] The backfilled snapshot does not duplicate if one already exists within 1 hour of the purchase date

### FR-3: Indicate Missing Period Data Instead of Silent Fallback

**Current behavior:** `computePeriodPnl()` returns all-time PNL when no period snapshot exists, with no indication to the frontend.

**Required behavior:** Return a flag indicating whether the period PNL is exact or approximate (fallback). The frontend can then display an indicator.

**Acceptance criteria:**
- [ ] Backend response includes `periodPnlApproximate: bool` field
- [ ] When snapshot is missing, `periodPnlApproximate = true`
- [ ] Frontend shows a subtle indicator (e.g., "~" prefix or tooltip) when approximate
- [ ] Normal period PNL (with snapshot) shows no indicator

### FR-4: Set CurrentPrice = AverageCost for CASH/FOREIGN_CURRENCY Investments

**Current behavior:** CASH/FOREIGN_CURRENCY are created with `isCustom=true`, which sets `currentPrice=0`. `Recalculate()` then computes `CurrentValue=0` and `UnrealizedPNL=-TotalCost`.

**Required behavior:** For CASH and FOREIGN_CURRENCY types, set `currentPrice = averageCost` at creation time (same as non-custom investments). This makes `CurrentValue = TotalCost` and `UnrealizedPNL = 0`, which is semantically correct for cash holdings.

**Acceptance criteria:**
- [ ] New CASH investment: `UnrealizedPNL = 0`, `UnrealizedPNLPercent = 0`
- [ ] New FOREIGN_CURRENCY investment: `UnrealizedPNL = 0` at creation
- [ ] Existing custom investments (non-CASH/FOREIGN_CURRENCY) remain unchanged (`currentPrice=0`)
- [ ] `UpdatePrices()` still skips custom investments (CASH price shouldn't change from market data)

## Non-Functional Requirements

- Performance: SQL aggregation preferred over in-memory for FR-1 (avoid fetching all rows)
- Security: No new endpoints or authorization changes needed — all fixes are in existing authenticated paths
- Backward compatibility: Existing snapshots remain valid; new aggregation logic works with old data

## Architecture Changes (C4)

### Diagrams to Update

- `docs/architecture/flow-investment.md` — Update "Portfolio Summary" or add "Portfolio History Snapshot" flow showing the backfill path

### New Diagrams

None needed — these are fixes to existing components, not new bounded contexts.

## Data Model Changes

None. The `PortfolioHistory` model is unchanged. FR-3 adds a response field to the proto, not a DB column.

## API Changes

### FR-3: Add `periodPnlApproximate` to portfolio summary response

In `investment.proto`, add to `PortfolioSummaryData`:
```protobuf
bool period_pnl_approximate = N; // true when period PNL falls back to all-time
```

This field is added to the existing `PortfolioSummaryData` message. No new endpoints.

## UI/UX Changes

### FR-3: Approximate PNL Indicator

When `periodPnlApproximate` is true, prefix the PNL amount with "≈" (approximately equal). This is a minimal, non-intrusive indicator.

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| PNL display | PNLCard | `app/[locale]/dashboard/home/PNLCard.tsx` |
| Chart | LineChart | `components/charts/LineChart.tsx` |
| Net worth display | NetWorthDisplay | `app/[locale]/dashboard/home/NetWorthDisplay.tsx` |

### New Components

None.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Scheduler | Portfolio snapshot | No (internal) | DB | Existing path, unchanged |
| 2 | CreateInvestment | Backfill snapshot | No (internal) | DB | New: snapshot at purchase date |
| 3 | DB | Aggregated history | No (internal) | Service | Fix: SQL aggregation |
| 4 | Service | PNL + approximate flag | Yes: Backend → Frontend | PNLCard | New field in response |

### Threats Identified

| # | Data Flow | STRIDE | Threat | Severity | Mitigation |
|---|-----------|--------|--------|----------|------------|
| T-1 | 2 | Tampering | User could craft `purchaseDate` far in the past to create misleading historical data | Low | Already validated: `purchaseDate <= now()`. Backfill only creates one snapshot per creation. |
| T-2 | 3 | Information Disclosure | Aggregated history across wallets is already scoped to authenticated user | N/A | Existing JWT auth + user ownership |

### Issues & Risks Summary

1. SQL aggregation query must be tested with both single-wallet and multi-wallet users
2. Backfill snapshot at purchase date may conflict with existing snapshots (handled by `IsDuplicate` 1-hour window)
3. Proto change requires `task proto:all` regeneration

## Edge Cases & Error Handling

- User with 0 wallets: No snapshots to aggregate — chart shows empty state (unchanged)
- User with 1 wallet: Aggregation returns same values as single-wallet query (no regression)
- Purchase date exactly 1 hour from existing snapshot: `IsDuplicate` returns true, existing snapshot updated
- CASH investment with quantity 0: `CurrentValue=0`, `UnrealizedPNL=0` (correct)
- Currency mismatch in aggregation: Snapshots are already stored in user's preferred currency (from `GetPortfolioSummary`)

## Out of Scope

- Retroactive historical price reconstruction (e.g., computing what portfolio was worth at each past date)
- Changing CASH investments to track FX-based PNL
- Adding missing period data interpolation
