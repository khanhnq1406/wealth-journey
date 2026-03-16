# Asset Sentiment Generalization — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Generalize the gold-only sentiment survey into an asset-agnostic system supporting gold and silver, add silver sentiment to the prices page silver tab, move gold sentiment into the prices page gold tab, clean up vote count from summary and "comments from" date indicator.

**Spec:** `docs/specs/2026-03-16-asset-sentiment-generalization-spec.md`

**Architecture:** Extend existing `gold_vote` / `gold_vote_comment` tables with a `category` column (0=gold, 1=silver). Thread `SentimentCategory` enum through proto → service → repository → handler → frontend. Generalize `GoldSentimentCard` into `SentimentCard` with `asset` prop. Add sentiment cards to the prices page tabs.

**Tech Stack:** Go (Gin, GORM, Redis), PostgreSQL, Protocol Buffers, Next.js (React 19, TypeScript, Tailwind, React Query), next-intl

## Security Implementation Notes

- **Authentication:** Same as existing gold sentiment — optional auth for votes, required for comments
- **Authorization:** Comment deletion requires ownership (`comment.UserID == userID`)
- **Input validation:** Server-side validation of `category` enum (must be 0 or 1); all existing XSS/length validation applies per category
- **Rate limiting:** Per-user per-category (existing IP-based for public, user-based for protected routes)
- **Cache isolation:** Separate Redis keys per category (`gold_sentiment:gold:YYYY-MM-DD`, `gold_sentiment:silver:YYYY-MM-DD`)

---

### Task 1: Database Migration — Add `category` Column

**Files:**
- Modify: `src/go-backend/domain/models/gold_vote.go`
- Modify: `src/go-backend/domain/models/gold_vote_comment.go`
- Modify: `src/go-backend/cmd/migrate-gold-sentiment/main.go`

**Security notes:** Default `category=0` ensures backward compatibility — all existing gold data is preserved.

**Step 1: Add `Category` field to `GoldVote` model**

In `src/go-backend/domain/models/gold_vote.go`, add:
```go
Category int32 `gorm:"type:smallint;default:0;not null" json:"category"` // 0=gold, 1=silver
```

**Step 2: Add `Category` field to `GoldVoteComment` model**

In `src/go-backend/domain/models/gold_vote_comment.go`, add:
```go
Category int32 `gorm:"type:smallint;default:0;not null" json:"category"` // 0=gold, 1=silver
```

**Step 3: Update migration script**

In `src/go-backend/cmd/migrate-gold-sentiment/main.go`, add migration steps after existing code:

```go
// Add category column to gold_vote
log.Println("Adding category column to gold_vote...")
if err := db.Exec(`ALTER TABLE gold_vote ADD COLUMN IF NOT EXISTS category SMALLINT DEFAULT 0 NOT NULL`).Error; err != nil {
    log.Printf("Warning: category column may already exist on gold_vote: %v", err)
}

// Drop old partial unique indexes and recreate with category
log.Println("Recreating partial unique indexes with category...")
db.Exec(`DROP INDEX IF EXISTS idx_gold_vote_user_date`)
db.Exec(`DROP INDEX IF EXISTS idx_gold_vote_anon_date`)
if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_vote_user_cat_date ON gold_vote(category, user_id, vote_date) WHERE user_id IS NOT NULL`).Error; err != nil {
    return fmt.Errorf("failed to create user+category partial index: %w", err)
}
if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_vote_anon_cat_date ON gold_vote(category, anonymous_id, vote_date) WHERE anonymous_id IS NOT NULL`).Error; err != nil {
    return fmt.Errorf("failed to create anonymous+category partial index: %w", err)
}

// Add index for efficient count queries by category+date
if err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_gold_vote_cat_date ON gold_vote(category, vote_date)`).Error; err != nil {
    log.Printf("Warning: failed to create category+date index: %v", err)
}

// Add category column to gold_vote_comment
log.Println("Adding category column to gold_vote_comment...")
if err := db.Exec(`ALTER TABLE gold_vote_comment ADD COLUMN IF NOT EXISTS category SMALLINT DEFAULT 0 NOT NULL`).Error; err != nil {
    log.Printf("Warning: category column may already exist on gold_vote_comment: %v", err)
}

