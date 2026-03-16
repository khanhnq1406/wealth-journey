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
import { store } from "@/features/auth/store/store";
import { setAuth } from "@/features/auth/store/actions";
import { updateAuthTokenCache } from "@/utils/api-client";

const registerSchema = z
  .object({
    email: z.string().min(1, "Required").email("Invalid email").max(100),
    username: z
      .string()
      .min(3, "Min 3 characters")
      .max(30, "Max 30 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
    displayName: z.string().min(1, "Required").max(100),
    password: z.string().min(10, "Min 10 characters").max(72, "Max 72 characters"),
    confirmPassword: z.string().min(1, "Required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

const STEP_1_FIELDS = ["email", "username", "displayName"] as const;

export function RegisterPasswordForm() {
  const t = useTranslations("auth.register");
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [step, setStep] = useState(1);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
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
          })
        );
        router.push(routes.home);
      }
    },
    onError(error: any) {
      const key = mapRegisterError(error.message);
      setServerError(key ? t(`errors.${key}`) : t("registrationFailed"));
    },
  });

  const handleNext = async () => {
    const valid = await trigger(
      STEP_1_FIELDS as unknown as (keyof RegisterFormData)[]
    );
    if (valid) setStep(2);
  };

  const onSubmit = (data: RegisterFormData) => {
    setServerError("");
    mutation.mutate({
      email: data.email,
      username: data.username,
      displayName: data.displayName,
      password: data.password,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1 rounded-full bg-primary-500" />
        <div
          className={`flex-1 h-1 rounded-full transition-colors ${
            step === 2
              ? "bg-primary-500"
              : "bg-neutral-200 dark:bg-dark-border"
          }`}
        />
      </div>

      {step === 1 ? (
        <>
          <FormInput
            label={t("email")}
            placeholder={t("emailPlaceholder")}
            type="email"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register("email")}
          />

          <FormInput
            label={t("username")}
            placeholder={t("usernamePlaceholder")}
            autoComplete="username"
            required
            error={errors.username?.message}
            {...register("username")}
          />

          <FormInput
            label={t("displayName")}
            placeholder={t("displayNamePlaceholder")}
            autoComplete="name"
            required
            error={errors.displayName?.message}
            {...register("displayName")}
          />

          <Button
            type={ButtonType.PRIMARY}
            htmlType="button"
            onClick={handleNext}
            className="w-full"
          >
            {t("continue")}
          </Button>
        </>
      ) : (
        <>
          <div>
            <PasswordInput
              label={t("password")}
              placeholder={t("passwordPlaceholder")}
              autoComplete="new-password"
              required
              error={errors.password?.message}
              {...register("password")}
            />
            <PasswordStrengthIndicator password={password} />
            {!errors.password && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {t("passwordRequirements")}
              </p>
            )}
          </div>

          <PasswordInput
            label={t("confirmPassword")}
            placeholder={t("confirmPasswordPlaceholder")}
            autoComplete="new-password"
            required
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />

          {serverError && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl">
              <p className="text-sm text-danger-800 dark:text-danger-200">
                {serverError}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 py-2.5 px-4 border border-neutral-300 dark:border-dark-border rounded-xl text-sm font-medium text-neutral-700 dark:text-dark-text-secondary hover:bg-neutral-50 dark:hover:bg-dark-border/30 transition-colors"
            >
              {t("back")}
            </button>
            <Button
              type={ButtonType.PRIMARY}
              htmlType="submit"
              loading={mutation.isPending}
              className="flex-[2]"
            >
              {t("createAccountButton")}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
