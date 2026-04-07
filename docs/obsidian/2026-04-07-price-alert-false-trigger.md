---
type: bug
status: Implement
---

## Overview

Price alerts for USD-denominated assets (BTC, stocks, gold USD) fire incorrectly — an "above $100,000" alert triggers even when the price is only $68,520. The backend `EvaluateAlerts` compares `currentPrice` (in cents, e.g., `6852028`) against `targetPrice` (in whole dollars, e.g., `100000`), causing a 100× scale mismatch that makes the condition always true for typical USD prices.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-07-price-alert-false-trigger-spec.md` |
| Plan     | `docs/plans/2026-04-07-price-alert-false-trigger-plan.md` |
| Progress | `docs/reports/2026-04-07-price-alert-false-trigger-progress.md` |
| Report   | `docs/reports/2026-04-07-price-alert-false-trigger-report.md` _(added after step 3 completes)_ |
