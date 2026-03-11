# Community Profile & Following Screens — Specification

## Summary

The community navigation defines "Hồ sơ" (Profile) and "Đang theo dõi" (Following) views, but no rendering logic or backend support exists for these screens. This spec adds: (1) a **Profile View** showing a user's profile header + their posts, and (2) a **Following View** showing lists of users the current user follows and users who follow them. Both views are rendered inline within the existing community page view router — no new routes needed.

## User Stories

- As a user, I want to click "Hồ sơ" in the community sidebar so that I can see my profile info and all my posts in one view.
- As a user, I want to click another user's name/avatar in the feed so that I can visit their profile and see their posts.
- As a user, I want to click "Đang theo dõi" so that I can see who I follow and who follows me.
- As a user, I want to follow/unfollow users directly from the following/followers lists.

## Functional Requirements

### FR-1: Profile View (Own Profile)

When the user clicks "Hồ sơ" in the sidebar or mobile nav:

- Display a **profile header** card at the top with:
  - Avatar (large, using existing `Avatar` component)
  - User name
  - Editable bio (same inline edit as `ProfileCard` — reuse the pattern)
  - Stats: post count, follower count, following count
  - Clicking follower/following counts opens the Following view with the appropriate tab
- Display **user's posts** below the header using existing `PostCard` components, paginated

**Acceptance criteria:**
- [x] Profile header renders with correct user data from `GetCommunityProfile`
- [x] Bio editing works with `UpdateBio` mutation (200 char limit)
- [x] Posts list uses `GetUserPosts` with pagination
- [x] All post interactions (like, comment, share, save) work normally
- [x] Hashtag clicks in posts trigger feed filter (switch to feed view with hashtag)

### FR-2: Profile View (Other User)

When the user clicks another user's name/avatar from feed, suggested users, or notification:

- Display the same profile header but:
  - Show `FollowButton` instead of bio edit controls
  - Bio is read-only
- Display the target user's posts below

**Acceptance criteria:**
- [x] Other user's profile renders with correct data
- [x] Follow/unfollow button works and updates counts
- [x] "Back" action returns to previous view
- [x] `isOwnProfile` flag from API correctly toggles edit vs follow mode

### FR-3: Following View (Two Tabs)

When the user clicks "Đang theo dõi" in the sidebar:

- Show two tabs: **"Đang theo dõi" (Following)** and **"Người theo dõi" (Followers)**
- Each tab shows a paginated list of users with:
  - Avatar
  - User name
  - Bio snippet (max 60 chars)
  - Follow/Unfollow button (not shown for self)
  - Clicking the user row navigates to their profile view
- Default tab: "Đang theo dõi" (Following)

**Acceptance criteria:**
- [x] Following tab lists users the current user follows
- [x] Followers tab lists users who follow the current user
- [x] Follow/unfollow actions update UI optimistically
- [x] Empty state shown when list is empty
- [x] Clicking a user navigates to their profile view

### FR-4: Navigation Integration

- Clicking any user name/avatar in the feed (`PostHeader`), notification items, or suggested user cards navigates to that user's profile view
- The profile view has a "back" button to return to the previous view
- Mobile sub-nav "profile" tab shows own profile

**Acceptance criteria:**
- [x] User name click in `PostHeader` triggers profile navigation
- [x] Back button in profile view returns to previous state
- [x] State management tracks view history for back navigation

## Non-Functional Requirements

- **Performance**: Following/followers list pagination with 20 items per page. No N+1 queries.
- **Security**: Users can only see public profiles. All queries scoped via JWT user ID. No private data leaked in follow lists.

## Architecture Changes (C4)

### Diagrams to Update
- `docs/architecture/c4-component-backend.md` — Add `GetFollowing`/`GetFollowers` to CommunityService and FollowRepository descriptions
- `docs/architecture/c4-component-frontend.md` — Add `ProfileView`, `FollowingView`, `FollowListView` components to community module

### New Diagrams
None needed — this extends existing community components, not a new bounded context.

## Runtime Flow Diagrams

### Flow Diagrams to Update
- `docs/architecture/flow-community.md` — Add "View User Profile" and "Get Following/Followers List" sequence diagrams

## Data Model Changes

**No new tables.** The `user_follow` table already stores follow relationships. The `user` table has all profile fields.

## API Changes

### New RPCs (2)

#### `GetFollowing` — List users that a user follows

```protobuf
message FollowUserItem {
  int32 userId = 1;
  string userName = 2;
  string userPicture = 3;
  string bioSnippet = 4;
  bool isFollowing = 5;  // Whether current user follows this person
}

message GetFollowingRequest {
  int32 userId = 1;
  PaginationParams pagination = 2;
}

message GetFollowingResponse {
  bool success = 1;
  string message = 2;
  repeated FollowUserItem users = 3;
  PaginationResult pagination = 4;
  string timestamp = 5;
}
```

