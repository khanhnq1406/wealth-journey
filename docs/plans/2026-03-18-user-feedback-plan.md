# User Feedback Page Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add a `/dashboard/feedback` page where authenticated users submit feedback and view their submission history with status tracking.
**Spec:** `docs/specs/2026-03-18-user-feedback-spec.md`
**Architecture:** Simple CRUD feature — new `feedback` table, Go backend (model → repo → service → handler), Next.js frontend page with form + list. Rate limiting on submit endpoint (10/user/hour). No admin UI.
**Tech Stack:** Go/Gin, GORM, PostgreSQL, Protobuf, Next.js, React Query, Zod, Tailwind CSS, next-intl

## Security Implementation Notes

- **Authentication**: All endpoints require JWT via `AuthMiddleware` — user_id extracted from token context
- **Authorization**: All queries filter by `user_id` from JWT — users can ONLY see their own feedback
- **Input validation**: Server-side length checks (subject 1-200, message 1-2000) in service layer; frontend Zod schema for client-side
- **Rate limiting**: Feedback-specific rate limiter on POST endpoint only (10 submissions/user/hour), using the existing general `RateLimitByUser` middleware (shared quota is acceptable for this low-volume feature)
- **XSS prevention**: React's default escaping — no `dangerouslySetInnerHTML` used anywhere
- **Data sanitization**: Trim whitespace on subject/message; GORM parameterized queries prevent SQL injection

## C4 Architecture Diagram Updates

1. **`docs/architecture/c4-component-backend.md`** — Add `FeedbackHandler`, `FeedbackService`, `FeedbackRepository` to the backend component diagram
2. **`docs/architecture/c4-component-frontend.md`** — Add `FeedbackPage` and `features/feedback/` module

---

### Task 0: Define Protobuf API Contract

**Files:**
- Create: `api/protobuf/v1/feedback.proto`

**Security notes:** Define strict field constraints in proto comments. Use `int64` for timestamps (Unix), not strings.

**Step 1: Create the feedback.proto file**

```protobuf
syntax = "proto3";

package wealthjourney.feedback.v1;

import "protobuf/v1/common.proto";
import "google/api/annotations.proto";

option go_package = "protobuf/v1";

service FeedbackService {
  rpc SubmitFeedback(SubmitFeedbackRequest) returns (SubmitFeedbackResponse) {
    option (google.api.http) = {
      post: "/api/v1/feedback"
      body: "*"
    };
  }

  rpc ListMyFeedback(ListMyFeedbackRequest) returns (ListMyFeedbackResponse) {
    option (google.api.http) = {
      get: "/api/v1/feedback"
    };
  }
}

enum FeedbackStatus {
  FEEDBACK_STATUS_UNSPECIFIED = 0;
  FEEDBACK_STATUS_PENDING = 1;
  FEEDBACK_STATUS_REVIEWED = 2;
  FEEDBACK_STATUS_RESOLVED = 3;
}

message FeedbackItem {
  int32 id = 1 [json_name = "id"];
  string subject = 2 [json_name = "subject"];
  string message = 3 [json_name = "message"];
  FeedbackStatus status = 4 [json_name = "status"];
  int64 createdAt = 5 [json_name = "createdAt"];
  int64 updatedAt = 6 [json_name = "updatedAt"];
}

message SubmitFeedbackRequest {
  string subject = 1 [json_name = "subject"];
  string message = 2 [json_name = "message"];
}

message SubmitFeedbackResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  FeedbackItem feedback = 3 [json_name = "feedback"];
  string timestamp = 4 [json_name = "timestamp"];
}

message ListMyFeedbackRequest {
  common.PaginationRequest pagination = 1 [json_name = "pagination"];
}

message ListMyFeedbackResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated FeedbackItem feedback = 3 [json_name = "feedback"];
  common.PaginationResponse pagination = 4 [json_name = "pagination"];
  string timestamp = 5 [json_name = "timestamp"];
}
```

**Step 2: Generate code**

```bash
task proto:all
```

**Step 3: Verify generated code compiles**

```bash
cd src/go-backend && go build ./...
```

**Step 4: Commit**

```
feat(feedback): define protobuf API contract for feedback service
```

---

### Task 1: Create Backend Model & Migration

