"use client";
import ActiveLink from "@/components/ActiveLink";
import { logout } from "../auth/utils/logout";
import { routes, ModalType } from "@/app/constants";
import { AuthCheck } from "../auth/utils/AuthCheck";
import { store } from "@/features/auth/store/store";
import { useState, useMemo, useEffect } from "react";
import { usePathname } from "@/lib/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/utils/api-client";
import NextImage from "next/image";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { CurrencyConversionProgress } from "@/components/CurrencyConversionProgress";
import { BottomNav, createNavItems } from "@/components/navigation";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { ZIndex } from "@/lib/utils/z-index";
import { BaseModal } from "@/components/modals/BaseModal";
import { AddInvestmentForm } from "@/components/lazy/OptimizedComponents";
import { useSidebarState } from "@/hooks/useSidebarState";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PushPermissionBanner } from "@/components/notifications/PushPermissionBanner";
import { SidebarToggle } from "@/components/navigation/SidebarToggle";
import { NavItem } from "@/components/navigation/NavItem";
import { NavTooltip } from "@/components/navigation/NavTooltip";
import { cn } from "@/lib/utils/cn";
import { useCallback } from "react";
import {
  House,
  Banknote,
  Wallet,
  ChartNoAxesCombined,
  Settings,
  Bell,
  Search,
  LogOut,
  X,
  Menu,
  Users,
  CircleUser,
  MessageCircle,
  Shield,
  TrendingUp,
  BookOpen,
} from "lucide-react";