// Add index for comment queries by category+date
if err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_gold_vote_comment_cat_date ON gold_vote_comment(category, vote_date)`).Error; err != nil {
    log.Printf("Warning: failed to create comment category+date index: %v", err)
}
```

**Step 4: Run migration locally to verify**
```bash
cd src/go-backend && go run cmd/migrate-gold-sentiment/main.go
```

**Step 5: Commit**
```
feat(sentiment): add category column to gold_vote and gold_vote_comment tables
```

---

### Task 2: Update Proto Definitions — Add `SentimentCategory` Enum

**Files:**
- Modify: `api/protobuf/v1/gold_sentiment.proto`

**Security notes:** Category field defaults to `GOLD (0)` for backward compatibility. Server must validate value is 0 or 1.

**Step 1: Add `SentimentCategory` enum and update messages**

Add enum after `VoteDirection`:
```protobuf
enum SentimentCategory {
    SENTIMENT_CATEGORY_GOLD = 0;
    SENTIMENT_CATEGORY_SILVER = 1;
}
```

Update request messages to include `category`:
- `GetGoldSentimentRequest`: add `SentimentCategory category = 1;`
- `GetGoldSentimentCommentsRequest`: add `SentimentCategory category = 3;`
- `CastGoldVoteRequest`: add `SentimentCategory category = 2;`
- `PostGoldSentimentCommentRequest`: add `SentimentCategory category = 2;`
- `DeleteGoldSentimentCommentRequest`: add `SentimentCategory category = 2;`

Update response messages:
- `GetGoldSentimentResponse`: add `SentimentCategory category = 8;`
- `GetGoldSentimentCommentsResponse`: add `SentimentCategory category = 6;`

**Step 2: Generate code**
```bash
task proto:all
```

**Step 3: Verify Go code compiles**
```bash
cd src/go-backend && go build ./...
```

**Step 4: Commit**
```
feat(sentiment): add SentimentCategory enum and category field to proto definitions
```

---

### Task 3: Update Repository Layer — Category-Aware Queries

**Files:**
- Modify: `src/go-backend/domain/repository/gold_vote_repository.go`
- Modify: `src/go-backend/domain/repository/gold_vote_comment_repository.go`
- Modify: `src/go-backend/domain/repository/interfaces.go` (repository interfaces)

**Security notes:** All queries must include `category` in WHERE clauses to prevent cross-category data leakage.

**Step 1: Update `GoldVoteRepository` interface**

In `src/go-backend/domain/repository/interfaces.go`, update `GoldVoteRepository` — every method that takes `voteDate` should also take `category int32`:

```go
type GoldVoteRepository interface {
    Upsert(ctx context.Context, vote *models.GoldVote) error
    GetByUserAndDate(ctx context.Context, userID int32, voteDate time.Time, category int32) (*models.GoldVote, error)
    CountByDate(ctx context.Context, voteDate time.Time, category int32) (bullish int32, bearish int32, err error)
    UpsertAnonymous(ctx context.Context, vote *models.GoldVote) error
    GetByAnonymousIDAndDate(ctx context.Context, anonymousID string, voteDate time.Time, category int32) (*models.GoldVote, error)
    DeleteByAnonymousIDAndDate(ctx context.Context, anonymousID string, voteDate time.Time, category int32) error
}
```

Note: `Upsert` and `UpsertAnonymous` get category from the `vote.Category` field (already set by service), so their signatures don't change.

**Step 2: Update `GoldVoteCommentRepository` interface**

```go
type GoldVoteCommentRepository interface {
    Create(ctx context.Context, comment *models.GoldVoteComment) error
    GetByID(ctx context.Context, id int32) (*models.GoldVoteComment, error)
    ListByDate(ctx context.Context, voteDate time.Time, category int32, limit, offset int) ([]*models.GoldVoteComment, int, error)
    Delete(ctx context.Context, id int32) error
    CountByUserAndDate(ctx context.Context, userID int32, voteDate time.Time, category int32) (int, error)
}
```

**Step 3: Update `gold_vote_repository.go` implementations**

