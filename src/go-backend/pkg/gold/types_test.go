package gold

import (
	"testing"
)

func TestGetGoldTypeByCode_USDType(t *testing.T) {
	tests := []struct {
		code     string
		wantName string
		wantCurr string
	}{
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

func TestGetGoldTypeByCode_VNDTypesReturnNil(t *testing.T) {
	// VND entries have been removed from GoldTypes — they are now served
	// dynamically via AssetDisplayConfigService.ListForInvestment().
	vndCodes := []string{
		"SJC", "SJC TD", "Eximbank", "TPBank", "Doji", "VietinGold",
		"ACBBank", "Mi hồng", "Vàng nhẫn SJC", "BTMC", "PNJ HCM",
		"999,9 TD", "99,9 TD", "Vàng 95%", "Doji_24K", "BTMC_24K",
		"Mihong_999", "99,99% GF", "95% GF",
	}

	for _, code := range vndCodes {
		t.Run(code, func(t *testing.T) {
			gt := GetGoldTypeByCode(code)
			if gt != nil {
				t.Errorf("Expected nil for removed VND type %q, got %+v", code, gt)
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

func TestGetGoldTypesByCurrency_VNDReturnsEmpty(t *testing.T) {
	// VND entries have been removed — GetGoldTypesByCurrency("VND") must return empty.
	vndTypes := GetGoldTypesByCurrency("VND")
	if len(vndTypes) != 0 {
		t.Errorf("Expected 0 VND gold types, got %d: %+v", len(vndTypes), vndTypes)
	}
}

func TestGetGoldTypesByCurrency_USDReturnsXAUUSD(t *testing.T) {
	usdTypes := GetGoldTypesByCurrency("USD")
	if len(usdTypes) != 1 {
		t.Fatalf("Expected 1 USD gold type, got %d", len(usdTypes))
	}
	if usdTypes[0].Code != "XAUUSD" {
		t.Errorf("Expected XAUUSD, got %q", usdTypes[0].Code)
	}
}
