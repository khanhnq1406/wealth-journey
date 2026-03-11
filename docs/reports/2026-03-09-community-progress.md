# Community Feature — Overall Progress

## Feature Overview

The Community module adds a finance-focused social feed to WealthJourney, similar to Facebook's feed model but scoped to financial knowledge sharing.

**Design Reference:** `design/pencil/design-v2/community/feed.pen`

## Phase Roadmap

| Phase | Name | Scope | Status | Spec | Plan | Report |
|-------|------|-------|--------|------|------|--------|
| **1** | **MVP** | Feed, Posts (text+image), Like, Comment, Follow, Basic Profile, Report | `completed` | `docs/specs/2026-03-09-community-phase1-spec.md` | `docs/plans/2026-03-10-community-phase1-plan.md` | `docs/reports/2026-03-10-community-phase1-report.md` |
| **2** | **Social** | Share, Notifications, Saved posts, Suggested users, Trending topics | `completed` | `docs/specs/2026-03-09-community-phase2-spec.md` | `docs/plans/2026-03-10-community-phase2-plan.md` | `docs/reports/2026-03-10-community-phase2-report.md` |
| 3 | Advanced | Groups, Advanced profile, Polls, Admin moderation dashboard | `planned` | — | — | — |

## Phase 1 (MVP) Details

### Key Decisions Made
- **Navigation:** Separate route `/dashboard/community` using existing app sidebar (premium section)
- **Content scope:** Finance-focused feed (topic tags removed in Phase 1 — see fix history)
- **Image storage:** Supabase Storage with signed upload URLs (endpoint exists, not yet integrated)
- **Feed algorithm:** Chronological (newest first) from followed users; fallback to global feed when no follows
- **Follow model:** Open follow (no approval required)
- **Moderation:** Basic report endpoint (manual review, no admin UI in Phase 1)
- **Desktop layout:** 3-column (left sidebar profile + center feed + right sidebar placeholder)

### Architecture
- **Backend:** `community.proto` → CommunityHandler → CommunityService → 4 repositories (Post, Comment, Like, Follow)
- **Frontend:** `features/community/` module with 11 components, 2 forms, 2 hooks, 2 utils (Phase 2 added more — see Phase 2 details)
- **Database:** 4 new tables (post, comment, post_like, user_follow) + bio field on user table
- **Storage:** GetUploadURL endpoint implemented; Supabase bucket integration deferred

### Phase 1 Implementation Progress

| # | Task | Status | Commit | Summary |
|---|------|--------|--------|---------|
| 1 | Design community.proto (17 RPCs) | `done` | `b87cc6f` | Post CRUD, feed, comments, likes, follow, profile, report, upload URL |
| 2 | Generate Go + TypeScript code | `done` | `917a11e` | Auto-generated .pb.go, .pb.gw.go, _grpc.pb.go, community.ts |
| 3 | Database models (GORM) | `done` | `92413be` | Post, Comment, PostLike, UserFollow models + User.bio extension |
| 4 | Database migration | `done` | `9faf62a` | Create 4 community tables with indexes |
| 5 | Repository layer (4 repos) | `done` | `43deb1b` | Post, Comment, Like, Follow repositories with pagination support |
| 6 | CommunityService (17 methods) | `done` | `612f0f1` | Full business logic: feed, engagement, follow, profile, report |
| 7 | REST handlers (17 endpoints) | `done` | `6822db6` | All community routes under `/api/v1/community/*` |
| 8 | Wire DI, routes, providers | `done` | `9484a7a` | builder.go, routes.go, providers.go wired |
| 9 | Community route + nav items | `done` | `e811358` | Route constant, sidebar nav, bottom nav restructure |
| 10 | Community page shell (3-column) | `done` | `8b08247` | Desktop 3-column + mobile single-column layout |
| 11 | PostCard component | `done` | `d3d96c7` | PostHeader, PostBody, PostActions, PostEngagement subcomponents |
| 12 | CreatePostBox + forms | `done` | `826f2d4` | CreatePostForm, EditPostForm with Zod validation |
| 13 | Like, comment, follow hooks + components | `done` | `d54e8b6` | useLike, useFollow hooks; CommentSection, CommentBubble, FollowButton |
| 14 | ProfileCard, sidebars, FeedEmpty | `done` | `9caf6fa` | ProfileCard with bio edit, CommunityLeftSidebar, CommunityRightSidebar (placeholder) |
| 15 | Mobile sub-navigation | `done` | `05e1823` | MobileSubNav component, responsive layout verification |
| 16 | C4 diagrams + implementation report | `done` | `9885939` | flow-community.md, c4 updates, 2026-03-10-community-phase1-report.md |
| 17 | Fix: user auth, cache keys, Tailwind | `done` | `b8a18c9` | Auth extraction fix, query key alignment, Tailwind purge config |
| 18 | Fix: wire like/comment/follow actions | `done` | `ad0f19e` | PostCard action wiring, user context propagation |
| 19 | Fix: global feed when no follows | `done` | `b3e1f7d` | Service returns global feed when following list is empty |
| 20 | Fix: comment submit spinner | `done` | `277ac6b` | Loading state on comment submit button |
| 21 | Fix: follow button state persistence | `done` | `441472e` | Follow state hydrated from profile query on refresh |
| 22 | Fix: remove topic tag feature | `done` | `55f21ca` | Topic tags removed from Phase 1 scope |
| 23 | Fix: move community to premium nav | `done` | `05b928a` | Community nav item placed in premium sidebar section |
| 24 | Fix: comment section scroll on mobile | `done` | `cb4eb3d` | Comment section scrolls past bottom nav on mobile |

