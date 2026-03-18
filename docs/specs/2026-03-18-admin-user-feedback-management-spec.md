# Admin User & Feedback Management Specification

## Summary

Add two new tabs to the existing admin page (`/dashboard/admin`): **Users** for listing/searching users with admin role toggling, and **Feedback** for viewing all user feedback with status updates, admin notes, and soft-deletion. The existing site settings content becomes the first "SEO" tab. All tabs are admin-only, leveraging the existing `AdminGuard` and `AdminMiddleware`.

## User Stories

- As an admin, I want to search and browse all users with pagination, so that I can find specific users quickly.
- As an admin, I want to toggle another user's admin role, so that I can grant or revoke admin access (but not my own).
- As an admin, I want to view all user feedback with pagination, so that I can triage and respond to issues.
- As an admin, I want to update feedback status (pending/reviewed/resolved), add internal notes, and delete spam, so that I can manage feedback effectively.

## Functional Requirements

### FR-1: Admin Page Tab Navigation

**Description:** Convert the existing admin page into a tabbed layout with three tabs: SEO (existing content), Users, Feedback.

**Acceptance criteria:**
- [ ] Admin page shows 3 tabs: SEO | Users | Feedback
- [ ] Tab state preserved via URL query parameter (`?tab=seo|users|feedback`)
- [ ] Default tab is "seo" (preserving existing behavior)
- [ ] Tab switching does not cause full page reload

### FR-2: User Management Tab

**Description:** A paginated, searchable user table with admin role toggle.

**Acceptance criteria:**
- [ ] Table displays: Name, Email/Username, Auth Provider, Admin status, Created date
- [ ] Search input filters users by name or email (server-side search)
- [ ] Pagination with configurable page size (default 10)
- [ ] Admin toggle button per row — toggles `isAdmin` field
- [ ] Self-protection: toggle is disabled for the currently logged-in admin's row
- [ ] Confirmation dialog before toggling admin role ("Are you sure you want to grant/revoke admin for {name}?")
- [ ] Toast notification on success/error
- [ ] Loading state while fetching/toggling

### FR-3: Feedback Management Tab

**Description:** A paginated feedback list with status management, admin notes, and deletion.

**Acceptance criteria:**
- [ ] Table displays: ID, User (name), Subject, Status (badge), Created date
- [ ] Expandable row or detail view shows full message + admin note
- [ ] Status dropdown to change: pending → reviewed → resolved
- [ ] Admin note text field — saved alongside status update
- [ ] Soft-delete button with confirmation dialog for spam removal
- [ ] Pagination with configurable page size (default 10)
- [ ] Filter by status (all/pending/reviewed/resolved)
- [ ] Toast notification on success/error
- [ ] Loading state while fetching/updating

## Non-Functional Requirements

- **Performance:** Paginated queries with server-side search. No client-side filtering of large datasets.
- **Security:** All new endpoints behind `AdminMiddleware`. Self-protection on role toggle. Admin note stripped of HTML tags server-side.

## Data Model Changes

### Modify: `feedback` table

Add `admin_note` column:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `admin_note` | `text` | nullable | Internal admin note/response |

**Model change** in `models/feedback.go`:
```go
AdminNote string `gorm:"type:text" json:"adminNote"`
```

No new tables needed. User model already has `IsAdmin` field.

## API Changes

### New Endpoints (all under `/api/v1/admin/`)

#### 1. `GET /api/v1/admin/users` — List users with search + pagination

**Request query params:**
- `page` (int, default 1)
- `pageSize` (int, default 10, max 50)
- `search` (string, optional — filters by name or email ILIKE)

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "name": "John",
      "email": "john@example.com",
      "username": "john123",
      "picture": "...",
      "authProvider": "google",
      "isAdmin": false,
      "createdAt": 1710000000
    }
  ],
  "pagination": {
    "totalCount": 100,
    "totalPages": 10,
    "page": 1,
    "pageSize": 10
  }
}
```

#### 2. `PUT /api/v1/admin/users/:id/role` — Toggle admin role

**Request body:**
```json
{ "isAdmin": true }
```

**Response:**
```json
{
  "success": true,
  "message": "Admin role updated",
  "user": { "id": 1, "name": "John", "isAdmin": true }
}
```

**Validations:**
- Cannot toggle own role (403)
- Target user must exist (404)

#### 3. `GET /api/v1/admin/feedback` — List all feedback with pagination + status filter

**Request query params:**
- `page` (int, default 1)
- `pageSize` (int, default 10, max 50)
- `status` (int, optional — 1=pending, 2=reviewed, 3=resolved)

**Response:**
```json
{
  "success": true,
  "feedback": [
    {
      "id": 1,
      "userId": 5,
      "userName": "John",
      "userEmail": "john@example.com",
      "subject": "Bug report",
      "message": "Full message text",
      "status": 1,
      "adminNote": "",
      "createdAt": 1710000000,
      "updatedAt": 1710000000
    }
  ],
  "pagination": { ... }
}
```

#### 4. `PUT /api/v1/admin/feedback/:id` — Update feedback status + admin note

**Request body:**
```json
{
  "status": 2,
  "adminNote": "We are looking into this"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback updated",
  "feedback": { ... }
}
```

**Validations:**
- Status must be 1, 2, or 3
- Admin note max 2000 characters
- Admin note stripped of HTML tags

#### 5. `DELETE /api/v1/admin/feedback/:id` — Soft-delete feedback

**Response:**
```json
{
  "success": true,
  "message": "Feedback deleted"
}
```

## Protobuf Changes

Add to `admin.proto`:

```protobuf
// Admin User Management
message AdminUserItem {
  int32 id = 1;
  string name = 2;
  string email = 3;
  string username = 4;
  string picture = 5;
  string authProvider = 6;
  bool isAdmin = 7;
  int64 createdAt = 8;
}

