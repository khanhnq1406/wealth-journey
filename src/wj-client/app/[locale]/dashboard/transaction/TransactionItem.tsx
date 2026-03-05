"use client";

import { useState } from "react";
import { Transaction, CategoryType } from "@/gen/protobuf/v1/transaction";
import { resources, ButtonType } from "@/app/constants";
import { Button } from "@/components/Button";
import Image from "next/image";
import { formatDateTime } from "@/lib/utils/date";
import { formatCurrency } from "@/utils/currency-formatter";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { useTranslations } from "next-intl";

type TransactionItemProps = {
  transaction: Transaction;
  categoryTypeMap: Map<number, CategoryType>;
  onDelete: (request: { transactionId: number }) => void;
  onEdit: (transactionId: number) => void;
};

export const TransactionItem = ({
  transaction,
  categoryTypeMap,
  onDelete,
  onEdit,
}: TransactionItemProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { currency } = useCurrency();
  const tDelete = useTranslations("transaction.delete");
  const amount = transaction.displayAmount?.amount ?? transaction.amount?.amount ?? 0;

  // Determine if this is income or expense based on category type
  const categoryType = transaction.categoryId
    ? categoryTypeMap.get(transaction.categoryId)
    : undefined;

  const isIncome = categoryType === CategoryType.CATEGORY_TYPE_INCOME;

  const handleEdit = () => {
    onEdit(transaction.id);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDeleteTransaction = () => {
    onDelete({ transactionId: transaction.id });
    setShowDeleteDialog(false);
  };

  const cancelDeleteTransaction = () => {
    setShowDeleteDialog(false);
  };

  return (
    <>
    <div className="flex items-center justify-between px-3 py-3 hover:bg-gray-50 rounded-lg transition-colors">
      {/* Left side - Icon and details */}
      <div className="flex items-center gap-3 flex-1">
        {/* Category Icon */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isIncome ? "bg-green-100" : "bg-red-100"
          }`}
        >
          <Image
            width={24}
            height={24}
            alt="category-icon"
            src={`${resources}${isIncome ? "income.svg" : "expense.svg"}`}
          />
        </div>

        {/* Transaction Details */}
        <div className="flex-1 min-w-0">
          {/* Category Name - using note as fallback */}
          <div className="font-medium text-gray-900 truncate">
            {transaction.note || "Transaction"}
          </div>
          {/* Date and Note */}
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <span>{formatDateTime(transaction.date)}</span>
            {transaction.note && (
              <>
                <span>•</span>
                <span className="truncate max-w-[200px]">
                  {transaction.note}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right side - Amount and Actions */}
      <div className="flex items-center gap-3">
        {/* Amount */}
        <div
          className={`font-semibold text-lg ${
            isIncome ? "text-green-600" : "text-red-600"
          }`}
        >
          {isIncome ? "+" : "-"}
          {formatCurrency(Math.abs(amount), currency)}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1">
          <Button
            type={ButtonType.IMG}
            src={`${resources}edit.svg`}
            onClick={handleEdit}
          />
          <Button
            type={ButtonType.IMG}
            src={`${resources}delete.svg`}
            onClick={handleDelete}
          />
        </div>
      </div>
    </div>

    {showDeleteDialog && (
      <ConfirmationDialog
        title={tDelete("title")}
        message={tDelete("confirmMessage")}
        confirmText={tDelete("confirmButton")}
        cancelText={tDelete("cancelButton")}
        onConfirm={confirmDeleteTransaction}
        onCancel={cancelDeleteTransaction}
        variant="danger"
      />
    )}
    </>
  );
};
