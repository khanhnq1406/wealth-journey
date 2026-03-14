# Gold Sentiment Vote & Comments Specification

## Summary

Add a daily community sentiment voting section for gold prices, inspired by CoinGecko's "How do you feel about X today?" feature. Users can vote bullish (up) or bearish (down) on today's gold price direction, and leave comments about their sentiment. The section appears on both the landing page (public, read-only with login CTA) and the dashboard home page (full interaction). Votes reset daily at midnight Vietnam time (UTC+7).

## User Stories

- As a **visitor** (unauthenticated), I want to see today's community gold sentiment (bullish/bearish %) and 1 recent comment, so that I get a sense of community opinion and am motivated to sign up.
- As a **logged-in user**, I want to vote bullish or bearish on today's gold price, so that I can share my market outlook.
- As a **logged-in user**, I want to comment on today's gold sentiment, so that I can explain my reasoning to the community.
- As a **logged-in user**, I want to see all community comments for today's vote, so that I can learn from others' perspectives.
- As a **logged-in user**, I want to change my vote within the same day, so that I can update my outlook if new information emerges.

## Functional Requirements

### FR-1: Daily Gold Sentiment Vote

Users can vote once per day on gold price direction.

**Acceptance criteria:**
- [ ] Question displayed: "Ban nghi gia Vang hom nay se nhu the nao?" (Vietnamese, with i18n support)
- [ ] Two voting options: Bullish (green up arrow) and Bearish (red down arrow)
- [ ] Vote results shown as percentages (e.g., 73% bullish, 27% bearish) with styled badges
- [ ] Total vote count displayed
- [ ] One vote per user per day (UNIQUE constraint on user_id + vote_date)
- [ ] User can change their vote within the same day (upsert behavior)
- [ ] Votes reset at midnight UTC+7 (Vietnam timezone) — new day = new vote
- [ ] After voting, user's selected option is highlighted
- [ ] Vote date uses Vietnam timezone (UTC+7) for consistency

### FR-2: Public Sentiment Display (Landing Page)

Unauthenticated visitors can see vote results but cannot interact.

**Acceptance criteria:**
- [ ] Show bullish/bearish percentages (read-only)
- [ ] Show total vote count
- [ ] Show 1 most recent comment with user name and avatar
- [ ] Second comment slot shows blurred/overlay with "Dang nhap de xem them" and login button
- [ ] Voting buttons show "Dang nhap de binh chon" tooltip/message when clicked by unauthenticated user
- [ ] Comment input hidden for unauthenticated users

### FR-3: Authenticated Sentiment Interaction (Home Page)

Logged-in users can vote and comment.

**Acceptance criteria:**
- [ ] Vote buttons are interactive (can click to vote)
- [ ] After voting, selected button is highlighted with filled style
- [ ] Comment input field below vote results
- [ ] Comments list shows all today's comments (paginated, newest first)
- [ ] Each comment shows: user avatar, user name, comment text, timestamp
- [ ] Comment input: max 500 characters, with character count
- [ ] Submit button disabled when comment is empty or mutation is pending
- [ ] Success feedback after posting comment

### FR-4: Comment Management

Basic comment features for the daily vote thread.

**Acceptance criteria:**
- [ ] Users can delete their own comments
- [ ] No threading/replies (flat comment list — keep it simple)
- [ ] No editing (simplicity — delete and repost)
- [ ] Comments are tied to a specific vote_date
- [ ] Pagination: 10 comments per page, load more button

## Non-Functional Requirements

- **Performance**: Public endpoints cached in Redis for 30 seconds to handle landing page traffic. Vote counts and percentages computed server-side with Redis caching.
- **Security**: Server-side validation for all writes. Rate limiting on vote and comment endpoints. Comment content sanitized (no HTML/script injection).
- **Scalability**: Indexed queries on vote_date for efficient daily lookups. Comment pagination to limit response size.
- **i18n**: All UI strings use next-intl translation keys (Vietnamese + English).

## Architecture Changes (C4)

### Diagrams to Update

