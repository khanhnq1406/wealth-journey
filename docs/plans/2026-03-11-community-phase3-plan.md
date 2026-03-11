# Community Phase 3 — Advanced Features Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Implement five feature areas: Advanced Profile (cover photo, extended bio, tabbed post history), Image Upload (server-side via Supabase Storage), Real-Time Notifications (SSE + Redis Pub/Sub), Edit Comments, and Reply Threads (1-level deep nesting).

**Spec:** `docs/specs/2026-03-11-community-phase3-spec.md`

**Architecture:** Extends existing community module (DDD pattern: models → repository → service → handler). Backend adds new RPC methods to existing CommunityService. Frontend extends `features/community/` module with new components/hooks. Proto-first API with `task proto:all` code generation.

**Tech Stack:** Go 1.23 (Gin), PostgreSQL (GORM), Redis Pub/Sub, Supabase Storage, Next.js 15 (React 19), TypeScript 5, React Query, Tailwind CSS.

## Security Implementation Notes

- **Authentication:** All endpoints behind JWT auth middleware (existing pattern)
- **Authorization:** Comment edit/delete requires ownership check (`comment.UserID == userID`). Profile update requires own profile. Upload requires authenticated user.
- **Input validation:** Server-side validation for all inputs: image magic bytes (not just extension), content length limits (1-500 chars for comments, 0-200 chars for bio, 0-100 for location, 0-200 for website URL), URL regex for website field.
- **Data sanitization:** All text fields through `validator.SanitizeStringField()` (existing XSS prevention). Image EXIF metadata stripped during server-side processing.
- **Rate limiting:** Upload endpoint: max 10 per user per minute. SSE: max 1 connection per user.
- **File upload security:** Magic bytes validation, 5MB size limit, image-only MIME types, UUID-based filenames (no user input in paths).

---

### Task 0: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**
1. Update backend L3 diagram: add `UploadImage`, `UpdateComment`, `GetReplies`, `GetLikedPosts`, `UpdateProfile`, `StreamNotifications` to CommunityHandler/CommunityService. Add `Redis Pub/Sub` as infrastructure component. Add `Supabase Storage` as external storage.
2. Update frontend L3 diagram: add Phase 3 components (`ImageUpload`, `EditCommentForm`, `ReplyBubble`, `ReplyInput`, `ProfileEditModal`, `ProfileTabs`). Add hooks (`useNotificationStream`, `useImageUpload`). Update existing component descriptions.
3. Commit diagram changes.

---

### Task 1: Database Migration — Add Phase 3 Columns

**Files:**
- Create: `src/go-backend/cmd/migrate-community-phase3/main.go`
- Modify: `src/go-backend/domain/models/user.go`
- Modify: `src/go-backend/domain/models/comment.go`

**Security notes:** Database migration adds nullable columns only — no data loss risk. FK constraint with CASCADE on `parent_comment_id` for data integrity.

**Step 1: Update User model**
Add `CoverPhotoURL`, `Location`, `Website` fields to User struct.

```go
// In user.go, add after Bio field:
CoverPhotoURL string `gorm:"size:500" json:"coverPhotoUrl"`
Location      string `gorm:"size:100" json:"location"`
Website       string `gorm:"size:200" json:"website"`
```

**Step 2: Update Comment model**
Add `ParentCommentID`, `ReplyCount`, `UpdatedAt` fields to Comment struct.

```go
// In comment.go, add after Content field:
ParentCommentID *int32         `gorm:"index:idx_comment_parent_id" json:"parentCommentId,omitempty"`
ReplyCount      int32          `gorm:"not null;default:0" json:"replyCount"`
UpdatedAt       *time.Time     `json:"updatedAt,omitempty"`
// Add self-referential relationship:
ParentComment   *Comment       `gorm:"foreignKey:ParentCommentID" json:"parentComment,omitempty"`
```

**Step 3: Create migration script**
Create `cmd/migrate-community-phase3/main.go` that:
- Adds `cover_photo_url`, `location`, `website` columns to `user` table
- Adds `parent_comment_id`, `reply_count`, `updated_at` columns to `comment` table
- Creates index `idx_comment_parent_id` on `parent_comment_id`
- Adds FK constraint `fk_comment_parent` on `comment.parent_comment_id` → `comment.id` with `ON DELETE CASCADE`

**Step 4: Add migration task to Taskfile.yml**
Add `backend:migrate-community-phase3` task.

