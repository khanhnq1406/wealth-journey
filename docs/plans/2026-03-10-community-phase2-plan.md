# Community Phase 2 (Social) — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add social engagement features to the existing community module — share/repost, in-app notifications, saved posts, suggested users, and trending topics (hashtags).

**Spec:** `docs/specs/2026-03-10-community-phase2-spec.md`

**Architecture:** Extends existing `community.proto` with 9 new RPCs and 5 new PostItem fields. Backend adds 3 new models (Notification, SavedPost, PostHashtag), 3 new repositories, extends CommunityService with new methods, and adds new handler methods + routes. Frontend adds notification components in shared layer (`components/notifications/`), plus new community feature components (SharePostModal, SavedPostsView, SuggestedUsers, TrendingTopics, HashtagLink). 3 new DB tables + 2 new columns on `post` table.

**Tech Stack:** Go 1.23 (Gin/GORM), Next.js 15 (React 19, TypeScript 5, Tailwind CSS), PostgreSQL 16, Redis 7, Protocol Buffers.

## Security Implementation Notes

- **Authentication:** All new endpoints reuse existing `AuthMiddleware` on community route group
- **Authorization:** Notifications only accessible by recipient (user_id from JWT). Saved posts private to owning user. Share cannot target own posts.
- **Input validation:** Server-side: share content (0-2000 chars, HTML stripped), hashtag filter (alphanumeric+underscore+diacritics, max 100 chars, lowercase normalized), pagination (page >= 1, pageSize 1-50)
- **Data sanitization:** Hashtags extracted server-side via regex — frontend does NOT send hashtags. Notification text generated server-side. Share commentary HTML-stripped same as post content.
- **Rate limiting:** Existing `RateLimitByUser` middleware. Additional: max 10 shares/min/user (service-layer check), notification polling max 100/min (30s client interval)
- **Denial of Service protection:** Suggested users query uses LIMIT 5 + 5-min React Query cache. Trending query uses indexed aggregation with LIMIT 10. Social graph traversal bounded by LIMIT.

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-backend.md`: Add NotificationRepository, SavedPostRepository, HashtagRepository to repository layer; update CommunityHandler/CommunityService descriptions
- Update `docs/architecture/c4-component-frontend.md`: Add NotificationPanel to shared components; add SavedPostsView, SuggestedUsers, TrendingTopics, SharePostModal, HashtagLink to community feature; add useNotifications, useSavedPost hooks

---

## Task Overview

| #   | Task                                                                        | Layer    | Dependencies |
| --- | --------------------------------------------------------------------------- | -------- | ------------ |
| 1   | Extend Protobuf API                                                         | API      | None         |
| 2   | Generate Code from Proto                                                    | Build    | Task 1       |
| 3   | Database Models (Notification, SavedPost, PostHashtag) + Post model changes | Backend  | Task 2       |
| 4   | Database Migration                                                          | Backend  | Task 3       |
| 5   | New Repositories (Notification, SavedPost, Hashtag)                         | Backend  | Task 3       |
| 6   | Extend PostRepository (shared posts, batch isSaved)                         | Backend  | Task 3       |
| 7   | Extend CommunityService — Share/Repost                                      | Backend  | Tasks 5, 6   |
| 8   | Extend CommunityService — Notifications                                     | Backend  | Task 5       |
| 9   | Extend CommunityService — Saved Posts                                       | Backend  | Task 5       |
| 10  | Extend CommunityService — Suggested Users                                   | Backend  | Task 5       |
| 11  | Extend CommunityService — Trending Topics (Hashtags)                        | Backend  | Task 5       |
| 12  | Extend CommunityService — Hashtag extraction in CreatePost/UpdatePost       | Backend  | Task 11      |
| 13  | New Handler Methods + Routes                                                | Backend  | Tasks 7-12   |
| 14  | Wire DI (builder, services, providers)                                      | Backend  | Task 13      |
| 15  | Frontend: Schemas, Hooks (useSavedPost, useNotifications)                   | Frontend | Task 2       |
| 16  | Frontend: SharePostModal + SharedPostEmbed                                  | Frontend | Task 15      |
| 17  | Frontend: PostCard/PostActions/PostBody/PostEngagement updates              | Frontend | Task 16      |
| 18  | Frontend: NotificationBell + NotificationPanel + NotificationItem           | Frontend | Task 15      |
| 19  | Frontend: SavedPostsView + CommunityNav/MobileSubNav updates                | Frontend | Task 15      |
| 20  | Frontend: SuggestedUsers + SuggestedUserCard                                | Frontend | Task 15      |
| 21  | Frontend: TrendingTopics + HashtagLink + Feed hashtag filter                | Frontend | Task 15      |
| 22  | Frontend: Wire notifications into dashboard layout                          | Frontend | Task 18      |
| 23  | Frontend: CommunityRightSidebar + page.tsx updates                          | Frontend | Tasks 20, 21 |
| 24  | Frontend: Mobile layout (horizontal scroll suggested users, trending chips) | Frontend | Task 23      |
| 25  | Update C4 Architecture Diagrams                                             | Docs     | Task 14      |
| 26  | Update Runtime Flow Diagrams                                                | Docs     | Task 14      |
| 27  | Integration Testing & Cleanup                                               | All      | All above    |

---

### Task 1: Extend Protobuf API — `api/protobuf/v1/community.proto`

**Files:**

- Modify: `api/protobuf/v1/community.proto`

**Security notes:** All new RPCs require authenticated user. User ID from JWT, never from request body.

**Step 1: Add new fields to PostItem (fields 15-19)**

Append after field 14 (`isFollowing`):

```protobuf
int32 shareCount = 15 [json_name = "shareCount"];
PostItem sharedPost = 16 [json_name = "sharedPost"];
bool isShared = 17 [json_name = "isShared"];
bool isSaved = 18 [json_name = "isSaved"];
repeated string hashtags = 19 [json_name = "hashtags"];
```

**Step 2: Add `hashtag` field to GetFeedRequest**

Add field 2 to existing `GetFeedRequest`:

```protobuf
string hashtag = 2 [json_name = "hashtag"];
```

**Step 3: Add new messages**

Add all new messages from spec section "New Messages":

- `SharePostRequest`, `SharePostResponse`
- `NotificationItem`, `GetNotificationsRequest`, `GetNotificationsResponse`
- `GetUnreadNotificationCountRequest`, `GetUnreadNotificationCountResponse`
- `MarkNotificationsReadRequest`, `MarkNotificationsReadResponse`
- `SavePostRequest`, `SavePostResponse`, `UnsavePostRequest`, `UnsavePostResponse`
- `GetSavedPostsRequest`, `GetSavedPostsResponse`
- `SuggestedUserItem`, `GetSuggestedUsersRequest`, `GetSuggestedUsersResponse`
- `TrendingTopicItem`, `GetTrendingTopicsRequest`, `GetTrendingTopicsResponse`

**Step 4: Add new RPCs to CommunityService**

Add 9 new RPCs with HTTP annotations:

- `SharePost` — POST `/api/v1/community/posts/{postId}/share`
- `GetNotifications` — GET `/api/v1/community/notifications`
- `GetUnreadNotificationCount` — GET `/api/v1/community/notifications/unread-count`
- `MarkNotificationsRead` — PUT `/api/v1/community/notifications/read`
- `SavePost` — POST `/api/v1/community/posts/{postId}/save`
- `UnsavePost` — DELETE `/api/v1/community/posts/{postId}/save`
- `GetSavedPosts` — GET `/api/v1/community/saved`
- `GetSuggestedUsers` — GET `/api/v1/community/suggested-users`
- `GetTrendingTopics` — GET `/api/v1/community/trending`

**Step 5: Verify proto compiles**

```bash
task proto:all
```

**Step 6: Commit**

---

### Task 2: Generate Code from Proto

**Files:**

- Generated: `src/go-backend/protobuf/v1/community*.go`
- Generated: `src/wj-client/gen/protobuf/v1/community*.ts`
- Generated: `src/wj-client/utils/generated/hooks.ts`

**Step 1: Run code generation**

```bash
task proto:all
```

**Step 2: Verify Go compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 3: Verify TypeScript compilation**

```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 4: Commit generated code**

