---
type: bug
status: Plan
---

## Overview

The system price alert is triggering alerts for all asset type codes, even those that have not been configured in the admin asset display config. This causes unwanted or irrelevant alerts to fire for assets that should not be monitored.

## Details

When the system evaluates price alerts, it should only trigger notifications for asset type codes that have been explicitly enabled and configured in the admin asset display config. Currently, the evaluation runs against all available codes regardless of admin configuration.

Expected: System price alerts only fire for asset codes that are present and enabled in the admin config.
Actual: System price alerts fire for all asset codes, including those not configured in the admin panel.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-03-fix-system-price-alert-shows-alert-for-all-codes-spec.md` |
| Plan     | `docs/plans/2026-04-03-fix-system-price-alert-shows-alert-for-all-codes-plan.md` |
| Report   | _(added after step 3)_ |
