---
type: bug
status: Spec
---

## Overview

The gold, silver, and currency tabs on the prices page always show regardless of admin asset display config. Additionally, price items shown in those tabs have wrong display names, wrong type_codes, and wrong sort order — currency always shows empty. Root cause: `GetMarketPrices` reads from `asset_price` using config `type_code` as filter, but prices are stored under fetch `type_code` (e.g. `"USD"` vs `"USD_VCB"`), bypassing the correct `AssetDisplayConfigService.GetDisplayPrices()` resolution path.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/2026-04-09-fix-prices-tabs-asset-display-config-spec.md` |
| Plan     | _(added after step 2)_ |
| Progress | _(added after step 3 starts)_ |
| Report   | _(added after step 3 completes)_ |
