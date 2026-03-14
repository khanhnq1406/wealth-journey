# Gold Sentiment Domain — Runtime Flows

Daily gold sentiment voting and commenting flows. Public GET endpoints support optional auth for user-specific data. Protected write endpoints require JWT authentication.

## Table of Contents

- [Cast Vote](#1-cast-vote)
- [Get Sentiment](#2-get-sentiment)
- [Post Comment](#3-post-comment)

---

## 1. Cast Vote

**Trigger:** User (authenticated or anonymous) clicks bullish or bearish vote button
**Endpoint:** `POST /api/v1/public/gold-sentiment/vote`
**Source:** `domain/service/gold_sentiment_service.go`, `handlers/gold_sentiment.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as GoldSentimentHandler
    participant GS as GoldSentimentService
    participant VR as GoldVoteRepository
    participant R as Redis

    SPA->>H: POST /api/v1/public/gold-sentiment/vote<br/>{direction: 1|2}<br/>Headers: Authorization (optional), X-Anonymous-ID (optional)
    H->>H: tryGetUserID (optional auth)
    H->>H: Read X-Anonymous-ID header
    H->>H: BindAndValidate request body
    H->>GS: CastVote(userID, anonymousID, req)

    activate GS
    GS->>GS: Validate direction (must be 1 or 2)
    alt Invalid direction
        GS-->>H: 400 Validation Error
        H-->>SPA: {success: false, message: "invalid vote direction"}
    end

    GS->>GS: getTodayVietnam() → UTC+7 date

    alt userID > 0 (Authenticated)
        alt anonymousID provided
            GS->>VR: DeleteByAnonymousIDAndDate(anonymousID, today)
            Note over VR: Remove anonymous vote from same device
        end
        GS->>VR: Upsert(GoldVote{userID, voteDate, direction})
        Note over VR: ON CONFLICT (user_id, vote_date)<br/>WHERE user_id IS NOT NULL<br/>DO UPDATE SET direction
    else Anonymous
        alt No anonymousID or invalid
            GS->>GS: Generate new UUID
        end
        GS->>VR: UpsertAnonymous(GoldVote{anonymousID, voteDate, direction})
        Note over VR: ON CONFLICT (anonymous_id, vote_date)<br/>WHERE anonymous_id IS NOT NULL<br/>DO UPDATE SET direction
    end

    alt DB error
        VR-->>GS: Error
        GS-->>H: 500 Internal Error
        H-->>SPA: {success: false, message: "..."}
    end
    VR-->>GS: OK

    GS->>R: Delete("gold_sentiment:{date}")
    Note over R: Invalidate cached counts

    GS->>VR: CountByDate(voteDate)
    VR-->>GS: bullish, bearish counts
    GS->>GS: computePercentages(bullish, bearish)
    deactivate GS

    GS-->>H: CastGoldVoteResponse
    H-->>SPA: {success: true, direction, counts, percentages, anonymousId}
    Note over SPA: If anonymousId present,<br/>save to localStorage
```

**Key Invariants:**
- Direction must be 1 (BULLISH) or 2 (BEARISH); 0 (UNSPECIFIED) is rejected
- Public endpoint — no auth required, supports both authenticated and anonymous votes
- Authenticated users: 1 vote/day via UNIQUE partial index `(user_id, vote_date) WHERE user_id IS NOT NULL`
- Anonymous users: 1 vote/day per UUID via UNIQUE partial index `(anonymous_id, vote_date) WHERE anonymous_id IS NOT NULL`
- When authenticated user votes, any anonymous vote from same device (same `X-Anonymous-ID`) is deleted
- Vote date calculated in Vietnam timezone (UTC+7)
- Redis cache invalidated after every vote to ensure fresh counts
- Anonymous ID validated as UUID format (36 chars, regex)

**Error Paths:**

| Condition | Response | Rollback |
|-----------|----------|----------|
| Direction = 0 or > 2 | 400 Validation Error | None |
| DB upsert failure | 500 Internal Error | None |

---

## 2. Get Sentiment

**Trigger:** Page loads gold sentiment card (landing or dashboard)
**Endpoint:** `GET /api/v1/public/gold-sentiment`
**Source:** `domain/service/gold_sentiment_service.go`, `handlers/gold_sentiment.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as GoldSentimentHandler
    participant GS as GoldSentimentService
    participant R as Redis
    participant VR as GoldVoteRepository

    SPA->>H: GET /api/v1/public/gold-sentiment<br/>Headers: Authorization (optional), X-Anonymous-ID (optional)
    H->>H: tryGetUserID(optional auth)
    H->>H: Read X-Anonymous-ID header
    Note over H: Extract bearer token if present<br/>Verify via AuthService<br/>Return 0 if no token or invalid
    H->>GS: GetSentiment(ctx, userID, anonymousID)

    activate GS
    GS->>GS: getTodayVietnam() → UTC+7 date
    GS->>R: Get("gold_sentiment:{date}")

    alt Cache hit
        R-->>GS: Cached {bullish, bearish, total, percentages}
    else Cache miss
        R-->>GS: nil
        GS->>VR: CountByDate(voteDate)
        VR-->>GS: bullish, bearish counts
        GS->>GS: computePercentages(bullish, bearish)
        GS->>R: Set("gold_sentiment:{date}", data, 30s TTL)
    end

    alt userID > 0 (Authenticated)
        GS->>VR: GetByUserAndDate(userID, voteDate)
        alt Vote found
            VR-->>GS: GoldVote{direction}
        else No vote
            VR-->>GS: nil (userVote = 0)
        end
    else anonymousID present
        GS->>VR: GetByAnonymousIDAndDate(anonymousID, voteDate)
        alt Vote found
            VR-->>GS: GoldVote{direction}
        else No vote
            VR-->>GS: nil (userVote = 0)
        end
    end
    deactivate GS

    GS-->>H: GetGoldSentimentResponse
    H-->>SPA: {success: true, counts, percentages, userVote}
```

**Key Invariants:**
- Public endpoint — no auth required, but auth or `X-Anonymous-ID` is attempted for `userVote` field
- Redis cache with 30s TTL prevents excessive DB queries
- `userVote` populated from auth (user_id lookup) or anonymous ID (anonymous_id lookup)
- `userVote` is 0 (UNSPECIFIED) when neither authenticated nor anonymous ID present, or no vote exists
- Cache stores only aggregate counts, not per-user data

**Error Paths:**

| Condition | Response | Rollback |
|-----------|----------|----------|
| Redis unavailable | Falls through to DB | None |
| DB query failure | 500 Internal Error | None |
| Invalid auth token | userID = 0, continues without user vote | None |

---

## 3. Post Comment

**Trigger:** Authenticated user submits a comment on dashboard home
**Endpoint:** `POST /api/v1/gold-sentiment/comments`
**Source:** `domain/service/gold_sentiment_service.go`, `handlers/gold_sentiment.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as GoldSentimentHandler
    participant GS as GoldSentimentService
    participant CR as GoldVoteCommentRepository

    SPA->>H: POST /api/v1/gold-sentiment/comments<br/>{content: "..."}
    H->>H: GetUserID from JWT
    H->>H: BindAndValidate request body
    H->>GS: PostComment(userID, req)

    activate GS
    GS->>GS: strings.TrimSpace(content)
    GS->>GS: Validate length (1-500 chars)
    alt Empty or too long
        GS-->>H: 400 Validation Error
        H-->>SPA: {success: false, message: "..."}
    end

    GS->>GS: html.EscapeString(content)
    Note over GS: XSS prevention server-side

    GS->>GS: getTodayVietnam() → UTC+7 date
    GS->>CR: CountByUserAndDate(userID, voteDate)
    CR-->>GS: dailyCount

    alt dailyCount >= 5
        GS-->>H: 429 Rate Limit Error
        H-->>SPA: {success: false, message: "daily limit reached"}
    end

    GS->>CR: Create(GoldVoteComment{userID, voteDate, content})
    alt DB error
        CR-->>GS: Error
        GS-->>H: 500 Internal Error
        H-->>SPA: {success: false, message: "..."}
    end
    CR-->>GS: Created comment

    GS->>CR: Preload("User") on created comment
    deactivate GS

    GS-->>H: PostGoldSentimentCommentResponse
    H-->>SPA: {success: true, comment: CommentItem}
```

**Key Invariants:**
- Content trimmed, validated (1-500 chars), and HTML-escaped server-side
- Rate limit: 5 comments per user per day (enforced in service layer)
- Comment date matches today's vote date (Vietnam TZ)
- User info preloaded for response (avatar, name)
- No `dangerouslySetInnerHTML` on frontend — all content rendered as text nodes

**Error Paths:**

| Condition | Response | Rollback |
|-----------|----------|----------|
| Missing/invalid JWT | 401 Unauthorized | None |
| Empty content after trim | 400 Validation Error | None |
| Content > 500 chars | 400 Validation Error | None |
| Daily limit (5) exceeded | 429 Rate Limit Error | None |
| DB write failure | 500 Internal Error | None |