**Step 5: Commit**

---

### Task 2: Proto — Phase 3 Message Types & RPCs

**Files:**
- Modify: `api/protobuf/v1/community.proto`

**Security notes:** New fields on existing messages are backward-compatible (proto3 defaults). SSE endpoint uses query param auth (documented risk in spec).

**Step 1: Update existing message types**

Add to `CommentItem`:
```protobuf
int32 parentCommentId = 9 [json_name = "parentCommentId"];
int32 replyCount = 10 [json_name = "replyCount"];
int64 updatedAt = 11 [json_name = "updatedAt"];
bool isEdited = 12 [json_name = "isEdited"];
```

Add to `CommunityProfile`:
```protobuf
string coverPhotoUrl = 10 [json_name = "coverPhotoUrl"];
string location = 11 [json_name = "location"];
string website = 12 [json_name = "website"];
```

Update `CreateCommentRequest`:
```protobuf
int32 parentCommentId = 3 [json_name = "parentCommentId"];
```

**Step 2: Add new message types**

```protobuf
// UpdateComment
message UpdateCommentRequest {
  int32 commentId = 1 [json_name = "commentId"];
  string content = 2 [json_name = "content"];
}

message UpdateCommentResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  CommentItem data = 3 [json_name = "data"];
  string timestamp = 4 [json_name = "timestamp"];
}

// GetReplies
message GetRepliesRequest {
  int32 commentId = 1 [json_name = "commentId"];
  wealthjourney.common.v1.PaginationParams pagination = 2 [json_name = "pagination"];
}

message GetRepliesResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated CommentItem replies = 3 [json_name = "replies"];
  wealthjourney.common.v1.PaginationResult pagination = 4 [json_name = "pagination"];
  string timestamp = 5 [json_name = "timestamp"];
}

// GetLikedPosts
message GetLikedPostsRequest {
  int32 userId = 1 [json_name = "userId"];
  wealthjourney.common.v1.PaginationParams pagination = 2 [json_name = "pagination"];
}

message GetLikedPostsResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated PostItem posts = 3 [json_name = "posts"];
  wealthjourney.common.v1.PaginationResult pagination = 4 [json_name = "pagination"];
  string timestamp = 5 [json_name = "timestamp"];
}

// UpdateProfile
message UpdateProfileRequest {
  string bio = 1 [json_name = "bio"];
  string location = 2 [json_name = "location"];
  string website = 3 [json_name = "website"];
  string picture = 4 [json_name = "picture"];
  string coverPhotoUrl = 5 [json_name = "coverPhotoUrl"];
}

message UpdateProfileResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  CommunityProfile data = 3 [json_name = "data"];
  string timestamp = 4 [json_name = "timestamp"];
}

// UploadImage
message UploadImageRequest {
  string purpose = 1 [json_name = "purpose"];
}

message UploadImageResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  string imageUrl = 3 [json_name = "imageUrl"];
  string timestamp = 4 [json_name = "timestamp"];
}
```

**Step 3: Add new RPCs to CommunityService**

```protobuf
// Phase 3
rpc UpdateComment(UpdateCommentRequest) returns (UpdateCommentResponse) {
  option (google.api.http) = {
    put: "/api/v1/community/comments/{commentId}"
    body: "*"
  };
}

rpc GetReplies(GetRepliesRequest) returns (GetRepliesResponse) {
  option (google.api.http) = {
    get: "/api/v1/community/comments/{commentId}/replies"
  };
}

rpc GetLikedPosts(GetLikedPostsRequest) returns (GetLikedPostsResponse) {
  option (google.api.http) = {
    get: "/api/v1/community/users/{userId}/liked-posts"
  };
}

rpc UpdateProfile(UpdateProfileRequest) returns (UpdateProfileResponse) {
  option (google.api.http) = {
    put: "/api/v1/community/profile"
    body: "*"
  };
}

rpc UploadImage(UploadImageRequest) returns (UploadImageResponse) {
  option (google.api.http) = {
    post: "/api/v1/community/upload"
    body: "*"
  };
}
```

**Step 4: Remove deprecated RPCs**
Remove `GetUploadURL` RPC and its request/response messages. Remove `UpdateBio` RPC (replaced by `UpdateProfile`).

**Step 5: Run `task proto:all` to generate code**
Verify generated Go and TypeScript types compile.

**Step 6: Commit**

---

