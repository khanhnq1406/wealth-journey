# Finance Page Action Buttons Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add three action buttons (Add Transaction, Transfer Money, Create Wallet) to the finance page header, reusing existing modal/form components from the home page.

**Spec:** `docs/specs/2026-04-02-finance-page-action-buttons-spec.md`

**Architecture:** Frontend-only change. Adds modal state management and a button row to the existing finance page. No new components, no backend changes, no API changes. Replicates the exact modal pattern already used on the home page (`FunctionalButtons.tsx` + `BaseModal` + form components).

**Tech Stack:** React 19, Next.js 16 (App Router), TypeScript, Tailwind CSS, React Query v5, next-intl

## Security Implementation Notes

- Authentication: Not applicable — this is a UI-only change; forms already handle auth via existing API hooks
- Authorization: Not applicable — existing form components enforce user ownership server-side
- Input validation: Handled by existing form components (Zod schemas + server-side)
- Data sanitization: Handled by existing form components

**Risk level: LOW** — Pure UI change reusing existing, secured components. No new trust boundaries.

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `Button` | `components/Button.tsx` | Action buttons with icons |
| `BaseModal` | `components/modals/BaseModal.tsx` | Modal container for all 3 forms |
| `AddTransactionForm` | `features/transaction/forms/AddTransactionForm.tsx` | Transaction creation form |
| `TransferMoneyForm` | `features/wallet/forms/TransferMoneyForm.tsx` | Transfer money form |
| `CreateWalletForm` | `features/wallet/forms/CreateWalletForm.tsx` | Wallet creation form |
| `PlusIcon` | `components/icons/ui.tsx` | Add Transaction & Create Wallet button icon |
| `TransferIcon` | `components/icons/finance.tsx` | Transfer button icon |

**New components needed (with justification):**

None — all components already exist.

## C4 Architecture Diagram Updates

None — the spec explicitly states no architectural changes. This is a minor UI addition to an existing page.

## Runtime Flow Diagram Updates

None — the spec explicitly states the transaction creation, transfer, and wallet creation flows already exist in `flow-wallet.md` and `flow-transaction.md`. This adds UI entry points only.

---

### Task 0: Update C4 Architecture Diagrams

**Skipped** — No new components, services, or architectural boundaries per spec.

---

### Task 1: Add action buttons and modal management to finance page

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/finance/page.tsx`

**Security notes:** No security concerns — reusing existing secured form components.

**Step 0: Component inventory check (MANDATORY)**

- [x] Verified `Button` at `components/Button.tsx` — supports `variant`, `leftIcon`, `size` props
- [x] Verified `BaseModal` at `components/modals/BaseModal.tsx` — supports `isOpen`, `onClose`, `title`, `children`
- [x] Verified `AddTransactionForm` at `features/transaction/forms/AddTransactionForm.tsx` — accepts `onSuccess?: () => void`
- [x] Verified `TransferMoneyForm` at `features/wallet/forms/TransferMoneyForm.tsx` — accepts `onSuccess?: () => void`
- [x] Verified `CreateWalletForm` at `features/wallet/forms/CreateWalletForm.tsx` — accepts `onSuccess?: () => void`
- [x] Verified `PlusIcon` at `components/icons/ui.tsx`
- [x] Verified `TransferIcon` at `components/icons/finance.tsx`
- [x] Verified i18n keys exist: `ui.modal.addTransaction`, `ui.modal.transferMoney`, `ui.modal.createWallet` and `dashboard.quickActions.addTransaction`, `dashboard.quickActions.transferMoney`, `dashboard.quickActions.createNewWallet`
- Reusing: All components listed in inventory above
- Creating new: None

**Step 1: Implement action buttons and modal state in finance page**

Add to `page.tsx`:
1. Import `useState` (already has `useCallback`, `Suspense`)
2. Import `useQueryClient` from `@tanstack/react-query`
3. Import `Button`, `BaseModal`, form components, icons, and query event constants
4. Add `ModalType` union type: `"add-transaction" | "transfer-money" | "create-wallet" | null`
5. Add `useState<ModalType>(null)` for modal state
6. Add `handleModalClose`, `handleModalSuccess`, `getModalTitle` — same pattern as home page
7. Add button row between the `<h1>` title and `<FinanceTabBar>`:

```tsx
{/* Action buttons */}
<div className="flex gap-2 overflow-x-auto pb-2 px-4 sm:px-6">
  <Button
    variant="secondary"
    size="sm"
    leftIcon={<PlusIcon className="w-4 h-4" />}
    fullWidth={false}
    onClick={() => setModalType("add-transaction")}
    className="whitespace-nowrap min-h-[44px]"
  >
    {t("addTransaction")}
  </Button>
  <Button
    variant="secondary"
    size="sm"
    leftIcon={<TransferIcon className="w-4 h-4" />}
    fullWidth={false}
    onClick={() => setModalType("transfer-money")}
    className="whitespace-nowrap min-h-[44px]"
  >
    {t("transferMoney")}
  </Button>
  <Button
    variant="secondary"
    size="sm"
    leftIcon={<PlusIcon className="w-4 h-4" />}
    fullWidth={false}
    onClick={() => setModalType("create-wallet")}
    className="whitespace-nowrap min-h-[44px]"
  >
    {t("createWallet")}
  </Button>
