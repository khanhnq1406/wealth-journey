"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useSelector, useDispatch } from "react-redux";
import { setAuth } from "@/features/auth/store/actions";
import {
  useMutationUpdatePreferences,
  useQueryGetAuth,
  EVENT_AuthGetAuth,
} from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";

interface CurrencyContextType {
  currency: string;
  isConverting: boolean;
  updateCurrency: (newCurrency: string) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined,
);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const auth = useSelector((state: any) => state.setAuthReducer);
  const [isConverting, setIsConverting] = useState(false);

  // Use selector with equality check to ensure re-renders on currency change
  const currency = useSelector((state: any) => state.setAuthReducer?.preferredCurrency || "VND");

  // Poll user data to check conversion progress
  // Fetch on mount to check initial conversion state, then poll if converting
  const { data: userData, refetch: refetchUserData } = useQueryGetAuth(
    { email: auth?.email || "" },
    {
      enabled: !!auth?.email,
      refetchInterval: isConverting ? 2000 : false, // Poll every 2 seconds during conversion
      refetchOnMount: "always",
    },
  );

  // Update isConverting state based on backend data
  useEffect(() => {
    if (userData?.data?.conversionInProgress !== undefined) {
      const backendIsConverting = userData.data.conversionInProgress;

      // Sync local state with backend state
      if (backendIsConverting && !isConverting) {
        // Backend says conversion is in progress, update local state
        setIsConverting(true);
      } else if (!backendIsConverting && isConverting) {
        // Backend says conversion is done, update local state
        setIsConverting(false);
        // Invalidate all queries to refetch with new converted values
        queryClient.invalidateQueries();

        // Update Redux auth state with latest data
        if (userData.data) {
          dispatch(
            setAuth({
              isAuthenticated: true,
              email: userData.data.email,
              fullname: userData.data.name,
              picture: userData.data.picture,
              preferredCurrency: userData.data.preferredCurrency,
            }) as any,
          );
        }
      }
    }
  }, [userData, isConverting, queryClient, dispatch]);

  const updatePreferencesMutation = useMutationUpdatePreferences({
    onSuccess: (data) => {
      // Update Redux auth state with new currency immediately
      if (data.data) {
        const newAuthState = {
          isAuthenticated: true,
          email: auth?.email || "",
          fullname: auth?.fullname || "",
          picture: auth?.picture || "",
          preferredCurrency: data.data.preferredCurrency,
        };

        dispatch(setAuth(newAuthState) as any);

        // Set converting flag if backend indicates conversion started
        if (data.data.conversionInProgress) {
          setIsConverting(true);
        }
      }

      // Note: Don't invalidate queries yet - wait for conversion to complete
      // The polling mechanism will invalidate once conversion is done
    },
  });

  const updateCurrency = useCallback(
    async (newCurrency: string) => {
      if (newCurrency === currency) {
        return; // No change needed
      }

      // Start conversion process
      await updatePreferencesMutation.mutateAsync({
        preferences: {
          preferredCurrency: newCurrency,
          language: "",
        },
      });
    },
    [currency, updatePreferencesMutation],
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        isConverting,
        updateCurrency,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
