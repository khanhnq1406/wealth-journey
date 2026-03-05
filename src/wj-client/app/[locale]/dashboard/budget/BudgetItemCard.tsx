"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BudgetItem } from "@/gen/protobuf/v1/budget";
import { formatCurrency } from "@/utils/currency-formatter";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ButtonType, resources } from "@/app/constants";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import {
  useMutationUpdateBudgetItem,
  useMutationDeleteBudgetItem,
} from "@/utils/generated/hooks";
import { EVENT_BudgetUpdateBudgetItem } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { useTranslations } from "next-intl";

interface BudgetItemCardProps {
  item: BudgetItem;
  budgetId: number;
  onRefresh: () => void;
  onEditItem: (budgetId: number, item: BudgetItem) => void;
}

/**
 * Enhanced BudgetItemCard with improved spacing and better visual hierarchy.
 */
export function BudgetItemCard({
  item,
  budgetId,
  onRefresh,
  onEditItem,
}: BudgetItemCardProps) {
  const t = useTranslations("budget");
  const tCommon = useTranslations("common");
  const tModals = useTranslations("modals");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { currency } = useCurrency();
  const queryClient = useQueryClient();

  const updateBudgetItemMutation = useMutationUpdateBudgetItem({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [EVENT_BudgetUpdateBudgetItem],
      });
      onRefresh();
    },
  });

  const deleteBudgetItemMutation = useMutationDeleteBudgetItem({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [EVENT_BudgetUpdateBudgetItem],
      });
      onRefresh();
    },
  });

  const handleDeleteItem = () => {
    setShowDeleteDialog(true);
  };

  const confirmDeleteItem = () => {
    deleteBudgetItemMutation.mutate({
      budgetId,
      itemId: item.id,
    });
    setShowDeleteDialog(false);
  };

  const cancelDeleteItem = () => {
    setShowDeleteDialog(false);
  };

  const handleCheckedChange = (checked: boolean) => {
    updateBudgetItemMutation.mutate({
      budgetId,
      itemId: item.id,
      name: item.name,
      total: item.total,
      checked: checked,
    });
  };

  const isPending =
    updateBudgetItemMutation.isPending || deleteBudgetItemMutation.isPending;

  const isChecked = item.checked ?? false;
  const itemAmount = item.displayTotal?.amount ?? item.total?.amount ?? 0;

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 16 }}
        transition={{ duration: 0.2 }}
        className={`group flex items-center gap-3 py-2.5 px-3 rounded-lg border transition-all duration-200 ${
          isChecked
            ? "bg-gray-50 border-gray-200"
            : "bg-white border-gray-200 hover:border-primary-600 hover:bg-gray-50/50"
        }`}
      >
        {/* Checkbox */}
        <Checkbox
          checked={isChecked}
          onChange={handleCheckedChange}
          disabled={isPending}
          className="shrink-0"
        />

        {/* Item Info */}
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-medium truncate transition-colors ${
              isChecked ? "text-gray-400 line-through" : "text-gray-900"
            }`}
          >
            {item.name}
          </div>
          <div
            className={`text-xs mt-0.5 transition-colors ${
              isChecked ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {formatCurrency(itemAmount, currency)}
          </div>
        </div>

        {/* Actions - Visible on Hover */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            type={ButtonType.IMG}
            src={`${resources}/editing.svg`}
            onClick={() => onEditItem(budgetId, item)}
            disabled={isPending}
            className="p-1.5 hover:bg-primary-50 rounded-md transition-colors"
          />
          <Button
            type={ButtonType.IMG}
            src={`${resources}/remove.svg`}
            onClick={handleDeleteItem}
            disabled={isPending}
            className="p-1.5 hover:bg-red-50 rounded-md transition-colors"
          />
        </div>
      </motion.div>

      {showDeleteDialog && (
        <ConfirmationDialog
          title={t("card.deleteItem")}
          message={
            <div className="flex flex-col gap-1.5">
              <p>{`${tModals("confirmation.areYouSure")} "${item.name}"?`}</p>
              <p className="text-sm text-gray-500">
                {tModals("confirmation.thisActionCannotBeUndone")}
              </p>
            </div>
          }
          confirmText={tCommon("delete")}
          cancelText={tCommon("cancel")}
          onConfirm={confirmDeleteItem}
          onCancel={cancelDeleteItem}
          isLoading={deleteBudgetItemMutation.isPending}
          variant="danger"
        />
      )}
    </>
  );
}
