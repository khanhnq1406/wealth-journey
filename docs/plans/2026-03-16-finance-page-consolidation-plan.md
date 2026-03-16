# Finance Page Consolidation — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Merge Transaction, Report, and Budget pages into a single tabbed Finance page at `/dashboard/finance`, consolidate navigation from 3 items to 1, and redirect old routes.

**Spec:** `docs/specs/2026-03-16-finance-page-consolidation-spec.md`

**Architecture:** Frontend-only refactor. No backend or protobuf changes. The three existing page components become tab content within a new FinancePage. A sticky FinanceTabBar manages tab state via URL query params (`?tab=transaction|report|budget`). Old routes become Next.js server-side redirects.

**Tech Stack:** Next.js 15 App Router, React 19, next-intl, Tailwind CSS, next/dynamic (code splitting), useSearchParams

## Security Implementation Notes

- No new API endpoints or backend changes
- Tab param validation: whitelist `transaction|report|budget`, fallback to `transaction`
- No new authentication or authorization concerns (existing page-level auth unchanged)
- No sensitive data handling changes

---

### Task 0: Update C4 Architecture Diagram (Frontend)

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Update the `App Router (Pages)` boundary:
   - Remove `txn_page`, `budget_page`, `report_page` as separate entries
   - Add `finance_page` — "Finance Page", "app/dashboard/finance", "Unified tabbed view: Transactions, Reports, Budget with sticky tab bar and URL-synced tab state (?tab=transaction|report|budget)"
   - Add redirect entries as note or keep implicit

2. Update relationships:
   - Remove: `Rel(txn_page, txn_feat, ...)`, `Rel(budget_page, budget_feat, ...)`, `Rel(report_page, report_feat, ...)`
   - Add: `Rel(finance_page, txn_feat, "Renders transaction tab content")`
   - Add: `Rel(finance_page, budget_feat, "Renders budget tab content")`
   - Add: `Rel(finance_page, report_feat, "Renders report tab content")`

3. No L4 code diagram needed (UI reorganization, no new domain models)

**Commit:** `docs(architecture): update C4 frontend diagram for finance page consolidation`

---

### Task 1: Add translation keys for Finance page

**Files:**
- Modify: `src/wj-client/messages/vi/nav.json`
- Modify: `src/wj-client/messages/en/nav.json`

**Steps:**

1. Add new translation keys to both locale files under the `nav` namespace:

**English (`messages/en/nav.json`):**
```json
"finance": "Finance",
"financePageTitle": "Personal Finance"
```

**Vietnamese (`messages/vi/nav.json`):**
```json
"finance": "Tài chính",
"financePageTitle": "Quản lý tài chính cá nhân"
```

2. Also add tab label keys under a new `finance` namespace. Create new files:

**English (`messages/en/finance.json`):**
```json
{
  "finance": {
    "tabs": {
      "transaction": "Transactions",
      "report": "Reports",
      "budget": "Budget"
    }
  }
}
```

**Vietnamese (`messages/vi/finance.json`):**
```json
{
  "finance": {
    "tabs": {
      "transaction": "Giao dịch",
      "report": "Báo cáo",
      "budget": "Ngân sách"
    }
  }
}
```

3. Verify the i18n message loading picks up new files. Check `src/wj-client/i18n/request.ts` for the glob pattern or manual imports to ensure new `finance.json` files are included.

**Commit:** `feat(i18n): add finance page and tab translation keys`

---

### Task 2: Add `finance` route to constants

**Files:**
- Modify: `src/wj-client/app/constants.tsx`

**Steps:**

1. Add the new finance route to the `routes` object:

```typescript
export const routes = {
  // ... existing routes ...
  finance: `/dashboard/finance`,
};
```

2. Keep existing `transaction`, `report`, `budget` routes — they are still used for redirects and by other code that references them.

**Commit:** `feat(routes): add finance route constant`

---

