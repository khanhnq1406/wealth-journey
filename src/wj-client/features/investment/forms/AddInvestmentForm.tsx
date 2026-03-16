"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { RHFFormInput as FormInput } from "@/components/forms/RHFFormInput";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { RHFFormSelect as FormSelect } from "@/components/forms/RHFFormSelect";
import {
  FormSelect as BasicFormSelect,
  SelectOption,
} from "@/components/forms/FormSelect";
import { Success } from "@/components/modals/Success";
import { SymbolAutocomplete } from "@/features/investment/components/SymbolAutocomplete";
import {
  useMutationCreateInvestment,
  useQueryGetMarketPrice,
  EVENT_InvestmentCreateInvestment,
  EVENT_InvestmentListInvestments,
  EVENT_InvestmentGetPortfolioSummary,
  EVENT_InvestmentListUserInvestments,
  EVENT_InvestmentGetAggregatedPortfolioSummary,
  EVENT_WalletListWallets,
} from "@/utils/generated/hooks";
import { InvestmentType, SearchResult } from "@/gen/protobuf/v1/investment";
import { useQueryClient } from "@tanstack/react-query";
import {
  createInvestmentSchema,
  CreateInvestmentFormInput,
} from "@/features/investment/utils/investment-schema";
import { getQuantityInputConfig } from "@/lib/utils/units";
import { Label } from "@/components/forms/Label";
import { ErrorMessage } from "@/components/forms/ErrorMessage";
import { CurrencyBadge } from "@/components/forms/CurrencyBadge";
import {
  isGoldType,
  getGoldTypeOptions,
  type GoldTypeOption,
  type GoldUnit,
  calculateGoldFromUserInput,
} from "@/features/investment/utils/gold-calculator";
import {
  isSilverType,
  getSilverTypeOptions,
  type SilverTypeOption,
  type SilverUnit,
  calculateSilverFromUserInput,
} from "@/features/investment/utils/silver-calculator";

// UI-only type values for merged gold/silver dropdowns
const GOLD_UI_TYPE = "GOLD_MERGED";
const SILVER_UI_TYPE = "SILVER_MERGED";

interface AddInvestmentFormProps {
  onSuccess?: () => void;
}