### Task 3: Backend — Image Upload Service

**Files:**
- Create: `src/go-backend/pkg/imaging/imaging.go` (image processing: validate, resize, strip EXIF)
- Modify: `src/go-backend/domain/service/community_service.go` (add UploadImage method)
- Modify: `src/go-backend/domain/service/interfaces.go` (update CommunityService interface)
- Modify: `src/go-backend/handlers/community.go` (add UploadImage handler)
- Modify: `src/go-backend/handlers/routes.go` (add upload route)

**Security notes:**
- Validate magic bytes (not just Content-Type header) — T-1 in threat model
- Enforce 5MB limit in Gin MaxMultipartMemory — T-2
- Strip EXIF metadata (GPS, personal data) — T-3
- UUID-based filenames, no user input in storage paths
- Rate limit: 10 uploads/min/user

**Step 1: Create imaging package**
`pkg/imaging/imaging.go`:
- `ValidateMagicBytes(data []byte) (string, error)` — check JPEG/PNG/WebP/GIF magic bytes, return detected MIME type
- `ResizeImage(data []byte, maxWidth int) ([]byte, error)` — resize if wider than maxWidth, maintain aspect ratio, strip EXIF
- Add `github.com/disintegration/imaging` dependency

```go
// Magic byte signatures
var magicBytes = map[string][]byte{
    "image/jpeg": {0xFF, 0xD8, 0xFF},
    "image/png":  {0x89, 0x50, 0x4E, 0x47},
    "image/gif":  {0x47, 0x49, 0x46},
    "image/webp": {0x52, 0x49, 0x46, 0x46}, // RIFF header (check "WEBP" at offset 8)
}
```

**Step 2: Add UploadImage to CommunityService interface**
```go
UploadImage(ctx context.Context, userID int32, fileData []byte, purpose string, filename string) (string, error)
```

**Step 3: Implement UploadImage service method**
- Validate purpose (whitelist: "post", "avatar", "cover")
- Validate magic bytes via `imaging.ValidateMagicBytes()`
- Validate size (5MB max)
- Determine max width by purpose: avatar=400, cover=1920, post=2048
- Resize via `imaging.ResizeImage()`
- Generate storage key: `community/{purpose}/{userId}/{uuid}.{ext}`
- Upload via existing `StorageProvider.Upload()`
- Return public URL

**Step 4: Wire storage provider into CommunityService**
Update `NewCommunityService()` constructor to accept `storage.StorageProvider`. Update `providers.go` and `services.go` to pass storage provider.

**Step 5: Add UploadImage handler**
Handler reads multipart/form-data (not JSON), extracts file + purpose field, calls service, returns `UploadImageResponse`.

```go
func (h *CommunityHandler) UploadImage(c *gin.Context) {
    // Parse multipart form (5MB limit)
    c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 5<<20)
    file, header, err := c.Request.FormFile("file")
    // Read file bytes, get purpose from form
    // Call service.UploadImage()
    // Return response
}
```

**Step 6: Register upload route**
```go
community.POST("/upload", h.Community.UploadImage)
```
Remove old `/upload-url` route.

**Step 7: Commit**

---

### Task 4: Backend — Edit Comment (UpdateComment)

**Files:**
- Modify: `src/go-backend/domain/repository/comment_repository.go` (add Update method)
- Modify: `src/go-backend/domain/repository/interfaces.go` (add Update to CommentRepository)
- Modify: `src/go-backend/domain/service/community_service.go` (add UpdateComment)
- Modify: `src/go-backend/domain/service/interfaces.go` (add UpdateComment to CommunityService)
- Modify: `src/go-backend/handlers/community.go` (add UpdateComment handler)
- Modify: `src/go-backend/handlers/routes.go` (add route)

**Security notes:**
- Authorization: Only comment owner can edit (403 for others)
- Content validation: 1-500 chars, sanitized via `SanitizeStringField`
- XSS prevention: same sanitization as CreateComment — T-7

**Step 1: Add Update method to CommentRepository**
```go
func (r *commentRepository) Update(ctx context.Context, comment *models.Comment) error {
    return r.db.DB.WithContext(ctx).Save(comment).Error
}
```

Add to interface:
```go
Update(ctx context.Context, comment *models.Comment) error
```

