# FAB Add Investment Only — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace the 3-action FAB (Add Transaction, Transfer Money, Create Wallet) with a single "Add Investment" action, opening the existing AddInvestmentForm in a layout-level modal.

**Spec:** `docs/specs/2026-03-20-fab-add-investment-only-spec.md`

**Architecture:** Frontend-only change. The dashboard layout (`app/[locale]/dashboard/layout.tsx`) currently wires 3 FAB actions and renders 3 form components in a global BaseModal. We replace all 3 with a single Add Investment action + form. No backend, API, or protobuf changes.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, lucide-react icons

## Security Implementation Notes

- Authentication: No change — AddInvestmentForm uses the authenticated API client (JWT middleware on all `/api/v1/` routes)
- Authorization: No change — backend verifies user ownership in `InvestmentService.CreateInvestment`
- Input validation: No change — existing client-side Zod + server-side Go validators
- Data sanitization: No change — same form component reused

## C4 Architecture Diagram Updates

None required. This is a UI configuration change — no new components, services, or data flows.

## Runtime Flow Diagram Updates

None required. The Add Investment flow already exists in `docs/architecture/flow-investment.md`.

---

### Task 1: Update i18n Messages — Add "addInvestment" to quickActions

**Files:**
- Modify: `src/wj-client/messages/en/ui.json` (line 342-346)
- Modify: `src/wj-client/messages/vi/ui.json` (line 342-346)

**Security notes:** None — static translation strings only.

**Step 1: Update English translations**

In `messages/en/ui.json`, replace the `quickActions` block (inside the `dashboard` namespace, lines 342-346):

```json
"quickActions": {
  "addInvestment": "Add Investment"
}
```

This removes `addTransaction`, `transferMoney`, `createNewWallet` and adds `addInvestment`.

**Step 2: Update Vietnamese translations**

In `messages/vi/ui.json`, replace the `quickActions` block (inside the `dashboard` namespace, lines 342-346):

```json
"quickActions": {
  "addInvestment": "Thêm khoản đầu tư"
}
```

**Step 3: Commit**

```
feat(i18n): replace FAB quickActions translations with addInvestment
```

---

### Task 2: Update Dashboard Layout — Replace FAB Actions and Global Modal

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`
  - Lines 19-21 (imports): Remove 3 form imports, add lazy AddInvestmentForm import
  - Lines 30-45 (lucide imports): Add `TrendingUp` for the investment icon
  - Lines 693-774 (FAB + Modal): Replace 3 actions with 1, replace 3 form renderings with 1

**Security notes:** None — same form component, same auth flow, same modal pattern.

**Step 1: Update imports**

Replace the 3 direct form imports (lines 19-21):

```typescript
// REMOVE these 3 lines:
import { AddTransactionForm } from "@/features/transaction/forms/AddTransactionForm";
import { TransferMoneyForm } from "@/features/wallet/forms/TransferMoneyForm";
import { CreateWalletForm } from "@/features/wallet/forms/CreateWalletForm";

// ADD this 1 line (lazy-loaded from OptimizedComponents):
import { AddInvestmentForm } from "@/components/lazy/OptimizedComponents";
```

This uses the existing dynamic import from `OptimizedComponents.tsx` (line 193) which already has `ssr: false` and a loading fallback — keeping the form out of the initial bundle.

Add `TrendingUp` to the lucide-react import (line 30-45):

```typescript
import {
  House,
  Banknote,
  Wallet,
  ChartNoAxesCombined,
  Settings,
  Bell,
  Search,
  LogOut,
  X,
  Menu,
  Users,
  CircleUser,
  MessageCircle,
  Shield,
  TrendingUp,  // ADD — icon for Add Investment FAB action
} from "lucide-react";
```

**Step 2: Replace FAB actions (lines 693-745)**

Replace the entire `<FloatingActionButton actions={[...]}/>` block with:

```tsx
<FloatingActionButton
  actions={[
    {
      label: tQuickActions("addInvestment"),
      icon: <TrendingUp className="w-6 h-6" />,
      onClick: () => {
        setModalType(ModalType.ADD_INVESTMENT);
      },
    },
  ]}
/>
```

This:
- Uses the existing `tQuickActions` translation namespace (updated in Task 1)
- Uses `TrendingUp` from lucide-react as the investment icon
- Opens `ModalType.ADD_INVESTMENT` (already exists in constants at line 155, value: `"Add Investment"`)

**Step 3: Replace Global Modal content (lines 748-774)**

Replace the 3 form conditionals inside the `<BaseModal>`:

```tsx
<BaseModal
  isOpen={modalType !== null}
  onClose={() => setModalType(null)}
  title={modalType || ""}
>
  {modalType === ModalType.ADD_INVESTMENT && (
    <AddInvestmentForm
      onSuccess={() => {
        setModalType(null);
      }}
    />
  )}
</BaseModal>
```

This removes the `ADD_TRANSACTION`, `TRANSFER_MONEY`, and `CREATE_WALLET` conditionals and adds `ADD_INVESTMENT`.

**Step 4: Clean up unused imports**

After removing the 3 form imports, verify no other references to `AddTransactionForm`, `TransferMoneyForm`, or `CreateWalletForm` remain in the layout file. The `Wallet` lucide icon import may still be needed for nav items — check before removing.

**Step 5: Verify build compiles**

```bash
cd src/wj-client && npx next build --no-lint 2>&1 | head -30
```

If build fails, investigate the error (don't retry blindly).

**Step 6: Commit**

```
feat(fab): replace 3-action FAB with single Add Investment action

- Remove Add Transaction, Transfer Money, Create Wallet from FAB
- Add Investment as the sole FAB action with TrendingUp icon
- Use lazy-loaded AddInvestmentForm from OptimizedComponents
- Remove unused direct form imports from layout
```

---

### Task 3: Manual Verification Checklist

**Files:** None (verification only)

**Steps:**

1. **Verify FAB renders** — Navigate to any dashboard page, confirm FAB shows a single "Add Investment" action on expand
2. **Verify modal opens** — Tap "Add Investment" on the FAB, confirm the AddInvestmentForm renders in a BaseModal with title "Add Investment"
3. **Verify form works** — Fill out the form and submit (or cancel), confirm it behaves identically to the portfolio page version
4. **Verify portfolio page inline button** — Navigate to `/dashboard/portfolio`, confirm the existing "Add Investment" button in PortfolioSummaryEnhanced still works independently
5. **Verify both access points on portfolio page** — On the portfolio page, both the inline button and the FAB should work without conflict
6. **Verify mobile** — Test on mobile viewport (375px), confirm FAB positioning is correct
7. **Verify i18n** — Switch to Vietnamese locale, confirm FAB action label shows "Thêm khoản đầu tư"

---

## Summary

| Task | Description | Files Modified | Estimated Effort |
|------|-------------|----------------|-----------------|
| 1 | Update i18n messages | 2 JSON files | ~2 min |
| 2 | Update layout (imports, FAB, modal) | 1 TSX file | ~5 min |
| 3 | Manual verification | None | ~5 min |

**Total: 3 tasks, ~12 min**

This is a minimal, surgical change — reusing the existing `AddInvestmentForm` (lazy-loaded), existing `ModalType.ADD_INVESTMENT` constant, and existing FAB component pattern. No new components, no new APIs, no new dependencies.
