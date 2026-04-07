# Price Alert Status Filter Bug — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix `ListAlerts` handler so the `status_filter` query parameter actually filters alerts by status.
**Spec:** `docs/specs/2026-04-07-price-alert-filter-bug-spec.md`
**Architecture:** Handler-only fix — replace `c.ShouldBindQuery(&req)` with manual query-param parsing for `status_filter`. The service and repository layers already handle filtering correctly; only the handler binding is broken.
**Tech Stack:** Go 1.25, Gin, proto-generated structs (`wealthjourney/protobuf/v1`)

## Security Implementation Notes

- **Authentication:** `GetUserID(c)` extracts userID from JWT — unchanged; no impact.
- **Authorization:** `ListByUserID` is always scoped to `userID` — unchanged; no impact.
- **Input validation:** `strconv.Atoi` + cast to `v1.AlertStatus`; unknown values silently fall back to 0 (all). Safe — no crash, no data leak.
- **Data sanitization:** No user-facing text in the filter path; no XSS surface.

## Component Reuse Inventory (Frontend Tasks)

No frontend changes required.

## C4 Architecture Diagram Updates

None — no structural changes (per spec: "no structural changes to components or services").

---

### Task 1: Fix `ListAlerts` handler — manual `status_filter` binding

**Files:**
- Modify: `src/go-backend/handlers/user_price_alert.go` (lines 47–67)
- Create: `src/go-backend/handlers/user_price_alert_test.go`

**Security notes:** Parse `status_filter` with `strconv.Atoi`; unknown enum values default to 0 (all-records). No new trust boundary crossed.

**Step 1: Write the failing test**

Create `src/go-backend/handlers/user_price_alert_test.go`:

