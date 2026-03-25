"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { FormNumberInput } from "@/components/forms/FormNumberInput";
import { RHFFormSelect as FormSelect } from "@/components/forms/RHFFormSelect";
import { SelectOption } from "@/components/forms/FormSelect";
import { RHFFormInput as FormInput } from "@/components/forms/RHFFormInput";
import { ErrorMessage } from "@/components/forms/ErrorMessage";
import {
  useMutationAddInvestmentTransaction,
  useMutationEditInvestmentTransaction,
  useQueryGetMarketPrice,
  EVENT_WalletListWallets,
  EVENT_WalletGetWallet,
} from "@/utils/generated/hooks";
import {
  InvestmentTransactionType,
  InvestmentType,
} from "@/gen/protobuf/v1/investment";
import type {
  AddTransactionRequest,
  InvestmentTransaction,
} from "@/gen/protobuf/v1/investment";
import { useQueryClient } from "@tanstack/react-query";
import {
  quantityToStorage,
  amountToSmallestUnit,
  smallestUnitToAmount,
  getQuantityInputConfig,
} from "@/lib/utils/units";
import { getInvestmentUnitLabelFull } from "@/app/[locale]/dashboard/portfolio/helpers";
import {
  AddTransactionFormInput,
  addTransactionSchema,
} from "@/features/investment/utils/investment-schema";
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
import { getTranslatedError } from "@/lib/utils/error-translator";
import type { GoldUnit } from "@/features/investment/utils/gold-calculator";

interface AddInvestmentTransactionFormProps {
  investmentId: number;
  investmentType: InvestmentType;
  investmentCurrency?: string; // Currency of the parent investment (ISO 4217)
  purchaseUnit?: string; // User's purchase unit for display ("mace", "tael", "kg", "oz", "gram")
  symbol?: string; // Symbol for price lookup
  onSuccess?: () => void;
  /** If provided, form is in edit mode — pre-fills fields and calls editMutation on submit */
  editTransaction?: InvestmentTransaction;
}

/**
 * Reverse-convert a stored quantity back to the display unit used in the form.
 *
 * Storage format for gold/silver: base_unit × 10000.
 * For Gold VND: stored in grams × 10000, displayed in mace.
 * For Gold USD: stored in ounces × 10000, displayed in ounces (no change).
 * For Silver VND: stored in grams × 10000, displayed in the user's purchaseUnit (tael/kg/gram).
 * For Silver USD: stored in ounces × 10000, displayed in ounces (no change).
 * For others: stored as quantity × 10000 (via quantityToStorage), displayed as quantity / 10000.
 */
function storageQuantityToDisplayQuantity(
  storedQuantity: number,
  investmentType: InvestmentType,
  displayUnit: GoldUnit | SilverUnit | null,
): number {
  const isGold =
    investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_VND ||
    investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_USD;
  const isSilver = isSilverType(investmentType);

  if (isGold && displayUnit) {
    const { unit: storageUnit } = getGoldStorageInfo(investmentType);
    const inStorageUnits = storedQuantity / 10000;
    return convertGoldQuantity(inStorageUnits, storageUnit, displayUnit as GoldUnit);
  }

  if (isSilver && displayUnit) {
    const { unit: storageUnit } = getSilverStorageInfo(investmentType);
    const inStorageUnits = storedQuantity / 10000;
    return convertSilverQuantity(
      inStorageUnits,
      storageUnit,
      displayUnit as SilverUnit,
    );
  }

  // Standard investments: quantityToStorage multiplies by 10000
  return storedQuantity / 10000;
}

/**
 * Reverse-convert a stored price (in smallest currency unit) back to the display
 * price-per-unit that the form shows.
 *
 * For Gold VND: stored price is per gram in VND (raw VND, multiplier=1), displayed per mace.
 * For Gold USD: stored price is per ounce in cents (multiplier=100), displayed per ounce.
 * For Silver VND: stored price is per gram in VND (raw VND), displayed per silverDisplayUnit.
 * For Silver USD: stored price is per ounce in cents, displayed per ounce.
 * For others: stored price is in smallest currency unit → divide by currency multiplier.
 */
