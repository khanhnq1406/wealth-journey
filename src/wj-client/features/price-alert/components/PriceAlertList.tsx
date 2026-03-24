"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";

import { MobileTable } from "@/components/table/MobileTable";
import type { MobileColumnDef } from "@/components/table/MobileTable";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { EmptyState } from "@/components/feedback/EmptyState";
import { AlertStatusBadge } from "./AlertStatusBadge";

import {
  useQueryListUserPriceAlerts,
  useMutationUpdateUserPriceAlert,
  useMutationDeleteUserPriceAlert,
  EVENT_InvestmentListUserPriceAlerts,
} from "@/utils/generated/hooks";
import {
  AlertStatus,
  AlertDirection,
  AlertTriggerMode,
  UserPriceAlert,
} from "@/gen/protobuf/v1/investment";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriceAlertListProps {
  /** Optional status filter (0 = all) */
  statusFilter?: AlertStatus;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(price: number, currency: string): string {
  if (!price) return "-";
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(price);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function directionLabel(
  direction: AlertDirection,
  t: (key: string) => string
): string {
  if (direction === AlertDirection.ALERT_DIRECTION_ABOVE)
    return t("directionAbove");
  if (direction === AlertDirection.ALERT_DIRECTION_BELOW)
    return t("directionBelow");
  return t("directionUnknown");
}

function triggerModeLabel(
  mode: AlertTriggerMode,
  t: (key: string) => string
): string {
  if (mode === AlertTriggerMode.ALERT_TRIGGER_MODE_ONCE) return t("triggerOnce");
  if (mode === AlertTriggerMode.ALERT_TRIGGER_MODE_REPEAT)
    return t("triggerRepeat");
  return t("triggerUnknown");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Pause/Activate toggle button (only for Active/Paused, not Triggered) */
function ToggleButton({
  alert,
  onToggle,
  isPending,
  t,
}: {
  alert: UserPriceAlert;
  onToggle: (alert: UserPriceAlert) => void;
  isPending: boolean;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  if (alert.status === AlertStatus.ALERT_STATUS_TRIGGERED) {
    return null;
  }

  const isActive = alert.status === AlertStatus.ALERT_STATUS_ACTIVE;
  const label = isActive ? t("pauseLabel") : t("activateLabel");
  const ariaLabel = isActive
    ? t("pauseAlertAria", { symbol: alert.symbol })
    : t("activateAlertAria", { symbol: alert.symbol });

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => onToggle(alert)}
      disabled={isPending}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md transition-colors hover:bg-v2-bg-surface-tint disabled:opacity-50 disabled:cursor-not-allowed text-v2-text-secondary hover:text-v2-gold-primary"
      title={label}
    >
      {isActive ? (
        /* Pause icon */
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
            d="M10 9v6m4-6v6"
          />
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      ) : (
        /* Play/activate icon */
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
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Desktop Table Row component
// ---------------------------------------------------------------------------

function DesktopAlertRow({
  alert,
  onToggle,
  onDelete,
  isTogglePending,
  isDeletePending,
  t,
}: {
  alert: UserPriceAlert;
  onToggle: (alert: UserPriceAlert) => void;
  onDelete: (alert: UserPriceAlert) => void;
  isTogglePending: boolean;
  isDeletePending: boolean;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  return (
    <tr className="border-b border-v2-border-light hover:bg-v2-bg-surface-tint transition-colors">
      <td className="py-3 px-4">
        <div className="font-medium text-v2-gold-accent">{alert.symbol}</div>
        <div className="text-xs text-v2-text-tertiary truncate max-w-[150px]">
          {alert.name}
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-v2-text-secondary">
        <span
          className={
            alert.direction === AlertDirection.ALERT_DIRECTION_ABOVE
              ? "text-v2-green-positive"
              : "text-v2-red-negative"
          }
        >
          {directionLabel(alert.direction, t)}
        </span>{" "}
        {formatPrice(alert.targetPrice, alert.currency)}
      </td>
      <td className="py-3 px-4 text-sm text-v2-text-secondary">
        {formatPrice(alert.currentPrice, alert.currency)}
      </td>
      <td className="py-3 px-4 text-sm text-v2-text-secondary">
        {triggerModeLabel(alert.triggerMode, t)}
      </td>
      <td className="py-3 px-4">
        <AlertStatusBadge status={alert.status} />
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <ToggleButton
            alert={alert}
            onToggle={onToggle}
            isPending={isTogglePending}
            t={t}
          />
          <button
            type="button"
            aria-label={t("deleteAlertAria", { symbol: alert.symbol })}
            onClick={() => onDelete(alert)}
            disabled={isDeletePending}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md transition-colors hover:bg-v2-red-light disabled:opacity-50 disabled:cursor-not-allowed text-v2-text-secondary hover:text-v2-red-negative"
            title={t("deleteLabel")}
          >
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PriceAlertList({ statusFilter }: PriceAlertListProps) {
  const t = useTranslations("priceAlerts");
  const queryClient = useQueryClient();
  const [alertToDelete, setAlertToDelete] = useState<UserPriceAlert | null>(
    null
  );

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------
  const { data, isLoading } = useQueryListUserPriceAlerts(
    {
      statusFilter: statusFilter ?? AlertStatus.ALERT_STATUS_UNSPECIFIED,
      pagination: { page: 1, pageSize: 100, orderBy: "", order: "" },
    },
    { refetchOnMount: "always" }
  );

  const alerts: UserPriceAlert[] = data?.alerts ?? [];

  // ------------------------------------------------------------------
  // Mutations
  // ------------------------------------------------------------------
  const toggleMutation = useMutationUpdateUserPriceAlert({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [EVENT_InvestmentListUserPriceAlerts],
      });
    },
  });

  const deleteMutation = useMutationDeleteUserPriceAlert({
    onSuccess: () => {
      setAlertToDelete(null);
      queryClient.invalidateQueries({
        queryKey: [EVENT_InvestmentListUserPriceAlerts],
      });
    },
  });

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const handleToggle = useCallback(
    (alert: UserPriceAlert) => {
      const newStatus =
        alert.status === AlertStatus.ALERT_STATUS_ACTIVE
          ? AlertStatus.ALERT_STATUS_PAUSED
          : AlertStatus.ALERT_STATUS_ACTIVE;

      toggleMutation.mutate({
        id: alert.id,
        targetPrice: alert.targetPrice,
        triggerMode: alert.triggerMode,
        cooldownHours: alert.cooldownHours,
        note: alert.note,
        status: newStatus,
      });
    },
    [toggleMutation]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!alertToDelete) return;
    deleteMutation.mutate({ id: alertToDelete.id });
  }, [alertToDelete, deleteMutation]);

  // ------------------------------------------------------------------
  // MobileTable columns
  // ------------------------------------------------------------------
  const mobileColumns: MobileColumnDef<UserPriceAlert>[] = useMemo(
    () => [
      {
        id: "symbol",
        header: t("colSymbol"),
        showInCollapsed: true,
        cell: ({ row }) => (
          <div>
            <span className="font-medium text-v2-gold-accent">{row.symbol}</span>
            <span className="text-xs text-v2-text-tertiary ml-2">{row.name}</span>
          </div>
        ),
      },
      {
        id: "target",
        header: t("colDirectionTarget"),
        showInCollapsed: true,
        cell: ({ row }) => (
          <span>
            <span
              className={
                row.direction === AlertDirection.ALERT_DIRECTION_ABOVE
                  ? "text-v2-green-positive"
                  : "text-v2-red-negative"
              }
            >
              {directionLabel(row.direction, t)}
            </span>{" "}
            {formatPrice(row.targetPrice, row.currency)}
          </span>
        ),
      },
      {
        id: "currentPrice",
        header: t("colCurrentPrice"),
        showInCollapsed: false,
        cell: ({ row }) => formatPrice(row.currentPrice, row.currency),
      },
      {
        id: "triggerMode",
        header: t("colTrigger"),
        showInCollapsed: false,
        cell: ({ row }) => triggerModeLabel(row.triggerMode, t),
      },
      {
        id: "status",
        header: t("colStatus"),
        showInCollapsed: true,
        cell: ({ row }) => <AlertStatusBadge status={row.status} />,
      },
    ],
    [t]
  );

  // ------------------------------------------------------------------
  // Mobile renderActions
  // ------------------------------------------------------------------
  const renderMobileActions = useCallback(
    (row: UserPriceAlert) => (
      <div className="flex items-center gap-1">
        <ToggleButton
          alert={row}
          onToggle={handleToggle}
          isPending={toggleMutation.isPending}
          t={t}
        />
        <button
          type="button"
          aria-label={t("deleteAlertAria", { symbol: row.symbol })}
          onClick={() => setAlertToDelete(row)}
          disabled={deleteMutation.isPending}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md transition-colors hover:bg-v2-red-light disabled:opacity-50 text-v2-text-secondary hover:text-v2-red-negative"
          title={t("deleteLabel")}
        >
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    ),
    [handleToggle, toggleMutation.isPending, deleteMutation.isPending, t]
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <>
      {/* Mobile view (< 800px) */}
      <div className="sm:hidden">
        <MobileTable
          data={alerts}
          columns={mobileColumns}
          isLoading={isLoading}
          getKey={(item) => item.id}
          renderActions={renderMobileActions}
          actionsPosition="top"
          expandable
          expandButtonLabel={t("expandDetails")}
          collapseButtonLabel={t("collapseDetails")}
          emptyMessage={t("emptyTitle")}
          emptyDescription={t("emptyDescription")}
        />
      </div>

      {/* Desktop view (>= 800px) */}
      <div className="hidden sm:block">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 bg-v2-bg-dark animate-pulse rounded-md"
              />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            variant="default"
            size="md"
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-v2-border-light">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-v2-border-light bg-v2-bg-surface-tint">
                  <th className="py-3 px-4 text-left text-xs font-semibold text-v2-text-secondary uppercase tracking-wider">
                    {t("colSymbol")}
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-v2-text-secondary uppercase tracking-wider">
                    {t("colDirectionTarget")}
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-v2-text-secondary uppercase tracking-wider">
                    {t("colCurrentPrice")}
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-v2-text-secondary uppercase tracking-wider">
                    {t("colTrigger")}
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-v2-text-secondary uppercase tracking-wider">
                    {t("colStatus")}
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-v2-text-secondary uppercase tracking-wider">
                    {t("colActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <DesktopAlertRow
                    key={alert.id}
                    alert={alert}
                    onToggle={handleToggle}
                    onDelete={setAlertToDelete}
                    isTogglePending={toggleMutation.isPending}
                    isDeletePending={deleteMutation.isPending}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {alertToDelete && (
        <ConfirmationDialog
          title={t("deleteDialogTitle")}
          message={t("deleteDialogMessage", { symbol: alertToDelete.symbol })}
          confirmText={t("deleteConfirmButton")}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setAlertToDelete(null)}
          isLoading={deleteMutation.isPending}
          variant="danger"
        />
      )}
    </>
  );
}
