"use client";

import { useState, useMemo, useEffect } from "react";
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
import { MarketPriceDisplay } from "@/components/forms/MarketPriceDisplay";
import {
  useMutationCreateInvestment,
  useQueryListWallets,
  useQueryGetMarketPrice,
  EVENT_InvestmentCreateInvestment,
  EVENT_InvestmentListInvestments,
  EVENT_InvestmentGetPortfolioSummary,
  EVENT_InvestmentListUserInvestments,
  EVENT_InvestmentGetAggregatedPortfolioSummary,
  EVENT_WalletListWallets,
} from "@/utils/generated/hooks";
import { WalletType } from "@/gen/protobuf/v1/wallet";
import { InvestmentType, SearchResult } from "@/gen/protobuf/v1/investment";
import { useQueryClient } from "@tanstack/react-query";
import {
  createInvestmentSchema,
  CreateInvestmentFormInput,
} from "@/features/investment/utils/investment-schema";
import {
  quantityToStorage,
  amountToSmallestUnit,
  getQuantityInputConfig,
  formatCurrency,
} from "@/lib/utils/units";
import { Label } from "@/components/forms/Label";
import { ErrorMessage } from "@/components/forms/ErrorMessage";
import { CurrencyBadge } from "@/components/forms/CurrencyBadge";
import {
  useExchangeRate,
  convertAmount,
  formatExchangeRate,
} from "@/hooks/useExchangeRate";
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
import { useCurrency } from "@/contexts/CurrencyContext";

interface AddInvestmentFormProps {
  walletId?: number; // Optional: if not provided, user must select from dropdown
  walletBalance?: number; // Wallet balance in smallest currency unit
  walletCurrency?: string; // Currency of the wallet (ISO 4217)
  onSuccess?: () => void;
}

const investmentTypeOptions: SelectOption[] = [
  { value: String(InvestmentType.INVESTMENT_TYPE_STOCK), label: "Stock" },
  { value: String(InvestmentType.INVESTMENT_TYPE_ETF), label: "ETF" },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_MUTUAL_FUND),
    label: "Mutual Fund",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY),
    label: "Cryptocurrency",
  },
  { value: String(InvestmentType.INVESTMENT_TYPE_BOND), label: "Bond" },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_COMMODITY),
    label: "Commodity",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_GOLD_VND),
    label: "Gold (Vietnam)",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_GOLD_USD),
    label: "Gold (World)",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_SILVER_VND),
    label: "Silver (Vietnam)",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_SILVER_USD),
    label: "Silver (World)",
  },
  { value: String(InvestmentType.INVESTMENT_TYPE_OTHER), label: "Other" },
];

