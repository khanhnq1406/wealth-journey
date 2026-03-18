"use client";

import { memo } from "react";
import Image from "next/image";
import { BaseCard } from "@/components/BaseCard";
import { WalletCard } from "./WalletCard";
import { Wallet } from "@/gen/protobuf/v1/wallet";
import { resources } from "@/app/constants";
import { useTranslations } from "next-intl";

interface WalletGridProps {
  wallets: Wallet[];
  isLoading: boolean;
  onEdit: (wallet: Wallet) => void;
  onDelete: (wallet: Wallet) => void;
}

// Skeleton card component
const WalletCardSkeleton = memo(function WalletCardSkeleton() {
  return (
    <BaseCard className="p-4">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
            <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="text-right">
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse ml-auto" />
          <div className="h-8 w-40 bg-gray-200 rounded animate-pulse ml-auto mt-1" />
        </div>
      </div>
    </BaseCard>
  );
});

// Empty state component
const EmptyWalletsState = memo(function EmptyWalletsState() {
  const tFeedback = useTranslations("uiFeedback.emptyState");
  return (
    <BaseCard className="p-8">
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Image
          src={`${resources}wallet.svg`}
          alt="No wallets"
          width={64}
          height={64}
          className="opacity-50"
        />
        <div className="text-gray-500 text-lg">{tFeedback("noWalletsFound")}</div>
        <div className="text-gray-400">
          {tFeedback("noWalletsDescription")}
        </div>
      </div>
    </BaseCard>
  );
});

export const WalletGrid = memo(function WalletGrid({
  wallets,
  isLoading,
  onEdit,
  onDelete,
}: WalletGridProps) {
  // Loading state with skeleton cards
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <WalletCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  // Empty state
  if (wallets.length === 0) {
    return <EmptyWalletsState />;
  }

  // Wallet cards grid
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {wallets.map((wallet) => (
        <WalletCard
          key={wallet.id}
          wallet={wallet}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
});
