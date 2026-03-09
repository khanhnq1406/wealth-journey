# Report Page — Wallet Analytics Charts Specification

## Summary

Four wallet analytics components currently exist as dead code in `app/[locale]/dashboard/home/` (left over from the previous homepage version, never removed): `Balance`, `AccountBalance`, `Dominance`, and `MonthlyDominance`. This feature moves those files into the report page directory and renders them on the report page as a new "Wallet Analytics" section. Each chart retains its own independent year selector powered by `ChartWrapper`. No new APIs or protobuf changes are required — all hooks already exist.

## User Stories

- As a user, I want to see my wallet balance trend over time on the report page, so that I can understand cash flow history without navigating to the old homepage.
- As a user, I want to see wallet dominance (how my wealth is split across wallets) on the report page, so that I can review my asset allocation in context with income/expense data.
- As a user, I want to see how wallet balances changed month by month over the year (monthly dominance stacked area), so that I can spot trends in wallet growth or drawdown.
- As a user, I want each chart to have its own year selector, so that I can compare different years independently across charts.

## Functional Requirements

### FR-1: Move Component Files
Move the four component files from `home/` to `report/`:
- `app/[locale]/dashboard/home/Balance.tsx` → `app/[locale]/dashboard/report/Balance.tsx`
- `app/[locale]/dashboard/home/AccountBalance.tsx` → `app/[locale]/dashboard/report/AccountBalance.tsx`
- `app/[locale]/dashboard/home/Dominance.tsx` → `app/[locale]/dashboard/report/Dominance.tsx`
- `app/[locale]/dashboard/home/MonthlyDominance.tsx` → `app/[locale]/dashboard/report/MonthlyDominance.tsx`

**Acceptance criteria:**
- [ ] All four files exist in the report directory
- [ ] All four files are deleted from the home directory
- [ ] No imports reference the old home paths

### FR-2: Render on Report Page
Add a "Wallet Analytics" section at the bottom of the report page (`app/[locale]/dashboard/report/page.tsx`), after the existing Monthly Summary table.

**Acceptance criteria:**
- [ ] Section heading "Wallet Analytics" (or translated equivalent) is visible
- [ ] All four charts render: Balance, AccountBalance, Dominance, MonthlyDominance
- [ ] Each chart has its own independent year selector (no shared year state at page level)
- [ ] `availableYears` is fetched via `useQueryGetAvailableYears` at the report page level and passed as a prop to each chart
- [ ] Charts appear in this order: Balance → AccountBalance → Dominance → MonthlyDominance
- [ ] Responsive layout: 1-column on mobile, 2-column grid on desktop (lg:grid-cols-2) — matching the existing charts grid above

### FR-3: Delete Dead Files from Home
After the move, the four `.tsx` files must NOT remain in the home directory.

**Acceptance criteria:**
- [ ] `ls app/[locale]/dashboard/home/` shows no Balance, AccountBalance, Dominance, MonthlyDominance files

### FR-4: Pass Available Years
The report page already uses `useQueryGetAvailableYears` indirectly via `ReportControls.tsx`. The report page itself should fetch available years and pass to the four components.

**Acceptance criteria:**
- [ ] `useQueryGetAvailableYears({})` called once at report page level
- [ ] `availableYears` array derived from the response (fallback to `[currentYear]` if empty)
- [ ] Passed as `availableYears` prop to Balance, Dominance, MonthlyDominance; and `availableYears` prop to AccountBalance (optional with default)

## Non-Functional Requirements

- **Performance:** `useQueryGetAvailableYears` is already cached — one additional hook call at page level adds negligible cost. Each chart fetches its own data independently (already how they worked).
- **Security:** Read-only data display. All queries are scoped to the authenticated user's data by the backend JWT middleware — no changes needed.
- **Accessibility:** Section heading uses `<h2>` tag consistent with existing report section headings. Charts inherit existing accessibility from ChartWrapper/LineChart/DonutChartSVG.
- **i18n:** Section title key must be added to translation files if using `useTranslations`. Alternatively, can use a hardcoded English label matching the v2 design aesthetic (align with existing hardcoded strings in report page).

## Architecture Changes (C4)

### Diagrams to Update
**`docs/architecture/c4-component-frontend.md`** — Minor update: the `report` feature module gains 4 additional chart components (Balance, AccountBalance, Dominance, MonthlyDominance). The existing entry for the report page can be updated to note this.

No new diagrams required. This is a file move + composition change, not a new domain.

## Runtime Flow Diagrams

### Flow Diagrams to Update
No flow diagram update needed — these components use existing query hooks with no new multi-step business logic or branching. The data flow (frontend → existing REST endpoints → backend) is unchanged.

## Data Model Changes
None. No new tables, fields, or relationships.

## API Changes
None. All API hooks already exist:
- `useQueryGetBalanceHistory` — used by Balance and AccountBalance
- `useQueryGetMonthlyDominance` — used by MonthlyDominance
- `useQueryListWallets` — used by Dominance
- `useQueryGetAvailableYears` — used at page level

