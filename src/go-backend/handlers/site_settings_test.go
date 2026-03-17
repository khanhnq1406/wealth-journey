package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"wealthjourney/domain/models"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// mockSiteSettingsService implements service.SiteSettingsService for testing.
type mockSiteSettingsService struct {
	getAllFunc       func(ctx context.Context) ([]*models.SiteSetting, error)
	updateFunc      func(ctx context.Context, adminUserID int32, settings []*models.SiteSetting) ([]*models.SiteSetting, error)
}

func (m *mockSiteSettingsService) GetAll(ctx context.Context) ([]*models.SiteSetting, error) {
	if m.getAllFunc != nil {
		return m.getAllFunc(ctx)
	}
	return nil, nil
}

func (m *mockSiteSettingsService) UpdateSettings(ctx context.Context, adminUserID int32, settings []*models.SiteSetting) ([]*models.SiteSetting, error) {
	if m.updateFunc != nil {
		return m.updateFunc(ctx, adminUserID, settings)
	}
	return nil, nil
}

func TestGetSiteSettings_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := &mockSiteSettingsService{
		getAllFunc: func(ctx context.Context) ([]*models.SiteSetting, error) {
			return []*models.SiteSetting{
				{Key: "seo.title", Value: "Test Title"},
				{Key: "footer.brand_name", Value: "Test Brand"},
			}, nil
		},
	}

	handler := NewSiteSettingsHandler(mockSvc)
	router := gin.New()
	router.GET("/api/v1/public/site-settings", handler.GetSiteSettings)

	req, _ := http.NewRequest("GET", "/api/v1/public/site-settings", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)

	var body map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &body)
	assert.NoError(t, err)
	assert.Equal(t, true, body["success"])

	settings := body["settings"].([]interface{})
	assert.Equal(t, 2, len(settings))
}

func TestUpdateSiteSettings_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := &mockSiteSettingsService{
		updateFunc: func(ctx context.Context, adminUserID int32, settings []*models.SiteSetting) ([]*models.SiteSetting, error) {
			return []*models.SiteSetting{
				{Key: "seo.title", Value: "Updated Title"},
			}, nil
		},
	}

	handler := NewSiteSettingsHandler(mockSvc)
	router := gin.New()
	router.PUT("/api/v1/admin/site-settings", func(c *gin.Context) {
		c.Set("user_id", int32(1))
		handler.UpdateSiteSettings(c)
	})

	body := map[string]interface{}{
		"settings": []map[string]string{
			{"key": "seo.title", "value": "Updated Title"},
		},
	}
	bodyBytes, _ := json.Marshal(body)

	req, _ := http.NewRequest("PUT", "/api/v1/admin/site-settings", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)

	var respBody map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &respBody)
	assert.NoError(t, err)
	assert.Equal(t, true, respBody["success"])
}

func TestUpdateSiteSettings_EmptyBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewSiteSettingsHandler(&mockSiteSettingsService{})
	router := gin.New()
	router.PUT("/api/v1/admin/site-settings", func(c *gin.Context) {
		c.Set("user_id", int32(1))
		handler.UpdateSiteSettings(c)
	})

	body := map[string]interface{}{
		"settings": []map[string]string{},
	}
	bodyBytes, _ := json.Marshal(body)

	req, _ := http.NewRequest("PUT", "/api/v1/admin/site-settings", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusBadRequest, resp.Code)
}
