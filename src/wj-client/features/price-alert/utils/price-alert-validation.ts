/**
 * Price alert validation schema and option definitions.
 *
 * Security note: Client-side Zod validation mirrors server-side rules.
 * All values are re-validated server-side before any DB write.
 *
 * Gold/Silver option lists are no longer defined statically here.
 * They are fetched at runtime from the admin config API via
 * useQueryGetAssetDisplayPrices (used in CreatePriceAlertForm).
 * The schema validates format only — server validates symbol existence.
 */

import { z } from "zod";
import {
  AlertDirection,
  AlertTriggerMode,
} from "@/gen/protobuf/v1/investment";

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
        code: "custom",
        path: ["cooldownHours"],
        message: "Cooldown must be at least 2 hours for repeat mode",
      });
    }
  });

export type CreatePriceAlertFormValues = z.infer<typeof createPriceAlertSchema>;

// ---------------------------------------------------------------------------
// Helper: translated form select options
// These are functions (not constants) because labels must come from i18n.
// Call them inside a component with the `t` function from useTranslations().
// ---------------------------------------------------------------------------

type TFn = (key: string) => string;

export function getDirectionOptions(t: TFn) {
  return [
    { value: String(AlertDirection.ALERT_DIRECTION_ABOVE), label: t("directionAbove") },
    { value: String(AlertDirection.ALERT_DIRECTION_BELOW), label: t("directionBelow") },
  ];
}

export function getTriggerModeOptions(t: TFn) {
  return [
    { value: String(AlertTriggerMode.ALERT_TRIGGER_MODE_ONCE), label: t("triggerOnce") },
    { value: String(AlertTriggerMode.ALERT_TRIGGER_MODE_REPEAT), label: t("triggerRepeat") },
  ];
}

export function getPriceSideOptions(t: TFn) {
  return [
    { value: "buy", label: t("priceSideBuy") },
    { value: "sell", label: t("priceSideSell") },
  ];
}
