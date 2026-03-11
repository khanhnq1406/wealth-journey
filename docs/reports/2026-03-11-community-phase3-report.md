# Community Phase 3 — Implementation Report

## Summary

Community Phase 3 implements five advanced features for the WealthJourney community module:

1. **Image Upload** — Server-side secure upload via Supabase Storage with magic bytes validation, EXIF stripping, and resize
2. **Edit Comments** — Users can edit their own comments with inline UI, ownership enforcement, and `(edited)` label
3. **Reply Threads** — 1-level flat nesting with lazy-loaded reply lists, thread UI, and cascade delete
4. **Advanced Profile** — Cover photo, location, website fields; tabbed post/liked/shared history; full profile edit modal
5. **Real-Time Notifications** — SSE stream backed by Redis Pub/Sub, with exponential backoff reconnect

## Spec Reference

`docs/specs/2026-03-11-community-phase3-spec.md`

## Plan Reference

`docs/plans/2026-03-11-community-phase3-plan.md`

## Tasks Completed

| # | Task | Status | Commit | Files Changed |
|---|------|--------|--------|---------------|
| 0 | Update C4 Architecture Diagrams | Done | f2332b0 | c4-component-backend.md, c4-component-frontend.md |
| 1 | Database Migration — Add Phase 3 Columns | Done | 681a772 | models/user.go, models/comment.go, cmd/migrate-community-phase3/main.go, Taskfile.yml |
| 2 | Proto — Phase 3 Message Types & RPCs | Done | cdc0ff2 | api/protobuf/v1/community.proto, generated Go+TS |
| 3 | Backend — Image Upload Service | Done | 28124fe | pkg/imaging/imaging.go, community_service.go, handlers/community.go |
| 4 | Backend — Edit Comment (UpdateComment) | Done | 55aab01 | community_service.go, repository/comment_repository.go, handlers/community.go, routes.go |
| 5 | Backend — Reply Threads | Done | ac08c66 | community_service.go, comment_repository.go, like_repository.go |
| 6 | Backend — Advanced Profile | Done | 8bb6cdb | community_service.go, handlers/community.go |
| 7 | Backend — Real-Time Notifications | Done | b171c76 | handlers/community.go, pkg/redis/redis.go, community_service.go |
| 8 | Frontend — Proto Regeneration | Done | ac08c66 | utils/generated/hooks.ts, gen/protobuf/v1/ |
| 9 | Frontend — Image Upload | Done | ac08c66 | hooks/useImageUpload.ts, components/ImageUpload.tsx, forms/CreatePostForm.tsx, EditPostForm.tsx |
| 10 | Frontend — Edit Comment UI | Done | ac08c66 | components/EditCommentForm.tsx, components/CommentBubble.tsx |
| 11 | Frontend — Reply Thread UI | Done | ac08c66 | components/ReplyInput.tsx, components/ReplyBubble.tsx, components/ReplyList.tsx, components/CommentSection.tsx |
| 12 | Frontend — Advanced Profile | Done | ac08c66 | components/ProfileTabs.tsx, components/ProfileEditModal.tsx, components/ProfileView.tsx |
| 13 | Frontend — Real-Time Notification Stream | Done | ac08c66 | hooks/useNotificationStream.ts, hooks/useNotifications.ts |
| 14 | Create/Update Runtime Flow Diagrams | Done | 8b0a7ff | docs/architecture/flow-community.md, docs/architecture/README.md |
| 15 | Backend Cleanup & Integration Verification | Done | 0bcde8f | service/interfaces.go, community_service.go, handlers/community.go, routes.go |
| 16 | Frontend Build Verification | Done | bd5d015 | components/ProfileCard.tsx, components/CommentSection.tsx |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Image type validation | Magic bytes check (JPEG/PNG/GIF/WebP), NOT Content-Type header | Yes |
| Image size limit | Server-side `MaxBytesReader(5MB)` before any processing | Yes |
| EXIF stripping | Re-encode through Go stdlib `image/jpeg`/`image/png` — strips all metadata | Yes |
| Storage path security | `community/{purpose}/{userID}/{uuid}.{ext}` — no user-controlled paths | Yes |
| Comment ownership | `comment.UserID != callerUserID` → 403 Forbidden before any mutation | Yes |
| Reply nesting enforcement | `parentCommentId > 0 && parent.ParentCommentID != nil` → flatten to grandparent | Yes |
| SSE auth | `?token=` query param (EventSource limitation); parsed via same JWT validator | Yes |
| SSE channel isolation | Channel name `user:{ID}:notifications` from validated JWT, never user input | Yes |
| Profile field validation | Bio ≤200 chars, location ≤100, website regex URL validation server-side | Yes |
| Input sanitization | `strings.TrimSpace` + length bounds on all text fields | Yes |

