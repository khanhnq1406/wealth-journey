---
type: bug
status: Spec
---

## Overview

Both the system price alert job and user price alert job are not firing on production. The issue started approximately 3 days ago following the "filter alert evaluation to admin-enabled type codes only" fix (commit `7da688f3`). No notifications are being sent despite the schedulers running on time.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-06-price-alert-not-running-prod-spec.md` |
| Plan     | `docs/plans/2026-04-06-price-alert-not-running-prod-plan.md` _(added after step 2)_ |
| Report   | `docs/reports/2026-04-06-price-alert-not-running-prod-report.md` _(added after step 3)_ |
