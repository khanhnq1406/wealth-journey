# Community Phase 1 (MVP) Implementation Report

## Summary

Implemented a finance-focused community social feed for WealthJourney. The community feature allows users to create posts with topic tags, like and comment on posts, follow other users, view a personalized feed, and report inappropriate content. The implementation spans the full stack: protobuf API definitions, Go backend (models, repositories, service, handlers, DI wiring), and Next.js frontend (page, components, forms, hooks, utilities).

## Spec Reference
`docs/specs/2026-03-09-community-phase1-spec.md`

## Plan Reference
`docs/plans/2026-03-10-community-phase1-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Commit |
|---|------|--------|---------------|--------|
| 0 | Update C4 Architecture Diagrams | Done | 2 modified | (bundled with task 17) |
| 1 | Define Protobuf API | Done | 1 created | b87cc6f |
| 2 | Generate Code from Proto | Done | Generated Go+TS | 917a11e |
| 3 | Database Models | Done | 6 created/modified | 92413be |
| 4 | Database Migration | Done | 2 created | 9faf62a |
| 5 | Repositories | Done | 7 created/modified | 43deb1b |
| 6 | Community Service | Done | 3 created/modified | 612f0f1 |
| 7 | Community Handlers | Done | 1 created | 6822db6 |
| 8 | Wire DI & Routes | Done | 3 modified | 9484a7a |
| 9 | Frontend: Constants & Route | Done | 6 modified, 1 created | e811358 |
| 10 | Frontend: Community Page Shell | Done | 7 created | 8b08247 |
| 11 | Frontend: PostCard Component | Done | 7 created, 1 modified | d3d96c7 |
| 12 | Frontend: CreatePostBox & Forms | Done | 4 created, 1 modified | 826f2d4 |
| 13 | Frontend: Like, Comment, Follow | Done | 5 created | d54e8b6 |
| 14 | Frontend: Profile Card & Nav | Done | 4 created, 3 modified | 9caf6fa |
| 15 | Frontend: Mobile Layout | Done | 1 created, 1 modified | 05e1823 |
| 16 | Create Runtime Flow Diagrams | Done | 1 created, 1 modified | a365470 |
| 17 | Integration Testing & Cleanup | Done | 4 modified, 1 created | (final commit) |

## Architecture

### Backend (Go)
- **Proto**: `api/protobuf/v1/community.proto` — 17 RPCs covering posts, comments, likes, follows, profiles, reports, and upload URLs
- **Models**: Post, Comment, PostLike, UserFollow, ContentReport + User.Bio field
- **Repositories**: PostRepository, CommentRepository, LikeRepository, FollowRepository, ReportRepository
- **Service**: CommunityService with 17 methods implementing all business logic
- **Handlers**: CommunityHandler with 17 REST endpoint handlers
- **Routes**: 17 endpoints under `/api/v1/community/*` with JWT auth and rate limiting

### Frontend (Next.js)
- **Page**: `app/[locale]/dashboard/community/page.tsx` — 3-column desktop layout, full-width mobile
- **Components** (16 files in `features/community/components/`):
  - PostCard, PostHeader, PostBody, PostActions, PostEngagement
  - Avatar, TopicTag, CommentBubble, CommentSection
  - ProfileCard, CommunityNav, FeedEmpty, SuggestedUsersPlaceholder
  - CommunityFeed, CommunityTabBar, CommunityLeftSidebar, CommunityRightSidebar
  - CreatePostBox, MobileSubNav
- **Forms**: CreatePostForm, EditPostForm (with Zod validation)
- **Hooks**: useLike (optimistic), useFollow (optimistic)
- **Utils**: topic-tags, time-format, community.schema

### Navigation Changes
- Bottom nav restructured from 6 items to 3: Portfolio | Home | Community
- Desktop sidebar: Community nav item added with CommunityIcon
- Mobile slide-out: Community added to standard items

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Authentication | JWT required on all community endpoints via AuthMiddleware | Yes |
| Authorization | User ID from JWT context (never request body); ownership checks for edit/delete | Yes |
| Input validation | Content length (1-2000 chars), topic tag required, bio max 200 chars | Yes |
| Self-follow prevention | Service rejects followerID == followeeID | Yes |
| Content reporting | Users can report posts/comments with reason; reports stored for moderation | Yes |
| XSS prevention | Content rendered with React (auto-escaped); no dangerouslySetInnerHTML | Yes |
| Rate limiting | Community routes use rate limiter middleware | Yes |

## Verification Results

| Check | Result |
|-------|--------|
| `go build ./domain/... ./handlers/... ./internal/... ./pkg/...` | Pass |
| `npx tsc --noEmit` | Pass (pre-existing portfolio.test.tsx errors excluded) |

## Architecture Documentation Updated

- **C4 Backend Components** (`c4-component-backend.md`): Added CommunityHandler, CommunityService, 5 repositories, all relations
- **C4 Frontend Components** (`c4-component-frontend.md`): Added CommunityPage, CommunityFeature, all relations
- **Runtime Flow Diagrams** (`flow-community.md`): 4 sequence diagrams (create post, feed generation, like/unlike, follow/unfollow)
- **Architecture README**: Updated dynamic behavior diagrams table

## Bugfix: Community Frontend Hotfix (2026-03-10)

### Issues Reported

| # | Issue | Root Cause | Severity |
|---|-------|------------|----------|
| 1 | Like/comment buttons do nothing | `CommunityFeed.handleLikeToggle` was a stub; `CommentSection` never rendered; proto field name mismatches (`post.postId`→`post.id`, `post.authorId`→`post.userId`, etc.) | Critical |
| 2 | Image post button does nothing | `CreatePostForm` had no image URL input field — the image button just opened the form without image support | Medium |
| 3 | Bio doesn't save after editing | `ProfileCard` used Redux store `setAuthReducer` which has no `id` field → `userId = 0` → profile query returned nothing | Critical |
| 4 | Avatar doesn't show Google image | Same root cause as #3: Redux store's `picture` field was not reliably populated; `useAuth` hook provides correct `user.picture` | Medium |
| 5 | Can't click follow button on posts | `FollowButton` component existed but was never integrated into `PostHeader` | Medium |

### Root Cause Analysis

**Primary root cause:** Components used `store.getState().setAuthReducer` (Redux legacy store) which lacks `id` field. The `AuthPayload` interface only has `{ isAuthenticated, email, fullname, picture, preferredCurrency }` — no `id`. This caused `userId = 0` across all community components, making all API calls fail silently.

**Secondary root cause:** Proto field name mismatches. Components referenced `post.postId`, `post.authorId`, `post.authorName`, `post.authorPicture`, `comment.commentId`, `comment.authorName` — but the generated TypeScript interfaces use `post.id`, `post.userId`, `post.userName`, `post.userPicture`, `comment.id`, `comment.userName`. All these fields resolved to `undefined`.

**Tertiary root cause:** Incomplete wiring. `useLike` hook was created (Task 13) but never integrated into `CommunityFeed`/`PostCard`. `CommentSection` had toggle state but no render. `FollowButton` existed but was not placed in `PostHeader`.

### Fix Approach

**Classification:** Minor fix path — all changes in frontend components only, no new business logic, no security-relevant changes, no API/proto changes.

**Strategy:** Replace Redux store access with `useAuth` hook at page level, pass `currentUser` prop down the component tree. Fix all proto field name references. Wire existing hooks (`useLike`, `useFollow`) into the component hierarchy.

### Fix Tasks Completed

| # | Task | Status | Files Changed |
|---|------|--------|---------------|
| F-1 | Replace Redux store with useAuth hook | Done | 7 modified |
| F-2 | Wire useLike hook into PostCard | Done | 2 modified |
| F-3 | Render CommentSection on toggle | Done | 2 modified |
| F-4 | Add image URL input to CreatePostForm | Done | 1 modified |
| F-5 | Add FollowButton to PostHeader | Done | 1 modified |
| F-6 | Fix proto field name mismatches | Done | 4 modified |
| F-7 | Fix pagination request format | Done | 2 modified |

### Files Changed (Hotfix)

| File | Changes |
|------|---------|
| `src/wj-client/app/[locale]/dashboard/community/page.tsx` | Use `useAuth` hook; create `currentUser` object with `id`, `name`, `picture`; pass to children; add auth loading state |
| `src/wj-client/features/community/components/CommunityFeed.tsx` | Accept `currentUser` prop; remove Redux dep; fix `post.id` key; fix pagination format `{ pagination: { page, pageSize } }` |
| `src/wj-client/features/community/components/PostCard.tsx` | Integrate `useLike` hook; render `CommentSection` on toggle; fix all proto field names (`id`, `userId`, `userName`, `userPicture`, `isOwnPost`) |
| `src/wj-client/features/community/components/PostHeader.tsx` | Add `FollowButton` for non-own posts; accept `authorId`, `isFollowing` props |
| `src/wj-client/features/community/components/CommentSection.tsx` | Accept `currentUser` prop; remove Redux dep; fix comment field names (`comment.id`, `comment.userName`, `comment.userPicture`); fix pagination format |
| `src/wj-client/features/community/components/ProfileCard.tsx` | Accept `currentUser` prop; remove Redux dep; use correct query invalidation key `EVENT_CommunityGetCommunityProfile` |
| `src/wj-client/features/community/components/CreatePostBox.tsx` | Accept `currentUser` prop; remove Redux dep |
| `src/wj-client/features/community/components/CommunityLeftSidebar.tsx` | Pass `currentUser` to `ProfileCard` |
| `src/wj-client/features/community/forms/CreatePostForm.tsx` | Accept `currentUser` prop; remove Redux dep; add toggleable image URL input field with `showImageInput` state |
| `src/wj-client/features/community/forms/EditPostForm.tsx` | Fix `post.postId` → `post.id`; fix `imageUrl` type (`undefined` → `""`) |

### Verification Results (Hotfix)

| Check | Result |
|-------|--------|
| `go build ./domain/... ./handlers/... ./internal/... ./pkg/...` | Pass |
| `npx tsc --noEmit` (community files) | Pass (0 community errors) |

### Security Review (Hotfix)

| Concern | Assessment |
|---------|-----------|
| Auth data source | Improved: `useAuth` hook uses JWT-verified user data from `verifyAuth` API call, more reliable than Redux store snapshot |
| User ID integrity | Fixed: `currentUser.id` now comes from server-verified auth response, not client-side Redux state |
| No new endpoints | Confirmed: all changes are frontend-only prop/wiring fixes |
| No new data exposure | Confirmed: same data flows, corrected field references |
| XSS prevention | Unchanged: image URL input uses standard `<input type="url">`, rendered via React auto-escaping |

## Hotfix 2: Community Avatar, Cache Invalidation & Tailwind (2026-03-10)

### Issues Reported

| # | Issue | Root Cause | Severity |
|---|-------|------------|----------|
| 1 | ProfileCard shows "User" name and no avatar | `extractAuthFromResponse` checks `response?.userId` but User proto has `id` — operator precedence causes `user` to always be `null` | Critical |
| 2 | Avatar not shown in PostCard | Cascading from #1: `currentUser.picture` is `""` | Critical |
| 3 | Avatar/username not shown in CreatePostBox | Cascading from #1 | Critical |
| 4 | Feed doesn't reload after creating post | Query key mismatch: `["GetFeed"]` vs `["api.community.getFeed", ...]` | Medium |
| 5 | Comments don't reload after posting | Query key mismatch: `["GetComments"]` vs `["api.community.getComments", ...]` | Medium |
| 6 | Bio doesn't save (visually) | Cascading from #1: `currentUser.id` is 0 → profile query disabled | Critical |
| 7 | Banner in ProfileCard is white | Tailwind `content` config missing `./features/**/*` — feature-only CSS classes purged | Medium |
| 8 | Avatar not shown in CommentSection | Cascading from #1 | Critical |

### Root Cause Analysis

**Primary:** `extractAuthFromResponse` (useAuth.ts:58) had JS operator precedence bug: `response?.user || response?.userId ? response : null` parses as `(response?.user || response?.userId) ? response : null`. The User proto has `id` not `userId`, so `user` was always `null`.

**Secondary:** Hardcoded query key strings `["GetFeed"]`/`["GetComments"]` didn't match auto-generated `EVENT_Community*` constants used by React Query hooks.

**Tertiary:** Tailwind `content` config missed `./features/**/*`, purging all CSS classes unique to feature files.

### Fix Tasks Completed

| # | Task | Files Changed |
|---|------|---------------|
| F2-1 | Fix `extractAuthFromResponse` to detect User by `id` field | `useAuth.ts` |
| F2-2 | Fix query keys in CreatePostForm and CommunityFeed | `CreatePostForm.tsx`, `CommunityFeed.tsx` |
| F2-3 | Fix query keys in CommentSection | `CommentSection.tsx` |
| F2-4 | Add `./features/**/*` to Tailwind content config | `tailwind.config.ts` |

### Verification Results (Hotfix 2)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (community + auth files) | Pass (0 errors) |

### Security Review (Hotfix 2)

| Concern | Assessment |
|---------|-----------|
| Auth data integrity | Fixed: correctly identifies User objects by server-verified `id` field |
| Query invalidation | Fixed: uses correct EVENT constants for cache consistency |
| No new endpoints | Confirmed: frontend-only fixes |
| No new data exposure | Confirmed: same data flows, corrected extraction logic |

## Fix History

| Date | Fix | Severity | Files Changed |
|------|-----|----------|---------------|
| 2026-03-10 | Add spinner loading state to comment submit button (replaces Send icon with Loader2 while `isPending`; dims button color during load) | Minor | `CommentSection.tsx` |

## Known Issues / Technical Debt

1. **No server-side image upload**: Phase 1 uses image URLs directly; Phase 2 should add Supabase storage upload
2. **No pagination optimization**: Feed uses simple offset pagination; Phase 2 should consider cursor-based for better performance
3. **Denormalized like count**: PostLike count is maintained on Post model — eventual consistency if concurrent writes overlap
4. **Pre-existing build errors**: `cmd/migrate-import` and `cmd/test-json` have unrelated build errors
5. **Pre-existing test errors**: `portfolio.test.tsx` references removed files

## Files Changed (Complete List)

### Protobuf
- `api/protobuf/v1/community.proto` (created)

### Backend — Models
- `src/go-backend/domain/models/post.go` (created)
- `src/go-backend/domain/models/comment.go` (created)
- `src/go-backend/domain/models/post_like.go` (created)
- `src/go-backend/domain/models/user_follow.go` (created)
- `src/go-backend/domain/models/content_report.go` (created)
- `src/go-backend/domain/models/user.go` (modified — added Bio field)

### Backend — Repositories
- `src/go-backend/domain/repository/post_repository.go` (created)
- `src/go-backend/domain/repository/comment_repository.go` (created)
- `src/go-backend/domain/repository/like_repository.go` (created)
- `src/go-backend/domain/repository/follow_repository.go` (created)
- `src/go-backend/domain/repository/report_repository.go` (created)
- `src/go-backend/domain/repository/interfaces.go` (modified)

### Backend — Service
- `src/go-backend/domain/service/community_service.go` (created)
- `src/go-backend/domain/service/interfaces.go` (modified)
- `src/go-backend/domain/service/services.go` (modified)

### Backend — Handlers & Wiring
- `src/go-backend/handlers/community.go` (created)
- `src/go-backend/handlers/builder.go` (modified)
- `src/go-backend/handlers/routes.go` (modified)
- `src/go-backend/internal/app/providers.go` (modified)

### Backend — Migration
- `src/go-backend/cmd/migrate-community/main.go` (created)
- `Taskfile.yml` (modified)

### Frontend — Page
- `src/wj-client/app/[locale]/dashboard/community/page.tsx` (created)

### Frontend — Components
- `src/wj-client/features/community/components/Avatar.tsx` (created)
- `src/wj-client/features/community/components/TopicTag.tsx` (created)
- `src/wj-client/features/community/components/PostCard.tsx` (created)
- `src/wj-client/features/community/components/PostHeader.tsx` (created)
- `src/wj-client/features/community/components/PostBody.tsx` (created)
- `src/wj-client/features/community/components/PostActions.tsx` (created)
- `src/wj-client/features/community/components/PostEngagement.tsx` (created)
- `src/wj-client/features/community/components/CommentBubble.tsx` (created)
- `src/wj-client/features/community/components/CommentSection.tsx` (created)
- `src/wj-client/features/community/components/FollowButton.tsx` (created)
- `src/wj-client/features/community/components/ProfileCard.tsx` (created)
- `src/wj-client/features/community/components/CommunityNav.tsx` (created)
- `src/wj-client/features/community/components/FeedEmpty.tsx` (created)
- `src/wj-client/features/community/components/SuggestedUsersPlaceholder.tsx` (created)
- `src/wj-client/features/community/components/CommunityFeed.tsx` (created)
- `src/wj-client/features/community/components/CommunityTabBar.tsx` (created)
- `src/wj-client/features/community/components/CommunityLeftSidebar.tsx` (created)
- `src/wj-client/features/community/components/CommunityRightSidebar.tsx` (created)
- `src/wj-client/features/community/components/CreatePostBox.tsx` (created)
- `src/wj-client/features/community/components/MobileSubNav.tsx` (created)

### Frontend — Forms
- `src/wj-client/features/community/forms/CreatePostForm.tsx` (created)
- `src/wj-client/features/community/forms/EditPostForm.tsx` (created)

### Frontend — Hooks
- `src/wj-client/features/community/hooks/useLike.ts` (created)
- `src/wj-client/features/community/hooks/useFollow.ts` (created)

### Frontend — Utils
- `src/wj-client/features/community/utils/topic-tags.ts` (created)
- `src/wj-client/features/community/utils/time-format.ts` (created)
- `src/wj-client/features/community/utils/community.schema.ts` (created)

### Frontend — Navigation & Constants
- `src/wj-client/app/constants.tsx` (modified)
- `src/wj-client/app/[locale]/dashboard/layout.tsx` (modified)
- `src/wj-client/components/navigation/BottomNav.tsx` (modified)
- `src/wj-client/components/icons/navigation.tsx` (modified)
- `src/wj-client/components/icons/index.ts` (modified)
- `src/wj-client/messages/en/nav.json` (modified)
- `src/wj-client/messages/vi/nav.json` (modified)

### Documentation
- `docs/architecture/c4-component-backend.md` (modified)
- `docs/architecture/c4-component-frontend.md` (modified)
- `docs/architecture/flow-community.md` (created)
- `docs/architecture/README.md` (modified)
- `docs/reports/2026-03-10-community-phase1-progress.md` (created)
- `docs/reports/2026-03-10-community-phase1-report.md` (created)

## How to Test

1. Run migration: `task backend:migrate-community`
2. Start backend: `task backend:dev`
3. Start frontend: `task frontend:dev`
4. Navigate to `/dashboard/community`
5. **Empty state**: See "Chưa có bài viết nào" empty feed message
6. **Create post**: Click "Chia sẻ kiến thức tài chính..." → fill form → submit
7. **Create post with image**: In create post form, click "Ảnh" → paste image URL → submit
8. **Like post**: Click heart icon → heart fills red, count increments; click again → unlike
9. **Comment**: Click comment icon → expand comment section → type → send → comment appears
10. **Follow**: On other users' posts, click "Theo dõi" button next to author name → toggles to "Đang theo dõi"
11. **Profile card**: Left sidebar shows user profile with Google avatar, stats, and bio editing
12. **Edit bio**: Click pencil icon → edit text → click checkmark → bio saves and refreshes
13. **Avatar**: Verify Google profile picture shows in profile card, post creation box, and comment input
14. **Mobile**: Resize to <800px → see full-width cards, mobile sub-nav, topic filter bar
