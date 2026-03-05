"use client";

import { useState, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import {
  useQueryListWallets,
  useQueryListCategories,
  useQueryGetTransaction,
  useMutationUpdateTransaction,
} from "@/utils/generated/hooks";
import {
  CategoryType,
  TransactionType as TransactionTypeEnum,
} from "@/gen/protobuf/v1/transaction";
import { FormToggle } from "@/components/forms/FormToggle";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { RHFFormSelect as FormSelect } from "@/components/forms/RHFFormSelect";
import { FormCreatableSelect } from "@/components/forms/FormCreatableSelect";
import { FormDateTimePicker } from "@/components/forms/FormDateTimePicker";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import {
  updateTransactionFormSchema,
  UpdateTransactionFormInput,
} from "@/features/transaction/utils/transaction.schema";
import { Success } from "@/components/modals/Success";
import { toDateTimeLocal, fromDateTimeLocal } from "@/lib/utils/date";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/utils/currency-formatter";
import { amountToSmallestUnit } from "@/lib/utils/units";

interface EditTransactionFormProps {
  transactionId: number;
  onSuccess?: () => void;
}

/**
 * Self-contained form component for editing transactions.
 * Owns its mutation logic, error handling, and loading state.
 * After successful update, calls onSuccess() callback (caller handles refetch + modal close).
 */
export function EditTransactionForm({
  transactionId,
  onSuccess,
}: EditTransactionFormProps) {
  const { currency } = useCurrency();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);

  const updateTransaction = useMutationUpdateTransaction();

  // Fetch transaction details
  const { data: transactionData, isLoading: transactionLoading } =
    useQueryGetTransaction(
      { transactionId },
      {
        enabled: !!transactionId,
        refetchOnMount: "always",
      },
    );

  const { data: walletsData } = useQueryListWallets({
    pagination: { page: 1, pageSize: 100, orderBy: "id", order: "asc" },
  });

  const { data: categoriesData, isLoading: categoriesLoading } =
    useQueryListCategories({
      pagination: { page: 1, pageSize: 100, orderBy: "id", order: "asc" },
    });

  const { control, handleSubmit, setValue, reset } =
    useForm<UpdateTransactionFormInput>({
      resolver: zodResolver(updateTransactionFormSchema),
      defaultValues: {
        transactionType: "income",
        walletId: "",
        categoryId: "",
        date: "",
        note: "",
      },
    });

  const transactionType = useWatch({
    control,
    name: "transactionType",
  });

  // Populate form with transaction data
  useEffect(() => {
    if (transactionData?.data) {
      const transaction = transactionData.data;

      // Map backend TransactionType enum to form values
      // TransactionType enum: INCOME = 1, EXPENSE = 2
      const getTransactionTypeValue = (
        type: number | undefined,
      ): "income" | "expense" => {
        if (type === TransactionTypeEnum.TRANSACTION_TYPE_INCOME)
          return "income";
        if (type === TransactionTypeEnum.TRANSACTION_TYPE_EXPENSE)
          return "expense";
        return "expense"; // Default fallback
      };

      const amount = transaction.amount?.amount || 0;

      reset({
        transactionType: getTransactionTypeValue(transaction.type),
        walletId: String(transaction.walletId),
        categoryId: transaction.categoryId
          ? String(transaction.categoryId)
          : "",
        date: toDateTimeLocal(transaction.date),
        note: transaction.note || "",
        amount: Math.abs(amount),
      });
    }
  }, [transactionData, reset]);

  const filteredCategories =
    categoriesData?.categories?.filter(
      (cat) =>
        cat.type ===
        (transactionType === "income"
          ? CategoryType.CATEGORY_TYPE_INCOME
          : CategoryType.CATEGORY_TYPE_EXPENSE),
    ) || [];

  // Only reset category when transaction type changes by user (not on initial load)
  const isInitialLoad = useRef(true);
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    // Only clear category if user manually changes transaction type
    setValue("categoryId", "");
  }, [transactionType, setValue]);

  const categoryOptions = filteredCategories.map((cat) => ({
    value: String(cat.id),
    label: cat.name,
  }));

  const walletOptions =
    (walletsData?.wallets || []).map((wallet) => ({
      value: String(wallet.id),
      label: `${wallet.walletName} (${formatCurrency(wallet.displayBalance?.amount ?? wallet.balance?.amount ?? 0, currency)})`,
      balance: wallet.displayBalance?.amount ?? wallet.balance?.amount ?? 0,
    })) || [];

  const onSubmit = (data: UpdateTransactionFormInput) => {
    setErrorMessage("");
    updateTransaction.mutate(
      {
        transactionId,
        walletId: Number(data.walletId),
        categoryId: data.categoryId ? Number(data.categoryId) : undefined,
        amount: {
          amount: amountToSmallestUnit(
            data.transactionType === "income"
              ? data.amount
              : -Math.abs(data.amount),
            currency,
          ),
          currency: currency,
        },
        date: fromDateTimeLocal(data.date),
        note: data.note,
      },
      {
        onSuccess: (data) => {
          const message =
            data?.message || "Transaction has been updated successfully";
          setSuccessMessage(message);
          setShowSuccess(true);
          setErrorMessage("");
        },
        onError: (error: any) => {
          setErrorMessage(
            error.message || "Failed to update transaction. Please try again",
          );
        },
      },
    );
  };

  // Show success state
  if (showSuccess) {
    return <Success message={successMessage} onDone={onSuccess} />;
  }

  if (transactionLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {errorMessage && (
        <div className="bg-red-50 text-danger-600 p-3 rounded mb-4">
          {errorMessage}
        </div>
      )}

      <FormToggle
        name="transactionType"
        control={control}
        options={[
          {
            value: "income",
            label: "Income",
            className: "bg-green-500 text-white",
          },
          {
            value: "expense",
            label: "Expense",
            className: "bg-red-500 text-white",
          },
        ]}
      />

      <FormNumberInput
        name="amount"
        control={control}
        label="Amount"
        suffix={currency}
        required
      />

      <FormSelect
        name="walletId"
        control={control}
        label="Wallet"
        options={walletOptions}
        placeholder="Select wallet"
        required
      />

      <FormCreatableSelect
        name="categoryId"
        control={control}
        label="Category"
        options={categoryOptions}
        placeholder="Select category..."
        required
        loading={categoriesLoading}
        onCreate={undefined} // Disable category creation in edit mode
      />

      <FormDateTimePicker
        name="date"
        control={control}
        label="Date & Time"
        required
      />

      <FormTextarea
        name="note"
        control={control}
        label="Note"
        placeholder="Enter note (optional)"
        maxLength={500}
        showCharacterCount
      />

      <div className="mt-4">
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => {}}
          loading={updateTransaction.isPending}
          htmlType="submit"
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
}