Route: `GET /api/v1/community/users/{userId}/following`

#### `GetFollowers` — List users who follow a user

```protobuf
message GetFollowersRequest {
  int32 userId = 1;
  PaginationParams pagination = 2;
}

message GetFollowersResponse {
  bool success = 1;
  string message = 2;
  repeated FollowUserItem users = 3;
  PaginationResult pagination = 4;
  string timestamp = 5;
}
```

Route: `GET /api/v1/community/users/{userId}/followers`

### Existing RPCs Used (No Changes)

- `GetCommunityProfile` — Profile header data
- `GetUserPosts` — User's posts for profile view
- `FollowUser` / `UnfollowUser` — Follow actions in lists
- `UpdateBio` — Bio editing on own profile

## UI/UX Changes

### Profile View Layout

```
┌─────────────────────────────────┐
│  ← Quay lại                    │  (back button, only when viewing other user)
├─────────────────────────────────┤
│  ┌──────┐                      │
│  │Avatar│  User Name            │
│  │ (lg) │  Bio text here...     │
│  └──────┘  [Edit bio] (own)    │
│            [Follow] (other)     │
│                                 │
│  ┌────────┬────────┬────────┐  │
│  │ N bài  │ N theo │ N người│  │
│  │ viết   │ dõi    │ theo   │  │
│  │        │        │ dõi    │  │
│  └────────┴────────┴────────┘  │
├─────────────────────────────────┤
│  [Post Card 1]                  │
│  [Post Card 2]                  │
│  [Post Card 3]                  │
│  ...                            │
└─────────────────────────────────┘
```

### Following View Layout

```
┌─────────────────────────────────┐
│  [Đang theo dõi] [Người theo dõi]  │  (tabs)
├─────────────────────────────────┤
│  ┌────┐ User Name               │
│  │ Av │ Bio snippet...           │
│  └────┘              [Follow]   │
│─────────────────────────────────│
│  ┌────┐ User Name               │
│  │ Av │ Bio snippet...           │
│  └────┘              [Đang theo dõi] │
│─────────────────────────────────│
│  ... more users                 │
└─────────────────────────────────┘
```

### Mobile Considerations
- Profile view and Following view render in the same center column
- Mobile sub-nav "profile" tab shows own profile
- Following view accessible from profile stats clicks
- Back navigation works via state (not browser history)

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | GET /users/{id}/following | Yes: Internet → App | Go Handler | Authenticated via JWT |
| 2 | Browser | GET /users/{id}/followers | Yes: Internet → App | Go Handler | Authenticated via JWT |
| 3 | Go Handler | SQL query | No: App → DB | PostgreSQL | Parameterized via GORM |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Follow list requests | JWT middleware + validation |
| App → DB | GORM queries | Parameterized queries, no raw SQL |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1, 2 | Internet → App | Spoofing | Unauthenticated access to follow lists | Low | JWT middleware already required on all community routes |
| T-2 | 1, 2 | Internet → App | Information Disclosure | Exposing private user data in follow lists | Low | Only return public fields (name, picture, bio snippet) — same as SuggestedUsers |
| T-3 | 3 | App → DB | Tampering | SQL injection via userId param | Low | GORM parameterized queries, userId parsed as int32 |

### Authorization Rules

- Any authenticated user can view any user's following/followers list (public social data)
- `isFollowing` field in `FollowUserItem` is computed relative to the requesting user's JWT
- Bio editing restricted to `isOwnProfile === true`

### Input Validation Rules

- `userId` path param: must be valid int32 > 0
- `pagination.page`: default 1, min 1
- `pagination.pageSize`: default 20, max 50

### Sensitive Data Handling

No sensitive financial data involved. Only public profile fields exposed (name, picture, bio).

### Issues & Risks Summary

1. **N+1 query risk** on follow lists — must batch-fetch user profiles and follow status. Mitigation: use JOIN or batch `GetByIDs`.
2. **Large follow lists** — paginate at 20 per page to keep response size manageable.

## Edge Cases & Error Handling

- User with 0 posts → show empty state in profile view
- User with 0 following/followers → show empty state in respective tab
- Viewing own profile in followers list → don't show follow button for self
- User not found (deleted account) → show error/not found state
- Following/unfollowing from the list updates the count in real-time

## Dependencies & Assumptions

- Existing `GetCommunityProfile`, `GetUserPosts`, `FollowUser`, `UnfollowUser` RPCs work correctly
- `Avatar`, `FollowButton`, `PostCard` components are reusable as-is
- All community routes already have JWT middleware

## Out of Scope

- Search for users by name
- Block/mute users
- Private/public profile toggle
- Mutual followers indicator on follow lists
- Direct messages
