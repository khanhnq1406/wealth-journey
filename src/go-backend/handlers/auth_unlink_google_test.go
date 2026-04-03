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

	apperrors "wealthjourney/pkg/errors"
	authv1 "wealthjourney/protobuf/v1"
)

// ---------------------------------------------------------------------------
// Mock for UnlinkGoogle service call
// ---------------------------------------------------------------------------

// unlinkGoogleFunc is the injectable function for mocking UnlinkGoogle behaviour.
type unlinkGoogleFunc func(ctx context.Context, userID int32, sessionID string) (*authv1.UnlinkGoogleResponse, error)

// testUnlinkGoogleHandler is a lightweight handler wired against a mock func,
// mirroring the real UnlinkGoogle handler logic without importing auth.Server.
type testUnlinkGoogleHandler struct {
	unlinkGoogle unlinkGoogleFunc
}

func (h *testUnlinkGoogleHandler) handle(c *gin.Context) {
	// Simulate AuthMiddleware setting user_id
	rawUID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "User not authenticated"})
		return
	}
	userID, ok := rawUID.(int32)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "User not authenticated"})
		return
	}

	// ExtractBearerToken — the real helper writes its own error
	token, ok := ExtractBearerToken(c)
	if !ok {
		return
	}

	_ = token // In tests we supply a fixed sessionID via context; no real JWT parsing needed.
	sessionID := "test-session-id"

	result, err := h.unlinkGoogle(c.Request.Context(), userID, sessionID)
	if err != nil {
		// Translate to HTTP status by inspecting error type
		var status int
		switch err.(type) {
		case apperrors.ValidationError:
			status = http.StatusBadRequest
		case apperrors.UnauthorizedError:
			status = http.StatusUnauthorized
		default:
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   result.Success,
		"message":   result.Message,
		"timestamp": result.Timestamp,
	})
}

// ---------------------------------------------------------------------------
// Router helpers
// ---------------------------------------------------------------------------

// newUnlinkGoogleRouter builds a Gin router with a simulated auth middleware
// that injects userID into the context (or skips injection to simulate 401).
func newUnlinkGoogleRouter(injectUserID *int32, h *testUnlinkGoogleHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	r.POST("/api/v1/auth/unlink-google", func(c *gin.Context) {
		// Simulate AuthMiddleware
		if injectUserID != nil {
			c.Set("user_id", *injectUserID)
		}
		h.handle(c)
	})

	return r
}

func doUnlinkGoogleRequest(t *testing.T, r *gin.Engine, authHeader string) *httptest.ResponseRecorder {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, "/api/v1/auth/unlink-google", nil)
	require.NoError(t, err)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// TestUnlinkGoogle_Handler_Unauthorized verifies that a request without an
// Authorization header is rejected with HTTP 401.
func TestUnlinkGoogle_Handler_Unauthorized(t *testing.T) {
	// No injected userID (simulates missing/invalid JWT — AuthMiddleware blocks)
	h := &testUnlinkGoogleHandler{
		unlinkGoogle: func(_ context.Context, _ int32, _ string) (*authv1.UnlinkGoogleResponse, error) {
			t.Error("service should not be called when unauthenticated")
			return nil, nil
		},
	}

	r := newUnlinkGoogleRouter(nil /* no user_id injected */, h)
	w := doUnlinkGoogleRequest(t, r, "") // No Authorization header

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.NotNil(t, body["error"], "response should contain an error field")
}

// TestUnlinkGoogle_Handler_NoPasswordSet verifies that a user who has Google
// linked but has not set a password receives HTTP 400.
func TestUnlinkGoogle_Handler_NoPasswordSet(t *testing.T) {
	uid := int32(42)

	h := &testUnlinkGoogleHandler{
		unlinkGoogle: func(_ context.Context, userID int32, _ string) (*authv1.UnlinkGoogleResponse, error) {
			assert.Equal(t, uid, userID)
			return nil, apperrors.NewValidationError("Please set a password before disconnecting Google")
		},
	}

	r := newUnlinkGoogleRouter(&uid, h)
	w := doUnlinkGoogleRequest(t, r, "Bearer valid-jwt-token")

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, false, body["success"])
	assert.NotEmpty(t, body["error"])
}

// TestUnlinkGoogle_Handler_Success verifies that a user with both Google and a
// password set receives HTTP 200 with success=true.
func TestUnlinkGoogle_Handler_Success(t *testing.T) {
	uid := int32(7)

	h := &testUnlinkGoogleHandler{
		unlinkGoogle: func(_ context.Context, userID int32, sessionID string) (*authv1.UnlinkGoogleResponse, error) {
			assert.Equal(t, uid, userID)
			assert.NotEmpty(t, sessionID)
			return &authv1.UnlinkGoogleResponse{
				Success:   true,
				Message:   "Google account disconnected successfully",
				Timestamp: "2026-04-03T00:00:00Z",
			}, nil
		},
	}

	r := newUnlinkGoogleRouter(&uid, h)
	w := doUnlinkGoogleRequest(t, r, "Bearer valid-jwt-token")

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, true, body["success"])
	assert.Equal(t, "Google account disconnected successfully", body["message"])
	assert.NotEmpty(t, body["timestamp"])
}
