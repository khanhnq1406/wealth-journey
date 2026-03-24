"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
  GOLD_VND_ALERT_OPTIONS,
  SILVER_VND_ALERT_OPTIONS,
  DIRECTION_OPTIONS,
  TRIGGER_MODE_OPTIONS,
  PRICE_SIDE_OPTIONS,
  PriceAlertAssetOption,
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
  defaultAssetType?: number;
  /** Pre-fill: ISO 4217 currency code */
  defaultCurrency?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GOLD_SELECT_OPTIONS = GOLD_VND_ALERT_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const SILVER_SELECT_OPTIONS = SILVER_VND_ALERT_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

/** Return the PriceAlertAssetOption that matches value within an options array */
function findOption(
  options: PriceAlertAssetOption[],
  value: string
): PriceAlertAssetOption | undefined {
  return options.find((o) => o.value === value);
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
  const queryClient = useQueryClient();

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
  const [otherAssetType, setOtherAssetType] = useState<number>(
    defaultCategory === "other"
      ? (defaultAssetType ?? InvestmentType.INVESTMENT_TYPE_STOCK)
      : InvestmentType.INVESTMENT_TYPE_STOCK
  );

  // ------------------------------------------------------------------
  // Derived defaults for gold/silver based on pre-fill props
  // ------------------------------------------------------------------
  const goldDefault =
    defaultCategory === "gold" && defaultSymbol
      ? defaultSymbol
      : GOLD_VND_ALERT_OPTIONS[0].value;

  const silverDefault =
    defaultCategory === "silver" && defaultSymbol
      ? defaultSymbol
      : SILVER_VND_ALERT_OPTIONS[0].value;

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
      symbol: goldDefault,
      name:
        defaultCategory === "gold"
          ? (findOption(GOLD_VND_ALERT_OPTIONS, goldDefault)?.label ?? "SJC")
          : defaultCategory === "silver"
            ? (findOption(SILVER_VND_ALERT_OPTIONS, silverDefault)?.label ?? "")
            : (defaultName ?? ""),
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
      setErrorMessage(
        error?.message ?? "Failed to create alert. Please try again."
      );
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
        const first = GOLD_VND_ALERT_OPTIONS[0];
        setValue("symbol", first.value);
        setValue("name", first.label);
        setValue("assetType", InvestmentType.INVESTMENT_TYPE_GOLD_VND);
        setValue("currency", "VND");
        setValue("priceSide", "buy");
      } else if (cat === "silver") {
        const first = SILVER_VND_ALERT_OPTIONS[0];
        setValue("symbol", first.value);
        setValue("name", first.label);
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
    [otherSymbol, otherName, otherAssetType, otherCurrency, setValue]
  );

  /** When a gold type is selected from the dropdown */
  const handleGoldTypeChange = useCallback(
    (value: string) => {
      const opt = findOption(GOLD_VND_ALERT_OPTIONS, value);
      if (opt) {
        setValue("symbol", opt.value);
        setValue("name", opt.label);
        setValue("assetType", opt.assetType);
        setValue("currency", opt.currency);
      }
    },
    [setValue]
  );

  /** When a silver type is selected from the dropdown */
  const handleSilverTypeChange = useCallback(
    (value: string) => {
      const opt = findOption(SILVER_VND_ALERT_OPTIONS, value);
      if (opt) {
        setValue("symbol", opt.value);
        setValue("name", opt.label);
        setValue("assetType", opt.assetType);
        setValue("currency", opt.currency);
      }
    },
    [setValue]
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
        assetType: data.assetType,
        currency: data.currency,
        priceSide: isGoldOrSilver ? data.priceSide : "buy",
        direction: data.direction,
        targetPrice: data.targetPrice,
        triggerMode: data.triggerMode,
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
        message="Your price alert has been created."
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
          Asset Category
        </p>
        <div
          role="group"
          aria-labelledby="category-label"
          className="flex gap-2"
        >
          {(["gold", "silver", "other"] as AssetCategory[]).map((cat) => {
            const isActive = category === cat;
            const label =
              cat === "gold" ? "Gold" : cat === "silver" ? "Silver" : "Other";
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
                    ? "bg-v2-gold-primary text-v2-bg-deepest border-v2-gold-primary"
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
            Gold Type
          </Label>
          <BasicFormSelect
            id="gold-type-select"
            options={GOLD_SELECT_OPTIONS}
            value={currentGoldSymbol}
            onChange={handleGoldTypeChange}
            placeholder="Select gold type"
            className="mt-1"
          />
        </div>
      )}

      {category === "silver" && (
        <div>
          <Label htmlFor="silver-type-select" required>
            Silver Type
          </Label>
          <BasicFormSelect
            id="silver-type-select"
            options={SILVER_SELECT_OPTIONS}
            value={currentSilverSymbol}
            onChange={handleSilverTypeChange}
            placeholder="Select silver type"
            className="mt-1"
          />
        </div>
      )}

      {category === "other" && (
        <div>
          <Label htmlFor="symbol-autocomplete-label" required>
            Symbol
          </Label>
          <div id="symbol-autocomplete-label" className="mt-1">
            <SymbolAutocomplete
              value={otherSymbol}
              onChange={handleOtherSymbolChange}
              placeholder="Search for stocks, ETFs, crypto..."
              usePortal
            />
          </div>
          {!otherSymbol && (
            <p className="text-xs text-v2-text-tertiary mt-1">
              Type at least 2 characters to search
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
          label="Price Side"
          options={PRICE_SIDE_OPTIONS}
          required
        />
      )}

      {/* Direction */}
      <FormSelect
        name="direction"
        control={control}
        label="Direction"
        options={DIRECTION_OPTIONS}
        parseAsNumber
        required
      />

      {/* Target Price */}
      <div>
        <FormNumberInput
          name="targetPrice"
          control={control}
          label="Target Price"
          placeholder="0"
          useThousandSeparator
          required
          showRecommendations={false}
        />
        {/* Current price reference note */}
        <p className="text-xs text-v2-text-tertiary mt-1">
          Enter the price that will trigger this alert
        </p>
      </div>

      {/* Trigger Mode */}
      <FormSelect
        name="triggerMode"
        control={control}
        label="Trigger Mode"
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
            label="Cooldown (hours)"
            placeholder="24"
            useThousandSeparator={false}
            min={2}
            max={168}
            required
            showRecommendations={false}
            helperText="Minimum 2 hours, maximum 168 hours (1 week)"
          />
        </div>
      )}

      {/* Note */}
      <FormTextarea
        name="note"
        control={control}
        label="Note"
        placeholder="Optional note..."
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
        Create Alert
      </Button>
    </form>
  );
}
