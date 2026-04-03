# Fix Admin Nav Items Not Showing — Implementation Report

## Summary

Replaced the broken `store.subscribe` pattern in `DashboardLayout` with `useSelector` from `react-redux`. The old code registered a new subscription on every render (no cleanup), used a stale closure guard (`!user.picture`) that silently dropped `isAdmin` updates under React 18 batching, and seeded state via `store.getState()` at mount time — meaning subsequent Redux state changes were not reflected in the UI. The fix makes `isAdmin` reactive through React-Redux's optimized subscription system, so the Admin nav item now appears immediately after Google OAuth login without requiring a hard refresh.

## Spec Reference

docs/specs/2026-04-03-fix-admin-nav-items-not-showing-spec.md

## Plan Reference

docs/plans/2026-04-03-fix-admin-nav-items-not-showing-plan.md

## Tasks Completed

| #   | Task                                                        | Status | Files Changed | Tests    | TDD |
| --- | ----------------------------------------------------------- | ------ | ------------- | -------- | --- |
| 1   | Replace store.subscribe with useSelector in DashboardLayout | Done   | 4 files       | 6/6 pass | Yes |

## Test Coverage Summary

| Layer              | Test File                                        | Tests | Pass | Coverage Area                                   |
| ------------------ | ------------------------------------------------ | ----- | ---- | ----------------------------------------------- |
| Frontend Component | `DashboardLayout-admin-nav.test.tsx` (new)       | 2     | 2/2  | Admin nav shows when isAdmin=true; hidden when false |
| Frontend Component | `DashboardLayout-fab-loading.test.tsx` (updated) | 2     | 2/2  | FAB loading state (regression — react-redux mock added) |
| Frontend Component | `DashboardLayout-guide.test.tsx` (updated)       | 2     | 2/2  | Guide link in desktop/mobile nav (regression — react-redux mock added) |

## Security Implementation Summary

| Concern          | Implementation                                          | Verified |
| ---------------- | ------------------------------------------------------- | -------- |
| Authorization    | isAdmin is display-only; AdminGuard + backend AdminMiddleware unchanged | Yes |
| Input validation | No new inputs — unchanged                               | N/A      |
| Data exposure    | No new data flows; user object already accessible to this component | Yes |

## Review Results

### Spec Compliance

PASS — all 4 required changes implemented exactly as specified. Collateral update to `DashboardLayout-guide.test.tsx` (not in plan) was correctly identified as required for test correctness after the component API changed.

### Security Review

APPROVED — no security concerns. Fix eliminates a subscription leak (O(n renders) subscriptions with no cleanup) which is a reliability improvement. No authorization logic changed.

### Code Quality

APPROVED — implementation is minimal and surgical. Two minor observations noted by reviewer (dead store mock in updated test files; `getAllByText` assertion could be slightly more precise) — neither blocks commit. Both are cosmetic and do not affect correctness.

## Known Issues / Technical Debt

The `react-redux` mock in `DashboardLayout-fab-loading.test.tsx` and `DashboardLayout-guide.test.tsx` still includes the `@/features/auth/store/store` mock (with `getState`, `subscribe`, `dispatch`). Since `DashboardLayout` no longer imports `store` directly, these mocks are now unused dead code. They do not cause failures and can be cleaned up in a future housekeeping pass.

## Files Changed

| File | Change |
|------|--------|
| `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx` | Removed store import; added useSelector; replaced useState + store.subscribe with useSelector call |
| `src/wj-client/app/[locale]/dashboard/__tests__/DashboardLayout-admin-nav.test.tsx` | Created — new TDD test for Admin nav item visibility |
| `src/wj-client/app/[locale]/dashboard/__tests__/DashboardLayout-fab-loading.test.tsx` | Added react-redux mock |
| `src/wj-client/app/[locale]/dashboard/__tests__/DashboardLayout-guide.test.tsx` | Added react-redux mock |

## How to Test

### Unit & Integration Tests

```bash
cd src/wj-client && npx jest --testPathPattern="DashboardLayout" --no-coverage
```

Expected: 3 suites, 6 tests, all pass.

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed.

`DashboardLayout` is the layout wrapper for all dashboard routes. The change only affects how `user` state is read — the rendered output is identical for any given Redux state. No callers of `DashboardLayout` pass props related to `user` or `isAdmin`; this is entirely internal state management.

### Manual Testing Steps

#### Scenario: Admin user sees Admin nav item after OAuth login

**Preconditions:** Google OAuth account that is marked `is_admin=true` in the backend database.

1. Open the app and navigate to `/auth/login`
2. Click "Sign in with Google" and complete the OAuth flow
3. After redirect to `/dashboard/home` → Expected: the Admin nav item is visible in the left sidebar (desktop) or slide-out menu (mobile) **without requiring a page refresh**

#### Scenario: Regular user does not see Admin nav item

**Preconditions:** Any Google OAuth account where `is_admin=false` (default for all users).

1. Sign in with Google OAuth
2. Navigate to `/dashboard/home` → Expected: no Admin nav item visible in sidebar or mobile menu

#### Scenario: Admin nav item disappears on logout

**Preconditions:** Logged in as an admin user.

1. Click the logout button in the sidebar
2. Expected: redirected to login page; Redux store cleared

#### Scenario: Unit test verification

```bash
cd src/wj-client && npx jest --testPathPattern="DashboardLayout-admin-nav" --no-coverage --verbose
```

Expected output:
```
PASS app/[locale]/dashboard/__tests__/DashboardLayout-admin-nav.test.tsx
  DashboardLayout — Admin nav item visibility
    ✓ shows Admin nav item in desktop sidebar when isAdmin=true
    ✓ hides Admin nav item when isAdmin=false
```
