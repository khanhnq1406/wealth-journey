"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import {
  useQueryListWallets,
  useMutationUpdateWallet,
  useMutationAdjustBalance,
} from "@/utils/generated/hooks";
import { RHFFormInput as FormInput } from "@/components/forms/RHFFormInput";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { Wallet } from "@/gen/protobuf/v1/wallet";
import { Success } from "@/components/modals/Success";
import { AdjustmentType } from "@/gen/protobuf/v1/wallet";
import {
  updateWalletSchema,
  UpdateWalletFormOutput,
  adjustBalanceSchema,
} from "@/features/wallet/utils/wallet.schema";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/utils/currency-formatter";
import { amountToSmallestUnit } from "@/lib/utils/units";
import { useTranslations } from "next-intl";

interface EditWalletFormProps {
  wallet: Wallet;
  onSuccess?: () => void;
}

/**
 * Self-contained form component for editing wallets.
 * Handles wallet name updates and balance adjustments.
 * Owns its mutation logic, error handling, and loading state.
 */
export function EditWalletForm({ wallet, onSuccess }: EditWalletFormProps) {
  const tForm = useTranslations("wallet.form");
  const tEdit = useTranslations("wallet.edit");
  const tCommon = useTranslations("common");
  const { currency } = useCurrency();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);

  const updateWalletMutation = useMutationUpdateWallet({
    onError: (error: any) => {
      setErrorMessage(
        error.message || tForm("failedToUpdate"),
      );
    },
  });

  const adjustBalanceMutation = useMutationAdjustBalance({
    onError: (error: any) => {
      setErrorMessage(
        error.message || tEdit("failedToAdjust"),
      );
    },
  });

  const { data: walletsData } = useQueryListWallets({
    pagination: { page: 1, pageSize: 100, orderBy: "id", order: "asc" },
  });

  // Filter out current wallet from the list when checking for name conflicts
  const existingWalletNames =
    walletsData?.wallets
      ?.filter((w) => w.id !== wallet.id)
      .map((w) => w.walletName) || [];

  const { control, handleSubmit, reset, watch, setError } = useForm<{
    walletName: string;
    adjustmentAmount?: number;
    adjustmentType?: "add" | "remove";
    reason?: string;
  }>({
    defaultValues: {
      walletName: "",
      adjustmentAmount: 0,
      adjustmentType: "add",
      reason: "",
    },
    mode: "onSubmit",
  });

  // Populate form with existing wallet data
  useEffect(() => {
    reset({
      walletName: wallet.walletName,
      adjustmentAmount: 0,
      adjustmentType: "add",
      reason: "",
    });
  }, [wallet, reset]);

  const watchAdjustmentAmount = watch("adjustmentAmount");
  const watchAdjustmentType = watch("adjustmentType");

  const isLoading =
    updateWalletMutation.isPending || adjustBalanceMutation.isPending;

  const onFormSubmit = async (data: typeof control._defaultValues) => {
    setErrorMessage("");

    // Validate wallet name
    const walletResult = updateWalletSchema(
      existingWalletNames,
      wallet.walletName,
    ).safeParse({
      walletName: data.walletName,
    });

    if (!walletResult.success) {
      walletResult.error.issues.forEach((issue) => {
        if (issue.path[0] === "walletName") {
          setError("walletName" as const, { message: issue.message });
        }
      });
      return;
    }

    const walletData: UpdateWalletFormOutput = walletResult.data;

    try {
      // First, adjust balance if provided
      let adjustmentMade = false;
      if (
        showAdjustment &&
        data.adjustmentAmount &&
        data.adjustmentAmount !== 0
      ) {
        // Validate adjustment amount and type
        const result = adjustBalanceSchema.safeParse({
          adjustmentAmount: data.adjustmentAmount,
          adjustmentType: data.adjustmentType || "add",
          reason: data.reason,
        });

        if (!result.success) {
          result.error.issues.forEach((issue) => {
            if (issue.path[0] === "adjustmentAmount") {
              setError("adjustmentAmount" as const, { message: issue.message });
            }
            if (issue.path[0] === "adjustmentType") {
              setError("adjustmentType" as const, { message: issue.message });
            }
            if (issue.path[0] === "reason") {
              setError("reason" as const, { message: issue.message });
            }
          });
          return;
        }

        const adjustment = result.data;
        const adjustmentType =
          adjustment.adjustmentType === "add"
            ? AdjustmentType.ADJUSTMENT_TYPE_ADD
            : AdjustmentType.ADJUSTMENT_TYPE_REMOVE;

        await adjustBalanceMutation.mutateAsync({
          walletId: wallet.id,
          amount: {
            amount: amountToSmallestUnit(
              adjustment.adjustmentAmount,
              wallet.balance?.currency || currency,
            ),
            currency: wallet.balance?.currency || currency,
          },
          reason: adjustment.reason || tEdit("balanceAdjustment"),
          adjustmentType,
        });
        adjustmentMade = true;
      }

      // Then update wallet name if changed
      let nameChanged = false;
      if (walletData.walletName !== wallet.walletName) {
        await updateWalletMutation.mutateAsync({
          walletId: wallet.id,
          walletName: walletData.walletName,
        });
        nameChanged = true;
      }

      // Show success if any changes were made
      if (nameChanged || adjustmentMade) {
        const message =
          nameChanged && adjustmentMade
            ? tEdit("nameAndBalanceSuccess")
            : nameChanged
              ? tEdit("nameUpdatedSuccess")
              : tEdit("balanceAdjustedSuccess");
        setSuccessMessage(message);
        setShowSuccess(true);
        setErrorMessage("");
      }
    } catch {
      // Error handling is done by mutation onError callbacks
    }
  };

  const handleDone = () => {
    onSuccess?.();
  };

  // Show success state
  if (showSuccess) {
    return <Success message={successMessage} onDone={handleDone} />;
  }

  // Calculate projected balance
  // Use raw balance for calculation, but displayBalance for display purposes
  const currentBalance = wallet.balance?.amount || 0;
  const displayBalance =
    (wallet.displayBalance?.amount ?? wallet.balance?.amount) || 0;
  const adjustmentAmount = watchAdjustmentAmount || 0;
  const adjustmentType = watchAdjustmentType || "add";
  const isAdd = adjustmentType === "add";
  const delta = isAdd ? adjustmentAmount : -adjustmentAmount;
  const projectedBalance = currentBalance + delta;

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {errorMessage && (
        <div className="bg-red-50 text-danger-600 p-3 rounded mb-4">
          {errorMessage}
        </div>
      )}

      {/* Wallet Name Section */}
      <div>
        <h3 className="text-lg font-medium mb-3">{tEdit("walletInformation")}</h3>
        <FormInput
          name="walletName"
          control={control}
          label={tForm("name")}
          placeholder={tForm("namePlaceholder")}
          required
          disabled={isLoading}
        />
      </div>

      {/* Balance Adjustment Section */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">{tEdit("balanceAdjustment")}</h3>
          <button
            type="button"
            onClick={() => setShowAdjustment(!showAdjustment)}
            className="text-sm text-gray-600 hover:text-gray-900"
            disabled={isLoading}
          >
            {showAdjustment ? tCommon("cancel") : tEdit("adjustBalance")}
          </button>
        </div>

        {showAdjustment && (
          <div className="space-y-3 bg-gray-50 p-4 rounded-md">
            <div className="text-sm text-gray-600 mb-2">
              {tEdit("currentBalance", { amount: formatCurrency(currentBalance, currency) })}
            </div>

            {/* Adjustment Type Radio Buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tEdit("adjustmentType")} <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    {...control.register("adjustmentType")}
                    value="add"
                    className="mr-2"
                    disabled={isLoading}
                  />
                  <span className="text-sm">{tEdit("addFunds")}</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    {...control.register("adjustmentType")}
                    value="remove"
                    className="mr-2"
                    disabled={isLoading}
                  />
                  <span className="text-sm">{tEdit("removeFunds")}</span>
                </label>
              </div>
            </div>

            <FormNumberInput
              name="adjustmentAmount"
              control={control}
              label={tEdit("adjustmentAmount", { currency })}
              placeholder={tEdit("adjustmentAmountPlaceholder")}
              step="1"
              min={0}
              disabled={isLoading}
            />
            <div className="text-xs text-gray-500 ml-1 -mt-1">
              {tEdit("adjustmentAmountHelp")}
            </div>

            {adjustmentAmount !== 0 && adjustmentAmount !== undefined && (
              <div className="text-sm">
                <span className="text-gray-600">{tEdit("projectedBalance")}</span>
                <span
                  className={`font-medium ${projectedBalance < 0 ? "text-red-600" : "text-v2-green-positive"}`}
                >
                  {formatCurrency(projectedBalance, currency)}
                </span>
              </div>
            )}

            <FormInput
              name="reason"
              control={control}
              label={tEdit("reasonLabel")}
              placeholder={tEdit("reasonPlaceholder")}
              disabled={isLoading}
            />

            <div className="text-xs text-gray-500 mt-2">
              {tEdit("auditNote")}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => {}}
          loading={isLoading}
          htmlType="submit"
        >
          {tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
