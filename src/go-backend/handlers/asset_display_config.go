package handlers

import (
	"fmt"
	"strconv"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/models"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
)

// AssetDisplayConfigHandler handles the admin-managed asset display configuration endpoints.
// It supersedes GoldDisplayConfigHandler and supports multiple asset types (gold, silver, etc.)
// as well as fetch-code-based price resolution CRUD.
type AssetDisplayConfigHandler struct {
	service service.AssetDisplayConfigService
}

// NewAssetDisplayConfigHandler creates a new AssetDisplayConfigHandler with constructor injection.
func NewAssetDisplayConfigHandler(svc service.AssetDisplayConfigService) *AssetDisplayConfigHandler {
	return &AssetDisplayConfigHandler{service: svc}
}

// assetDisplayPriceResponse is the JSON shape for a single display price item.
type assetDisplayPriceResponse struct {
	TypeCode         string `json:"typeCode"`
	AssetType        string `json:"assetType"`
	DisplayName      string `json:"displayName"`
	Buy              int64  `json:"buy"`
	Sell             int64  `json:"sell"`
	IsStale          bool   `json:"isStale"`
	ShowInInvestment bool   `json:"showInInvestment"`
	DisplayOrder     int32  `json:"displayOrder"`
	Enabled          bool   `json:"enabled"`
}

// assetDisplayConfigResponse is the JSON shape for a single config item.
type assetDisplayConfigResponse struct {
	ID               int32  `json:"id"`
	TypeCode         string `json:"typeCode"`
	AssetType        string `json:"assetType"`
	DisplayName      string `json:"displayName"`
	DisplayOrder     int32  `json:"displayOrder"`
	Enabled          bool   `json:"enabled"`
	ShowInInvestment bool   `json:"showInInvestment"`
}

// assetConfigFetchCodeResponse is the JSON shape for a single fetch code item.
type assetConfigFetchCodeResponse struct {
	ID       int32  `json:"id"`
	ConfigID int32  `json:"configId"`
	TypeCode string `json:"typeCode"`
	Priority int32  `json:"priority"`
}

// createFetchCodeRequest is the JSON body for creating a fetch code.
type createFetchCodeRequest struct {
	TypeCode string `json:"typeCode"`
	Priority int32  `json:"priority"`
}

// updateFetchCodeRequest is the JSON body for updating a fetch code priority.
type updateFetchCodeRequest struct {
	Priority int32 `json:"priority"`
}

// createAssetDisplayConfigRequest is the JSON body for creating a new config.
type createAssetDisplayConfigRequest struct {
	TypeCode         string `json:"typeCode"`
	DisplayName      string `json:"displayName"`
	AssetType        string `json:"assetType"`
	DisplayOrder     int32  `json:"displayOrder"`
	Enabled          bool   `json:"enabled"`
	ShowInInvestment bool   `json:"showInInvestment"`
}

// updateAssetDisplayConfigRequest is the JSON body for updating a config.
type updateAssetDisplayConfigRequest struct {
	DisplayName      string `json:"displayName"`
	DisplayOrder     int32  `json:"displayOrder"`
	Enabled          bool   `json:"enabled"`
	ShowInInvestment bool   `json:"showInInvestment"`
}

// configToAssetProto converts an AssetDisplayConfig model to its response representation.
func configToAssetResponse(cfg *models.AssetDisplayConfig) *assetDisplayConfigResponse {
	return &assetDisplayConfigResponse{
		ID:               cfg.ID,
		TypeCode:         cfg.TypeCode,
		AssetType:        cfg.AssetType,
		DisplayName:      cfg.DisplayName,
		DisplayOrder:     cfg.DisplayOrder,
		Enabled:          cfg.Enabled,
		ShowInInvestment: cfg.ShowInInvestment,
	}
}

