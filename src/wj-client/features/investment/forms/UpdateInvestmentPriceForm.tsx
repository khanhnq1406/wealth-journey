"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { InvestmentType } from "@/gen/protobuf/v1/investment";
import { useMutationUpdateInvestment } from "@/utils/generated/hooks";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { FormInput } from "@/components/forms/FormInput";
import { Success } from "@/components/modals/Success";
import { getTranslatedError } from "@/lib/utils/error-translator";

interface UpdateInvestmentPriceFormProps {
  investmentId: number;
  currentSymbol: string;
  currentName: string;
  currentPrice: number;
  currency: string;
  investmentType: InvestmentType;
  onSuccess?: () => void;
}

export function UpdateInvestmentPriceForm({
  investmentId,
  currentSymbol,
  currentName,
  currentPrice,
  currency,
  investmentType,
  onSuccess,
}: UpdateInvestmentPriceFormProps) {
  const t = useTranslations("investmentPrice.form");
  const tErrors = useTranslations();
  // Currencies with no decimal places (0 decimals)
  const zeroDecimalCurrencies = ["VND", "JPY", "KRW"];
  const hasDecimals = !zeroDecimalCurrencies.includes(currency);

  // Calculate display price and initial input based on currency
  const displayPrice =
    currentPrice > 0
      ? hasDecimals
        ? (currentPrice / 100).toFixed(2)
        : currentPrice.toString()
      : "";

  const [priceInput, setPriceInput] = useState(displayPrice);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [showSuccess, setShowSuccess] = useState(false);

  const updateMutation = useMutationUpdateInvestment({
    onSuccess: () => {
      setShowSuccess(true);
    },
    onError: (error: any) => {
      setErrorMessage(getTranslatedError(error, tErrors));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(undefined);

    const priceDecimal = parseFloat(priceInput);
    if (isNaN(priceDecimal) || priceDecimal < 0) {
      setErrorMessage(t("invalidPrice"));
      return;
    }

    // Convert to smallest currency unit (currency-aware)
    // USD/EUR/GBP: multiply by 100 (cents)
    // VND/JPY/KRW: no conversion (already in smallest unit)
    const priceInSmallestUnit = hasDecimals
      ? Math.round(priceDecimal * 100)
      : Math.round(priceDecimal);

    updateMutation.mutate({
      id: investmentId,
      name: currentName,
      currentPrice: priceInSmallestUnit,
    });
  };

  if (showSuccess) {
    return <Success message={t("successMessage")} onDone={onSuccess} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 p-3 rounded-md">
        <p className="text-sm text-gray-600">
          <strong>{t("symbol")}:</strong> {currentSymbol}
        </p>
        <p className="text-sm text-gray-600">
          <strong>{t("currentPrice")}:</strong>{" "}
          {currentPrice > 0 ? `${currency} ${displayPrice}` : t("notSet")}
        </p>
      </div>

      <FormInput
        label={t("newPrice")}
        name="price"
        type="number"
        step={hasDecimals ? "0.01" : "1"}
        min="0"
        value={priceInput}
        onChange={(e) => setPriceInput(e.target.value)}
        placeholder={hasDecimals ? "0.00" : "0"}
        required
        helperText={t("pricePerUnit", { currency })}
      />

      <div className="bg-blue-50 p-3 rounded-md border border-v2-gold-primary/30">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> {t("tip")}
        </p>
      </div>

      {errorMessage && (
        <div className="bg-red-50 p-3 rounded-md border border-v2-red-negative/30">
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type={ButtonType.PRIMARY}
          onClick={handleSubmit}
          loading={updateMutation.isPending}
          htmlType="submit"
        >
          {t("updatePrice")}
        </Button>
      </div>
    </form>
  );
}