1. **`c4-component-backend.md`** — Add `GoldSentimentHandler`, `GoldSentimentService`, `GoldVoteRepository`, `GoldVoteCommentRepository` components to the backend component diagram.
2. **`c4-component-frontend.md`** — Add `GoldSentimentCard` shared component, update Landing Page and Home Page to show dependency on it.

### New Diagrams

No new L4 code diagram needed — this is a simple 2-model domain, not complex enough for a class diagram.

## Runtime Flow Diagrams

### Flow Diagrams to Create

Add to `docs/architecture/flow-gold-sentiment.md`:

1. **Cast Vote flow** (`sequenceDiagram`): User -> Handler -> Service -> Repository (upsert vote, update cached counts) -> Response with updated percentages
2. **Get Sentiment flow** (`sequenceDiagram`): Client -> Handler -> Redis cache check -> Service -> Repository (if cache miss) -> Response with percentages + total + user's vote
3. **Post Comment flow** (`sequenceDiagram`): User -> Handler -> Service -> Repository (insert comment) -> Response

## Data Model Changes

### New Table: `gold_vote`

```sql
CREATE TABLE gold_vote (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES "user"(id),
    vote_date   DATE NOT NULL,                        -- YYYY-MM-DD in UTC+7
    direction   SMALLINT NOT NULL,                     -- 1=BULLISH, 2=BEARISH
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, vote_date)
);

CREATE INDEX idx_gold_vote_date ON gold_vote(vote_date);
CREATE INDEX idx_gold_vote_user_date ON gold_vote(user_id, vote_date);
```

### New Table: `gold_vote_comment`

```sql
CREATE TABLE gold_vote_comment (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES "user"(id),
    vote_date   DATE NOT NULL,                        -- YYYY-MM-DD in UTC+7
    content     TEXT NOT NULL,                          -- max 500 chars enforced in app
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,                           -- soft delete
    CONSTRAINT chk_content_length CHECK (char_length(content) <= 500)
);

CREATE INDEX idx_gold_vote_comment_date ON gold_vote_comment(vote_date);
CREATE INDEX idx_gold_vote_comment_user ON gold_vote_comment(user_id);
```

### GORM Models

```go
// GoldVote represents a user's daily gold sentiment vote
type GoldVote struct {
    ID        int32     `gorm:"primaryKey;autoIncrement"`
    UserID    int32     `gorm:"not null;uniqueIndex:idx_gold_vote_unique,priority:1"`
    VoteDate  time.Time `gorm:"type:date;not null;uniqueIndex:idx_gold_vote_unique,priority:2;index:idx_gold_vote_date"`
    Direction int32     `gorm:"type:smallint;not null"` // 1=BULLISH, 2=BEARISH
    CreatedAt time.Time
    UpdatedAt time.Time
    User      *User     `gorm:"foreignKey:UserID"`
}

// GoldVoteComment represents a comment on a daily gold sentiment thread
type GoldVoteComment struct {
    ID        int32          `gorm:"primaryKey;autoIncrement"`
    UserID    int32          `gorm:"not null;index:idx_gold_vote_comment_user"`
    VoteDate  time.Time      `gorm:"type:date;not null;index:idx_gold_vote_comment_date"`
    Content   string         `gorm:"type:text;not null"`
    CreatedAt time.Time
    DeletedAt gorm.DeletedAt `gorm:"index"`
    User      *User          `gorm:"foreignKey:UserID"`
}
```

## API Changes

### Proto Additions (in `investment.proto` or new `gold_sentiment.proto`)

New file: `api/protobuf/v1/gold_sentiment.proto`

