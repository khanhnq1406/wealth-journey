---
type: bug
status: Review
---

## Overview

Price values in the Price Alert table show incorrect amounts for USD-denominated assets (e.g., BTC shows $6,847,203.00 instead of $68,472.03). The backend stores prices as int64 in smallest currency units (cents for USD), but the frontend formats without dividing by the decimal multiplier — a 100× display error for all non-VND currencies.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-07-price-alert-usd-display-bug-spec.md` |
| Plan     | `docs/plans/2026-04-07-price-alert-usd-display-bug-plan.md` |
| Progress | `docs/reports/2026-04-07-price-alert-usd-display-bug-progress.md` _(added after step 3 starts)_ |
| Report   | `docs/reports/2026-04-07-price-alert-usd-display-bug-report.md` _(added after step 3 completes)_ |