```go
package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	v1 "wealthjourney/protobuf/v1"
)

// mockUserPriceAlertService stubs UserPriceAlertService for handler tests.
type mockUserPriceAlertService struct {
	listAlertsFunc func(ctx context.Context, userID int32, req *v1.ListUserPriceAlertsRequest) (*v1.ListUserPriceAlertsResponse, error)
}

func (m *mockUserPriceAlertService) CreateAlert(ctx context.Context, userID int32, req *v1.CreateUserPriceAlertRequest) (*v1.CreateUserPriceAlertResponse, error) {
	return nil, nil
}
func (m *mockUserPriceAlertService) ListAlerts(ctx context.Context, userID int32, req *v1.ListUserPriceAlertsRequest) (*v1.ListUserPriceAlertsResponse, error) {
	if m.listAlertsFunc != nil {
		return m.listAlertsFunc(ctx, userID, req)
	}
	return &v1.ListUserPriceAlertsResponse{Success: true, Alerts: nil}, nil
}
func (m *mockUserPriceAlertService) UpdateAlert(ctx context.Context, alertID int32, userID int32, req *v1.UpdateUserPriceAlertRequest) (*v1.UpdateUserPriceAlertResponse, error) {
	return nil, nil
}
func (m *mockUserPriceAlertService) DeleteAlert(ctx context.Context, alertID int32, userID int32) (*v1.DeleteUserPriceAlertResponse, error) {
	return nil, nil
}
func (m *mockUserPriceAlertService) EvaluateAlerts(ctx context.Context) error { return nil }

// newAlertTestRouter wires a test router that injects a fixed userID via middleware.
func newAlertTestRouter(h *UserPriceAlertHandlers) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("userID", int32(42))
		c.Next()
	})
	r.GET("/api/v1/price-alerts", h.ListAlerts)
	return r
}

func doListAlertsRequest(t *testing.T, r *gin.Engine, query string) *httptest.ResponseRecorder {
	t.Helper()
	url := "/api/v1/price-alerts"
	if query != "" {
		url += "?" + query
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// TestListAlerts_StatusFilter_Active verifies status_filter=1 is passed to service as ACTIVE.
func TestListAlerts_StatusFilter_Active(t *testing.T) {
	var capturedFilter v1.AlertStatus

	svc := &mockUserPriceAlertService{
		listAlertsFunc: func(_ context.Context, _ int32, req *v1.ListUserPriceAlertsRequest) (*v1.ListUserPriceAlertsResponse, error) {
			capturedFilter = req.StatusFilter
			return &v1.ListUserPriceAlertsResponse{Success: true, Alerts: nil}, nil
		},
	}

	r := newAlertTestRouter(NewUserPriceAlertHandlers(svc))
	w := doListAlertsRequest(t, r, "status_filter=1&pagination.page=1&pagination.page_size=100")

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, v1.AlertStatus_ALERT_STATUS_ACTIVE, capturedFilter,
		"status_filter=1 must reach service as ALERT_STATUS_ACTIVE")
}

// TestListAlerts_StatusFilter_Triggered verifies status_filter=2 is passed to service as TRIGGERED.
func TestListAlerts_StatusFilter_Triggered(t *testing.T) {
	var capturedFilter v1.AlertStatus

	svc := &mockUserPriceAlertService{
		listAlertsFunc: func(_ context.Context, _ int32, req *v1.ListUserPriceAlertsRequest) (*v1.ListUserPriceAlertsResponse, error) {
			capturedFilter = req.StatusFilter
			return &v1.ListUserPriceAlertsResponse{Success: true, Alerts: nil}, nil
		},
	}

	r := newAlertTestRouter(NewUserPriceAlertHandlers(svc))
	w := doListAlertsRequest(t, r, "status_filter=2")

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, v1.AlertStatus_ALERT_STATUS_TRIGGERED, capturedFilter,
		"status_filter=2 must reach service as ALERT_STATUS_TRIGGERED")
}

// TestListAlerts_StatusFilter_Unspecified verifies missing status_filter returns all (0).
func TestListAlerts_StatusFilter_Unspecified(t *testing.T) {
	var capturedFilter v1.AlertStatus

	svc := &mockUserPriceAlertService{
		listAlertsFunc: func(_ context.Context, _ int32, req *v1.ListUserPriceAlertsRequest) (*v1.ListUserPriceAlertsResponse, error) {
			capturedFilter = req.StatusFilter
			return &v1.ListUserPriceAlertsResponse{Success: true, Alerts: nil}, nil
		},
	}

	r := newAlertTestRouter(NewUserPriceAlertHandlers(svc))
	w := doListAlertsRequest(t, r, "") // no query params

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, v1.AlertStatus_ALERT_STATUS_UNSPECIFIED, capturedFilter,
		"missing status_filter must result in UNSPECIFIED (0 = all alerts)")
}

// TestListAlerts_StatusFilter_Invalid verifies non-numeric status_filter defaults to 0 safely.
func TestListAlerts_StatusFilter_Invalid(t *testing.T) {
	var capturedFilter v1.AlertStatus

	svc := &mockUserPriceAlertService{
		listAlertsFunc: func(_ context.Context, _ int32, req *v1.ListUserPriceAlertsRequest) (*v1.ListUserPriceAlertsResponse, error) {
			capturedFilter = req.StatusFilter
			return &v1.ListUserPriceAlertsResponse{Success: true, Alerts: nil}, nil
		},
	}

	r := newAlertTestRouter(NewUserPriceAlertHandlers(svc))
	w := doListAlertsRequest(t, r, "status_filter=abc")

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, v1.AlertStatus_ALERT_STATUS_UNSPECIFIED, capturedFilter,
		"non-numeric status_filter must safely default to UNSPECIFIED")
}

// TestListAlerts_StatusFilter_Zero verifies status_filter=0 returns all alerts.
func TestListAlerts_StatusFilter_Zero(t *testing.T) {
	var capturedFilter v1.AlertStatus

	svc := &mockUserPriceAlertService{
		listAlertsFunc: func(_ context.Context, _ int32, req *v1.ListUserPriceAlertsRequest) (*v1.ListUserPriceAlertsResponse, error) {
			capturedFilter = req.StatusFilter
			return &v1.ListUserPriceAlertsResponse{Success: true, Alerts: nil}, nil
		},
	}

	r := newAlertTestRouter(NewUserPriceAlertHandlers(svc))
	w := doListAlertsRequest(t, r, "status_filter=0")

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, v1.AlertStatus_ALERT_STATUS_UNSPECIFIED, capturedFilter,
		"status_filter=0 must be UNSPECIFIED (all alerts)")
}

// TestListAlerts_ResponseShape verifies the handler returns success=true JSON.
func TestListAlerts_ResponseShape(t *testing.T) {
	svc := &mockUserPriceAlertService{}
	r := newAlertTestRouter(NewUserPriceAlertHandlers(svc))
	w := doListAlertsRequest(t, r, "")

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, true, body["success"])
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test -run TestListAlerts_StatusFilter -v ./handlers/
```