```protobuf
syntax = "proto3";
package wealthjourney.v1;

import "google/api/annotations.proto";

// Vote direction enum
enum VoteDirection {
    VOTE_DIRECTION_UNSPECIFIED = 0;
    VOTE_DIRECTION_BULLISH = 1;
    VOTE_DIRECTION_BEARISH = 2;
}

// === Public Endpoints ===

message GetGoldSentimentRequest {}

message GetGoldSentimentResponse {
    int32 bullish_count = 1;
    int32 bearish_count = 2;
    int32 total_votes = 3;
    double bullish_percentage = 4;    // 0-100
    double bearish_percentage = 5;    // 0-100
    string vote_date = 6;            // YYYY-MM-DD
    VoteDirection user_vote = 7;      // Current user's vote (UNSPECIFIED if not voted or not authenticated)
}

message GetGoldSentimentCommentsRequest {
    int32 page = 1;
    int32 page_size = 2;             // default 10, max 50
}

message GoldSentimentCommentItem {
    int32 id = 1;
    int32 user_id = 2;
    string user_name = 3;
    string user_picture = 4;
    string content = 5;
    int64 created_at = 6;            // Unix timestamp
    bool is_own_comment = 7;
    VoteDirection user_vote_direction = 8;  // What did this commenter vote?
}

message GetGoldSentimentCommentsResponse {
    repeated GoldSentimentCommentItem comments = 1;
    int32 total_count = 2;
    int32 page = 3;
    int32 page_size = 4;
}

// === Authenticated Endpoints ===

message CastGoldVoteRequest {
    VoteDirection direction = 1;      // BULLISH or BEARISH
}

message CastGoldVoteResponse {
    VoteDirection direction = 1;
    int32 bullish_count = 2;
    int32 bearish_count = 3;
    int32 total_votes = 4;
    double bullish_percentage = 5;
    double bearish_percentage = 6;
}

message PostGoldSentimentCommentRequest {
    string content = 1;               // max 500 chars
}

message PostGoldSentimentCommentResponse {
    GoldSentimentCommentItem comment = 1;
}

message DeleteGoldSentimentCommentRequest {
    int32 comment_id = 1;
}

message DeleteGoldSentimentCommentResponse {}

service GoldSentimentService {
    // Public: Get today's sentiment (no auth required, optionally returns user's vote if authenticated)
    rpc GetGoldSentiment(GetGoldSentimentRequest) returns (GetGoldSentimentResponse) {
        option (google.api.http) = {
            get: "/api/v1/public/gold-sentiment"
        };
    }

    // Public: Get today's comments
    rpc GetGoldSentimentComments(GetGoldSentimentCommentsRequest) returns (GetGoldSentimentCommentsResponse) {
        option (google.api.http) = {
            get: "/api/v1/public/gold-sentiment/comments"
        };
    }

    // Auth: Cast or update vote
    rpc CastGoldVote(CastGoldVoteRequest) returns (CastGoldVoteResponse) {
        option (google.api.http) = {
            post: "/api/v1/gold-sentiment/vote"
            body: "*"
        };
    }

    // Auth: Post a comment
    rpc PostGoldSentimentComment(PostGoldSentimentCommentRequest) returns (PostGoldSentimentCommentResponse) {
        option (google.api.http) = {
            post: "/api/v1/gold-sentiment/comments"
            body: "*"
        };
    }

    // Auth: Delete own comment
    rpc DeleteGoldSentimentComment(DeleteGoldSentimentCommentRequest) returns (DeleteGoldSentimentCommentResponse) {
        option (google.api.http) = {
            delete: "/api/v1/gold-sentiment/comments/{comment_id}"
        };
    }
}
```

### REST Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/public/gold-sentiment` | No | Get today's vote percentages (+ user's vote if token present) |
| `GET` | `/api/v1/public/gold-sentiment/comments` | No | Get today's comments (paginated) |
| `POST` | `/api/v1/gold-sentiment/vote` | Yes | Cast or update today's vote |
| `POST` | `/api/v1/gold-sentiment/comments` | Yes | Post a comment on today's thread |
| `DELETE` | `/api/v1/gold-sentiment/comments/:id` | Yes | Delete own comment |

## UI/UX Changes

### GoldSentimentCard Component

A shared component used on both landing page and home page, adapting based on auth state.

**Mobile-first design** (responsive with `sm:` breakpoint at 800px).

#### Layout (Mobile)

