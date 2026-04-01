/**
 * Tests for GuideSection component — TDD (RED → GREEN → REFACTOR)
 *
 * Run: cd src/wj-client && npx jest --testPathPattern="guide/__tests__/GuideSection" --no-coverage
 */

import React from "react";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock decorative components (server components — no client-side behaviour)
// ---------------------------------------------------------------------------

jest.mock("@/components/decorative/OrnateHeading", () => ({
  OrnateHeading: ({ children, size }: { children: React.ReactNode; size?: string }) => (
    <div data-testid="ornate-heading" data-size={size}>
      {children}
    </div>
  ),
}));

jest.mock("@/components/decorative/OrnateDivider", () => ({
  OrnateDivider: ({ variant }: { variant?: string }) => (
    <hr data-testid="ornate-divider" data-variant={variant} />
  ),
}));

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import { GuideSection } from "../GuideSection";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GuideSection", () => {
  const defaultProps = {
    id: "getting-started",
    title: "Getting Started",
    icon: <svg data-testid="section-icon" aria-hidden="true" />,
    children: <p>Section content goes here.</p>,
  };

  describe("id attribute for anchor linking", () => {
    it("sets correct id attribute on the section element", () => {
      render(<GuideSection {...defaultProps} />);
      const section = document.getElementById("getting-started");
      expect(section).toBeInTheDocument();
    });

    it("uses the provided id value exactly", () => {
      render(<GuideSection {...defaultProps} id="wallet-management" />);
      const section = document.getElementById("wallet-management");
      expect(section).toBeInTheDocument();
    });
  });

  describe("heading rendering", () => {
    it("renders the title text", () => {
      render(<GuideSection {...defaultProps} />);
      expect(screen.getByText("Getting Started")).toBeInTheDocument();
    });

    it("renders OrnateHeading for h2 level (default)", () => {
      render(<GuideSection {...defaultProps} />);
      expect(screen.getByTestId("ornate-heading")).toBeInTheDocument();
    });

    it("renders OrnateHeading with lg size for h2 level", () => {
      render(<GuideSection {...defaultProps} />);
      expect(screen.getByTestId("ornate-heading")).toHaveAttribute("data-size", "lg");
    });

    it("does NOT render OrnateHeading for h3 level", () => {
      render(<GuideSection {...defaultProps} level="h3" />);
      expect(screen.queryByTestId("ornate-heading")).not.toBeInTheDocument();
    });

    it("renders h3 element for h3 level", () => {
      render(<GuideSection {...defaultProps} level="h3" title="Sub Section" />);
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent("Sub Section");
    });
  });

  describe("OrnateDivider for h2 sections", () => {
    it("renders OrnateDivider above h2 section", () => {
      render(<GuideSection {...defaultProps} />);
      expect(screen.getByTestId("ornate-divider")).toBeInTheDocument();
    });

    it("does NOT render OrnateDivider for h3 sections", () => {
      render(<GuideSection {...defaultProps} level="h3" />);
      expect(screen.queryByTestId("ornate-divider")).not.toBeInTheDocument();
    });
  });

  describe("icon rendering", () => {
    it("renders the icon passed as prop", () => {
      render(<GuideSection {...defaultProps} />);
      expect(screen.getByTestId("section-icon")).toBeInTheDocument();
    });

    it("renders the icon for h3 level too", () => {
      render(<GuideSection {...defaultProps} level="h3" />);
      expect(screen.getByTestId("section-icon")).toBeInTheDocument();
    });
  });

  describe("children content", () => {
    it("renders children content inside the section", () => {
      render(<GuideSection {...defaultProps} />);
      expect(screen.getByText("Section content goes here.")).toBeInTheDocument();
    });

    it("renders complex children content", () => {
      render(
        <GuideSection {...defaultProps}>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </GuideSection>
      );
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
    });
  });

  describe("scroll offset class", () => {
    it("applies scroll-mt-20 class for anchor scroll offset", () => {
      render(<GuideSection {...defaultProps} />);
      const section = document.getElementById("getting-started");
      expect(section).toHaveClass("scroll-mt-20");
    });
  });

  describe("default level", () => {
    it("defaults to h2 level when level prop is omitted", () => {
      render(<GuideSection {...defaultProps} />);
      // h2 sections get OrnateHeading, not a plain heading element
      expect(screen.getByTestId("ornate-heading")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    });
  });
});
