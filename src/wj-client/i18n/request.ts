import { getRequestConfig } from 'next-intl/server';

export const locales = ['vi', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'vi';

// Message file groups — each file covers related namespaces
const messageGroups = [
  'common',      // common, dates, validation
  'nav',         // nav, landing, sidebarToggle
  'auth',        // auth.*
  'transaction', // transaction.*, transfer, transactionCard, transactionReview
  'wallet',      // wallet.*
  'investment',  // investment.*, prices, investmentPrice, changeRate, currencyConversion
  'budget',      // budget.*
  'report',      // report.*, export, share
  'finance',     // finance.tabs
  'import',      // import.*, reviewStep
  'settings',    // settings.*, currency
  'feedback',    // feedback.* (user feedback submission & history)
  'admin',       // admin.* (CMS, users, feedback management)
  'ui',          // modals, feedback, emptyState, errorState, formWizard, skeleton,
                 // pullToRefresh, pwa, search, select, datePicker, currencySelector,
                 // dashboard, symbolAutocomplete, connectionStatus, dataFreshness,
                 // quickActions, featureDiscovery, landingErrorBoundary
  'errors',      // error code translations for i18n error display
  'community',   // community.profile (edit profile, bio, etc.)
] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  // Get locale from request (set by middleware)
  let locale = await requestLocale;

  // Validate locale — fall back to default if invalid
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }

  // Load all message groups and merge into a single flat messages object
  const groupModules = await Promise.all(
    messageGroups.map((group) => import(`../messages/${locale}/${group}.json`))
  );

  const messages = Object.assign({}, ...groupModules.map((m) => m.default));

  return { locale, messages };
});