---

### Task 3: Database Models (Notification, SavedPost, PostHashtag) + Post Model Changes

**Files:**

- Create: `src/go-backend/domain/models/notification.go`
- Create: `src/go-backend/domain/models/saved_post.go`
- Create: `src/go-backend/domain/models/post_hashtag.go`
- Modify: `src/go-backend/domain/models/post.go`

**Security notes:** Notification `user_id` index ensures efficient per-user queries. SavedPost unique constraint prevents duplicate saves. PostHashtag unique constraint prevents duplicate tags per post.

**Step 1: Create Notification model**

```go
// src/go-backend/domain/models/notification.go
package models

import "time"

type Notification struct {
	ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int32     `gorm:"not null;index:idx_notif_user_read_created;index:idx_notif_user_created" json:"userId"`
	ActorID   int32     `gorm:"not null" json:"actorId"`
	Type      string    `gorm:"type:varchar(20);not null" json:"type"` // like, comment, follow, share
	PostID    *int32    `gorm:"index" json:"postId,omitempty"`         // NULL for follow type
	IsRead    bool      `gorm:"not null;default:false;index:idx_notif_user_read_created" json:"isRead"`
	CreatedAt time.Time `gorm:"not null;index:idx_notif_user_read_created;index:idx_notif_user_created" json:"createdAt"`
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Actor     *User     `gorm:"foreignKey:ActorID" json:"actor,omitempty"`
}

func (Notification) TableName() string {
	return "notification"
}
```

**Step 2: Create SavedPost model**

```go
// src/go-backend/domain/models/saved_post.go
package models

import "time"

type SavedPost struct {
	ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int32     `gorm:"not null;uniqueIndex:idx_saved_user_post;index:idx_saved_user_created" json:"userId"`
	PostID    int32     `gorm:"not null;uniqueIndex:idx_saved_user_post" json:"postId"`
	CreatedAt time.Time `gorm:"not null;index:idx_saved_user_created" json:"createdAt"`
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Post      *Post     `gorm:"foreignKey:PostID" json:"post,omitempty"`
}

func (SavedPost) TableName() string {
	return "saved_post"
}
```

**Step 3: Create PostHashtag model**

```go
// src/go-backend/domain/models/post_hashtag.go
package models

import "time"

type PostHashtag struct {
	ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	PostID    int32     `gorm:"not null;uniqueIndex:idx_hashtag_unique;index:idx_hashtag_post" json:"postId"`
	Hashtag   string    `gorm:"type:varchar(100);not null;uniqueIndex:idx_hashtag_unique;index:idx_hashtag_tag_created" json:"hashtag"`
	CreatedAt time.Time `gorm:"not null;index:idx_hashtag_tag_created" json:"createdAt"`
}

func (PostHashtag) TableName() string {
	return "post_hashtag"
}
```

**Step 4: Add SharedPostID and ShareCount to Post model**

Add two fields to existing `Post` struct:

```go
SharedPostID *int32 `gorm:"index:idx_post_shared" json:"sharedPostId,omitempty"`
ShareCount   int32  `gorm:"type:int;default:0;not null" json:"shareCount"`
```

**Step 5: Verify Go compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 6: Commit**

---

### Task 4: Database Migration

**Files:**

- Modify: `src/go-backend/cmd/migrate-community/main.go`

**Step 1: Add Phase 2 migration function**

Add `migrateCommunityPhase2` function to the existing migration file, following the same pattern as Phase 1:

