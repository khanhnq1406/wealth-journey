package service

import (
	"context"
	"fmt"
	"strings"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
)

// assetDisplayConfigService implements AssetDisplayConfigService.
// Depguard: no gorm.io/gorm import — all DB access goes through the repository interfaces.
type assetDisplayConfigService struct {
	configRepo    repository.AssetDisplayConfigRepository
	fetchCodeRepo repository.AssetConfigFetchCodeRepository
	assetPriceRepo repository.AssetPriceRepository
}

// NewAssetDisplayConfigService creates a new AssetDisplayConfigService with constructor injection.
func NewAssetDisplayConfigService(
	configRepo repository.AssetDisplayConfigRepository,
	fetchCodeRepo repository.AssetConfigFetchCodeRepository,
	assetPriceRepo repository.AssetPriceRepository,
) AssetDisplayConfigService {
	return &assetDisplayConfigService{
		configRepo:    configRepo,
		fetchCodeRepo: fetchCodeRepo,
		assetPriceRepo: assetPriceRepo,
	}
}

// GetDisplayPrices returns enabled configs for assetType, each resolved via fetch codes.
// If price resolution fails for an individual config (e.g. no fetch codes configured),
// the DTO is included with Buy=0, Sell=0, IsStale=true rather than failing the whole call.
func (s *assetDisplayConfigService) GetDisplayPrices(ctx context.Context, assetType string) ([]*AssetDisplayPriceDTO, error) {
	configs, err := s.configRepo.ListByAssetType(ctx, assetType)
	if err != nil {
		return nil, err
	}

	result := make([]*AssetDisplayPriceDTO, 0, len(configs))
	for _, cfg := range configs {
		dto := &AssetDisplayPriceDTO{
			TypeCode:         cfg.TypeCode,
			AssetType:        cfg.AssetType,
			DisplayName:      cfg.DisplayName,
			DisplayOrder:     cfg.DisplayOrder,
			Enabled:          cfg.Enabled,
			ShowInInvestment: cfg.ShowInInvestment,
			// Default: stale with zero prices (safe fallback).
			IsStale: true,
		}

		price, isStale, resolveErr := s.ResolvePrice(ctx, cfg.TypeCode, assetType)
		if resolveErr == nil {
			dto.Buy = price
			dto.IsStale = isStale
		}
		// On resolve error, dto retains IsStale=true, Buy=0, Sell=0.

		result = append(result, dto)
	}

	return result, nil
}

// ListAll returns all configs (including disabled) for the given asset type, for admin management.
func (s *assetDisplayConfigService) ListAll(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
	return s.configRepo.ListAll(ctx, assetType)
}

// Create validates inputs and inserts a new asset display config entry.
// Security: validates typeCode length, displayName after trim, displayOrder >= 0, and
// detects duplicate type_code before writing to DB.
func (s *assetDisplayConfigService) Create(
	ctx context.Context,
	typeCode, displayName, assetType string,
	displayOrder int32,
	enabled, showInInvestment bool,
) (*models.AssetDisplayConfig, error) {
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

	if assetType == "" {
		assetType = "gold"
	}

	// --- Duplicate type_code check ---
	existing, err := s.configRepo.GetByTypeCode(ctx, typeCode)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, apperrors.NewConflictError("type code already exists")
	}

	config := &models.AssetDisplayConfig{
		TypeCode:         typeCode,
		AssetType:        assetType,
		DisplayName:      displayName,
		DisplayOrder:     displayOrder,
		Enabled:          enabled,
		ShowInInvestment: showInInvestment,
	}

	if err := s.configRepo.Create(ctx, config); err != nil {
		return nil, err
	}

	return config, nil
}

