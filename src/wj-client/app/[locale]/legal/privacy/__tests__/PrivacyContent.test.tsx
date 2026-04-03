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

import { PrivacyContent } from "../PrivacyContent";

test("renders navbar and footer", () => {
  render(<PrivacyContent />);
  expect(screen.getByTestId("navbar")).toBeInTheDocument();
  expect(screen.getByTestId("footer")).toBeInTheDocument();
});

test("renders data collection section", () => {
  render(<PrivacyContent />);
  expect(
    screen.getByText(/privacy\.sections\.dataCollection\.title/)
  ).toBeInTheDocument();
});

test("renders all 9 section titles", () => {
  render(<PrivacyContent />);
  const sections = [
    "introduction",
    "dataCollection",
    "dataUse",
    "dataStorage",
    "thirdParties",
    "userRights",
    "cookies",
    "changes",
    "contact",
  ];
  sections.forEach((section) => {
    expect(
      screen.getByText(`privacy.sections.${section}.title`)
    ).toBeInTheDocument();
  });
});

test("renders page title and subtitle", () => {
  render(<PrivacyContent />);
  expect(screen.getByText("privacy.title")).toBeInTheDocument();
  expect(screen.getByText("privacy.subtitle")).toBeInTheDocument();
});
