# Price Alerts Tab in Prices Screen — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Move Price Alerts management into the Prices page as the first tab (Price Alerts → Watchlist → Gold → Silver → Currency → Search Symbol).
**Spec:** `docs/specs/2026-03-25-price-alerts-into-prices-tab-spec.md`
**Architecture:** Pure frontend restructuring — no backend, no proto changes. Adds a new tab to `PricesPage` reusing existing `PriceAlertList` and `CreatePriceAlertForm` components. Updates notification routing and settings page.
**Tech Stack:** Next.js 16.2, React 19, TypeScript, next-intl, React Query

## Security Implementation Notes

No new security surface. All existing auth, IDOR, rate limiting, and validation remain unchanged. The tab change is entirely within the authenticated dashboard.

## Component Reuse Inventory

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `PriceAlertList` | `features/price-alert/components/PriceAlertList.tsx` | Rendered inside the new priceAlerts tab |
| `CreatePriceAlertForm` | `features/price-alert/forms/CreatePriceAlertForm.tsx` | Already imported in PricesPage — used in priceAlerts tab modal |
| `BaseModal` | `components/modals/BaseModal.tsx` | Already used in PricesPage — reused for Create Alert |
| `Button` | `components/Button.tsx` | Already used in PricesPage — Create Alert button |

**New components needed:** None.

## C4 Architecture Diagram Updates

Update `docs/architecture/c4-component-frontend.md` — add note that Prices Page now hosts Price Alerts tab.

---

### Task 0: Update C4 Frontend Architecture Diagram

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**
1. Find the PricesPage component description in the diagram
2. Update description to include "Price Alerts tab" alongside existing tabs
3. Commit with task changes

---

### Task 1: Add i18n keys for "Price Alerts" tab label

**Files:**
- Modify: `src/wj-client/messages/en/investment.json` — add `prices.tabs.priceAlerts`
- Modify: `src/wj-client/messages/vi/investment.json` — add `prices.tabs.priceAlerts`

**Security notes:** None — i18n static strings only.

**Step 1: Add key to en messages**
In `messages/en/investment.json`, under `"prices" > "tabs"`, add:
```json
"priceAlerts": "Price Alerts"
```

**Step 2: Add key to vi messages**
In `messages/vi/investment.json`, under `"prices" > "tabs"`, add:
```json
"priceAlerts": "Cảnh báo giá"
```

**Step 3: Verify no lint errors**
```bash
cd src/wj-client && npm run lint -- --max-warnings=0 2>&1 | tail -5
```

**Step 4: Commit**
```
feat(i18n): add priceAlerts tab label to prices namespace
```

---

### Task 2: Update PricesPage to add Price Alerts as first tab

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/prices/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/prices/__tests__/PricesPage.test.tsx`

**Security notes:** No new security surface. `PriceAlertList` uses existing authenticated React Query hooks.

**Step 0: Component inventory check**
- `PriceAlertList` — already imported style confirmed in settings/alerts/page.tsx
- `EVENT_InvestmentListUserPriceAlerts` — need to add to imports from hooks
- `AlertStatus` — need to add to imports from gen/protobuf

**Step 1: Write failing test**
Add tests to `PricesPage.test.tsx` that verify:
1. "Price Alerts" tab exists in the tab bar
2. "Price Alerts" tab is active by default (first tab)
3. Clicking "Price Alerts" tab shows a "Create Alert" button

The existing tests that click "Gold" and "Silver" tabs by name must still pass (they will since tabs are still present).

New mock needed in test file:
```typescript
jest.mock("@/features/price-alert/components/PriceAlertList", () => ({
  PriceAlertList: ({ statusFilter }: { statusFilter: number }) => (
    <div data-testid="price-alert-list" data-status={statusFilter} />
  ),
}));

