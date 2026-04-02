# Finance Page Action Buttons Specification

## Summary

Add three action buttons (Add Transaction, Transfer Money, Create Wallet) to the finance page header area. This is a frontend-only change that replicates the existing modal pattern from the home page into the finance page, giving users quick access to common financial actions without navigating away.

## User Stories

- As a user on the finance page, I want to add a transaction directly from this page, so that I don't have to navigate to another page
- As a user on the finance page, I want to transfer money between wallets, so that I can manage funds while reviewing my finances
- As a user on the finance page, I want to create a new wallet, so that I can organize my finances without leaving the page

## Functional Requirements

### FR-1: Header Action Buttons

Add a row of 3 buttons in the finance page header, next to the page title.

**Buttons:**
1. **Add Transaction** — opens AddTransactionForm in a BaseModal
2. **Transfer** — opens TransferMoneyForm in a BaseModal
3. **Create Wallet** — opens CreateWalletForm in a BaseModal

**Behavior:**
- All 3 buttons are always visible regardless of active tab
- Buttons use the existing `Button` component with appropriate icons
- On mobile: buttons display in a horizontally scrollable row with text labels
- On desktop: buttons display inline in the header

**Acceptance criteria:**
- [ ] 3 buttons visible in the finance page header
- [ ] Each button opens the correct modal with the correct form
- [ ] Modal close (X, backdrop click, ESC) works correctly
- [ ] On form success: relevant queries are invalidated and modal closes
- [ ] Buttons are horizontally scrollable on small screens
- [ ] Min touch target of 44px on all buttons

### FR-2: Modal Management

Use the same local state pattern as the home page.

**Acceptance criteria:**
- [ ] Modal state managed via `useState<ModalType>(null)`
- [ ] BaseModal renders with correct title per modal type
- [ ] Success callback invalidates wallet list, total balance, and transaction list queries
- [ ] Only one modal open at a time

## Non-Functional Requirements

- Performance: No additional API calls on page load — modals fetch data only when opened
- Accessibility: Buttons have proper labels, modals have focus trap and ARIA attributes (handled by BaseModal)

## Architecture Changes (C4)

### Diagrams to Update

None — this is a minor UI addition to an existing page. No new components, services, or architectural boundaries.

### New Diagrams

None needed.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — the transaction creation, transfer, and wallet creation flows already exist in `flow-wallet.md` and `flow-transaction.md`. This feature only adds new UI entry points to those existing flows.

### New Flow Diagrams

None needed.

## Data Model Changes

None — no backend or database changes.

## API Changes

None — all required API endpoints already exist:
- `CreateTransaction` (transaction.proto)
- `TransferFunds` (wallet.proto)
- `CreateWallet` (wallet.proto)

## UI/UX Changes

### Modified Page

**Finance page** (`app/[locale]/dashboard/finance/page.tsx`):
- Add button row between page title and tab bar
- Add modal state management
- Add BaseModal with 3 form components

### Layout

```
┌─────────────────────────────────────────────┐
│ Finance          [+ Add Txn] [↔ Transfer] [+ Wallet] │
├─────────────────────────────────────────────┤
│ [Transaction] [Report] [Budget]  ← tab bar  │
├─────────────────────────────────────────────┤
│                                             │
│  Tab content area                           │
│                                             │
└─────────────────────────────────────────────┘
```

**Mobile layout** (scrollable):
```
┌──────────────────────┐
│ Finance              │
│ [+ Add Txn] [↔ Transfer] [+ Wallet] ← scrollable │
├──────────────────────┤
│ [Txn] [Report] [Budget]             │
```

### Styling

- Buttons: `variant="secondary"` or ghost style with icons, using v2 design tokens
- Button row: `flex gap-2 overflow-x-auto` for mobile scroll
- Icons: use existing SVG icons or lucide-react (Plus, ArrowLeftRight, Wallet)
- Colors: `text-v2-gold-accent`, `border-v2-border-light` for button styling

### Existing Component Inventory

| Need | Existing Component | Location |
|------|-------------------|----------|
| Action buttons | `Button` | `components/Button.tsx` |
| Modal container | `BaseModal` | `components/modals/BaseModal.tsx` |
| Transaction form | `AddTransactionForm` | `features/transaction/forms/AddTransactionForm.tsx` |
| Transfer form | `TransferMoneyForm` | `features/wallet/forms/TransferMoneyForm.tsx` |
| Wallet form | `CreateWalletForm` | `features/wallet/forms/CreateWalletForm.tsx` |
| Query invalidation events | `EVENT_WalletListWallets`, etc. | `utils/generated/hooks.ts` |

### New Components

None — all components already exist and are reusable.

## Security & Risk Assessment

### Risk Level: LOW

This is a **frontend-only, UI-only change**. No new API endpoints, no new data flows, no new backend logic. The feature reuses existing, already-secured form components and API hooks.

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | Button click | No | React state | Local state change only |
| 2 | User (browser) | Form input | Yes: Internet → App (existing) | REST Handler (existing) | Already validated by existing forms |

All data flows (form submission → API → backend) are **already implemented and secured** by the existing form components. This feature adds no new trust boundary crossings.

### Trust Boundaries

No new trust boundaries. Existing boundaries:
- Internet → App: Already secured by JWT auth + input validation in existing forms
- App → DB: Already secured by parameterized GORM queries in existing services

### Threats Identified (STRIDE)

No new threats introduced. All form submissions go through existing, already-audited code paths:
- AddTransactionForm → CreateTransaction API (existing)
- TransferMoneyForm → TransferFunds API (existing)
- CreateWalletForm → CreateWallet API (existing)

### Authorization Rules

No changes — existing authorization rules apply (user can only create transactions/wallets/transfers for their own account).

### Input Validation Rules

No changes — existing client-side (Zod) and server-side validation in the form components applies.

### External Dependency Risks

No new dependencies introduced.

### Sensitive Data Handling

No changes — forms handle the same data they already handle on other pages.

### Issues & Risks Summary

1. **Low risk**: Button row may overflow on very small screens — mitigated by horizontal scroll
2. **No security risk**: Pure UI change reusing existing secured components

## Edge Cases & Error Handling

- **No wallets exist**: AddTransactionForm and TransferMoneyForm already handle this (show empty state or prompt to create wallet)
- **API errors**: Already handled by individual form components (error states, toast messages)
- **Rapid modal switching**: Closing one modal and opening another — React state handles this naturally

## Dependencies & Assumptions

- Existing form components (AddTransactionForm, TransferMoneyForm, CreateWalletForm) are stable and self-contained
- BaseModal component handles accessibility (focus trap, ESC, backdrop click)
- i18n translations for modal titles already exist (used by home page)

## Out of Scope

- Refactoring home page to share modal logic with finance page
- Adding tab-specific action buttons (e.g., "Add Budget" on budget tab)
- FAB or other mobile-specific action patterns
- Any backend changes
