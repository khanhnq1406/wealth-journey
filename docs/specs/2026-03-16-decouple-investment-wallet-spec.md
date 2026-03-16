# Decouple Investment from Wallet Selection — Specification

## Summary

Simplify the investment and wallet experience by removing wallet selection from the investment creation flow, removing cash balance validation for investments, removing wallet type selection during wallet creation (defaulting to BASIC), and removing wallet-related UI elements from the portfolio page. Investments will be auto-assigned to the user's oldest wallet internally while the database schema remains unchanged.

## User Stories

- As a user, I want to add investments without choosing a wallet, so the process is simpler and faster.
- As a user, I want to create a wallet without picking a type, so I don't have to understand wallet categories.
- As a user, I want to view my portfolio without wallet filters or cash balance cards, so I can focus on my investments.

## Functional Requirements

### FR-1: Remove Wallet Selection from Investment Creation

**Description:** When creating an investment, the user should not see a wallet selector. The backend auto-assigns the investment to the user's oldest active wallet.

**Acceptance criteria:**
- [ ] AddInvestmentForm no longer shows a wallet dropdown
- [ ] Backend auto-selects the user's oldest active wallet when `walletId` is 0 or omitted
- [ ] If user has no wallets, return a clear error message
- [ ] Existing investments retain their current `walletId` (no data migration needed for investments)

### FR-2: Remove Cash Balance Validation for Investments

**Description:** The backend should not check wallet balance before creating an investment. Users can create investments regardless of wallet cash balance.

**Acceptance criteria:**
- [ ] Remove balance sufficiency check in `CreateInvestment` service
- [ ] Remove balance deduction when creating an investment
- [ ] Remove balance restoration when deleting an investment
- [ ] Remove FX conversion for balance check
- [ ] AddInvestmentForm no longer displays "Available Cash" or validates against wallet balance

### FR-3: Default Wallet Type to BASIC

**Description:** When creating a wallet, always default the type to BASIC. Remove the wallet type selector from the UI.

**Acceptance criteria:**
- [ ] CreateWalletForm no longer shows a wallet type dropdown
- [ ] New wallets are always created with `type = BASIC (0)`
- [ ] Existing INVESTMENT wallets are migrated to BASIC via database migration
- [ ] Backend CreateWallet ignores the `type` field in the request (always sets BASIC)

### FR-4: Remove Wallet Filter from Portfolio Page

**Description:** The portfolio page should always show the aggregated view across all investments. Remove the wallet filter dropdown.

**Acceptance criteria:**
- [ ] Portfolio page removes the wallet selector dropdown
- [ ] Portfolio always calls `GetAggregatedPortfolioSummary` (never per-wallet summary)
- [ ] `ListUserInvestments` is always called with `walletId = 0` (all investments)
- [ ] Historical portfolio values always show aggregated data

### FR-5: Remove WalletCashBalanceCard from Portfolio Page

**Description:** Remove the cash balance display from the portfolio page since investments are no longer coupled to wallet balances.

**Acceptance criteria:**
- [ ] WalletCashBalanceCard is not rendered on the portfolio page
- [ ] Portfolio page layout adjusts to fill the space formerly occupied by the card

### FR-6: Remove Investment-Specific Wallet Enrichment

**Description:** Wallet responses no longer need `investmentValue`, `displayInvestmentValue`, `totalValue`, `displayTotalValue` fields since wallets and investments are decoupled.

**Acceptance criteria:**
- [ ] Wallet service no longer calculates investment values per wallet
- [ ] `getInvestmentValueInWalletCurrency` is removed or no longer called in wallet enrichment
- [ ] `GetInvestmentValuesByWalletIDs` is removed or deprecated
- [ ] Wallet API responses return `investmentValue` and `totalValue` as 0 (proto fields kept for backward compatibility but not populated)
- [ ] Frontend wallet displays no longer show investment-related values

### FR-7: Remove Wallet Type Validation in Investment Service

**Description:** The investment service should not check if a wallet is of type INVESTMENT before allowing investment creation.

**Acceptance criteria:**
- [ ] Remove `WalletType_INVESTMENT` check in `CreateInvestment`
- [ ] Investments can be created in any wallet type
- [ ] `ListInvestmentWallets` method updated to return all active wallets (not filtered by type)

## Non-Functional Requirements

- **Performance:** No performance regression — removing validation and enrichment logic should slightly improve wallet listing and investment creation performance.
- **Backward Compatibility:** Proto fields for `walletId` on Investment and `investmentValue`/`totalValue` on Wallet remain in the schema but are either auto-populated (walletId) or zeroed out (investment values on wallet). No proto field removals.
- **Migration Safety:** Database migration only changes wallet types (UPDATE SET type=0 WHERE type=1). No column additions/removals. Reversible.

