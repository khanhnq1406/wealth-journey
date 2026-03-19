package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/types"
	v1 "wealthjourney/protobuf/v1"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// mockAdminService implements service.AdminService for handler testing.
type mockAdminService struct {
	listUsersFunc      func(ctx context.Context, search string, params types.PaginationParams) (*v1.AdminListUsersResponse, error)
	toggleAdminFunc    func(ctx context.Context, adminUserID int32, req *v1.AdminToggleRoleRequest) (*v1.AdminToggleRoleResponse, error)
	listFeedbackFunc   func(ctx context.Context, statusFilter int32, params types.PaginationParams) (*v1.AdminListFeedbackResponse, error)
	updateFeedbackFunc func(ctx context.Context, feedbackID int32, req *v1.AdminUpdateFeedbackRequest) (*v1.AdminUpdateFeedbackResponse, error)
	deleteFeedbackFunc func(ctx context.Context, feedbackID int32) (*v1.AdminDeleteFeedbackResponse, error)
}

func (m *mockAdminService) ListUsers(ctx context.Context, search string, params types.PaginationParams) (*v1.AdminListUsersResponse, error) {
	if m.listUsersFunc != nil {
		return m.listUsersFunc(ctx, search, params)
	}
	return nil, nil
}

func (m *mockAdminService) ToggleAdminRole(ctx context.Context, adminUserID int32, req *v1.AdminToggleRoleRequest) (*v1.AdminToggleRoleResponse, error) {
	if m.toggleAdminFunc != nil {
		return m.toggleAdminFunc(ctx, adminUserID, req)
	}
	return nil, nil
}

func (m *mockAdminService) ListFeedback(ctx context.Context, statusFilter int32, params types.PaginationParams) (*v1.AdminListFeedbackResponse, error) {
	if m.listFeedbackFunc != nil {
		return m.listFeedbackFunc(ctx, statusFilter, params)
	}
	return nil, nil
}

func (m *mockAdminService) UpdateFeedback(ctx context.Context, feedbackID int32, req *v1.AdminUpdateFeedbackRequest) (*v1.AdminUpdateFeedbackResponse, error) {
	if m.updateFeedbackFunc != nil {
		return m.updateFeedbackFunc(ctx, feedbackID, req)
	}
	return nil, nil
}

func (m *mockAdminService) DeleteFeedback(ctx context.Context, feedbackID int32) (*v1.AdminDeleteFeedbackResponse, error) {
	if m.deleteFeedbackFunc != nil {
		return m.deleteFeedbackFunc(ctx, feedbackID)
	}
	return nil, nil
}

func (m *mockAdminService) Broadcast(ctx context.Context, adminUserID int32, title, message string) (int32, error) {
	return 0, nil
}

// --- AdminUserHandler tests ---

func TestAdminUserHandler_ListUsers_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := &mockAdminService{
		listUsersFunc: func(ctx context.Context, search string, params types.PaginationParams) (*v1.AdminListUsersResponse, error) {
			return &v1.AdminListUsersResponse{
				Success: true,
				Message: "Users retrieved successfully",
				Users: []*v1.AdminUserItem{
					{Id: 1, Name: "Alice", Email: "alice@test.com", IsAdmin: true},
				},
				Pagination: &v1.PaginationResult{TotalCount: 1, TotalPages: 1, Page: 1, PageSize: 10},
			}, nil
		},
	}

	handler := NewAdminUserHandler(mockSvc)
	router := gin.New()
	router.GET("/api/v1/admin/users", handler.ListUsers)

	req, _ := http.NewRequest("GET", "/api/v1/admin/users?page=1&page_size=10", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)

	var body map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &body)
	assert.NoError(t, err)
	assert.Equal(t, true, body["success"])

	users := body["users"].([]interface{})
	assert.Len(t, users, 1)
}

