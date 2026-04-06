---
type: bug
status: Implement
---

## Overview

The public asset display prices endpoint (`GET /api/v1/public/asset-display-prices`) returns identical buy/sell values across all asset types (gold, silver, currency) when queried separately. For example, querying for `assetType=silver` and `assetType=currency` returns the same gold prices that were returned for `assetType=gold`, causing silver and currency price tables on the home dashboard to display incorrect gold prices.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-06-fix-asset-display-prices-same-value-bug-spec.md` |
| Plan     | `docs/plans/2026-04-06-fix-asset-display-prices-same-value-bug-plan.md` |
| Progress | `docs/reports/2026-04-06-fix-asset-display-prices-same-value-bug-progress.md` |
| Report   | _(added after step 3 completes)_ |
