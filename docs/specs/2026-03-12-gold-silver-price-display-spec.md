# Gold & Silver Price Display Improvements Specification

## Summary

Improve the gold and silver price tables and charts across both the landing page and home dashboard by: (1) filtering gold price tables to show only 9 specific types with custom display names, (2) showing update timestamps in "Cập nhật dd/mm/yyyy giờ:phút" format, and (3) replacing Select dropdowns with toggle button UI for the gold type selector and silver unit selector in charts.

## User Stories

- As a user, I want to see only the most relevant gold price types in the table, so I can quickly compare prices without scrolling through less important entries.
- As a user, I want to see when the gold/silver prices were last updated in a clear Vietnamese date format, so I know how fresh the data is.
- As a user, I want the gold type and silver unit selectors to look like toggle buttons (matching the market toggle), so the UI feels consistent and is easier to tap on mobile.

## Functional Requirements

### FR-1: Filter Gold Price Table to 9 Specific Types

**Applies to:** Home dashboard `GoldPriceTable` and landing page `LandingGoldPriceTable`

The gold price table must show only these 9 types, in this exact order, with these display names:

| # | Display Name | API Source Array | API `Name` Field |
|---|---|---|---|
| 1 | SJC | sjcNationWide | `SJC` |
| 2 | SJC Tự Do | sjcNationWide | `SJC TD` |
| 3 | Nhẫn SJC 9999 | **vsg_gold_table** | `Vàng nhẫn SJC` |
| 4 | Nhẫn Doji 9999 | goldNationWide | `Doji_24K` |
| 5 | SJC Mi Hồng | sjcNationWide | `Mi hồng` |
| 6 | Nhẫn Mi Hồng 9999 | goldNationWide | `Mihong_999` |
| 7 | SJC BTMC | sjcNationWide | `BTMC` |
| 8 | Nhẫn BTMC | goldNationWide | `BTMC_24K` |
| 9 | PNJ | **vsg_gold_table** | `PNJ HCM` |

**Backend changes required:**
- Parse `vsg_gold_table` array from API response (currently not parsed) to extract "Vàng nhẫn SJC" and "PNJ HCM"
- Add new gold type entries in `types.go` for these 2 new sources
- The backend should return ALL gold types (no filtering at backend level) — filtering happens on the frontend

**Frontend changes:**
- Define a `GOLD_TABLE_FILTER` constant with the 9 API type codes and their display name overrides
- Filter and reorder `goldPrices` array before rendering in both `GoldPriceTable` and `LandingGoldPriceTable`

**Acceptance criteria:**
- [ ] Gold price tables show exactly 9 rows in the specified order
- [ ] Display names match the table above (not API names)
- [ ] Both home dashboard and landing page tables are filtered identically
- [ ] No other gold types appear in the tables

### FR-2: Update Timestamp Format — "Cập nhật dd/mm/yyyy giờ:phút"

**Applies to:** `GoldPriceTable`, `SilverPriceTable`, `LandingGoldPriceTable`, `LandingSilverPriceTable`

**Current behavior:**
- Home dashboard: Shows "Cập nhật HH:MM" using `new Date()` (current browser time, not API timestamp)
- Landing page: Does not show update time

**New behavior:**
- Use the `UpdatedAt` field from the API's `PriceItem` (Unix timestamp from the actual price data source)
- Format as: `Cập nhật dd/mm/yyyy HH:mm` (e.g. "Cập nhật 12/03/2026 14:30")
- Use the most recent `UpdatedAt` across all price items for the section header
- Show on all 4 tables (home gold, home silver, landing gold, landing silver)

**For landing page:** The landing page currently fetches only type metadata (no prices, no timestamps) from `/api/v1/public/market-types`. Two approaches:
- Option A: Add a `timestamp` from the latest gold/silver price update to the public endpoint
- Option B: Show current time on landing page, API timestamp on home page

**Selected: Option A** — Add a `goldUpdatedAt` and `silverUpdatedAt` timestamp field to the `/api/v1/public/market-types` response, sourced from the latest price data fetch.

**Acceptance criteria:**
- [ ] Time format is "Cập nhật dd/mm/yyyy HH:mm" in Vietnamese locale
- [ ] Time comes from actual API data, not browser clock
- [ ] Both gold and silver tables show update time
- [ ] Both landing page and home dashboard show update time
- [ ] English locale shows equivalent format: "Updated dd/mm/yyyy HH:mm"

### FR-3: Toggle Button UI for Chart Selectors

**Applies to:** `GoldPriceChart` (gold type selector), `SilverPriceChart` (silver unit selector), and their landing page counterparts

**Current behavior:**
- Gold chart: `Select` dropdown for SJC/999 selection
- Silver chart: `Select` dropdown for C/L/KG selection

**New behavior:**
- Replace both `Select` dropdowns with toggle button groups identical to the market toggle pattern:
  ```
  [bg-v2-bg-primary rounded-lg p-0.5] container
    [px-2.5 py-1 rounded-md text-[11px] font-medium] active: bg-white shadow-sm text-v2-text-primary
    [px-2.5 py-1 rounded-md text-[11px] font-medium] inactive: text-v2-text-secondary
  ```