func TestAdminUserHandler_ListUsers_WithSearchParam(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var capturedSearch string
	mockSvc := &mockAdminService{
		listUsersFunc: func(ctx context.Context, search string, params types.PaginationParams) (*v1.AdminListUsersResponse, error) {
			capturedSearch = search
			return &v1.AdminListUsersResponse{
				Success:    true,
				Users:      []*v1.AdminUserItem{},
				Pagination: &v1.PaginationResult{TotalCount: 0, TotalPages: 0, Page: 1, PageSize: 10},
			}, nil
		},
	}

	handler := NewAdminUserHandler(mockSvc)
	router := gin.New()
	router.GET("/api/v1/admin/users", handler.ListUsers)

	req, _ := http.NewRequest("GET", "/api/v1/admin/users?search=alice", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Equal(t, "alice", capturedSearch)
}

func TestAdminUserHandler_ListUsers_ServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := &mockAdminService{
		listUsersFunc: func(ctx context.Context, search string, params types.PaginationParams) (*v1.AdminListUsersResponse, error) {
			return nil, apperrors.NewValidationError("search query must be 100 characters or less")
		},
	}

	handler := NewAdminUserHandler(mockSvc)
	router := gin.New()
	router.GET("/api/v1/admin/users", handler.ListUsers)

	req, _ := http.NewRequest("GET", "/api/v1/admin/users", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusBadRequest, resp.Code)
}

func TestAdminUserHandler_ToggleRole_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var capturedAdminID int32
	var capturedReq *v1.AdminToggleRoleRequest
	mockSvc := &mockAdminService{
		toggleAdminFunc: func(ctx context.Context, adminUserID int32, req *v1.AdminToggleRoleRequest) (*v1.AdminToggleRoleResponse, error) {
			capturedAdminID = adminUserID
			capturedReq = req
			return &v1.AdminToggleRoleResponse{
				Success: true,
				Message: "Admin role granted successfully",
				User:    &v1.AdminUserItem{Id: 2, Name: "Bob", IsAdmin: true},
			}, nil
		},
	}

	handler := NewAdminUserHandler(mockSvc)
	router := gin.New()
	router.PUT("/api/v1/admin/users/:id/role", func(c *gin.Context) {
		c.Set("user_id", int32(1))
		handler.ToggleRole(c)
	})

	body, _ := json.Marshal(map[string]interface{}{"isAdmin": true})
	req, _ := http.NewRequest("PUT", "/api/v1/admin/users/2/role", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Equal(t, int32(1), capturedAdminID)
	assert.Equal(t, int32(2), capturedReq.UserId) // Path :id overrides
}

func TestAdminUserHandler_ToggleRole_NoAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewAdminUserHandler(&mockAdminService{})
	router := gin.New()
	// No user_id set in context
	router.PUT("/api/v1/admin/users/:id/role", handler.ToggleRole)

	body, _ := json.Marshal(map[string]interface{}{"isAdmin": true})
	req, _ := http.NewRequest("PUT", "/api/v1/admin/users/2/role", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusUnauthorized, resp.Code)
}

func TestAdminUserHandler_ToggleRole_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewAdminUserHandler(&mockAdminService{})
	router := gin.New()
	router.PUT("/api/v1/admin/users/:id/role", func(c *gin.Context) {
		c.Set("user_id", int32(1))
		handler.ToggleRole(c)
	})

	body, _ := json.Marshal(map[string]interface{}{"isAdmin": true})
	req, _ := http.NewRequest("PUT", "/api/v1/admin/users/abc/role", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusBadRequest, resp.Code)
}

func TestAdminUserHandler_ToggleRole_PathOverridesBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var capturedReq *v1.AdminToggleRoleRequest
	mockSvc := &mockAdminService{
		toggleAdminFunc: func(ctx context.Context, adminUserID int32, req *v1.AdminToggleRoleRequest) (*v1.AdminToggleRoleResponse, error) {
			capturedReq = req
			return &v1.AdminToggleRoleResponse{
				Success: true,
				User:    &v1.AdminUserItem{Id: 5, IsAdmin: true},
			}, nil
		},
	}

	handler := NewAdminUserHandler(mockSvc)
	router := gin.New()
	router.PUT("/api/v1/admin/users/:id/role", func(c *gin.Context) {
		c.Set("user_id", int32(1))
		handler.ToggleRole(c)
	})

	// Body says userId=999, but path says :id=5 — path should win
	body, _ := json.Marshal(map[string]interface{}{"userId": 999, "isAdmin": true})
	req, _ := http.NewRequest("PUT", "/api/v1/admin/users/5/role", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Equal(t, int32(5), capturedReq.UserId) // Path :id overrides body userId
}

