"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useMutationUpdateBudgetItem } from "@/utils/generated/hooks";
import { RHFFormInput as FormInput } from "@/components/forms/RHFFormInput";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { BudgetItem } from "@/gen/protobuf/v1/budget";
import {
  updateBudgetItemSchema,
  UpdateBudgetItemFormInput,
} from "@/features/budget/utils/budget.schema";
import { Success } from "@/components/modals/Success";
import { useCurrency } from "@/contexts/CurrencyContext";
import { amountToSmallestUnit } from "@/lib/utils/units";

interface EditBudgetItemFormProps {
  budgetId: number;
  item: BudgetItem;
  onSuccess?: () => void;
}

/**
 * Self-contained form component for editing budget items.
 * Owns its mutation logic, error handling, and loading state.
 * After successful update, calls onSuccess() callback (caller handles refetch + modal close).
 */
export function EditBudgetItemForm({
  budgetId,
  item,
  onSuccess,
}: EditBudgetItemFormProps) {
  const { currency } = useCurrency();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);

  const updateBudgetItem = useMutationUpdateBudgetItem({
    onSuccess: (data) => {
      const message =
        data?.message || "Budget item has been updated successfully";
      setSuccessMessage(message);
      setShowSuccess(true);
      setErrorMessage("");
    },
    onError: (error: any) => {
      setErrorMessage(
        error.message || "Failed to update budget item. Please try again",
      );
    },
  });

  const { control, handleSubmit, reset } = useForm<UpdateBudgetItemFormInput>({
    resolver: zodResolver(updateBudgetItemSchema),
    defaultValues: {
      name: "",
      total: 0,
    },
    mode: "onSubmit",
  });

  // Populate form with existing budget item data
  useEffect(() => {
    reset({
      name: item.name,
      total: item.total?.amount || 0, // Convert from int64 to float
    });
  }, [item, reset]);

  const onSubmit = (data: UpdateBudgetItemFormInput) => {
    setErrorMessage("");
    updateBudgetItem.mutate({
      budgetId,
      itemId: item.id,
      name: data.name,
      total: {
        amount: amountToSmallestUnit(data.total, currency),
        currency: currency,
      },
      checked: item.checked ?? false,
    });
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
        label="Budget Item Name"
        placeholder="e.g., Groceries"
        required
        disabled={updateBudgetItem.isPending}
      />

      <FormNumberInput
        name="total"
        control={control}
        label="Allocated Amount"
        placeholder="0"
        suffix={currency}
        required
        min={1}
        step="1"
        disabled={updateBudgetItem.isPending}
      />

      <div className="mt-4">
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => {}}
          loading={updateBudgetItem.isPending}
          htmlType="submit"
        >
          Save
        </Button>
      </div>
    </form>
  );
}
