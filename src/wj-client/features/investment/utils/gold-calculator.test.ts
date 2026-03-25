/**
 * Tests for Gold Calculator
 * Tests cover both LAYER 1 (unit) and LAYER 2 (currency) conversions
 */

import {
  describe,
  test,
  expect,
  it,
} from '@jest/globals';

import {
  convertGoldQuantity,
  convertGoldPricePerUnit,
  getGoldStorageInfo,
  getGoldMarketPriceUnit,
  calculateGoldFromUserInput,
  formatGoldQuantityDisplay,
  getGoldTypeOptions,
  getGoldTypeByCode,
  isGoldType,
  getGoldTypeLabel,
  GRAMS_PER_MACE,
  GRAMS_PER_OUNCE,
  GOLD_VND_OPTIONS,
  GOLD_USD_OPTIONS,
  type GoldUnit,
  type GoldCalculationInput,
} from './gold-calculator';

describe('Gold Calculator - Unit Conversions (LAYER 1)', () => {
  describe('convertGoldQuantity', () => {
    it('should convert mace to grams correctly', () => {
      expect(convertGoldQuantity(20, 'mace', 'gram')).toBe(75); // 20 × 3.75 = 75
      expect(convertGoldQuantity(1, 'mace', 'gram')).toBe(3.75);
    });

    it('should convert grams to mace correctly', () => {
      expect(convertGoldQuantity(75, 'gram', 'mace')).toBe(20); // 75 / 3.75 = 20
      expect(convertGoldQuantity(3.75, 'gram', 'mace')).toBe(1);
    });

    it('should convert ounces to grams correctly', () => {
      const result = convertGoldQuantity(1, 'oz', 'gram');
      expect(result).toBeCloseTo(GRAMS_PER_OUNCE, 4);
    });

    it('should convert grams to ounces correctly', () => {
      expect(convertGoldQuantity(GRAMS_PER_OUNCE, 'gram', 'oz')).toBeCloseTo(1, 4);
    });

    it('should handle same unit conversion', () => {
      expect(convertGoldQuantity(1, 'gram', 'gram')).toBe(1);
      expect(convertGoldQuantity(1, 'mace', 'mace')).toBe(1);
      expect(convertGoldQuantity(1, 'oz', 'oz')).toBe(1);
    });
  });

  describe('convertGoldPricePerUnit', () => {
    it('should convert price per mace to price per gram', () => {
      // 7,500,000 VND per mace / 3.75 = 2,000,000 VND per gram
      expect(convertGoldPricePerUnit(7500000, 'mace', 'gram')).toBeCloseTo(2000000, 0);
    });

    it('should convert price per gram to price per mace', () => {
      expect(convertGoldPricePerUnit(2000000, 'gram', 'mace')).toBeCloseTo(7500000, 0);
    });

    it('should handle same unit conversion', () => {
      expect(convertGoldPricePerUnit(1000, 'gram', 'gram')).toBe(1000);
      expect(convertGoldPricePerUnit(1000, 'mace', 'mace')).toBeCloseTo(1000, 4);
    });
  });
});

describe('Gold Calculator - Storage Info', () => {
  it('should return gram and VND for GOLD_VND type', () => {
    const info = getGoldStorageInfo(8); // GOLD_VND
    expect(info.unit).toBe('gram');
    expect(info.currency).toBe('VND');
  });

  it('should return ounce and USD for GOLD_USD type', () => {
    const info = getGoldStorageInfo(9); // GOLD_USD
    expect(info.unit).toBe('oz');
    expect(info.currency).toBe('USD');
  });

  it('should return default for unknown types', () => {
    const info = getGoldStorageInfo(0); // UNSPECIFIED
    expect(info.unit).toBe('gram');
    expect(info.currency).toBe('USD');
  });
});

describe('Gold Calculator - Market Price Unit', () => {
  it('should return mace for GOLD_VND', () => {
    expect(getGoldMarketPriceUnit(8)).toBe('mace'); // GOLD_VND
  });

  it('should return ounce for GOLD_USD', () => {
    expect(getGoldMarketPriceUnit(9)).toBe('oz'); // GOLD_USD
  });
});

