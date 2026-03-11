# Community Profile & Following Screens — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add Profile view and Following/Followers view to the community page so users can see profiles and manage their follow relationships.

**Spec:** `docs/specs/2026-03-11-community-profile-following-spec.md`

**Architecture:** Extends existing community feature — adds 2 new proto RPCs (`GetFollowing`, `GetFollowers`), 2 new repository methods, 2 new service methods, 2 new handlers, and 4 new frontend components (`ProfileView`, `FollowingView`, `FollowListView`, `UserListItem`). No new database tables.

**Tech Stack:** Proto → Go (handler/service/repo) → TypeScript/React (components/hooks)

## Security Implementation Notes

- Authentication: JWT middleware already covers all `/api/v1/community/` routes
- Authorization: Follow lists are public social data; `isFollowing` computed per requesting user
- Input validation: `userId` parsed as int32 in handler; pagination validated with defaults
- Data exposure: Only public fields (name, picture, bio snippet) returned — same as `GetSuggestedUsers`

---

### Task 1: Extend Protobuf with GetFollowing and GetFollowers RPCs

**Files:**
- Modify: `api/protobuf/v1/community.proto`

**Steps:**

1. Add `FollowUserItem` message after `SuggestedUserItem` (line ~368):
```protobuf
// FollowUserItem represents a user in a following/followers list
message FollowUserItem {
  int32 userId = 1 [json_name = "userId"];
  string userName = 2 [json_name = "userName"];
  string userPicture = 3 [json_name = "userPicture"];
  string bioSnippet = 4 [json_name = "bioSnippet"];
  bool isFollowing = 5 [json_name = "isFollowing"];
}
```

2. Add request/response messages for GetFollowing:
```protobuf
message GetFollowingRequest {
  int32 userId = 1 [json_name = "userId"];
  wealthjourney.common.v1.PaginationParams pagination = 2 [json_name = "pagination"];
}

message GetFollowingResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated FollowUserItem users = 3 [json_name = "users"];
  wealthjourney.common.v1.PaginationResult pagination = 4 [json_name = "pagination"];
  string timestamp = 5 [json_name = "timestamp"];
}
```

3. Add request/response messages for GetFollowers:
```protobuf
message GetFollowersRequest {
  int32 userId = 1 [json_name = "userId"];
  wealthjourney.common.v1.PaginationParams pagination = 2 [json_name = "pagination"];
}

message GetFollowersResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated FollowUserItem users = 3 [json_name = "users"];
  wealthjourney.common.v1.PaginationResult pagination = 4 [json_name = "pagination"];
  string timestamp = 5 [json_name = "timestamp"];
}
```

4. Add RPCs to `CommunityService`:
```protobuf
rpc GetFollowing(GetFollowingRequest) returns (GetFollowingResponse) {
  option (google.api.http) = {
    get: "/api/v1/community/users/{userId}/following"
  };
}

rpc GetFollowers(GetFollowersRequest) returns (GetFollowersResponse) {
  option (google.api.http) = {
    get: "/api/v1/community/users/{userId}/followers"
  };
}
```

5. Run `task proto:all` to generate Go + TypeScript code

6. Verify: `cd src/go-backend && go build ./...`

7. Commit: `feat(community): add GetFollowing and GetFollowers proto RPCs`

---

### Task 2: Add Repository Methods for Paginated Following/Followers

**Files:**
- Modify: `src/go-backend/domain/repository/interfaces.go` (add to `FollowRepository`)
- Modify: `src/go-backend/domain/repository/follow_repository.go` (implement)

**Steps:**

1. Add to `FollowRepository` interface in `interfaces.go`:
```go
// GetFollowing returns paginated list of users that userID follows, with their User data.
GetFollowing(ctx context.Context, userID int32, opts ListOptions) ([]*models.UserFollow, int, error)
// GetFollowers returns paginated list of users that follow userID, with their User data.
GetFollowers(ctx context.Context, userID int32, opts ListOptions) ([]*models.UserFollow, int, error)
```

2. Implement `GetFollowing` in `follow_repository.go`:
   - Query `user_follow` WHERE `follower_id = userID`
   - Preload `Following` (User relationship) for user data
   - Apply pagination (offset, limit)
   - Count total for pagination result
   - Order by `created_at DESC` (most recent follows first)

3. Implement `GetFollowers` in `follow_repository.go`:
   - Query `user_follow` WHERE `following_id = userID`
   - Preload `Follower` (User relationship) for user data
   - Apply pagination (offset, limit)
   - Count total for pagination result
   - Order by `created_at DESC`

