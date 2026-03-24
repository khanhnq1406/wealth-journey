"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { FormInput } from "@/components/forms/FormInput";
import { Success } from "@/components/modals/Success";
import { Select } from "@/components/select/Select";
import { ButtonType } from "@/app/constants";
import { useMutationCreateWatchlistItem, useQueryGetMarketPrices } from "@/utils/generated/hooks";
import { InvestmentType, SearchResult } from "@/gen/protobuf/v1/investment";
import { GOLD_VND_OPTIONS } from "@/features/investment/utils/gold-calculator";
import { SILVER_VND_OPTIONS } from "@/features/investment/utils/silver-calculator";
// eslint-disable-next-line no-restricted-imports
import { SymbolAutocomplete } from "@/features/investment/components/SymbolAutocomplete";

type AssetCategory = "gold" | "silver" | "currency" | "other";

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
  const [category, setCategory] = useState<AssetCategory>("gold");

  const { data: marketData } = useQueryGetMarketPrices({}, { staleTime: 5 * 60 * 1000 });

  // Assembled watchlist item fields
  const [symbol, setSymbol] = useState(GOLD_VND_OPTIONS[0]?.value ?? "");
  const [name, setName] = useState(GOLD_VND_OPTIONS[0]?.label ?? "");
  const [assetType, setAssetType] = useState<InvestmentType>(InvestmentType.INVESTMENT_TYPE_GOLD_VND);
  const [currency, setCurrency] = useState(GOLD_VND_OPTIONS[0]?.currency ?? "VND");
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

  const handleCategoryChange = (cat: AssetCategory) => {
    setCategory(cat);
    // Reset symbol/name/note when switching category
    setSymbol("");
    setName("");
    setNote("");
    setErrorKey(undefined);
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
    } else if (cat === "currency") {
      setAssetType(InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY);
      setCurrency("VND");
      const first = marketData?.currency?.[0];
      if (first) {
        setSymbol(first.typeCode);
        setName(first.name || first.typeCode);
      }
    } else {
      setAssetType(InvestmentType.INVESTMENT_TYPE_OTHER);
      setCurrency("USD");
    }
  };

  const handleGoldSelect = (value: string) => {
    const opt = GOLD_VND_OPTIONS.find((o) => o.value === value);
    if (opt) {
      setSymbol(opt.value);
      setName(opt.label);
      setAssetType(InvestmentType.INVESTMENT_TYPE_GOLD_VND);
      setCurrency(opt.currency);
    }
  };

  const handleSilverSelect = (value: string) => {
    const opt = SILVER_VND_OPTIONS.find((o) => o.value === value);
    if (opt) {
      setSymbol(opt.value);
      setName(opt.label);
      setAssetType(InvestmentType.INVESTMENT_TYPE_SILVER_VND);
      setCurrency(opt.currency);
    }
  };

  const handleCurrencySelect = (value: string) => {
    const item = marketData?.currency?.find((c) => c.typeCode === value);
    if (item) {
      setSymbol(item.typeCode);
      setName(item.name || item.typeCode);
      setAssetType(InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY);
      setCurrency("VND");
    }
  };

  const handleSymbolChange = (sym: string, result?: SearchResult) => {
    setSymbol(sym);
    if (result) {
      setName(result.name || sym);
      setCurrency(result.currency || "USD");
      setAssetType(mapQuoteTypeToInvestmentType(result.type || ""));
    }
  };

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

  const categories: { value: AssetCategory; label: string }[] = [
    { value: "gold", label: t("gold") },
    { value: "silver", label: t("silver") },
    { value: "currency", label: t("currency") },
    { value: "other", label: t("otherAssets") },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Category tabs */}
      <div className="flex rounded-lg border border-v2-border-light bg-v2-bg-dark p-1 gap-1">
        {categories.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => handleCategoryChange(cat.value)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-v2-gold-primary focus:ring-offset-1 ${
              category === cat.value
                ? "bg-v2-gold-primary text-v2-bg-surface"
                : "text-v2-text-secondary hover:text-v2-gold-accent"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Symbol selector — changes based on category */}
      {category === "gold" && (
        <div className="flex flex-col gap-1.5">
          <label className="block text-sm font-medium text-v2-text-secondary">
            {t("goldType")}
          </label>
          <Select
            options={GOLD_VND_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            value={symbol}
            onChange={handleGoldSelect}
            disableInput
            disableFilter
            clearable={false}
            usePortal
          />
        </div>
      )}

      {category === "silver" && (
        <div className="flex flex-col gap-1.5">
          <label className="block text-sm font-medium text-v2-text-secondary">
            {t("silverType")}
          </label>
          <Select
            options={SILVER_VND_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            value={symbol}
            onChange={handleSilverSelect}
            disableInput
            disableFilter
            clearable={false}
            usePortal
          />
        </div>
      )}

      {category === "currency" && (
        <div className="flex flex-col gap-1.5">
          <label className="block text-sm font-medium text-v2-text-secondary">
            {t("currencyType")}
          </label>
          <Select
            options={(marketData?.currency ?? []).map((item) => ({
              value: item.typeCode,
              label: item.name || item.typeCode,
            }))}
            value={symbol}
            onChange={handleCurrencySelect}
            disableInput
            disableFilter
            clearable={false}
            usePortal
          />
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
        disabled={!symbol.trim()}
        className="w-full"
      >
        {tp("addToWatchlist")}
      </Button>
    </div>
  );
}