func TestAdminUserHandler_ToggleRole_Forbidden(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := &mockAdminService{
		toggleAdminFunc: func(ctx context.Context, adminUserID int32, req *v1.AdminToggleRoleRequest) (*v1.AdminToggleRoleResponse, error) {
			return nil, apperrors.NewForbiddenError("cannot modify your own admin role")
		},
	}

	handler := NewAdminUserHandler(mockSvc)
	router := gin.New()
	router.PUT("/api/v1/admin/users/:id/role", func(c *gin.Context) {
		c.Set("user_id", int32(1))
		handler.ToggleRole(c)
	})

	body, _ := json.Marshal(map[string]interface{}{"isAdmin": false})
	req, _ := http.NewRequest("PUT", "/api/v1/admin/users/1/role", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusForbidden, resp.Code)
}

// --- AdminFeedbackHandler tests ---

func TestAdminFeedbackHandler_ListFeedback_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := &mockAdminService{
		listFeedbackFunc: func(ctx context.Context, statusFilter int32, params types.PaginationParams) (*v1.AdminListFeedbackResponse, error) {
			return &v1.AdminListFeedbackResponse{
				Success: true,
				Feedback: []*v1.AdminFeedbackItem{
					{Id: 1, Subject: "Bug", Status: v1.FeedbackStatus_FEEDBACK_STATUS_PENDING},
				},
				Pagination: &v1.PaginationResult{TotalCount: 1, TotalPages: 1, Page: 1, PageSize: 10},
			}, nil
		},
	}

	handler := NewAdminFeedbackHandler(mockSvc)
	router := gin.New()
	router.GET("/api/v1/admin/feedback", handler.ListFeedback)

	req, _ := http.NewRequest("GET", "/api/v1/admin/feedback", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)

	var body map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &body)
	assert.NoError(t, err)
	assert.Equal(t, true, body["success"])
}

