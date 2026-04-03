# Fix: Admin Nav Items Not Showing After Login — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace the broken `store.subscribe` pattern in `DashboardLayout` with `useSelector` so the Admin nav item appears reliably after Google OAuth login without a page refresh.
**Spec:** `docs/specs/2026-04-03-fix-admin-nav-items-not-showing-spec.md`
**Architecture:** Frontend-only fix. `DashboardLayout` reads `isAdmin` from the Redux store using `useSelector` (same pattern as `AdminGuard.tsx`). No backend, no API, no new dependencies.
**Tech Stack:** React 19, Redux Toolkit, react-redux v9.2.0, Next.js App Router, Jest + React Testing Library

---

## Security Implementation Notes

- **Authentication:** Unchanged — JWT verification remains on the backend
- **Authorization:** `isAdmin` is display-only; `AdminGuard` + backend `AdminMiddleware` provide real enforcement (unchanged)
- **Input validation:** No new inputs — no validation changes needed
- **Data sanitization:** No new data flows — no sanitization changes needed

---

## Component Reuse Inventory

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `useSelector` | `react-redux` (already installed) | Replace `useState(store.getState())` + `store.subscribe` |

**New components needed:** None.

---

## C4 Architecture Diagram Updates

No diagram updates needed — `DashboardLayout` already has a dependency on the auth Redux store in the C4 diagrams; only the implementation mechanism changes.

---

## Task 1: Replace `store.subscribe` with `useSelector` in `DashboardLayout`

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx` (lines 6–7, 62, 92–96)

**Security notes:** No security impact — this is a client-side read of a display-only boolean.

---

### Step 1: Write the failing test

Add a new test file that verifies the Admin nav item renders when `isAdmin: true` is returned from the Redux store — and that it is absent when `isAdmin: false`.

Create: `src/wj-client/app/[locale]/dashboard/__tests__/DashboardLayout-admin-nav.test.tsx`

```typescript
/**
 * TDD test: Admin nav item appears when isAdmin=true; hidden when isAdmin=false.
 *
 * Verifies the useSelector fix is in place (not store.subscribe).
 * Run: cd src/wj-client && npx jest --testPathPattern="DashboardLayout-admin-nav" --no-coverage
 */

import React from "react";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — same pattern as DashboardLayout-fab-loading.test.tsx
// ---------------------------------------------------------------------------

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(() => ({ get: jest.fn(() => null) })),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => "/dashboard/home"),
}));

jest.mock("next-intl", () => ({
  useTranslations: jest.fn(
    () =>
      (key: string) =>
        key,
  ),
}));

