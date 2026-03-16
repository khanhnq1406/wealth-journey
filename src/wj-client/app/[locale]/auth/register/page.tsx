"use client";

import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import Image from "next/image";

import { LOCAL_STORAGE_TOKEN_NAME, routes } from "@/app/constants";
import { store } from "@/features/auth/store/store";
import { setAuth } from "@/features/auth/store/actions";
import { Link, useRouter } from "@/lib/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutationRegister } from "@/utils/generated/hooks";
import { updateAuthTokenCache } from "@/utils/api-client";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { RegisterPasswordForm } from "@/features/auth/forms/RegisterPasswordForm";

export default function Register() {
  const router = useRouter();
  const t = useTranslations("auth.register");
  const tCommon = useTranslations("common");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const register = useMutationRegister({
    onError(error) {
      console.error("Registration error:", error);
      setError(error.message || t("registrationFailed"));
      setIsLoading(false);
    },
    onSuccess(data) {
      if (data.data) {
        const { accessToken, email, fullname, picture } = data.data;

        localStorage.setItem(LOCAL_STORAGE_TOKEN_NAME, accessToken);
        updateAuthTokenCache(accessToken);

        store.dispatch(
          setAuth({
            isAuthenticated: true,
            email: email,
            fullname: fullname,
            picture: picture,
          }),
        );

        router.push(routes.home);
      }
    },
  });

  const handleGoogleRegister = async (credentialResponse: any) => {
    setIsLoading(true);
    setError("");
    await register.mutateAsync({
      token: credentialResponse.credential,
    });
  };

  const handleGoogleRegisterError = () => {
    setError(t("googleRegisterFailed"));
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-50 via-white to-primary-50 dark:from-dark-background dark:via-dark-surface dark:to-dark-background flex flex-col">
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
          <span className="text-xl sm:text-2xl font-bold text-v2-red-primary dark:text-dark-text">
            congdongvang.com
          </span>
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-md">
          {/* Registration Card */}
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

            {/* Feature Highlights */}
            <div className="mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600 dark:text-dark-text-secondary">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-accent-600 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{t("freeForever")}</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600 dark:text-dark-text-secondary">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-accent-600 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{t("bankLevelSecurity")}</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600 dark:text-dark-text-secondary">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-accent-600 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{t("noCreditCard")}</span>
              </div>
            </div>

            {/* Password Register Form */}
            <RegisterPasswordForm />

            {/* OR Divider */}
            <div className="my-5 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200 dark:border-dark-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-dark-surface text-neutral-500 dark:text-dark-text-tertiary">
                  {t("orDivider")}
                </span>
              </div>
            </div>

            {/* Google Register Button */}
            <div className={isLoading ? "opacity-50 pointer-events-none" : ""}>
              <GoogleOAuthProvider
                clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}
              >
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleRegister}
                    onError={handleGoogleRegisterError}
                    width="100%"
                    theme="filled_blue"
                    size="large"
                    text="signup_with"
                    shape="rectangular"
                    logo_alignment="left"
                  />
                </div>
              </GoogleOAuthProvider>
            </div>

            {/* Loading Spinner */}
            {isLoading && (
              <div className="mt-6 flex justify-center">
                <LoadingSpinner text={t("creatingAccount")} />
              </div>
            )}

            {/* Error Message (Google OAuth) */}
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
                  {t("alreadyHaveAccount")}
                </span>
              </div>
            </div>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <Link
                href={routes.login}
                className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors touch-target-lg rounded-lg"
              >
                {t("signInInstead")}
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