**Step 2: Implement UpdateComment service**
```go
func (s *communityService) UpdateComment(ctx context.Context, userID int32, req *v1.UpdateCommentRequest) (*v1.UpdateCommentResponse, error) {
    comment, err := s.commentRepo.GetByID(ctx, req.CommentId)
    // Authorization: comment.UserID != userID → 403
    // Validate & sanitize content (1-500 chars)
    // Set comment.Content, set comment.UpdatedAt = &now
    // Save via commentRepo.Update()
    // Return response with updated CommentItem
}
```

**Step 3: Add handler and route**
Handler: parse commentId from URL, bind request body, call service.
Route: `community.PUT("/comments/:comment_id", h.Community.UpdateComment)`

**Step 4: Update commentToProto helper**
Add `parentCommentId`, `replyCount`, `updatedAt`, `isEdited` fields to CommentItem mapping.

**Step 5: Commit**

---

### Task 5: Backend — Reply Threads (CreateComment extension + GetReplies)

**Files:**
- Modify: `src/go-backend/domain/repository/comment_repository.go` (add GetReplies, IncrementReplyCount, GetByParentID)
- Modify: `src/go-backend/domain/repository/interfaces.go` (add new methods to CommentRepository)
- Modify: `src/go-backend/domain/service/community_service.go` (extend CreateComment, add GetReplies, update DeleteComment)
- Modify: `src/go-backend/domain/service/interfaces.go` (add GetReplies)
- Modify: `src/go-backend/handlers/community.go` (add GetReplies handler)
- Modify: `src/go-backend/handlers/routes.go` (add route)

**Security notes:**
- Validate parentCommentId belongs to same post — T-8 (cross-post reply prevention)
- If parentCommentId points to a reply, redirect to root parent (prevent nesting > 1)
- Atomic reply_count increment/decrement — T-9
- Cascade: deleting parent comment cascades via FK (reply_count on post needs manual adjustment)

**Step 1: Add repository methods**

```go
// GetByParentID returns replies for a parent comment (paginated)
func (r *commentRepository) GetByParentID(ctx context.Context, parentID int32, opts ListOptions) ([]*models.Comment, int, error)

// IncrementReplyCount atomically increments/decrements reply_count
func (r *commentRepository) IncrementReplyCount(ctx context.Context, commentID int32, delta int32) error
```

Add to interface:
```go
GetByParentID(ctx context.Context, parentID int32, opts ListOptions) ([]*models.Comment, int, error)
IncrementReplyCount(ctx context.Context, commentID int32, delta int32) error
```

**Step 2: Extend CreateComment service**

When `req.ParentCommentId > 0`:
1. Fetch parent comment via `commentRepo.GetByID(parentCommentId)`
2. Validate parent belongs to same post (`parent.PostID == req.PostId`)
3. If parent has its own parent (is a reply), use parent's parent as the actual parent (flatten to 1 level)
4. Create comment with `ParentCommentID` set
5. Atomically increment parent's `reply_count`
6. Increment post's `comment_count` (replies count toward total)
7. Create "reply" notification to parent comment's author (if not self)

**Step 3: Update DeleteComment service**

When deleting a reply (has `ParentCommentID`):
1. Decrement parent's `reply_count`
2. Decrement post's `comment_count`

When deleting a root comment with replies:
1. FK CASCADE handles reply deletion
2. Decrement post's `comment_count` by `1 + comment.ReplyCount`

**Step 4: Implement GetReplies service**
```go
func (s *communityService) GetReplies(ctx context.Context, userID int32, commentID int32, req *v1.GetRepliesRequest) (*v1.GetRepliesResponse, error) {
    // Validate comment exists
    // Fetch replies via commentRepo.GetByParentID()
    // Map to CommentItem proto with ownership flag
    // Return paginated response
}
```

**Step 5: Add handler and route**
Route: `community.GET("/comments/:comment_id/replies", h.Community.GetReplies)`

**Step 6: Update GetComments to exclude replies**
Modify `commentRepo.GetByPostID()` to only return root comments (WHERE `parent_comment_id IS NULL`).

**Step 7: Commit**

---

### Task 6: Backend — Advanced Profile (UpdateProfile + GetLikedPosts)

**Files:**
- Modify: `src/go-backend/domain/repository/interfaces.go` (add GetLikedPosts to LikeRepository)
- Modify: `src/go-backend/domain/repository/like_repository.go` (add GetLikedPosts)
- Modify: `src/go-backend/domain/service/community_service.go` (add UpdateProfile, GetLikedPosts, remove UpdateBio)
- Modify: `src/go-backend/domain/service/interfaces.go` (add/remove methods)
- Modify: `src/go-backend/handlers/community.go` (add UpdateProfile, GetLikedPosts handlers, remove UpdateBio/GetUploadURL)
- Modify: `src/go-backend/handlers/routes.go` (add/update routes)

