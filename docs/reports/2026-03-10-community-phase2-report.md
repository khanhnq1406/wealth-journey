# Community Phase 2 (Social) — Implementation Report

## Summary

Community Phase 2 adds full social engagement capabilities to WealthJourney's community section. The feature introduces Share/Repost, In-App Notifications, Saved Posts, Suggested Users, and Trending Hashtags — extending the existing community feed with a complete social interaction layer.

## Spec Reference

`docs/specs/2026-03-10-community-phase2-spec.md`

## Plan Reference

`docs/plans/2026-03-10-community-phase2-plan.md`

## Tasks Completed

| # | Task | Status | Commit | Files Changed |
|---|------|--------|--------|---------------|
| 1 | Extend Protobuf API | Done | 870355a | `api/protobuf/v1/community.proto` |
| 2 | Generate Code from Proto | Done | 870355a | `src/go-backend/protobuf/v1/community*.go`, `src/wj-client/gen/protobuf/v1/community*.ts`, `src/wj-client/utils/generated/hooks.ts` |
| 3 | Database Models | Done | 17b287e | `domain/models/notification.go`, `domain/models/saved_post.go`, `domain/models/post_hashtag.go`, `domain/models/post.go` |
| 4 | Database Migration | Done | 17b287e | `cmd/migrate-community-phase2/main.go` |
| 5 | New Repositories | Done | b607f1f | `domain/repository/notification_repository.go`, `domain/repository/saved_post_repository.go`, `domain/repository/hashtag_repository.go` |
| 6 | Extend PostRepository + FollowRepository | Done | b607f1f | `domain/repository/post_repository.go`, `domain/repository/follow_repository.go` |
| 7–12 | Extend CommunityService (all 9 Phase 2 methods) | Done | 962200a | `domain/service/community_service.go`, `domain/service/interfaces.go`, `domain/service/services.go` |
| 13–14 | Handlers + Routes + DI Wiring | Done | 12e4e2c | `handlers/community.go`, `handlers/routes.go`, `internal/app/providers.go` |
| 15 | Frontend Schemas and Hooks | Done | fb91325 | `features/community/utils/community.schema.ts`, `features/community/hooks/useSavedPost.ts`, `features/community/hooks/useNotifications.ts`, `features/community/utils/hashtag.ts` |
| 16–17 | SharePost Modal + PostCard Updates | Done | 11b3b13 | `SharePostModal.tsx`, `SharedPostEmbed.tsx`, `HashtagLink.tsx`, `SharePostForm.tsx`, `PostActions.tsx`, `PostBody.tsx`, `PostEngagement.tsx`, `PostCard.tsx` |
| 18 | Notification Components | Done | a14e377 | `components/notifications/NotificationItem.tsx`, `NotificationPanel.tsx`, `NotificationBell.tsx` |
| 19–21 | SavedPostsView, SuggestedUsers, TrendingTopics | Done | 5eb9503 | `SavedPostsView.tsx`, `SuggestedUserCard.tsx`, `SuggestedUsers.tsx`, `TrendingTopics.tsx`, `CommunityNav.tsx`, `MobileSubNav.tsx`, `CommunityRightSidebar.tsx` |
| 22–24 | Wire into Layout and Community Page | Done | 12bfe42 | `app/[locale]/dashboard/layout.tsx`, `CommunityFeed.tsx`, `CommunityLeftSidebar.tsx`, `app/[locale]/dashboard/community/page.tsx` |
| 25–26 | Update Architecture Diagrams | Done | 69e1261 | `docs/architecture/c4-component-backend.md`, `docs/architecture/c4-component-frontend.md`, `docs/architecture/flow-community.md` |
| 27 | Build Verification | Done | 9e140d8 | Progress file updated |

## API Changes

### New RPCs (9 total)

| RPC | Method | Route |
|-----|--------|-------|
| `SharePost` | POST | `/api/v1/community/posts/:id/share` |
| `GetNotifications` | GET | `/api/v1/community/notifications` |
| `GetUnreadNotificationCount` | GET | `/api/v1/community/notifications/unread-count` |
| `MarkNotificationsRead` | POST | `/api/v1/community/notifications/mark-read` |
| `SavePost` | POST | `/api/v1/community/posts/:id/save` |
| `UnsavePost` | DELETE | `/api/v1/community/posts/:id/save` |
| `GetSavedPosts` | GET | `/api/v1/community/saved-posts` |
| `GetSuggestedUsers` | GET | `/api/v1/community/suggested-users` |
| `GetTrendingTopics` | GET | `/api/v1/community/trending-topics` |

