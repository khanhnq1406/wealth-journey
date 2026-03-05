/**
 * Investment form validation functions
 */

export interface InvestmentFormData {
  symbol: string;
  name: string;
  quantity: string;
  cost: string;
  currency: string;
  isCustom: boolean;
}

export function validateSymbol(
  symbol: string,
  isCustom: boolean,
): string | null {
  if (!symbol || symbol.trim().length === 0) {
    return "Symbol is required";
  }

  if (symbol.length > 20) {
    return "Symbol must be 20 characters or less";
  }

  if (!isCustom) {
    // Market-based investments: symbol should be uppercase alphanumeric with hyphens
    const marketSymbolPattern = /^[A-Z0-9.-]+$/;
    if (!marketSymbolPattern.test(symbol)) {
      return "Symbol should contain only uppercase letters, numbers, dots, and hyphens";
    }
  } else {
    // Custom investments: allow more flexible symbols
    const customSymbolPattern = /^[A-Za-z0-9._-]+$/;
    if (!customSymbolPattern.test(symbol)) {
      return "Symbol should contain only letters, numbers, dots, underscores, and hyphens";
    }
  }

  return null;
}

export function validateCurrency(
  currency: string,
  isCustom: boolean,
): string | null {
  if (!currency || currency.trim().length === 0) {
    if (isCustom) {
      return "Currency is required for custom investments";
    }
    return "Currency is required";
  }

  if (currency.length !== 3) {
    return "Currency must be a 3-letter ISO code (e.g., USD, VND)";
  }

  const currencyPattern = /^[A-Z]{3}$/;
  if (!currencyPattern.test(currency)) {
    return "Currency must be 3 uppercase letters";
  }

  return null;
}

export function validateQuantity(quantity: string): string | null {
  if (!quantity || quantity.trim().length === 0) {
    return "Quantity is required";
  }

  const quantityNum = parseFloat(quantity);
  if (isNaN(quantityNum) || quantityNum <= 0) {
    return "Quantity must be greater than 0";
  }

  return null;
}

export function validateCost(cost: string): string | null {
  if (!cost || cost.trim().length === 0) {
    return "Cost is required";
  }

  const costNum = parseFloat(cost);
  if (isNaN(costNum) || costNum <= 0) {
    return "Cost must be greater than 0";
  }

  return null;
}
