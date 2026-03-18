# Admin User & Feedback Management Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add Users and Feedback management tabs to the existing admin page, with backend APIs for listing/searching users, toggling admin roles, and managing feedback (list, update status, add notes, soft-delete).

**Spec:** `docs/specs/2026-03-18-admin-user-feedback-management-spec.md`

**Architecture:** Extends existing admin handler pattern with two new handler structs (`AdminUserHandler`, `AdminFeedbackHandler`). Extends `FeedbackRepository` and `UserRepository` interfaces with admin-specific methods. Adds a new `AdminService` to encapsulate admin business logic. Frontend adds tabbed layout to existing admin page with two new feature components.

**Tech Stack:** Go/Gin (backend), PostgreSQL/GORM (DB), Protocol Buffers (API contracts), Next.js/React/TypeScript (frontend), Tailwind CSS (styling)

## Security Implementation Notes

- **Authentication:** All endpoints behind `AuthMiddleware` + `AdminMiddleware` (existing)
- **Authorization:** Self-protection on role toggle — `targetUserID != requestingUserID`
- **Input validation:** Server-side: search max 100 chars, pageSize max 50, adminNote max 2000 chars, status 1-3, LIKE wildcards escaped
- **Data sanitization:** Admin note stripped of HTML tags using existing `htmlTagRegex` pattern from `site_settings_service.go`
- **Error messages:** Use `handler.HandleError` — no internal details leaked

---

### Task 1: Extend Protobuf Definitions

**Files:**
- Modify: `api/protobuf/v1/admin.proto`

**Security notes:** None — schema definition only.

**Step 1:** Add admin user management and admin feedback management messages to `admin.proto`. Import `common.proto` for pagination and `feedback.proto` for `FeedbackStatus`.

Add these messages after the existing `UpdateSiteSettingsResponse`:

```protobuf
import "protobuf/v1/common.proto";
import "protobuf/v1/feedback.proto";

// --- Admin User Management ---

message AdminUserItem {
  int32 id = 1 [json_name = "id"];
  string name = 2 [json_name = "name"];
  string email = 3 [json_name = "email"];
  string username = 4 [json_name = "username"];
  string picture = 5 [json_name = "picture"];
  string authProvider = 6 [json_name = "authProvider"];
  bool isAdmin = 7 [json_name = "isAdmin"];
  int64 createdAt = 8 [json_name = "createdAt"];
}

message AdminListUsersRequest {
  wealthjourney.common.v1.PaginationParams pagination = 1 [json_name = "pagination"];
  string search = 2 [json_name = "search"];
}

message AdminListUsersResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated AdminUserItem users = 3 [json_name = "users"];
  wealthjourney.common.v1.PaginationResult pagination = 4 [json_name = "pagination"];
  string timestamp = 5 [json_name = "timestamp"];
}

message AdminToggleRoleRequest {
  int32 userId = 1 [json_name = "userId"];
  bool isAdmin = 2 [json_name = "isAdmin"];
}

message AdminToggleRoleResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  AdminUserItem user = 3 [json_name = "user"];
  string timestamp = 4 [json_name = "timestamp"];
}

// --- Admin Feedback Management ---

message AdminFeedbackItem {
  int32 id = 1 [json_name = "id"];
  int32 userId = 2 [json_name = "userId"];
  string userName = 3 [json_name = "userName"];
  string userEmail = 4 [json_name = "userEmail"];
  string subject = 5 [json_name = "subject"];
  string message = 6 [json_name = "message"];
  wealthjourney.feedback.v1.FeedbackStatus status = 7 [json_name = "status"];
  string adminNote = 8 [json_name = "adminNote"];
  int64 createdAt = 9 [json_name = "createdAt"];
  int64 updatedAt = 10 [json_name = "updatedAt"];
}

message AdminListFeedbackRequest {
  wealthjourney.common.v1.PaginationParams pagination = 1 [json_name = "pagination"];
  int32 status = 2 [json_name = "status"];
}

message AdminListFeedbackResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated AdminFeedbackItem feedback = 3 [json_name = "feedback"];
  wealthjourney.common.v1.PaginationResult pagination = 4 [json_name = "pagination"];
  string timestamp = 5 [json_name = "timestamp"];
}

message AdminUpdateFeedbackRequest {
  int32 feedbackId = 1 [json_name = "feedbackId"];
  int32 status = 2 [json_name = "status"];
  string adminNote = 3 [json_name = "adminNote"];
}

message AdminUpdateFeedbackResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  AdminFeedbackItem feedback = 3 [json_name = "feedback"];
  string timestamp = 4 [json_name = "timestamp"];
}

message AdminDeleteFeedbackRequest {
  int32 feedbackId = 1 [json_name = "feedbackId"];
}

message AdminDeleteFeedbackResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  string timestamp = 3 [json_name = "timestamp"];
}
```