**Security notes:**
- UpdateProfile: only own profile (enforced by JWT userID)
- Website field: validate URL pattern (regex on server-side)
- Cover photo URL: validate it starts with known Supabase base URL prefix
- Bio/location/website: sanitize via SanitizeStringField

**Step 1: Add GetLikedPosts to LikeRepository**
```go
// GetLikedPosts returns post IDs that a user has liked (paginated, ordered by like creation time DESC)
func (r *likeRepository) GetLikedPosts(ctx context.Context, userID int32, opts ListOptions) ([]int32, int, error)
```

**Step 2: Implement UpdateProfile service**
```go
func (s *communityService) UpdateProfile(ctx context.Context, userID int32, req *v1.UpdateProfileRequest) (*v1.UpdateProfileResponse, error) {
    user, err := s.userRepo.GetByID(ctx, userID)
    // Validate & sanitize: bio (0-200), location (0-100), website (0-200, URL pattern)
    // Validate coverPhotoUrl starts with Supabase base URL (if provided)
    // Update user fields (only set non-empty fields)
    // Save via userRepo.Update()
    // Return UpdateProfileResponse with CommunityProfile
}
```

**Step 3: Implement GetLikedPosts service**
```go
func (s *communityService) GetLikedPosts(ctx context.Context, userID int32, targetUserID int32, req *v1.GetLikedPostsRequest) (*v1.GetLikedPostsResponse, error) {
    // Get liked post IDs via likeRepo.GetLikedPosts()
    // Batch fetch posts via postRepo.GetByIDs()
    // Enrich with isLiked, isFollowing, isSaved for viewer
    // Return paginated PostItem list
}
```

**Step 4: Add handlers and routes**
- `community.PUT("/profile", h.Community.UpdateProfile)` — replaces `/profile/bio`
- `community.GET("/users/:user_id/liked-posts", h.Community.GetLikedPosts)`
- Remove `/profile/bio` route and `UpdateBio` handler
- Remove `/upload-url` route and `GetUploadURL` handler

**Step 5: Update GetProfile (GetCommunityProfile) to include new fields**
Add `coverPhotoUrl`, `location`, `website` to the CommunityProfile proto mapping.

**Step 6: Commit**

---

### Task 7: Backend — Real-Time Notifications (SSE + Redis Pub/Sub)

**Files:**
- Modify: `src/go-backend/pkg/redis/redis.go` (add Pub/Sub methods)
- Modify: `src/go-backend/domain/service/community_service.go` (publish notifications to Redis)
- Modify: `src/go-backend/handlers/community.go` (add StreamNotifications SSE handler)
- Modify: `src/go-backend/handlers/routes.go` (add SSE route)

**Security notes:**
- SSE auth via `?token=` query param (EventSource API limitation) — T-5
- Do NOT log the token query param in access logs
- Subscribe only to `user:{authenticatedUserID}` channel (never user-supplied channel) — T-6
- Goroutine cleanup on client disconnect via `c.Request.Context().Done()` — T-4 (SSE goroutine leak)
- Rate limit: max 1 SSE connection per user (reject with 409)

**Step 1: Add Pub/Sub methods to RedisClient**
```go
// Publish publishes a message to a Redis channel
func (r *RedisClient) Publish(channel string, message interface{}) error {
    data, err := json.Marshal(message)
    return r.client.Publish(r.ctx, channel, data).Err()
}

// Subscribe returns a PubSub for the given channel
func (r *RedisClient) Subscribe(channel string) *redis.PubSub {
    return r.client.Subscribe(r.ctx, channel)
}
```

**Step 2: Publish notifications from service layer**
After creating each notification (like, comment, follow, share, reply), publish to `user:{userId}:notifications` channel with serialized NotificationItem.

Wire RedisClient into CommunityService constructor (update `NewCommunityService` signature, `services.go`, `providers.go`).