### Phase 1 Scope Boundaries

**Delivered in Phase 1:**
- Post CRUD (create, read, update, delete)
- Image URL attachment on posts (manual URL input only)
- Like / unlike posts (optimistic UI)
- Comment create / delete (flat, no threading)
- Follow / unfollow users (open model, no approval)
- User community profile with bio editor
- Content reporting (POST endpoint; no admin review UI)
- Personalized feed (followed users) + global fallback
- Responsive design: 3-column desktop, single-column mobile
- Optimistic state updates for likes and follows
- Pagination on feed and comments

**Explicitly deferred to Phase 2+:**
- Topic tags (removed from Phase 1 after implementation)
- Image upload via Supabase Storage (endpoint exists, not integrated in UI)
- Notifications (real-time or batch)
- User search / suggested users (right sidebar is placeholder)
- Share / repost
- Saved posts / bookmarks
- Edit comments
- Reply threads
- Admin moderation dashboard

## Phase 2 (Social) Details

### Key Decisions Made
- **Notifications:** Pull-based polling (every 30s); real-time WebSocket/SSE deferred to Phase 3
- **Share model:** Creates a new post with `shared_post_id` FK pointing to original; `SharedPostEmbed` renders the original inside
- **Hashtag extraction:** Regex `#(\p{L}|\p{N})+` (Unicode, supports Vietnamese diacritics); stored in `post_hashtag` table on create/share
- **Suggested users algorithm:** Three-tier fallback — friends-of-friends → top by followers → recently joined (cold-start)
- **Saved posts toggle:** Unique constraint on `(user_id, post_id)` in `saved_post` table; optimistic UI toggle
- **Notification components:** Placed in `components/notifications/` (shared layer) rather than `features/community/` for potential reuse

### Architecture
- **Backend:** 9 new RPCs in `community.proto`; 3 new repositories (Notification, SavedPost, Hashtag); CommunityService extended with 10 new methods; 9 new routes
- **Frontend:** `features/community/` extended with 11 new components, 1 new form, 2 new hooks, 1 new util; 3 new shared notification components in `components/notifications/`
- **Database:** 3 new tables (`notification`, `saved_post`, `post_hashtag`) + 2 columns on `post` (`shared_post_id`, `share_count`)

### Phase 2 Implementation Progress

