"use client";

import { ButtonType } from "@/app/constants";
import { Button } from "@/components/Button";
import { memo } from "react";
import { useTranslations } from "next-intl";

type ModalTypeLocal = "add-transaction" | "transfer-money" | "create-wallet";

type FunctionalButtonProps = {
  onOpenModal: (type: ModalTypeLocal) => void;
};

export const FunctionalButton = memo(function FunctionalButton({
  onOpenModal,
}: FunctionalButtonProps) {
  const t = useTranslations("dashboard.quickActions");
  return (
    <div className="py-5">
      <div className="mb-5">
        <Button
          variant="primary"
          type={ButtonType.PRIMARY}
          onClick={() => onOpenModal("add-transaction")}
        >
          {t("addTransaction")}
        </Button>
      </div>
      <div className="mb-5">
        <Button
          type={ButtonType.SECONDARY}
          onClick={() => onOpenModal("transfer-money")}
        >
          {t("transferMoney")}
        </Button>
      </div>
      <div>
        <Button
          type={ButtonType.SECONDARY}
          onClick={() => onOpenModal("create-wallet")}
        >
          {t("createNewWallet")}
        </Button>
      </div>
    </div>
  );
});
