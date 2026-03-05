"use client";

import { memo, Fragment, useRef, useEffect } from "react";
import { formatCurrency as formatCurrencyUtil } from "@/utils/currency-formatter";
import { useCurrency } from "@/contexts/CurrencyContext";

interface MonthlyData {
  income: number;
  expense: number;
  balance: number;
}

interface WalletData {
  id: number;
  walletName: string;
  balance?: { amount: number };
  displayBalance?: { amount: number };
  isExpanded: boolean;
  monthlyData: MonthlyData[];
}

interface TableData {
  income: number;
  expense: number;
  balance: number;
}

interface ExpandableTableProps {
  months: string[];
  wallets: WalletData[];
  totals: TableData[];
  onToggleWallet: (walletId: number) => void;
}

export const ExpandableTable = memo(function ExpandableTable({
  months,
  wallets,
  totals,
  onToggleWallet,
}: ExpandableTableProps) {
  const { currency } = useCurrency();
  const scrollableRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (amount: number): string => {
    return formatCurrencyUtil(amount, currency);
  };

  // Synchronize horizontal scroll between body and footer
  useEffect(() => {
    const scrollable = scrollableRef.current;
    const footer = footerRef.current;

    if (!scrollable || !footer) return;

    const handleBodyScroll = () => {
      if (footer) {
        footer.scrollLeft = scrollable.scrollLeft;
      }
    };

    const handleFooterScroll = () => {
      if (scrollable) {
        scrollable.scrollLeft = footer.scrollLeft;
      }
    };

    scrollable.addEventListener("scroll", handleBodyScroll);
    footer.addEventListener("scroll", handleFooterScroll);

    return () => {
      scrollable.removeEventListener("scroll", handleBodyScroll);
      footer.removeEventListener("scroll", handleFooterScroll);
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable table body */}
      <div ref={scrollableRef} className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse">
          <colgroup>
            <col className="w-[120px]" />
            {months.map((_, index) => (
              <col key={index} className="w-[80px]" />
            ))}
            <col className="w-[120px]" />
          </colgroup>
          <thead className="sticky top-0 bg-white z-10 shadow-sm">
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 px-2 sm:py-3 sm:px-4 font-semibold text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                Wallet
              </th>
              {months.map((month) => (
                <th
                  key={month}
                  className="text-center py-2 px-1 sm:py-3 sm:px-2 font-semibold text-xs sm:text-sm text-gray-700 min-w-[60px] sm:min-w-[80px] whitespace-nowrap"
                >
                  {month}
                </th>
              ))}
              <th className="text-center py-2 px-2 sm:py-3 sm:px-4 font-semibold text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((wallet) => (
              <Fragment key={wallet.id}>
                <tr
                  className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                  onClick={() => onToggleWallet(wallet.id)}
                >
                  <td className="py-2 px-2 sm:py-3 sm:px-4">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWallet(wallet.id);
                        }}
                        className="w-4 h-4 flex items-center justify-center flex-shrink-0"
                        aria-label={wallet.isExpanded ? "Collapse" : "Expand"}
                      >
                        {wallet.isExpanded ? (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M7.41 15.41L12 10.83L16.59 15.41L18 14L12 8L6 14L7.41 15.41Z"
                              fill="#333333"
                            />
                          </svg>
                        ) : (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M7.41 8.59L12 13.17L16.59 8.59L18 10L12 16L6 10L7.41 8.59Z"
                              fill="#333333"
                            />
                          </svg>
                        )}
                      </button>
                      <span className="font-medium text-xs sm:text-sm truncate">
                        {wallet.walletName}
                      </span>
                    </div>
                  </td>
                  {wallet.monthlyData.map((data, index) => (
                    <td
                      key={index}
                      className="text-center py-2 px-1 sm:py-3 sm:px-2 text-xs sm:text-sm text-gray-600 whitespace-nowrap"
                    >
                      {data.balance}
                    </td>
                  ))}
                  <td className="text-center py-2 px-2 sm:py-3 sm:px-4 font-semibold text-xs sm:text-sm whitespace-nowrap">
                    {formatCurrency(wallet.displayBalance?.amount ?? wallet.balance?.amount ?? 0)}
                  </td>
                </tr>

                {wallet.isExpanded && (
                  <tr className="bg-gray-50">
                    <td className="py-1.5 px-2 sm:py-2 sm:px-4">
                      <div className="pl-4 sm:pl-6 text-xs text-gray-500">
                        Income
                      </div>
                    </td>
                    {wallet.monthlyData.map((data, index) => (
                      <td
                        key={`income-${index}`}
                        className="text-center py-1.5 px-1 sm:py-2 sm:px-2 text-xs text-green-600 whitespace-nowrap"
                      >
                        {data.income > 0 ? formatCurrency(data.income) : "-"}
                      </td>
                    ))}
                    <td className="text-center py-1.5 px-2 sm:py-2 sm:px-4 text-xs font-semibold text-green-600 whitespace-nowrap">
                      {formatCurrency(
                        wallet.monthlyData.reduce(
                          (sum, m) => sum + m.income,
                          0,
                        ),
                      )}
                    </td>
                  </tr>
                )}
                {wallet.isExpanded && (
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <td className="py-1.5 px-2 sm:py-2 sm:px-4">
                      <div className="pl-4 sm:pl-6 text-xs text-gray-500">
                        Expense
                      </div>
                    </td>
                    {wallet.monthlyData.map((data, index) => (
                      <td
                        key={`expense-${index}`}
                        className="text-center py-1.5 px-1 sm:py-2 sm:px-2 text-xs text-red-600 whitespace-nowrap"
                      >
                        {data.expense > 0 ? formatCurrency(data.expense) : "-"}
                      </td>
                    ))}
                    <td className="text-center py-1.5 px-2 sm:py-2 sm:px-4 text-xs font-semibold text-red-600 whitespace-nowrap">
                      {formatCurrency(
                        wallet.monthlyData.reduce(
                          (sum, m) => sum + m.expense,
                          0,
                        ),
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fixed Totals Row at bottom */}
      <div
        ref={footerRef}
        className="flex-shrink-0 border-t-2 border-gray-300 bg-gray-100 shadow-[0_-2px_4px_rgba(0,0,0,0.1)] overflow-x-auto overflow-y-hidden scrollbar-hide"
      >
        <table className="w-full border-collapse">
          <colgroup>
            <col className="w-[120px]" />
            {months.map((_, index) => (
              <col key={index} className="w-[80px]" />
            ))}
            <col className="w-[120px]" />
          </colgroup>
          <tbody>
            <tr className="font-semibold">
              <td className="py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm">
                Total
              </td>
              {months.map((_, index) => (
                <td
                  key={`total-${index}`}
                  className="text-center py-2 px-1 sm:py-3 sm:px-2 text-xs sm:text-sm whitespace-nowrap"
                >
                  {formatCurrency(totals[index]?.balance ?? 0)}
                </td>
              ))}
              <td className="text-center py-2 px-2 sm:py-3 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                {formatCurrency(
                  wallets.reduce((sum, w) => sum + (w.displayBalance?.amount ?? w.balance?.amount ?? 0), 0)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
});
