"use client";

import { useTranslations } from "next-intl";
import { CurrencyConversion } from "@/gen/protobuf/v1/import";
import { formatCurrency, formatExchangeRate } from "@/utils/currency-formatter";
import { Button } from "@/components/Button";

export interface CurrencyConversionSectionProps {
  conversions: CurrencyConversion[];
  onChangeRate: (fromCurrency: string, toCurrency: string) => void;
}

/**
 * Displays currency conversion summary for imported transactions
 * Shows conversion rates, sources, transaction counts, and totals
 */
export function CurrencyConversionSection({
  conversions,
  onChangeRate,
}: CurrencyConversionSectionProps) {
  const t = useTranslations("currencyConversion.section");

  if (!conversions || conversions.length === 0) {
    return null;
  }

  const totalTransactionCount = conversions.reduce(
    (sum, conv) => sum + conv.transactionCount,
    0
  );

  const formatDate = (timestamp: number): string => {
    if (!timestamp || timestamp === 0) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(timestamp * 1000));
  };

  const getRateSourceLabel = (source: string): string => {
    switch (source) {
      case "auto":
        return t("sourceAuto");
      case "manual":
        return t("sourceManual");
      case "fallback":
        return t("sourceFallback");
      default:
        return source;
    }
  };

  const getRateSourceColor = (source: string): string => {
    switch (source) {
      case "auto":
 return "text-success-600";
      case "manual":
 return "text-primary-600";
      case "fallback":
 return "text-warning-600";
      default:
 return "text-v2-text-secondary";
    }
  };

  return (
 <div className="border border-v2-border-light rounded-lg p-4 bg-v2-bg-surface">
      <div className="flex items-center justify-between mb-4">
 <h3 className="flex items-center gap-2 text-lg font-semibold text-v2-gold-accent">
          <span className="text-2xl">💱</span>
          {totalTransactionCount !== 1
            ? t("titlePlural", { count: totalTransactionCount })
            : t("title", { count: totalTransactionCount })}
        </h3>
      </div>

      <div className="space-y-4">
        {conversions.map((conversion) => (
          <div
            key={`${conversion.fromCurrency}-${conversion.toCurrency}`}
 className="border border-v2-border-light rounded-lg p-4 bg-v2-bg-dark"
          >
            <div className="space-y-3">
              {/* Conversion Header */}
              <div className="flex items-start justify-between">
                <div>
 <div className="text-base font-semibold text-v2-gold-accent">
                    {conversion.fromCurrency} → {conversion.toCurrency}
                  </div>
 <div className="text-sm text-v2-text-secondary mt-1">
                    Rate: 1 {conversion.fromCurrency} ={" "}
                    {formatExchangeRate(conversion.exchangeRate, conversion.toCurrency)}{" "}
                    {conversion.toCurrency}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    onChangeRate(
                      conversion.fromCurrency,
                      conversion.toCurrency
                    )
                  }
                >
                  {t("changeRate")}
                </Button>
              </div>

              {/* Conversion Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
 <span className="text-v2-text-secondary">
                    {t("source")}{" "}
                  </span>
                  <span
                    className={`font-medium ${getRateSourceColor(
                      conversion.rateSource
                    )}`}
                  >
                    {getRateSourceLabel(conversion.rateSource)}
                  </span>
                </div>
                <div>
 <span className="text-v2-text-secondary">
                    {t("date")}{" "}
                  </span>
 <span className="font-medium text-v2-gold-accent">
                    {formatDate(conversion.rateDate)}
                  </span>
                </div>
                <div>
 <span className="text-v2-text-secondary">
                    {t("transactions")}{" "}
                  </span>
 <span className="font-medium text-v2-gold-accent">
                    {conversion.transactionCount}
                  </span>
                </div>
              </div>

              {/* Conversion Totals */}
 <div className="pt-3 border-t border-v2-border-light">
                <div className="flex items-center justify-between text-sm">
 <span className="text-v2-text-secondary">
                    {t("total")}
                  </span>
 <div className="font-semibold text-v2-gold-accent">
                    {conversion.totalOriginal &&
                      formatCurrency(
                        conversion.totalOriginal.amount,
                        conversion.totalOriginal.currency
                      )}{" "}
                    →{" "}
                    {conversion.totalConverted &&
                      formatCurrency(
                        conversion.totalConverted.amount,
                        conversion.totalConverted.currency
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Note */}
 <div className="mt-4 p-3 bg-v2-bg-dark border border-blue-400/30 rounded-lg">
 <p className="text-sm text-blue-400">
          <strong>Note:</strong> {t("note")}
        </p>
      </div>
    </div>
  );
}
