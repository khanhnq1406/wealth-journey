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
import { updateAuthTokenCache } from "@/utils/api-client";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";

export default function Login() {
  const router = useRouter();
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const login = useMutationLogin({
    onError(error) {
      console.error("Login error:", error);
      setError(error.message || t("genericError"));
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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-dark-background dark:via-dark-surface dark:to-dark-background flex flex-col">
      {/* Header with Logo */}
      <div className="pt-6 pb-4 px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="congdongvang.com"
            width={48}
            height={48}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-[10px]"
          />
          <span className="text-xl sm:text-2xl font-bold dark:text-dark-text text-v2-red-primary">
            congdongvang.com
          </span>
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-md">
          {/* Welcome Card */}
          <div className="bg-white dark:bg-dark-surface rounded-2xl sm:rounded-3xl shadow-card sm:shadow-lg p-6 sm:p-8 md:p-10 animate-fade-in-up">
            {/* Title */}
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-dark-text mb-2">
                {t("title")}
              </h1>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-dark-text-secondary">
                {t("subtitle")}
              </p>
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

            {/* Error Message */}
            {error && (
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl animate-fade-in">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-sm text-danger-800 dark:text-danger-200">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="mt-6 sm:mt-8 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200 dark:border-dark-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-dark-surface text-neutral-500 dark:text-dark-text-tertiary">
                  {t("newToApp")}
                </span>
              </div>
            </div>

            {/* Sign Up Link */}
            <div className="mt-6 text-center">
              <Link
                href={routes.register}
                className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors touch-target-lg rounded-lg"
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
          <p className="mt-6 sm:mt-8 text-xs sm:text-sm text-neutral-500 dark:text-dark-text-tertiary text-center">
            {t("termsAgreement")}{" "}
            <Link
              href="#terms"
              className="underline hover:text-neutral-700 dark:hover:text-dark-text-secondary transition-colors"
            >
              {t("termsOfService")}
            </Link>{" "}
            {tCommon("and")}{" "}
            <Link
              href="#privacy"
              className="underline hover:text-neutral-700 dark:hover:text-dark-text-secondary transition-colors"
            >
              {t("privacyPolicy")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
