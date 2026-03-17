# Investment User Ownership — Specification

## Summary

Complete the decoupling of investments from wallets by adding direct `UserID` ownership to the `Investment` model and making `WalletID` nullable. Currently, investments require a wallet (via non-null `WalletID` FK), which causes a 400 error when users with no wallets try to create investments. After this change, investments belong directly to users — wallets become optional metadata, not a hard dependency.

## User Stories

- As a new user, I want to create an investment without first creating a wallet, so that I can start tracking my portfolio immediately
- As a user, I want my investments to belong to me directly, so that deleting a wallet doesn't affect my investment records

## Root Cause Analysis

The `POST /api/v1/investments` endpoint returns `400 "please create a wallet first"` when:
1. Frontend sends `walletId: 0` (auto-select mode, hardcoded after wallet decoupling)
2. Backend tries to auto-select a wallet via `walletRepo.ListByUserID()`
3. User has zero wallets → error at `investment_service.go:122`

The recent decoupling (`docs/reports/2026-03-16-decouple-investment-wallet-report.md`) removed wallet balance operations but kept the `WalletID` FK as required. This is incomplete — if wallets don't affect investments, they shouldn't gate investment creation.

## Functional Requirements

### FR-1: Add UserID to Investment Model

**Description:** Add a `UserID int32` field to the `Investment` model with a non-null constraint and index.

**Acceptance criteria:**
- [ ] `Investment` model has `UserID int32` field with `gorm:"not null;index:idx_investment_user"`
- [ ] Database migration adds `user_id` column and backfills from `wallet.user_id`
- [ ] `WalletID` becomes nullable (`*int32` in Go, `gorm:"index:idx_investment_wallet"` without `not null`)
- [ ] Foreign key relationship to `Wallet` uses `constraint:OnDelete:SET NULL`
- [ ] `ToProto()` returns the `UserID` in the response

### FR-2: Update Repository Layer

**Description:** Modify investment repository to use `UserID` for authorization queries instead of JOIN through wallet.

**Acceptance criteria:**
- [ ] `GetByIDForUser` uses `WHERE investment.id = ? AND investment.user_id = ?` (no wallet JOIN)
- [ ] `ListByUserID` uses `WHERE user_id = ?` directly (no wallet subquery)
- [ ] `GetByWalletAndSymbol` becomes `GetByUserAndSymbol(ctx, userID, symbol)` — checks symbol uniqueness per user, not per wallet
- [ ] `GetPortfolioSummary` works with `userID` parameter
- [ ] `GetAggregatedPortfolioSummary` uses `WHERE user_id = ?` directly
- [ ] `ListByWalletID` is kept but becomes optional filter (not primary query path)

### FR-3: Update Service Layer

**Description:** Remove wallet dependency from `CreateInvestment` and all transaction operations.

**Acceptance criteria:**
- [ ] `CreateInvestment` no longer requires `walletId` — sets `UserID` from auth context
- [ ] `CreateInvestment` skips wallet auto-selection entirely when `walletId == 0`
- [ ] If `walletId > 0` is provided, it's stored as optional metadata (verify ownership)
- [ ] Symbol uniqueness check uses `GetByUserAndSymbol` instead of `GetByWalletAndSymbol`
- [ ] Portfolio summary, price updates, and snapshot jobs use `userID`-based queries

### FR-4: Update API Contracts

**Description:** Make `walletId` optional in proto definitions and add `userId` to response messages.

**Acceptance criteria:**
- [ ] `CreateInvestmentRequest.walletId` documented as optional (0 = no wallet)
- [ ] `Investment` proto message includes `userId` field
- [ ] `ListInvestmentsRequest` and `ListUserInvestmentsRequest` continue to support optional `walletId` filter
- [ ] No breaking changes to existing API consumers (walletId still accepted)

### FR-5: Update InvestmentTransaction Model

**Description:** Add `UserID` to `InvestmentTransaction` model for consistent direct ownership.

**Acceptance criteria:**
- [ ] `InvestmentTransaction` has `UserID int32` field
- [ ] `WalletID` becomes nullable in transaction model
- [ ] Transaction queries use `userID` instead of wallet JOIN

### FR-6: Update Portfolio History

**Description:** Portfolio history already has `UserID` — ensure it works without wallet dependency.

**Acceptance criteria:**
- [ ] Aggregated snapshots work when `walletId` is null on investments
- [ ] Historical values API continues to support optional `walletId` filter
- [ ] Snapshot job iterates by user, not by wallet

## Non-Functional Requirements

- **Performance**: Add composite index `(user_id, type)` on investment table for filtered queries
- **Migration safety**: Backfill migration must be idempotent and reversible
- **Backward compatibility**: Existing API consumers sending `walletId` must continue working

## Architecture Changes (C4)

### Diagrams to Update

1. **`docs/architecture/c4-component-backend.md`** — Update `invest_repo` description: queries by `user_id` directly instead of wallet JOIN. Update `invest_svc` description: no wallet dependency for investment CRUD.

2. **`docs/architecture/c4-code-investment.md`** — Update Investment class diagram: add `UserID`, mark `WalletID` as optional.

