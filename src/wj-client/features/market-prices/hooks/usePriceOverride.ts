"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EVENT_InvestmentGetMarketPrices } from "@/utils/generated/hooks";
import { apiClient } from "@/utils/api-client";

const OVERRIDE_URL = "/api/v1/admin/price-overrides";

export interface SetPriceOverrideParams {
  category: string;
  typeCode: string;
  currency: string;
  buy: number;
  sell: number;
  name: string;
}

export interface DeletePriceOverrideParams {
  category: string;
  typeCode: string;
  currency: string;
}

export function usePriceOverrideSet(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SetPriceOverrideParams) => {
      return apiClient.post(OVERRIDE_URL, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENT_InvestmentGetMarketPrices] });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}

export function usePriceOverrideDelete(options?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: DeletePriceOverrideParams) => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${baseUrl}${OVERRIDE_URL}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to delete price override" }));
        throw new Error(err.message || "Failed to delete price override");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENT_InvestmentGetMarketPrices] });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}