Update `Upsert` SQL to include `category`:
```sql
INSERT INTO gold_vote (user_id, vote_date, direction, category, created_at, updated_at)
VALUES (?, ?, ?, ?, NOW(), NOW())
ON CONFLICT (category, user_id, vote_date) WHERE user_id IS NOT NULL
DO UPDATE SET direction = EXCLUDED.direction, updated_at = NOW()
```
Pass `vote.Category` as the 4th parameter.

Update `UpsertAnonymous` SQL similarly:
```sql
INSERT INTO gold_vote (anonymous_id, vote_date, direction, category, created_at, updated_at)
VALUES (?, ?, ?, ?, NOW(), NOW())
ON CONFLICT (category, anonymous_id, vote_date) WHERE anonymous_id IS NOT NULL
DO UPDATE SET direction = EXCLUDED.direction, updated_at = NOW()
```

Update `GetByUserAndDate` to add `category int32` parameter:
```go
func (r *goldVoteRepository) GetByUserAndDate(ctx context.Context, userID int32, voteDate time.Time, category int32) (*models.GoldVote, error) {
    var vote models.GoldVote
    result := r.db.DB.WithContext(ctx).
        Where("user_id = ? AND vote_date = ? AND category = ?", userID, voteDate, category).
        First(&vote)
    // ...
}
```

Update `GetByAnonymousIDAndDate` similarly — add `AND category = ?`.

Update `DeleteByAnonymousIDAndDate` similarly — add `AND category = ?`.

Update `CountByDate` to add `category int32` parameter:
```go
func (r *goldVoteRepository) CountByDate(ctx context.Context, voteDate time.Time, category int32) (bullish int32, bearish int32, err error) {
    // ...
    err = r.db.DB.WithContext(ctx).
        Model(&models.GoldVote{}).
        Select("direction, count(*) as count").
        Where("vote_date = ? AND category = ?", voteDate, category).
        Group("direction").
        Scan(&results).Error
    // ...
}
```

**Step 4: Update `gold_vote_comment_repository.go` implementations**

Update `ListByDate` to add `category int32` parameter — add `AND category = ?` to both the count query and the list query.

Update `CountByUserAndDate` to add `category int32` parameter — add `AND category = ?`.

Note: `Create` gets category from `comment.Category` (set by service). `GetByID` and `Delete` don't need category since they operate by primary key.

**Step 5: Verify compilation**
```bash
cd src/go-backend && go build ./...
```

**Step 6: Commit**
```
feat(sentiment): add category parameter to vote and comment repository queries
```

---

### Task 4: Update Service Layer — Category-Aware Business Logic

**Files:**
- Modify: `src/go-backend/domain/service/gold_sentiment_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go`

**Security notes:** Validate category is 0 or 1 at the service level. Cache keys must be scoped by category.

**Step 1: Update `GoldSentimentService` interface in `interfaces.go`**

Add `category int32` parameter to all methods:
```go
type GoldSentimentService interface {
    GetSentiment(ctx context.Context, userID int32, anonymousID string, category int32) (*v1.GetGoldSentimentResponse, error)
    CastVote(ctx context.Context, userID int32, anonymousID string, req *v1.CastGoldVoteRequest) (*v1.CastGoldVoteResponse, error)
    GetComments(ctx context.Context, userID int32, req *v1.GetGoldSentimentCommentsRequest) (*v1.GetGoldSentimentCommentsResponse, error)
    PostComment(ctx context.Context, userID int32, req *v1.PostGoldSentimentCommentRequest) (*v1.PostGoldSentimentCommentResponse, error)
    DeleteComment(ctx context.Context, userID int32, commentID int32) error
}
```

Note: `CastVote`, `GetComments`, `PostComment` get category from the proto request's `Category` field. `GetSentiment` needs it as a parameter since `GetGoldSentimentRequest` previously had no fields. `DeleteComment` doesn't need it (operates by comment ID + ownership check).

**Step 2: Add category validation helper**

```go
func validateCategory(category int32) int32 {
    if category == int32(v1.SentimentCategory_SENTIMENT_CATEGORY_SILVER) {
        return int32(v1.SentimentCategory_SENTIMENT_CATEGORY_SILVER)
    }
    return int32(v1.SentimentCategory_SENTIMENT_CATEGORY_GOLD) // default
}
```

**Step 3: Update cache key to include category**

