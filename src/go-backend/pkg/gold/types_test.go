package gold

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetGoldTypeByCode_NewTypes(t *testing.T) {
	tests := []struct {
		code     string
		wantName string
		wantCurr string
	}{
		{"SJC", "SJC 9999", "VND"},
		{"SJC TD", "SJC Tự Do", "VND"},
		{"Eximbank", "Eximbank SJC", "VND"},
		{"Doji", "DOJI", "VND"},
		{"999,9 TD", "Vàng 999.9 Tự Do", "VND"},
		{"99,9 TD", "Vàng 99.9 Tự Do", "VND"},
		{"Vàng 95%", "Vàng 95%", "VND"},
		{"BTMC_24K", "Bảo Tín 24K", "VND"},
		{"99,99% GF", "Golden Fund 99.99%", "VND"},
		{"95% GF", "Golden Fund 95%", "VND"},
		{"XAUUSD", "Gold World (XAU/USD)", "USD"},
	}

	for _, tt := range tests {
		t.Run(tt.code, func(t *testing.T) {
			gt := GetGoldTypeByCode(tt.code)
			if gt == nil {
				t.Fatalf("Expected gold type for %s, got nil", tt.code)
			}
			if gt.Name != tt.wantName {
				t.Errorf("Name = %s, want %s", gt.Name, tt.wantName)
			}
			if gt.Currency != tt.wantCurr {
				t.Errorf("Currency = %s, want %s", gt.Currency, tt.wantCurr)
			}
		})
	}
}

func TestGetGoldTypeByCode_RemovedTypes(t *testing.T) {
	removedCodes := []string{"SJ9999", "DOHNL", "DOHCML", "DOJINHTV", "PQHNVM", "PQHN24NTT", "VIETTINMSJC"}

	for _, code := range removedCodes {
		t.Run(code, func(t *testing.T) {
			gt := GetGoldTypeByCode(code)
			if gt != nil {
				t.Errorf("Expected nil for removed type %s, got %+v", code, gt)
			}
		})
	}
}

// TestAliasToCanonical_AllTargetsExistInGoldTypes verifies that every canonical
// code referenced by AliasToCanonical is present in the GoldTypes registry.
// This prevents phantom aliases that point to non-existent codes.
func TestAliasToCanonical_AllTargetsExistInGoldTypes(t *testing.T) {
	canonicalCodes := make(map[string]struct{}, len(GoldTypes))
	for _, gt := range GoldTypes {
		canonicalCodes[gt.Code] = struct{}{}
	}
	for alias, canonical := range AliasToCanonical {
		_, exists := canonicalCodes[canonical]
		assert.True(t, exists,
			"AliasToCanonical[%q] = %q but %q is not in GoldTypes", alias, canonical, canonical)
	}
}

// TestAliasToCanonical_KnownMappings verifies specific known mappings.
func TestAliasToCanonical_KnownMappings(t *testing.T) {
	cases := []struct {
		alias     string
		canonical string
	}{
		{"VNGSJC", "SJC"},
		{"MIHONG_999", "Mihong_999"},
		{"SJ9999", "Vàng nhẫn SJC"},
		{"SJL1L10", "SJC"},
		{"DOHN", "Doji"},
		{"DOHCM", "Doji"},
		{"BTSJC", "BTMC"},
		{"BT9999", "BTMC_24K"},
		{"VIETTINM", "VietinGold"},
	}
	for _, tc := range cases {
		t.Run(tc.alias, func(t *testing.T) {
			got, ok := AliasToCanonical[tc.alias]
			assert.True(t, ok, "missing alias %q", tc.alias)
			assert.Equal(t, tc.canonical, got)
		})
	}
}
