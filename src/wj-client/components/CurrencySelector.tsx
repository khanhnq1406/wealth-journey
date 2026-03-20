"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { SUPPORTED_CURRENCIES } from "@/app/constants";
import { ZIndex } from "@/lib/utils/z-index";
import { cn } from "@/lib/utils/cn";
import { BottomSheet } from "@/components/BottomSheet";
import { useMobile } from "@/hooks/useMobile";

export function CurrencySelector() {
  const t = useTranslations("currencySelector");
  const { currency, updateCurrency, isConverting } = useCurrency();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const isMobile = useMobile();

  // Refs for accessibility
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Find current currency info - will update when currency context changes
  const currentCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
  const isDisabled = isConverting || isLoading;

  const handleCurrencyClick = (newCurrency: string) => {
    if (newCurrency === currency) {
      return; // No change
    }
    setSelectedCurrency(newCurrency);
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await updateCurrency(selectedCurrency);
      setShowConfirmation(false);
    } catch (error) {
      console.error("Failed to update currency:", error);
      // Error is handled by the mutation hook
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setSelectedCurrency("");
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    currCode: string,
    index: number
  ) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        handleCurrencyClick(currCode);
        break;
      case "ArrowDown":
        e.preventDefault();
        // Focus next item
        const nextButton = e.currentTarget.parentElement?.children[
          index + 1
        ] as HTMLButtonElement;
        nextButton?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        // Focus previous item
        const prevButton = e.currentTarget.parentElement?.children[
          index - 1
        ] as HTMLButtonElement;
        prevButton?.focus();
        break;
      case "Escape":
        e.preventDefault();
        // Close dropdown and return focus to trigger
        triggerRef.current?.focus();
        break;
    }
  };

  const handleMobileOpen = () => {
    setIsMobileSheetOpen(true);
  };

  const handleMobileClose = () => {
    setIsMobileSheetOpen(false);
    // Return focus to trigger button
    triggerRef.current?.focus();
  };

  return (
    <>
      <div className="relative group">
        <button
          ref={triggerRef}
          onClick={() => {
            if (isMobile) {
              handleMobileOpen();
            }
          }}
          className={cn(
            "flex items-center gap-2 rounded-lg transition-all duration-200",
 "bg-v2-maroon-800",
 "border border-v2-maroon-600",
 "shadow-sm",
            // Mobile-first: touch-friendly padding
            "px-3 py-3 min-h-[44px]",
            // Desktop: slightly smaller
            "sm:py-2 sm:min-h-[40px]",
            isDisabled
              ? "opacity-60 cursor-not-allowed"
 : "hover:bg-v2-maroon-700 cursor-pointer hover:shadow-md active:scale-95"
          )}
          style={{
            touchAction: "manipulation",
          }}
          aria-label={t("selectAriaLabel")}
          aria-expanded={isMobile ? isMobileSheetOpen : undefined}
          aria-haspopup={isMobile ? "dialog" : "menu"}
          disabled={isDisabled}
          title={
            isConverting
              ? t("converting")
              : t("selectAriaLabel")
          }
        >
          {isConverting ? (
            // Show loading spinner during conversion
            <svg
              className="animate-spin h-5 w-5 text-primary-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
 <span className="text-lg font-semibold text-neutral-900">
              {currentCurrency?.symbol || currency}
            </span>
          )}
 <span className="text-sm text-neutral-600">
            {currency}
          </span>
          {!isConverting && (
            <svg
 className="w-4 h-4 text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </button>

        {/* Desktop dropdown - only show when not disabled and not mobile */}
        {!isDisabled && !isMobile && (
          <div
            ref={dropdownRef}
            className={cn(
              "absolute right-0 sm:top-auto sm:bottom-full sm:mt-0 sm:mb-2",
 "bg-v2-maroon-900",
 "rounded-lg shadow-lg",
 "border border-v2-maroon-600",
              "py-2 hidden group-hover:block min-w-[200px]"
            )}
            style={{ zIndex: ZIndex.dropdown }}
            role="menu"
            aria-label={t("optionsAriaLabel")}
          >
            {SUPPORTED_CURRENCIES.map((curr, index) => (
              <button
                key={curr.code}
                onClick={() => handleCurrencyClick(curr.code)}
                onKeyDown={(e) => handleKeyDown(e, curr.code, index)}
                className={cn(
                  "w-full px-4 py-2 text-left transition-colors flex items-center gap-3",
 "hover:bg-neutral-100",
 "text-neutral-900",
                  "cursor-pointer",
                  curr.code === currency &&
 "bg-primary-50 font-semibold"
                )}
                role="menuitem"
                tabIndex={0}
              >
                <span className="text-lg w-6">{curr.symbol}</span>
                <div className="flex flex-col">
                  <span className="text-sm">{curr.code}</span>
 <span className="text-xs text-neutral-500">
                    {curr.name}
                  </span>
                </div>
                {curr.code === currency && (
                  <svg
 className="w-4 h-4 text-primary-500 ml-auto"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Mobile bottom sheet */}
        {isMobile && (
          <BottomSheet
            isOpen={isMobileSheetOpen}
            onClose={handleMobileClose}
            title={t("selectTitle")}
          >
            <div className="py-2">
              {SUPPORTED_CURRENCIES.map((curr, index) => (
                <button
                  key={curr.code}
                  onClick={() => {
                    handleCurrencyClick(curr.code);
                    setIsMobileSheetOpen(false);
                  }}
                  className={cn(
                    "w-full px-6 py-4 text-left flex items-center gap-4",
                    // Mobile-first: touch-friendly sizing
                    "min-h-[56px]",
 "active:bg-neutral-100",
 "text-neutral-900",
                    "active:scale-[0.98]",
                    "transition-transform",
                    curr.code === currency &&
 "bg-primary-50 font-semibold",
                    // Add border separator except for last item
                    index < SUPPORTED_CURRENCIES.length - 1 &&
 "border-b border-neutral-100"
                  )}
                  style={{
                    touchAction: "manipulation",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span className="text-2xl w-8">{curr.symbol}</span>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-base font-medium">{curr.code}</span>
 <span className="text-sm text-neutral-500 truncate">
                      {curr.name}
                    </span>
                  </div>
                  {curr.code === currency && (
                    <svg
 className="w-5 h-5 text-primary-500 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </BottomSheet>
        )}
      </div>

      {/* Confirmation dialog */}
      {showConfirmation && (
        <ConfirmationDialog
          title={t("confirmTitle")}
          message={
            <div>
              <div>
                {t("confirmMessage", { currencyName: SUPPORTED_CURRENCIES.find((c) => c.code === selectedCurrency)?.name || selectedCurrency })}
              </div>
              <div>
                {t("confirmNote")}
              </div>
            </div>
          }
          confirmText={t("confirmButton")}
          cancelText={t("cancelButton")}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          isLoading={isLoading}
          variant="default"
        />
      )}
    </>
  );
}