Change cache prefix usage from:
```go
key := goldSentimentCachePrefix + date.Format("2006-01-02")
```
To:
```go
func sentimentCacheKey(date time.Time, category int32) string {
    cat := "gold"
    if category == 1 {
        cat = "silver"
    }
    return fmt.Sprintf("%s%s:%s", goldSentimentCachePrefix, cat, date.Format("2006-01-02"))
}
```

Update `getCachedSentiment`, `cacheSentiment`, and `invalidateCache` to accept and use `category int32`.

**Step 4: Update `GetSentiment` to pass category**

```go
func (s *goldSentimentService) GetSentiment(ctx context.Context, userID int32, anonymousID string, category int32) (*v1.GetGoldSentimentResponse, error) {
    category = validateCategory(category)
    today := getTodayVietnam()

    resp, err := s.getCachedSentiment(ctx, today, category)
    if err == nil && resp != nil {
        s.populateUserVote(ctx, resp, userID, anonymousID, today, category)
        return resp, nil
    }

    bullish, bearish, err := s.voteRepo.CountByDate(ctx, today, category)
    // ... rest stays same, pass category to cache and populateUserVote
    resp.Category = v1.SentimentCategory(category)
    // ...
}
```

**Step 5: Update `CastVote` to use `req.Category`**

Extract category from request, validate it, set on the vote model, pass to all repo calls:
```go
category := validateCategory(int32(req.Category))
// ...
vote := &models.GoldVote{
    UserID:    &userID,
    VoteDate:  today,
    Direction: int32(req.Direction),
    Category:  category,
}
```

Pass `category` to `DeleteByAnonymousIDAndDate`, `CountByDate`, and `invalidateCache`.

**Step 6: Update `GetComments` to use `req.Category`**

Extract and validate category, pass to `ListByDate` and `GetByUserAndDate` calls.

**Step 7: Update `PostComment` to use `req.Category`**

Extract and validate category, set on the comment model, pass to `CountByUserAndDate` and `GetByUserAndDate`.

**Step 8: Update `populateUserVote` to accept `category`**

Pass `category` to `GetByUserAndDate` and `GetByAnonymousIDAndDate`.

**Step 9: Verify compilation**
```bash
cd src/go-backend && go build ./...
```

**Step 10: Commit**
```
feat(sentiment): thread category through service layer with cache isolation
```

---

### Task 5: Update Handler Layer — Pass Category from HTTP Requests

**Files:**
- Modify: `src/go-backend/handlers/gold_sentiment.go`

**Security notes:** Parse category from query param (GET) or request body (POST). Default to 0 (gold) if missing.

**Step 1: Update `GetGoldSentiment` handler**

Parse category from query string:
```go
func (h *GoldSentimentHandler) GetGoldSentiment(c *gin.Context) {
    userID := h.tryGetUserID(c)
    anonymousID := c.GetHeader("X-Anonymous-ID")
    category, _ := strconv.Atoi(c.DefaultQuery("category", "0"))

    result, err := h.service.GetSentiment(c.Request.Context(), userID, anonymousID, int32(category))
    // ...
}
```

**Step 2: Update `GetGoldSentimentComments` handler**

Parse category from query string and set on the request:
```go
func (h *GoldSentimentHandler) GetGoldSentimentComments(c *gin.Context) {
    // ... existing page/pageSize parsing ...
    category, _ := strconv.Atoi(c.DefaultQuery("category", "0"))

    req := &v1.GetGoldSentimentCommentsRequest{
        Page:     int32(page),
        PageSize: int32(pageSize),
        Category: v1.SentimentCategory(category),
    }
    // ...
}
```

**Step 3: CastGoldVote, PostGoldSentimentComment, DeleteGoldSentimentComment**

These already bind the request body which now includes `category` field from proto. No handler changes needed — the proto-generated struct already has the field, and the service reads it from the request.

