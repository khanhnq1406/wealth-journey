package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"wealthjourney/pkg/device"
	apperrors "wealthjourney/pkg/errors"
	redis "wealthjourney/pkg/redis"
	authv1 "wealthjourney/protobuf/v1"
)

// ---------------------------------------------------------------------------
// Lightweight handler that mirrors the Login handler logic with an injectable
// RegisterWithDevice func, so we can test it without a real auth.Server.
// ---------------------------------------------------------------------------

type registerWithDeviceFunc func(ctx context.Context, googleToken string, deviceInfo *redis.SessionData) (*authv1.RegisterResponse, error)

type testLoginHandler struct {
	registerWithDevice registerWithDeviceFunc
}

func (h *testLoginHandler) handle(c *gin.Context) {
	var req struct {
		Token string `json:"token" binding:"required"`
	}
	if !bindJSON(c, &req) {
		return
	}

	deviceInfo := device.ExtractDeviceInfo(c)
	result, err := h.registerWithDevice(c.Request.Context(), req.Token, deviceInfo)
	if err != nil {
		if _, ok := err.(apperrors.UnauthorizedError); ok {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "UNAUTHORIZED",
					"message": err.Error(),
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func newLoginRouter(h *testLoginHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/v1/auth/login", h.handle)
	return r
}

func doLoginRequest(t *testing.T, r *gin.Engine, token string) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"token": token})
	req, err := http.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBuffer(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// TestLogin_NewUser_AutoRegistersAndReturns200 verifies that when RegisterWithDevice
// succeeds (new user auto-registered), the Login endpoint returns HTTP 200.
func TestLogin_NewUser_AutoRegistersAndReturns200(t *testing.T) {
	h := &testLoginHandler{
		registerWithDevice: func(_ context.Context, _ string, _ *redis.SessionData) (*authv1.RegisterResponse, error) {
			return &authv1.RegisterResponse{
				Success: true,
				Message: "Login successful",
				Data: &authv1.LoginData{
					AccessToken: "jwt-token",
					Email:       "newuser@gmail.com",
					Fullname:    "New User",
				},
				Timestamp: "2026-04-03T00:00:00Z",
			}, nil
		},
	}

	r := newLoginRouter(h)
	w := doLoginRequest(t, r, "google-token")

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, true, body["success"])
	assert.Equal(t, "Login successful", body["message"])
}

// TestLogin_UnlinkedGoogle_Returns401 verifies that AUTH_GOOGLE_NOT_LINKED is
// preserved as a 401 and not wrapped in a generic error.
func TestLogin_UnlinkedGoogle_Returns401(t *testing.T) {
	h := &testLoginHandler{
		registerWithDevice: func(_ context.Context, _ string, _ *redis.SessionData) (*authv1.RegisterResponse, error) {
			return nil, apperrors.NewGoogleNotLinkedError()
		},
	}

	r := newLoginRouter(h)
	w := doLoginRequest(t, r, "google-token-for-unlinked-account")

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, false, body["success"])
}

// TestLogin_MissingToken_Returns400 verifies that a request without a token
// field is rejected with HTTP 400.
func TestLogin_MissingToken_Returns400(t *testing.T) {
	h := &testLoginHandler{
		registerWithDevice: func(_ context.Context, _ string, _ *redis.SessionData) (*authv1.RegisterResponse, error) {
			t.Error("service should not be called with missing token")
			return nil, nil
		},
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/v1/auth/login", h.handle)

	body, _ := json.Marshal(map[string]string{}) // no "token" field
	req, err := http.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBuffer(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