**Step 3: Implement StreamNotifications SSE handler**
```go
func (h *CommunityHandler) StreamNotifications(c *gin.Context) {
    // Auth: validate JWT from ?token= query param
    // Set SSE headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
    // Subscribe to user:{userID}:notifications Redis channel
    // Loop:
    //   - On message: write "event: notification\ndata: {json}\n\n"
    //   - On 30s tick: write ":ping\n\n" (heartbeat)
    //   - On c.Request.Context().Done(): cleanup and return
    // Unsubscribe on exit
}
```

**Step 4: Register SSE route**
```go
// SSE route — outside rate limiter middleware (long-lived connection)
community.GET("/notifications/stream", h.Community.StreamNotifications)
```

Note: The SSE route must be registered BEFORE the rate-limit middleware is applied, or use a separate route group without rate limiting.

**Step 5: Commit**

---

### Task 8: Frontend — Proto Regeneration & API Hooks

**Files:**
- Run: `task proto:all`
- Verify: `src/wj-client/gen/protobuf/v1/community.ts` (new types)
- Verify: `src/wj-client/utils/generated/hooks.ts` (new hooks)

**Step 1: Regenerate proto types and hooks**
```bash
task proto:all
```

**Step 2: Verify generated TypeScript types include:**
- Updated `CommentItem` with `parentCommentId`, `replyCount`, `updatedAt`, `isEdited`
- Updated `CommunityProfile` with `coverPhotoUrl`, `location`, `website`
- New types: `UpdateCommentRequest/Response`, `GetRepliesRequest/Response`, `GetLikedPostsRequest/Response`, `UpdateProfileRequest/Response`, `UploadImageRequest/Response`

**Step 3: Verify generated hooks include:**
- `useMutationUpdateComment`
- `useQueryGetReplies`
- `useQueryGetLikedPosts`
- `useMutationUpdateProfile`
- `useMutationUploadImage` (Note: this won't work for multipart — we'll need a custom hook)

**Step 4: Commit**

---

### Task 9: Frontend — Image Upload Hook & Component

**Files:**
- Create: `src/wj-client/features/community/hooks/useImageUpload.ts`
- Create: `src/wj-client/features/community/components/ImageUpload.tsx`
- Modify: `src/wj-client/features/community/forms/CreatePostForm.tsx` (integrate image upload)
- Modify: `src/wj-client/features/community/forms/EditPostForm.tsx` (integrate image upload)

**Security notes:** Client-side file type check is UX only — server validates magic bytes. Client-side size check prevents unnecessary upload attempts.

**Step 1: Create useImageUpload hook**
Custom hook (NOT auto-generated — multipart/form-data needs manual fetch):
```typescript
export function useImageUpload() {
  // State: uploading, progress, error, imageUrl
  // uploadImage(file: File, purpose: 'post' | 'avatar' | 'cover'): Promise<string>
  // Uses fetch() with FormData (not React Query mutation — needs progress tracking)
  // Client-side validation: file type (JPEG/PNG/WebP/GIF), size (5MB)
  // Progress tracking via XMLHttpRequest onprogress
  // Returns public URL on success
}
```

**Step 2: Create ImageUpload component**
```typescript
// Drag-and-drop zone + click-to-select file input
// Image preview after selection (before upload)
// Upload progress bar
// X button to remove selected image
// Props: purpose, onUpload(url: string), onRemove()
```

**Step 3: Integrate into CreatePostForm**
Replace URL input with `ImageUpload` component. On form submit, if image selected but not uploaded yet, upload first then create post with returned URL.

**Step 4: Integrate into EditPostForm**
Same pattern. Show existing image if post has one. Allow replacing or removing.

**Step 5: Commit**

---

### Task 10: Frontend — Edit Comment UI

**Files:**
- Modify: `src/wj-client/features/community/components/CommentBubble.tsx` (add edit mode)
- Create: `src/wj-client/features/community/components/EditCommentForm.tsx`
- Modify: `src/wj-client/features/community/utils/community.schema.ts` (add edit comment schema)

**Step 1: Add edit comment Zod schema**
```typescript
export const editCommentSchema = z.object({
  content: z.string().min(1).max(500),
});
```

**Step 2: Create EditCommentForm component**
Inline textarea that replaces comment text. Save/Cancel buttons. Uses `useMutationUpdateComment` hook.

**Step 3: Update CommentBubble**
- Add 3-dot menu (or long-press on mobile) for own comments
- Menu options: "Edit", "Delete" (existing)
- "Edit" toggles inline edit mode → shows EditCommentForm
- Show "(edited)" label next to timestamp when `isEdited` is true

