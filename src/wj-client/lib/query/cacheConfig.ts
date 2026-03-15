/**
 * React Query Cache Configuration
 *
 * Centralized cache strategies for different data types in congdongvang.com.
 * Implements UI/UX optimization plan section 3.4: Data Fetching Optimization.
 *
 * @see docs/UI_UX_OPTIMIZATION_PLAN.md - Section 3.4
 */

import type { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

// ============================================================================
// CACHE TIME CONSTANTS
// ============================================================================

/**
 * Cache duration constants (in milliseconds)
 * Following best practices for financial data freshness
 */
export const CacheTime = {
  /** Very short cache for real-time data (15 seconds) */
  REALTIME: 15 * 1000,

  /** Short cache for frequently changing data (30 seconds) */
  SHORT: 30 * 1000,

  /** Medium cache for standard data (2 minutes) */
  MEDIUM: 2 * 60 * 1000,

  /** Long cache for stable data (5 minutes) */
  LONG: 5 * 60 * 1000,

  /** Extra long cache for rarely changing data (10 minutes) */
  EXTRA_LONG: 10 * 60 * 1000,
} as const;

// ============================================================================
// CACHE CONFIGURATION PRESETS
// ============================================================================

/**
 * Wallet queries cache configuration
 * - Medium freshness (30s stale time)
 * - 5 minute cache retention
 * - No auto-refetch on window focus
 * - Always refetch on mount to ensure balance accuracy
 */
export const walletQueryConfig = {
  staleTime: CacheTime.SHORT,
  gcTime: CacheTime.LONG, // formerly cacheTime in React Query v4
  refetchOnWindowFocus: false,
  refetchOnMount: 'always' as const,
  retry: 1,
} satisfies Partial<UseQueryOptions>;

/**
 * Transaction queries cache configuration
 * - Medium freshness (30s stale time)
 * - 5 minute cache retention
 * - No window focus refetch (prevents unnecessary API calls)
 * - Refetch on mount for latest data
 */
export const transactionQueryConfig = {
  staleTime: CacheTime.SHORT,
  gcTime: CacheTime.LONG,
  refetchOnWindowFocus: false,
  refetchOnMount: 'always' as const,
  retry: 1,
} satisfies Partial<UseQueryOptions>;

/**
 * Portfolio/Investment queries cache configuration
 * - Medium freshness (30s stale time)
 * - 5 minute cache retention
 * - Enable background refetch for latest market data
 * - Refetch on mount
 */
export const portfolioQueryConfig = {
  staleTime: CacheTime.SHORT,
  gcTime: CacheTime.LONG,
  refetchOnWindowFocus: false,
  refetchOnMount: 'always' as const,
  retry: 1,
} satisfies Partial<UseQueryOptions>;

/**
 * Market price queries cache configuration
 * - Very fresh data (15s stale time for near real-time prices)
 * - 2 minute cache retention
 * - Background refetch enabled for price updates
 * - Retry failed requests (market data APIs can be flaky)
 */
export const marketPriceQueryConfig = {
  staleTime: CacheTime.REALTIME,
  gcTime: CacheTime.MEDIUM,
  refetchOnWindowFocus: false,
  refetchOnMount: 'always' as const,
  retry: 2, // More retries for external APIs
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 3000),
} satisfies Partial<UseQueryOptions>;

/**
 * User settings/preferences cache configuration
 * - Long freshness (5 minutes - settings rarely change)
 * - 10 minute cache retention
 * - No background refetch needed
 * - Don't refetch on mount unless stale
 */
export const userSettingsQueryConfig = {
  staleTime: CacheTime.LONG,
  gcTime: CacheTime.EXTRA_LONG,
  refetchOnWindowFocus: false,
  refetchOnMount: false, // Only refetch if stale
  retry: 1,
} satisfies Partial<UseQueryOptions>;

/**
 * Category/Budget queries cache configuration
 * - Long freshness (5 minutes - categories change infrequently)
 * - 10 minute cache retention
 * - No background refetch
 * - Refetch on mount for consistency
 */
export const categoryQueryConfig = {
  staleTime: CacheTime.LONG,
  gcTime: CacheTime.EXTRA_LONG,
  refetchOnWindowFocus: false,
  refetchOnMount: 'always' as const,
  retry: 1,
} satisfies Partial<UseQueryOptions>;

