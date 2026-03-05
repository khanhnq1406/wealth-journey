import { z } from "zod";
import { nameSchema, amountSchema } from "@/lib/validation/common";

/**
 * Zod schema for budget creation
 */

// Budget creation schema
export const createBudgetSchema = z.object({
  name: nameSchema,
  total: amountSchema,
});

// Budget update schema
export const updateBudgetSchema = z.object({
  name: nameSchema,
  total: amountSchema,
});

// Budget item creation schema
export const createBudgetItemSchema = z.object({
  name: nameSchema,
  total: amountSchema,
});

// Budget item update schema
export const updateBudgetItemSchema = z.object({
  name: nameSchema,
  total: amountSchema,
});

// Infer the form types from the schemas
export type CreateBudgetFormInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetFormInput = z.infer<typeof updateBudgetSchema>;
export type CreateBudgetItemFormInput = z.infer<typeof createBudgetItemSchema>;
export type UpdateBudgetItemFormInput = z.infer<typeof updateBudgetItemSchema>;
