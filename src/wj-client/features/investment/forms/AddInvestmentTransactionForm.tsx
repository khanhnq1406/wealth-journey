"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { RHFFormSelect as FormSelect } from "@/components/forms/RHFFormSelect";
import { SelectOption } from "@/components/forms/FormSelect";
import { RHFFormInput as FormInput } from "@/components/forms/RHFFormInput";
import { ErrorMessage } from "@/components/forms/ErrorMessage";
import {
  useMutationAddInvestmentTransaction,
  EVENT_WalletListWallets,
  EVENT_WalletGetWallet,
} from "@/utils/generated/hooks";
import {
  InvestmentTransactionType,
  InvestmentType,
} from "@/gen/protobuf/v1/investment";
import type { AddTransactionRequest } from "@/gen/protobuf/v1/investment";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  quantityToStorage,
  amountToSmallestUnit,
  getQuantityInputConfig,
  calculateTransactionCost,
  formatCurrency,
} from "@/lib/utils/units";
import { getInvestmentUnitLabelFull } from "@/app/[locale]/dashboard/portfolio/helpers";
import {
  AddTransactionFormInput,
  addTransactionSchema,
} from "@/features/investment/utils/investment-schema";
import {
  useExchangeRate,
  convertAmount,
  formatExchangeRate,
} from "@/hooks/useExchangeRate";
import {
  getGoldStorageInfo,
  convertGoldQuantity,
  convertGoldPricePerUnit,
  getGoldUnitLabel,
} from "@/features/investment/utils/gold-calculator";
import {
  isSilverType,
  getSilverStorageInfo,
  convertSilverQuantity,
  convertSilverPricePerUnit,
  getSilverUnitLabel,
  type SilverUnit,
} from "@/features/investment/utils/silver-calculator";
import { SuccessAnimation } from "@/components/success/SuccessAnimation";
import { MarketPriceDisplay } from "@/components/forms/MarketPriceDisplay";

interface AddInvestmentTransactionFormProps {
  investmentId: number;
  investmentType: InvestmentType;
  investmentCurrency?: string; // Currency of the parent investment (ISO 4217)
  purchaseUnit?: string; // User's purchase unit for display ("tael", "kg", "oz", "gram")
  walletBalance?: number; // Wallet balance in smallest currency unit
  walletCurrency?: string; // Currency of the wallet (ISO 4217)
  symbol?: string; // Symbol for price lookup
  onSuccess?: () => void;
}

/**
 * Self-contained form component for adding investment transactions.
 * Follows the established pattern of other form components in the codebase.
 * Owns its mutation logic, error handling, and loading state.
 */
