/**
 * Silver Calculator - Dual Conversion System for Silver Investments
 *
 * Handles BOTH unit conversions (tael/kg/gram/oz) AND currency conversions (VND/USD)
 * for silver investment tracking.
 *
 * LAYER 1: Unit Conversion
 *   - Tael/lượng (37.5g) ↔ Kg (1000g) ↔ Gram (1g) ↔ Ounce (31.1034768g)
 *
 * LAYER 2: Currency Conversion (via FX rates)
 *   - VND ↔ USD (using existing FX rate service)
 */

import { InvestmentType } from "@/gen/protobuf/v1/investment";

export type SilverUnit = "tael" | "kg" | "gram" | "oz";

// Constants for unit conversions
const GRAMS_PER_TAEL = 37.5;
const GRAMS_PER_OUNCE = 31.1034768;
const GRAMS_PER_KG = 1000.0;

/**
 * Silver type options for frontend dropdown
 */
export interface SilverTypeOption {
  value: string; // "AG_VND", "XAG"
  label: string; // Display name
  currency: string; // "VND" or "USD"
  type: number; // InvestmentType enum value (10, 11)
  availableUnits: SilverUnit[]; // Units user can input
}

// Vietnamese silver type options
export const SILVER_VND_OPTIONS: SilverTypeOption[] = [
  // Tael-based (lượng)
  { value: "GOLDENFUND_1L", label: "Golden Fund 1 Lượng", currency: "VND", type: 10, availableUnits: ['tael'] },
  { value: "GOLDENFUND_5L", label: "Golden Fund 5 Lượng", currency: "VND", type: 10, availableUnits: ['tael'] },
  { value: "GOLDENFUND_10L", label: "Golden Fund 10 Lượng", currency: "VND", type: 10, availableUnits: ['tael'] },
  { value: "PHUQUY_1L", label: "Phú Quý 1 Lượng", currency: "VND", type: 10, availableUnits: ['tael'] },
  { value: "PHUQUY_5L", label: "Phú Quý 5 Lượng", currency: "VND", type: 10, availableUnits: ['tael'] },
  { value: "ANCARAT_1L", label: "Ancarat 1 Lượng", currency: "VND", type: 10, availableUnits: ['tael'] },
  { value: "ANCARAT_5L", label: "Ancarat 5 Lượng", currency: "VND", type: 10, availableUnits: ['tael'] },
  // Kg-based
  { value: "GOLDENFUND_1KG", label: "Golden Fund 1 Kg", currency: "VND", type: 10, availableUnits: ['kg'] },
  { value: "PHUQUY_1KG", label: "Phú Quý 1 Kg", currency: "VND", type: 10, availableUnits: ['kg'] },
  { value: "ANCARAT_1KG", label: "Ancarat 1 Kg", currency: "VND", type: 10, availableUnits: ['kg'] },
];

// World silver type options
export const SILVER_USD_OPTIONS: SilverTypeOption[] = [
  { value: "XAGUSD", label: "Silver World (XAG/USD)", currency: "USD", type: 11, availableUnits: ['oz'] },
];

/**
 * LAYER 1: Unit Conversion Functions
 */

/**
 * Convert silver quantity between units
 */
export function convertSilverQuantity(
  quantity: number,
  from: SilverUnit,
  to: SilverUnit,
): number {
  // Convert to grams first (common base unit)
  let inGrams: number;

  switch (from) {
    case "tael":
      inGrams = quantity * GRAMS_PER_TAEL;
      break;
    case "kg":
      inGrams = quantity * GRAMS_PER_KG;
      break;
    case "oz":
      inGrams = quantity * GRAMS_PER_OUNCE;
      break;
    case "gram":
    default:
      inGrams = quantity;
      break;
  }

  // Convert from grams to target unit
  switch (to) {
    case "tael":
      return inGrams / GRAMS_PER_TAEL;
    case "kg":
      return inGrams / GRAMS_PER_KG;
    case "oz":
      return inGrams / GRAMS_PER_OUNCE;
    case "gram":
    default:
      return inGrams;
  }
}

/**
 * Convert price per unit between silver units
 * Price is inversely proportional to quantity
 */
export function convertSilverPricePerUnit(
  price: number,
  from: SilverUnit,
  to: SilverUnit,
): number {
  let quantityRatio: number;

  switch (from) {
    case "tael":
      quantityRatio = GRAMS_PER_TAEL;
      break;
    case "kg":
      quantityRatio = GRAMS_PER_KG;
      break;
    case "oz":
      quantityRatio = GRAMS_PER_OUNCE;
      break;
    case "gram":
    default:
      quantityRatio = 1;
      break;
  }

  const pricePerGram = price / quantityRatio;

  switch (to) {
    case "tael":
      return pricePerGram * GRAMS_PER_TAEL;
    case "kg":
      return pricePerGram * GRAMS_PER_KG;
    case "oz":
      return pricePerGram * GRAMS_PER_OUNCE;
    case "gram":
    default:
      return pricePerGram;
  }
}