**Step 4: Verify compilation**
```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**
```
feat(sentiment): parse category from query params in sentiment handlers
```

---

### Task 6: Regenerate Frontend Types and Hooks

**Files:**
- Auto-generated: `src/wj-client/gen/protobuf/v1/gold_sentiment.ts`
- Auto-generated: `src/wj-client/utils/generated/hooks.ts`

**Step 1: Generate TypeScript types and hooks**
```bash
task proto:all
```

**Step 2: Verify generated types include `SentimentCategory` enum and `category` field**

Check `src/wj-client/gen/protobuf/v1/gold_sentiment.ts` for:
- `SentimentCategory` enum
- `category` field on all request/response types

**Step 3: Verify frontend builds**
```bash
cd src/wj-client && npm run build
```

**Step 4: Commit**
```
feat(sentiment): regenerate frontend types with SentimentCategory support
```

---

### Task 7: Generalize Frontend Component — `GoldSentimentCard` → `SentimentCard`

**Files:**
- Modify: `src/wj-client/components/GoldSentimentCard.tsx` (rename export + add `asset` prop)

**Security notes:** Anonymous vote IDs must be scoped per asset type (`gold_vote_anonymous_id` vs `silver_vote_anonymous_id`).

**Step 1: Update props interface and component**

Add `asset` prop alongside existing `variant`:
```typescript
type SentimentAsset = "gold" | "silver";

interface SentimentCardProps {
  variant: "landing" | "home";
  asset?: SentimentAsset; // defaults to "gold" for backward compat
}
```

**Step 2: Import `SentimentCategory` from generated types**

```typescript
import { VoteDirection, SentimentCategory } from "@/gen/protobuf/v1/gold_sentiment";
```

**Step 3: Map asset to category and pass to all hooks**

```typescript
const category = asset === "silver"
  ? SentimentCategory.SENTIMENT_CATEGORY_SILVER
  : SentimentCategory.SENTIMENT_CATEGORY_GOLD;
```

Update all hook calls to include `category`:
- `useQueryGetGoldSentiment({ category }, ...)`
- `useQueryGetGoldSentimentComments({ page: 1, pageSize: ..., category }, ...)`
- `castVoteMutation.mutate({ direction, category })`
- `postCommentMutation.mutate({ content: trimmed, category })`
- `deleteCommentMutation.mutate({ commentId, category })`

**Step 4: Scope anonymous vote ID per asset**

```typescript
const anonymousIdKey = asset === "silver" ? "silver_vote_anonymous_id" : "gold_vote_anonymous_id";
```

Update the `onSuccess` callback for `castVoteMutation`:
```typescript
localStorage.setItem(anonymousIdKey, data.anonymousId);
```

**Step 5: Apply asset-specific theming**

Define a theme config:
```typescript
const ASSET_THEME = {
  gold: {
    spinnerBorder: "border-v2-gold-primary",
    focusRing: "focus:ring-v2-gold-primary/30 focus:border-v2-gold-primary",
    accentText: "text-v2-gold-primary hover:text-v2-gold-dark dark:hover:text-v2-gold-accent",
    sendButton: "bg-v2-gold-primary hover:bg-v2-gold-dark active:bg-v2-gold-dark",
    loadMoreText: "text-v2-gold-primary hover:text-v2-gold-dark dark:hover:text-v2-gold-accent",
  },
  silver: {
    spinnerBorder: "border-v2-silver-primary",
    focusRing: "focus:ring-v2-silver-primary/30 focus:border-v2-silver-primary",
    accentText: "text-v2-silver-primary hover:text-v2-silver-dark dark:hover:text-gray-300",
    sendButton: "bg-v2-silver-primary hover:bg-v2-silver-dark active:bg-v2-silver-dark",
    loadMoreText: "text-v2-silver-primary hover:text-v2-silver-dark dark:hover:text-gray-300",
  },
} as const;
```

Replace hardcoded gold classes with `theme.spinnerBorder`, `theme.focusRing`, etc.

**Step 6: Update i18n namespace based on asset**

```typescript
const t = useTranslations(asset === "silver" ? "silverSentiment" : "goldSentiment");
```

**Step 7: Update summary text — remove vote count (FR-6)**

Change `getSummaryText`:
```typescript
const getSummaryText = () => {
  if (totalVotes === 0) return t("communityNeutral");
  if (bullishPct >= bearishPct) return t("communityBullish");
  return t("communityBearish");
};
```

**Step 8: Remove "comments from" date indicator (FR-6)**

Remove `showingOlderComments` derived state and the `commentsFrom` display in the comments section header. Remove unused `isToday` and `formatShortDate` functions.

**Step 9: Keep backward compatibility — export both names**

```typescript
export function SentimentCard({ variant, asset = "gold" }: SentimentCardProps) {
  // ... component body
}

