# Replace FAB with Add Investment Only — Specification

## Summary

Replace the current global FloatingActionButton (FAB) in the dashboard layout — which has 3 expandable actions (Add Transaction, Transfer Money, Create Wallet) — with a single "Add Investment" action. The FAB retains the expandable pattern but only shows one action. The Add Investment modal opens in-place on whatever page the user is on. The existing inline "Add Investment" button on the portfolio page's Quick Actions card remains unchanged.

## User Stories

- As a user, I want quick access to "Add Investment" from any dashboard page so I can log investments without navigating to the portfolio page first.

## Functional Requirements

### FR-1: Replace FAB Actions

Replace the 3 existing FAB actions (Add Transaction, Transfer Money, Create Wallet) with a single "Add Investment" action.

**Acceptance criteria:**
- [ ] FAB shows only one action: "Add Investment" with an appropriate icon
- [ ] Tapping the FAB expands to show the single "Add Investment" action (existing expandable pattern preserved)
- [ ] Tapping "Add Investment" opens the AddInvestmentForm in a BaseModal
- [ ] The FAB appears on all dashboard pages (same as today)

### FR-2: Global Add Investment Modal

The Add Investment modal opens in the dashboard layout (in-place), not requiring navigation to the portfolio page.

**Acceptance criteria:**
- [ ] AddInvestmentForm renders inside a BaseModal at the layout level
- [ ] The form works identically to the portfolio page's version (same component, same behavior)
- [ ] On success, the modal closes and relevant query caches are invalidated (handled by the form internally)
- [ ] The modal title reads "Add Investment" (matching existing `ModalType.ADD_INVESTMENT` constant value)

### FR-3: Preserve Portfolio Page Inline Button

The portfolio page's PortfolioSummaryEnhanced "Add Investment" button remains unchanged.

**Acceptance criteria:**
- [ ] The inline "Add Investment" button in PortfolioSummaryEnhanced still works
- [ ] Users on the portfolio page have two access points: the inline button and the FAB

## Non-Functional Requirements

- Performance: AddInvestmentForm is already dynamically imported via `OptimizedComponents.tsx` — use the same lazy import in the layout to avoid increasing the initial bundle
- No new API endpoints or backend changes required
- No protobuf changes required

## Architecture Changes (C4)

### Diagrams to Update

None. This is a UI-only change that doesn't add new components to the architecture — it moves the FAB's action configuration from transaction/wallet actions to investment actions.

### New Diagrams

None required.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None. The Add Investment flow already exists. This change only adds a new entry point (FAB → modal) using the same form component.

### New Flow Diagrams

None required.

## Data Model Changes

None.

## API Changes

None. The AddInvestmentForm already uses `useMutationCreateInvestment` which calls the existing `POST /api/v1/investments` endpoint.

## UI/UX Changes

### Change 1: FAB Actions

**Before:** FAB expands to show 3 actions — Add Transaction, Transfer Money, Create Wallet
**After:** FAB expands to show 1 action — Add Investment

### Change 2: Layout-Level Modal

**Before:** Layout-level BaseModal handles ADD_TRANSACTION, TRANSFER_MONEY, CREATE_WALLET
**After:** Layout-level BaseModal handles ADD_INVESTMENT only (remove the other 3)

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|---|---|---|
| FAB container | `FloatingActionButton` | `components/FloatingActionButton.tsx` |
| Add Investment form | `AddInvestmentForm` (dynamic) | `features/investment/forms/AddInvestmentForm.tsx` via `components/lazy/OptimizedComponents.tsx` |
| Modal container | `BaseModal` | `components/modals/BaseModal.tsx` |
| Investment icon | Existing SVG icons or inline SVG | `components/icons/` |
| ModalType constant | `ModalType.ADD_INVESTMENT` | `app/constants.tsx` (value: `"Add Investment"`) |

### New Components

None required. All components already exist.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|---|---|---|---|---|
| 1 | User tap on FAB | UI event (no data) | No | Layout component state | Local React state change |
| 2 | AddInvestmentForm submit | Investment data (symbol, quantity, price) | Yes: Browser → API | Backend `/api/v1/investments` | Same flow as existing portfolio page usage |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|---|---|---|
| Browser → API | Investment creation request | JWT auth + server-side validation (already exists) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|---|---|---|---|---|---|
| T-1 | 2 | Browser → API | Spoofing | Unauthenticated investment creation | Low | JWT middleware already enforces auth on all `/api/v1/` routes |
| T-2 | 2 | Browser → API | Tampering | Manipulated investment data | Low | Server-side validation in `InvestmentService.CreateInvestment` already validates all fields |

### Authorization Rules

No change. The AddInvestmentForm already uses the authenticated API client, and the backend verifies user ownership.

### Input Validation Rules

No change. All validation is handled by the existing AddInvestmentForm (client-side Zod + server-side Go validators).

### External Dependency Risks

None. No new dependencies introduced.

### Sensitive Data Handling

No change. Investment data handling remains identical.

### Issues & Risks Summary

1. **Low risk:** Removing Add Transaction, Transfer Money, and Create Wallet from the FAB reduces quick access to those features. Users must navigate to specific pages to perform those actions.
2. **No security risk:** The same AddInvestmentForm component is reused — no new attack surface.

## Edge Cases & Error Handling

1. **Form errors:** Handled internally by AddInvestmentForm (duplicate symbol, invalid quantity, etc.)
2. **No investment wallets:** AddInvestmentForm already handles this case (shows appropriate error)
3. **Concurrent FAB + inline button on portfolio page:** Both open the same form; no conflict since layout modal state and portfolio page modal state are independent

## Dependencies & Assumptions

- AddInvestmentForm is self-contained (confirmed: only needs optional `onSuccess` callback)
- CurrencyProvider and QueryClientProvider are already at the app root level
- Dynamic import via OptimizedComponents.tsx already exists for AddInvestmentForm

## Out of Scope

- Changing the FAB component's expand/collapse behavior
- Changing the FAB's visual design or positioning
- Modifying the AddInvestmentForm itself
- Adding other actions to the FAB
- Removing the inline "Add Investment" button from portfolio page
