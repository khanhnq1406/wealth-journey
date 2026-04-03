package handlers

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/auth"
	"wealthjourney/pkg/device"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/handler"
	authv1 "wealthjourney/protobuf/v1"
)

// AuthHandlers handles authentication-related HTTP requests.
type AuthHandlers struct {
	authSrv *auth.Server
}

// NewAuthHandlers creates auth handlers with the shared auth server.
func NewAuthHandlers(authSrv *auth.Server) *AuthHandlers {
	return &AuthHandlers{
		authSrv: authSrv,
	}
}

// Register handles user registration with Google OAuth
func (h *AuthHandlers) Register(c *gin.Context) {
	var req struct {
		Token string `json:"token" binding:"required"`
	}

	if !bindJSON(c, &req) {
		return
	}

	deviceInfo := device.ExtractDeviceInfo(c)
	result, err := h.authSrv.RegisterWithDevice(c.Request.Context(), req.Token, deviceInfo)

	if err != nil {
		log.Printf("[AUTH] Registration failed: %v", err)
		// Preserve specific auth errors (e.g. AUTH_GOOGLE_NOT_LINKED) — don't wrap them.
		var unauthorizedErr apperrors.UnauthorizedError
		if errors.As(err, &unauthorizedErr) {
			handler.HandleError(c, err)
			return
		}
		handler.HandleError(c, apperrors.NewRegistrationErrorWithCause(err))
		return
	}

	c.JSON(http.StatusOK, result)
}

// Login handles user login with Google OAuth
func (h *AuthHandlers) Login(c *gin.Context) {
	var req struct {
		Token string `json:"token" binding:"required"`
	}

	if !bindJSON(c, &req) {
		return
	}

	deviceInfo := device.ExtractDeviceInfo(c)
	result, err := h.authSrv.LoginWithDeviceInfo(c.Request.Context(), req.Token, deviceInfo)

	if err != nil {
		log.Printf("[AUTH] Login failed: %v", err)
		// Preserve specific auth errors (e.g. AUTH_GOOGLE_NOT_LINKED) — don't wrap them.
		var unauthorizedErr apperrors.UnauthorizedError
		if errors.As(err, &unauthorizedErr) {
			handler.HandleError(c, err)
			return
		}
		handler.HandleError(c, apperrors.NewLoginErrorWithCause(err))
		return
	}

	c.JSON(http.StatusOK, result)
}

