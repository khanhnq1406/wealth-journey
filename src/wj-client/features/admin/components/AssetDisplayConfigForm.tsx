"use client";

import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FormInput } from "@/components/forms/FormInput";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { apiClient } from "@/utils/api-client";
import { FetchCodeList } from "./FetchCodeList";

// Query key for invalidating the list after mutations
export const QUERY_KEY_ASSET_DISPLAY_CONFIG = "admin-asset-display-config";

interface AssetDisplayConfigFormValues {
  typeCode: string;
  displayName: string;
  displayOrder: number;
  enabled: boolean;
  showInInvestment: boolean;
}

export interface AssetDisplayConfigFormProps {
  mode: "create" | "edit";
  assetType?: string;
  initialValues?: {
    id: number;
    typeCode: string;
    displayName: string;
    displayOrder: number;
    enabled: boolean;
    showInInvestment: boolean;
  };
  existingCodes?: string[];
  nextDisplayOrder?: number;
  onSuccess?: (createdId?: number, createdAssetType?: string) => void;
}

interface CreateConfigRequest {
  typeCode: string;
  displayName: string;
  assetType: string;
  displayOrder: number;
  enabled: boolean;
  showInInvestment: boolean;
}

interface UpdateConfigRequest {
  displayName: string;
  displayOrder: number;
  enabled: boolean;
  showInInvestment: boolean;
}

interface CreateConfigResponse {
  config: {
    id: number;
    typeCode: string;
    assetType: string;
    displayName: string;
    displayOrder: number;
    enabled: boolean;
    showInInvestment: boolean;
  };
}

