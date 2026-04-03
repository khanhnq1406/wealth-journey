# Fix: Admin Nav Items Not Showing After Login Specification

## Summary

After a fresh Google OAuth login, admin users are intermittently redirected to the dashboard without the admin nav item appearing in the sidebar (both desktop and mobile). A hard page refresh resolves the issue. The root cause is a broken manual `store.subscribe` pattern in `DashboardLayout` that uses a stale closure guard (`!user.picture`) and leaks subscriptions on every render. The fix replaces this pattern with `useSelector` from react-redux, which is already used elsewhere in the codebase (`AdminGuard`, `CurrencyContext`).

## User Stories

- As an admin user, I want the Admin nav item to appear immediately after login, so that I can access admin-only routes without needing a manual page refresh.

## Functional Requirements

### FR-1: Admin Nav Item Appears Consistently After Login

After completing Google OAuth and being redirected to `/dashboard/home`, the Admin nav item must appear in both the desktop sidebar and mobile slide-out menu without requiring a page refresh.

**Acceptance criteria:**
- [ ] Admin nav item appears in desktop sidebar on first render after fresh login
- [ ] Admin nav item appears in mobile slide-out menu on first render after fresh login
- [ ] Non-admin users never see the Admin nav item
- [ ] The fix works consistently, not just most of the time

### FR-2: No Redux Subscription Leak

The current `store.subscribe` call lives in the render body of `DashboardLayout`, registering a new subscription on every re-render with no cleanup. This must be eliminated.

**Acceptance criteria:**
- [ ] `store.subscribe` call is removed from `DashboardLayout`
- [ ] No unbounded subscription accumulation on re-renders

## Non-Functional Requirements

- **Performance:** `useSelector` re-renders only when the selected slice changes (same or better than current)
- **Consistency:** Pattern matches `AdminGuard.tsx` and `CurrencyContext.tsx` which already use `useSelector`
- **No new dependencies:** `react-redux` v9.2.0 already in `package.json`

## Root Cause Analysis

### Exact Bug

`DashboardLayout` mounts before `AuthCheck` has completed token verification (since `DashboardLayout` wraps `AuthCheck` in its render output). At mount:

```typescript
// Line 62 — captures Redux state at mount time (isAdmin: false, picture: null)
const [user, setUser] = useState(store.getState().setAuthReducer);
```

Then in the render body (not in `useEffect`):

```typescript
// Lines 92-96 — registers a NEW subscription on every render, never cleaned up
store.subscribe(() => {
  if (!user.picture) {          // ← stale closure: captures `user` from current render
    setUser(store.getState().setAuthReducer);
  }
});
```

When `setAuth` is dispatched (after token verification), the subscription fires. The `!user.picture` check uses the closure value of `user` from the render in which that particular subscription was registered. Under React 18 automatic batching, if a re-render has occurred between subscription registration and the `setAuth` dispatch where `picture` got set to a truthy value in the closure, the guard prevents the `isAdmin` update from being applied to local state.

Because `queueMicrotask(() => setToken(storedToken))` and `store.dispatch(setAuth({...}))` run in the same useEffect callback, React 18 may batch the resulting state updates, causing the subscription callback to see a post-render closure where `user.picture` is already set — and silently dropping the `isAdmin` update.

### Why It's Intermittent

The race depends on React 18's automatic batching behavior: whether the subscription callback fires before or after the re-render triggered by the batched state updates. This is non-deterministic across browser sessions and network speed variations.

### The Fix

Replace `useState(store.getState()...)` + `store.subscribe` with `useSelector`:

```typescript
import { useSelector } from "react-redux";

// In DashboardLayout:
const user = useSelector((state: any) => state.setAuthReducer);
// Remove lines 62, 92-96 entirely
```

