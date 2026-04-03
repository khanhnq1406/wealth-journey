/**
 * TDD test: DashboardLayout renders a "Guide" link
 *
 * RED → GREEN → REFACTOR
 * Run: cd src/wj-client && npx jest --testPathPattern="dashboard/__tests__/DashboardLayout-guide" --no-coverage
 */

import React from "react";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — stub all heavy dependencies so the component can render
// ---------------------------------------------------------------------------

// next/navigation
jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(() => ({ get: jest.fn(() => null) })),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => "/dashboard/home"),
}));

// next-intl
jest.mock("next-intl", () => ({
  useTranslations: jest.fn(
    () =>
      (key: string) =>
        key,
  ),
}));

// @/lib/navigation (wraps next/navigation)
jest.mock("@/lib/navigation", () => ({
  usePathname: jest.fn(() => "/dashboard/home"),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ActiveLink
jest.mock("@/components/ActiveLink", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
    disableBuiltInActive: _d,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    disableBuiltInActive?: boolean;
    [key: string]: unknown;
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

// Auth utilities — use relative paths from the test file location
jest.mock("../../auth/utils/logout", () => ({
  logout: jest.fn(),
}));

jest.mock("../../auth/utils/AuthCheck", () => ({
  AuthCheck: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Redux store
jest.mock("@/features/auth/store/store", () => ({
  store: {
    getState: jest.fn(() => ({
      setAuthReducer: {
        picture: null,
        fullname: "Test User",
        email: "test@example.com",
        username: "testuser",
        isAdmin: false,
      },
    })),
    subscribe: jest.fn(() => jest.fn()),
    dispatch: jest.fn(),
  },
}));

// CurrencyContext
jest.mock("@/contexts/CurrencyContext", () => ({
  CurrencyProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// CurrencyConversionProgress
jest.mock("@/components/CurrencyConversionProgress", () => ({
  CurrencyConversionProgress: () => null,
}));

// BottomNav
jest.mock("@/components/navigation", () => ({
  BottomNav: () => null,
  createNavItems: jest.fn(() => []),
}));

// GlobalSearch
jest.mock("@/components/search/GlobalSearch", () => ({
  GlobalSearch: () => null,
}));

// ZIndex
jest.mock("@/lib/utils/z-index", () => ({
  ZIndex: { modal: 100, modalBackdrop: 99, sidebar: 50, sticky: 40 },
}));

// BaseModal
jest.mock("@/components/modals/BaseModal", () => ({
  BaseModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));

// Lazy/OptimizedComponents
jest.mock("@/components/lazy/OptimizedComponents", () => ({
  AddInvestmentForm: () => null,
}));

// useSidebarState
jest.mock("@/hooks/useSidebarState", () => ({
  useSidebarState: jest.fn(() => ({ isExpanded: true, toggle: jest.fn() })),
}));

// Notifications
jest.mock("@/components/notifications/NotificationBell", () => ({
  NotificationBell: () => null,
}));

jest.mock("@/components/notifications/PushPermissionBanner", () => ({
  PushPermissionBanner: () => null,
}));

// Navigation sub-components
jest.mock("@/components/navigation/SidebarToggle", () => ({
  SidebarToggle: () => null,
}));

jest.mock("@/components/navigation/NavItem", () => ({
  NavItem: ({
    href,
    label,
  }: {
    href: string;
    label: string;
    [key: string]: unknown;
  }) => <a href={href}>{label}</a>,
}));

jest.mock("@/components/navigation/NavTooltip", () => ({
  NavTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// FloatingActionButton
jest.mock("@/components/FloatingActionButton", () => ({
  FloatingActionButton: () => null,
}));

// next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

// @tanstack/react-query (apiClient fetch for fab-settings)
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => ({ data: null, isLoading: false })),
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// cn utility
jest.mock("@/lib/utils/cn", () => ({
  cn: (...args: unknown[]) =>
    args
      .filter(Boolean)
      .join(" "),
}));

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { DashboardLayout } from "../DashboardLayout";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DashboardLayout — Guide link", () => {
  function renderLayout() {
    return render(
      <DashboardLayout>
        <div>Page content</div>
      </DashboardLayout>,
    );
  }

  it("renders a Guide link pointing to /guide in the desktop sidebar", () => {
    renderLayout();
    // NavItem is mocked to render an <a> tag with href and label text
    const guideLinks = screen.getAllByRole("link", { name: /guide/i });
    expect(guideLinks.length).toBeGreaterThan(0);
    expect(guideLinks[0]).toHaveAttribute("href", "/guide");
  });

  it("renders the Guide link label text in the mobile navigation", () => {
    renderLayout();
    // Mobile nav uses ActiveLink (mocked to <a>) with the t("guide") label
    const guideLinks = screen.getAllByRole("link", { name: /guide/i });
    expect(guideLinks.length).toBeGreaterThan(0);
  });
});