- Gold chart toggle: `SJC | 999` (2 options)
- Silver chart toggle: `C | L | KG` (3 options)
- Landing page chart placeholders already show the correct toggle style for silver — just ensure gold chart placeholder also matches

**Acceptance criteria:**
- [ ] Gold chart uses toggle buttons instead of Select dropdown
- [ ] Silver chart uses toggle buttons instead of Select dropdown
- [ ] Toggle styling matches the market domestic/global toggle exactly
- [ ] Active state has white background with shadow
- [ ] Inactive state has transparent background with secondary text color
- [ ] Toggle works correctly on mobile (tappable, no overflow)
- [ ] Landing page chart placeholders also show toggle style for gold type selector

## Non-Functional Requirements

- **Performance:** No additional API calls — reuse existing data. The `vsg_gold_table` parsing adds minimal overhead to the existing API response processing.
- **Security:** No new endpoints or auth changes. Filtering is frontend-only for tables.

## Data Model Changes

### Backend: Parse `vsg_gold_table`

In `pkg/vnprice/client.go` → `FetchPrices()`:
- Parse `apiResp.VSGGoldTable` (already defined in `types.go` as `VSGGoldTable []PriceEntry`)
- Extract entries matching: `Vàng nhẫn SJC`, `PNJ HCM`
- Add them to `goldPrices` result with appropriate names

### Backend: New Gold Types in `types.go`

Add 2 new entries to `GoldTypes`:
```go
{Code: "Vàng nhẫn SJC", Name: "Nhẫn SJC 9999", Currency: "VND", Unit: UnitTael, ...}
{Code: "PNJ HCM",       Name: "PNJ",            Currency: "VND", Unit: UnitTael, ...}
```

### Backend: Public Endpoint Enhancement

Add `goldUpdatedAt` and `silverUpdatedAt` to `/api/v1/public/market-types` response. This requires the public handler to fetch latest price data timestamps (can use a lightweight cache check).

## API Changes

### Modified: `GET /api/v1/investments/market-prices`

No structural change — just returns additional items from `vsg_gold_table` in the `gold` array.

### Modified: `GET /api/v1/public/market-types`

Add two optional timestamp fields:
```json
{
  "gold": [...],
  "silver": [...],
  "goldUpdatedAt": "2026-03-12T14:30:00+07:00",
  "silverUpdatedAt": "2026-03-12T14:30:00+07:00",
  "timestamp": "..."
}
```

## UI/UX Changes

### Gold Price Table (Home + Landing)
- Filter to 9 rows with custom display names
- Show "Cập nhật dd/mm/yyyy HH:mm" timestamp in header

### Silver Price Table (Home + Landing)
- Show "Cập nhật dd/mm/yyyy HH:mm" timestamp in header

### Gold Chart (Home + Landing)
- Replace `Select` dropdown with toggle button group: `SJC | 999`
- Match market toggle styling

### Silver Chart (Home + Landing)
- Replace `Select` dropdown with toggle button group: `C | L | KG`
- Match market toggle styling

## Security & Risk Assessment

### Threats Identified

This is a **low-risk, display-only change**. No new endpoints requiring auth, no new data inputs, no financial operations.

| # | Threat | Severity | Mitigation |
|---|--------|----------|------------|
| T-1 | Additional API data parsing could introduce malformed data | Low | Reuse existing parsing logic; same API source |
| T-2 | Frontend display name override could show wrong price for wrong type | Low | Use strict type code matching, not index-based |

### Authorization Rules
No changes — same authenticated endpoints, same public endpoint.

### Input Validation Rules
No new user inputs. All changes are display/formatting.

## Edge Cases & Error Handling

1. **Missing gold types:** If any of the 9 filtered types is not in the API response, skip it (don't show an empty row)
2. **Missing `vsg_gold_table`:** If the VSG table array is empty/missing, the 2 new types won't appear — gracefully degrade to 7 rows
3. **Missing `UpdatedAt`:** If timestamp is 0 or invalid (like `0001-01-01`), fall back to current time
4. **PNJ HCM missing:** If `PNJ HCM` is not in API but `PNJ Hà Nội` is, fall back to `PNJ Hà Nội`

## Dependencies & Assumptions

- The `vangsaigon.vn` API continues to return `vsg_gold_table` array with `Vàng nhẫn SJC` and `PNJ HCM` entries
- The `VSGGoldTable` field is already defined in `vnprice/types.go` APIResponse struct
- No new external API integrations needed (Mi Hồng data comes from existing API, not mihong.vn)

## Out of Scope

- Filtering the silver price table (show all silver types as-is)
- Adding new gold types to the chart (chart keeps SJC/999 toggle only)
- Market prices page (`/dashboard/prices`) — only landing and home page affected
- Mi Hồng website API integration — Mi Hồng prices already available from vangsaigon.vn
