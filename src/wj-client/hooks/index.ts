// Export custom useAuth hook with localStorage management
export { useAuth } from '@/features/auth/hooks/useAuth';
export type { AuthState, AuthActions } from '@/features/auth/hooks/useAuth';

// Export useDebounce hook
export { useDebounce } from './useDebounce';

// Export usePortfolioHistoricalValues hook (moved to features/investment/hooks)
export { usePortfolioHistoricalValues, useLivePortfolioHistoricalValues } from '@/features/investment/hooks/usePortfolioHistoricalValues';
export type { HistoricalPortfolioValue, PortfolioHistoricalValuesResponse, UsePortfolioHistoricalValuesOptions } from '@/features/investment/hooks/usePortfolioHistoricalValues';

// Export useMobile hook
export { useMobile } from './useMobile';

// Export usePWAInstall hook
export { usePWAInstall } from './usePWAInstall';
export type { PWAInstallState, Platform } from './usePWAInstall';