Expected: `FAIL` — `status_filter=1` captures `0` (UNSPECIFIED) because `ShouldBindQuery` doesn't bind it.

**Step 3: Write minimal implementation**

Replace `ListAlerts` in `src/go-backend/handlers/user_price_alert.go` (lines 47–67):

```go
// ListAlerts lists all price alerts for the authenticated user.
func (h *UserPriceAlertHandlers) ListAlerts(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse status_filter manually: ShouldBindQuery cannot bind proto enums
	// because proto-generated structs have json:"" tags but NOT form:"" tags.
	// Gin's query binding uses form tags; without them, the param is silently ignored.
	var req v1.ListUserPriceAlertsRequest
	if statusStr := c.Query("status_filter"); statusStr != "" {
		if statusInt, err := strconv.Atoi(statusStr); err == nil {
			req.StatusFilter = v1.AlertStatus(statusInt)
		}
		// On Atoi error (non-numeric): StatusFilter stays 0 (UNSPECIFIED = all). Safe.
	}

	// Bind remaining params (pagination) via ShouldBindQuery.
	// Pagination sub-fields (pagination.page, pagination.page_size) use dot-notation
	// which Gin does not support for nested proto structs without form tags.
	// The service's buildListOptions falls back to defaults when Pagination is nil — safe.
	// If pagination binding is verified broken in testing, add manual parsing here.
	if err := c.ShouldBindQuery(&req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.alertService.ListAlerts(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -run TestListAlerts -v ./handlers/
```

Expected: `PASS` — all 6 test cases pass.

**Step 5: Verify pagination binding behavior**

Check whether pagination actually binds. The service `buildListOptions` defaults to `{Limit:20, Offset:0}` when `Pagination == nil`. The frontend sends `pagination.page_size=100` — verify the default is acceptable (100 alerts per page), or add manual pagination parsing if needed.

Run the existing service tests to confirm no regression:

```bash
cd src/go-backend && go test -run TestListAlerts -v ./domain/service/
```

**Step 6: Lint check**

```bash
cd src/go-backend && task ci:backend-lint
```

Expected: no new lint errors.

**Step 7: Full backend build**

```bash
cd src/go-backend && go build ./...
```

**Step 8: Commit**

```
fix(price-alert): parse status_filter manually in ListAlerts handler

ShouldBindQuery cannot bind proto enum fields without form tags.
Parse status_filter via c.Query + strconv.Atoi; unknown/invalid
values safely default to 0 (UNSPECIFIED = all alerts returned).

Fixes filter tabs (Đang hoạt động / Đã kích hoạt) on alerts page.
```

---

### Task 2: Verify pagination binding + add manual parsing if broken

> **Prerequisite:** Task 1 must be merged first. This task is a conditional follow-up.

**Context:** The frontend sends `pagination.page=1&pagination.page_size=100`. Gin's `ShouldBindQuery` with a nested proto struct (`*v1.PaginationParams`) and no `form:` tags likely ignores these params too — leaving `Pagination == nil`, which causes `buildListOptions` to use its defaults (`Limit: 20, Offset: 0`).

**Impact of no fix:** The `pageSize=100` from the frontend is silently capped to 20. For users with <= 20 alerts this is invisible. For users with > 20 alerts, page 2+ would never appear (the frontend currently requests page 1 with size 100 for the alerts list — expecting all alerts in one shot).

**Files:**
- Modify: `src/go-backend/handlers/user_price_alert.go`
- Modify: `src/go-backend/handlers/user_price_alert_test.go`

**Step 1: Write failing test for pagination binding**

Add to `src/go-backend/handlers/user_price_alert_test.go`:

```go
// TestListAlerts_Pagination_PageSize verifies pagination.page_size is passed to service.
func TestListAlerts_Pagination_PageSize(t *testing.T) {
	var capturedPagination *v1.PaginationParams

	svc := &mockUserPriceAlertService{
		listAlertsFunc: func(_ context.Context, _ int32, req *v1.ListUserPriceAlertsRequest) (*v1.ListUserPriceAlertsResponse, error) {
			capturedPagination = req.Pagination
			return &v1.ListUserPriceAlertsResponse{Success: true, Alerts: nil}, nil
		},
	}

	r := newAlertTestRouter(NewUserPriceAlertHandlers(svc))
	w := doListAlertsRequest(t, r, "pagination.page=1&pagination.page_size=100")

	assert.Equal(t, http.StatusOK, w.Code)
	require.NotNil(t, capturedPagination, "pagination must not be nil when sent in query")
	assert.Equal(t, int64(1), capturedPagination.GetPage())
	assert.Equal(t, int64(100), capturedPagination.GetPageSize())
}
```

