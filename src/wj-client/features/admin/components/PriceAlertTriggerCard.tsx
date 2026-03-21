"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient } from "@/utils/api-client";
import { Zap } from "lucide-react";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";

interface TriggerResponse {
  success: boolean;
  message: string;
}

export function PriceAlertTriggerCard() {
  const t = useTranslations("admin.priceAlertTrigger");
  const [isTriggering, setIsTriggering] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleTrigger = async () => {
    if (isTriggering) return;
    setIsTriggering(true);
    setResult(null);

    try {
      const res = await apiClient.post<TriggerResponse>(
        "/api/v1/admin/price-alert-trigger",
      );
      const data = res as unknown as TriggerResponse;
      if (data.success) {
        setResult({ type: "success", message: t("toast.success") });
      } else {
        setResult({
          type: "error",
          message: data.message || t("toast.error"),
        });
      }
    } catch (err: unknown) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : t("toast.error"),
      });
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="border border-v2-border-light rounded-lg px-4 py-4 bg-v2-bg-secondary">
      <div className="flex items-start gap-3">
        <Zap className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-roboto font-semibold text-sm text-v2-text-primary">
            {t("title")}
          </h4>
          <p className="font-roboto text-xs text-v2-text-tertiary mt-0.5">
            {t("description")}
          </p>

          {result && (
            <div
              className={`mt-2 rounded-md px-3 py-1.5 text-sm font-roboto ${
                result.type === "success"
                  ? "bg-v2-bg-dark text-v2-green-positive border border-v2-green-positive/30"
                  : "bg-v2-bg-dark text-v2-red-negative border border-v2-red-negative/30"
              }`}
            >
              {result.message}
            </div>
          )}

          <div className="mt-3">
            <Button
              type={ButtonType.SECONDARY}
              onClick={handleTrigger}
              loading={isTriggering}
            >
              {isTriggering ? t("running") : t("button")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
