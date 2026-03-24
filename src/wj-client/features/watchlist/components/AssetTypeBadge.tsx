"use client";

import { InvestmentType } from "@/gen/protobuf/v1/investment";
import { getAssetTypeLabel } from "@/features/watchlist/utils/watchlist-helpers";

interface AssetTypeBadgeProps {
  assetType: number;
}

function getBadgeClasses(assetType: number): string {
  switch (assetType) {
    case InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY:
      return "bg-orange-100 text-orange-700";
    case InvestmentType.INVESTMENT_TYPE_STOCK:
      return "bg-blue-100 text-blue-700";
    case InvestmentType.INVESTMENT_TYPE_ETF:
      return "bg-purple-100 text-purple-700";
    case InvestmentType.INVESTMENT_TYPE_GOLD_VND:
    case InvestmentType.INVESTMENT_TYPE_GOLD_USD:
      return "bg-yellow-100 text-yellow-700";
    case InvestmentType.INVESTMENT_TYPE_SILVER_VND:
    case InvestmentType.INVESTMENT_TYPE_SILVER_USD:
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-500";
  }
}

export function AssetTypeBadge({ assetType }: AssetTypeBadgeProps) {
  const label = getAssetTypeLabel(assetType);
  const colorClasses = getBadgeClasses(assetType);

  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClasses}`}
    >
      {label}
    </span>
  );
}