## Architecture Changes (C4)

### Diagrams to Update

1. **`docs/architecture/c4-component-backend.md`** — Update the Investment Service component description to note that wallet selection is automatic, not user-driven. Remove the dependency arrow from Investment Service to "Wallet Type Validation."

2. **`docs/architecture/c4-component-frontend.md`** — Update the Portfolio Page component to remove wallet filter and cash balance card. Update AddInvestmentForm to note wallet selection is removed.

### New Diagrams

No new L4 code diagrams needed — this simplifies existing architecture rather than adding new domain complexity.

## Runtime Flow Diagrams

### Flow Diagrams to Update

1. **`docs/architecture/flow-investment.md`** — Update the "Create Investment" sequence diagram:
   - Remove wallet type validation step
   - Remove balance check and deduction steps
   - Add auto-wallet-selection step (pick oldest active wallet when walletId=0)
   - Simplify the flow significantly

2. **`docs/architecture/flow-wallet.md`** — Update "Create Wallet" flow:
   - Remove wallet type selection (always BASIC)
   - Simplify the sequence

### New Flow Diagrams

None needed.

## Data Model Changes

### Database Migration

```sql
-- Convert all INVESTMENT wallets to BASIC
UPDATE wallet SET type = 0 WHERE type = 1 AND deleted_at IS NULL;
```

No schema changes (no column additions/removals). The `WalletType` enum value `INVESTMENT (1)` remains in proto but is no longer used.

### Models Unchanged

- `Investment.WalletID` — kept as-is, auto-populated by backend
- `InvestmentTransaction.WalletID` — kept as-is
- `PortfolioHistory.WalletID` — kept as-is
- `Wallet.Type` — kept in schema, always set to BASIC for new wallets

## API Changes

### Modified Behavior (No Proto Schema Changes)

| Endpoint | Current | After |
|----------|---------|-------|
| `POST /api/v1/investments` | Requires `walletId`, validates wallet type & balance | `walletId` optional (0 = auto-assign), no type/balance validation |
| `POST /api/v1/wallets` | Accepts `type` field | Ignores `type` field, always creates BASIC |
| `GET /api/v1/wallets` | Enriches INVESTMENT wallets with investment values | No investment value enrichment on any wallet |
| `GET /api/v1/wallets/{id}` | Returns `investmentValue`, `totalValue` for INVESTMENT wallets | Returns 0 for `investmentValue`, `totalValue` on all wallets |

### Endpoints Unchanged

- All `ListUserInvestments`, `GetAggregatedPortfolioSummary`, `GetHistoricalPortfolioValues` — already support user-level aggregation.
- All investment transaction endpoints — unchanged (they reference investmentId, not walletId directly).

## UI/UX Changes

### Portfolio Page (`app/[locale]/dashboard/portfolio/page.tsx`)

**Remove:**
- Wallet filter dropdown (was used to select specific investment wallet)
- WalletCashBalanceCard component rendering
- Wallet-related state management (`selectedWallet`, `walletIdForApi`, etc.)
- "No investment wallets" empty state (since all wallets can hold investments now, and investments are user-level)

**Keep:**
- Investment type filter (stocks, crypto, gold, etc.)
- Period selector for PnL
- PortfolioSummaryEnhanced component (already wallet-agnostic)
- Investment list and detail modals
- Historical portfolio chart

### AddInvestmentForm (`features/investment/forms/AddInvestmentForm.tsx`)

**Remove:**
- Wallet selector dropdown
- Available cash balance display
- Wallet balance validation logic
- `walletId`, `walletBalance`, `walletCurrency` props (or make optional with no UI)

**Keep:**
- Symbol autocomplete
- Investment type selection
- Quantity and cost inputs
- Gold/silver special handling
- All other form fields

### CreateWalletForm (`features/wallet/forms/CreateWalletForm.tsx`)

**Remove:**
- Wallet type dropdown (BASIC/INVESTMENT selector)
- `defaultType` prop handling

**Keep:**
- Wallet name input
- Initial balance input
- Currency selector
- All validation

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Portfolio summary display | PortfolioSummaryEnhanced | `app/[locale]/dashboard/portfolio/components/` |
| Investment list | InvestmentList (within page) | `app/[locale]/dashboard/portfolio/page.tsx` |
| Investment form | AddInvestmentForm | `features/investment/forms/` |
| Wallet creation | CreateWalletForm | `features/wallet/forms/` |
| Type filter | Already exists in portfolio page | `app/[locale]/dashboard/portfolio/page.tsx` |

### New Components

