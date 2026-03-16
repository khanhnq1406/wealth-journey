# Asset Sentiment Survey Generalization Specification

## Summary

Generalize the existing gold-only sentiment survey system into an asset-agnostic sentiment system supporting both gold and silver. Add silver sentiment survey to the prices page silver tab, move gold sentiment survey into the prices page gold tab, and keep both surveys on the landing + dashboard home pages. Also clean up the survey UI by removing vote counts from the summary text and the "comments from" date indicator.

## User Stories

- As a user, I want to vote and comment on silver price sentiment, so that I can see community opinions on silver prices
- As a user, I want to see the gold sentiment survey directly below the gold price table on the prices page, so that price data and community sentiment are co-located
- As a user, I want to see the silver sentiment survey directly below the silver price table on the prices page
- As a user, I want a cleaner survey UI without vote counts in the summary or "comments from" date labels

## Functional Requirements

### FR-1: Generalize Backend to Support Multiple Asset Types

**Description:** Add an `asset_type` column to the existing `gold_vote` and `gold_vote_comment` tables (or rename them to `sentiment_vote` / `sentiment_comment`). Generalize the service, repository, handler, and proto definitions to accept an asset type parameter.

**Acceptance criteria:**
- [ ] Database tables support a `category` column distinguishing gold (0) vs silver (1)
- [ ] Existing gold votes/comments continue to work (backward compatible, default category=0)
- [ ] New silver votes/comments are stored with category=1
- [ ] Separate vote counts and percentages per asset type
- [ ] Separate comment streams per asset type
- [ ] Redis cache keys are scoped per asset type
- [ ] Rate limits apply per-user per-asset-type (1 vote/day/asset, 5 comments/day/asset)

### FR-2: Generalize Proto Definitions

**Description:** Update the proto file to support asset types. Add a `SentimentCategory` enum and thread it through all request/response messages.

**Acceptance criteria:**
- [ ] `SentimentCategory` enum with `GOLD = 0`, `SILVER = 1`
- [ ] All request messages accept a `category` field
- [ ] All response messages include the `category` field
- [ ] Generated TS types and hooks support the category parameter
- [ ] Backward compatible: omitting category defaults to GOLD

### FR-3: Generalize Frontend SentimentCard Component

**Description:** Rename `GoldSentimentCard` to `SentimentCard` and accept an `asset` prop (`"gold" | "silver"`) alongside the existing `variant` prop. The component should pass the asset type to all API calls and display asset-appropriate theming.

**Acceptance criteria:**
- [ ] Component accepts `asset` prop (`"gold" | "silver"`)
- [ ] Gold variant uses existing gold theming (gold spinner, gold ring focus)
- [ ] Silver variant uses silver theming (silver/gray tones)
- [ ] Question text is asset-specific (e.g., "What do you think about Silver prices today?")
- [ ] Each asset has independent vote state and comment stream
- [ ] Anonymous vote IDs are scoped per asset (`gold_vote_anonymous_id`, `silver_vote_anonymous_id`)

### FR-4: Add Sentiment Surveys to Prices Page

**Description:** Place gold sentiment below the gold tab content and silver sentiment below the silver tab content on the `/dashboard/prices` page.

**Acceptance criteria:**
- [ ] Gold sentiment card appears below the gold price table within the gold tab
- [ ] Silver sentiment card appears below the silver price table within the silver tab
- [ ] Cards use the `"home"` variant (full interaction: vote, comment, delete)
- [ ] Cards only render when their tab is active (no unnecessary API calls)

### FR-5: Keep Sentiment on Landing + Home Pages

**Description:** Both gold and silver sentiment surveys should appear on the landing page and dashboard home page.

**Acceptance criteria:**
- [ ] Landing page shows both gold and silver sentiment cards (variant `"landing"`)
- [ ] Dashboard home page shows both gold and silver sentiment cards (variant `"home"`)
- [ ] Cards are visually distinct (gold vs silver theming)

### FR-6: Remove Vote Count from Summary & "Comments From" Date

**Description:** Clean up the survey UI by removing the vote count from the summary text and the "showing comments from {date}" indicator.

