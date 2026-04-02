/**
 * TDD tests for FloatingActionButton — isLoading prop & skeleton
 *
 * RED → GREEN → REFACTOR
 * Run: cd src/wj-client && npx jest --testPathPattern="FloatingActionButton" --no-coverage --watchAll=false
 */

import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// next-intl: Skeleton uses useTranslations("skeleton")
jest.mock("next-intl", () => ({
  useTranslations: jest.fn(
    () =>
      (key: string) =>
        key,
  ),
}));

// z-index utility
jest.mock("@/lib/utils/z-index", () => ({
  ZIndex: { floating: 50 },
}));

// cn utility — simple join
jest.mock("@/lib/utils/cn", () => ({
  cn: (...args: unknown[]) =>
    args
      .flat()
      .filter((x) => typeof x === "string" && x.length > 0)
      .join(" "),
}));

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { FloatingActionButton } from "../FloatingActionButton";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultActions = [
  {
    label: "Add Investment",
    icon: <span data-testid="icon" />,
    onClick: jest.fn(),
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FloatingActionButton — isLoading prop", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("isLoading prop type contract", () => {
    it("renders without error when isLoading is not provided (default behavior)", () => {
      render(
        <FloatingActionButton actions={defaultActions} />,
      );
      // Main FAB button should be rendered
      expect(
        screen.getByRole("button", { name: /open quick actions/i }),
      ).toBeInTheDocument();
    });

    it("renders without error when isLoading=false", () => {
      render(
        <FloatingActionButton actions={defaultActions} isLoading={false} />,
      );
      expect(
        screen.getByRole("button", { name: /open quick actions/i }),
      ).toBeInTheDocument();
    });

    it("renders without error when isLoading=true", () => {
      render(
        <FloatingActionButton actions={defaultActions} isLoading={true} />,
      );
      expect(
        screen.getByRole("button", { name: /open quick actions/i }),
      ).toBeInTheDocument();
    });
  });

  describe("skeleton rendering when popup is open and isLoading=true", () => {
    async function openFAB(isLoading: boolean, introContent?: { title: string; text: string; contactInfo: string }) {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(
        <FloatingActionButton
          actions={defaultActions}
          isLoading={isLoading}
          introContent={introContent}
        />,
      );
      const openBtn = screen.getByRole("button", { name: /open quick actions/i });
      await user.click(openBtn);
      return { user };
    }

    it("shows skeleton area when isLoading=true and popup is open and no introContent", async () => {
      await openFAB(true, undefined);
      // aria-busy container should be in the DOM
      const busyEl = document.querySelector('[aria-busy="true"]');
      expect(busyEl).toBeInTheDocument();
    });

    it("skeleton area has aria-busy=true", async () => {
      await openFAB(true, undefined);
      const busyEl = document.querySelector('[aria-busy="true"]');
      expect(busyEl).toHaveAttribute("aria-busy", "true");
    });

    it("does NOT show skeleton area when isLoading=false", async () => {
      await openFAB(false, undefined);
      const busyEl = document.querySelector('[aria-busy="true"]');
      expect(busyEl).not.toBeInTheDocument();
    });

    it("does NOT show skeleton area when isLoading=true but introContent is provided", async () => {
      await openFAB(true, { title: "Hello", text: "World", contactInfo: "info@test.com" });
      // introContent is present — skeleton should NOT render
      const busyEl = document.querySelector('[aria-busy="true"]');
      expect(busyEl).not.toBeInTheDocument();
      // But actual intro content should show
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });
  });

  describe("action buttons always render regardless of isLoading", () => {
    it("action buttons are visible when popup is open and isLoading=true", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(
        <FloatingActionButton actions={defaultActions} isLoading={true} />,
      );
      const openBtn = screen.getByRole("button", { name: /open quick actions/i });
      await user.click(openBtn);
      expect(screen.getByRole("button", { name: /add investment/i })).toBeInTheDocument();
    });

    it("action buttons are visible when popup is open and isLoading=false", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(
        <FloatingActionButton actions={defaultActions} isLoading={false} />,
      );
      const openBtn = screen.getByRole("button", { name: /open quick actions/i });
      await user.click(openBtn);
      expect(screen.getByRole("button", { name: /add investment/i })).toBeInTheDocument();
    });
  });

  describe("skeleton disappears when loading completes (isLoading transitions false)", () => {
    it("shows skeleton when loading, hides when loading complete with no introContent", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { rerender } = render(
        <FloatingActionButton actions={defaultActions} isLoading={true} />,
      );
      const openBtn = screen.getByRole("button", { name: /open quick actions/i });
      await user.click(openBtn);

      // Loading: skeleton visible
      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();

      // Transition to not loading, no introContent
      rerender(
        <FloatingActionButton actions={defaultActions} isLoading={false} />,
      );

      // No skeleton, no intro content
      expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
    });

    it("shows skeleton when loading, replaces with introContent when loaded", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { rerender } = render(
        <FloatingActionButton actions={defaultActions} isLoading={true} />,
      );
      const openBtn = screen.getByRole("button", { name: /open quick actions/i });
      await user.click(openBtn);

      // Loading: skeleton visible
      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();

      // Transition to loaded with introContent
      rerender(
        <FloatingActionButton
          actions={defaultActions}
          isLoading={false}
          introContent={{ title: "Welcome!", text: "Body text", contactInfo: "contact@test.com" }}
        />,
      );

      // Skeleton gone, actual content shown
      expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
      expect(screen.getByText("Welcome!")).toBeInTheDocument();
    });
  });

  describe("auto-open behavior unaffected by isLoading", () => {
    it("auto-opens after 500ms even when isLoading=true", async () => {
      render(
        <FloatingActionButton
          actions={defaultActions}
          isLoading={true}
          autoOpen
        />,
      );

      // Before timer fires: popup should not be open (action buttons hidden)
      expect(screen.queryByRole("button", { name: /add investment/i })).not.toBeInTheDocument();

      // Advance timer past 500ms
      act(() => {
        jest.advanceTimersByTime(600);
      });

      // Popup opens: skeleton visible and action buttons visible
      expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add investment/i })).toBeInTheDocument();
    });
  });
});
