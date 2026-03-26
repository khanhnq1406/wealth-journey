package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"wealthjourney/domain/models"
	"wealthjourney/domain/service"
)

// ---------------------------------------------------------------------------
// mockGoldDisplayConfigService — test double
// ---------------------------------------------------------------------------

type mockGoldDisplayConfigService struct {
	getDisplayPricesFunc func(ctx context.Context) ([]*service.GoldDisplayPriceDTO, error)
	listAllFunc          func(ctx context.Context) ([]*models.GoldDisplayConfig, error)
	createFunc           func(ctx context.Context, typeCode, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.GoldDisplayConfig, error)
	updateFunc           func(ctx context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.GoldDisplayConfig, error)
	deleteFunc           func(ctx context.Context, id int32) error
}

func (m *mockGoldDisplayConfigService) GetDisplayPrices(ctx context.Context) ([]*service.GoldDisplayPriceDTO, error) {
	if m.getDisplayPricesFunc != nil {
		return m.getDisplayPricesFunc(ctx)
	}
	return []*service.GoldDisplayPriceDTO{}, nil
}

func (m *mockGoldDisplayConfigService) ListAll(ctx context.Context) ([]*models.GoldDisplayConfig, error) {
	if m.listAllFunc != nil {
		return m.listAllFunc(ctx)
	}
	return []*models.GoldDisplayConfig{}, nil
}

func (m *mockGoldDisplayConfigService) Create(ctx context.Context, typeCode, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.GoldDisplayConfig, error) {
	if m.createFunc != nil {
		return m.createFunc(ctx, typeCode, displayName, displayOrder, enabled, showInInvestment)
	}
	return &models.GoldDisplayConfig{ID: 1, TypeCode: typeCode, DisplayName: displayName}, nil
}

func (m *mockGoldDisplayConfigService) Update(ctx context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.GoldDisplayConfig, error) {
	if m.updateFunc != nil {
		return m.updateFunc(ctx, id, displayName, displayOrder, enabled, showInInvestment)
	}
	return &models.GoldDisplayConfig{ID: id, DisplayName: displayName}, nil
}

func (m *mockGoldDisplayConfigService) Delete(ctx context.Context, id int32) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, id)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Compile-time interface check
// ---------------------------------------------------------------------------

var _ service.GoldDisplayConfigService = (*mockGoldDisplayConfigService)(nil)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func newTestGoldDisplayConfigHandler(svc service.GoldDisplayConfigService) *GoldDisplayConfigHandler {
	// nil overrideCache — graceful skip
	return NewGoldDisplayConfigHandler(svc, nil)
}

func runGoldDisplayConfigRequest(h *GoldDisplayConfigHandler, method, path, body string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var reqBody *bytes.Reader
	if body != "" {
		reqBody = bytes.NewReader([]byte(body))
	} else {
		reqBody = bytes.NewReader([]byte{})
	}
	req, _ := http.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	switch method {
	case http.MethodPost:
		h.Create(c)
	case http.MethodGet:
		h.ListAll(c)
	}
	return w
}

func runGetDisplayPrices(h *GoldDisplayConfigHandler) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/public/gold-display-prices", nil)
	c.Request = req
	h.GetDisplayPrices(c)
	return w
}

func runListAll(h *GoldDisplayConfigHandler) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/admin/gold-display-config", nil)
	c.Request = req
	h.ListAll(c)
	return w
}

func runUpdateWithID(h *GoldDisplayConfigHandler, idParam, body string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: idParam}}
	req, _ := http.NewRequest(http.MethodPut, "/api/v1/admin/gold-display-config/"+idParam, bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	h.Update(c)
	return w
}

func runDeleteWithID(h *GoldDisplayConfigHandler, idParam string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "id", Value: idParam}}
	req, _ := http.NewRequest(http.MethodDelete, "/api/v1/admin/gold-display-config/"+idParam, nil)
	c.Request = req
	h.Delete(c)
	return w
}

// ---------------------------------------------------------------------------
// GetDisplayPrices tests
// ---------------------------------------------------------------------------

