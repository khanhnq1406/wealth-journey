# React Query Cache Configuration - Usage Examples

This guide shows how to use the centralized cache configuration from `cacheConfig.ts` in your components.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Migration Guide](#migration-guide)
3. [Optimistic Updates](#optimistic-updates)
4. [Prefetching](#prefetching)
5. [Cache Invalidation](#cache-invalidation)
6. [Real-World Examples](#real-world-examples)

---

## Basic Usage

### Using Cache Presets in Queries

**Before** (manual configuration):
```typescript
const getListWallets = useQueryListWallets(
  { pagination: { page: 1, pageSize: 10, orderBy: "", order: "" } },
  { refetchOnMount: "always" }
);
```

**After** (using preset):
```typescript
import { walletQueryConfig } from '@/lib/query/cacheConfig';

const getListWallets = useQueryListWallets(
  { pagination: { page: 1, pageSize: 10, orderBy: "", order: "" } },
  walletQueryConfig
);
```

### Available Cache Presets

| Preset | Use Case | Stale Time | Cache Time |
|--------|----------|------------|------------|
| `walletQueryConfig` | Wallet data | 30s | 5min |
| `transactionQueryConfig` | Transaction data | 30s | 5min |
| `portfolioQueryConfig` | Investment portfolio | 30s | 5min |
| `marketPriceQueryConfig` | Market prices | 15s | 2min |
| `userSettingsQueryConfig` | User preferences | 5min | 10min |
| `categoryQueryConfig` | Categories/budgets | 5min | 10min |
| `staticDataQueryConfig` | Static/reference data | 10min | 10min |

---

## Migration Guide

### Step 1: Replace Current Dashboard Home Page

**File**: `src/wj-client/app/dashboard/home/page.tsx`

**Before**:
```typescript
const getListWallets = useQueryListWallets(
  { pagination: { page: 1, pageSize: 10, orderBy: "", order: "" } },
  { refetchOnMount: "always" }
);

const { data: availableYearsData } = useQueryGetAvailableYears(
  {},
  { refetchOnMount: "always" }
);
```

**After**:
```typescript
import { walletQueryConfig, staticDataQueryConfig } from '@/lib/query/cacheConfig';

const getListWallets = useQueryListWallets(
  { pagination: { page: 1, pageSize: 10, orderBy: "", order: "" } },
  walletQueryConfig
);

const { data: availableYearsData } = useQueryGetAvailableYears(
  {},
  staticDataQueryConfig
);
```

### Step 2: Replace Portfolio Page

**File**: `src/wj-client/app/dashboard/portfolio/page.tsx`

**Before**:
```typescript
const { data: investmentWallets } = useQueryListWallets(
  { pagination: { page: 1, pageSize: 100, orderBy: "", order: "" } },
  { refetchOnMount: "always" }
);

const { data: investments } = useQueryListUserInvestments(
  { userId: Number(user?.id) },
  { refetchOnMount: "always", enabled: !!user?.id }
);

const { data: portfolioSummary } = useQueryGetAggregatedPortfolioSummary(
  { userId: Number(user?.id) },
  { refetchOnMount: "always", enabled: !!user?.id }
);
```

**After**:
```typescript
import {
  walletQueryConfig,
  portfolioQueryConfig,
  createQueryOptions
} from '@/lib/query/cacheConfig';

const { data: investmentWallets } = useQueryListWallets(
  { pagination: { page: 1, pageSize: 100, orderBy: "", order: "" } },
  walletQueryConfig
);

const { data: investments } = useQueryListUserInvestments(
  { userId: Number(user?.id) },
  createQueryOptions(portfolioQueryConfig, {
    enabled: !!user?.id,
  })
);

const { data: portfolioSummary } = useQueryGetAggregatedPortfolioSummary(
  { userId: Number(user?.id) },
  createQueryOptions(portfolioQueryConfig, {
    enabled: !!user?.id,
  })
);
```

### Step 3: Replace Transaction Page

**File**: `src/wj-client/app/dashboard/transaction/page.tsx`

**Before**:
```typescript
const getListTransactions = useQueryListTransactions(
  { walletId: currentWalletId, pagination },
  { refetchOnMount: "always" }
);

const { data: categories } = useQueryListCategories(
  {},
  { refetchOnMount: "always" }
);
```

**After**:
```typescript
import { transactionQueryConfig, categoryQueryConfig } from '@/lib/query/cacheConfig';

const getListTransactions = useQueryListTransactions(
  { walletId: currentWalletId, pagination },
  transactionQueryConfig
);

const { data: categories } = useQueryListCategories(
  {},
  categoryQueryConfig
);
```

---

## Optimistic Updates

### Example 1: Update Wallet Name

```typescript
import { useMutationUpdateWallet, EVENT_WalletListWallets } from '@/utils/generated/hooks';
import { createOptimisticMutationOptions } from '@/lib/query/cacheConfig';
import { useQueryClient } from '@tanstack/react-query';
import type { ListWalletsResponse, UpdateWalletRequest } from '@/gen/protobuf/v1/wallet';

function EditWalletForm({ walletId }: { walletId: string }) {
  const queryClient = useQueryClient();

  const updateWalletMutation = useMutationUpdateWallet(
    createOptimisticMutationOptions<
      ListWalletsResponse,
      UpdateWalletRequest
    >(
      queryClient,
      [EVENT_WalletListWallets],
      (oldData, variables) => {
        if (!oldData?.wallets) return oldData;

        return {
          ...oldData,
          wallets: oldData.wallets.map(wallet =>
            wallet.id === variables.walletId
              ? { ...wallet, walletName: variables.walletName }
              : wallet
          ),
        };
      }
    )
  );

  const handleSubmit = (walletName: string) => {
    updateWalletMutation.mutate({
      walletId,
      walletName,
    });
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit('New Wallet Name');
    }}>
      {/* Form fields */}
    </form>
  );
}
```

### Example 2: Add Transaction with Optimistic Update

```typescript
import { useMutationCreateTransaction, EVENT_TransactionListTransactions } from '@/utils/generated/hooks';
import { createOptimisticMutationOptions } from '@/lib/query/cacheConfig';
import { useQueryClient } from '@tanstack/react-query';
import type { ListTransactionsResponse, CreateTransactionRequest } from '@/gen/protobuf/v1/transaction';

function AddTransactionForm() {
  const queryClient = useQueryClient();

  const createTransactionMutation = useMutationCreateTransaction(
    createOptimisticMutationOptions<
      ListTransactionsResponse,
      CreateTransactionRequest
    >(
      queryClient,
      [EVENT_TransactionListTransactions],
      (oldData, newTransaction) => {
        if (!oldData?.transactions) return oldData;

        // Create optimistic transaction with temporary ID
        const optimisticTransaction = {
          ...newTransaction,
          id: `temp-${Date.now()}`,
          createdAt: Math.floor(Date.now() / 1000),
        };

        // Add to beginning of list (most recent first)
        return {
          ...oldData,
          transactions: [optimisticTransaction, ...oldData.transactions],
        };
      }
    )
  );

  const handleSubmit = (data: CreateTransactionRequest) => {
    createTransactionMutation.mutate(data);
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      // handleSubmit with form data
    }}>
      {/* Form fields */}
      <button
        type="submit"
        disabled={createTransactionMutation.isPending}
      >
        {createTransactionMutation.isPending ? 'Adding...' : 'Add Transaction'}
      </button>
    </form>
  );
}
```

### Example 3: Delete Wallet (Simple Cache Update)

```typescript
import { useMutationDeleteWallet, EVENT_WalletListWallets } from '@/utils/generated/hooks';
import { useQueryClient } from '@tanstack/react-query';
import type { ListWalletsResponse } from '@/gen/protobuf/v1/wallet';

function DeleteWalletButton({ walletId }: { walletId: string }) {
  const queryClient = useQueryClient();

  const deleteWalletMutation = useMutationDeleteWallet({
    onSuccess: () => {
      // Option 1: Manually update cache (faster)
      queryClient.setQueryData<ListWalletsResponse>(
        [EVENT_WalletListWallets],
        (oldData) => {
          if (!oldData?.wallets) return oldData;

          return {
            ...oldData,
            wallets: oldData.wallets.filter(w => w.id !== walletId),
          };
        }
      );

      // Option 2: Invalidate to trigger refetch (more reliable)
      // queryClient.invalidateQueries({ queryKey: [EVENT_WalletListWallets] });
    },
  });

  return (
    <button onClick={() => deleteWalletMutation.mutate({ walletId })}>
      Delete Wallet
    </button>
  );
}
```

---

## Prefetching

### Example 1: Prefetch on Hover (Investment Details)

```typescript
import { prefetchOnHover } from '@/lib/query/cacheConfig';
import { useQueryClient } from '@tanstack/react-query';
import { EVENT_InvestmentGetInvestment } from '@/utils/generated/hooks';
import { api } from '@/utils/generated/api';

function InvestmentTable({ investments }: { investments: Investment[] }) {
  const queryClient = useQueryClient();

  const handleRowHover = (investmentId: string) => {
    prefetchOnHover(
      queryClient,
      [EVENT_InvestmentGetInvestment, { investmentId }],
      () => api.investment.getInvestment({ investmentId })
    );
  };

  return (
    <table>
      <tbody>
        {investments.map(investment => (
          <tr
            key={investment.id}
            onMouseEnter={() => handleRowHover(investment.id)}
            onClick={() => openInvestmentModal(investment.id)}
          >
            <td>{investment.symbol}</td>
            <td>{investment.quantity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Example 2: Prefetch Related Queries

```typescript
import { prefetchRelatedQueries } from '@/lib/query/cacheConfig';
import { useQueryClient } from '@tanstack/react-query';
import {
  EVENT_WalletListWallets,
  EVENT_CategoryListCategories,
} from '@/utils/generated/hooks';
import { api } from '@/utils/generated/api';

function AddTransactionButton() {
  const queryClient = useQueryClient();

  const handleOpenModal = () => {
    // Prefetch data needed for the form
    prefetchRelatedQueries(queryClient, [
      {
        queryKey: [EVENT_WalletListWallets],
        queryFn: () => api.wallet.listWallets({ pagination: {} }),
      },
      {
        queryKey: [EVENT_CategoryListCategories],
        queryFn: () => api.category.listCategories({}),
      },
    ]);

    // Open modal after prefetch starts
    setModalOpen(true);
  };

  return (
    <button onClick={handleOpenModal}>
      Add Transaction
    </button>
  );
}
```

---

## Cache Invalidation

### Example 1: Invalidate Specific Domain

```typescript
import {
  invalidateWalletQueries,
  invalidateTransactionQueries,
  invalidatePortfolioQueries,
} from '@/lib/query/cacheConfig';
import { useQueryClient } from '@tanstack/react-query';

function CreateWalletForm() {
  const queryClient = useQueryClient();

  const createWalletMutation = useMutationCreateWallet({
    onSuccess: () => {
      // Invalidate all wallet queries
      invalidateWalletQueries(queryClient);
      onClose();
    },
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      createWalletMutation.mutate(formData);
    }}>
      {/* Form fields */}
    </form>
  );
}
```

### Example 2: Invalidate Multiple Domains (Transfer Money)

```typescript
import { invalidateAllFinancialQueries } from '@/lib/query/cacheConfig';
import { useQueryClient } from '@tanstack/react-query';

function TransferMoneyForm() {
  const queryClient = useQueryClient();

  const transferMutation = useMutationTransferFunds({
    onSuccess: () => {
      // Transfer affects both wallets and transactions
      // Invalidate all financial queries
      invalidateAllFinancialQueries(queryClient);
      onClose();
    },
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      transferMutation.mutate(transferData);
    }}>
      {/* Form fields */}
    </form>
  );
}
```

### Example 3: Selective Invalidation

```typescript
import { useQueryClient } from '@tanstack/react-query';
import {
  EVENT_WalletListWallets,
  EVENT_WalletGetTotalBalance,
  EVENT_WalletGetBalanceHistory,
} from '@/utils/generated/hooks';

function AddTransactionForm() {
  const queryClient = useQueryClient();

  const createTransactionMutation = useMutationCreateTransaction({
    onSuccess: () => {
      // Only invalidate specific queries that are affected
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return [
            EVENT_WalletListWallets,
            EVENT_WalletGetTotalBalance,
            EVENT_WalletGetBalanceHistory,
            EVENT_TransactionListTransactions,
          ].includes(key);
        },
      });
      onClose();
    },
  });

  return <form>{/* Form fields */}</form>;
}
```

---

## Real-World Examples

### Complete Page Migration: Dashboard Home

**File**: `src/wj-client/app/dashboard/home/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useQueryListWallets,
  useQueryGetAvailableYears,
  EVENT_WalletListWallets,
  EVENT_WalletGetTotalBalance,
  EVENT_TransactionListTransactions,
  EVENT_WalletGetBalanceHistory,
  EVENT_WalletGetMonthlyDominance,
} from "@/utils/generated/hooks";
import {
  walletQueryConfig,
  staticDataQueryConfig,
  invalidateWalletQueries,
  invalidateTransactionQueries,
} from "@/lib/query/cacheConfig";
import { BaseModal } from "@/components/modals/BaseModal";
import { CreateWalletForm } from "@/components/modals/forms/CreateWalletForm";
import { AddTransactionForm } from "@/components/modals/forms/AddTransactionForm";
import { TransferMoneyForm } from "@/components/modals/forms/TransferMoneyForm";

