"use client";
import ActiveLink from "@/components/ActiveLink";
import { logout } from "../auth/utils/logout";
import { routes, ModalType } from "@/app/constants";
import { AuthCheck } from "../auth/utils/AuthCheck";
import { store } from "@/features/auth/store/store";
import { useState, useMemo, useEffect } from "react";
import { usePathname } from "@/lib/navigation";
import { useTranslations } from "next-intl";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import NextImage from "next/image";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { CurrencyConversionProgress } from "@/components/CurrencyConversionProgress";
import { BottomNav, createNavItems } from "@/components/navigation";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { ZIndex } from "@/lib/utils/z-index";
import { BaseModal } from "@/components/modals/BaseModal";
import { AddTransactionForm } from "@/features/transaction/forms/AddTransactionForm";
import { TransferMoneyForm } from "@/features/wallet/forms/TransferMoneyForm";
import { useSidebarState } from "@/hooks/useSidebarState";
import { SidebarToggle } from "@/components/navigation/SidebarToggle";
import { NavItem } from "@/components/navigation/NavItem";
import { NavTooltip } from "@/components/navigation/NavTooltip";
import { cn } from "@/lib/utils/cn";
import { useCallback } from "react";
import {
  House,
  ArrowLeftRight,
  Wallet,
  ChartNoAxesCombined,
  Calculator,
  ChartPie,
  Settings,
  Bell,
  Search,
  LogOut,
  X,
  Menu,
  Users,
} from "lucide-react";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const path = usePathname();
  const t = useTranslations("nav");
  const tHome = useTranslations("dashboard.home");
  const tQuickActions = useTranslations("dashboard.quickActions");
  const tSearch = useTranslations("search.globalSearch");
  const [user, setUser] = useState(store.getState().setAuthReducer);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [modalType, setModalType] = useState<string | null>(null);
  const { isExpanded, toggle } = useSidebarState();

  store.subscribe(() => {
    if (!user.picture) {
      setUser(store.getState().setAuthReducer);
    }
  });

  // Global search keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen]);

  const toggleMobileMenu = useCallback(() => {
    if (isMobileMenuOpen) {
      setIsClosing(true);
      setTimeout(() => {
        setIsMobileMenuOpen(false);
        setIsClosing(false);
      }, 300);
    } else {
      setIsMobileMenuOpen(true);
    }
  }, [isMobileMenuOpen]);

  const handleNavClick = useCallback(() => {
    if (isMobileMenuOpen) {
      toggleMobileMenu();
    }
  }, [isMobileMenuOpen, toggleMobileMenu]);

  // V2 greeting logic
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return tHome("greeting.morning");
    if (hour < 18) return tHome("greeting.afternoon");
    return tHome("greeting.evening");
  }, [tHome]);

  // V2 formatted date
  const formattedDate = useMemo(() => {
    const locale = path.startsWith("/vi") ? "vi-VN" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "2-digit",
    }).format(new Date());
  }, [path]);

  // Mobile navigation items for slide-out menu
  const navigationItems = useMemo(() => {
    const standardItems = [
      {
        href: routes.transaction,
        label: t("transactions"),
        icon: <ArrowLeftRight size={22} />,
      },
      { href: routes.wallets, label: t("wallets"), icon: <Wallet size={22} /> },
      {
        href: routes.report,
        label: t("reports"),
        icon: <ChartPie size={22} />,
      },
      {
        href: routes.budget,
        label: t("budget"),
        icon: <Calculator size={22} />,
      },
    ];

    return (
      <div className="flex flex-col gap-3 px-3">
        {/* Premium Card — Home + Portfolio + Community */}
        <div
          className="rounded-2xl border border-v2-border-light p-1.5 flex flex-col gap-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          style={{
            background:
              "linear-gradient(180deg, #FFFFFF 0%, #FEF2F233 50%, #FEE2E240 100%)",
          }}
        >
          <ActiveLink
            href={routes.home}
            className={cn(
              "flex items-center gap-3 py-3 px-3.5 rounded-xl font-vietnam text-[15px] transition-colors duration-200 touch-target animate-stagger-fade-in",
              path === routes.home
                ? "text-v2-red-primary bg-v2-red-light font-semibold"
                : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
            )}
          >
            <House size={22} />
            <span>{t("home")}</span>
          </ActiveLink>
          <ActiveLink
            href={routes.portfolio}
            className={cn(
              "flex items-center gap-3 py-3 px-3.5 rounded-xl font-vietnam text-[15px] transition-colors duration-200 touch-target",
              path === routes.portfolio
                ? "text-v2-red-primary bg-v2-red-light font-semibold"
                : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
            )}
          >
            <ChartNoAxesCombined size={22} />
            <span>{t("portfolio")}</span>
          </ActiveLink>
          <ActiveLink
            href={routes.community}
            className={cn(
              "flex items-center gap-3 py-3 px-3.5 rounded-xl font-vietnam text-[15px] transition-colors duration-200 touch-target",
              path === routes.community
                ? "text-v2-red-primary bg-v2-red-light font-semibold"
                : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
            )}
          >
            <Users size={22} />
            <span>{t("community")}</span>
          </ActiveLink>
        </div>

        {/* Standard group */}
        <div className="flex flex-col gap-0.5">
          {standardItems.map((item) => (
            <ActiveLink
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 py-3 px-3.5 rounded-xl font-vietnam text-[15px] transition-colors duration-200 touch-target",
                path === item.href
                  ? "text-v2-red-primary bg-v2-red-light font-semibold"
                  : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </ActiveLink>
          ))}
        </div>

        {/* Divider + Settings + Logout */}
        <div>
          <div className="border-t border-v2-border-light mb-1" />
          <ActiveLink
            href="/dashboard/settings"
            className={cn(
              "flex items-center gap-3 py-3 px-3.5 rounded-xl font-vietnam text-[15px] transition-colors duration-200 touch-target",
              path.startsWith("/dashboard/settings")
                ? "text-v2-red-primary bg-v2-red-light font-semibold"
                : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
            )}
          >
            <Settings size={22} />
            <span>{t("settings")}</span>
          </ActiveLink>
          <button
            onClick={logout}
            className="flex items-center gap-3 py-3 px-3.5 rounded-xl font-vietnam text-[15px] font-medium text-v2-text-secondary hover:bg-v2-bg-primary transition-colors duration-200 touch-target w-full text-left"
            aria-label={t("logout")}
          >
            <LogOut size={22} />
            <span>{t("logout")}</span>
          </button>
        </div>
      </div>
    );
  }, [handleNavClick, t, path]);

  return (
    <AuthCheck>
      <CurrencyProvider>
        {/* Currency conversion progress banner */}
        <CurrencyConversionProgress />

        <div className="dashboard-container h-dvh bg-v2-bg-primary flex flex-col sm:flex-row overflow-hidden">
          {/* Desktop Sidebar - V2 White with Crimson accents */}
          <aside
            className={cn(
              "hidden sm:flex flex-col bg-white border-r border-v2-border-light min-h-screen fixed left-0 top-0 z-sidebar transition-all duration-300 ease-in-out",
              isExpanded ? "sm:w-64 lg:w-72" : "sm:w-20",
            )}
          >
            {/* Logo Section */}
            <div
              className={cn(
                "pt-6 pb-4 transition-all duration-300 ease-in-out",
                isExpanded ? "px-6" : "px-0",
              )}
            >
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "flex items-center gap-3 transition-all duration-300 ease-in-out",
                    isExpanded
                      ? "opacity-100 scale-100 translate-x-0"
                      : "opacity-0 w-0 overflow-hidden scale-95 -translate-x-2",
                  )}
                >
                  <div className="w-[38px] h-[38px] bg-v2-red-primary rounded-[10px] flex items-center justify-center">
                    <span className="text-white font-vietnam font-bold text-[18px]">
                      W
                    </span>
                  </div>
                  <h1 className="text-v2-text-primary font-vietnam font-bold text-[19px]">
                    WealthJourney
                  </h1>
                </div>
                {!isExpanded && (
                  <div className="w-[38px] h-[38px] bg-v2-red-primary rounded-[10px] flex items-center justify-center mx-auto animate-scale-in">
                    <span className="text-white font-vietnam font-bold text-[18px]">
                      W
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <nav
              className="flex-1 overflow-y-auto px-3 overflow-x-hidden"
              aria-label={t("mainNavigation")}
            >
              <div className="flex flex-col h-full">
                {/* Premium Card — Home + Portfolio + Community */}
                <div
                  className="rounded-2xl border border-v2-border-light p-1.5 flex flex-col gap-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                  style={{
                    background:
                      "linear-gradient(180deg, #FFFFFF 0%, #FEF2F233 50%, #FEE2E240 100%)",
                  }}
                >
                  <NavItem
                    href={routes.home}
                    label={t("home")}
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={0}
                    icon={<House size={20} />}
                    isActive={path === routes.home}
                    isPremium
                  />
                  <NavItem
                    href={routes.portfolio}
                    label={t("portfolio")}
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={30}
                    icon={<ChartNoAxesCombined size={20} />}
                    isActive={path === routes.portfolio}
                    isPremium
                  />
                  <NavItem
                    href={routes.community}
                    label={t("community")}
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={60}
                    icon={<Users size={20} />}
                    isActive={path === routes.community}
                    isPremium
                  />
                </div>

                {/* Standard group */}
                <div
                  className={cn(
                    "flex flex-col gap-0.5",
                    isExpanded ? "mt-3" : "mt-4",
                  )}
                >
                  <NavItem
                    href={routes.transaction}
                    label={t("transactions")}
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={90}
                    icon={<ArrowLeftRight size={20} />}
                    isActive={path === routes.transaction}
                  />
                  <NavItem
                    href={routes.wallets}
                    label={t("wallets")}
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={120}
                    icon={<Wallet size={20} />}
                    isActive={path === routes.wallets}
                  />
                  <NavItem
                    href={routes.report}
                    label={t("reports")}
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={150}
                    icon={<ChartPie size={20} />}
                    isActive={path === routes.report}
                  />
                  <NavItem
                    href={routes.budget}
                    label={t("budget")}
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={180}
                    icon={<Calculator size={20} />}
                    isActive={path === routes.budget}
                  />
                </div>

                {/* Spacer + Divider + Settings */}
                <div className="flex-1" />
                <div className="border-t border-v2-border-light" />
                <div className="h-2" />
                <NavItem
                  href="/dashboard/settings"
                  label={t("settings")}
                  isExpanded={isExpanded}
                  showTooltip={!isExpanded}
                  animationDelay={210}
                  icon={<Settings size={20} />}
                  isActive={path.startsWith("/dashboard/settings")}
                />
              </div>
            </nav>

            {/* Sidebar Toggle */}
            <div className="px-3 pt-2 pb-0 flex justify-center">
              <SidebarToggle isExpanded={isExpanded} onToggle={toggle} />
            </div>

            {/* User Section */}
            <div className="px-3 pt-2 pb-3 transition-all duration-300 ease-in-out">
              <div className="border-t border-v2-border-light mb-2" />
              <div
                className={cn(
                  "flex items-center py-2 rounded-xl transition-all duration-300 ease-in-out",
                  isExpanded ? "gap-3 px-2" : "justify-center px-0",
                )}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0 bg-v2-red-primary">
                  {user.picture ? (
                    <NextImage
                      src={user.picture}
                      alt={user.fullname || "User"}
                      width={36}
                      height={36}
                      className="rounded-full"
                    />
                  ) : (
                    <span className="font-vietnam text-[13px] font-medium text-white">
                      {(user.fullname || "U").charAt(0)}
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1 min-w-0 transition-all duration-300 ease-in-out",
                    isExpanded
                      ? "opacity-100 w-auto translate-x-0"
                      : "opacity-0 w-0 overflow-hidden -translate-x-2 hidden",
                  )}
                  style={{
                    transitionDelay: isExpanded ? "100ms" : "0ms",
                  }}
                >
                  <p className="font-vietnam text-[13px] font-medium text-v2-text-primary truncate">
                    {user.fullname || "User"}
                  </p>
                  <p className="font-jetbrains text-[11px] text-v2-text-tertiary truncate">
                    {user.email || "user@example.com"}
                  </p>
                </div>
              </div>
              {/* Logout Button */}
              <NavTooltip content={t("logout")} disabled={isExpanded}>
                <button
                  onClick={logout}
                  className={cn(
                    "flex items-center w-full py-2.5 rounded-xl font-vietnam text-[14px] font-medium text-v2-text-secondary hover:bg-v2-bg-primary transition-all duration-300 ease-in-out mt-1",
                    isExpanded ? "gap-3 px-3" : "justify-center px-0",
                  )}
                  aria-label={t("logout")}
                >
                  <LogOut size={20} className="shrink-0" />
                  <span
                    className={cn(
                      "whitespace-nowrap transition-all duration-300 ease-in-out",
                      isExpanded
                        ? "opacity-100 w-auto translate-x-0"
                        : "opacity-0 w-0 overflow-hidden -translate-x-2",
                    )}
                  >
                    {t("logout")}
                  </span>
                </button>
              </NavTooltip>
            </div>
          </aside>

          {/* V2 Mobile Header */}
          <header className="sm:hidden shrink-0 sticky top-0 z-sticky">
            {/* Red accent line */}
            <div className="h-[3px] bg-v2-red-primary w-full" />
            <div className="bg-v2-bg-primary border-b border-v2-border-light">
              <div className="flex items-center justify-between px-4 py-3">
                {/* Logo area */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-v2-red-primary rounded-[8px] flex items-center justify-center">
                    <span className="text-white font-vietnam font-bold text-[14px]">
                      W
                    </span>
                  </div>
                  <span className="font-vietnam font-bold text-[16px] text-v2-text-primary">
                    WealthJourney
                  </span>
                </div>

                {/* Action icons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSearchOpen(true)}
                    className="p-2 rounded-lg hover:bg-white/60 transition-colors touch-target"
                    aria-label="Search"
                  >
                    <Search size={20} className="text-v2-text-secondary" />
                  </button>
                  <button
                    className="p-2 rounded-lg hover:bg-white/60 transition-colors touch-target"
                    aria-label="Notifications"
                  >
                    <Bell size={20} className="text-v2-text-secondary" />
                  </button>
                  <button
                    onClick={toggleMobileMenu}
                    className="p-2 rounded-lg hover:bg-white/60 transition-colors touch-target"
                    aria-label={t("toggleMenu")}
                    aria-expanded={isMobileMenuOpen}
                  >
                    <Menu size={20} className="text-v2-text-secondary" />
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
              <>
                <div
                  className={`fixed inset-0 bg-black/50 z-[45] sm:hidden transition-opacity duration-300 ${
                    isClosing ? "animate-fade-out" : "animate-fade-in"
                  }`}
                  onClick={toggleMobileMenu}
                  aria-hidden="true"
                  style={{ zIndex: ZIndex.modalBackdrop }}
                />
                <div
                  className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white z-modal sm:hidden overflow-y-auto ${
                    isClosing
                      ? "animate-slide-out-left"
                      : "animate-slide-in-left"
                  }`}
                  style={{ zIndex: ZIndex.modal }}
                >
                  {/* Close Button */}
                  <div className="flex items-center justify-between p-4 border-b border-v2-border-light">
                    <div className="flex items-center gap-3">
                      <div className="w-[38px] h-[38px] bg-v2-red-primary rounded-[10px] flex items-center justify-center">
                        <span className="text-white font-vietnam font-bold text-[18px]">
                          W
                        </span>
                      </div>
                      <span className="text-v2-text-primary font-vietnam font-bold text-lg">
                        WealthJourney
                      </span>
                    </div>
                    <button
                      onClick={toggleMobileMenu}
                      className="p-2 -mr-2 rounded-lg hover:bg-v2-bg-primary transition-colors duration-200 touch-target"
                      aria-label={t("closeMenu")}
                    >
                      <X size={24} className="text-v2-text-secondary" />
                    </button>
                  </div>

                  {/* Navigation Items */}
                  <nav className="p-4" aria-label={t("mobileNavigation")}>
                    {navigationItems}
                  </nav>

                  {/* User Info */}
                  <div className="p-4 border-t border-v2-border-light">
                    <div className="flex items-center gap-3 px-3 py-2 bg-v2-bg-primary rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden">
                        {user.picture ? (
                          <NextImage
                            src={user.picture}
                            alt={user.fullname || "User"}
                            width={32}
                            height={32}
                            className="rounded-full"
                          />
                        ) : (
                          <span className="font-vietnam text-[13px] font-medium text-v2-text-secondary">
                            {(user.fullname || "U").charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-vietnam text-[13px] font-medium text-v2-text-primary truncate">
                          {user.fullname || "User"}
                        </p>
                        <p className="font-jetbrains text-[11px] text-v2-text-tertiary truncate">
                          {user.email || "user@example.com"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </header>

          {/* Main Content */}
          <main
            className={cn(
              "flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
              isExpanded ? "sm:ml-64 lg:ml-72" : "sm:ml-20",
            )}
          >
            {/* V2 Desktop Top Bar */}
            <header className="hidden sm:flex items-center justify-between px-8 py-4 border-b border-v2-border-light bg-white h-[68px] shrink-0">
              {/* Left: Greeting + Date */}
              <div>
                <h2 className="font-vietnam font-semibold text-[18px] text-v2-text-primary">
                  {greeting}
                  {user.fullname ? `, ${user.fullname}` : ""}
                </h2>
                <p className="font-jetbrains text-[12px] text-v2-text-tertiary">
                  {formattedDate}
                </p>
              </div>

              {/* Right: Search + Bell */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="flex items-center gap-2 w-fit bg-v2-bg-primary border border-v2-border rounded-xl px-4 py-2 text-v2-text-tertiary text-[13px] font-vietnam hover:border-v2-text-tertiary transition-colors"
                >
                  <Search size={16} />
                  <span>{tSearch("placeholder")}</span>
                </button>
                <button
                  className="p-2 rounded-lg hover:bg-v2-bg-primary transition-colors"
                  aria-label="Notifications"
                >
                  <Bell size={20} className="text-v2-text-secondary" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-safe-mobile sm:pb-8 transition-all duration-300 ease-in-out">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <BottomNav navItems={createNavItems(routes, t)} />

        {/* Global Search - Keyboard Shortcut: Cmd/Ctrl + K */}
        <GlobalSearch
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />

        {/* Floating Action Button */}
        <FloatingActionButton
          actions={[
            {
              label: tQuickActions("addTransaction"),
              icon: (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              ),
              onClick: () => {
                setModalType(ModalType.ADD_TRANSACTION);
              },
            },
            {
              label: tQuickActions("transferMoney"),
              icon: (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              ),
              onClick: () => {
                setModalType(ModalType.TRANSFER_MONEY);
              },
            },
          ]}
        />

        {/* Global Modals */}
        <BaseModal
          isOpen={modalType !== null}
          onClose={() => setModalType(null)}
          title={modalType || ""}
        >
          {modalType === ModalType.ADD_TRANSACTION && (
            <AddTransactionForm
              onSuccess={() => {
                setModalType(null);
              }}
            />
          )}
          {modalType === ModalType.TRANSFER_MONEY && (
            <TransferMoneyForm
              onSuccess={() => {
                setModalType(null);
              }}
            />
          )}
        </BaseModal>
      </CurrencyProvider>
    </AuthCheck>
  );
}