```
┌────────────────────────────────────┐
│  Ban nghi gia Vang hom nay         │
│  se nhu the nao?                   │
│                                    │
│  ┌──────────┐  ┌──────────┐       │
│  │ 🚀 73%   │  │ 📉 27%   │       │
│  │ Tang      │  │ Giam     │       │
│  └──────────┘  └──────────┘       │
│                                    │
│  Cong dong dang lac quan (325 vote)│
│                                    │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                    │
│  ┌────────────────────────────┐    │
│  │ 🔼 Nguyen Van A  ·  2p    │    │
│  │ Vang se tang vi Fed giu   │    │
│  │ lai suat...                │    │
│  └────────────────────────────┘    │
│                                    │
│  [LANDING PAGE ONLY:]              │
│  ┌────────────────────────────┐    │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░ │    │
│  │ ░░ Dang nhap de xem them ░│    │
│  │ ░░    [Dang nhap]        ░│    │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░ │    │
│  └────────────────────────────┘    │
│                                    │
│  [HOME PAGE ONLY:]                 │
│  ┌────────────────────────────┐    │
│  │ 🔽 Tran Van B  ·  5p      │    │
│  │ Thi truong co ve tieu     │    │
│  │ cuc...                     │    │
│  └────────────────────────────┘    │
│  ... more comments ...             │
│  [Xem them binh luan]             │
│                                    │
│  [HOME PAGE ONLY:]                 │
│  ┌────────────────────────────┐    │
│  │ Viet binh luan...    [Gui]│    │
│  └────────────────────────────┘    │
└────────────────────────────────────┘
```

#### Visual Design

- **Card**: White background, rounded corners, subtle shadow (matches `BaseCard` pattern)
- **Vote buttons**: Pill-shaped badges
  - Bullish: Green background (`#10B981` / emerald-500), white text, up arrow icon
  - Bearish: Red background (`#EF4444` / red-500), white text, down arrow icon
  - Selected state: Filled with darker shade + ring/outline
  - Unselected: Light background with colored text
- **Percentage text**: Bold, inside the badge
- **Sentiment summary**: Light gray text below vote buttons ("Cong dong dang lac quan")
- **Comments**: Simple list with avatar (32px circle), name, relative time, content
- **Comment with vote indicator**: Small up/down arrow icon next to username showing what they voted
- **Login CTA**: Blurred overlay on 2nd comment with centered button

#### Desktop Layout (sm: 800px+)

Same card layout but wider, potentially in a full-width container below the price tables grid.

### Landing Page Integration

Add `<GoldSentimentCard variant="landing" />` below the currency table, above `<LandingFooter />`.

### Home Page Integration

