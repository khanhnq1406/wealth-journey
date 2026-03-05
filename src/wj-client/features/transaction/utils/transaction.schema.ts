import { z } from "zod";
import { amountSchema, optionalNoteSchema } from "@/lib/validation/common";

/**
 * Zod schema for transaction creation
 * Schema matches form input types exactly (no transformations)
 * All transformations to API types happen in the submit handler
 */

export type TransactionType = "income" | "expense";

const transactionTypeEnum = z.enum(["income", "expense"]);

export const createTransactionFormSchema = z.object({
  transactionType: transactionTypeEnum,
  amount: amountSchema,
  walletId: z.number().or(z.string().min(1, "Wallet is required")),
  categoryId: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  note: optionalNoteSchema,
});

export type CreateTransactionFormInput = z.infer<
  typeof createTransactionFormSchema
>;

/**
 * Zod schema for transaction update
 * Similar to create schema but with optional fields for partial updates
 */
export const updateTransactionFormSchema = z.object({
  transactionType: transactionTypeEnum,
  amount: amountSchema,
  walletId: z.number().or(z.string().min(1, "Wallet is required")),
  categoryId: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  note: optionalNoteSchema,
});

export type UpdateTransactionFormInput = z.infer<
  typeof updateTransactionFormSchema
>;