describe('Gold Calculator - Total Cost Calculation', () => {
  it('should calculate VND gold cost with no currency conversion', () => {
    const input: GoldCalculationInput = {
      quantity: 20,
      quantityUnit: 'mace',
      pricePerUnit: 8500000, // 8.5M VND per mace
      priceCurrency: 'VND',
      priceUnit: 'mace',
      investmentType: 8, // GOLD_VND
      walletCurrency: 'VND',
    };

    const result = calculateGoldFromUserInput(input);

    // 20 mace = 75 grams
    // Price per gram = 8.5M / 3.75 = 2,266,667 VND
    // Total cost = 75 × 2,266,667 = 170,000,000 VND (rounded)
    expect(result.storedQuantity).toBe(750000); // 75g × 10000
    expect(result.totalCostNative).toBe(170000000); // 170M VND dong
    expect(result.displayInfo.quantity).toBe(20);
    expect(result.displayInfo.unit).toBe('mace');
  });

  it('should calculate USD gold cost with no currency conversion', () => {
    const input: GoldCalculationInput = {
      quantity: 1,
      quantityUnit: 'oz',
      pricePerUnit: 2700, // $2700 per ounce (in dollars, will be converted to cents)
      priceCurrency: 'USD',
      priceUnit: 'oz',
      investmentType: 9, // GOLD_USD
      walletCurrency: 'USD',
    };

    const result = calculateGoldFromUserInput(input);

    expect(result.storedQuantity).toBe(10000); // 1oz × 10000
    expect(result.totalCostNative).toBe(270000); // $2700 in cents
    expect(result.displayInfo.quantity).toBe(1);
    expect(result.displayInfo.unit).toBe('oz');
  });

  it('should calculate VND gold with currency conversion to USD wallet', () => {
    const input: GoldCalculationInput = {
      quantity: 20,
      quantityUnit: 'mace',
      pricePerUnit: 8500000, // 8.5M VND per mace
      priceCurrency: 'VND',
      priceUnit: 'mace',
      investmentType: 8, // GOLD_VND
      walletCurrency: 'USD',
      fxRate: 0.00004, // 1 VND = 0.00004 USD (or 1 USD = 25,000 VND)
    };

    const result = calculateGoldFromUserInput(input);

    // Total cost in VND: 170,000,000 VND
    // Total cost in USD: 170,000,000 × 0.00004 = $6,800 = 680,000 cents
    expect(result.totalCostNative).toBe(170000000);
    expect(result.totalCostWallet).toBeCloseTo(680000, 0);
  });
});

describe('Gold Calculator - Display Functions', () => {
  it('should format VND gold quantity for display', () => {
    const result = formatGoldQuantityDisplay(750000, 8, 'VND'); // 75g stored

    expect(result.value).toBeCloseTo(20, 4); // Should show in mace (75g / 3.75 = 20)
    expect(result.unit).toBe('mace');
  });

  it('should format USD gold quantity for display', () => {
    const result = formatGoldQuantityDisplay(10000, 9, 'USD'); // 1oz stored

    expect(result.value).toBeCloseTo(1, 4);
    expect(result.unit).toBe('oz');
  });
});

describe('Gold Calculator - Utility Functions', () => {
  describe('getGoldTypeOptions', () => {
    it('should return VND options when filtering by VND', () => {
      const options = getGoldTypeOptions('VND');
      expect(options).toEqual(GOLD_VND_OPTIONS);
      expect(options.every(opt => opt.currency === 'VND'));
    });

    it('should return USD options when filtering by USD', () => {
      const options = getGoldTypeOptions('USD');
      expect(options).toEqual(GOLD_USD_OPTIONS);
      expect(options.every(opt => opt.currency === 'USD'));
    });

    it('should return VND options when no filter', () => {
      const options = getGoldTypeOptions();
      expect(options).toEqual(GOLD_VND_OPTIONS);
    });
  });

  describe('getGoldTypeByCode', () => {
    it('should find SJC gold type by code', () => {
      const result = getGoldTypeByCode('SJC');
      expect(result).toBeDefined();
      expect(result?.value).toBe('SJC');
      expect(result?.currency).toBe('VND');
    });

    it('should find world gold by code', () => {
      const result = getGoldTypeByCode('XAUUSD');
      expect(result).toBeDefined();
      expect(result?.value).toBe('XAUUSD');
      expect(result?.currency).toBe('USD');
    });

    it('should return undefined for unknown code', () => {
      expect(getGoldTypeByCode('UNKNOWN')).toBeUndefined();
    });
  });

  describe('isGoldType', () => {
    it('should return true for VND gold', () => {
      expect(isGoldType(8)).toBe(true);
    });

    it('should return true for USD gold', () => {
      expect(isGoldType(9)).toBe(true);
    });

    it('should return false for other types', () => {
      expect(isGoldType(0)).toBe(false);
      expect(isGoldType(1)).toBe(false); // CRYPTO
      expect(isGoldType(2)).toBe(false); // STOCK
    });
  });

  describe('getGoldTypeLabel', () => {
    it('should return correct labels', () => {
      expect(getGoldTypeLabel(8)).toBe('Gold (Vietnam)');
      expect(getGoldTypeLabel(9)).toBe('Gold (World)');
      expect(getGoldTypeLabel(0)).toBe('Other');
    });
  });
});

