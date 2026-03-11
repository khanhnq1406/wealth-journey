# Community Phase 3 — Advanced Features Specification

## Summary

Phase 3 extends the WealthJourney community module with five feature areas: **Advanced Profile** (cover photo, extended bio, tabbed post history), **Image Upload** (server-side upload via Supabase Storage), **Real-Time Notifications** (SSE with Redis Pub/Sub), **Edit Comments**, and **Reply Threads** (1-level deep nesting). Groups, Polls, and Admin Moderation Dashboard are explicitly deferred to a future phase.

## User Stories

### Advanced Profile
- As a user, I want to set a cover photo on my profile, so that my profile feels personalized
- As a user, I want to add my location and website to my profile, so that others can learn more about me
- As a user, I want to browse my own or another user's post history by tab (Posts, Likes, Shared), so that I can find specific content

### Image Upload
- As a user, I want to attach images to my posts by selecting/dropping a file, so that I can share visual content without pasting URLs manually
- As a user, I want to upload a profile avatar and cover photo, so that my profile is visually distinct

### Real-Time Notifications
- As a user, I want to receive notifications instantly when someone likes, comments, follows, or shares, so that I stay engaged without waiting for a polling cycle

### Edit Comments
- As a user, I want to edit a comment I previously posted, so that I can fix typos or clarify my message

### Reply Threads
- As a user, I want to reply to a specific comment, so that threaded conversations are easier to follow
- As a user, I want to see reply count on a comment and expand/collapse replies, so that the comment section stays clean

---

## Functional Requirements

### FR-1: Advanced Profile

**FR-1.1: Cover Photo**
- Users can upload a cover photo (via image upload — FR-2)
- Cover photo displayed as full-width banner at top of profile (height ~160px desktop, ~120px mobile)
- Default: keep existing gradient banner when no cover photo is set
- Cover photo stored as URL in `user.cover_photo_url` column

**Acceptance criteria:**
- [ ] Cover photo renders on ProfileView and ProfileCard (sidebar)
- [ ] "Edit cover photo" button visible only on own profile
- [ ] Clicking edit opens file picker (reuses image upload component from FR-2)
- [ ] Cover photo URL persisted via UpdateProfile RPC
- [ ] Fallback to gradient banner when cover_photo_url is null/empty

**FR-1.2: Extended Profile Fields**
- New fields: `location` (max 100 chars), `website` (max 200 chars, validated URL pattern)
- Displayed on profile below bio
- Editable via an "Edit Profile" modal (replaces inline bio-only editing)

**Acceptance criteria:**
- [ ] Location and website render on ProfileView below bio
- [ ] "Edit Profile" button opens modal with bio, location, website fields
- [ ] Website validated as valid URL on both client and server
- [ ] Location and website are optional (nullable)