/**
 * Static/reference data cache configuration
 * - Very long freshness (10 minutes - rarely changes)
 * - Long retention (10 minutes)
 * - No refetch needed
 * - Examples: available years, currency codes, gold types
 */
export const staticDataQueryConfig = {
  staleTime: CacheTime.EXTRA_LONG,
  gcTime: CacheTime.EXTRA_LONG,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  retry: 1,
} satisfies Partial<UseQueryOptions>;

// ============================================================================
// MUTATION CONFIGURATION PRESETS
// ============================================================================

/**
 * Standard mutation configuration
 * - No retries on error (user should retry manually)
 * - Single attempt per mutation
 */
export const standardMutationConfig = {
  retry: 0,
} satisfies Partial<UseMutationOptions>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create query options with custom configuration
 * Merges provided options with base config
 *
 * @param baseConfig Base cache configuration
 * @param customOptions Custom options to override
 * @returns Merged query options
 *
 * @example
 * ```ts
 * const queryOptions = createQueryOptions(walletQueryConfig, {
 *   enabled: isAuthenticated,
 *   onSuccess: (data) => console.log(data),
 * });
 * ```
 */
export function createQueryOptions<TData = unknown, TError = unknown>(
  baseConfig: Partial<UseQueryOptions<TData, TError>>,
  customOptions?: Partial<UseQueryOptions<TData, TError>>
): Partial<UseQueryOptions<TData, TError>> {
  return {
    ...baseConfig,
    ...customOptions,
  };
}

/**
 * Create mutation options with optimistic updates
 * Helper for mutations that update cached data immediately
 *
 * @param queryClient React Query client instance
 * @param queryKey Query key to update optimistically
 * @param updateFn Function to update cached data
 * @returns Mutation options with optimistic update handlers
 *
 * @example
 * ```ts
 * const mutation = useMutationUpdateWallet(
 *   createOptimisticMutationOptions(
 *     queryClient,
 *     [EVENT_WalletListWallets],
 *     (oldData, newWallet) => {
 *       return oldData.map(w => w.id === newWallet.id ? newWallet : w);
 *     }
 *   )
 * );
 * ```
 */
export function createOptimisticMutationOptions<
  TData,
  TVariables,
  TContext = { previousData: TData | undefined }
>(
  queryClient: QueryClient,
  queryKey: unknown[],
  updateFn: (oldData: TData | undefined, variables: TVariables) => TData
): Partial<UseMutationOptions<unknown, Error, TVariables, TContext>> {
  return {
    onMutate: async (variables: TVariables) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot current value for rollback
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update cached data
      queryClient.setQueryData<TData>(queryKey, (old) => updateFn(old, variables));

      // Return context with snapshot for rollback
      return { previousData } as TContext;
    },

    onError: (_err, _variables, context) => {
      // Rollback to previous data on error
      if (context && typeof context === 'object' && 'previousData' in context && context.previousData !== undefined) {
        queryClient.setQueryData(queryKey, (context as { previousData: TData }).previousData);
      }
    },

    onSettled: () => {
      // Refetch to ensure consistency after mutation completes
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

// ============================================================================
// PREFETCH HELPERS
// ============================================================================

/**
 * Prefetch query on hover/focus for perceived performance
 * Call this in onMouseEnter or onFocus handlers
 *
 * @param queryClient React Query client instance
 * @param queryKey Query key to prefetch
 * @param queryFn Function to fetch data
 *
 * @example
 * ```ts
 * <tr
 *   onMouseEnter={() => prefetchOnHover(
 *     queryClient,
 *     ['investment-details', id],
 *     () => fetchInvestmentDetails(id)
 *   )}
 * >
 * ```
 */
export function prefetchOnHover<TData>(
  queryClient: QueryClient,
  queryKey: unknown[],
  queryFn: () => Promise<TData>
): void {
  // Only prefetch if data is not already cached or is stale
  const cachedData = queryClient.getQueryData(queryKey);
  const queryState = queryClient.getQueryState(queryKey);

  if (!cachedData || (queryState && queryState.isInvalidated)) {
    queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: CacheTime.SHORT, // Keep prefetched data fresh for 30s
    });
  }
}

