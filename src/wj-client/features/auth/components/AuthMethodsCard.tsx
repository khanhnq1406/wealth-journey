"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useQueryClient } from "@tanstack/react-query";
import { BaseCard } from "@/components/BaseCard";
import {
  useQueryGetAuthMethods,
  useMutationLinkGoogle,
  EVENT_AuthGetAuthMethods,
} from "@/utils/generated/hooks";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { mapLinkGoogleError } from "@/features/auth/utils/error-mapper";

interface AuthMethodsCardProps {
  onSetPassword?: () => void;
  onChangePassword?: () => void;
}

export function AuthMethodsCard({ onSetPassword, onChangePassword }: AuthMethodsCardProps) {
  const t = useTranslations("settings.security");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQueryGetAuthMethods({}, { refetchOnMount: "always" });
  const methods = data?.data;

  const [linkGoogleError, setLinkGoogleError] = useState<string | null>(null);

  const linkGoogle = useMutationLinkGoogle({
    onSuccess() {
      setLinkGoogleError(null);
      queryClient.invalidateQueries({ queryKey: [EVENT_AuthGetAuthMethods] });
    },
    onError(error: any) {
      const i18nKey = mapLinkGoogleError(error.message);
      setLinkGoogleError(
        i18nKey ? t(`errors.${i18nKey}`) : error.message || t("errors.linkGoogleFailed")
      );
    },
  });

  const handleGoogleLink = (credentialResponse: any) => {
    setLinkGoogleError(null);
    linkGoogle.mutate({ token: credentialResponse.credential });
  };

  if (isLoading) {
    return (
      <BaseCard>
        <div className="p-4 flex justify-center">
          <LoadingSpinner />
        </div>
      </BaseCard>
    );
  }

  return (
    <BaseCard>
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-semibold">{t("authMethods")}</h2>

        {/* Google OAuth */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span className="text-sm font-medium">{t("googleLinked")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                methods?.hasGoogle
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
              }`}
            >
              {methods?.hasGoogle ? t("linked") : t("notSet")}
            </span>
            {!methods?.hasGoogle && (
              <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
                <GoogleLogin
                  onSuccess={handleGoogleLink}
                  onError={() => setLinkGoogleError(t("errors.linkGoogleFailed"))}
                  size="small"
                  text="continue_with"
                  shape="rectangular"
                  theme="outline"
                />
              </GoogleOAuthProvider>
            )}
          </div>
        </div>
        {linkGoogleError && (
          <p className="text-xs text-red-600 dark:text-red-400 -mt-2">{linkGoogleError}</p>
        )}

        {/* Password */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-neutral-600 dark:text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span className="text-sm font-medium">{t("passwordSet")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                methods?.hasPassword
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
              }`}
            >
              {methods?.hasPassword ? t("linked") : t("notSet")}
            </span>
            {methods?.hasPassword ? (
              <button
                onClick={onChangePassword}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                {t("changePassword")}
              </button>
            ) : (
              <button
                onClick={onSetPassword}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                {t("setPassword")}
              </button>
            )}
          </div>
        </div>

        {/* Username */}
        {methods?.username && (
          <div className="flex items-center justify-between py-2 border-t border-neutral-200 dark:border-dark-border">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">{t("username")}</span>
            <span className="text-sm font-medium">@{methods.username}</span>
          </div>
        )}
      </div>
    </BaseCard>
  );
}