Also add RPCs to `AdminService`:

```protobuf
  rpc AdminListUsers(AdminListUsersRequest) returns (AdminListUsersResponse) {
    option (google.api.http) = {
      get: "/api/v1/admin/users"
    };
  }

  rpc AdminToggleRole(AdminToggleRoleRequest) returns (AdminToggleRoleResponse) {
    option (google.api.http) = {
      put: "/api/v1/admin/users/{userId}/role"
      body: "*"
    };
  }

  rpc AdminListFeedback(AdminListFeedbackRequest) returns (AdminListFeedbackResponse) {
    option (google.api.http) = {
      get: "/api/v1/admin/feedback"
    };
  }

  rpc AdminUpdateFeedback(AdminUpdateFeedbackRequest) returns (AdminUpdateFeedbackResponse) {
    option (google.api.http) = {
      put: "/api/v1/admin/feedback/{feedbackId}"
      body: "*"
    };
  }

  rpc AdminDeleteFeedback(AdminDeleteFeedbackRequest) returns (AdminDeleteFeedbackResponse) {
    option (google.api.http) = {
      delete: "/api/v1/admin/feedback/{feedbackId}"
    };
  }
```

**Step 2:** Run `task proto:all` to generate Go and TypeScript types.

**Step 3:** Verify generated code compiles: `cd src/go-backend && go build ./...`

**Step 4:** Commit.

---

### Task 2: Add `admin_note` Column to Feedback Model + Migration

**Files:**
- Modify: `src/go-backend/domain/models/feedback.go`
- Create: `src/go-backend/cmd/migrate-feedback-admin-note/main.go`

**Security notes:** `AdminNote` is a text field — must be HTML-stripped before storage (handled in service layer, Task 4).

**Step 1:** Add `AdminNote` field to `Feedback` model in `models/feedback.go`:

```go
AdminNote string `gorm:"type:text" json:"adminNote"`
```

Add after the `Status` field.

**Step 2:** Create migration file `cmd/migrate-feedback-admin-note/main.go` following existing migration patterns (e.g., `cmd/migrate-sessions/main.go`). The migration should `AutoMigrate(&models.Feedback{})` to add the new column.

**Step 3:** Add task to `Taskfile.yml`:

```yaml
backend:migrate-feedback-admin-note:
  desc: "Add admin_note column to feedback table"
  dir: src/go-backend
  cmd: go run cmd/migrate-feedback-admin-note/main.go
```

**Step 4:** Commit.

---

### Task 3: Extend Repository Interfaces and Implementations

**Files:**
- Modify: `src/go-backend/domain/repository/interfaces.go` — extend `FeedbackRepository` and `UserRepository`
- Modify: `src/go-backend/domain/repository/feedback_repository.go` — add new methods
- Modify: `src/go-backend/domain/repository/user_repository.go` — add search method

**Security notes:** Use parameterized GORM queries for all user input. Escape LIKE wildcards (`%`, `_`) in search strings.

