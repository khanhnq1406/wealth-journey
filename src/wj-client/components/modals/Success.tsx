"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SuccessAnimation } from "../success/SuccessAnimation";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";

type SuccessProps = {
  message?: string;
  onDone?: () => void;
};

export const Success: React.FC<SuccessProps> = ({ message: propMessage, onDone }) => {
  const t = useTranslations("uiFeedback.success");
  const tCommon = useTranslations("common");
  const [message, setMessage] = useState(propMessage || "");

  useEffect(() => {
    if (!propMessage) {
      const stored = sessionStorage.getItem("successMessage");
      if (stored) {
        queueMicrotask(() => setMessage(stored));
        sessionStorage.removeItem("successMessage");
      }
    }
  }, [propMessage]);

  return (
    <div>
      <div className="flex justify-center">
        <SuccessAnimation />
      </div>
      <div className="text-center text-2xl font-bold m-2">{t("defaultMessage")}</div>
      <div className="text-center mt-2 mb-3 text-gray-600">{message}</div>
      {onDone && (
        <div className="flex justify-center mt-4">
          <Button type={ButtonType.PRIMARY} onClick={onDone} className="px-8">
            {tCommon("done")}
          </Button>
        </div>
      )}
    </div>
  );
};
