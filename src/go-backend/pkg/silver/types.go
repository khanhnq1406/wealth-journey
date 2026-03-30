package silver

import investmentv1 "wealthjourney/protobuf/v1"

const (
	GramsPerTael  = 37.5
	GramsPerOunce = 31.1034768
	GramsPerKg    = 1000.0
)

type SilverUnit string

const (
	UnitGram  SilverUnit = "gram"
	UnitTael  SilverUnit = "tael" // lượng
	UnitKg    SilverUnit = "kg"
	UnitOunce SilverUnit = "oz"
)

type SilverType struct {
	Code     string                      // "AG_VND", "XAG"
	Name     string                      // Display name
	Currency string                      // "VND" or "USD"
	Type     investmentv1.InvestmentType // Enum value
}

// SilverTypes is the registry of supported silver types.
// VND silver types are no longer listed here — they are served dynamically from the
// asset_display_config table via AssetDisplayConfigService.ListForInvestment().
// GetSilverTypesByCurrency("VND") intentionally returns an empty slice.
var SilverTypes = []SilverType{
	// Ounce-based - USD (use Yahoo Finance)
	{
		Code:     "XAGUSD",
		Name:     "Silver World (XAG/USD)",
		Currency: "USD",
		Type:     investmentv1.InvestmentType_INVESTMENT_TYPE_SILVER_USD,
	},
}

// GetNativeStorageInfo returns storage unit and native currency
func GetNativeStorageInfo(investmentType investmentv1.InvestmentType) (SilverUnit, string) {
	switch investmentType {
	case investmentv1.InvestmentType_INVESTMENT_TYPE_SILVER_VND:
		return UnitGram, "VND" // Store VND silver in grams
	case investmentv1.InvestmentType_INVESTMENT_TYPE_SILVER_USD:
		return UnitOunce, "USD" // Store USD silver in ounces
	default:
		return UnitGram, "USD"
	}
}

// GetPriceUnitForMarketData returns what unit market prices are in based on the symbol
func GetPriceUnitForMarketData(symbol string) SilverUnit {
	// Check if ends with L (tael-based)
	if len(symbol) > 2 && symbol[len(symbol)-1] == 'L' {
		return UnitTael
	}
	// Check if ends with KG (kg-based)
	if len(symbol) >= 2 && symbol[len(symbol)-2:] == "KG" {
		return UnitKg
	}
	// XAGUSD or other USD silver
	if symbol == "XAGUSD" || symbol == "SI=F" {
		return UnitOunce
	}
	return UnitOunce
}

func IsSilverType(t investmentv1.InvestmentType) bool {
	return t == investmentv1.InvestmentType_INVESTMENT_TYPE_SILVER_VND ||
		t == investmentv1.InvestmentType_INVESTMENT_TYPE_SILVER_USD
}

func GetSilverTypeByCode(code string) *SilverType {
	for _, st := range SilverTypes {
		if st.Code == code {
			return &st
		}
	}
	return nil
}

func GetSilverTypesByCurrency(currency string) []SilverType {
	var result []SilverType
	for _, st := range SilverTypes {
		if st.Currency == currency {
			result = append(result, st)
		}
	}
	return result
}
