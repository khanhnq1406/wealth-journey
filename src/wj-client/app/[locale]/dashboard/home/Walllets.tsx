"use client";

import { resources } from "@/app/constants";
import Image from "next/image";
import { UseQueryResult } from "@tanstack/react-query";
import { memo, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ListWalletsResponse, Wallet } from "@/gen/protobuf/v1/wallet";
import { ErrorType } from "@/utils/generated/hooks.types";
import { formatCurrency } from "@/utils/currency-formatter";
import { useCurrency } from "@/contexts/CurrencyContext";
import { WalletListSkeleton } from "@/components/loading/Skeleton";

type WalletsProps = {
  getListWallets: UseQueryResult<ListWalletsResponse, ErrorType>;
};

// Memoized wallet item component
const WalletItem = memo(function WalletItem({
  wallet,
  currency,
}: {
  wallet: Wallet;
  currency: string;
}) {
  const t = useTranslations("common");
  const isInvestmentWallet = wallet.type === 1; // WALLET_TYPE_INVESTMENT

  // For investment wallets, show total value; for basic wallets, show balance
  const displayValue = isInvestmentWallet
    ? (wallet.displayTotalValue?.amount ?? wallet.totalValue?.amount ?? 0)
    : (wallet.displayBalance?.amount ?? wallet.balance?.amount ?? 0);

  const cashBalance =
    wallet.displayBalance?.amount ?? wallet.balance?.amount ?? 0;

  return (
    <div className="flex flex-nowrap justify-between m-3">
      <div className="flex flex-nowrap gap-3 items-center">
        {isInvestmentWallet ? (
          <svg
            className="w-6 h-6 sm:w-6 sm:h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
        ) : (
          <svg
            className="w-6 h-6 sm:w-6 sm:h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        )}
        <div className="font-semibold">{wallet.walletName}</div>
      </div>
      <div className="text-right">
        <div className="font-semibold">
          {formatCurrency(displayValue, currency)}
        </div>
        {isInvestmentWallet && (
          <div className="text-xs text-gray-500">
            {t("cash")}: {formatCurrency(cashBalance, currency)}
          </div>
        )}
      </div>
    </div>
  );
});

// Memoized empty state
const EmptyWalletsState = memo(function EmptyWalletsState() {
  const tFeedback = useTranslations("feedback.emptyState");
  return (
    <div className="flex items-center justify-center py-8 text-gray-400">
      {tFeedback("noWalletsFound")}. {tFeedback("noWalletsDescription")}
    </div>
  );
});

const Wallets: React.FC<WalletsProps> = memo(function Wallets({
  getListWallets,
}) {
  const { isLoading, data } = getListWallets;
  const { currency } = useCurrency();

  // Memoize wallet list rendering
  const walletList = useMemo(() => {
    if (!data?.wallets || data.wallets.length === 0) {
      return <EmptyWalletsState />;
    }

    return data.wallets.map((wallet) => (
      <WalletItem key={wallet.id} wallet={wallet} currency={currency} />
    ));
  }, [data, currency]);

  if (isLoading) {
    return <WalletListSkeleton />;
  }

  return <div className="px-2 py-1">{walletList}</div>;
});

export { Wallets };
