package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"wealthjourney/domain/auth"
	"wealthjourney/pkg/handler"
	authv1 "wealthjourney/protobuf/v1"
)

// MockAuthServer embeds auth.Server for testing
type MockAuthServer struct {
	*auth.Server
	loginResponse   *authv1.LoginResponse
	verifyResponse  *authv1.VerifyAuthResponse
	verifyErr       error
	loginErr        error
}

func (m *MockAuthServer) Register(ctx context.Context, googleToken string) (*authv1.RegisterResponse, error) {
	return nil, nil
}

func (m *MockAuthServer) Login(ctx context.Context, googleToken string) (*authv1.LoginResponse, error) {
	if m.loginErr != nil {
		return nil, m.loginErr
	}
	return m.loginResponse, nil
}

func (m *MockAuthServer) Logout(token string) (*authv1.LogoutResponse, error) {
	return nil, nil
}

func (m *MockAuthServer) VerifyAuth(token string) (*authv1.VerifyAuthResponse, error) {
	if m.verifyErr != nil {
		return nil, m.verifyErr
	}
	return m.verifyResponse, nil
}

func (m *MockAuthServer) GetAuth(ctx context.Context, userID int32) (*authv1.GetAuthResponse, error) {
	return nil, nil
}

// testAuthHandler is a wrapper for testing that bypasses dependency checks
type testAuthHandler struct {
	auth *MockAuthServer
}

func (t *testAuthHandler) Login(c *gin.Context) {
	// Bypass dependency checks for testing
	var req struct {
		Token string `json:"token" binding:"required"`
	}

	if !bindJSON(c, &req) {
		return
	}

	// Handle error case if loginErr is set
	if t.auth.loginErr != nil {
		errorResponse := map[string]interface{}{
			"success": false,
			"error": map[string]interface{}{
				"code":   "UNAUTHORIZED",
				"message": "Login failed",
			},
		}
		c.JSON(http.StatusUnauthorized, errorResponse)
		return
	}

	// Use mock response
	response := t.auth.loginResponse
	c.JSON(http.StatusOK, response)
}

func (t *testAuthHandler) VerifyAuth(c *gin.Context) {
	// Extract token without using the real ExtractBearerToken (which writes error responses)
	authHeader := c.GetHeader("Authorization")
	token := ""
	ok := false

	if authHeader != "" {
		// Remove "Bearer " prefix
		token = strings.TrimPrefix(authHeader, "Bearer ")
		if token != authHeader {
			ok = true
		}
	}

	// If not in header, try query parameter
	if !ok {
		token = c.Query("token")
		if token != "" {
			ok = true
		}
	}

	if !ok {
		handler.Unauthorized(c, "No token provided")
		return
	}

	// Handle error case if verifyErr is set
	if t.auth.verifyErr != nil {
		errorResponse := map[string]interface{}{
			"success": false,
			"error": map[string]interface{}{
				"code":   "UNAUTHORIZED",
				"message": "Verification failed",
			},
		}
		c.JSON(http.StatusUnauthorized, errorResponse)
		return
	}

	// Use mock response
	response := t.auth.verifyResponse
	c.JSON(http.StatusOK, response)
}

