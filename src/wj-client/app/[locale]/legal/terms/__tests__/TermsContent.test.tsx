import React from "react";
import { render, screen } from "@testing-library/react";

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
// Mock LandingNavbar/Footer (default exports)
jest.mock("@/components/landing/LandingNavbar", () => ({
  __esModule: true,
  default: () => <nav data-testid="navbar" />,
}));
jest.mock("@/components/landing/LandingFooter", () => ({
  __esModule: true,
  default: () => <footer data-testid="footer" />,
}));
// Mock decorative components (named exports)
jest.mock("@/components/decorative/OrnateHeading", () => ({
  OrnateHeading: ({ children }: { children: React.ReactNode }) => (
    <h1>{children}</h1>
  ),
}));
jest.mock("@/components/decorative/OrnateDivider", () => ({
  OrnateDivider: () => <hr />,
}));

import { TermsContent } from "../TermsContent";

test("renders navbar and footer", () => {
  render(<TermsContent />);
  expect(screen.getByTestId("navbar")).toBeInTheDocument();
  expect(screen.getByTestId("footer")).toBeInTheDocument();
});

test("renders disclaimer section", () => {
  render(<TermsContent />);
  // The mock useTranslations returns the key itself, so section key should be in DOM
  expect(
    screen.getByText(/terms\.sections\.disclaimer\.title/)
  ).toBeInTheDocument();
});

test("renders all 9 section titles", () => {
  render(<TermsContent />);
  const sections = [
    "introduction",
    "acceptance",
    "userResponsibilities",
    "disclaimer",
    "intellectualProperty",
    "termination",
    "changes",
    "governingLaw",
    "contact",
  ];
  sections.forEach((section) => {
    expect(
      screen.getByText(`terms.sections.${section}.title`)
    ).toBeInTheDocument();
  });
});

test("renders page title and subtitle", () => {
  render(<TermsContent />);
  expect(screen.getByText("terms.title")).toBeInTheDocument();
  expect(screen.getByText("terms.subtitle")).toBeInTheDocument();
});