### Task 3: Extract page content into importable components

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/report/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/budget/page.tsx`

**Approach:** Extract each page's content into a named export component, then have the default export (the page) simply render that component. This way the content is importable by the new Finance page via `dynamic()` while keeping the old pages functional during the redirect transition.

**Steps:**

1. **Transaction page** (`transaction/page.tsx`):
   - Rename the existing `TransactionPage()` function to `export function TransactionContent()` (named export)
   - Add a new `export default function TransactionPage()` that returns `<TransactionContent />`
   - No other changes — all state, hooks, and JSX stay inside `TransactionContent`

2. **Report page** (`report/page.tsx`):
   - Rename the existing `ReportPageEnhanced()` function to `export function ReportContent()` (named export)
   - Add a new `export default function ReportPage()` that returns `<ReportContent />`

3. **Budget page** (`budget/page.tsx`):
   - Rename the existing `BudgetPage()` function to `export function BudgetContent()` (named export)
   - Add a new `export default function BudgetPage()` that returns `<BudgetContent />`

**Why this approach:**
- Minimal diff — just renaming + adding a thin wrapper
- Code-splitting works with `dynamic(() => import(...).then(mod => mod.TransactionContent))`
- Old pages continue to work (needed for redirect fallback)
- No need for separate wrapper files

**Commit:** `refactor(pages): extract page content into named exports for tab reuse`

---

### Task 4: Create FinanceTabBar component

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/finance/FinanceTabBar.tsx`

**Security notes:** Validate `activeTab` prop against whitelist.

**Steps:**

1. Create the `FinanceTabBar` component:

```typescript
"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export type FinanceTab = "transaction" | "report" | "budget";

export const FINANCE_TABS: FinanceTab[] = ["transaction", "report", "budget"];

interface FinanceTabBarProps {
  activeTab: FinanceTab;
  onTabChange: (tab: FinanceTab) => void;
}

export function FinanceTabBar({ activeTab, onTabChange }: FinanceTabBarProps) {
  const t = useTranslations("finance.tabs");

  return (
    <div
      role="tablist"
      aria-label="Finance sections"
      className="sticky top-0 z-10 bg-white border-b border-v2-border-light"
    >
      <div className="flex">
        {FINANCE_TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`tabpanel-${tab}`}
            id={`tab-${tab}`}
            onClick={() => onTabChange(tab)}
            className={cn(
              "flex-1 sm:flex-initial sm:px-6 py-3 text-sm font-medium font-vietnam transition-colors relative",
              "min-h-[44px] touch-target",
              activeTab === tab
                ? "text-v2-red-primary"
                : "text-v2-text-secondary hover:text-v2-text-primary"
            )}
          >
            {t(tab)}
            {/* Active underline indicator */}
            {activeTab === tab && (
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-v2-red-primary transition-all duration-200"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Design notes:**
- Mobile: tabs are `flex-1` (full-width, equally distributed) — matches spec FR-2
- Desktop (`sm:`): tabs are `flex-initial` with horizontal padding — left-aligned
- Active underline uses `v2-red-primary` (crimson accent) — matches v2 design system
- Min height 44px for touch targets — matches spec FR-2
- ARIA attributes: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `id` — matches spec NFR accessibility
- Sticky positioning — matches spec FR-2

2. Add keyboard navigation (arrow keys between tabs):
   - Left/Right arrow keys to switch tabs
   - Home/End keys for first/last tab
   - Use `onKeyDown` handler on each tab button

**Commit:** `feat(finance): create FinanceTabBar with accessibility and responsive layout`

---

### Task 5: Create Finance page

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/finance/page.tsx`

**Security notes:** Validate tab query param against whitelist.

**Steps:**

1. Create the unified Finance page:

```typescript
"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { FinanceTabBar, FinanceTab, FINANCE_TABS } from "./FinanceTabBar";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";

// Lazy-load tab content for code-splitting
const TransactionContent = dynamic(
  () =>
    import("../transaction/page").then((mod) => mod.TransactionContent),
  { ssr: false, loading: () => <TabLoadingFallback /> }
);

const ReportContent = dynamic(
  () =>
    import("../report/page").then((mod) => mod.ReportContent),
  { ssr: false, loading: () => <TabLoadingFallback /> }
);

const BudgetContent = dynamic(
  () =>
    import("../budget/page").then((mod) => mod.BudgetContent),
  { ssr: false, loading: () => <TabLoadingFallback /> }
);

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <LoadingSpinner />
    </div>
  );
}

function FinancePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("nav");

  // Validate tab param — fallback to "transaction"
  const rawTab = searchParams.get("tab");
  const activeTab: FinanceTab =
    rawTab && FINANCE_TABS.includes(rawTab as FinanceTab)
      ? (rawTab as FinanceTab)
      : "transaction";

  const handleTabChange = useCallback(
    (tab: FinanceTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`/dashboard/finance?${params.toString()}`);
    },
    [searchParams, router]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-4 sm:px-6 pt-4 pb-2">
        <h1 className="text-lg sm:text-xl font-bold font-vietnam text-v2-text-primary">
          {t("financePageTitle")}
        </h1>
      </div>

      {/* Sticky tab bar */}
      <FinanceTabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab content */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="flex-1 overflow-y-auto"
      >
        {activeTab === "transaction" && <TransactionContent />}
        {activeTab === "report" && <ReportContent />}
        {activeTab === "budget" && <BudgetContent />}
      </div>
    </div>
  );
}

export default function FinancePage() {
  return (
    <Suspense fallback={<TabLoadingFallback />}>
      <FinancePageInner />
    </Suspense>
  );
}
```