| # | Task | Status | Commit | Summary |
|---|------|--------|--------|---------|
| 1 | Extend community.proto (9 new RPCs) | `done` | `870355a` | Share, Notifications (3), Saved Posts (3), SuggestedUsers, TrendingTopics |
| 2 | Phase 2 models + migration | `done` | `17b287e` | notification, saved_post, post_hashtag tables; shared_post_id + share_count on post |
| 3 | Phase 2 repositories | `done` | `b607f1f` | NotificationRepository, SavedPostRepository, HashtagRepository; extend PostRepo + FollowRepo |
| 4 | Extend CommunityService (10 methods) | `done` | `962200a` | SharePost, GetNotifications, GetUnreadCount, MarkRead, SavePost, UnsavePost, GetSaved, GetSuggestedUsers, GetTrendingTopics + helpers |
| 5 | Phase 2 handlers + routes + DI | `done` | `12e4e2c` | 9 new routes under `/api/v1/community/*`; DI wired in providers.go and builder.go |
| 6 | Frontend schemas, hooks, hashtag utils | `done` | `fb91325` | community.schema.ts, useSavedPost, useNotifications, hashtag.ts |
| 7 | SharePost modal + PostCard Phase 2 | `done` | `11b3b13` | SharePostModal, SharedPostEmbed, SharePostForm; PostActions updated |
| 8 | Notification components | `done` | `a14e377` | NotificationBell, NotificationPanel, NotificationItem (shared layer) |
| 9 | SavedPostsView, SuggestedUsers, TrendingTopics | `done` | `5eb9503` | SuggestedUserCard, SuggestedUsersPlaceholder, HashtagLink, TrendingTopics |
| 10 | Wire Phase 2 into layout + community page | `done` | `12bfe42` | CommunityNav, MobileSubNav, CommunityRightSidebar updated; NotificationBell in dashboard header |
| 11 | C4 diagrams + Phase 2 report | `done` | `69e1261` | Architecture docs updated for Phase 2 |
| 12 | Fix: bookmark icon not persisting | `done` | `d5d6b11` | isSaved hydrated from feed query on reload |
| 13 | Fix: saved posts route 404 | `done` | `dd23263` | Route corrected to `/saved` |
| 14 | Fix: SavePost/UnsavePost returning 204 | `done` | `d6d27d4` | Handlers return 200 JSON |
| 15 | Fix: notification click not navigating | `done` | `dc2ef3d` | Click navigates + optimistic single-item mark-read |
| 16 | Fix: mark-all-read not updating UI | `done` | `cde3634` | Query invalidation added after mutation |
| 17 | Fix: NotificationBell badge stale | `done` | `409efbf` | Badge refetches on panel open via invalidateQueries |
| 18 | Fix: SharedPostEmbed missing from feed | `done` | `28fddbe` | Backend Preload("SharedPost") added to feed query |
| 19 | Fix: trending topics route mismatch | `done` | `d2cfa46` | Route corrected to match proto HTTP option `/trending` |
| 20 | Fix: SuggestedUserCard dismiss button | `done` | `d7c5c95` | X dismiss button removes card client-side |
| 21 | Fix: SuggestedUsers + TrendingTopics mobile | `done` | `bae09c8` | Widgets shown below feed on mobile (lg:hidden wrapper) |
| 22 | Fix: cold-start suggested users | `done` | `06bd49a` | GetRecentUsers fallback for new accounts with no follows |
| 23 | Fix: avatar 429 errors (Google CDN) | `done` | `b0378b6` | Avatar uses Next.js Image instead of raw img tag |

### Phase 2 Scope Delivered

**Delivered in Phase 2:**
- Share/repost posts with optional commentary (shares appear in feed with embedded original)
- In-app notifications for likes, comments, follows, shares (pull-based, 30s polling)
- Unread badge on NotificationBell in dashboard header
- Mark all notifications read
- Save/bookmark posts (optimistic toggle, bookmark persists on reload)
- Saved Posts view (paginated, accessible from sidebar and mobile nav)
- Suggested Users widget (friends-of-friends → top followers → recent; dismiss per card)
- Trending hashtags widget (top 10 by post count, clickable to filter feed)
- Hashtag extraction in posts and shares (stored in `post_hashtag` table)
- Hashtag feed filtering (click trending topic or inline hashtag to filter)
- Share count displayed on PostEngagement

**Explicitly deferred to Phase 3+:**
- Real-time notifications (WebSocket/SSE)
- Single-item notification mark-as-read API
- Share count decrement on share deletion
- Edit comments
- Reply threads (threaded comments)
- Groups
- Advanced profile
- Polls
- Admin moderation dashboard
- Image upload via Supabase Storage (endpoint exists, no UI integration)

## Phase 3 (Advanced) Planned Scope

- **Groups:** Create/join finance groups (e.g., "Crypto VN", "Đầu tư bất động sản"), group feed, group moderation
- **Advanced Profile:** Profile customization, post history, activity summary, badges/achievements
- **Polls:** Create polls within posts (e.g., "VN-Index cuối năm: >1300 / 1200-1300 / <1200")
- **Admin Moderation Dashboard:** Review reported content, ban users, content analytics

## Notes

- Created: 2026-03-09
- Last updated: 2026-03-10 (Phase 2 completed)