4. Verify the `UserFollow` model has proper relationships — check `models/user_follow.go` or wherever the model is defined. Ensure it has:
   - `Follower *User` with `foreignKey:FollowerID`
   - `Following *User` with `foreignKey:FollowingID`

5. Verify: `go build ./...`

6. Commit: `feat(community): add GetFollowing/GetFollowers repository methods`

---

### Task 3: Add Service Methods for GetFollowing and GetFollowers

**Files:**
- Modify: `src/go-backend/domain/service/interfaces.go` (add to `CommunityService`)
- Modify: `src/go-backend/domain/service/community_service.go` (implement)

**Steps:**

1. Add to `CommunityService` interface:
```go
GetFollowing(ctx context.Context, userID int32, targetUserID int32, req *v1.GetFollowingRequest) (*v1.GetFollowingResponse, error)
GetFollowers(ctx context.Context, userID int32, targetUserID int32, req *v1.GetFollowersRequest) (*v1.GetFollowersResponse, error)
```

2. Implement `GetFollowing` following the `GetSuggestedUsers` pattern:
   - Parse pagination from request (default page=1, pageSize=20)
   - Call `followRepo.GetFollowing(ctx, targetUserID, opts)`
   - For each follow record, build `FollowUserItem` with user data from preloaded relationship
   - Batch check `isFollowing` for each user in the list (call `followRepo.GetFollowedAuthorIDs` with the user IDs)
   - Build pagination result
   - Return response

3. Implement `GetFollowers` with same pattern but using `followRepo.GetFollowers`

4. Verify: `go build ./...`

5. Commit: `feat(community): add GetFollowing/GetFollowers service methods`

---

### Task 4: Add Handlers and Routes for GetFollowing and GetFollowers

**Files:**
- Modify: `src/go-backend/handlers/community.go` (add handler methods)
- Modify: `src/go-backend/handlers/routes.go` (add routes)

**Steps:**

1. Add `GetFollowing` handler method following `GetUserPosts` pattern:
   - `handler.GetUserID(c)` for auth
   - `c.Param("user_id")` for target user
   - Parse pagination from query params
   - Call `h.communityService.GetFollowing(ctx, userID, targetUserID, req)`
   - `handler.Success(c, result)`

2. Add `GetFollowers` handler method with same pattern

3. Add routes in `routes.go` under the existing community user routes:
```go
community.GET("/users/:user_id/following", h.Community.GetFollowing)
community.GET("/users/:user_id/followers", h.Community.GetFollowers)
```

4. Verify: `go build ./...`

5. Commit: `feat(community): add GetFollowing/GetFollowers handlers and routes`

---

### Task 5: Create Frontend UserListItem Component

**Files:**
- Create: `src/wj-client/features/community/components/UserListItem.tsx`

**Steps:**

