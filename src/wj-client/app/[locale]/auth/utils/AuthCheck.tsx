"use client";

import { useEffect, useState, useCallback } from "react";
import { LOCAL_STORAGE_TOKEN_NAME, routes } from "@/app/constants";
import { useRouter, usePathname } from "@/lib/navigation";
import { useLocale } from "next-intl";
import { locales } from "@/i18n/request";
import { store } from "@/features/auth/store/store";
import { setAuth } from "@/features/auth/store/actions";
import { useQueryVerifyAuth } from "@/utils/generated/hooks";
import { FullPageLoading } from "@/components/loading/FullPageLoading";

export const AuthCheck = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();
  const [token, setToken] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(false);

  const handleError = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_TOKEN_NAME);
    router.push(routes.login);
  }, [router]);

  const storedToken =
    typeof window !== "undefined"
      ? localStorage.getItem(LOCAL_STORAGE_TOKEN_NAME)
      : null;

  // Verify authentication using the token
  const { data: authResponse, error: authError } = useQueryVerifyAuth(
    { token: storedToken || "" },
    {
      enabled: shouldFetch && !!storedToken,
    }
  );

  useEffect(() => {
    if (authError) {
      handleError();
    }
  }, [authError, handleError]);

  useEffect(() => {
    const storedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_NAME);

    if (storedToken) {
      queueMicrotask(() => setShouldFetch(true));
    } else {
      router.push(routes.login);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_NAME);
    if (storedToken && authResponse?.data) {
      queueMicrotask(() => setToken(storedToken));
      const lang = authResponse.data.preferredLanguage || "vi";
      store.dispatch(
        setAuth({
          isAuthenticated: true,
          email: authResponse.data.email,
          fullname: authResponse.data.name,
          picture: authResponse.data.picture,
          username: authResponse.data.username,
          preferredCurrency: authResponse.data.preferredCurrency || "VND",
          preferredLanguage: lang,
        })
      );

      // Set locale cookie (used by middleware on next navigation)
      document.cookie = `wj-locale=${lang}; path=/; SameSite=Lax; Secure; max-age=31536000`;

      // If current URL locale differs from user preference, redirect
      const userLocale = (locales as readonly string[]).includes(lang) ? lang : 'vi';
      if (currentLocale !== userLocale) {
        router.replace(pathname, { locale: userLocale });
      }
    }
  }, [authResponse, router]);
  if (token === null) {
    return <FullPageLoading />;
  }

  return <>{children}</>;
};
