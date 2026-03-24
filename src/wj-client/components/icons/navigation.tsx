"use client";

import { memo } from "react";
import { Icon, standardSvgProps, type IconProps } from "./Icon";

export const HomeIcon = memo(function HomeIcon(
  props: Omit<IconProps, "children">,
) {
  return (
    <Icon {...props} ariaLabel={props.ariaLabel || "Home"}>
      <svg {...standardSvgProps}>
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    </Icon>
  );
});

export const TransactionIcon = memo(function TransactionIcon(
  props: Omit<IconProps, "children">,
) {
  return (
    <Icon {...props} ariaLabel={props.ariaLabel || "Transactions"}>
      <svg {...standardSvgProps}>
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    </Icon>
  );
});

export const WalletIcon = memo(function WalletIcon(
  props: Omit<IconProps, "children">,
) {
  return (
    <Icon {...props} ariaLabel={props.ariaLabel || "Wallets"}>
      <svg {...standardSvgProps}>
        <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    </Icon>
  );
});

export const PortfolioIcon = memo(function PortfolioIcon(
  props: Omit<IconProps, "children">,
) {
  return (
    <Icon {...props} ariaLabel={props.ariaLabel || "Portfolio"}>
      <svg {...standardSvgProps}>
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    </Icon>
  );
});

export const ReportsIcon = memo(function ReportsIcon(
  props: Omit<IconProps, "children">,
) {
  return (
    <Icon {...props} ariaLabel={props.ariaLabel || "Reports"}>
      <svg {...standardSvgProps}>
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    </Icon>
  );
});

export const CommunityIcon = memo(function CommunityIcon(
  props: Omit<IconProps, "children">,
) {
  return (
    <Icon {...props} ariaLabel={props.ariaLabel || "Community"}>
      <svg {...standardSvgProps}>
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </Icon>
  );
});

export const BudgetIcon = memo(function BudgetIcon(
  props: Omit<IconProps, "children">,
) {
  return (
    <Icon {...props} ariaLabel={props.ariaLabel || "Budget"}>
      <svg {...standardSvgProps}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    </Icon>
  );
});

export const PricesIcon = memo(function PricesIcon(
  props: Omit<IconProps, "children">,
) {
  return (
    <Icon {...props} ariaLabel={props.ariaLabel || "Prices"}>
      <svg {...standardSvgProps}>
        <path d="M3 3v18h18M7 16l4-4 4 4 4-8" />
      </svg>
    </Icon>
  );
});
