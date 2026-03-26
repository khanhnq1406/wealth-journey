package handlers

import (
	"fmt"
	"strconv"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/models"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/handler"
	investmentv1 "wealthjourney/protobuf/v1"
)

// GoldDisplayConfigHandler handles the admin-managed gold display configuration endpoints.
type GoldDisplayConfigHandler struct {
	svc           service.GoldDisplayConfigService
	overrideCache *cache.PriceOverrideCache
}

// NewGoldDisplayConfigHandler creates a new GoldDisplayConfigHandler with constructor injection.
func NewGoldDisplayConfigHandler(
	svc service.GoldDisplayConfigService,
	overrideCache *cache.PriceOverrideCache,
) *GoldDisplayConfigHandler {
	return &GoldDisplayConfigHandler{svc: svc, overrideCache: overrideCache}
}

// GetDisplayPrices returns enabled gold configs joined with latest prices and admin overrides.
// GET /api/v1/public/gold-display-prices
func (h *GoldDisplayConfigHandler) GetDisplayPrices(c *gin.Context) {
	ctx := c.Request.Context()

	dtos, err := h.svc.GetDisplayPrices(ctx)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	// Build override lookup map (graceful — skip if Redis unavailable)
	overrideMap := make(map[string]*cache.PriceOverride)
	if h.overrideCache != nil {
		allOverrides, overrideErr := h.overrideCache.GetAll(ctx)
		if overrideErr == nil && len(allOverrides) > 0 {
			for _, o := range allOverrides {
				key := o.TypeCode + ":" + o.Currency
				overrideMap[key] = o
			}
		}
	}

	items := make([]*investmentv1.GoldDisplayPrice, 0, len(dtos))
	for _, dto := range dtos {
		item := &investmentv1.GoldDisplayPrice{
			TypeCode:         dto.TypeCode,
			DisplayName:      dto.DisplayName,
			Buy:              dto.Buy,
			Sell:             dto.Sell,
			ChangeBuy:        dto.ChangeBuy,
			ChangeSell:       dto.ChangeSell,
			Currency:         dto.Currency,
			UpdatedAt:        dto.UpdatedAt,
			IsStale:          dto.IsStale,
			ShowInInvestment: dto.ShowInInvestment,
			DisplayOrder:     dto.DisplayOrder,
		}
		// Apply override if present
		if o, ok := overrideMap[dto.TypeCode+":"+dto.Currency]; ok {
			item.Buy = o.Buy
			item.Sell = o.Sell
		}
		items = append(items, item)
	}

	handler.Success(c, &investmentv1.GetGoldDisplayPricesResponse{Prices: items})
}

// ListAll returns all gold display configs (including disabled) for admin.
// GET /api/v1/admin/gold-display-config
func (h *GoldDisplayConfigHandler) ListAll(c *gin.Context) {
	ctx := c.Request.Context()

	configs, err := h.svc.ListAll(ctx)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	items := make([]*investmentv1.GoldDisplayConfig, 0, len(configs))
	for _, cfg := range configs {
		items = append(items, configToProto(cfg))
	}

	handler.Success(c, &investmentv1.ListGoldDisplayConfigResponse{Configs: items})
}

// Create adds a new gold display config entry.
// POST /api/v1/admin/gold-display-config
func (h *GoldDisplayConfigHandler) Create(c *gin.Context) {
	ctx := c.Request.Context()

	var req investmentv1.CreateGoldDisplayConfigRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	config, err := h.svc.Create(ctx, req.TypeCode, req.DisplayName, req.DisplayOrder, req.Enabled, req.ShowInInvestment)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, &investmentv1.CreateGoldDisplayConfigResponse{Config: configToProto(config)})
}

// Update modifies an existing gold display config entry.
// PUT /api/v1/admin/gold-display-config/:id
func (h *GoldDisplayConfigHandler) Update(c *gin.Context) {
	ctx := c.Request.Context()

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		handler.BadRequest(c, fmt.Errorf("invalid id"))
		return
	}

	var req investmentv1.UpdateGoldDisplayConfigRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	config, err := h.svc.Update(ctx, int32(id), req.DisplayName, req.DisplayOrder, req.Enabled, req.ShowInInvestment)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, &investmentv1.UpdateGoldDisplayConfigResponse{Config: configToProto(config)})
}

// Delete soft-deletes a gold display config entry.
// DELETE /api/v1/admin/gold-display-config/:id
func (h *GoldDisplayConfigHandler) Delete(c *gin.Context) {
	ctx := c.Request.Context()

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		handler.BadRequest(c, fmt.Errorf("invalid id"))
		return
	}

	if err := h.svc.Delete(ctx, int32(id)); err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, &investmentv1.DeleteGoldDisplayConfigResponse{Success: true})
}

// configToProto converts a GoldDisplayConfig model to its proto representation.
func configToProto(cfg *models.GoldDisplayConfig) *investmentv1.GoldDisplayConfig {
	return &investmentv1.GoldDisplayConfig{
		Id:               cfg.ID,
		TypeCode:         cfg.TypeCode,
		DisplayName:      cfg.DisplayName,
		DisplayOrder:     cfg.DisplayOrder,
		Enabled:          cfg.Enabled,
		ShowInInvestment: cfg.ShowInInvestment,
	}
}
