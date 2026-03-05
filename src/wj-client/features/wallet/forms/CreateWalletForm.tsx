"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useQueryListWallets,
  useMutationCreateWallet,
} from "@/utils/generated/hooks";
import { RHFFormInput as FormInput } from "@/components/forms/RHFFormInput";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { RHFFormSelect as FormSelect } from "@/components/forms/RHFFormSelect";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { WalletType } from "@/gen/protobuf/v1/wallet";
import { Success } from "@/components/modals/Success";
import {
  createWalletSchemaWithExisting,
  CreateWalletFormOutput,
} from "@/features/wallet/utils/wallet.schema";
import { SelectOption } from "@/components/forms/FormSelect";
import { useMemo } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { amountToSmallestUnit } from "@/lib/utils/units";

interface CreateWalletFormProps {
  onSuccess?: () => void;
  defaultType?: WalletType;
}

/**
 * Self-contained form component for creating wallets.
 * Owns its mutation logic, error handling, and loading state.
 * After successful creation, calls onSuccess() callback (caller handles refetch + modal close).
 */
export function CreateWalletForm({
  onSuccess,
  defaultType,
}: CreateWalletFormProps) {
  const createWallet = useMutationCreateWallet();
  const { currency } = useCurrency();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: walletsData } = useQueryListWallets({
    pagination: { page: 1, pageSize: 100, orderBy: "id", order: "asc" },
  });

  const existingWalletNames = useMemo(
    () => walletsData?.wallets?.map((w) => w.walletName) || [],
    [walletsData],
  );

  const { control, handleSubmit } = useForm<CreateWalletFormOutput>({
    resolver: zodResolver(createWalletSchemaWithExisting(existingWalletNames)),
    defaultValues: {
      walletName: "",
      initialBalance: 0,
      type: String(defaultType ?? WalletType.BASIC),
    },
    mode: "onSubmit",
  });

  const walletTypeOptions: SelectOption[] = [
    { value: String(WalletType.BASIC), label: "Basic" },
    { value: String(WalletType.INVESTMENT), label: "Investment" },
  ];

  const onSubmit = (data: CreateWalletFormOutput) => {
    setErrorMessage("");
    createWallet.mutate(
      {
        walletName: data.walletName,
        initialBalance: {
          amount: amountToSmallestUnit(data.initialBalance, currency),
          currency: currency,
        },
        type: Number(data.type) as WalletType,
      },
      {
        onSuccess: (data) => {
          const message =
            data?.message ||
            `Wallet "${data?.data?.walletName || ""}" has been created successfully`;
          setSuccessMessage(message);
          setShowSuccess(true);
          setErrorMessage("");
        },
        onError: (error: any) => {
          setErrorMessage(
            error.message || "Failed to create wallet. Please try again",
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
        name="walletName"
        control={control}
        label="Name"
        placeholder="Enter wallet's name"
        required
        className="mb-3 sm:mb-4"
      />

      <FormNumberInput
        name="initialBalance"
        control={control}
        label="Initial Balance"
        suffix={currency}
      />

      <FormSelect
        name="type"
        control={control}
        label="Wallet Type"
        options={walletTypeOptions}
        placeholder="Select wallet type"
        portal
      />

      <div className="mt-4">
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => {}}
          loading={createWallet.isPending}
          htmlType="submit"
        >
          Create
        </Button>
      </div>
    </form>
  );
}