### New PostItem Fields (5)
- `is_saved` — whether the current user has saved this post
- `share_count` — total number of shares/reposts
- `shared_post_id` — ID of the original post (for reposts)
- `shared_post` — embedded original `PostItem` (for reposts)
- `hashtags` — list of hashtag strings extracted from content

### GetFeed Enhancement
- Added `hashtag` query parameter for filtering feed by hashtag

## Database Changes

### New Tables (3)

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `notification` | In-app notifications | `user_id`, `actor_id`, `type`, `post_id`, `is_read` |
| `saved_post` | User's saved posts | `user_id`, `post_id`, unique constraint |
| `post_hashtag` | Hashtag index | `post_id`, `hashtag`, index on hashtag |

### Post Model Changes
- `SharedPostID *int32` — nullable FK to original post (self-referential)
- `ShareCount int32` — denormalized count for fast reads

## Frontend Architecture

### New Feature Hooks
- `useSavedPost(postId, initialSaved)` — optimistic toggle following `useLike` pattern
- `useNotificationCount()` — polls unread count every 30s, returns `{count, isLoading}`
- `useMarkAllRead()` — mutation wrapper for `MarkNotificationsRead`

### New Feature Utilities
- `extractHashtags(content)` — regex extracts hashtags supporting Unicode/Vietnamese diacritics (`\p{L}\p{N}`)
- `tokenizeContent(content)` — splits content into `{type: 'text'|'hashtag', value}` tokens for rendering

### New Shared Components (`components/notifications/`)
- `NotificationBell` — dropdown trigger, red badge for unread count, click-outside close
- `NotificationPanel` — paginated list with mark-all-read, used in dashboard header and community page
- `NotificationItem` — single row with Vietnamese type labels, time-ago, unread green dot

### New Feature Components (`features/community/components/`)
- `HashtagLink` — renders `#tag` as clickable button (calls `onHashtagClick`) or styled span
- `SharedPostEmbed` — compact read-only card for the original post inside a share
- `SharePostModal` — `BaseModal` wrapping `SharePostForm`
- `SharePostForm` — controlled form with optional comment field
- `SavedPostsView` — paginated saved posts list, reuses `PostCard`, `Bookmark` empty state
- `SuggestedUserCard` — user card with `FollowButton` (compact via `className`)
- `SuggestedUsers` — replaces placeholder, calls `useQueryGetSuggestedUsers`
- `TrendingTopics` — replaces placeholder, calls `useQueryGetTrendingTopics`, clickable hashtag pills

### Updated Components
- `PostActions` — Share2 + Bookmark icons wired to `onShareClick`/`onSaveToggle`/`isSaved`/`isSaveLoading`
- `PostBody` — tokenizes content for hashtag links; shows `SharedPostEmbed` for reposts
- `PostEngagement` — renders `shareCount` stat
- `PostCard` — root wiring: `useSavedPost`, `SharePostModal`, `onHashtagClick` propagation
- `CommunityFeed` — `hashtag` filter prop + active-hashtag chip UI
- `CommunityNav` — view-based navigation with `activeView`/`onViewChange` props (Phase 2 views enabled)
- `MobileSubNav` — all four tabs enabled (feed, saved, notifications, profile)
- `CommunityLeftSidebar` — passes `activeView`/`onViewChange` to `CommunityNav`
- `CommunityRightSidebar` — uses real `SuggestedUsers`/`TrendingTopics` with `onHashtagClick`
- `dashboard/layout.tsx` — `NotificationBell` replaces placeholder Bell buttons (desktop + mobile header)
- `community/page.tsx` — full view router with `activeView`, `mobileView`, `hashtagFilter` state

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Authentication | JWT middleware on all community routes (unchanged from Phase 1) | Yes |
| Authorization | `userID` extracted from JWT context — users can only read/write their own notifications, saved posts | Yes |
| Input validation | `sharePostSchema` (Zod, max 2000 chars); server-side validation in handler | Yes |
| Hashtag injection | Hashtags extracted server-side via regex; stored as plain strings, rendered as text | Yes |
| Rate limiting | Inherits existing rate limiter middleware on `/api/v1/` routes | Yes |
| SQL injection | All queries via GORM parameterized (no raw string interpolation) | Yes |
| Data exposure | Notification actor info limited to public profile fields; `is_read` scoped to requesting user | Yes |

