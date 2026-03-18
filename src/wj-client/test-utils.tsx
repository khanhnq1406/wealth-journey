/**
 * Shared test utilities providing next-intl context for component tests.
 *
 * Usage:
 *   import { renderWithIntl } from "@/test-utils";
 *   renderWithIntl(<MyComponent />);
 */
import React from "react";
import { render, RenderOptions, RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

// Load all English message files at module level so tests don't need to import them
import authMessages from "./messages/en/auth.json";
import budgetMessages from "./messages/en/budget.json";
import commonMessages from "./messages/en/common.json";
import importMessages from "./messages/en/import.json";
import investmentMessages from "./messages/en/investment.json";
import navMessages from "./messages/en/nav.json";
import reportMessages from "./messages/en/report.json";
import settingsMessages from "./messages/en/settings.json";
import transactionMessages from "./messages/en/transaction.json";
import uiMessages from "./messages/en/ui.json";
import walletMessages from "./messages/en/wallet.json";
import adminMessages from "./messages/en/admin.json";

const allMessages = {
  ...authMessages,
  ...budgetMessages,
  ...commonMessages,
  ...importMessages,
  ...investmentMessages,
  ...navMessages,
  ...reportMessages,
  ...settingsMessages,
  ...transactionMessages,
  ...uiMessages,
  ...walletMessages,
  ...adminMessages,
};

interface IntlWrapperProps {
  children: React.ReactNode;
}

function IntlWrapper({ children }: IntlWrapperProps) {
  return (
    <NextIntlClientProvider locale="en" messages={allMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Renders a component wrapped in NextIntlClientProvider with all English messages.
 * Use this instead of `render` for any component that calls `useTranslations`.
 */
export function renderWithIntl(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
): RenderResult {
  return render(ui, { wrapper: IntlWrapper, ...options });
}

export { IntlWrapper };