export function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const path = usePathname();
  const searchParams = useSearchParams();
  const isProfileView =
    path === routes.community && searchParams.get("view") === "profile";
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

  const fabSettings = useQuery({
    queryKey: ["fab-settings"],
    queryFn: () =>
      apiClient.get<{ settings: { key: string; value: string }[] }>(
        "/api/v1/public/site-settings",
      ),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const fabIntroContent = useMemo(() => {
    const settings = fabSettings.data?.data?.settings;
    if (!settings) return undefined;
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    if (map["fab.enabled"] === "false") return undefined;
    const title = map["fab.title"];
    const text = map["fab.intro_text"];
    const contactInfo = map["fab.contact_info"];
    if (!title && !text && !contactInfo) return undefined;
    return { title: title || "", text: text || "", contactInfo: contactInfo || "" };
  }, [fabSettings.data]);

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
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const navigationItems = useMemo(() => {
    const standardItems = [
      {
        href: routes.finance,
        label: t("finance"),
        icon: <Banknote size={22} />,
      },
      { href: routes.wallets, label: t("wallets"), icon: <Wallet size={22} /> },
      {
        href: routes.prices,
        label: t("prices"),
        icon: <TrendingUp size={22} />,
      },
      {
        href: routes.feedback,
        label: t("feedback"),
        icon: <MessageCircle size={22} />,
      },
    ];

    return (
      <div className="flex flex-col gap-3 px-3">
        {/* Premium Card — Home + Portfolio + Community */}
        <div
          className="rounded-2xl border border-v2-border-light p-1.5 flex flex-col gap-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          style={{
            background:
              "linear-gradient(180deg, rgba(95,2,2,1) 0%, rgba(155,1,17,0.15) 50%, rgba(215,139,28,0.08) 100%)",
          }}
        >
          <ActiveLink
            href={routes.home}
            disableBuiltInActive
            className={cn(
              "flex items-center gap-3 py-3 px-3.5 rounded-xl font-roboto text-[15px] transition-colors duration-200 touch-target animate-stagger-fade-in",
              path === routes.home
                ? "text-v2-gold-primary bg-v2-gold-primary/10 font-semibold"
                : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
            )}
          >
            <House size={22} />
            <span>{t("home")}</span>
          </ActiveLink>
          <ActiveLink
            href={routes.portfolio}
            disableBuiltInActive
            className={cn(
              "flex items-center gap-3 py-3 px-3.5 rounded-xl font-roboto text-[15px] transition-colors duration-200 touch-target",
              path === routes.portfolio
                ? "text-v2-gold-primary bg-v2-gold-primary/10 font-semibold"
                : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
            )}
          >
            <ChartNoAxesCombined size={22} />
            <span>{t("portfolio")}</span>
          </ActiveLink>
          <ActiveLink
            href={routes.community}
            disableBuiltInActive
            className={cn(
              "flex items-center gap-3 py-3 px-3.5 rounded-xl font-roboto text-[15px] transition-colors duration-200 touch-target",
              path === routes.community && !isProfileView
                ? "text-v2-gold-primary bg-v2-gold-primary/10 font-semibold"
                : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
            )}
          >
            <Users size={22} />
            <span>{t("community")}</span>
          </ActiveLink>
          <ActiveLink
            href={routes.communityProfile}
            disableBuiltInActive
            className={cn(
              "flex items-center gap-3 py-3 px-3.5 rounded-xl font-roboto text-[15px] transition-colors duration-200 touch-target",
              isProfileView
                ? "text-v2-gold-primary bg-v2-gold-primary/10 font-semibold"
                : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
            )}
          >
            <CircleUser size={22} />
            <span>{t("profile")}</span>
          </ActiveLink>
        </div>

        {/* Standard group */}
        <div className="flex flex-col gap-0.5">
          {standardItems.map((item) => (
            <ActiveLink
              key={item.href}
              href={item.href}
              disableBuiltInActive
              className={cn(
                "flex items-center gap-3 py-3 px-3.5 rounded-xl font-roboto text-[15px] transition-colors duration-200 touch-target",
                path.startsWith(item.href)
                  ? "text-v2-gold-primary bg-v2-gold-primary/10 font-semibold"
                  : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </ActiveLink>
          ))}
        </div>

        {/* Divider + Settings + Guide + Logout */}
        <div>
          <div className="border-t border-v2-border-light mb-1" />
          <ActiveLink
            href="/dashboard/settings"
            disableBuiltInActive
            className={cn(
              "flex items-center gap-3 py-3 px-3.5 rounded-xl font-roboto text-[15px] transition-colors duration-200 touch-target",
              path.startsWith("/dashboard/settings")
                ? "text-v2-gold-primary bg-v2-gold-primary/10 font-semibold"
                : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
            )}
          >
            <Settings size={22} />
            <span>{t("settings")}</span>
          </ActiveLink>
          <ActiveLink
            href={routes.guide}
            disableBuiltInActive
            className="flex items-center gap-3 py-3 px-3.5 rounded-xl font-roboto text-[15px] font-medium text-v2-text-secondary hover:bg-v2-bg-primary transition-colors duration-200 touch-target"
          >
            <BookOpen size={22} />
            <span>{t("guide")}</span>
          </ActiveLink>
          {user?.isAdmin && (
            <ActiveLink
              href={routes.admin}
              disableBuiltInActive
              className={cn(
                "flex items-center gap-3 py-3 px-3.5 rounded-xl font-roboto text-[15px] transition-colors duration-200 touch-target",
                path.startsWith(routes.admin)
                  ? "text-v2-gold-primary bg-v2-gold-primary/10 font-semibold"
                  : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
              )}
            >
              <Shield size={22} />
              <span>Admin</span>
            </ActiveLink>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 py-3 px-3.5 rounded-xl font-roboto text-[15px] font-medium text-v2-text-secondary hover:bg-v2-bg-primary transition-colors duration-200 touch-target w-full text-left"
            aria-label={t("logout")}
          >
            <LogOut size={22} />
            <span>{t("logout")}</span>
          </button>
        </div>
      </div>
    );
  }, [t, path, isProfileView, user?.isAdmin]);

  return (
    <AuthCheck>
      <CurrencyProvider>
        {/* Currency conversion progress banner */}
        <CurrencyConversionProgress />

        <div className="dashboard-container h-dvh bg-v2-bg-primary flex flex-col sm:flex-row overflow-hidden">
          {/* Desktop Sidebar - Maroon with Gold accents */}
          <aside
            className={cn(
              "hidden sm:flex flex-col bg-v2-bg-primary border-r border-v2-border-light min-h-screen fixed left-0 top-0 z-sidebar transition-all duration-300 ease-in-out",
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
                  <NextImage
                    src="/logo.svg"
                    alt="congdongvang.com"
                    width={38}
                    height={38}
                    className="rounded-[10px]"
                  />
                  <h1 className="text-v2-text-primary font-roboto font-bold text-[16px]">
                    congdongvang.com
                  </h1>
                </div>
                {!isExpanded && (
                  <NextImage
                    src="/logo.svg"
                    alt="congdongvang.com"
                    width={38}
                    height={38}
                    className="rounded-[10px] mx-auto animate-scale-in"
                  />
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
                      "linear-gradient(180deg, rgba(95,2,2,1) 0%, rgba(155,1,17,0.15) 50%, rgba(215,139,28,0.08) 100%)",
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
                    isActive={path === routes.community && !isProfileView}
                    isPremium
                  />
                  <NavItem
                    href={routes.communityProfile}
                    label={t("profile")}
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={90}
                    icon={<CircleUser size={20} />}
                    isActive={isProfileView}
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
                    href={routes.finance}
                    label={t("finance")}
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={120}
                    icon={<Banknote size={20} />}
                    isActive={path.startsWith(routes.finance)}
                  />
                  <NavItem
                    href={routes.wallets}
                    label={t("wallets")}
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={150}
                    icon={<Wallet size={20} />}
                    isActive={path === routes.wallets}
                  />
                  <NavItem
                    href={routes.prices}
                    label={t("prices")}
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={180}
                    icon={<TrendingUp size={20} />}
                    isActive={path === routes.prices}
                  />
                  <NavItem
                    href={routes.feedback}
                    label={t("feedback")}
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={210}
                    icon={<MessageCircle size={20} />}
                    isActive={path === routes.feedback}
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
                  animationDelay={240}
                  icon={<Settings size={20} />}
                  isActive={path.startsWith("/dashboard/settings")}
                />
                <NavItem
                  href={routes.guide}
                  label={t("guide")}
                  isExpanded={isExpanded}
                  showTooltip={!isExpanded}
                  animationDelay={270}
                  icon={<BookOpen size={20} />}
                  isActive={false}
                />
                {user?.isAdmin && (
                  <NavItem
                    href={routes.admin}
                    label="Admin"
                    isExpanded={isExpanded}
                    showTooltip={!isExpanded}
                    animationDelay={300}
                    icon={<Shield size={20} />}
                    isActive={path.startsWith(routes.admin)}
                  />
                )}
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
                <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0 bg-v2-gold-primary">
                  {user.picture ? (
                    <NextImage
                      src={user.picture}
                      alt={user.fullname || "User"}
                      width={36}
                      height={36}
                      className="rounded-full"
                    />
                  ) : (
                    <span className="font-roboto text-[13px] font-medium text-white">
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
                  <p className="font-roboto text-[13px] font-medium text-v2-text-primary truncate">
                    {user.fullname || "User"}
                  </p>
                  <p className="font-roboto text-[11px] text-v2-text-tertiary truncate">
                    {user.email || (user.username ? `@${user.username}` : "")}
                  </p>
                </div>
              </div>
              {/* Logout Button */}
              <NavTooltip content={t("logout")} disabled={isExpanded}>
                <button
                  onClick={logout}
                  className={cn(
                    "flex items-center w-full py-2.5 rounded-xl font-roboto text-[14px] font-medium text-v2-text-secondary hover:bg-v2-bg-primary transition-all duration-300 ease-in-out mt-1",
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
            {/* Gold accent line */}
            <div className="h-[3px] bg-v2-gold-primary w-full" />
            <div className="bg-v2-bg-primary border-b border-v2-border-light">
              <div className="flex items-center justify-between px-4 py-3">
                {/* Logo area */}
                <div className="flex items-center gap-2">
                  <NextImage
                    src="/logo.svg"
                    alt="congdongvang.com"
                    width={32}
                    height={32}
                    className="rounded-[8px]"
                  />
                  <span className="font-roboto font-bold text-[14px] text-v2-text-primary">
                    congdongvang.com
                  </span>
                </div>

                {/* Action icons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSearchOpen(true)}
                    className="p-2 rounded-lg hover:bg-v2-bg-surface-tint transition-colors touch-target"
                    aria-label="Search"
                  >
                    <Search size={20} className="text-v2-text-secondary" />
                  </button>
                  <NotificationBell />
                  <button
                    onClick={toggleMobileMenu}
                    className="p-2 rounded-lg hover:bg-v2-bg-surface-tint transition-colors touch-target"
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
                  className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-v2-bg-surface z-modal sm:hidden flex flex-col ${
                    isClosing
                      ? "animate-slide-out-left"
                      : "animate-slide-in-left"
                  }`}
                  style={{ zIndex: ZIndex.modal }}
                >
                  {/* Close Button */}
                  <div className="flex items-center justify-between p-4 border-b border-v2-border-light shrink-0">
                    <div className="flex items-center gap-3">
                      <NextImage
                        src="/logo.svg"
                        alt="congdongvang.com"
                        width={38}
                        height={38}
                        className="rounded-[10px]"
                      />
                      <span className="text-v2-text-primary font-roboto font-bold text-lg">
                        congdongvang.com
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

                  {/* Navigation Items — scrollable when overflowing */}
                  <nav
                    className="flex-1 overflow-y-auto p-4"
                    aria-label={t("mobileNavigation")}
                  >
                    {navigationItems}
                  </nav>

                  {/* User Info — pinned to bottom */}
                  <div className="p-4 pb-20 border-t border-v2-border-light shrink-0">
                    <div className="flex items-center gap-3 px-3 py-2 bg-v2-bg-dark rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-v2-gold-primary flex items-center justify-center overflow-hidden">
                        {user.picture ? (
                          <NextImage
                            src={user.picture}
                            alt={user.fullname || "User"}
                            width={32}
                            height={32}
                            className="rounded-full"
                          />
                        ) : (
                          <span className="font-roboto text-[13px] font-medium text-v2-text-secondary">
                            {(user.fullname || "U").charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-roboto text-[13px] font-medium text-v2-text-primary truncate">
                          {user.fullname || "User"}
                        </p>
                        <p className="font-roboto text-[11px] text-v2-text-tertiary truncate">
                          {user.email ||
                            (user.username ? `@${user.username}` : "")}
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
            <header className="hidden sm:flex items-center justify-between px-8 py-4 border-b border-v2-border-light bg-v2-bg-surface h-[68px] shrink-0">
              {/* Left: Greeting + Date */}
              <div>
                <h2 className="font-roboto font-semibold text-[18px] text-v2-text-primary">
                  {greeting}
                  {user.fullname ? `, ${user.fullname}` : ""}
                </h2>
                <p className="font-roboto text-[12px] text-v2-text-tertiary">
                  {formattedDate}
                </p>
              </div>

              {/* Right: Search + Bell */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="flex items-center gap-2 w-fit bg-v2-bg-primary border border-v2-border rounded-xl px-4 py-2 text-v2-text-tertiary text-[13px] font-roboto hover:border-v2-text-tertiary transition-colors"
                >
                  <Search size={16} />
                  <span>{tSearch("placeholder")}</span>
                </button>
                <NotificationBell />
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-safe-mobile sm:pb-8 transition-all duration-300 ease-in-out pt-0 sm:pt-0 lg:pt-0">
              <PushPermissionBanner />
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
              label: tQuickActions("addInvestment"),
              icon: <TrendingUp className="w-6 h-6" />,
              onClick: () => {
                setModalType(ModalType.ADD_INVESTMENT);
              },
            },
          ]}
          autoOpen={path === routes.home}
          introContent={fabIntroContent}
        />

        {/* Global Modals */}
        <BaseModal
          isOpen={modalType !== null}
          onClose={() => setModalType(null)}
          title={modalType || ""}
        >
          {modalType === ModalType.ADD_INVESTMENT && (
            <AddInvestmentForm
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