</div>
```

8. Add BaseModal + form rendering after the tab panel (same pattern as home page):

```tsx
<BaseModal
  isOpen={modalType !== null}
  onClose={handleModalClose}
  title={getModalTitle()}
>
  {modalType === "add-transaction" && (
    <AddTransactionForm onSuccess={handleModalSuccess} />
  )}
  {modalType === "transfer-money" && (
    <TransferMoneyForm onSuccess={handleModalSuccess} />
  )}
  {modalType === "create-wallet" && (
    <CreateWalletForm onSuccess={handleModalSuccess} />
  )}
</BaseModal>
```

9. Query invalidation in `handleModalSuccess` — invalidate wallet list, total balance, and transaction list (same as home page):

```tsx
const handleModalSuccess = () => {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      return [
        EVENT_WalletListWallets,
        EVENT_WalletGetTotalBalance,
        EVENT_TransactionListTransactions,
      ].includes(key);
    },
  });
  setModalType(null);
};
```

**Step 2: Verify translations**

Check that the finance page's `useTranslations` namespace has the button labels. The home page uses `dashboard.quickActions` namespace. For the finance page, use the same namespace or `ui.modal` namespace which already has the translations.

**Step 3: Responsive & accessibility check**

- Mobile (375px): Buttons in `flex gap-2 overflow-x-auto` row — horizontally scrollable, `whitespace-nowrap` prevents text wrapping
- Desktop (768px+): Buttons display inline in header row
- Touch targets: `min-h-[44px]` on all buttons
- Focus: Button component already has `focus-visible:ring-2 focus-visible:ring-v2-gold-primary`
- Modal: BaseModal already handles focus trap, ESC, backdrop click, ARIA attributes

**Step 4: Verify layout**

The layout should be:
```
┌─────────────────────────────────────────────┐
│ Finance          [+ Add Txn] [↔ Transfer] [+ Wallet] │
├─────────────────────────────────────────────┤
│ [Transaction] [Report] [Budget]  ← tab bar  │
├─────────────────────────────────────────────┤
│  Tab content area                           │
└─────────────────────────────────────────────┘
```

On mobile, the title goes on its own line, buttons on next line (scrollable).

**Step 5: Commit**

```
feat(finance): add action buttons for transaction, transfer, and wallet creation
```

---

### Task N-1: Create/Update Runtime Flow Diagrams

**Skipped** — Simple CRUD with no branching, no multi-service coordination. All flows already documented.

---

## Implementation Notes

### Key decisions:
1. **Replicate home page pattern exactly** — same `ModalType` union, same `handleModalSuccess` with predicate-based invalidation
2. **Secondary variant buttons with icons** — spec says `variant="secondary"` or ghost style; secondary matches the finance page aesthetic better since buttons sit between title and tabs
3. **No i18n changes needed** — translations already exist in `dashboard.quickActions` namespace
4. **Single task** — this is a ~5 minute change to one file; breaking it further would be overhead

### What NOT to change:
- Home page (no shared modal logic extraction — spec says out of scope)
- Tab-specific buttons (out of scope)
- FAB or mobile-specific patterns (out of scope)
- Any backend code
