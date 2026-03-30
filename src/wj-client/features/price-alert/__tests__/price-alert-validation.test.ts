/**
 * Tests for price-alert validation schema.
 *
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPattern="price-alert-validation"
 *
 * NOTE: GOLD_VND_ALERT_OPTIONS and SILVER_VND_ALERT_OPTIONS have been removed
 * from this utils file. Gold/silver options are now fetched from the admin
 * config API (useQueryGetAssetDisplayPrices) at runtime. The Zod schema
 * validates format only — server validates symbol existence.
 */

import { describe, it, expect } from "@jest/globals";
import {
  createPriceAlertSchema,
} from "../utils/price-alert-validation";
import { AlertDirection, AlertTriggerMode } from "@/gen/protobuf/v1/investment";

describe("createPriceAlertSchema", () => {
  const validBase = {
    symbol: "SJC",
    name: "SJC Gold",
    assetType: 8,
    currency: "VND",
    priceSide: "buy" as const,
    direction: AlertDirection.ALERT_DIRECTION_ABOVE,
    targetPrice: 90000000,
    triggerMode: AlertTriggerMode.ALERT_TRIGGER_MODE_ONCE,
    cooldownHours: 0,
    note: "",
  };

  it("accepts a valid gold alert payload", () => {
    const result = createPriceAlertSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("rejects empty symbol", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      symbol: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const symbolError = result.error.issues.find((i) =>
        i.path.includes("symbol")
      );
      expect(symbolError).toBeDefined();
    }
  });

  it("rejects symbol longer than 50 characters", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      symbol: "A".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("accepts any non-empty symbol string (format-only validation, no symbol list)", () => {
    // Schema does not validate against a static symbol list — any valid string passes
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      symbol: "ARBITRARY_SYMBOL_NOT_IN_ANY_LIST",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 200 characters", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      name: "N".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects assetType of 0 (unspecified)", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      assetType: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects currency not exactly 3 characters", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      currency: "US",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive targetPrice", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      targetPrice: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative targetPrice", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      targetPrice: -100,
    });
    expect(result.success).toBe(false);
  });

  it("accepts repeat mode with valid cooldownHours", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      triggerMode: AlertTriggerMode.ALERT_TRIGGER_MODE_REPEAT,
      cooldownHours: 24,
    });
    expect(result.success).toBe(true);
  });

  it("accepts once mode with cooldownHours = 0", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      triggerMode: AlertTriggerMode.ALERT_TRIGGER_MODE_ONCE,
      cooldownHours: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects repeat mode with cooldownHours below minimum (2)", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      triggerMode: AlertTriggerMode.ALERT_TRIGGER_MODE_REPEAT,
      cooldownHours: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects repeat mode with cooldownHours above maximum (168)", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      triggerMode: AlertTriggerMode.ALERT_TRIGGER_MODE_REPEAT,
      cooldownHours: 169,
    });
    expect(result.success).toBe(false);
  });

  it("accepts note up to 200 characters", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      note: "A".repeat(200),
    });
    expect(result.success).toBe(true);
  });

  it("rejects note longer than 200 characters", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      note: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("accepts ALERT_DIRECTION_BELOW direction", () => {
    const result = createPriceAlertSchema.safeParse({
      ...validBase,
      direction: AlertDirection.ALERT_DIRECTION_BELOW,
    });
    expect(result.success).toBe(true);
  });
});