// TestGoldDisplayConfig_GetDisplayPrices_HappyPath verifies the handler returns
// 200 with a prices array when service returns valid DTOs.
func TestGoldDisplayConfig_GetDisplayPrices_HappyPath(t *testing.T) {
	mockSvc := &mockGoldDisplayConfigService{
		getDisplayPricesFunc: func(ctx context.Context) ([]*service.GoldDisplayPriceDTO, error) {
			return []*service.GoldDisplayPriceDTO{
				{
					TypeCode:         "SJL1L10",
					DisplayName:      "SJC 1L-10L",
					Buy:              95500000,
					Sell:             97500000,
					Currency:         "VND",
					ShowInInvestment: true,
					DisplayOrder:     1,
				},
			}, nil
		},
	}

	h := newTestGoldDisplayConfigHandler(mockSvc)
	w := runGetDisplayPrices(h)

	assert.Equal(t, http.StatusOK, w.Code)

	// Response is proto-serialized; parse as generic JSON
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	prices, ok := body["prices"].([]interface{})
	require.True(t, ok, "prices should be an array")
	assert.Len(t, prices, 1)

	first, ok := prices[0].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "SJL1L10", first["typeCode"])
	assert.Equal(t, "SJC 1L-10L", first["displayName"])
}

// TestGoldDisplayConfig_GetDisplayPrices_EmptyList verifies the handler returns
// 200 with an empty prices key (or absent — depends on EmitUnpopulated=false) on
// empty service response.
func TestGoldDisplayConfig_GetDisplayPrices_EmptyList(t *testing.T) {
	mockSvc := &mockGoldDisplayConfigService{
		getDisplayPricesFunc: func(ctx context.Context) ([]*service.GoldDisplayPriceDTO, error) {
			return []*service.GoldDisplayPriceDTO{}, nil
		},
	}

	h := newTestGoldDisplayConfigHandler(mockSvc)
	w := runGetDisplayPrices(h)

	assert.Equal(t, http.StatusOK, w.Code)
}