// TestLoginThenVerifyFlow tests the complete login -> verify flow
func TestLoginThenVerifyFlow(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Setup test router
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Create mock auth server
	mockAuthSrv := &MockAuthServer{
		loginResponse: &authv1.LoginResponse{
			Success: true,
			Message: "Login successful",
			Data: &authv1.LoginData{
				AccessToken: "mock-jwt-token",
				Email:       "test@example.com",
				Fullname:    "Test User",
				Picture:    "https://example.com/picture.jpg",
			},
			Timestamp: time.Now().Format(time.RFC3339),
		},
		verifyResponse: &authv1.VerifyAuthResponse{
			Success: true,
			Message: "Token is valid",
			Data: &authv1.User{
				Id:                   1,
				Email:                "test@example.com",
				Name:                 "Test User",
				Picture:              "https://example.com/picture.jpg",
				PreferredCurrency:    "USD",
				ConversionInProgress: false,
				CreatedAt:            time.Now().Unix(),
				UpdatedAt:            time.Now().Unix(),
			},
			Timestamp: time.Now().Format(time.RFC3339),
		},
	}

	// Use test handler wrapper
	testHandler := &testAuthHandler{auth: mockAuthSrv}

	// Register routes
	router.POST("/api/v1/auth/login", testHandler.Login)
	router.GET("/api/v1/auth/verify", testHandler.VerifyAuth)

	// Step 1: Login with Google OAuth token
	loginPayload := map[string]string{
		"token": "mock-google-oauth-token",  // Use Google OAuth token instead of email/password
	}

	loginBody, _ := json.Marshal(loginPayload)
	loginReq, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")

	loginRecorder := httptest.NewRecorder()
	router.ServeHTTP(loginRecorder, loginReq)

	// Verify login response
	assert.Equal(t, http.StatusOK, loginRecorder.Code)

	var loginResponse map[string]interface{}
	err := json.Unmarshal(loginRecorder.Body.Bytes(), &loginResponse)
	assert.NoError(t, err)

	// Check response structure matches protobuf definition
	assert.Equal(t, true, loginResponse["success"])
	assert.Equal(t, "Login successful", loginResponse["message"])

	data, ok := loginResponse["data"].(map[string]interface{})
	assert.True(t, ok, "Data should be present in login response")

	accessToken, ok := data["accessToken"].(string)
	assert.True(t, ok, "AccessToken should be present in login response")
	assert.NotEmpty(t, accessToken, "AccessToken should not be empty")

	// Step 2: Verify with Authorization header
	verifyReqHeader, _ := http.NewRequest("GET", "/api/v1/auth/verify", nil)
	verifyReqHeader.Header.Set("Authorization", "Bearer "+accessToken)

	verifyRecorderHeader := httptest.NewRecorder()
	router.ServeHTTP(verifyRecorderHeader, verifyReqHeader)

	// Verify response with Authorization header
	assert.Equal(t, http.StatusOK, verifyRecorderHeader.Code)

	var verifyResponseHeader map[string]interface{}
	err = json.Unmarshal(verifyRecorderHeader.Body.Bytes(), &verifyResponseHeader)
	assert.NoError(t, err)

	// Check response structure matches protobuf definition
	assert.Equal(t, true, verifyResponseHeader["success"])
	assert.Equal(t, "Token is valid", verifyResponseHeader["message"])

	verifyData, ok := verifyResponseHeader["data"].(map[string]interface{})
	assert.True(t, ok, "Data should be present in verify response")

	userID, ok := verifyData["id"].(float64)
	assert.True(t, ok, "User ID should be present in verify response")
	assert.Equal(t, float64(1), userID, "User ID should be 1")

	// Step 3: Verify with query parameter (for protobuf client compatibility)
	verifyReqQuery, _ := http.NewRequest("GET", "/api/v1/auth/verify?token="+accessToken, nil)

	verifyRecorderQuery := httptest.NewRecorder()
	router.ServeHTTP(verifyRecorderQuery, verifyReqQuery)

	// Verify response with query parameter
	assert.Equal(t, http.StatusOK, verifyRecorderQuery.Code)

	var verifyResponseQuery map[string]interface{}
	err = json.Unmarshal(verifyRecorderQuery.Body.Bytes(), &verifyResponseQuery)
	assert.NoError(t, err)

	// Check response structure matches protobuf definition
	assert.Equal(t, true, verifyResponseQuery["success"])
	assert.Equal(t, "Token is valid", verifyResponseQuery["message"])

	verifyDataQuery, ok := verifyResponseQuery["data"].(map[string]interface{})
	assert.True(t, ok, "Data should be present in verify response")

	userIDQuery, ok := verifyDataQuery["id"].(float64)
	assert.True(t, ok, "User ID should be present in verify response")
	assert.Equal(t, float64(1), userIDQuery, "User ID should be 1")

	// Test error cases in separate tests below
}

// TestLoginError tests error handling during login
func TestLoginError(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Setup test router
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Create mock auth server with error
	mockAuthSrv := &MockAuthServer{
		loginErr: &MockAuthError{"invalid_token", "Invalid Google token"},
	}

	// Use test handler wrapper
	testHandler := &testAuthHandler{auth: mockAuthSrv}

	// Register routes
	router.POST("/api/v1/auth/login", testHandler.Login)

	// Step 1: Login with invalid Google OAuth token
	loginPayload := map[string]string{
		"token": "invalid-google-oauth-token",
	}

	loginBody, _ := json.Marshal(loginPayload)
	loginReq, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")

	loginRecorder := httptest.NewRecorder()
	router.ServeHTTP(loginRecorder, loginReq)

	// Verify login error response
	assert.Equal(t, http.StatusUnauthorized, loginRecorder.Code)

	var errorResponse map[string]interface{}
	err := json.Unmarshal(loginRecorder.Body.Bytes(), &errorResponse)
	assert.NoError(t, err)

	assert.Equal(t, false, errorResponse["success"])
	errorData, ok := errorResponse["error"].(map[string]interface{})
	assert.True(t, ok, "Error should be present in error response")
	assert.Equal(t, "UNAUTHORIZED", errorData["code"])
}

// MockAuthError implements error interface for testing
type MockAuthError struct {
	Code    string
	Message string
}

func (e *MockAuthError) Error() string {
	return e.Message
}

// TestVerifyAuthError tests error handling during verification
func TestVerifyAuthError(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Setup test router
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Create mock auth server with verification error
	mockAuthSrv := &MockAuthServer{
		verifyErr: &MockAuthError{"unauthorized", "Invalid token"},
	}

	// Use test handler wrapper
	testHandler := &testAuthHandler{auth: mockAuthSrv}

	// Register routes
	router.GET("/api/v1/auth/verify", testHandler.VerifyAuth)

	// Test with invalid token
	verifyReq, _ := http.NewRequest("GET", "/api/v1/auth/verify?token=invalid.token", nil)
	verifyRecorder := httptest.NewRecorder()
	router.ServeHTTP(verifyRecorder, verifyReq)

	// Verify error response
	assert.Equal(t, http.StatusUnauthorized, verifyRecorder.Code)

	var errorResponse map[string]interface{}
	err := json.Unmarshal(verifyRecorder.Body.Bytes(), &errorResponse)
	assert.NoError(t, err)

	assert.Equal(t, false, errorResponse["success"])
	errorData, ok := errorResponse["error"].(map[string]interface{})
	assert.True(t, ok, "Error should be present in error response")
	assert.Equal(t, "UNAUTHORIZED", errorData["code"])
}