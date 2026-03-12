package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestHealthHandler_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	mockDB := &mockDatabase{
		statsFunc: func() map[string]interface{} {
			return map[string]interface{}{
				"max_open_connections": 10,
				"open_connections":     5,
				"in_use":               2,
				"idle":                 3,
			}
		},
		pingFunc: func() error {
			return nil
		},
	}

	router.GET("/health", HealthHandler(mockDB))

	req, _ := http.NewRequest("GET", "/health", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.Code)
	}

	var body map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &body)
	if err != nil {
		t.Fatalf("Failed to unmarshal response body: %v", err)
	}

	if body["status"] != "healthy" {
		t.Errorf("Expected status 'healthy', got '%v'", body["status"])
	}

	dbStatus := body["database"].(map[string]interface{})
	if dbStatus["status"] != "connected" {
		t.Errorf("Expected database status 'connected', got '%v'", dbStatus["status"])
	}
}

func TestHealthHandler_DatabaseDown(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	mockDB := &mockDatabase{
		pingFunc: func() error {
			return fmt.Errorf("connection refused")
		},
	}

	router.GET("/health", HealthHandler(mockDB))

	req, _ := http.NewRequest("GET", "/health", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 503, got %d", resp.Code)
	}

	var body map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &body)
	if err != nil {
		t.Fatalf("Failed to unmarshal response body: %v", err)
	}

	if body["status"] != "unhealthy" {
		t.Errorf("Expected status 'unhealthy', got '%v'", body["status"])
	}

	dbStatus := body["database"].(map[string]interface{})
	if dbStatus["status"] != "disconnected" {
		t.Errorf("Expected database status 'disconnected', got '%v'", dbStatus["status"])
	}
}

func TestHealthHandler_HEADMethod(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	mockDB := &mockDatabase{
		pingFunc: func() error {
			return nil
		},
		statsFunc: func() map[string]interface{} {
			return map[string]interface{}{
				"max_open_connections": 10,
				"open_connections":     5,
			}
		},
	}

	router.HEAD("/health", HealthHandler(mockDB))

	req, _ := http.NewRequest("HEAD", "/health", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	// The important thing is the status code is 200
	if resp.Code != http.StatusOK {
		t.Errorf("Expected status 200 for HEAD request, got %d", resp.Code)
	}

	// Verify the response contains health check data
	// Note: Gin automatically converts HEAD to GET and returns the body
	// This is acceptable for health check purposes
	var body map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &body)
	if err != nil {
		t.Fatalf("Failed to unmarshal response body: %v", err)
	}

	if body["status"] != "healthy" {
		t.Errorf("Expected status 'healthy', got '%v'", body["status"])
	}
}

type mockDatabase struct {
	statsFunc func() map[string]interface{}
	pingFunc  func() error
}

func (m *mockDatabase) Stats() map[string]interface{} {
	if m.statsFunc != nil {
		return m.statsFunc()
	}
	return map[string]interface{}{}
}

func (m *mockDatabase) Ping() error {
	if m.pingFunc != nil {
		return m.pingFunc()
	}
	return nil
}