/**
 * LAYER 2: Calculate Total from User Input
 */

interface CalculateSilverParams {
  quantity: number;
  quantityUnit: SilverUnit;
  pricePerUnit: number;
  priceCurrency: string;
  priceUnit: SilverUnit;
  investmentType: number;
  walletCurrency: string;
  fxRate?: number;
}

interface CalculateSilverResult {
  storedQuantity: number; // Quantity in storage format (base unit × 10000)
  totalCostNative: number; // Total cost in investment's native currency
  totalCostWallet: number; // Total cost in wallet currency
  averageCostNative: number; // Average cost per base unit in native currency
  purchaseUnit: SilverUnit; // Remember user's input unit
}

export function calculateSilverFromUserInput(
  params: CalculateSilverParams,
): CalculateSilverResult {
  // Determine storage unit based on investment type
  const storageUnit: SilverUnit = params.investmentType === 10 ? "gram" : "oz";
  const nativeCurrency = params.investmentType === 10 ? "VND" : "USD";

  // LAYER 1: Unit conversion
  // Convert quantity to storage unit
  const quantityInStorage = convertSilverQuantity(
    params.quantity,
    params.quantityUnit,
    storageUnit,
  );

  // Convert price to per-storage-unit
  const priceInStorage = convertSilverPricePerUnit(
    params.pricePerUnit,
    params.priceUnit,
    storageUnit,
  );

  // Calculate total cost
  const totalCostInPriceCurrency = quantityInStorage * priceInStorage;

  // LAYER 2: Currency conversion (if needed)
  let totalCostInNativeCurrency = totalCostInPriceCurrency;
  if (params.priceCurrency !== nativeCurrency && params.fxRate) {
    totalCostInNativeCurrency = totalCostInPriceCurrency * params.fxRate;
  }

  let totalCostInWalletCurrency = totalCostInNativeCurrency;
  if (nativeCurrency !== params.walletCurrency && params.fxRate) {
    // Apply conversion (simplified - in real implementation, need proper FX rate)
    totalCostInWalletCurrency =
      totalCostInNativeCurrency * (params.fxRate || 1);
  }

  // Get currency multiplier (VND: 1, USD: 100)
  const getCurrencyMultiplier = (currency: string) => {
    return currency === "VND" ? 1 : 100;
  };

  return {
    storedQuantity: Math.round(quantityInStorage * 10000), // 4 decimal precision
    totalCostNative: Math.round(
      totalCostInNativeCurrency * getCurrencyMultiplier(nativeCurrency),
    ),
    totalCostWallet: Math.round(
      totalCostInWalletCurrency * getCurrencyMultiplier(params.walletCurrency),
    ),
    averageCostNative: Math.round(
      priceInStorage * getCurrencyMultiplier(nativeCurrency),
    ),
    purchaseUnit: params.quantityUnit, // Remember user's input unit
  };
}

/**
 * Display Formatting Functions
 */

export function formatSilverQuantityDisplay(
  storedQuantity: number,
  investmentType: InvestmentType,
  purchaseUnit: SilverUnit,
): { value: number; unit: SilverUnit } {
  const storageUnit: SilverUnit =
    investmentType === InvestmentType.INVESTMENT_TYPE_SILVER_VND
      ? "gram"
      : "oz";
  const quantityInStorage = storedQuantity / 10000;

  // Convert from storage unit to purchase unit for display
  const displayValue = convertSilverQuantity(
    quantityInStorage,
    storageUnit,
    purchaseUnit,
  );

  return { value: displayValue, unit: purchaseUnit };
}

export function getSilverUnitLabel(unit: SilverUnit): string {
  switch (unit) {
    case "tael":
      return "lượng";
    case "kg":
      return "kg";
    case "oz":
      return "oz";
    case "gram":
      return "g";
    default:
      return unit;
  }
}

/**
 * Get silver display unit label for forms (with full name)
 * Returns user-friendly labels like "Tael (lượng)", "Kg", "Ounce"
 */
export function getSilverUnitLabelFull(unit: SilverUnit): string {
  switch (unit) {
    case "tael":
      return "Tael (lượng)";
    case "kg":
      return "Kg";
    case "oz":
      return "Ounce";
    case "gram":
      return "Gram";
    default:
      return unit;
  }
}