**Key design decisions:**
- `useSearchParams` requires `<Suspense>` wrapper in Next.js 15 — hence the inner/outer component split
- `router.replace` (not `push`) for tab switches — avoids polluting browser history per spec FR-1
- Tab content conditionally rendered (unmount inactive) — per spec decision (React Query cache provides instant data)
- `dynamic()` imports for code-splitting — per spec NFR performance
- Tab param validated against `FINANCE_TABS` whitelist

**Commit:** `feat(finance): create unified finance page with tabbed navigation`

---

### Task 6: Set up old route redirects

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/transaction/redirect.ts` (or modify page.tsx)
- Create: `src/wj-client/app/[locale]/dashboard/report/redirect.ts`
- Create: `src/wj-client/app/[locale]/dashboard/budget/redirect.ts`

**Approach:** Replace the default export in each old page file with a server component that performs a redirect. Since we still need the content components (used by the Finance page via `dynamic()` import), we keep the named exports and only change the default export to redirect.

**Steps:**

1. **Transaction page** (`transaction/page.tsx`):
   - Change the default export to perform a redirect:

```typescript
import { redirect } from "next/navigation";

// ... existing TransactionContent stays as named export ...

export default function TransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Build redirect URL preserving existing query params
  const params = new URLSearchParams();
  params.set("tab", "transaction");

  // Note: In Next.js 15, searchParams is a Promise in server components
  // For simplicity, redirect without preserving extra params initially
  redirect(`/dashboard/finance?tab=transaction`);
}
```

**Problem:** The existing page uses `"use client"` (it has hooks, state, etc.), so we can't use server-side `redirect()` in the same file.

**Revised approach — separate redirect file:**

Instead of modifying the existing page files (which are `"use client"`), we'll handle redirects differently:

**Option A (Recommended): Next.js `next.config.js` redirects**

Add redirects in the Next.js config. This is the cleanest approach — no new files, server-handled, and works for all locales:

```javascript
// next.config.js — add to existing config
async redirects() {
  return [
    {
      source: '/:locale/dashboard/transaction',
      destination: '/:locale/dashboard/finance?tab=transaction',
      permanent: true,
    },
    {
      source: '/:locale/dashboard/report',
      destination: '/:locale/dashboard/finance?tab=report',
      permanent: true,
    },
    {
      source: '/:locale/dashboard/budget',
      destination: '/:locale/dashboard/finance?tab=budget',
      permanent: true,
    },
  ];
},
```

**Limitation:** `next.config.js` redirects do NOT forward source query params to the destination. To handle that, we'll need middleware.

**Option B (Better for query param preservation): Middleware redirect**

Add redirect logic in `src/wj-client/middleware.ts` to handle the old routes and preserve query params:

```typescript
// Add to existing middleware.ts
const redirectMap: Record<string, string> = {
  '/dashboard/transaction': 'transaction',
  '/dashboard/report': 'report',
  '/dashboard/budget': 'budget',
};

// In the middleware function, before the next-intl middleware:
// Check if the pathname (without locale) matches a redirect
const pathWithoutLocale = request.nextUrl.pathname.replace(/^\/(vi|en)/, '');
const tabValue = redirectMap[pathWithoutLocale];
if (tabValue) {
  const url = request.nextUrl.clone();
  url.pathname = url.pathname.replace(pathWithoutLocale, '/dashboard/finance');
  url.searchParams.set('tab', tabValue);
  return NextResponse.redirect(url, 308);
}
```

This preserves existing query params AND uses HTTP 308 permanent redirect.

2. We'll use **Option B (middleware)** since it handles query param preservation per spec FR-3.

3. Read the existing `middleware.ts` to understand its structure before modifying.

4. Add the redirect logic BEFORE the next-intl middleware runs (so the redirect happens first).

**Commit:** `feat(routing): add middleware redirects from old routes to finance page`

---

### Task 7: Update navigation — Desktop Sidebar

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`

**Steps:**

