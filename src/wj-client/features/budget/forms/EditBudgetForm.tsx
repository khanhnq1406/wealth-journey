"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useMutationUpdateBudget } from "@/utils/generated/hooks";
import { RHFFormInput as FormInput } from "@/components/forms/RHFFormInput";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { Budget } from "@/gen/protobuf/v1/budget";
import {
  updateBudgetSchema,
  UpdateBudgetFormInput,
} from "@/features/budget/utils/budget.schema";
import { Success } from "@/components/modals/Success";
import { useCurrency } from "@/contexts/CurrencyContext";
import { amountToSmallestUnit } from "@/lib/utils/units";
import { useTranslations } from "next-intl";
import { getTranslatedError } from "@/lib/utils/error-translator";

interface EditBudgetFormProps {
  budget: Budget;
  onSuccess?: () => void;
}

/**
 * Self-contained form component for editing budgets.
 * Owns its mutation logic, error handling, and loading state.
 * After successful update, calls onSuccess() callback (caller handles refetch + modal close).
 */
export function EditBudgetForm({ budget, onSuccess }: EditBudgetFormProps) {
  const { currency } = useCurrency();
  const t = useTranslations("budget.form");
  const tErrors = useTranslations();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);

  const updateBudget = useMutationUpdateBudget({
    onSuccess: (data) => {
      const message = data?.message || t("updatedSuccess");
      setSuccessMessage(message);
      setShowSuccess(true);
      setErrorMessage("");
    },
    onError: (error: any) => {
      setErrorMessage(getTranslatedError(error, tErrors));
    },
  });

  const { control, handleSubmit, reset } = useForm<UpdateBudgetFormInput>({
    resolver: zodResolver(updateBudgetSchema),
    defaultValues: {
      name: "",
      total: 0,
    },
    mode: "onSubmit",
  });

  // Populate form with existing budget data
  useEffect(() => {
    reset({
      name: budget.name,
      total: budget.total?.amount || 0,
    });
  }, [budget, reset]);

  const onSubmit = (data: UpdateBudgetFormInput) => {
    setErrorMessage("");
    updateBudget.mutate({
      budgetId: budget.id,
      name: data.name,
      total: {
        amount: amountToSmallestUnit(data.total, currency),
        currency: currency,
      },
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
        label={t("budgetName")}
        placeholder={t("budgetNamePlaceholder")}
        required
        disabled={updateBudget.isPending}
      />

      <FormNumberInput
        name="total"
        control={control}
        label={t("totalAmount")}
        placeholder="0"
        suffix={currency}
        required
        min={1}
        step="1"
        disabled={updateBudget.isPending}
      />

      <div className="mt-4">
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => {}}
          loading={updateBudget.isPending}
          htmlType="submit"
        >
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
