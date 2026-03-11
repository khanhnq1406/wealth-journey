# Community Domain — Runtime Flows

Community social feed flows covering post creation, feed generation, like/unlike toggling, follow/unfollow operations, Phase 2 social features (share post, notifications, saved posts), and Phase 3 advanced features (image upload, edit comment, reply threads, SSE notification stream, reply list). All operations require JWT authentication and enforce content ownership rules.

## Table of Contents

- [Create Post](#1-create-post)
- [Feed Generation](#2-feed-generation)
- [Like / Unlike Post](#3-like--unlike-post)
- [Follow / Unfollow User](#4-follow--unfollow-user)
- [Share Post](#5-share-post)
- [View User Profile](#6-view-user-profile)
- [Get Following / Followers List](#7-get-following--followers-list)
- [Image Upload](#8-image-upload)
- [Edit Comment](#9-edit-comment)
- [Reply Thread (Create Reply)](#10-reply-thread-create-reply)
- [SSE Notification Stream](#11-sse-notification-stream)
- [Get Reply List](#12-get-reply-list)

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

---

## 6. View User Profile

**Trigger:** User clicks an avatar or username in the feed, or navigates to own profile from sidebar
**Endpoint:** `GET /api/v1/community/users/:user_id/profile` + `GET /api/v1/community/users/:user_id/posts`
**Source:** `domain/service/community_service.go`, `handlers/community.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as CommunityHandler
    participant CS as CommunityService
    participant UR as UserRepository
    participant FR as FollowRepository
    participant PR as PostRepository
    participant LR as LikeRepository

    SPA->>H: GET /api/v1/community/users/:user_id/profile
    H->>H: GetUserID from JWT (viewer)
    H->>H: Parse target user_id from URL
    H->>CS: GetCommunityProfile(viewerID, targetUserID)

    activate CS
    CS->>UR: GetByID(targetUserID)
    alt User not found
        UR-->>CS: nil
        CS-->>H: 404 Not Found
        H-->>SPA: {success: false}
    end
    UR-->>CS: User

    CS->>FR: CountFollowers(targetUserID)
    CS->>FR: CountFollowing(targetUserID)
    CS->>FR: Exists(viewerID, targetUserID)
    CS->>PR: CountByUserID(targetUserID)
    FR-->>CS: followerCount, followingCount, isFollowing
    PR-->>CS: postCount

    CS->>CS: Build profile (isOwnProfile = viewerID == targetUserID)
    deactivate CS

    CS-->>H: ProfileData
    H-->>SPA: {success: true, data: {userName, bio, followerCount, followingCount, postCount, isFollowing, isOwnProfile}}

    Note over SPA: SPA also fetches user's posts

    SPA->>H: GET /api/v1/community/users/:user_id/posts?page=1&pageSize=20
    H->>H: GetUserID from JWT
    H->>CS: GetUserPosts(viewerID, targetUserID, page, pageSize)

    activate CS
    CS->>PR: GetByUserID(targetUserID, page, pageSize)
    PR-->>CS: []Post
    CS->>LR: BatchCheckLikes(viewerID, postIDs)
    LR-->>CS: map[postID]bool
    CS->>CS: Build PostItem[] with isLiked, isOwnPost flags
    deactivate CS

    CS-->>H: {posts, pagination}
    H-->>SPA: {success: true, posts: [...], pagination: {...}}
```

**Key Invariants:**
- Profile data includes `isOwnProfile` flag to control UI (edit bio vs follow button)
- Viewer's follow status is resolved (`isFollowing`) for the follow button
- Posts are paginated and include the viewer's like/save state
- Bio editing is only available when `isOwnProfile` is true

**Error Paths:**

| Condition | Response | Rollback |
|-----------|----------|----------|
| Missing/invalid JWT | 401 Unauthorized | None |
| Target user not found | 404 Not Found | None |
| Invalid page/pageSize | 400 Validation Error | None |
| DB read failure | 500 Internal Error | None |

---

## 7. Get Following / Followers List

**Trigger:** User clicks "Đang theo dõi" (Following) or "Người theo dõi" (Followers) count on a profile
**Endpoint:** `GET /api/v1/community/users/:user_id/following` or `GET /api/v1/community/users/:user_id/followers`
**Source:** `domain/service/community_service.go`, `handlers/community.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as CommunityHandler
    participant CS as CommunityService
    participant FR as FollowRepository
    participant UR as UserRepository

    SPA->>H: GET /api/v1/community/users/:user_id/following<br/>?page=1&pageSize=20
    H->>H: GetUserID from JWT (viewer)
    H->>H: Parse target user_id from URL
    H->>CS: GetFollowing(viewerID, targetUserID, page, pageSize)

    activate CS
    CS->>FR: GetFollowing(targetUserID, offset, limit)
    Note over FR: Preloads Following User relationship
    FR-->>CS: []UserFollow (with Following user data), totalCount

    CS->>CS: Extract userIDs from follow list
    CS->>FR: GetFollowedAuthorIDs(viewerID, userIDs)
    Note over CS: Batch check: which users does the viewer follow?
    FR-->>CS: followedIDs set

    CS->>CS: Build FollowUserItem[] with:<br/>userName, userPicture, bioSnippet (60 chars),<br/>isFollowing (from batch check)
    deactivate CS

    CS-->>H: {users: FollowUserItem[], pagination}
    H-->>SPA: {success: true, users: [...], pagination: {...}}

    Note over SPA: Same flow for /followers endpoint<br/>(uses FR.GetFollowers with Preload("Follower"))
```

**Key Invariants:**
- Results are paginated with total count for "load more" support
- Each user includes `isFollowing` from the viewer's perspective (enables follow/unfollow buttons in the list)
- Bio snippet is truncated to 60 characters for compact display
- Users are ordered by follow creation time (newest first)
- Viewer cannot see follow lists of non-existent users (404)

**Error Paths:**

| Condition | Response | Rollback |
|-----------|----------|----------|
| Missing/invalid JWT | 401 Unauthorized | None |
| Target user not found | 404 Not Found | None |
| Invalid page/pageSize | 400 Validation Error | None |
| DB read failure | 500 Internal Error | None |

---

## 8. Image Upload

**Trigger:** User selects an image file in a post editor, profile edit modal, or cover photo picker
**Endpoint:** `POST /api/v1/community/upload` (multipart/form-data)
**Source:** `handlers/community.go` `UploadImage`, `domain/service/community_service.go` `UploadImage`, `pkg/imaging/imaging.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as CommunityHandler
    participant CS as CommunityService
    participant IMG as imaging.go
    participant Storage as Supabase Storage

    SPA->>SPA: Client validation:<br/>MIME type check (JPEG/PNG/WebP/GIF)<br/>File size check (≤ 5 MB)

    alt Client-side validation fails
        SPA->>SPA: Show error — do not send request
    end

    SPA->>H: POST /api/v1/community/upload<br/>multipart/form-data {file, purpose}
    Note over H: MaxBytesReader enforces 5 MB body limit

    H->>H: GetUserID from JWT
    H->>H: Parse multipart form<br/>Read file bytes + purpose field

    alt Body exceeds 5 MB
        H-->>SPA: 400 Bad Request — file too large
    end

    H->>CS: UploadImage(userID, fileData, purpose, filename)

    activate CS
    CS->>CS: Validate purpose whitelist<br/>("post" | "avatar" | "cover")

    alt Invalid purpose
        CS-->>H: 400 Bad Request
        H-->>SPA: {success: false, message: "invalid purpose"}
    end

    CS->>IMG: ValidateMagicBytes(fileData)
    Note over IMG: Checks JPEG (FF D8 FF), PNG (89 50 4E 47),<br/>GIF (47 49 46), WebP (52 49 46 46 + WEBP at offset 8)

    alt Magic bytes do not match any allowed type
        IMG-->>CS: error — unsupported file type
        CS-->>H: 400 Bad Request
        H-->>SPA: {success: false, message: "invalid file type"}
    end

    IMG-->>CS: detectedMIME

    CS->>CS: Determine maxWidth by purpose:<br/>avatar=400, cover=1920, post=2048

    CS->>IMG: ResizeImage(fileData, maxWidth)
    Note over IMG: Resize if wider than maxWidth<br/>Strip EXIF metadata (GPS, personal data)<br/>Maintain aspect ratio

    IMG-->>CS: processedData []byte

    CS->>CS: Generate storage key:<br/>community/{purpose}/{userID}/{uuid}.{ext}

    CS->>Storage: Upload(key, processedData, mimeType)

    alt Storage failure
        Storage-->>CS: Error
        CS-->>H: 500 Internal Error
        H-->>SPA: {success: false, message: "upload failed"}
    end

    Storage-->>CS: Public URL
    deactivate CS

    CS-->>H: imageUrl string
    H-->>SPA: {success: true, imageUrl: "https://..."}

    SPA->>SPA: Store returned URL, attach to post/profile form
```

### Key Invariants

- Magic bytes validation is server-side (not relying on Content-Type header from client) — prevents polyglot file attacks
- EXIF metadata is stripped from all images before storage (prevents GPS/personal data leakage)
- Storage keys use UUID-based filenames — no user input appears in the storage path
- File size limit is enforced both at Go `MaxBytesReader` level (hard cut) and as a client-side UX guard (soft pre-check)
- Rate limit: max 10 uploads per user per minute
- The `purpose` field determines the resize threshold; it is validated against a fixed whitelist

### Error Paths

| Condition | HTTP Status | Details |
|-----------|-------------|---------|
| Missing/invalid JWT | 401 Unauthorized | Auth middleware rejects before handler |
| Body exceeds 5 MB | 400 Bad Request | Go `MaxBytesReader` truncates and returns error |
| Client sends non-image file | 400 Bad Request | Magic bytes check fails; Content-Type is untrusted |
| Invalid purpose value | 400 Bad Request | Only "post", "avatar", "cover" are accepted |
| Image processing/resize failure | 500 Internal Error | Imaging library error |
| Supabase Storage unavailable | 500 Internal Error | No partial state; image is never referenced |

---

## 9. Edit Comment

**Trigger:** User clicks the edit option on their own comment and submits the updated text inline
**Endpoint:** `PUT /api/v1/community/comments/{commentId}`
**Source:** `handlers/community.go` `UpdateComment`, `domain/service/community_service.go` `UpdateComment`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as CommunityHandler
    participant CS as CommunityService
    participant CR as CommentRepository

    SPA->>H: PUT /api/v1/community/comments/{commentId}<br/>{content: "updated text"}
    H->>H: GetUserID from JWT
    H->>H: Parse commentId from URL path
    H->>H: Bind request body

    H->>CS: UpdateComment(userID, req{commentId, content})

    activate CS
    CS->>CR: GetByID(commentId)

    alt Comment not found
        CR-->>CS: nil
        CS-->>H: 404 Not Found
        H-->>SPA: {success: false, message: "comment not found"}
    end

    CR-->>CS: comment

    CS->>CS: Ownership check:<br/>comment.UserID != userID?

    alt Not the comment owner
        CS-->>H: 403 Forbidden
        H-->>SPA: {success: false, message: "not authorized to edit this comment"}
    end

    CS->>CS: Validate content length (1-500 chars)

    alt Content empty or too long
        CS-->>H: 400 Bad Request
        H-->>SPA: {success: false, message: "content must be 1-500 characters"}
    end

    CS->>CS: SanitizeStringField(content)
    CS->>CS: Set comment.Content = sanitized content
    CS->>CS: Set comment.UpdatedAt = &now

    CS->>CR: Update(comment)

    alt DB error
        CR-->>CS: Error
        CS-->>H: 500 Internal Error
        H-->>SPA: {success: false, message: "..."}
    end

    CR-->>CS: Updated comment
    deactivate CS

    CS-->>H: CommentItem{..., updatedAt, isEdited: true}
    H-->>SPA: {success: true, data: CommentItem}

    SPA->>SPA: Replace comment text in UI<br/>Show "(edited)" label next to timestamp
```

### Key Invariants

- Ownership is enforced in the service layer using the JWT-derived `userID` (not a request body field)
- `UpdatedAt` is always set to server time on successful edit — clients cannot supply a custom timestamp
- `isEdited` is derived at read time: `updatedAt != nil` indicates the comment has been edited
- Content is sanitized via the same `SanitizeStringField` function used at creation (XSS prevention)
- The comment's `PostID`, `ParentCommentID`, and `UserID` are immutable — only `Content` and `UpdatedAt` change

### Error Paths

| Condition | HTTP Status | Details |
|-----------|-------------|---------|
| Missing/invalid JWT | 401 Unauthorized | Auth middleware rejects before handler |
| Comment not found | 404 Not Found | `commentRepo.GetByID` returns nil |
| Requester is not the comment owner | 403 Forbidden | `comment.UserID != userID` check in service |
| Content is empty | 400 Bad Request | Minimum length 1 character |
| Content exceeds 500 characters | 400 Bad Request | Maximum length 500 characters |
| DB save failure | 500 Internal Error | No partial state; original comment is unchanged |

---

## 10. Reply Thread (Create Reply)

**Trigger:** User clicks "Reply" on a root comment, types a reply, and submits
**Endpoint:** `POST /api/v1/community/posts/{postId}/comments` with `parentCommentId > 0` in body
**Source:** `handlers/community.go` `CreateComment`, `domain/service/community_service.go` `CreateComment`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as CommunityHandler
    participant CS as CommunityService
    participant CR as CommentRepository
    participant PR as PostRepository
    participant NR as NotificationRepository
    participant Redis

    SPA->>H: POST /api/v1/community/posts/{postId}/comments<br/>{content, parentCommentId: <id>}
    H->>H: GetUserID from JWT
    H->>H: Parse postId from URL path
    H->>H: Bind request body

    H->>CS: CreateComment(userID, postId, req{content, parentCommentId})

    activate CS
    CS->>CS: Validate content (1-500 chars)

    CS->>CR: GetByID(parentCommentId)

    alt Parent comment not found
        CR-->>CS: nil
        CS-->>H: 404 Not Found
        H-->>SPA: {success: false, message: "parent comment not found"}
    end

    CR-->>CS: parentComment

    CS->>CS: Validate parentComment.PostID == postId
    Note over CS: Cross-post reply prevention (T-8)

    alt Parent belongs to different post
        CS-->>H: 400 Bad Request
        H-->>SPA: {success: false, message: "parent comment belongs to a different post"}
    end

    CS->>CS: Flatten nesting:<br/>if parentComment.ParentCommentID != nil,<br/>use parentComment.ParentCommentID as actualParentID<br/>(prevents nesting deeper than 1 level)

    CS->>CS: SanitizeStringField(content)
    CS->>CR: Create(Comment{userID, postId, content, parentCommentID: actualParentID})

    alt DB create error
        CR-->>CS: Error
        CS-->>H: 500 Internal Error
        H-->>SPA: {success: false, message: "..."}
    end

    CR-->>CS: newReply

    CS->>CR: IncrementReplyCount(actualParentID, +1)
    Note over CS,CR: Atomic increment on parent comment's reply_count

    CS->>PR: IncrementCommentCount(postId, +1)
    Note over CS,PR: Replies count toward the post's total comment_count

    opt Notify parent comment author (if not self-reply)
        CS->>NR: Create(Notification{<br/>recipientID: parentComment.UserID,<br/>actorID: userID,<br/>type: "reply",<br/>postID: postId,<br/>commentID: newReply.ID})
        NR-->>CS: Created

        CS->>Redis: Publish("user:{parentComment.UserID}:notifications", notificationItem)
        Note over CS,Redis: Real-time delivery to notification SSE stream
    end

    deactivate CS

    CS-->>H: CommentItem{..., parentCommentId, replyCount: 0}
    H-->>SPA: {success: true, data: CommentItem}

    SPA->>SPA: Append reply under parent comment<br/>Increment replyCount badge on parent
```

### Key Invariants

- Nesting is enforced to exactly 1 level: if the targeted parent is itself a reply, the new reply is re-parented to the grandparent (the original root comment)
- Cross-post reply prevention: the parent comment's `PostID` must match the URL `postId` parameter
- Both `IncrementReplyCount` (on the parent comment) and `IncrementCommentCount` (on the post) are executed — replies count toward total post comment count
- Notifications are published to Redis synchronously after DB write; Redis failure does not fail the request (best-effort)
- `GetComments` (root comment listing) excludes replies (`WHERE parent_comment_id IS NULL`) so they only appear when the reply list is explicitly loaded

### Error Paths

| Condition | HTTP Status | Details |
|-----------|-------------|---------|
| Missing/invalid JWT | 401 Unauthorized | Auth middleware rejects before handler |
| Parent comment not found | 404 Not Found | `commentRepo.GetByID` returns nil |
| Parent comment belongs to a different post | 400 Bad Request | Cross-post reply prevention check |
| Content empty or exceeds 500 chars | 400 Bad Request | Validation before DB write |
| DB create failure | 500 Internal Error | No reply is created; counts are not incremented |
| `IncrementReplyCount` failure | 500 Internal Error | Reply is rolled back conceptually (inconsistency risk) |

---

## 11. SSE Notification Stream

**Trigger:** Frontend mounts the notification bell component (community layout or dashboard layout)
**Endpoint:** `GET /api/v1/community/notifications/stream?token=<jwt>`
**Source:** `handlers/community.go` `StreamNotifications`

```mermaid
sequenceDiagram
    participant Browser
    participant SPA as Next.js SPA
    participant H as CommunityHandler
    participant Auth as AuthService
    participant Redis

    Note over SPA,H: EventSource API cannot send Authorization header —<br/>JWT is passed as ?token= query parameter instead

    SPA->>Browser: new EventSource("/api/v1/community/notifications/stream?token=<jwt>")
    Browser->>H: GET /api/v1/community/notifications/stream?token=<jwt>
    Note over H: SSE route is registered OUTSIDE rate-limit middleware<br/>(long-lived connection)

    H->>H: Extract token from ?token= query param
    Note over H: Do NOT log the token value in access logs (T-5)

    H->>Auth: ValidateJWT(token)

    alt Invalid or expired JWT
        Auth-->>H: Error
        H-->>Browser: 401 Unauthorized (closes EventSource)
        SPA->>SPA: Fallback to 30s polling
    end

    Auth-->>H: claims{userID, sessionID}

    H->>Redis: Subscribe("user:{userID}:notifications")
    Note over H,Redis: Channel is derived from authenticated userID only —<br/>never from user-supplied input (T-6)

    H->>Browser: HTTP 200 OK<br/>Content-Type: text/event-stream<br/>Cache-Control: no-cache<br/>Connection: keep-alive

    loop Stream is open

        alt Notification published by another service action
            Redis-->>H: PubSub message (NotificationItem JSON)
            H-->>Browser: event: notification\ndata: {json}\n\n
            Browser-->>SPA: EventSource "notification" event
            SPA->>SPA: Parse JSON, update React Query cache:<br/>- Increment unread count<br/>- Prepend to notification list
        end

        alt 30-second heartbeat tick
            H-->>Browser: :ping\n\n
            Note over H,Browser: Keeps TCP connection alive through proxies
        end

        alt Client disconnects (tab close, navigation, network)
            Browser->>H: c.Request.Context().Done()
            H->>Redis: Unsubscribe("user:{userID}:notifications")
            H->>H: Goroutine cleanup
            Note over H: T-4: Goroutine leak prevention via context cancellation
        end

    end
```

### Key Invariants

- Authentication uses `?token=` query parameter because the `EventSource` browser API does not support custom headers
- The token value must not appear in server access logs to prevent token leakage in log aggregation systems
- The Redis channel is always `user:{authenticatedUserID}:notifications` — constructed from the validated JWT, never from a request parameter
- Goroutine lifetime is bounded by `c.Request.Context().Done()` — no goroutine leak on client disconnect
- Heartbeat pings every 30 seconds prevent proxy/load-balancer timeout disconnections
- Rate limit: maximum 1 SSE connection per user at a time (subsequent connections return 429)
- Frontend maintains 30-second polling as a fallback if SSE fails to connect or is unavailable

### Error Paths

| Condition | HTTP Status | Details |
|-----------|-------------|---------|
| Missing or empty `?token=` param | 401 Unauthorized | JWT extraction fails before handler logic |
| Invalid, expired, or tampered JWT | 401 Unauthorized | `ValidateJWT` returns error; EventSource closes |
| Redis connection failure at subscribe time | 500 Internal Error | Stream cannot be established; client falls back to polling |
| Redis connection drops mid-stream | Stream terminates | `PubSub.Receive` returns error; handler cleans up and returns |
| User already has 1 active SSE connection | 429 Too Many Requests | Rate limiter enforces max 1 SSE per user |
| Client disconnects normally | — | Context cancellation triggers cleanup; no error logged |

---

## 12. Get Reply List

**Trigger:** User clicks "View N replies" under a root comment to expand the reply thread
**Endpoint:** `GET /api/v1/community/comments/{commentId}/replies?page=1&pageSize=5`
**Source:** `handlers/community.go` `GetReplies`, `domain/service/community_service.go` `GetReplies`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as CommunityHandler
    participant CS as CommunityService
    participant CR as CommentRepository

    SPA->>H: GET /api/v1/community/comments/{commentId}/replies<br/>?page=1&pageSize=5
    H->>H: GetUserID from JWT
    H->>H: Parse commentId from URL path
    H->>H: Parse page, pageSize from query params

    H->>CS: GetReplies(userID, commentId, req{pagination})

    activate CS
    CS->>CR: GetByID(commentId)

    alt Comment not found
        CR-->>CS: nil
        CS-->>H: 404 Not Found
        H-->>SPA: {success: false, message: "comment not found"}
    end

    CR-->>CS: rootComment
    Note over CS: Confirm rootComment.ParentCommentID IS NULL<br/>(only root comments have a reply list)

    CS->>CR: GetByParentID(commentId, ListOptions{offset, limit})
    Note over CR: SELECT * FROM comment<br/>WHERE parent_comment_id = ?<br/>ORDER BY created_at ASC<br/>LIMIT ? OFFSET ?

    CR-->>CS: []Comment, totalCount

    CS->>CS: Map each Comment → CommentItem{<br/>..., parentCommentId, isEdited, updatedAt,<br/>isOwner: comment.UserID == userID}

    deactivate CS

    CS-->>H: GetRepliesResponse{replies, pagination{total, page, pageSize}}
    H-->>SPA: {success: true, replies: [...], pagination: {...}}

    SPA->>SPA: Render replies with indentation (ml-8)<br/>Show "Load more" if hasMore
```

### Key Invariants

- Only root comments (those with `parent_comment_id IS NULL`) have a reply list; requesting replies for a reply returns an empty list (the reply has no children)
- Replies are ordered by `created_at ASC` (chronological, oldest first) — matches conversation reading order
- `isOwner` is resolved per-reply using the JWT `userID` so the frontend can show edit/delete controls
- `isEdited` is derived from `updatedAt != nil`
- Page size defaults to 5; larger values are accepted up to a configured cap to prevent abuse
- The total count returned enables the frontend to show a "N of M replies loaded" indicator

### Error Paths

| Condition | HTTP Status | Details |
|-----------|-------------|---------|
| Missing/invalid JWT | 401 Unauthorized | Auth middleware rejects before handler |
| Comment not found | 404 Not Found | `commentRepo.GetByID` returns nil |
| Invalid page or pageSize | 400 Bad Request | Negative or non-integer values |
| DB read failure | 500 Internal Error | No partial data returned |