1. **Import the new Banknote icon** from lucide-react (finance-appropriate icon):
   - Add `Banknote` (or `CircleDollarSign` or `Receipt`) to the lucide-react import
   - Remove unused icons if Transaction, Report, Budget icons are no longer needed individually

2. **Update Desktop Sidebar — Standard group** (lines ~335-378):

Replace the 4 NavItems (Transactions, Wallets, Reports, Budget) with 2 NavItems (Finance, Wallets):

```typescript
{/* Standard group */}
<div className={cn("flex flex-col gap-0.5", isExpanded ? "mt-3" : "mt-4")}>
  <NavItem
    href={routes.finance}
    label={t("finance")}
    isExpanded={isExpanded}
    showTooltip={!isExpanded}
    animationDelay={90}
    icon={<Banknote size={20} />}
    isActive={path.startsWith("/dashboard/finance")}
  />
  <NavItem
    href={routes.wallets}
    label={t("wallets")}
    isExpanded={isExpanded}
    showTooltip={!isExpanded}
    animationDelay={120}
    icon={<Wallet size={20} />}
    isActive={path === routes.wallets}
  />
</div>
```

**Key changes:**
- Replace Transaction, Reports, Budget NavItems with single Finance NavItem
- Finance `isActive` uses `path.startsWith("/dashboard/finance")` to match all tab states
- Animation delays adjusted: Finance=90, Wallets=120 (previously Transaction=90, Wallets=120, Reports=150, Budget=180)
- Settings animationDelay becomes 150 (was 210)

3. **Update animation delays** for the reduced item count:
   - Premium: Home=0, Portfolio=30, Community=60 (unchanged)
   - Standard: Finance=90, Wallets=120 (2 items instead of 4)
   - Settings: 150 (was 210)

**Commit:** `feat(nav): consolidate sidebar from 4 standard items to Finance + Wallets`

---

### Task 8: Update navigation — Mobile Slide-out Menu

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`

**Steps:**

1. **Update the `navigationItems` useMemo** (lines ~121-234):

Replace the `standardItems` array:

```typescript
const standardItems = [
  {
    href: routes.finance,
    label: t("finance"),
    icon: <Banknote size={22} />,
  },
  { href: routes.wallets, label: t("wallets"), icon: <Wallet size={22} /> },
];
```

This replaces the 4-item array (Transaction, Wallets, Reports, Budget) with 2 items (Finance, Wallets).

2. **Update `isActive` check** for the Finance item in the mobile menu:
   - Currently uses `path === item.href` for exact match
   - Finance needs `path.startsWith("/dashboard/finance")` for partial match
   - Modify the className logic in the `standardItems.map()` to handle this:

```typescript
{standardItems.map((item) => (
  <ActiveLink
    key={item.href}
    href={item.href}
    className={cn(
      "flex items-center gap-3 py-3 px-3.5 rounded-xl font-vietnam text-[15px] transition-colors duration-200 touch-target",
      path.startsWith(item.href)
        ? "text-v2-red-primary bg-v2-red-light font-semibold"
        : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
    )}
  >
    {item.icon}
    <span>{item.label}</span>
  </ActiveLink>
))}
```

Note: Changed `path === item.href` to `path.startsWith(item.href)`. This works for both Finance (`/dashboard/finance*`) and Wallets (`/dashboard/wallets`). Verify that `/dashboard/wallets` doesn't have sub-routes that would cause false positives.

**Commit:** `feat(nav): consolidate mobile menu from 4 standard items to Finance + Wallets`

---

### Task 9: Clean up unused icon imports

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`

**Steps:**

1. Review lucide-react imports at the top of layout.tsx
2. Remove icons that are no longer used after nav consolidation:
   - `ArrowLeftRight` — was used for Transactions nav item
   - `ChartPie` — was used for Reports nav item
   - `Calculator` — was used for Budget nav item
3. Add `Banknote` (or chosen icon) to the import

Before:
```typescript
import {
  House, ArrowLeftRight, Wallet, ChartNoAxesCombined,
  Calculator, ChartPie, Settings, Bell, Search, LogOut, X, Menu, Users,
} from "lucide-react";
```

After:
```typescript
import {
  House, Banknote, Wallet, ChartNoAxesCombined,
  Settings, Bell, Search, LogOut, X, Menu, Users,
} from "lucide-react";
```

**Commit:** `refactor(layout): clean up unused icon imports after nav consolidation`

---

### Task 10: Verify and fix page content in tab context