**Step 4: Commit**

---

### Task 11: Frontend — Reply Thread UI

**Files:**
- Create: `src/wj-client/features/community/components/ReplyBubble.tsx`
- Create: `src/wj-client/features/community/components/ReplyInput.tsx`
- Create: `src/wj-client/features/community/components/ReplyList.tsx`
- Modify: `src/wj-client/features/community/components/CommentBubble.tsx` (add Reply button)
- Modify: `src/wj-client/features/community/components/CommentSection.tsx` (integrate replies)

**Step 1: Create ReplyInput component**
Inline textarea below comment, appears when "Reply" button clicked. Uses `useMutationCreateComment` with `parentCommentId` field.

**Step 2: Create ReplyBubble component**
Similar to CommentBubble but with `ml-8 sm:ml-8` (32px) indentation. Supports edit/delete if own. No "Reply" button on replies (replies to replies become siblings).

**Step 3: Create ReplyList component**
- "N replies" toggle link that expands/collapses
- Lazy loads replies on expand via `useQueryGetReplies`
- Paginated: 5 per page with "Load more" button
- Shows ReplyBubble for each reply

**Step 4: Update CommentBubble**
Add "Reply" button below each root comment (not on replies). Clicking opens ReplyInput inline.

**Step 5: Update CommentSection**
Integrate ReplyList below each root CommentBubble. Pass replyCount from comment data.

**Step 6: Commit**

---

### Task 12: Frontend — Advanced Profile (Cover Photo, Extended Fields, Tabs)

**Files:**
- Modify: `src/wj-client/features/community/components/ProfileView.tsx` (cover photo, extended info, tabs)
- Create: `src/wj-client/features/community/components/ProfileEditModal.tsx`
- Create: `src/wj-client/features/community/components/ProfileTabs.tsx`
- Modify: `src/wj-client/features/community/components/ProfileCard.tsx` (cover photo in sidebar)
- Modify: `src/wj-client/features/community/utils/community.schema.ts` (profile edit schema)

**Step 1: Add profile edit schema**
```typescript
export const editProfileSchema = z.object({
  bio: z.string().max(200).optional(),
  location: z.string().max(100).optional(),
  website: z.string().max(200).url().optional().or(z.literal('')),
});
```

**Step 2: Create ProfileEditModal**
Modal with fields: bio textarea, location input, website input, avatar upload (ImageUpload component), cover photo upload (ImageUpload component). Uses `useMutationUpdateProfile`.

**Step 3: Create ProfileTabs component**
3 tabs: Posts (default), Likes, Shared.
- Posts: uses existing `useQueryGetUserPosts`
- Likes: uses `useQueryGetLikedPosts`
- Shared: uses `useQueryGetUserPosts` and filters for shared posts (client-side filter on `sharedPost` presence)
- Each tab has independent pagination
- Active tab state lifted to parent to survive tab switches

**Step 4: Update ProfileView**
- Cover photo: full-width banner at top (height 120px mobile, 160px desktop). Gradient fallback if no cover photo.
- "Edit cover photo" camera icon overlay on own profile
- Avatar overlaps cover photo (negative margin)
- Location + website displayed below bio (with icons)
- "Edit Profile" button opens ProfileEditModal (replaces inline bio editing)
- ProfileTabs below profile header

**Step 5: Update ProfileCard (sidebar)**
Show cover photo as small banner at top of sidebar card.

**Step 6: Commit**

---

### Task 13: Frontend — Real-Time Notification Stream (SSE)

**Files:**
- Create: `src/wj-client/features/community/hooks/useNotificationStream.ts`
- Modify: `src/wj-client/features/community/hooks/useNotifications.ts` (integrate SSE)
- Modify: `src/wj-client/features/community/components/NotificationBell.tsx` (if exists, or the notification UI component)

**Step 1: Create useNotificationStream hook**
```typescript
export function useNotificationStream() {
  // Connects to SSE endpoint with JWT token via ?token= query param
  // On "notification" event: parse JSON, update React Query cache:
  //   - Increment unread count
  //   - Prepend to notification list
  // Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s)
  // Graceful fallback: if SSE fails, existing 30s polling continues
  // Cleanup: close EventSource on unmount
}
```

