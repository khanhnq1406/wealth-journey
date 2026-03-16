package gold

import (
	"context"
	"fmt"
	"math"

	"wealthjourney/pkg/fx"
	investmentv1 "wealthjourney/protobuf/v1"
)

// Converter handles BOTH unit and currency conversions for gold
// LAYER 1: Unit conversion (mace ↔ gram ↔ ounce)
// LAYER 2: Currency conversion (VND ↔ USD via FXRateService)
type Converter struct {
	fxService fx.Service
}

// NewGoldConverter creates a new gold converter
func NewGoldConverter(fxService fx.Service) *Converter {
	return &Converter{fxService: fxService}
}

// ===== LAYER 1: UNIT CONVERSION =====

// ConvertQuantity converts quantity between units (no currency involved)
func ConvertQuantity(quantity float64, fromUnit, toUnit GoldUnit) float64 {
	// Convert everything to grams first, then to target
	var inGrams float64

	switch fromUnit {
	case UnitMace:
		inGrams = quantity * GramsPerMace
	case UnitOunce:
		inGrams = quantity * GramsPerOunce
	case UnitGram:
		inGrams = quantity
	}

	switch toUnit {
	case UnitMace:
		return inGrams / GramsPerMace
	case UnitOunce:
		return inGrams / GramsPerOunce
	case UnitGram:
		return inGrams
	}

	return inGrams
}

// ConvertPricePerUnit converts price between units (no currency involved)
// Used when converting price per mace to price per gram
// Price is inversely proportional to quantity
func ConvertPricePerUnit(price float64, fromUnit, toUnit GoldUnit) float64 {
	// Get quantity ratio for from unit
	var quantityRatio float64

	switch fromUnit {
	case UnitMace:
		quantityRatio = GramsPerMace
	case UnitOunce:
		quantityRatio = GramsPerOunce
	case UnitGram:
		quantityRatio = 1
	}

	// Convert price: if price is per mace, price per gram = price / 3.75
	pricePerGram := price / quantityRatio

	// Convert from grams to target unit
	switch toUnit {
	case UnitMace:
		return pricePerGram * GramsPerMace
	case UnitOunce:
		return pricePerGram * GramsPerOunce
	case UnitGram:
		return pricePerGram
	}

	return pricePerGram
}

// ===== STORAGE NORMALIZATION (Unit only) =====

// NormalizeQuantityForStorage converts user input quantity to internal storage format
// Handles LAYER 1: Unit conversion only
// Storage format: base_unit × 10000 (4 decimal precision)
func (c *Converter) NormalizeQuantityForStorage(
	quantity float64,
	inputUnit GoldUnit,
	investmentType investmentv1.InvestmentType,
) (int64, error) {
	storageUnit, _ := GetNativeStorageInfo(investmentType)

	// Convert input unit to storage unit
	inStorageUnits := ConvertQuantity(quantity, inputUnit, storageUnit)

	// Store with 4 decimal precision
	return int64(math.Round(inStorageUnits * 10000)), nil
}

// DenormalizeQuantityForDisplay converts stored quantity to display unit
func (c *Converter) DenormalizeQuantityForDisplay(
	storedQuantity int64,
	investmentType investmentv1.InvestmentType,
	displayUnit GoldUnit,
) float64 {
	storageUnit, _ := GetNativeStorageInfo(investmentType)
	inStorageUnits := float64(storedQuantity) / 10000

	return ConvertQuantity(inStorageUnits, storageUnit, displayUnit)
}

// ===== PRICE & COST CALCULATIONS (Unit + Currency) =====

