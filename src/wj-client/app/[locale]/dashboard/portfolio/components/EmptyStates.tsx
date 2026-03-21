"use client";

import React, { memo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";

/**
 * EmptyWalletsState component props
 */
export interface EmptyWalletsStateProps {
  /** Callback when user clicks create wallet button */
  onOpenModal: () => void;
}

/**
 * EmptyWalletsState component - displayed when user has no investment wallets
 */
export const EmptyWalletsState = memo(function EmptyWalletsState({
  onOpenModal,
}: EmptyWalletsStateProps) {
  const t = useTranslations("investment");
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="text-center">
        <p className="text-xl sm:text-2xl font-bold text-v2-gold-accent">
          {t("emptyWallets.title")}
        </p>
        <p className="text-base text-v2-text-secondary mt-2">
          {t("emptyWallets.description")}
        </p>
      </div>
      <Button
        type={ButtonType.PRIMARY}
        onClick={onOpenModal}
        className="w-fit px-4"
      >
        {t("emptyWallets.createButton")}
      </Button>
    </div>
  );
});

/**
 * EmptyInvestmentsState component - displayed when wallet has no investments
 */
export const EmptyInvestmentsState = memo(function EmptyInvestmentsState() {
  const t = useTranslations("investment");
  return (
    <div className="text-center py-8 text-gray-500">
      <p>
        {t("emptyInvestments.message")}
      </p>
    </div>
  );
});
