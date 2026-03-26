"use client";

import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { FormInput } from "@/components/forms/FormInput";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { apiClient } from "@/utils/api-client";

// Query key for invalidating the list after mutations
export const QUERY_KEY_GOLD_DISPLAY_CONFIG = "admin-gold-display-config";

interface GoldDisplayConfigFormValues {
  typeCode: string;
  displayName: string;
  displayOrder: number;
  enabled: boolean;
  showInInvestment: boolean;
}

export interface GoldDisplayConfigFormProps {
  mode: "create" | "edit";
  initialValues?: {
    id: number;
    typeCode: string;
    displayName: string;
    displayOrder: number;
    enabled: boolean;
    showInInvestment: boolean;
  };
  onSuccess?: () => void;
}

interface CreateConfigRequest {
  typeCode: string;
  displayName: string;
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

export function GoldDisplayConfigForm({
  mode,
  initialValues,
  onSuccess,
}: GoldDisplayConfigFormProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string>();

  const { register, handleSubmit, control, reset, setValue } =
    useForm<GoldDisplayConfigFormValues>({
      defaultValues: {
        typeCode: initialValues?.typeCode ?? "",
        displayName: initialValues?.displayName ?? "",
        displayOrder: initialValues?.displayOrder ?? 0,
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

  const enabledValue = useWatch({ control, name: "enabled" });
  const showInInvestmentValue = useWatch({ control, name: "showInInvestment" });

  const createMutation = useMutation({
    mutationFn: (req: CreateConfigRequest) =>
      apiClient.post("/api/v1/admin/gold-display-config", req),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY_GOLD_DISPLAY_CONFIG],
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      setErrorMessage(error.message || "Failed to create config");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (req: UpdateConfigRequest) =>
      apiClient.put(
        `/api/v1/admin/gold-display-config/${initialValues!.id}`,
        req
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY_GOLD_DISPLAY_CONFIG],
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      setErrorMessage(error.message || "Failed to update config");
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: GoldDisplayConfigFormValues) => {
    setErrorMessage(undefined);
    if (mode === "create") {
      createMutation.mutate({
        typeCode: values.typeCode.trim(),
        displayName: values.displayName.trim(),
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* typeCode — only shown on create */}
      {mode === "create" && (
        <FormInput
          label="Type Code"
          placeholder="e.g. SJC_1L"
          required
          error={undefined}
          {...register("typeCode", { required: "Type code is required" })}
        />
      )}

      {/* displayName */}
      <FormInput
        label="Display Name"
        placeholder="e.g. SJC 1 Lượng"
        required
        {...register("displayName", { required: "Display name is required" })}
      />

      {/* displayOrder */}
      <FormNumberInput
        name="displayOrder"
        control={control}
        label="Display Order"
        placeholder="0"
        required
        useThousandSeparator={false}
        showRecommendations={false}
        min={0}
      />

      {/* enabled toggle */}
      <div className="flex items-center justify-between py-2 border-b border-v2-border-light">
        <span className="text-sm font-medium text-v2-gold-accent">Enabled</span>
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

      {/* showInInvestment toggle */}
      <div className="flex items-center justify-between py-2 border-b border-v2-border-light">
        <span className="text-sm font-medium text-v2-gold-accent">
          Show in Investment
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

      {/* Error */}
      {errorMessage && (
        <p className="text-sm text-v2-red-negative">{errorMessage}</p>
      )}

      {/* Submit */}
      <Button
        type={ButtonType.PRIMARY}
        htmlType="submit"
        loading={isPending}
        fullWidth={false}
        className="w-full mt-2"
      >
        {mode === "create" ? "Add Gold Type" : "Save Changes"}
      </Button>
    </form>
  );
}