// CalculateTotalCostFromUserInput calculates total cost from user-entered data
// Handles BOTH LAYERS: Unit conversion AND Currency conversion
//
// Parameters:
//   - userQuantity: quantity entered by user (e.g., 20 mace)
//   - userQuantityUnit: unit of userQuantity (e.g., "mace")
//   - userPricePerUnit: price entered by user (e.g., 8,500,000 VND per mace)
//   - userPriceCurrency: currency of userPricePerUnit (e.g., "VND")
//   - userPriceUnit: unit of userPricePerUnit (e.g., "mace")
//   - investmentType: type of gold investment
//   - walletCurrency: currency of wallet for final cost
//
// Returns:
//   - totalCostNative: total cost in gold's native currency (for storage)
//   - totalCostWallet: total cost in wallet currency (for balance deduction)
//   - averageCostNative: average cost per base unit in native currency (for storage)
func (c *Converter) CalculateTotalCostFromUserInput(
	ctx context.Context,
	userQuantity float64,
	userQuantityUnit GoldUnit,
	userPricePerUnit float64,
	userPriceCurrency string,
	userPriceUnit GoldUnit,
	investmentType investmentv1.InvestmentType,
	walletCurrency string,
) (totalCostNative int64, totalCostWallet int64, averageCostNative int64, err error) {
	// Get native storage info
	storageUnit, nativeCurrency := GetNativeStorageInfo(investmentType)

	// LAYER 1: Convert quantity to storage unit
	quantityInStorageUnit := ConvertQuantity(userQuantity, userQuantityUnit, storageUnit)

	// LAYER 1: Convert price to storage unit price
	// User price is in userPriceUnit (e.g., per mace), need price in storageUnit (e.g., per gram)
	priceInStorageUnitCurrency := ConvertPricePerUnit(userPricePerUnit, userPriceUnit, storageUnit)

	// Calculate total cost in the price's currency
	totalCostInPriceCurrency := priceInStorageUnitCurrency * quantityInStorageUnit
	averageCostInPriceCurrency := priceInStorageUnitCurrency

	// LAYER 2: Convert to native currency if user entered price in different currency
	totalCostInNativeCurrency := totalCostInPriceCurrency
	averageCostInNativeCurrency := averageCostInPriceCurrency

	if userPriceCurrency != nativeCurrency {
		// Need FX conversion
		rate, err := c.fxService.GetRate(ctx, userPriceCurrency, nativeCurrency)
		if err != nil {
			return 0, 0, 0, fmt.Errorf("get FX rate %s->%s: %w", userPriceCurrency, nativeCurrency, err)
		}

		// Convert using proper decimal handling
		multiplierFrom := fx.GetDecimalMultiplier(userPriceCurrency)
		multiplierTo := fx.GetDecimalMultiplier(nativeCurrency)

		totalCostInSmallestFrom := int64(math.Round(totalCostInPriceCurrency * float64(multiplierFrom)))
		totalCostInSmallestTo, _ := c.fxService.ConvertAmountWithRate(
			ctx,
			totalCostInSmallestFrom,
			rate,
			userPriceCurrency,
			nativeCurrency,
		)

		totalCostInNativeCurrency = float64(totalCostInSmallestTo) / float64(multiplierTo)

		// Also convert average cost
		avgCostInSmallestFrom := int64(math.Round(priceInStorageUnitCurrency * float64(multiplierFrom)))
		avgCostInSmallestTo, _ := c.fxService.ConvertAmountWithRate(
			ctx,
			avgCostInSmallestFrom,
			rate,
			userPriceCurrency,
			nativeCurrency,
		)
		averageCostInNativeCurrency = float64(avgCostInSmallestTo) / float64(multiplierTo)
	}

	// Convert to smallest currency units for storage
	multiplierNative := fx.GetDecimalMultiplier(nativeCurrency)
	totalCostNative = int64(math.Round(totalCostInNativeCurrency * float64(multiplierNative)))
	averageCostNative = int64(math.Round(averageCostInNativeCurrency * float64(multiplierNative)))

	// LAYER 2: Convert total cost to wallet currency for balance operations
	totalCostWallet = totalCostNative
	if nativeCurrency != walletCurrency {
		converted, err := c.fxService.ConvertAmount(
			ctx,
			totalCostNative,
			nativeCurrency,
			walletCurrency,
		)
		if err != nil {
			return 0, 0, 0, fmt.Errorf("convert to wallet currency: %w", err)
		}
		totalCostWallet = converted
	}

	return totalCostNative, totalCostWallet, averageCostNative, nil
}

