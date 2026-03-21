"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { BaseModal } from "@/components/modals/BaseModal";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { Button } from "@/components/Button";
import { FormInput } from "@/components/forms/FormInput";
import { CurrencyConversion } from "@/gen/protobuf/v1/import";
import { formatCurrency, formatExchangeRate } from "@/utils/currency-formatter";
import { ButtonType } from "@/app/constants";
import { useDebounce } from "@/hooks/useDebounce";

export interface ChangeRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversion: CurrencyConversion;
  onConfirm: (newRate: number) => void;
}

/**
 * Modal for manually overriding currency exchange rates
 * Shows real-time preview and warns about large differences
 */
export function ChangeRateModal({
  isOpen,
  onClose,
  conversion,
  onConfirm,
}: ChangeRateModalProps) {
  const t = useTranslations("changeRate.modal");

  const [rateInput, setRateInput] = useState(
    conversion.exchangeRate.toString()
  );
  const [error, setError] = useState<string>();
  const [showWarning, setShowWarning] = useState(false);

  // Debounce rate input to prevent excessive re-calculations on every keystroke
  const debouncedRateInput = useDebounce(rateInput, 300);

  // Calculate percentage difference from auto rate
  const rateDifference = useMemo(() => {
    const newRate = parseFloat(debouncedRateInput);
    if (isNaN(newRate) || newRate <= 0) return null;

    const autoRate = conversion.exchangeRate;
    const diff = ((newRate - autoRate) / autoRate) * 100;
    return diff;
  }, [debouncedRateInput, conversion.exchangeRate]);

  // Calculate preview of converted total
  const previewTotal = useMemo(() => {
    const newRate = parseFloat(debouncedRateInput);
    if (
      isNaN(newRate) ||
      newRate <= 0 ||
      !conversion.totalOriginal?.amount
    ) {
      return null;
    }

    // Calculate new converted amount
    // Original amount is in smallest currency unit
    const originalAmount = conversion.totalOriginal.amount;
    const newConvertedAmount = Math.round(originalAmount * newRate);

    return {
      amount: newConvertedAmount,
      currency: conversion.toCurrency,
    };
  }, [debouncedRateInput, conversion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    const newRate = parseFloat(rateInput);

    // Validation
    if (isNaN(newRate) || newRate <= 0) {
      setError(t("invalidRate"));
      return;
    }

    if (newRate === conversion.exchangeRate) {
      setError(t("sameRate"));
      return;
    }

    // Warning for large differences (>10%)
    if (rateDifference && Math.abs(rateDifference) > 10) {
      setShowWarning(true);
      return;
    }

    // Apply rate change
    onConfirm(newRate);
    onClose();
  };

  const handleConfirmWarning = () => {
    setShowWarning(false);
    const newRate = parseFloat(rateInput);
    onConfirm(newRate);
    onClose();
  };

  const handleCancelWarning = () => {
    setShowWarning(false);
  };

  const handleCancel = () => {
    setError(undefined);
    setRateInput(conversion.exchangeRate.toString());
    onClose();
  };

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={handleCancel}
        title={t("title", { from: conversion.fromCurrency, to: conversion.toCurrency })}
        maxWidth="max-w-lg"
      >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Rate Info */}
 <div className="bg-v2-bg-dark p-3 rounded-md border border-v2-border-light">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
 <span className="text-v2-text-secondary">
                {t("currentRate")}
              </span>
 <span className="font-semibold text-v2-gold-accent">
                1 {conversion.fromCurrency} ={" "}
                {formatExchangeRate(
                  conversion.exchangeRate,
                  conversion.toCurrency
                )}{" "}
                {conversion.toCurrency}
              </span>
            </div>
            <div className="flex justify-between">
 <span className="text-v2-text-secondary">
                {t("source")}
              </span>
 <span className="font-medium text-v2-gold-accent">
                {conversion.rateSource === "auto"
                  ? t("sourceAuto")
                  : conversion.rateSource === "manual"
                  ? t("sourceManual")
                  : t("sourceFallback")}
              </span>
            </div>
            <div className="flex justify-between">
 <span className="text-v2-text-secondary">
                {t("transactions")}
              </span>
 <span className="font-medium text-v2-gold-accent">
                {conversion.transactionCount}
              </span>
            </div>
            <div className="flex justify-between">
 <span className="text-v2-text-secondary">
                {t("currentTotal")}
              </span>
 <span className="font-semibold text-v2-gold-accent">
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
              </span>
            </div>
          </div>
        </div>

        {/* New Rate Input */}
        <FormInput
          label={t("newRateLabel", { from: conversion.fromCurrency, to: conversion.toCurrency })}
          name="rate"
          type="number"
          step={conversion.toCurrency === "VND" ? "1" : "0.01"}
          min="0.00001"
          value={rateInput}
          onChange={(e) => setRateInput(e.target.value)}
          required
          placeholder={`e.g., ${formatExchangeRate(
            conversion.exchangeRate,
            conversion.toCurrency
          )}`}
        />

        {/* Rate Difference Warning */}
        {rateDifference !== null && (
          <div
            className={`p-3 rounded-md border ${
              Math.abs(rateDifference) > 10
 ? "bg-warning-50 border-warning-200"
 : "bg-blue-50 border-blue-200"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">
                {Math.abs(rateDifference) > 10 ? "⚠️" : "ℹ️"}
              </span>
              <div className="flex-1 text-sm">
                <p
                  className={
                    Math.abs(rateDifference) > 10
 ? "text-warning-700"
 : "text-blue-700"
                  }
                >
                  {rateDifference > 0 ? "+" : ""}
                  {rateDifference.toFixed(2)}{t("fromAutoRate")}
                </p>
                {Math.abs(rateDifference) > 10 && (
 <p className="text-warning-600 mt-1">
                    {t("warningSignificant")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Preview Total */}
        {previewTotal && (
 <div className="bg-success-50 p-3 rounded-md border border-success-200">
            <div className="text-sm">
 <span className="text-success-700">
                <strong>{t("newTotal")}</strong>
              </span>
 <div className="mt-1 font-semibold text-success-800">
                {conversion.totalOriginal &&
                  formatCurrency(
                    conversion.totalOriginal.amount,
                    conversion.totalOriginal.currency
                  )}{" "}
                →{" "}
                {formatCurrency(previewTotal.amount, previewTotal.currency)}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
 <div className="p-3 bg-v2-bg-dark border border-v2-red-negative/30 rounded-lg">
 <p className="text-sm text-v2-red-negative">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            className="flex-1"
          >
            {t("cancel")}
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            {t("applyRate")}
          </Button>
        </div>
      </form>
      </BaseModal>

      {/* Warning Dialog for Large Rate Differences */}
      {showWarning && rateDifference !== null && (
        <ConfirmationDialog
          title={t("warningTitle")}
          message={t("warningMessage", { percent: Math.abs(rateDifference).toFixed(1) })}
          confirmText={t("proceed")}
          cancelText={t("cancel")}
          variant="default"
          onConfirm={handleConfirmWarning}
          onCancel={handleCancelWarning}
        />
      )}
    </>
  );
}
