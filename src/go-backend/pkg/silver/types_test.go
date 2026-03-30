package silver

import (
	"testing"
)

func TestGetSilverTypeByCode_USDType(t *testing.T) {
	tests := []struct {
		code     string
		wantName string
		wantCurr string
	}{
		{"XAGUSD", "Silver World (XAG/USD)", "USD"},
	}

	for _, tt := range tests {
		t.Run(tt.code, func(t *testing.T) {
			st := GetSilverTypeByCode(tt.code)
			if st == nil {
				t.Fatalf("Expected silver type for %s, got nil", tt.code)
			}
			if st.Name != tt.wantName {
				t.Errorf("Name = %s, want %s", st.Name, tt.wantName)
			}
			if st.Currency != tt.wantCurr {
				t.Errorf("Currency = %s, want %s", st.Currency, tt.wantCurr)
			}
		})
	}
}

func TestGetSilverTypeByCode_VNDTypesReturnNil(t *testing.T) {
	// VND entries have been removed from SilverTypes — they are now served
	// dynamically via AssetDisplayConfigService.ListForInvestment().
	vndCodes := []string{
		"GOLDENFUND_1L", "GOLDENFUND_5L", "GOLDENFUND_10L",
		"PHUQUY_1L", "PHUQUY_5L",
		"ANCARAT_1L", "ANCARAT_5L",
		"GOLDENFUND_1KG", "PHUQUY_1KG", "ANCARAT_1KG",
	}

	for _, code := range vndCodes {
		t.Run(code, func(t *testing.T) {
			st := GetSilverTypeByCode(code)
			if st != nil {
				t.Errorf("Expected nil for removed VND type %q, got %+v", code, st)
			}
		})
	}
}

func TestGetSilverTypeByCode_RemovedTypes(t *testing.T) {
	removedCodes := []string{"AG_VND_Tael", "AG_VND_Kg", "AG_VND"}

	for _, code := range removedCodes {
		t.Run(code, func(t *testing.T) {
			st := GetSilverTypeByCode(code)
			if st != nil {
				t.Errorf("Expected nil for removed type %s, got %+v", code, st)
			}
		})
	}
}

func TestGetSilverTypesByCurrency_VNDReturnsEmpty(t *testing.T) {
	// VND entries have been removed — GetSilverTypesByCurrency("VND") must return empty.
	vndTypes := GetSilverTypesByCurrency("VND")
	if len(vndTypes) != 0 {
		t.Errorf("Expected 0 VND silver types, got %d: %+v", len(vndTypes), vndTypes)
	}
}

func TestGetSilverTypesByCurrency_USDReturnsXAGUSD(t *testing.T) {
	usdTypes := GetSilverTypesByCurrency("USD")
	if len(usdTypes) != 1 {
		t.Fatalf("Expected 1 USD silver type, got %d", len(usdTypes))
	}
	if usdTypes[0].Code != "XAGUSD" {
		t.Errorf("Expected XAGUSD, got %q", usdTypes[0].Code)
	}
}

func TestGetPriceUnitForMarketData_NewTypes(t *testing.T) {
	tests := []struct {
		symbol   string
		wantUnit SilverUnit
	}{
		{"GOLDENFUND_1L", UnitTael},
		{"ANCARAT_5L", UnitTael},
		{"PHUQUY_1KG", UnitKg},
		{"XAGUSD", UnitOunce},
	}

	for _, tt := range tests {
		t.Run(tt.symbol, func(t *testing.T) {
			got := GetPriceUnitForMarketData(tt.symbol)
			if got != tt.wantUnit {
				t.Errorf("GetPriceUnitForMarketData(%s) = %s, want %s", tt.symbol, got, tt.wantUnit)
			}
		})
	}
}
