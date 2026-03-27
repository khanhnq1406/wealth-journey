"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { MobileTable } from "@/components/table/MobileTable";
import type { MobileColumnDef } from "@/components/table/MobileTable";
import { BaseModal } from "@/components/modals/BaseModal";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { apiClient } from "@/utils/api-client";
import { useNotification } from "@/contexts/NotificationContext";
import {
  AssetDisplayConfigForm,
  QUERY_KEY_ASSET_DISPLAY_CONFIG,
} from "./AssetDisplayConfigForm";

type AssetTab = "gold" | "silver";

interface AssetDisplayConfigItem {
  id: number;
  typeCode: string;
  assetType: string;
  displayName: string;
  displayOrder: number;
  enabled: boolean;
  showInInvestment: boolean;
}

interface ListConfigsResponse {
  configs: AssetDisplayConfigItem[];
}

interface UpdateConfigRequest {
  displayName: string;
  displayOrder: number;
  enabled: boolean;
  showInInvestment: boolean;
}

export function AssetDisplayConfigTable() {
  const { toast } = useNotification();
  const queryClient = useQueryClient();
  const t = useTranslations("admin.assetDisplayConfig");

  // Active asset type tab
  const [activeTab, setActiveTab] = useState<AssetTab>("gold");
  // Modal state: null = closed, "create" = create modal, number = edit modal for that id
  const [modalState, setModalState] = useState<null | "create" | number>(null);
  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<AssetDisplayConfigItem | null>(null);
  // Track which row's toggle is in flight: `enabled-{id}` or `showInInvestment-{id}`
  const [toggleLoading, setToggleLoading] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<ListConfigsResponse>({
    queryKey: [QUERY_KEY_ASSET_DISPLAY_CONFIG, activeTab],
    queryFn: async () => {
      const response = (await apiClient.get(
        `/api/v1/admin/asset-display-config?assetType=${encodeURIComponent(activeTab)}`
      )) as unknown as ListConfigsResponse;
      return response;
    },
  });

  useEffect(() => {
    if (error) {
      toast.error(t("toast.loadFailed"));
    }
  }, [error, toast, t]);

  const configs = data?.configs ?? [];

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      req,
    }: {
      id: number;
      req: UpdateConfigRequest;
    }) => apiClient.put(`/api/v1/admin/asset-display-config/${id}`, req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY_ASSET_DISPLAY_CONFIG],
      });
    },
    onError: (err: any) => {
      toast.error(err.message || t("toast.updateFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/api/v1/admin/asset-display-config/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY_ASSET_DISPLAY_CONFIG],
      });
      toast.success(t("toast.deleted"));
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.message || t("toast.deleteFailed"));
      setDeleteTarget(null);
    },
  });

  const handleToggleEnabled = useCallback(
    (row: AssetDisplayConfigItem) => {
      const key = `enabled-${row.id}`;
      setToggleLoading((prev) => new Set(prev).add(key));
      updateMutation.mutate(
        {
          id: row.id,
          req: {
            displayName: row.displayName,
            displayOrder: row.displayOrder,
            enabled: !row.enabled,
            showInInvestment: row.showInInvestment,
          },
        },
        {
          onSettled: () => {
            setToggleLoading((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          },
        }
      );
    },
    [updateMutation]
  );

  const handleToggleShowInInvestment = useCallback(
    (row: AssetDisplayConfigItem) => {
      const key = `showInInvestment-${row.id}`;
      setToggleLoading((prev) => new Set(prev).add(key));
      updateMutation.mutate(
        {
          id: row.id,
          req: {
            displayName: row.displayName,
            displayOrder: row.displayOrder,
            enabled: row.enabled,
            showInInvestment: !row.showInInvestment,
          },
        },
        {
          onSettled: () => {
            setToggleLoading((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          },
        }
      );
    },
    [updateMutation]
  );

  const handleModalSuccess = useCallback(
    (createdId?: number, createdAssetType?: string) => {
      if (typeof modalState === "string" && createdId !== undefined) {
        // After create: switch tab to match the created asset type (if different),
        // then switch to edit mode so fetch codes can be added immediately.
        if (createdAssetType && (createdAssetType === "gold" || createdAssetType === "silver")) {
          setActiveTab(createdAssetType);
        }
        setModalState(createdId);
        toast.success(t("toast.created"));
      } else {
        setModalState(null);
        toast.success(
          typeof modalState === "number" ? t("toast.updated") : t("toast.created")
        );
      }
    },
    [modalState, toast, t]
  );

  const editTarget =
    typeof modalState === "number"
      ? configs.find((c) => c.id === modalState)
      : undefined;

  const columns: MobileColumnDef<AssetDisplayConfigItem>[] = [
    {
      id: "displayOrder",
      header: t("columns.order"),
      accessorKey: "displayOrder",
      showInCollapsed: true,
    },
    {
      id: "typeCode",
      header: t("columns.typeCode"),
      accessorKey: "typeCode",
      showInCollapsed: true,
    },
    {
      id: "displayName",
      header: t("columns.displayName"),
      accessorKey: "displayName",
      showInCollapsed: true,
    },
    {
      id: "enabled",
      header: t("columns.enabled"),
      showInCollapsed: true,
      cell: ({ row }) => {
        const key = `enabled-${row.id}`;
        const isInFlight = toggleLoading.has(key);
        return (
          <button
            type="button"
            role="switch"
            aria-checked={row.enabled}
            disabled={isInFlight}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleEnabled(row);
            }}
            className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer focus-visible:ring-2 focus-visible:ring-v2-gold-primary rounded-md ${
              isInFlight ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <span
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                row.enabled ? "bg-v2-green-positive/60" : "bg-v2-bg-dark"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  row.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </button>
        );
      },
    },
    {
      id: "showInInvestment",
      header: t("columns.inInvestment"),
      showInCollapsed: false,
      cell: ({ row }) => {
        const key = `showInInvestment-${row.id}`;
        const isInFlight = toggleLoading.has(key);
        return (
          <button
            type="button"
            role="switch"
            aria-checked={row.showInInvestment}
            disabled={isInFlight}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleShowInInvestment(row);
            }}
            className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer focus-visible:ring-2 focus-visible:ring-v2-gold-primary rounded-md ${
              isInFlight ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <span
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                row.showInInvestment ? "bg-v2-green-positive/60" : "bg-v2-bg-dark"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  row.showInInvestment ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </button>
        );
      },
    },
  ];

  const TABS: { key: AssetTab; label: string }[] = [
    { key: "gold", label: t("tabs.gold") },
    { key: "silver", label: t("tabs.silver") },
  ];

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-v2-gold-accent">
          {t("title")}
        </h2>
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => setModalState("create")}
          fullWidth={false}
          size="sm"
          className="min-h-[44px]"
        >
          {t("addButton")}
        </Button>
      </div>

      {/* Asset type tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-v2-bg-dark border border-v2-border-light w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`min-h-[36px] px-4 py-1.5 text-sm font-medium rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-v2-gold-primary cursor-pointer ${
              activeTab === tab.key
                ? "bg-v2-gold-primary text-v2-bg-dark"
                : "text-v2-text-tertiary hover:text-v2-gold-accent hover:bg-v2-maroon-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <MobileTable
        data={configs}
        columns={columns}
        getKey={(item) => item.id}
        isLoading={isLoading}
        emptyMessage={t("emptyMessage")}
        emptyDescription={t("emptyDescription")}
        expandable
        expandButtonLabel={t("actions.more")}
        collapseButtonLabel={t("actions.less")}
        renderActions={(row) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModalState(row.id)}
              className="min-h-[44px] px-3 py-1 text-sm font-medium text-v2-gold-accent border border-v2-border rounded-md hover:bg-v2-maroon-600 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-v2-gold-primary"
              aria-label={`${t("actions.edit")} ${row.displayName}`}
            >
              {t("actions.edit")}
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(row)}
              className="min-h-[44px] px-3 py-1 text-sm font-medium text-v2-red-negative border border-v2-red-negative/40 rounded-md hover:bg-v2-red-negative/10 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-v2-red-negative"
              aria-label={`${t("actions.delete")} ${row.displayName}`}
            >
              {t("actions.delete")}
            </button>
          </div>
        )}
      />

      {/* Create / Edit Modal */}
      <BaseModal
        isOpen={modalState !== null}
        onClose={() => setModalState(null)}
        title={
          modalState === "create" ? t("modal.addTitle") : t("modal.editTitle")
        }
        maxWidth="max-w-md"
      >
        {modalState === "create" && (
          <AssetDisplayConfigForm
            mode="create"
            assetType={activeTab}
            existingCodes={configs.map((c) => c.typeCode)}
            onSuccess={handleModalSuccess}
          />
        )}
        {typeof modalState === "number" && !editTarget && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-v2-gold-primary border-t-transparent animate-spin" />
          </div>
        )}
        {typeof modalState === "number" && editTarget && (
          <AssetDisplayConfigForm
            mode="edit"
            assetType={editTarget.assetType}
            initialValues={editTarget}
            onSuccess={handleModalSuccess}
          />
        )}
      </BaseModal>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmationDialog
          title={t("delete.title")}
          message={
            <span className="text-v2-text-secondary">
              {t("delete.message", {
                name: deleteTarget.displayName,
                code: deleteTarget.typeCode,
              })}
            </span>
          }
          confirmText={t("delete.confirm")}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteMutation.isPending}
          variant="danger"
        />
      )}
    </div>
  );
}