// Update modifies an existing config entry identified by id.
// Returns NotFoundError if the record does not exist.
func (s *assetDisplayConfigService) Update(
	ctx context.Context,
	id int32,
	displayName string,
	displayOrder int32,
	enabled, showInInvestment bool,
) (*models.AssetDisplayConfig, error) {
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

	config, err := s.configRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if config == nil {
		return nil, apperrors.NewNotFoundError("asset display config")
	}

	config.DisplayName = displayName
	config.DisplayOrder = displayOrder
	config.Enabled = enabled
	config.ShowInInvestment = showInInvestment

	if err := s.configRepo.Update(ctx, config); err != nil {
		return nil, err
	}

	return config, nil
}

// Delete soft-deletes a config entry by id.
// Delegates entirely to the repository which returns NotFoundError if absent.
func (s *assetDisplayConfigService) Delete(ctx context.Context, id int32) error {
	return s.configRepo.Delete(ctx, id)
}

// ResolvePrice resolves the best available price for a typeCode + assetType pair by
// iterating fetch codes in priority order.
//
// Algorithm:
//  1. Get config by typeCode + assetType.
//  2. Get fetch codes ordered by priority ASC.
//  3. If no fetch codes: return error.
//  4. Load all asset_price rows for this assetType once (single DB query).
//  5. For each fetch code (by priority): if found and not stale, return price.Buy, false, nil.
//  6. If all are stale: return the freshest stale price.Buy, true, nil.
//  7. If no asset_price rows match any fetch code: return error.
func (s *assetDisplayConfigService) ResolvePrice(ctx context.Context, typeCode, assetType string) (int64, bool, error) {
	// Step 1: Get config.
	cfg, err := s.configRepo.GetByTypeCodeAndAssetType(ctx, typeCode, assetType)
	if err != nil {
		return 0, false, err
	}
	if cfg == nil {
		return 0, false, apperrors.NewNotFoundError(fmt.Sprintf("asset display config for type_code=%s asset_type=%s", typeCode, assetType))
	}

	// Step 2: Get fetch codes ordered by priority ASC.
	fetchCodes, err := s.fetchCodeRepo.ListByConfigID(ctx, cfg.ID)
	if err != nil {
		return 0, false, err
	}

	// Step 3: No fetch codes configured.
	if len(fetchCodes) == 0 {
		return 0, false, apperrors.NewValidationError(fmt.Sprintf("no fetch codes configured for type_code=%s", typeCode))
	}

	// Step 4: Load all asset_price rows for this assetType once.
	allPrices, err := s.assetPriceRepo.ListByAssetType(ctx, assetType)
	if err != nil {
		return 0, false, err
	}

	// Build a lookup map: typeCode → price (take most recently fetched for each type_code).
	priceMap := make(map[string]*models.AssetPrice, len(allPrices))
	for _, p := range allPrices {
		existing, ok := priceMap[p.TypeCode]
		if !ok || p.FetchedAt.After(existing.FetchedAt) {
			priceMap[p.TypeCode] = p
		}
	}

	// Step 5: Iterate fetch codes by priority. Return first non-stale hit.
	var freshestStale *models.AssetPrice

	for _, fc := range fetchCodes {
		p, ok := priceMap[fc.TypeCode]
		if !ok {
			// This fetch code's type_code has no price row; try next.
			continue
		}

		if !p.IsStale {
			// Found a non-stale price — return immediately.
			return p.Buy, false, nil
		}

		// Track freshest stale price.
		if freshestStale == nil || p.FetchedAt.After(freshestStale.FetchedAt) {
			freshestStale = p
		}
	}

	// Step 6: All prices were stale — return freshest stale price.
	if freshestStale != nil {
		return freshestStale.Buy, true, nil
	}

	// Step 7: No matching asset_price rows at all.
	return 0, false, apperrors.NewNotFoundError(fmt.Sprintf("no asset price found for fetch codes of type_code=%s", typeCode))
}

// ListFetchCodes retrieves all active fetch codes for a config ordered by priority ASC.
func (s *assetDisplayConfigService) ListFetchCodes(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
	return s.fetchCodeRepo.ListByConfigID(ctx, configID)
}

