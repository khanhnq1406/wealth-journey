"use client";

import { Transaction, CategoryType } from "@/gen/protobuf/v1/transaction";
import { TransactionItem } from "./TransactionItem";
import { formatDateFriendly } from "@/lib/utils/transaction";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency, parseAmount } from "@/utils/currency-formatter";

type TransactionGroupProps = {
  date: string;
  transactions: Transaction[];
  categoryTypeMap: Map<number, CategoryType>;
  onDelete: (request: { transactionId: number }) => void;
  onEdit: (transactionId: number) => void;
};

export const TransactionGroup = ({
  date,
  transactions,
  categoryTypeMap,
  onDelete,
  onEdit,
}: TransactionGroupProps) => {
  const { currency } = useCurrency();

  // Calculate daily total using signed amounts
  // Amounts are signed: positive for income, negative for expense
  const dailyTotal = transactions.reduce((total, transaction) => {
    const amount = parseAmount(transaction.amount?.amount);
    return total + amount; // Simply add the signed amount
  }, 0);

  return (
    <div>
      {/* Date Header */}
      <div className="flex justify-between items-center mb-2 px-3">
        <div className="font-semibold text-gray-700">
          {formatDateFriendly(date)}
        </div>
        <div
          className={`font-semibold ${
            dailyTotal >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {dailyTotal >= 0 ? "+" : ""}
          {formatCurrency(Math.abs(dailyTotal), currency)}
        </div>
      </div>

      {/* Transactions */}
      <div className="space-y-1">
        {transactions.map((transaction) => (
          <TransactionItem
            key={transaction.id}
            transaction={transaction}
            categoryTypeMap={categoryTypeMap}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
};