## UI/UX Changes

### Report Page Addition
At the bottom of the report page, after the Monthly Summary table, add:

```
── Wallet Analytics ──────────────────────────────────

[Balance Chart]           [AccountBalance Chart]
(per-wallet line+bar)     (total balance area+lines)

[Dominance Chart]         [MonthlyDominance Chart]
(pie: wallet share)       (stacked area: month-by-month)
```

**Mobile:** 1-column stack (space-y-4)
**Desktop:** 2-column grid (lg:grid-cols-2 gap-4), same pattern as existing charts grid above

Each chart is wrapped in a `BaseCard` with padding `p-3 sm:p-4`, matching the existing charts on the report page. Each chart includes its own `ChartWrapper` year selector (already built into the components).

Add a section heading using the same style as existing headings on the report page:
```tsx
<h2 className="text-xl sm:text-2xl font-bold text-neutral-900">
  {/* Wallet Analytics */}
</h2>
```

### Styling Notes
- Use `motion.div` wrappers with staggered `delay` (continuing from 0.4 used by existing last section → use 0.5 for the heading, 0.6 / 0.7 / 0.8 / 0.9 for each chart)
- `BaseCard` with `p-3 sm:p-4` matching existing chart cards
- No new color tokens needed — components use hardcoded hex colors internally

## Security & Risk Assessment

### Data Flow Diagram
| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Frontend (report page) | GET balance history request | Yes: Frontend → Backend (JWT) | Go backend `/api/v1/wallets/.../balance-history` | Existing endpoint, JWT validated |
| 2 | Frontend (report page) | GET monthly dominance request | Yes: Frontend → Backend (JWT) | Go backend monthly dominance endpoint | Existing endpoint, JWT validated |
| 3 | Frontend (report page) | GET wallet list request | Yes: Frontend → Backend (JWT) | Go backend wallet list endpoint | Existing endpoint, JWT validated |
| 4 | Backend | Balance/wallet data (user-scoped) | Yes: Backend → Frontend | Report page | Data scoped by user ID from JWT |

### Trust Boundaries
| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | All API requests | JWT validated on every request by backend middleware |
| Backend → Frontend | Response data | User-scoped queries only return the authenticated user's data |

### Threats Identified (STRIDE per boundary crossing)
| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1,2,3 | Internet → App | Information Disclosure | Unauthorized user reads another user's wallet data | Low | Backend already validates JWT and scopes all wallet queries to `userID` extracted from token — no change needed |
| T-2 | 4 | Backend → Frontend | Information Disclosure | Sensitive balance amounts displayed | Low | This is existing behavior; data already shown on portfolio page. No new exposure. |

### Authorization Rules
- All read operations are user-scoped at the backend — no change needed
- No mutations in this feature

### Input Validation Rules
- `availableYears` prop is a `number[]` derived from API response — no user input
- `selectedYear` state in each component is constrained to options from `availableYears` (ChartWrapper select) — safe

### External Dependency Risks
- None new. All API hooks already in production use on other pages.

### Sensitive Data Handling
- Wallet balances and names are displayed — same sensitivity level as the existing Wallets page and Portfolio page. No new risk.

### Issues & Risks Summary
1. **Translation keys**: If the section heading uses `useTranslations`, a new key must be added to all locale files. Risk: forgotten locale = runtime error. Mitigation: either hardcode the string (low-risk shortcut for an internal heading) or add keys to all locale files.
2. **`availableYears` duplicate fetch**: The report page will now call `useQueryGetAvailableYears` directly. `ReportControls.tsx` also calls this hook. React Query deduplicates same-key concurrent calls, so this has zero performance cost — but it's worth noting the duplication.
3. **Dead import cleanup**: After moving files, any TypeScript path alias cache may need a dev server restart. Not a code issue but a DX note.

## Edge Cases & Error Handling

- **No wallets**: `Dominance` renders an empty pie chart (already handled by `DonutChartSVG` with empty data)
- **No balance history**: `Balance` and `AccountBalance` render an empty `LineChart` (already handled)
- **No monthly dominance data**: `MonthlyDominance` renders an empty chart (already handled)
- **`availableYears` empty from API**: Fallback to `[currentYear]` — same pattern already used in `ReportControls`

## Dependencies & Assumptions

- `ChartWrapper`, `LineChart`, `DonutChartSVG` components are already in `@/components/charts`
- `useQueryGetBalanceHistory`, `useQueryGetMonthlyDominance`, `useQueryListWallets`, `useQueryGetAvailableYears` are all in `@/utils/generated/hooks`
- `CurrencyContext`, `useCurrency` are available project-wide
- The report page is a `"use client"` component (already is)
- No backend changes required

## Out of Scope

- Adding these charts back to the home page
- Creating new API endpoints
- Adding export functionality for the new wallet charts
- Modifying the ChartWrapper year selector behavior
- Adding wallet filter (the `Balance` component already has a wallet dropdown built in)