**Files:**
- Potentially modify: `src/wj-client/app/[locale]/dashboard/transaction/page.tsx`
- Potentially modify: `src/wj-client/app/[locale]/dashboard/report/page.tsx`
- Potentially modify: `src/wj-client/app/[locale]/dashboard/budget/page.tsx`

**Steps:**

1. **Check for duplicate headers:** The existing pages likely have their own header sections (title, action buttons). When rendered as tab content within the Finance page (which has its own header + tab bar), there may be visual duplication.

   - Transaction page: Has a header with balance display — this should remain as it's content-specific, not page chrome
   - Report page: Has a header with export button — same, content-specific
   - Budget page: Has a header with "Create Budget" button — same

   **Decision:** The existing page headers are content-specific (balance, export, create buttons) and should remain. The Finance page header is just the page title. No changes needed here unless visual testing reveals issues.

2. **Check for full-height layout issues:** The existing pages may use `h-full` or `min-h-screen` that could conflict when rendered inside the tab panel. If so, remove explicit height constraints from the content components.

3. **Check for scroll behavior:** Each tab content should scroll within the tab panel. Verify that the existing pages don't have their own scroll containers that would create nested scrollbars.

4. **Test each tab renders correctly** — visual verification.

**Commit:** `fix(finance): adjust page content components for tab context (if needed)`

---

### Task 11: Update FloatingActionButton context

**Files:**
- Potentially modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`

**Steps:**

1. **Verify FAB behavior on Finance page:** The FloatingActionButton (3 quick actions: Add Transaction, Transfer Money, Create Wallet) is rendered in the layout and should work on any dashboard page including the new Finance page.

2. No changes expected — the FAB is already in the layout and not page-specific.

**Commit:** Skip if no changes needed.

---

### Task 12: Update C4 frontend component diagram

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

Per Task 0 analysis:

1. In the `App Router (Pages)` boundary:
   - Remove `txn_page`, `budget_page`, `report_page` components
   - Add: `Component(finance_page, "Finance Page", "app/dashboard/finance", "Unified tabbed view: FinanceTabBar switches between TransactionContent, ReportContent, BudgetContent via URL query params (?tab=transaction|report|budget). Content lazy-loaded via next/dynamic.")`

2. Update relationships:
   - Remove: `Rel(txn_page, txn_feat, ...)`, `Rel(budget_page, budget_feat, ...)`, `Rel(report_page, report_feat, ...)`
   - Add:
     ```
     Rel(finance_page, txn_feat, "Renders transaction tab content")
     Rel(finance_page, budget_feat, "Renders budget tab content")
     Rel(finance_page, report_feat, "Renders report tab content")
     ```

**Commit:** `docs(architecture): update C4 frontend diagram for finance page consolidation`

---

## Task Dependency Graph

```
Task 1 (i18n keys)          ─┐
Task 2 (route constant)     ─┤
Task 3 (extract components) ─┼─→ Task 5 (Finance page) ─→ Task 10 (verify content)
Task 4 (FinanceTabBar)      ─┘
                                   Task 6 (redirects) — independent of Task 5
Task 7 (desktop sidebar)    ─┐
Task 8 (mobile menu)        ─┼─→ Task 9 (cleanup imports)
                              ┘
Task 12 (C4 diagram)        — independent
```

**Parallel-safe groups:**
- **Group A (can run in parallel):** Tasks 1, 2, 3, 4, 12 — no shared files
- **Group B (depends on Group A):** Tasks 5, 6 — depend on outputs of Group A
- **Group C (independent of Group B):** Tasks 7, 8 — only modify layout.tsx
- **Group D (depends on Group C):** Task 9 — cleanup of layout.tsx
- **Group E (depends on Group B):** Task 10 — verify after Finance page exists

**Recommended execution order:**
1. Tasks 1, 2, 3, 4 (parallel) — foundation
2. Task 5 — Finance page (depends on all of Group A)
3. Tasks 6, 7, 8 (parallel) — redirects + nav updates
4. Task 9 — cleanup imports
5. Task 10 — verify and fix
6. Task 12 — C4 diagram (can run anytime, but logically last)

## Notes

- Bottom nav is **not affected** — it shows Home, Portfolio, Community (spec confirmed)
- The `BottomNav` component is hardcoded for 3 items at 33.33% width — no changes needed
- Old page files remain in the codebase (not deleted) because they serve as the source for dynamic imports AND handle redirects during the transition
- Consider deleting old page files in a follow-up if redirects are moved entirely to middleware
- The `useSearchParams` hook is new to this codebase — it requires `<Suspense>` boundary in Next.js 15