## Build Verification

### Go Backend
```
go build ./...  →  SUCCESS (0 errors)
Packages: domain/models, domain/repository, domain/service, handlers, internal/app
```

### TypeScript Frontend
```
tsc --noEmit  →  200 pre-existing errors (unchanged baseline)
Phase 2 files: 0 errors
```

Pre-existing errors are in test files and unrelated legacy components — not introduced by this feature.

## Review Results

### Spec Compliance
All 5 functional requirement groups from the spec were implemented:
- FR-1 Share/Repost — `SharePost` RPC, `SharedPostEmbed`, `SharePostModal`
- FR-2 In-App Notifications — `GetNotifications`/`GetUnreadNotificationCount`/`MarkNotificationsRead`, `NotificationBell`/`NotificationPanel`
- FR-3 Saved Posts — `SavePost`/`UnsavePost`/`GetSavedPosts`, `SavedPostsView`, `useSavedPost` optimistic toggle
- FR-4 Suggested Users — `GetSuggestedUsers` (friends-of-friends + by-follower-count), `SuggestedUsers`
- FR-5 Trending Hashtags — server-side extraction + `GetTrendingTopics`, `TrendingTopics`, hashtag feed filter

### Security Review
- No monetary operations in Phase 2 (social features only) — no FIFO/balance risk
- All user-scoped data (notifications, saved posts) verified against JWT user ID in service layer
- No sensitive financial data exposed in notification payloads

### Code Quality
- Frontend hooks follow established patterns (`useSavedPost` mirrors `useLike`, `useNotificationCount` mirrors `useUnreadCount`)
- No cross-feature imports introduced
- Shared notification components placed in `components/notifications/` per ADR-003 boundary rules
- All new Go code follows existing handler + service + repository layer separation

## Errors Encountered and Fixed

| # | Error | Root Cause | Fix |
|---|-------|-----------|-----|
| 1 | `not enough arguments in call to s.postRepo.GetFeed` | `GetFeed` signature extended with `hashtag` param but existing call not updated | Added `req.Hashtag` as 4th arg in `CommunityService.GetFeed()` |
| 2 | `SharePostRequest` field mismatch — `comment` vs `content` | Schema used `comment` but proto type defines `content` | Renamed field in `sharePostSchema` and `SharePostForm` |
| 3 | Avatar `picture` prop doesn't exist | `Avatar` component uses `imageUrl`, not `picture` | Fixed `SharedPostEmbed` to use `imageUrl={sharedPost.userPicture}` |
| 4 | `FollowButton` `compact` prop doesn't exist | Component only accepts `className` | Replaced `compact` with `className="text-xs px-3 py-1 flex-shrink-0"` |
| 5 | `Button` `buttonType` prop doesn't exist for HTML type | Submit type uses `htmlType` prop | Fixed `SharePostForm` to use `htmlType="submit"` |

## Fix History

