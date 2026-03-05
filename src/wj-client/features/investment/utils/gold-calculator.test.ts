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
  GRAMS_PER_TAEL,
  GRAMS_PER_OUNCE,
  GOLD_VND_OPTIONS,
  GOLD_USD_OPTIONS,
  type GoldUnit,
} from './gold-calculator';

describe('Gold Calculator - Unit Conversions (LAYER 1)', () => {
  describe('convertGoldQuantity', () => {
    it('should convert taels to grams correctly', () => {
      expect(convertGoldQuantity(2, 'tael', 'gram')).toBe(75); // 2 × 37.5 = 75
      expect(convertGoldQuantity(1, 'tael', 'gram')).toBe(37.5);
    });

    it('should convert grams to taels correctly', () => {
      expect(convertGoldQuantity(75, 'gram', 'tael')).toBe(2); // 75 / 37.5 = 2
      expect(convertGoldQuantity(37.5, 'gram', 'tael')).toBe(1);
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
      expect(convertGoldQuantity(1, 'tael', 'tael')).toBe(1);
      expect(convertGoldQuantity(1, 'oz', 'oz')).toBe(1);
    });
  });

  describe('convertGoldPricePerUnit', () => {
    it('should convert price per tael to price per gram', () => {
      // 75,000,000 VND per tael / 37.5 = 2,000,000 VND per gram
      expect(convertGoldPricePerUnit(75000000, 'tael', 'gram')).toBeCloseTo(2000000, 0);
    });

    it('should convert price per gram to price per tael', () => {
      expect(convertGoldPricePerUnit(2000000, 'gram', 'tael')).toBeCloseTo(75000000, 0);
    });

    it('should handle same unit conversion', () => {
      expect(convertGoldPricePerUnit(1000, 'gram', 'gram')).toBe(1000);
      expect(convertGoldPricePerUnit(1000, 'tael', 'tael')).toBe(1000);
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
  it('should return tael for GOLD_VND', () => {
    expect(getGoldMarketPriceUnit(8)).toBe('tael'); // GOLD_VND
  });

  it('should return ounce for GOLD_USD', () => {
    expect(getGoldMarketPriceUnit(9)).toBe('oz'); // GOLD_USD
  });
});

describe('Gold Calculator - Total Cost Calculation', () => {
  it('should calculate VND gold cost with no currency conversion', () => {
    const input: GoldCalculationInput = {
      quantity: 2,
      quantityUnit: 'tael',
      pricePerUnit: 85000000, // 85M VND per tael
      priceCurrency: 'VND',
      priceUnit: 'tael',
      investmentType: 8, // GOLD_VND
      walletCurrency: 'VND',
    };

    const result = calculateGoldFromUserInput(input);

    // 2 taels = 75 grams
    // Price per gram = 85M / 37.5 = 2,266,667 VND
    // Total cost = 75 × 2,266,667 = 170,000,000 VND (rounded)
    expect(result.storedQuantity).toBe(750000); // 75g × 10000
    expect(result.totalCostNative).toBe(170000000); // 170M VND dong
    expect(result.displayInfo.quantity).toBe(2);
    expect(result.displayInfo.unit).toBe('tael');
  });

  it('should calculate USD gold cost with no currency conversion', () => {
    const input: GoldCalculationInput = {
      quantity: 1,
      quantityUnit: 'oz',
      pricePerUnit: 270000, // $2700 per ounce (in cents)
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
      quantity: 2,
      quantityUnit: 'tael',
      pricePerUnit: 85000000, // 85M VND per tael
      priceCurrency: 'VND',
      priceUnit: 'tael',
      investmentType: 8, // GOLD_VND
      walletCurrency: 'USD',
      fxRate: 0.00004, // 1 VND = 0.00004 USD (or 1 USD = 25,000 VND)
    };

    const result = calculateGoldFromUserInput(input);

    // Total cost in VND: 170,000,000 VND
    // Total cost in USD: 170,000,000 × 0.00004 = $6,800
    expect(result.totalCostNative).toBe(170000000);
    expect(result.totalCostWallet).toBeCloseTo(6800, 0);
  });
});

describe('Gold Calculator - Display Functions', () => {
  it('should format VND gold quantity for display', () => {
    const result = formatGoldQuantityDisplay(750000, 8, 'VND'); // 75g stored

    expect(result.value).toBeCloseTo(2, 4); // Should show in taels
    expect(result.unit).toBe('tael');
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

    it('should return all options when no filter', () => {
      const options = getGoldTypeOptions();
      expect(options.length).toBe(GOLD_VND_OPTIONS.length + GOLD_USD_OPTIONS.length);
    });
  });

  describe('getGoldTypeByCode', () => {
    it('should find SJC gold type by code', () => {
      const result = getGoldTypeByCode('SJL1L10');
      expect(result).toBeDefined();
      expect(result?.code).toBe('SJL1L10');
      expect(result?.currency).toBe('VND');
    });

    it('should find world gold by code', () => {
      const result = getGoldTypeByCode('XAU');
      expect(result).toBeDefined();
      expect(result?.code).toBe('XAU');
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
    // User buys 2.5 taels of SJC gold at 86,000,000 VND/tael
    const input: GoldCalculationInput = {
      quantity: 2.5,
      quantityUnit: 'tael',
      pricePerUnit: 86000000,
      priceCurrency: 'VND',
      priceUnit: 'tael',
      investmentType: 8,
      walletCurrency: 'VND',
    };

    const result = calculateGoldFromUserInput(input);

    // Verify calculations
    expect(result.storedQuantity).toBe(93750); // 2.5 × 37.5g × 10000 = 937,500
    expect(result.totalCostNative).toBe(215000000); // ~215M VND
    expect(result.displayInfo.quantity).toBe(2.5);
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
      pricePerUnit: 275000, // $2750 per ounce
      priceCurrency: 'USD',
      priceUnit: 'oz',
      investmentType: 9,
      walletCurrency: 'VND',
      fxRate: 25000, // 1 USD = 25,000 VND
    };

    const result = calculateGoldFromUserInput(input);

    // Total in USD: $2750 × 0.5 = $1375
    // Total in VND: $1375 × 25,000 = 34,375,000 VND
    expect(result.totalCostNative).toBe(137500); // $1375 in cents
    expect(result.totalCostWallet).toBeCloseTo(34375000000, 6); // 34.4B VND
  });
});
