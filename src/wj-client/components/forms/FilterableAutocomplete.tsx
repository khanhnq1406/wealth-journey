"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";

export interface FilterableAutocompleteProps {
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  noMatchText?: string;
  className?: string;
}

export function FilterableAutocomplete({
  suggestions,
  value,
  onChange,
  placeholder,
  disabled = false,
  isLoading = false,
  noMatchText = "No matches",
  className,
}: FilterableAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    if (!value) return suggestions;
    const lower = value.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(lower));
  }, [suggestions, value]);

  const handleSelect = useCallback(
    (item: string) => {
      onChange(item);
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        setIsOpen(true);
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filtered.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
            handleSelect(filtered[highlightedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
        case "Tab":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, filtered, highlightedIndex, handleSelect],
  );

  const handleBlur = useCallback((e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as Node;
    if (containerRef.current?.contains(relatedTarget)) return;
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listboxRef.current) {
      const option = listboxRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      option?.scrollIntoView?.({ block: "nearest" });
    }
  }, [highlightedIndex]);

  // Compute portal dropdown position from the input's bounding rect.
  // Mirrors FormSelect pattern: scroll-aware + updates on scroll/resize.
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
        zIndex: 9999,
      });
    };

    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  const listboxId = "filterable-autocomplete-listbox";

  return (
    <div
      ref={containerRef}
      className={`relative ${className ?? ""}`}
      onBlur={handleBlur}
    >
      <div className="relative">
        <input
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={
            isOpen && highlightedIndex >= 0
              ? `autocomplete-option-${highlightedIndex}`
              : undefined
          }
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 min-h-[44px] rounded-md bg-v2-bg-dark border border-v2-border text-v2-text-secondary placeholder:text-v2-text-placeholder text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="animate-spin h-4 w-4 text-v2-gold-accent"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        )}
      </div>

      {isOpen &&
        !disabled &&
        createPortal(
          <ul
            id={listboxId}
            ref={listboxRef}
            role="listbox"
            style={dropdownStyle}
            className="bg-v2-bg-surface border border-v2-border-light rounded-md shadow-dropdown max-h-60 overflow-auto"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-v2-text-tertiary text-sm">
                {noMatchText}
              </li>
            ) : (
              filtered.map((item, index) => (
                <li
                  key={item}
                  id={`autocomplete-option-${index}`}
                  role="option"
                  aria-selected={highlightedIndex === index}
                  className={`px-3 py-2 text-sm font-mono cursor-pointer transition-colors ${
                    highlightedIndex === index
                      ? "bg-v2-bg-surface-tint text-v2-gold-primary"
                      : "text-v2-text-secondary hover:bg-v2-bg-surface-tint hover:text-v2-gold-accent"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent blur before click
                    handleSelect(item);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {item}
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