// ===== MARKET DATA PROCESSING (Unit + Currency) =====

// ProcessMarketPrice processes market price from vang.today API
// Market prices come as: VND gold = per lượng (37.5g), World gold = per ounce
// Storage needs: VND gold = per gram, World gold = per ounce
func (c *Converter) ProcessMarketPrice(
	marketPrice int64,      // Price from API in smallest currency unit
	marketCurrency string,  // Currency of market price (VND or USD)
	investmentType investmentv1.InvestmentType,
) int64 {
	storageUnit, _ := GetNativeStorageInfo(investmentType)

	// For VND gold: API returns price per lượng (37.5g), convert to per gram for storage
	if investmentType == investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND && storageUnit == UnitGram {
		priceInBaseUnits := float64(marketPrice) / float64(fx.GetDecimalMultiplier(marketCurrency))
		pricePerGram := priceInBaseUnits / gramsPerLuong
		return int64(math.Round(pricePerGram * float64(fx.GetDecimalMultiplier(marketCurrency))))
	}

	// USD gold: price per ounce, storage per ounce — no conversion needed
	return marketPrice
}

// ===== DISPLAY CALCULATIONS (Unit + Currency) =====

// CalculateDisplayQuantity formats quantity for display with unit
func (c *Converter) CalculateDisplayQuantity(
	storedQuantity int64,
	investmentType investmentv1.InvestmentType,
) (value float64, unit GoldUnit) {
	// For VND gold: display in mace/chỉ (Vietnamese convention)
	// For USD gold: display in ounces (international convention)
	switch investmentType {
	case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND:
		displayUnit := UnitMace // Default to mace (chỉ) for VND gold
		value = c.DenormalizeQuantityForDisplay(storedQuantity, investmentType, displayUnit)
		return value, displayUnit

	case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD:
		displayUnit := UnitOunce
		value = c.DenormalizeQuantityForDisplay(storedQuantity, investmentType, displayUnit)
		return value, displayUnit

	default:
		value = c.DenormalizeQuantityForDisplay(storedQuantity, investmentType, UnitGram)
		return value, UnitGram
	}
}

// CalculateDisplayValue calculates current value with unit + currency conversion
func (c *Converter) CalculateDisplayValue(
	ctx context.Context,
	storedQuantity int64,
	storedPrice int64,
	nativeCurrency string,
	userCurrency string,
	investmentType investmentv1.InvestmentType,
) (nativeValue int64, userValue int64, displayQuantity float64, displayUnit GoldUnit, err error) {
	storageUnit, _ := GetNativeStorageInfo(investmentType)

	// Calculate native value
	quantityInBaseUnits := float64(storedQuantity) / 10000
	priceInBaseUnits := float64(storedPrice) / float64(fx.GetDecimalMultiplier(nativeCurrency))
	valueInNativeCurrency := quantityInBaseUnits * priceInBaseUnits
	multiplierNative := fx.GetDecimalMultiplier(nativeCurrency)
	nativeValue = int64(math.Round(valueInNativeCurrency * float64(multiplierNative)))

	// LAYER 2: Currency conversion for display
	userValue = nativeValue
	if nativeCurrency != userCurrency {
		userValue, err = c.fxService.ConvertAmount(ctx, nativeValue, nativeCurrency, userCurrency)
		if err != nil {
			return nativeValue, nativeValue, 0, storageUnit, fmt.Errorf("convert value: %w", err)
		}
	}

	// Get display quantity
	displayQuantity, displayUnit = c.CalculateDisplayQuantity(storedQuantity, investmentType)

	return nativeValue, userValue, displayQuantity, displayUnit, nil
}
