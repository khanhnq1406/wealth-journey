"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQueryGetAssetDisplayPrices } from "@/utils/generated/hooks";
import { formatUpdateTimestamp } from "@/features/market-prices/utils/format-update-time";

export function LandingCurrencyPriceTable() {
  const t = useTranslations("landing.priceTeaser");
  const { data, isLoading } = useQueryGetAssetDisplayPrices({ assetType: "currency" });

  const prices = data?.prices ?? [];

  const updatedTime = (() => {
    const entry = prices.find((p) => p.updatedAt && p.updatedAt > 0);
    return entry?.updatedAt ? formatUpdateTimestamp(entry.updatedAt) : undefined;
  })();

  if (isLoading && prices.length === 0) {
    return (
      <div className="rounded-lg border-2 border-v2-currency-primary/30 overflow-hidden shadow-v2-card">
        <div className="bg-gradient-to-r from-v2-currency-primary via-v2-currency-accent to-v2-currency-primary px-5 py-3">
          <h3 className="font-roboto font-bold text-[16px] text-v2-maroon-900">
            {t("currencyTableTitle")}
          </h3>
        </div>
        <div className="bg-v2-cream-200 px-5 py-8 text-center font-roboto text-[13px] text-v2-maroon-800 animate-pulse">
          {t("loadingTypes")}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-v2-currency-primary/30 overflow-hidden shadow-v2-card">
      {/* Currency gradient header bar */}
      <div className="bg-gradient-to-r from-v2-currency-primary via-v2-currency-accent to-v2-currency-primary px-5 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-roboto font-bold text-[16px] text-white">
            {t("currencyTableTitle")}
          </h3>
          {updatedTime && (
            <span className="font-roboto text-[11px] text-white/70">
              {t("updatedTime", { time: updatedTime })}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-b-lg">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-v2-currency-accent/30">
              <th className="text-left px-5 py-3.5 font-roboto font-bold text-[14px] tracking-normal text-v2-maroon-900 border-r border-v2-currency-primary/20">
                {t("currencyType")}
              </th>
              <th className="text-right px-5 py-3.5 font-roboto font-black text-[15px] uppercase tracking-[1px] text-v2-maroon-900 border-r border-v2-currency-primary/20">
                {t("buy")}
              </th>
              <th className="text-right px-5 py-3.5 font-roboto font-black text-[15px] uppercase tracking-[1px] text-v2-maroon-900">
                {t("sell")}
              </th>
            </tr>
          </thead>
          <tbody>
            {prices.map((item, index) => (
              <tr
                key={item.typeCode}
                className={`border-b border-v2-currency-primary/10 ${index % 2 === 0 ? "bg-v2-cream-200" : "bg-v2-cream-300"}`}
              >
                <td className="px-5 py-3.5 font-roboto font-bold text-[14px] text-v2-maroon-900 border-r border-v2-currency-primary/10">
                  {item.displayName}
                </td>
                <td className="px-5 py-3.5 text-right font-roboto font-bold text-[14px] text-green-700 border-r border-v2-currency-primary/10">
                  {t.rich("loginPrompt", {
                    loginLink: (chunks) => (
                      <Link
                        href="/auth/login"
                        className="font-semibold text-v2-red-primary underline sm:no-underline sm:hover:underline"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </td>
                <td className="px-5 py-3.5 text-right font-roboto font-bold text-[14px] text-green-700">
                  {t.rich("loginPrompt", {
                    loginLink: (chunks) => (
                      <Link
                        href="/auth/login"
                        className="font-semibold text-v2-red-primary underline sm:no-underline sm:hover:underline"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </td>
              </tr>
            ))}
            {prices.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-5 py-8 text-center font-roboto text-[13px] text-v2-maroon-800 bg-v2-cream-200"
                >
                  {t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