### New Diagrams

None required — this simplifies existing structure.

## Runtime Flow Diagrams

### Flow Diagrams to Update

1. **`docs/architecture/flow-investment.md`** — Update "Create Investment" flow: remove wallet auto-selection step, add direct `user_id` assignment. Update "Buy Transaction" flow: remove wallet lookup.

## Data Model Changes

### Investment Table

```sql
ALTER TABLE investment ADD COLUMN user_id INT NOT NULL DEFAULT 0;
UPDATE investment SET user_id = (SELECT user_id FROM wallet WHERE wallet.id = investment.wallet_id);
ALTER TABLE investment ALTER COLUMN wallet_id DROP NOT NULL;
CREATE INDEX idx_investment_user ON investment(user_id);
CREATE INDEX idx_investment_user_type ON investment(user_id, type);
```

### InvestmentTransaction Table

```sql
ALTER TABLE investment_transaction ADD COLUMN user_id INT NOT NULL DEFAULT 0;
UPDATE investment_transaction SET user_id = (SELECT user_id FROM wallet WHERE wallet.id = investment_transaction.wallet_id);
ALTER TABLE investment_transaction ALTER COLUMN wallet_id DROP NOT NULL;
CREATE INDEX idx_investment_tx_user ON investment_transaction(user_id);
```

## API Changes

### Modified: `POST /api/v1/investments`

**Request** — `walletId` becomes optional:
```json
{
  "walletId": 0,       // Optional: 0 or omitted = no wallet association
  "symbol": "SJC",
  "name": "SJC Gold",
  "type": 8,
  ...
}
```

**Response** — includes `userId`:
```json
{
  "investment": {
    "id": 1,
    "userId": 42,
    "walletId": 0,      // 0 when no wallet associated
    "symbol": "SJC",
    ...
  }
}
```

### No changes to query endpoints

`ListUserInvestments`, `GetAggregatedPortfolioSummary`, etc. already use `walletId: 0` to mean "all" — this remains the same, but the backend query changes from wallet JOIN to direct `user_id` filter.

## UI/UX Changes

None. The frontend already sends `walletId: 0` and doesn't display wallet associations for investments. This is a backend-only change.

### Existing Component Inventory (REQUIRED)

No new frontend components needed. This is entirely a backend change.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Frontend | CreateInvestmentRequest | Yes: Internet → App | Investment Handler | JWT auth required |
| 2 | Investment Handler | Validated request | No: within backend | Investment Service | Internal call |
| 3 | Investment Service | Investment model | No: within backend | PostgreSQL | Direct DB write |
| 4 | PostgreSQL | Investment with user_id | No: within backend | Investment Service | Query response |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | User requests | JWT auth middleware + user_id from token |
| App → DB | GORM queries | Parameterized queries, user_id filter |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Attacker sends request with different userId | Low | userId comes from JWT token, not request body |
| T-2 | 3 | App → DB | Tampering | Missing user_id in WHERE clause exposes other users' investments | High | All repository queries include user_id filter; code review verification |
| T-3 | 4 | App → DB | Information Disclosure | Migration backfill sets wrong user_id | Medium | Verify with COUNT query after migration |

### Authorization Rules

- `user_id` is ALWAYS extracted from JWT token (middleware), never from request body
- Every investment query MUST include `user_id` filter
- `walletId` if provided, must belong to the authenticated user

### Input Validation Rules

- `walletId`: int32, >= 0 (0 means no wallet). If > 0, verify wallet belongs to user
- `userId`: never accepted from request — always from JWT middleware

### External Dependency Risks

None — this is a database schema + query change only.

### Sensitive Data Handling

No new sensitive data introduced. Financial data (prices, quantities) unchanged.

### Issues & Risks Summary

1. **Migration data integrity**: Must verify all `user_id` values are correctly backfilled before making `wallet_id` nullable
2. **Query authorization**: Every repository method must include `user_id` — missing it would be a security vulnerability
3. **Backward compatibility**: API consumers sending `walletId > 0` must still work

## Edge Cases & Error Handling

1. **User with no wallets creates investment** → Works (wallet not required)
2. **User provides walletId > 0 but doesn't own it** → 403 Forbidden (same as today)
3. **User provides walletId > 0 that doesn't exist** → 404 Not Found
4. **Migration: investment with deleted wallet** → Use `wallet.user_id` from soft-deleted wallet for backfill
5. **Symbol uniqueness**: Now per-user instead of per-wallet — if user has same symbol in different wallets, migration must handle duplicates

## Dependencies & Assumptions

- The wallet decoupling (`docs/reports/2026-03-16-decouple-investment-wallet-report.md`) is complete and deployed
- All wallet balance operations are already removed from investment flows
- PostgreSQL supports `ALTER COLUMN ... DROP NOT NULL` without table rewrite

## Out of Scope

- Removing `WalletID` entirely from the model (kept as optional metadata)
- Frontend wallet association UI (investments are wallet-agnostic in the UI)
- Portfolio history `WalletID` changes (it already has `UserID`)