**Acceptance criteria:**
- [ ] Summary text shows "Community is bullish" / "Community is bearish" without vote count
- [ ] No "Showing comments from {date}" / "Bình luận từ ngày {date}" text displayed
- [ ] Both EN and VI translations updated
- [ ] Unused helper functions (`isToday`, `formatShortDate`) removed from component
- [ ] Unused `showingOlderComments` derived state removed

## Non-Functional Requirements

- **Performance:** Silver sentiment should not add extra latency to gold sentiment (separate cache keys, parallel API calls)
- **Security:** Same security model as gold (rate limiting, XSS prevention, ownership verification)
- **Backward compatibility:** Existing gold votes/comments must not be lost or corrupted

## Architecture Changes (C4)

### Diagrams to Update

1. **`docs/architecture/c4-component-backend.md`** — Rename `GoldSentimentService` → `SentimentService`, `GoldSentimentHandler` → `SentimentHandler` in the L3 backend component diagram
2. **`docs/architecture/c4-component-frontend.md`** — Rename `GoldSentimentCard` → `SentimentCard`, note it's now used in prices page too

### New Diagrams

None needed — this is a generalization of existing components, not a new bounded context.

## Runtime Flow Diagrams

### Flow Diagrams to Update

1. **`docs/architecture/flow-gold-sentiment.md`** — Rename to `flow-sentiment.md` or update to show the `category` parameter threading through vote/comment flows

### New Flow Diagrams

None needed — same flows, just parameterized by asset type.

## Data Model Changes

### Option A: Add `category` column to existing tables (Recommended — minimal migration)

**`gold_vote` table changes:**
- Add `category INT DEFAULT 0 NOT NULL` column
- Drop and recreate partial unique indexes to include `category`:
  - `idx_vote_user_date` → `UNIQUE(category, user_id, vote_date) WHERE user_id IS NOT NULL`
  - `idx_vote_anon_date` → `UNIQUE(category, anonymous_id, vote_date) WHERE anonymous_id IS NOT NULL`
- Add index on `(category, vote_date)` for efficient count queries

**`gold_vote_comment` table changes:**
- Add `category INT DEFAULT 0 NOT NULL` column
- Update index `idx_gold_vote_comment_date` → include `category`
- Update index `idx_gold_vote_comment_user` → include `category`

**Why not rename tables?** Renaming would require updating all existing queries, GORM model `TableName()` methods, and risk breaking the migration path. Adding a column is simpler and backward compatible — existing data gets `category=0` (gold) by default.

### Model Changes

**`GoldVote` model** — Add `Category int32` field:
```go
Category int32 `gorm:"type:smallint;default:0;not null" json:"category"` // 0=gold, 1=silver
```

**`GoldVoteComment` model** — Add `Category int32` field:
```go
Category int32 `gorm:"type:smallint;default:0;not null" json:"category"` // 0=gold, 1=silver
```

## API Changes

### Proto Changes (`gold_sentiment.proto`)

Add enum:
```protobuf
enum SentimentCategory {
    SENTIMENT_CATEGORY_GOLD = 0;
    SENTIMENT_CATEGORY_SILVER = 1;
}
```

Update all request messages to include `category`:
- `GetGoldSentimentRequest` → add `SentimentCategory category = 1`
- `GetGoldSentimentCommentsRequest` → add `SentimentCategory category = 3`
- `CastGoldVoteRequest` → add `SentimentCategory category = 2`
- `PostGoldSentimentCommentRequest` → add `SentimentCategory category = 2`

Update response messages:
- `GetGoldSentimentResponse` → add `SentimentCategory category = 8`
- `GetGoldSentimentCommentsResponse` → add `SentimentCategory category = 6`

**Note:** Field numbers for new fields must not conflict with existing fields.

### Endpoint Changes

No URL changes needed — the category is passed as a query parameter (GET) or request body field (POST). Existing calls without a category default to GOLD (0).

## UI/UX Changes

### Prices Page (`/dashboard/prices`)

