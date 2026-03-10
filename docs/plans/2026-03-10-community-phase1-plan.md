# Community Phase 1 (MVP) — Implementation Plan

> **Spec:** `docs/specs/2026-03-09-community-phase1-spec.md`

**Goal:** Add a community module to WealthJourney — a finance-focused social feed with posts (text+image), likes, comments, follow, basic profile, and content reporting.

**Architecture:** New `community.proto` defines the API contract. Backend adds CommunityHandler → CommunityService → 5 repositories (Post, Comment, Like, Follow, Report). Frontend adds `features/community/` module with feed page at `/dashboard/community`. 5 new DB tables + `bio` field on `user` table.

**Tech Stack:** Go 1.23 (Gin/GORM), Next.js 15 (React 19, TypeScript 5, Tailwind CSS), PostgreSQL 16, Redis 7, Protocol Buffers, Supabase Storage.

## Security Implementation Notes

- **Authentication:** All community endpoints require JWT auth via existing `AuthMiddleware`
- **Authorization:** User ID from JWT context (`handler.GetUserID(c)`), never from request body. Ownership checks in service layer for edit/delete/bio operations.
- **Input validation:** Server-side validation for all fields — post content (1-2000 chars), comment (1-500 chars), bio (0-200 chars), topic tags against allowlist, image URLs against Supabase Storage domain pattern.
- **Data sanitization:** Strip HTML tags from post content, comment content, and bio before storage. Frontend renders text content as text nodes (not dangerouslySetInnerHTML).
- **Rate limiting:** Reuse existing `RateLimitByUser` middleware on community route group.
- **Image security:** Signed upload URLs with 5-min TTL, content-type lock (jpeg/png/webp), max 5MB.

---

## Task Overview

| # | Task | Layer | Files | Dependencies |
|---|------|-------|-------|-------------|
| 0 | Update C4 Architecture Diagrams | Docs | 3 docs files | None |
| 1 | Define Protobuf API | API | `community.proto`, `common.proto` | None |
| 2 | Generate Code from Proto | Build | Generated files | Task 1 |
| 3 | Database Models | Backend | 6 model files | Task 2 |
| 4 | Database Migration | Backend | 1 migration cmd | Task 3 |
| 5 | Repositories | Backend | 5 repo files + interfaces | Task 3 |
| 6 | Community Service | Backend | service file + interfaces | Task 5 |
| 7 | Community Handlers | Backend | handler file | Task 6 |
| 8 | Wire DI & Routes | Backend | builder, routes, providers | Task 7 |
| 9 | Frontend: Constants & Route | Frontend | constants, layout, nav | Task 2 |
| 10 | Frontend: Community Page Shell | Frontend | page.tsx, layout components | Task 9 |
| 11 | Frontend: PostCard Component | Frontend | feature components | Task 10 |
| 12 | Frontend: CreatePostBox & Form | Frontend | feature forms | Task 11 |
| 13 | Frontend: Like, Comment, Follow | Frontend | feature hooks, components | Task 11 |
| 14 | Frontend: Profile Card & Nav | Frontend | feature components | Task 11 |
| 15 | Frontend: Mobile Layout | Frontend | responsive components | Task 14 |
| 16 | Create Runtime Flow Diagrams | Docs | flow-community.md | Task 8 |
| 17 | Integration Testing & Cleanup | All | various | All above |

---

### Task 0: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md` — Add CommunityHandler, CommunityService, 5 repositories
- Modify: `docs/architecture/c4-component-frontend.md` — Add community feature module, community page
- Create: `docs/architecture/c4-code-community.md` — L4 code diagram (classDiagram with CommunityService, repositories, models)

**Steps:**
1. Add to backend L3: `Component(community_h, "Community Handlers", "handlers/community.go", "Post CRUD, Like, Comment, Follow, Report, Profile, Upload URL")` in Handlers boundary
2. Add to backend L3: `Component(community_svc, "CommunityService", "service/community_service.go", "Business logic for posts, comments, likes, follows, reports, profiles")` in Services boundary
3. Add to backend L3: `Component(post_repo, "PostRepository")`, `Component(comment_repo, "CommentRepository")`, `Component(like_repo, "LikeRepository")`, `Component(follow_repo, "FollowRepository")`, `Component(report_repo, "ReportRepository")` in Repos boundary
4. Add relationships: community_h → community_svc → repos
5. Add to frontend L3: `community` feature module in Features container, `/dashboard/community` page in Pages
6. Create L4 code diagram using classDiagram with all interfaces and models from the spec

---

### Task 1: Define Protobuf API — `api/protobuf/v1/community.proto`

**Files:**
- Create: `api/protobuf/v1/community.proto`

