package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ExtractBearerToken extracts the Bearer token from the Authorization header.
// Returns the token without the "Bearer " prefix, or an error if missing/invalid.
func ExtractBearerToken(c *gin.Context) (string, bool) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "Missing authorization header",
		})
		return "", false
	}

	// Remove "Bearer " prefix
	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == authHeader {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "Invalid authorization format. Use: Bearer <token>",
		})
		return "", false
	}

	return token, true
}

// bindJSON binds JSON request body and handles validation errors.
// Returns true if binding succeeded, false otherwise.
func bindJSON(c *gin.Context, obj interface{}) bool {
	if err := c.ShouldBindJSON(obj); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return false
	}
	return true
}
