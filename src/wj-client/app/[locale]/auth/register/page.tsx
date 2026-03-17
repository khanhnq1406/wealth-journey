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
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const register = useMutationRegister({
    onError(error) {
      console.error("Registration error:", error);
      setError(error.message || t("registrationFailed"));
      setIsLoading(false);
    },
    onSuccess(data) {
      if (data.data) {
        const { accessToken, email, fullname, picture, username } = data.data;

        localStorage.setItem(LOCAL_STORAGE_TOKEN_NAME, accessToken);
        updateAuthTokenCache(accessToken);

        store.dispatch(
          setAuth({
            isAuthenticated: true,
            email: email,
            fullname: fullname,
            picture: picture,
            username: username,
            isAdmin: false,
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
            {/* Title — compact when password form is open */}
            <div className={`text-center ${showPasswordForm ? "mb-4 sm:mb-6" : "mb-6 sm:mb-8"}`}>
              <h1 className={`${showPasswordForm ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"} font-bold text-neutral-900 dark:text-dark-text mb-1`}>
                {t("title")}
              </h1>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-dark-text-secondary">
                {t("subtitle")}
              </p>
            </div>

            {/* Google Register Button (Primary) — hidden when password form is open */}
            {!showPasswordForm && (
              <>
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
              </>
            )}

            {/* Expandable Password Form */}
            {!showPasswordForm ? (
              <button
                type="button"
                onClick={() => setShowPasswordForm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-neutral-300 dark:border-dark-border rounded-xl text-sm font-medium text-neutral-700 dark:text-dark-text-secondary hover:bg-neutral-50 dark:hover:bg-dark-border/30 transition-colors"
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                {t("createWithPassword")}
              </button>
            ) : (
              <div className="animate-fade-in">
                <RegisterPasswordForm />
                {/* Back to Google option */}
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(false)}
                  className="w-full mt-3 flex items-center justify-center gap-2 text-sm text-neutral-500 dark:text-dark-text-tertiary hover:text-neutral-700 dark:hover:text-dark-text-secondary transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                  </svg>
                  {t("useGoogleInstead")}
                </button>
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