Add `<GoldSentimentCard variant="home" />` below the price tables section, above the wallets section.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | Vote direction (enum) | Yes: Internet -> App | GoldSentiment Handler | Untrusted input, validate enum |
| 2 | User (browser) | Comment text (string) | Yes: Internet -> App | GoldSentiment Handler | Untrusted input, sanitize XSS |
| 3 | Handler | Validated vote | No (same tier) | GoldSentiment Service | Internal |
| 4 | Handler | Validated comment | No (same tier) | GoldSentiment Service | Internal |
| 5 | Service | Vote record | Yes: App -> DB | PostgreSQL (gold_vote) | Parameterized GORM query |
| 6 | Service | Comment record | Yes: App -> DB | PostgreSQL (gold_vote_comment) | Parameterized GORM query |
| 7 | Service | Vote counts | Yes: App -> Cache | Redis | Cache invalidation on vote |
| 8 | Redis | Cached counts | Yes: Cache -> App | Service | Validate cached data types |
| 9 | Public endpoint | Sentiment + comments | Yes: App -> Internet | User (browser) | No sensitive data exposed |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet -> Application | Vote/Comment requests | JWT auth (write endpoints), input validation, rate limiting |
| Application -> Database | GORM queries | Parameterized queries, user ownership checks |
| Application -> Redis | Cache read/write | Key prefixing, TTL expiration |
| Application -> Internet | Public responses | No PII beyond display name + avatar URL |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet -> App | Spoofing | Unauthenticated user votes | Medium | JWT required for POST /vote |
| T-2 | 1 | Internet -> App | Tampering | Invalid vote direction value | Low | Validate enum server-side (only 1 or 2) |
| T-3 | 2 | Internet -> App | Tampering | XSS in comment content | High | HTML-escape content server-side, CSP headers |
| T-4 | 2 | Internet -> App | DoS | Spam comments/votes | Medium | Rate limiting: 1 vote/day, 5 comments/day per user |
| T-5 | 5 | App -> DB | Tampering | SQL injection | Low | GORM parameterized queries (mitigated by default) |
| T-6 | 9 | App -> Internet | Info Disclosure | User email/ID exposed in public comments | Medium | Only expose display name + avatar URL, never email |
| T-7 | 2 | Internet -> App | Repudiation | User denies posting comment | Low | CreatedAt timestamp + user_id audit trail |
| T-8 | 1 | Internet -> App | Elevation | User votes multiple times per day | Medium | UNIQUE constraint + upsert logic |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated |
|-----------|-------|------------|-----------------|
| View sentiment | Yes | Yes | Yes (public) |
| View comments | Yes | Yes | Yes (public, paginated) |
| Cast vote | Yes | N/A | No (401) |
| Post comment | Yes | N/A | No (401) |
| Delete comment | Yes (own only) | No (403) | No (401) |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| `direction` | enum (int32) | Must be 1 (BULLISH) or 2 (BEARISH) | Required, validate against enum values |
| `content` | string | 1-500 characters, no empty | Required, trim whitespace, check length, HTML-escape |
| `comment_id` | int32 | Must exist, must be owned by user | Required, verify ownership |
| `page` | int32 | >= 1, default 1 | Optional, default 1 |
| `page_size` | int32 | 1-50, default 10 | Optional, clamp to range |

### External Dependency Risks

No new external dependencies. This feature uses only existing PostgreSQL and Redis.

### Sensitive Data Handling

| Data Field | Sensitivity | Protection |
|------------|------------|-----------|
| user_id (internal) | Internal | Never exposed in public API responses |
| user email | Confidential | Never exposed — only name + picture shown |
| vote direction | Public | Aggregated percentages shown publicly |
| comment content | Public | Shown publicly with author name |

### Issues & Risks Summary

1. **Comment spam** — Mitigated by rate limiting (5 comments/day per user) and content length limit
2. **Vote manipulation** — Mitigated by UNIQUE constraint per user per day; cannot create fake accounts easily (Google OAuth)
3. **XSS via comments** — Mitigated by server-side HTML escaping and React's default escaping
4. **PII leakage** — Only display name and avatar URL exposed; email and user_id never in public responses

## Edge Cases & Error Handling

| Edge Case | Handling |
|-----------|---------|
| User votes then changes mind | Upsert: update existing vote for today |
| No votes yet today (first visitor) | Show 0% / 0% with "Be the first to vote!" message |
| Midnight rollover while user is on page | Frontend polls/refreshes; new day = fresh counts |
| User deletes only their comment | Soft delete; comment disappears from list |
| Very long comment (>500 chars) | Server rejects with validation error; frontend prevents input beyond 500 |
| Concurrent votes from same user | UNIQUE constraint prevents duplicates; upsert handles race |
| Landing page with no comments | Show "No comments yet" with login CTA |
| Redis cache miss | Fallback to DB query, populate cache |

## Dependencies & Assumptions

- **Google OAuth** — Only way to register, limits bot/fake account creation
- **Existing Redis** — Used for caching vote counts (30s TTL)
- **Existing User model** — Comments reference User for name + picture
- **Vietnam timezone (UTC+7)** — Vote date calculated server-side using UTC+7
- **next-intl** — Already set up for i18n translations

## Out of Scope

- Voting on silver or other assets (can be generalized later)
- Comment threading/replies
- Comment likes/reactions
- Comment editing
- Real-time updates via WebSocket/SSE (polling or manual refresh for v1)
- Admin moderation panel for comments
- Reporting abusive comments (can reuse community `ReportContent` later)
- Historical sentiment charts (showing past days' sentiment trends)
