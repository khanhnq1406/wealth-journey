/**
 * Price alert validation schema and option definitions.
 *
 * Security note: Client-side Zod validation mirrors server-side rules.
 * All values are re-validated server-side before any DB write.
 *
 * Gold/Silver option definitions are replicated locally here to avoid
 * cross-feature imports (forbidden by ESLint rules).
 * Original values in:
 *   - features/investment/utils/gold-calculator.ts (GOLD_VND_OPTIONS)
 *   - features/investment/utils/silver-calculator.ts (SILVER_VND_OPTIONS)
 */

import { z } from "zod";
import {
  AlertDirection,
  AlertTriggerMode,
} from "@/gen/protobuf/v1/investment";

// ---------------------------------------------------------------------------
// Option type
// ---------------------------------------------------------------------------

export interface PriceAlertAssetOption {
  /** Symbol / type code sent in the API request */
  value: string;
  /** Human-readable display label */
  label: string;
  /** InvestmentType enum value (8 = GOLD_VND, 10 = SILVER_VND) */
  assetType: number;
  /** ISO 4217 currency code */
  currency: string;
}

// ---------------------------------------------------------------------------
// Gold VND options — mirrors GOLD_VND_OPTIONS from gold-calculator.ts
// InvestmentType.INVESTMENT_TYPE_GOLD_VND = 8
// ---------------------------------------------------------------------------

export const GOLD_VND_ALERT_OPTIONS: PriceAlertAssetOption[] = [
  { value: "SJC", label: "SJC", assetType: 8, currency: "VND" },
  {
    value: "Vàng nhẫn SJC",
    label: "Nhẫn SJC 9999",
    assetType: 8,
    currency: "VND",
  },
  {
    value: "Doji_24K",
    label: "Nhẫn Doji 9999",
    assetType: 8,
    currency: "VND",
  },
  { value: "Mi hồng", label: "SJC Mi Hồng", assetType: 8, currency: "VND" },
  {
    value: "Mihong_999",
    label: "Nhẫn Mi Hồng 9999",
    assetType: 8,
    currency: "VND",
  },
  { value: "BTMC", label: "SJC BTMC", assetType: 8, currency: "VND" },
  {
    value: "BTMC_24K",
    label: "Nhẫn BTMC",
    assetType: 8,
    currency: "VND",
  },
  { value: "PNJ HCM", label: "PNJ", assetType: 8, currency: "VND" },
];

// ---------------------------------------------------------------------------
// Silver VND options — mirrors SILVER_VND_OPTIONS from silver-calculator.ts
// InvestmentType.INVESTMENT_TYPE_SILVER_VND = 10
// ---------------------------------------------------------------------------

export const SILVER_VND_ALERT_OPTIONS: PriceAlertAssetOption[] = [
  {
    value: "PH_QU_THI_1L",
    label: "Phú Quý thỏi 1L",
    assetType: 10,
    currency: "VND",
  },
  {
    value: "PH_QU_THI_5L_10L",
    label: "Phú Quý thỏi 5L,10L",
    assetType: 10,
    currency: "VND",
  },
  {
    value: "BC_M_NGH_PH_QU",
    label: "Bạc Mỹ nghệ Phú Quý",
    assetType: 10,
    currency: "VND",
  },
  {
    value: "ANCARAT_NGN_LONG_1L",
    label: "Ancarat Ngân Long 1L",
    assetType: 10,
    currency: "VND",
  },
  {
    value: "ANCARAT_NGN_LONG_5L",
    label: "Ancarat Ngân Long 5L",
    assetType: 10,
    currency: "VND",
  },
  {
    value: "SBJ_1L_10L_50L",
    label: "SBJ 1L,10L,50L",
    assetType: 10,
    currency: "VND",
  },
  {
    value: "DOJI_99.9_1L",
    label: "DOJI 99.9 1L",
    assetType: 10,
    currency: "VND",
  },
  {
    value: "DOJI_99.9_5L",
    label: "DOJI 99.9 5L",
    assetType: 10,
    currency: "VND",
  },
  {
    value: "ANCARAT_NGN_LONG_1KG",
    label: "Ancarat Ngân Long 1kg",
    assetType: 10,
    currency: "VND",
  },
  {
    value: "ANCARAT_THI_999_-_1KG",
    label: "Ancarat thỏi 999 - 1kg",
    assetType: 10,
    currency: "VND",
  },
  { value: "SBJ_1KG", label: "SBJ 1kg", assetType: 10, currency: "VND" },
];

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

/**
 * Validation schema for creating a price alert.
 *
 * Mirrors backend server-side validation rules. All values must be numeric
 * (no floats for price — int64 in proto) and pass these constraints before
 * being sent to the server.
 *
 * cooldownHours validation is conditional: required (2–168) when triggerMode
 * is REPEAT, otherwise 0 is accepted.
 */
export const createPriceAlertSchema = z
  .object({
    /** Asset symbol or type code (e.g. "SJC", "AAPL") */
    symbol: z.string().min(1, "Symbol is required").max(50),

    /** Display name of the asset */
    name: z.string().min(1, "Name is required").max(200),

    /** InvestmentType enum value — must be > 0 */
    assetType: z.number().int().min(1, "Asset type is required"),

    /** ISO 4217 currency code (exactly 3 chars) */
    currency: z.string().length(3, "Currency must be 3 characters"),

    /** Price side: "buy" or "sell" (only relevant for gold/silver) */
    priceSide: z.enum(["buy", "sell"]),

    /** Alert direction (AlertDirection enum value) */
    direction: z.number().int(),

    /**
     * Target price in smallest currency unit (int64).
     * Money must never be stored as float; backend expects int64.
     */
    targetPrice: z.number().int().positive("Target price must be positive"),

    /** AlertTriggerMode enum value */
    triggerMode: z.number().int(),

    /**
     * Cooldown hours between repeat triggers (0 for once mode).
     * Conditionally validated below.
     */
    cooldownHours: z.number().int().min(0).max(168),

    /** Optional freetext note */
    note: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    const isRepeat =
      data.triggerMode === AlertTriggerMode.ALERT_TRIGGER_MODE_REPEAT;
    if (isRepeat && data.cooldownHours < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: 2,
        type: "number",
        inclusive: true,
        path: ["cooldownHours"],
        message: "Cooldown must be at least 2 hours for repeat mode",
      });
    }
  });

export type CreatePriceAlertFormValues = z.infer<typeof createPriceAlertSchema>;

// ---------------------------------------------------------------------------
// Helper: form select options for Direction
// ---------------------------------------------------------------------------

export const DIRECTION_OPTIONS = [
  { value: String(AlertDirection.ALERT_DIRECTION_ABOVE), label: "Above" },
  { value: String(AlertDirection.ALERT_DIRECTION_BELOW), label: "Below" },
];

// ---------------------------------------------------------------------------
// Helper: form select options for TriggerMode
// ---------------------------------------------------------------------------

export const TRIGGER_MODE_OPTIONS = [
  {
    value: String(AlertTriggerMode.ALERT_TRIGGER_MODE_ONCE),
    label: "Once",
  },
  {
    value: String(AlertTriggerMode.ALERT_TRIGGER_MODE_REPEAT),
    label: "Repeat",
  },
];

// ---------------------------------------------------------------------------
// Helper: price side options
// ---------------------------------------------------------------------------

export const PRICE_SIDE_OPTIONS = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
];