- Gold tab: price table + `<SentimentCard asset="gold" variant="home" />` below
- Silver tab: price table + `<SentimentCard asset="silver" variant="home" />` below

### Landing Page

- Show both `<SentimentCard asset="gold" variant="landing" />` and `<SentimentCard asset="silver" variant="landing" />`

### Dashboard Home

- Show both `<SentimentCard asset="gold" variant="home" />` and `<SentimentCard asset="silver" variant="home" />`

### SentimentCard Theming

| Property | Gold | Silver |
|----------|------|--------|
| Spinner border color | `border-v2-gold-primary` | `border-v2-silver-primary` (or `border-gray-400`) |
| Focus ring | `ring-v2-gold-primary/30` | `ring-v2-silver-primary/30` (or `ring-gray-400/30`) |
| Question text | "What do you think about Gold prices today?" | "What do you think about Silver prices today?" |
| i18n namespace | `goldSentiment` (keep existing) | `silverSentiment` (new) |
| Anonymous ID key | `gold_vote_anonymous_id` | `silver_vote_anonymous_id` |

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Sentiment card | `GoldSentimentCard` → generalize to `SentimentCard` | `components/GoldSentimentCard.tsx` → rename |
| Price tables | `TanStackTable`, `MobileTable` | `components/table/` |
| Card wrapper | `BaseCard` | `components/BaseCard.tsx` |
| Avatar in comments | `Avatar` | `features/community/components/Avatar` |

### New Components

None — this is a generalization of the existing `GoldSentimentCard` into `SentimentCard`.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | Vote (direction, category) | Yes: Internet → App | Sentiment Handler | Same as existing gold flow |
| 2 | Browser | Comment (content, category) | Yes: Internet → App | Sentiment Handler | Same as existing gold flow |
| 3 | Handler | category param | No: within app | Service | New — must validate enum range |
| 4 | Service | vote/comment data | No: within app | PostgreSQL | Category column added |
| 5 | Service | cache key with category | No: within app | Redis | Cache scoped per category |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Vote/comment requests | JWT (optional for votes), rate limiting, input validation |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Tampering | Invalid category value | Low | Server-side enum validation (0 or 1 only) |
| T-2 | 1 | Internet → App | Spoofing | Cross-category vote manipulation | Low | Category scoped in all queries; no cross-contamination possible |

### Authorization Rules

Same as existing gold sentiment:
- Voting: public/anonymous (same model)
- Commenting: authenticated users only
- Deleting comments: own comments only

### Input Validation Rules

- `category` field: must be 0 (GOLD) or 1 (SILVER); default to 0 if omitted
- All existing validation (comment length, XSS escaping) applies per category

### External Dependency Risks

None — no new external dependencies.

### Sensitive Data Handling

No change — same data classification as existing gold sentiment.

### Issues & Risks Summary

1. **Migration risk (Low):** Adding `category` column with DEFAULT 0 is safe; existing data auto-classified as gold
2. **Cache invalidation:** Must ensure silver votes don't invalidate gold cache and vice versa (separate cache keys)
3. **Rate limit scoping:** Rate limits must be per-user per-category, not per-user globally

## Edge Cases & Error Handling

- User votes on gold then silver on same day → both should be allowed (separate categories)
- Anonymous user votes on both gold and silver → separate anonymous IDs per asset
- Old clients sending requests without category → default to gold (backward compatible)
- Cache miss for silver (new, no votes yet) → return zero counts, "No votes yet"

## Dependencies & Assumptions

- Existing gold sentiment feature is stable and production-ready
- No need to rename database tables (add column approach)
- Proto file can be extended without breaking existing clients (additive field addition)
- Tailwind v2 color tokens for silver theming exist (e.g., `v2-silver-primary`, `v2-silver-dark`)

## Out of Scope

- Currency sentiment survey (only gold and silver for now)
- Renaming database tables from `gold_vote` → `sentiment_vote` (deferred — add column is simpler)
- Renaming proto service from `GoldSentimentService` → `SentimentService` (would break existing generated code)
- Renaming backend Go types (keep `GoldVote`, `GoldVoteComment` model names with added `Category` field)
