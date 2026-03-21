"use client";

import { cn } from "@/lib/utils/cn";
import { ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * Action item interface for quick action buttons
 */
export interface ActionItem {
  /** Unique identifier for the action */
  id: string;
  /** Label text displayed below the icon */
  label: string;
  /** Icon component (from lucide-react or custom) */
  icon: ReactNode;
  /** Click handler for the action */
  onClick: () => void;
  /** Accessibility label for screen readers */
  ariaLabel: string;
  /** Optional: Disable the action button */
  disabled?: boolean;
}

/**
 * Props for QuickActions component
 */
export interface QuickActionsProps {
  /** Array of action items to display */
  actions: ActionItem[];
  /** Optional additional CSS classes */
  className?: string;
  /** Optional: Show icon only (no label) */
  iconOnly?: boolean;
}

/**
 * QuickActions Component
 *
 * Mobile-optimized horizontal scrolling action buttons for common dashboard actions.
 * Hidden on desktop screens where actions are available in the sidebar.
 *
 * Features:
 * - Horizontal scrolling with scrollbar hidden
 * - Touch-friendly minimum 44px targets
 * - Icon + label layout for clarity
 * - Active/hover states with visual feedback
 * - Fully accessible with ARIA labels
 *
 * @example
 * ```tsx
 * import { PlusIcon, TransactionIcon, WalletIcon } from "@/components/icons";
 *
 * const actions = [
 *   {
 *     id: 'add-transaction',
 *     label: 'Add',
 *     icon: <PlusIcon size="lg" />,
 *     onClick: () => openModal('add-transaction'),
 *     ariaLabel: 'Add new transaction',
 *   },
 *   {
 *     id: 'view-wallets',
 *     label: 'Wallets',
 *     icon: <WalletIcon size="lg" />,
 *     onClick: () => router.push('/dashboard/wallets'),
 *     ariaLabel: 'Go to wallets',
 *   },
 *   // ... more actions
 * ];
 *
 * <QuickActions actions={actions} />
 * ```
 */
export function QuickActions({
  actions,
  className,
  iconOnly = false,
}: QuickActionsProps) {
  const t = useTranslations("quickActions");

  if (actions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        // Only visible on mobile (< 640px)
        "flex sm:hidden",
        // Horizontal scroll container
        "overflow-x-auto",
        // Hide scrollbar for cleaner appearance
        "scrollbar-hide",
        // Spacing and padding
        "gap-3 px-4 py-3",
        // Background
        "bg-v2-maroon-800",
        // Bottom border for visual separation
        "border-b border-v2-gold-primary/20",
        className,
      )}
      role="navigation"
      aria-label={t("sectionAriaLabel")}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          aria-label={action.ariaLabel}
          className={cn(
            // Flex layout for icon + label
            "flex flex-col items-center justify-center",
            // Minimum touch target (44px)
            "min-w-[80px] min-h-[44px]",
            // Gap between icon and label
            iconOnly ? "gap-0" : "gap-2",
            // Padding
            "px-3 py-2",
            // Rounded corners
            "rounded-lg",
            // Background and border
            "bg-v2-maroon-800 border border-v2-maroon-600",
            // Hover state
            "hover:bg-neutral-50 hover:border-v2-gold-primary/30",
            // Active state (touch feedback)
            "active:bg-neutral-100 active:scale-95",
            // Focus state for keyboard navigation
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2",
            // Transitions
            "transition-all duration-200",
            // Disabled state
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          )}
        >
          {/* Icon container */}
          <span
            className={cn(
              // Icon size: 24px (6 * 4px)
              "w-6 h-6",
              // Color
              "text-primary-600",
              // Transition
              "transition-colors duration-200",
            )}
            aria-hidden="true"
          >
            {action.icon}
          </span>

          {/* Label */}
          {!iconOnly && (
            <span
              className={cn(
                // Text size: 12px (text-xs)
                "text-xs",
                // Font weight
                "font-medium",
                // Text color
                "text-neutral-700",
                // Truncate long text
                "truncate max-w-[80px]",
                // Center align
                "text-center",
              )}
            >
              {action.label}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Default quick action sets for common pages
 */

/**
 * Home page quick actions
 */
export const homeQuickActions = (
  onOpenModal: (modalType: string) => void,
): ActionItem[] => [
  {
    id: "add-transaction",
    label: "Add",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </svg>
    ),
    onClick: () => onOpenModal("add-transaction"),
    ariaLabel: "Add new transaction",
  },
  {
    id: "transfer",
    label: "Transfer",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m16 3 4 4-4 4" />
        <path d="M20 7H4" />
        <path d="m8 21-4-4 4-4" />
        <path d="M4 17h16" />
      </svg>
    ),
    onClick: () => onOpenModal("transfer"),
    ariaLabel: "Transfer money between wallets",
  },
  {
    id: "new-wallet",
    label: "Wallet",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
    ),
    onClick: () => onOpenModal("create-wallet"),
    ariaLabel: "Create new wallet",
  },
];

/**
 * Portfolio page quick actions
 */
export const portfolioQuickActions = (
  onOpenModal: (modalType: string) => void,
  onRefresh?: () => void,
): ActionItem[] => [
  {
    id: "add-investment",
    label: "Add Investment",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </svg>
    ),
    onClick: () => onOpenModal("add-investment"),
    ariaLabel: "Add new investment",
  },
  ...(onRefresh
    ? [
        {
          id: "refresh",
          label: "Refresh",
          icon: (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
          ) as ReactNode,
          onClick: onRefresh,
          ariaLabel: "Refresh market prices",
        } as ActionItem,
      ]
    : []),
];

/**
 * Transaction page quick actions
 */
export const transactionQuickActions = (
  onOpenModal: (modalType: string) => void,
): ActionItem[] => [
  {
    id: "add-transaction",
    label: "Add",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </svg>
    ),
    onClick: () => onOpenModal("add-transaction"),
    ariaLabel: "Add new transaction",
  },
  {
    id: "transfer",
    label: "Transfer",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m16 3 4 4-4 4" />
        <path d="M20 7H4" />
        <path d="m8 21-4-4 4-4" />
        <path d="M4 17h16" />
      </svg>
    ),
    onClick: () => onOpenModal("transfer"),
    ariaLabel: "Transfer money between wallets",
  },
];

/**
 * Wallets page quick actions
 */
export const walletsQuickActions = (
  onOpenModal: (modalType: string) => void,
): ActionItem[] => [
  {
    id: "new-wallet",
    label: "New Wallet",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </svg>
    ),
    onClick: () => onOpenModal("create-wallet"),
    ariaLabel: "Create new wallet",
  },
  {
    id: "transfer",
    label: "Transfer",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m16 3 4 4-4 4" />
        <path d="M20 7H4" />
        <path d="m8 21-4-4 4-4" />
        <path d="M4 17h16" />
      </svg>
    ),
    onClick: () => onOpenModal("transfer"),
    ariaLabel: "Transfer money between wallets",
  },
];
