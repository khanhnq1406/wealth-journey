package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/handler"

	"wealthjourney/domain/auth"
	"wealthjourney/pkg/device"
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
			handler.HandleError(c, apperrors.NewValidationError("invalid request body"))
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
		handler.Unauthorized(c, "No token provided")
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

// GetAuth handles GET /auth - returns user information for authenticated user
func (h *AuthHandlers) GetAuth(c *gin.Context) {
	// Extract email from context (set by AuthMiddleware)
	userEmail, exists := c.Get("user_email")
	if !exists {
		handler.UnauthorizedWithPath(c, "User not authenticated")
		return
	}

	email := userEmail.(string)

	userData, err := h.authSrv.GetAuth(c.Request.Context(), email)

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
