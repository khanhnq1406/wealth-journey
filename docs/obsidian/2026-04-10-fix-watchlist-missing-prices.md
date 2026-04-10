---
type: bug
status: Review
---

## Overview

Some watchlist items show N/A for price despite being successfully added. The API response for items like "USD Tự Do" (assetType 13), "Eximbank" (assetType 8), and "SJC Mi Hồng" (assetType 8) returns no currentPrice, buyPrice, or sellPrice fields, while other items like "Bitcoin USD" and "Nhẫn Mi Hồng 9999" return prices correctly.

### API Response

{
"success": true,
"message": "Watchlist retrieved successfully",
"items": [
{
"id": 10,
"symbol": "USD",
"name": "USD Tự Do",
"assetType": 13,
"currency": "VND",
"createdAt": "1774337358"
},
{
"id": 7,
"symbol": "BTC-USD",
"name": "Bitcoin USD",
"assetType": 1,
"currency": "USD",
"sortOrder": 1,
"currentPrice": "7165394",
"buyPrice": "7165394",
"sellPrice": "7165394",
"createdAt": "1774333503"
},
{
"id": 9,
"symbol": "Eximbank",
"name": "Eximbank",
"assetType": 8,
"currency": "VND",
"sortOrder": 2,
"createdAt": "1774336551"
},
{
"id": 12,
"symbol": "Mihong_999",
"name": "Nhẫn Mi Hồng 9999",
"assetType": 8,
"currency": "VND",
"sortOrder": 4,
"currentPrice": "170700000",
"buyPrice": "170700000",
"sellPrice": "172700000",
"createdAt": "1775810100"
},
{
"id": 13,
"symbol": "Mi hồng",
"name": "SJC Mi Hồng",
"assetType": 8,
"currency": "VND",
"sortOrder": 5,
"createdAt": "1775810119"
}
],
"total": 5,
"timestamp": "1775810153"
}

## Pipeline Artifacts

| Artifact | File                             |
| -------- | -------------------------------- |
| Spec     | `docs/specs/2026-04-10-fix-watchlist-missing-prices-spec.md` |
| Plan     | `docs/plans/2026-04-10-fix-watchlist-missing-prices-plan.md` |
| Progress | `docs/reports/2026-04-10-fix-watchlist-missing-prices-progress.md` |
| Report   | `docs/reports/2026-04-10-fix-watchlist-missing-prices-report.md` |