function storagePriceToDisplayPrice(
  storedPrice: number,
  investmentType: InvestmentType,
  investmentCurrency: string,
  displayUnit: GoldUnit | SilverUnit | null,
): number {
  const isGold =
    investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_VND ||
    investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_USD;
  const isSilver = isSilverType(investmentType);

  if (isGold && displayUnit) {
    const { unit: storageUnit } = getGoldStorageInfo(investmentType);
    // storedPrice is smallestUnit per storageUnit — convert to main units first
    const pricePerStorageUnitMain = smallestUnitToAmount(storedPrice, investmentCurrency);
    if (investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_VND) {
      // Convert from price-per-gram to price-per-mace (display unit)
      return convertGoldPricePerUnit(
        pricePerStorageUnitMain,
        storageUnit,
        displayUnit as GoldUnit,
      );
    }
    // Gold USD: price is per ounce, storageUnit = oz, displayUnit = oz — no conversion needed
    return pricePerStorageUnitMain;
  }

  if (isSilver && displayUnit) {
    const { unit: storageUnit } = getSilverStorageInfo(investmentType);
    const pricePerStorageUnitMain = smallestUnitToAmount(storedPrice, investmentCurrency);
    if (investmentType === InvestmentType.INVESTMENT_TYPE_SILVER_VND) {
      // Convert from price-per-gram to price-per-displayUnit (tael, kg, etc.)
      return convertSilverPricePerUnit(
        pricePerStorageUnitMain,
        storageUnit,
        displayUnit as SilverUnit,
      );
    }
    // Silver USD: price is per ounce — no conversion needed
    return pricePerStorageUnitMain;
  }

  // Standard investments: just convert from smallest unit to main unit
  return smallestUnitToAmount(storedPrice, investmentCurrency);
}

/**
 * Convert a Unix timestamp (seconds) to a YYYY-MM-DD string for <input type="date" />.
 */
function unixToDateString(unixSeconds: number): string {
  if (!unixSeconds) return new Date().toISOString().split("T")[0];
  const d = new Date(unixSeconds * 1000);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return d.toISOString().split("T")[0];
}

/**
 * Self-contained form component for adding or editing investment transactions.
 * Follows the established pattern of other form components in the codebase.
 * Owns its mutation logic, error handling, and loading state.
 *
 * When `editTransaction` is provided the form pre-fills with the existing
 * transaction's values (reverse-converted from storage to display units) and
 * calls the edit mutation on submit instead of the add mutation.
 */
