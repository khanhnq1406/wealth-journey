/**
 * TDD tests for GuideTOC component.
 *
 * Run: cd src/wj-client && npx jest --testPathPatterns="guide/__tests__/GuideTOC" --no-coverage
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { GuideTOC } from "../GuideTOC";

const SECTIONS = [
  { id: "getting-started", label: "Getting Started" },
  { id: "wallets", label: "Wallets" },
  { id: "transactions", label: "Transactions" },
  { id: "investments", label: "Investments" },
];

describe("GuideTOC", () => {
  describe("renders all section links", () => {
    it("renders a button for every section (both mobile and desktop copies)", () => {
      render(<GuideTOC sections={SECTIONS} activeSection="getting-started" />);
      for (const section of SECTIONS) {
        // Both mobile and desktop render the same label — use getAllByText
        const buttons = screen.getAllByText(section.label);
        expect(buttons.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("renders 2x sections buttons total (mobile + desktop)", () => {
      render(<GuideTOC sections={SECTIONS} activeSection="getting-started" />);
      const buttons = screen.getAllByRole("button");
      // Each section appears once in mobile pill bar + once in desktop list
      expect(buttons.length).toBe(SECTIONS.length * 2);
    });
  });

  describe("active section highlighting", () => {
    it("active section buttons have gold highlight classes", () => {
      render(<GuideTOC sections={SECTIONS} activeSection="wallets" />);
      const activeButtons = screen.getAllByText("Wallets");
      for (const btn of activeButtons) {
        const button = btn.closest("button");
        expect(button).toHaveClass("bg-v2-gold-primary");
        expect(button).toHaveClass("text-v2-bg-dark");
      }
    });

    it("inactive sections do NOT have gold highlight classes", () => {
      render(<GuideTOC sections={SECTIONS} activeSection="wallets" />);
      const inactiveButtons = screen.getAllByText("Getting Started");
      for (const btn of inactiveButtons) {
        const button = btn.closest("button");
        expect(button).not.toHaveClass("bg-v2-gold-primary");
      }
    });

    it("inactive sections have tertiary text color class", () => {
      render(<GuideTOC sections={SECTIONS} activeSection="wallets" />);
      const inactiveButtons = screen.getAllByText("Getting Started");
      for (const btn of inactiveButtons) {
        const button = btn.closest("button");
        expect(button).toHaveClass("text-v2-text-tertiary");
      }
    });
  });

  describe("smooth scroll on click", () => {
    it("calls scrollIntoView with smooth behavior when a section is clicked", () => {
      const mockScrollIntoView = jest.fn();
      const mockGetElementById = jest
        .spyOn(document, "getElementById")
        .mockReturnValue({
          scrollIntoView: mockScrollIntoView,
        } as unknown as HTMLElement);

      render(<GuideTOC sections={SECTIONS} activeSection="getting-started" />);
      // Click the first instance (mobile pill bar)
      const walletButtons = screen.getAllByText("Wallets");
      fireEvent.click(walletButtons[0]);

      expect(mockGetElementById).toHaveBeenCalledWith("wallets");
      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });

      mockGetElementById.mockRestore();
    });

    it("does not throw when element does not exist in DOM", () => {
      jest.spyOn(document, "getElementById").mockReturnValue(null);
      render(<GuideTOC sections={SECTIONS} activeSection="getting-started" />);
      const walletButtons = screen.getAllByText("Wallets");
      expect(() => fireEvent.click(walletButtons[0])).not.toThrow();
      jest.restoreAllMocks();
    });
  });

  describe("accessibility", () => {
    it("all buttons meet min touch target height (min-h-[44px])", () => {
      render(<GuideTOC sections={SECTIONS} activeSection="getting-started" />);
      const buttons = screen.getAllByRole("button");
      for (const button of buttons) {
        expect(button).toHaveClass("min-h-[44px]");
      }
    });

    it("all buttons have cursor-pointer", () => {
      render(<GuideTOC sections={SECTIONS} activeSection="getting-started" />);
      const buttons = screen.getAllByRole("button");
      for (const button of buttons) {
        expect(button).toHaveClass("cursor-pointer");
      }
    });

    it("all buttons have focus-visible ring class", () => {
      render(<GuideTOC sections={SECTIONS} activeSection="getting-started" />);
      const buttons = screen.getAllByRole("button");
      for (const button of buttons) {
        expect(button.className).toContain("focus-visible:ring-2");
      }
    });
  });

  describe("desktop layout", () => {
    it("renders a nav element as the root", () => {
      render(<GuideTOC sections={SECTIONS} activeSection="getting-started" />);
      expect(screen.getByRole("navigation")).toBeInTheDocument();
    });

    it("desktop vertical list has sticky positioning class", () => {
      const { container } = render(
        <GuideTOC sections={SECTIONS} activeSection="getting-started" />
      );
      const nav = container.querySelector("nav");
      expect(nav?.className).toContain("lg:sticky");
    });
  });

  describe("mobile layout", () => {
    it("mobile pill bar container has overflow-x-auto for horizontal scroll", () => {
      const { container } = render(
        <GuideTOC sections={SECTIONS} activeSection="getting-started" />
      );
      const nav = container.querySelector("nav");
      const scrollWrapper = nav?.querySelector(".overflow-x-auto");
      expect(scrollWrapper).toBeInTheDocument();
    });

    it("mobile pill bar is hidden on desktop (lg:hidden)", () => {
      const { container } = render(
        <GuideTOC sections={SECTIONS} activeSection="getting-started" />
      );
      const nav = container.querySelector("nav");
      const mobileWrapper = nav?.querySelector(".lg\\:hidden");
      expect(mobileWrapper).toBeInTheDocument();
    });

    it("desktop list is hidden on mobile (hidden lg:flex)", () => {
      const { container } = render(
        <GuideTOC sections={SECTIONS} activeSection="getting-started" />
      );
      const nav = container.querySelector("nav");
      const desktopWrapper = nav?.querySelector(".hidden.lg\\:flex");
      expect(desktopWrapper).toBeInTheDocument();
    });
  });

  describe("empty sections", () => {
    it("renders without crashing when sections array is empty", () => {
      expect(() =>
        render(<GuideTOC sections={[]} activeSection="" />)
      ).not.toThrow();
    });
  });
});
