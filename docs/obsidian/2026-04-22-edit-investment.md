---
type: feature
status: Not Started
---

## Overview

Users cannot edit an investment's core fields (type, symbol, name, currency) after creation. When an investment is created with the wrong type — for example, crypto assets like ETH-USD or SOL-USD saved as stocks — the only way to correct it is a manual database migration. An edit feature would let users fix these mistakes themselves through the UI.

## Implementation Idea — Migration Script Reference

When we migrated investments #47 (ETH-USD) and #48 (SOL-USD) from stock (type=2) to crypto (type=1), these were the affected tables and fields:

```sql
-- 1. Update investment type and scale quantities (4-decimal → 8-decimal precision)
UPDATE investment
SET type = 1,
    quantity = quantity * 10000
WHERE id IN (47, 48);

-- 2. Scale transaction quantities
UPDATE investment_transaction
SET quantity = quantity * 10000,
    remaining_quantity = remaining_quantity * 10000
WHERE investment_id IN (47, 48);

-- 3. Scale lot quantities
UPDATE investment_lot
SET quantity = quantity * 10000,
    remaining_quantity = remaining_quantity * 10000
WHERE investment_id IN (47, 48);
```

**Key insight:** Changing an investment's `type` is not just a field update — different types use different quantity divisors (crypto=100,000,000 / 8 decimals, stock=10,000 / 4 decimals). The edit feature must detect when the type changes and automatically rescale `quantity`, `remaining_quantity` across `investment`, `investment_transaction`, and `investment_lot` tables. The `Recalculate()` method in the model handles `current_value` recomputation based on the new divisor.

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | _(added after step 1)_ |
| Plan     | _(added after step 2)_ |
| Progress | _(added after step 3 starts)_ |
| Report   | _(added after step 3 completes)_ |
