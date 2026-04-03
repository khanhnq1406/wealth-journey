"use client";

import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import Image from "next/image";

import { LOCAL_STORAGE_TOKEN_NAME, routes } from "@/app/constants";
import { store } from "@/features/auth/store/store";
import { setAuth } from "@/features/auth/store/actions";
import { Link, useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutationLogin } from "@/utils/generated/hooks";
import { mapGoogleLoginError } from "@/features/auth/utils/error-mapper";
import { updateAuthTokenCache } from "@/utils/api-client";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { LoginPasswordForm } from "@/features/auth/forms/LoginPasswordForm";

export default function Login() {
  const router = useRouter();
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const login = useMutationLogin({
    onError(error) {
      console.error("Login error:", error);
      const i18nKey = mapGoogleLoginError(error.code);
      setError(i18nKey ? t(i18nKey) : t("genericError"));
      setIsLoading(false);
    },
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
          }),
        );
        router.push(routes.home);
      }
    },
  });

  useEffect(() => {
    const token = localStorage.getItem(LOCAL_STORAGE_TOKEN_NAME);
    if (token) {
      router.push(routes.home);
    }
  }, [router]);

  const handleGoogleLogin = async (credentialResponse: any) => {
    setIsLoading(true);
    setError("");
    await login.mutateAsync({
      token: credentialResponse.credential,
    });
  };

  const handleGoogleLoginError = () => {
    setError(t("googleLoginFailed"));
    setIsLoading(false);
  };

  return (
 <div className="min-h-screen bg-v2-bg-primary flex flex-col">
      {/* Header with Logo — mobile only */}
      <div className="pt-6 pb-4 px-4 sm:hidden">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="congdongvang.com"
            width={48}
            height={48}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-[10px]"
          />
          <span className="text-xl sm:text-2xl font-bold text-v2-text-secondary">
            congdongvang.com
          </span>
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-md">
          {/* Welcome Card */}
          <div className="bg-v2-bg-surface border border-v2-border-light border-t-2 border-t-v2-gold-primary rounded-2xl sm:rounded-3xl shadow-lg p-6 sm:p-8 md:p-10 animate-fade-in-up">
            {/* Title */}
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-v2-gold-accent mb-2">
                {t("title")}
              </h1>
              <p className="text-sm sm:text-base text-v2-text-secondary">
                {t("subtitle")}
              </p>
            </div>

            {/* Password Login Form */}
            <LoginPasswordForm />

            {/* OR Divider */}
            <div className="my-5 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-v2-border-light"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-v2-bg-surface text-v2-text-tertiary">
                  {t("orDivider")}
                </span>
              </div>
            </div>

            {/* Google Login Button */}
            <div className={isLoading ? "opacity-50 pointer-events-none" : ""}>
              <GoogleOAuthProvider
                clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}
              >
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleLogin}
                    onError={handleGoogleLoginError}
                    width="100%"
                    theme="filled_blue"
                    size="large"
                    text="continue_with"
                    shape="rectangular"
                    logo_alignment="left"
                  />
                </div>
              </GoogleOAuthProvider>
            </div>

            {/* Loading Spinner */}
            {isLoading && (
              <div className="mt-6 flex justify-center">
                <LoadingSpinner text={t("signingIn")} />
              </div>
            )}

            {/* Error Message (Google OAuth) */}
            {error && (
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-v2-bg-dark border border-v2-red-negative/30 rounded-xl animate-fade-in">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-v2-red-negative flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-sm text-v2-red-negative">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="mt-6 sm:mt-8 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-v2-border-light"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-v2-bg-surface text-v2-text-tertiary">
                  {t("newToApp")}
                </span>
              </div>
            </div>

            {/* Sign Up Link */}
            <div className="mt-6 text-center">
              <Link
                href={routes.register}
                className="inline-flex items-center gap-2 text-v2-gold-primary hover:text-v2-text-secondary font-medium transition-colors touch-target-lg rounded-lg"
              >
                {t("createAccount")}
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
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
            </div>
          </div>

          {/* Footer Text */}
          <p className="mt-6 sm:mt-8 text-xs sm:text-sm text-v2-text-tertiary text-center">
            {t("termsAgreement")}{" "}
            <Link
              href="/legal/terms"
              className="underline hover:text-v2-text-secondary transition-colors"
            >
              {t("termsOfService")}
            </Link>{" "}
            {tCommon("and")}{" "}
            <Link
              href="/legal/privacy"
              className="underline hover:text-v2-text-secondary transition-colors"
            >
              {t("privacyPolicy")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
