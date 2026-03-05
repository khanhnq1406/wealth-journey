import { z } from "zod";
import { amountSchema, optionalNoteSchema } from "@/lib/validation/common";

/**
 * Zod schema for money transfer between wallets
 */

export const transferMoneySchemaWithBalances = (
  wallets: Array<{ id: number; balance: number }>,
) =>
  z
    .object({
      amount: amountSchema,
      fromWalletId: z
        .number()
        .or(z.string().min(1, "Source wallet is required")),
      toWalletId: z.number().or(z.string().min(1, "Source wallet is required")),
      datetime: z.string().optional(),
      note: optionalNoteSchema,
    })
    .refine((data) => data.fromWalletId !== data.toWalletId, {
      message: "Source and destination wallets must be different",
      path: ["toWalletId"],
    })
    .refine(
      (data) => {
        const fromWallet = wallets.find(
          (w) => w.id === Number(data.fromWalletId),
        );
        if (!fromWallet) return false;
        return fromWallet.balance >= data.amount;
      },
      {
        message: "Insufficient balance in source wallet",
        path: ["amount"],
      },
    );

export type TransferMoneyFormInput = z.infer<
  ReturnType<typeof transferMoneySchemaWithBalances>
>;
