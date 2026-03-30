/**
 * Tests for Silver Calculator
 * Focused on null/undefined guard in formatSilverQuantityDisplay
 */

import { describe, it, expect } from '@jest/globals';
import { InvestmentType } from '@/gen/protobuf/v1/investment';
import {
  formatSilverQuantityDisplay,
  formatSilverQuantity,
  getSilverTypeOptions,
  SILVER_USD_OPTIONS,
} from './silver-calculator';

describe('getSilverTypeOptions', () => {
  it('should return empty array when filtering by VND (VND options now come from API)', () => {
    const options = getSilverTypeOptions('VND');
    expect(options).toEqual([]);
  });

  it('should return USD options when filtering by USD', () => {
    const options = getSilverTypeOptions('USD');
    expect(options).toEqual(SILVER_USD_OPTIONS);
  });

  it('should return USD options when no filter (default to USD)', () => {
    const options = getSilverTypeOptions();
    expect(options).toEqual(SILVER_USD_OPTIONS);
  });
});

describe('formatSilverQuantityDisplay - null/zero guard', () => {
  it('should return 0 value (not NaN) when storedQuantity is null', () => {
    // Dividend transactions or missing API data can produce null quantity
    const result = formatSilverQuantityDisplay(
      null as unknown as number,
      InvestmentType.INVESTMENT_TYPE_SILVER_VND,
      'tael',
    );
    expect(result.value).toBe(0);
    expect(result.unit).toBe('tael');
  });

  it('should return 0 value (not NaN) when storedQuantity is undefined', () => {
    const result = formatSilverQuantityDisplay(
      undefined as unknown as number,
      InvestmentType.INVESTMENT_TYPE_SILVER_VND,
      'tael',
    );
    expect(result.value).toBe(0);
    expect(result.unit).toBe('tael');
  });

  it('should return 0 value for storedQuantity of 0 (VND silver)', () => {
    const result = formatSilverQuantityDisplay(
      0,
      InvestmentType.INVESTMENT_TYPE_SILVER_VND,
      'tael',
    );
    expect(result.value).toBe(0);
    expect(result.unit).toBe('tael');
  });

  it('should return 0 value for storedQuantity of 0 (USD silver)', () => {
    const result = formatSilverQuantityDisplay(
      0,
      InvestmentType.INVESTMENT_TYPE_SILVER_USD,
      'oz',
    );
    expect(result.value).toBe(0);
    expect(result.unit).toBe('oz');
  });
});

describe('formatSilverQuantity - null/zero guard', () => {
  it('should return "0.0000 lượng" (not NaN) when storedQuantity is null', () => {
    const result = formatSilverQuantity(
      null as unknown as number,
      InvestmentType.INVESTMENT_TYPE_SILVER_VND,
      'tael',
    );
    expect(result).not.toContain('NaN');
    expect(result).toBe('0.0000 lượng');
  });

  it('should return "0.0000 oz" (not NaN) when storedQuantity is undefined', () => {
    const result = formatSilverQuantity(
      undefined as unknown as number,
      InvestmentType.INVESTMENT_TYPE_SILVER_USD,
      'oz',
    );
    expect(result).not.toContain('NaN');
    expect(result).toBe('0.0000 oz');
  });
});
