# Community Feature — Overall Progress

## Feature Overview

The Community module adds a finance-focused social feed to WealthJourney, similar to Facebook's feed model but scoped to financial knowledge sharing.

**Design Reference:** `design/pencil/design-v2/community/feed.pen`

## Phase Roadmap

| Phase | Name | Scope | Status | Spec | Plan | Report |
|-------|------|-------|--------|------|------|--------|
| **1** | **MVP** | Feed, Posts (text+image), Like, Comment, Follow, Basic Profile, Report | `not_started` | `docs/specs/2026-03-09-community-phase1-spec.md` | — | — |
| 2 | Social | Share, Notifications, Saved posts, Suggested users, Trending topics | `planned` | — | — | — |
| 3 | Advanced | Groups, Advanced profile, Polls, Admin moderation dashboard | `planned` | — | — | — |

## Phase 1 (MVP) Details

### Key Decisions Made
- **Navigation:** Separate route `/dashboard/community` using existing app sidebar
- **Content scope:** Finance-focused with topic tags (Chứng khoán VN, Crypto, Vàng & Bạc, etc.)
- **Image storage:** Supabase Storage with signed upload URLs
- **Feed algorithm:** Chronological (newest first) from followed users + own posts
- **Follow model:** Open follow (no approval required)
- **Moderation:** Basic report + hide (manual review)
- **Desktop layout:** 3-column (left sidebar profile + center feed + right sidebar placeholder)

### Architecture
- **Backend:** New `community.proto` → CommunityHandler → CommunityService → 5 repositories (Post, Comment, Like, Follow, Report)
- **Frontend:** New `features/community/` module with components, forms, hooks, utils
- **Database:** 5 new tables (post, comment, post_like, user_follow, content_report) + bio field on user table
- **Storage:** Supabase Storage bucket for post images

### Phase 1 Implementation Progress

| # | Task | Status | Commit | Summary |
|---|------|--------|--------|---------|
| — | *Not yet planned* | — | — | Next step: run `plan` command with spec file |

## Phase 2 (Social) Planned Scope

- **Share/Repost:** Share posts to own feed with optional commentary
- **Notifications:** Real-time notifications for likes, comments, follows, mentions
- **Saved Posts:** Bookmark posts for later reading
- **Suggested Users:** Algorithm-based user suggestions (based on followed topics, mutual follows)
- **Trending Topics:** Aggregate popular topic tags into trending section on right sidebar

## Phase 3 (Advanced) Planned Scope

- **Groups:** Create/join finance groups (e.g., "Crypto VN", "Đầu tư bất động sản"), group feed, group moderation
- **Advanced Profile:** Profile customization, post history, activity summary, badges/achievements
- **Polls:** Create polls within posts (e.g., "VN-Index cuối năm: >1300 / 1200-1300 / <1200")
- **Admin Moderation Dashboard:** Review reported content, ban users, content analytics

## Notes

- Created: 2026-03-09
- Last updated: 2026-03-09
