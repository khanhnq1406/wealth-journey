"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { FormInput } from "@/components/forms/FormInput";
import { Success } from "@/components/modals/Success";
import { ButtonType } from "@/app/constants";
import { useMutationCreateWatchlistItem } from "@/utils/generated/hooks";
import { InvestmentType, SearchResult } from "@/gen/protobuf/v1/investment";
import { GOLD_VND_OPTIONS } from "@/features/investment/utils/gold-calculator";
import { SILVER_VND_OPTIONS } from "@/features/investment/utils/silver-calculator";
// eslint-disable-next-line no-restricted-imports
import { SymbolAutocomplete } from "@/features/investment/components/SymbolAutocomplete";

type AssetCategory = "gold" | "silver" | "other";

interface AddToWatchlistFormProps {
  onSuccess?: () => void;
}

function mapQuoteTypeToInvestmentType(quoteType: string): InvestmentType {
  switch (quoteType.toUpperCase()) {
    case "EQUITY":
      return InvestmentType.INVESTMENT_TYPE_STOCK;
    case "CRYPTOCURRENCY":
      return InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY;
    case "ETF":
      return InvestmentType.INVESTMENT_TYPE_ETF;
    case "MUTUALFUND":
      return InvestmentType.INVESTMENT_TYPE_MUTUAL_FUND;
    case "BOND":
      return InvestmentType.INVESTMENT_TYPE_BOND;
    case "COMMODITY":
      return InvestmentType.INVESTMENT_TYPE_COMMODITY;
    default:
      return InvestmentType.INVESTMENT_TYPE_OTHER;
  }
}

function getErrorKey(errorMsg: string): "alreadyInWatchlist" | "limitReached" | "failedToAdd" {
  const lower = errorMsg.toLowerCase();
  if (lower.includes("already in watchlist") || lower.includes("already exists") || lower.includes("duplicate")) {
    return "alreadyInWatchlist";
  }
  if (lower.includes("maximum") || lower.includes("limit") || lower.includes("max")) {
    return "limitReached";
  }
  return "failedToAdd";
}