**Security notes:** All RPCs require authenticated user. User ID sourced from JWT context, not request body.

**Content:** Define the full `CommunityService` as specified in the spec (Section "API Changes"):
- Service with 17 RPCs: CreatePost, UpdatePost, DeletePost, GetPost, GetFeed, GetUserPosts, LikePost, UnlikePost, CreateComment, DeleteComment, GetComments, FollowUser, UnfollowUser, GetCommunityProfile, UpdateBio, ReportContent, GetUploadURL
- Messages: PostItem, CommentItem, CommunityProfile, TopicTag enum or string
- Request/Response messages for each RPC
- HTTP annotations using `google.api.http` for REST endpoints
- Import `common.proto` for PaginationParams/PaginationResult

**Key design decisions:**
- `topic_tag` as string (not enum) for flexibility — validated server-side against allowlist
- `image_url` validated to match Supabase Storage domain pattern
- `is_liked`, `is_own_post`, `is_following`, `is_own_profile` computed fields for frontend convenience
- Timestamps as `int64` (Unix seconds) consistent with existing proto patterns
- Response pattern: `{success, message, data/posts/comments/profile, pagination, timestamp}` matching existing conventions

---

### Task 2: Generate Code from Proto

**Files:**
- Generated: `src/go-backend/protobuf/v1/community.pb.go`, `community_grpc.pb.go`, `community.pb.gw.go`
- Generated: `src/wj-client/gen/protobuf/v1/community.ts`
- Generated: `src/wj-client/utils/generated/hooks.ts` (new community hooks auto-added)

**Steps:**
1. Run `task proto:all`
2. Verify Go code compiles: `cd src/go-backend && go build ./...`
3. Verify TypeScript types generated: check `src/wj-client/gen/protobuf/v1/community.ts`
4. Verify hooks generated: grep for `useMutationCreatePost` in `hooks.ts`

---

### Task 3: Database Models

**Files:**
- Create: `src/go-backend/domain/models/post.go`
- Create: `src/go-backend/domain/models/comment.go`
- Create: `src/go-backend/domain/models/post_like.go`
- Create: `src/go-backend/domain/models/user_follow.go`
- Create: `src/go-backend/domain/models/content_report.go`
- Modify: `src/go-backend/domain/models/user.go` — Add `Bio` field

**Security notes:** All models use soft delete where applicable (Post, Comment). `post_like` has unique constraint on (user_id, post_id) to prevent double-likes. `user_follow` has unique constraint on (follower_id, following_id).

**Model definitions (following existing patterns):**

```go
// post.go
type Post struct {
    ID           int32          `gorm:"primaryKey;autoIncrement" json:"id"`
    UserID       int32          `gorm:"not null;index:idx_post_user_id" json:"userId"`
    Content      string         `gorm:"type:text;not null" json:"content"`
    ImageURL     string         `gorm:"size:500" json:"imageUrl"`
    TopicTag     string         `gorm:"size:50;not null" json:"topicTag"`
    LikeCount    int32          `gorm:"default:0" json:"likeCount"`
    CommentCount int32          `gorm:"default:0" json:"commentCount"`
    CreatedAt    time.Time      `json:"createdAt"`
    UpdatedAt    time.Time      `json:"updatedAt"`
    DeletedAt    gorm.DeletedAt `gorm:"index:idx_post_deleted_at" json:"-"`
    User         *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
func (Post) TableName() string { return "post" }

// comment.go
type Comment struct {
    ID        int32          `gorm:"primaryKey;autoIncrement" json:"id"`
    PostID    int32          `gorm:"not null;index:idx_comment_post_id" json:"postId"`
    UserID    int32          `gorm:"not null;index:idx_comment_user_id" json:"userId"`
    Content   string         `gorm:"type:text;not null" json:"content"`
    CreatedAt time.Time      `json:"createdAt"`
    DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
    User      *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
    Post      *Post          `gorm:"foreignKey:PostID" json:"post,omitempty"`
}
func (Comment) TableName() string { return "comment" }

// post_like.go
type PostLike struct {
    ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
    UserID    int32     `gorm:"not null;uniqueIndex:idx_like_user_post" json:"userId"`
    PostID    int32     `gorm:"not null;uniqueIndex:idx_like_user_post;index:idx_like_post_id" json:"postId"`
    CreatedAt time.Time `json:"createdAt"`
}
func (PostLike) TableName() string { return "post_like" }

// user_follow.go
type UserFollow struct {
    ID          int32     `gorm:"primaryKey;autoIncrement" json:"id"`
    FollowerID  int32     `gorm:"not null;uniqueIndex:idx_follow_follower_following" json:"followerId"`
    FollowingID int32     `gorm:"not null;uniqueIndex:idx_follow_follower_following;index:idx_follow_following_id" json:"followingId"`
    CreatedAt   time.Time `json:"createdAt"`
}
func (UserFollow) TableName() string { return "user_follow" }

// content_report.go
type ContentReport struct {
    ID         int32     `gorm:"primaryKey;autoIncrement" json:"id"`
    ReporterID int32     `gorm:"not null;uniqueIndex:idx_report_target" json:"reporterId"`
    TargetType string    `gorm:"size:20;not null;uniqueIndex:idx_report_target" json:"targetType"`
    TargetID   int32     `gorm:"not null;uniqueIndex:idx_report_target" json:"targetId"`
    Reason     string    `gorm:"size:50;not null" json:"reason"`
    Details    string    `gorm:"type:text" json:"details"`
    Status     string    `gorm:"size:20;default:'pending';index:idx_report_status" json:"status"`
    CreatedAt  time.Time `json:"createdAt"`
}
func (ContentReport) TableName() string { return "content_report" }

// user.go — add Bio field
Bio string `gorm:"size:200" json:"bio"`
```

