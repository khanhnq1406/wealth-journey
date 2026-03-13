"use client";

import { useQuery } from "@tanstack/react-query";

export interface MarketTypeItem {
  code: string;
  name: string;
  currency: string;
}

export interface PublicMarketTypesResponse {
  success: boolean;
  message: string;
  gold: MarketTypeItem[];
  silver: MarketTypeItem[];
  currency: MarketTypeItem[];
  goldUpdatedAt: number;
  silverUpdatedAt: number;
  currencyUpdatedAt: number;
  timestamp: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchPublicMarketTypes(): Promise<PublicMarketTypesResponse> {
  const res = await fetch(`${API_BASE}/api/v1/public/market-types`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    // No Authorization header — public endpoint
  });

  if (!res.ok) {
    throw new Error("Failed to fetch market types");
  }

  return res.json();
}

export function usePublicMarketTypes() {
  return useQuery<PublicMarketTypesResponse>({
    queryKey: ["public-market-types"],
    queryFn: fetchPublicMarketTypes,
    staleTime: 30 * 60 * 1000, // 30 minutes — types rarely change
    refetchOnWindowFocus: false,
  });
}
