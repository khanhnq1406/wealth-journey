import { PublicMarketTypesResponse } from "@/features/market-prices/hooks/usePublicMarketTypes";
import { LandingContent } from "./LandingContent";

async function fetchMarketTypes(): Promise<PublicMarketTypesResponse | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "";
    if (!apiUrl) return null;
    const res = await fetch(`${apiUrl}/api/v1/public/market-types`, {
      next: { revalidate: 300 }, // 5-minute ISR
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function LandingPage() {
  const data = await fetchMarketTypes();
  return <LandingContent initialData={data} />;
}
