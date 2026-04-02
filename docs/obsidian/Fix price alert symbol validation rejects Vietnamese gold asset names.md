---
type: bug
status: Not Started
---

## Overview

When a user creates a price alert for a Vietnamese gold asset (assetType 8), the backend rejects the request with a validation error because the symbol field contains Vietnamese characters. This prevents users from setting price alerts on gold assets entirely.

## Details

Occurs when submitting a price alert with a symbol like "Vàng nhẫn SJC" (Vietnamese gold asset name) and assetType 8 (gold).

Expected: Price alert is created successfully for gold assets, which use descriptive Vietnamese names as their symbol identifiers.

Actual: Returns VALIDATION_ERROR — "symbol must contain only alphanumeric characters, dots, dashes, or underscores" — blocking the creation of any gold price alert with a Vietnamese symbol name.

Sample failing request:
- symbol: "Vàng nhẫn SJC"
- assetType: 8 (gold)
- currency: VND