1. Create `UserListItem` component:
   - Props: `user: { userId, userName, userPicture, bioSnippet, isFollowing }`, `currentUserId: number`, `onUserClick: (userId: number) => void`
   - Renders: Avatar (md size), user name, bio snippet, FollowButton
   - Row is clickable → calls `onUserClick(user.userId)`
   - Hide FollowButton when `user.userId === currentUserId` (don't follow yourself)
   - Style: matches existing `SuggestedUserCard` pattern with `bg-white` card, `border-b border-[#EDE8E1]`

2. Commit: `feat(community): add UserListItem component for follow lists`

---

### Task 6: Create Frontend FollowingView Component

**Files:**
- Create: `src/wj-client/features/community/components/FollowingView.tsx`

**Steps:**

1. Create `FollowingView` component:
   - Props: `currentUser: { id, name, picture }`, `onUserClick: (userId: number) => void`, `initialTab?: "following" | "followers"`
   - Two tabs: "Đang theo dõi" (Following) and "Người theo dõi" (Followers)
   - Active tab state with styled tab buttons (matching community v2 styling)
   - Each tab renders a list of `UserListItem` components
   - Uses `useQueryGetFollowing({ userId: currentUser.id, pagination })` for following tab
   - Uses `useQueryGetFollowers({ userId: currentUser.id, pagination })` for followers tab
   - Shows `LoadingSpinner` while loading
   - Shows empty state (Users icon + "Chưa theo dõi ai" / "Chưa có người theo dõi") when list is empty
   - Pagination: load more on scroll or "Xem thêm" button

2. Commit: `feat(community): add FollowingView component with tabs`

---

### Task 7: Create Frontend ProfileView Component

**Files:**
- Create: `src/wj-client/features/community/components/ProfileView.tsx`

**Steps:**

1. Create `ProfileView` component:
   - Props: `targetUserId: number`, `currentUser: { id, name, picture }`, `onBack?: () => void`, `onUserClick: (userId: number) => void`, `onHashtagClick: (tag: string) => void`, `onFollowingClick?: (tab: "following" | "followers") => void`
   - **Profile header section:**
     - Uses `useQueryGetCommunityProfile({ userId: targetUserId })`
     - Large Avatar, user name, bio
     - If `isOwnProfile`: inline bio edit (reuse `ProfileCard` edit pattern — useState for editing, `useMutationUpdateBio`)
     - If not own profile: `FollowButton` + back button
     - Stats row: post count, following count (clickable → `onFollowingClick("following")`), follower count (clickable → `onFollowingClick("followers")`)
   - **Posts section:**
     - Uses `useQueryGetUserPosts({ userId: targetUserId, pagination })`
     - Renders `PostCard` for each post (reuse existing)
     - Empty state when no posts: "Chưa có bài viết nào"
   - Back button at top when `onBack` is provided (viewing other user)

2. Commit: `feat(community): add ProfileView component`

---

### Task 8: Wire Views into Community Page Router

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/community/page.tsx`

**Steps:**

1. Import new components: `ProfileView`, `FollowingView`

2. Add state for profile navigation:
```typescript
const [profileUserId, setProfileUserId] = useState<number | null>(null);
const [followingTab, setFollowingTab] = useState<"following" | "followers">("following");
```

3. Create `handleUserClick` callback:
```typescript
const handleUserClick = (userId: number) => {
  setProfileUserId(userId);
  setActiveView("profile");
  setMobileView("profile");
};
```

4. Update `renderCenterContent` to handle "profile" and "following" views:
```typescript
if (view === "profile") {
  const targetId = profileUserId ?? currentUser.id;
  return (
    <ProfileView
      targetUserId={targetId}
      currentUser={currentUser}
      onBack={profileUserId ? () => { setProfileUserId(null); setActiveView("feed"); } : undefined}
      onUserClick={handleUserClick}
      onHashtagClick={handleHashtagClick}
      onFollowingClick={(tab) => { setFollowingTab(tab); setActiveView("following"); setMobileView("feed"); }}
    />
  );
}
if (view === "following") {
  return (
    <FollowingView
      currentUser={currentUser}
      onUserClick={handleUserClick}
      initialTab={followingTab}
    />
  );
}
```

5. When navigating to own profile from sidebar: reset `profileUserId` to null (so it shows own profile)
6. When clicking "Hồ sơ" nav: `setProfileUserId(null)` + `setActiveView("profile")`

7. Pass `onUserClick={handleUserClick}` down to `CommunityFeed` → `PostCard` → `PostHeader` for user name clicks

8. Verify build: `cd src/wj-client && npx tsc --noEmit`

9. Commit: `feat(community): wire ProfileView and FollowingView into community page`

---

### Task 9: Add User Click Navigation to PostHeader and Other Components

**Files:**
- Modify: `src/wj-client/features/community/components/PostHeader.tsx`
- Modify: `src/wj-client/features/community/components/PostCard.tsx`
- Modify: `src/wj-client/features/community/components/CommunityFeed.tsx`

**Steps:**

1. Add `onUserClick?: (userId: number) => void` prop to `PostHeader`
   - Make user name and avatar clickable (wrap in button or make the existing elements clickable)
   - Call `onUserClick(userId)` on click

2. Pass `onUserClick` through `PostCard` → `PostHeader`

3. Pass `onUserClick` through `CommunityFeed` → `PostCard`

4. Verify build

5. Commit: `feat(community): add user click navigation to PostHeader`

---

### Task 10: Update Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`
- Modify: `docs/architecture/flow-community.md`

**Steps:**

1. Update backend C4: Add GetFollowing/GetFollowers to CommunityService and FollowRepository descriptions
2. Update frontend C4: Add ProfileView, FollowingView components to community module
3. Update flow-community.md: Add sequence diagrams for "View User Profile" and "Get Following/Followers"

4. Commit: `docs(community): update architecture diagrams for Profile & Following views`

---

### Task 11: Build Verification and Report

**Steps:**

1. Run `cd src/go-backend && go build ./...` — verify 0 errors
2. Run `cd src/wj-client && npx tsc --noEmit` — verify no new errors
3. Write implementation report to `docs/reports/2026-03-11-community-profile-following-report.md`
4. Update Phase 2 report's Fix History table

5. Commit: `docs(community): add Profile & Following implementation report`
