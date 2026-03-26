package service

import (
	"context"
	"strings"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
)

// goldDisplayConfigService implements GoldDisplayConfigService.
// Depguard: no gorm.io/gorm import — all DB access goes through the repository interface.
type goldDisplayConfigService struct {
	repo          repository.GoldDisplayConfigRepository
	assetPriceSvc AssetPriceService
}

// NewGoldDisplayConfigService creates a new GoldDisplayConfigService with constructor injection.
func NewGoldDisplayConfigService(
	repo repository.GoldDisplayConfigRepository,
	assetPriceSvc AssetPriceService,
) GoldDisplayConfigService {
	return &goldDisplayConfigService{
		repo:          repo,
		assetPriceSvc: assetPriceSvc,
	}
}

// GetDisplayPrices returns enabled gold configs joined with the latest DB-cached prices.
// Missing prices get Buy=0, Sell=0, IsStale=true so callers can render "--" safely.
func (s *goldDisplayConfigService) GetDisplayPrices(ctx context.Context) ([]*GoldDisplayPriceDTO, error) {
	configs, err := s.repo.ListEnabled(ctx)
	if err != nil {
		return nil, err
	}

	// Fetch current gold prices from the DB cache (may be nil slice on cold start).
	prices, _ := s.assetPriceSvc.GetPricesByAssetType(ctx, "gold")

	// Build a fast lookup map: TypeCode → price DTO.
	priceMap := make(map[string]*AssetPriceDTO, len(prices))
	for _, p := range prices {
		priceMap[p.TypeCode] = p
	}

	result := make([]*GoldDisplayPriceDTO, 0, len(configs))
	for _, cfg := range configs {
		dto := &GoldDisplayPriceDTO{
			TypeCode:         cfg.TypeCode,
			DisplayName:      cfg.DisplayName,
			ShowInInvestment: cfg.ShowInInvestment,
			DisplayOrder:     cfg.DisplayOrder,
			// Default: stale with zero prices (safe fallback).
			IsStale: true,
		}
		if p, ok := priceMap[cfg.TypeCode]; ok {
			dto.Buy = p.Buy
			dto.Sell = p.Sell
			dto.ChangeBuy = p.ChangeBuy
			dto.ChangeSell = p.ChangeSell
			dto.Currency = p.Currency
			dto.UpdatedAt = p.FetchedAt.Unix()
			dto.IsStale = p.IsStale
		}
		result = append(result, dto)
	}

	return result, nil
}

// ListAll returns all configs (including disabled) for admin management.
func (s *goldDisplayConfigService) ListAll(ctx context.Context) ([]*models.GoldDisplayConfig, error) {
	return s.repo.ListAll(ctx)
}

// Create validates inputs and inserts a new gold display config entry.
// Security: validates typeCode length, displayName after trim, displayOrder >= 0, and
// detects duplicate type_code before writing to DB.
func (s *goldDisplayConfigService) Create(
	ctx context.Context,
	typeCode, displayName string,
	displayOrder int32,
	enabled, showInInvestment bool,
) (*models.GoldDisplayConfig, error) {
	// --- Input validation ---
	if typeCode == "" {
		return nil, apperrors.NewValidationError("type_code is required")
	}
	if len(typeCode) > 50 {
		return nil, apperrors.NewValidationError("type_code must not exceed 50 characters")
	}

	displayName = strings.TrimSpace(displayName)
	if displayName == "" {
		return nil, apperrors.NewValidationError("display_name is required")
	}
	if len(displayName) > 100 {
		return nil, apperrors.NewValidationError("display_name must not exceed 100 characters")
	}

	if displayOrder < 0 {
		return nil, apperrors.NewValidationError("display_order must be >= 0")
	}

	// --- Duplicate type_code check ---
	existing, err := s.repo.GetByTypeCode(ctx, typeCode)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, apperrors.NewConflictError("type code already exists")
	}

	config := &models.GoldDisplayConfig{
		TypeCode:         typeCode,
		DisplayName:      displayName,
		DisplayOrder:     displayOrder,
		Enabled:          enabled,
		ShowInInvestment: showInInvestment,
	}

	if err := s.repo.Create(ctx, config); err != nil {
		return nil, err
	}

	return config, nil
}

// Update modifies an existing config entry identified by id.
// Returns NotFoundError if the record does not exist.
func (s *goldDisplayConfigService) Update(
	ctx context.Context,
	id int32,
	displayName string,
	displayOrder int32,
	enabled, showInInvestment bool,
) (*models.GoldDisplayConfig, error) {
	// --- Input validation ---
	displayName = strings.TrimSpace(displayName)
	if displayName == "" {
		return nil, apperrors.NewValidationError("display_name is required")
	}
	if len(displayName) > 100 {
		return nil, apperrors.NewValidationError("display_name must not exceed 100 characters")
	}
	if displayOrder < 0 {
		return nil, apperrors.NewValidationError("display_order must be >= 0")
	}

	config, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	config.DisplayName = displayName
	config.DisplayOrder = displayOrder
	config.Enabled = enabled
	config.ShowInInvestment = showInInvestment

	if err := s.repo.Update(ctx, config); err != nil {
		return nil, err
	}

	return config, nil
}

// Delete soft-deletes a config entry by id.
// Delegates entirely to the repository which returns NotFoundError if absent.
func (s *goldDisplayConfigService) Delete(ctx context.Context, id int32) error {
	return s.repo.Delete(ctx, id)
}