/**
 * Prefetch multiple related queries
 * Useful for prefetching related data when a modal opens
 *
 * @param queryClient React Query client instance
 * @param queries Array of query configurations to prefetch
 *
 * @example
 * ```ts
 * prefetchRelatedQueries(queryClient, [
 *   { queryKey: ['wallets'], queryFn: fetchWallets },
 *   { queryKey: ['categories'], queryFn: fetchCategories },
 * ]);
 * ```
 */
export function prefetchRelatedQueries(
  queryClient: QueryClient,
  queries: Array<{
    queryKey: unknown[];
    queryFn: () => Promise<unknown>;
  }>
): void {
  queries.forEach(({ queryKey, queryFn }) => {
    queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: CacheTime.SHORT,
    });
  });
}

// ============================================================================
// QUERY INVALIDATION HELPERS
// ============================================================================

/**
 * Invalidate all wallet-related queries
 * Use after mutations that affect wallet data
 *
 * @param queryClient React Query client instance
 *
 * @example
 * ```ts
 * const createWalletMutation = useMutationCreateWallet({
 *   onSuccess: () => {
 *     invalidateWalletQueries(queryClient);
 *   },
 * });
 * ```
 */
export function invalidateWalletQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      return key?.startsWith('api.wallet');
    },
  });
}

/**
 * Invalidate all transaction-related queries
 * Use after mutations that affect transaction data
 *
 * @param queryClient React Query client instance
 */
export function invalidateTransactionQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      return key?.startsWith('api.transaction');
    },
  });
}

/**
 * Invalidate all portfolio/investment queries
 * Use after mutations that affect investment data
 *
 * @param queryClient React Query client instance
 */
export function invalidatePortfolioQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0] as string;
      return key?.startsWith('api.investment');
    },
  });
}

/**
 * Invalidate all financial data queries
 * Nuclear option - use when multiple data types are affected
 * (e.g., after transfer between wallets)
 *
 * @param queryClient React Query client instance
 */
export function invalidateAllFinancialQueries(queryClient: QueryClient): void {
  invalidateWalletQueries(queryClient);
  invalidateTransactionQueries(queryClient);
  invalidatePortfolioQueries(queryClient);
}

// ============================================================================
// OPTIMISTIC UPDATE EXAMPLES
// ============================================================================

/**
 * Example: Optimistic update for wallet balance
 *
 * @example
 * ```ts
 * import { useMutationUpdateWallet, EVENT_WalletListWallets } from '@/utils/generated/hooks';
 * import { createOptimisticMutationOptions } from '@/lib/query/cacheConfig';
 * import type { Wallet, ListWalletsResponse } from '@/gen/protobuf/v1/wallet';
 *
 * function UpdateWalletForm() {
 *   const queryClient = useQueryClient();
 *
 *   const updateWalletMutation = useMutationUpdateWallet(
 *     createOptimisticMutationOptions<ListWalletsResponse, { walletId: string; walletName: string }>(
 *       queryClient,
 *       [EVENT_WalletListWallets],
 *       (oldData, variables) => {
 *         if (!oldData?.wallets) return oldData;
 *
 *         return {
 *           ...oldData,
 *           wallets: oldData.wallets.map(wallet =>
 *             wallet.id === variables.walletId
 *               ? { ...wallet, walletName: variables.walletName }
 *               : wallet
 *           ),
 *         };
 *       }
 *     )
 *   );
 *
 *   return (
 *     <form onSubmit={(e) => {
 *       e.preventDefault();
 *       updateWalletMutation.mutate({ walletId: '1', walletName: 'New Name' });
 *     }}>
 *       // Form fields
 *     </form>
 *   );
 * }
 * ```
 */