export function isSilverType(type: InvestmentType): boolean {
  return (
    type === InvestmentType.INVESTMENT_TYPE_SILVER_VND ||
    type === InvestmentType.INVESTMENT_TYPE_SILVER_USD
  );
}

/**
 * Get storage information for a silver investment type
 * @param investmentType - The investment type enum value
 * @returns Object with storage unit and native currency
 */
export function getSilverStorageInfo(investmentType: number): {
  unit: SilverUnit;
  currency: string;
} {
  // SILVER_VND = 10, SILVER_USD = 11
  if (investmentType === 10) {
    return { unit: "gram" as SilverUnit, currency: "VND" };
  } else if (investmentType === 11) {
    return { unit: "oz" as SilverUnit, currency: "USD" };
  }
  return { unit: "gram" as SilverUnit, currency: "USD" };
}

/**
 * Get the market price unit for a silver investment type
 * @param investmentType - The investment type enum value
 * @param symbol - Optional symbol to determine unit from suffix (overrides investmentType)
 * @returns The unit that market prices are quoted in
 */
export function getSilverMarketPriceUnit(
  investmentType: number,
  symbol?: string,
): SilverUnit {
  // If symbol is provided, determine unit from suffix (matches backend GetPriceUnitForMarketData)
  if (symbol) {
    if (symbol.endsWith("L")) {
      return "tael" as SilverUnit;
    }
    if (symbol.endsWith("KG")) {
      return "kg" as SilverUnit;
    }
    if (symbol === "XAGUSD" || symbol === "SI=F") {
      return "oz" as SilverUnit;
    }
  }

  if (investmentType === 10) {
    // SILVER_VND
    return "tael" as SilverUnit; // Default for VND silver
  } else if (investmentType === 11) {
    // SILVER_USD
    return "oz" as SilverUnit;
  }
  return "oz" as SilverUnit;
}

export function getSilverTypeLabel(type: InvestmentType): string {
  switch (type) {
    case InvestmentType.INVESTMENT_TYPE_SILVER_VND:
      return "Silver (VND)";
    case InvestmentType.INVESTMENT_TYPE_SILVER_USD:
      return "Silver (USD)";
    default:
      return "Unknown";
  }
}

/**
 * Get silver type options for a given currency
 */
export function getSilverTypeOptions(currency: string): SilverTypeOption[] {
  if (currency === "VND") {
    return SILVER_VND_OPTIONS;
  } else if (currency === "USD") {
    return SILVER_USD_OPTIONS;
  }
  return [];
}

/**
 * Format silver quantity for display with unit label
 */
export function formatSilverQuantity(
  storedQuantity: number,
  investmentType: InvestmentType,
  purchaseUnit: SilverUnit,
): string {
  const { value, unit } = formatSilverQuantityDisplay(
    storedQuantity,
    investmentType,
    purchaseUnit,
  );
  const unitLabel = getSilverUnitLabel(unit);

  return `${value.toFixed(4)} ${unitLabel}`;
}

/**
 * Format silver price for display with unit label
 * Handles three cases:
 * 1. VND silver in native VND currency (price per gram in VND)
 * 2. USD silver (XAG) in native USD currency (price per ounce in cents)
 * 3. VND silver converted to USD by backend (price per gram in cents)
 */
export function formatSilverPrice(
  price: number,
  currency: string,
  priceUnit: SilverUnit,
  investmentType?: InvestmentType
): string {
  // Convert from storage format to display format
  let priceForDisplay: number;

  if (currency === 'VND') {
    // Case 1: Native VND silver (price per gram in VND)
    // Convert to price per priceUnit (tael or kg)
    const pricePerGram = price;
    priceForDisplay = convertSilverPricePerUnit(pricePerGram, 'gram', priceUnit);
  } else if (investmentType === InvestmentType.INVESTMENT_TYPE_SILVER_USD) {
    // Case 2: Native USD silver (XAG)
    // Backend stores price per ounce in USD cents
    // Display as price per ounce in dollars
    priceForDisplay = price / 100;
  } else {
    // Case 3: VND silver with backend currency conversion to USD
    // Backend returns price per gram in USD cents
    // Convert cents to dollars, then apply unit conversion
    const pricePerGramInDollars = price / 100;
    priceForDisplay = convertSilverPricePerUnit(pricePerGramInDollars, 'gram', priceUnit);
  }

  const unitLabel = getSilverUnitLabel(priceUnit);

  // Format price with currency
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceForDisplay);

  return `${formattedPrice}/${unitLabel}`;
}