```go
func migrateCommunityPhase2(db *gorm.DB) error {
	log.Println("=== Community Phase 2 Migration ===")

	// Step 1: Add new columns to post table
	log.Println("Adding shared_post_id and share_count to post table...")
	if err := db.Exec(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS shared_post_id INTEGER`).Error; err != nil {
		return fmt.Errorf("failed to add shared_post_id: %w", err)
	}
	if err := db.Exec(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0`).Error; err != nil {
		return fmt.Errorf("failed to add share_count: %w", err)
	}
	// Index on shared_post_id
	if err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_post_shared ON "post" (shared_post_id) WHERE shared_post_id IS NOT NULL`).Error; err != nil {
		return fmt.Errorf("failed to create idx_post_shared: %w", err)
	}

	// Step 2: Create notification table
	log.Println("Creating notification table...")
	if err := db.AutoMigrate(&models.Notification{}); err != nil {
		return fmt.Errorf("failed to create notification table: %w", err)
	}

	// Step 3: Create saved_post table
	log.Println("Creating saved_post table...")
	if err := db.AutoMigrate(&models.SavedPost{}); err != nil {
		return fmt.Errorf("failed to create saved_post table: %w", err)
	}

	// Step 4: Create post_hashtag table
	log.Println("Creating post_hashtag table...")
	if err := db.AutoMigrate(&models.PostHashtag{}); err != nil {
		return fmt.Errorf("failed to create post_hashtag table: %w", err)
	}

	log.Println("=== Community Phase 2 Migration Complete ===")
	return nil
}
```

**Step 2: Call from main function**

Add call to `migrateCommunityPhase2(db)` after existing Phase 1 migration in main.

**Step 3: Commit**

---

### Task 5: New Repositories (Notification, SavedPost, Hashtag)

**Files:**

- Create: `src/go-backend/domain/repository/notification_repository.go`
- Create: `src/go-backend/domain/repository/saved_post_repository.go`
- Create: `src/go-backend/domain/repository/hashtag_repository.go`
- Modify: `src/go-backend/domain/repository/interfaces.go` (if shared interface file exists) or add interfaces in individual files

**Security notes:** All queries filter by user_id for authorization. SavedPost uses unique constraint for idempotency.

**Step 1: Create NotificationRepository**

```go
type NotificationRepository interface {
	Create(ctx context.Context, notification *models.Notification) error
	GetByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Notification, int, error)
	GetUnreadCount(ctx context.Context, userID int32) (int32, error)
	MarkAllRead(ctx context.Context, userID int32) error
	MarkRead(ctx context.Context, id int32, userID int32) error
}
```

Implementation:

- `GetByUserID`: Preload `Actor`, order by `created_at DESC`, with pagination
- `GetUnreadCount`: `WHERE user_id = ? AND is_read = false`, count
- `MarkAllRead`: `UPDATE notification SET is_read = true WHERE user_id = ? AND is_read = false`
- `MarkRead`: `UPDATE notification SET is_read = true WHERE id = ? AND user_id = ?`

**Step 2: Create SavedPostRepository**

```go
type SavedPostRepository interface {
	Create(ctx context.Context, savedPost *models.SavedPost) error
	Delete(ctx context.Context, userID, postID int32) error
	Exists(ctx context.Context, userID, postID int32) (bool, error)
	GetByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.SavedPost, int, error)
	GetSavedPostIDs(ctx context.Context, userID int32, postIDs []int32) ([]int32, error)
}
```

Implementation:

- `Create`: Insert with ON CONFLICT DO NOTHING (idempotent)
- `Delete`: Soft delete by user_id + post_id
- `GetSavedPostIDs`: Batch query like `GetLikedPostIDs` pattern for N+1 prevention
- `GetByUserID`: Preload `Post.User`, order by `saved_post.created_at DESC`

**Step 3: Create HashtagRepository**

```go
type HashtagRepository interface {
	CreateBatch(ctx context.Context, postID int32, hashtags []string, createdAt time.Time) error
	DeleteByPostID(ctx context.Context, postID int32) error
	GetByPostID(ctx context.Context, postID int32) ([]string, error)
	GetTrending(ctx context.Context, since time.Time, limit int) ([]TrendingHashtag, error)
	GetPostIDsByHashtag(ctx context.Context, hashtag string, opts ListOptions) ([]int32, int, error)
}