// Also add EVENT_InvestmentListUserPriceAlerts to the hooks mock:
EVENT_InvestmentListUserPriceAlerts: "api.investment.listUserPriceAlerts",
```

New test cases:
```typescript
describe("Price Alerts tab", () => {
  it("renders Price Alerts as the first tab", () => {
    renderPage();
    const tabs = screen.getAllByRole("button", { name: /price alerts|watchlist|gold|silver|currency|symbol lookup/i });
    expect(tabs[0]).toHaveTextContent(/price alerts/i);
  });

  it("shows Price Alerts tab content by default (active on load)", () => {
    renderPage();
    expect(screen.getByTestId("price-alert-list")).toBeInTheDocument();
  });

  it("shows Create Alert button on Price Alerts tab", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /create alert/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify RED**
```bash
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="PricesPage" 2>&1 | tail -20
```

**Step 3: Implement changes in prices/page.tsx**

3a. Update `Tab` type union to include `"priceAlerts"`:
```typescript
type Tab = "priceAlerts" | "watchlist" | "gold" | "silver" | "currency" | "symbol";
```

3b. Add `priceAlerts` to `TAB_TYPE_COLOR_DESKTOP` and `TAB_TYPE_COLOR_MOBILE` records:
```typescript
const TAB_TYPE_COLOR_DESKTOP: Record<Tab, string> = {
  priceAlerts: "text-v2-maroon-900",
  watchlist: "text-v2-maroon-900",
  // ... rest unchanged
};

const TAB_TYPE_COLOR_MOBILE: Record<Tab, string> = {
  priceAlerts: "text-v2-gold-accent",
  watchlist: "text-v2-gold-accent",
  // ... rest unchanged
};
```

3c. Add new imports at the top of the file:
```typescript
import { PriceAlertList } from "@/features/price-alert/components/PriceAlertList";
import { EVENT_InvestmentListUserPriceAlerts } from "@/utils/generated/hooks";
import { AlertStatus } from "@/gen/protobuf/v1/investment";
```

3d. Add state for price alert filter tab inside `PricesPage`:
```typescript
const [alertFilter, setAlertFilter] = useState<AlertStatus>(AlertStatus.ALERT_STATUS_UNSPECIFIED);
```

3e. Update default `activeTab` state to `"priceAlerts"`:
```typescript
const [activeTab, setActiveTab] = useState<Tab>("priceAlerts");
```

3f. Update `TABS` array to put priceAlerts first:
```typescript
const TABS: { key: Tab; label: string }[] = [
  { key: "priceAlerts", label: t("tabs.priceAlerts") },
  { key: "watchlist", label: t("tabs.watchlist") },
  { key: "gold", label: t("tabs.gold") },
  { key: "silver", label: t("tabs.silver") },
  { key: "currency", label: t("tabs.currency") },
  { key: "symbol", label: t("tabs.symbolLookup") },
];
```

3g. Update the Refresh button condition to exclude `"priceAlerts"`:
```typescript
{activeTab !== "symbol" && activeTab !== "watchlist" && activeTab !== "priceAlerts" && (
  <Button ...>
```

3h. Add `handleCreateAlertSuccess` callback that invalidates the alerts query:
```typescript
const handleCreateAlertSuccess = useCallback(() => {
  queryClient.invalidateQueries({ queryKey: [EVENT_InvestmentListUserPriceAlerts] });
  handleCloseModal();
}, [queryClient, handleCloseModal]);
```

3i. Add ALERT_FILTER_TABS constant inside PricesPage (similar to settings/alerts/page.tsx):
```typescript
const ALERT_FILTER_TABS = useMemo(
  () => [
    { id: AlertStatus.ALERT_STATUS_UNSPECIFIED, label: t("priceAlerts.filterAll") },
    { id: AlertStatus.ALERT_STATUS_ACTIVE, label: t("priceAlerts.filterActive") },
    { id: AlertStatus.ALERT_STATUS_TRIGGERED, label: t("priceAlerts.filterTriggered") },
  ],
  [t]
);
```

Wait — `t` is bound to `"prices"` namespace. The `priceAlerts.*` keys live under `"priceAlerts"` namespace. Need a separate translator:
```typescript
const tAlerts = useTranslations("priceAlerts");
```
Then use `tAlerts("filterAll")` etc. for filter tab labels, and `tAlerts("createAlert")` for the button, and `tAlerts("modalTitle")` for modal title.

3j. Add the Price Alerts tab content block in the JSX (add BEFORE the watchlist block):
```tsx
{activeTab === "priceAlerts" && (
  <div className="space-y-4">
    {/* Header */}
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-v2-gold-accent">
        {tAlerts("title")}
      </h2>
      <Button
        type={ButtonType.PRIMARY}
        onClick={() => setModalType(ModalType.CREATE_PRICE_ALERT)}
        fullWidth={false}
        className="min-h-[44px] shrink-0"
        leftIcon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        }
      >
        {tAlerts("createAlert")}
      </Button>
    </div>

    {/* Status filter tabs */}
    <div className="flex gap-1 bg-v2-bg-surface-tint rounded-lg p-1 w-fit">
      {ALERT_FILTER_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setAlertFilter(tab.id)}
          aria-pressed={alertFilter === tab.id}
          className={[
            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px]",
            alertFilter === tab.id
              ? "bg-v2-gold-primary text-v2-bg-dark shadow-sm"
              : "text-v2-text-secondary hover:text-v2-gold-primary hover:bg-v2-bg-dark",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>

    {/* Alert list */}
    <PriceAlertList statusFilter={alertFilter} />
  </div>
)}
```

3k. Update the `BaseModal` to handle `handleCreateAlertSuccess` (already in the modal for `CreatePriceAlertForm` but previously used `handleCloseModal` — update `onSuccess` prop):
Change `onSuccess={handleCloseModal}` to `onSuccess={handleCreateAlertSuccess}` for the `CreatePriceAlertForm` inside the modal.

**Step 4: Run tests to verify GREEN**
```bash
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="PricesPage" 2>&1 | tail -20
```

**Step 5: Run all frontend tests (verify no regressions)**
```bash
cd src/wj-client && npm test -- --watchAll=false 2>&1 | tail -10
```

**Step 6: Commit**
```
feat(prices): add Price Alerts as first tab on Prices page
```

---

### Task 3: Update notification routing

**Files:**
- Modify: `src/wj-client/components/notifications/NotificationPanel.tsx`

**Security notes:** Routing change only — no auth or data impact.

**Step 1: Write failing test (conceptual — NotificationPanel has no dedicated test file)**

Since there's no dedicated test file for `NotificationPanel`, verify behavior manually or in E2E. Note this as a manual test.

**Step 2: Update routing in NotificationPanel.tsx**

Change:
```typescript
} else if (notif.type === "user_price_alert") {
  router.push("/dashboard/settings/alerts" as Parameters<typeof router.push>[0]);
}
```
To:
```typescript
} else if (notif.type === "user_price_alert") {
  router.push("/dashboard/prices" as Parameters<typeof router.push>[0]);
}
```

**Step 3: Run all frontend tests**
```bash
cd src/wj-client && npm test -- --watchAll=false 2>&1 | tail -10
```

**Step 4: Commit**
```
fix(notifications): route user_price_alert notifications to /dashboard/prices
```

---

### Task 4: Update settings page — remove Alerts link

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/settings/page.tsx`

**Security notes:** None — static page link removal.

**Step 1: Remove the Price Alerts `<Link>` block**

Remove the entire `<Link href="/dashboard/settings/alerts" ...>` block (lines 46-77 in current file).

**Step 2: Run all frontend tests**
```bash
cd src/wj-client && npm test -- --watchAll=false 2>&1 | tail -10
```

**Step 3: Commit**
```
fix(settings): remove Price Alerts link (moved to Prices page)
```

---

### Task 5: Redirect `/dashboard/settings/alerts` to `/dashboard/prices`

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/settings/alerts/page.tsx`

**Security notes:** Server-side redirect only, no data exposure.

**Step 1: Replace page content with redirect**

The current page is a `"use client"` component. Replace with a server component that uses `redirect()`:

```typescript
import { redirect } from "next/navigation";

export default function PriceAlertsSettingsPage() {
  redirect("/dashboard/prices");
}
```

This is a server component (no `"use client"`) using Next.js App Router's `redirect()` function which produces a 307 redirect.

**Step 2: Run all frontend tests**
```bash
cd src/wj-client && npm test -- --watchAll=false 2>&1 | tail -10
```

**Step 3: Commit**
```
fix(settings/alerts): redirect to /dashboard/prices (price alerts moved there)
```

---

### Task 6: Update C4 Frontend Architecture Diagram

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**
1. Find the Prices Page component entry
2. Update description to mention "Price Alerts tab" as first tab
3. Note that `/dashboard/settings/alerts` now redirects to Prices page
4. Commit

---

## Task Execution Order

```
Task 1 (i18n) → Task 2 (PricesPage) → Task 3 (NotificationPanel) → Task 4 (Settings) → Task 5 (Redirect) → Task 6 (C4)
```

Task 1 must precede Task 2 (tab label key must exist before PricesPage uses it). Tasks 3-5 are independent of each other and can follow Task 2. Task 6 can be done last.