export function AddToWatchlistForm({ onSuccess }: AddToWatchlistFormProps) {
  const t = useTranslations("prices.watchlist.form");
  const tp = useTranslations("prices");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState<AssetCategory | null>(null);

  // Assembled watchlist item fields
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<InvestmentType>(InvestmentType.INVESTMENT_TYPE_OTHER);
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");

  const [errorKey, setErrorKey] = useState<"alreadyInWatchlist" | "limitReached" | "failedToAdd" | undefined>();
  const [showSuccess, setShowSuccess] = useState(false);

  const createMutation = useMutationCreateWatchlistItem({
    onSuccess: () => {
      setShowSuccess(true);
    },
    onError: (error: { message: string }) => {
      setErrorKey(getErrorKey(error.message || ""));
    },
  });

  // Step 1: Category selection
  const handleCategorySelect = (cat: AssetCategory) => {
    setCategory(cat);
    // Reset fields when switching category
    setSymbol("");
    setName("");
    setNote("");
    if (cat === "gold") {
      const first = GOLD_VND_OPTIONS[0];
      if (first) {
        setSymbol(first.value);
        setName(first.label);
        setAssetType(InvestmentType.INVESTMENT_TYPE_GOLD_VND);
        setCurrency(first.currency);
      }
    } else if (cat === "silver") {
      const first = SILVER_VND_OPTIONS[0];
      if (first) {
        setSymbol(first.value);
        setName(first.label);
        setAssetType(InvestmentType.INVESTMENT_TYPE_SILVER_VND);
        setCurrency(first.currency);
      }
    } else {
      setAssetType(InvestmentType.INVESTMENT_TYPE_OTHER);
      setCurrency("USD");
    }
    setStep(2);
  };

  // Step 2 gold/silver: dropdown change
  const handleGoldSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opt = GOLD_VND_OPTIONS.find((o) => o.value === e.target.value);
    if (opt) {
      setSymbol(opt.value);
      setName(opt.label);
      setAssetType(InvestmentType.INVESTMENT_TYPE_GOLD_VND);
      setCurrency(opt.currency);
    }
  };

  const handleSilverSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opt = SILVER_VND_OPTIONS.find((o) => o.value === e.target.value);
    if (opt) {
      setSymbol(opt.value);
      setName(opt.label);
      setAssetType(InvestmentType.INVESTMENT_TYPE_SILVER_VND);
      setCurrency(opt.currency);
    }
  };

  // Step 2 other assets: SymbolAutocomplete change
  const handleSymbolChange = (sym: string, result?: SearchResult) => {
    setSymbol(sym);
    if (result) {
      setName(result.name || sym);
      setCurrency(result.currency || "USD");
      setAssetType(mapQuoteTypeToInvestmentType(result.type || ""));
    }
  };

  const canProceedToStep3 = symbol.trim().length > 0;

  const handleSubmit = () => {
    setErrorKey(undefined);
    if (!symbol.trim()) {
      setErrorKey("failedToAdd");
      return;
    }
    createMutation.mutate({
      symbol: symbol.trim(),
      name: name.trim(),
      assetType,
      currency,
      note: note.trim(),
    });
  };

  if (showSuccess) {
    return <Success message={t("addedSuccess")} onDone={onSuccess} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Step 1: Asset category */}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-v2-text-secondary mb-1">
            {t("chooseCategoryLabel")}
          </p>
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={() => handleCategorySelect("gold")}
              className="flex-1 min-h-[48px] rounded-lg border border-v2-border-light bg-v2-bg-dark text-v2-gold-accent font-medium text-sm hover:border-v2-gold-primary hover:text-v2-gold-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-v2-gold-primary"
            >
              {t("gold")}
            </button>
            <button
              type="button"
              onClick={() => handleCategorySelect("silver")}
              className="flex-1 min-h-[48px] rounded-lg border border-v2-border-light bg-v2-bg-dark text-v2-gold-accent font-medium text-sm hover:border-v2-gold-primary hover:text-v2-gold-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-v2-gold-primary"
            >
              {t("silver")}
            </button>
            <button
              type="button"
              onClick={() => handleCategorySelect("other")}
              className="flex-1 min-h-[48px] rounded-lg border border-v2-border-light bg-v2-bg-dark text-v2-gold-accent font-medium text-sm hover:border-v2-gold-primary hover:text-v2-gold-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-v2-gold-primary"
            >
              {t("otherAssets")}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Symbol selection */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => { setStep(1); setCategory(null); }}
            className="self-start text-sm text-v2-text-tertiary hover:text-v2-gold-accent flex items-center gap-1 focus:outline-none"
            aria-label={t("backToCategoryLabel")}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t("back")}
          </button>

          {category === "gold" && (
            <div className="flex flex-col gap-1.5">
              <label className="block text-sm font-medium text-v2-text-secondary">
                {t("goldType")}
              </label>
              <select
                value={symbol}
                onChange={handleGoldSelect}
                className="w-full min-h-[44px] sm:min-h-[48px] px-3 sm:px-4 rounded-lg border border-v2-border-light bg-v2-bg-dark text-v2-gold-accent text-base focus:outline-none focus:ring-2 focus:ring-v2-gold-primary focus:border-transparent transition-all duration-200"
              >
                {GOLD_VND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === "silver" && (
            <div className="flex flex-col gap-1.5">
              <label className="block text-sm font-medium text-v2-text-secondary">
                {t("silverType")}
              </label>
              <select
                value={symbol}
                onChange={handleSilverSelect}
                className="w-full min-h-[44px] sm:min-h-[48px] px-3 sm:px-4 rounded-lg border border-v2-border-light bg-v2-bg-dark text-v2-gold-accent text-base focus:outline-none focus:ring-2 focus:ring-v2-gold-primary focus:border-transparent transition-all duration-200"
              >
                {SILVER_VND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === "other" && (
            <div className="flex flex-col gap-1.5">
              <label className="block text-sm font-medium text-v2-text-secondary">
                {t("searchSymbol")}
              </label>
              <SymbolAutocomplete
                value={symbol}
                onChange={handleSymbolChange}
                placeholder={t("searchSymbolPlaceholder")}
                usePortal
              />
            </div>
          )}

          <Button
            type={ButtonType.PRIMARY}
            onClick={() => setStep(3)}
            disabled={!canProceedToStep3}
            className="w-full mt-1"
          >
            {t("continue")}
          </Button>
        </div>
      )}

      {/* Step 3: Note + Confirm */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="self-start text-sm text-v2-text-tertiary hover:text-v2-gold-accent flex items-center gap-1 focus:outline-none"
            aria-label={t("backToSymbolLabel")}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t("back")}
          </button>

          {/* Summary of selected asset */}
          <div className="rounded-lg border border-v2-border-light bg-v2-bg-dark px-4 py-3 flex flex-col gap-0.5">
            <span className="text-xs text-v2-text-tertiary">{t("selectedAsset")}</span>
            <span className="text-base font-semibold text-v2-gold-accent">{symbol}</span>
            {name && name !== symbol && (
              <span className="text-sm text-v2-text-secondary truncate">{name}</span>
            )}
            <span className="text-xs text-v2-text-tertiary">{currency}</span>
          </div>

          {/* Optional note */}
          <FormInput
            label={t("noteLabel")}
            value={note}
            onChange={(e) => {
              if (e.target.value.length <= 200) {
                setNote(e.target.value);
              }
            }}
            maxLength={200}
            placeholder={t("notePlaceholder")}
            helperText={`${note.length}/200`}
          />

          {/* Error message */}
          {errorKey && (
            <p className="text-sm text-v2-red-negative flex items-center gap-1">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{t(`errors.${errorKey}`)}</span>
            </p>
          )}

          <Button
            type={ButtonType.PRIMARY}
            onClick={handleSubmit}
            loading={createMutation.isPending}
            className="w-full"
          >
            {tp("addToWatchlist")}
          </Button>
        </div>
      )}
    </div>
  );
}
