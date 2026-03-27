"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { apiClient } from "@/utils/api-client";
import { useNotification } from "@/contexts/NotificationContext";

export interface FetchCodeListProps {
  configId: number;
  assetType: string;
}

interface AssetConfigFetchCode {
  id: number;
  configId: number;
  typeCode: string;
  priority: number;
}

interface ListFetchCodesResponse {
  fetchCodes: AssetConfigFetchCode[];
}

interface CreateFetchCodeRequest {
  typeCode: string;
  priority: number;
}

interface CreateFetchCodeResponse {
  fetchCode: AssetConfigFetchCode;
}

interface DeleteFetchCodeResponse {
  success: boolean;
}

interface ListAvailableTypeCodesResponse {
  typeCodes: string[];
}

function fetchCodeQueryKey(configId: number) {
  return ["admin-fetch-codes", configId];
}

function availableTypeCodesQueryKey(assetType: string) {
  return ["admin-asset-price-type-codes", assetType];
}

export function FetchCodeList({ configId, assetType }: FetchCodeListProps) {
  const t = useTranslations("admin.assetDisplayConfig.fetchCodes");
  const { toast } = useNotification();
  const queryClient = useQueryClient();

  // Add form state
  const [typeCodeInput, setTypeCodeInput] = useState("");
  const [priorityInput, setPriorityInput] = useState<number>(1);
  const [addError, setAddError] = useState<string | undefined>(undefined);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<AssetConfigFetchCode | null>(null);

  const { data, isLoading, error } = useQuery<ListFetchCodesResponse>({
    queryKey: fetchCodeQueryKey(configId),
    queryFn: async () => {
      const response = (await apiClient.get(
        `/api/v1/admin/asset-display-config/${configId}/fetch-codes`
      )) as unknown as ListFetchCodesResponse;
      return response;
    },
    enabled: configId > 0,
  });

  const { data: availableCodesData, isLoading: availableCodesLoading } =
    useQuery<ListAvailableTypeCodesResponse>({
      queryKey: availableTypeCodesQueryKey(assetType),
      queryFn: async () => {
        const response = (await apiClient.get(
          `/api/v1/admin/asset-price-type-codes?assetType=${assetType}`
        )) as unknown as ListAvailableTypeCodesResponse;
        return response;
      },
      enabled: !!assetType,
    });

  useEffect(() => {
    if (error) {
      toast.error(t("toast.createFailed"));
    }
  }, [error, toast, t]);

  const createMutation = useMutation({
    mutationFn: (req: CreateFetchCodeRequest) =>
      apiClient.post<CreateFetchCodeResponse>(
        `/api/v1/admin/asset-display-config/${configId}/fetch-codes`,
        req
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fetchCodeQueryKey(configId) });
      toast.success(t("toast.created"));
      setTypeCodeInput("");
      setPriorityInput(1);
      setAddError(undefined);
    },
    onError: (err: any) => {
      setAddError(err.message || t("toast.createFailed"));
      toast.error(err.message || t("toast.createFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (fcId: number) =>
      apiClient.delete<DeleteFetchCodeResponse>(
        `/api/v1/admin/asset-display-config/${configId}/fetch-codes/${fcId}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fetchCodeQueryKey(configId) });
      toast.success(t("toast.deleted"));
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.message || t("toast.deleteFailed"));
      setDeleteTarget(null);
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(undefined);

    if (!typeCodeInput.trim()) {
      setAddError(t("form.typeCodeRequired"));
      return;
    }

    createMutation.mutate({
      typeCode: typeCodeInput.trim(),
      priority: Number(priorityInput),
    });
  };

  // Sort fetch codes by priority (ascending)
  const fetchCodes = (data?.fetchCodes ?? []).slice().sort(
    (a, b) => a.priority - b.priority
  );

  return (
    <div className="space-y-4">
      {/* Section heading */}
      <h3 className="text-base font-semibold text-v2-gold-accent border-b border-v2-border-light pb-2">
        {t("title")}
      </h3>

      {/* Fetch codes list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-11 rounded-md bg-v2-bg-dark animate-pulse"
            />
          ))}
        </div>
      ) : fetchCodes.length === 0 ? (
        <EmptyState
          title={t("emptyMessage")}
          description={t("emptyDescription")}
          variant="minimal"
          size="sm"
        />
      ) : (
        <div className="space-y-2">
          {/* Column headers */}
          <div className="grid grid-cols-[2rem_1fr_auto] gap-2 px-3 py-1">
            <span className="text-xs font-medium text-v2-text-tertiary">
              {t("columns.priority")}
            </span>
            <span className="text-xs font-medium text-v2-text-tertiary">
              {t("columns.typeCode")}
            </span>
            <span className="text-xs font-medium text-v2-text-tertiary">
              {t("columns.actions")}
            </span>
          </div>

          {/* Rows */}
          {fetchCodes.map((fc) => (
            <div
              key={fc.id}
              className="grid grid-cols-[2rem_1fr_auto] gap-2 items-center px-3 py-2 rounded-md bg-v2-bg-dark border border-v2-border-light"
            >
              <span className="text-sm font-mono text-v2-text-secondary text-center">
                {fc.priority}
              </span>
              <span className="text-sm font-mono text-v2-text-secondary truncate">
                {fc.typeCode}
              </span>
              <button
                type="button"
                onClick={() => setDeleteTarget(fc)}
                aria-label={`${t("delete.confirm")} ${fc.typeCode}`}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center px-2 text-sm font-medium text-v2-red-negative border border-v2-red-negative/30 rounded-md hover:bg-v2-red-negative/10 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-v2-red-negative"
              >
                {t("delete.confirm")}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <form
        onSubmit={handleAddSubmit}
        className="space-y-3 pt-2 border-t border-v2-border-light"
      >
        {/* Available codes from DB */}
        {availableCodesLoading ? (
          <p className="text-xs text-v2-text-tertiary">{t("form.availableCodesLoading")}</p>
        ) : (availableCodesData?.typeCodes?.length ?? 0) > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-v2-gold-accent">{t("form.availableCodes")}</p>
            <div className="flex flex-wrap gap-1.5">
              {availableCodesData!.typeCodes.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setTypeCodeInput(code)}
                  className="px-2 py-0.5 text-xs font-mono rounded border border-v2-border-light bg-v2-bg-dark text-v2-text-secondary hover:border-v2-gold-primary hover:text-v2-gold-accent cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-v2-gold-primary"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-2">
          {/* Type code input */}
          <div className="flex-1">
            <label className="block text-xs font-medium text-v2-gold-accent mb-1">
              {t("form.typeCode")}
            </label>
            <input
              type="text"
              value={typeCodeInput}
              onChange={(e) => setTypeCodeInput(e.target.value)}
              placeholder={t("form.typeCodePlaceholder")}
              className="w-full px-3 py-2 min-h-[44px] rounded-md bg-v2-bg-dark border border-v2-border text-v2-text-secondary placeholder:text-v2-text-placeholder text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary"
            />
          </div>

          {/* Priority input */}
          <div className="w-full sm:w-28">
            <label className="block text-xs font-medium text-v2-gold-accent mb-1">
              {t("form.priority")}
            </label>
            <input
              type="number"
              value={priorityInput}
              min={1}
              onChange={(e) => setPriorityInput(Number(e.target.value))}
              className="w-full px-3 py-2 min-h-[44px] rounded-md bg-v2-bg-dark border border-v2-border text-v2-text-secondary text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary"
            />
          </div>
        </div>

        {/* Priority help text */}
        <p className="text-xs text-v2-text-tertiary">{t("form.priorityHelp")}</p>

        {addError && (
          <p className="text-sm text-v2-red-negative">{addError}</p>
        )}

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="min-h-[44px] px-4 py-2 text-sm font-medium bg-v2-gold-primary text-v2-bg-dark rounded-md hover:bg-v2-gold-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-v2-gold-primary"
        >
          {createMutation.isPending ? t("form.adding") : t("addButton")}
        </button>
      </form>

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmationDialog
          title={t("delete.title")}
          message={
            <span className="text-v2-text-secondary">
              {t("delete.message", { code: deleteTarget.typeCode })}
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
