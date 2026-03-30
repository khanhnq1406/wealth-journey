"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { RHFFormSelect as FormSelect } from "@/components/forms/RHFFormSelect";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { FormSelect as BasicFormSelect } from "@/components/forms/FormSelect";
import { ErrorMessage } from "@/components/forms/ErrorMessage";
import { Label } from "@/components/forms/Label";
import { Success } from "@/components/modals/Success";
import { SymbolAutocomplete } from "@/features/investment/components/SymbolAutocomplete";

import {
  useMutationCreateUserPriceAlert,
  useQueryGetAssetDisplayPrices,
  EVENT_InvestmentListUserPriceAlerts,
} from "@/utils/generated/hooks";
import {
  AlertDirection,
  AlertTriggerMode,
  InvestmentType,
  SearchResult,
} from "@/gen/protobuf/v1/investment";
import { useQueryClient } from "@tanstack/react-query";

import {
  createPriceAlertSchema,
  CreatePriceAlertFormValues,
  getDirectionOptions,
  getTriggerModeOptions,
  getPriceSideOptions,
} from "../utils/price-alert-validation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssetCategory = "gold" | "silver" | "other";

export interface CreatePriceAlertFormProps {
  onSuccess?: () => void;
  /** Pre-fill: starting asset category */
  defaultCategory?: AssetCategory;
  /** Pre-fill: symbol (for gold/silver: the type code; for other: ticker) */
  defaultSymbol?: string;
  /** Pre-fill: display name */
  defaultName?: string;
  /** Pre-fill: InvestmentType enum value */
  defaultAssetType?: InvestmentType;
  /** Pre-fill: ISO 4217 currency code */
  defaultCurrency?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Select option shape used by BasicFormSelect */
interface SelectOption {
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CreatePriceAlertForm
 *
 * 3-step progressive disclosure:
 *   1. Asset category: Gold | Silver | Other Assets
 *   2. Symbol selection: gold/silver dropdown or SymbolAutocomplete for others
 *   3. Alert configuration: price side, direction, target price, trigger mode, note
 *
 * Design notes:
 * - Mobile-first layout, full-width fields, touch targets >= 44px
 * - No cross-feature imports (SymbolAutocomplete re-used from investment feature
 *   since the shared forms/index.ts already re-exports it — ESLint allows that
 *   re-export path)
 * - Gold/Silver option definitions are replicated locally in price-alert-validation.ts
 */
export function CreatePriceAlertForm({
  onSuccess,
  defaultCategory = "gold",
  defaultSymbol,
  defaultName,
  defaultAssetType,
  defaultCurrency,
}: CreatePriceAlertFormProps) {
  const t = useTranslations("priceAlerts");
  const queryClient = useQueryClient();

  const DIRECTION_OPTIONS = useMemo(() => getDirectionOptions(t), [t]);
  const TRIGGER_MODE_OPTIONS = useMemo(() => getTriggerModeOptions(t), [t]);
  const PRICE_SIDE_OPTIONS = useMemo(() => getPriceSideOptions(t), [t]);

  // ------------------------------------------------------------------
  // Asset display price queries (admin config API)
  // ------------------------------------------------------------------
  const goldQuery = useQueryGetAssetDisplayPrices({ assetType: "gold" });
  const silverQuery = useQueryGetAssetDisplayPrices({ assetType: "silver" });

  const goldSelectOptions = useMemo<SelectOption[]>(
    () =>
      (goldQuery.data?.prices ?? [])
        .filter((p) => p.showInInvestment)
        .map((p) => ({ value: p.typeCode, label: p.displayName })),
    [goldQuery.data]
  );

  const silverSelectOptions = useMemo<SelectOption[]>(
    () =>
      (silverQuery.data?.prices ?? [])
        .filter((p) => p.showInInvestment)
        .map((p) => ({ value: p.typeCode, label: p.displayName })),
    [silverQuery.data]
  );

  // ------------------------------------------------------------------
  // UI state
  // ------------------------------------------------------------------
  const [category, setCategory] = useState<AssetCategory>(defaultCategory);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [showSuccess, setShowSuccess] = useState(false);

  // "Other" category: symbol/name/currency come from SymbolAutocomplete
  const [otherSymbol, setOtherSymbol] = useState(
    defaultCategory === "other" ? (defaultSymbol ?? "") : ""
  );
  const [otherName, setOtherName] = useState(
    defaultCategory === "other" ? (defaultName ?? "") : ""
  );
  const [otherCurrency, setOtherCurrency] = useState(
    defaultCategory === "other" ? (defaultCurrency ?? "USD") : "USD"
  );
  const [otherAssetType, setOtherAssetType] = useState<InvestmentType>(
    defaultCategory === "other"
      ? (defaultAssetType ?? InvestmentType.INVESTMENT_TYPE_STOCK)
      : InvestmentType.INVESTMENT_TYPE_STOCK
  );

  // ------------------------------------------------------------------
  // Form
  // ------------------------------------------------------------------
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreatePriceAlertFormValues>({
    resolver: zodResolver(createPriceAlertSchema),
    defaultValues: {
      // symbol/name start empty; populated once API data loads (see useEffect below)
      symbol: defaultCategory === "other" ? (defaultSymbol ?? "") : "",
      name: defaultCategory === "other" ? (defaultName ?? "") : "",
      assetType:
        defaultCategory === "gold"
          ? InvestmentType.INVESTMENT_TYPE_GOLD_VND
          : defaultCategory === "silver"
            ? InvestmentType.INVESTMENT_TYPE_SILVER_VND
            : (defaultAssetType ?? InvestmentType.INVESTMENT_TYPE_STOCK),
      currency:
        defaultCategory === "gold" || defaultCategory === "silver"
          ? "VND"
          : (defaultCurrency ?? "USD"),
      priceSide: "buy",
      direction: AlertDirection.ALERT_DIRECTION_ABOVE,
      targetPrice: 0,
      triggerMode: AlertTriggerMode.ALERT_TRIGGER_MODE_ONCE,
      cooldownHours: 0,
      note: "",
    },
  });

  // Ref flags: populate gold/silver symbol once API data first loads (one-shot init)
  const goldInitialized = useRef(false);
  const silverInitialized = useRef(false);

  useEffect(() => {
    if (!goldInitialized.current && category === "gold" && goldSelectOptions.length > 0) {
      goldInitialized.current = true;
      const preferredSymbol =
        defaultCategory === "gold" && defaultSymbol
          ? defaultSymbol
          : goldSelectOptions[0].value;
      const opt = goldSelectOptions.find((o) => o.value === preferredSymbol) ?? goldSelectOptions[0];
      setValue("symbol", opt.value);
      setValue("name", opt.label);
      setValue("assetType", InvestmentType.INVESTMENT_TYPE_GOLD_VND);
      setValue("currency", "VND");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldSelectOptions.length]);

  useEffect(() => {
    if (!silverInitialized.current && category === "silver" && silverSelectOptions.length > 0) {
      silverInitialized.current = true;
      const preferredSymbol =
        defaultCategory === "silver" && defaultSymbol
          ? defaultSymbol
          : silverSelectOptions[0].value;
      const opt = silverSelectOptions.find((o) => o.value === preferredSymbol) ?? silverSelectOptions[0];
      setValue("symbol", opt.value);
      setValue("name", opt.label);
      setValue("assetType", InvestmentType.INVESTMENT_TYPE_SILVER_VND);
      setValue("currency", "VND");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silverSelectOptions.length]);

  const watchedTriggerMode = watch("triggerMode");
  const isRepeat =
    watchedTriggerMode === AlertTriggerMode.ALERT_TRIGGER_MODE_REPEAT;
  const isGoldOrSilver = category === "gold" || category === "silver";

  // ------------------------------------------------------------------
  // Mutation
  // ------------------------------------------------------------------
  const createAlertMutation = useMutationCreateUserPriceAlert({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [EVENT_InvestmentListUserPriceAlerts],
      });
      setShowSuccess(true);
    },
    onError: (error: any) => {
      setErrorMessage(error?.message ?? t("createError"));
    },
  });

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  /** Switch asset category; reset symbol/name/currency/assetType accordingly */
  const handleCategoryChange = useCallback(
    (cat: AssetCategory) => {
      setCategory(cat);
      setErrorMessage(undefined);

      if (cat === "gold") {
        const first = goldSelectOptions[0];
        if (first) {
          setValue("symbol", first.value);
          setValue("name", first.label);
        } else {
          setValue("symbol", "");
          setValue("name", "");
        }
        setValue("assetType", InvestmentType.INVESTMENT_TYPE_GOLD_VND);
        setValue("currency", "VND");
        setValue("priceSide", "buy");
      } else if (cat === "silver") {
        const first = silverSelectOptions[0];
        if (first) {
          setValue("symbol", first.value);
          setValue("name", first.label);
        } else {
          setValue("symbol", "");
          setValue("name", "");
        }
        setValue("assetType", InvestmentType.INVESTMENT_TYPE_SILVER_VND);
        setValue("currency", "VND");
        setValue("priceSide", "buy");
      } else {
        // "other" — clear until user picks
        setValue("symbol", otherSymbol);
        setValue("name", otherName);
        setValue(
          "assetType",
          otherAssetType || InvestmentType.INVESTMENT_TYPE_STOCK
        );
        setValue("currency", otherCurrency);
        setValue("priceSide", "buy");
      }
    },
    [goldSelectOptions, silverSelectOptions, otherSymbol, otherName, otherAssetType, otherCurrency, setValue]
  );