// fetchCodeToResponse converts an AssetConfigFetchCode model to its response representation.
func fetchCodeToResponse(fc *models.AssetConfigFetchCode) *assetConfigFetchCodeResponse {
	return &assetConfigFetchCodeResponse{
		ID:       fc.ID,
		ConfigID: fc.ConfigID,
		TypeCode: fc.TypeCode,
		Priority: fc.Priority,
	}
}

// GetDisplayPrices returns enabled configs for the given assetType joined with latest prices.
// GET /api/v1/public/asset-display-prices?assetType=gold
func (h *AssetDisplayConfigHandler) GetDisplayPrices(c *gin.Context) {
	ctx := c.Request.Context()

	assetType := c.Query("assetType")
	if assetType == "" {
		assetType = c.Query("asset_type") // Fallback: generated client sends snake_case
	}
	if assetType == "" {
		assetType = "gold"
	}

	dtos, err := h.service.GetDisplayPrices(ctx, assetType)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	items := make([]*assetDisplayPriceResponse, 0, len(dtos))
	for _, dto := range dtos {
		items = append(items, &assetDisplayPriceResponse{
			TypeCode:         dto.TypeCode,
			AssetType:        dto.AssetType,
			DisplayName:      dto.DisplayName,
			Buy:              dto.Buy,
			Sell:             dto.Sell,
			IsStale:          dto.IsStale,
			ShowInInvestment: dto.ShowInInvestment,
			DisplayOrder:     dto.DisplayOrder,
			Enabled:          dto.Enabled,
		})
	}

	handler.Success(c, map[string]interface{}{"prices": items})
}

// ListAll returns all asset display configs (including disabled) for admin.
// GET /api/v1/admin/asset-display-config?assetType=gold
func (h *AssetDisplayConfigHandler) ListAll(c *gin.Context) {
	ctx := c.Request.Context()

	assetType := c.Query("assetType")
	if assetType == "" {
		assetType = c.Query("asset_type") // Fallback: generated client sends snake_case
	}
	if assetType == "" {
		assetType = "gold"
	}

	configs, err := h.service.ListAll(ctx, assetType)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	items := make([]*assetDisplayConfigResponse, 0, len(configs))
	for _, cfg := range configs {
		items = append(items, configToAssetResponse(cfg))
	}

	handler.Success(c, map[string]interface{}{"configs": items})
}

// Create adds a new asset display config entry.
// POST /api/v1/admin/asset-display-config
func (h *AssetDisplayConfigHandler) Create(c *gin.Context) {
	ctx := c.Request.Context()

	var req createAssetDisplayConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.BadRequest(c, fmt.Errorf("invalid request body"))
		return
	}

	assetType := req.AssetType
	if assetType == "" {
		assetType = "gold"
	}

	config, err := h.service.Create(ctx, req.TypeCode, req.DisplayName, assetType, req.DisplayOrder, req.Enabled, req.ShowInInvestment)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, map[string]interface{}{"config": configToAssetResponse(config)})
}

// Update modifies an existing asset display config entry.
// PUT /api/v1/admin/asset-display-config/:id
func (h *AssetDisplayConfigHandler) Update(c *gin.Context) {
	ctx := c.Request.Context()

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		handler.BadRequest(c, fmt.Errorf("invalid id"))
		return
	}

	var req updateAssetDisplayConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.BadRequest(c, fmt.Errorf("invalid request body"))
		return
	}

	config, err := h.service.Update(ctx, int32(id), req.DisplayName, req.DisplayOrder, req.Enabled, req.ShowInInvestment)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, map[string]interface{}{"config": configToAssetResponse(config)})
}

// Delete soft-deletes an asset display config entry.
// DELETE /api/v1/admin/asset-display-config/:id
func (h *AssetDisplayConfigHandler) Delete(c *gin.Context) {
	ctx := c.Request.Context()

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		handler.BadRequest(c, fmt.Errorf("invalid id"))
		return
	}

	if err := h.service.Delete(ctx, int32(id)); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, map[string]interface{}{"success": true})
}

