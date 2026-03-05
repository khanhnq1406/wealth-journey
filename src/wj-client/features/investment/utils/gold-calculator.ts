/**
 * Gold Calculator - Dual Conversion System for Gold Investments
 *
 * Handles BOTH unit conversions (tael/gram/oz) AND currency conversions (VND/USD)
 * for gold investment tracking.
 *
 * LAYER 1: Unit Conversion
 *   - Tael (37.5g) ↔ Gram (1g) ↔ Ounce (31.1034768g)
 *
 * LAYER 2: Currency Conversion (via FX rates)
 *   - VND ↔ USD (using existing FX rate service)
 */

export type GoldUnit = 'tael' | 'gram' | 'oz';

// Constants for unit conversions
const GRAMS_PER_TAEL = 37.5;
const GRAMS_PER_OUNCE = 31.1034768;

/**
 * Gold type options for frontend dropdown
 */
export interface GoldTypeOption {
  value: string;      // e.g., "SJL1L10", "XAU"
  label: string;      // Display name
  unit: GoldUnit;    // "tael", "gram", or "oz"
  currency: string;   // "VND" or "USD"
  unitWeight: number; // Weight in grams
  type: number;      // InvestmentType enum value
}

// Vietnamese gold type options (from backend pkg/gold/types.go)
export const GOLD_VND_OPTIONS: GoldTypeOption[] = [
  // SJC Gold (tael-based)
  { value: "SJC", label: "SJC 9999", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "SJC TD", label: "SJC Tự Do", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "Eximbank", label: "Eximbank SJC", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "TPBank", label: "TPBank SJC", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "Doji", label: "DOJI", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "VietinGold", label: "VietinBank Gold", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "ACBBank", label: "ACB Gold", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "Mi hồng", label: "Mi Hồng Gold", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "BTMC", label: "Bảo Tín SJC", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  // Other Gold Types (tael-based)
  { value: "999,9 TD", label: "Vàng 999.9 Tự Do", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "99,9 TD", label: "Vàng 99.9 Tự Do", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "Vàng 95%", label: "Vàng 95%", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "Doji_24K", label: "DOJI 24K", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "BTMC_24K", label: "Bảo Tín 24K", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "Mihong_999", label: "Mi Hồng 999", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "99,99% GF", label: "Golden Fund 99.99%", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
  { value: "95% GF", label: "Golden Fund 95%", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
];

// World gold type options (from backend pkg/gold/types.go)
export const GOLD_USD_OPTIONS: GoldTypeOption[] = [
  { value: "XAUUSD", label: "Gold World (XAU/USD)", unit: "oz" as GoldUnit, currency: "USD", unitWeight: GRAMS_PER_OUNCE, type: 9 },
];

/**
 * LAYER 1: Unit Conversion Functions
 */

/**
 * Convert gold quantity between units
 * @param quantity - The quantity to convert
 * @param from - The source unit
 * @param to - The target unit
 * @returns The converted quantity
 */
export function convertGoldQuantity(
  quantity: number,
  from: GoldUnit,
  to: GoldUnit
): number {
  // Convert to grams first (common base unit)
  let inGrams: number;

  switch (from) {
    case 'tael':
      inGrams = quantity * GRAMS_PER_TAEL;
      break;
    case 'oz':
      inGrams = quantity * GRAMS_PER_OUNCE;
      break;
    case 'gram':
    default:
      inGrams = quantity;
      break;
  }

  // Convert from grams to target unit
  switch (to) {
    case 'tael':
      return inGrams / GRAMS_PER_TAEL;
    case 'oz':
      return inGrams / GRAMS_PER_OUNCE;
    case 'gram':
    default:
      return inGrams;
  }
}

/**
 * Convert price per unit between gold units
 * Price is inversely proportional to quantity
 * @param price - The price to convert
 * @param from - The source unit
 * @param to - The target unit
 * @returns The converted price per unit
 */
export function convertGoldPricePerUnit(
  price: number,
  from: GoldUnit,
  to: GoldUnit
): number {
  // Get the quantity ratio for the source unit
  let quantityRatio: number;

  switch (from) {
    case 'tael':
      quantityRatio = GRAMS_PER_TAEL;
      break;
    case 'oz':
      quantityRatio = GRAMS_PER_OUNCE;
      break;
    case 'gram':
    default:
      quantityRatio = 1;
      break;
  }

  // Convert to price per gram
  const pricePerGram = price / quantityRatio;

  // Convert from price per gram to target unit
  switch (to) {
    case 'tael':
      return pricePerGram * GRAMS_PER_TAEL;
    case 'oz':
      return pricePerGram * GRAMS_PER_OUNCE;
    case 'gram':
    default:
      return pricePerGram;
  }
}

/**
 * Get storage information for a gold investment type
 * @param investmentType - The investment type enum value
 * @returns Object with storage unit and native currency
 */
export function getGoldStorageInfo(investmentType: number): { unit: GoldUnit; currency: string } {
  // GOLD_VND = 8, GOLD_USD = 9
  if (investmentType === 8) {
    return { unit: 'gram' as GoldUnit, currency: 'VND' };
  } else if (investmentType === 9) {
    return { unit: 'oz' as GoldUnit, currency: 'USD' };
  }
  return { unit: 'gram' as GoldUnit, currency: 'USD' };
}

/**
 * Get the market price unit for a gold investment type
 * @param investmentType - The investment type enum value
 * @returns The unit that market prices are quoted in
 */
export function getGoldMarketPriceUnit(investmentType: number): GoldUnit {
  if (investmentType === 8) { // GOLD_VND
    return 'tael' as GoldUnit; // VND gold prices are per tael
  } else if (investmentType === 9) { // GOLD_USD
    return 'oz' as GoldUnit; // World gold prices are per ounce
  }
  return 'oz' as GoldUnit;
}

/**
 * Calculate total cost from user input with dual conversion
 * Handles BOTH unit and currency conversions
 *
 * @param input - User's calculation input
 * @returns Calculation output with storage values
 */
export interface GoldCalculationInput {
  quantity: number;           // User-entered quantity
  quantityUnit: GoldUnit;     // Unit of quantity (tael/gram/oz)
  pricePerUnit: number;       // Price entered by user
  priceCurrency: string;      // Currency of price (VND/USD)
  priceUnit: GoldUnit;        // Unit of price (tael/gram/oz)
  investmentType: number;     // InvestmentType enum value
  walletCurrency: string;     // Wallet currency for final cost
  fxRate?: number;            // Optional FX rate if currencies differ
}

export interface GoldCalculationOutput {
  storedQuantity: number;     // Quantity for API (base unit × 10000)
  totalCostNative: number;    // Total cost in native currency (cents/dong)
  totalCostWallet: number;    // Total cost in wallet currency
  averageCostNative: number;  // Average cost in native currency
  displayInfo: {
    quantity: number;          // Display quantity (user's original input)
    unit: GoldUnit;            // Display unit
    totalCost: number;        // Total cost for display
    currency: string;         // Display currency
  };
}

/**
 * Calculate gold investment values from user input
 * Implements BOTH LAYER 1 (unit) and LAYER 2 (currency) conversions
 */
export function calculateGoldFromUserInput(input: GoldCalculationInput): GoldCalculationOutput {
  const {
    quantity,
    quantityUnit,
    pricePerUnit,
    priceCurrency,
    priceUnit,
    investmentType,
    walletCurrency,
    fxRate = 1, // Default to 1 if same currency or rate not provided
  } = input;

  // Get storage info
  const { unit: storageUnit, currency: nativeCurrency } = getGoldStorageInfo(investmentType);

  // LAYER 1: Convert quantity to storage unit
  const quantityInStorageUnit = convertGoldQuantity(quantity, quantityUnit, storageUnit);

  // LAYER 1: Convert price to storage unit price
  const priceInStorageUnit = convertGoldPricePerUnit(pricePerUnit, priceUnit, storageUnit);

  // Calculate total cost in price currency
  const totalCostInPriceCurrency = priceInStorageUnit * quantityInStorageUnit;

  // LAYER 2: Currency conversion (if needed)
  let totalCostInNativeCurrency = totalCostInPriceCurrency;
  let averageCostInNativeCurrency = priceInStorageUnit;

  if (priceCurrency !== nativeCurrency && fxRate !== undefined && fxRate !== 1) {
    totalCostInNativeCurrency = totalCostInPriceCurrency * fxRate;
    averageCostInNativeCurrency = priceInStorageUnit * fxRate;
  }

  // Convert to smallest currency units for storage
  const nativeMultiplier = nativeCurrency === 'VND' ? 1 : 100; // VND has 0 decimals, USD has 2
  const totalCostNative = Math.round(totalCostInNativeCurrency * nativeMultiplier);
  const averageCostNative = Math.round(averageCostInNativeCurrency * nativeMultiplier);

  // LAYER 2: Convert to wallet currency for balance
  // Convert from native currency smallest units to wallet currency smallest units
  let totalCostWallet = totalCostNative;
  if (nativeCurrency !== walletCurrency && fxRate !== undefined && fxRate !== 1) {
    // Convert: native smallest units → native main units → wallet main units → wallet smallest units
    const nativeMainUnits = totalCostNative / nativeMultiplier;
    const walletMainUnits = nativeMainUnits * fxRate;
    const walletMultiplier = walletCurrency === 'VND' ? 1 : 100;
    totalCostWallet = Math.round(walletMainUnits * walletMultiplier);
  }

  // Storage quantity (base unit × 10000)
  const storedQuantity = Math.round(quantityInStorageUnit * 10000);

  // Display info - show user's original input
  const displayInfo = {
    quantity: quantity, // Show user's original input
    unit: quantityUnit,
    totalCost: totalCostInPriceCurrency,
    currency: priceCurrency,
  };

  return {
    storedQuantity,
    totalCostNative,
    totalCostWallet,
    averageCostNative,
    displayInfo,
  };
}

/**
 * Format gold quantity for display
 * @param storedQuantity - Quantity in storage format (base unit × 10000)
 * @param investmentType - The investment type
 * @param userCurrency - User's preferred currency (not used for quantity, but kept for API consistency)
 * @returns Display quantity and unit
 */
export function formatGoldQuantityDisplay(
  storedQuantity: number,
  investmentType: number,
  userCurrency: string
): { value: number; unit: GoldUnit } {
  // Get storage unit (what we store in) and display unit (what we show to user)
  const { unit: storageUnit } = getGoldStorageInfo(investmentType);
  let displayUnit: GoldUnit;

  // For VND gold: display in taels (Vietnamese convention)
  // For USD gold: display in ounces (international convention)
  if (investmentType === 8) { // GOLD_VND
    displayUnit = 'tael' as GoldUnit;
  } else if (investmentType === 9) { // GOLD_USD
    displayUnit = 'oz' as GoldUnit;
  } else {
    displayUnit = storageUnit; // Fallback to storage unit
  }

  // Convert from storage unit to display unit
  const inStorageUnits = storedQuantity / 10000;
  const value = convertGoldQuantity(inStorageUnits, storageUnit, displayUnit);

  return { value, unit: displayUnit };
}

/**
 * Get the unit label for display
 */
export function getGoldUnitLabel(unit: GoldUnit): string {
  switch (unit) {
    case 'tael':
      return 'lượng';
    case 'gram':
      return 'g';
    case 'oz':
      return 'oz';
    default:
      return '';
  }
}

/**
 * Get gold display unit label for forms (with full name)
 * Returns user-friendly labels like "Tael (lượng)", "Ounce"
 */
export function getGoldUnitLabelFull(unit: GoldUnit): string {
  switch (unit) {
    case 'tael':
      return 'Tael (lượng)';
    case 'gram':
      return 'Gram';
    case 'oz':
      return 'Ounce';
    default:
      return '';
  }
}

/**
 * Format gold price for display
 * @param price - Price in smallest currency unit
 * @param currency - Currency code (VND or USD)
 * @param priceUnit - Unit of the price (tael/gram/oz)
 * @returns Formatted price string
 */
export function formatGoldPriceDisplay(
  price: number,
  currency: string,
  priceUnit?: GoldUnit
): string {
  const priceInMainUnits = price / (currency === 'VND' ? 1 : 100);

  const unit = priceUnit || (currency === 'VND' ? 'tael' : 'oz');

  // Format the price number
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'VND' ? 'VND' : 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceInMainUnits);

  return `${formattedPrice}/${getGoldUnitLabel(unit)}`;
}

/**
 * Get gold options by currency for filtering
 * @param currency - Currency filter ("VND", "USD", or undefined for all)
 * @returns Array of gold type options
 */
export function getGoldTypeOptions(currency?: string): GoldTypeOption[] {
  if (currency === 'VND') {
    return GOLD_VND_OPTIONS;
  } else if (currency === 'USD') {
    return GOLD_USD_OPTIONS;
  }
  return [...GOLD_VND_OPTIONS, ...GOLD_USD_OPTIONS];
}

/**
 * Get gold type option by code
 * @param code - The gold type code
 * @returns The gold type option or undefined
 */
export function getGoldTypeByCode(code: string): GoldTypeOption | undefined {
  return [...GOLD_VND_OPTIONS, ...GOLD_USD_OPTIONS].find(opt => opt.value === code);
}

/**
 * Check if an investment type is a gold type
 * @param type - The investment type enum value
 * @returns True if gold type
 */
export function isGoldType(type: number): boolean {
  return type === 8 || type === 9; // GOLD_VND or GOLD_USD
}

/**
 * Get the investment type label
 * @param type - The investment type enum value
 * @returns Display label
 */
export function getGoldTypeLabel(type: number): string {
  if (type === 8) {
    return 'Gold (Vietnam)';
  } else if (type === 9) {
    return 'Gold (World)';
  }
  return 'Other';
}

/**
 * Round to a specified number of decimal places
 */
function roundTo(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}
