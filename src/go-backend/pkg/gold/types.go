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

// GoldTypes is the registry of all supported gold types
var GoldTypes = []GoldType{
	// SJC Gold (mace-based, VND × 1000)
	{
		Code:       "SJC",
		Name:       "SJC 9999",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "SJC TD",
		Name:       "SJC Tự Do",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "Eximbank",
		Name:       "Eximbank SJC",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "TPBank",
		Name:       "TPBank SJC",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "Doji",
		Name:       "DOJI",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "VietinGold",
		Name:       "VietinBank Gold",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "ACBBank",
		Name:       "ACB Gold",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "Mi hồng",
		Name:       "Mi Hồng Gold",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "Vàng nhẫn SJC",
		Name:       "Nhẫn SJC 9999",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "BTMC",
		Name:       "Bảo Tín SJC",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "PNJ HCM",
		Name:       "PNJ",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	// Other Gold Types (mace-based, VND × 1000)
	{
		Code:       "999,9 TD",
		Name:       "Vàng 999.9 Tự Do",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "99,9 TD",
		Name:       "Vàng 99.9 Tự Do",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "Vàng 95%",
		Name:       "Vàng 95%",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "Doji_24K",
		Name:       "DOJI 24K",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "BTMC_24K",
		Name:       "Bảo Tín 24K",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "Mihong_999",
		Name:       "Mi Hồng 999",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "99,99% GF",
		Name:       "Golden Fund 99.99%",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
	{
		Code:       "95% GF",
		Name:       "Golden Fund 95%",
		Currency:   "VND",
		Unit:       UnitMace,
		UnitWeight: GramsPerMace,
		Type:       investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
	},
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

// AliasToCanonical documents known mappings between external API alias TypeCodes
// and their previously-used canonical codes. Retained as reference only.
//
// IMPORTANT: As of 2026-03-27 this map is NO LONGER applied during DB writes.
// Raw TypeCodes from all price sources are stored in the asset_price table as-is.
// Admins configure source→display mappings via asset_config_fetch_code.
//
// Historical note: vang.today returns source-specific codes (e.g. "DOHN", "DOHCM"
// for DOJI Hanoi and HCM branches) that previously collapsed to one canonical "Doji"
// row. They are now stored as separate rows, allowing admins to map each independently.
var AliasToCanonical = map[string]string{
	// vang.today SJC aliases
	"VNGSJC":  "SJC",   // vang.today's main SJC bar code
	"SJL1L10": "SJC",   // vang.today SJC 1L/10L bar variant

	// vang.today SJC ring
	"SJ9999": "Vàng nhẫn SJC", // vang.today SJC ring 9999

	// vang.today Mihong
	"MIHONG_999": "Mihong_999", // vang.today uppercases the underscore variant

	// vang.today DOJI — HN and HCM branches both map to canonical "Doji"
	"DOHN":  "Doji",
	"DOHCM": "Doji",

	// vang.today Bảo Tín Minh Châu
	"BTSJC":  "BTMC",     // Bảo Tín SJC bar
	"BT9999": "BTMC_24K", // Bảo Tín 24K bar

	// vang.today VietinBank gold
	"VIETTINM": "VietinGold",
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
