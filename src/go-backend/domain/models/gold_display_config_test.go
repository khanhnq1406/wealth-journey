package models_test

import (
	"reflect"
	"strings"
	"testing"

	"wealthjourney/domain/models"
)

func TestGoldDisplayConfig_TableName(t *testing.T) {
	m := models.GoldDisplayConfig{}
	if m.TableName() != "gold_display_config" {
		t.Errorf("expected gold_display_config, got %s", m.TableName())
	}
}

func TestGoldDisplayConfig_FieldTypes(t *testing.T) {
	cfg := models.GoldDisplayConfig{
		ID:               1,
		TypeCode:         "SJC",
		DisplayName:      "SJC",
		DisplayOrder:     1,
		Enabled:          true,
		ShowInInvestment: true,
	}

	if cfg.TypeCode != "SJC" {
		t.Errorf("expected TypeCode='SJC', got '%s'", cfg.TypeCode)
	}
	if cfg.DisplayName != "SJC" {
		t.Errorf("expected DisplayName='SJC', got '%s'", cfg.DisplayName)
	}
	if cfg.DisplayOrder != 1 {
		t.Errorf("expected DisplayOrder=1, got %d", cfg.DisplayOrder)
	}
	if !cfg.Enabled {
		t.Errorf("expected Enabled=true, got false")
	}
	if !cfg.ShowInInvestment {
		t.Errorf("expected ShowInInvestment=true, got false")
	}
}

func TestGoldDisplayConfig_UniqueIndex_TypeCode(t *testing.T) {
	const wantIndex = "idx_gold_display_config_type_code"

	typ := reflect.TypeOf(models.GoldDisplayConfig{})
	field, ok := typ.FieldByName("TypeCode")
	if !ok {
		t.Fatal("TypeCode field not found in GoldDisplayConfig")
	}
	tag := field.Tag.Get("gorm")
	if !strings.Contains(tag, wantIndex) {
		t.Errorf("TypeCode gorm tag %q does not contain uniqueIndex name %q", tag, wantIndex)
	}
}

func TestGoldDisplayConfig_Defaults(t *testing.T) {
	// Verify that Enabled defaults are represented correctly in GORM tags
	typ := reflect.TypeOf(models.GoldDisplayConfig{})

	enabledField, ok := typ.FieldByName("Enabled")
	if !ok {
		t.Fatal("Enabled field not found in GoldDisplayConfig")
	}
	if !strings.Contains(enabledField.Tag.Get("gorm"), "default:true") {
		t.Errorf("Enabled gorm tag %q missing 'default:true'", enabledField.Tag.Get("gorm"))
	}

	showField, ok := typ.FieldByName("ShowInInvestment")
	if !ok {
		t.Fatal("ShowInInvestment field not found in GoldDisplayConfig")
	}
	if !strings.Contains(showField.Tag.Get("gorm"), "default:true") {
		t.Errorf("ShowInInvestment gorm tag %q missing 'default:true'", showField.Tag.Get("gorm"))
	}
}
