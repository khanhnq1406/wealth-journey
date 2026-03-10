# Community Domain — Runtime Flows

Community social feed flows covering post creation, feed generation, like/unlike toggling, follow/unfollow operations, and Phase 2 social features (share post, notifications, saved posts). All operations require JWT authentication and enforce content ownership rules.

## Table of Contents

- [Create Post](#1-create-post)
- [Feed Generation](#2-feed-generation)
- [Like / Unlike Post](#3-like--unlike-post)
- [Follow / Unfollow User](#4-follow--unfollow-user)
- [Share Post](#5-share-post)

---

## 1. Create Post

**Trigger:** User submits "Create Post" form with content, topic tag, and optional image URL
**Endpoint:** `POST /api/v1/community/posts`
**Source:** `domain/service/community_service.go`, `handlers/community.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as CommunityHandler
    participant CS as CommunityService
    participant PR as PostRepository

    SPA->>H: POST /api/v1/community/posts<br/>{content, topicTag, imageUrl}
    H->>H: GetUserID from JWT
    H->>H: Validate request body
    H->>CS: CreatePost(userID, req)

    activate CS
    CS->>CS: Validate content length (1-2000 chars)
    CS->>CS: Validate topicTag is not empty

    CS->>PR: Create(Post{userID, content, topicTag, imageUrl})
    alt DB error
        PR-->>CS: Error
        CS-->>H: 500 Internal Error
        H-->>SPA: {success: false, message: "..."}
    end
    PR-->>CS: Created Post
    deactivate CS

    CS-->>H: Post with author info
    H-->>SPA: {success: true, data: PostItem}
```

**Key Invariants:**
- Content must be 1-2000 characters
- Topic tag must not be empty
- Author ID comes from JWT (never from request body)
- Image URL is optional; no server-side upload in Phase 1

**Error Paths:**

| Condition | Response | Rollback |
|-----------|----------|----------|
| Missing/invalid JWT | 401 Unauthorized | None |
| Empty content | 400 Validation Error | None |
| Empty topic tag | 400 Validation Error | None |
| DB write failure | 500 Internal Error | None |

---

## 2. Feed Generation

**Trigger:** User opens community page or scrolls to load more posts
**Endpoint:** `GET /api/v1/community/feed?topicFilter=&page=1&pageSize=20`
**Source:** `domain/service/community_service.go`, `handlers/community.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as CommunityHandler
    participant CS as CommunityService
    participant FR as FollowRepository
    participant PR as PostRepository
    participant LR as LikeRepository

    SPA->>H: GET /api/v1/community/feed<br/>?topicFilter=&page=1&pageSize=20
    H->>H: GetUserID from JWT
    H->>CS: GetFeed(userID, topicFilter, page, pageSize)

    activate CS
    CS->>FR: GetFollowingIDs(userID)
    FR-->>CS: followingIDs []int32

    CS->>CS: Append userID to followingIDs<br/>(user sees own posts)

    CS->>PR: GetFeedPosts(followingIDs, topicFilter, page, pageSize)
    alt No posts found
        PR-->>CS: empty []Post
        CS-->>H: {posts: [], hasMore: false}
        H-->>SPA: {success: true, posts: []}
    end
    PR-->>CS: []Post

    CS->>LR: BatchCheckLikes(userID, postIDs)
    LR-->>CS: map[postID]bool

    CS->>CS: Build PostItem[] with isLiked flags
    deactivate CS

    CS-->>H: {posts: PostItem[], hasMore: bool}
    H-->>SPA: {success: true, posts: [...], hasMore: true}
```

**Key Invariants:**
- Feed shows posts from users the current user follows + own posts
- Posts are ordered by createdAt descending (newest first)
- Topic filter is optional; empty string returns all topics
- `isLiked` is resolved per-post for the requesting user
- Page size capped at reasonable limit to prevent abuse

**Error Paths:**

| Condition | Response | Rollback |
|-----------|----------|----------|
| Missing/invalid JWT | 401 Unauthorized | None |
| Invalid page/pageSize | 400 Validation Error | None |
| DB read failure | 500 Internal Error | None |

---

## 3. Like / Unlike Post

**Trigger:** User clicks the heart button on a post
**Endpoint:** `POST /api/v1/community/posts/:post_id/like` (like) or `DELETE /api/v1/community/posts/:post_id/like` (unlike)
**Source:** `domain/service/community_service.go`, `handlers/community.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as CommunityHandler
    participant CS as CommunityService
    participant LR as LikeRepository
    participant PR as PostRepository

    SPA->>H: POST /api/v1/community/posts/:post_id/like
    Note over SPA: Optimistic UI: toggle heart immediately
    H->>H: GetUserID from JWT
    H->>H: Parse post_id from URL
    H->>CS: LikePost(userID, postID)

    activate CS
    CS->>LR: Exists(userID, postID)
    alt Already liked
        LR-->>CS: true
        CS-->>H: 409 Conflict (already liked)
        H-->>SPA: {success: false}
        Note over SPA: Rollback optimistic update
    end
    LR-->>CS: false

    CS->>LR: Create(PostLike{userID, postID})
    LR-->>CS: Created

    CS->>PR: IncrementLikeCount(postID)
    PR-->>CS: Updated
    deactivate CS

    CS-->>H: Success
    H-->>SPA: {success: true}
```

**Unlike flow** mirrors the like flow:
1. Check like exists → if not, return 404
2. Delete the PostLike record
3. Decrement like count on the Post

**Key Invariants:**
- One like per user per post (unique constraint)
- Like count on Post is denormalized for read performance
- Frontend uses optimistic updates with rollback on error
- Like count cannot go below 0

**Error Paths:**

| Condition | Response | Rollback |
|-----------|----------|----------|
| Missing/invalid JWT | 401 Unauthorized | None |
| Post not found | 404 Not Found | None |
| Already liked (on like) | 409 Conflict | Frontend rollback |
| Not liked (on unlike) | 404 Not Found | Frontend rollback |

---

## 4. Follow / Unfollow User

**Trigger:** User clicks "Theo dõi" (Follow) or "Đang theo dõi" (Unfollow) button
**Endpoint:** `POST /api/v1/community/users/:user_id/follow` (follow) or `DELETE /api/v1/community/users/:user_id/follow` (unfollow)
**Source:** `domain/service/community_service.go`, `handlers/community.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as CommunityHandler
    participant CS as CommunityService
    participant FR as FollowRepository

    SPA->>H: POST /api/v1/community/users/:user_id/follow
    Note over SPA: Optimistic UI: toggle button immediately
    H->>H: GetUserID from JWT
    H->>H: Parse target user_id from URL
    H->>CS: FollowUser(followerID, followeeID)

    activate CS
    CS->>CS: Validate followerID != followeeID
    alt Self-follow attempt
        CS-->>H: 400 Cannot follow yourself
        H-->>SPA: {success: false}
        Note over SPA: Rollback optimistic update
    end

    CS->>FR: Exists(followerID, followeeID)
    alt Already following
        FR-->>CS: true
        CS-->>H: 409 Conflict (already following)
        H-->>SPA: {success: false}
        Note over SPA: Rollback optimistic update
    end
    FR-->>CS: false

    CS->>FR: Create(UserFollow{followerID, followeeID})
    FR-->>CS: Created
    deactivate CS

    CS-->>H: Success
    H-->>SPA: {success: true}
```

**Unfollow flow** mirrors the follow flow:
1. Validate not self-unfollow
2. Check follow exists → if not, return 404
3. Delete the UserFollow record

**Key Invariants:**
- Users cannot follow themselves
- One follow relationship per user pair (unique constraint)
- Follow/unfollow affects which posts appear in the user's feed
- Frontend uses optimistic updates with rollback on error

**Error Paths:**

| Condition | Response | Rollback |
|-----------|----------|----------|
| Missing/invalid JWT | 401 Unauthorized | None |
| Self-follow attempt | 400 Bad Request | Frontend rollback |
| Already following (on follow) | 409 Conflict | Frontend rollback |
| Not following (on unfollow) | 404 Not Found | Frontend rollback |
| Target user not found | 404 Not Found | Frontend rollback |

---

## 5. Share Post

**Trigger:** User clicks "Share" on a post, writes an optional comment in `SharePostModal`, and submits
**Endpoint:** `POST /api/v1/community/posts/:post_id/share`
**Source:** `domain/service/community_service.go`, `handlers/community.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as CommunityHandler
    participant CS as CommunityService
    participant PR as PostRepository
    participant NR as NotificationRepository

    SPA->>H: POST /api/v1/community/posts/:post_id/share<br/>{comment?}
    H->>H: GetUserID from JWT
    H->>H: Parse post_id from URL
    H->>CS: SharePost(sharerID, originalPostID, comment)

    activate CS
    CS->>PR: GetByID(originalPostID)
    alt Post not found
        PR-->>CS: nil
        CS-->>H: 404 Not Found
        H-->>SPA: {success: false, message: "Post not found"}
    end
    PR-->>CS: originalPost

    CS->>CS: Build new Post{userID: sharerID, sharedPostID: originalPostID,<br/>content: comment, topicTag: originalPost.topicTag}

    CS->>PR: Create(sharedPost)
    alt DB error
        PR-->>CS: Error
        CS-->>H: 500 Internal Error
        H-->>SPA: {success: false, message: "..."}
    end
    PR-->>CS: Created sharedPost

    CS->>PR: IncrementShareCount(originalPostID)
    PR-->>CS: Updated

    CS->>NR: Create(Notification{recipientID: originalPost.userID,<br/>actorID: sharerID, type: "share", postID: originalPostID})
    NR-->>CS: Created
    deactivate CS

    CS-->>H: sharedPost with embed
    H-->>SPA: {success: true, data: PostItem}
```

**Key Invariants:**
- A share creates a new Post record referencing the original via `sharedPostID`
- The original post's `shareCount` is incremented atomically
- A notification is dispatched to the original post's author (skipped if sharer == author)
- The optional `comment` field is the sharer's own caption (may be empty)
- The original post is embedded in the feed response as `SharedPostEmbed` for display
- Shared posts carry the original's `topicTag` so they appear in the same topic filter

**Error Paths:**

| Condition | Response | Rollback |
|-----------|----------|----------|
| Missing/invalid JWT | 401 Unauthorized | None |
| Original post not found | 404 Not Found | None |
| Comment exceeds 2000 chars | 400 Validation Error | None |
| DB write failure (new post) | 500 Internal Error | None |
| DB failure (share count increment) | 500 Internal Error | New post is rolled back |
