# User Feedback Page Specification

## Summary

Add a dedicated feedback page at `/dashboard/feedback` where authenticated users can submit general feedback about the app experience. Feedback is stored in PostgreSQL with status tracking (pending, reviewed, resolved). Users can view their submission history and current status. No admin UI — status updates managed directly via database. Accessible from a new sidebar navigation item.

## User Stories

- As a user, I want to send feedback about the app so that the developer knows what I think
- As a user, I want to see my past feedback submissions so that I can track whether they've been acknowledged
- As a user, I want to know the status of my feedback (pending, reviewed, resolved) so that I feel heard

## Functional Requirements

### FR-1: Submit Feedback

Users can submit feedback via a form on the feedback page.

**Form fields:**
- **Subject** (required, max 200 characters) — brief summary
- **Message** (required, max 2000 characters) — detailed feedback with character counter

**Acceptance criteria:**
- [ ] Subject is required, 1-200 characters
- [ ] Message is required, 1-2000 characters with visible character counter
- [ ] Form shows validation errors inline
- [ ] Submit button shows loading state during submission
- [ ] Success state shown after submission (reuse `<Success>` component)
- [ ] After success dismiss, form resets and feedback list refreshes
- [ ] Rate limited: max 10 submissions per user per hour

### FR-2: View Feedback History

Users can see a list of their previously submitted feedback below the form.

**List displays:**
- Subject (truncated if long)
- Status badge (Pending = yellow, Reviewed = blue, Resolved = green)
- Submitted date (formatted per locale)
- Message preview (first ~100 characters)

**Acceptance criteria:**
- [ ] List sorted by newest first
- [ ] Paginated (10 items per page)
- [ ] Empty state when no feedback submitted yet
- [ ] Loading skeleton while fetching
- [ ] Status badges with appropriate colors
- [ ] Tapping/clicking a feedback item expands to show full message

### FR-3: Sidebar Navigation

Add "Feedback" as a navigation item in the sidebar.

**Acceptance criteria:**
- [ ] Visible in desktop sidebar (standard group, after Wallets)
- [ ] Visible in mobile slide-out menu
- [ ] Uses `MessageCircle` icon from lucide-react
- [ ] Active state when on feedback page
- [ ] Animation delay follows existing 30ms increment pattern

## Non-Functional Requirements

- **Performance**: Page loads in <1s, feedback list uses React Query caching
- **Security**: Server-side validation, rate limiting, user can only see own feedback
- **Accessibility**: Form labels, ARIA attributes, keyboard navigation
- **i18n**: Full translation support (en + vi) via next-intl

## Architecture Changes (C4)

### Diagrams to Update

1. **`docs/architecture/c4-component-backend.md`** — Add `FeedbackHandler`, `FeedbackService`, `FeedbackRepository` components to the backend component diagram
2. **`docs/architecture/c4-component-frontend.md`** — Add `FeedbackPage` and `features/feedback/` module to the frontend component diagram

### New Diagrams

None needed — this is a simple CRUD domain (1 model, 1 service) that doesn't warrant an L4 code diagram.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — no existing flows are affected.

### New Flow Diagrams

None needed — this is straightforward CRUD (submit feedback, list feedback) with no multi-step business logic, branching decisions, or multi-service coordination.

## Data Model Changes

### New Table: `feedback`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| user_id | INT | NOT NULL, FK → user(id), INDEX | Submitting user |
| subject | VARCHAR(200) | NOT NULL | Feedback subject |
| message | TEXT | NOT NULL | Feedback message body |
| status | SMALLINT | NOT NULL, DEFAULT 0 | 0=pending, 1=reviewed, 2=resolved |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Submission time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update time |
| deleted_at | TIMESTAMPTZ | NULL, INDEX | Soft delete (GORM) |

**Indexes:**
- `idx_feedback_user_id` on `user_id` (filtered queries)
- `idx_feedback_created_at` on `created_at` (sort order)

## API Changes

### New Proto: `api/protobuf/v1/feedback.proto`

**Service: FeedbackService**

#### `SubmitFeedback` — POST `/api/v1/feedback`

Request:
```protobuf
message SubmitFeedbackRequest {
  string subject = 1;   // 1-200 chars
  string message = 2;   // 1-2000 chars
}
```

Response:
```protobuf
message SubmitFeedbackResponse {
  bool success = 1;
  string message = 2;
  int32 feedbackId = 3;
  string timestamp = 4;
}
```

#### `ListMyFeedback` — GET `/api/v1/feedback`

Request:
```protobuf
message ListMyFeedbackRequest {
  common.PaginationRequest pagination = 1;
}
```

Response:
```protobuf
message ListMyFeedbackResponse {
  repeated FeedbackItem feedback = 1;
  common.PaginationResponse pagination = 2;
}

message FeedbackItem {
  int32 id = 1;
  string subject = 2;
  string message = 3;
  FeedbackStatus status = 4;
  int64 createdAt = 5;   // Unix timestamp
  int64 updatedAt = 6;   // Unix timestamp
}

enum FeedbackStatus {
  FEEDBACK_STATUS_UNSPECIFIED = 0;
  FEEDBACK_STATUS_PENDING = 1;
  FEEDBACK_STATUS_REVIEWED = 2;
  FEEDBACK_STATUS_RESOLVED = 3;
}
```

## UI/UX Changes

### New Page: `/dashboard/feedback`

**Layout (mobile-first):**

