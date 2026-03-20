"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { PasswordStrengthIndicator } from "@/features/auth/components/PasswordStrengthIndicator";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { useMutationChangePassword } from "@/utils/generated/hooks";
import { mapChangePasswordError } from "@/features/auth/utils/error-mapper";
import { Success } from "@/components/modals/Success";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z.string().min(10, "Min 10 characters").max(72, "Max 72 characters"),
    confirmNewPassword: z.string().min(1, "Required"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

interface ChangePasswordFormProps {
  onSuccess?: () => void;
}

export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const t = useTranslations("settings.security");
  const [serverError, setServerError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const newPassword = watch("newPassword", "");

  const mutation = useMutationChangePassword({
    onSuccess() {
      setShowSuccess(true);
    },
    onError(error: any) {
      const key = mapChangePasswordError(error.message);
      setServerError(key ? t(`errors.${key}`) : t("errors.changePasswordFailed"));
    },
  });

  if (showSuccess) {
    return <Success message={t("passwordChanged")} onDone={onSuccess} />;
  }

  const onSubmit = (data: ChangePasswordFormData) => {
    setServerError("");
    mutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <PasswordInput
        label={t("currentPassword")}
        placeholder={t("currentPasswordPlaceholder")}
        autoComplete="current-password"
        required
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />

      <div>
        <PasswordInput
          label={t("newPassword")}
          placeholder={t("newPasswordPlaceholder")}
          autoComplete="new-password"
          required
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <PasswordStrengthIndicator password={newPassword} />
      </div>

      <PasswordInput
        label={t("confirmNewPassword")}
        placeholder={t("confirmNewPasswordPlaceholder")}
        autoComplete="new-password"
        required
        error={errors.confirmNewPassword?.message}
        {...register("confirmNewPassword")}
      />

      {serverError && (
 <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl">
 <p className="text-sm text-danger-800">{serverError}</p>
        </div>
      )}

      <Button
        type={ButtonType.PRIMARY}
        htmlType="submit"
        loading={mutation.isPending}
        className="w-full"
      >
        {t("changePassword")}
      </Button>
    </form>
  );
}
