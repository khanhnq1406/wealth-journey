package silver

import (
	"testing"
)

func TestGetSilverTypeByCode_NewTypes(t *testing.T) {
	tests := []struct {
		code     string
		wantName string
		wantCurr string
	}{
		{"GOLDENFUND_1L", "Golden Fund 1 Lượng", "VND"},
		{"ANCARAT_1KG", "Ancarat 1 Kg", "VND"},
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