export function AddInvestmentTransactionForm({
  investmentId,
  investmentType,
  investmentCurrency = "USD",
  purchaseUnit,
  symbol,
  onSuccess,
  editTransaction,
}: AddInvestmentTransactionFormProps) {
  const t = useTranslations("investment");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);

  const isEditMode = Boolean(editTransaction);

  const transactionTypeOptions: SelectOption[] = useMemo(
    () => [
      {
        value: String(
          InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY,
        ),
        label: t("transaction.buy"),
      },
      {
        value: String(
          InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_SELL,
        ),
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

  // Check if this is a gold investment
  const isGoldInvestment =
    investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_VND ||
    investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_USD;

  // Check if this is a silver investment
  const isSilverInvestment = isSilverType(investmentType);

  // Get gold display unit for quantity input label
  const goldDisplayUnit = useMemo(() => {
    if (!isGoldInvestment) return null;
    // For VND gold, user enters quantity in mace/chỉ (display convention)
    // For USD gold, user enters quantity in ounces (storage convention)
    return investmentType === InvestmentType.INVESTMENT_TYPE_GOLD_VND
      ? ("mace" as const)
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

  // --- Compute default values for the form ---
  // In edit mode, reverse-convert storage values to display values.
  const defaultFormValues = useMemo((): AddTransactionFormInput => {
    if (!editTransaction) {
      return {
        type: InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY,
        quantity: 0,
        price: 0,
        fees: 0,
        transactionDate: new Date().toISOString().split("T")[0],
      };
    }

    const displayUnit = isGoldInvestment
      ? goldDisplayUnit
      : isSilverInvestment
        ? silverDisplayUnit
        : null;

    const displayQuantity = storageQuantityToDisplayQuantity(
      editTransaction.quantity,
      investmentType,
      displayUnit,
    );

    const displayPrice = storagePriceToDisplayPrice(
      editTransaction.price,
      investmentType,
      investmentCurrency,
      displayUnit,
    );

    const displayFees = smallestUnitToAmount(
      editTransaction.fees,
      investmentCurrency,
    );

    return {
      type: editTransaction.type,
      quantity: displayQuantity,
      price: displayPrice,
      fees: displayFees,
      transactionDate: unixToDateString(editTransaction.transactionDate),
    };
  }, [
    editTransaction,
    investmentType,
    investmentCurrency,
    isGoldInvestment,
    isSilverInvestment,
    goldDisplayUnit,
    silverDisplayUnit,
  ]);

  // --- Mutations ---
  const addTransactionMutation = useMutationAddInvestmentTransaction({
    onSuccess: () => {
      setSuccessMessage(t("transaction.transactionAddedMessage"));
      setShowSuccess(true);
      setErrorMessage("");
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return ["Investment", "investments"].some((k) => key.includes(k));
        },
      });
      queryClient.invalidateQueries({ queryKey: [EVENT_WalletListWallets] });
      queryClient.invalidateQueries({ queryKey: [EVENT_WalletGetWallet] });
    },
    onError: (error: any) => {
      setErrorMessage(getTranslatedError(error, tErrors));
    },
  });

  const editMutation = useMutationEditInvestmentTransaction({
    onSuccess: () => {
      setSuccessMessage(t("transaction.transactionUpdatedMessage", { defaultValue: "Transaction updated successfully." }));
      setShowSuccess(true);
      setErrorMessage("");
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return ["Investment", "investments"].some((k) => key.includes(k));
        },
      });
      queryClient.invalidateQueries({ queryKey: [EVENT_WalletListWallets] });
      queryClient.invalidateQueries({ queryKey: [EVENT_WalletGetWallet] });
    },
    onError: (error: any) => {
      setErrorMessage(getTranslatedError(error, tErrors));
    },
  });

  // Get quantity input configuration from utilities
  const quantityConfig = getQuantityInputConfig(investmentType);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
    getValues,
    setError,
    setValue,
    reset,
  } = useForm<AddTransactionFormInput>({
    // NOTE: Removed zodResolver due to bug where it strips type and transactionDate fields
    // See: https://github.com/react-hook-form/resolvers/issues/XXX
    // resolver: zodResolver(addTransactionSchema),
    mode: "onSubmit",
    defaultValues: defaultFormValues,
  });

  // When editTransaction changes (e.g., the same form instance is reused for a different
  // transaction), reset the form with the fresh default values.
  useEffect(() => {
    reset(defaultFormValues);
    // reset is stable, defaultFormValues is memoized — intentional dep list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTransaction?.id]);

  // Fetch market price for auto-fill (only in add mode, not edit mode)
  const priceQuery = useQueryGetMarketPrice(
    {
      symbol: symbol || "",
      currency: investmentCurrency,
      type: investmentType,
    },
    {
      enabled: !isEditMode && !!symbol && symbol.length >= 2,
      refetchOnMount: "always",
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  );

  // Auto-fill price from market data — always use priceDecimal (human-readable)
  // Only in add mode to avoid overwriting pre-filled edit values
  useEffect(() => {
    if (isEditMode) return;
    if (!priceQuery.data?.data) return;
    const data = priceQuery.data.data;
    if (data.priceDecimal) setValue("price", data.priceDecimal);
  }, [priceQuery.data, setValue, isEditMode]);

  const isRefreshing = priceQuery.isFetching;

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
        // User enters price per mace (chỉ), convert to price per gram
        // IMPORTANT: Use convertGoldPricePerUnit, not convertGoldQuantity!
        priceInStorage = convertGoldPricePerUnit(
          completeData.price,
          goldDisplayUnit, // mace
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

    const transactionDateUnix = Math.floor(
      new Date(completeData.transactionDate).getTime() / 1000,
    );
    const feesInSmallestUnit = amountToSmallestUnit(completeData.fees, investmentCurrency);
    const priceInSmallestUnit = amountToSmallestUnit(priceInStorage, investmentCurrency);

    if (isEditMode && editTransaction) {
      // Edit mode: call edit mutation
      editMutation.mutate({
        id: editTransaction.id,
        type: completeData.type,
        quantity: quantityInStorage,
        price: priceInSmallestUnit,
        fees: feesInSmallestUnit,
        transactionDate: transactionDateUnix,
        notes: editTransaction.notes ?? "",
      });
    } else {
      // Add mode: call add mutation
      const request: AddTransactionRequest = {
        investmentId: investmentId,
        type: completeData.type,
        quantity: quantityInStorage,
        price: priceInSmallestUnit,
        fees: feesInSmallestUnit,
        transactionDate: transactionDateUnix,
        notes: "",
      };
      addTransactionMutation.mutate(request);
    }
  };

  const isPending = isEditMode
    ? editMutation.isPending
    : addTransactionMutation.isPending;

  const submitLabel = isEditMode
    ? t("transaction.saveChanges", { defaultValue: "Save Changes" })
    : t("transaction.addTransaction");

  const successTitle = isEditMode
    ? t("transaction.transactionUpdatedSuccess", { defaultValue: "Transaction Updated!" })
    : t("transaction.transactionAddedSuccess");

  // Show success state
  if (showSuccess) {
    return (
      <div className="text-center py-8 flex flex-col gap-2">
        <SuccessAnimation />
        <h3 className="text-lg font-semibold">
          {successTitle}
        </h3>
        <p className="text-v2-text-secondary mb-6">{successMessage}</p>
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
          (isGoldInvestment && goldDisplayUnit === "mace") ||
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
          (isGoldInvestment && goldDisplayUnit === "mace") ||
          (isSilverInvestment && silverDisplayUnit === "tael")
            ? "0.0001"
            : isSilverInvestment && silverDisplayUnit === "kg"
              ? "0.01"
              : quantityConfig.step
        }
        showRecommendations={false}
      />

      {/* Price + Refresh Button */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="block text-sm font-medium text-v2-gold-accent">
            {isGoldInvestment
              ? t("transaction.pricePerUnitWithUnit", {
                  unit: getInvestmentUnitLabelFull(goldDisplayUnit || "oz", investmentType),
                  currency: investmentCurrency,
                })
              : isSilverInvestment && silverDisplayUnit
                ? t("transaction.pricePerUnitWithUnit", {
                    unit: getInvestmentUnitLabelFull(silverDisplayUnit, investmentType),
                    currency: investmentCurrency,
                  })
                : t("transaction.pricePerUnit", {
                    currency: investmentCurrency,
                  })}
            <span className="text-red-500 ml-0.5">*</span>
          </label>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <FormNumberInput
              name="price"
              control={control}
              placeholder="0.00"
              required
              disabled={isSubmitting}
              min={0}
              step="0.01"
            />
          </div>
          {/* Refresh button — only shown in add mode when symbol is available */}
          {!isEditMode && symbol && symbol.length >= 2 && (
            <button
              type="button"
              onClick={() => priceQuery.refetch()}
              disabled={isRefreshing}
              className="px-3 py-2 text-sm font-medium text-v2-gold-primary bg-v2-maroon-900 border border-v2-gold-primary rounded-md hover:bg-v2-maroon-800 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap h-[50px] cursor-pointer"
            >
              {isRefreshing
                ? t("transaction.refreshingPrice")
                : t("transaction.refreshPrice")}
            </button>
          )}
        </div>
      </div>

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

      {/* Submit button */}
      <Button
        htmlType="submit"
        type={ButtonType.PRIMARY}
        loading={isPending || isSubmitting}
        className="w-full"
      >
        {submitLabel}
      </Button>
    </form>
  );
}