**Files:**
- Create: `src/go-backend/domain/models/feedback.go`
- Create: `src/go-backend/cmd/migrate-feedback/main.go`
- Modify: `Taskfile.yml` — add migration task

**Security notes:** Use `int32` for user_id FK, `gorm.DeletedAt` for soft deletes, index on `user_id` for filtered queries.

**Step 1: Write the GORM model**

Create `src/go-backend/domain/models/feedback.go`:

```go
package models

import (
	"time"

	"gorm.io/gorm"
)

type Feedback struct {
	ID        int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int32          `gorm:"not null;index:idx_feedback_user_id" json:"userId"`
	Subject   string         `gorm:"size:200;not null" json:"subject"`
	Message   string         `gorm:"type:text;not null" json:"message"`
	Status    int16          `gorm:"type:smallint;not null;default:1" json:"status"` // 1=pending, 2=reviewed, 3=resolved
	CreatedAt time.Time      `gorm:"index:idx_feedback_created_at" json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	User      *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Feedback) TableName() string {
	return "feedback"
}
```

**Step 2: Write the migration command**

Create `src/go-backend/cmd/migrate-feedback/main.go`:

```go
package main

import (
	"log"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

	log.Println("Running feedback table migration...")

	if err := db.DB.AutoMigrate(&models.Feedback{}); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Feedback table migration completed successfully!")
}
```

**Step 3: Add Taskfile entry**

Add to `Taskfile.yml`:

```yaml
backend:migrate-feedback:
  desc: "Create feedback table"
  dir: "src/go-backend"
  cmds:
    - go run ./cmd/migrate-feedback
```

**Step 4: Run migration locally to verify**

```bash
task backend:migrate-feedback
```

**Step 5: Commit**

```
feat(feedback): add feedback model and migration
```

---

### Task 2: Create Backend Repository

**Files:**
- Create: `src/go-backend/domain/repository/feedback_repository.go`
- Modify: `src/go-backend/domain/repository/interfaces.go` — add `FeedbackRepository` interface

**Security notes:** All list queries MUST filter by `user_id` — never return feedback belonging to other users.

**Step 1: Write the failing test**

Create `src/go-backend/domain/repository/feedback_repository_test.go` — test that the repository interface compiles and mock satisfies it.

**Step 2: Add the repository interface to `interfaces.go`**

```go
type FeedbackRepository interface {
	Create(ctx context.Context, feedback *models.Feedback) error
	ListByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Feedback, int, error)
	CountRecentByUserID(ctx context.Context, userID int32, since time.Time) (int, error)
}
```

Note: `CountRecentByUserID` is for rate-limit checking at the service layer (count feedback submitted in the last hour).

**Step 3: Implement the repository**

Create `src/go-backend/domain/repository/feedback_repository.go`:

```go
package repository

import (
	"context"
	"time"

	"wealthjourney/domain/models"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/database"
)

type feedbackRepository struct {
	*BaseRepository
}

func NewFeedbackRepository(db *database.Database) FeedbackRepository {
	return &feedbackRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *feedbackRepository) Create(ctx context.Context, feedback *models.Feedback) error {
	result := r.db.DB.WithContext(ctx).Create(feedback)
	if result.Error != nil {
		return r.handleDBError(result.Error, "feedback", "create feedback")
	}
	return nil
}

func (r *feedbackRepository) ListByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Feedback, int, error) {
	var feedbacks []*models.Feedback
	var total int64

	if err := r.db.DB.WithContext(ctx).Model(&models.Feedback{}).
		Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to count feedback", err)
	}

	orderClause := r.buildOrderClause(opts)
	if orderClause == "" {
		orderClause = "created_at DESC"
	}

	query := r.db.DB.WithContext(ctx).
		Where("user_id = ?", userID).
		Order(orderClause)
	query = r.applyPagination(query, opts)

	if err := query.Find(&feedbacks).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to list feedback", err)
	}

	return feedbacks, int(total), nil
}