export function AddInvestmentTransactionForm({
  investmentId,
  investmentType,
  investmentCurrency = "USD",
  purchaseUnit,
  walletBalance = 0,
  walletCurrency = "USD",
  symbol,
  onSuccess,
}: AddInvestmentTransactionFormProps) {
  const t = useTranslations("investment");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [insufficientBalance, setInsufficientBalance] = useState(false);

  const transactionTypeOptions: SelectOption[] = useMemo(
    () => [
      {
        value: String(InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY),
        label: t("transaction.buy"),
      },
      {
        value: String(InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_SELL),
        label: t("transaction.sell"),
      },
      {
        value: String(
          InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_DIVIDEND,
        ),
        label: t("transaction.dividend"),
      },
    ],
    [t],
  );

  const addTransactionMutation = useMutationAddInvestmentTransaction({
    onSuccess: (data) => {
      setSuccessMessage(data.message || t("transaction.transactionAddedMessage"));
      setShowSuccess(true);
      setErrorMessage("");
      // Invalidate investment queries
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return ["Investment", "investments"].some((k) => key.includes(k));
        },
      });
      // Invalidate wallet queries to refresh balance after transaction
      queryClient.invalidateQueries({ queryKey: [EVENT_WalletListWallets] });
      queryClient.invalidateQueries({ queryKey: [EVENT_WalletGetWallet] });
    },
    onError: (error: any) => {
      setErrorMessage(
        error.message || t("transaction.failedToAdd"),
      );
    },
  });

  // Get quantity input configuration from utilities
  const quantityConfig = getQuantityInputConfig(investmentType);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
    watch,
    getValues,
    setError,
  } = useForm<AddTransactionFormInput>({
    // NOTE: Removed zodResolver due to bug where it strips type and transactionDate fields
    // See: https://github.com/react-hook-form/resolvers/issues/XXX
    // resolver: zodResolver(addTransactionSchema),
    mode: "onSubmit",
    defaultValues: {
      type: InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY,
      quantity: 0,
      price: 0,
      fees: 0,
      transactionDate: new Date().toISOString().split("T")[0],
    },
  });

  // Watch form values for balance validation
  const transactionType = watch("type");
  const quantity = watch("quantity");
  const price = watch("price");
  const fees = watch("fees");

  // Check if currencies match
  const currenciesMatch = investmentCurrency === walletCurrency;

  // Check if this is a gold investment
  const isGoldInvestment =
    investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_VND ||
    investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_USD;

  // Check if this is a silver investment
  const isSilverInvestment = isSilverType(investmentType);

  // Get gold display unit for quantity input label
  const goldDisplayUnit = useMemo(() => {
    if (!isGoldInvestment) return null;
    const { unit } = getGoldStorageInfo(investmentType);
    // For VND gold, user enters quantity in taels (display convention)
    // For USD gold, user enters quantity in ounces (storage convention)
    return investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_VND
      ? ("tael" as const)
      : ("oz" as const);
  }, [investmentType, isGoldInvestment]);

  // Get silver display unit for quantity input label
  // Use purchaseUnit from investment if available, otherwise fall back to market default
  const silverDisplayUnit = useMemo(() => {
    if (!isSilverInvestment) return null;
    // If user has a purchase unit preference, use it
    if (purchaseUnit && ["tael", "kg", "gram", "oz"].includes(purchaseUnit)) {
      return purchaseUnit as SilverUnit;
    }
    // Default to market convention: tael for VND, oz for USD
    return investmentType === InvestmentType.INVESTMENT_TYPE_SILVER_VND
      ? ("tael" as const)
      : ("oz" as const);
  }, [investmentType, isSilverInvestment, purchaseUnit]);

  // Fetch exchange rate when currencies differ
  const { rate: exchangeRate, isLoading: isLoadingRate } = useExchangeRate(
    walletCurrency,
    investmentCurrency,
  );

  // Calculate total cost for BUY transactions
  const totalCost = useMemo(() => {
    if (
      transactionType !==
      InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY
    )
      return 0;

    let quantityInStorage: number;
    let priceInCents: number;

    if (isGoldInvestment && goldDisplayUnit) {
      // For gold: user enters quantity in display units, price in display units
      const { unit: storageUnit } = getGoldStorageInfo(investmentType);

      // Convert quantity to storage units (grams for VND gold, ounces for USD gold)
      const quantityInStorageUnits = convertGoldQuantity(
        Number(quantity) || 0,
        goldDisplayUnit,
        storageUnit,
      );
      quantityInStorage = Math.round(quantityInStorageUnits * 10000);

      // Convert price from display units to storage units
      // VND gold: price per tael → price per gram (using price conversion function)
      // USD gold: price per ounce (already in storage units)
      let priceInStorageUnits = Number(price) || 0;
      if (investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_VND) {
        // User enters price per tael, convert to price per gram
        // IMPORTANT: Use convertGoldPricePerUnit, not convertGoldQuantity!
        priceInStorageUnits = convertGoldPricePerUnit(
          priceInStorageUnits,
          goldDisplayUnit, // tael
          storageUnit, // gram
        );
      }
      // For USD gold, price is already per ounce, no conversion needed

      priceInCents = amountToSmallestUnit(
        priceInStorageUnits,
        investmentCurrency,
      );
    } else if (isSilverInvestment && silverDisplayUnit) {
      // For silver: user enters quantity in display units, price in display units
      const { unit: storageUnit } = getSilverStorageInfo(investmentType);

      // Convert quantity to storage units (grams for VND silver, ounces for USD silver)
      const quantityInStorageUnits = convertSilverQuantity(
        Number(quantity) || 0,
        silverDisplayUnit,
        storageUnit,
      );
      quantityInStorage = Math.round(quantityInStorageUnits * 10000);

      // Convert price from display units to storage units
      // VND silver: price per tael → price per gram (using price conversion function)
      // USD silver: price per ounce (already in storage units)
      let priceInStorageUnits = Number(price) || 0;
      if (investmentType === InvestmentType.INVESTMENT_TYPE_SILVER_VND) {
        // User enters price per tael, convert to price per gram
        priceInStorageUnits = convertSilverPricePerUnit(
          priceInStorageUnits,
          silverDisplayUnit, // tael
          storageUnit, // gram
        );
      }
      // For USD silver, price is already per ounce, no conversion needed

      priceInCents = amountToSmallestUnit(
        priceInStorageUnits,
        investmentCurrency,
      );
    } else {
      // For non-gold, non-silver: use standard conversions
      quantityInStorage = quantityToStorage(
        Number(quantity) || 0,
        investmentType,
      );
      priceInCents = amountToSmallestUnit(
        Number(price) || 0,
        investmentCurrency,
      );
    }

    const feesInCents = amountToSmallestUnit(
      Number(fees) || 0,
      investmentCurrency,
    );
    return (
      calculateTransactionCost(
        quantityInStorage,
        priceInCents,
        investmentType,
      ) + feesInCents
    );
  }, [
    quantity,
    price,
    fees,
    transactionType,
    investmentType,
    investmentCurrency,
    isGoldInvestment,
    goldDisplayUnit,
    isSilverInvestment,
    silverDisplayUnit,
  ]);

  // Convert wallet balance to investment currency for comparison
  const walletBalanceInInvestmentCurrency = useMemo(() => {
    if (currenciesMatch || !exchangeRate) {
      return walletBalance;
    }
    return convertAmount(
      walletBalance,
      exchangeRate,
      walletCurrency,
      investmentCurrency,
    );
  }, [
    walletBalance,
    exchangeRate,
    walletCurrency,
    investmentCurrency,
    currenciesMatch,
  ]);

  // Check for insufficient balance (with currency conversion when needed)
  useEffect(() => {
    const isBuyTransaction =
      transactionType ===
      InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY;
    if (!isBuyTransaction || walletBalance <= 0) {
      setInsufficientBalance(false);
      return;
    }

    if (currenciesMatch) {
      setInsufficientBalance(totalCost > walletBalance);
    } else if (exchangeRate) {
      setInsufficientBalance(totalCost > walletBalanceInInvestmentCurrency);
    } else {
      // No rate available yet, don't block submission
      setInsufficientBalance(false);
    }
  }, [
    totalCost,
    walletBalance,
    walletBalanceInInvestmentCurrency,
    transactionType,
    currenciesMatch,
    exchangeRate,
  ]);

  const onSubmit = () => {
    setErrorMessage(undefined);

    // Get all form values directly (bypassing Zod resolver issue)
    const formData = getValues();

    // Manual validation using Zod schema
    const validationResult = addTransactionSchema.safeParse(formData);

    if (!validationResult.success) {
      // Set form errors
      validationResult.error.issues.forEach((issue) => {
        const fieldName = issue.path[0] as keyof AddTransactionFormInput;
        setError(fieldName, { message: issue.message });
      });
      setErrorMessage(t("transaction.fixValidationErrors"));
      return;
    }

    const completeData = validationResult.data;

    // Convert quantity to storage format
    let quantityInStorage: number;
    let priceInStorage: number;

    if (isGoldInvestment && goldDisplayUnit) {
      // For gold: user enters quantity in display units, price in display units
      const { unit: storageUnit } = getGoldStorageInfo(investmentType);

      // Convert quantity to storage units
      const quantityInStorageUnits = convertGoldQuantity(
        completeData.quantity,
        goldDisplayUnit,
        storageUnit,
      );
      quantityInStorage = Math.round(quantityInStorageUnits * 10000);

      // Convert price from display units to storage units
      priceInStorage = completeData.price;
      if (investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_VND) {
        // User enters price per tael, convert to price per gram
        // IMPORTANT: Use convertGoldPricePerUnit, not convertGoldQuantity!
        priceInStorage = convertGoldPricePerUnit(
          completeData.price,
          goldDisplayUnit, // tael
          storageUnit, // gram
        );
      }
      // For USD gold, price is already per ounce, no conversion needed
    } else if (isSilverInvestment && silverDisplayUnit) {
      // For silver: user enters quantity in display units, price in display units
      const { unit: storageUnit } = getSilverStorageInfo(investmentType);

      // Convert quantity to storage units
      const quantityInStorageUnits = convertSilverQuantity(
        completeData.quantity,
        silverDisplayUnit,
        storageUnit,
      );
      quantityInStorage = Math.round(quantityInStorageUnits * 10000);

      // Convert price from display units to storage units
      priceInStorage = completeData.price;
      if (investmentType === InvestmentType.INVESTMENT_TYPE_SILVER_VND) {
        // User enters price per tael, convert to price per gram
        priceInStorage = convertSilverPricePerUnit(
          completeData.price,
          silverDisplayUnit, // tael
          storageUnit, // gram
        );
      }
      // For USD silver, price is already per ounce, no conversion needed
    } else {
      // For non-gold, non-silver: use standard quantity conversion
      quantityInStorage = quantityToStorage(
        completeData.quantity,
        investmentType,
      );
      priceInStorage = completeData.price;
    }

    // Convert to API format using utility functions
    const request: AddTransactionRequest = {
      investmentId: investmentId,
      type: completeData.type,
      quantity: quantityInStorage,
      price: amountToSmallestUnit(priceInStorage, investmentCurrency),
      fees: amountToSmallestUnit(completeData.fees, investmentCurrency),
      transactionDate: Math.floor(
        new Date(completeData.transactionDate).getTime() / 1000,
      ),
      notes: "",
    };

    addTransactionMutation.mutate(request);
  };

  // Show success state
  if (showSuccess) {
    return (
      <div className="text-center py-8 flex flex-col gap-2">
        <SuccessAnimation />
        <h3 className="text-lg font-semibold">{t("transaction.transactionAddedSuccess")}</h3>
        <p className="text-gray-600 mb-6">{successMessage}</p>
        <Button type={ButtonType.PRIMARY} onClick={onSuccess}>
          {tCommon("done")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Error message */}
      {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}

      {/* Transaction Type */}
      <FormSelect
        name="type"
        control={control}
        label={t("transaction.transactionType")}
        options={transactionTypeOptions}
        placeholder={t("transaction.selectTransactionType")}
        required
        disabled={isSubmitting}
        parseAsNumber={true}
      />

      {/* Quantity */}
      <FormNumberInput
        name="quantity"
        control={control}
        label={
          isGoldInvestment && goldDisplayUnit
            ? `${t("transaction.quantity")} (${getGoldUnitLabel(goldDisplayUnit)})`
            : isSilverInvestment && silverDisplayUnit
              ? `${t("transaction.quantity")} (${getSilverUnitLabel(silverDisplayUnit)})`
              : t("transaction.quantity")
        }
        placeholder={
          (isGoldInvestment && goldDisplayUnit === "tael") ||
          (isSilverInvestment && silverDisplayUnit === "tael")
            ? "0.0000"
            : isSilverInvestment && silverDisplayUnit === "kg"
              ? "0.00"
              : quantityConfig.placeholder
        }
        required
        disabled={isSubmitting}
        min={0}
        step={
          (isGoldInvestment && goldDisplayUnit === "tael") ||
          (isSilverInvestment && silverDisplayUnit === "tael")
            ? "0.0001"
            : isSilverInvestment && silverDisplayUnit === "kg"
              ? "0.01"
              : quantityConfig.step
        }
        showRecommendations={false}
      />

      {/* Price */}
      <FormNumberInput
        name="price"
        control={control}
        label={
          isGoldInvestment
            ? `Price per ${getInvestmentUnitLabelFull(goldDisplayUnit || "oz", investmentType)} (${investmentCurrency})`
            : isSilverInvestment && silverDisplayUnit
              ? `Price per ${getInvestmentUnitLabelFull(silverDisplayUnit, investmentType)} (${investmentCurrency})`
              : t("transaction.pricePerUnit", { currency: investmentCurrency })
        }
        placeholder="0.00"
        required
        disabled={isSubmitting}
        min={0}
        step="0.01"
      />

      {/* Market price display */}
      {symbol && (
        <MarketPriceDisplay
          symbol={symbol}
          currency={investmentCurrency}
          investmentType={investmentType}
          className="mt-2 mb-4"
        />
      )}

      {/* Fees */}
      <FormNumberInput
        name="fees"
        control={control}
        label={t("transaction.fees", { currency: investmentCurrency })}
        placeholder="0.00"
        disabled={isSubmitting}
        min={0}
        step="0.01"
      />

      {/* Transaction Date */}
      <FormInput
        control={control}
        name="transactionDate"
        type="date"
        label={t("transaction.transactionDate")}
        disabled={isSubmitting}
        required
        rules={{
          required: t("transaction.transactionDateRequired"),
        }}
      />

      {/* Balance Preview for BUY transactions - same currency */}
      {transactionType ===
        InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY &&
        walletBalance > 0 &&
        currenciesMatch && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <div className="flex justify-between text-sm">
              <span>{t("transaction.walletBalance")}</span>
              <span>{formatCurrency(walletBalance, walletCurrency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{t("transaction.transactionCost")}</span>
              <span className="text-red-600">
                -{formatCurrency(totalCost, investmentCurrency)}
              </span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between font-medium">
              <span>{t("transaction.remaining")}</span>
              <span
                className={
                  walletBalance - totalCost < 0
                    ? "text-red-600"
                    : "text-green-600"
                }
              >
                {formatCurrency(walletBalance - totalCost, investmentCurrency)}
              </span>
            </div>
          </div>
        )}

      {/* Balance Preview for BUY transactions - different currencies with conversion */}
      {transactionType ===
        InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY &&
        walletBalance > 0 &&
        !currenciesMatch && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <div className="flex justify-between text-sm">
              <span>{t("transaction.walletBalance")}</span>
              <span>
                {formatCurrency(walletBalance, walletCurrency)}
                {exchangeRate && (
                  <span className="text-gray-500 ml-1">
                    (≈{" "}
                    {formatCurrency(
                      walletBalanceInInvestmentCurrency,
                      investmentCurrency,
                    )}
                    )
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{t("transaction.transactionCost")}</span>
              <span className="text-red-600">
                -{formatCurrency(totalCost, investmentCurrency)}
              </span>
            </div>
            <hr className="my-2" />
            <div className="flex justify-between font-medium">
              <span>{t("transaction.remaining")}</span>
              {isLoadingRate ? (
                <span className="text-gray-400">{t("transaction.loadingRate")}</span>
              ) : exchangeRate ? (
                <span
                  className={
                    walletBalanceInInvestmentCurrency - totalCost < 0
                      ? "text-red-600"
                      : "text-green-600"
                  }
                >
                  ≈{" "}
                  {formatCurrency(
                    walletBalanceInInvestmentCurrency - totalCost,
                    investmentCurrency,
                  )}
                </span>
              ) : (
                <span className="text-gray-400">{t("transaction.rateUnavailable")}</span>
              )}
            </div>
            {exchangeRate && (
              <p className="text-xs text-gray-500 mt-2">
                {t("transaction.exchangeRate", {
                  from: walletCurrency,
                  rate: formatExchangeRate(exchangeRate),
                  to: investmentCurrency,
                })}
              </p>
            )}
          </div>
        )}

      {/* Insufficient balance error */}
      {insufficientBalance && (
        <p className="text-red-600 text-sm mt-2">
          {t("transaction.insufficientBalance", {
            amount: formatCurrency(
              currenciesMatch
                ? totalCost - walletBalance
                : totalCost - walletBalanceInInvestmentCurrency,
              investmentCurrency,
            ),
          })}
        </p>
      )}

      {/* Submit button */}
      <Button
        htmlType="submit"
        type={ButtonType.PRIMARY}
        disabled={insufficientBalance}
        loading={addTransactionMutation.isPending || isSubmitting}
        className="w-full"
      >
        {t("transaction.addTransaction")}
      </Button>
    </form>
  );
}
