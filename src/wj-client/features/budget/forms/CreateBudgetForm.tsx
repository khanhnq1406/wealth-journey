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
import { useTranslations } from "next-intl";
import { getTranslatedError } from "@/lib/utils/error-translator";

interface CreateBudgetFormProps {
  onSuccess?: () => void;
}

/**
 * Self-contained form component for creating budgets.
 * Owns its mutation logic, error handling, and loading state.
 * After successful creation, calls onSuccess() callback (caller handles refetch + modal close).
 */
export function CreateBudgetForm({ onSuccess }: CreateBudgetFormProps) {
  const t = useTranslations("budget");
  const tErrors = useTranslations();
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
            t("form.createdSuccess", { name: data?.data?.name || "" });
          setSuccessMessage(message);
          setShowSuccess(true);
          setErrorMessage("");
        },
        onError: (error: any) => {
          setErrorMessage(getTranslatedError(error, tErrors));
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
        label={t("form.budgetName")}
        placeholder={t("form.budgetNamePlaceholder")}
        required
      />

      <FormNumberInput
        name="total"
        control={control}
        label={t("form.totalAmount")}
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
          {t("form.create")}
        </Button>
      </div>
    </form>
  );
}
