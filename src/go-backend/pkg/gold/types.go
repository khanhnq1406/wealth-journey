package gold

import (
	investmentv1 "wealthjourney/protobuf/v1"
)

const (
	// GramsPerMace is the conversion factor for Vietnamese mace (chỉ) to grams
	// 1 mace (chỉ) = 3.75 grams (1 tael/lượng = 10 mace = 37.5g)
	GramsPerMace = 3.75

	// GramsPerOunce is the conversion factor for troy ounce to grams
	// 1 troy ounce = 31.1034768 grams
	GramsPerOunce = 31.1034768

	// gramsPerLuong is used internally for market price normalization.
	// The vang.today API returns VND gold prices per lượng (= 10 mace = 37.5g).
	gramsPerLuong = 37.5
)

// GoldUnit represents the physical unit for gold quantity
type GoldUnit string

const (
	UnitGram  GoldUnit = "gram"
	UnitMace  GoldUnit = "mace"
	UnitOunce GoldUnit = "oz"
)

// GoldType defines a gold type available from vang.today
type GoldType struct {
	Code       string                      // Type code (e.g., "SJL1L10", "XAU")
	Name       string                      // Display name
	Currency   string                      // "VND" or "USD"
	Unit       GoldUnit                    // "mace", "gram", or "oz"
	UnitWeight float64                     // Weight in grams
	Type       investmentv1.InvestmentType // InvestmentType enum value
}

// GoldTypes is the registry of supported gold types.
// VND gold types are no longer listed here — they are served dynamically from the
// asset_display_config table via AssetDisplayConfigService.ListForInvestment().
// GetGoldTypesByCurrency("VND") intentionally returns an empty slice.
var GoldTypes = []GoldType{
	// World Gold (ounce-based, USD)
	{
		Code:       "XAUUSD",
		Name:       "Gold World (XAU/USD)",
		Currency:   "USD",
		Unit:       UnitOunce,
		UnitWeight: GramsPerOunce,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD,
	},
}

// GetGoldTypeByCode returns the gold type definition for a given code
func GetGoldTypeByCode(code string) *GoldType {
	for _, gt := range GoldTypes {
		if gt.Code == code {
			return &gt
		}
	}
	return nil
}

// GetGoldTypesByCurrency returns all gold types for a given currency
func GetGoldTypesByCurrency(currency string) []GoldType {
	var result []GoldType
	for _, gt := range GoldTypes {
		if gt.Currency == currency {
			result = append(result, gt)
		}
	}
	return result
}

// GetNativeStorageInfo returns the storage unit and native currency for a gold investment type
func GetNativeStorageInfo(investmentType investmentv1.InvestmentType) (GoldUnit, string) {
	switch investmentType {
	case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND:
		return UnitGram, "VND" // Store VND gold in grams
	case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD:
		return UnitOunce, "USD" // Store USD gold in ounces
	default:
		return UnitGram, "USD"
	}
}

// GetPriceUnitForMarketData returns what unit market prices are in for display.
// Note: vang.today API returns VND gold prices per lượng (37.5g), but we display per mace (3.75g).
// The ProcessMarketPrice function handles the lượng→gram conversion internally.
func GetPriceUnitForMarketData(investmentType investmentv1.InvestmentType) GoldUnit {
	switch investmentType {
	case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND:
		return UnitMace // VND gold display unit is mace (chỉ)
	case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD:
		return UnitOunce // World gold market price is per ounce
	default:
		return UnitOunce
	}
}

// IsGoldType checks if an investment type is a gold type
func IsGoldType(t investmentv1.InvestmentType) bool {
	return t == investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND ||
		t == investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD
}
