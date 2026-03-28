package models_test

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"wealthjourney/domain/models"
)

// ---- AssetDisplayConfig tests ----

func TestAssetDisplayConfig_TableName(t *testing.T) {
	m := models.AssetDisplayConfig{}
	if m.TableName() != "asset_display_config" {
		t.Errorf("expected table name 'asset_display_config', got %q", m.TableName())
	}
}

func TestAssetDisplayConfig_FieldValues(t *testing.T) {
	cfg := models.AssetDisplayConfig{
		ID:               1,
		TypeCode:         "SJC",
		AssetType:        "gold",
		DisplayName:      "SJC Gold",
		DisplayOrder:     1,
		Enabled:          true,
		ShowInInvestment: true,
	}

	if cfg.TypeCode != "SJC" {
		t.Errorf("expected TypeCode='SJC', got %q", cfg.TypeCode)
	}
	if cfg.AssetType != "gold" {
		t.Errorf("expected AssetType='gold', got %q", cfg.AssetType)
	}
	if cfg.DisplayName != "SJC Gold" {
		t.Errorf("expected DisplayName='SJC Gold', got %q", cfg.DisplayName)
	}
	if cfg.DisplayOrder != 1 {
		t.Errorf("expected DisplayOrder=1, got %d", cfg.DisplayOrder)
	}
	if !cfg.Enabled {
		t.Error("expected Enabled=true, got false")
	}
	if !cfg.ShowInInvestment {
		t.Error("expected ShowInInvestment=true, got false")
	}
}

func TestAssetDisplayConfig_AssetTypeField_JsonTag(t *testing.T) {
	typ := reflect.TypeOf(models.AssetDisplayConfig{})
	field, ok := typ.FieldByName("AssetType")
	if !ok {
		t.Fatal("AssetType field not found in AssetDisplayConfig")
	}
	jsonTag := field.Tag.Get("json")
	if jsonTag != "assetType" {
		t.Errorf("expected json tag 'assetType', got %q", jsonTag)
	}
}

func TestAssetDisplayConfig_UniqueIndex_TypeCodeAssetType(t *testing.T) {
	const wantIndex = "idx_asset_display_config_type_code_asset_type"

	typ := reflect.TypeOf(models.AssetDisplayConfig{})

	typeCodeField, ok := typ.FieldByName("TypeCode")
	if !ok {
		t.Fatal("TypeCode field not found in AssetDisplayConfig")
	}
	if !strings.Contains(typeCodeField.Tag.Get("gorm"), wantIndex) {
		t.Errorf("TypeCode gorm tag %q does not contain composite uniqueIndex %q", typeCodeField.Tag.Get("gorm"), wantIndex)
	}

	assetTypeField, ok := typ.FieldByName("AssetType")
	if !ok {
		t.Fatal("AssetType field not found in AssetDisplayConfig")
	}
	if !strings.Contains(assetTypeField.Tag.Get("gorm"), wantIndex) {
		t.Errorf("AssetType gorm tag %q does not contain composite uniqueIndex %q", assetTypeField.Tag.Get("gorm"), wantIndex)
	}
}

func TestAssetDisplayConfig_Defaults(t *testing.T) {
	typ := reflect.TypeOf(models.AssetDisplayConfig{})

	enabledField, ok := typ.FieldByName("Enabled")
	if !ok {
		t.Fatal("Enabled field not found in AssetDisplayConfig")
	}
	if !strings.Contains(enabledField.Tag.Get("gorm"), "default:true") {
		t.Errorf("Enabled gorm tag %q missing 'default:true'", enabledField.Tag.Get("gorm"))
	}

	showField, ok := typ.FieldByName("ShowInInvestment")
	if !ok {
		t.Fatal("ShowInInvestment field not found in AssetDisplayConfig")
	}
	if !strings.Contains(showField.Tag.Get("gorm"), "default:true") {
		t.Errorf("ShowInInvestment gorm tag %q missing 'default:true'", showField.Tag.Get("gorm"))
	}

	assetTypeField, ok := typ.FieldByName("AssetType")
	if !ok {
		t.Fatal("AssetType field not found in AssetDisplayConfig")
	}
	if !strings.Contains(assetTypeField.Tag.Get("gorm"), "default:'gold'") {
		t.Errorf("AssetType gorm tag %q missing \"default:'gold'\"", assetTypeField.Tag.Get("gorm"))
	}
}