message AdminListUsersRequest {
  wealthjourney.common.v1.PaginationParams pagination = 1;
  string search = 2;
}

message AdminListUsersResponse {
  bool success = 1;
  string message = 2;
  repeated AdminUserItem users = 3;
  wealthjourney.common.v1.PaginationResult pagination = 4;
  string timestamp = 5;
}

message AdminToggleRoleRequest {
  int32 userId = 1;
  bool isAdmin = 2;
}

message AdminToggleRoleResponse {
  bool success = 1;
  string message = 2;
  AdminUserItem user = 3;
  string timestamp = 4;
}

// Admin Feedback Management
message AdminFeedbackItem {
  int32 id = 1;
  int32 userId = 2;
  string userName = 3;
  string userEmail = 4;
  string subject = 5;
  string message = 6;
  FeedbackStatus status = 7;  // reuse from feedback.proto
  string adminNote = 8;
  int64 createdAt = 9;
  int64 updatedAt = 10;
}

message AdminListFeedbackRequest {
  wealthjourney.common.v1.PaginationParams pagination = 1;
  int32 status = 2;  // 0=all, 1=pending, 2=reviewed, 3=resolved
}

message AdminListFeedbackResponse {
  bool success = 1;
  string message = 2;
  repeated AdminFeedbackItem feedback = 3;
  wealthjourney.common.v1.PaginationResult pagination = 4;
  string timestamp = 5;
}

message AdminUpdateFeedbackRequest {
  int32 feedbackId = 1;
  int32 status = 2;
  string adminNote = 3;
}

message AdminUpdateFeedbackResponse {
  bool success = 1;
  string message = 2;
  AdminFeedbackItem feedback = 3;
  string timestamp = 4;
}

message AdminDeleteFeedbackRequest {
  int32 feedbackId = 1;
}