// Logout handles user logout
func (h *AuthHandlers) Logout(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		// Try to get from body
		var req struct {
			Token string `json:"token"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			handler.HandleError(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.RequestBodyInvalid, "invalid request body"))
			return
		}
		token = req.Token
	} else {
		// Use ExtractBearerToken for header tokens
		extractedToken, ok := ExtractBearerToken(c)
		if !ok {
			return
		}
		token = extractedToken
	}

	result, err := h.authSrv.Logout(token)

	if err != nil {
		log.Printf("[AUTH] Logout failed: %v", err)
		handler.HandleError(c, apperrors.NewLogoutErrorWithCause(err))
		return
	}

	c.JSON(http.StatusOK, result)
}

// VerifyAuth handles authentication verification
//
// NOTE: This endpoint supports token in both Authorization header and query parameter.
// The query parameter fallback is needed for compatibility with the auto-generated
// frontend API client (protobuf-based) which passes tokens as query params for GET requests.
func (h *AuthHandlers) VerifyAuth(c *gin.Context) {
	// Try to extract token from Authorization header first (security best practice)
	token, ok := ExtractBearerToken(c)

	// Fallback to query parameter for protobuf client compatibility
	if !ok {
		token = c.Query("token")
		ok = token != ""
	}

	if !ok {
		handler.UnauthorizedWithCode(c, apperrors.Codes.AuthNoToken, "No token provided")
		return
	}

	result, err := h.authSrv.VerifyAuth(token)

	if err != nil {
		log.Printf("[AUTH] Token verification failed: %v", err)
		handler.HandleError(c, apperrors.NewTokenError("verification"))
		return
	}

	c.JSON(http.StatusOK, result)
}

// RegisterWithPassword handles user registration with username/password
func (h *AuthHandlers) RegisterWithPassword(c *gin.Context) {
	var body struct {
		Username    string `json:"username"`
		Password    string `json:"password"`
		DisplayName string `json:"displayName"`
	}
	if !bindJSON(c, &body) {
		return
	}

	req := &authv1.RegisterWithPasswordRequest{
		Username:    body.Username,
		Password:    body.Password,
		DisplayName: body.DisplayName,
	}

	deviceInfo := device.ExtractDeviceInfo(c)
	result, err := h.authSrv.RegisterWithPassword(c.Request.Context(), req, deviceInfo)
	if err != nil {
		log.Printf("[AUTH] Password registration failed: %v", err)
		handler.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

// LoginWithPassword handles user login with email/username and password
func (h *AuthHandlers) LoginWithPassword(c *gin.Context) {
	var req authv1.LoginWithPasswordRequest
	if !bindJSON(c, &req) {
		return
	}

	deviceInfo := device.ExtractDeviceInfo(c)
	result, err := h.authSrv.LoginWithPassword(c.Request.Context(), &req, deviceInfo)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

// LinkPassword handles linking a password to an existing account
func (h *AuthHandlers) LinkPassword(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.UnauthorizedWithPath(c, "User not authenticated")
		return
	}

	var req authv1.LinkPasswordRequest
	if !bindJSON(c, &req) {
		return
	}

	result, err := h.authSrv.LinkPassword(c.Request.Context(), userID, &req)
	if err != nil {
		log.Printf("[AUTH] Link password failed: %v", err)
		handler.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

// ChangePassword handles password change for authenticated users
func (h *AuthHandlers) ChangePassword(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.UnauthorizedWithPath(c, "User not authenticated")
		return
	}

	// Extract session ID from JWT token
	token, ok := ExtractBearerToken(c)
	if !ok {
		return
	}
	claims, err := h.authSrv.ParseToken(token)
	if err != nil {
		handler.HandleError(c, apperrors.NewUnauthorizedErrorWithCode(apperrors.Codes.AuthInvalidToken, "invalid token"))
		return
	}

	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if !bindJSON(c, &body) {
		return
	}

	req := &authv1.ChangePasswordRequest{
		CurrentPassword: body.CurrentPassword,
		NewPassword:     body.NewPassword,
	}

	result, err := h.authSrv.ChangePassword(c.Request.Context(), userID, req, claims.SessionID)
	if err != nil {
		log.Printf("[AUTH] Change password failed: %v", err)
		handler.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetAuthMethods handles retrieving auth methods for the current user
func (h *AuthHandlers) GetAuthMethods(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.UnauthorizedWithPath(c, "User not authenticated")
		return
	}

	result, err := h.authSrv.GetAuthMethods(c.Request.Context(), userID)
	if err != nil {
		log.Printf("[AUTH] Get auth methods failed: %v", err)
		handler.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": result.Success,
		"message": result.Message,
		"data": gin.H{
			"hasGoogle":   result.Data.HasGoogle,
			"hasPassword": result.Data.HasPassword,
			"username":    result.Data.Username,
			"email":       result.Data.Email,
		},
		"timestamp": result.Timestamp,
	})
}

// LinkGoogle handles linking a Google account to an existing user
func (h *AuthHandlers) LinkGoogle(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.UnauthorizedWithPath(c, "User not authenticated")
		return
	}

	var body struct {
		Token string `json:"token" binding:"required"`
	}
	if !bindJSON(c, &body) {
		return
	}

	result, err := h.authSrv.LinkGoogle(c.Request.Context(), userID, body.Token)
	if err != nil {
		log.Printf("[AUTH] Link Google failed: %v", err)
		handler.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

// UnlinkGoogle handles unlinking a Google account from an existing user
func (h *AuthHandlers) UnlinkGoogle(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.UnauthorizedWithPath(c, "User not authenticated")
		return
	}

	// Extract session ID from JWT token (same as ChangePassword pattern)
	token, ok := ExtractBearerToken(c)
	if !ok {
		return
	}
	claims, err := h.authSrv.ParseToken(token)
	if err != nil {
		handler.HandleError(c, apperrors.NewUnauthorizedErrorWithCode(apperrors.Codes.AuthInvalidToken, "invalid token"))
		return
	}

	result, err := h.authSrv.UnlinkGoogle(c.Request.Context(), userID, claims.SessionID)
	if err != nil {
		log.Printf("[AUTH] Unlink Google failed: %v", err)
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetAuth handles GET /auth - returns user information for authenticated user
func (h *AuthHandlers) GetAuth(c *gin.Context) {
	// Extract userID from context (set by AuthMiddleware)
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.UnauthorizedWithPath(c, "User not authenticated")
		return
	}

	userData, err := h.authSrv.GetAuth(c.Request.Context(), userID)

	if err != nil {
		handler.NotFoundWithPath(c, err.Error())
		return
	}

	handler.SuccessWithPath(c, gin.H{
		"id":                   userData.Data.Id,
		"email":                userData.Data.Email,
		"name":                 userData.Data.Name,
		"picture":              userData.Data.Picture,
		"preferredCurrency":    userData.Data.PreferredCurrency,
		"conversionInProgress": userData.Data.ConversionInProgress,
		"preferredLanguage":    userData.Data.PreferredLanguage,
	})
}
