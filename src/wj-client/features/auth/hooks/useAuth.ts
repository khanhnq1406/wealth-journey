/**
 * React Hook for Authentication
 * Provides authentication state and operations using generated hooks
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useMutationLogin,
  useMutationRegister,
  useMutationLogout,
  useMutationVerifyAuth,
} from "@/utils/generated/hooks";
import { LOCAL_STORAGE_TOKEN_NAME } from "@/app/constants";
import { updateAuthTokenCache } from "@/utils/api-client";
import type { User } from "@/gen/protobuf/v1/auth";

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: (token: string) => Promise<boolean>;
  register: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

// Helper functions for token management
const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LOCAL_STORAGE_TOKEN_NAME);
};

const setStoredToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_STORAGE_TOKEN_NAME, token);
};

const clearStoredToken = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOCAL_STORAGE_TOKEN_NAME);
};

// Helper to extract user and token from response
const extractAuthFromResponse = (
  response: any
): { user: User | null; token: string | null } => {
  // Adjust based on your actual API response structure
  const token = response?.accessToken || response?.token || getStoredToken();
  const user = response?.user || response?.userId ? response : null;
  return { user, token };
};

export function useAuth(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: getStoredToken(),
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  // Verify auth mutation
  const verifyAuth = useMutationVerifyAuth({
    onSuccess: (data) => {
      const { user, token } = extractAuthFromResponse(data.data);
      setState((prev) => ({
        ...prev,
        user,
        token,
        isLoading: false,
        isAuthenticated: !!user,
        error: null,
      }));
    },
    onError: (error) => {
      clearStoredToken();
      setState((prev) => ({
        ...prev,
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
        error: error.message,
      }));
    },
  });

  // Login mutation
  const loginMutation = useMutationLogin({
    onSuccess: (data) => {
      const { user, token } = extractAuthFromResponse(data.data);
      if (token) {
        setStoredToken(token);
        updateAuthTokenCache(token);
      }
      setState({
        user,
        token,
        isLoading: false,
        isAuthenticated: !!user,
        error: null,
      });
    },
    onError: (error) => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message,
        isAuthenticated: false,
      }));
    },
  });

  // Register mutation
  const registerMutation = useMutationRegister({
    onSuccess: (data) => {
      const { user, token } = extractAuthFromResponse(data.data);
      if (token) {
        setStoredToken(token);
        updateAuthTokenCache(token);
      }
      setState({
        user,
        token,
        isLoading: false,
        isAuthenticated: !!user,
        error: null,
      });
    },
    onError: (error) => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message,
        isAuthenticated: false,
      }));
    },
  });

  // Logout mutation
  const logoutMutation = useMutationLogout({
    onSuccess: () => {
      clearStoredToken();
      updateAuthTokenCache(null);
      setState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    },
    onError: () => {
      // Clear local state even if logout fails on server
      clearStoredToken();
      updateAuthTokenCache(null);
      setState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    },
  });

  /**
   * Initialize auth state from stored token
   */
  useEffect(() => {
    const initAuth = async () => {
      const token = getStoredToken();

      if (token) {
        try {
          await verifyAuth.mutateAsync({ token });
        } catch {
          clearStoredToken();
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isAuthenticated: false,
          }));
        }
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
        }));
      }
    };

    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Login with email and password (placeholder - adjust based on API)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const login = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({
      ...prev,
      error: "Email/password login not implemented. Use Google OAuth.",
    }));
    return false;
  }, []);

  /**
   * Login with Google token
   */
  const loginWithGoogle = useCallback(
    async (token: string): Promise<boolean> => {
      try {
        await loginMutation.mutateAsync({ token });
        return true;
      } catch {
        return false;
      }
    },
    [loginMutation]
  );

  /**
   * Register new user with Google token
   */
  const register = useCallback(
    async (token: string): Promise<boolean> => {
      try {
        await registerMutation.mutateAsync({ token });
        return true;
      } catch {
        return false;
      }
    },
    [registerMutation]
  );

  /**
   * Logout current user
   */
  const logout = useCallback(async (): Promise<void> => {
    const token = getStoredToken();
    if (token) {
      await logoutMutation.mutateAsync({ token });
    } else {
      clearStoredToken();
      setState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    }
  }, [logoutMutation]);

  /**
   * Refresh current user data
   */
  const refreshUser = useCallback(async (): Promise<void> => {
    const token = getStoredToken();
    if (!token) {
      return;
    }

    try {
      await verifyAuth.mutateAsync({ token });
    } catch {
      clearStoredToken();
      setState((prev) => ({
        ...prev,
        user: null,
        token: null,
        isAuthenticated: false,
      }));
    }
  }, [verifyAuth]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    isLoading:
      state.isLoading ||
      loginMutation.isPending ||
      registerMutation.isPending ||
      logoutMutation.isPending ||
      verifyAuth.isPending,
    error:
      loginMutation.error?.message ||
      registerMutation.error?.message ||
      logoutMutation.error?.message ||
      verifyAuth.error?.message ||
      state.error,
    login,
    loginWithGoogle,
    register,
    logout,
    refreshUser,
    clearError,
  };
}