func TestAdminFeedbackHandler_ListFeedback_WithStatusFilter(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var capturedStatus int32
	mockSvc := &mockAdminService{
		listFeedbackFunc: func(ctx context.Context, statusFilter int32, params types.PaginationParams) (*v1.AdminListFeedbackResponse, error) {
			capturedStatus = statusFilter
			return &v1.AdminListFeedbackResponse{
				Success:    true,
				Feedback:   []*v1.AdminFeedbackItem{},
				Pagination: &v1.PaginationResult{},
			}, nil
		},
	}

	handler := NewAdminFeedbackHandler(mockSvc)
	router := gin.New()
	router.GET("/api/v1/admin/feedback", handler.ListFeedback)

	req, _ := http.NewRequest("GET", "/api/v1/admin/feedback?status=2", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Equal(t, int32(2), capturedStatus)
}

func TestAdminFeedbackHandler_ListFeedback_InvalidStatusFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var capturedStatus int32
	mockSvc := &mockAdminService{
		listFeedbackFunc: func(ctx context.Context, statusFilter int32, params types.PaginationParams) (*v1.AdminListFeedbackResponse, error) {
			capturedStatus = statusFilter
			return &v1.AdminListFeedbackResponse{
				Success:    true,
				Feedback:   []*v1.AdminFeedbackItem{},
				Pagination: &v1.PaginationResult{},
			}, nil
		},
	}

	handler := NewAdminFeedbackHandler(mockSvc)
	router := gin.New()
	router.GET("/api/v1/admin/feedback", handler.ListFeedback)

	// Non-numeric status falls back to 0
	req, _ := http.NewRequest("GET", "/api/v1/admin/feedback?status=abc", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Equal(t, int32(0), capturedStatus) // Falls back to default 0
}

func TestAdminFeedbackHandler_UpdateFeedback_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var capturedID int32
	mockSvc := &mockAdminService{
		updateFeedbackFunc: func(ctx context.Context, feedbackID int32, req *v1.AdminUpdateFeedbackRequest) (*v1.AdminUpdateFeedbackResponse, error) {
			capturedID = feedbackID
			return &v1.AdminUpdateFeedbackResponse{
				Success:  true,
				Message:  "Feedback updated successfully",
				Feedback: &v1.AdminFeedbackItem{Id: feedbackID, Status: v1.FeedbackStatus(req.Status)},
			}, nil
		},
	}

	handler := NewAdminFeedbackHandler(mockSvc)
	router := gin.New()
	router.PUT("/api/v1/admin/feedback/:id", handler.UpdateFeedback)

	body, _ := json.Marshal(map[string]interface{}{"status": 2, "adminNote": "reviewed"})
	req, _ := http.NewRequest("PUT", "/api/v1/admin/feedback/1", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Equal(t, int32(1), capturedID)
}

func TestAdminFeedbackHandler_UpdateFeedback_PathOverridesBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var capturedID int32
	mockSvc := &mockAdminService{
		updateFeedbackFunc: func(ctx context.Context, feedbackID int32, req *v1.AdminUpdateFeedbackRequest) (*v1.AdminUpdateFeedbackResponse, error) {
			capturedID = feedbackID
			return &v1.AdminUpdateFeedbackResponse{
				Success:  true,
				Feedback: &v1.AdminFeedbackItem{Id: feedbackID},
			}, nil
		},
	}

	handler := NewAdminFeedbackHandler(mockSvc)
	router := gin.New()
	router.PUT("/api/v1/admin/feedback/:id", handler.UpdateFeedback)

	// Body says feedbackId=999, but path says :id=5 — path should win
	body, _ := json.Marshal(map[string]interface{}{"feedbackId": 999, "status": 2, "adminNote": ""})
	req, _ := http.NewRequest("PUT", "/api/v1/admin/feedback/5", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.Equal(t, int32(5), capturedID) // Path :id is authoritative
}

func TestAdminFeedbackHandler_UpdateFeedback_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewAdminFeedbackHandler(&mockAdminService{})
	router := gin.New()
	router.PUT("/api/v1/admin/feedback/:id", handler.UpdateFeedback)

	body, _ := json.Marshal(map[string]interface{}{"status": 2})
	req, _ := http.NewRequest("PUT", "/api/v1/admin/feedback/abc", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusBadRequest, resp.Code)
}

func TestAdminFeedbackHandler_DeleteFeedback_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := &mockAdminService{
		deleteFeedbackFunc: func(ctx context.Context, feedbackID int32) (*v1.AdminDeleteFeedbackResponse, error) {
			return &v1.AdminDeleteFeedbackResponse{
				Success: true,
				Message: "Feedback deleted successfully",
			}, nil
		},
	}

	handler := NewAdminFeedbackHandler(mockSvc)
	router := gin.New()
	router.DELETE("/api/v1/admin/feedback/:id", handler.DeleteFeedback)

	req, _ := http.NewRequest("DELETE", "/api/v1/admin/feedback/1", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)

	var body map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &body)
	assert.NoError(t, err)
	assert.Equal(t, true, body["success"])
	assert.Equal(t, "Feedback deleted successfully", body["message"])
}

func TestAdminFeedbackHandler_DeleteFeedback_ServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := &mockAdminService{
		deleteFeedbackFunc: func(ctx context.Context, feedbackID int32) (*v1.AdminDeleteFeedbackResponse, error) {
			return nil, apperrors.NewNotFoundError("feedback")
		},
	}

	handler := NewAdminFeedbackHandler(mockSvc)
	router := gin.New()
	router.DELETE("/api/v1/admin/feedback/:id", handler.DeleteFeedback)

	req, _ := http.NewRequest("DELETE", fmt.Sprintf("/api/v1/admin/feedback/%d", 99), nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusNotFound, resp.Code)
}