**Step 1:** Extend `FeedbackRepository` interface in `interfaces.go`:

```go
// FeedbackRepository defines the interface for feedback data operations.
type FeedbackRepository interface {
	Create(ctx context.Context, feedback *models.Feedback) error
	ListByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Feedback, int, error)
	CountRecentByUserID(ctx context.Context, userID int32, since time.Time) (int, error)
	// Admin methods
	GetByID(ctx context.Context, id int32) (*models.Feedback, error)
	ListAll(ctx context.Context, statusFilter int16, opts ListOptions) ([]*models.Feedback, int, error)
	Update(ctx context.Context, feedback *models.Feedback) error
	Delete(ctx context.Context, id int32) error
}
```

**Step 2:** Extend `UserRepository` interface in `interfaces.go`:

```go
// Add to UserRepository interface:
	// ListWithSearch retrieves users with optional search filter on name/email.
	ListWithSearch(ctx context.Context, search string, opts ListOptions) ([]*models.User, int, error)
```

**Step 3:** Implement `GetByID`, `ListAll`, `Update`, `Delete` in `feedback_repository.go`:

- `GetByID` — standard GORM query with `Preload("User")` for user info
- `ListAll` — query all feedback (no user_id filter), optional status filter, `Preload("User")`, paginated
- `Update` — GORM `Save()` on feedback record
- `Delete` — soft delete with `gorm.DeletedAt`

**Step 4:** Implement `ListWithSearch` in `user_repository.go`:

```go
func (r *userRepository) ListWithSearch(ctx context.Context, search string, opts ListOptions) ([]*models.User, int, error) {
	var users []*models.User
	var total int64

	query := r.db.DB.WithContext(ctx).Model(&models.User{})

	if search != "" {
		// Escape LIKE wildcards
		escaped := strings.NewReplacer("%", "\\%", "_", "\\_").Replace(search)
		pattern := "%" + escaped + "%"
		query = query.Where("name ILIKE ? OR email ILIKE ? OR username ILIKE ?", pattern, pattern, pattern)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to count users", err)
	}

	orderClause := r.buildOrderClause(opts)
	if orderClause == "" {
		orderClause = "created_at DESC"
	}
	dataQuery := r.db.DB.WithContext(ctx)
	if search != "" {
		escaped := strings.NewReplacer("%", "\\%", "_", "\\_").Replace(search)
		pattern := "%" + escaped + "%"
		dataQuery = dataQuery.Where("name ILIKE ? OR email ILIKE ? OR username ILIKE ?", pattern, pattern, pattern)
	}
	dataQuery = dataQuery.Order(orderClause)
	dataQuery = r.applyPagination(dataQuery, opts)

	if err := dataQuery.Find(&users).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to list users", err)
	}

	return users, int(total), nil
}
```

**Step 5:** Verify compilation: `cd src/go-backend && go build ./...`

**Step 6:** Commit.

---

### Task 4: Create Admin Service

**Files:**
- Create: `src/go-backend/domain/service/admin_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go` — add `AdminService` interface
- Modify: `src/go-backend/domain/service/services.go` — add `AdminService` to `Services` struct

**Security notes:**
- Self-protection: `ToggleAdminRole` must reject if `adminUserID == targetUserID`
- HTML stripping: Use `htmlTagRegex` pattern (from site_settings) on `adminNote`
- Input validation: status 1-3, adminNote max 2000 chars, search max 100 chars

**Step 1:** Add `AdminService` interface to `interfaces.go`:

```go
// AdminService defines admin-only business logic.
type AdminService interface {
	ListUsers(ctx context.Context, search string, params types.PaginationParams) (*v1.AdminListUsersResponse, error)
	ToggleAdminRole(ctx context.Context, adminUserID int32, req *v1.AdminToggleRoleRequest) (*v1.AdminToggleRoleResponse, error)
	ListFeedback(ctx context.Context, statusFilter int32, params types.PaginationParams) (*v1.AdminListFeedbackResponse, error)
	UpdateFeedback(ctx context.Context, feedbackID int32, req *v1.AdminUpdateFeedbackRequest) (*v1.AdminUpdateFeedbackResponse, error)
	DeleteFeedback(ctx context.Context, feedbackID int32) (*v1.AdminDeleteFeedbackResponse, error)
}
```

**Step 2:** Create `admin_service.go`:

```go
package service

import (
	"context"
	"regexp"
	"strings"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/types"
	"wealthjourney/pkg/validator"
	v1 "wealthjourney/protobuf/v1"
)

var adminHTMLTagRegex = regexp.MustCompile("<[^>]*>")

type adminService struct {
	userRepo     repository.UserRepository
	feedbackRepo repository.FeedbackRepository
}

func NewAdminService(userRepo repository.UserRepository, feedbackRepo repository.FeedbackRepository) AdminService {
	return &adminService{
		userRepo:     userRepo,
		feedbackRepo: feedbackRepo,
	}
}
```

Key method implementations:

- **ListUsers:** Validate `search` (max 100 chars, trimmed), call `userRepo.ListWithSearch`, map to `AdminUserItem` proto.
- **ToggleAdminRole:** Validate `req.UserId`, check `adminUserID != req.UserId` (403 self-protection), get user by ID (404 if not found), toggle `IsAdmin`, save, return updated user.
- **ListFeedback:** Validate `statusFilter` (0-3), call `feedbackRepo.ListAll` with status filter, map to `AdminFeedbackItem` proto (include user name/email from preloaded User).
- **UpdateFeedback:** Validate `feedbackID`, validate `status` (1-3), validate `adminNote` (max 2000 chars), strip HTML from `adminNote`, get feedback by ID (404), update fields, save, return updated item.
- **DeleteFeedback:** Validate `feedbackID`, get by ID (404), call `feedbackRepo.Delete`, return success.

**Step 3:** Add `AdminService` to `Services` struct in `services.go`:

```go
Admin AdminService
```

And in `NewServices`:

```go
Admin: NewAdminService(repos.User, repos.Feedback),
```

**Step 4:** Verify compilation.

**Step 5:** Commit.

---

### Task 5: Create Admin Handlers

**Files:**
- Create: `src/go-backend/handlers/admin_user.go`
- Create: `src/go-backend/handlers/admin_feedback.go`
- Modify: `src/go-backend/handlers/builder.go` — add to `AllHandlers`
- Modify: `src/go-backend/handlers/routes.go` — register admin routes

**Security notes:** All handlers extract `user_id` from context (set by `AuthMiddleware`). Routes are under admin group (already gated by `AdminMiddleware`).

**Step 1:** Create `admin_user.go`:

```go
package handlers

import (
	"github.com/gin-gonic/gin"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
	v1 "wealthjourney/protobuf/v1"
)

type AdminUserHandler struct {
	adminService service.AdminService
}

func NewAdminUserHandler(adminService service.AdminService) *AdminUserHandler {
	return &AdminUserHandler{adminService: adminService}
}

func (h *AdminUserHandler) ListUsers(c *gin.Context) {
	search := c.Query("search")
	params := parsePaginationParams(c)

	result, err := h.adminService.ListUsers(c.Request.Context(), search, params)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

func (h *AdminUserHandler) ToggleRole(c *gin.Context) {
	adminUserID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req v1.AdminToggleRoleRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Parse target user ID from URL param
	targetUserID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}
	req.UserId = targetUserID

	result, err := h.adminService.ToggleAdminRole(c.Request.Context(), adminUserID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}
```

**Step 2:** Create `admin_feedback.go`:

```go
package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
	v1 "wealthjourney/protobuf/v1"
)

type AdminFeedbackHandler struct {
	adminService service.AdminService
}

func NewAdminFeedbackHandler(adminService service.AdminService) *AdminFeedbackHandler {
	return &AdminFeedbackHandler{adminService: adminService}
}

func (h *AdminFeedbackHandler) ListFeedback(c *gin.Context) {
	statusFilter := int32(0)
	if s := c.Query("status"); s != "" {
		if v, err := strconv.ParseInt(s, 10, 32); err == nil {
			statusFilter = int32(v)
		}
	}

	params := parsePaginationParams(c)

	result, err := h.adminService.ListFeedback(c.Request.Context(), statusFilter, params)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

func (h *AdminFeedbackHandler) UpdateFeedback(c *gin.Context) {
	feedbackID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	var req v1.AdminUpdateFeedbackRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}
	req.FeedbackId = feedbackID

	result, err := h.adminService.UpdateFeedback(c.Request.Context(), feedbackID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

func (h *AdminFeedbackHandler) DeleteFeedback(c *gin.Context) {
	feedbackID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.adminService.DeleteFeedback(c.Request.Context(), feedbackID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}
```

**Step 3:** Add to `AllHandlers` in `builder.go`:

```go
AdminUser     *AdminUserHandler
AdminFeedback *AdminFeedbackHandler
```

And in `NewHandlers`:

```go
AdminUser:     NewAdminUserHandler(services.Admin),
AdminFeedback: NewAdminFeedbackHandler(services.Admin),
```

**Step 4:** Register routes in `routes.go` inside the existing `admin` group:

```go
// Admin user management
if h.AdminUser != nil {
	admin.GET("/users", h.AdminUser.ListUsers)
	admin.PUT("/users/:id/role", h.AdminUser.ToggleRole)
}

// Admin feedback management
if h.AdminFeedback != nil {
	admin.GET("/feedback", h.AdminFeedback.ListFeedback)
	admin.PUT("/feedback/:id", h.AdminFeedback.UpdateFeedback)
	admin.DELETE("/feedback/:id", h.AdminFeedback.DeleteFeedback)
}
```

**Step 5:** Check for existing `parseIDParam` utility — if not present, add a simple helper.

**Step 6:** Verify compilation.

**Step 7:** Commit.

---

### Task 6: Frontend — Refactor Admin Page to Tabbed Layout

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/admin/page.tsx`

**Security notes:** None — UI restructuring only. Existing `AdminGuard` continues to protect the page.

**Step 0: Component inventory check**
- Reusing: `AdminGuard`, `BaseCard`, all existing form components from current page
- Creating new: Inline tab navigation (simple `div` with buttons, not a separate component)

**Step 1:** Refactor `AdminCMSPage` to add tab navigation with URL query param state:

```typescript
"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { AdminGuard } from "@/features/admin/components/AdminGuard";
// ... existing imports for AdminCMSContent (SEO form)

type AdminTab = "seo" | "users" | "feedback";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "seo", label: "SEO" },
  { id: "users", label: "Users" },
  { id: "feedback", label: "Feedback" },
];

