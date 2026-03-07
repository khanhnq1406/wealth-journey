"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useQueryListWallets,
  useMutationTransferFunds,
} from "@/utils/generated/hooks";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { RHFFormSelect as FormSelect } from "@/components/forms/RHFFormSelect";
import { FormDateTimePicker } from "@/components/forms/FormDateTimePicker";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import {
  transferMoneySchemaWithBalances,
  TransferMoneyFormInput,
} from "@/features/wallet/utils/transfer.schema";
import { Success } from "@/components/modals/Success";
import { SelectOption } from "@/components/forms/FormSelect";
import { toDateTimeLocal, getCurrentTimestamp } from "@/lib/utils/date";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/utils/currency-formatter";
import { amountToSmallestUnit } from "@/lib/utils/units";
import { useTranslations } from "next-intl";

interface TransferMoneyFormProps {
  onSuccess?: () => void;
}

/**
 * Self-contained form component for transferring money between wallets.
 * Owns its mutation logic, error handling, and loading state.
 * After successful transfer, calls onSuccess() callback (caller handles refetch + modal close).
 */
export function TransferMoneyForm({ onSuccess }: TransferMoneyFormProps) {
  const t = useTranslations("transfer.form");
  const { currency } = useCurrency();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);

  const transferFunds = useMutationTransferFunds();

  const { data: walletsData, isLoading: walletsLoading } = useQueryListWallets({
    pagination: { page: 1, pageSize: 100, orderBy: "id", order: "asc" },
  });

  const wallets = walletsData?.wallets || [];

  const { control, handleSubmit } = useForm<TransferMoneyFormInput>({
    resolver: zodResolver(
      transferMoneySchemaWithBalances(
        wallets.map((w) => ({ id: w.id, balance: w.balance?.amount || 0 })),
      ),
    ),
    defaultValues: {
      fromWalletId: "",
      toWalletId: "",
      datetime: toDateTimeLocal(getCurrentTimestamp()),
      note: "",
    },
  });

  const fromWalletId = useWatch({
    control,
    name: "fromWalletId",
  });

  const availableToWallets = fromWalletId
    ? wallets.filter((w) => w.id !== fromWalletId)
    : wallets;

  const walletOptions: SelectOption[] = wallets.map((wallet) => ({
    value: String(wallet.id),
    label: wallet.walletName,
    balance: wallet.balance?.amount || 0, // Keep raw balance for validation
  }));

  const toWalletOptions: SelectOption[] = availableToWallets.map((wallet) => ({
    value: String(wallet.id),
    label: wallet.walletName,
    balance: wallet.balance?.amount || 0, // Keep raw balance for validation
  }));

  const renderWalletOption = (option: SelectOption) => {
    const walletData = wallets.find((w) => w.id === Number(option.value));
    const balance =
      (walletData?.displayBalance?.amount ?? walletData?.balance?.amount) || 0;
    return (
      <span>
        {option.label}{" "}
        <span className="text-neutral-500">
          ({formatCurrency(balance, currency)})
        </span>
      </span>
    );
  };

  const onSubmit = (data: TransferMoneyFormInput) => {
    setErrorMessage("");
    transferFunds.mutate(
      {
        fromWalletId: Number(data.fromWalletId),
        toWalletId: Number(data.toWalletId),
        amount: {
          amount: amountToSmallestUnit(data.amount, currency),
          currency: currency,
        },
      },
      {
        onSuccess: (data) => {
          const message =
            data?.message || t("successDefault");
          setSuccessMessage(message);
          setShowSuccess(true);
          setErrorMessage("");
        },
        onError: (error: any) => {
          setErrorMessage(
            error.message || t("failedToTransfer"),
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

      <FormNumberInput
        name="amount"
        control={control}
        label={t("amount")}
        suffix={currency}
        required
      />

      <FormSelect
        name="fromWalletId"
        control={control}
        label={t("from")}
        options={walletOptions}
        placeholder={t("selectSourceWallet")}
        renderOption={renderWalletOption}
        required
      />

      <FormSelect
        name="toWalletId"
        control={control}
        label={t("to")}
        options={toWalletOptions}
        placeholder={
          !fromWalletId
            ? t("selectSourceFirst")
            : t("selectDestWallet")
        }
        renderOption={renderWalletOption}
        required
        disabled={!fromWalletId}
      />

      <FormDateTimePicker
        name="datetime"
        control={control}
        label={t("dateTime")}
      />

      <FormTextarea
        name="note"
        control={control}
        label={t("note")}
        placeholder={t("notePlaceholder")}
        maxLength={500}
        showCharacterCount
      />

      <div className="mt-4">
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => {}}
          loading={transferFunds.isPending}
          htmlType="submit"
        >
          {t("transfer")}
        </Button>
      </div>
    </form>
  );
}
