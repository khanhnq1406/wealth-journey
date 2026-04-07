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
		c.Set("user_id", int32(42))
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