  /** When a gold type is selected from the dropdown */
  const handleGoldTypeChange = useCallback(
    (value: string) => {
      const opt = goldSelectOptions.find((o) => o.value === value);
      if (opt) {
        setValue("symbol", opt.value);
        setValue("name", opt.label);
        setValue("assetType", InvestmentType.INVESTMENT_TYPE_GOLD_VND);
        setValue("currency", "VND");
      }
    },
    [goldSelectOptions, setValue]
  );

  /** When a silver type is selected from the dropdown */
  const handleSilverTypeChange = useCallback(
    (value: string) => {
      const opt = silverSelectOptions.find((o) => o.value === value);
      if (opt) {
        setValue("symbol", opt.value);
        setValue("name", opt.label);
        setValue("assetType", InvestmentType.INVESTMENT_TYPE_SILVER_VND);
        setValue("currency", "VND");
      }
    },
    [silverSelectOptions, setValue]
  );

  /** When a symbol is picked from SymbolAutocomplete */
  const handleOtherSymbolChange = useCallback(
    (sym: string, result?: SearchResult) => {
      const name = result?.name ?? sym;
      const currency = result?.currency ?? "USD";
      // Map from SearchResult to InvestmentType — default to STOCK
      const assetType = InvestmentType.INVESTMENT_TYPE_STOCK;

      setOtherSymbol(sym);
      setOtherName(name);
      setOtherCurrency(currency);
      setOtherAssetType(assetType);

      setValue("symbol", sym);
      setValue("name", name);
      setValue("assetType", assetType);
      setValue("currency", currency);
    },
    [setValue]
  );