```
Mobile (< 800px):
┌──────────────────────────┐
│ Send Feedback             │
├──────────────────────────┤
│ [Subject input         ] │
│ [                      ] │
│ [  Message textarea    ] │
│ [              0/2000  ] │
│                          │
│   [  Submit Feedback  ]  │
├──────────────────────────┤
│ My Feedback              │
├──────────────────────────┤
│ ┌────────────────────┐   │
│ │ Login issue     🟡  │   │
│ │ Mar 15 · Pending   │   │
│ │ I tried to login...│   │
│ └────────────────────┘   │
│ ┌────────────────────┐   │
│ │ Great app!      🟢  │   │
│ │ Mar 10 · Resolved  │   │
│ │ Really enjoying... │   │
│ └────────────────────┘   │
│                          │
│ [  Load More  ]          │
└──────────────────────────┘

Desktop (>= 800px):
Same vertical layout, max-width constrained (~640px centered)
```

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|-------------------|----------|
| Card wrapper | `BaseCard` | `components/cards/BaseCard.tsx` |
| Text input | `FormInput` | `components/forms/FormInput.tsx` |
| Textarea | `FormTextarea` | `components/forms/FormTextarea.tsx` |
| Submit button | `Button` | `components/Button.tsx` |
| Success state | `Success` | `components/modals/Success.tsx` |
| Empty state | `EmptyState` | `components/feedback/EmptyState.tsx` |
| Loading | `LoadingSpinner` | `components/loading/LoadingSpinner.tsx` |
| Status badge | NEW — simple styled span | `features/feedback/components/StatusBadge.tsx` |
| Feedback list item | NEW — expandable card | `features/feedback/components/FeedbackItem.tsx` |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| `StatusBadge` | `features/feedback/components/StatusBadge.tsx` | Domain-specific status display with color mapping — no existing badge component |
| `FeedbackItem` | `features/feedback/components/FeedbackItem.tsx` | Expandable list item with status, date, preview — no existing expandable list item |
| `SubmitFeedbackForm` | `features/feedback/forms/SubmitFeedbackForm.tsx` | Feature-specific form following existing form patterns |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | Subject + Message text | Yes: Internet → App Server | Go Backend (Gin) | User input, needs sanitization |
| 2 | Go Backend | Validated feedback | No: internal | PostgreSQL | Server to DB, parameterized queries |
| 3 | PostgreSQL | Feedback records | No: internal | Go Backend | DB to server, filtered by user_id |
| 4 | Go Backend | Feedback list JSON | Yes: App Server → Internet | Browser | Response to user, only own data |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App Server | User submit/list requests | JWT auth + rate limiting + input validation |
| App Server → Database | GORM queries | Parameterized queries, user_id filtering |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | User submits feedback as another user | Medium | JWT auth extracts user_id from token, not request body |
| T-2 | 1 | Internet → App | Tampering | Inject malicious content (XSS) in subject/message | Medium | Server-side length validation; frontend escapes output via React's default XSS protection |
| T-3 | 1 | Internet → App | Denial of Service | Flood feedback submissions | Medium | Rate limit: 10/user/hour via existing rate limiter middleware |
| T-4 | 4 | App → Internet | Information Disclosure | User sees another user's feedback | High | WHERE user_id = ? in all queries; no admin endpoints exposed |
| T-5 | 1 | Internet → App | Tampering | Extremely long input bypassing frontend validation | Low | Server-side max length enforcement (200/2000 chars) |

### Authorization Rules

- Submit feedback: Any authenticated user (JWT required)
- List feedback: Authenticated user, returns ONLY their own feedback (filtered by user_id from JWT)
- No update/delete endpoints for users — status managed via direct DB access

### Input Validation Rules

| Field | Frontend (Zod) | Backend (Go) | Location |
|-------|---------------|--------------|----------|
| subject | `z.string().min(1).max(200)` | `len(subject) >= 1 && len(subject) <= 200` | Service layer |
| message | `z.string().min(1).max(2000)` | `len(message) >= 1 && len(message) <= 2000` | Service layer |

### External Dependency Risks

None — no external APIs. Only PostgreSQL (already trusted) and existing auth system.

### Sensitive Data Handling

- Feedback content is user-generated text, not financial data
- No PII beyond what's already associated with the user account
- Feedback is soft-deleted (not permanently removed) to maintain audit trail

### Issues & Risks Summary

1. **Rate limiting** — Must enforce server-side to prevent spam (10/user/hour)
2. **Data isolation** — All queries must filter by authenticated user_id
3. **XSS in feedback text** — React escapes by default; no `dangerouslySetInnerHTML`

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Empty subject or message | Frontend Zod validation blocks submit; backend rejects with 400 |
| Subject > 200 or message > 2000 chars | Frontend enforces maxLength; backend truncates or rejects |
| Rate limit exceeded | Backend returns 429; frontend shows "Please wait before submitting again" |
| Network error during submit | Frontend shows error message with retry option |
| No feedback history | Show `EmptyState` component with encouraging message |
| User not authenticated | Redirect to login (handled by auth middleware) |

## Dependencies & Assumptions

- Existing JWT auth middleware works correctly
- Existing rate limiter middleware can be applied per-route
- PostgreSQL migration can be run via a new Taskfile command
- next-intl infrastructure supports adding new message files

## Out of Scope

- Admin UI for managing feedback (manage via Supabase dashboard / SQL)
- File/screenshot attachments
- Email notifications when feedback is submitted
- Replying to feedback from admin
- Bug report specific fields (steps to reproduce, severity, etc.)
- Feature request specific fields (priority, voting)