**Step 2: Run to detect current behavior**

```bash
cd src/go-backend && go test -run TestListAlerts_Pagination_PageSize -v ./handlers/
```

- If PASS: pagination binds correctly — no further action needed, skip to Step 6.
- If FAIL: proceed with Steps 3–5.

**Step 3: Add manual pagination parsing (only if Step 2 fails)**

Add to `ListAlerts` in `user_price_alert.go`, before `ShouldBindQuery`:

```go
// Parse pagination manually (proto nested struct has no form: tags for ShouldBindQuery).
page, _ := strconv.ParseInt(c.DefaultQuery("pagination.page", "1"), 10, 64)
pageSize, _ := strconv.ParseInt(c.DefaultQuery("pagination.page_size", "20"), 10, 64)
if page < 1 {
    page = 1
}
if pageSize < 1 || pageSize > 100 {
    pageSize = 20
}
req.Pagination = &v1.PaginationParams{
    Page:     page,
    PageSize: pageSize,
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -run TestListAlerts -v ./handlers/
```

**Step 5: Lint + build**

```bash
cd src/go-backend && task ci:backend-lint && go build ./...
```

**Step 6: Commit (only if pagination change was needed)**

```
fix(price-alert): parse pagination manually in ListAlerts handler

Proto nested struct PaginationParams has no form: tags for Gin query
binding. Parse pagination.page and pagination.page_size via c.Query.
This allows users with >20 alerts to see all results (pageSize=100).
```

---

### Task 3: Playwright E2E — verify filter tabs work end-to-end

**Files:**
- Modify: `src/wj-client/tests/e2e/price-alerts-settings-flow.spec.ts`

**Step 1: Locate existing E2E spec**

```bash
ls src/wj-client/tests/e2e/price-alerts-settings-flow.spec.ts
```

**Step 2: Review current spec for filter tab coverage**

Read the spec and check whether it has any test that:
- Creates alerts with different statuses
- Clicks a filter tab
- Asserts the list changes

**Step 3: Add filter tab smoke test**

Add to `price-alerts-settings-flow.spec.ts`:

```typescript
test('filter tabs change displayed alerts', async ({ page }) => {
  // Navigate to alerts settings page
  await page.goto('/en/dashboard/settings/alerts');
  await page.waitForLoadState('networkidle');

  // Verify the three tabs are present
  await expect(page.getByRole('button', { name: /Tất cả/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Đang hoạt động/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Đã kích hoạt/i })).toBeVisible();

  // Click "Đang hoạt động" — verify network request includes status_filter=1
  const [request] = await Promise.all([
    page.waitForRequest(req => req.url().includes('status_filter=1')),
    page.getByRole('button', { name: /Đang hoạt động/i }).click(),
  ]);
  expect(request).toBeTruthy();

  // Click "Đã kích hoạt" — verify network request includes status_filter=2
  const [request2] = await Promise.all([
    page.waitForRequest(req => req.url().includes('status_filter=2')),
    page.getByRole('button', { name: /Đã kích hoạt/i }).click(),
  ]);
  expect(request2).toBeTruthy();
});
```

**Step 4: Run E2E spec**

```bash
cd src/wj-client && npx playwright test tests/e2e/price-alerts-settings-flow.spec.ts --reporter=list
```

Note: The E2E requires an authenticated session. If auth is not set up in the test environment, document the result and skip — the unit test coverage in Task 1 is sufficient for this fix.

**Step 5: Commit**

```
test(price-alert): add E2E smoke test for filter tab network requests
```

---

## Task Order Summary

| Task | Parallelizable? | Prerequisite |
|------|----------------|--------------|
| Task 1: Fix `status_filter` binding | No (core fix) | None |
| Task 2: Fix pagination binding | After Task 1 | Task 1 |
| Task 3: E2E test | After Task 1 | Task 1 |

Tasks 2 and 3 can be done in parallel after Task 1.