**FR-1.3: Tabbed Post History**
- Profile shows 3 tabs: **Posts** (user's own posts), **Likes** (posts user liked), **Shared** (posts user shared)
- Default tab: Posts
- Each tab is paginated independently
- Tabs visible on both own and other users' profiles

**Acceptance criteria:**
- [ ] 3 tabs rendered below profile header
- [ ] "Posts" tab shows user's own posts (existing GetUserPosts)
- [ ] "Likes" tab shows posts the user has liked (new GetLikedPosts RPC)
- [ ] "Shared" tab shows posts the user has shared (filtered GetUserPosts where shared_post_id IS NOT NULL)
- [ ] Pagination works independently per tab
- [ ] Active tab state preserved when navigating back to profile

---

### FR-2: Image Upload (Supabase Storage)

**FR-2.1: Post Image Upload**
- Replace manual URL input with file-based image upload
- Accepted formats: JPEG, PNG, WebP, GIF
- Max file size: 5 MB
- Images uploaded to Go backend → validated → resized if > 2048px wide → uploaded to Supabase Storage → public URL returned
- Post creation form shows image preview after selection
- Multiple images NOT supported (single image per post, same as current)

**Acceptance criteria:**
- [ ] File picker / drag-and-drop in CreatePostForm and EditPostForm
- [ ] Image preview shown before submission
- [ ] Server-side file type validation (magic bytes, not just extension)
- [ ] Server-side size limit enforcement (5 MB)
- [ ] Image resized to max 2048px width (maintain aspect ratio)
- [ ] Uploaded to Supabase Storage bucket, public URL returned
- [ ] Post stores Supabase public URL in `image_url` field
- [ ] Upload progress indicator shown to user

**FR-2.2: Profile Image Upload**
- Avatar upload → stored in `user.picture` (reuse existing field)
- Cover photo upload → stored in `user.cover_photo_url` (new field from FR-1.1)
- Same validation rules as post images
- Avatar resized to max 400px, cover photo to max 1920px wide

**Acceptance criteria:**
- [ ] Avatar upload on profile edit modal
- [ ] Cover photo upload on profile cover area
- [ ] Old images not deleted from Supabase (acceptable for MVP; cleanup deferred)

**FR-2.3: Upload API**
- New RPC: `UploadImage` — accepts multipart/form-data with file + purpose field
- Purpose: `post`, `avatar`, `cover`
- Returns `{ imageUrl: string }` — the public URL
- Replaces the existing stub `GetUploadURL` RPC (remove signed-URL approach, use server-side upload)

**Acceptance criteria:**
- [ ] `POST /api/v1/community/upload` endpoint accepts multipart file
- [ ] Validates file type (image/jpeg, image/png, image/webp, image/gif)
- [ ] Validates file size (5 MB max)
- [ ] Generates unique filename: `community/{purpose}/{userId}/{uuid}.{ext}`
- [ ] Returns public URL
- [ ] Rate limited: max 10 uploads per user per minute

---

### FR-3: Real-Time Notifications (SSE)

**FR-3.1: Server-Sent Events Endpoint**
- New SSE endpoint: `GET /api/v1/community/notifications/stream`
- Requires JWT authentication (passed via query param `?token=` since EventSource doesn't support headers)
- Server pushes notification events as they occur
- Heartbeat every 30 seconds to keep connection alive
- One SSE connection per user (reject additional connections)

**Acceptance criteria:**
- [ ] SSE endpoint returns `text/event-stream` content type
- [ ] Auth via `?token=` query parameter (validated same as Bearer token)
- [ ] Events pushed when notification is created (like, comment, follow, share, reply)
- [ ] Heartbeat `:ping\n\n` sent every 30s
- [ ] Connection closes on client disconnect (goroutine cleanup)
- [ ] Rate limited: max 1 SSE connection per user

**FR-3.2: Redis Pub/Sub Integration**
- When a notification is created in the service layer, publish to Redis channel `user:{userId}:notifications`
- SSE handler subscribes to the user's channel and forwards events
- Message format: JSON-serialized `NotificationItem`

**Acceptance criteria:**
- [ ] Redis Pub/Sub `Publish` and `Subscribe` methods added to Redis client
- [ ] CommunityService publishes after creating notifications
- [ ] SSE handler subscribes on connection, unsubscribes on disconnect
- [ ] Late-arriving clients miss events (acceptable — polling fallback exists)

**FR-3.3: Frontend EventSource Integration**
- New hook: `useNotificationStream` in `features/community/hooks/`
- Connects to SSE endpoint with JWT token
- On receiving event: update React Query cache (increment unread count, prepend to notification list)
- Graceful fallback: if SSE connection fails, keep existing 30s polling
- Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s)

**Acceptance criteria:**
- [ ] EventSource connects on mount, closes on unmount
- [ ] New notifications appear instantly in NotificationBell badge
- [ ] NotificationPanel shows new items without manual refresh
- [ ] Falls back to polling if SSE connection fails
- [ ] Reconnects automatically after disconnect

---

### FR-4: Edit Comments

**FR-4.1: Edit Comment API**
- New RPC: `UpdateComment` — only comment author can edit
- Content validation: 1-500 chars (same as create)
- Edited comments show "(edited)" indicator with original timestamp preserved, `updated_at` added

**Acceptance criteria:**
- [ ] `PUT /api/v1/community/comments/{commentId}` endpoint
- [ ] Only comment owner can edit (403 for others)
- [ ] Content validated: 1-500 chars, sanitized
- [ ] `updated_at` timestamp set on edit
- [ ] Response includes updated comment

**FR-4.2: Edit Comment UI**
- "Edit" option in comment menu (3-dot or long-press on mobile)
- Inline edit mode: comment content becomes editable textarea
- Save/Cancel buttons
- "(edited)" label shown next to timestamp after edit

**Acceptance criteria:**
- [ ] Edit option visible only on own comments
- [ ] Inline edit replaces comment text with textarea
- [ ] Cancel restores original text
- [ ] Save submits mutation, updates UI optimistically
- [ ] "(edited)" indicator shown after successful edit

---

### FR-5: Reply Threads (1-Level Deep)

**FR-5.1: Reply Data Model**
- Add `parent_comment_id` (nullable FK → comment.id) to Comment model
- Add `reply_count` (int32, default 0) denormalized counter on parent comments
- Replies are flat children of a parent comment — no nesting beyond 1 level
- If a reply is made to another reply, it becomes a sibling reply (same parent)

**Acceptance criteria:**
- [ ] Comment model has `parent_comment_id` and `reply_count` fields
- [ ] Database migration adds columns + index on `parent_comment_id`
- [ ] FK constraint with ON DELETE CASCADE (deleting parent removes replies)

**FR-5.2: Reply API**
- `CreateComment` extended: if `parentCommentId` is provided, creates a reply
- New RPC: `GetReplies` — paginated replies for a parent comment
- `DeleteComment` handles replies: decrements parent's `reply_count`
- Notification: reply creates `reply` type notification to parent comment's author

**Acceptance criteria:**
- [ ] `CreateComment` accepts optional `parentCommentId` field
- [ ] If `parentCommentId` is set, validates parent exists and belongs to same post
- [ ] If `parentCommentId` points to a reply (has its own parent), redirect to root comment as parent (prevent nesting > 1)
- [ ] `GET /api/v1/community/comments/{commentId}/replies` returns paginated replies
- [ ] `reply_count` incremented/decremented atomically
- [ ] Post's `comment_count` incremented for both root comments AND replies
- [ ] `reply` notification sent to parent comment author (not self)

**FR-5.3: Reply UI**
- "Reply" button on each root comment
- Clicking opens inline reply input below the comment
- Reply count shown: "N replies" — clicking expands/collapses reply list
- Replies indented (ml-8) under parent comment
- Replies loaded on demand (lazy — fetch when expanded)
- Reply bubble shows author, content, time, edit/delete (if own)

**Acceptance criteria:**
- [ ] "Reply" button on root comments (not on replies)
- [ ] Inline reply input appears below comment when Reply clicked
- [ ] "N replies" toggle expands/collapses reply list
- [ ] Replies visually indented under parent
- [ ] Replies paginated (5 per page with "Load more")
- [ ] Reply supports edit (FR-4) and delete
- [ ] Replying to a reply shows it as sibling (same parent level)

---

## Non-Functional Requirements

- **Performance:** SSE connection should consume < 5 KB/s per idle user (heartbeat only). Image upload should complete in < 5s for 5 MB file on broadband.
- **Security:** All uploads validated server-side. SSE token validated on connection. Image content-type verified via magic bytes. No user-uploaded JavaScript execution (SVG sanitized or rejected).
- **Scalability:** Redis Pub/Sub supports horizontal backend scaling (multiple instances). SSE connections limited to 1 per user to bound goroutine count.
- **Reliability:** SSE gracefully degrades to polling. Image upload failures show clear error messages. Reply thread deletion cascades correctly.

---

## Architecture Changes (C4)

### Diagrams to Update

**L3 Backend (`c4-component-backend.md`):**
- Add to CommunityHandler: `UploadImage`, `UpdateComment`, `GetReplies`, `GetLikedPosts`, `UpdateProfile`, `StreamNotifications`
- Add to CommunityService: `UploadImage`, `UpdateComment`, `GetReplies`, `GetLikedPosts`, `UpdateProfile`, notification publishing
- Add `Redis Pub/Sub` as infrastructure component (extend existing Redis usage)
- Add `Supabase Storage` as external storage (used by UploadImage)

**L3 Frontend (`c4-component-frontend.md`):**
- Add Phase 3 components: `ImageUpload`, `EditCommentForm`, `ReplyBubble`, `ReplyInput`, `ProfileEditModal`, `ProfileTabs`
- Add hooks: `useNotificationStream`, `useImageUpload`
- Update existing: `CommentBubble` (edit + reply), `CommentSection` (threads), `ProfileView` (tabs + cover), `CreatePostForm` (image upload)

### New Diagrams
- No new L4 code diagram needed (community domain already well-documented; these changes extend existing patterns)

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-community.md` — Update existing:**
1. **"Create Post" flow** — Add image upload step before post creation
2. **"View User Profile" flow** — Add tabbed content loading (Posts/Likes/Shared)

### New Flow Diagrams

**Add to `flow-community.md`:**

1. **Image Upload Flow** — `sequenceDiagram`: Browser → Gin handler → validate → resize → Supabase Storage → return URL
2. **SSE Notification Flow** — `sequenceDiagram`: Action trigger → Service creates notification → Redis Pub/Sub → SSE handler → Browser EventSource
3. **Reply Thread Flow** — `sequenceDiagram`: User creates reply → Service validates parent → creates comment with parentId → increments reply_count → notification
4. **Edit Comment Flow** — `sequenceDiagram`: User submits edit → Service validates ownership → updates content + updated_at → response

---

## Data Model Changes

### Modified Tables

**`user` table:**
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `cover_photo_url` | varchar(500) | YES | NULL | Cover photo URL from Supabase Storage |
| `location` | varchar(100) | YES | NULL | User's location (free text) |
| `website` | varchar(200) | YES | NULL | User's website URL |

**`comment` table:**
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `parent_comment_id` | int32 | YES | NULL | FK → comment.id (NULL = root comment) |
| `reply_count` | int32 | NO | 0 | Denormalized count of direct replies |
| `updated_at` | timestamp | YES | NULL | Set when comment is edited |

### New Indexes

| Table | Index | Columns | Type |
|-------|-------|---------|------|
| `comment` | `idx_comment_parent_id` | `parent_comment_id` | B-tree |
| `comment` | `idx_comment_updated_at` | `updated_at` | B-tree |

### New FK Constraints

| Table | Constraint | Reference | On Delete |
|-------|-----------|-----------|-----------|
| `comment` | `fk_comment_parent` | `comment.id` | CASCADE |

---

## API Changes

### New RPCs

| RPC | Method | Route | Request | Response |
|-----|--------|-------|---------|----------|
| `UploadImage` | POST | `/api/v1/community/upload` | multipart/form-data (file + purpose) | `{ success, imageUrl, timestamp }` |
| `UpdateComment` | PUT | `/api/v1/community/comments/{commentId}` | `{ content }` | `{ success, comment, timestamp }` |
| `GetReplies` | GET | `/api/v1/community/comments/{commentId}/replies` | pagination query params | `{ success, replies[], pagination, timestamp }` |
| `GetLikedPosts` | GET | `/api/v1/community/users/{userId}/liked-posts` | pagination query params | `{ success, posts[], pagination, timestamp }` |
| `UpdateProfile` | PUT | `/api/v1/community/profile` | `{ bio?, location?, website?, picture?, coverPhotoUrl? }` | `{ success, profile, timestamp }` |
| `StreamNotifications` | GET | `/api/v1/community/notifications/stream` | `?token=JWT` | SSE stream |

### Modified RPCs

| RPC | Change |
|-----|--------|
| `CreateComment` | Add optional `parentCommentId` field to request |
| `CommentItem` | Add fields: `parentCommentId`, `replyCount`, `updatedAt`, `isEdited` |
| `CommunityProfile` | Add fields: `coverPhotoUrl`, `location`, `website` |
| `GetUploadURL` | **Remove** (replaced by `UploadImage` server-side upload) |

### Deprecated RPCs

| RPC | Reason |
|-----|--------|
| `GetUploadURL` | Replaced by `UploadImage`. Remove the stub handler and service method. |
| `UpdateBio` | Replaced by `UpdateProfile` which handles bio + location + website + photos. |

---

## UI/UX Changes

### Profile Redesign
- **Cover photo area:** Full-width image (or gradient fallback), "Edit" camera icon overlay on own profile
- **Avatar:** Overlaps cover photo (negative margin), camera icon overlay for upload on own profile
- **Extended info:** Location icon + text, link icon + website below bio
- **Edit Profile modal:** Bio textarea + location input + website input + avatar upload + cover photo upload
- **Tabs:** Horizontal tab bar below profile info — Posts | Likes | Shared

### Post Creation
- **Image attachment:** Replace URL input with drag-and-drop / click-to-select file area
- **Image preview:** Thumbnail shown in form before submission, with X to remove
- **Upload progress:** Linear progress bar during upload

### Comment Section
- **Edit action:** 3-dot menu on own comments → "Edit" option → inline textarea edit mode
- **"(edited)" label:** Small gray text next to timestamp
- **Reply button:** Below each root comment
- **Reply input:** Inline textarea below comment (appears on Reply click)
- **Reply count:** "N replies" link that toggles reply list expansion
- **Reply indentation:** ml-8 (32px) left margin for reply bubbles
- **Reply bubble:** Same as CommentBubble but slightly smaller, with edit/delete if own

### Notifications
- **No visible UI change** — SSE works behind the scenes, badge updates instantly instead of every 30s

### Mobile-First Design
- Cover photo: 120px height on mobile, 160px on desktop
- Profile edit modal: bottom sheet on mobile
- Reply indentation: ml-6 (24px) on mobile for tighter space
- Image upload: full-width file input on mobile, supports camera capture

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | Image file (up to 5MB) | Yes: Internet → App | Gin Upload Handler | Untrusted binary input |
| 2 | Gin Handler | Validated image bytes | Yes: App → Supabase Storage | Supabase Storage | Authenticated via service role key |
| 3 | Supabase Storage | Public URL | Yes: External → App | Gin Handler → User | URL stored in DB |
| 4 | User (browser) | Comment edit text | Yes: Internet → App | Gin Handler | Untrusted text input |
| 5 | Gin Handler | Sanitized comment | No (same tier) | CommunityService | Validated by handler |
| 6 | CommunityService | Notification JSON | Yes: App → Redis | Redis Pub/Sub channel | Internal trusted boundary |
| 7 | Redis | Notification JSON | Yes: Redis → App | SSE Handler | Internal trusted boundary |
| 8 | SSE Handler | SSE event | Yes: App → Internet | Browser EventSource | JWT-authenticated stream |
| 9 | User (browser) | JWT token (query param) | Yes: Internet → App | SSE Handler | Token in URL (logged!) |
| 10 | User (browser) | Reply content + parentId | Yes: Internet → App | Gin Handler | Untrusted input |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | User requests (upload, edit, reply, SSE) | JWT auth + input validation + rate limiting |
| App → Supabase Storage | Image upload | Service role key (not exposed to client) |
| App → Redis Pub/Sub | Notification publish | Internal network, no user input in channel names |
| App → Database | GORM queries | Parameterized queries, ownership checks |
| App → Internet (SSE) | Notification stream | JWT validated on connection |

### Threats Identified (STRIDE per boundary)

| # | Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Tampering | Malicious file uploaded as image (e.g., .exe renamed to .jpg) | High | Validate magic bytes, not just Content-Type header. Reject non-image files. |
| T-2 | 1 | Internet → App | DoS | Large file uploads exhausting server memory/disk | Medium | 5 MB limit enforced in handler (Gin MaxMultipartMemory). Rate limit 10/min. |
| T-3 | 1 | Internet → App | Info Disclosure | Image EXIF metadata contains GPS/personal data | Low | Strip EXIF metadata during resize step. |
| T-4 | 3 | External → App | Tampering | Supabase returns manipulated URL | Low | Trust Supabase CDN. URLs always start with known Supabase base URL. |
| T-5 | 8,9 | Internet → App | Spoofing | JWT in query param visible in server logs, browser history | Medium | Log SSE connections without token. Use short-lived SSE-specific tokens if needed (deferred). |
| T-6 | 8 | App → Internet | Info Disclosure | SSE stream leaks notifications of other users | High | Subscribe only to `user:{authenticatedUserID}` channel. Never use user-supplied channel name. |
| T-7 | 4 | Internet → App | Injection (XSS) | Edited comment contains script tags | High | HTML sanitization in service layer (existing `SanitizeStringField`). |
| T-8 | 10 | Internet → App | Elevation | User sends parentCommentId from a different post | Medium | Validate parent comment belongs to same post. Reject cross-post reply attempts. |
| T-9 | 10 | Internet → App | Tampering | User manipulates reply_count via concurrent requests | Low | Atomic increment/decrement. reply_count is denormalized — periodic reconciliation acceptable. |
| T-10 | 6 | App → Redis | DoS | Redis Pub/Sub flooded by high-frequency notification events | Low | Notifications created per user action (bounded by rate limiting on actions). No amplification risk. |

### Authorization Rules

| Operation | Owner | Other Authenticated | Unauthenticated |
|-----------|-------|---------------------|-----------------|
| Upload image | Allowed | Allowed (own uploads) | Denied |
| Edit comment | Allowed (own only) | Denied (403) | Denied |
| Delete comment/reply | Allowed (own only) | Denied (403) | Denied |
| View replies | Allowed | Allowed | Denied |
| Create reply | Allowed | Allowed | Denied |
| Update profile | Allowed (own only) | Denied (403) | Denied |
| View profile (cover, bio, etc.) | Allowed | Allowed | Denied |
| SSE notification stream | Allowed (own stream) | Denied | Denied |
| View liked posts | Allowed | Allowed | Denied |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| Image file | binary | JPEG/PNG/WebP/GIF, max 5 MB | Magic bytes check, size limit |
| Upload purpose | string | Enum: `post`, `avatar`, `cover` | Whitelist validation |
| Comment content (edit) | string | 1-500 chars | Length check + HTML sanitization |
| Reply content | string | 1-500 chars | Length check + HTML sanitization |
| parentCommentId | int32 | Valid comment ID, same post | DB lookup + post match |
| Bio (profile update) | string | 0-200 chars | Length check + sanitization |
| Location | string | 0-100 chars | Length check + sanitization |
| Website | string | 0-200 chars, valid URL pattern | URL regex validation |
| Cover photo URL | string | Valid Supabase URL | URL prefix validation |
| SSE token | string | Valid JWT | Same verification as Bearer token |

### External Dependency Risks

| Service | Data Exchanged | Trust Level | Failure Impact | Mitigation |
|---------|---------------|-------------|----------------|------------|
| Supabase Storage | Image files | Medium | Image upload fails → post created without image | Show error, allow retry. Post can be created without image. |
| Redis Pub/Sub | Notification JSON | High (internal) | SSE stops working → falls back to polling | Auto-reconnect + polling fallback always active |

### Sensitive Data Handling

| Data | Sensitivity | Protection |
|------|------------|------------|
| User images | Internal | Stored on Supabase with public URLs; no PII in filenames (UUID-based) |
| JWT in SSE query param | Confidential | Not logged in access logs; short-lived tokens recommended for future |
| EXIF metadata in images | Internal | Stripped during server-side processing |
| Comment edit history | Internal | Only latest version stored (no edit history in MVP) |

### Issues & Risks Summary

1. **JWT in SSE query param** — Standard EventSource API does not support custom headers. Token will be in URL. Mitigate by not logging query params for SSE endpoint. Future: issue short-lived SSE-specific tokens.
2. **Image EXIF stripping** — Need a Go image processing library (e.g., `disintegration/imaging` or `nfnt/resize`). EXIF data may contain GPS coordinates.
3. **Reply cascade on parent delete** — FK ON DELETE CASCADE handles data integrity, but denormalized `comment_count` on post needs manual adjustment.
4. **SSE goroutine leak** — If client disconnects without proper close, goroutine may linger. Use `c.Request.Context().Done()` + timeout to detect dead connections.
5. **Supabase Storage bucket policy** — Ensure the community uploads bucket is configured for public read access but authenticated write only.

---

## Edge Cases & Error Handling

| Edge Case | Expected Behavior |
|-----------|------------------|
| Upload non-image file with spoofed Content-Type | Server rejects after magic bytes check, returns 400 |
| Upload 0-byte file | Server rejects, returns 400 "empty file" |
| Upload while offline | Frontend shows error, post can still be created without image |
| Edit comment that was deleted by another request | Server returns 404 |
| Reply to a deleted parent comment | Server returns 404 "parent comment not found" |
| Reply to a reply (attempt 2-level nesting) | Server redirects to root parent — reply becomes sibling |
| SSE connection interrupted | Client auto-reconnects with exponential backoff |
| Two SSE connections from same user | Second connection rejected with 409 |
| User deletes parent comment with 50 replies | CASCADE deletes replies; post.comment_count decremented by 1 + reply_count |
| Concurrent reply_count increment | Atomic SQL `SET reply_count = reply_count + 1` prevents race |
| Profile update with invalid website URL | Server returns 400 with validation error |
| Cover photo upload for non-existent user | Impossible — JWT auth ensures valid user |

---

## Dependencies & Assumptions

**Dependencies:**
- Supabase Storage bucket `wealthjourney-uploads` exists and is configured for community images
- Redis server supports Pub/Sub (standard Redis feature, already available)
- Go image processing library for resize + EXIF strip (recommend `disintegration/imaging`)
- Backend deployed on Railway (persistent process, supports SSE long-lived connections)

**Assumptions:**
- Single image per post is sufficient (no gallery support needed)
- No edit history for comments (only latest version stored)
- Reply threads 1-level deep is sufficient (no recursive nesting)
- Public read access on Supabase Storage is acceptable for community images
- SSE connection per user is bounded by active browser tabs (typically 1-3)

---

## Out of Scope

- **Groups** — Create/join finance groups (deferred to future phase)
- **Polls** — Create polls within posts (deferred to future phase)
- **Admin Moderation Dashboard** — Review reported content, ban users (deferred)
- **Image gallery / multiple images per post** — Single image only
- **Comment edit history** — No versioning, only latest content stored
- **Nested replies beyond 1 level** — Replies to replies become siblings
- **Video upload** — Images only
- **Image CDN / transformation** — Use Supabase Storage directly, no Cloudinary/imgproxy
- **SSE-specific short-lived tokens** — Use existing JWT for now, optimize later
- **Old image cleanup** — When user changes avatar/cover, old image remains in storage
- **Push notifications (mobile/browser)** — SSE only; no Firebase/APNs

---

## Implementation Notes

### Go Dependencies to Add
- `github.com/disintegration/imaging` — Image resize + format conversion (pure Go, no CGO)

### Supabase Storage Key Path Convention
```
community/post/{userId}/{uuid}.{ext}      — Post images
community/avatar/{userId}/{uuid}.{ext}    — User avatars
community/cover/{userId}/{uuid}.{ext}     — Cover photos
```

### SSE Event Format
```
event: notification
data: {"id":123,"type":"like","actorId":5,"actorName":"Khanh","actorPicture":"...","postId":42,"postPreview":"...","isRead":false,"createdAt":1710000000}

:ping
```

### Redis Pub/Sub Channel Convention
```
user:{userId}:notifications    — Per-user notification channel
```

### Comment Model Evolution
```
Phase 1-2: { id, postId, userId, content, createdAt, deletedAt }
Phase 3:   { id, postId, userId, content, parentCommentId?, replyCount, createdAt, updatedAt?, deletedAt }
```

---

**Created:** 2026-03-11
**Author:** WealthJourney Team
**Status:** Draft — pending user approval