type TrendingHashtag struct {
	Hashtag   string
	PostCount int32
}
```

Implementation:

- `CreateBatch`: Batch insert with ON CONFLICT DO NOTHING
- `GetTrending`: `SELECT hashtag, COUNT(*) as post_count FROM post_hashtag WHERE created_at > ? GROUP BY hashtag ORDER BY post_count DESC LIMIT ?`
- `GetPostIDsByHashtag`: `SELECT post_id FROM post_hashtag WHERE hashtag = ? ORDER BY created_at DESC` with pagination

**Step 4: Verify Go compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

---

### Task 6: Extend PostRepository (Shared Posts, Batch isSaved)

**Files:**

- Modify: `src/go-backend/domain/repository/post_repository.go`

**Step 1: Add IncrementShareCount method**

Follow exact pattern of `IncrementLikeCount`:

```go
func (r *postRepository) IncrementShareCount(ctx context.Context, postID int32, delta int32) error {
	return r.db.DB.WithContext(ctx).Model(&models.Post{}).
		Where("id = ?", postID).
		Update("share_count", gorm.Expr("share_count + ?", delta)).Error
}
```

**Step 2: Add GetByIDs method (for shared post embedding)**

```go
func (r *postRepository) GetByIDs(ctx context.Context, ids []int32) ([]*models.Post, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var posts []*models.Post
	err := r.db.DB.WithContext(ctx).Preload("User").Where("id IN ?", ids).Find(&posts).Error
	return posts, err
}
```

**Step 3: Extend GetFeed to support hashtag filtering**

Modify `GetFeed` to accept an optional hashtag parameter. When provided, join with `post_hashtag` table:

```go
func (r *postRepository) GetFeed(ctx context.Context, userIDs []int32, opts ListOptions, hashtag string) ([]*models.Post, int, error) {
	query := r.db.DB.WithContext(ctx).Model(&models.Post{})
	if len(userIDs) > 0 {
		query = query.Where("user_id IN ?", userIDs)
	}
	if hashtag != "" {
		query = query.Where("id IN (SELECT post_id FROM post_hashtag WHERE hashtag = ?)", hashtag)
	}
	// ... rest unchanged
}
```

**Step 4: Update PostRepository interface**

Add `IncrementShareCount`, `GetByIDs` to the interface. Update `GetFeed` signature to include `hashtag string` parameter.

**Step 5: Verify Go compilation and commit**

---

### Task 7: Extend CommunityService — Share/Repost

**Files:**

- Modify: `src/go-backend/domain/service/community_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go`

**Security notes:** Cannot share own posts. If sharing a post that is itself a share, resolve to original (prevent recursive embedding). Validate original post exists and is not deleted.

**Step 1: Add SharePost to CommunityService interface**

```go
SharePost(ctx context.Context, userID int32, req *v1.SharePostRequest) (*v1.SharePostResponse, error)
```

**Step 2: Implement SharePost**

```go
func (s *communityService) SharePost(ctx context.Context, userID int32, req *v1.SharePostRequest) (*v1.SharePostResponse, error) {
	// 1. Validate content (0-2000 chars, HTML stripped)
	content := validator.SanitizeStringField(req.Content, 2000)

	// 2. Get original post
	originalPost, err := s.postRepo.GetByID(ctx, req.PostId)
	if err != nil || originalPost == nil {
		return nil, apperrors.NewNotFoundError("post")
	}

	// 3. Cannot share own post
	if originalPost.UserID == userID {
		return nil, apperrors.NewValidationError("cannot share your own post")
	}

	// 4. Resolve to root original (if sharing a shared post)
	rootPostID := originalPost.ID
	if originalPost.SharedPostID != nil {
		rootPostID = *originalPost.SharedPostID
	}

	// 5. Create shared post
	post := &models.Post{
		UserID:       userID,
		Content:      content,
		SharedPostID: &rootPostID,
	}
	if err := s.postRepo.Create(ctx, post); err != nil {
		return nil, err
	}

	// 6. Increment share count on original
	s.postRepo.IncrementShareCount(ctx, rootPostID, 1)

	// 7. Create notification for original author
	rootPost, _ := s.postRepo.GetByID(ctx, rootPostID)
	if rootPost != nil && rootPost.UserID != userID {
		s.notificationRepo.Create(ctx, &models.Notification{
			UserID:  rootPost.UserID,
			ActorID: userID,
			Type:    "share",
			PostID:  &rootPostID,
		})
	}

	// 8. Extract and store hashtags from commentary
	s.extractAndStoreHashtags(ctx, post.ID, content, post.CreatedAt)

	// 9. Build response with embedded shared post
	user, _ := s.userRepo.GetByID(ctx, userID)
	protoPost := s.postToProto(post, user, false, true, false)
	// Attach shared post data
	if rootPost != nil {
		rootUser := rootPost.User
		if rootUser == nil {
			rootUser, _ = s.userRepo.GetByID(ctx, rootPost.UserID)
		}
		protoPost.SharedPost = s.postToProto(rootPost, rootUser, false, false, false)
		protoPost.IsShared = true
	}

	return &v1.SharePostResponse{
		Success:   true,
		Message:   "Post shared successfully",
		Data:      protoPost,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
```

**Step 3: Update postToProto to include new fields**

Add `ShareCount`, `IsShared`, `IsSaved`, `Hashtags` fields to the proto conversion:

```go
func (s *communityService) postToProto(post *models.Post, user *models.User, isLiked, isOwnPost, isFollowing bool) *v1.PostItem {
	item := &v1.PostItem{
		// ... existing fields ...
		ShareCount: post.ShareCount,
		IsShared:   post.SharedPostID != nil,
	}
	// ... rest unchanged
	return item
}
```

**Step 4: Update GetFeed to embed shared posts and isSaved**

In the feed enrichment loop, after batch-loading isLiked and isFollowing:

1. Collect all `SharedPostID` values from feed posts
2. Batch-fetch shared posts via `GetByIDs`
3. Attach `sharedPost` to each feed item that has one
4. Batch-check `isSaved` via `savedPostRepo.GetSavedPostIDs`
5. Batch-load hashtags for all posts

**Step 5: Commit**

---

### Task 8: Extend CommunityService — Notifications

**Files:**

- Modify: `src/go-backend/domain/service/community_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go`

**Security notes:** Notifications only accessible by the owning user (user_id from JWT). Self-actions do NOT generate notifications.

**Step 1: Add notification methods to CommunityService interface**

```go
GetNotifications(ctx context.Context, userID int32, req *v1.GetNotificationsRequest) (*v1.GetNotificationsResponse, error)
GetUnreadNotificationCount(ctx context.Context, userID int32) (*v1.GetUnreadNotificationCountResponse, error)
MarkNotificationsRead(ctx context.Context, userID int32) error
```

**Step 2: Implement GetNotifications**

- Parse pagination (default 20, max 50)
- Call `notificationRepo.GetByUserID(ctx, userID, opts)` — preloads Actor
- Convert to `[]*v1.NotificationItem` with actor info and post preview
- For post preview: batch-fetch referenced posts and truncate content to 100 chars

**Step 3: Implement GetUnreadNotificationCount**

- Call `notificationRepo.GetUnreadCount(ctx, userID)`
- Return count in response

**Step 4: Implement MarkNotificationsRead**

- Call `notificationRepo.MarkAllRead(ctx, userID)`

**Step 5: Add notification creation as side-effects**

Add `createNotification` helper. Wire into existing methods:

- `LikePost`: Create notification type "like" (skip if liking own post)
- `CreateComment`: Create notification type "comment" (skip if commenting on own post)
- `FollowUser`: Create notification type "follow"
- `SharePost`: Already added in Task 7

```go
func (s *communityService) createNotification(ctx context.Context, userID, actorID int32, notifType string, postID *int32) {
	if userID == actorID {
		return // No self-notifications
	}
	s.notificationRepo.Create(ctx, &models.Notification{
		UserID:  userID,
		ActorID: actorID,
		Type:    notifType,
		PostID:  postID,
	})
}
```

**Step 6: Commit**

---

### Task 9: Extend CommunityService — Saved Posts

**Files:**

- Modify: `src/go-backend/domain/service/community_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go`

**Security notes:** Saved posts are private — only the owning user can view/manage. Save/unsave are idempotent.

**Step 1: Add saved post methods to CommunityService interface**

```go
SavePost(ctx context.Context, userID int32, postID int32) error
UnsavePost(ctx context.Context, userID int32, postID int32) error
GetSavedPosts(ctx context.Context, userID int32, req *v1.GetSavedPostsRequest) (*v1.GetSavedPostsResponse, error)
```

**Step 2: Implement SavePost**

- Validate post exists (not deleted)
- Call `savedPostRepo.Create(ctx, &models.SavedPost{UserID: userID, PostID: postID})`
- Idempotent: ON CONFLICT DO NOTHING

**Step 3: Implement UnsavePost**

- Call `savedPostRepo.Delete(ctx, userID, postID)`
- Idempotent: return success even if not found

**Step 4: Implement GetSavedPosts**

- Parse pagination
- Call `savedPostRepo.GetByUserID(ctx, userID, opts)` — preloads Post.User
- Enrich each post with isLiked, isFollowing, isSaved (always true in this view), hashtags, shared post embed
- Return paginated response

**Step 5: Commit**

---

### Task 10: Extend CommunityService — Suggested Users

**Files:**

- Modify: `src/go-backend/domain/service/community_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go`
- Modify: `src/go-backend/domain/repository/follow_repository.go` (add new query)

**Security notes:** No sensitive data exposed — only public profile info. Query uses LIMIT to prevent expensive graph traversals.

**Step 1: Add GetSuggestedUsers to interface**

```go
GetSuggestedUsers(ctx context.Context, userID int32) (*v1.GetSuggestedUsersResponse, error)
```

**Step 2: Add GetFriendsOfFriends to FollowRepository**

```go
func (r *followRepository) GetFriendsOfFriends(ctx context.Context, userID int32, excludeIDs []int32, limit int) ([]FriendOfFriend, error)
```

Query: Users followed by people I follow, excluding me and people I already follow, grouped by count (mutual follows), ordered by mutual count DESC, limited.

```sql
SELECT uf2.following_id, COUNT(*) as mutual_count
FROM user_follow uf1
JOIN user_follow uf2 ON uf1.following_id = uf2.follower_id
WHERE uf1.follower_id = ?
  AND uf2.following_id != ?
  AND uf2.following_id NOT IN (?)
GROUP BY uf2.following_id
ORDER BY mutual_count DESC
LIMIT ?
```

**Step 3: Add GetTopUsersByFollowers to FollowRepository**

```go
func (r *followRepository) GetTopUsersByFollowers(ctx context.Context, excludeIDs []int32, limit int) ([]UserFollowerCount, error)
```

Query: Users with most followers who have at least 1 post, excluding specified IDs.

```sql
SELECT uf.following_id, COUNT(*) as follower_count
FROM user_follow uf
WHERE uf.following_id NOT IN (?)
  AND EXISTS (SELECT 1 FROM post p WHERE p.user_id = uf.following_id AND p.deleted_at IS NULL)
GROUP BY uf.following_id
ORDER BY follower_count DESC
LIMIT ?
```

**Step 4: Implement GetSuggestedUsers**

1. Get user's following IDs (to exclude)
2. Get friends-of-friends (up to 5)
3. If < 5 results, fill remaining with top users by follower count
4. Fetch user details for all suggested IDs
5. Build response with user info, bio snippet (first 60 chars), mutual count, follower count

**Step 5: Commit**

---

### Task 11: Extend CommunityService — Trending Topics (Hashtags)

**Files:**

- Modify: `src/go-backend/domain/service/community_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go`

**Step 1: Add GetTrendingTopics to interface**

```go
GetTrendingTopics(ctx context.Context) (*v1.GetTrendingTopicsResponse, error)
```

**Step 2: Implement GetTrendingTopics**

```go
func (s *communityService) GetTrendingTopics(ctx context.Context) (*v1.GetTrendingTopicsResponse, error) {
	since := time.Now().Add(-24 * time.Hour)
	trending, err := s.hashtagRepo.GetTrending(ctx, since, 10)
	if err != nil {
		return nil, err
	}

	items := make([]*v1.TrendingTopicItem, len(trending))
	for i, t := range trending {
		items[i] = &v1.TrendingTopicItem{
			Hashtag:   t.Hashtag,
			PostCount: t.PostCount,
		}
	}

	return &v1.GetTrendingTopicsResponse{
		Success:   true,
		Message:   "Trending topics retrieved",
		Topics:    items,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
```

**Step 3: Commit**

---

### Task 12: Extend CommunityService — Hashtag Extraction in CreatePost/UpdatePost

**Files:**

- Modify: `src/go-backend/domain/service/community_service.go`

**Security notes:** Hashtag extraction is server-side only. Frontend does NOT send hashtags. Regex validated. Max 10 hashtags per post.

**Step 1: Add extractHashtags helper**

```go
var hashtagRegex = regexp.MustCompile(`#([a-zA-Z0-9_\x{00C0}-\x{024F}]+)`)

func extractHashtags(content string) []string {
	matches := hashtagRegex.FindAllStringSubmatch(content, -1)
	seen := make(map[string]bool)
	var hashtags []string
	for _, match := range matches {
		tag := strings.ToLower(match[1])
		if !seen[tag] && len(tag) <= 100 {
			seen[tag] = true
			hashtags = append(hashtags, tag)
			if len(hashtags) >= 10 {
				break
			}
		}
	}
	return hashtags
}
```

**Step 2: Add extractAndStoreHashtags helper**

```go
func (s *communityService) extractAndStoreHashtags(ctx context.Context, postID int32, content string, createdAt time.Time) {
	hashtags := extractHashtags(content)
	if len(hashtags) > 0 {
		s.hashtagRepo.CreateBatch(ctx, postID, hashtags, createdAt)
	}
}
```

**Step 3: Wire into CreatePost**

After `s.postRepo.Create(ctx, post)` succeeds, call `s.extractAndStoreHashtags(ctx, post.ID, post.Content, post.CreatedAt)`.

**Step 4: Wire into UpdatePost**

After content update succeeds:

1. `s.hashtagRepo.DeleteByPostID(ctx, post.ID)` — remove old hashtags
2. `s.extractAndStoreHashtags(ctx, post.ID, content, post.CreatedAt)` — re-extract

**Step 5: Wire into DeletePost**

After soft-delete, call `s.hashtagRepo.DeleteByPostID(ctx, postID)`.

**Step 6: Update postToProto to include hashtags**

Load hashtags for post (or accept them as parameter from batch-loaded data in feed):

```go
// In feed enrichment, batch-load hashtags for all posts
// In single post views, load individually
```

**Step 7: Commit**

---

### Task 13: New Handler Methods + Routes

**Files:**

- Modify: `src/go-backend/handlers/community.go`
- Modify: `src/go-backend/handlers/routes.go`

**Security notes:** All handlers extract userID from JWT context. Path params validated as int32.

**Step 1: Add handler methods**

Add 9 new handler methods following existing patterns:

```go
// Share
func (h *CommunityHandler) SharePost(c *gin.Context) { ... }

// Notifications
func (h *CommunityHandler) GetNotifications(c *gin.Context) { ... }
func (h *CommunityHandler) GetUnreadNotificationCount(c *gin.Context) { ... }
func (h *CommunityHandler) MarkNotificationsRead(c *gin.Context) { ... }

// Saved Posts
func (h *CommunityHandler) SavePost(c *gin.Context) { ... }
func (h *CommunityHandler) UnsavePost(c *gin.Context) { ... }
func (h *CommunityHandler) GetSavedPosts(c *gin.Context) { ... }

// Suggested Users
func (h *CommunityHandler) GetSuggestedUsers(c *gin.Context) { ... }

// Trending Topics
func (h *CommunityHandler) GetTrendingTopics(c *gin.Context) { ... }
```

Each follows the standard pattern:

1. Extract userID from JWT
2. Parse path params / query params / body
3. Call service method
4. Return response with `handler.Success(c, result)` or `handler.Created(c, result)`

**Step 2: Add routes**

Add to the community route group in `routes.go`:

```go
// Share
community.POST("/posts/:post_id/share", h.Community.SharePost)

// Notifications
community.GET("/notifications", h.Community.GetNotifications)
community.GET("/notifications/unread-count", h.Community.GetUnreadNotificationCount)
community.PUT("/notifications/read", h.Community.MarkNotificationsRead)

// Saved Posts
community.POST("/posts/:post_id/save", h.Community.SavePost)
community.DELETE("/posts/:post_id/save", h.Community.UnsavePost)
community.GET("/saved", h.Community.GetSavedPosts)

// Suggested Users
community.GET("/suggested-users", h.Community.GetSuggestedUsers)

// Trending
community.GET("/trending", h.Community.GetTrendingTopics)
```

**Important:** Place `/notifications` and `/notifications/unread-count` and `/notifications/read` routes BEFORE the `/posts/:post_id` wildcard routes in the route group to avoid conflicts.

**Step 3: Update GetFeed handler to pass hashtag param**

```go
func (h *CommunityHandler) GetFeed(c *gin.Context) {
	// ... existing code ...
	req.Hashtag = c.Query("hashtag") // Add this line
	// ... rest unchanged
}
```

**Step 4: Verify Go compilation and commit**

---

### Task 14: Wire DI (Builder, Services, Providers)

**Files:**

- Modify: `src/go-backend/handlers/builder.go` (no changes needed — CommunityHandler already wired)
- Modify: `src/go-backend/domain/service/services.go` (add new repos to CommunityService constructor)
- Modify: `src/go-backend/internal/app/providers.go` (add new repo instantiation)

**Step 1: Add new repositories to Repositories struct**

```go
Notification repository.NotificationRepository
SavedPost    repository.SavedPostRepository
Hashtag      repository.HashtagRepository
```

**Step 2: Instantiate new repositories**

```go
Notification: repository.NewNotificationRepository(db),
SavedPost:    repository.NewSavedPostRepository(db),
Hashtag:      repository.NewHashtagRepository(db),
```

**Step 3: Update NewCommunityService constructor**

Pass 3 new repositories:

```go
communitySvc := NewCommunityService(
	repos.Post,
	repos.Comment,
	repos.Like,
	repos.Follow,
	repos.Report,
	repos.User,
	repos.Notification,  // NEW
	repos.SavedPost,     // NEW
	repos.Hashtag,       // NEW
)
```

**Step 4: Update communityService struct**

Add fields:

```go
type communityService struct {
	// ... existing fields ...
	notificationRepo repository.NotificationRepository
	savedPostRepo    repository.SavedPostRepository
	hashtagRepo      repository.HashtagRepository
}
```

**Step 5: Verify Go compilation and commit**

---

### Task 15: Frontend: Schemas, Hooks (useSavedPost, useNotifications)

**Files:**

- Modify: `src/wj-client/features/community/utils/community.schema.ts`
- Create: `src/wj-client/features/community/hooks/useSavedPost.ts`
- Create: `src/wj-client/features/community/hooks/useNotifications.ts`
- Create: `src/wj-client/features/community/utils/hashtag.ts`

**Step 1: Add share schema to community.schema.ts**

```typescript
export const sharePostSchema = z.object({
  content: z
    .string()
    .max(2000, "Maximum 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type SharePostFormData = z.infer<typeof sharePostSchema>;
```

**Step 2: Create useSavedPost hook**

Follow `useLike` pattern with optimistic UI:

```typescript
export function useSavedPost(postId: number, initialIsSaved: boolean) {
  const [isSaved, setIsSaved] = useState(initialIsSaved);

  const saveMutation = useMutationSavePost();
  const unsaveMutation = useMutationUnsavePost();

  const toggle = () => {
    if (isSaved) {
      setIsSaved(false);
      unsaveMutation.mutate({ postId }, { onError: () => setIsSaved(true) });
    } else {
      setIsSaved(true);
      saveMutation.mutate({ postId }, { onError: () => setIsSaved(false) });
    }
  };

  const isLoading = saveMutation.isPending || unsaveMutation.isPending;
  return { isSaved, toggle, isLoading };
}
```

**Step 3: Create useNotifications hook**

```typescript
export function useNotifications() {
  const { data: unreadData } = useQueryGetUnreadNotificationCount(
    {},
    { refetchInterval: 30000 }, // Poll every 30 seconds
  );

  const unreadCount = unreadData?.count ?? 0;

  const markAllRead = useMutationMarkNotificationsRead();

  return { unreadCount, markAllRead };
}
```

**Step 4: Create hashtag.ts utility**

```typescript
// Regex matching hashtags in post content
const HASHTAG_REGEX = /#([a-zA-Z0-9_\u00C0-\u024F]+)/g;

// Parse post content and split into text/hashtag segments for rendering
export function parseContentWithHashtags(content: string): ContentSegment[] {
  // Returns array of { type: 'text' | 'hashtag', value: string }
}
```

**Step 5: Commit**

---

### Task 16: Frontend: SharePostModal + SharedPostEmbed

**Files:**

- Create: `src/wj-client/features/community/components/SharePostModal.tsx`
- Create: `src/wj-client/features/community/components/SharedPostEmbed.tsx`
- Create: `src/wj-client/features/community/forms/SharePostForm.tsx`

**Step 1: Create SharedPostEmbed component**

Renders the embedded original post inside a shared post card:

```typescript
interface SharedPostEmbedProps {
  post: PostItem | undefined;
}

export function SharedPostEmbed({ post }: SharedPostEmbedProps) {
  if (!post) {
    return (
      <div className="bg-v2-bg-primary rounded-xl p-4 text-v2-text-tertiary text-sm">
        Bài viết gốc đã bị xóa
      </div>
    );
  }
  // Render read-only original post with distinct background
  return (
    <div className="bg-v2-bg-primary rounded-xl p-3 border border-v2-border-light">
      <PostHeader ... /> {/* Original post author */}
      <PostBody ... /> {/* Original post content */}
    </div>
  );
}
```

**Step 2: Create SharePostForm**

```typescript
interface SharePostFormProps {
  originalPost: PostItem;
  onSuccess?: () => void;
}
```

- Uses `react-hook-form` + `sharePostSchema` Zod resolver
- Shows original post preview via `SharedPostEmbed`
- Textarea for optional commentary (0-2000 chars)
- Submit button triggers `useMutationSharePost`
- On success: invalidate feed, call `onSuccess`

**Step 3: Create SharePostModal**

Wraps `BaseModal` with `SharePostForm` inside. Title: "Chia sẻ bài viết".

**Step 4: Commit**

---

### Task 17: Frontend: PostCard/PostActions/PostBody/PostEngagement Updates

**Files:**

- Modify: `src/wj-client/features/community/components/PostCard.tsx`
- Modify: `src/wj-client/features/community/components/PostActions.tsx`
- Modify: `src/wj-client/features/community/components/PostBody.tsx`
- Modify: `src/wj-client/features/community/components/PostEngagement.tsx`

**Step 1: Update PostActions — add Share and Bookmark buttons**

Add two new buttons:

- **Share button** (ArrowUpRight or Forward icon): triggers share modal. Hidden for own posts.
- **Bookmark button** (Bookmark icon): toggles save/unsave via `useSavedPost` hook. Filled when saved.

Props additions:

```typescript
interface PostActionsProps {
  // ... existing props ...
  onShareClick?: () => void;
  isSaved: boolean;
  onSaveToggle: () => void;
  isSaveLoading?: boolean;
  isOwnPost?: boolean;
}
```

**Step 2: Update PostEngagement — add share count**

Add `shareCount` prop, display "X lượt chia sẻ" when > 0.

**Step 3: Update PostBody — render clickable hashtags**

Use `parseContentWithHashtags` utility to split content into segments. Render hashtag segments as clickable `<span>` with `text-v2-red-primary cursor-pointer` that navigates to `?hashtag=<tag>`.

**Step 4: Update PostCard — wire share modal and bookmark**

- Add `useSavedPost(postId, post.isSaved ?? false)` hook
- Add `showShareModal` state
- Pass new props to `PostActions`
- Render `SharePostModal` when `showShareModal` is true
- Render `SharedPostEmbed` when `post.isShared && post.sharedPost`

**Step 5: Commit**

---

### Task 18: Frontend: NotificationBell + NotificationPanel + NotificationItem

**Files:**

- Create: `src/wj-client/components/notifications/NotificationBell.tsx`
- Create: `src/wj-client/components/notifications/NotificationPanel.tsx`
- Create: `src/wj-client/components/notifications/NotificationItem.tsx`

**Security notes:** Notification panel uses z-index 20 (dropdown level). Click outside to close.

**Step 1: Create NotificationBell**

Bell icon with red badge showing unread count. Badge hidden when count is 0.

```typescript
interface NotificationBellProps {
  unreadCount: number;
  onClick: () => void;
}

export function NotificationBell({ unreadCount, onClick }: NotificationBellProps) {
  return (
    <button onClick={onClick} className="relative p-2 rounded-lg hover:bg-v2-bg-primary" aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}>
      <Bell size={20} className="text-v2-text-secondary" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
```

**Step 2: Create NotificationItem**

```typescript
interface NotificationItemProps {
  notification: NotificationItem;
  onClick: (notification: NotificationItem) => void;
}
```

Renders: actor avatar, action text (Vietnamese), relative time, read/unread indicator (blue dot for unread).

Action text mapping:

- `like`: "đã thích bài viết của bạn"
- `comment`: "đã bình luận bài viết của bạn"
- `follow`: "đã theo dõi bạn"
- `share`: "đã chia sẻ bài viết của bạn"

**Step 3: Create NotificationPanel**

Desktop: dropdown (320px wide, max-h 480px, z-20, positioned below bell).
Mobile: full-screen overlay.

Features:

- "Thông báo" header + "Đọc tất cả" button
- Scrollable list of NotificationItem
- Empty state: "Chưa có thông báo nào"
- Click outside to close (useRef + useEffect pattern)
- Pagination with "Xem thêm" button
- Uses `useQueryGetNotifications` for data

**Step 4: Commit**

---

### Task 19: Frontend: SavedPostsView + CommunityNav/MobileSubNav Updates

**Files:**

- Create: `src/wj-client/features/community/components/SavedPostsView.tsx`
- Modify: `src/wj-client/features/community/components/CommunityNav.tsx`
- Modify: `src/wj-client/features/community/components/MobileSubNav.tsx`

**Step 1: Create SavedPostsView**

```typescript
interface SavedPostsViewProps {
  currentUser: { id: number; name: string; picture: string };
}
```

- Uses `useQueryGetSavedPosts` with pagination
- Renders `PostCard` for each saved post
- Empty state: "Chưa có bài viết đã lưu"
- Same pagination pattern as CommunityFeed

**Step 2: Update CommunityNav**

- Enable "Bài đã lưu" nav item (remove disabled flag, remove "Phase 2" badge)
- Enable "Thông báo" nav item (remove disabled flag, remove "Phase 2" badge)
- Add `onNavChange` callback prop for tab switching
- Add `activeTab` prop to control active state

**Step 3: Update MobileSubNav**

- Replace "Nhóm" tab with "Đã lưu" (Saved) tab
- Enable "Thông báo" tab
- Add `onTabChange` callback prop and `activeTab` prop

**Step 4: Commit**

---

### Task 20: Frontend: SuggestedUsers + SuggestedUserCard

**Files:**

- Create: `src/wj-client/features/community/components/SuggestedUsers.tsx`
- Create: `src/wj-client/features/community/components/SuggestedUserCard.tsx`
- Delete or replace: `src/wj-client/features/community/components/SuggestedUsersPlaceholder.tsx`

**Step 1: Create SuggestedUserCard**

```typescript
interface SuggestedUserCardProps {
  user: SuggestedUserItem;
  onDismiss: (userId: number) => void;
}
```

Renders: avatar, name, bio snippet (60 chars), mutual follow count ("X người bạn theo dõi"), follow button (inline via `useFollow`), dismiss X button.

**Step 2: Create SuggestedUsers**

```typescript
interface SuggestedUsersProps {
  className?: string;
  layout?: "vertical" | "horizontal"; // vertical for desktop sidebar, horizontal for mobile scroll
}
```

- Uses `useQueryGetSuggestedUsers({}, { staleTime: 5 * 60 * 1000 })` — 5-min cache
- Manages dismissed IDs in local state (session-only, not persisted)
- Filters out dismissed users
- Desktop: vertical list in right sidebar card
- Mobile: horizontal scroll with snap points

**Step 3: Commit**

---

### Task 21: Frontend: TrendingTopics + HashtagLink + Feed Hashtag Filter

**Files:**

- Create: `src/wj-client/features/community/components/TrendingTopics.tsx`
- Create: `src/wj-client/features/community/components/HashtagLink.tsx`
- Modify: `src/wj-client/features/community/components/CommunityFeed.tsx`

**Step 1: Create HashtagLink**

```typescript
interface HashtagLinkProps {
  hashtag: string;
  onHashtagClick?: (hashtag: string) => void;
}

export function HashtagLink({ hashtag, onHashtagClick }: HashtagLinkProps) {
  return (
    <span
      className="text-v2-red-primary cursor-pointer hover:underline"
      onClick={() => onHashtagClick?.(hashtag)}
    >
      #{hashtag}
    </span>
  );
}
```

**Step 2: Create TrendingTopics**

```typescript
interface TrendingTopicsProps {
  className?: string;
  onHashtagClick?: (hashtag: string) => void;
  layout?: "vertical" | "horizontal"; // vertical for desktop sidebar, horizontal for mobile chips
}
```

- Uses `useQueryGetTrendingTopics({})` — auto-generated hook
- Desktop: vertical list in right sidebar card with "Chủ đề nổi bật" heading
- Mobile: horizontal chip scroll
- Each item shows: `#hashtag` text + `(postCount)` count
- Click triggers `onHashtagClick`

**Step 3: Update CommunityFeed for hashtag filter**

- Accept `hashtag` prop (optional)
- Pass to `useQueryGetFeed({ pagination: ..., hashtag })` query
- Show active filter banner when hashtag is set: "#hashtag · X bài viết" with X button to clear
- Clear filter navigates back to default feed

**Step 4: Commit**

---

### Task 22: Frontend: Wire Notifications into Dashboard Layout

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`

**Step 1: Import NotificationBell and NotificationPanel**

```typescript
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
```

**Step 2: Replace placeholder bell button with NotificationBell**

In the desktop header (top bar), replace the existing placeholder `<button>` with:

```typescript
<NotificationBell unreadCount={unreadCount} onClick={() => setShowNotifications(prev => !prev)} />
{showNotifications && (
  <NotificationPanel onClose={() => setShowNotifications(false)} />
)}
```

**Step 3: Add useNotifications hook to layout**

```typescript
const { unreadCount } = useNotifications();
const [showNotifications, setShowNotifications] = useState(false);
```

**Step 4: Mobile header — same NotificationBell integration**

Add bell with badge to mobile header section.

**Step 5: Commit**

---

### Task 23: Frontend: CommunityRightSidebar + Page.tsx Updates

**Files:**

- Modify: `src/wj-client/features/community/components/CommunityRightSidebar.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/community/page.tsx`

**Step 1: Update CommunityRightSidebar**

Replace placeholders with real components:

```typescript
interface CommunityRightSidebarProps {
  className?: string;
  onHashtagClick?: (hashtag: string) => void;
}

export function CommunityRightSidebar({ className, onHashtagClick }: CommunityRightSidebarProps) {
  return (
    <aside className={className}>
      <SuggestedUsers layout="vertical" />
      <TrendingTopics layout="vertical" onHashtagClick={onHashtagClick} />
    </aside>
  );
}
```

**Step 2: Update page.tsx**

- Add `activeTab` state: "feed" | "saved" | "notifications"
- Add `activeHashtag` state (for hashtag filtering)
- Pass `activeTab` and callbacks to CommunityNav and MobileSubNav
- Conditionally render:
  - "feed" tab: `<CommunityFeed hashtag={activeHashtag} />`
  - "saved" tab: `<SavedPostsView currentUser={currentUser} />`
  - "notifications" tab (mobile only): full notification list
- Pass `onHashtagClick` to CommunityRightSidebar and CommunityFeed

**Step 3: Commit**

---

### Task 24: Frontend: Mobile Layout (Horizontal Scroll Suggested Users, Trending Chips)

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/community/page.tsx`

**Step 1: Add mobile suggested users section**

Above the feed on mobile, add horizontal scroll section:

```typescript
{/* Mobile only - suggested users horizontal scroll */}
<div className="sm:hidden">
  <SuggestedUsers layout="horizontal" />
</div>
```

**Step 2: Add mobile trending chips**

Below suggested users, above CreatePostBox on mobile:

```typescript
{/* Mobile only - trending chips horizontal scroll */}
<div className="sm:hidden">
  <TrendingTopics layout="horizontal" onHashtagClick={setActiveHashtag} />
</div>
```

**Step 3: Ensure snap scrolling on mobile**

Both components use `overflow-x-auto snap-x snap-mandatory` with `scroll-snap-align: start` on children and `scrollbar-hide` utility.

**Step 4: Commit**

---

### Task 25: Update C4 Architecture Diagrams

**Files:**

- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Step 1: Update backend L3 diagram**

- Add `NotificationRepository`, `SavedPostRepository`, `HashtagRepository` to repository boundary
- Update `CommunityHandler` description to include new endpoints
- Update `CommunityService` description to include new operations
- Add relationship arrows from CommunityService to new repositories

**Step 2: Update frontend L3 diagram**

- Add `NotificationPanel` to shared components boundary (`components/notifications/`)
- Add `SavedPostsView`, `SuggestedUsers`, `TrendingTopics`, `SharePostModal`, `HashtagLink` to community feature module
- Add `useNotifications`, `useSavedPost` to community hooks

**Step 3: Commit**

---

### Task 26: Update Runtime Flow Diagrams

**Files:**

- Modify: `docs/architecture/flow-community.md`

**Step 1: Add Share Post sequence diagram**

```
sequenceDiagram: User → PostActions → SharePostModal → API → CommunityHandler → CommunityService → PostRepo.Create + NotificationService.Create
```

**Step 2: Add Notification Polling sequence diagram**

```
sequenceDiagram: Dashboard Layout (30s interval) → API → CommunityHandler → NotificationRepo.GetUnreadCount
Bell click → API → CommunityHandler → NotificationRepo.GetByUserID
```

**Step 3: Add Save/Unsave Post sequence diagram**

```
sequenceDiagram: User → PostActions → SavePostAPI → CommunityHandler → SavedPostRepo
```

**Step 4: Add Suggested Users sequence diagram**

```
sequenceDiagram: User → RightSidebar → API → CommunityHandler → CommunityService → FollowRepo.GetFriendsOfFriends + FollowRepo.GetTopUsers
```

**Step 5: Add Trending Topics sequence diagram**

```
sequenceDiagram: User → RightSidebar → API → CommunityHandler → HashtagRepo.GetTrending
```

**Step 6: Update Create Post diagram**

Add hashtag extraction step after post creation.

**Step 7: Update Like Post and Follow User diagrams**

Add notification creation side-effects.

**Step 8: Commit**

---

### Task 27: Integration Testing & Cleanup

**Files:**

- All modified files across the feature

**Step 1: Run full backend build**

```bash
cd src/go-backend && go build ./...
```

**Step 2: Run database migration**

```bash
task backend:migrate-community
```

**Step 3: Run frontend build**

```bash
cd src/wj-client && npm run build
```

**Step 4: Manual testing checklist**

- [x] Create a post with hashtags → verify hashtags extracted and stored
- [x] Share another user's post with commentary → verify shared post renders correctly
- [x] Share a shared post → verify it references the original (no recursive nesting)
- [x] Like/comment/follow → verify notification created for target user
- [x] Check notification bell shows unread count
- [x] Open notification panel → verify list renders with action text
- [x] Click "Đọc tất cả" → verify all marked as read, badge clears
- [x] Click notification → navigates to correct post/profile
- [x] Bookmark a post → verify bookmark icon filled
- [x] Go to "Đã lưu" tab → verify saved post appears
- [ ] Unbookmark → verify post removed from saved view
- [ ] Check right sidebar → suggested users render with follow buttons
- [ ] Dismiss a suggested user → removed from current session
- [ ] Check trending topics → top 10 hashtags render with counts
- [ ] Click trending hashtag → feed filters to that hashtag
- [ ] Click hashtag in post body → same filter behavior
- [ ] Clear hashtag filter → returns to full feed
- [ ] Mobile: horizontal scroll suggested users + trending chips
- [ ] Mobile: notification tab in sub-nav works
- [ ] Desktop: notification dropdown positions correctly below bell
- [ ] Desktop: saved tab in left nav works

**Step 5: Fix any issues found**

**Step 6: Final commit**

---

## Parallel Execution Map

Tasks that can run in parallel (no shared file conflicts):

- **Batch 1** (after Task 2): Tasks 3, 15 (backend models + frontend schemas/hooks)
- **Batch 2** (after Task 3): Tasks 4, 5, 6 (migration + repos in parallel)
- **Batch 3** (after Tasks 5, 6): Tasks 7, 8, 9, 10, 11 (service methods — separate methods, same file but independent sections)
- **Batch 4** (after service tasks): Tasks 13, 14 (handlers + DI wiring)
- **Batch 5** (after Task 15): Tasks 16, 18, 19, 20, 21 (frontend components — separate files)
- **Batch 6** (after frontend components): Tasks 17, 22, 23, 24 (integrations — modify existing files)
- **Batch 7** (after all): Tasks 25, 26, 27 (docs + testing)

**Note:** Tasks 7-12 all modify `community_service.go`, so while they're logically independent methods, they should be implemented sequentially to avoid merge conflicts. Same applies to Task 13 (single handler file) and Task 17 (multiple existing component files).
