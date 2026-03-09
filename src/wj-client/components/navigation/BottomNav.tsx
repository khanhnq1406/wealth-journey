"use client";

import { usePathname, useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";
import { memo } from "react";
import { useTranslations } from "next-intl";
import { ZIndex } from "@/lib/utils/z-index";
import {
  HomeIcon,
  TransactionIcon,
  WalletIcon,
  PortfolioIcon,
  ReportsIcon,
  BudgetIcon,
} from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  ariaLabel: string;
}

interface BottomNavProps {
  navItems: NavItem[];
  className?: string;
}

/**
 * Mobile-optimized bottom navigation bar.
 * Features:
 * - Fixed position at bottom on mobile (< 640px)
 * - Hidden on desktop (sm breakpoint)
 * - Touch-friendly 44px min-height targets
 * - Smooth transitions and active state indicators
 * - Safe area padding for devices with home indicators
 */
export const BottomNav = memo(function BottomNav({
  navItems,
  className,
}: BottomNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();

  const handleClick = (
    e: React.MouseEvent,
    href: string
  ) => {
    // Allow Cmd/Ctrl+click and middle-click to open in new tab
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      return;
    }
    e.preventDefault();
    router.push(href);
  };

  return (
    <nav
      className={cn(
        "sm:hidden fixed bottom-0 left-0 right-0",
        "bg-white border-t border-v2-border-light",
        "pt-1",
        "shadow-[0_-2px_10px_rgba(0,0,0,0.05)]",
        className
      )}
      style={{
        zIndex: ZIndex.sidebar,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)'
      }}
      role="navigation"
      aria-label={t("mainNavigation")}
    >
      <div className="flex justify-around items-center min-h-[52px]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleClick(e, item.href)}
              className={cn(
                "flex flex-col items-center justify-center",
                "min-h-[48px] w-full max-w-[16.66%]", // 16.66% width for 6 items
                "transition-all duration-200 ease-out",
                "text-v2-text-tertiary",
                isActive
                  ? "text-v2-red-primary"
                  : "hover:text-v2-text-secondary active:text-v2-red-dark",
                isActive && "font-medium"
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.ariaLabel}
            >
              <div className="relative flex-shrink-0">
                {/* Icon with active indicator */}
                <div
                  className={cn(
                    "flex items-center justify-center",
                    "w-6 h-6 sm:w-7 sm:h-7",
                    "transition-transform duration-200",
                    isActive ? "scale-110" : "scale-100"
                  )}
                  style={{ minWidth: '24px', minHeight: '24px' }}
                >
                  {item.icon}
                </div>
                {/* Active dot indicator */}
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                    <div className="w-1 h-1 rounded-full bg-v2-red-primary" />
                  </div>
                )}
              </div>
              {/* Label text */}
              <span
                className={cn(
                  "text-[10px] sm:text-xs mt-1",
                  "truncate max-w-full",
                  isActive ? "font-medium" : "font-normal"
                )}
              >
                {item.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
});

/**
 * Helper function to create navigation items from routes
 * Use this to easily generate nav items with proper icons
 * @param routes - Route paths record
 * @param t - Optional translation function from useTranslations('nav')
 */
export const createNavItems = (
  routes: Record<string, string>,
  t?: (key: string) => string
): NavItem[] => {
  return [
    {
      href: routes.home,
      label: t ? t('home') : "Home",
      ariaLabel: t ? t('home') : "Go to home dashboard",
      icon: <HomeIcon size="md" decorative />,
    },
    {
      href: routes.transaction,
      label: t ? t('transactions') : "Transactions",
      ariaLabel: t ? t('transactions') : "Go to transactions",
      icon: <TransactionIcon size="md" decorative />,
    },
    {
      href: routes.wallets,
      label: t ? t('wallets') : "Wallets",
      ariaLabel: t ? t('wallets') : "Go to wallets",
      icon: <WalletIcon size="md" decorative />,
    },
    {
      href: routes.portfolio,
      label: t ? t('portfolio') : "Portfolio",
      ariaLabel: t ? t('portfolio') : "Go to investment portfolio",
      icon: <PortfolioIcon size="md" decorative />,
    },
    {
      href: routes.report,
      label: t ? t('reports') : "Reports",
      ariaLabel: t ? t('reports') : "Go to reports",
      icon: <ReportsIcon size="md" decorative />,
    },
    {
      href: routes.budget,
      label: t ? t('budget') : "Budget",
      ariaLabel: t ? t('budget') : "Go to budget",
      icon: <BudgetIcon size="md" decorative />,
    },
  ];
};
