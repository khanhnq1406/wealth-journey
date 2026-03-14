package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/auth"
)

// AuthMiddleware validates JWT tokens from Redis whitelist.
// It accepts the auth server instance to avoid creating a new one per request.
func AuthMiddleware(authSrv *auth.Server) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract token using helper function
		token, ok := ExtractBearerToken(c)
		if !ok {
			c.Abort()
			return
		}

		// Verify token using the shared auth service instance
		result, err := authSrv.VerifyAuth(token)

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Invalid or expired token",
			})
			c.Abort()
			return
		}

		// Store user info in context
		c.Set("user_id", result.Data.Id)
		c.Set("user_email", result.Data.Email)
		c.Set("user_name", result.Data.Name)
		c.Set("is_admin", result.Data.IsAdmin)

		c.Next()
	}
}

// AdminMiddleware checks that the authenticated user is an admin.
// Must be used after AuthMiddleware in the middleware chain.
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		isAdmin, exists := c.Get("is_admin")
		if !exists || !isAdmin.(bool) {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "Admin access required",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
