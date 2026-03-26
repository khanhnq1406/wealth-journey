"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MobileTable } from "@/components/table/MobileTable";
import type { MobileColumnDef } from "@/components/table/MobileTable";
import { BaseModal } from "@/components/modals/BaseModal";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { apiClient } from "@/utils/api-client";
import { useNotification } from "@/contexts/NotificationContext";
import {
  GoldDisplayConfigForm,
  QUERY_KEY_GOLD_DISPLAY_CONFIG,
} from "./GoldDisplayConfigForm";

interface GoldDisplayConfigItem {
  id: number;
  typeCode: string;
  displayName: string;
  displayOrder: number;
  enabled: boolean;
  showInInvestment: boolean;
}

interface ListConfigsResponse {
  configs: GoldDisplayConfigItem[];
}

interface UpdateConfigRequest {
  displayName: string;
  displayOrder: number;
  enabled: boolean;
  showInInvestment: boolean;
}

export function GoldDisplayConfigTable() {
  const { toast } = useNotification();
  const queryClient = useQueryClient();

  // Modal state: null = closed, "create" = create modal, number = edit modal for that id
  const [modalState, setModalState] = useState<null | "create" | number>(null);
  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<GoldDisplayConfigItem | null>(null);
  // Track which row's toggle is in flight: `enabled-{id}` or `showInInvestment-{id}`
  const [toggleLoading, setToggleLoading] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<ListConfigsResponse>({
    queryKey: [QUERY_KEY_GOLD_DISPLAY_CONFIG],
    queryFn: async () => {
      const response = (await apiClient.get(
        "/api/v1/admin/gold-display-config"
      )) as unknown as ListConfigsResponse;
      return response;
    },
  });

  useEffect(() => {
    if (error) {
      toast.error("Failed to load gold display configs");
    }
  }, [error, toast]);

  const configs = data?.configs ?? [];

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      req,
    }: {
      id: number;
      req: UpdateConfigRequest;
    }) => apiClient.put(`/api/v1/admin/gold-display-config/${id}`, req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY_GOLD_DISPLAY_CONFIG],
      });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update config");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/api/v1/admin/gold-display-config/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY_GOLD_DISPLAY_CONFIG],
      });
      toast.success("Config deleted");
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete config");
      setDeleteTarget(null);
    },
  });

  const handleToggleEnabled = useCallback(
    (row: GoldDisplayConfigItem) => {
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
    (row: GoldDisplayConfigItem) => {
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

  const handleModalSuccess = useCallback(() => {
    setModalState(null);
    toast.success(
      typeof modalState === "number"
        ? "Config updated"
        : "Config created"
    );
  }, [modalState, toast]);

  const editTarget =
    typeof modalState === "number"
      ? configs.find((c) => c.id === modalState)
      : undefined;

  const columns: MobileColumnDef<GoldDisplayConfigItem>[] = [
    {
      id: "displayOrder",
      header: "Order",
      accessorKey: "displayOrder",
      showInCollapsed: true,
    },
    {
      id: "typeCode",
      header: "Type Code",
      accessorKey: "typeCode",
      showInCollapsed: true,
    },
    {
      id: "displayName",
      header: "Display Name",
      accessorKey: "displayName",
      showInCollapsed: true,
    },
    {
      id: "enabled",
      header: "Enabled",
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
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-v2-gold-primary min-h-[44px] min-w-[44px] justify-center ${
              isInFlight
                ? "opacity-50 cursor-not-allowed"
                : ""
            } ${row.enabled ? "bg-v2-green-positive/60" : "bg-v2-bg-dark"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                row.enabled ? "translate-x-2" : "-translate-x-2"
              }`}
            />
          </button>
        );
      },
    },
    {
      id: "showInInvestment",
      header: "In Investment",
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
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-v2-gold-primary min-h-[44px] min-w-[44px] justify-center ${
              isInFlight
                ? "opacity-50 cursor-not-allowed"
                : ""
            } ${row.showInInvestment ? "bg-v2-green-positive/60" : "bg-v2-bg-dark"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                row.showInInvestment ? "translate-x-2" : "-translate-x-2"
              }`}
            />
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-v2-gold-accent">
          Gold Display Configs
        </h2>
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => setModalState("create")}
          fullWidth={false}
          size="sm"
          className="min-h-[44px]"
        >
          + Add Gold Type
        </Button>
      </div>

      {/* Table */}
      <MobileTable
        data={configs}
        columns={columns}
        getKey={(item) => item.id}
        isLoading={isLoading}
        emptyMessage="No gold display configs found"
        emptyDescription="Add your first gold type config using the button above"
        expandable
        expandButtonLabel="More"
        collapseButtonLabel="Less"
        renderActions={(row) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModalState(row.id)}
              className="min-h-[44px] px-3 py-1 text-sm font-medium text-v2-gold-accent border border-v2-border rounded-md hover:bg-v2-maroon-600 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-v2-gold-primary"
              aria-label={`Edit ${row.displayName}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(row)}
              className="min-h-[44px] px-3 py-1 text-sm font-medium text-v2-red-negative border border-v2-red-negative/40 rounded-md hover:bg-v2-red-negative/10 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-v2-red-negative"
              aria-label={`Delete ${row.displayName}`}
            >
              Delete
            </button>
          </div>
        )}
      />

      {/* Create / Edit Modal */}
      <BaseModal
        isOpen={modalState !== null}
        onClose={() => setModalState(null)}
        title={
          modalState === "create" ? "Add Gold Type" : "Edit Gold Type"
        }
        maxWidth="max-w-md"
      >
        {modalState === "create" && (
          <GoldDisplayConfigForm
            mode="create"
            onSuccess={handleModalSuccess}
          />
        )}
        {typeof modalState === "number" && editTarget && (
          <GoldDisplayConfigForm
            mode="edit"
            initialValues={editTarget}
            onSuccess={handleModalSuccess}
          />
        )}
      </BaseModal>

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmationDialog
          title="Delete Gold Type"
          message={
            <span className="text-v2-text-secondary">
              Are you sure you want to delete{" "}
              <strong className="text-v2-gold-accent">
                {deleteTarget.displayName}
              </strong>{" "}
              ({deleteTarget.typeCode})?
            </span>
          }
          confirmText="Delete"
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteMutation.isPending}
          variant="danger"
        />
      )}
    </div>
  );
}
