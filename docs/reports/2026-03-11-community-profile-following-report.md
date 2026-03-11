# Community Profile & Following Screens — Implementation Report

## Summary

Implemented the missing Profile View and Following/Followers View screens in the Community feature. Users can now view their own profile (with bio editing), view other users' profiles, see follower/following counts, navigate to follower/following lists, and click on any user avatar/name in the feed to visit their profile.

## Spec Reference
`docs/specs/2026-03-11-community-profile-following-spec.md`

## Plan Reference
`docs/plans/2026-03-11-community-profile-following-plan.md`

## Root Cause

The Community Phase 2 implementation included navigation buttons (sidebar + mobile nav) for "Profile" and "Following" views, but the `renderCenterContent()` function in `page.tsx` only handled "saved", "notifications", and the default "feed" case. Profile and Following views silently fell through to the feed. Additionally, the backend had no `GetFollowing`/`GetFollowers` API endpoints.

## Tasks Completed

| # | Task | Status | Commit | Files Changed |
|---|------|--------|--------|---------------|
| 1 | Extend Protobuf with GetFollowing/GetFollowers RPCs | Done | 3f90cf0 | community.proto, generated Go+TS |
| 2 | Add Repository Methods | Done | 2bd5d34 | user_follow.go, interfaces.go, follow_repository.go |
| 3 | Add Service Methods | Done | 754e574 | interfaces.go, community_service.go |
| 4 | Add Handlers and Routes | Done | ba4e6cd | community.go, routes.go |
| 5 | Create UserListItem Component | Done | 549d339 | UserListItem.tsx |
| 6 | Create FollowingView Component | Done | 549d339 | FollowingView.tsx |
| 7 | Create ProfileView Component | Done | 549d339 | ProfileView.tsx |
| 8 | Wire Views into Community Page | Done | 78ee712 | page.tsx |
| 9 | Add User Click Navigation | Done | a0a1926 | PostHeader.tsx, PostCard.tsx, CommunityFeed.tsx, page.tsx |
| 10 | Update Architecture Diagrams | Done | b80df59 | c4-component-backend.md, c4-component-frontend.md, flow-community.md |
| 11 | Build Verification and Report | Done | — | This report |

## Implementation Details

### Backend (Go)

**Proto changes (`api/protobuf/v1/community.proto`):**
- Added `FollowUserItem` message with userId, userName, userPicture, bioSnippet, isFollowing
- Added `GetFollowingRequest/Response` and `GetFollowersRequest/Response` messages
- Added `GetFollowing` and `GetFollowers` RPCs to CommunityService

**Repository (`domain/repository/follow_repository.go`):**
- Added GORM relationships (`Follower *User`, `Following *User`) to `UserFollow` model for Preload
- Implemented `GetFollowing()` — queries by `follower_id`, Preloads `Following` user, paginated
- Implemented `GetFollowers()` — queries by `following_id`, Preloads `Follower` user, paginated

**Service (`domain/service/community_service.go`):**
- `GetFollowing()` — calls repo, batch-checks viewer's follow status via `GetFollowedAuthorIDs`, builds `FollowUserItem` list with 60-char bio snippets
- `GetFollowers()` — same pattern but for followers

**Handlers (`handlers/community.go`, `handlers/routes.go`):**
- `GET /api/v1/community/users/:user_id/following` — paginated following list
- `GET /api/v1/community/users/:user_id/followers` — paginated followers list

### Frontend (React/Next.js)

**New components:**
- `UserListItem.tsx` — Reusable user row with Avatar, name, bio snippet, FollowButton (hidden for self)
- `FollowingView.tsx` — Tabbed view (Following/Followers) with conditional data fetching, empty states
- `ProfileView.tsx` — Profile header with banner, avatar, bio edit (own profile), FollowButton (other), stats row, user posts list

**Updated components:**
- `page.tsx` — Added `profileUserId`, `followingTab` state; extended `renderCenterContent` with "profile" and "following" cases; added `handleUserClick`, updated `handleViewChange`/`handleMobileViewChange`
- `PostHeader.tsx` — Added `onUserClick` prop; wrapped avatar and username in clickable buttons
- `PostCard.tsx` — Added `onUserClick` prop, passes through to PostHeader
- `CommunityFeed.tsx` — Added `onUserClick` prop, passes through to PostCard

### Architecture Documentation

- `c4-component-backend.md` — Added GetFollowing/GetFollowers to `community_svc` and `follow_repo` descriptions
- `c4-component-frontend.md` — Added ProfileView, FollowingView, UserListItem to `community_feat`; added new hooks to gen_hooks relationship
- `flow-community.md` — Added "View User Profile" and "Get Following/Followers List" sequence diagrams

## Build Verification

| Check | Result |
|-------|--------|
| `go build ./domain/... ./handlers/... ./internal/... ./protobuf/...` | Pass (no errors) |
| `npx tsc --noEmit` (community files only) | Pass (no errors) |
| Pre-existing TS errors in test files | Not related to this change |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Authentication | JWT required for all endpoints | Yes — uses `handler.GetUserID(c)` |
| Authorization | User ID from JWT context, never from request body | Yes |
| Input validation | Pagination params parsed server-side with defaults | Yes |
| Data exposure | Bio snippet truncated to 60 chars; only public profile data returned | Yes |
| N+1 prevention | Batch follow-status check via `GetFollowedAuthorIDs` | Yes |

## How to Test

1. Navigate to Community page
2. Click your profile icon in the left sidebar → should see your profile with bio, stats, posts
3. Click "Đang theo dõi" count → should see Following tab with user list
4. Click "Người theo dõi" count → should see Followers tab with user list
5. Click any user avatar/name in the feed → should navigate to their profile
6. On another user's profile, click back arrow → returns to feed
7. On your own profile, click pencil icon to edit bio → save/cancel works
8. Mobile: use bottom sub-nav tabs to switch between Feed, Saved, Profile, Notifications
