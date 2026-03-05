"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationCreateBudget } from "@/utils/generated/hooks";
import { RHFFormInput as FormInput } from "@/components/forms/RHFFormInput";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import {
  createBudgetSchema,
  CreateBudgetFormInput,
} from "@/features/budget/utils/budget.schema";
import { Success } from "@/components/modals/Success";
import { useCurrency } from "@/contexts/CurrencyContext";
import { amountToSmallestUnit } from "@/lib/utils/units";

interface CreateBudgetFormProps {
  onSuccess?: () => void;
}

/**
 * Self-contained form component for creating budgets.
 * Owns its mutation logic, error handling, and loading state.
 * After successful creation, calls onSuccess() callback (caller handles refetch + modal close).
 */
export function CreateBudgetForm({ onSuccess }: CreateBudgetFormProps) {
  const { currency } = useCurrency();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);

  const createBudget = useMutationCreateBudget();

  const { control, handleSubmit } = useForm<CreateBudgetFormInput>({
    resolver: zodResolver(createBudgetSchema),
    defaultValues: {
      name: "",
      total: 0,
    },
    mode: "onSubmit",
  });

  const onSubmit = (data: CreateBudgetFormInput) => {
    setErrorMessage("");
    createBudget.mutate(
      {
        name: data.name,
        total: {
          amount: amountToSmallestUnit(data.total, currency),
          currency: currency,
        },
        items: [],
      },
      {
        onSuccess: (data) => {
          const message =
            data?.message ||
            `Budget "${data?.data?.name || ""}" has been created successfully`;
          setSuccessMessage(message);
          setShowSuccess(true);
          setErrorMessage("");
        },
        onError: (error: any) => {
          setErrorMessage(
            error.message || "Failed to create budget. Please try again",
          );
        },
      },
    );
  };

  // Show success state
  if (showSuccess) {
    return <Success message={successMessage} onDone={onSuccess} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {errorMessage && (
        <div className="bg-red-50 text-danger-600 p-3 rounded mb-4">
          {errorMessage}
        </div>
      )}

      <FormInput
        name="name"
        control={control}
        label="Budget Name"
        placeholder="e.g., Monthly Budget"
        required
      />

      <FormNumberInput
        name="total"
        control={control}
        label="Total Amount"
        placeholder="0"
        suffix={currency}
        required
        min={1}
        step="1"
      />

      <div className="mt-4">
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => {}}
          loading={createBudget.isPending}
          htmlType="submit"
        >
          Create
        </Button>
      </div>
    </form>
  );
}
