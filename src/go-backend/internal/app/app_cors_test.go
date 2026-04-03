package app

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// TestSetupGinEngine_CORSOriginAllowed verifies that a request from
// an allowed origin receives CORS headers.
func TestSetupGinEngine_CORSOriginAllowed(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"https://app.example.com"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))
	r.GET("/health", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("OPTIONS", "/health", nil)
	req.Header.Set("Origin", "https://app.example.com")
	req.Header.Set("Access-Control-Request-Method", "GET")
	r.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "https://app.example.com" {
		t.Errorf("Expected CORS header for allowed origin, got: %q", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

// TestSetupGinEngine_CORSOriginBlocked verifies that a request from
// an unlisted origin does NOT receive CORS headers.
func TestSetupGinEngine_CORSOriginBlocked(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"https://app.example.com"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))
	r.GET("/health", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("OPTIONS", "/health", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	req.Header.Set("Access-Control-Request-Method", "GET")
	r.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("Expected no CORS header for unlisted origin, got: %q", w.Header().Get("Access-Control-Allow-Origin"))
	}
}