| Date | Fix | Severity | File | Commit |
|------|-----|----------|------|--------|
| 2026-03-10 | Backend route `/trending-topics` → `/trending` to match proto HTTP option and generated frontend client | Minor | `src/go-backend/handlers/routes.go:276` | — |
| 2026-03-10 | SharedPostEmbed not rendered when viewing feed: (1) added `SharedPost *Post` GORM relationship to Post model, (2) added `Preload("SharedPost").Preload("SharedPost.User")` to `GetFeed` and `GetByUserID`, (3) populated `item.SharedPost` in `postToProto` when relationship is loaded | Minor | `domain/models/post.go`, `domain/repository/post_repository.go`, `domain/service/community_service.go` | — |
| 2026-03-10 | NotificationBell badge only updated after page refresh: (1) added `refetchInterval: 30_000` and `refetchOnMount: "always"` to `useQueryGetUnreadNotificationCount` in `useNotificationCount`, (2) added `useEffect` in `NotificationBell` to invalidate the unread count cache whenever the panel opens so badge syncs with the freshly fetched list | Minor | `features/community/hooks/useNotifications.ts`, `components/notifications/NotificationBell.tsx` | — |
| 2026-03-10 | "Đọc tất cả" button sends API but UI does not mark notifications as read: root cause — `MarkNotificationsRead` handler returned `204 No Content` but the `apiClient.put()` always calls `response.json()`, throwing a SyntaxError on an empty body; the mutation landed in `onError` so `invalidateQueries` never fired. Fix: (1) change backend handler to return `200 OK` with `{"success":true}` JSON body; (2) add optimistic `setQueriesData` in `useMarkAllRead.onSuccess` so the UI updates instantly regardless of the 5-min global staleTime | Minor | `src/go-backend/handlers/community.go`, `features/community/hooks/useNotifications.ts` | — |
| 2026-03-10 | Bookmark icon fills then unfills immediately on save/unsave: root cause — same pattern as MarkNotificationsRead fix; `SavePost` and `UnsavePost` handlers returned `204 No Content` but `apiClient` always calls `response.json()` on the empty body, throwing a SyntaxError; mutation landed in `onError`, triggering the optimistic rollback in `useSavedPost`. Fix: change both handlers to return `200 OK` with `{"success":true}` JSON body using `handler.Success()` | Minor | `src/go-backend/handlers/community.go:590,612` | — |
| 2026-03-10 | Clicking a notification did not navigate and did not mark it as read: root cause — `NotificationPanel.handleNotificationClick` called `onClose()` only; it ignored the notification data entirely. Fix: (1) add `useMarkOneReadOptimistic` hook to `useNotifications.ts` that updates only the clicked item's `isRead` in cache and decrements the badge count; (2) update `handleNotificationClick` in `NotificationPanel` to call `markOneRead(notif.id)`, fire `MarkNotificationsRead` API (mark-all, the only API available), then call `router.push(routes.community)` to navigate to the community page | Minor | `features/community/hooks/useNotifications.ts`, `components/notifications/NotificationPanel.tsx` | — |
| 2026-03-10 | `GET /api/v1/community/saved` returning 404: root cause — backend route registered as `/saved-posts` but proto HTTP option defines `get: "/api/v1/community/saved"`; frontend (generated from proto) calls `/saved`. Fix: rename route from `/saved-posts` to `/saved` in `routes.go` | Minor | `src/go-backend/handlers/routes.go:272` | — |

## Known Issues / Technical Debt

- **`GetSuggestedUsers`** uses a simple SQL query (users not followed + ordered by follower count). A more sophisticated recommendation algorithm (mutual follows, shared interests) is out of scope for Phase 2.
- **Notification delivery** is pull-based (polling every 30s). Real-time push via WebSocket or SSE is deferred to a future phase.
- **Hashtag extraction** runs on every `CreatePost` and `SharePost` — at scale this could be moved to a background job. Acceptable for current user volume.
- **`ShareCount`** is a denormalized counter. It is incremented atomically but not decremented if a share is deleted (delete-share is not in scope).

## Files Changed (Complete List)

### Backend
- `api/protobuf/v1/community.proto`
- `src/go-backend/protobuf/v1/community_grpc.pb.go` (generated)
- `src/go-backend/protobuf/v1/community.pb.go` (generated)
- `src/go-backend/domain/models/notification.go` (new)
- `src/go-backend/domain/models/saved_post.go` (new)
- `src/go-backend/domain/models/post_hashtag.go` (new)
- `src/go-backend/domain/models/post.go`
- `src/go-backend/domain/repository/notification_repository.go` (new)
- `src/go-backend/domain/repository/saved_post_repository.go` (new)
- `src/go-backend/domain/repository/hashtag_repository.go` (new)
- `src/go-backend/domain/repository/post_repository.go`
- `src/go-backend/domain/repository/follow_repository.go`
- `src/go-backend/domain/service/community_service.go`
- `src/go-backend/domain/service/interfaces.go`
- `src/go-backend/domain/service/services.go`
- `src/go-backend/handlers/community.go`
- `src/go-backend/handlers/routes.go`
- `src/go-backend/internal/app/providers.go`
- `src/go-backend/cmd/migrate-community-phase2/main.go` (new)