describe('Gold Calculator - Integration Tests', () => {
  it('should handle complete VND gold investment flow', () => {
    // User buys 25 mace of SJC gold at 8,600,000 VND/mace
    const input: GoldCalculationInput = {
      quantity: 25,
      quantityUnit: 'mace',
      pricePerUnit: 8600000,
      priceCurrency: 'VND',
      priceUnit: 'mace',
      investmentType: 8,
      walletCurrency: 'VND',
    };

    const result = calculateGoldFromUserInput(input);

    // Verify calculations
    expect(result.storedQuantity).toBe(937500); // 25 × 3.75g × 10000 = 937,500
    expect(result.totalCostNative).toBe(215000000); // ~215M VND
    expect(result.displayInfo.quantity).toBe(25);
  });

  it('should handle VND gold with gram input', () => {
    const input: GoldCalculationInput = {
      quantity: 100,
      quantityUnit: 'gram',
      pricePerUnit: 2000000, // 2M VND per gram
      priceCurrency: 'VND',
      priceUnit: 'gram',
      investmentType: 8,
      walletCurrency: 'VND',
    };

    const result = calculateGoldFromUserInput(input);

    expect(result.storedQuantity).toBe(1000000); // 100g × 10000
    expect(result.totalCostNative).toBe(200000000); // 200M VND
    expect(result.displayInfo.quantity).toBe(100);
    expect(result.displayInfo.unit).toBe('gram');
  });

  it('should handle cross-currency USD gold to VND wallet', () => {
    const input: GoldCalculationInput = {
      quantity: 0.5,
      quantityUnit: 'oz',
      pricePerUnit: 2750, // $2750 per ounce (in dollars)
      priceCurrency: 'USD',
      priceUnit: 'oz',
      investmentType: 9,
      walletCurrency: 'VND',
      fxRate: 25000, // 1 USD = 25,000 VND
    };

    const result = calculateGoldFromUserInput(input);

    // Total in USD: $2750 × 0.5 = $1375 = 137500 cents
    // Total in VND: $1375 × 25,000 = 34,375,000 VND
    expect(result.totalCostNative).toBe(137500); // $1375 in cents
    expect(result.totalCostWallet).toBeCloseTo(34375000, 0); // 34.375M VND
  });
});

describe('formatGoldQuantityDisplay - null/zero guard', () => {
  it('should return 0 value (not NaN) when storedQuantity is null', () => {
    // Dividend transactions or missing API data can produce null quantity
    const result = formatGoldQuantityDisplay(null as unknown as number, 8, '');
    expect(result.value).toBe(0);
    expect(result.unit).toBe('mace');
  });

  it('should return 0 value (not NaN) when storedQuantity is undefined', () => {
    const result = formatGoldQuantityDisplay(undefined as unknown as number, 8, '');
    expect(result.value).toBe(0);
    expect(result.unit).toBe('mace');
  });

  it('should return 0 value for storedQuantity of 0 (VND gold)', () => {
    const result = formatGoldQuantityDisplay(0, 8, '');
    expect(result.value).toBe(0);
    expect(result.unit).toBe('mace');
  });

  it('should return 0 value for storedQuantity of 0 (USD gold)', () => {
    const result = formatGoldQuantityDisplay(0, 9, '');
    expect(result.value).toBe(0);
    expect(result.unit).toBe('oz');
  });
});