func (r *feedbackRepository) CountRecentByUserID(ctx context.Context, userID int32, since time.Time) (int, error) {
	var count int64
	if err := r.db.DB.WithContext(ctx).Model(&models.Feedback{}).
		Where("user_id = ? AND created_at >= ?", userID, since).
		Count(&count).Error; err != nil {
		return 0, apperrors.NewInternalErrorWithCause("failed to count recent feedback", err)
	}
	return int(count), nil
}
```

**Step 4: Register in providers**

Modify `src/go-backend/internal/app/providers.go` — add to `ProvideRepositories()`:

```go
Feedback: repository.NewFeedbackRepository(db),
```

Modify `src/go-backend/domain/service/services.go` — add `Feedback` field to `Repositories` struct:

```go
Feedback repository.FeedbackRepository
```

**Step 5: Verify it compiles**

```bash
cd src/go-backend && go build ./...
```

**Step 6: Commit**

```
feat(feedback): add feedback repository with user-scoped queries
```

---

### Task 3: Create Backend Service

**Files:**
- Create: `src/go-backend/domain/service/feedback_service.go`
- Create: `src/go-backend/domain/service/feedback_service_test.go`
- Modify: `src/go-backend/domain/service/interfaces.go` — add `FeedbackService` interface
- Modify: `src/go-backend/domain/service/services.go` — register service

**Security notes:** Validate input lengths server-side. Rate limit check: count submissions in last hour, reject if >= 10. Always use `userID` from JWT context.

**Step 1: Write the failing test**

Create `src/go-backend/domain/service/feedback_service_test.go`:

Test cases:
- `TestSubmitFeedback_Success` — valid input creates feedback
- `TestSubmitFeedback_EmptySubject` — returns validation error
- `TestSubmitFeedback_SubjectTooLong` — returns validation error (>200 chars)
- `TestSubmitFeedback_EmptyMessage` — returns validation error
- `TestSubmitFeedback_MessageTooLong` — returns validation error (>2000 chars)
- `TestSubmitFeedback_RateLimited` — returns error when >= 10 in last hour
- `TestListMyFeedback_Success` — returns paginated feedback
- `TestListMyFeedback_Empty` — returns empty list

Use `testify/mock` for repository mocking.

**Step 2: Add service interface to `interfaces.go`**

```go
type FeedbackService interface {
	SubmitFeedback(ctx context.Context, userID int32, req *v1.SubmitFeedbackRequest) (*v1.SubmitFeedbackResponse, error)
	ListMyFeedback(ctx context.Context, userID int32, params types.PaginationParams) (*v1.ListMyFeedbackResponse, error)
}
```

**Step 3: Implement the service**

Create `src/go-backend/domain/service/feedback_service.go`:

```go
package service

import (
	"context"
	"strings"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/types"
	"wealthjourney/pkg/validator"
	v1 "wealthjourney/protobuf/v1"
)

const maxFeedbackPerHour = 10

type feedbackService struct {
	feedbackRepo repository.FeedbackRepository
}

func NewFeedbackService(feedbackRepo repository.FeedbackRepository) FeedbackService {
	return &feedbackService{
		feedbackRepo: feedbackRepo,
	}
}

