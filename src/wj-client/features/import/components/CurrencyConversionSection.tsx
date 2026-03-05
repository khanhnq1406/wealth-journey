"use client";

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
        return "Automatic";
      case "manual":
        return "Manual Override";
      case "fallback":
        return "Fallback Rate";
      default:
        return source;
    }
  };

  const getRateSourceColor = (source: string): string => {
    switch (source) {
      case "auto":
        return "text-success-600 dark:text-success-400";
      case "manual":
        return "text-primary-600 dark:text-primary-400";
      case "fallback":
        return "text-warning-600 dark:text-warning-400";
      default:
        return "text-neutral-600 dark:text-neutral-400";
    }
  };

  return (
    <div className="border border-neutral-200 dark:border-dark-border rounded-lg p-4 bg-white dark:bg-dark-surface">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-dark-text">
          <span className="text-2xl">💱</span>
          Currency Conversions ({totalTransactionCount} transaction
          {totalTransactionCount !== 1 ? "s" : ""})
        </h3>
      </div>

      <div className="space-y-4">
        {conversions.map((conversion) => (
          <div
            key={`${conversion.fromCurrency}-${conversion.toCurrency}`}
            className="border border-neutral-200 dark:border-dark-border rounded-lg p-4 bg-neutral-50 dark:bg-dark-surface-hover"
          >
            <div className="space-y-3">
              {/* Conversion Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold text-neutral-900 dark:text-dark-text">
                    {conversion.fromCurrency} → {conversion.toCurrency}
                  </div>
                  <div className="text-sm text-neutral-600 dark:text-dark-text-secondary mt-1">
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
                  Change Rate
                </Button>
              </div>

              {/* Conversion Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-neutral-600 dark:text-dark-text-secondary">
                    Source:{" "}
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
                  <span className="text-neutral-600 dark:text-dark-text-secondary">
                    Date:{" "}
                  </span>
                  <span className="font-medium text-neutral-900 dark:text-dark-text">
                    {formatDate(conversion.rateDate)}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-600 dark:text-dark-text-secondary">
                    Transactions:{" "}
                  </span>
                  <span className="font-medium text-neutral-900 dark:text-dark-text">
                    {conversion.transactionCount}
                  </span>
                </div>
              </div>

              {/* Conversion Totals */}
              <div className="pt-3 border-t border-neutral-200 dark:border-dark-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600 dark:text-dark-text-secondary">
                    Total:
                  </span>
                  <div className="font-semibold text-neutral-900 dark:text-dark-text">
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
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Note:</strong> Currency conversions are applied to all
          transactions in foreign currencies. You can manually override the
          exchange rate if needed.
        </p>
      </div>
    </div>
  );
}