// CreateFetchCode adds a fetch code to a config.
//
// Validation:
//   - type_code: 1-50 chars (non-empty, max length)
//   - priority: >= 0
//   - max 10 fetch codes per config (CountByConfigID check before Create)
//   - type_code must exist in asset_price table (ListAvailableTypeCodes check)
func (s *assetDisplayConfigService) CreateFetchCode(
	ctx context.Context,
	configID int32,
	typeCode string,
	priority int32,
) (*models.AssetConfigFetchCode, error) {
	// Validate type_code.
	if typeCode == "" {
		return nil, apperrors.NewValidationError("type_code is required")
	}
	if len(typeCode) > 50 {
		return nil, apperrors.NewValidationError("type_code must not exceed 50 characters")
	}

	// Validate priority.
	if priority < 0 {
		return nil, apperrors.NewValidationError("priority must be >= 0")
	}

	// Get config to determine assetType for type_code existence check.
	cfg, err := s.configRepo.GetByID(ctx, configID)
	if err != nil {
		return nil, err
	}
	if cfg == nil {
		return nil, apperrors.NewNotFoundError("asset display config")
	}

	// Check max cap (10 fetch codes per config).
	count, err := s.fetchCodeRepo.CountByConfigID(ctx, configID)
	if err != nil {
		return nil, err
	}
	if count >= 10 {
		return nil, apperrors.NewValidationError("maximum of 10 fetch codes per config has been reached")
	}

	// Validate type_code exists in asset_price table.
	availableCodes, err := s.ListAvailableTypeCodes(ctx, cfg.AssetType)
	if err != nil {
		return nil, err
	}
	found := false
	for _, code := range availableCodes {
		if code == typeCode {
			found = true
			break
		}
	}
	if !found {
		return nil, apperrors.NewValidationError(fmt.Sprintf("type_code=%s does not exist in asset_price table for asset_type=%s", typeCode, cfg.AssetType))
	}

	fc := &models.AssetConfigFetchCode{
		ConfigID: configID,
		TypeCode: typeCode,
		Priority: priority,
	}

	if err := s.fetchCodeRepo.Create(ctx, fc); err != nil {
		return nil, err
	}

	return fc, nil
}

// UpdateFetchCode updates the priority of an existing fetch code.
// Validates priority >= 0 and returns NotFoundError if the fetch code does not exist.
func (s *assetDisplayConfigService) UpdateFetchCode(
	ctx context.Context,
	id int32,
	priority int32,
) (*models.AssetConfigFetchCode, error) {
	// Validate priority.
	if priority < 0 {
		return nil, apperrors.NewValidationError("priority must be >= 0")
	}

	fc, err := s.fetchCodeRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if fc == nil {
		return nil, apperrors.NewNotFoundError("asset config fetch code")
	}

	fc.Priority = priority

	if err := s.fetchCodeRepo.Update(ctx, fc); err != nil {
		return nil, err
	}

	return fc, nil
}

// DeleteFetchCode soft-deletes a fetch code by id.
// Delegates to the repository which returns NotFoundError if absent.
func (s *assetDisplayConfigService) DeleteFetchCode(ctx context.Context, id int32) error {
	return s.fetchCodeRepo.Delete(ctx, id)
}

// ListAvailableTypeCodes returns all distinct type_codes from the asset_price table
// that are relevant for the given assetType.
func (s *assetDisplayConfigService) ListAvailableTypeCodes(ctx context.Context, assetType string) ([]string, error) {
	prices, err := s.assetPriceRepo.ListByAssetType(ctx, assetType)
	if err != nil {
		return nil, err
	}

	seen := make(map[string]struct{}, len(prices))
	codes := make([]string, 0, len(prices))
	for _, p := range prices {
		if _, exists := seen[p.TypeCode]; !exists {
			seen[p.TypeCode] = struct{}{}
			codes = append(codes, p.TypeCode)
		}
	}

	return codes, nil
}
