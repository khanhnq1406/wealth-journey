import { z } from "zod";
import { nameSchema } from "@/lib/validation/common";
import { WalletType } from "@/gen/protobuf/v1/wallet";

/**
 * Zod schema for wallet creation
 * Includes async validation for wallet name uniqueness
 */

// Schema with runtime wallet list for async validation
export const createWalletSchemaWithExisting = (existingWalletNames: string[]) =>
  z.object({
    walletName: nameSchema.refine(
      (name) => !existingWalletNames.includes(name),
      {
        message: "WALLET_NAME_EXISTS",
      },
    ),
    initialBalance: z.number({ message: "COMMON_AMOUNT_NUMBER" }),
    // Accept string from select component, validate it's a valid wallet type string
    type: z.string().refine(
      (val) => val === String(WalletType.BASIC) || val === String(WalletType.INVESTMENT),
      { message: "WALLET_TYPE_INVALID" }
    ),
  });

// Infer the form type from the schema
export type CreateWalletFormOutput = z.infer<
  ReturnType<typeof createWalletSchemaWithExisting>
>;

/**
 * Zod schema for wallet update
 * Only validates wallet name - balance updates are handled separately via AddFunds/WithdrawFunds
 */
export const updateWalletSchema = (
  existingWalletNames: string[],
  currentWalletName: string,
) =>
  z.object({
    walletName: nameSchema.refine(
      (name) =>
        !existingWalletNames.some(
          (existingName) =>
            existingName === name && existingName !== currentWalletName,
        ),
      {
        message: "WALLET_NAME_EXISTS",
      },
    ),
  });

// Infer the form type from the schema
export type UpdateWalletFormOutput = z.infer<
  ReturnType<typeof updateWalletSchema>
>;

/**
 * Zod schema for wallet balance adjustment
 * Amount must be positive, type determines add/remove
 */
export const adjustBalanceSchema = z.object({
  adjustmentAmount: z
    .number({
      message: "WALLET_ADJUST_AMOUNT_NUMBER",
    })
    .min(0.01, { message: "WALLET_ADJUST_AMOUNT_MIN" }),
  adjustmentType: z.enum(["add", "remove"], {
    message: "WALLET_ADJUST_TYPE",
  }),
  reason: z
    .string()
    .max(200, "WALLET_ADJUST_REASON_MAX")
    .optional(),
});

// Infer the form type from the schema
export type AdjustBalanceFormOutput = z.infer<typeof adjustBalanceSchema>;
