"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationCreateBudgetItem } from "@/utils/generated/hooks";
import { RHFFormInput as FormInput } from "@/components/forms/RHFFormInput";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import {
  createBudgetItemSchema,
  CreateBudgetItemFormInput,
} from "@/features/budget/utils/budget.schema";
import { Success } from "@/components/modals/Success";
import { useCurrency } from "@/contexts/CurrencyContext";
import { amountToSmallestUnit } from "@/lib/utils/units";

interface CreateBudgetItemFormProps {
  budgetId: number;
  onSuccess?: () => void;
}

/**
 * Self-contained form component for creating budget items.
 * Owns its mutation logic, error handling, and loading state.
 * After successful creation, calls onSuccess() callback (caller handles refetch + modal close).
 */
export function CreateBudgetItemForm({
  budgetId,
  onSuccess,
}: CreateBudgetItemFormProps) {
  const t = useTranslations("budget.form");
  const { currency } = useCurrency();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);

  const createBudgetItem = useMutationCreateBudgetItem();

  const { control, handleSubmit } = useForm<CreateBudgetItemFormInput>({
    resolver: zodResolver(createBudgetItemSchema),
    defaultValues: {
      name: "",
      total: 0,
    },
    mode: "onSubmit",
  });

  const onSubmit = (data: CreateBudgetItemFormInput) => {
    setErrorMessage("");
    createBudgetItem.mutate(
      {
        budgetId,
        name: data.name,
        total: {
          amount: amountToSmallestUnit(data.total, currency),
          currency: currency,
        },
      },
      {
        onSuccess: (data) => {
          const message =
            data?.message ||
            t("budgetItemCreatedSuccess", { name: data?.data?.name || "" });
          setSuccessMessage(message);
          setShowSuccess(true);
          setErrorMessage("");
        },
        onError: (error: any) => {
          setErrorMessage(
            error.message || t("failedToCreateItem"),
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
        label={t("budgetItemName")}
        placeholder={t("budgetItemNamePlaceholder")}
        required
      />

      <FormNumberInput
        name="total"
        control={control}
        label={t("allocatedAmount")}
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
          loading={createBudgetItem.isPending}
          htmlType="submit"
        >
          {t("addItem")}
        </Button>
      </div>
    </form>
  );
}
