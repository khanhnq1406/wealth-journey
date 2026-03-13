import { InvestmentType } from "@/gen/protobuf/v1/investment";
import {
  quantityToStorage,
  quantityFromStorage,
  dollarsToCents,
  centsToDollars,
  formatCurrency,
  formatQuantity,
  calculateTransactionCost,
  calculateCurrentValue,
  calculateUnrealizedPNL,
  calculateUnrealizedPNLPercent,
  getQuantityInputConfig,
  getDecimalPlaces,
  getDecimalMultiplier,
} from "./units";

describe("Unit Conversions", () => {
  describe("Decimal precision", () => {
    it("should return 8 decimals for cryptocurrency", () => {
      expect(getDecimalPlaces(InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY)).toBe(8);
      expect(getDecimalMultiplier(InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY)).toBe(100000000);
    });

    it("should return 4 decimals for stocks", () => {
      expect(getDecimalPlaces(InvestmentType.INVESTMENT_TYPE_STOCK)).toBe(4);
      expect(getDecimalMultiplier(InvestmentType.INVESTMENT_TYPE_STOCK)).toBe(10000);
    });

    it("should return 4 decimals for ETFs", () => {
      expect(getDecimalPlaces(InvestmentType.INVESTMENT_TYPE_ETF)).toBe(4);
      expect(getDecimalMultiplier(InvestmentType.INVESTMENT_TYPE_ETF)).toBe(10000);
    });

    it("should default to 4 decimals for unknown types", () => {
      expect(getDecimalPlaces(999 as InvestmentType)).toBe(4);
      expect(getDecimalMultiplier(999 as InvestmentType)).toBe(10000);
    });
  });

  describe("Quantity conversions", () => {
    it("should convert 1 BTC to satoshis and back", () => {
      const btc = 1.0;
      const satoshis = quantityToStorage(btc, InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY);
      expect(satoshis).toBe(100000000);

      const restored = parseFloat(quantityFromStorage(satoshis, InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY));
      expect(restored).toBe(btc);
    });

    it("should handle small crypto amounts", () => {
      const btc = 0.00000001; // 1 satoshi
      const satoshis = quantityToStorage(btc, InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY);
      expect(satoshis).toBe(1);

      const restored = parseFloat(quantityFromStorage(satoshis, InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY));
      expect(restored).toBe(btc);
    });

    it("should convert stock quantities", () => {
      const shares = 100.5;
      const stored = quantityToStorage(shares, InvestmentType.INVESTMENT_TYPE_STOCK);
      expect(stored).toBe(1005000); // 100.5 * 10000

      const restored = parseFloat(quantityFromStorage(stored, InvestmentType.INVESTMENT_TYPE_STOCK));
      expect(restored).toBe(shares);
    });

    it("should handle fractional stock amounts", () => {
      const shares = 0.0001;
      const stored = quantityToStorage(shares, InvestmentType.INVESTMENT_TYPE_STOCK);
      expect(stored).toBe(1); // 0.0001 * 10000 = 1

      const restored = parseFloat(quantityFromStorage(stored, InvestmentType.INVESTMENT_TYPE_STOCK));
      expect(restored).toBe(shares);
    });

    it("should format quantity for display", () => {
      const satoshis = 150000000;
      const formatted = formatQuantity(satoshis, InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY);
      expect(formatted).toBe("1.50000000");
    });
  });

  describe("Currency conversions", () => {
    it("should convert dollars to cents", () => {
      expect(dollarsToCents(100)).toBe(10000);
      expect(dollarsToCents(0.01)).toBe(1);
      expect(dollarsToCents(1234.56)).toBe(123456);
      expect(dollarsToCents(60000)).toBe(6000000);
    });

    it("should convert cents to dollars", () => {
      expect(centsToDollars(10000)).toBe(100);
      expect(centsToDollars(1)).toBe(0.01);
      expect(centsToDollars(123456)).toBe(1234.56);
    });

    it("should format currency for display", () => {
      expect(formatCurrency(10000)).toBe("$100.00");
      expect(formatCurrency(123456)).toBe("$1,234.56");
      expect(formatCurrency(6000000)).toBe("$60,000.00");
      expect(formatCurrency(100)).toBe("$1.00");
    });
  });

  describe("Transaction cost calculation", () => {
    it("should calculate crypto transaction cost correctly", () => {
      const quantity = quantityToStorage(1.0, InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY);
      const price = dollarsToCents(60000); // $60,000
      const cost = calculateTransactionCost(quantity, price, InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY);

      expect(cost).toBe(6000000); // $60,000 in cents
    });

    it("should calculate fractional crypto transaction cost", () => {
      const quantity = quantityToStorage(0.5, InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY);
      const price = dollarsToCents(60000); // $60,000
      const cost = calculateTransactionCost(quantity, price, InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY);

      expect(cost).toBe(3000000); // $30,000 in cents
    });

    it("should calculate stock transaction cost correctly", () => {
      const quantity = quantityToStorage(100, InvestmentType.INVESTMENT_TYPE_STOCK);
      const price = dollarsToCents(100); // $100
      const cost = calculateTransactionCost(quantity, price, InvestmentType.INVESTMENT_TYPE_STOCK);

      expect(cost).toBe(1000000); // $10,000 in cents
    });

    it("should calculate fractional stock transaction cost", () => {
      const quantity = quantityToStorage(50.5, InvestmentType.INVESTMENT_TYPE_STOCK);
      const price = dollarsToCents(50); // $50
      const cost = calculateTransactionCost(quantity, price, InvestmentType.INVESTMENT_TYPE_STOCK);

      expect(cost).toBe(252500); // $2,525 in cents
    });
  });

  describe("Current value calculation", () => {
    it("should calculate current value for crypto", () => {
      const quantity = quantityToStorage(1.0, InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY);
      const price = dollarsToCents(70000); // $70,000
      const value = calculateCurrentValue(quantity, price, InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY);

      expect(value).toBe(7000000); // $70,000 in cents
    });

    it("should calculate current value for stocks", () => {
      const quantity = quantityToStorage(100, InvestmentType.INVESTMENT_TYPE_STOCK);
      const price = dollarsToCents(150); // $150
      const value = calculateCurrentValue(quantity, price, InvestmentType.INVESTMENT_TYPE_STOCK);

      expect(value).toBe(1500000); // $15,000 in cents
    });
  });

  describe("PNL calculations", () => {
    it("should calculate unrealized PNL for profit", () => {
      const currentValue = 7000000; // $70,000
      const totalCost = 6000000; // $60,000
      const pnl = calculateUnrealizedPNL(currentValue, totalCost);

      expect(pnl).toBe(1000000); // $10,000 profit
    });

    it("should calculate unrealized PNL for loss", () => {
      const currentValue = 5000000; // $50,000
      const totalCost = 6000000; // $60,000
      const pnl = calculateUnrealizedPNL(currentValue, totalCost);

      expect(pnl).toBe(-1000000); // $10,000 loss
    });

    it("should calculate unrealized PNL percentage", () => {
      const unrealizedPNL = 1000000; // $10,000
      const totalCost = 6000000; // $60,000
      const percent = calculateUnrealizedPNLPercent(unrealizedPNL, totalCost);

      expect(percent).toBeCloseTo(16.666666666666668, 10);
    });

    it("should return 0 for unrealized PNL percent when cost is 0", () => {
      const percent = calculateUnrealizedPNLPercent(1000, 0);
      expect(percent).toBe(0);
    });
  });

  describe("Input configuration", () => {
    it("should return correct config for crypto inputs", () => {
      const config = getQuantityInputConfig(InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY);

      expect(config.step).toBe("0.00000001");
      expect(config.placeholder).toBe("0.00000000");
      expect(config.decimals).toBe(8);
    });

    it("should return correct config for stock inputs", () => {
      const config = getQuantityInputConfig(InvestmentType.INVESTMENT_TYPE_STOCK);

      expect(config.step).toBe("0.0001");
      expect(config.placeholder).toBe("0.0000");
      expect(config.decimals).toBe(4);
    });
  });
});