## Review Results

### Spec Compliance
All 5 feature areas from the spec implemented: image upload, edit comments, reply threads, advanced profile, real-time notifications. The one intentional deviation: `UpdateBio` RPC was deprecated in favor of the richer `UpdateProfile` RPC — spec was updated to reflect this.

### Security Review
- Magic bytes validation prevents MIME-sniffing attacks
- EXIF stripping prevents geolocation/metadata leakage from uploaded images
- Comment ownership checks prevent cross-user mutations
- SSE channel isolation prevents notification cross-contamination between users
- All monetary/ID fields use `int32`/`int64` (no floats)

### Code Quality
- TDD not enforced (pre-existing project pattern has limited test coverage)
- DDD architecture maintained: models → repository → service → handler
- Proto-first API design maintained
- Constructor injection (ADR-002) maintained
- Feature-based frontend module structure (ADR-003) maintained

## Known Issues / Technical Debt

1. **Pre-existing build failures** — `cmd/migrate-import` and `cmd/test-json` have broken model references from a prior refactor. These are not introduced by Phase 3 and don't affect the running application.
2. **No automated tests** — Phase 3 follows the project's existing pattern of limited test coverage. Unit tests for `pkg/imaging` and service layer would be valuable additions.
3. **SSE single connection per user** — Current implementation allows multiple SSE connections per user (Redis fan-out handles it naturally). A 429 guard mentioned in flow docs is not yet implemented.
4. **Image upload rate limiting** — Handler-level rate limit (10/min) is enforced by the existing rate limiter middleware; no per-user limit specifically for uploads.

## Files Changed (Complete List)

### Backend (`src/go-backend/`)
- `domain/models/user.go` — Added `CoverPhotoURL`, `Location`, `Website` fields
- `domain/models/comment.go` — Added `ParentCommentID`, `ReplyCount`, `UpdatedAt`, `ParentComment` fields
- `domain/service/interfaces.go` — Added `UpdateComment`, `GetReplies`, `UpdateProfile`, `GetLikedPosts`, `UploadImage`; removed `UpdateBio`
- `domain/service/community_service.go` — Implemented all Phase 3 service methods; removed `UpdateBio`
- `domain/service/services.go` — Updated `NewCommunityService` signature (storageProvider + rdb)
- `domain/repository/interfaces.go` — Added `Update`, `GetByParentID`, `IncrementReplyCount` to `CommentRepository`; added `GetLikedPostsByUser` to `LikeRepository`
- `domain/repository/comment_repository.go` — Implemented new repo methods; `GetByPostID` filters replies
- `domain/repository/like_repository.go` — Added `GetLikedPostsByUser`
- `handlers/community.go` — Added `UploadImage`, `UpdateComment`, `GetReplies`, `UpdateProfile`, `GetLikedPosts`, `StreamNotifications`; removed `UpdateBio`
- `handlers/routes.go` — Registered Phase 3 routes; separate SSE route group without rate limiter
- `handlers/builder.go` — Updated `NewCommunityHandler` with `rdb` and `authSrv` deps
- `internal/app/app.go` — Passes storage provider to `ProvideServices`
- `internal/app/providers.go` — Updated `ProvideServices` signature
- `pkg/imaging/imaging.go` — NEW: magic bytes validation, resize, EXIF strip
- `pkg/redis/redis.go` — Added `Publish` and `Subscribe` methods
- `cmd/migrate-community-phase3/main.go` — NEW: migration script for Phase 3 columns
- `Taskfile.yml` — Added `backend:migrate-community-phase3` task