export default function AdminCMSPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get("tab") as AdminTab) || "seo";

  const handleTabChange = (tab: AdminTab) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <AdminGuard>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold ...">Content Management</h1>
          <p className="text-sm ...">Manage admin settings and user data</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-neutral-200 dark:border-dark-border mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-bg text-bg"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "seo" && <AdminCMSContent />}
        {activeTab === "users" && <AdminUsersTab />}
        {activeTab === "feedback" && <AdminFeedbackTab />}
      </div>
    </AdminGuard>
  );
}
```

The existing `AdminCMSContent` function stays in the same file as-is.

Placeholder components for `AdminUsersTab` and `AdminFeedbackTab` that render "Coming soon" text.

**Step 2:** Verify the page renders correctly with tab switching.

**Step 3:** Commit.

---

### Task 7: Frontend — Admin Users Tab Component

**Files:**
- Create: `src/wj-client/features/admin/components/AdminUsersTab.tsx`
- Create: `src/wj-client/features/admin/components/Pagination.tsx`

**Security notes:** No sensitive operations on frontend — all auth/authorization is backend-enforced. Display only.

**Step 0: Component inventory check**
- Reusing: `MobileTable`, `FormInput` (search), `ConfirmationDialog`, `LoadingSpinner`, `useNotification`
- Creating new: `Pagination` (reusable for both tabs), `AdminUsersTab`

**Step 1:** Create `Pagination.tsx` — a simple page navigation component:

```typescript
interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
```

Renders: `< Prev | page X of Y | Next >` with disabled states.

**Step 2:** Create `AdminUsersTab.tsx`:

Features:
- Search input with debounce (300ms) using `useState` + `useEffect` with timeout
- `MobileTable` displaying: Name, Email/Username, Auth Provider, Admin badge, Created date
- Admin toggle per row — button that opens `ConfirmationDialog`
- Self-protection: disable toggle for current user (compare `user.id` with auth state's user ID)
- `Pagination` component at bottom
- Loading state with `LoadingSpinner`
- Toast notifications on success/error
- Uses `apiClient.get`/`apiClient.put` for API calls (manual React Query since no generated hooks yet)

```typescript
// API calls
const fetchUsers = async (page: number, search: string) => {
  const params = new URLSearchParams({ page: String(page), page_size: "10" });
  if (search) params.set("search", search);
  return apiClient.get<AdminListUsersResponse>(`/api/v1/admin/users?${params}`);
};

const toggleRole = async (userId: number, isAdmin: boolean) => {
  return apiClient.put(`/api/v1/admin/users/${userId}/role`, { isAdmin });
};
```

Column definitions for `MobileTable`:
- `name` (showInCollapsed: true) — display name
- `email` (showInCollapsed: true) — email or username
- `authProvider` (showInCollapsed: false)
- `isAdmin` (showInCollapsed: true) — render as toggle button, disabled for self
- `createdAt` (showInCollapsed: false) — formatted date

**Step 3:** Import and render `AdminUsersTab` in `page.tsx` (replacing placeholder).

**Step 4:** Commit.

---

### Task 8: Frontend — Admin Feedback Tab Component

**Files:**
- Create: `src/wj-client/features/admin/components/AdminFeedbackTab.tsx`

**Security notes:** No sensitive operations on frontend — all auth/authorization is backend-enforced.

**Step 0: Component inventory check**
- Reusing: `MobileTable`, `Select` (status filter), `ConfirmationDialog`, `LoadingSpinner`, `Pagination` (from Task 7), `useNotification`
- Creating new: `AdminFeedbackTab` only

**Step 1:** Create `AdminFeedbackTab.tsx`:

Features:
- Status filter dropdown using `Select` component: All / Pending / Reviewed / Resolved
- `MobileTable` with expandable rows displaying: ID, User Name, Subject, Status badge, Created date
- Expanded row shows: full message, admin note textarea, status dropdown, Save button, Delete button
- Status badges: Pending (yellow), Reviewed (blue), Resolved (green)
- `ConfirmationDialog` for delete with danger variant
- `Pagination` component
- Loading state
- Toast notifications

```typescript
// API calls
const fetchFeedback = async (page: number, status: number) => {
  const params = new URLSearchParams({ page: String(page), page_size: "10" });
  if (status > 0) params.set("status", String(status));
  return apiClient.get<AdminListFeedbackResponse>(`/api/v1/admin/feedback?${params}`);
};

const updateFeedback = async (id: number, status: number, adminNote: string) => {
  return apiClient.put(`/api/v1/admin/feedback/${id}`, { status, adminNote });
};

