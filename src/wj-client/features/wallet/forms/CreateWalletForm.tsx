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
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { WalletType } from "@/gen/protobuf/v1/wallet";
import { Success } from "@/components/modals/Success";
import {
  createWalletSchemaWithExisting,
  CreateWalletFormOutput,
} from "@/features/wallet/utils/wallet.schema";
import { useMemo } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { amountToSmallestUnit } from "@/lib/utils/units";
import { useTranslations } from "next-intl";

interface CreateWalletFormProps {
  onSuccess?: () => void;
}

/**
 * Self-contained form component for creating wallets.
 * Owns its mutation logic, error handling, and loading state.
 * After successful creation, calls onSuccess() callback (caller handles refetch + modal close).
 */
export function CreateWalletForm({
  onSuccess,
}: CreateWalletFormProps) {
  const t = useTranslations("wallet");
  const tForm = useTranslations("wallet.form");
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
      type: String(WalletType.BASIC),
    },
    mode: "onSubmit",
  });

  const onSubmit = (data: CreateWalletFormOutput) => {
    setErrorMessage("");
    createWallet.mutate(
      {
        walletName: data.walletName,
        initialBalance: {
          amount: amountToSmallestUnit(data.initialBalance, currency),
          currency: currency,
        },
        type: WalletType.BASIC,
      },
      {
        onSuccess: (data) => {
          const message =
            data?.message ||
            tForm("createdSuccess", { name: data?.data?.walletName || "" });
          setSuccessMessage(message);
          setShowSuccess(true);
          setErrorMessage("");
        },
        onError: (error: any) => {
          setErrorMessage(
            error.message || tForm("failedToCreate"),
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
        <div className="bg-v2-red-primary/10 text-v2-red-negative p-3 rounded mb-4">
          {errorMessage}
        </div>
      )}

      <FormInput
        name="walletName"
        control={control}
        label={tForm("name")}
        placeholder={tForm("namePlaceholder")}
        required
        className="mb-3 sm:mb-4"
      />

      <FormNumberInput
        name="initialBalance"
        control={control}
        label={tForm("initialBalance")}
        suffix={currency}
      />

      <div className="mt-4">
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => {}}
          loading={createWallet.isPending}
          htmlType="submit"
        >
          {tForm("create")}
        </Button>
      </div>
    </form>
  );
}
