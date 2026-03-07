"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  useMutationDeleteWallet,
  useQueryListWallets,
} from "@/utils/generated/hooks";
import { Wallet, WalletDeletionOption } from "@/gen/protobuf/v1/wallet";
import { Success } from "@/components/modals/Success";
import { formatCurrency } from "@/utils/currency-formatter";

interface DeleteWalletModalProps {
  wallet: Wallet;
  onSuccess?: () => void;
  onCancel?: () => void;
  isPending?: boolean;
}

type DeletionOption = "archive" | "transfer" | "delete_only";

export function DeleteWalletModal({
  wallet,
  onSuccess,
  onCancel,
  isPending = false,
}: DeleteWalletModalProps) {
  const t = useTranslations("wallet.delete");
  const tCommon = useTranslations("common");
  const [option, setOption] = useState<DeletionOption>("archive");
  const [targetWalletId, setTargetWalletId] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);

  const getListWallets = useQueryListWallets(
    { pagination: { page: 1, pageSize: 100, orderBy: "", order: "" } },
    { refetchOnMount: "always" },
  );

  const deleteWalletMutation = useMutationDeleteWallet({
    onSuccess: (data) => {
      // Show success message
      const message = data?.message || "";
      setSuccessMessage(message);
      setShowSuccess(true);
      setError("");
    },
    onError: (err: any) => {
      setError(err.message || t("failedToProcess"));
    },
  });

  const handleSubmit = useCallback(() => {
    setError("");
    setSuccessMessage("");
    setShowSuccess(false);

    let deletionOption: WalletDeletionOption;
    switch (option) {
      case "archive":
        deletionOption = WalletDeletionOption.WALLET_DELETION_OPTION_ARCHIVE;
        break;
      case "transfer":
        deletionOption = WalletDeletionOption.WALLET_DELETION_OPTION_TRANSFER;
        if (!targetWalletId) {
          setError(t("selectTargetError"));
          return;
        }
        break;
      case "delete_only":
        deletionOption =
          WalletDeletionOption.WALLET_DELETION_OPTION_DELETE_ONLY;
        break;
      default:
        deletionOption =
          WalletDeletionOption.WALLET_DELETION_OPTION_UNSPECIFIED;
    }

    deleteWalletMutation.mutate({
      walletId: wallet.id,
      option: deletionOption,
      targetWalletId: option === "transfer" ? targetWalletId : 0,
    });
  }, [option, targetWalletId, wallet.id, deleteWalletMutation]);

  const isLoading = deleteWalletMutation.isPending || isPending;

  const handleDone = useCallback(() => {
    onSuccess?.();
  }, [onSuccess]);

  // Show success state
  if (showSuccess) {
    return <Success message={successMessage} onDone={handleDone} />;
  }

  // Get other wallets for transfer option (filter out current wallet and different currencies)
  const otherWallets = (getListWallets.data?.wallets ?? []).filter(
    (w) => w.id !== wallet.id && w.currency === wallet.currency,
  );

  return (
    <>
      <h2 className="text-xl font-bold mb-4">{t("title")}</h2>

      <p className="text-gray-600 mb-4">
        {t("description", { walletName: wallet.walletName })}
      </p>

      <div className="space-y-3 mb-6">
        <label className="flex items-start p-3 border rounded cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="option"
            checked={option === "archive"}
            onChange={() => setOption("archive")}
            className="mt-1 mr-3"
            disabled={isLoading}
          />
          <div>
            <div className="font-medium">{t("archiveOption")}</div>
            <div className="text-sm text-gray-500">
              {t("archiveDescription")}
            </div>
          </div>
        </label>

        <label className="flex items-start p-3 border rounded cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="option"
            checked={option === "transfer"}
            onChange={() => setOption("transfer")}
            className="mt-1 mr-3"
            disabled={isLoading}
          />
          <div className="flex-1">
            <div className="font-medium">
              {t("transferOption")}
            </div>
            <div className="text-sm text-gray-500 mb-2">
              {t("transferDescription")}
            </div>
            {option === "transfer" && (
              <select
                name="target-wallet"
                value={targetWalletId}
                onChange={(e) => setTargetWalletId(Number(e.target.value))}
                className="w-full border rounded p-2 text-sm"
                disabled={isLoading}
                required
                aria-label="Select target wallet for transfer"
              >
                <option value="">{t("selectTargetWallet")}</option>
                {otherWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.walletName} ({formatCurrency(w.balance?.amount ?? 0, w.currency)})
                  </option>
                ))}
              </select>
            )}
            {option === "transfer" && otherWallets.length === 0 && (
              <div className="text-sm text-amber-600 mt-1">
                {t("noOtherWallets")}
              </div>
            )}
          </div>
        </label>

        <label className="flex items-start p-3 border rounded cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="option"
            checked={option === "delete_only"}
            onChange={() => setOption("delete_only")}
            className="mt-1 mr-3"
            disabled={isLoading}
          />
          <div>
            <div className="font-medium text-red-600">
              {t("deleteOnlyOption")}
            </div>
            <div className="text-sm text-gray-500">
              {t("deleteOnlyDescription")}{" "}
              <strong>{t("notRecommended")}</strong>
            </div>
          </div>
        </label>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm" role="alert">
          {error}
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          disabled={isLoading}
        >
          {tCommon("cancel")}
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
          disabled={isLoading || (option === "transfer" && !targetWalletId)}
        >
          {isLoading ? tCommon("processing") : t("confirm")}
        </button>
      </div>
    </>
  );
}
