/**
 * Tests for FinanceTabBar backward-compatibility wrapper
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPattern=FinanceTabBar
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { FinanceTabBar, FINANCE_TABS } from "../FinanceTabBar";

const messages = {
  finance: {
    tabs: {
      transaction: "Transactions",
      report: "Report",
      budget: "Budget",
    },
  },
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("FinanceTabBar", () => {
  it("exports FINANCE_TABS array with 3 tabs", () => {
    expect(FINANCE_TABS).toEqual(["transaction", "report", "budget"]);
  });

  it("renders translated tab labels", () => {
    render(
      <Wrapper>
        <FinanceTabBar activeTab="transaction" onTabChange={jest.fn()} />
      </Wrapper>
    );
    expect(screen.getByRole("tab", { name: "Transactions" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Report" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Budget" })).toBeInTheDocument();
  });

  it("calls onTabChange with correct FinanceTab value", () => {
    const onTabChange = jest.fn();
    render(
      <Wrapper>
        <FinanceTabBar activeTab="transaction" onTabChange={onTabChange} />
      </Wrapper>
    );
    fireEvent.click(screen.getByRole("tab", { name: "Report" }));
    expect(onTabChange).toHaveBeenCalledWith("report");
  });

  it("has sticky tablist", () => {
    const { container } = render(
      <Wrapper>
        <FinanceTabBar activeTab="transaction" onTabChange={jest.fn()} />
      </Wrapper>
    );
    expect(container.querySelector(".sticky")).toBeInTheDocument();
  });
});
