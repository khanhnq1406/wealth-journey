"use client";

import { SUPPORTED_CURRENCIES } from "@/app/constants";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";

interface CurrencyBadgeProps {
  value: string;
  onChange: (currency: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CurrencyBadge({
  value,
  onChange,
  disabled = false,
  className = "",
}: CurrencyBadgeProps) {
  const t = useTranslations("common");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find current currency info
  const currentCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (currencyCode: string) => {
    onChange(currencyCode);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 text-sm font-medium rounded-md
          border transition-all duration-150
          ${
            disabled
              ? "bg-v2-maroon-700 text-v2-cream-100 border-v2-maroon-600 cursor-not-allowed"
              : "bg-v2-gold-primary/10 text-v2-gold-accent border-v2-gold-primary/20 hover:bg-v2-gold-primary/20 hover:border-v2-gold-primary/30 cursor-pointer"
          }
        `}
        aria-label={t("changeCurrency")}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>{currentCurrency?.symbol || value}</span>
        <span>{value}</span>
        {!disabled && (
          <svg
            className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
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

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 bg-v2-maroon-900 rounded-lg shadow-lg border border-v2-maroon-600 py-1 z-50 min-w-[180px] max-h-[240px] overflow-y-auto"
          role="listbox"
          aria-label={t("selectCurrency")}
        >
          {SUPPORTED_CURRENCIES.map((curr) => (
            <button
              key={curr.code}
              type="button"
              onClick={() => handleSelect(curr.code)}
              className={`
                w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors
                ${
                  curr.code === value
                    ? "bg-v2-gold-primary/10 text-v2-gold-accent font-medium"
                    : "hover:bg-v2-maroon-700 text-v2-cream-100"
                }
              `}
              role="option"
              aria-selected={curr.code === value}
            >
              <span className="w-5 text-center">{curr.symbol}</span>
              <span className="flex-1">{curr.code}</span>
              {curr.code === value && (
                <svg
                  className="w-4 h-4 text-primary-600"
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
    </div>
  );
}
