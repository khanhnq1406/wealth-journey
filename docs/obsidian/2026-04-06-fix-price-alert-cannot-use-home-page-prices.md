---
type: bug
status: Review
---

## Overview

The price tables on the home page successfully display market prices (gold, silver, currency), but when users try to create a price alert, those same prices are not available to set as the alert target price. Users cannot create alerts based on the prices they see on the home page, making the price alert feature inconsistent with the displayed market data.

## Error Response

```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "symbol 'Doji_24K' does not match any known price code — use the internal type code (e.g. SJ9999, DOHCML)"
    },
    "timestamp": "2026-04-06T09:02:30Z"
}
```

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-06-fix-price-alert-cannot-use-home-page-prices-spec.md` |
| Plan     | `docs/plans/2026-04-06-fix-price-alert-cannot-use-home-page-prices-plan.md` |
| Progress | `docs/reports/2026-04-06-fix-price-alert-cannot-use-home-page-prices-progress.md` |
| Report   | `docs/reports/2026-04-06-fix-price-alert-cannot-use-home-page-prices-report.md` |
