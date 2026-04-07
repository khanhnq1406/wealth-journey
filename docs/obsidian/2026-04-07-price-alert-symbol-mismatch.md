---
type: bug
status: Implement
---

## Overview

Creating a gold/silver price alert fails or silently never triggers because `AssetDisplayConfig.TypeCode` (what the frontend sends as `symbol`) does not always match `asset_price.TypeCode` (what the backend validates and evaluates against). The two layers are bridged by `asset_config_fetch_code` but the alert service bypasses this bridge entirely.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-07-price-alert-symbol-mismatch-spec.md` |
| Plan     | `docs/plans/2026-04-07-price-alert-symbol-mismatch-plan.md` |
| Progress | `docs/reports/2026-04-07-price-alert-symbol-mismatch-progress.md` |
| Report   | `docs/reports/2026-04-07-price-alert-symbol-mismatch-report.md` _(added after step 3 completes)_ |
