"use client";

import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Button } from "@/components/Button";
import { ButtonType, ModalType } from "@/app/constants";
import { BaseModal } from "@/components/modals/BaseModal";
import { PriceAlertList } from "@/features/price-alert/components/PriceAlertList";
import { CreatePriceAlertForm } from "@/features/price-alert/forms/CreatePriceAlertForm";
import { EVENT_InvestmentListUserPriceAlerts } from "@/utils/generated/hooks";
import {
  AlertStatus,
} from "@/gen/protobuf/v1/investment";

// ---------------------------------------------------------------------------
// Status filter tabs
// ---------------------------------------------------------------------------

type FilterTab = "all" | "active" | "triggered";

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PriceAlertsSettingsPage() {
  const t = useTranslations("priceAlerts");
  const queryClient = useQueryClient();
  const [modalType, setModalType] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const FILTER_TABS = useMemo(
    () => [
      {
        id: "all" as FilterTab,
        label: t("filterAll"),
        status: AlertStatus.ALERT_STATUS_UNSPECIFIED,
      },
      {
        id: "active" as FilterTab,
        label: t("filterActive"),
        status: AlertStatus.ALERT_STATUS_ACTIVE,
      },
      {
        id: "triggered" as FilterTab,
        label: t("filterTriggered"),
        status: AlertStatus.ALERT_STATUS_TRIGGERED,
      },
    ],
    [t]
  );

  const handleOpenModal = useCallback((type: string) => {
    setModalType(type);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalType(null);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [EVENT_InvestmentListUserPriceAlerts],
    });
    handleCloseModal();
  }, [queryClient, handleCloseModal]);

  const currentFilter =
    FILTER_TABS.find((tab) => tab.id === activeFilter) ?? FILTER_TABS[0];

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-v2-gold-accent">
          {t("title")}
        </h1>
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => handleOpenModal(ModalType.CREATE_PRICE_ALERT)}
          fullWidth={false}
          className="min-h-[44px] shrink-0"
          leftIcon={
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          }
        >
          {t("createAlert")}
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-v2-bg-surface-tint rounded-lg p-1 w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveFilter(tab.id)}
            aria-pressed={activeFilter === tab.id}
            className={[
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[36px]",
              activeFilter === tab.id
                ? "bg-v2-gold-primary text-v2-bg-dark shadow-sm"
                : "text-v2-text-secondary hover:text-v2-gold-primary hover:bg-v2-bg-dark",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <PriceAlertList statusFilter={currentFilter.status} />

      {/* Create Alert Modal */}
      <BaseModal
        isOpen={modalType === ModalType.CREATE_PRICE_ALERT}
        onClose={handleCloseModal}
        title={t("modalTitle")}
        maxWidth="max-w-lg"
      >
        <CreatePriceAlertForm onSuccess={handleCreateSuccess} />
      </BaseModal>
    </div>
  );
}
