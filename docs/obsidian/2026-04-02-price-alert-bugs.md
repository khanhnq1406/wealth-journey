---
type: bug
status: Done
---

## Overview

Two bugs in the user price alert system prevent correct operation: USD price alerts show values divided by 100 in notifications, and Vietnamese gold symbol names like "Vàng nhẫn SJC" are rejected by backend symbol validation. Both bugs are backend-only fixes with no API or frontend changes required.

## Details

**Bug 1 — Wrong USD value in notifications:** When a price alert for a USD asset (e.g. BTC at $50,000) triggers, the notification displays "500.00 USD" instead of "$50,000 USD". The backend `FormatUserAlertPrice()` incorrectly divides by 100, assuming cents-based storage when the frontend sends whole-dollar amounts.

**Bug 2 — Vietnamese gold symbol validation rejected:** Creating a price alert for a Vietnamese gold asset (assetType 8) with a symbol like "Vàng nhẫn SJC" fails with VALIDATION_ERROR because the backend symbol regex only allows ASCII alphanumeric characters, dots, dashes, and underscores — rejecting accented Vietnamese characters and spaces.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-02-price-alert-bugs-spec.md` |
| Plan     | `docs/plans/2026-04-02-price-alert-bugs-plan.md` |
| Report   | `docs/reports/2026-04-02-price-alert-bugs-report.md` |