// ListFetchCodes retrieves all active fetch codes for a config ordered by priority ASC.
// GET /api/v1/admin/asset-display-config/:id/fetch-codes
func (h *AssetDisplayConfigHandler) ListFetchCodes(c *gin.Context) {
	ctx := c.Request.Context()

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		handler.BadRequest(c, fmt.Errorf("invalid id"))
		return
	}

	fetchCodes, err := h.service.ListFetchCodes(ctx, int32(id))
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	items := make([]*assetConfigFetchCodeResponse, 0, len(fetchCodes))
	for _, fc := range fetchCodes {
		items = append(items, fetchCodeToResponse(fc))
	}

	handler.Success(c, map[string]interface{}{"fetchCodes": items})
}

// CreateFetchCode adds a fetch code to a config.
// POST /api/v1/admin/asset-display-config/:id/fetch-codes
func (h *AssetDisplayConfigHandler) CreateFetchCode(c *gin.Context) {
	ctx := c.Request.Context()

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		handler.BadRequest(c, fmt.Errorf("invalid id"))
		return
	}

	var req createFetchCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.BadRequest(c, fmt.Errorf("invalid request body"))
		return
	}

	fc, err := h.service.CreateFetchCode(ctx, int32(id), req.TypeCode, req.Priority)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, map[string]interface{}{"fetchCode": fetchCodeToResponse(fc)})
}

// UpdateFetchCode updates the priority of an existing fetch code.
// PUT /api/v1/admin/asset-display-config/:id/fetch-codes/:fcId
func (h *AssetDisplayConfigHandler) UpdateFetchCode(c *gin.Context) {
	ctx := c.Request.Context()

	// Parse :id (config id) — present for routing consistency but fcId is the authoritative key
	_, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		handler.BadRequest(c, fmt.Errorf("invalid id"))
		return
	}

	fcID, err := strconv.Atoi(c.Param("fcId"))
	if err != nil || fcID <= 0 {
		handler.BadRequest(c, fmt.Errorf("invalid fcId"))
		return
	}

	var req updateFetchCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handler.BadRequest(c, fmt.Errorf("invalid request body"))
		return
	}

	fc, err := h.service.UpdateFetchCode(ctx, int32(fcID), req.Priority)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, map[string]interface{}{"fetchCode": fetchCodeToResponse(fc)})
}

// DeleteFetchCode soft-deletes a fetch code by id.
// DELETE /api/v1/admin/asset-display-config/:id/fetch-codes/:fcId
func (h *AssetDisplayConfigHandler) DeleteFetchCode(c *gin.Context) {
	ctx := c.Request.Context()

	// Parse :id (config id) — present for routing consistency but fcId is the authoritative key
	_, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		handler.BadRequest(c, fmt.Errorf("invalid id"))
		return
	}

	fcID, err := strconv.Atoi(c.Param("fcId"))
	if err != nil || fcID <= 0 {
		handler.BadRequest(c, fmt.Errorf("invalid fcId"))
		return
	}

	if err := h.service.DeleteFetchCode(ctx, int32(fcID)); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, map[string]interface{}{"success": true})
}

// ListAvailableTypeCodes returns all distinct type_codes from the asset_price table
// that are relevant for the given assetType.
// GET /api/v1/admin/asset-price-type-codes?assetType=gold
func (h *AssetDisplayConfigHandler) ListAvailableTypeCodes(c *gin.Context) {
	ctx := c.Request.Context()

	assetType := c.Query("assetType")
	if assetType == "" {
		assetType = c.Query("asset_type") // Fallback: generated client sends snake_case
	}
	if assetType == "" {
		assetType = "gold"
	}

	typeCodes, err := h.service.ListAvailableTypeCodes(ctx, assetType)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, map[string]interface{}{"typeCodes": typeCodes})
}