export function AddInvestmentForm({ onSuccess }: AddInvestmentFormProps) {
  const t = useTranslations("investment");
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>("");

  // UI type tracks the main dropdown selection (includes merged gold/silver values)
  const [selectedUIType, setSelectedUIType] = useState<string>(GOLD_UI_TYPE);

  const investmentTypeOptions = useMemo<SelectOption[]>(
    () => [
      { value: GOLD_UI_TYPE, label: t("typeOptions.gold") },
      { value: SILVER_UI_TYPE, label: t("typeOptions.silver") },
      {
        value: String(InvestmentType.INVESTMENT_TYPE_CASH),
        label: t("typeOptions.cash"),
      },
      {
        value: String(InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY),
        label: t("typeOptions.foreignCurrency"),
      },
      {
        value: String(InvestmentType.INVESTMENT_TYPE_STOCK),
        label: t("typeOptions.stock"),
      },
      {
        value: String(InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY),
        label: t("typeOptions.cryptocurrency"),
      },
      {
        value: String(InvestmentType.INVESTMENT_TYPE_ETF),
        label: t("typeOptions.etf"),
      },
      {
        value: String(InvestmentType.INVESTMENT_TYPE_BOND),
        label: t("typeOptions.bond"),
      },
      {
        value: String(InvestmentType.INVESTMENT_TYPE_COMMODITY),
        label: t("typeOptions.commodity"),
      },
      {
        value: String(InvestmentType.INVESTMENT_TYPE_MUTUAL_FUND),
        label: t("typeOptions.mutualFund"),
      },
      {
        value: String(InvestmentType.INVESTMENT_TYPE_OTHER),
        label: t("typeOptions.other"),
      },
    ],
    [t],
  );

  const [showSuccess, setShowSuccess] = useState(false);
  // Gold-specific state
  const [selectedGoldType, setSelectedGoldType] =
    useState<GoldTypeOption | null>(null);
  const [goldQuantityUnit, setGoldQuantityUnit] = useState<GoldUnit>("tael");

  // Silver-specific state
  const [selectedSilverType, setSelectedSilverType] =
    useState<SilverTypeOption | null>(null);
  const [silverQuantityUnit, setSilverQuantityUnit] =
    useState<SilverUnit>("tael");

  // State for tracking selected symbol and currency (for market price display)
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD");

  // Custom investment toggle state
  const [isCustomInvestment, setIsCustomInvestment] = useState(false);

  // Purchase date state (YYYY-MM-DD string, defaults to today)
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // Price per unit state (replaces total cost input)
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);

  // Derived type flags
  const isGoldInvestment = selectedUIType === GOLD_UI_TYPE;
  const isSilverInvestment = selectedUIType === SILVER_UI_TYPE;
  const isCashOrForeignCurrency =
    selectedUIType === String(InvestmentType.INVESTMENT_TYPE_CASH) ||
    selectedUIType === String(InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY);

  const createInvestmentMutation = useMutationCreateInvestment({
    onSuccess: (data) => {
      setSuccessMessage(data.message || t("errors.createdSuccessfully"));
      setShowSuccess(true);
      // Invalidate queries (both old and new aggregated endpoints)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return [
            EVENT_InvestmentCreateInvestment,
            EVENT_InvestmentListInvestments,
            EVENT_InvestmentGetPortfolioSummary,
            EVENT_InvestmentListUserInvestments,
            EVENT_InvestmentGetAggregatedPortfolioSummary,
            EVENT_WalletListWallets,
          ].includes(key);
        },
      });
    },
    onError: (error: any) => {
      // Parse error message and provide user-friendly alternatives
      let errorMsg = error.message || t("errors.failedToCreate");

      if (
        errorMsg.toLowerCase().includes("duplicate") ||
        errorMsg.toLowerCase().includes("already exists")
      ) {
        errorMsg = t("errors.duplicateSymbol");
      } else if (errorMsg.toLowerCase().includes("currency")) {
        errorMsg = t("errors.invalidCurrency");
      } else if (
        errorMsg.toLowerCase().includes("balance") ||
        errorMsg.toLowerCase().includes("insufficient")
      ) {
        errorMsg = t("errors.insufficientBalance");
      } else if (errorMsg.toLowerCase().includes("symbol")) {
        errorMsg = t("errors.invalidSymbol");
      } else if (errorMsg.toLowerCase().includes("quantity")) {
        errorMsg = t("errors.invalidQuantity");
      } else if (
        errorMsg.toLowerCase().includes("cost") ||
        errorMsg.toLowerCase().includes("price")
      ) {
        errorMsg = t("errors.invalidCost");
      } else if (errorMsg.toLowerCase().includes("wallet")) {
        errorMsg = t("errors.invalidWallet");
      } else if (
        errorMsg.toLowerCase().includes("not found") ||
        errorMsg.toLowerCase().includes("404")
      ) {
        errorMsg = t("errors.resourceNotFound");
      } else if (
        errorMsg.toLowerCase().includes("unauthorized") ||
        errorMsg.toLowerCase().includes("403")
      ) {
        errorMsg = t("errors.unauthorized");
      }

      setErrorMessage(errorMsg);
    },
  });

  const form = useForm<CreateInvestmentFormInput>({
    resolver: zodResolver(createInvestmentSchema),
    defaultValues: {
      symbol: "",
      name: "",
      type: InvestmentType.INVESTMENT_TYPE_GOLD_VND,
      initialQuantity: 0,
      initialCost: 0,
      currency: "VND",
    },
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
    watch,
    setValue,
  } = form;

  // Watch investment type to update quantity input config dynamically
  const investmentType = watch("type");
  const currency = watch("currency");
  const watchedQuantity = watch("initialQuantity");
  const quantityConfig = getQuantityInputConfig(investmentType);

  // Fetch gold market price when gold type is selected
  const goldPriceQuery = useQueryGetMarketPrice(
    {
      symbol: selectedGoldType?.value || "",
      currency: selectedGoldType?.currency || "VND",
      type: Number(investmentType) as InvestmentType,
    },
    {
      enabled: isGoldInvestment && !!selectedGoldType,
      refetchOnMount: "always",
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  );

  // Fetch silver market price when silver type is selected
  const silverPriceQuery = useQueryGetMarketPrice(
    {
      symbol: selectedSilverType?.value || "",
      currency: selectedSilverType?.currency || "VND",
      type: Number(investmentType) as InvestmentType,
    },
    {
      enabled: isSilverInvestment && !!selectedSilverType,
      refetchOnMount: "always",
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  );

  // Fetch market price for standard investments (stocks, crypto, ETF, etc.)
  const isStandardWithSymbol =
    !isGoldInvestment &&
    !isSilverInvestment &&
    !isCustomInvestment &&
    !!selectedSymbol &&
    selectedSymbol.length >= 2;
  const standardPriceQuery = useQueryGetMarketPrice(
    {
      symbol: selectedSymbol,
      currency: selectedCurrency,
      type: Number(investmentType) as InvestmentType,
    },
    {
      enabled: isStandardWithSymbol,
      refetchOnMount: "always",
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  );

  // Get ALL gold type options (no currency filter — show all 19)
  const goldTypeOptions = useMemo(() => {
    if (!isGoldInvestment) return [];
    return getGoldTypeOptions(); // No currency filter
  }, [isGoldInvestment]);

  // Get ALL silver type options (no currency filter — show all)
  const silverTypeOptions = useMemo(() => {
    if (!isSilverInvestment) return [];
    return getSilverTypeOptions(); // No currency filter
  }, [isSilverInvestment]);

  // Update gold quantity unit based on selected gold type
  useEffect(() => {
    if (selectedGoldType) {
      setGoldQuantityUnit(selectedGoldType.unit);
    }
  }, [selectedGoldType]);

  // Reset gold type when investment type changes
  useEffect(() => {
    if (!isGoldInvestment) {
      setSelectedGoldType(null);
    } else {
      // Pre-populate symbol/name to pass Zod validation (real guard is in onSubmit)
      setValue("symbol", "GOLD");
      setValue("name", t("form.defaultGoldName"));
    }
  }, [isGoldInvestment, setValue, t]);

  // Update silver quantity unit based on selected silver type
  useEffect(() => {
    if (selectedSilverType && selectedSilverType.availableUnits.length > 0) {
      setSilverQuantityUnit(selectedSilverType.availableUnits[0]);
    }
  }, [selectedSilverType]);

  // Reset silver type when investment type changes
  useEffect(() => {
    if (!isSilverInvestment) {
      setSelectedSilverType(null);
    } else {
      // Pre-populate symbol/name to pass Zod validation (real guard is in onSubmit)
      setValue("symbol", "SILVER");
      setValue("name", t("form.defaultSilverName"));
    }
  }, [isSilverInvestment, setValue, t]);

  // Handle CASH/FOREIGN_CURRENCY: auto-enable custom mode
  useEffect(() => {
    if (isCashOrForeignCurrency) {
      setIsCustomInvestment(true);
      setValue("type", Number(selectedUIType) as InvestmentType);
    }
  }, [isCashOrForeignCurrency, selectedUIType, setValue]);

  // Auto-fill price per unit from gold market price (use priceDecimal for human-readable display)
  useEffect(() => {
    if (isGoldInvestment && goldPriceQuery.data?.data?.priceDecimal) {
      setPricePerUnit(goldPriceQuery.data.data.priceDecimal);
    }
  }, [isGoldInvestment, goldPriceQuery.data]);

  // Auto-fill price per unit from silver market price (use priceDecimal for human-readable display)
  useEffect(() => {
    if (isSilverInvestment && silverPriceQuery.data?.data?.priceDecimal) {
      setPricePerUnit(silverPriceQuery.data.data.priceDecimal);
    }
  }, [isSilverInvestment, silverPriceQuery.data]);

  // Auto-fill price per unit from standard investment market price
  // Use priceDecimal (human-readable value) since pricePerUnit is displayed directly
  useEffect(() => {
    if (isStandardWithSymbol && standardPriceQuery.data?.data?.priceDecimal) {
      setPricePerUnit(standardPriceQuery.data.data.priceDecimal);
    }
  }, [isStandardWithSymbol, standardPriceQuery.data]);

  // Compute total cost in real time
  const totalCost = useMemo(() => {
    if (watchedQuantity > 0 && pricePerUnit > 0) {
      return watchedQuantity * pricePerUnit;
    }
    return 0;
  }, [watchedQuantity, pricePerUnit]);

  // Sync total cost to form's initialCost field for validation
  useEffect(() => {
    setValue("initialCost", totalCost);
  }, [totalCost, setValue]);

  // Handle UI type dropdown change
  const handleUITypeChange = useCallback(
    (value: string) => {
      setSelectedUIType(value);
      setPricePerUnit(0);
      setSelectedSymbol("");

      if (value === GOLD_UI_TYPE) {
        // Gold: set a default type (GOLD_VND), will be overridden by brand selection
        setValue("type", InvestmentType.INVESTMENT_TYPE_GOLD_VND);
        setIsCustomInvestment(false);
      } else if (value === SILVER_UI_TYPE) {
        // Silver: set a default type (SILVER_VND), will be overridden by brand selection
        setValue("type", InvestmentType.INVESTMENT_TYPE_SILVER_VND);
        setIsCustomInvestment(false);
      } else if (
        value === String(InvestmentType.INVESTMENT_TYPE_CASH) ||
        value === String(InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY)
      ) {
        // Cash/Foreign Currency: auto-enable custom mode
        setValue("type", Number(value) as InvestmentType);
        setIsCustomInvestment(true);
        setValue("symbol", "");
        setValue("name", "");
      } else {
        // Standard types
        setValue("type", Number(value) as InvestmentType);
        setIsCustomInvestment(false);
      }
    },
    [setValue],
  );

  // Handle symbol selection - auto-fill name and currency from search result
  const handleSymbolChange = (symbol: string, result?: SearchResult) => {
    setValue("symbol", symbol);
    setSelectedSymbol(symbol);

    if (result?.name) {
      setValue("name", result.name);
    }
    if (result?.currency) {
      setValue("currency", result.currency);
      setSelectedCurrency(result.currency);
    }
  };

  // Convert purchase date to Unix timestamp
  const getPurchaseDateTs = (): number => {
    if (!purchaseDate) return 0;
    const ts = Math.floor(new Date(purchaseDate).getTime() / 1000);
    return Number.isNaN(ts) ? 0 : ts;
  };

  const isRefreshing =
    (isGoldInvestment && goldPriceQuery.isFetching) ||
    (isSilverInvestment && silverPriceQuery.isFetching) ||
    (isStandardWithSymbol && standardPriceQuery.isFetching);

  const onSubmit = (data: CreateInvestmentFormInput) => {
    setErrorMessage(undefined);
    const purchaseDateTs = getPurchaseDateTs();

    // Validate gold type is selected for gold investments
    if (isGoldInvestment && !selectedGoldType) {
      setErrorMessage(t("form.selectGoldTypeError"));
      return;
    }

    // Validate silver type is selected for silver investments
    if (isSilverInvestment && !selectedSilverType) {
      setErrorMessage(t("form.selectSilverTypeError"));
      return;
    }

    if (isGoldInvestment && selectedGoldType) {
      // Use gold calculator for gold investments
      const formData = form.getValues();
      const goldCalculation = calculateGoldFromUserInput({
        quantity: data.initialQuantity,
        quantityUnit: goldQuantityUnit,
        pricePerUnit: pricePerUnit,
        priceCurrency: formData.currency,
        priceUnit: goldQuantityUnit,
        investmentType: formData.type,
        walletCurrency: formData.currency,
        fxRate: 1,
      });

      createInvestmentMutation.mutate({
        walletId: 0,
        symbol: selectedGoldType.value,
        name: selectedGoldType.label,
        type: formData.type,
        initialQuantityDecimal: goldCalculation.storedQuantity / 10000,
        initialCostDecimal: data.initialQuantity * pricePerUnit,
        currency: formData.currency,
        purchaseUnit: goldQuantityUnit,
        purchaseDate: purchaseDateTs,
        initialQuantity: 0,
        initialCost: 0,
        isCustom: false,
      });
    } else if (isSilverInvestment && selectedSilverType) {
      // Use silver calculator for silver investments
      const formData = form.getValues();
      const silverCalculation = calculateSilverFromUserInput({
        quantity: data.initialQuantity,
        quantityUnit: silverQuantityUnit,
        pricePerUnit: pricePerUnit,
        priceCurrency: formData.currency,
        priceUnit: silverQuantityUnit,
        investmentType: formData.type,
        walletCurrency: formData.currency,
        fxRate: 1,
      });

      createInvestmentMutation.mutate({
        walletId: 0,
        symbol: selectedSilverType.value,
        name: selectedSilverType.label,
        type: formData.type,
        initialQuantityDecimal: silverCalculation.storedQuantity / 10000,
        initialCostDecimal: data.initialQuantity * pricePerUnit,
        currency: formData.currency,
        purchaseUnit: silverCalculation.purchaseUnit,
        purchaseDate: purchaseDateTs,
        initialQuantity: 0,
        initialCost: 0,
        isCustom: false,
      });
    } else {
      // Standard and custom investments (including CASH/FOREIGN_CURRENCY)
      const formData = form.getValues();
      createInvestmentMutation.mutate({
        walletId: 0,
        symbol: (formData.symbol || "").toUpperCase(),
        name: formData.name || "",
        type: formData.type,
        initialQuantityDecimal: data.initialQuantity,
        initialCostDecimal: data.initialQuantity * pricePerUnit,
        currency: formData.currency || "USD",
        purchaseUnit: "gram",
        purchaseDate: purchaseDateTs,
        initialQuantity: 0,
        initialCost: 0,
        isCustom: isCustomInvestment,
      });
    }
  };

  // Show success state (AFTER all hooks have been called)
  if (showSuccess) {
    return <Success message={successMessage} onDone={onSuccess} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Type */}
      <BasicFormSelect
        label={t("form.investmentType")}
        options={investmentTypeOptions}
        value={selectedUIType}
        onChange={handleUITypeChange}
        placeholder={t("form.selectType")}
        disabled={isSubmitting}
        required
      />

      {/* Custom Investment Toggle - shown for non-gold, non-silver, non-cash/forex */}
      {!isGoldInvestment && !isSilverInvestment && !isCashOrForeignCurrency && (
        <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isCustomInvestment}
              onChange={(e) => {
                setIsCustomInvestment(e.target.checked);
                // Clear symbol when toggling, but keep currency valid
                if (e.target.checked) {
                  setValue("symbol", "");
                  setSelectedSymbol("");
                } else {
                  // Reset to default when unchecked
                  setValue("currency", "USD");
                  setSelectedCurrency("USD");
                }
              }}
              className="w-4 h-4 text-v2-red-primary border-gray-300 rounded focus:ring-v2-red-primary"
            />
            <div className="flex-1">
              <span className="font-medium text-gray-900">
                {t("form.isCustom")}
              </span>
              <p className="text-sm text-gray-500">
                {t("form.customInvestmentDescription")}
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Symbol - hidden for gold and silver investments (auto-populated from type) */}
      {!isGoldInvestment && !isSilverInvestment && (
        <div className="mb-4">
          <Label htmlFor="symbol" required>
            Symbol
          </Label>
          {!isCustomInvestment ? (
            // Autocomplete for regular investments
            <>
              <SymbolAutocomplete
                value={watch("symbol")}
                onChange={handleSymbolChange}
                placeholder={t("form.searchSymbolPlaceholder")}
                className="mt-1"
              />
              {errors.symbol && (
                <ErrorMessage id="symbol-error">
                  {errors.symbol.message}
                </ErrorMessage>
              )}
              {/* Market price display for standard investments */}
              {isStandardWithSymbol && standardPriceQuery.isLoading && (
                <p className="text-xs text-gray-400 mt-2 ml-1">
                  {t("form.loadingPrice")}
                </p>
              )}
              {isStandardWithSymbol && standardPriceQuery.isError && (
                <p className="text-xs text-red-500 mt-2 ml-1">
                  {t("form.unableToFetchPrice")}
                </p>
              )}
            </>
          ) : (
            // Manual input for custom investments (including CASH/FOREIGN_CURRENCY)
            <>
              <FormInput
                name="symbol"
                control={control}
                label=""
                placeholder="e.g., MY-CUSTOM-ASSET"
                required
                disabled={isSubmitting}
                className="mt-1"
              />
              {errors.symbol && (
                <ErrorMessage id="symbol-error">
                  {errors.symbol.message}
                </ErrorMessage>
              )}
              <p className="text-xs text-gray-500 mt-1 ml-1">
                {t("form.customSymbolInfo")}
              </p>
              {/* Info box for custom investments */}
              <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-sm text-blue-800">
                  {t("form.customPriceNote")}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Name - hidden for gold and silver investments (auto-populated from type) */}
      {!isGoldInvestment && !isSilverInvestment && (
        <FormInput
          name="name"
          control={control}
          label={t("form.nameLabel")}
          placeholder={t("form.investmentNamePlaceholder")}
          required
          disabled={isSubmitting}
        />
      )}

      {/* Gold Type Selector - shown only for gold investments */}
      {isGoldInvestment && (
        <div className="mb-4">
          <BasicFormSelect
            label={t("form.goldTypeLabel")}
            options={goldTypeOptions.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
            value={selectedGoldType?.value}
            onChange={(value) => {
              const selected = goldTypeOptions.find(
                (opt) => opt.value === value,
              );
              if (selected) {
                setSelectedGoldType(selected);
                setValue("symbol", selected.value);
                setValue("name", selected.label);
                // Set the actual proto type based on the brand's currency
                setValue("type", selected.type as InvestmentType);
                setValue("currency", selected.currency);
              }
            }}
            placeholder={t("form.selectGoldTypePlaceholder")}
            disabled={isSubmitting}
            required
          />
          {selectedGoldType && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-500 ml-1">
                {t("form.goldUnitCurrencyInfo", {
                  unit: selectedGoldType.unit,
                  currency: selectedGoldType.currency,
                })}
              </p>
              {/* Market Price Display */}
              {goldPriceQuery.isLoading && (
                <p className="text-xs text-gray-400 ml-1">
                  {t("form.loadingPrice")}
                </p>
              )}
              {goldPriceQuery.isError && (
                <p className="text-xs text-red-500 ml-1">
                  {t("form.unableToFetchPrice")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Silver Type Selector - shown only for silver investments */}
      {isSilverInvestment && (
        <div className="mb-4">
          <BasicFormSelect
            label={t("form.silverTypeLabel")}
            options={silverTypeOptions.map((opt: SilverTypeOption) => ({
              value: opt.value,
              label: opt.label,
            }))}
            value={selectedSilverType?.value}
            onChange={(value) => {
              const selected = silverTypeOptions.find(
                (opt: SilverTypeOption) => opt.value === value,
              );
              if (selected) {
                setSelectedSilverType(selected);
                setValue("symbol", selected.value);
                setValue("name", selected.label);
                // Set the actual proto type based on the brand's type
                setValue("type", selected.type as InvestmentType);
                setValue("currency", selected.currency);
                // Reset quantity unit to first available unit for this type
                if (selected.availableUnits.length > 0) {
                  setSilverQuantityUnit(selected.availableUnits[0]);
                }
              }
            }}
            placeholder={t("form.selectSilverTypePlaceholder")}
            disabled={isSubmitting}
            required
          />
          {selectedSilverType && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-500 ml-1">
                {t("form.silverCurrencyInfo", {
                  currency: selectedSilverType.currency,
                })}
              </p>
              {/* Market Price Display */}
              {silverPriceQuery.isLoading && (
                <p className="text-xs text-gray-400 ml-1">
                  {t("form.loadingPrice")}
                </p>
              )}
              {silverPriceQuery.isError && (
                <p className="text-xs text-red-500 ml-1">
                  {t("form.unableToFetchPrice")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Initial Quantity */}
      <div>
        {isGoldInvestment ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Label htmlFor="initialQuantity" required>
                {t("form.quantity")}
              </Label>
            </div>
            <FormNumberInput
              name="initialQuantity"
              control={control}
              label=""
              placeholder={`e.g., ${goldQuantityUnit === "tael" ? "2.5" : "100"}`}
              required
              disabled={isSubmitting}
              min={0}
              step="0.01"
              showRecommendations={false}
            />
            <p className="text-xs text-gray-500 -mt-2 ml-1">
              {t("form.amountOfGold", {
                unit:
                  goldQuantityUnit === "tael"
                    ? t("form.taelUnitLong")
                    : goldQuantityUnit === "oz"
                      ? "oz"
                      : t("form.gramUnit"),
              })}
            </p>
          </>
        ) : isSilverInvestment ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col">
              <Label htmlFor="initialQuantity" required>
                {t("form.quantity")}
              </Label>
              <FormNumberInput
                name="initialQuantity"
                control={control}
                label=""
                placeholder={`e.g., ${silverQuantityUnit === "tael" ? "2.5" : silverQuantityUnit === "kg" ? "1" : "10"}`}
                required
                disabled={isSubmitting}
                min={0}
                step="0.01"
                className="mt-1"
                showRecommendations={false}
              />
              <p className="text-xs text-gray-500 -mt-2 ml-1">
                {t("form.amountOfSilver", {
                  unit:
                    silverQuantityUnit === "tael"
                      ? t("form.taelUnitLong")
                      : silverQuantityUnit === "kg"
                        ? t("form.kgUnit")
                        : silverQuantityUnit === "oz"
                          ? "oz"
                          : t("form.gramUnit"),
                })}
              </p>
            </div>

            {/* Unit selector for silver - only show for VND silver which has multiple units */}
            {selectedSilverType?.currency === "VND" &&
              selectedSilverType?.availableUnits &&
              selectedSilverType.availableUnits.length > 1 && (
                <div>
                  <BasicFormSelect
                    label={t("form.unitLabel")}
                    options={selectedSilverType.availableUnits.map(
                      (unit: SilverUnit) => ({
                        value: unit,
                        label:
                          unit === "tael"
                            ? t("form.taelUnit")
                            : unit === "kg"
                              ? t("form.kgUnit")
                              : unit,
                      }),
                    )}
                    value={silverQuantityUnit}
                    onChange={(value) =>
                      setSilverQuantityUnit(value as SilverUnit)
                    }
                    disabled={isSubmitting}
                    required
                    containerClassName="w-40"
                  />
                </div>
              )}
          </div>
        ) : (
          <>
            <FormNumberInput
              name="initialQuantity"
              control={control}
              label={t("form.initialQuantityLabel")}
              placeholder={quantityConfig.placeholder}
              required
              disabled={isSubmitting}
              min={0}
              step={quantityConfig.step}
            />
            <p className="text-xs text-gray-500 mt-1 -mb-3 ml-1">
              {t("form.quantityHint")}
            </p>
          </>
        )}
      </div>

      {/* Purchase Date */}
      <div>
        <Label htmlFor="purchaseDate">{t("form.purchaseDate")}</Label>
        <input
          type="date"
          id="purchaseDate"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-bg focus:border-bg text-sm"
          disabled={isSubmitting}
        />
        <p className="text-xs text-gray-500 mt-1 ml-1">
          {t("form.purchaseDateHint")}
        </p>
      </div>

      {/* Currency Input - shown for custom investments before Price Per Unit */}
      {!isGoldInvestment && !isSilverInvestment && isCustomInvestment && (
        <FormSelect
          name="currency"
          control={control}
          label={t("form.currencyLabel")}
          options={[
            { value: "USD", label: "USD - US Dollar" },
            { value: "VND", label: "VND - Vietnamese Dong" },
            { value: "EUR", label: "EUR - Euro" },
            { value: "GBP", label: "GBP - British Pound" },
            { value: "JPY", label: "JPY - Japanese Yen" },
            { value: "CNY", label: "CNY - Chinese Yuan" },
            { value: "KRW", label: "KRW - South Korean Won" },
            { value: "SGD", label: "SGD - Singapore Dollar" },
          ]}
          required
          disabled={isSubmitting}
          className="mb-4"
          portal
        />
      )}

      {/* Price Per Unit + Refresh Button */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Label htmlFor="pricePerUnit" required>
            {t("form.pricePerUnitLabel")}
          </Label>
          {/* CurrencyBadge - hidden for custom investments (manual select above) */}
          {!isCustomInvestment && (
            <CurrencyBadge
              value={currency}
              onChange={(newCurrency) => setValue("currency", newCurrency)}
              disabled={isSubmitting || isGoldInvestment || isSilverInvestment}
            />
          )}
          {/* Display only badge for custom investments */}
          {isCustomInvestment && (
            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
              {currency || "USD"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <input
              type="number"
              id="pricePerUnit"
              value={pricePerUnit || ""}
              onChange={(e) => setPricePerUnit(Number(e.target.value) || 0)}
              placeholder="0.00"
              min={0}
              step="0.01"
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-bg focus:border-bg text-sm"
            />
          </div>
          {/* Refresh button - for gold/silver/standard investments with symbol */}
          {(isGoldInvestment || isSilverInvestment || isStandardWithSymbol) && (
            <button
              type="button"
              onClick={() => {
                if (isGoldInvestment) goldPriceQuery.refetch();
                else if (isSilverInvestment) silverPriceQuery.refetch();
                else if (isStandardWithSymbol) standardPriceQuery.refetch();
              }}
              disabled={isRefreshing}
              className="px-3 py-2 text-sm font-medium text-bg bg-green-50 border border-bg rounded-md hover:bg-green-100 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
            >
              {isRefreshing
                ? t("form.refreshingPrice")
                : t("form.refreshPrice")}
            </button>
          )}
        </div>
        {/* Total cost summary — pricePerUnit is human-readable, so totalCost is too */}
        {watchedQuantity > 0 && pricePerUnit > 0 && (
          <p className="text-sm font-medium text-gray-700 mt-2">
            {t("form.totalCostSummary", {
              amount: new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: currency || "USD",
                minimumFractionDigits: currency === "VND" || currency === "JPY" || currency === "KRW" ? 0 : 2,
                maximumFractionDigits: currency === "VND" || currency === "JPY" || currency === "KRW" ? 0 : 2,
              }).format(totalCost),
            })}
          </p>
        )}
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-50 border border-danger-600 text-danger-600 px-4 py-3 rounded">
          {errorMessage}
        </div>
      )}

      {/* Submit button */}
      <Button
        type={ButtonType.PRIMARY}
        loading={createInvestmentMutation.isPending || isSubmitting}
        className="w-full"
        htmlType="submit"
      >
        Add Investment
      </Button>
    </form>
  );
}
