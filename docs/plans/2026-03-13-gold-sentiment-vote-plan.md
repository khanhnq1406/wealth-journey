# Gold Sentiment Vote & Comments — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add daily community sentiment voting on gold prices with comments — public read-only on landing page, full interaction on dashboard home page.

**Spec:** `docs/specs/2026-03-13-gold-sentiment-vote-spec.md`

**Architecture:** New proto file (`gold_sentiment.proto`), 2 GORM models, 2 repositories, 1 service, 1 handler, 1 shared React component with `variant` prop for landing/home pages. Public endpoints (no auth) for reads, protected endpoints for writes. Redis caching for vote counts (30s TTL).

**Tech Stack:** Go 1.23, Gin, GORM, PostgreSQL, Redis, Protocol Buffers, Next.js 15, React 19, TypeScript, Tailwind CSS, React Query

## Security Implementation Notes

- **Authentication:** Public GET endpoints require no auth. Write endpoints (vote, comment, delete) require JWT via `AuthMiddleware`. The `GetGoldSentiment` endpoint uses _optional_ auth (try to extract user from token if present, but don't reject if missing) to return `user_vote` field.
- **Authorization:** Users can only delete their own comments (verify `user_id` matches). Vote upsert is scoped to authenticated `user_id`.
- **Input validation:** Server-side validation for: direction enum (must be 1 or 2), comment content (1-500 chars, trimmed, HTML-escaped), comment_id ownership, pagination bounds.
- **Rate limiting:** IP-based rate limiting on public endpoints. User-based rate limiting on protected endpoints. Application-level: 1 vote/day (enforced by UNIQUE constraint), 5 comments/day per user (enforced in service layer).
- **Data sanitization:** Comment content HTML-escaped server-side using `html.EscapeString()`. React's default JSX escaping provides double protection on frontend.
- **XSS prevention:** No `dangerouslySetInnerHTML` used. All user content rendered as text nodes.

## C4 Architecture Diagram Updates

- **Modify:** `docs/architecture/c4-component-backend.md` — Add `GoldSentimentHandler`, `GoldSentimentService`, `GoldVoteRepository`, `GoldVoteCommentRepository` components
- **Modify:** `docs/architecture/c4-component-frontend.md` — Add `GoldSentimentCard` shared component, update Landing Page and Home Page dependencies

## Runtime Flow Diagrams

- **Create:** `docs/architecture/flow-gold-sentiment.md` — Cast Vote flow, Get Sentiment flow, Post Comment flow (all as `sequenceDiagram`)
- **Update:** `docs/architecture/README.md` — Add flow-gold-sentiment.md to Dynamic Behavior Diagrams table

---

### Task 1: Create Protobuf Definitions

**Files:**
- Create: `api/protobuf/v1/gold_sentiment.proto`

**Security notes:** Enum validation — `VOTE_DIRECTION_UNSPECIFIED (0)` must be rejected server-side for write operations.

**Step 1: Create the proto file**

```protobuf
syntax = "proto3";

package wealthjourney.v1;

option go_package = "wealthjourney/protobuf/v1;v1";

import "google/api/annotations.proto";

enum VoteDirection {
    VOTE_DIRECTION_UNSPECIFIED = 0;
    VOTE_DIRECTION_BULLISH = 1;
    VOTE_DIRECTION_BEARISH = 2;
}

message GetGoldSentimentRequest {}

message GetGoldSentimentResponse {
    int32 bullish_count = 1 [json_name = "bullishCount"];
    int32 bearish_count = 2 [json_name = "bearishCount"];
    int32 total_votes = 3 [json_name = "totalVotes"];
    double bullish_percentage = 4 [json_name = "bullishPercentage"];
    double bearish_percentage = 5 [json_name = "bearishPercentage"];
    string vote_date = 6 [json_name = "voteDate"];
    VoteDirection user_vote = 7 [json_name = "userVote"];
}

message GetGoldSentimentCommentsRequest {
    int32 page = 1 [json_name = "page"];
    int32 page_size = 2 [json_name = "pageSize"];
}

message GoldSentimentCommentItem {
    int32 id = 1 [json_name = "id"];
    int32 user_id = 2 [json_name = "userId"];
    string user_name = 3 [json_name = "userName"];
    string user_picture = 4 [json_name = "userPicture"];
    string content = 5 [json_name = "content"];
    int64 created_at = 6 [json_name = "createdAt"];
    bool is_own_comment = 7 [json_name = "isOwnComment"];
    VoteDirection user_vote_direction = 8 [json_name = "userVoteDirection"];
}

message GetGoldSentimentCommentsResponse {
    repeated GoldSentimentCommentItem comments = 1 [json_name = "comments"];
    int32 total_count = 2 [json_name = "totalCount"];
    int32 page = 3 [json_name = "page"];
    int32 page_size = 4 [json_name = "pageSize"];
}

message CastGoldVoteRequest {
    VoteDirection direction = 1 [json_name = "direction"];
}

message CastGoldVoteResponse {
    VoteDirection direction = 1 [json_name = "direction"];
    int32 bullish_count = 2 [json_name = "bullishCount"];
    int32 bearish_count = 3 [json_name = "bearishCount"];
    int32 total_votes = 4 [json_name = "totalVotes"];
    double bullish_percentage = 5 [json_name = "bullishPercentage"];
    double bearish_percentage = 6 [json_name = "bearishPercentage"];
}

message PostGoldSentimentCommentRequest {
    string content = 1 [json_name = "content"];
}

message PostGoldSentimentCommentResponse {
    GoldSentimentCommentItem comment = 1 [json_name = "comment"];
}

message DeleteGoldSentimentCommentRequest {
    int32 comment_id = 1 [json_name = "commentId"];
}

message DeleteGoldSentimentCommentResponse {}

service GoldSentimentService {
    rpc GetGoldSentiment(GetGoldSentimentRequest) returns (GetGoldSentimentResponse) {
        option (google.api.http) = {
            get: "/api/v1/public/gold-sentiment"
        };
    }

    rpc GetGoldSentimentComments(GetGoldSentimentCommentsRequest) returns (GetGoldSentimentCommentsResponse) {
        option (google.api.http) = {
            get: "/api/v1/public/gold-sentiment/comments"
        };
    }

    rpc CastGoldVote(CastGoldVoteRequest) returns (CastGoldVoteResponse) {
        option (google.api.http) = {
            post: "/api/v1/gold-sentiment/vote"
            body: "*"
        };
    }

    rpc PostGoldSentimentComment(PostGoldSentimentCommentRequest) returns (PostGoldSentimentCommentResponse) {
        option (google.api.http) = {
            post: "/api/v1/gold-sentiment/comments"
            body: "*"
        };
    }

    rpc DeleteGoldSentimentComment(DeleteGoldSentimentCommentRequest) returns (DeleteGoldSentimentCommentResponse) {
        option (google.api.http) = {
            delete: "/api/v1/gold-sentiment/comments/{comment_id}"
        };
    }
}
```

**Step 2: Generate code**

```bash
task proto:all
```

Verify Go and TypeScript code generated successfully.

**Step 3: Commit**

```
feat(proto): add gold_sentiment.proto for daily vote & comments

Define VoteDirection enum, sentiment/comment messages, and 5 RPC endpoints
(2 public reads, 3 authenticated writes).
```

---

### Task 2: Create Database Models & Migration

**Files:**
- Create: `src/go-backend/domain/models/gold_vote.go`
- Create: `src/go-backend/domain/models/gold_vote_comment.go`
- Create: `src/go-backend/cmd/migrate-gold-sentiment/main.go`
- Modify: `Taskfile.yml` — add migration task

**Security notes:** UNIQUE constraint on `(user_id, vote_date)` prevents duplicate votes. DB-level CHECK constraint on comment content length.

**Step 1: Create GoldVote model**

```go
// src/go-backend/domain/models/gold_vote.go
package models

import "time"

type GoldVote struct {
    ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
    UserID    int32     `gorm:"not null;uniqueIndex:idx_gold_vote_user_date,priority:1" json:"userId"`
    VoteDate  time.Time `gorm:"type:date;not null;uniqueIndex:idx_gold_vote_user_date,priority:2;index:idx_gold_vote_date" json:"voteDate"`
    Direction int32     `gorm:"type:smallint;not null" json:"direction"` // 1=BULLISH, 2=BEARISH
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
    User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (GoldVote) TableName() string {
    return "gold_vote"
}
```

**Step 2: Create GoldVoteComment model**

```go
// src/go-backend/domain/models/gold_vote_comment.go
package models

import (
    "time"
    "gorm.io/gorm"
)

type GoldVoteComment struct {
    ID        int32          `gorm:"primaryKey;autoIncrement" json:"id"`
    UserID    int32          `gorm:"not null;index:idx_gold_vote_comment_user" json:"userId"`
    VoteDate  time.Time      `gorm:"type:date;not null;index:idx_gold_vote_comment_date" json:"voteDate"`
    Content   string         `gorm:"type:text;not null" json:"content"`
    CreatedAt time.Time      `json:"createdAt"`
    DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
    User      *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (GoldVoteComment) TableName() string {
    return "gold_vote_comment"
}
```

**Step 3: Create migration command**

```go
// src/go-backend/cmd/migrate-gold-sentiment/main.go
package main

import (
    "fmt"
    "log"

    "wealthjourney/domain/models"
    "wealthjourney/pkg/config"
    "wealthjourney/pkg/database"

    "gorm.io/gorm"
)

func main() {
    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("Failed to load config: %v", err)
    }

    db, err := database.New(cfg)
    if err != nil {
        log.Fatalf("Failed to connect to database: %v", err)
    }
    defer func() { _ = db.Close() }()

    if err := migrateGoldSentiment(db.DB); err != nil {
        log.Fatalf("Migration failed: %v", err)
    }

    log.Println("Gold sentiment migration completed successfully!")
}

func migrateGoldSentiment(db *gorm.DB) error {
    log.Println("Creating gold_vote table...")
    if err := db.AutoMigrate(&models.GoldVote{}); err != nil {
        return fmt.Errorf("failed to create gold_vote table: %w", err)
    }

    log.Println("Creating gold_vote_comment table...")
    if err := db.AutoMigrate(&models.GoldVoteComment{}); err != nil {
        return fmt.Errorf("failed to create gold_vote_comment table: %w", err)
    }

    // Add CHECK constraint for comment content length
    if err := db.Exec(`
        DO $$ BEGIN
            ALTER TABLE gold_vote_comment
            ADD CONSTRAINT chk_content_length CHECK (char_length(content) <= 500);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    `).Error; err != nil {
        log.Printf("Warning: failed to add content length constraint: %v", err)
    }

    log.Println("Gold sentiment tables created successfully")
    return nil
}
```

**Step 4: Add Taskfile entry**

Add to `Taskfile.yml`:
```yaml
  backend:migrate-gold-sentiment:
    desc: "Create gold_vote and gold_vote_comment tables"
    dir: "{{.BACKEND_DIR}}"
    cmds:
      - go run ./cmd/migrate-gold-sentiment
```

**Step 5: Run migration**

```bash
task backend:migrate-gold-sentiment
```

**Step 6: Commit**

```
feat(db): add gold_vote and gold_vote_comment tables

Two new tables for daily gold sentiment voting with UNIQUE constraint
on (user_id, vote_date) and CHECK constraint on comment length (500 chars).
```

---

### Task 3: Create Repository Layer

**Files:**
- Create: `src/go-backend/domain/repository/gold_vote_repository.go`
- Create: `src/go-backend/domain/repository/gold_vote_comment_repository.go`
- Modify: `src/go-backend/domain/repository/interfaces.go` — add interfaces
- Modify: `src/go-backend/domain/service/services.go` — add to Repositories struct
- Modify: `src/go-backend/internal/app/providers.go` — wire repos

**Security notes:** All queries scoped by `user_id` for authorization. Parameterized GORM queries only.

**Step 1: Add repository interfaces to `interfaces.go`**

```go
// GoldVoteRepository handles gold sentiment vote persistence.
type GoldVoteRepository interface {
    Upsert(ctx context.Context, vote *models.GoldVote) error
    GetByUserAndDate(ctx context.Context, userID int32, voteDate time.Time) (*models.GoldVote, error)
    CountByDate(ctx context.Context, voteDate time.Time) (bullish int32, bearish int32, err error)
}

// GoldVoteCommentRepository handles gold sentiment comment persistence.
type GoldVoteCommentRepository interface {
    Create(ctx context.Context, comment *models.GoldVoteComment) error
    GetByID(ctx context.Context, id int32) (*models.GoldVoteComment, error)
    ListByDate(ctx context.Context, voteDate time.Time, limit, offset int) ([]*models.GoldVoteComment, int, error)
    Delete(ctx context.Context, id int32) error
    CountByUserAndDate(ctx context.Context, userID int32, voteDate time.Time) (int, error)
}
```

**Step 2: Implement GoldVoteRepository**

```go
// src/go-backend/domain/repository/gold_vote_repository.go
package repository

import (
    "context"
    "time"

    "wealthjourney/domain/models"
    "wealthjourney/pkg/database"

    "gorm.io/gorm/clause"
)

type goldVoteRepository struct {
    *BaseRepository
}

func NewGoldVoteRepository(db *database.Database) GoldVoteRepository {
    return &goldVoteRepository{
        BaseRepository: NewBaseRepository(db),
    }
}

func (r *goldVoteRepository) Upsert(ctx context.Context, vote *models.GoldVote) error {
    result := r.db.DB.WithContext(ctx).
        Clauses(clause.OnConflict{
            Columns:   []clause.Column{{Name: "user_id"}, {Name: "vote_date"}},
            DoUpdates: clause.AssignmentColumns([]string{"direction", "updated_at"}),
        }).
        Create(vote)
    if result.Error != nil {
        return r.handleDBError(result.Error, "gold_vote", "upsert vote")
    }
    return nil
}

func (r *goldVoteRepository) GetByUserAndDate(ctx context.Context, userID int32, voteDate time.Time) (*models.GoldVote, error) {
    var vote models.GoldVote
    result := r.db.DB.WithContext(ctx).
        Where("user_id = ? AND vote_date = ?", userID, voteDate).
        First(&vote)
    if result.Error != nil {
        return nil, r.handleDBError(result.Error, "gold_vote", "get vote")
    }
    return &vote, nil
}

func (r *goldVoteRepository) CountByDate(ctx context.Context, voteDate time.Time) (bullish int32, bearish int32, err error) {
    type countResult struct {
        Direction int32
        Count     int32
    }
    var results []countResult

    err = r.db.DB.WithContext(ctx).
        Model(&models.GoldVote{}).
        Select("direction, count(*) as count").
        Where("vote_date = ?", voteDate).
        Group("direction").
        Scan(&results).Error
    if err != nil {
        return 0, 0, err
    }

    for _, r := range results {
        switch r.Direction {
        case 1: // BULLISH
            bullish = r.Count
        case 2: // BEARISH
            bearish = r.Count
        }
    }
    return bullish, bearish, nil
}
```

**Step 3: Implement GoldVoteCommentRepository**

```go
// src/go-backend/domain/repository/gold_vote_comment_repository.go
package repository

import (
    "context"
    "time"

    "wealthjourney/domain/models"
    apperrors "wealthjourney/pkg/errors"
    "wealthjourney/pkg/database"
)

type goldVoteCommentRepository struct {
    *BaseRepository
}

func NewGoldVoteCommentRepository(db *database.Database) GoldVoteCommentRepository {
    return &goldVoteCommentRepository{
        BaseRepository: NewBaseRepository(db),
    }
}

func (r *goldVoteCommentRepository) Create(ctx context.Context, comment *models.GoldVoteComment) error {
    result := r.db.DB.WithContext(ctx).Create(comment)
    if result.Error != nil {
        return r.handleDBError(result.Error, "gold_vote_comment", "create comment")
    }
    return nil
}

func (r *goldVoteCommentRepository) GetByID(ctx context.Context, id int32) (*models.GoldVoteComment, error) {
    var comment models.GoldVoteComment
    result := r.db.DB.WithContext(ctx).First(&comment, id)
    if result.Error != nil {
        return nil, r.handleDBError(result.Error, "gold_vote_comment", "get comment")
    }
    return &comment, nil
}

func (r *goldVoteCommentRepository) ListByDate(ctx context.Context, voteDate time.Time, limit, offset int) ([]*models.GoldVoteComment, int, error) {
    var comments []*models.GoldVoteComment
    var total int64

    baseQuery := r.db.DB.WithContext(ctx).
        Model(&models.GoldVoteComment{}).
        Where("vote_date = ?", voteDate)

    if err := baseQuery.Count(&total).Error; err != nil {
        return nil, 0, apperrors.NewInternalErrorWithCause("failed to count comments", err)
    }

    result := r.db.DB.WithContext(ctx).
        Where("vote_date = ?", voteDate).
        Preload("User").
        Order("created_at DESC").
        Limit(limit).
        Offset(offset).
        Find(&comments)

    if result.Error != nil {
        return nil, 0, apperrors.NewInternalErrorWithCause("failed to list comments", result.Error)
    }

    return comments, int(total), nil
}

func (r *goldVoteCommentRepository) Delete(ctx context.Context, id int32) error {
    result := r.db.DB.WithContext(ctx).Delete(&models.GoldVoteComment{}, id)
    if result.Error != nil {
        return r.handleDBError(result.Error, "gold_vote_comment", "delete comment")
    }
    if result.RowsAffected == 0 {
        return apperrors.NewNotFoundError("comment")
    }
    return nil
}

func (r *goldVoteCommentRepository) CountByUserAndDate(ctx context.Context, userID int32, voteDate time.Time) (int, error) {
    var count int64
    err := r.db.DB.WithContext(ctx).
        Model(&models.GoldVoteComment{}).
        Where("user_id = ? AND vote_date = ?", userID, voteDate).
        Count(&count).Error
    if err != nil {
        return 0, apperrors.NewInternalErrorWithCause("failed to count user comments", err)
    }
    return int(count), nil
}
```

**Step 4: Add to Repositories struct in `services.go`**

Add fields:
```go
GoldVote        repository.GoldVoteRepository
GoldVoteComment repository.GoldVoteCommentRepository
```

**Step 5: Wire in `providers.go`**

Add to `ProvideRepositories`:
```go
GoldVote:        repository.NewGoldVoteRepository(db),
GoldVoteComment: repository.NewGoldVoteCommentRepository(db),
```

**Step 6: Commit**

```
feat(repo): add GoldVote and GoldVoteComment repositories

Includes upsert for daily vote (ON CONFLICT), paginated comment listing
with user preload, and daily comment count for rate limiting.
```

---

### Task 4: Create Service Layer

**Files:**
- Create: `src/go-backend/domain/service/gold_sentiment_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go` — add interface
- Modify: `src/go-backend/domain/service/services.go` — add to Services struct and wire

**Security notes:** Server-side validation for all inputs. HTML-escape comment content. Rate limit: 5 comments/day per user. Vietnam timezone (UTC+7) for vote date calculation.

**Step 1: Add service interface to `interfaces.go`**

```go
// GoldSentimentService handles daily gold sentiment voting and comments.
type GoldSentimentService interface {
    // GetSentiment returns today's vote counts and percentages, optionally with user's vote.
    GetSentiment(ctx context.Context, userID int32) (*v1.GetGoldSentimentResponse, error)
    // CastVote creates or updates a user's vote for today.
    CastVote(ctx context.Context, userID int32, req *v1.CastGoldVoteRequest) (*v1.CastGoldVoteResponse, error)
    // GetComments returns paginated comments for today.
    GetComments(ctx context.Context, userID int32, req *v1.GetGoldSentimentCommentsRequest) (*v1.GetGoldSentimentCommentsResponse, error)
    // PostComment creates a comment for today's vote thread.
    PostComment(ctx context.Context, userID int32, req *v1.PostGoldSentimentCommentRequest) (*v1.PostGoldSentimentCommentResponse, error)
    // DeleteComment deletes a user's own comment.
    DeleteComment(ctx context.Context, userID int32, commentID int32) error
}
```

**Step 2: Implement service**

Key implementation details:
- `getTodayVietnam()` helper: `time.Now().In(time.FixedZone("UTC+7", 7*60*60))` truncated to date
- `GetSentiment`: Check Redis cache first (`gold_sentiment:{date}` key, 30s TTL). On miss, query DB, compute percentages, cache result. If `userID > 0`, also query user's vote.
- `CastVote`: Validate direction (must be 1 or 2). Upsert vote. Invalidate Redis cache. Return updated counts.
- `PostComment`: Validate content (1-500 chars, trimmed). Check daily limit (5). HTML-escape content. Create comment. Return with user info.
- `DeleteComment`: Verify ownership (`comment.UserID == userID`). Soft delete.
- Percentages: `bullishPct = float64(bullish) / float64(total) * 100` (handle total=0 → 0%)

**Step 3: Add to Services struct and wire**

In `services.go`:
```go
// Add field
GoldSentiment GoldSentimentService

// In NewServices(), Phase 1 (no service dependencies):
goldSentimentSvc := NewGoldSentimentService(repos.GoldVote, repos.GoldVoteComment, repos.User, redisClient)

// Add to return
GoldSentiment: goldSentimentSvc,
```

**Step 4: Commit**

```
feat(service): add GoldSentimentService with vote upsert, comments, Redis caching

Implements daily gold sentiment with Vietnam timezone (UTC+7), 30s Redis
cache for vote counts, 5 comments/day rate limit, and HTML content escaping.
```

---

### Task 5: Create Handler & Routes

**Files:**
- Create: `src/go-backend/handlers/gold_sentiment.go`
- Modify: `src/go-backend/handlers/builder.go` — add to AllHandlers + NewHandlers
- Modify: `src/go-backend/handlers/routes.go` — register routes (public + protected)

**Security notes:** Public endpoints use `OptionalAuthMiddleware` to extract user ID if token is present (for `user_vote` field) without rejecting unauthenticated requests. Protected endpoints use `AuthMiddleware`.

**Step 1: Create handler**

```go
// src/go-backend/handlers/gold_sentiment.go
package handlers

// GoldSentimentHandler handles gold sentiment voting and comments.
type GoldSentimentHandler struct {
    service service.GoldSentimentService
    authSrv *auth.Server
}

func NewGoldSentimentHandler(svc service.GoldSentimentService, authSrv *auth.Server) *GoldSentimentHandler {
    return &GoldSentimentHandler{service: svc, authSrv: authSrv}
}
```

Handler methods:

- `GetGoldSentiment(c *gin.Context)` — Try to extract user ID from optional auth header (don't reject if missing). Call `service.GetSentiment(ctx, userID)`. Return JSON.
- `GetGoldSentimentComments(c *gin.Context)` — Parse `page` and `page_size` query params with defaults (1, 10). Try optional auth for `is_own_comment`. Call service. Return JSON.
- `CastGoldVote(c *gin.Context)` — Require auth. Bind JSON request. Call service. Return JSON with updated counts.
- `PostGoldSentimentComment(c *gin.Context)` — Require auth. Bind JSON request. Call service. Return JSON.
- `DeleteGoldSentimentComment(c *gin.Context)` — Require auth. Parse `comment_id` from URL param. Call service. Return JSON.

Optional auth helper for public endpoints:
```go
func (h *GoldSentimentHandler) tryGetUserID(c *gin.Context) int32 {
    authHeader := c.GetHeader("Authorization")
    if authHeader == "" {
        return 0
    }
    token := strings.TrimPrefix(authHeader, "Bearer ")
    if token == authHeader {
        return 0
    }
    result, err := h.authSrv.VerifyAuth(token)
    if err != nil {
        return 0
    }
    return result.Data.Id
}
```

**Step 2: Wire in `builder.go`**

Add to `AllHandlers`:
```go
GoldSentiment *GoldSentimentHandler
```

Add to `NewHandlers`:
```go
GoldSentiment: NewGoldSentimentHandler(services.GoldSentiment, deps.AuthSrv),
```

**Step 3: Register routes in `routes.go`**

```go
// Gold Sentiment — Public routes (no auth, optional auth for user_vote)
goldSentimentPublic := v1.Group("/public/gold-sentiment")
if rateLimiter != nil {
    goldSentimentPublic.Use(appmiddleware.RateLimitByIP(rateLimiter))
}
{
    goldSentimentPublic.GET("", h.GoldSentiment.GetGoldSentiment)
    goldSentimentPublic.GET("/comments", h.GoldSentiment.GetGoldSentimentComments)
}

// Gold Sentiment — Protected routes (auth required)
goldSentiment := v1.Group("/gold-sentiment")
if rateLimiter != nil {
    goldSentiment.Use(appmiddleware.RateLimitByUser(rateLimiter))
}
goldSentiment.Use(AuthMiddleware(authSrv))
{
    goldSentiment.POST("/vote", h.GoldSentiment.CastGoldVote)
    goldSentiment.POST("/comments", h.GoldSentiment.PostGoldSentimentComment)
    goldSentiment.DELETE("/comments/:comment_id", h.GoldSentiment.DeleteGoldSentimentComment)
}
```

**Step 4: Commit**

```
feat(api): add gold sentiment handler with public + protected routes

Public GET endpoints with optional auth for user_vote field.
Protected POST/DELETE endpoints for voting and commenting.
```

---

### Task 6: Generate Frontend API Hooks

**Files:**
- Regenerate: `src/wj-client/utils/generated/hooks.ts` (auto-generated)
- Regenerate: `src/wj-client/gen/protobuf/v1/` (auto-generated types)

**Step 1: Regenerate frontend code**

```bash
task proto:all
```

**Step 2: Verify generated hooks**

Confirm these hooks exist in `hooks.ts`:
- `useQueryGetGoldSentiment`
- `useQueryGetGoldSentimentComments`
- `useMutationCastGoldVote`
- `useMutationPostGoldSentimentComment`
- `useMutationDeleteGoldSentimentComment`

And these EVENT constants:
- `EVENT_GoldSentimentGetGoldSentiment`
- `EVENT_GoldSentimentGetGoldSentimentComments`

**Step 3: Verify TypeScript types**

Confirm types generated in `gen/protobuf/v1/gold_sentiment.ts`:
- `VoteDirection` enum
- `GetGoldSentimentResponse`
- `GoldSentimentCommentItem`
- etc.

**Step 4: Commit (if any manual fixes needed)**

```
chore(proto): regenerate frontend hooks and types for gold sentiment
```

---

### Task 7: Create GoldSentimentCard Component

**Files:**
- Create: `src/wj-client/components/GoldSentimentCard.tsx`

**Security notes:** Never use `dangerouslySetInnerHTML` for comment content. All user text rendered as text nodes. No user IDs exposed in UI.

**Step 1: Create the component**

Props interface:
```typescript
interface GoldSentimentCardProps {
    variant: "landing" | "home";
}
```

Component structure:
1. **Header**: Question text "Ban nghi gia Vang hom nay se nhu the nao?" (use `useTranslations("goldSentiment")`)
2. **Vote buttons**: Two pill-shaped badges (Bullish green / Bearish red) showing percentages
   - Unvoted: light background, colored text
   - Voted (selected): filled dark background, white text, ring outline
   - On click (landing): show login CTA message
   - On click (home): call `useMutationCastGoldVote` → invalidate query → highlight selected
3. **Summary text**: "Cong dong dang lac quan" or "bi quan" based on majority, with total vote count
4. **Divider**
5. **Comments list**:
   - Each comment: avatar (32px circle), username, vote direction icon (small up/down arrow), relative time, content
   - Landing variant: Show 1 comment, then blurred overlay with "Dang nhap de xem them" + login button
   - Home variant: Show all comments paginated (10/page), "Xem them" load more button
6. **Comment input** (home variant only):
   - Textarea with max 500 chars, character count display
   - Submit button (disabled when empty or pending)
   - `useMutationPostGoldSentimentComment` on submit

Auth detection:
```typescript
const [isAuthenticated, setIsAuthenticated] = useState(false);
useEffect(() => {
    const authState = store.getState().setAuthReducer.isAuthenticated;
    queueMicrotask(() => setIsAuthenticated(authState ?? false));
}, []);
```

Data fetching:
```typescript
const { data: sentiment, isLoading } = useQueryGetGoldSentiment({});
const { data: comments } = useQueryGetGoldSentimentComments({ page: 1, pageSize: variant === "landing" ? 2 : 10 });
```

Styling (Tailwind, mobile-first):
- Wrap in `<BaseCard>` with appropriate padding
- Vote buttons: `rounded-full px-6 py-3` with green/red variants
- Comments: `space-y-3` list with `flex items-start gap-3` per comment
- Blurred overlay: `blur-sm` + absolute positioned login CTA
- Responsive: same layout for both mobile and desktop (card stretches full width)

**Step 2: Create i18n translation keys**

Add to Vietnamese (`vi`) and English (`en`) translation files:
- `goldSentiment.question`
- `goldSentiment.bullish`
- `goldSentiment.bearish`
- `goldSentiment.communityBullish`
- `goldSentiment.communityBearish`
- `goldSentiment.votes`
- `goldSentiment.loginToVote`
- `goldSentiment.loginToSeeMore`
- `goldSentiment.login`
- `goldSentiment.writeComment`
- `goldSentiment.send`
- `goldSentiment.loadMore`
- `goldSentiment.noComments`
- `goldSentiment.beFirstToVote`
- `goldSentiment.charsRemaining`
- `goldSentiment.commentPosted`
- `goldSentiment.commentDeleted`
- `goldSentiment.delete`
- `goldSentiment.timeAgo`

**Step 3: Commit**

```
feat(ui): add GoldSentimentCard component with vote, comments, and auth states

Shared component with landing (read-only + login CTA) and home (full
interaction) variants. Mobile-first responsive design.
```

---

### Task 8: Integrate into Landing Page

**Files:**
- Modify: `src/wj-client/app/[locale]/landing/page.tsx`

**Step 1: Add GoldSentimentCard to landing page**

Import and add `<GoldSentimentCard variant="landing" />` before `<LandingFooter />` in both mobile and desktop layouts.

Mobile layout:
```tsx
{/* After currency section, before footer */}
<GoldSentimentCard variant="landing" />
<LandingFooter />
```

Desktop layout:
```tsx
{/* After currency grid row, before footer */}
<div className="space-y-6">
    <GoldSentimentCard variant="landing" />
</div>
<LandingFooter />
```

**Step 2: Commit**

```
feat(landing): add gold sentiment voting card to landing page

Shows bullish/bearish percentages, 1 recent comment, and login CTA
for unauthenticated visitors.
```

---

### Task 9: Integrate into Dashboard Home Page

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/page.tsx`

**Step 1: Add GoldSentimentCard to home page**

Import and add `<GoldSentimentCard variant="home" />` after the price tables section and before the wallets section.

Mobile layout:
```tsx
{/* After DollarIndexChart, before WalletsSection */}
<GoldSentimentCard variant="home" />
```

Desktop layout:
```tsx
{/* After currency grid row, before wallets section */}
<GoldSentimentCard variant="home" />
```

**Step 2: Commit**

```
feat(home): add gold sentiment voting card to dashboard home page

Full interaction: vote, comment, delete own comments, paginated comment
list for authenticated users.
```

---

### Task 10: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Step 1: Update backend component diagram**

Add to HTTP Handlers section:
```
Component(gold_sentiment_handler, "GoldSentiment Handler", "Go/Gin", "Daily gold sentiment vote & comments")
```

Add to Service Layer:
```
Component(gold_sentiment_svc, "GoldSentiment Service", "Go", "Vote upsert, comments, Redis caching, daily reset")
```

Add to Repository Layer:
```
Component(gold_vote_repo, "GoldVote Repository", "Go/GORM", "Vote persistence with upsert")
Component(gold_vote_comment_repo, "GoldVoteComment Repository", "Go/GORM", "Comment CRUD with soft delete")
```

Add relationships:
```
Rel(gold_sentiment_handler, gold_sentiment_svc, "Uses")
Rel(gold_sentiment_svc, gold_vote_repo, "Reads/Writes")
Rel(gold_sentiment_svc, gold_vote_comment_repo, "Reads/Writes")
Rel(gold_sentiment_svc, redis, "Caches vote counts")
```

**Step 2: Update frontend component diagram**

Add to Shared Components:
```
Component(gold_sentiment_card, "GoldSentimentCard", "React", "Daily gold sentiment vote & comments with landing/home variants")
```

Update Landing Page and Home Page to show dependency:
```
Rel(landing_page, gold_sentiment_card, "Uses (variant=landing)")
Rel(home_page, gold_sentiment_card, "Uses (variant=home)")
```

**Step 3: Commit**

```
docs(arch): update C4 component diagrams for gold sentiment feature

Add handler, service, repositories to backend diagram. Add shared
GoldSentimentCard component to frontend diagram.
```

---

### Task 11: Create Runtime Flow Diagrams

**Files:**
- Create: `docs/architecture/flow-gold-sentiment.md`
- Modify: `docs/architecture/README.md` — add to Dynamic Behavior Diagrams table

**Step 1: Create flow diagram file**

Include 3 sequence diagrams:

1. **Cast Vote Flow** — User → Handler → (validate direction) → Service → (get today Vietnam TZ) → Repository (upsert) → (invalidate Redis cache) → (recompute counts) → Response with updated percentages

2. **Get Sentiment Flow** — Client → Handler → (try optional auth) → Service → (check Redis cache) → [cache hit: return] / [cache miss: query DB → compute percentages → cache 30s → return] → (if authenticated: also query user's vote) → Response

3. **Post Comment Flow** — User → Handler → (require auth) → Service → (validate content length, trim, HTML-escape) → (check daily limit: 5/day) → Repository (create) → (preload user for response) → Response with comment item

Each diagram includes:
- Key Invariants
- Error Paths table (Condition | Response | Rollback)

**Step 2: Update README.md**

Add to Dynamic Behavior Diagrams table:
```
| flow-gold-sentiment.md | Gold sentiment voting, comments | Cast vote, get sentiment, post comment |
```

**Step 3: Commit**

```
docs(arch): add runtime flow diagrams for gold sentiment feature

Three sequence diagrams: cast vote with upsert, get sentiment with
Redis cache, post comment with rate limiting and content sanitization.
```

---

## Task Dependency Graph

```
Task 1 (Proto) ──── Task 2 (Models/Migration) ──── Task 3 (Repos) ──── Task 4 (Service)
                                                                              │
                                                                              ▼
Task 6 (Gen Hooks) ◄──── Task 1 (Proto)                              Task 5 (Handler/Routes)
       │                                                                      │
       ▼                                                                      │
Task 7 (Component) ◄─────────────────────────────────────────────────────────┘
   │        │
   ▼        ▼
Task 8    Task 9          Task 10 (C4 Diagrams) ── parallel
(Landing) (Home)          Task 11 (Flow Diagrams) ── parallel
```

**Sequential chain:** 1 → 2 → 3 → 4 → 5 (backend must be built in order)
**Parallel after Task 1:** Task 6 (regenerate hooks — only needs proto)
**Parallel after Task 5 + 6:** Task 7 (component needs both hooks and backend)
**Parallel after Task 7:** Tasks 8, 9 (page integrations are independent)
**Fully parallel:** Tasks 10, 11 (docs can be written anytime after implementation)

## Summary

| Task | Description | Files | Dependencies |
|------|-------------|-------|-------------|
| 1 | Create protobuf definitions | 1 new | None |
| 2 | Create DB models & migration | 3 new, 1 modify | Task 1 |
| 3 | Create repository layer | 2 new, 3 modify | Task 2 |
| 4 | Create service layer | 1 new, 2 modify | Task 3 |
| 5 | Create handler & routes | 1 new, 2 modify | Task 4 |
| 6 | Generate frontend API hooks | Auto-generated | Task 1 |
| 7 | Create GoldSentimentCard component | 1 new + i18n files | Tasks 5, 6 |
| 8 | Integrate into landing page | 1 modify | Task 7 |
| 9 | Integrate into dashboard home | 1 modify | Task 7 |
| 10 | Update C4 architecture diagrams | 2 modify | Tasks 5, 7 |
| 11 | Create runtime flow diagrams | 1 new, 1 modify | Tasks 5, 7 |
