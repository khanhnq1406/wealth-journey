---
type: bug
status: Not Started
---

## Overview

After logging in as an admin and navigating to the dashboard, the admin-specific navigation items sometimes fail to appear in the navbar. This creates a broken experience where admins cannot access admin-only routes without a manual page refresh.

## Details

The issue occurs intermittently after admin login when redirected to the dashboard. The navbar renders without the admin nav items (e.g., Admin panel link), even though the user has admin privileges. This is likely a race condition where the navbar component renders before the auth/user state (including the admin role) has fully propagated — possibly the Redux auth store or the session query hasn't resolved by the time the sidebar/nav component mounts.

**Route affected:** `/dashboard/*` (sidebar and/or top nav)
**Expected:** Admin nav items appear immediately after login redirect.
**Actual:** Admin nav items are missing; a hard refresh resolves the issue.

## Acceptance Criteria

- [ ] Admin nav items consistently appear after admin login without requiring a page refresh
- [ ] Auth/role state is fully resolved before the navbar renders admin-conditional items
- [ ] Verified on both desktop sidebar and mobile slide-out navigation
