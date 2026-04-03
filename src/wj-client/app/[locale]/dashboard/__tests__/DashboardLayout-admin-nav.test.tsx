/**
 * TDD test: Admin nav item appears when isAdmin=true; hidden when isAdmin=false.
 *
 * Verifies the useSelector fix is in place (not store.subscribe).
 * Run: cd src/wj-client && npx jest --testPathPattern="DashboardLayout-admin-nav" --no-coverage
 */

import React from "react";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — same pattern as DashboardLayout-fab-loading.test.tsx
// ---------------------------------------------------------------------------

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(() => ({ get: jest.fn(() => null) })),
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => "/dashboard/home"),
}));

jest.mock("next-intl", () => ({
  useTranslations: jest.fn(
    () =>
      (key: string) =>
        key,
  ),
}));

jest.mock("@/lib/navigation", () => ({
  usePathname: jest.fn(() => "/dashboard/home"),
  Link: ({
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

jest.mock("@/app/[locale]/auth/utils/logout", () => ({ logout: jest.fn() }));
jest.mock("@/app/[locale]/auth/utils/AuthCheck", () => ({
  AuthCheck: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Redux store — NOT mocked directly; react-redux's useSelector will be mocked
jest.mock("@/features/auth/store/store", () => ({
  store: {
    getState: jest.fn(() => ({ setAuthReducer: { picture: null, fullname: "Test User", email: "", username: "", isAdmin: false } })),
    subscribe: jest.fn(() => jest.fn()),
    dispatch: jest.fn(),
  },
}));

jest.mock("@/contexts/CurrencyContext", () => ({
  CurrencyProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/CurrencyConversionProgress", () => ({ CurrencyConversionProgress: () => null }));
jest.mock("@/components/navigation", () => ({ BottomNav: () => null, createNavItems: jest.fn(() => []) }));
jest.mock("@/components/search/GlobalSearch", () => ({ GlobalSearch: () => null }));
jest.mock("@/lib/utils/z-index", () => ({ ZIndex: { modal: 100, modalBackdrop: 99, sidebar: 50, sticky: 40 } }));
jest.mock("@/components/modals/BaseModal", () => ({
  BaseModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));
jest.mock("@/components/lazy/OptimizedComponents", () => ({ AddInvestmentForm: () => null }));
jest.mock("@/hooks/useSidebarState", () => ({ useSidebarState: jest.fn(() => ({ isExpanded: true, toggle: jest.fn() })) }));
jest.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));
jest.mock("@/components/notifications/PushPermissionBanner", () => ({ PushPermissionBanner: () => null }));
jest.mock("@/components/navigation/SidebarToggle", () => ({ SidebarToggle: () => null }));
jest.mock("@/components/navigation/NavItem", () => ({
  NavItem: ({ href, label }: { href: string; label: string; [key: string]: unknown }) => (
    <a href={href}>{label}</a>
  ),
}));
jest.mock("@/components/navigation/NavTooltip", () => ({
  NavTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => ({ data: null, isPending: false })),
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/lib/utils/cn", () => ({ cn: (...args: unknown[]) => args.filter(Boolean).join(" ") }));
jest.mock("@/components/FloatingActionButton", () => ({ FloatingActionButton: () => null }));

// react-redux — mock useSelector to control what isAdmin returns
const mockUseSelector = jest.fn();
jest.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) => mockUseSelector(selector),
}));

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { DashboardLayout } from "../DashboardLayout";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DashboardLayout — Admin nav item visibility", () => {
  beforeEach(() => {
    mockUseSelector.mockClear();
  });

  it("shows Admin nav item in desktop sidebar when isAdmin=true", () => {
    // Simulate useSelector returning isAdmin: true
    mockUseSelector.mockImplementation(() => ({
      picture: null,
      fullname: "Admin User",
      email: "admin@example.com",
      username: "admin",
      isAdmin: true,
    }));

    render(
      <DashboardLayout>
        <div>page</div>
      </DashboardLayout>,
    );

    // NavItem renders as <a href={href}>{label}</a> in our mock
    const adminLinks = screen.getAllByText("Admin");
    expect(adminLinks.length).toBeGreaterThan(0);
  });

  it("hides Admin nav item when isAdmin=false", () => {
    mockUseSelector.mockImplementation(() => ({
      picture: null,
      fullname: "Regular User",
      email: "user@example.com",
      username: "user",
      isAdmin: false,
    }));

    render(
      <DashboardLayout>
        <div>page</div>
      </DashboardLayout>,
    );

    expect(screen.queryByText("Admin")).toBeNull();
  });
});
