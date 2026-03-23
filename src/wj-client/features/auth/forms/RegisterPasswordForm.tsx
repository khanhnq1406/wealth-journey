"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/navigation";
import { FormInput } from "@/components/forms/FormInput";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { PasswordStrengthIndicator } from "@/features/auth/components/PasswordStrengthIndicator";
import { Button } from "@/components/Button";
import { ButtonType, LOCAL_STORAGE_TOKEN_NAME, routes } from "@/app/constants";
import { useMutationRegisterWithPassword } from "@/utils/generated/hooks";
import { mapRegisterError } from "@/features/auth/utils/error-mapper";
import { getTranslatedError, translateValidationMessage } from "@/lib/utils/error-translator";
import { store } from "@/features/auth/store/store";
import { setAuth } from "@/features/auth/store/actions";
import { updateAuthTokenCache } from "@/utils/api-client";

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "AUTH_USERNAME_MIN")
      .max(30, "AUTH_USERNAME_MAX")
      .regex(/^[a-zA-Z0-9_]+$/, "AUTH_USERNAME_FORMAT"),
    displayName: z.string().min(1, "AUTH_FIELD_REQUIRED").max(100, "AUTH_DISPLAY_NAME_MAX"),
    password: z.string().min(10, "AUTH_PASSWORD_MIN").max(72, "AUTH_PASSWORD_MAX"),
    confirmPassword: z.string().min(1, "AUTH_FIELD_REQUIRED"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "AUTH_PASSWORD_MATCH",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPasswordForm() {
  const t = useTranslations("auth.register");
  const tErrors = useTranslations();
  const tValidation = useTranslations("validation");
  const router = useRouter();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch("password", "");

  const mutation = useMutationRegisterWithPassword({
    onSuccess(data) {
      if (data.data) {
        const token = data.data.accessToken;
        localStorage.setItem(LOCAL_STORAGE_TOKEN_NAME, token);
        updateAuthTokenCache(token);
        store.dispatch(
          setAuth({
            isAuthenticated: true,
            email: data.data.email,
            fullname: data.data.fullname,
            picture: data.data.picture,
            username: data.data.username,
            isAdmin: false,
          })
        );
        router.push(routes.home);
      }
    },
    onError(error: any) {
      setServerError(getTranslatedError(error, tErrors));
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    setServerError("");
    mutation.mutate({
      username: data.username,
      displayName: data.displayName,
      password: data.password,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <FormInput
        label={t("username")}
        placeholder={t("usernamePlaceholder")}
        autoComplete="username"
        required
        error={translateValidationMessage(tValidation, errors.username?.message)}
        {...register("username")}
      />

      <FormInput
        label={t("displayName")}
        placeholder={t("displayNamePlaceholder")}
        autoComplete="name"
        required
        error={translateValidationMessage(tValidation, errors.displayName?.message)}
        {...register("displayName")}
      />

      <div>
        <PasswordInput
          label={t("password")}
          placeholder={t("passwordPlaceholder")}
          autoComplete="new-password"
          required
          error={translateValidationMessage(tValidation, errors.password?.message)}
          {...register("password")}
        />
        {!errors.password && <PasswordStrengthIndicator password={password} />}
        {!errors.password && !password && (
          <p className="mt-1 text-xs text-v2-text-tertiary">
            {t("passwordRequirements")}
          </p>
        )}
      </div>

      <PasswordInput
        label={t("confirmPassword")}
        placeholder={t("confirmPasswordPlaceholder")}
        autoComplete="new-password"
        required
        error={translateValidationMessage(tValidation, errors.confirmPassword?.message)}
        {...register("confirmPassword")}
      />

      {serverError && (
        <div className="p-2.5 bg-v2-bg-dark border border-v2-red-negative/30 rounded-xl">
          <p className="text-sm text-v2-red-negative">
            {serverError}
          </p>
        </div>
      )}

      <Button
        type={ButtonType.PRIMARY}
        htmlType="submit"
        loading={mutation.isPending}
        className="w-full"
      >
        {t("createAccountButton")}
      </Button>
    </form>
  );
}