export function AssetDisplayConfigForm({
  mode,
  assetType,
  initialValues,
  existingCodes,
  nextDisplayOrder,
  onSuccess,
}: AssetDisplayConfigFormProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [selectedAssetType, setSelectedAssetType] = useState<string>(assetType ?? "gold");
  const t = useTranslations("admin.assetDisplayConfig");

  const { register, handleSubmit, control, reset, setValue, formState: { errors } } =
    useForm<AssetDisplayConfigFormValues>({
      defaultValues: {
        typeCode: initialValues?.typeCode ?? "",
        displayName: initialValues?.displayName ?? "",
        displayOrder: initialValues?.displayOrder ?? nextDisplayOrder ?? 1,
        enabled: initialValues?.enabled ?? true,
        showInInvestment: initialValues?.showInInvestment ?? true,
      },
    });

  useEffect(() => {
    if (initialValues) {
      reset({
        typeCode: initialValues.typeCode,
        displayName: initialValues.displayName,
        displayOrder: initialValues.displayOrder,
        enabled: initialValues.enabled,
        showInInvestment: initialValues.showInInvestment,
      });
    }
  }, [initialValues, reset]);

  useEffect(() => {
    if (mode === "create" && nextDisplayOrder !== undefined) {
      setValue("displayOrder", nextDisplayOrder);
    }
  }, [nextDisplayOrder, mode, setValue]);

  const enabledValue = useWatch({ control, name: "enabled" });
  const showInInvestmentValue = useWatch({ control, name: "showInInvestment" });

  const createMutation = useMutation({
    mutationFn: (req: CreateConfigRequest) =>
      apiClient.post<CreateConfigResponse>("/api/v1/admin/asset-display-config", req),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_ASSET_DISPLAY_CONFIG] });
      onSuccess?.(data?.data?.config?.id, selectedAssetType);
    },
    onError: (error: any) => {
      setErrorMessage(error.message || t("form.createError"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (req: UpdateConfigRequest) =>
      apiClient.put(`/api/v1/admin/asset-display-config/${initialValues!.id}`, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_ASSET_DISPLAY_CONFIG] });
      onSuccess?.(undefined);
    },
    onError: (error: any) => {
      setErrorMessage(error.message || t("form.updateError"));
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: AssetDisplayConfigFormValues) => {
    setErrorMessage(undefined);
    if (mode === "create") {
      createMutation.mutate({
        typeCode: values.typeCode.trim(),
        displayName: values.displayName.trim(),
        assetType: selectedAssetType,
        displayOrder: Number(values.displayOrder),
        enabled: values.enabled,
        showInInvestment: values.showInInvestment,
      });
    } else {
      updateMutation.mutate({
        displayName: values.displayName.trim(),
        displayOrder: Number(values.displayOrder),
        enabled: values.enabled,
        showInInvestment: values.showInInvestment,
      });
    }
  };

  return (
    <div className="space-y-0">
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {mode === "create" && (
        <div className="space-y-2">
          {/* Asset type selector — user can pick Gold or Silver before submitting */}
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-v2-gold-accent">
              {t("form.assetType")}
            </span>
            <div className="flex gap-1 p-1 rounded-lg bg-v2-bg-dark border border-v2-border-light w-fit">
              {(["gold", "silver"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selectedAssetType === type}
                  onClick={() => setSelectedAssetType(type)}
                  className={`min-h-[36px] px-4 py-1.5 text-sm font-medium rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-v2-gold-primary cursor-pointer capitalize ${
                    selectedAssetType === type
                      ? "bg-v2-gold-primary text-v2-bg-dark"
                      : "text-v2-text-tertiary hover:text-v2-gold-accent hover:bg-v2-maroon-600"
                  }`}
                >
                  {type === "gold" ? t("tabs.gold") : t("tabs.silver")}
                </button>
              ))}
            </div>
          </div>
          <FormInput
            label={t("form.typeCode")}
            placeholder={t("form.typeCodePlaceholder")}
            required
            error={errors.typeCode?.message}
            {...register("typeCode", { required: t("form.typeCodeRequired") })}
          />
          {existingCodes && existingCodes.length > 0 && (
            <div className="rounded-md border border-v2-border-light bg-v2-bg-dark p-3 space-y-2">
              <p className="text-xs font-medium text-v2-text-tertiary">
                {t("form.existingCodesLabel")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {existingCodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setValue("typeCode", code)}
                    className="px-2 py-0.5 text-xs font-mono rounded border border-v2-border-light text-v2-gold-accent bg-v2-bg-surface hover:bg-v2-maroon-600 hover:border-v2-border transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-v2-gold-primary"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <FormInput
        label={t("form.displayName")}
        placeholder={t("form.displayNamePlaceholder")}
        required
        error={errors.displayName?.message}
        {...register("displayName", { required: t("form.displayNameRequired") })}
      />

      <FormNumberInput
        name="displayOrder"
        control={control}
        label={t("form.displayOrder")}
        placeholder="0"
        required
        useThousandSeparator={false}
        showRecommendations={false}
        min={0}
      />

      <div className="flex items-center justify-between py-2 border-b border-v2-border-light">
        <span className="text-sm font-medium text-v2-gold-accent">{t("form.enabled")}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabledValue}
          onClick={() => setValue("enabled", !enabledValue)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-v2-gold-primary cursor-pointer ${
            enabledValue ? "bg-v2-green-positive/60" : "bg-v2-bg-dark"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabledValue ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between py-2 border-b border-v2-border-light">
        <span className="text-sm font-medium text-v2-gold-accent">
          {t("form.showInInvestment")}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={showInInvestmentValue}
          onClick={() => setValue("showInInvestment", !showInInvestmentValue)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-v2-gold-primary cursor-pointer ${
            showInInvestmentValue ? "bg-v2-green-positive/60" : "bg-v2-bg-dark"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              showInInvestmentValue ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {errorMessage && (
        <p className="text-sm text-v2-red-negative">{errorMessage}</p>
      )}

      <Button
        type={ButtonType.PRIMARY}
        htmlType="submit"
        loading={isPending}
        fullWidth={false}
        className="w-full mt-2"
      >
        {mode === "create" ? t("form.submitCreate") : t("form.submitEdit")}
      </Button>
    </form>

    {mode === "edit" && initialValues?.id && (
      <div className="mt-6 pt-4 border-t border-v2-border-light">
        <FetchCodeList
          configId={initialValues.id}
          assetType={assetType ?? "gold"}
        />
      </div>
    )}
    </div>
  );
}