const deleteFeedback = async (id: number) => {
  return apiClient.delete(`/api/v1/admin/feedback/${id}`);
};
```

Column definitions for `MobileTable`:
- `id` (showInCollapsed: true) — feedback ID
- `userName` (showInCollapsed: true) — user who submitted
- `subject` (showInCollapsed: true) — feedback subject
- `status` (showInCollapsed: true) — render as colored badge
- `createdAt` (showInCollapsed: false) — formatted date

Expanded view renders:
- Full message text
- Admin note textarea (inline, not FormTextarea since not in a form context)
- Status dropdown (inline Select)
- Save and Delete action buttons

**Step 2:** Import and render `AdminFeedbackTab` in `page.tsx` (replacing placeholder).

**Step 3:** Commit.

---

### Task 9: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md` — add AdminUserHandler, AdminFeedbackHandler, AdminService to L3 backend diagram
- Modify: `docs/architecture/c4-component-frontend.md` — add admin feature components to L3 frontend diagram

**Steps:**
1. Add `AdminUserHandler` and `AdminFeedbackHandler` to the Handlers section in backend L3 diagram
2. Add `AdminService` to the Services section
3. Add `AdminUsersTab`, `AdminFeedbackTab`, `Pagination` to the admin feature module in frontend L3 diagram
4. Commit.

---

### Task 10: Integration Testing & Verification

**Files:**
- No new files — manual verification

**Steps:**
1. Run `task proto:all` — verify protobuf generation succeeds
2. Run `cd src/go-backend && go build ./...` — verify Go compilation
3. Run `cd src/wj-client && npm run build` — verify frontend compilation
4. Test admin API endpoints manually (or with curl):
   - `GET /api/v1/admin/users?page=1&page_size=10`
   - `GET /api/v1/admin/users?search=test`
   - `PUT /api/v1/admin/users/1/role` with `{"isAdmin": true}`
   - `GET /api/v1/admin/feedback?page=1&page_size=10`
   - `GET /api/v1/admin/feedback?status=1`
   - `PUT /api/v1/admin/feedback/1` with `{"status": 2, "adminNote": "Looking into it"}`
   - `DELETE /api/v1/admin/feedback/1`
5. Verify self-protection: toggling own admin role returns 403
6. Verify HTML stripping: admin note with `<script>alert('xss')</script>` is stripped
7. Verify LIKE injection: search with `%` returns no SQL error
8. Commit final verification notes.

---

## Task Summary

| # | Task | Files Created | Files Modified | Dependencies |
|---|------|--------------|---------------|--------------|
| 1 | Extend Protobuf | — | `admin.proto` | None |
| 2 | Feedback model + migration | `cmd/migrate-feedback-admin-note/main.go` | `models/feedback.go`, `Taskfile.yml` | None |
| 3 | Repository extensions | — | `repository/interfaces.go`, `feedback_repository.go`, `user_repository.go` | Task 2 |
| 4 | Admin service | `service/admin_service.go` | `service/interfaces.go`, `service/services.go` | Tasks 1, 3 |
| 5 | Admin handlers + routes | `handlers/admin_user.go`, `handlers/admin_feedback.go` | `handlers/builder.go`, `handlers/routes.go` | Task 4 |
| 6 | Frontend tab layout | — | `app/[locale]/dashboard/admin/page.tsx` | None |
| 7 | Users tab component | `features/admin/components/AdminUsersTab.tsx`, `features/admin/components/Pagination.tsx` | `app/[locale]/dashboard/admin/page.tsx` | Tasks 5, 6 |
| 8 | Feedback tab component | `features/admin/components/AdminFeedbackTab.tsx` | `app/[locale]/dashboard/admin/page.tsx` | Tasks 5, 6, 7 |
| 9 | C4 diagrams | — | `docs/architecture/c4-component-backend.md`, `c4-component-frontend.md` | Tasks 5, 8 |
| 10 | Integration verification | — | — | All |

**Parallel execution:** Tasks 1 and 2 can run in parallel. Tasks 6 can run in parallel with 3-5. Tasks 7 and 8 depend on both 5 and 6.