None — this feature only removes/simplifies existing components.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | CreateInvestmentRequest (no walletId) | Yes: Internet → App | Investment Handler | walletId auto-assigned server-side |
| 2 | Investment Handler | Auto-selected walletId | No: internal | Investment Service | Service picks oldest user wallet |
| 3 | Investment Service | Wallet lookup query | No: internal | Wallet Repository | Filters by authenticated userID |
| 4 | Browser | CreateWalletRequest (no type) | Yes: Internet → App | Wallet Handler | Type forced to BASIC server-side |
| 5 | DB Migration | UPDATE wallet SET type=0 | No: internal | PostgreSQL | One-time migration |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | User requests (#1, #4) | JWT authentication + middleware |
| App → Database | Auto-wallet selection (#3) | Parameterized queries, user ownership check |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Attacker sends walletId belonging to another user | Medium | Auto-assign ignores user-provided walletId; backend always picks from authenticated user's wallets |
| T-2 | 1 | Internet → App | Tampering | Attacker manipulates request to create investment in someone else's wallet | Medium | Backend uses authenticated userID to find wallets; cannot cross user boundary |
| T-3 | 2 | Internal | Elevation of Privilege | Auto-assignment picks wrong wallet | Low | Query filters by userID with parameterized query; wallet ownership guaranteed |
| T-4 | 4 | Internet → App | Tampering | Client sends type=INVESTMENT hoping to create investment wallet | Low | Backend ignores type field, always sets BASIC |

### Authorization Rules

- **Investment creation:** Backend verifies the auto-selected wallet belongs to the authenticated user via `wallet.user_id = authenticated_user_id`
- **Wallet creation:** Only authenticated users can create wallets for themselves
- **No change** to existing authorization for read/update/delete operations

### Input Validation Rules

| Field | Validation | Location |
|-------|-----------|----------|
| `walletId` in CreateInvestment | If 0 or missing: auto-assign. If provided: verify ownership (existing behavior) | Backend service |
| `type` in CreateWallet | Ignored — always set to BASIC | Backend service |
| All other fields | Unchanged | Existing validators |

### External Dependency Risks

None — this feature removes complexity rather than adding external dependencies.

### Sensitive Data Handling

No changes to sensitive data handling. Monetary values continue to use `int64` in smallest currency units.

### Issues & Risks Summary

1. **Risk: Auto-assignment picks unexpected wallet** — Mitigated by using oldest active wallet (deterministic, predictable). User can see which wallet is used if they check investment details.
2. **Risk: Backward compatibility** — Proto fields kept but behavior changes. Clients expecting `investmentValue` on wallet responses will get 0. Mobile clients or API consumers need to be aware.
3. **Risk: Migration rollback** — If INVESTMENT wallet type is needed again, migration is reversible (`UPDATE wallet SET type=1 WHERE ...`), but would need to know which wallets were originally INVESTMENT type. Consider logging affected wallet IDs before migration.

## Edge Cases & Error Handling

| Edge Case | Handling |
|-----------|----------|
| User has no wallets | Return clear error: "Please create a wallet first" |
| User has only soft-deleted wallets | Same as "no wallets" — query filters `deleted_at IS NULL` |
| All wallets have 0 balance | No issue — balance check is removed |
| User sends `walletId` in request | Accept it if valid and owned by user (backward compatible). If 0, auto-assign. |
| Duplicate symbol check | Currently per-wallet (`wallet_id + symbol` unique). With auto-assignment, this still works — investments in the auto-assigned wallet can't have duplicate symbols. |
| Existing INVESTMENT wallets after migration | Converted to BASIC. Their investments remain (walletId FK unchanged). |
| Multiple wallets with same currency | Oldest wallet is picked. User doesn't control this but it's deterministic. |

## Dependencies & Assumptions

- **Assumption:** Every user has at least one wallet. The app's onboarding flow creates a default wallet.
- **Assumption:** The oldest wallet (by `created_at ASC`) is a reasonable default for auto-assignment.
- **Dependency:** Database migration must run before deploying the code changes (to convert INVESTMENT wallets to BASIC).
- **No new external dependencies.**

## Out of Scope

- **Portfolio grouping/tagging:** Future feature to group investments by custom tags (not wallets).
- **Moving investments between wallets:** Not needed since wallet selection is hidden.
- **Removing `walletId` from Investment model:** Database schema stays the same; only behavior changes.
- **Removing `WalletType` enum from proto:** Kept for future use (user mentioned potential new wallet types).
- **Removing wallet-scoped portfolio history:** `PortfolioHistory.WalletID` stays in DB; snapshots continue to work but are less meaningful now.
- **API versioning:** No new API version; behavior changes are backward-compatible enough.