// Backward compat alias
export const GoldSentimentCard = SentimentCard;
```

**Step 10: Commit**
```
feat(sentiment): generalize GoldSentimentCard to SentimentCard with asset prop
```

---

### Task 8: Add i18n Translations for Silver Sentiment

**Files:**
- Modify: `src/wj-client/messages/en/ui.json`
- Modify: `src/wj-client/messages/vi/ui.json`

**Step 1: Update gold translations — remove vote count from summary (FR-6)**

In both `en/ui.json` and `vi/ui.json`, update `goldSentiment`:
- `communityBullish`: `"Community is bullish"` (EN) / `"Cộng đồng đang lạc quan"` (VI) — remove `with {count} votes`
- `communityBearish`: `"Community is bearish"` (EN) / `"Cộng đồng đang bi quan"` (VI)
- Remove `commentsFrom` key (no longer used)

**Step 2: Add `silverSentiment` namespace**

In `en/ui.json`, after `goldSentiment`, add:
```json
"silverSentiment": {
    "question": "What do you think about Silver prices today?",
    "bullish": "Bullish",
    "bearish": "Bearish",
    "communityBullish": "Community is bullish",
    "communityBearish": "Community is bearish",
    "communityNeutral": "No votes yet. Be the first!",
    "votes": "votes",
    "loginToVote": "to comment and see more",
    "loginToComment": "Log in to comment",
    "loginToSeeMore": "Log in to see more",
    "login": "Log in",
    "writeComment": "Write a comment...",
    "send": "Send",
    "loadMore": "Load more",
    "noComments": "No comments yet",
    "beFirstToComment": "Be the first to comment!",
    "charsRemaining": "{count} characters remaining",
    "commentPosted": "Comment posted",
    "commentDeleted": "Comment deleted",
    "delete": "Delete",
    "justNow": "just now",
    "minutesAgo": "{count} min ago",
    "hoursAgo": "{count}h ago",
    "daysAgo": "{count}d ago",
    "comments": "Comments",
    "dailyLimitReached": "You've reached the {count} comments/day limit"
}
```

In `vi/ui.json`, add:
```json
"silverSentiment": {
    "question": "Bạn nghĩ giá bạc hôm nay sẽ như thế nào?",
    "bullish": "Tăng",
    "bearish": "Giảm",
    "communityBullish": "Cộng đồng đang lạc quan",
    "communityBearish": "Cộng đồng đang bi quan",
    "communityNeutral": "Chưa có bình chọn nào. Hãy là người đầu tiên!",
    "votes": "lượt bình chọn",
    "loginToVote": "để bình luận và xem thêm",
    "loginToComment": "Đăng nhập để bình luận",
    "loginToSeeMore": "Đăng nhập để xem thêm",
    "login": "Đăng nhập",
    "writeComment": "Viết bình luận...",
    "send": "Gửi",
    "loadMore": "Xem thêm",
    "noComments": "Chưa có bình luận",
    "beFirstToComment": "Hãy là người đầu tiên bình luận!",
    "charsRemaining": "còn {count} ký tự",
    "commentPosted": "Đã đăng bình luận",
    "commentDeleted": "Đã xóa bình luận",
    "delete": "Xóa",
    "justNow": "vừa xong",
    "minutesAgo": "{count} phút trước",
    "hoursAgo": "{count} giờ trước",
    "daysAgo": "{count} ngày trước",
    "comments": "Bình luận",
    "dailyLimitReached": "Bạn đã đạt giới hạn {count} bình luận/ngày"
}
```

**Step 3: Commit**
```
feat(sentiment): add silver sentiment i18n translations, clean up vote count from summary
```

---

### Task 9: Add Sentiment Cards to Prices Page Tabs

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/prices/page.tsx`

**Security notes:** Cards should only render when their tab is active to avoid unnecessary API calls.

**Step 1: Import SentimentCard**

```typescript
import { SentimentCard } from "@/components/GoldSentimentCard";
```

**Step 2: Add SentimentCard below gold tab content**

Inside the `{activeTab === "gold" && ( ... )}` block, after the mobile `<MobileTable>` closing tag and before the closing `</>`:

