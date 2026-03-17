"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { FormInput } from "@/components/forms/FormInput";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { PasswordStrengthIndicator } from "@/features/auth/components/PasswordStrengthIndicator";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { useMutationLinkPassword } from "@/utils/generated/hooks";
import { mapLinkPasswordError } from "@/features/auth/utils/error-mapper";
import { Success } from "@/components/modals/Success";

const linkPasswordSchema = z
  .object({
    username: z
      .string()
      .min(3, "Min 3 characters")
      .max(30, "Max 30 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
    password: z.string().min(10, "Min 10 characters").max(72, "Max 72 characters"),
    confirmPassword: z.string().min(1, "Required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type LinkPasswordFormData = z.infer<typeof linkPasswordSchema>;

interface LinkPasswordFormProps {
  onSuccess?: () => void;
}

export function LinkPasswordForm({ onSuccess }: LinkPasswordFormProps) {
  const t = useTranslations("settings.security");
  const [serverError, setServerError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LinkPasswordFormData>({
    resolver: zodResolver(linkPasswordSchema),
  });

  const password = watch("password", "");

  const mutation = useMutationLinkPassword({
    onSuccess() {
      setShowSuccess(true);
    },
    onError(error: any) {
      const key = mapLinkPasswordError(error.message);
      setServerError(key ? t(`errors.${key}`) : t("errors.linkPasswordFailed"));
    },
  });

  if (showSuccess) {
    return <Success message={t("passwordLinked")} onDone={onSuccess} />;
  }

  const onSubmit = (data: LinkPasswordFormData) => {
    setServerError("");
    mutation.mutate({
      username: data.username,
      password: data.password,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormInput
        label={t("username")}
        placeholder={t("usernamePlaceholder")}
        autoComplete="username"
        required
        error={errors.username?.message}
        {...register("username")}
      />

      <div>
        <PasswordInput
          label={t("newPassword")}
          placeholder={t("passwordPlaceholder")}
          autoComplete="new-password"
          required
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordStrengthIndicator password={password} />
      </div>

      <PasswordInput
        label={t("confirmNewPassword")}
        placeholder={t("confirmPasswordPlaceholder")}
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      {serverError && (
        <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl">
          <p className="text-sm text-danger-800 dark:text-danger-200">{serverError}</p>
        </div>
      )}

      <Button
        type={ButtonType.PRIMARY}
        htmlType="submit"
        loading={mutation.isPending}
        className="w-full"
      >
        {t("setPassword")}
      </Button>
    </form>
  );
}