func TestAssetDisplayConfig_FetchCodesRelation(t *testing.T) {
	cfg := models.AssetDisplayConfig{
		FetchCodes: []models.AssetConfigFetchCode{
			{TypeCode: "SJC_BUY", Priority: 1},
			{TypeCode: "SJC_SELL", Priority: 2},
		},
	}
	if len(cfg.FetchCodes) != 2 {
		t.Errorf("expected 2 FetchCodes, got %d", len(cfg.FetchCodes))
	}
	if cfg.FetchCodes[0].TypeCode != "SJC_BUY" {
		t.Errorf("expected FetchCodes[0].TypeCode='SJC_BUY', got %q", cfg.FetchCodes[0].TypeCode)
	}
}

// ---- AssetConfigFetchCode tests ----

func TestAssetConfigFetchCode_TableName(t *testing.T) {
	m := models.AssetConfigFetchCode{}
	if m.TableName() != "asset_config_fetch_code" {
		t.Errorf("expected table name 'asset_config_fetch_code', got %q", m.TableName())
	}
}

func TestAssetConfigFetchCode_FieldValues(t *testing.T) {
	fc := models.AssetConfigFetchCode{
		ID:       1,
		ConfigID: 10,
		TypeCode: "SJC_BUY",
		Priority: 3,
	}

	if fc.ConfigID != 10 {
		t.Errorf("expected ConfigID=10, got %d", fc.ConfigID)
	}
	if fc.TypeCode != "SJC_BUY" {
		t.Errorf("expected TypeCode='SJC_BUY', got %q", fc.TypeCode)
	}
	if fc.Priority != 3 {
		t.Errorf("expected Priority=3, got %d", fc.Priority)
	}
}

func TestAssetConfigFetchCode_UniqueIndex_ConfigIDTypeCode(t *testing.T) {
	const wantIndex = "idx_asset_config_fetch_code_unique"

	typ := reflect.TypeOf(models.AssetConfigFetchCode{})

	configIDField, ok := typ.FieldByName("ConfigID")
	if !ok {
		t.Fatal("ConfigID field not found in AssetConfigFetchCode")
	}
	if !strings.Contains(configIDField.Tag.Get("gorm"), wantIndex) {
		t.Errorf("ConfigID gorm tag %q does not contain composite uniqueIndex %q", configIDField.Tag.Get("gorm"), wantIndex)
	}

	typeCodeField, ok := typ.FieldByName("TypeCode")
	if !ok {
		t.Fatal("TypeCode field not found in AssetConfigFetchCode")
	}
	if !strings.Contains(typeCodeField.Tag.Get("gorm"), wantIndex) {
		t.Errorf("TypeCode gorm tag %q does not contain composite uniqueIndex %q", typeCodeField.Tag.Get("gorm"), wantIndex)
	}
}

func TestAssetConfigFetchCode_Priority_DefaultZero(t *testing.T) {
	typ := reflect.TypeOf(models.AssetConfigFetchCode{})
	priorityField, ok := typ.FieldByName("Priority")
	if !ok {
		t.Fatal("Priority field not found in AssetConfigFetchCode")
	}
	if !strings.Contains(priorityField.Tag.Get("gorm"), "default:0") {
		t.Errorf("Priority gorm tag %q missing 'default:0'", priorityField.Tag.Get("gorm"))
	}
}

// ---- Investment.PriceUpdatedAt tests ----

func TestInvestment_PriceUpdatedAt_FieldExists(t *testing.T) {
	typ := reflect.TypeOf(models.Investment{})
	field, ok := typ.FieldByName("PriceUpdatedAt")
	if !ok {
		t.Fatal("PriceUpdatedAt field not found in Investment struct")
	}

	// Must be *time.Time (nullable)
	expectedType := reflect.TypeOf((*time.Time)(nil))
	if field.Type != expectedType {
		t.Errorf("PriceUpdatedAt expected type *time.Time, got %v", field.Type)
	}
}

func TestInvestment_PriceUpdatedAt_IsNullableByDefault(t *testing.T) {
	inv := models.Investment{}
	if inv.PriceUpdatedAt != nil {
		t.Error("expected PriceUpdatedAt to be nil by default")
	}
}

func TestInvestment_PriceUpdatedAt_CanBeSet(t *testing.T) {
	now := time.Now()
	inv := models.Investment{
		PriceUpdatedAt: &now,
	}
	if inv.PriceUpdatedAt == nil {
		t.Fatal("expected PriceUpdatedAt to be non-nil after assignment")
	}
	if !inv.PriceUpdatedAt.Equal(now) {
		t.Errorf("expected PriceUpdatedAt=%v, got %v", now, *inv.PriceUpdatedAt)
	}
}
