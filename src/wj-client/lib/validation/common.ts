import { z } from "zod";

/**
 * Common validation schemas used across multiple forms
 * Messages are translation keys resolved by RHF wrapper components via the 'validation' namespace
 */

// Name validation (min 2 chars, max 50)
export const nameSchema = z
  .string()
  .min(2, "COMMON_NAME_MIN")
  .max(50, "COMMON_NAME_MAX")
  .trim();

// Amount validation (positive number, 2 decimal places)
export const amountSchema = z
  .number({
    message: "COMMON_AMOUNT_NUMBER",
  })
  .positive("COMMON_AMOUNT_POSITIVE")
  .min(0.01, "COMMON_AMOUNT_MIN")
  .max(999999999.99, "COMMON_AMOUNT_MAX");

// Date validation (Unix timestamp)
export const unixTimestampSchema = z
  .number({
    message: "COMMON_DATE_VALID",
  })
  .int("COMMON_TIMESTAMP_VALID")
  .positive("COMMON_DATE_POSITIVE")
  .min(946684800, "COMMON_DATE_MIN") // Year 2000 minimum
  .max(4102444800, "COMMON_DATE_MAX"); // Year 2100 maximum

// Optional note validation
export const optionalNoteSchema = z
  .string()
  .max(500, "COMMON_NOTE_MAX")
  .optional()
  .or(z.literal(""));

// Wallet ID validation
export const walletIdSchema = z
  .number({
    message: "COMMON_WALLET_ID",
  })
  .int("COMMON_WALLET_ID")
  .positive("COMMON_WALLET_ID");

// Category ID validation
export const categoryIdSchema = z
  .number({
    message: "COMMON_CATEGORY_ID",
  })
  .int("COMMON_CATEGORY_ID")
  .positive("COMMON_CATEGORY_ID");
