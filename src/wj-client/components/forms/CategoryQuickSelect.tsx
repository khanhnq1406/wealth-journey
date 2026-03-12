"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export interface CategoryOption {
  id: string | number;
  name: string;
  icon?: string;
  color?: string;
  type?: "income" | "expense";
}

export interface CategoryQuickSelectProps {
  categories: CategoryOption[];
  value?: string | number;
  onChange: (categoryId: string | number) => void;
  onCreateCategory?: (name: string) => void;
  type: "income" | "expense";
  className?: string;
}

// Default category icons for common categories
const DEFAULT_ICONS: Record<string, string> = {
  // Income categories
  salary: "💰",
  bonus: "🎁",
  investment: "📈",
  refund: "↩️",
  other_income: "💵",

  // Expense categories
  food: "🍔",
  transport: "🚗",
  shopping: "🛒",
  entertainment: "🎬",
  health: "💊",
  education: "📚",
  bills: "📄",
  transfer: "💸",
  other_expense: "📝",
};

/**
 * Quick category selection with icon grid.
 * Touch-friendly tiles for mobile category selection.
 */
export const CategoryQuickSelect = memo(function CategoryQuickSelect({
  categories,
  value,
  onChange,
  onCreateCategory,
  type,
  className,
}: CategoryQuickSelectProps) {
  const t = useTranslations("transaction.form");
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Filter categories by type and add default icons
  const displayCategories = useMemo(() => {
    return categories.map((cat) => ({
      ...cat,
      icon: cat.icon || getDefaultIcon(cat.name.toLowerCase(), type),
      color: cat.color || getDefaultColor(cat.id),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, type, getDefaultColor, getDefaultIcon]);

  const handleCategorySelect = useCallback(
    (categoryId: string | number) => {
      onChange(categoryId);
    },
    [onChange]
  );

  const handleCreateCategory = useCallback(() => {
    if (newCategoryName.trim() && onCreateCategory) {
      onCreateCategory(newCategoryName.trim());
      setNewCategoryName("");
      setIsCreating(false);
    }
  }, [newCategoryName, onCreateCategory]);

  const getDefaultIcon = useCallback((name: string, catType: string): string => {
    // Try exact match first
    if (DEFAULT_ICONS[name]) {
      return DEFAULT_ICONS[name];
    }

    // Try partial match
    for (const [key, icon] of Object.entries(DEFAULT_ICONS)) {
      if (name.includes(key) || key.includes(name)) {
        return icon;
      }
    }

    // Default icons based on type
    return catType === "income" ? "💵" : "📝";
  }, []);

  const getDefaultColor = useCallback((id: string | number): string => {
    const colors = [
      "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
      "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400",
      "bg-v2-green-light text-v2-green-positive dark:bg-green-900/30 dark:text-green-400",
      "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
      "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
      "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
      "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    ];

    const index = Math.abs(Number(id)) % colors.length;
    return colors[index];
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Category Grid */}
      <div className="grid grid-cols-4 gap-2">
        {displayCategories.map((category) => {
          const isSelected = value === category.id;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => handleCategorySelect(category.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-lg transition-all duration-150",
                "min-h-[88px] focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2",
                isSelected
                  ? "bg-v2-red-primary text-white shadow-md scale-105"
                  : "bg-white dark:bg-dark-surface text-gray-700 dark:text-dark-text border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface-hover active:scale-95"
              )}
              aria-label={`Select ${category.name}`}
              aria-pressed={isSelected}
            >
              <span className="text-2xl">{category.icon}</span>
              <span className="text-xs font-medium text-center line-clamp-2">
                {category.name}
              </span>
            </button>
          );
        })}

        {/* Create New Category Button */}
        {onCreateCategory && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 p-3 rounded-lg transition-all duration-150",
              "min-h-[88px] focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2",
              "bg-gray-100 dark:bg-dark-surface-hover text-gray-500 dark:text-dark-text-tertiary border-2 border-dashed border-gray-300 dark:border-dark-border hover:bg-gray-200 dark:hover:bg-dark-surface-active"
            )}
            aria-label={t("createNewCategory")}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium">New</span>
          </button>
        )}
      </div>

      {/* Create Category Modal/Inline Form */}
      {isCreating && onCreateCategory && (
        <div className="mt-3 p-4 bg-gray-50 dark:bg-dark-surface-hover rounded-lg border border-gray-200 dark:border-dark-border">
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
            New Category Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t("newCategoryPlaceholder")}
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-v2-red-primary dark:text-dark-text"
              autoFocus
            />
            <button
              type="button"
              onClick={handleCreateCategory}
              disabled={!newCategoryName.trim()}
              className="px-4 py-2 bg-v2-red-primary text-white rounded-lg font-medium hover:bg-v2-red-dark disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewCategoryName("");
              }}
              className="px-4 py-2 bg-white dark:bg-dark-surface text-gray-700 dark:text-dark-text border border-gray-300 dark:border-dark-border rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-dark-surface-hover min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
