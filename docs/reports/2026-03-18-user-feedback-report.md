# User Feedback Page — Implementation Report

## Summary

Implemented a `/dashboard/feedback` page where authenticated users can submit feedback and view their submission history with status tracking. The feature spans the full stack: protobuf API definition, Go backend (model, repository, service, handler), and Next.js frontend (form, components, page).

## Spec Reference

`docs/specs/2026-03-18-user-feedback-spec.md`

## Plan Reference

`docs/plans/2026-03-18-user-feedback-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Tests | TDD |
|---|------|--------|---------------|-------|-----|
| 0 | Define Protobuf API Contract | Done | feedback.proto + generated Go/TS | Build pass | N/A |
| 1 | Create Backend Model & Migration | Done | models/feedback.go, cmd/migrate-feedback/ | Build pass | N/A |
| 2 | Create Backend Repository | Done | repository/feedback_repository.go, interfaces.go | Build pass | N/A |
| 3 | Create Backend Service | Done | service/feedback_service.go, service_test.go | 10/10 pass | Yes |
| 4 | Create Backend Handler & Routes | Done | handlers/feedback.go, builder.go, routes.go | Build pass | N/A |
| 5 | Add i18n Translations | Done | en/feedback.json, vi/feedback.json, nav.json x2, request.ts | N/A | N/A |
| 6 | Add Frontend Route & Navigation | Done | constants.tsx, layout.tsx, feedback/page.tsx | Build pass | N/A |
| 7 | Create Frontend Form & Validation | Done | feedback-schema.ts, SubmitFeedbackForm.tsx | Build pass | N/A |
| 8 | Create StatusBadge & FeedbackItem | Done | StatusBadge.tsx, FeedbackItem.tsx | Build pass | N/A |
| 9 | Build Complete Feedback Page | Done | feedback/page.tsx (full implementation) | Build pass | N/A |
| 10 | Update C4 Architecture Diagrams | Done | c4-component-backend.md, c4-component-frontend.md | N/A | N/A |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
|-------|-----------|-------|------|---------------|
| Backend Service | `feedback_service_test.go` | 10 | 10/10 | Submit validation (empty/long subject/message, whitespace), rate limiting, list success/empty, invalid user ID |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Authentication | JWT via AuthMiddleware on all feedback routes | Yes |
| Authorization | All queries filter by user_id from JWT context | Yes |
| Input validation | Server-side: subject 1-200, message 1-2000 (trimmed) | Yes |
| Client validation | Zod schema matching server constraints | Yes |
| Rate limiting | 10 submissions/user/hour via CountRecentByUserID | Yes |
| XSS prevention | React default escaping, no dangerouslySetInnerHTML | Yes |
| SQL injection | GORM parameterized queries | Yes |
| Error sanitization | Backend returns generic error messages | Yes |

## Review Results

### Spec Compliance
- All functional requirements implemented: submit feedback, view history, status display
- Pagination via page/pageSize query params
- Rate limiting at 10/user/hour
- i18n in both English and Vietnamese

### Architecture Diagram Updates
- Backend C4: Added FeedbackHandler, FeedbackService, FeedbackRepository with relationships
- Frontend C4: Added FeedbackPage, features/feedback module with relationships

## Plan Deviations

| Deviation | Plan Said | Actual | Reason |
|-----------|-----------|--------|--------|
| Proto pagination types | PaginationRequest/PaginationResponse | PaginationParams/PaginationResult | Matches existing common.proto naming |
| Error type | Create TooManyRequestsError | Used existing RateLimitError | Already exists in pkg/errors |
| BaseCard import | `@/components/cards/BaseCard` | `@/components/BaseCard` | Actual file location |
| Pagination field | `totalItems` | `totalCount` | Matches PaginationResult proto definition |

## Files Changed

### Created
- `api/protobuf/v1/feedback.proto`
- `src/go-backend/domain/models/feedback.go`
- `src/go-backend/cmd/migrate-feedback/main.go`
- `src/go-backend/domain/repository/feedback_repository.go`
- `src/go-backend/domain/service/feedback_service.go`
- `src/go-backend/domain/service/feedback_service_test.go`
- `src/go-backend/handlers/feedback.go`
- `src/wj-client/messages/en/feedback.json`
- `src/wj-client/messages/vi/feedback.json`
- `src/wj-client/app/[locale]/dashboard/feedback/page.tsx`
- `src/wj-client/features/feedback/utils/feedback-schema.ts`
- `src/wj-client/features/feedback/forms/SubmitFeedbackForm.tsx`
- `src/wj-client/features/feedback/components/StatusBadge.tsx`
- `src/wj-client/features/feedback/components/FeedbackItem.tsx`

### Modified
- `src/go-backend/domain/repository/interfaces.go` — added FeedbackRepository interface
- `src/go-backend/domain/service/interfaces.go` — added FeedbackService interface
- `src/go-backend/domain/service/services.go` — added Feedback to Services and Repositories structs
- `src/go-backend/internal/app/providers.go` — registered FeedbackRepository
- `src/go-backend/handlers/builder.go` — added Feedback to AllHandlers
- `src/go-backend/handlers/routes.go` — registered feedback routes
- `src/wj-client/app/constants.tsx` — added feedback route
- `src/wj-client/app/[locale]/dashboard/layout.tsx` — added sidebar + mobile nav items
- `src/wj-client/messages/en/nav.json` — added feedback label
- `src/wj-client/messages/vi/nav.json` — added feedback label
- `src/wj-client/i18n/request.ts` — registered feedback message group
- `docs/architecture/c4-component-backend.md` — added feedback components
- `docs/architecture/c4-component-frontend.md` — added feedback components
- `Taskfile.yml` — added migrate-feedback task

### Auto-Generated (by `task proto:all`)
- `src/go-backend/protobuf/v1/feedback.pb.go`
- `src/go-backend/protobuf/v1/feedback_grpc.pb.go`
- `src/go-backend/protobuf/v1/feedback.pb.gw.go`
- `src/wj-client/gen/protobuf/v1/feedback.ts`
- `src/wj-client/utils/generated/hooks.ts` (updated)
- `src/wj-client/utils/generated/api.ts` (updated)

## How to Test

1. **Run migration**: `task backend:migrate-feedback`
2. **Start backend**: `task backend:dev`
3. **Start frontend**: `task frontend:dev`
4. **Navigate to**: `/dashboard/feedback`
5. **Submit feedback**: Fill in subject and message, click Submit
6. **Verify history**: Submitted feedback appears in the list below
7. **Expand item**: Click a feedback item to see full message
8. **Rate limit**: Submit 10+ feedback within an hour to verify 429 error
9. **Run backend tests**: `cd src/go-backend && go test ./domain/service/ -run TestFeedback -v`

## Known Issues / Technical Debt

- No admin UI for reviewing/resolving feedback (out of scope per spec)
- "Load More" replaces page content rather than appending (acceptable for low-volume feature)
- No runtime flow diagram created (simple CRUD, no complex multi-step logic)