type ModalType = "add-transaction" | "transfer-money" | "create-wallet" | null;

export default function Home() {
  const queryClient = useQueryClient();
  const [modalType, setModalType] = useState<ModalType>(null);

  // Use cache presets for queries
  const getListWallets = useQueryListWallets(
    { pagination: { page: 1, pageSize: 10, orderBy: "", order: "" } },
    walletQueryConfig
  );

  const { data: availableYearsData } = useQueryGetAvailableYears(
    {},
    staticDataQueryConfig
  );

  const availableYears = availableYearsData?.years?.length
    ? availableYearsData.years
    : [new Date().getFullYear()];

  const handleModalClose = () => setModalType(null);

  const handleModalSuccess = () => {
    // Use helper functions for invalidation
    invalidateWalletQueries(queryClient);
    invalidateTransactionQueries(queryClient);
    handleModalClose();
  };

  const getModalTitle = () => {
    switch (modalType) {
      case "add-transaction":
        return "Add Transaction";
      case "transfer-money":
        return "Transfer Money";
      case "create-wallet":
        return "Create Wallet";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Page content */}

      <BaseModal
        isOpen={modalType !== null}
        onClose={handleModalClose}
        title={getModalTitle()}
      >
        {modalType === "add-transaction" && (
          <AddTransactionForm onSuccess={handleModalSuccess} />
        )}
        {modalType === "transfer-money" && (
          <TransferMoneyForm onSuccess={handleModalSuccess} />
        )}
        {modalType === "create-wallet" && (
          <CreateWalletForm onSuccess={handleModalSuccess} />
        )}
      </BaseModal>
    </div>
  );
}
```

### Complete Form with Optimistic Updates

**File**: `src/wj-client/components/modals/forms/EditWalletForm.tsx`

```typescript
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMutationUpdateWallet,
  EVENT_WalletListWallets,
} from "@/utils/generated/hooks";
import { createOptimisticMutationOptions } from "@/lib/query/cacheConfig";
import type { ListWalletsResponse, UpdateWalletRequest } from "@/gen/protobuf/v1/wallet";
import { Button } from "@/components/Button";
import { FormInput } from "@/components/forms/FormInput";
import { Success } from "@/components/modals/Success";
import { ErrorMessage } from "@/components/forms/ErrorMessage";