```tsx
{/* Gold Sentiment */}
<div className="mt-4">
  <SentimentCard variant="home" asset="gold" />
</div>
```

**Step 3: Add SentimentCard below silver tab content**

Inside the `{activeTab === "silver" && ( ... )}` block, same pattern:

```tsx
{/* Silver Sentiment */}
<div className="mt-4">
  <SentimentCard variant="home" asset="silver" />
</div>
```

**Step 4: Verify build**
```bash
cd src/wj-client && npm run build
```

**Step 5: Commit**
```
feat(sentiment): add gold/silver sentiment cards to prices page tabs
```

---

### Task 10: Update Landing and Home Pages — Add Silver Sentiment

**Files:**
- Modify: `src/wj-client/app/[locale]/landing/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/home/page.tsx`

**Step 1: Update imports in both files**

Replace:
```typescript
import { GoldSentimentCard } from "@/components/GoldSentimentCard";
```
With:
```typescript
import { SentimentCard } from "@/components/GoldSentimentCard";
```

**Step 2: Update landing page**

Replace the two `<GoldSentimentCard variant="landing" />` instances with:
```tsx
<SentimentCard variant="landing" asset="gold" />
<SentimentCard variant="landing" asset="silver" />
```

At mobile position (line ~64) and desktop position (line ~89), add silver below gold.

**Step 3: Update dashboard home page**

Replace the two `<GoldSentimentCard variant="home" />` instances with:
```tsx
<SentimentCard variant="home" asset="gold" />
<SentimentCard variant="home" asset="silver" />
```

At mobile position (line ~205) and desktop position (line ~276), add silver below gold.

**Step 4: Verify build**
```bash
cd src/wj-client && npm run build
```

**Step 5: Commit**
```
feat(sentiment): add silver sentiment cards to landing and home pages
```

---

### Task 11: Update Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`
- Modify: `docs/architecture/flow-gold-sentiment.md`

**Step 1: Update C4 backend component diagram**

In `c4-component-backend.md`, update references:
- `GoldSentimentService` description → note it now handles "gold and silver sentiment with category-based isolation"
- `GoldSentimentHandler` description → note it accepts `category` query parameter

**Step 2: Update C4 frontend component diagram**

In `c4-component-frontend.md`:
- `GoldSentimentCard` → note "now exported as `SentimentCard` with `asset` prop supporting gold/silver"
- Add note that it's used in prices page tabs, landing, and home pages

**Step 3: Update flow diagram**

In `flow-gold-sentiment.md`:
- Update title to "Sentiment Vote & Comment Flows"
- Add `category` parameter to all sequence diagram interactions
- Note that cache keys are scoped per category

**Step 4: Commit**
```
docs(architecture): update C4 and flow diagrams for sentiment generalization
```

---

## Task Dependency Order

```
Task 1 (DB migration) → Task 2 (Proto) → Task 3 (Repository) → Task 4 (Service) → Task 5 (Handler) → Task 6 (Generate TS)
Task 6 → Task 7 (Frontend component) [depends on generated types]
Task 7 → Task 8 (i18n) [can be parallel with Task 7]
Task 7 + Task 8 → Task 9 (Prices page)
Task 7 + Task 8 → Task 10 (Landing + Home pages)
Task 9 + Task 10 → Task 11 (Architecture docs)
```

**Parallelizable tasks:**
- Tasks 8 and 7 can overlap (i18n doesn't depend on component code, just needs the namespace decision)
- Tasks 9 and 10 are independent (different files)

## Summary

| # | Task | Files Changed | Estimated Complexity |
|---|------|---------------|---------------------|
| 1 | DB Migration | 3 files | Low |
| 2 | Proto Definitions | 1 file + generated | Low |
| 3 | Repository Layer | 3 files | Medium |
| 4 | Service Layer | 2 files | Medium |
| 5 | Handler Layer | 1 file | Low |
| 6 | Generate Frontend Types | Auto-generated | Low |
| 7 | Frontend Component | 1 file | Medium |
| 8 | i18n Translations | 2 files | Low |
| 9 | Prices Page | 1 file | Low |
| 10 | Landing + Home Pages | 2 files | Low |
| 11 | Architecture Docs | 3 files | Low |
