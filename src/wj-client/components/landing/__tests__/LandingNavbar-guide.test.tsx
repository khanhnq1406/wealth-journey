"use client";

import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test-utils";
import LandingNavbar from "../LandingNavbar";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock next/link
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...rest
    }: {
      children: React.ReactNode;
      [key: string]: unknown;
    }) => <div {...rest}>{children}</div>,
    svg: ({
      children,
      ...rest
    }: {
      children: React.ReactNode;
      [key: string]: unknown;
    }) => <svg {...rest}>{children}</svg>,
    path: ({ ...rest }: { [key: string]: unknown }) => <path {...rest} />,
  },
  AnimatePresence: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <>{children}</>,
}));

// Mock the Redux store used in LandingNavbar
jest.mock("@/features/auth/store/store", () => ({
  store: {
    getState: () => ({
      setAuthReducer: {
        isAuthenticated: false,
      },
    }),
  },
}));

describe("LandingNavbar — Guide link", () => {
  it("renders a Guide link pointing to /guide in the desktop nav", () => {
    renderWithIntl(<LandingNavbar />);

    const guideLinks = screen.getAllByRole("link", { name: /guide/i });
    expect(guideLinks.length).toBeGreaterThanOrEqual(1);

    const guideLink = guideLinks[0];
    expect(guideLink).toHaveAttribute("href", "/guide");
  });

  it("renders the Guide link with correct href /guide", () => {
    renderWithIntl(<LandingNavbar />);

    // Find all anchor tags with href="/guide"
    const allLinks = screen.getAllByRole("link");
    const guideHrefLinks = allLinks.filter(
      (link) => link.getAttribute("href") === "/guide"
    );

    expect(guideHrefLinks.length).toBeGreaterThanOrEqual(1);
  });
});
