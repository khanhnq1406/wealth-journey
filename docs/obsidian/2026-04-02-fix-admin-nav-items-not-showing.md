---
type: bug
status: Spec
---

## Overview

After a fresh Google OAuth login and redirect to the dashboard, admin-specific navigation items (e.g., the Admin panel link) intermittently fail to appear in the navbar. A hard page refresh resolves the issue. The bug is caused by a broken `store.subscribe` pattern in `DashboardLayout` with a stale closure guard.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-03-fix-admin-nav-items-not-showing-spec.md` |
| Plan     | `docs/plans/2026-04-03-fix-admin-nav-items-not-showing-plan.md` _(added after step 2)_ |
| Progress | `docs/reports/2026-04-03-fix-admin-nav-items-not-showing-progress.md` _(added after step 3 starts)_ |
| Report   | `docs/reports/2026-04-03-fix-admin-nav-items-not-showing-report.md` _(added after step 3 completes)_ |