`useSelector` subscribes correctly via React's render cycle, always reflects the current Redux state, never has a stale closure problem, and cleans up automatically on unmount.

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-frontend.md` (L3 Frontend):** No structural change — `DashboardLayout` still depends on the auth Redux store. The relationship exists; only the implementation of how it reads the store changes. No diagram update needed.

### New Diagrams

None required — this is an internal implementation fix within an existing component.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`flow-auth.md`:** The auth flow itself is unchanged. `DashboardLayout` now correctly reacts to `setAuth` dispatch via `useSelector` — but the sequence of calls is identical. No diagram update needed.

### New Flow Diagrams

None — no new multi-step business logic introduced.

## Data Model Changes

None.

## API Changes

None.

## UI/UX Changes

The Admin nav item rendering logic stays exactly the same — only the mechanism by which `user.isAdmin` is read changes. No visual change for non-admin users. Admin users will now consistently see the Admin nav item after login.

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Read Redux auth state reactively | `useSelector` from react-redux | Already imported in `AdminGuard.tsx`, `CurrencyContext.tsx` |

### New Components

None.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Google OAuth | ID token | Yes: Internet → App | Backend `/auth/verify` | Unchanged |
| 2 | Backend `/auth/verify` | `{ isAdmin, email, picture, ... }` | Yes: Backend → Frontend | Redux store via `setAuth` | Unchanged |
| 3 | Redux store | `isAdmin` boolean | No | `DashboardLayout` render | This is the fixed flow |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|------------|-----------------|
| Internet → App | OAuth token exchange | Google OAuth + JWT verification on backend |
| Backend → Frontend | Auth response | JWT whitelist in Redis; response only to authenticated caller |
| Redux store → Component | `isAdmin` read | No boundary — both are client-side; `isAdmin` is display-only |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | Flow 3 | None (client-side) | Tampering | Client modifies Redux `isAdmin` to `true` | Low | `AdminGuard` re-checks `isAdmin` server-side; backend enforces admin on all admin endpoints |
| T-2 | Flow 3 | None | Information Disclosure | Non-admin sees admin nav via client manipulation | Low | `AdminGuard` blocks page render; backend endpoints require admin middleware |

### Authorization Rules

- `isAdmin` on the frontend is **display-only** — it shows/hides the nav item
- `AdminGuard` provides page-level protection (already correct — unchanged)
- All backend admin endpoints use `AdminMiddleware` (unchanged)
- Client-side `isAdmin` manipulation cannot grant real access

### Input Validation Rules

None — this fix has no new inputs.

### External Dependency Risks

- `react-redux` v9.2.0 — already in use, no new dependency risk

### Sensitive Data Handling

- `isAdmin` boolean is not sensitive on its own; actual admin data is protected server-side

### Issues & Risks Summary

1. **Subscription leak (fixed):** The current unbounded `store.subscribe` registers O(n renders) subscriptions — this fix eliminates the leak entirely
2. **Stale closure (fixed):** `!user.picture` guard silently drops `isAdmin` updates — `useSelector` has no such guard
3. **Low risk fix:** The change is contained to 3 lines in one file; no backend changes, no API changes, no new dependencies

## Edge Cases & Error Handling

- **Admin user with no profile picture:** `user.picture` would be falsy — currently this is what makes the bug intermittent (the guard is `!user.picture`, so users WITHOUT pictures would actually be *less* affected). With `useSelector`, `picture` is irrelevant to `isAdmin` display.
- **Non-admin user:** `isAdmin` is `false` by default in reducer; `useSelector` returns `false` → nav item hidden. Correct.
- **Token verification failure:** `handleError()` redirects to login; `DashboardLayout` unmounts. `useSelector` subscription cleaned up automatically. Correct.
- **Locale redirect (line 77-79 in AuthCheck):** `router.replace` may cause re-render; `useSelector` handles this correctly since it always reflects current store state.

## Dependencies & Assumptions

- `react-redux` v9.2.0 is installed (confirmed in `package.json`)
- `useSelector` is imported from `react-redux` (same as `AdminGuard.tsx`)
- The Redux store type: `state.setAuthReducer` — using `any` type as per existing pattern in `AdminGuard.tsx` (can be typed as `ReturnType<typeof store.getState>` for future improvement, out of scope)
- `DashboardLayout` is a `"use client"` component (line 1 of file) — hooks are valid

## Out of Scope

- Typing the Redux state with `RootState` (worthwhile future improvement, separate task)
- Fixing `AdminGuard`'s `(state: any)` typing
- Migrating other Redux usages in `DashboardLayout` (e.g., modal state) to `useSelector`
- Bottom navigation admin items (bottom nav is hardcoded for 6 non-admin items; no admin item there)