interface EditWalletFormProps {
  walletId: string;
  currentName: string;
  onSuccess?: () => void;
}

export function EditWalletForm({
  walletId,
  currentName,
  onSuccess,
}: EditWalletFormProps) {
  const queryClient = useQueryClient();
  const [walletName, setWalletName] = useState(currentName);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [showSuccess, setShowSuccess] = useState(false);

  // Use optimistic updates for instant feedback
  const updateWalletMutation = useMutationUpdateWallet(
    createOptimisticMutationOptions<ListWalletsResponse, UpdateWalletRequest>(
      queryClient,
      [EVENT_WalletListWallets],
      (oldData, variables) => {
        if (!oldData?.wallets) return oldData;

        return {
          ...oldData,
          wallets: oldData.wallets.map(wallet =>
            wallet.id === variables.walletId
              ? { ...wallet, walletName: variables.walletName }
              : wallet
          ),
        };
      }
    )
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(undefined);

    updateWalletMutation.mutate(
      { walletId, walletName },
      {
        onSuccess: () => {
          setShowSuccess(true);
        },
        onError: (error: any) => {
          setErrorMessage(error.message || "Failed to update wallet");
        },
      }
    );
  };

  if (showSuccess) {
    return <Success message="Wallet updated successfully!" onDone={onSuccess} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormInput
        label="Wallet Name"
        name="walletName"
        value={walletName}
        onChange={(e) => setWalletName(e.target.value)}
        required
      />

      {errorMessage && <ErrorMessage message={errorMessage} />}

      <Button
        type="submit"
        loading={updateWalletMutation.isPending}
        disabled={!walletName || walletName === currentName}
      >
        Update Wallet
      </Button>
    </form>
  );
}
```

---

## Benefits of This Approach

1. **Consistency**: All queries use the same cache strategies
2. **Maintainability**: Change cache times in one place
3. **Performance**: Optimal cache durations for each data type
4. **Type Safety**: Full TypeScript support with generics
5. **DRY**: No repeated configuration across components
6. **Best Practices**: Following React Query and UI/UX optimization guidelines

---

## Migration Checklist

- [ ] Update `src/wj-client/app/dashboard/home/page.tsx` to use cache presets
- [ ] Update `src/wj-client/app/dashboard/portfolio/page.tsx` to use cache presets
- [ ] Update `src/wj-client/app/dashboard/transaction/page.tsx` to use cache presets
- [ ] Update `src/wj-client/app/dashboard/wallets/page.tsx` to use cache presets
- [ ] Update wallet form components to use optimistic updates
- [ ] Update transaction form components to use optimistic updates
- [ ] Add hover prefetching to investment table rows
- [ ] Replace manual invalidation with helper functions
- [ ] Test all pages for correct cache behavior
- [ ] Monitor network requests to verify reduced API calls

---

## Performance Monitoring

After migration, monitor these metrics:

1. **Network Requests**: Should see ~30% reduction in API calls
2. **UI Responsiveness**: Optimistic updates should feel instant
3. **Cache Hit Rate**: Check React Query DevTools
4. **Bundle Size**: Should remain the same (no new dependencies)
5. **Time to Interactive**: Should improve with prefetching

---

## Troubleshooting

### Query not refetching when expected

**Problem**: Data feels stale
**Solution**: Check if `staleTime` is too long or `refetchOnMount` is disabled

```typescript
// Temporarily force fresh data
const { data } = useQueryListWallets(
  { pagination: {...} },
  {
    ...walletQueryConfig,
    staleTime: 0, // Always consider stale
    refetchOnMount: 'always',
  }
);
```

### Optimistic update not working

**Problem**: UI doesn't update immediately
**Solution**: Ensure query key matches exactly

```typescript
// Check query key matches
const queryKey = [EVENT_WalletListWallets]; // Must match exactly
queryClient.getQueryData(queryKey); // Should return data
```

### Cache not invalidating

**Problem**: Stale data after mutation
**Solution**: Use predicate to invalidate related queries

```typescript
queryClient.invalidateQueries({
  predicate: (query) => {
    const key = query.queryKey[0] as string;
    console.log('Checking key:', key); // Debug
    return key?.startsWith('api.wallet');
  },
});
```

---

## Additional Resources

- [React Query Documentation](https://tanstack.com/query/latest)
- [UI/UX Optimization Plan](../../docs/UI_UX_OPTIMIZATION_PLAN.md)
- [congdongvang.com CLAUDE.md](./.claude/CLAUDE.md)
