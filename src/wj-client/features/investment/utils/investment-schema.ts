import { z } from "zod";
import {
  InvestmentTransactionType,
  InvestmentType,
} from "@/gen/protobuf/v1/investment";

/**
 * Zod schema for investment creation
 */

// Gold/silver/cash/foreign currency types allow any symbol format
const FLEXIBLE_SYMBOL_TYPES = new Set<InvestmentType>([
  InvestmentType.INVESTMENT_TYPE_GOLD_VND,
  InvestmentType.INVESTMENT_TYPE_GOLD_USD,
  InvestmentType.INVESTMENT_TYPE_SILVER_VND,
  InvestmentType.INVESTMENT_TYPE_SILVER_USD,
  InvestmentType.INVESTMENT_TYPE_CASH,
  InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY,
]);

export const createInvestmentSchema = z
  .object({
    symbol: z
      .string()
      .min(1, "INVESTMENT_SYMBOL_REQUIRED")
      .max(50, "INVESTMENT_SYMBOL_MAX"),
    name: z
      .string()
      .min(1, "INVESTMENT_NAME_REQUIRED")
      .max(100, "INVESTMENT_NAME_MAX"),
    type: z.nativeEnum(InvestmentType),
    initialQuantity: z.number().min(0.00000001, "INVESTMENT_QUANTITY_POSITIVE"),
    initialCost: z.number().min(0, "INVESTMENT_COST_MIN"),
    pricePerUnit: z.number().min(0, "INVESTMENT_PRICE_MIN"),
    purchaseDate: z.string().min(1, "INVESTMENT_DATE_REQUIRED"),
    currency: z
      .string()
      .length(3, "INVESTMENT_CURRENCY_LENGTH")
      .regex(/^[A-Z]{3}$/, "INVESTMENT_CURRENCY_FORMAT"),
  })
  .refine(
    (data) => {
      return data.initialQuantity > 0;
    },
    { message: "INVESTMENT_QUANTITY_GT_ZERO", path: ["initialQuantity"] },
  )
  .refine(
    (data) => {
      // Only enforce symbol format for non-gold/silver/cash/forex types (user-entered symbols)
      if (FLEXIBLE_SYMBOL_TYPES.has(data.type)) return true;
      return /^[A-Za-z0-9._-]+$/.test(data.symbol);
    },
    {
      message: "INVESTMENT_SYMBOL_FORMAT",
      path: ["symbol"],
    },
  );

// Dynamic validation schema based on investment type (crypto vs others)
export const addTransactionSchema = z.object({
  type: z.nativeEnum(InvestmentTransactionType),
  quantity: z.number().min(0.00000001, "INVESTMENT_QUANTITY_GT_ZERO"),
  price: z.number().min(0, "INVESTMENT_PRICE_NON_NEGATIVE"),
  fees: z.number().min(0, "INVESTMENT_FEES_NON_NEGATIVE"),
  transactionDate: z.string().min(1, "INVESTMENT_TX_DATE_REQUIRED"),
});

export type CreateInvestmentFormInput = z.infer<typeof createInvestmentSchema>;
export type AddTransactionFormInput = z.infer<typeof addTransactionSchema>;
