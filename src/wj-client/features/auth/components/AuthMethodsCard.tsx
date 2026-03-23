"use client";

import { useState, useRef, useEffect } from "react";
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

function StatusBadge({ linked }: { linked: boolean }) {
  const t = useTranslations("settings.security");
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
        linked
          ? "bg-green-500/20 text-green-400"
          : "bg-v2-bg-dark text-v2-text-tertiary"
      }`}
    >
      {linked && (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
      {linked ? t("linked") : t("notSet")}
    </span>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
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
  );
}

/** Measures the container width and renders GoogleLogin at the correct pixel size */
function ResponsiveGoogleButton({
  onSuccess,
  onError,
}: {
  onSuccess: (resp: any) => void;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const measure = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full rounded">
      {width > 0 && (
        <GoogleOAuthProvider
          clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}
        >
          <GoogleLogin
            onSuccess={onSuccess}
            onError={onError}
            size="large"
            text="continue_with"
            shape="rectangular"
            theme="outline"
            width={Math.floor(width)}
            logo_alignment="left"
          />
        </GoogleOAuthProvider>
      )}
    </div>
  );
}

export function AuthMethodsCard({
  onSetPassword,
  onChangePassword,
}: AuthMethodsCardProps) {
  const t = useTranslations("settings.security");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQueryGetAuthMethods(
    {},
    { refetchOnMount: "always" },
  );
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
        i18nKey
          ? t(`errors.${i18nKey}`)
          : error.message || t("errors.linkGoogleFailed"),
      );
    },
  });

  const handleGoogleLink = (credentialResponse: any) => {
    setLinkGoogleError(null);
    linkGoogle.mutate({ token: credentialResponse.credential });
  };

  if (isLoading) {
    return (
      <BaseCard padding="none">
        <div className="p-6 flex justify-center">
          <LoadingSpinner />
        </div>
      </BaseCard>
    );
  }

  return (
    <BaseCard padding="none">
      <h2 className="px-4 pt-4 pb-3 sm:px-6 sm:pt-5 text-base font-semibold text-v2-gold-accent">
        {t("authMethods")}
      </h2>

      {/* Google OAuth Row */}
      <div className="px-4 py-3 sm:px-6 border-t border-v2-border-light">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-v2-bg-dark flex items-center justify-center">
            <GoogleIcon />
          </div>
          <span className="text-sm font-medium text-v2-gold-accent flex-1 min-w-0">
            {t("googleLinked")}
          </span>
          <StatusBadge linked={!!methods?.hasGoogle} />
        </div>

        {!methods?.hasGoogle && (
          <div className="mt-3 pl-12">
            <ResponsiveGoogleButton
              onSuccess={handleGoogleLink}
              onError={() => setLinkGoogleError(t("errors.linkGoogleFailed"))}
            />
          </div>
        )}

        {linkGoogleError && (
          <div className="mt-2 ml-12 p-2.5 bg-v2-bg-dark border border-v2-red-negative/30 rounded-lg">
            <p className="text-xs text-v2-red-negative">
              {linkGoogleError}
            </p>
          </div>
        )}
      </div>

      {/* Password Row */}
      <div className="px-4 py-3 sm:px-6 border-t border-v2-border-light">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-v2-bg-dark flex items-center justify-center">
            <svg
              className="w-5 h-5 text-v2-text-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <span className="text-sm font-medium text-v2-gold-accent flex-1 min-w-0">
            {t("passwordSet")}
          </span>
          <StatusBadge linked={!!methods?.hasPassword} />
        </div>

        <div className="mt-2 pl-12">
          {methods?.hasPassword ? (
            <button
              onClick={onChangePassword}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-v2-gold-primary hover:text-v2-text-secondary active:text-v2-gold-accent transition-colors py-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              {t("changePassword")}
            </button>
          ) : (
            <button
              onClick={onSetPassword}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-v2-gold-primary hover:text-v2-text-secondary active:text-v2-gold-accent transition-colors py-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t("setPassword")}
            </button>
          )}
        </div>
      </div>

      {/* Username Row */}
      {methods?.username && (
        <div className="px-4 py-3 sm:px-6 border-t border-v2-border-light">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-v2-bg-dark flex items-center justify-center">
              <svg
                className="w-5 h-5 text-v2-text-tertiary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <span className="text-sm text-v2-text-tertiary">
              {t("username")}
            </span>
            <span className="text-sm font-mono font-medium text-v2-gold-accent ml-auto">
              @{methods.username}
            </span>
          </div>
        </div>
      )}
    </BaseCard>
  );
}