  /** Form submit handler */
  const onSubmit = useCallback(
    (data: CreatePriceAlertFormValues) => {
      setErrorMessage(undefined);
      createAlertMutation.mutate({
        symbol: data.symbol,
        name: data.name,
        assetType: data.assetType as InvestmentType,
        currency: data.currency,
        priceSide: isGoldOrSilver ? data.priceSide : "buy",
        direction: data.direction as AlertDirection,
        targetPrice: data.targetPrice,
        triggerMode: data.triggerMode as AlertTriggerMode,
        cooldownHours: isRepeat ? data.cooldownHours : 0,
        note: data.note ?? "",
      });
    },
    [createAlertMutation, isGoldOrSilver, isRepeat]
  );

  // ------------------------------------------------------------------
  // Success state
  // ------------------------------------------------------------------
  if (showSuccess) {
    return (
      <Success
        message={t("successMessage")}
        onDone={onSuccess}
      />
    );
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const currentGoldSymbol = watch("symbol");
  const currentSilverSymbol = watch("symbol");

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Step 1: Asset Category                                               */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <p
          id="category-label"
          className="text-sm font-medium text-v2-text-secondary mb-2"
        >
          {t("assetCategory")}
        </p>
        <div
          role="group"
          aria-labelledby="category-label"
          className="flex gap-2"
        >
          {(["gold", "silver", "other"] as AssetCategory[]).map((cat) => {
            const isActive = category === cat;
            const label =
              cat === "gold"
                ? t("categoryGold")
                : cat === "silver"
                  ? t("categorySilver")
                  : t("categoryOther");
            return (
              <button
                key={cat}
                type="button"
                role="button"
                aria-pressed={isActive}
                onClick={() => handleCategoryChange(cat)}
                className={[
                  "flex-1 min-h-[44px] rounded-lg border text-sm font-medium transition-colors",
                  "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary",
                  isActive
                    ? "bg-v2-gold-primary text-v2-bg-dark border-v2-gold-primary"
                    : "bg-v2-bg-dark text-v2-text-secondary border-v2-border-light hover:border-v2-gold-primary hover:text-v2-gold-primary",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Step 2: Symbol / Type selection                                       */}
      {/* ------------------------------------------------------------------ */}
      {category === "gold" && (
        <div>
          <Label htmlFor="gold-type-select" required>
            {t("goldTypeLabel")}
          </Label>
          <BasicFormSelect
            id="gold-type-select"
            options={goldSelectOptions}
            value={currentGoldSymbol}
            onChange={handleGoldTypeChange}
            placeholder={goldQuery.isLoading ? "Loading..." : t("goldTypePlaceholder")}
            className="mt-1"
            disabled={goldQuery.isLoading}
          />
        </div>
      )}

      {category === "silver" && (
        <div>
          <Label htmlFor="silver-type-select" required>
            {t("silverTypeLabel")}
          </Label>
          <BasicFormSelect
            id="silver-type-select"
            options={silverSelectOptions}
            value={currentSilverSymbol}
            onChange={handleSilverTypeChange}
            placeholder={silverQuery.isLoading ? "Loading..." : t("silverTypePlaceholder")}
            className="mt-1"
            disabled={silverQuery.isLoading}
          />
        </div>
      )}

      {category === "other" && (
        <div>
          <Label htmlFor="symbol-autocomplete-label" required>
            {t("symbolLabel")}
          </Label>
          <div id="symbol-autocomplete-label" className="mt-1">
            <SymbolAutocomplete
              value={otherSymbol}
              onChange={handleOtherSymbolChange}
              placeholder={t("symbolPlaceholder")}
              usePortal
            />
          </div>
          {!otherSymbol && (
            <p className="text-xs text-v2-text-tertiary mt-1">
              {t("symbolHint")}
            </p>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 3: Alert configuration                                          */}
      {/* ------------------------------------------------------------------ */}

      {/* Price Side — gold/silver only */}
      {isGoldOrSilver && (
        <FormSelect
          name="priceSide"
          control={control}
          label={t("priceSideLabel")}
          options={PRICE_SIDE_OPTIONS}
          required
        />
      )}

      {/* Direction */}
      <FormSelect
        name="direction"
        control={control}
        label={t("directionLabel")}
        options={DIRECTION_OPTIONS}
        parseAsNumber
        required
      />

      {/* Target Price */}
      <div>
        <FormNumberInput
          name="targetPrice"
          control={control}
          label={t("targetPriceLabel")}
          placeholder="0"
          useThousandSeparator
          required
          showRecommendations={false}
        />
        <p className="text-xs text-v2-text-tertiary mt-1">
          {t("targetPriceHint")}
        </p>
      </div>

      {/* Trigger Mode */}
      <FormSelect
        name="triggerMode"
        control={control}
        label={t("triggerModeLabel")}
        options={TRIGGER_MODE_OPTIONS}
        parseAsNumber
        required
      />

      {/* Cooldown Hours — only shown for repeat mode */}
      {isRepeat && (
        <div>
          <FormNumberInput
            name="cooldownHours"
            control={control}
            label={t("cooldownLabel")}
            placeholder="24"
            useThousandSeparator={false}
            min={2}
            max={168}
            required
            showRecommendations={false}
            helperText={t("cooldownHint")}
          />
        </div>
      )}

      {/* Note */}
      <FormTextarea
        name="note"
        control={control}
        label={t("noteLabel")}
        placeholder={t("notePlaceholder")}
        maxLength={200}
        showCharacterCount
        rows={2}
      />

      {/* Error message */}
      {errorMessage && (
        <ErrorMessage severity="error">{errorMessage}</ErrorMessage>
      )}

      {/* Submit */}
      <Button
        type={ButtonType.PRIMARY}
        onClick={handleSubmit(onSubmit)}
        loading={createAlertMutation.isPending}
        disabled={createAlertMutation.isPending}
        className="w-full min-h-[44px]"
      >
        {t("createButton")}
      </Button>
    </form>
  );
}