message AdminDeleteFeedbackResponse {
  bool success = 1;
  string message = 2;
  string timestamp = 3;
}
```

## UI/UX Changes

### Tab Layout

The existing admin page content (SEO + Footer) moves under an "SEO" tab. Two new tabs are added.

```
+--------------------------------------------------+
| Content Management                                |
| Manage admin settings and user data               |
|                                                    |
| [SEO] [Users] [Feedback]                          |
| ─────────────────────────────────────────────     |
|                                                    |
|  (Tab content here)                               |
+--------------------------------------------------+
```

### Users Tab

```
+--------------------------------------------------+
| [🔍 Search users...                          ]   |
|                                                    |
| Name        | Email      | Provider | Admin | Date |
| ------------|------------|----------|-------|------|
| John Doe    | john@...   | google   | [✓]   | ... |
| Jane Smith  | jane@...   | password | [ ]   | ... |
| (me) Admin  | admin@...  | google   | [✓] ← | ... |
|                                         disabled   |
|                                                    |
| < 1 2 3 ... 10 >       Showing 1-10 of 100       |
+--------------------------------------------------+
```

### Feedback Tab

```
+--------------------------------------------------+
| Status: [All ▾]                                   |
|                                                    |
| ID | User     | Subject       | Status    | Date  |
| ---|----------|---------------|-----------|-------|
| 1  | John Doe | Bug report    | 🟡 Pending| ...  |
| 2  | Jane     | Feature req   | 🟢 Resolved| ... |
|                                                    |
| ▼ Expanded row:                                   |
| Message: "I found a bug when..."                  |
| Admin Note: [________________________]            |
| Status: [Reviewed ▾]  [Save] [🗑 Delete]         |
|                                                    |
| < 1 2 3 >              Showing 1-10 of 25        |
+--------------------------------------------------+
```

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Tab navigation | NEW — simple tab component (3 tabs: SEO, Users, Feedback) | Inline in admin page |
| User/Feedback table | MobileTable | `components/table/MobileTable` |
| Search input | FormInput | `components/forms/FormInput` |
| Status dropdown | FormSelect or Select | `components/select/Select` |
| Toggle switch | FormToggle | `components/forms/FormToggle` |
| Confirmation dialog | ConfirmationDialog | `components/modals/ConfirmationDialog` |
| Toast notifications | useNotification | `contexts/NotificationContext` |
| Loading spinner | LoadingSpinner | `components/loading/LoadingSpinner` |
| Card wrapper | BaseCard | `components/BaseCard` |
| Pagination | NEW — pagination component | `features/admin/components/Pagination` |
| Admin note textarea | FormTextarea | `components/forms/FormTextarea` |
| Status badge | NEW — small inline badge | Inline styled span |
| Admin guard | AdminGuard | `features/admin/components/AdminGuard` |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| Pagination | `features/admin/components/Pagination.tsx` | MobileTable doesn't include pagination controls; need reusable pagination for both tabs |
| AdminTabs | Inline in page.tsx | Simple 3-tab switcher, no need for separate component |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Admin browser | Search query, page params | Yes: Internet → App | Go backend (admin endpoints) | JWT + AdminMiddleware |
| 2 | Admin browser | Toggle role request (userId, isAdmin) | Yes: Internet → App | Go backend → PostgreSQL | Must verify not self-toggle |
| 3 | Admin browser | Feedback status + admin note | Yes: Internet → App | Go backend → PostgreSQL | Strip HTML from admin note |
| 4 | Admin browser | Delete feedback request | Yes: Internet → App | Go backend → PostgreSQL (soft delete) | Verify feedback exists |
| 5 | Go backend | User list with emails | Yes: App → Internet | Admin browser | PII exposure — admin-only |
| 6 | Go backend | Feedback with user info | Yes: App → Internet | Admin browser | PII — admin-only |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Admin requests | JWT + AuthMiddleware + AdminMiddleware |
| App → Database | Service layer | Parameterized GORM queries |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Non-admin accesses admin endpoints | High | AdminMiddleware checks `is_admin` from JWT |
| T-2 | 2 | Internet → App | Tampering | Admin demotes themselves (breaks access) | Medium | Self-protection check: reject if targetUserID == requestingUserID |
| T-3 | 2 | Internet → App | Elevation | Regular user toggles admin via direct API call | High | AdminMiddleware enforced on route group |
| T-4 | 3 | Internet → App | Tampering | XSS via admin note field | Medium | Strip HTML tags server-side (same as site settings pattern) |
| T-5 | 1 | Internet → App | Tampering | SQL injection via search query | Medium | GORM parameterized queries (ILIKE with `?` placeholder) |
| T-6 | 5,6 | App → Internet | Info Disclosure | User PII (emails) exposed | Low | Admin-only endpoints; no public access. Password hashes excluded via `json:"-"` tag |

### Authorization Rules

- All endpoints require `AuthMiddleware` + `AdminMiddleware`
- Toggle role: admin cannot modify their own `isAdmin` flag
- No super-admin concept — any admin can toggle any other user

### Input Validation Rules

| Field | Validation | Where |
|-------|-----------|-------|
| `search` | Max 100 chars, trimmed | Backend handler |
| `page` | >= 1, default 1 | Backend handler |
| `pageSize` | 1-50, default 10 | Backend handler |
| `status` (feedback filter) | 0-3 | Backend handler |
| `status` (update) | 1-3 | Backend service |
| `adminNote` | Max 2000 chars, HTML stripped | Backend service |
| `userId` (toggle) | Must exist, must not be self | Backend service |

### Issues & Risks Summary

1. **PII exposure** — User emails visible to all admins. Acceptable since admin access is gated.
2. **No audit trail** — Role changes not logged. Consider adding audit logging in the future.
3. **Race condition on role toggle** — Two admins toggling simultaneously. Low risk given small admin count. GORM `Save()` is atomic.

## Edge Cases & Error Handling

- Search with special characters (`%`, `_`) — escape LIKE wildcards
- Toggle role for deleted user — return 404
- Update feedback that was already deleted — return 404
- Empty search string — return all users (no filter applied)
- Admin note with only whitespace — trim and treat as empty string
- Feedback status set to current value — allow (idempotent), no error

## Dependencies & Assumptions

- Existing `AdminMiddleware` and `AdminGuard` are sufficient for authorization
- `FeedbackRepository` interface will be extended with new methods (no new repo)
- `UserRepository` already has `List()` — extend with search support
- Protobuf generation (`task proto:all`) works for the new messages

## Out of Scope

- Super admin concept / role hierarchy
- Audit logging for admin actions
- Email notifications to users on feedback status change
- Bulk operations (multi-select delete/status update)
- User creation/deletion from admin panel
- Export feedback to CSV