jest.mock("@/lib/navigation", () => ({
  usePathname: jest.fn(() => "/dashboard/home"),
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@/components/ActiveLink", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
    disableBuiltInActive: _d,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    disableBuiltInActive?: boolean;
    [key: string]: unknown;
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@/app/[locale]/auth/utils/logout", () => ({ logout: jest.fn() }));
jest.mock("@/app/[locale]/auth/utils/AuthCheck", () => ({
  AuthCheck: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Redux store — NOT mocked directly; react-redux's useSelector will be mocked
jest.mock("@/features/auth/store/store", () => ({
  store: {
    getState: jest.fn(() => ({ setAuthReducer: { picture: null, fullname: "Test User", email: "", username: "", isAdmin: false } })),
    subscribe: jest.fn(() => jest.fn()),
    dispatch: jest.fn(),
  },
}));

jest.mock("@/contexts/CurrencyContext", () => ({
  CurrencyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/CurrencyConversionProgress", () => ({ CurrencyConversionProgress: () => null }));
jest.mock("@/components/navigation", () => ({ BottomNav: () => null, createNavItems: jest.fn(() => []) }));
jest.mock("@/components/search/GlobalSearch", () => ({ GlobalSearch: () => null }));
jest.mock("@/lib/utils/z-index", () => ({ ZIndex: { modal: 100, modalBackdrop: 99, sidebar: 50, sticky: 40 } }));
jest.mock("@/components/modals/BaseModal", () => ({
  BaseModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));
jest.mock("@/components/lazy/OptimizedComponents", () => ({ AddInvestmentForm: () => null }));
jest.mock("@/hooks/useSidebarState", () => ({ useSidebarState: jest.fn(() => ({ isExpanded: true, toggle: jest.fn() })) }));
jest.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));
jest.mock("@/components/notifications/PushPermissionBanner", () => ({ PushPermissionBanner: () => null }));
jest.mock("@/components/notifications/SidebarToggle", () => ({ SidebarToggle: () => null }));
jest.mock("@/components/navigation/SidebarToggle", () => ({ SidebarToggle: () => null }));
jest.mock("@/components/navigation/NavItem", () => ({
  NavItem: ({ href, label }: { href: string; label: string; [key: string]: unknown }) => (
    <a href={href}>{label}</a>
  ),
}));
jest.mock("@/components/navigation/NavTooltip", () => ({
  NavTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => ({ data: null, isPending: false })),
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/lib/utils/cn", () => ({ cn: (...args: unknown[]) => args.filter(Boolean).join(" ") }));
jest.mock("@/components/FloatingActionButton", () => ({ FloatingActionButton: () => null }));

// react-redux — mock useSelector to control what isAdmin returns
const mockUseSelector = jest.fn();
jest.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) => mockUseSelector(selector),
}));

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { DashboardLayout } from "../DashboardLayout";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DashboardLayout — Admin nav item visibility", () => {
  beforeEach(() => {
    mockUseSelector.mockClear();
  });

  it("shows Admin nav item in desktop sidebar when isAdmin=true", () => {
    // Simulate useSelector returning isAdmin: true
    mockUseSelector.mockImplementation(() => ({
      picture: null,
      fullname: "Admin User",
      email: "admin@example.com",
      username: "admin",
      isAdmin: true,
    }));

    render(
      <DashboardLayout>
        <div>page</div>
      </DashboardLayout>,
    );

    // NavItem renders as <a href={href}>{label}</a> in our mock
    const adminLinks = screen.getAllByText("Admin");
    expect(adminLinks.length).toBeGreaterThan(0);
  });

  it("hides Admin nav item when isAdmin=false", () => {
    mockUseSelector.mockImplementation(() => ({
      picture: null,
      fullname: "Regular User",
      email: "user@example.com",
      username: "user",
      isAdmin: false,
    }));

    render(
      <DashboardLayout>
        <div>page</div>
      </DashboardLayout>,
    );

    expect(screen.queryByText("Admin")).toBeNull();
  });
});
```

---

### Step 2: Run test to verify it fails (RED)

```bash
cd src/wj-client && npx jest --testPathPattern="DashboardLayout-admin-nav" --no-coverage
```

**Expected failure:** The test will fail because `DashboardLayout` currently uses `store.subscribe` (not `useSelector`), so `mockUseSelector` is never called and the component does not react to the mocked state.

---

### Step 3: Write minimal implementation

In `DashboardLayout.tsx`, make three changes:

**Change 1 — Add `useSelector` import, remove direct `store` import (keep store import if needed elsewhere; check — store is only used in lines 62 and 92–96, so remove it):**

```diff
-import { store } from "@/features/auth/store/store";
-import { useState, useMemo, useEffect } from "react";
+import { useSelector } from "react-redux";
+import { useMemo, useEffect } from "react";
```

`useState` must remain for `isMobileMenuOpen`, `isClosing`, `isSearchOpen`, `modalType`. So:

```diff
-import { store } from "@/features/auth/store/store";
-import { useState, useMemo, useEffect } from "react";
+import { useSelector } from "react-redux";
+import { useState, useMemo, useEffect } from "react";
```

Remove the `store` import entirely (line 6).

**Change 2 — Replace `useState(store.getState()...)` with `useSelector` (line 62):**

```diff
-const [user, setUser] = useState(store.getState().setAuthReducer);
+const user = useSelector((state: any) => state.setAuthReducer);
```

**Change 3 — Remove the `store.subscribe` block (lines 92–96):**

```diff
-store.subscribe(() => {
-  if (!user.picture) {
-    setUser(store.getState().setAuthReducer);
-  }
-});
-
 // Global search keyboard shortcut (Cmd/Ctrl + K)
```

**Complete diff to apply:**

File: `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx`

1. Line 6: Remove `import { store } from "@/features/auth/store/store";`
2. Line 7: Change to `import { useSelector } from "react-redux";`  (add after other imports, before `useState` line)
3. Line 62: Replace `const [user, setUser] = useState(store.getState().setAuthReducer);` with `const user = useSelector((state: any) => state.setAuthReducer);`
4. Lines 92–96: Remove entire `store.subscribe(...)` block

---

### Step 4: Run test to verify it passes (GREEN)

```bash
cd src/wj-client && npx jest --testPathPattern="DashboardLayout-admin-nav" --no-coverage
```

**Expected:** Both tests pass.

---

### Step 5: Run existing tests to verify no regression

```bash
cd src/wj-client && npx jest --testPathPattern="DashboardLayout" --no-coverage
```

The existing `DashboardLayout-fab-loading` tests mock `store.subscribe` — they should still pass because:
- `store.subscribe` is no longer called from the component (the mock is unused but that causes no failure)
- The `store.getState` mock is still there (used by nothing after the fix, also fine)
- The `react-redux` `useSelector` mock needs to be added to the fab-loading test — see Step 6.

---

### Step 6: Update existing test to add `react-redux` mock

The existing `DashboardLayout-fab-loading.test.tsx` will fail because `useSelector` is now called but `react-redux` is not mocked there. Add the mock:

In `DashboardLayout-fab-loading.test.tsx`, add after the `cn` mock:

```typescript
// react-redux
jest.mock("react-redux", () => ({
  useSelector: jest.fn(() => ({
    picture: null,
    fullname: "Test User",
    email: "test@example.com",
    username: "testuser",
    isAdmin: false,
  })),
}));
```

Then re-run:

```bash
cd src/wj-client && npx jest --testPathPattern="DashboardLayout" --no-coverage
```

**Expected:** All tests in both files pass.

---

### Step 7: Run frontend lint

```bash
cd src/wj-client && npm run lint 2>&1 | head -40
```

**Expected:** No new lint errors. The `(state: any)` typing matches the existing pattern in `AdminGuard.tsx`.

---

### Step 8: Playwright E2E Audit

This is a frontend-only fix. The affected page is `DashboardLayout` (wraps all dashboard routes).

```bash
cd src/wj-client && npx playwright test tests/e2e/ --reporter=list 2>&1 | tail -20
```

No specific E2E spec exists for admin nav item visibility (it requires a live OAuth flow). Document result in the implementation report.

---

### Step 9: Commit

```
fix(dashboard): replace store.subscribe with useSelector in DashboardLayout

The store.subscribe call in DashboardLayout's render body registered a new
subscription on every render and used a stale closure guard (!user.picture)
that silently dropped isAdmin updates under React 18 batching. This caused
admin nav items to intermittently fail to appear after Google OAuth login.

Replace useState(store.getState()) + store.subscribe with useSelector from
react-redux, matching the pattern used in AdminGuard.tsx and CurrencyContext.
useSelector always reflects current Redux state with no stale closure risk.

Fixes: admin nav items missing after fresh login (requires hard refresh)
```

---

## Summary

| Task | Files Changed | Tests Added/Modified |
|------|--------------|----------------------|
| 1 — Replace subscribe with useSelector | `DashboardLayout.tsx` (4 line changes) | `DashboardLayout-admin-nav.test.tsx` (new), `DashboardLayout-fab-loading.test.tsx` (add react-redux mock) |

**Total scope:** 1 file changed (4 line diff), 1 new test file, 1 existing test file updated.
