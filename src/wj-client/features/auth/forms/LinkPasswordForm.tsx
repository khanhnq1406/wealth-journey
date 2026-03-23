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
import { getTranslatedError, translateValidationMessage } from "@/lib/utils/error-translator";

const linkPasswordSchema = z
  .object({
    username: z
      .string()
      .min(3, "AUTH_USERNAME_MIN")
      .max(30, "AUTH_USERNAME_MAX")
      .regex(/^[a-zA-Z0-9_]+$/, "AUTH_USERNAME_FORMAT"),
    password: z.string().min(10, "AUTH_PASSWORD_MIN").max(72, "AUTH_PASSWORD_MAX"),
    confirmPassword: z.string().min(1, "AUTH_FIELD_REQUIRED"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "AUTH_PASSWORD_MATCH",
    path: ["confirmPassword"],
  });

type LinkPasswordFormData = z.infer<typeof linkPasswordSchema>;

interface LinkPasswordFormProps {
  onSuccess?: () => void;
}

export function LinkPasswordForm({ onSuccess }: LinkPasswordFormProps) {
  const t = useTranslations("settings.security");
  const tErrors = useTranslations();
  const tValidation = useTranslations("validation");
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
      setServerError(getTranslatedError(error, tErrors));
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
        error={translateValidationMessage(tValidation, errors.username?.message)}
        {...register("username")}
      />

      <div>
        <PasswordInput
          label={t("newPassword")}
          placeholder={t("passwordPlaceholder")}
          autoComplete="new-password"
          required
          error={translateValidationMessage(tValidation, errors.password?.message)}
          {...register("password")}
        />
        <PasswordStrengthIndicator password={password} />
      </div>

      <PasswordInput
        label={t("confirmNewPassword")}
        placeholder={t("confirmPasswordPlaceholder")}
        autoComplete="new-password"
        required
        error={translateValidationMessage(tValidation, errors.confirmPassword?.message)}
        {...register("confirmPassword")}
      />

      {serverError && (
        <div className="p-3 bg-v2-bg-dark border border-v2-red-negative/30 rounded-xl">
          <p className="text-sm text-v2-red-negative">{serverError}</p>
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