### Frontend (`src/wj-client/features/community/`)
- `hooks/useImageUpload.ts` — NEW: XHR upload with progress tracking
- `hooks/useNotificationStream.ts` — NEW: SSE EventSource with exponential backoff
- `hooks/useNotifications.ts` — Updated to mount SSE stream
- `components/ImageUpload.tsx` — NEW: drag-drop upload component
- `components/EditCommentForm.tsx` — NEW: inline edit form with char counter
- `components/ReplyInput.tsx` — NEW: inline reply composer
- `components/ReplyBubble.tsx` — NEW: indented reply display with edit/delete
- `components/ReplyList.tsx` — NEW: lazy-loaded collapsible reply thread
- `components/ProfileTabs.tsx` — NEW: Posts/Likes/Shared tabs
- `components/ProfileEditModal.tsx` — NEW: full profile edit overlay with avatar + cover upload
- `components/CommentBubble.tsx` — Updated with edit/delete menu, reply button, (edited) label
- `components/CommentSection.tsx` — Updated with delete handler, ReplyList, parentCommentId fix
- `components/ProfileView.tsx` — Updated with cover photo, location/website display, ProfileTabs
- `components/ProfileCard.tsx` — Updated cover photo mini-banner; fixed to use `useMutationUpdateProfile`
- `forms/CreatePostForm.tsx` — Replaced URL input with ImageUpload component
- `forms/EditPostForm.tsx` — Added ImageUpload component
- `utils/community.schema.ts` — Added `editCommentSchema` and `editProfileSchema`

### Protobuf
- `api/protobuf/v1/community.proto` — Added Phase 3 messages + RPCs; removed UpdateBio/GetUploadURL
- `utils/generated/hooks.ts` — Regenerated with Phase 3 hooks
- `gen/protobuf/v1/community_pb.ts` — Regenerated TypeScript types

### Docs
- `docs/architecture/c4-component-backend.md` — Phase 3 backend components
- `docs/architecture/c4-component-frontend.md` — Phase 3 frontend components
- `docs/architecture/flow-community.md` — 5 new Phase 3 runtime flows (8–12)
- `docs/architecture/README.md` — Updated flow diagram table entry

## How to Test

### Prerequisites
1. Run database migration: `task backend:migrate-community-phase3`
2. Ensure Supabase Storage bucket `community` exists with public read access
3. Ensure Redis is running (SSE requires Pub/Sub)

### Manual Testing Steps

**Image Upload:**
1. Create a post → click image area → select JPEG/PNG/WebP file ≤5MB
2. Verify progress bar and preview appear
3. Submit post — verify image appears in feed

**Edit Comment:**
1. Create a comment on a post
2. Click the `...` menu on your comment → Edit
3. Modify text → press Enter or click ✓
4. Verify `(edited)` label appears on the comment

**Reply Threads:**
1. Click "Reply" on any comment
2. Type and submit a reply
3. Verify reply count updates on parent comment
4. Click "View N replies" to expand the reply list
5. Verify replies show indented under the parent comment

**Advanced Profile:**
1. Navigate to your own profile
2. Click "Edit Profile" → change bio, location, website, avatar, cover photo
3. Save → verify all fields update
4. Click other user's profile → verify tabs (Posts, Likes, Shared)

**Real-Time Notifications:**
1. Open app in two browser windows (two users)
2. User B likes/comments on User A's post
3. Verify User A receives notification without page refresh (bell count updates)
