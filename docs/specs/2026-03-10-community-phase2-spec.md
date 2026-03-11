# Community Phase 2 (Social) Specification

## Phase Overview

| Phase | Name | Scope | Status |
|-------|------|-------|--------|
| 1 | MVP | Feed, Posts, Like, Comment, Follow, Basic Profile, Report | `completed` |
| **2** | **Social** | **Share/Repost, Notifications, Saved Posts, Suggested Users, Trending Topics** | **Current** |
| 3 | Advanced | Groups, Advanced profile, Polls, Admin moderation dashboard | `planned` |

## Summary

Phase 2 adds the **social engagement layer** on top of the Phase 1 MVP community module. Five features work together to increase user retention and content discovery: (1) quote-repost lets users amplify and comment on others' posts, (2) in-app notifications keep users informed of engagement on their content, (3) saved posts let users bookmark valuable finance content, (4) suggested users surface new people to follow based on the social graph, and (5) trending topics powered by free-form hashtags enable content discovery by theme.

**Design Reference:** `design/pencil/design-v2/community/feed.pen`
**Phase 1 Spec:** `docs/specs/2026-03-09-community-phase1-spec.md`
**Phase 1 Report:** `docs/reports/2026-03-10-community-phase1-report.md`

## User Stories

### Share / Repost
- As a user, I want to share an interesting post with my own commentary so my followers see it with my perspective.
- As a user, I want to see who shared my post so I know my content is being amplified.
- As a user, I want to see the original post embedded inside a shared post so I understand the context.
- As a user, I want a share count on my posts so I can gauge how widely they're being distributed.

### Notifications
- As a user, I want to see a bell icon with an unread count in the app header so I know when something happened.
- As a user, I want to receive notifications when someone likes my post, comments on my post, follows me, or shares my post.
- As a user, I want to click a notification and navigate to the relevant post or profile.
- As a user, I want to mark all notifications as read so I can clear the badge.
- As a user, I want to see a chronological list of my notifications with relative timestamps.

### Saved Posts
- As a user, I want to bookmark a post so I can find it later.
- As a user, I want to unbookmark a post I no longer need.
- As a user, I want a dedicated "Saved" view to browse all my bookmarked posts.
- As a user, I want saved posts to appear in chronological order (newest saved first).

### Suggested Users
- As a user, I want to see suggested people to follow in the right sidebar so I can discover new finance content creators.
- As a user, I want suggestions based on who my follows are following (friends-of-friends) and popular users.
- As a user, I want to follow a suggested user directly from the suggestion card without navigating away.
- As a user, I want to dismiss a suggestion if I'm not interested.

