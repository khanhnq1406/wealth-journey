"use client";

import { useEffect, useState, useCallback } from "react";
import { LOCAL_STORAGE_TOKEN_NAME, routes } from "@/app/constants";
import { useRouter } from "next/navigation";
import { store } from "@/features/auth/store/store";
import { setAuth } from "@/features/auth/store/actions";
import { useQueryVerifyAuth } from "@/utils/generated/hooks";
import { FullPageLoading } from "@/components/loading/FullPageLoading";

export const AuthCheck = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
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
      setShouldFetch(true);
    } else {
      router.push(routes.login);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_NAME);
    if (storedToken && authResponse?.data) {
      setToken(storedToken);
      store.dispatch(
        setAuth({
          isAuthenticated: true,
          email: authResponse.data.email,
          fullname: authResponse.data.name,
          picture: authResponse.data.picture,
          preferredCurrency: authResponse.data.preferredCurrency || "VND",
        })
      );
    }
  }, [authResponse]);
  if (token === null) {
    return <FullPageLoading />;
  }

  return <>{children}</>;
};