// TestGoldDisplayConfig_GetDisplayPrices_ServiceError verifies that service errors
// produce a non-200 response via handler.HandleError.
func TestGoldDisplayConfig_GetDisplayPrices_ServiceError(t *testing.T) {
	mockSvc := &mockGoldDisplayConfigService{
		getDisplayPricesFunc: func(ctx context.Context) ([]*service.GoldDisplayPriceDTO, error) {
			return nil, errors.New("db error")
		},
	}

	h := newTestGoldDisplayConfigHandler(mockSvc)
	w := runGetDisplayPrices(h)

	// handler.HandleError maps unknown errors → 500
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ---------------------------------------------------------------------------
// ListAll tests
// ---------------------------------------------------------------------------

// TestGoldDisplayConfig_ListAll_HappyPath verifies admin list returns 200 with configs array.
func TestGoldDisplayConfig_ListAll_HappyPath(t *testing.T) {
	mockSvc := &mockGoldDisplayConfigService{
		listAllFunc: func(ctx context.Context) ([]*models.GoldDisplayConfig, error) {
			return []*models.GoldDisplayConfig{
				{ID: 1, TypeCode: "SJL1L10", DisplayName: "SJC 1L-10L", DisplayOrder: 1, Enabled: true, ShowInInvestment: true},
				{ID: 2, TypeCode: "DOJI_1C", DisplayName: "DOJI 1 Chỉ", DisplayOrder: 2, Enabled: false, ShowInInvestment: false},
			}, nil
		},
	}

	h := newTestGoldDisplayConfigHandler(mockSvc)
	w := runListAll(h)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	configs, ok := body["configs"].([]interface{})
	require.True(t, ok, "configs should be an array")
	assert.Len(t, configs, 2)
}

// ---------------------------------------------------------------------------
// Create tests
// ---------------------------------------------------------------------------

// TestGoldDisplayConfig_Create_HappyPath verifies that a valid create request returns 201.
func TestGoldDisplayConfig_Create_HappyPath(t *testing.T) {
	called := false
	mockSvc := &mockGoldDisplayConfigService{
		createFunc: func(ctx context.Context, typeCode, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.GoldDisplayConfig, error) {
			called = true
			return &models.GoldDisplayConfig{ID: 1, TypeCode: typeCode, DisplayName: displayName, DisplayOrder: displayOrder, Enabled: enabled, ShowInInvestment: showInInvestment}, nil
		},
	}

	h := newTestGoldDisplayConfigHandler(mockSvc)
	w := runGoldDisplayConfigRequest(h, http.MethodPost, "/api/v1/admin/gold-display-config",
		`{"typeCode":"TEST","displayName":"Test Gold","displayOrder":1,"enabled":true,"showInInvestment":true}`)

	assert.Equal(t, http.StatusCreated, w.Code)
	assert.True(t, called, "service.Create should have been called")
}

// ---------------------------------------------------------------------------
// Update tests (ID parsing is the critical security path)
// ---------------------------------------------------------------------------

// TestGoldDisplayConfig_Update_InvalidID_NonNumeric verifies that a non-numeric
// id path param returns 400 Bad Request.
func TestGoldDisplayConfig_Update_InvalidID_NonNumeric(t *testing.T) {
	h := newTestGoldDisplayConfigHandler(&mockGoldDisplayConfigService{})
	w := runUpdateWithID(h, "abc", `{"displayName":"test","displayOrder":1,"enabled":true,"showInInvestment":false}`)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// TestGoldDisplayConfig_Update_InvalidID_Zero verifies that id=0 returns 400.
func TestGoldDisplayConfig_Update_InvalidID_Zero(t *testing.T) {
	h := newTestGoldDisplayConfigHandler(&mockGoldDisplayConfigService{})
	w := runUpdateWithID(h, "0", `{"displayName":"test","displayOrder":1,"enabled":true,"showInInvestment":false}`)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// TestGoldDisplayConfig_Update_InvalidID_Negative verifies that a negative id returns 400.
func TestGoldDisplayConfig_Update_InvalidID_Negative(t *testing.T) {
	h := newTestGoldDisplayConfigHandler(&mockGoldDisplayConfigService{})
	w := runUpdateWithID(h, "-1", `{"displayName":"test","displayOrder":1,"enabled":true,"showInInvestment":false}`)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// TestGoldDisplayConfig_Update_HappyPath verifies a valid update returns 200.
func TestGoldDisplayConfig_Update_HappyPath(t *testing.T) {
	called := false
	mockSvc := &mockGoldDisplayConfigService{
		updateFunc: func(ctx context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.GoldDisplayConfig, error) {
			called = true
			assert.Equal(t, int32(5), id)
			return &models.GoldDisplayConfig{ID: 5, DisplayName: displayName, DisplayOrder: displayOrder, Enabled: enabled, ShowInInvestment: showInInvestment}, nil
		},
	}

	h := newTestGoldDisplayConfigHandler(mockSvc)
	w := runUpdateWithID(h, "5", `{"displayName":"Updated Name","displayOrder":3,"enabled":true,"showInInvestment":false}`)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, called, "service.Update should have been called")
}

// ---------------------------------------------------------------------------
// Delete tests (ID parsing is the critical security path)
// ---------------------------------------------------------------------------

// TestGoldDisplayConfig_Delete_InvalidID_NonNumeric verifies non-numeric id returns 400.
func TestGoldDisplayConfig_Delete_InvalidID_NonNumeric(t *testing.T) {
	h := newTestGoldDisplayConfigHandler(&mockGoldDisplayConfigService{})
	w := runDeleteWithID(h, "xyz")
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// TestGoldDisplayConfig_Delete_InvalidID_Zero verifies id=0 returns 400.
func TestGoldDisplayConfig_Delete_InvalidID_Zero(t *testing.T) {
	h := newTestGoldDisplayConfigHandler(&mockGoldDisplayConfigService{})
	w := runDeleteWithID(h, "0")
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// TestGoldDisplayConfig_Delete_HappyPath verifies a valid delete returns 200.
func TestGoldDisplayConfig_Delete_HappyPath(t *testing.T) {
	called := false
	mockSvc := &mockGoldDisplayConfigService{
		deleteFunc: func(ctx context.Context, id int32) error {
			called = true
			assert.Equal(t, int32(7), id)
			return nil
		},
	}

	h := newTestGoldDisplayConfigHandler(mockSvc)
	w := runDeleteWithID(h, "7")

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, called, "service.Delete should have been called")
}

// TestGoldDisplayConfig_Delete_ServiceError verifies service errors produce non-200.
func TestGoldDisplayConfig_Delete_ServiceError(t *testing.T) {
	mockSvc := &mockGoldDisplayConfigService{
		deleteFunc: func(ctx context.Context, id int32) error {
			return errors.New("db error")
		},
	}

	h := newTestGoldDisplayConfigHandler(mockSvc)
	w := runDeleteWithID(h, "3")

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

// ---------------------------------------------------------------------------
// Struct field compile-time check
// ---------------------------------------------------------------------------

// TestGoldDisplayConfig_StructFields is a compile-time check that the handler
// has the expected fields.
func TestGoldDisplayConfig_StructFields(t *testing.T) {
	h := newTestGoldDisplayConfigHandler(&mockGoldDisplayConfigService{})
	// Accessing these fields confirms their existence at compile time.
	_ = h.svc
	_ = h.overrideCache
}