### Trending Topics
- As a user, I want to add hashtags to my posts (e.g., #crypto, #savings) so others can discover my content by topic.
- As a user, I want to see the top 10 trending hashtags from the last 24 hours in the right sidebar.
- As a user, I want to click a trending hashtag and see all posts tagged with it.
- As a user, I want hashtags in post content to be clickable links that filter the feed.

---

## Functional Requirements

### FR-1: Share / Repost (Quote Repost)

A share creates a **new post** that embeds the original post. The sharer can add optional commentary text above the embedded original.

**Acceptance criteria:**
- [ ] User can tap a "Share" button on any post (including shared posts — no recursive embedding, shows original only)
- [ ] Share opens a modal with the original post preview and a text input for optional commentary (0-2000 chars)
- [ ] Share creates a new `Post` record with `shared_post_id` referencing the original post
- [ ] Shared posts render with: sharer's header + commentary (if any) + embedded original post card (read-only, styled distinctly)
- [ ] If the original post is deleted (soft-deleted), the shared post shows "This post is no longer available" placeholder
- [ ] Post model gains `shareCount` (denormalized counter, incremented on share)
- [ ] `PostItem` proto gains `shareCount`, `sharedPost` (embedded `PostItem`), and `isShared` fields
- [ ] User cannot share their own posts
- [ ] Share action triggers a notification to the original post author (type: `share`)
- [ ] Feed correctly displays shared posts with proper attribution

### FR-2: In-App Notifications

Notifications are stored server-side and fetched via polling. A bell icon in the app-wide header shows unread count.

**Acceptance criteria:**
- [ ] New `notification` database table stores notifications with `type`, `actor_id`, `target_id`, `target_type`, `post_id`, `is_read`, `created_at`
- [ ] Notification types: `like`, `comment`, `follow`, `share`
- [ ] Notifications are created server-side as a side-effect of like/comment/follow/share actions
- [ ] `GetNotifications` RPC returns paginated notifications (default 20, max 50)
- [ ] `GetUnreadCount` RPC returns the count of unread notifications
- [ ] `MarkNotificationsRead` RPC marks all notifications as read (batch update)
- [ ] Frontend polls `GetUnreadCount` every 30 seconds when the user is on any dashboard page
- [ ] Bell icon in desktop top bar and mobile header shows red badge with unread count (hidden when 0)
- [ ] Clicking bell opens a notification dropdown/panel listing recent notifications
- [ ] Each notification displays: actor avatar, actor name, action text, relative timestamp, read/unread indicator
- [ ] Clicking a notification navigates to the relevant post (for like/comment/share) or profile (for follow)
- [ ] Clicking a notification marks it as read
- [ ] "Mark all as read" button at the top of the notification panel
- [ ] Self-actions do NOT generate notifications (e.g., liking your own post)
- [ ] Notification panel uses z-index `dropdown` (20) — below modals, above content

### FR-3: Saved Posts (Bookmarks)

Users can bookmark posts for later reference. Saved posts are private to the user.

**Acceptance criteria:**
- [ ] New `saved_post` database table with unique constraint on `(user_id, post_id)`
- [ ] Bookmark icon appears on every post in the feed (next to share button)
- [ ] Tapping bookmark toggles save/unsave with optimistic UI update
- [ ] `PostItem` proto gains `isSaved` boolean field
- [ ] `SavePost` / `UnsavePost` RPCs for toggling
- [ ] `GetSavedPosts` RPC returns paginated saved posts (newest saved first)
- [ ] Saved posts accessible via a "Saved" tab in the MobileSubNav and CommunityNav
- [ ] Saved post count is NOT displayed publicly (private feature)
- [ ] Batch `isSaved` check in feed queries to prevent N+1 (same pattern as `isLiked`)
- [ ] Unsaving a post that was already unsaved returns success (idempotent)

### FR-4: Suggested Users

Right sidebar shows up to 5 suggested users based on mutual-follow graph and popularity.

**Acceptance criteria:**
- [ ] `GetSuggestedUsers` RPC returns up to 5 user suggestions
- [ ] Algorithm: prioritize users followed by people you follow (friends-of-friends), fill remaining slots with top users by follower count
- [ ] Exclude: users already followed, the requesting user, users with 0 posts
- [ ] Each suggestion card shows: avatar, name, bio snippet (first 60 chars), mutual follow count, follow button
- [ ] Follow button works inline (optimistic UI, same `useFollow` hook)
- [ ] Dismiss button removes the suggestion from the current session (client-side only, no persistence)
- [ ] Replaces `SuggestedUsersPlaceholder` component in `CommunityRightSidebar`
- [ ] On mobile, suggested users appear in a horizontal scroll section above the feed
- [ ] Suggested users refresh when: user follows/unfollows someone, or page is refreshed
- [ ] Results are cached for 5 minutes (React Query staleTime)

### FR-5: Trending Topics (Hashtags)

Free-form hashtags extracted from post content, aggregated into a trending section.

**Acceptance criteria:**
- [ ] Hashtags are extracted from post content using regex pattern `#[a-zA-Z0-9_\u00C0-\u024F]+` (supports Vietnamese diacritics)
- [ ] New `post_hashtag` junction table: `(post_id, hashtag)` — hashtags stored lowercase, normalized
- [ ] Hashtags extracted and stored on post create/update; removed on post delete
- [ ] Maximum 10 hashtags per post; additional hashtags silently ignored
- [ ] `GetTrendingTopics` RPC returns top 10 hashtags from the last 24 hours, ordered by post count
- [ ] Each trending item shows: hashtag text, post count in last 24h
- [ ] Replaces trending placeholder in `CommunityRightSidebar`
- [ ] Clicking a trending hashtag filters the feed to posts containing that hashtag
- [ ] `GetFeed` gains optional `hashtag` query parameter for filtering
- [ ] Hashtags in post content rendered as clickable links (styled `text-v2-red-primary`)
- [ ] Hashtag parsing is server-side (backend extracts and stores); frontend renders clickable links from raw content
- [ ] On mobile, trending topics appear below suggested users in a horizontal chip scroll

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Notification polling: max 50ms response for `GetUnreadCount`; trending query: max 200ms (indexed aggregation) |
| **Performance** | Suggested users query: max 300ms (social graph traversal with LIMIT) |
| **Performance** | Feed with shared posts: no additional round-trip; shared post data embedded in feed response |
| **Security** | Notifications only accessible by the owning user; saved posts are private |
| **Security** | Hashtag content sanitized (no HTML, no scripts); notification text generated server-side (not from user input) |
| **Security** | Rate limit: max 10 shares per minute per user; max 100 notification poll requests per minute |
| **Scalability** | Notification table: partition-ready by `user_id`; index on `(user_id, is_read, created_at)` |
| **Scalability** | Trending aggregation: index on `(hashtag, created_at)` for efficient 24h window queries |
| **Accessibility** | Notification badge uses `aria-label` with count; bell button has clear `aria-label` |
| **Accessibility** | Bookmark toggle uses `aria-pressed` attribute |
| **Mobile** | Notification panel: full-screen overlay on mobile (< 800px), dropdown on desktop |
| **Mobile** | Suggested users: horizontal scroll with snap points on mobile |

---

## Architecture Changes (C4)

### Diagrams to Update

**L3 Backend Component (`docs/architecture/c4-component-backend.md`):**
- Add `NotificationService` to CommunityService dependencies
- Add `NotificationRepository`, `SavedPostRepository`, `HashtagRepository` to repository layer
- Update `CommunityHandler` to include new endpoints (share, notifications, saved, suggested, trending)

**L3 Frontend Component (`docs/architecture/c4-component-frontend.md`):**
- Add `NotificationPanel` to shared components (lives in `components/` since it's in the app header)
- Add `SavedPostsView`, `SuggestedUsers`, `TrendingTopics`, `SharePostModal` to `features/community/components/`
- Add `useNotifications`, `useSavedPost` hooks to `features/community/hooks/`
- Update community page structure to include new tabs (Saved)

### New Diagrams

No new L4 code diagram needed — Phase 2 extends the existing community domain without introducing a new bounded context. The notification system is simple enough (single service + repository) that an L4 diagram would be over-documentation.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`docs/architecture/flow-community.md`:**
- Add "Share Post" sequence diagram (User → Handler → CommunityService → PostRepo.Create + NotificationService.Create)
- Add "Notification Polling" sequence diagram (User → Handler → NotificationService → NotificationRepo)
- Add "Save/Unsave Post" sequence diagram (User → Handler → CommunityService → SavedPostRepo)
- Add "Get Suggested Users" sequence diagram (User → Handler → CommunityService → FollowRepo graph query)
- Add "Get Trending Topics" sequence diagram (User → Handler → CommunityService → HashtagRepo aggregation)
- Update "Create Post" diagram to include hashtag extraction step

### New Flow Diagrams

None — all new flows belong in the existing `flow-community.md` file.

---

## Data Model Changes

### New Table: `notification`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `int32` | PK, auto-increment | Notification ID |
| `user_id` | `int32` | NOT NULL, INDEX(`idx_notif_user_read_created`: user_id, is_read, created_at) | Notification recipient |
| `actor_id` | `int32` | NOT NULL | User who triggered the notification |
| `type` | `varchar(20)` | NOT NULL | `like`, `comment`, `follow`, `share` |
| `post_id` | `int32` | NULL | Related post (null for `follow` type) |
| `is_read` | `boolean` | NOT NULL, DEFAULT false | Read status |
| `created_at` | `timestamp` | NOT NULL | Creation time |

**Indexes:**
- `idx_notif_user_read_created` — composite: `(user_id, is_read, created_at DESC)` — for unread count + paginated listing
- `idx_notif_user_created` — composite: `(user_id, created_at DESC)` — for paginated all-notifications query

### New Table: `saved_post`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `int32` | PK, auto-increment | Saved record ID |
| `user_id` | `int32` | NOT NULL, UNIQUE(`idx_saved_user_post`: user_id, post_id) | User who saved |
| `post_id` | `int32` | NOT NULL, UNIQUE(`idx_saved_user_post`: user_id, post_id) | Saved post |
| `created_at` | `timestamp` | NOT NULL | When saved (for ordering) |

**Indexes:**
- `idx_saved_user_post` — unique composite: `(user_id, post_id)` — prevents duplicate saves
- `idx_saved_user_created` — composite: `(user_id, created_at DESC)` — for paginated saved list

### New Table: `post_hashtag`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `int32` | PK, auto-increment | Record ID |
| `post_id` | `int32` | NOT NULL, INDEX(`idx_hashtag_post`) | Associated post |
| `hashtag` | `varchar(100)` | NOT NULL, INDEX(`idx_hashtag_tag_created`) | Lowercase normalized hashtag (without `#`) |
| `created_at` | `timestamp` | NOT NULL | Post creation time (denormalized for trending query efficiency) |

**Indexes:**
- `idx_hashtag_post` — `(post_id)` — for deleting hashtags when post is deleted
- `idx_hashtag_tag_created` — composite: `(hashtag, created_at DESC)` — for trending aggregation and hashtag feed filter
- `idx_hashtag_unique` — unique composite: `(post_id, hashtag)` — prevents duplicate hashtags on same post

### Modified Table: `post`

| Column | Change | Description |
|--------|--------|-------------|
| `shared_post_id` | ADD, `int32`, NULL, INDEX(`idx_post_shared`) | References the original post being shared (NULL for regular posts) |
| `share_count` | ADD, `int32`, DEFAULT 0 | Denormalized share counter |

### Modified Proto: `PostItem`

| Field | Change | Description |
|-------|--------|-------------|
| `shareCount` | ADD, `int32` | Number of times this post was shared |
| `sharedPost` | ADD, `PostItem` | Embedded original post data (populated only for shared posts) |
| `isShared` | ADD, `bool` | Whether this post is a share of another post |
| `isSaved` | ADD, `bool` | Whether the current user has saved this post |
| `hashtags` | ADD, `repeated string` | Extracted hashtags from post content |

---

## API Changes

### New RPCs in `CommunityService`

```protobuf
// Share/Repost
rpc SharePost(SharePostRequest) returns (SharePostResponse) {
  option (google.api.http) = {
    post: "/api/v1/community/posts/{postId}/share"
    body: "*"
  };
}

// Notifications
rpc GetNotifications(GetNotificationsRequest) returns (GetNotificationsResponse) {
  option (google.api.http) = {
    get: "/api/v1/community/notifications"
  };
}

rpc GetUnreadNotificationCount(GetUnreadNotificationCountRequest) returns (GetUnreadNotificationCountResponse) {
  option (google.api.http) = {
    get: "/api/v1/community/notifications/unread-count"
  };
}

rpc MarkNotificationsRead(MarkNotificationsReadRequest) returns (MarkNotificationsReadResponse) {
  option (google.api.http) = {
    put: "/api/v1/community/notifications/read"
    body: "*"
  };
}

// Saved Posts
rpc SavePost(SavePostRequest) returns (SavePostResponse) {
  option (google.api.http) = {
    post: "/api/v1/community/posts/{postId}/save"
    body: "*"
  };
}

rpc UnsavePost(UnsavePostRequest) returns (UnsavePostResponse) {
  option (google.api.http) = {
    delete: "/api/v1/community/posts/{postId}/save"
  };
}

rpc GetSavedPosts(GetSavedPostsRequest) returns (GetSavedPostsResponse) {
  option (google.api.http) = {
    get: "/api/v1/community/saved"
  };
}

// Suggested Users
rpc GetSuggestedUsers(GetSuggestedUsersRequest) returns (GetSuggestedUsersResponse) {
  option (google.api.http) = {
    get: "/api/v1/community/suggested-users"
  };
}

// Trending Topics
rpc GetTrendingTopics(GetTrendingTopicsRequest) returns (GetTrendingTopicsResponse) {
  option (google.api.http) = {
    get: "/api/v1/community/trending"
  };
}
```

### New Messages

```protobuf
// --- Share ---
message SharePostRequest {
  int32 postId = 1 [json_name = "postId"];      // Original post to share
  string content = 2 [json_name = "content"];    // Optional commentary (0-2000 chars)
}

message SharePostResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  PostItem data = 3 [json_name = "data"];        // The newly created shared post
  string timestamp = 4 [json_name = "timestamp"];
}

// --- Notifications ---
message NotificationItem {
  int32 id = 1 [json_name = "id"];
  string type = 2 [json_name = "type"];              // "like", "comment", "follow", "share"
  int32 actorId = 3 [json_name = "actorId"];
  string actorName = 4 [json_name = "actorName"];
  string actorPicture = 5 [json_name = "actorPicture"];
  int32 postId = 6 [json_name = "postId"];           // null/0 for follow type
  string postPreview = 7 [json_name = "postPreview"]; // First 100 chars of post content
  bool isRead = 8 [json_name = "isRead"];
  int64 createdAt = 9 [json_name = "createdAt"];
}

message GetNotificationsRequest {
  wealthjourney.common.v1.PaginationParams pagination = 1 [json_name = "pagination"];
}

message GetNotificationsResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated NotificationItem notifications = 3 [json_name = "notifications"];
  wealthjourney.common.v1.PaginationResult pagination = 4 [json_name = "pagination"];
  string timestamp = 5 [json_name = "timestamp"];
}

message GetUnreadNotificationCountRequest {}

message GetUnreadNotificationCountResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  int32 count = 3 [json_name = "count"];
  string timestamp = 4 [json_name = "timestamp"];
}

message MarkNotificationsReadRequest {}

message MarkNotificationsReadResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  string timestamp = 3 [json_name = "timestamp"];
}

// --- Saved Posts ---
message SavePostRequest {
  int32 postId = 1 [json_name = "postId"];
}

message SavePostResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  string timestamp = 3 [json_name = "timestamp"];
}

message UnsavePostRequest {
  int32 postId = 1 [json_name = "postId"];
}

message UnsavePostResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  string timestamp = 3 [json_name = "timestamp"];
}

message GetSavedPostsRequest {
  wealthjourney.common.v1.PaginationParams pagination = 1 [json_name = "pagination"];
}

message GetSavedPostsResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated PostItem posts = 3 [json_name = "posts"];
  wealthjourney.common.v1.PaginationResult pagination = 4 [json_name = "pagination"];
  string timestamp = 5 [json_name = "timestamp"];
}

// --- Suggested Users ---
message SuggestedUserItem {
  int32 userId = 1 [json_name = "userId"];
  string userName = 2 [json_name = "userName"];
  string userPicture = 3 [json_name = "userPicture"];
  string bioSnippet = 4 [json_name = "bioSnippet"];      // First 60 chars of bio
  int32 mutualFollowCount = 5 [json_name = "mutualFollowCount"]; // Friends-of-friends count
  int32 followerCount = 6 [json_name = "followerCount"];
}

message GetSuggestedUsersRequest {}

message GetSuggestedUsersResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated SuggestedUserItem users = 3 [json_name = "users"];
  string timestamp = 4 [json_name = "timestamp"];
}

// --- Trending Topics ---
message TrendingTopicItem {
  string hashtag = 1 [json_name = "hashtag"];
  int32 postCount = 2 [json_name = "postCount"];
}

message GetTrendingTopicsRequest {}

message GetTrendingTopicsResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated TrendingTopicItem topics = 3 [json_name = "topics"];
  string timestamp = 4 [json_name = "timestamp"];
}
```

### Modified Messages

```protobuf
// PostItem — add new fields (keep existing field numbers, append new ones)
message PostItem {
  // ... existing fields 1-14 unchanged ...
  int32 shareCount = 15 [json_name = "shareCount"];
  PostItem sharedPost = 16 [json_name = "sharedPost"];  // Embedded original post (1 level only)
  bool isShared = 17 [json_name = "isShared"];
  bool isSaved = 18 [json_name = "isSaved"];
  repeated string hashtags = 19 [json_name = "hashtags"];
}

// GetFeedRequest — add optional hashtag filter
message GetFeedRequest {
  wealthjourney.common.v1.PaginationParams pagination = 1 [json_name = "pagination"];
  string hashtag = 2 [json_name = "hashtag"];  // Optional: filter by hashtag
}
```

---

## UI/UX Changes

### New Routes

| Route | Purpose |
|-------|---------|
| `/dashboard/community` | Main community page (existing, updated with new features) |
| `/dashboard/community?hashtag=<tag>` | Feed filtered by hashtag (query param, same page) |
| `/dashboard/community?tab=saved` | Saved posts view (query param tab, same page) |

### Desktop Layout Update (3-column)

```
┌──────────────────────────────────────────────────────────────────┐
│ Desktop Top Bar                                          🔔 (3) │
│ (existing bell now shows unread notification count badge)        │
│ Click bell → NotificationDropdown panel                          │
└──────────────────────────────────────────────────────────────────┘
│  Left Sidebar (280px)  │  Center Feed (flex-1)  │ Right Sidebar  │
│                        │                        │   (280px)      │
│  ProfileCard           │  CreatePostBox         │                │
│                        │                        │  Suggested     │
│  CommunityNav          │  [Feed / Saved] tabs   │  Users (5)     │
│  ├ Bảng tin            │                        │  ┌──────────┐  │
│  ├ Đã lưu (NEW)       │  CommunityFeed         │  │ Avatar    │  │
│  ├ Hồ sơ              │  (with shared posts,   │  │ Name      │  │
│  └ Thông báo (NEW)    │   bookmark icons,      │  │ Bio...    │  │
│    (links to notif     │   hashtag links)       │  │ [Follow]  │  │
│     panel)             │                        │  └──────────┘  │
│                        │                        │                │
│                        │                        │  Trending      │
│                        │                        │  Topics (10)   │
│                        │                        │  #crypto (42)  │
│                        │                        │  #savings (38) │
│                        │                        │  #vnindex (25) │
│                        │                        │  ...           │
└────────────────────────┴────────────────────────┴────────────────┘
```

### Mobile Layout Update

```
┌────────────────────────────────┐
│ Mobile Header        🔍 🔔 ☰  │  ← Bell gets unread badge
│                       (3)      │
└────────────────────────────────┘
│ MobileSubNav                   │
│ [Bảng tin] [Đã lưu] [Hồ sơ]  │  ← Updated tabs
│ [Thông báo]                    │  ← New tab
├────────────────────────────────┤
│ Suggested Users (horizontal    │  ← New horizontal scroll
│ scroll cards)                  │
├────────────────────────────────┤
│ Trending chips (horizontal     │  ← New chip scroll
│ scroll: #crypto #savings ...)  │
├────────────────────────────────┤
│ CreatePostBox                  │
│ CommunityFeed                  │
│ (shared posts, bookmarks,      │
│  clickable hashtags)           │
└────────────────────────────────┘
│ Bottom Nav: Portfolio|Home|Comm│
└────────────────────────────────┘
```

### Notification Panel (Desktop: Dropdown, Mobile: Full-screen)

```
Desktop Dropdown (320px wide, max-h 480px, positioned below bell icon):
┌────────────────────────────────┐
│ Thông báo        [Đọc tất cả] │
├────────────────────────────────┤
│ 🔴 Nguyen Van A đã thích      │
│    bài viết của bạn   · 5m    │
├────────────────────────────────┤
│    Tran Thi B đã bình luận    │
│    bài viết của bạn   · 2h    │
├────────────────────────────────┤
│ 🔴 Le Van C đã theo dõi bạn  │
│                        · 1d   │
├────────────────────────────────┤
│          [Xem thêm →]         │
└────────────────────────────────┘

Mobile Full-screen (same content, scrollable):
┌────────────────────────────────┐
│ ← Thông báo      [Đọc tất cả]│
├────────────────────────────────┤
│ (Same notification items,      │
│  full-width, scrollable list)  │
└────────────────────────────────┘
```

### Shared Post Card Rendering

```
┌────────────────────────────────┐
│ [Avatar] Nguyen Van A shared   │  ← Sharer header
│ 2h · [Follow]                  │
├────────────────────────────────┤
│ "Bài viết này rất hay!"       │  ← Sharer's commentary
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│ ┌──────────────────────────┐   │
│ │ [Avatar] Tran Thi B      │   │  ← Original post (embedded, distinct bg)
│ │ 3h                       │   │
│ │                          │   │
│ │ Original post content... │   │
│ │ [image if any]           │   │
│ └──────────────────────────┘   │
├────────────────────────────────┤
│ 5 likes · 2 comments · 1 share│  ← Engagement counts (sharer's post)
│ [♡ Like] [💬 Comment] [↗ Share]│  ← Actions
│          [🔖 Save]             │
└────────────────────────────────┘
```

### Feature Module Structure (Updated)

```
features/community/
├── components/
│   ├── Avatar.tsx                    (existing)
│   ├── CommentBubble.tsx             (existing)
│   ├── CommentSection.tsx            (existing)
│   ├── CommunityFeed.tsx             (modified — hashtag filter, saved tab)
│   ├── CommunityLeftSidebar.tsx      (modified — nav items updated)
│   ├── CommunityNav.tsx              (modified — add Saved, Notifications)
│   ├── CommunityRightSidebar.tsx     (modified — real components replace placeholders)
│   ├── CreatePostBox.tsx             (existing)
│   ├── FeedEmpty.tsx                 (existing)
│   ├── FollowButton.tsx              (existing)
│   ├── MobileSubNav.tsx              (modified — add Saved, Notifications tabs)
│   ├── PostActions.tsx               (modified — add Share + Bookmark buttons)
│   ├── PostBody.tsx                  (modified — render clickable hashtags)
│   ├── PostCard.tsx                  (modified — render shared post embed)
│   ├── PostEngagement.tsx            (modified — add share count)
│   ├── PostHeader.tsx                (existing)
│   ├── ProfileCard.tsx               (existing)
│   ├── SavedPostsView.tsx            (NEW — saved posts list)
│   ├── SharePostModal.tsx            (NEW — share/quote repost modal)
│   ├── SharedPostEmbed.tsx           (NEW — embedded original post card)
│   ├── SuggestedUsers.tsx            (NEW — replaces SuggestedUsersPlaceholder)
│   ├── SuggestedUserCard.tsx         (NEW — individual suggestion card)
│   ├── TrendingTopics.tsx            (NEW — replaces trending placeholder)
│   └── HashtagLink.tsx               (NEW — clickable hashtag in post body)
├── forms/
│   ├── CreatePostForm.tsx            (existing)
│   ├── EditPostForm.tsx              (existing)
│   └── SharePostForm.tsx             (NEW — share commentary form)
├── hooks/
│   ├── useFollow.ts                  (existing)
│   ├── useLike.ts                    (existing)
│   ├── useSavedPost.ts              (NEW — save/unsave optimistic toggle)
│   └── useNotifications.ts          (NEW — polling + unread count)
└── utils/
    ├── community.schema.ts           (modified — add share, notification schemas)
    ├── time-format.ts                (existing)
    └── hashtag.ts                    (NEW — hashtag extraction + rendering utils)

components/
├── notifications/
│   ├── NotificationBell.tsx          (NEW — bell icon + badge, used in app header)
│   ├── NotificationPanel.tsx         (NEW — dropdown/fullscreen notification list)
│   └── NotificationItem.tsx          (NEW — single notification row)
```

**Note:** Notification components live in `components/notifications/` (shared layer) because the bell icon appears in the app-wide dashboard layout, not just the community page.

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | Share post request (postId, content) | Yes: Internet → App | CommunityHandler.SharePost | User input needs validation |
| 2 | CommunityService | Notification record | No: internal | NotificationRepository | Server-generated, no user input in stored data |
| 3 | User (browser) | Notification poll request | Yes: Internet → App | CommunityHandler.GetUnreadCount | Auth required, rate-limited |
| 4 | User (browser) | Save/unsave request | Yes: Internet → App | CommunityHandler.SavePost | Auth + post existence check |
| 5 | User (browser) | GetSuggestedUsers request | Yes: Internet → App | CommunityHandler.GetSuggestedUsers | Auth required, no user input |
| 6 | CommunityService | Social graph query | No: App → Database | FollowRepository | Complex query, needs LIMIT to prevent expensive scans |
| 7 | User (browser) | Feed request with hashtag filter | Yes: Internet → App | CommunityHandler.GetFeed | Hashtag param needs sanitization |
| 8 | CommunityService | Hashtag extraction from post content | No: internal | HashtagRepository | Server-side regex, controlled input |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | All user requests | JWT auth + rate limiting + input validation |
| App → Database | Service layer queries | Parameterized GORM queries, LIMIT clauses |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | User shares post as another user | High | JWT auth extracts user ID server-side |
| T-2 | 1 | Internet → App | Tampering | Malicious content in share commentary | Medium | Server-side HTML stripping, 2000 char limit |
| T-3 | 3 | Internet → App | Denial of Service | Excessive notification polling floods server | Medium | Rate limit: 100 polls/min/user; 30s client interval |
| T-4 | 6 | App → Database | Denial of Service | Expensive social graph query (suggested users) | Medium | LIMIT 5 results, 5-min cache, indexed queries |
| T-5 | 7 | Internet → App | Injection | SQL injection via hashtag filter param | High | Parameterized GORM query; hashtag sanitized to alphanumeric+underscore |
| T-6 | 2 | Internal | Information Disclosure | Notification leaks post content to unauthorized user | Low | Notification only contains post preview (100 chars), only delivered to post owner |
| T-7 | 1 | Internet → App | Elevation of Privilege | User shares a post they shouldn't see (e.g., deleted post) | Medium | Check post exists and is not soft-deleted before allowing share |
| T-8 | 8 | Internal | Tampering | Hashtag extraction bypassed to inject arbitrary tags | Low | Server-side extraction only; frontend does not send hashtags |
| T-9 | 4 | Internet → App | Repudiation | User saves/unsaves repeatedly to manipulate counts | Low | No count is exposed; unique constraint prevents duplicates |

### Authorization Rules

| Action | Who Can Do It |
|--------|---------------|
| Share a post | Any authenticated user (except the post author) |
| View notifications | Only the notification recipient |
| Mark notifications read | Only the notification recipient |
| Save/unsave a post | Any authenticated user |
| View saved posts | Only the owning user |
| Get suggested users | Any authenticated user (results personalized per user) |
| Get trending topics | Any authenticated user (global, not personalized) |
| Filter feed by hashtag | Any authenticated user |

### Input Validation Rules

| Field | Validation | Location |
|-------|-----------|----------|
| Share `content` | 0-2000 chars, HTML stripped | Service layer |
| Share `postId` | Must exist, not soft-deleted, not own post | Service layer |
| Notification `pagination` | page >= 1, pageSize 1-50 | Service layer (reuse `parsePagination`) |
| Feed `hashtag` filter | Alphanumeric + underscore + diacritics, max 100 chars, lowercase | Service layer |
| Hashtag extraction | Regex `#[a-zA-Z0-9_\u00C0-\u024F]+`, max 10 per post | Service layer |

### External Dependency Risks

None — Phase 2 features are entirely internal (no external APIs). Notification polling uses standard HTTP; no WebSocket or SSE dependencies.

### Sensitive Data Handling

| Data | Sensitivity | Protection |
|------|-------------|------------|
| Saved posts list | Private to user | Authorization check in handler + service |
| Notification content | Contains post preview + actor info | Only accessible by recipient; preview truncated to 100 chars |
| Social graph (follow data) | Semi-public | Used for suggestions but not directly exposed; only aggregated counts shown |

### Issues & Risks Summary

1. **Notification table growth** — Could grow rapidly with high engagement; mitigate with 90-day TTL cleanup job (Phase 3) and composite index on `(user_id, is_read, created_at)`
2. **Suggested users query cost** — Social graph traversal can be expensive; mitigate with LIMIT, 5-min React Query cache, and indexed follow table
3. **Trending topic gaming** — Users could spam hashtags; mitigate with 10-hashtag-per-post limit and rate limiting on post creation (already exists)
4. **Shared post chain** — If a shared post is itself shared, we must resolve to the original to prevent deep nesting; always reference the root original post

---

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Share a post that was already soft-deleted | Return 404 "Post not found" |
| Share a post that is itself a share | Reference the original root post, not the intermediate share |
| Share own post | Return 400 "Cannot share your own post" |
| View shared post where original was later deleted | Show embedded placeholder: "Bài viết gốc đã bị xóa" |
| Notification for a post that was later deleted | Notification still shows; clicking navigates to 404 which shows "Post not found" |
| Save an already-saved post | Idempotent success (no error) |
| Unsave a post that wasn't saved | Idempotent success (no error) |
| Hashtag with mixed case (#Crypto vs #crypto) | Normalize to lowercase before storage |
| Hashtag exceeds 100 chars | Silently truncate or ignore (regex won't match past reasonable length) |
| Post has > 10 hashtags | Store first 10, silently ignore rest |
| No suggested users available (new user, no follows) | Show top 5 by follower count as fallback |
| All suggested users dismissed | Show empty state: "Không còn gợi ý nào" |
| Notification poll fails (network error) | Silently retry on next 30s interval; keep showing last known count |
| User has 0 notifications | Show empty state in panel: "Chưa có thông báo nào" |
| Trending has < 10 topics | Show as many as available; if 0, show "Chưa có chủ đề nổi bật" |
| Feed filtered by non-existent hashtag | Show empty feed with message: "Không tìm thấy bài viết nào" |

---

## Dependencies & Assumptions

### Dependencies
- Phase 1 community module fully operational (all 17 RPCs working)
- Existing `PostRepository`, `FollowRepository`, `LikeRepository` interfaces
- Existing `useLike`, `useFollow` hook patterns for optimistic UI
- Bell icon already rendered in desktop top bar and mobile header (just needs wiring)
- `BaseModal` component for share modal
- React Query for polling and cache management

### Assumptions
- Notification polling every 30 seconds is acceptable UX (no real-time requirement)
- 5 suggested users is sufficient for right sidebar
- 10 trending topics is sufficient for discovery
- Hashtags are Latin + Vietnamese diacritics only (no CJK, emoji, or special chars)
- No notification preferences/settings needed in Phase 2 (all notifications enabled by default)
- Dismissed suggested users are session-only (no persistence)

---

## Out of Scope

- **Push notifications** (browser/mobile push) — Phase 3
- **Notification preferences** (enable/disable per type) — Phase 3
- **Notification cleanup/TTL** (auto-delete old notifications) — Phase 3
- **Saved post collections/folders** — Phase 3
- **Advanced trending algorithm** (weighted by engagement, not just count) — Phase 3
- **Hashtag autocomplete** when composing posts — Phase 3
- **Mention notifications** (@username) — Phase 3
- **Edit comments** — Phase 3
- **Reply threads** (nested comments) — Phase 3
- **Admin moderation dashboard** — Phase 3
- **Image upload integration** (Supabase Storage) — Phase 3