func (s *feedbackService) SubmitFeedback(ctx context.Context, userID int32, req *v1.SubmitFeedbackRequest) (*v1.SubmitFeedbackResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Trim and validate subject
	subject := strings.TrimSpace(req.Subject)
	if subject == "" || len(subject) > 200 {
		return nil, apperrors.NewValidationError("subject must be 1-200 characters")
	}

	// Trim and validate message
	message := strings.TrimSpace(req.Message)
	if message == "" || len(message) > 2000 {
		return nil, apperrors.NewValidationError("message must be 1-2000 characters")
	}

	// Rate limit check
	oneHourAgo := time.Now().Add(-1 * time.Hour)
	count, err := s.feedbackRepo.CountRecentByUserID(ctx, userID, oneHourAgo)
	if err != nil {
		return nil, err
	}
	if count >= maxFeedbackPerHour {
		return nil, apperrors.NewTooManyRequestsError("Maximum 10 feedback submissions per hour. Please try again later.")
	}

	feedback := &models.Feedback{
		UserID:  userID,
		Subject: subject,
		Message: message,
		Status:  1, // pending
	}

	if err := s.feedbackRepo.Create(ctx, feedback); err != nil {
		return nil, err
	}

	return &v1.SubmitFeedbackResponse{
		Success: true,
		Message: "Feedback submitted successfully",
		Feedback: &v1.FeedbackItem{
			Id:        feedback.ID,
			Subject:   feedback.Subject,
			Message:   feedback.Message,
			Status:    v1.FeedbackStatus(feedback.Status),
			CreatedAt: feedback.CreatedAt.Unix(),
			UpdatedAt: feedback.UpdatedAt.Unix(),
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *feedbackService) ListMyFeedback(ctx context.Context, userID int32, params types.PaginationParams) (*v1.ListMyFeedbackResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	opts := repository.ListOptions{
		Limit:   params.PageSize,
		Offset:  (params.Page - 1) * params.PageSize,
		OrderBy: "created_at",
		Order:   "desc",
	}

	feedbacks, total, err := s.feedbackRepo.ListByUserID(ctx, userID, opts)
	if err != nil {
		return nil, err
	}

	items := make([]*v1.FeedbackItem, len(feedbacks))
	for i, f := range feedbacks {
		items[i] = &v1.FeedbackItem{
			Id:        f.ID,
			Subject:   f.Subject,
			Message:   f.Message,
			Status:    v1.FeedbackStatus(f.Status),
			CreatedAt: f.CreatedAt.Unix(),
			UpdatedAt: f.UpdatedAt.Unix(),
		}
	}

	totalPages := (int32(total) + int32(params.PageSize) - 1) / int32(params.PageSize)

	return &v1.ListMyFeedbackResponse{
		Success:  true,
		Message:  "Feedback retrieved successfully",
		Feedback: items,
		Pagination: &v1.PaginationResponse{
			TotalItems:  int32(total),
			TotalPages:  totalPages,
			CurrentPage: int32(params.Page),
			PageSize:    int32(params.PageSize),
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
```

**Step 4: Check if `TooManyRequestsError` exists in apperrors**

If not, add it to `src/go-backend/pkg/errors/errors.go`:

```go
type TooManyRequestsError struct {
	BaseError
}

func NewTooManyRequestsError(message string) TooManyRequestsError {
	return TooManyRequestsError{
		BaseError: NewError("RATE_LIMIT_EXCEEDED", message, http.StatusTooManyRequests),
	}
}
```

Also ensure `handler.HandleError()` maps this error type to 429 status.

**Step 5: Register service in `services.go`**

Add `Feedback FeedbackService` to `Services` struct.

In `NewServices()`:

```go
feedbackSvc := NewFeedbackService(repos.Feedback)
```

And add to return:

```go
Feedback: feedbackSvc,
```

**Step 6: Run tests**

```bash
cd src/go-backend && go test ./domain/service/ -run TestFeedback -v
```

**Step 7: Commit**

```
feat(feedback): add feedback service with validation and rate limiting
```

---

### Task 4: Create Backend Handler & Routes

**Files:**
- Create: `src/go-backend/handlers/feedback.go`
- Modify: `src/go-backend/handlers/builder.go` — add `Feedback` to `AllHandlers`
- Modify: `src/go-backend/handlers/routes.go` — register feedback routes

**Security notes:** Apply `AuthMiddleware` + `RateLimitByUser` on the feedback route group. Extract `userID` from context only — never from request body.

**Step 1: Create the handler**

Create `src/go-backend/handlers/feedback.go`:

```go
package handlers

import (
	"github.com/gin-gonic/gin"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
	"wealthjourney/pkg/types"
	v1 "wealthjourney/protobuf/v1"
)

type FeedbackHandlers struct {
	feedbackService service.FeedbackService
}

func NewFeedbackHandlers(feedbackService service.FeedbackService) *FeedbackHandlers {
	return &FeedbackHandlers{
		feedbackService: feedbackService,
	}
}

func (h *FeedbackHandlers) SubmitFeedback(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req v1.SubmitFeedbackRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.feedbackService.SubmitFeedback(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

func (h *FeedbackHandlers) ListMyFeedback(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	params := types.PaginationParams{
		Page:     handler.GetQueryInt(c, "page", 1),
		PageSize: handler.GetQueryInt(c, "pageSize", 10),
	}

	result, err := h.feedbackService.ListMyFeedback(c.Request.Context(), userID, params)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.OK(c, result)
}
```

**Step 2: Wire handler in builder.go**

Add to `AllHandlers` struct:

```go
Feedback *FeedbackHandlers
```

In `NewHandlers()`:

```go
Feedback: NewFeedbackHandlers(services.Feedback),
```

**Step 3: Register routes in routes.go**

Add feedback route group (after existing groups, before admin routes):

```go
// Feedback
feedback := v1.Group("/feedback")
if rateLimiter != nil {
    feedback.Use(appmiddleware.RateLimitByUser(rateLimiter))
}
feedback.Use(AuthMiddleware(authSrv))
{
    feedback.POST("", h.Feedback.SubmitFeedback)
    feedback.GET("", h.Feedback.ListMyFeedback)
}
```

**Step 4: Verify it compiles and runs**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

```
feat(feedback): add REST handler and routes for feedback endpoints
```

---

### Task 5: Add i18n Translation Keys

**Files:**
- Create: `src/wj-client/messages/en/feedback.json`
- Create: `src/wj-client/messages/vi/feedback.json`
- Modify: `src/wj-client/messages/en/nav.json` — add "feedback" nav label
- Modify: `src/wj-client/messages/vi/nav.json` — add "feedback" nav label

**Security notes:** None — static translation files.

**Step 1: Create English translations**

Create `src/wj-client/messages/en/feedback.json`:

```json
{
  "feedback": {
    "title": "Feedback",
    "sendFeedback": "Send Feedback",
    "myFeedback": "My Feedback",
    "loading": "Loading feedback...",
    "noFeedbackTitle": "No feedback yet",
    "noFeedbackDescription": "Share your thoughts to help us improve the app",
    "form": {
      "subject": "Subject",
      "subjectPlaceholder": "Brief summary of your feedback",
      "message": "Message",
      "messagePlaceholder": "Tell us what you think...",
      "submit": "Submit Feedback",
      "submittedSuccess": "Thank you! Your feedback has been submitted.",
      "failedToSubmit": "Failed to submit feedback. Please try again.",
      "rateLimited": "You've submitted too many feedback recently. Please try again later."
    },
    "status": {
      "pending": "Pending",
      "reviewed": "Reviewed",
      "resolved": "Resolved"
    },
    "loadMore": "Load More",
    "noMore": "No more feedback"
  }
}
```

**Step 2: Create Vietnamese translations**

Create `src/wj-client/messages/vi/feedback.json`:

```json
{
  "feedback": {
    "title": "Phản hồi",
    "sendFeedback": "Gửi phản hồi",
    "myFeedback": "Phản hồi của tôi",
    "loading": "Đang tải phản hồi...",
    "noFeedbackTitle": "Chưa có phản hồi",
    "noFeedbackDescription": "Chia sẻ ý kiến của bạn để giúp chúng tôi cải thiện ứng dụng",
    "form": {
      "subject": "Tiêu đề",
      "subjectPlaceholder": "Tóm tắt ngắn gọn phản hồi của bạn",
      "message": "Nội dung",
      "messagePlaceholder": "Hãy cho chúng tôi biết suy nghĩ của bạn...",
      "submit": "Gửi phản hồi",
      "submittedSuccess": "Cảm ơn bạn! Phản hồi đã được gửi thành công.",
      "failedToSubmit": "Gửi phản hồi thất bại. Vui lòng thử lại.",
      "rateLimited": "Bạn đã gửi quá nhiều phản hồi. Vui lòng thử lại sau."
    },
    "status": {
      "pending": "Đang chờ",
      "reviewed": "Đã xem",
      "resolved": "Đã giải quyết"
    },
    "loadMore": "Xem thêm",
    "noMore": "Không còn phản hồi"
  }
}
```

**Step 3: Add nav labels**

In `src/wj-client/messages/en/nav.json`, add to the `nav` object:

```json
"feedback": "Feedback"
```

In `src/wj-client/messages/vi/nav.json`, add:

```json
"feedback": "Phản hồi"
```

**Step 4: Commit**

```
feat(feedback): add i18n translations for feedback feature (en + vi)
```

---

### Task 6: Add Frontend Route & Navigation

**Files:**
- Modify: `src/wj-client/app/constants.tsx` — add `feedback` route
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx` — add sidebar + mobile nav items
- Create: `src/wj-client/app/[locale]/dashboard/feedback/page.tsx` — placeholder page

**Security notes:** None — routing only. Auth is handled by layout middleware.

**Step 1: Add route constant**

In `src/wj-client/app/constants.tsx`, add to `routes` object:

```typescript
feedback: `/dashboard/feedback`,
```

**Step 2: Add desktop sidebar NavItem**

In `layout.tsx`, inside the "Standard group" div (after Wallets NavItem, before the spacer), add:

```tsx
<NavItem
  href={routes.feedback}
  label={t("feedback")}
  isExpanded={isExpanded}
  showTooltip={!isExpanded}
  animationDelay={180}
  icon={<MessageCircle size={20} />}
  isActive={path === routes.feedback}
/>
```

Move Settings `animationDelay` from 180 to 210.

Import `MessageCircle` from `lucide-react`.

**Step 3: Add mobile slide-out menu item**

In `layout.tsx`, add to `standardItems` array:

```typescript
{ href: routes.feedback, label: t("feedback"), icon: <MessageCircle size={22} /> },
```

**Step 4: Create placeholder page**

Create `src/wj-client/app/[locale]/dashboard/feedback/page.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";

export default function FeedbackPage() {
  const t = useTranslations("feedback");
  return (
    <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
      <h1 className="text-lg sm:text-xl font-bold font-vietnam text-v2-text-primary">
        {t("title")}
      </h1>
    </div>
  );
}
```

**Step 5: Verify navigation works**

```bash
cd src/wj-client && npm run build
```

**Step 6: Commit**

```
feat(feedback): add feedback route, sidebar nav, and placeholder page
```

---

### Task 7: Create Frontend Feature Module — Form & Validation

**Files:**
- Create: `src/wj-client/features/feedback/utils/feedback-schema.ts`
- Create: `src/wj-client/features/feedback/forms/SubmitFeedbackForm.tsx`

**Security notes:** Zod schema enforces client-side limits matching server (subject 1-200, message 1-2000). Server is the real authority.

**Step 0: Component inventory check**
- [x] Reusing: `FormInput`, `FormTextarea`, `Button`, `Success`
- [x] Creating new: `SubmitFeedbackForm` (feature-specific form)

**Step 1: Create Zod validation schema**

Create `src/wj-client/features/feedback/utils/feedback-schema.ts`:

```typescript
import { z } from "zod";

export const submitFeedbackSchema = z.object({
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject must be 200 characters or less"),
  message: z
    .string()
    .min(1, "Message is required")
    .max(2000, "Message must be 2000 characters or less"),
});

export type SubmitFeedbackFormInput = z.infer<typeof submitFeedbackSchema>;
```

**Step 2: Create the form component**

Create `src/wj-client/features/feedback/forms/SubmitFeedbackForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { RHFFormInput as FormInput } from "@/components/forms/RHFFormInput";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { Success } from "@/components/modals/Success";
import { useMutationSubmitFeedback } from "@/utils/generated/hooks";
import {
  submitFeedbackSchema,
  type SubmitFeedbackFormInput,
} from "@/features/feedback/utils/feedback-schema";

interface SubmitFeedbackFormProps {
  onSuccess?: () => void;
}

export function SubmitFeedbackForm({ onSuccess }: SubmitFeedbackFormProps) {
  const t = useTranslations("feedback");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [showSuccess, setShowSuccess] = useState(false);

  const submitFeedback = useMutationSubmitFeedback();

  const { control, handleSubmit, reset } = useForm<SubmitFeedbackFormInput>({
    resolver: zodResolver(submitFeedbackSchema),
    defaultValues: {
      subject: "",
      message: "",
    },
    mode: "onSubmit",
  });

  const onSubmit = (data: SubmitFeedbackFormInput) => {
    setErrorMessage(undefined);
    submitFeedback.mutate(
      { subject: data.subject, message: data.message },
      {
        onSuccess: () => {
          setShowSuccess(true);
        },
        onError: (error: any) => {
          if (error?.statusCode === 429) {
            setErrorMessage(t("form.rateLimited"));
          } else {
            setErrorMessage(error.message || t("form.failedToSubmit"));
          }
        },
      }
    );
  };

  const handleDone = () => {
    setShowSuccess(false);
    reset();
    onSuccess?.();
  };

  if (showSuccess) {
    return <Success message={t("form.submittedSuccess")} onDone={handleDone} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      {errorMessage && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      <FormInput
        name="subject"
        control={control}
        label={t("form.subject")}
        placeholder={t("form.subjectPlaceholder")}
        maxLength={200}
        required
      />

      <FormTextarea
        name="message"
        control={control}
        label={t("form.message")}
        placeholder={t("form.messagePlaceholder")}
        rows={5}
        maxLength={2000}
        showCharacterCount={true}
        required
      />

      <Button
        type={ButtonType.PRIMARY}
        htmlType="submit"
        loading={submitFeedback.isPending}
      >
        {t("form.submit")}
      </Button>
    </form>
  );
}
```

**Step 3: Verify it compiles**

```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 4: Commit**

```
feat(feedback): add feedback form with validation and rate limit handling
```

---

### Task 8: Create Frontend Feature Module — StatusBadge & FeedbackItem Components

**Files:**
- Create: `src/wj-client/features/feedback/components/StatusBadge.tsx`
- Create: `src/wj-client/features/feedback/components/FeedbackItem.tsx`

**Security notes:** No `dangerouslySetInnerHTML` — React escapes all text content by default.

**Step 0: Component inventory check**
- [x] Creating new: `StatusBadge` (domain-specific status display), `FeedbackItem` (expandable list item)
- No existing badge or expandable list item component to reuse

**Step 1: Create StatusBadge component**

Create `src/wj-client/features/feedback/components/StatusBadge.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";

const statusConfig: Record<number, { key: string; className: string }> = {
  1: { key: "pending", className: "bg-yellow-100 text-yellow-800" },
  2: { key: "reviewed", className: "bg-blue-100 text-blue-800" },
  3: { key: "resolved", className: "bg-green-100 text-green-800" },
};

interface StatusBadgeProps {
  status: number;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const t = useTranslations("feedback");
  const config = statusConfig[status] || statusConfig[1];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {t(`status.${config.key}`)}
    </span>
  );
}
```

**Step 2: Create FeedbackItem component**

Create `src/wj-client/features/feedback/components/FeedbackItem.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BaseCard } from "@/components/cards/BaseCard";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

interface FeedbackItemProps {
  subject: string;
  message: string;
  status: number;
  createdAt: number; // Unix timestamp
}

export function FeedbackItem({
  subject,
  message,
  status,
  createdAt,
}: FeedbackItemProps) {
  const [expanded, setExpanded] = useState(false);

  const formattedDate = new Date(createdAt * 1000).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric" }
  );

  const preview = message.length > 100 ? message.slice(0, 100) + "..." : message;

  return (
    <BaseCard padding="none">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex flex-col gap-2"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-vietnam text-sm font-semibold text-v2-text-primary truncate flex-1">
            {subject}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={status} />
            <ChevronDown
              size={16}
              className={cn(
                "text-v2-text-tertiary transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-v2-text-tertiary font-vietnam">
          <span>{formattedDate}</span>
        </div>
        {!expanded && (
          <p className="text-sm text-v2-text-secondary font-vietnam line-clamp-2">
            {preview}
          </p>
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-v2-border-light pt-3">
          <p className="text-sm text-v2-text-secondary font-vietnam whitespace-pre-wrap">
            {message}
          </p>
        </div>
      )}
    </BaseCard>
  );
}
```

**Step 3: Commit**

```
feat(feedback): add StatusBadge and FeedbackItem components
```

---

### Task 9: Build Complete Feedback Page

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/feedback/page.tsx` — full implementation

**Security notes:** None — page composes already-secured components. Data fetched via authenticated hooks.

**Step 1: Implement the full page**

Replace placeholder in `src/wj-client/app/[locale]/dashboard/feedback/page.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { BaseCard } from "@/components/cards/BaseCard";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { EmptyState } from "@/components/feedback/EmptyState";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { MessageCircle } from "lucide-react";
import { useQueryListMyFeedback, EVENT_FeedbackListMyFeedback } from "@/utils/generated/hooks";
import { SubmitFeedbackForm } from "@/features/feedback/forms/SubmitFeedbackForm";
import { FeedbackItem } from "@/features/feedback/components/FeedbackItem";

export default function FeedbackPage() {
  const t = useTranslations("feedback");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const feedbackQuery = useQueryListMyFeedback(
    { pagination: { page, pageSize, orderBy: "", order: "" } },
    { refetchOnMount: "always" }
  );

  const handleFormSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [EVENT_FeedbackListMyFeedback] });
  }, [queryClient]);

  const feedbackItems = feedbackQuery.data?.feedback || [];
  const totalItems = feedbackQuery.data?.pagination?.totalItems || 0;
  const hasMore = feedbackItems.length < totalItems;

  return (
    <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 max-w-2xl mx-auto">
      {/* Submit Feedback Form */}
      <BaseCard className="mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-bold font-vietnam text-v2-text-primary mb-3">
          {t("sendFeedback")}
        </h2>
        <SubmitFeedbackForm onSuccess={handleFormSuccess} />
      </BaseCard>

      {/* Feedback History */}
      <h2 className="text-base sm:text-lg font-bold font-vietnam text-v2-text-primary mb-3">
        {t("myFeedback")}
      </h2>

      {feedbackQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner text={t("loading")} />
        </div>
      ) : feedbackItems.length === 0 ? (
        <EmptyState
          icon={<MessageCircle size={40} />}
          title={t("noFeedbackTitle")}
          description={t("noFeedbackDescription")}
          variant="card"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {feedbackItems.map((item) => (
            <FeedbackItem
              key={item.id}
              subject={item.subject}
              message={item.message}
              status={item.status}
              createdAt={item.createdAt}
            />
          ))}

          {hasMore && (
            <Button
              type={ButtonType.SECONDARY}
              onClick={() => setPage((p) => p + 1)}
              loading={feedbackQuery.isFetching}
            >
              {t("loadMore")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Responsive & accessibility check**
- Mobile (375px): Vertical stack, full-width form and list, touch targets >= 44px
- Desktop (800px+): max-w-2xl centered, same vertical layout
- ARIA: `aria-expanded` on FeedbackItem, form labels on inputs
- Keyboard: Tab through form fields, Enter to submit, click/Enter to expand items

**Step 3: Commit**

```
feat(feedback): implement complete feedback page with form and history list
```

---

### Task 10: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md` — add FeedbackHandler, FeedbackService, FeedbackRepository
- Modify: `docs/architecture/c4-component-frontend.md` — add FeedbackPage, features/feedback module

**Steps:**
1. Read existing C4 diagrams
2. Add new components following existing Mermaid syntax
3. Verify Mermaid renders correctly

**Step 1: Update backend C4 component diagram**

Add to the backend component diagram:
- `FeedbackHandler` in the Handlers layer
- `FeedbackService` in the Service layer
- `FeedbackRepository` in the Repository layer
- Relationships: Handler → Service → Repository → PostgreSQL

**Step 2: Update frontend C4 component diagram**

Add:
- `FeedbackPage` at `/dashboard/feedback`
- `features/feedback/` module with forms, components, utils

**Step 3: Commit**

```
docs(architecture): update C4 diagrams for feedback feature
```

---

### Task 11: Write Implementation Report

**Files:**
- Create: `docs/reports/2026-03-18-user-feedback-report.md`

**Steps:**
1. Summarize all tasks completed
2. List all files created/modified
3. Document test coverage
4. Document security implementations
5. Note any known issues or technical debt

**Step 1: Write the report**

Following the implementation report template from the spec.

**Step 2: Commit**

```
docs(feedback): add implementation report for user feedback feature
```

---

## Task Dependency Graph

```
Task 0 (Proto) ──┐
                  ├── Task 1 (Model/Migration)
                  │       │
                  │       ├── Task 2 (Repository)
                  │       │       │
                  │       │       ├── Task 3 (Service + Tests)
                  │       │       │       │
                  │       │       │       ├── Task 4 (Handler + Routes)
                  │       │       │       │
Task 5 (i18n) ───┤       │       │       │
                  │       │       │       │
Task 6 (Route + Nav) ────┤       │       │
                          │       │       │
Task 7 (Form + Schema) ──┤       │       │
                          │       │       │
Task 8 (Components) ─────┤       │       │
                          │       │       │
                          ├── Task 9 (Full Page) ── requires Tasks 0-8
                          │
                          ├── Task 10 (C4 Diagrams) ── after all implementation
                          │
                          └── Task 11 (Report) ── final task
```

**Parallelizable groups:**
- **Group A**: Tasks 5, 6, 7, 8 (frontend setup — can be done in parallel)
- **Group B**: Tasks 0 → 1 → 2 → 3 → 4 (backend — sequential dependency chain)
- **Group C**: Task 9 (depends on both Group A and Group B completing)
- **Group D**: Tasks 10, 11 (documentation — after Task 9)

**Note:** Task 0 (proto generation) must complete before both backend (Tasks 1-4) and frontend hooks (Tasks 7, 9) can use generated types. Run `task proto:all` in Task 0, then backend and frontend can proceed in parallel.