**Step 2: Integrate into notification system**
- Mount `useNotificationStream` in the community layout or dashboard layout where notifications are consumed
- Keep existing polling as fallback (don't remove)
- SSE updates are additive to React Query cache

**Step 3: Commit**

---

### Task 14: Create/Update Runtime Flow Diagrams

**Files:**
- Modify: `docs/architecture/flow-community.md`

**Steps:**
1. Update **"Create Post" flow** — Add image upload step before post creation
2. Update **"View User Profile" flow** — Add tabbed content loading (Posts/Likes/Shared)
3. Add **"Image Upload Flow"** — `sequenceDiagram`: Browser → Gin handler → validate magic bytes → resize → Supabase Storage → return URL
4. Add **"SSE Notification Flow"** — `sequenceDiagram`: Action trigger → Service creates notification → Redis Publish → SSE handler → Browser EventSource
5. Add **"Reply Thread Flow"** — `sequenceDiagram`: User creates reply → Service validates parent → creates comment with parentId → increments reply_count → notification
6. Add **"Edit Comment Flow"** — `sequenceDiagram`: User submits edit → Service validates ownership → updates content + updated_at → response
7. Each new diagram includes error paths and key invariants table
8. Commit diagram changes

---

### Task 15: Backend Cleanup & Integration Verification

**Files:**
- Modify: `src/go-backend/domain/service/community_service.go` (remove deprecated methods)
- Modify: `src/go-backend/domain/service/interfaces.go` (remove deprecated methods)
- Modify: `src/go-backend/handlers/community.go` (remove deprecated handlers)

**Steps:**
1. Remove `UpdateBio` service method (replaced by `UpdateProfile`)
2. Remove `GetUploadURL` service method (replaced by `UploadImage`)
3. Remove corresponding handlers
4. Verify all new routes are registered correctly
5. Verify `go build ./...` succeeds
6. Verify `task proto:all` produces clean output
7. Commit

---

### Task 16: Frontend Build Verification

**Files:** All frontend files from Tasks 8-13

**Steps:**
1. Run `cd src/wj-client && npm run build` to verify no TypeScript errors
2. Fix any type errors from proto changes (e.g., removed `GetUploadURL` hook references)
3. Verify all new components are properly exported and imported
4. Commit fixes if any

---

### Task 17: Write Implementation Report

**Files:**
- Create: `docs/reports/2026-03-11-community-phase3-report.md`

**Steps:**
1. Summarize all tasks completed
2. List all files created/modified
3. Security implementation summary (validation, auth, rate limiting)
4. Known issues / technical debt (old image cleanup deferred, SSE token optimization deferred)
5. Manual testing steps

---

## Task Dependency Graph

```
Task 0 (C4 diagrams) ─────────── independent
Task 1 (DB migration) ─────────── must be first (schema changes)
Task 2 (Proto) ────────────────── after Task 1 (needs updated models)
Task 3 (Image upload backend) ──── after Task 2 (needs proto types)
Task 4 (Edit comment backend) ──── after Task 2 (needs proto types)
Task 5 (Reply threads backend) ─── after Task 4 (extends comment logic)
Task 6 (Profile backend) ─────── after Task 2 (needs proto types)
Task 7 (SSE backend) ─────────── after Task 2 (needs proto types)
Task 8 (Proto regen frontend) ──── after Task 2 (needs updated .proto)
Task 9 (Image upload frontend) ── after Task 3, Task 8 (needs backend + hooks)
Task 10 (Edit comment frontend) ── after Task 4, Task 8 (needs backend + hooks)
Task 11 (Reply thread frontend) ── after Task 5, Task 8 (needs backend + hooks)
Task 12 (Profile frontend) ────── after Task 6, Task 8, Task 9 (needs backend + hooks + image upload)
Task 13 (SSE frontend) ───────── after Task 7, Task 8 (needs backend + hooks)
Task 14 (Flow diagrams) ─────── after Tasks 3-7 (needs implemented service code)
Task 15 (Backend cleanup) ────── after Tasks 3-7 (all backend done)
Task 16 (Frontend build verify) ── after Tasks 9-13 (all frontend done)
Task 17 (Report) ──────────────── last
```

**Parallelization opportunities:**
- Tasks 3, 4, 6, 7 can run in parallel (independent backend features, all depend on Task 2)
- Task 5 depends on Task 4 only (reply extends comments)
- Tasks 9, 10, 11, 12, 13 can partially overlap (different files) but Task 12 depends on Task 9

---

**Created:** 2026-03-11
**Author:** WealthJourney Team
**Status:** Draft — pending user approval