/**
 * Example: Optimistic update for adding a transaction
 *
 * @example
 * ```ts
 * import { useMutationCreateTransaction, EVENT_TransactionListTransactions } from '@/utils/generated/hooks';
 * import { createOptimisticMutationOptions } from '@/lib/query/cacheConfig';
 * import type { ListTransactionsResponse, Transaction } from '@/gen/protobuf/v1/transaction';
 *
 * function AddTransactionForm() {
 *   const queryClient = useQueryClient();
 *
 *   const createTransactionMutation = useMutationCreateTransaction(
 *     createOptimisticMutationOptions<ListTransactionsResponse, Transaction>(
 *       queryClient,
 *       [EVENT_TransactionListTransactions],
 *       (oldData, newTransaction) => {
 *         if (!oldData?.transactions) return oldData;
 *
 *         // Generate temporary ID for optimistic update
 *         const optimisticTransaction = {
 *           ...newTransaction,
 *           id: `temp-${Date.now()}`,
 *         };
 *
 *         return {
 *           ...oldData,
 *           transactions: [optimisticTransaction, ...oldData.transactions],
 *         };
 *       }
 *     )
 *   );
 *
 *   return (
 *     <form onSubmit={(e) => {
 *       e.preventDefault();
 *       createTransactionMutation.mutate({
 *         // transaction data
 *       });
 *     }}>
 *       // Form fields
 *     </form>
 *   );
 * }
 * ```
 */

/**
 * Example: Manual cache update after successful mutation
 * Use when optimistic updates are not needed or too complex
 *
 * @example
 * ```ts
 * import { useMutationDeleteWallet, EVENT_WalletListWallets } from '@/utils/generated/hooks';
 * import { useQueryClient } from '@tanstack/react-query';
 *
 * function DeleteWalletButton({ walletId }: { walletId: string }) {
 *   const queryClient = useQueryClient();
 *
 *   const deleteWalletMutation = useMutationDeleteWallet({
 *     onSuccess: () => {
 *       // Manually update cache by removing deleted wallet
 *       queryClient.setQueryData<ListWalletsResponse>(
 *         [EVENT_WalletListWallets],
 *         (oldData) => {
 *           if (!oldData?.wallets) return oldData;
 *
 *           return {
 *             ...oldData,
 *             wallets: oldData.wallets.filter(w => w.id !== walletId),
 *           };
 *         }
 *       );
 *
 *       // Or simply invalidate to trigger refetch
 *       // queryClient.invalidateQueries({ queryKey: [EVENT_WalletListWallets] });
 *     },
 *   });
 *
 *   return (
 *     <button onClick={() => deleteWalletMutation.mutate({ walletId })}>
 *       Delete Wallet
 *     </button>
 *   );
 * }
 * ```
 */

// ============================================================================
// USAGE SUMMARY
// ============================================================================

/**
 * Quick Reference Guide:
 *
 * 1. **Use cache presets in queries**:
 *    ```ts
 *    import { walletQueryConfig } from '@/lib/query/cacheConfig';
 *
 *    const { data } = useQueryListWallets(
 *      { pagination: {...} },
 *      walletQueryConfig
 *    );
 *    ```
 *
 * 2. **Create custom options**:
 *    ```ts
 *    import { createQueryOptions, walletQueryConfig } from '@/lib/query/cacheConfig';
 *
 *    const customOptions = createQueryOptions(walletQueryConfig, {
 *      enabled: isAuthenticated,
 *      onSuccess: (data) => console.log(data),
 *    });
 *    ```
 *
 * 3. **Prefetch on hover**:
 *    ```ts
 *    import { prefetchOnHover } from '@/lib/query/cacheConfig';
 *
 *    <div onMouseEnter={() => prefetchOnHover(
 *      queryClient,
 *      ['investment', id],
 *      () => fetchInvestment(id)
 *    )}>
 *    ```
 *
 * 4. **Optimistic updates**:
 *    ```ts
 *    import { createOptimisticMutationOptions } from '@/lib/query/cacheConfig';
 *
 *    const mutation = useMutationUpdateWallet(
 *      createOptimisticMutationOptions(
 *        queryClient,
 *        [EVENT_WalletListWallets],
 *        (old, variables) => ({
 *          ...old,
 *          wallets: old.wallets.map(w =>
 *            w.id === variables.id ? variables : w
 *          ),
 *        })
 *      )
 *    );
 *    ```
 *
 * 5. **Invalidate queries after mutations**:
 *    ```ts
 *    import { invalidateWalletQueries } from '@/lib/query/cacheConfig';
 *
 *    const mutation = useMutationCreateWallet({
 *      onSuccess: () => invalidateWalletQueries(queryClient),
 *    });
 *    ```
 */
