"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/navigation";
import { FormInput } from "@/components/forms/FormInput";
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { Button } from "@/components/Button";
import { ButtonType, LOCAL_STORAGE_TOKEN_NAME, routes } from "@/app/constants";
import { useMutationLoginWithPassword } from "@/utils/generated/hooks";
import { store } from "@/features/auth/store/store";
import { setAuth } from "@/features/auth/store/actions";
import { updateAuthTokenCache } from "@/utils/api-client";

const loginSchema = z.object({
  identifier: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPasswordForm() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutationLoginWithPassword({
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
            isAdmin: data.data.isAdmin || false,
          })
        );
        router.push(routes.home);
      }
    },
    onError() {
      setServerError(t("invalidCredentials"));
    },
  });

  const onSubmit = (data: LoginFormData) => {
    setServerError("");
    mutation.mutate({
      identifier: data.identifier,
      password: data.password,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormInput
        label={t("emailOrUsername")}
        placeholder={t("emailOrUsernamePlaceholder")}
        autoComplete="username"
        required
        error={errors.identifier?.message}
        {...register("identifier")}
      />

      <PasswordInput
        label={t("password")}
        placeholder={t("passwordPlaceholder")}
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register("password")}
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
        {t("signIn")}
      </Button>
    </form>
  );
}