export function AddInvestmentForm({
  walletId: propWalletId,
  walletBalance: propWalletBalance,
  walletCurrency: propWalletCurrency,
  onSuccess,
}: AddInvestmentFormProps) {
  const queryClient = useQueryClient();
  const { currency: preferredCurrency } = useCurrency();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  // Local wallet selection state (used when walletId not provided)
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(
    propWalletId ?? null,
  );
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

  // Fetch user's wallets if walletId not provided
  const getListWallets = useQueryListWallets(
    {
      pagination: {
        page: 1,
        pageSize: 100,
        orderBy: "created_at",
        order: "desc",
      },
    },
    {
      refetchOnMount: "always",
      enabled: propWalletId === undefined, // Only fetch if no wallet provided
    },
  );

  // Filter for investment wallets
  const investmentWallets = useMemo(() => {
    if (!getListWallets.data?.wallets) return [];
    return getListWallets.data.wallets.filter(
      (wallet) => wallet.type === WalletType.INVESTMENT,
    );
  }, [getListWallets.data]);

  // Determine the active wallet ID (either from props or from selector)
  const walletId = propWalletId ?? selectedWalletId;

  // Get wallet balance and currency from selected wallet or props
  const walletBalance = useMemo(() => {
    if (propWalletBalance !== undefined) return propWalletBalance;
    if (!walletId) return 0;
    const wallet = investmentWallets.find((w) => w.id === walletId);
    return wallet?.balance?.amount || 0;
  }, [propWalletBalance, walletId, investmentWallets]);

  const walletCurrency = useMemo(() => {
    if (propWalletCurrency !== undefined) return propWalletCurrency;
    if (!walletId) return "USD";
    const wallet = investmentWallets.find((w) => w.id === walletId);
    return wallet?.balance?.currency || "USD";
  }, [propWalletCurrency, walletId, investmentWallets]);

  const createInvestmentMutation = useMutationCreateInvestment({
    onSuccess: (data) => {
      setSuccessMessage(data.message || "Investment created successfully");
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
      let errorMsg = error.message || "Failed to create investment";

      if (
        errorMsg.toLowerCase().includes("duplicate") ||
        errorMsg.toLowerCase().includes("already exists")
      ) {
        errorMsg =
          "An investment with this symbol already exists in this wallet";
      } else if (errorMsg.toLowerCase().includes("currency")) {
        errorMsg = "Invalid currency code. Please select a valid currency";
      } else if (
        errorMsg.toLowerCase().includes("balance") ||
        errorMsg.toLowerCase().includes("insufficient")
      ) {
        errorMsg = "Insufficient wallet balance for this investment";
      } else if (errorMsg.toLowerCase().includes("symbol")) {
        errorMsg = "Invalid symbol format. Please check and try again";
      } else if (errorMsg.toLowerCase().includes("quantity")) {
        errorMsg = "Invalid quantity. Please enter a valid positive number";
      } else if (
        errorMsg.toLowerCase().includes("cost") ||
        errorMsg.toLowerCase().includes("price")
      ) {
        errorMsg = "Invalid cost amount. Please enter a valid positive number";
      } else if (errorMsg.toLowerCase().includes("wallet")) {
        errorMsg = "Invalid wallet or wallet not found";
      } else if (
        errorMsg.toLowerCase().includes("not found") ||
        errorMsg.toLowerCase().includes("404")
      ) {
        errorMsg = "Resource not found. Please try again";
      } else if (
        errorMsg.toLowerCase().includes("unauthorized") ||
        errorMsg.toLowerCase().includes("403")
      ) {
        errorMsg = "You don't have permission to perform this action";
      }

      setErrorMessage(errorMsg);
    },
  });

  const form = useForm<CreateInvestmentFormInput>({
    resolver: zodResolver(createInvestmentSchema),
    defaultValues: {
      symbol: "",
      name: "",
      type: InvestmentType.INVESTMENT_TYPE_STOCK,
      initialQuantity: 0,
      initialCost: 0,
      currency: "USD",
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
  const initialCost = watch("initialCost");
  const quantityConfig = getQuantityInputConfig(investmentType);

  // Check if current investment type is gold (convert to number for comparison)
  const isGoldInvestment = isGoldType(Number(investmentType));

  // Check if current investment type is silver (cast to InvestmentType enum)
  const isSilverInvestment = isSilverType(
    Number(investmentType) as InvestmentType,
  );

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

  // Get gold type options based on investment type (not currency field)
  const goldTypeOptions = useMemo(() => {
    if (!isGoldInvestment) return [];
    // Determine currency from investment type: GOLD_VND → VND, GOLD_USD → USD
    const goldCurrency =
      Number(investmentType) === InvestmentType.INVESTMENT_TYPE_GOLD_VND
        ? "VND"
        : "USD";
    return getGoldTypeOptions(goldCurrency);
  }, [isGoldInvestment, investmentType]);

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
      // Auto-set currency based on gold investment type
      const targetCurrency =
        Number(investmentType) === InvestmentType.INVESTMENT_TYPE_GOLD_VND
          ? "VND"
          : "USD";
      setValue("currency", targetCurrency);
      // Pre-populate symbol/name to pass Zod validation (real guard is in onSubmit)
      setValue("symbol", "GOLD");
      setValue("name", "Gold Investment");
    }
  }, [isGoldInvestment, investmentType, setValue]);

  // Get silver type options based on investment type
  const silverTypeOptions = useMemo(() => {
    if (!isSilverInvestment) return [];
    // Determine currency from investment type: SILVER_VND → VND, SILVER_USD → USD
    const silverCurrency =
      Number(investmentType) === InvestmentType.INVESTMENT_TYPE_SILVER_VND
        ? "VND"
        : "USD";
    return getSilverTypeOptions(silverCurrency);
  }, [isSilverInvestment, investmentType]);

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
      // Auto-set currency based on silver investment type
      const targetCurrency =
        Number(investmentType) === InvestmentType.INVESTMENT_TYPE_SILVER_VND
          ? "VND"
          : "USD";
      setValue("currency", targetCurrency);
      // Pre-populate symbol/name to pass Zod validation (real guard is in onSubmit)
      setValue("symbol", "SILVER");
      setValue("name", "Silver Investment");
    }
  }, [isSilverInvestment, investmentType, setValue]);

  // Fetch exchange rate when currencies differ
  const currenciesMatch = currency === walletCurrency;
  const { rate: exchangeRate, isLoading: isLoadingRate } = useExchangeRate(
    walletCurrency,
    currency,
  );

  // Fetch exchange rate from wallet currency to preferred currency for display
  const { rate: walletToPreferredRate } = useExchangeRate(
    walletCurrency,
    preferredCurrency,
  );

  // Convert wallet balance to preferred currency for display
  const walletBalanceInPreferredCurrency = useMemo(() => {
    if (walletCurrency === preferredCurrency || !walletToPreferredRate) {
      return walletBalance;
    }
    return convertAmount(
      walletBalance,
      walletToPreferredRate,
      walletCurrency,
      preferredCurrency,
    );
  }, [walletBalance, walletToPreferredRate, walletCurrency, preferredCurrency]);

  // Calculate initial cost in smallest unit for balance validation
  const initialCostInSmallestUnit = useMemo(() => {
    return amountToSmallestUnit(Number(initialCost) || 0, currency);
  }, [initialCost, currency]);

  // Convert wallet balance to investment currency for comparison
  const walletBalanceInInvestmentCurrency = useMemo(() => {
    if (currenciesMatch || !exchangeRate) {
      return walletBalance;
    }
    return convertAmount(walletBalance, exchangeRate, walletCurrency, currency);
  }, [walletBalance, exchangeRate, walletCurrency, currency, currenciesMatch]);

  // Check for insufficient balance (with currency conversion when needed)
  useEffect(() => {
    if (currenciesMatch) {
      setInsufficientBalance(
        initialCostInSmallestUnit > walletBalance && walletBalance > 0,
      );
    } else if (exchangeRate) {
      // Compare in investment currency
      setInsufficientBalance(
        initialCostInSmallestUnit > walletBalanceInInvestmentCurrency &&
          walletBalance > 0,
      );
    } else {
      // No rate available yet, don't block submission
      setInsufficientBalance(false);
    }
  }, [
    initialCostInSmallestUnit,
    walletBalance,
    walletBalanceInInvestmentCurrency,
    currenciesMatch,
    exchangeRate,
  ]);

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

  const onSubmit = (data: CreateInvestmentFormInput) => {
    setErrorMessage(undefined);

    // Validate wallet is selected
    if (!walletId) {
      setErrorMessage("Please select a wallet");
      return;
    }

    // Validate gold type is selected for gold investments
    if (isGoldInvestment && !selectedGoldType) {
      setErrorMessage("Please select a gold type");
      return;
    }

    // Validate silver type is selected for silver investments
    if (isSilverInvestment && !selectedSilverType) {
      setErrorMessage("Please select a silver type");
      return;
    }

    if (isGoldInvestment && selectedGoldType) {
      // Use gold calculator for gold investments
      const formData = form.getValues();
      const goldCalculation = calculateGoldFromUserInput({
        quantity: data.initialQuantity,
        quantityUnit: goldQuantityUnit,
        pricePerUnit: data.initialCost / data.initialQuantity, // Calculate price per unit
        priceCurrency: formData.currency,
        priceUnit: goldQuantityUnit,
        investmentType: formData.type,
        walletCurrency: walletCurrency,
        fxRate: exchangeRate || 1,
      });

      createInvestmentMutation.mutate({
        walletId,
        symbol: selectedGoldType.value,
        name: selectedGoldType.label,
        type: formData.type,
        initialQuantityDecimal: goldCalculation.storedQuantity / 10000, // Convert storage format (grams×10000) to decimal (grams)
        initialCostDecimal: data.initialCost, // Send decimal value in the user's input currency
        currency: formData.currency, // Send the currency the user actually paid in (NOT wallet currency)
        purchaseUnit: goldQuantityUnit, // Store user's purchase unit for display
        // Set int64 fields to 0 (decimal fields take precedence)
        initialQuantity: 0,
        initialCost: 0,
        isCustom: false, // Gold investments are never custom
      });
    } else if (isSilverInvestment && selectedSilverType) {
      // Use silver calculator for silver investments
      const formData = form.getValues();
      const silverCalculation = calculateSilverFromUserInput({
        quantity: data.initialQuantity,
        quantityUnit: silverQuantityUnit,
        pricePerUnit: data.initialCost / data.initialQuantity, // Calculate price per unit
        priceCurrency: formData.currency,
        priceUnit: silverQuantityUnit,
        investmentType: formData.type,
        walletCurrency: walletCurrency,
        fxRate: exchangeRate || 1,
      });

      // Use full symbol with unit suffix to allow multiple VND silver investments (tael and kg)
      createInvestmentMutation.mutate({
        walletId,
        symbol: selectedSilverType.value, // Keep unit suffix: AG_VND_Tael or AG_VND_Kg
        name: selectedSilverType.label,
        type: formData.type,
        initialQuantityDecimal: silverCalculation.storedQuantity / 10000, // Convert storage format (grams×10000 or oz×10000) to decimal
        initialCostDecimal: data.initialCost, // Send decimal value in the user's input currency
        currency: formData.currency, // Send the currency the user actually paid in (NOT wallet currency)
        purchaseUnit: silverCalculation.purchaseUnit, // Store user's purchase unit for display
        // Set int64 fields to 0 (decimal fields take precedence)
        initialQuantity: 0,
        initialCost: 0,
        isCustom: false, // Silver investments are never custom
      });
    } else {
      // Convert to API format using utility functions for non-gold, non-silver investments
      // Use form.getValues() instead of data because zodResolver may return partial data on validation failure
      const formData = form.getValues();
      createInvestmentMutation.mutate({
        walletId,
        symbol: (formData.symbol || "").toUpperCase(),
        name: formData.name || "",
        type: formData.type,
        initialQuantityDecimal: data.initialQuantity, // Send decimal value
        initialCostDecimal: data.initialCost, // Send decimal value
        currency: formData.currency || "USD",
        purchaseUnit: "gram", // Default unit for non-gold, non-silver investments
        // Set int64 fields to 0 (decimal fields take precedence)
        initialQuantity: 0,
        initialCost: 0,
        isCustom: isCustomInvestment, // Set custom flag based on toggle
      });
    }
  };

  // Build wallet options for selector
  const walletSelectOptions = useMemo((): SelectOption[] => {
    return investmentWallets.map((wallet) => {
      const balance = wallet.balance?.amount || 0;
      const currency = wallet.balance?.currency || "USD";
      const formattedBalance = formatCurrency(balance, currency);
      return {
        value: String(wallet.id),
        label: `${wallet.walletName} (${formattedBalance})`,
      };
    });
  }, [investmentWallets]);

  // Show success state (AFTER all hooks have been called)
  if (showSuccess) {
    return <Success message={successMessage} onDone={onSuccess} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Wallet Selector - only shown when walletId not provided */}
      {propWalletId === undefined && (
        <div className="mb-4">
          <BasicFormSelect
            label="Investment Wallet"
            options={walletSelectOptions}
            value={selectedWalletId ? String(selectedWalletId) : undefined}
            onChange={(value) => setSelectedWalletId(parseInt(value, 10))}
            placeholder="Select investment wallet"
            disabled={isSubmitting || getListWallets.isLoading}
            required
          />
          {!walletId && (
            <ErrorMessage id="wallet-error">
              Please select a wallet
            </ErrorMessage>
          )}
        </div>
      )}

      {/* Type */}
      <FormSelect
        name="type"
        control={control}
        label="Investment Type"
        options={investmentTypeOptions}
        placeholder="Select investment type"
        required
        disabled={isSubmitting}
        className="mb-4"
        parseAsNumber={true}
      />

      {/* Custom Investment Toggle - shown only for non-gold, non-silver investments */}
      {!isGoldInvestment && !isSilverInvestment && (
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
              className="w-4 h-4 text-bg border-gray-300 rounded focus:ring-bg"
            />
            <div className="flex-1">
              <span className="font-medium text-gray-900">
                Custom Investment
              </span>
              <p className="text-sm text-gray-500">
                Create investment for assets not available in market data
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
                placeholder="Search for stocks, ETFs, crypto (e.g., AAPL, BTC, VTI)..."
                // disabled={isSubmitting}
                className="mt-1"
              />
              {errors.symbol && (
                <ErrorMessage id="symbol-error">
                  {errors.symbol.message}
                </ErrorMessage>
              )}
              {/* Market price display */}
              {selectedSymbol && selectedSymbol.length >= 2 && (
                <MarketPriceDisplay
                  symbol={selectedSymbol}
                  currency={selectedCurrency}
                  investmentType={Number(watch("type")) as InvestmentType}
                  className="mt-2"
                />
              )}
            </>
          ) : (
            // Manual input for custom investments
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
                Enter a unique identifier for your custom investment
              </p>
              {/* Info box for custom investments */}
              <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Custom investments don&apos;t have
                  market prices. You can set the price manually after creation.
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
          label="Name"
          placeholder="Apple Inc., Bitcoin, Vanguard Total Stock Market ETF..."
          required
          disabled={isSubmitting}
        />
      )}

      {/* Gold Type Selector - shown only for gold investments */}
      {isGoldInvestment && (
        <div className="mb-4">
          <BasicFormSelect
            label="Gold Type"
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
                // Currency is already set based on investment type, no need to override
              }
            }}
            placeholder="Select gold type (SJC, XAU, etc.)"
            disabled={isSubmitting}
            required
          />
          {selectedGoldType && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-500 ml-1">
                Unit: {selectedGoldType.unit} | Currency:{" "}
                {selectedGoldType.currency}
              </p>
              {/* Market Price Display */}
              {goldPriceQuery.isLoading && (
                <p className="text-xs text-gray-400 ml-1">Loading price...</p>
              )}
              {goldPriceQuery.data?.data && (
                <div className="p-2 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm font-medium text-green-900">
                    Current Market Price:{" "}
                    {formatCurrency(
                      goldPriceQuery.data.data.price,
                      goldPriceQuery.data.data.currency,
                    )}
                    /{selectedGoldType.unit}
                  </p>
                  {goldPriceQuery.data.data.isCached && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      (Cached price)
                    </p>
                  )}
                </div>
              )}
              {goldPriceQuery.isError && (
                <p className="text-xs text-red-500 ml-1">
                  Unable to fetch price
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
            label="Silver Type"
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
                // Reset quantity unit to first available unit for this type
                if (selected.availableUnits.length > 0) {
                  setSilverQuantityUnit(selected.availableUnits[0]);
                }
              }
            }}
            placeholder="Select silver type (AG_VND, XAG, etc.)"
            disabled={isSubmitting}
            required
          />
          {selectedSilverType && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-500 ml-1">
                Currency: {selectedSilverType.currency}
              </p>
              {/* Market Price Display */}
              {silverPriceQuery.isLoading && (
                <p className="text-xs text-gray-400 ml-1">Loading price...</p>
              )}
              {silverPriceQuery.data?.data && (
                <div className="p-2 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm font-medium text-green-900">
                    Current Market Price:{" "}
                    {formatCurrency(
                      silverPriceQuery.data.data.price,
                      silverPriceQuery.data.data.currency,
                    )}
                    /{selectedSilverType.availableUnits[0] || "unit"}
                  </p>
                  {silverPriceQuery.data.data.isCached && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      (Cached price)
                    </p>
                  )}
                </div>
              )}
              {silverPriceQuery.isError && (
                <p className="text-xs text-red-500 ml-1">
                  Unable to fetch price
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
                Quantity
              </Label>
              {/* {selectedGoldType?.currency === "VND" && (
                <Select
                  options={[
                    { value: "tael", label: "Tael (lượng)" },
                    { value: "gram", label: "Gram (g)" },
                  ]}
                  value={goldQuantityUnit}
                  onChange={(value) => setGoldQuantityUnit(value as GoldUnit)}
                  disabled={isSubmitting}
                  className="w-40"
                />
              )} */}
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
              Amount of gold in{" "}
              {goldQuantityUnit === "tael"
                ? "taels (lượng)"
                : goldQuantityUnit === "oz"
                  ? "oz"
                  : "grams"}
            </p>
          </>
        ) : isSilverInvestment ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col">
              <Label htmlFor="initialQuantity" required>
                Quantity
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
                Amount of silver in{" "}
                {silverQuantityUnit === "tael"
                  ? "taels (lượng)"
                  : silverQuantityUnit === "kg"
                    ? "kg"
                    : silverQuantityUnit === "oz"
                      ? "oz"
                      : "grams"}
              </p>
            </div>

            {/* Unit selector for silver - only show for VND silver which has multiple units */}
            {selectedSilverType?.currency === "VND" &&
              selectedSilverType?.availableUnits &&
              selectedSilverType.availableUnits.length > 1 && (
                <div>
                  <BasicFormSelect
                    label="Unit"
                    options={selectedSilverType.availableUnits.map(
                      (unit: SilverUnit) => ({
                        value: unit,
                        label:
                          unit === "tael"
                            ? "Tael (lượng)"
                            : unit === "kg"
                              ? "Kg"
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
              label="Initial Quantity"
              placeholder={quantityConfig.placeholder}
              required
              disabled={isSubmitting}
              min={0}
              step={quantityConfig.step}
            />
            <p className="text-xs text-gray-500 mt-1 -mb-3 ml-1">
              Number of shares, coins, or units you hold
            </p>
          </>
        )}
      </div>

      {/* Currency Input - shown for custom investments before Initial Cost */}
      {!isGoldInvestment && !isSilverInvestment && isCustomInvestment && (
        <FormSelect
          name="currency"
          control={control}
          label="Currency"
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
        />
      )}

      {/* Initial Cost */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Label htmlFor="initialCost" required>
            Total Initial Cost
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
        <FormNumberInput
          name="initialCost"
          control={control}
          placeholder="15000.00"
          required
          disabled={isSubmitting}
          min={0}
          step="0.01"
        />
        <p className="text-xs text-gray-500 mt-1 -mb-3 ml-1">
          Total amount paid to acquire this investment (including fees)
        </p>
      </div>

      {/* Balance Preview - same currency */}
      {walletBalance > 0 && currenciesMatch && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <div className="flex justify-between text-sm">
            <span>Wallet Balance:</span>
            <span>
              {formatCurrency(
                walletBalanceInPreferredCurrency,
                preferredCurrency,
              )}
              {walletCurrency !== preferredCurrency &&
                walletToPreferredRate && (
                  <span className="text-gray-500 ml-1">
                    ({formatCurrency(walletBalance, walletCurrency)})
                  </span>
                )}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Initial Cost:</span>
            <span className="text-red-600">
              -
              {currency
                ? formatCurrency(initialCostInSmallestUnit, currency)
                : `${(initialCostInSmallestUnit / 100).toFixed(2)}`}
            </span>
          </div>
          <hr className="my-2" />
          <div className="flex justify-between font-medium">
            <span>Remaining:</span>
            <span
              className={
                walletBalance - initialCostInSmallestUnit < 0
                  ? "text-red-600"
                  : "text-green-600"
              }
            >
              {formatCurrency(
                walletBalance - initialCostInSmallestUnit,
                currency,
              )}
            </span>
          </div>
        </div>
      )}

      {/* Balance Preview - different currencies with conversion */}
      {walletBalance > 0 && !currenciesMatch && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <div className="flex justify-between text-sm">
            <span>Wallet Balance:</span>
            <span>
              {formatCurrency(
                walletBalanceInPreferredCurrency,
                preferredCurrency,
              )}
              {walletCurrency !== preferredCurrency &&
                walletToPreferredRate && (
                  <span className="text-gray-500 ml-1">
                    ({formatCurrency(walletBalance, walletCurrency)})
                  </span>
                )}
              {exchangeRate && (
                <span className="text-gray-500 ml-1">
                  ≈{" "}
                  {currency
                    ? formatCurrency(
                        walletBalanceInInvestmentCurrency,
                        currency,
                      )
                    : `${(walletBalanceInInvestmentCurrency / 100).toFixed(2)}`}
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Initial Cost:</span>
            <span className="text-red-600">
              -
              {currency
                ? formatCurrency(initialCostInSmallestUnit, currency)
                : `${(initialCostInSmallestUnit / 100).toFixed(2)}`}
            </span>
          </div>
          <hr className="my-2" />
          <div className="flex justify-between font-medium">
            <span>Remaining:</span>
            {isLoadingRate ? (
              <span className="text-gray-400">Loading rate...</span>
            ) : exchangeRate ? (
              <span
                className={
                  walletBalanceInInvestmentCurrency -
                    initialCostInSmallestUnit <
                  0
                    ? "text-red-600"
                    : "text-green-600"
                }
              >
                ≈{" "}
                {formatCurrency(
                  walletBalanceInInvestmentCurrency - initialCostInSmallestUnit,
                  currency,
                )}
              </span>
            ) : (
              <span className="text-gray-400">Rate unavailable</span>
            )}
          </div>
          {exchangeRate && (
            <p className="text-xs text-gray-500 mt-2">
              Exchange rate: 1 {walletCurrency} ≈{" "}
              {formatExchangeRate(exchangeRate)} {currency}
            </p>
          )}
        </div>
      )}

      {/* Insufficient balance error */}
      {insufficientBalance && (
        <p className="text-red-600 text-sm mt-2">
          Insufficient wallet balance for this investment.
        </p>
      )}

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
        disabled={insufficientBalance}
        className="w-full"
        htmlType="submit"
      >
        Add Investment
      </Button>
    </form>
  );
}