---

### Task 4: Database Migration — `cmd/migrate-community/main.go`

**Files:**
- Create: `src/go-backend/cmd/migrate-community/main.go`
- Modify: `Taskfile.yml` — Add `backend:migrate-community` task

**Steps:**
1. Use GORM `AutoMigrate` for new tables: Post, Comment, PostLike, UserFollow, ContentReport
2. Add `bio` column to user table: `db.DB.Exec("ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS bio VARCHAR(200)")`
3. Create indexes explicitly (some compound indexes GORM can't auto-create):
   - `idx_post_created_at` on post(created_at)
   - `idx_post_user_id` on post(user_id)
4. Add Taskfile entry: `backend:migrate-community: go run cmd/migrate-community/main.go`

---

### Task 5: Repositories

**Files:**
- Create: `src/go-backend/domain/repository/post_repository.go`
- Create: `src/go-backend/domain/repository/comment_repository.go`
- Create: `src/go-backend/domain/repository/like_repository.go`
- Create: `src/go-backend/domain/repository/follow_repository.go`
- Create: `src/go-backend/domain/repository/report_repository.go`
- Modify: `src/go-backend/domain/repository/interfaces.go` — Add 5 new interfaces (if they exist in a single file) OR create individual interface files

**Repository interfaces (following BaseRepository patterns):**

```go
// PostRepository
type PostRepository interface {
    Create(ctx context.Context, post *models.Post) error
    GetByID(ctx context.Context, id int32) (*models.Post, error)
    Update(ctx context.Context, post *models.Post) error
    SoftDelete(ctx context.Context, id int32) error
    GetFeed(ctx context.Context, followedUserIDs []int32, opts ListOptions) ([]*models.Post, int, error)
    GetByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Post, int, error)
    IncrementLikeCount(ctx context.Context, postID int32, delta int32) error
    IncrementCommentCount(ctx context.Context, postID int32, delta int32) error
    CountByUserID(ctx context.Context, userID int32) (int32, error)
}

// CommentRepository
type CommentRepository interface {
    Create(ctx context.Context, comment *models.Comment) error
    GetByID(ctx context.Context, id int32) (*models.Comment, error)
    SoftDelete(ctx context.Context, id int32) error
    GetByPostID(ctx context.Context, postID int32, opts ListOptions) ([]*models.Comment, int, error)
}

// LikeRepository
type LikeRepository interface {
    Create(ctx context.Context, like *models.PostLike) error
    Delete(ctx context.Context, userID, postID int32) error
    Exists(ctx context.Context, userID, postID int32) (bool, error)
    GetLikedPostIDs(ctx context.Context, userID int32, postIDs []int32) ([]int32, error)
}

// FollowRepository
type FollowRepository interface {
    Create(ctx context.Context, follow *models.UserFollow) error
    Delete(ctx context.Context, followerID, followingID int32) error
    Exists(ctx context.Context, followerID, followingID int32) (bool, error)
    GetFollowingIDs(ctx context.Context, userID int32) ([]int32, error)
    GetFollowerCount(ctx context.Context, userID int32) (int32, error)
    GetFollowingCount(ctx context.Context, userID int32) (int32, error)
}

// ReportRepository
type ReportRepository interface {
    Create(ctx context.Context, report *models.ContentReport) error
    ExistsByUser(ctx context.Context, userID int32, targetType string, targetID int32) (bool, error)
}
```

**Key implementation notes:**
- `GetFeed` query: `WHERE user_id IN (?) AND deleted_at IS NULL ORDER BY created_at DESC` with pagination
- `GetFeed` includes own posts: append current userID to followedUserIDs list
- `IncrementLikeCount/CommentCount`: use `gorm.Expr("like_count + ?", delta)` for atomic updates
- `GetLikedPostIDs`: batch check which posts in a list the user has liked (for feed rendering)
- All repos extend `BaseRepository` for error handling helpers

---

### Task 6: Community Service — `service/community_service.go`

**Files:**
- Create: `src/go-backend/domain/service/community_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go` — Add `CommunityService` interface
- Modify: `src/go-backend/domain/service/services.go` — Add `Community CommunityService` field

**Security notes per method:**
- `CreatePost`: Validate content length (1-2000), topic_tag against allowlist, image_url against Supabase pattern, strip HTML
- `UpdatePost`: Verify `post.UserID == userID` before allowing edit
- `DeletePost`: Verify `post.UserID == userID` before allowing delete
- `CreateComment`: Validate content length (1-500), strip HTML
- `DeleteComment`: Verify `comment.UserID == userID`
- `FollowUser`: Verify followerID != followingID (can't follow self)
- `ReportContent`: Verify reporter != content author, check not already reported
- `UpdateBio`: Validate length (0-200), strip HTML

**CommunityService interface:**
```go
type CommunityService interface {
    CreatePost(ctx context.Context, userID int32, req *v1.CreatePostRequest) (*v1.CreatePostResponse, error)
    UpdatePost(ctx context.Context, userID int32, req *v1.UpdatePostRequest) (*v1.UpdatePostResponse, error)
    DeletePost(ctx context.Context, userID int32, postID int32) error
    GetPost(ctx context.Context, userID int32, postID int32) (*v1.GetPostResponse, error)
    GetFeed(ctx context.Context, userID int32, req *v1.GetFeedRequest) (*v1.GetFeedResponse, error)
    GetUserPosts(ctx context.Context, userID int32, targetUserID int32, req *v1.GetUserPostsRequest) (*v1.GetUserPostsResponse, error)
    LikePost(ctx context.Context, userID int32, postID int32) error
    UnlikePost(ctx context.Context, userID int32, postID int32) error
    CreateComment(ctx context.Context, userID int32, req *v1.CreateCommentRequest) (*v1.CreateCommentResponse, error)
    DeleteComment(ctx context.Context, userID int32, commentID int32) error
    GetComments(ctx context.Context, userID int32, postID int32, req *v1.GetCommentsRequest) (*v1.GetCommentsResponse, error)
    FollowUser(ctx context.Context, followerID int32, followingID int32) error
    UnfollowUser(ctx context.Context, followerID int32, followingID int32) error
    GetProfile(ctx context.Context, userID int32, targetUserID int32) (*v1.GetCommunityProfileResponse, error)
    UpdateBio(ctx context.Context, userID int32, bio string) error
    ReportContent(ctx context.Context, userID int32, req *v1.ReportContentRequest) error
    GetUploadURL(ctx context.Context, userID int32, req *v1.GetUploadURLRequest) (*v1.GetUploadURLResponse, error)
}
```

**Constructor dependencies:**
```go
func NewCommunityService(
    postRepo repository.PostRepository,
    commentRepo repository.CommentRepository,
    likeRepo repository.LikeRepository,
    followRepo repository.FollowRepository,
    reportRepo repository.ReportRepository,
    userRepo repository.UserRepository,
    // supabaseClient for signed upload URLs (or config for Supabase Storage)
) CommunityService
```

**Feed generation logic:**
1. Get followed user IDs from FollowRepository
2. Append own userID to the list
3. Query posts from PostRepository.GetFeed with pagination
4. Batch check liked status via LikeRepository.GetLikedPostIDs
5. Enrich PostItem with user info, is_liked, is_own_post

**Topic tag allowlist:**
```go
var AllowedTopicTags = []string{
    "Chứng khoán VN", "Giao dịch Crypto", "Vàng & Bạc",
    "Ngân sách", "Tiết kiệm", "Bất động sản", "Bảo hiểm", "Tổng hợp",
}
```

---

### Task 7: Community Handlers — `handlers/community.go`

**Files:**
- Create: `src/go-backend/handlers/community.go`

**Handler struct:**
```go
type CommunityHandler struct {
    communityService service.CommunityService
}

func NewCommunityHandler(svc service.CommunityService) *CommunityHandler {
    return &CommunityHandler{communityService: svc}
}
```

**Endpoints (17 handler methods):**
- `CreatePost(c *gin.Context)` — POST /api/v1/community/posts
- `UpdatePost(c *gin.Context)` — PUT /api/v1/community/posts/:post_id
- `DeletePost(c *gin.Context)` — DELETE /api/v1/community/posts/:post_id
- `GetPost(c *gin.Context)` — GET /api/v1/community/posts/:post_id
- `GetFeed(c *gin.Context)` — GET /api/v1/community/feed
- `GetUserPosts(c *gin.Context)` — GET /api/v1/community/users/:user_id/posts
- `LikePost(c *gin.Context)` — POST /api/v1/community/posts/:post_id/like
- `UnlikePost(c *gin.Context)` — DELETE /api/v1/community/posts/:post_id/like
- `CreateComment(c *gin.Context)` — POST /api/v1/community/posts/:post_id/comments
- `DeleteComment(c *gin.Context)` — DELETE /api/v1/community/comments/:comment_id
- `GetComments(c *gin.Context)` — GET /api/v1/community/posts/:post_id/comments
- `FollowUser(c *gin.Context)` — POST /api/v1/community/users/:user_id/follow
- `UnfollowUser(c *gin.Context)` — DELETE /api/v1/community/users/:user_id/follow
- `GetProfile(c *gin.Context)` — GET /api/v1/community/users/:user_id/profile
- `UpdateBio(c *gin.Context)` — PUT /api/v1/community/profile/bio
- `ReportContent(c *gin.Context)` — POST /api/v1/community/report
- `GetUploadURL(c *gin.Context)` — POST /api/v1/community/upload-url

**Pattern per handler:**
1. `handler.GetUserID(c)` → extract user from JWT
2. `handler.BindAndValidate(c, &req)` → parse request
3. `h.communityService.Method(ctx, userID, &req)` → call service
4. `handler.Success(c, result)` / `handler.Created(c, result)` → return response

---

### Task 8: Wire DI & Routes

**Files:**
- Modify: `src/go-backend/handlers/builder.go` — Add `Community *CommunityHandler` to `AllHandlers`, wire in `NewHandlers()`
- Modify: `src/go-backend/handlers/routes.go` — Add community route group
- Modify: `src/go-backend/internal/app/providers.go` — Add community repos and service to providers
- Modify: `src/go-backend/domain/service/services.go` — Add `Community CommunityService` to `Services` struct

**Route registration (specific routes before parameterized):**
```go
community := v1.Group("/community")
community.Use(AuthMiddleware(authSrv))
community.Use(appmiddleware.RateLimitByUser(rateLimiter))
{
    // Feed
    community.GET("/feed", h.Community.GetFeed)

    // Posts — specific routes first
    community.POST("/posts", h.Community.CreatePost)
    community.GET("/posts/:post_id", h.Community.GetPost)
    community.PUT("/posts/:post_id", h.Community.UpdatePost)
    community.DELETE("/posts/:post_id", h.Community.DeletePost)

    // Likes
    community.POST("/posts/:post_id/like", h.Community.LikePost)
    community.DELETE("/posts/:post_id/like", h.Community.UnlikePost)

    // Comments
    community.POST("/posts/:post_id/comments", h.Community.CreateComment)
    community.GET("/posts/:post_id/comments", h.Community.GetComments)
    community.DELETE("/comments/:comment_id", h.Community.DeleteComment)

    // Users — specific routes first
    community.GET("/users/:user_id/posts", h.Community.GetUserPosts)
    community.GET("/users/:user_id/profile", h.Community.GetProfile)
    community.POST("/users/:user_id/follow", h.Community.FollowUser)
    community.DELETE("/users/:user_id/follow", h.Community.UnfollowUser)

    // Profile
    community.PUT("/profile/bio", h.Community.UpdateBio)

    // Report
    community.POST("/report", h.Community.ReportContent)

    // Upload
    community.POST("/upload-url", h.Community.GetUploadURL)
}
```

**Provider wiring:**
```go
// In ProvideRepositories:
postRepo := repository.NewPostRepository(db)
commentRepo := repository.NewCommentRepository(db)
likeRepo := repository.NewLikeRepository(db)
followRepo := repository.NewFollowRepository(db)
reportRepo := repository.NewReportRepository(db)

// In ProvideServices (Phase 1 — no service deps):
communitySvc := service.NewCommunityService(postRepo, commentRepo, likeRepo, followRepo, reportRepo, repos.User)

// In Services struct:
Community: communitySvc,
```

---

### Task 9: Frontend — Constants, Route & Navigation Restructure

**Files:**
- Modify: `src/wj-client/app/constants.tsx` — Add `community: "/dashboard/community"` to routes, add community ModalType constants
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx` — Add Community nav item to desktop sidebar and mobile slide-out menu
- Modify: `src/wj-client/components/navigation/BottomNav.tsx` — **Restructure from 6 items to 3 items:** Portfolio (left), Home (center), Community (right)
- Create: `src/wj-client/components/icons/CommunityIcon.tsx` — Community icon (use Lucide `newspaper` icon pattern)

**Bottom nav restructure (BREAKING CHANGE):**
- Reduce from 6 items to 3: Portfolio | Home | Community
- Each item gets `max-w-[33.33%]` (was `max-w-[16.66%]`)
- Removed items (Transactions, Wallets, Reports, Budget) remain accessible via:
  - Desktop sidebar navigation (unchanged)
  - Mobile slide-out hamburger menu (unchanged)
- Home stays as center item (most prominent position)
- Update `createNavItems()` function to return only 3 items

**Desktop sidebar nav item placement:**
- Add Community between existing nav items with correct `animationDelay` recalculated
- Mobile slide-out: Add to `navigationItems` array

**Constants additions:**
```typescript
export const routes = {
    // ... existing
    community: "/dashboard/community",
};

export const ModalType = {
    // ... existing
    CREATE_POST: "Create Post",
    EDIT_POST: "Edit Post",
    REPORT_CONTENT: "Report Content",
};
```

---

### Task 10: Frontend — Community Page Shell

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/community/page.tsx`
- Create: `src/wj-client/features/community/components/CommunityFeed.tsx` — Main feed container
- Create: `src/wj-client/features/community/components/CommunityLeftSidebar.tsx` — Desktop left sidebar (profile card + nav)
- Create: `src/wj-client/features/community/components/CommunityRightSidebar.tsx` — Desktop right sidebar (placeholder)
- Create: `src/wj-client/features/community/components/CommunityTabBar.tsx` — Mobile tab bar
- Create: `src/wj-client/features/community/utils/topic-tags.ts` — Topic tag constants
- Create: `src/wj-client/features/community/utils/time-format.ts` — Relative time formatting

**Desktop layout (3-column from design):**
```tsx
// page.tsx
<div className="flex flex-col h-full">
  {/* Mobile tab bar - shown below sm */}
  <CommunityTabBar className="sm:hidden" />

  {/* Desktop body - 3 column */}
  <div className="flex gap-6 p-6 sm:px-8">
    {/* Left sidebar - hidden on mobile */}
    <CommunityLeftSidebar className="hidden sm:block w-[280px] shrink-0" />

    {/* Center feed - fill width */}
    <div className="flex-1 min-w-0 flex flex-col gap-4">
      <CreatePostBox />
      <FeedList />
    </div>

    {/* Right sidebar - hidden on mobile, placeholder */}
    <CommunityRightSidebar className="hidden lg:block w-[280px] shrink-0" />
  </div>
</div>
```

**Topic tags constant:**
```typescript
export const TOPIC_TAGS = [
    { value: "Chứng khoán VN", label: "Chứng khoán VN", color: "bg-red-50 text-red-700" },
    { value: "Giao dịch Crypto", label: "Giao dịch Crypto", color: "bg-orange-50 text-orange-700" },
    { value: "Vàng & Bạc", label: "Vàng & Bạc", color: "bg-yellow-50 text-yellow-700" },
    { value: "Ngân sách", label: "Ngân sách", color: "bg-blue-50 text-blue-700" },
    { value: "Tiết kiệm", label: "Tiết kiệm", color: "bg-green-50 text-green-700" },
    { value: "Bất động sản", label: "Bất động sản", color: "bg-purple-50 text-purple-700" },
    { value: "Bảo hiểm", label: "Bảo hiểm", color: "bg-pink-50 text-pink-700" },
    { value: "Tổng hợp", label: "Tổng hợp", color: "bg-stone-100 text-stone-700" },
];
```

**Relative time formatting:**
```typescript
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    if (diff < 60) return "vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(timestamp * 1000).toLocaleDateString("vi-VN");
}
```

---

### Task 11: Frontend — PostCard Component

**Files:**
- Create: `src/wj-client/features/community/components/PostCard.tsx`
- Create: `src/wj-client/features/community/components/PostHeader.tsx`
- Create: `src/wj-client/features/community/components/PostBody.tsx`
- Create: `src/wj-client/features/community/components/PostActions.tsx`
- Create: `src/wj-client/features/community/components/PostEngagement.tsx`
- Create: `src/wj-client/features/community/components/TopicTag.tsx`
- Create: `src/wj-client/features/community/components/Avatar.tsx` — Gold gradient avatar with initials

**PostCard structure (from design analysis):**
```
PostCard (white bg, rounded-2xl on desktop, no radius on mobile)
  PostHeader: avatar (36-40px) + name + meta ("2h · Topic") + 3-dot menu
  PostBody: text content + optional image (h-[220px] desktop, h-[180px] mobile)
  PostEngagement: "243 lượt thích" + "56 bình luận"
  Divider
  PostActions: Like button + Comment button
```

**Styling tokens (from design):**
- Card bg: `bg-white` / `bg-v2-bg-surface`
- Text primary: `text-v2-text-primary` (#1C1917)
- Text secondary: `text-v2-text-secondary` (#57534E)
- Text tertiary: `text-v2-text-tertiary` (#78716C)
- Divider: `border-[#EDE8E1]`
- Avatar gradient: `bg-gradient-to-b from-[#B8860B] to-[#D4A017]`
- Liked heart: `text-[#DC2626]` (red-negative) filled
- Engagement counts: `font-jetbrains text-xs`
- Post text: `font-vietnam text-sm leading-relaxed`

---

### Task 12: Frontend — CreatePostBox & CreatePostForm

**Files:**
- Create: `src/wj-client/features/community/components/CreatePostBox.tsx` — Compact create post trigger
- Create: `src/wj-client/features/community/forms/CreatePostForm.tsx` — Full create post modal form
- Create: `src/wj-client/features/community/forms/EditPostForm.tsx` — Edit existing post
- Create: `src/wj-client/features/community/utils/community.schema.ts` — Zod validation schemas

**CreatePostBox (compact, always visible at top of feed):**
```
Avatar + "Chia sẻ kiến thức tài chính..." input placeholder + action row (Ảnh, Bình chọn, Cảm xúc)
```
Clicking opens CreatePostForm in a BaseModal.

**CreatePostForm (modal, from components.pen design):**
- Red-to-gold gradient top accent (4px)
- User avatar + name + visibility selector + topic tag
- Text area (max 2000 chars, char counter "0 / 2.000")
- Image upload area (dashed border, 140px height)
- Action bar: photo + poll (disabled Phase 3) + topic buttons | "Đăng bài" submit
- Uses `useMutationCreatePost` hook
- Image upload flow: call `GetUploadURL` → upload to Supabase → include URL in post

**Zod schemas:**
```typescript
export const createPostSchema = z.object({
    content: z.string().min(1).max(2000),
    topicTag: z.string().min(1),
    imageUrl: z.string().url().optional().or(z.literal("")),
});

export const editPostSchema = z.object({
    content: z.string().min(1).max(2000),
    topicTag: z.string().min(1),
    imageUrl: z.string().url().optional().or(z.literal("")),
});

export const createCommentSchema = z.object({
    content: z.string().min(1).max(500),
});

export const updateBioSchema = z.object({
    bio: z.string().max(200),
});

export const reportContentSchema = z.object({
    targetType: z.enum(["post", "comment"]),
    targetId: z.number(),
    reason: z.string().min(1),
});
```

---

### Task 13: Frontend — Like, Comment, Follow Hooks & Components

**Files:**
- Create: `src/wj-client/features/community/hooks/useLike.ts` — Optimistic like/unlike
- Create: `src/wj-client/features/community/hooks/useFollow.ts` — Follow/unfollow with optimistic update
- Create: `src/wj-client/features/community/hooks/useFeed.ts` — Feed data fetching with infinite scroll
- Create: `src/wj-client/features/community/components/CommentSection.tsx` — Comments list + add comment input
- Create: `src/wj-client/features/community/components/CommentBubble.tsx` — Individual comment display
- Create: `src/wj-client/features/community/components/FollowButton.tsx` — Follow/Unfollow toggle

**useLike hook (optimistic updates):**
```typescript
export function useLike(postId: number, initialIsLiked: boolean, initialCount: number) {
    const [isLiked, setIsLiked] = useState(initialIsLiked);
    const [count, setCount] = useState(initialCount);

    const likeMutation = useMutationLikePost();
    const unlikeMutation = useMutationUnlikePost();

    const toggle = () => {
        if (isLiked) {
            setIsLiked(false);
            setCount(c => c - 1);
            unlikeMutation.mutate({ postId }, { onError: () => { setIsLiked(true); setCount(c => c + 1); } });
        } else {
            setIsLiked(true);
            setCount(c => c + 1);
            likeMutation.mutate({ postId }, { onError: () => { setIsLiked(false); setCount(c => c - 1); } });
        }
    };

    return { isLiked, count, toggle };
}
```

**CommentSection layout (from design):**
- Comments list: avatar (24-32px) + speech bubble (bg-[#FAF9F7], rounded-xl, padding 8-12px)
- "Xem thêm bình luận" load more button (initial 5 comments)
- Add comment input at bottom: avatar + text input + send button

**FollowButton (from design):**
- Following: white bg, border, "Đang theo dõi" text
- Not following: red bg (#B91C1C), white text, "Theo dõi"
- Rounded-full (cornerRadius: 20px)

---

### Task 14: Frontend — Profile Card & Community Nav

**Files:**
- Create: `src/wj-client/features/community/components/ProfileCard.tsx` — Left sidebar profile card
- Create: `src/wj-client/features/community/components/CommunityNav.tsx` — Left sidebar navigation card
- Create: `src/wj-client/features/community/components/FeedEmpty.tsx` — Empty state when no posts
- Create: `src/wj-client/features/community/components/SuggestedUsersPlaceholder.tsx` — Right sidebar placeholder

**ProfileCard (from design):**
```
Banner (h-20, red gradient)
Avatar (72px, gold gradient, white 3px ring, -mt-9 overlap)
Name (font-vietnam text-lg font-bold)
Bio (font-vietnam text-[13px] text-v2-text-secondary)
Edit bio button (pill, border)
Divider
Stats row (space-around):
  - "24" (font-jetbrains text-xl font-bold) + "Bài viết" (text-xs)
  - "156" + "Người theo dõi"
  - "89" + "Đang theo dõi"
```

**CommunityNav (from design):**
Nav items with icons:
- Bảng tin (newspaper) — active: red bg, red text
- Hồ sơ (user)
- Bài đã lưu (bookmark) — disabled "Phase 2"
- Đang theo dõi (users)
- Thông báo (bell) — disabled "Phase 2"

---

### Task 15: Frontend — Mobile Layout

**Files:**
- Modify: `src/wj-client/features/community/components/CommunityTabBar.tsx` — Complete mobile tab bar
- Ensure all components from Tasks 11-14 are responsive (mobile-first with `sm:` breakpoint)

**Mobile specifics (from design):**
- Tab bar: 5 tabs (Bảng tin, Nhóm*, Hồ sơ, Thông báo*, Menu) — * disabled in Phase 1
- Post cards: full-width, no border-radius, separated by 8px gap (#FAF9F7)
- Post images: h-[180px] on mobile vs h-[220px] on desktop
- CreatePostBox: simplified, padding 12-16px
- No left/right sidebars — feed takes full width
- Bottom nav: 3-item layout (Portfolio | Home | Community) — restructured in Task 9

---

### Task 16: Create Runtime Flow Diagrams

**Files:**
- Create: `docs/architecture/flow-community.md`
- Modify: `docs/architecture/README.md` — Add to Dynamic Behavior Diagrams table

**Flow diagrams to create (from spec):**
1. **Create Post Flow** (sequenceDiagram) — User → Handler → Service (validate, optional image upload) → Repository → Response
2. **Feed Generation Flow** (sequenceDiagram) — User → Handler → Service (get following IDs, query posts, batch check likes) → Repository → Response
3. **Like/Unlike Flow** (sequenceDiagram) — User → Handler → Service (check exists, toggle, update count) → Repository → Response
4. **Follow/Unfollow Flow** (sequenceDiagram) — User → Handler → Service (validate not self, create/delete) → Repository → Response

Each diagram includes error paths, key invariants, and source file references.

---

### Task 17: Integration Testing & Cleanup

**Steps:**
1. Verify `go build ./...` succeeds
2. Verify `cd src/wj-client && npx tsc --noEmit` succeeds
3. Run backend tests: `cd src/go-backend && go test ./...`
4. Run frontend lint: `cd src/wj-client && npx next lint`
5. Manual smoke test: verify API endpoints respond correctly
6. Review all files for security issues (HTML injection, auth checks, ownership validation)
7. Update progress file to `completed`
8. Write implementation report

---

## Verification Plan

### Backend Verification
```bash
# Build
cd src/go-backend && go build ./...

# Run migration
task backend:migrate-community

# Test endpoints (with valid JWT)
curl -H "Authorization: Bearer $TOKEN" localhost:8080/api/v1/community/feed
curl -X POST -H "Authorization: Bearer $TOKEN" -d '{"content":"Test","topicTag":"Tổng hợp"}' localhost:8080/api/v1/community/posts
```

### Frontend Verification
```bash
cd src/wj-client
npx tsc --noEmit      # Type check
npx next lint          # Lint
npx next build         # Build
```

### Manual Test Scenarios
1. Navigate to `/dashboard/community` — see empty feed state
2. Create a text-only post — appears in feed
3. Create a post with image — image displays
4. Like/unlike a post — heart toggles, count updates
5. Comment on a post — comment appears
6. Follow a user from their profile — their posts appear in feed
7. Edit own post — content updates
8. Delete own post — removed from feed
9. Report another user's post — confirmation toast
10. View profile — stats display correctly
