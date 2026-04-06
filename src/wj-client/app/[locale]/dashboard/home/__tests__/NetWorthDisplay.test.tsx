/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { NetWorthDisplay } from "../NetWorthDisplay";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    // Return recognizable values for known keys so tests can assert on them
    const translations: Record<string, string> = {
      "sharePnl.buttonAriaLabel": "Share PnL",
    };
    return translations[key] ?? key;
  },
}));
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

describe("NetWorthDisplay", () => {
  const baseProps = {
    totalNetWorth: 1000000,
    currency: "VND",
    onShareClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders share button with aria-label", () => {
    render(<NetWorthDisplay {...baseProps} />);
    // Both mobile and desktop versions render a share button
    const btns = screen.getAllByRole("button", { name: /share pnl/i });
    expect(btns.length).toBeGreaterThanOrEqual(1);
    expect(btns[0]).toBeInTheDocument();
  });

  it("calls onShareClick when share button clicked", () => {
    render(<NetWorthDisplay {...baseProps} />);
    // getAllByRole since we render both mobile and desktop versions
    const btns = screen.getAllByRole("button", { name: /share pnl/i });
    btns[0].click();
    expect(baseProps.onShareClick).toHaveBeenCalledTimes(1);
  });

  it("renders data-pnl-card attribute on the card containers", () => {
    const { container } = render(<NetWorthDisplay {...baseProps} />);
    const cards = container.querySelectorAll("[data-pnl-card]");
    // Both mobile and desktop versions have the attribute
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render share button when onShareClick is not provided", () => {
    render(
      <NetWorthDisplay totalNetWorth={1000000} currency="VND" />
    );
    expect(
      screen.queryByRole("button", { name: /share pnl/i })
    ).not.toBeInTheDocument();
  });
});
