"use client";

/**
 * Optimized Component Loading
 *
 * This file implements dynamic imports and code splitting for heavy components
 * following Vercel React Best Practices:
 * - bundle-dynamic-imports: Use next/dynamic for heavy components
 * - bundle-preload: Preload components on hover/focus for perceived speed
 * - bundle-conditional: Load modules only when feature is activated
 */

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// Loading fallback component
function TableLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-pulse flex space-x-4">
        <div className="flex-1 space-y-4 py-1">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-v2-gold-primary"></div>
    </div>
  );
}

/**
 * Dynamic TanStack Table with loading state
 * Rule: bundle-dynamic-imports - Heavy table component loaded on demand
 */
export const TanStackTable = dynamic(
  () => import("../table/TanStackTable").then((mod) => mod.TanStackTable),
  {
    loading: () => <TableLoadingFallback />,
    ssr: false, // Table doesn't need SSR
  }
);

/**
 * Dynamic Investment Detail Modal with loading state
 * Rule: bundle-dynamic-imports - Complex modal (385 lines) loaded on demand
 */
export const InvestmentDetailModal = dynamic(
  () =>
    import("@/features/investment/components/InvestmentDetailModal").then(
      (mod) => mod.InvestmentDetailModal
    ),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);

/**
 * Dynamic Chart Components
 * Rule: bundle-dynamic-imports - Recharts components loaded on demand
 * These components are heavy and only used on specific pages
 */
export const BalanceChart = dynamic(
  () => import("../../app/[locale]/dashboard/report/Balance").then((mod) => mod.Balance),
  {
    loading: () => <TableLoadingFallback />,
    ssr: false,
  }
);

export const DominanceChart = dynamic(
  () =>
    import("../../app/[locale]/dashboard/report/Dominance").then((mod) => mod.Dominance),
  {
    loading: () => <TableLoadingFallback />,
    ssr: false,
  }
);

export const MonthlyDominanceChart = dynamic(
  () =>
    import("../../app/[locale]/dashboard/report/MonthlyDominance").then(
      (mod) => mod.MonthlyDominance
    ),
  {
    loading: () => <TableLoadingFallback />,
    ssr: false,
  }
);

export const AccountBalanceChart = dynamic(
  () =>
    import("../../app/[locale]/dashboard/report/AccountBalance").then(
      (mod) => mod.AccountBalance
    ),
  {
    loading: () => <TableLoadingFallback />,
    ssr: false,
  }
);

/**
 * Preload helper for bundle-preload optimization
 * Call this on hover/focus to preload the component before user interaction
 *
 * Usage:
 * <Button
 *   onMouseEnter={() => preloadInvestmentDetailModal()}
 *   onClick={() => setOpenModal(true)}
 * >
 *   View Details
 * </Button>
 */
export const preloadInvestmentDetailModal = () => {
  import("@/features/investment/components/InvestmentDetailModal");
};

export const preloadTanStackTable = () => {
  import("../table/TanStackTable");
};

export const preloadCharts = () => {
  import("../../app/[locale]/dashboard/report/Balance");
  import("../../app/[locale]/dashboard/report/Dominance");
  import("../../app/[locale]/dashboard/report/MonthlyDominance");
  import("../../app/[locale]/dashboard/report/AccountBalance");
};

export const preloadTransactionForms = () => {
  import("@/features/transaction/forms/AddTransactionForm");
  import("@/features/transaction/forms/EditTransactionForm");
  import("@/features/wallet/forms/TransferMoneyForm");
};

export const preloadBudgetForms = () => {
  import("@/features/budget/forms/CreateBudgetForm");
  import("@/features/budget/forms/EditBudgetForm");
  import("@/features/budget/forms/CreateBudgetItemForm");
  import("@/features/budget/forms/EditBudgetItemForm");
};

export const preloadInvestmentForms = () => {
  import("@/features/investment/forms/AddInvestmentForm");
};

/**
 * Form Components - lazy loaded for modals
 * Rule: bundle-conditional - Load only when modal opens
 */
export const CreateWalletForm = dynamic(
  () =>
    import("@/features/wallet/forms/CreateWalletForm").then(
      (mod) => mod.CreateWalletForm
    ),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);

export const AddTransactionForm = dynamic(
  () =>
    import("@/features/transaction/forms/AddTransactionForm").then(
      (mod) => mod.AddTransactionForm
    ),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);

export const TransferMoneyForm = dynamic(
  () =>
    import("@/features/wallet/forms/TransferMoneyForm").then(
      (mod) => mod.TransferMoneyForm
    ),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);

export const AddInvestmentForm = dynamic(
  () =>
    import("@/features/investment/forms/AddInvestmentForm").then(
      (mod) => mod.AddInvestmentForm
    ),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);

export const EditTransactionForm = dynamic(
  () =>
    import("@/features/transaction/forms/EditTransactionForm").then(
      (mod) => mod.EditTransactionForm
    ),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);

export const CreateBudgetForm = dynamic(
  () =>
    import("@/features/budget/forms/CreateBudgetForm").then(
      (mod) => mod.CreateBudgetForm
    ),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);

export const EditBudgetForm = dynamic(
  () =>
    import("@/features/budget/forms/EditBudgetForm").then(
      (mod) => mod.EditBudgetForm
    ),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);

export const CreateBudgetItemForm = dynamic(
  () =>
    import("@/features/budget/forms/CreateBudgetItemForm").then(
      (mod) => mod.CreateBudgetItemForm
    ),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);

export const EditBudgetItemForm = dynamic(
  () =>
    import("@/features/budget/forms/EditBudgetItemForm").then(
      (mod) => mod.EditBudgetItemForm
    ),
  {
    loading: () => <ModalLoadingFallback />,
    ssr: false,
  }
);
