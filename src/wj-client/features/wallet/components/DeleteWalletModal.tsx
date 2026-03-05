"use client";

import { useState, useCallback } from "react";
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
      const message =
        data?.message ||
        `Wallet "${wallet.walletName}" has been ${option === "archive" ? "archived" : option === "transfer" ? "deleted" : "processed"} successfully`;
      setSuccessMessage(message);
      setShowSuccess(true);
      setError("");
    },
    onError: (err: any) => {
      setError(err.message || "Failed to process wallet. Please try again");
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
          setError("Please select a target wallet");
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
      <h2 className="text-xl font-bold mb-4">Delete Wallet</h2>

      <p className="text-gray-600 mb-4">
        <strong>{wallet.walletName}</strong> will be deleted. What would you
        like to do with the transactions?
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
            <div className="font-medium">Archive wallet (Recommended)</div>
            <div className="text-sm text-gray-500">
              Wallet will be hidden but all transactions will be preserved for
              your records.
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
              Transfer transactions to another wallet
            </div>
            <div className="text-sm text-gray-500 mb-2">
              Move all transactions to another wallet with the same currency.
              The target wallet&apos;s balance will be updated accordingly.
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
                <option value="">Select a wallet...</option>
                {otherWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.walletName} ({formatCurrency(w.balance?.amount ?? 0, w.currency)})
                  </option>
                ))}
              </select>
            )}
            {option === "transfer" && otherWallets.length === 0 && (
              <div className="text-sm text-amber-600 mt-1">
                No other wallets with the same currency available.
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
              Delete wallet and keep transactions
            </div>
            <div className="text-sm text-gray-500">
              Transactions will be preserved but the wallet reference will be
              removed.
              <strong> Not recommended.</strong>
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
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
          disabled={isLoading || (option === "transfer" && !targetWalletId)}
        >
          {isLoading ? "Processing…" : "Confirm"}
        </button>
      </div>
    </>
  );
}