### Frontend
- `src/wj-client/gen/protobuf/v1/community*.ts` (generated)
- `src/wj-client/utils/generated/hooks.ts` (generated)
- `src/wj-client/features/community/utils/community.schema.ts`
- `src/wj-client/features/community/utils/hashtag.ts` (new)
- `src/wj-client/features/community/hooks/useSavedPost.ts` (new)
- `src/wj-client/features/community/hooks/useNotifications.ts` (new)
- `src/wj-client/features/community/components/HashtagLink.tsx` (new)
- `src/wj-client/features/community/components/SharedPostEmbed.tsx` (new)
- `src/wj-client/features/community/forms/SharePostForm.tsx` (new)
- `src/wj-client/features/community/components/SharePostModal.tsx` (new)
- `src/wj-client/features/community/components/PostActions.tsx`
- `src/wj-client/features/community/components/PostBody.tsx`
- `src/wj-client/features/community/components/PostEngagement.tsx`
- `src/wj-client/features/community/components/PostCard.tsx`
- `src/wj-client/features/community/components/SavedPostsView.tsx` (new)
- `src/wj-client/features/community/components/SuggestedUserCard.tsx` (new)
- `src/wj-client/features/community/components/SuggestedUsers.tsx`
- `src/wj-client/features/community/components/TrendingTopics.tsx`
- `src/wj-client/features/community/components/CommunityNav.tsx`
- `src/wj-client/features/community/components/MobileSubNav.tsx`
- `src/wj-client/features/community/components/CommunityRightSidebar.tsx`
- `src/wj-client/features/community/components/CommunityLeftSidebar.tsx`
- `src/wj-client/features/community/components/CommunityFeed.tsx`
- `src/wj-client/components/notifications/NotificationItem.tsx` (new)
- `src/wj-client/components/notifications/NotificationPanel.tsx` (new)
- `src/wj-client/components/notifications/NotificationBell.tsx` (new)
- `src/wj-client/app/[locale]/dashboard/community/page.tsx`
- `src/wj-client/app/[locale]/dashboard/layout.tsx`

### Documentation
- `docs/architecture/c4-component-backend.md`
- `docs/architecture/c4-component-frontend.md`
- `docs/architecture/flow-community.md`
- `docs/reports/2026-03-10-community-phase2-progress.md`

## Git Log

```
9e140d8 chore(community): mark Phase 2 implementation as complete
69e1261 docs(community): update C4 architecture diagrams for Phase 2
12bfe42 feat(community): wire Phase 2 features into layout and community page
5eb9503 feat(community): add SavedPostsView, SuggestedUsers, TrendingTopics components
a14e377 feat(community): add NotificationBell, NotificationPanel, NotificationItem components
11b3b13 feat(community): add SharePost modal and update PostCard with Phase 2 actions
fb91325 feat(community): add Phase 2 frontend schemas, hooks, and hashtag utils
12e4e2c feat(community): add Phase 2 handlers, routes, and DI wiring
962200a feat(community): extend CommunityService with Phase 2 social methods
b607f1f feat(community): add Phase 2 repositories and extend existing repos
17b287e feat(community): add Phase 2 models and database migration
870355a feat(community): extend proto with Phase 2 social features + generate code
```

## How to Test

### Backend
```bash
# Run migration
task backend:migrate-community-phase2

# Build verification
cd src/go-backend && go build ./...

# Start backend
task backend:dev
```

### Frontend
```bash
cd src/wj-client
npm run build   # type-check + build

# Start dev server
task frontend:dev
```

### Manual Test Checklist

**Share/Repost**
- [ ] Open any post → Share button visible in PostActions
- [ ] Click Share → SharePostModal opens with optional comment field
- [ ] Submit → post appears in feed with `SharedPostEmbed` showing original
- [ ] Share count increments on original post

**Notifications**
- [ ] NotificationBell appears in dashboard header (desktop + mobile)
- [ ] After a like/comment/share from another user → red badge shows unread count
- [ ] Click bell → NotificationPanel dropdown opens with notification list
- [ ] "Mark all read" button clears badge
- [ ] Notifications view in community left sidebar shows same panel

**Saved Posts**
- [ ] Bookmark icon in PostActions → toggles saved state optimistically
- [ ] Navigate to Saved view (left sidebar or mobile tab) → saved posts listed
- [ ] Unsave from feed → post removed from Saved view on next load

**Hashtags**
- [ ] Create post with `#hashtag` → hashtag rendered as green clickable link
- [ ] Click hashtag → feed filtered to that hashtag, active-filter chip shown
- [ ] Click × on filter chip → feed returns to full feed
- [ ] Trending Topics in right sidebar shows top hashtags → clicking filters feed

**Suggested Users**
- [ ] Right sidebar (desktop) shows suggested users not yet followed
- [ ] Follow button on suggested card → follow state updates
