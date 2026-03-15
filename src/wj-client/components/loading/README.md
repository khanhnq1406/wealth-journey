# Loading Components

This directory contains loading state components for the congdongvang.com application. All skeleton components use a polished shimmer animation that provides better visual feedback than simple pulse animations.

## Features

- **Shimmer Animation**: Smooth gradient animation that sweeps across skeleton elements
- **Accessibility**: Proper ARIA attributes (`role="status"`, `aria-label`) for screen readers
- **Performance**: All components are memoized with `React.memo` to prevent unnecessary re-renders
- **Responsive**: Mobile-optimized variants for table and card skeletons
- **Reduced Motion**: Honors `prefers-reduced-motion` preferences
- **Design System Match**: Components match BaseCard, Button, and other component styling

## Installation

All components are exported from the main index:

```tsx
import {
  LoadingSpinner,
  FullPageLoading,
  Skeleton,
  CardSkeleton,
  TableSkeleton,
  StatsCardSkeleton,
  PortfolioSkeleton,
  // ... more
} from "@/components/loading";
```

## Base Components

### `Skeleton`

Base skeleton component for custom loading states with shimmer animation.

```tsx
import { Skeleton } from "@/components/loading";

// Custom dimensions
<Skeleton className="h-4 w-32" />
<Skeleton className="h-8 w-48 rounded-full" />

// With custom style
<Skeleton className="h-12" style={{ width: "50%" }} />
```

### `LoadingSpinner`

Traditional spinner with optional text for action-based loading states.

```tsx
import { LoadingSpinner } from "@/components/loading";

<LoadingSpinner text="Loading data..." />
<LoadingSpinner /> // Default text
```

### `FullPageLoading`

Full-page loading overlay for initial page loads or route transitions.

```tsx
import { FullPageLoading } from "@/components/loading";

<FullPageLoading text="Loading dashboard..." />
```

## Skeleton Components

### `CardSkeleton`

Loading state for card components matching `BaseCard` styling.

```tsx
import { CardSkeleton } from "@/components/loading";

// Basic usage
<CardSkeleton />

// With custom configuration
<CardSkeleton
  lines={5}
  showHeader
  showAction
  padding="md"      // "none" | "sm" | "md" | "lg"
  shadow="md"       // "sm" | "md" | "lg" | "none"
/>
```

### `TableSkeleton`

Loading state for table/list views with configurable row count and columns.

```tsx
import { TableSkeleton } from "@/components/loading";

// Desktop table with header
<TableSkeleton rows={10} columns={5} showHeader />

// Mobile card view
<TableSkeleton rows={5} mobile />

// With avatar column
<TableSkeleton rows={5} showAvatar />
```

### `StatsCardSkeleton`

Loading state for dashboard statistics cards (portfolio summary, etc.).

```tsx
import { StatsCardSkeleton } from "@/components/loading";

// 4 cards in grid (default)
<StatsCardSkeleton cards={4} />

// Custom grid layout
<StatsCardSkeleton
  cards={3}
  cols={3}           // 1 | 2 | 3 | 4
  showChange         // Show change indicator (e.g., +5.2%)
/>
```

### `TextSkeleton`

Loading state for text content (paragraphs, headings).

```tsx
import { TextSkeleton } from "@/components/loading";

// Standard paragraph
<TextSkeleton lines={3} />

// Heading with custom height
<TextSkeleton
  lines={1}
  width="1/2"        // "full" | "3/4" | "2/3" | "1/2" | "1/3"
  height="h-6"       // "h-3" | "h-4" | "h-5" | "h-6"
/>
```

### `ButtonSkeleton`

Button skeleton matching `Button` component dimensions.

```tsx
import { ButtonSkeleton } from "@/components/loading";

<ButtonSkeleton size="md" width="full" showIcon />

// Sizes: "sm" | "md" | "lg"
// Width: "auto" | "full"
```

### `ChartSkeleton`

Loading state for chart components with support for bar, line, and pie charts.

```tsx
import { ChartSkeleton } from "@/components/loading";

// Bar chart
<ChartSkeleton bars={7} height="h-64" variant="bar" showLegend />

// Line chart
<ChartSkeleton bars={12} height="h-48" variant="line" />

// Pie chart
<ChartSkeleton variant="pie" showLegend />
```

### `FormSkeleton`

Loading state for form components.

```tsx
import { FormSkeleton } from "@/components/loading";

<FormSkeleton
  fields={4}
  showSubmitButton
  showLabels
  selectFields={1}   // Number of select dropdowns
/>
```

### `PageSkeleton`

Full-page skeleton matching dashboard layout with header, content, and optional sidebar.

```tsx
import { PageSkeleton } from "@/components/loading";

<PageSkeleton
  showHeader
  showSidebar
  contentCards={3}
/>
```

## Specialized Skeletons

### `PortfolioSkeleton`

Portfolio page skeleton matching the portfolio page layout.

```tsx
import { PortfolioSkeleton } from "@/components/loading";

<PortfolioSkeleton
  showFilters          // Show wallet/type filter dropdowns
  investmentRows={5}   // Number of investment rows
/>
```

### `TransactionSkeleton`

Transaction list skeleton for transaction page loading.

```tsx
import { TransactionSkeleton } from "@/components/loading";

<TransactionSkeleton
  transactions={10}
  showCategory         // Show category badges
  showWallet           // Show wallet indicator
/>
```

### `WalletCardSkeleton`

Wallet card skeleton for wallet list loading.

```tsx
import { WalletCardSkeleton } from "@/components/loading";

<WalletCardSkeleton
  cards={3}
  showBalance
  showTransactionCount
/>
```

### `ModalSkeleton`

Modal skeleton for modal content loading states.

```tsx
import { ModalSkeleton } from "@/components/loading";

// Form modal
<ModalSkeleton variant="form" />

// Details modal
<ModalSkeleton variant="details" />

// Confirmation modal
<ModalSkeleton variant="confirmation" />
```

### `AvatarSkeleton`

Avatar skeleton for user profile loading.

```tsx
import { AvatarSkeleton } from "@/components/loading";

<AvatarSkeleton size="lg" showName />

// Sizes: "sm" | "md" | "lg" | "xl"
```

### `ListSkeleton`

Simple list skeleton for dropdowns, select lists, etc.

```tsx
import { ListSkeleton } from "@/components/loading";

<ListSkeleton
  items={5}
  showAvatar
  lines={2}
/>
```

## Legacy Skeletons

These components are kept for backward compatibility:

- `WalletListSkeleton` - Simple wallet list loading
- `TotalBalanceSkeleton` - Balance display loading
- `UserSkeleton` - User profile loading (alias for `AvatarSkeleton`)

## Design System

All skeleton components follow these design principles:

### Color

- **Background**: `neutral-200` (#E2E8F0) from the design system palette
- **Shimmer**: White gradient overlay (40% opacity) for smooth animation

### Animation

- **Type**: Shimmer (gradient sweep) instead of simple pulse
- **Duration**: 1.5s infinite loop
- **Easing**: Linear for smooth, continuous motion
- **Honor reduced motion**: Disabled when `prefers-reduced-motion: reduce`

### Accessibility

- **ARIA role**: `role="status"` for all skeleton elements
- **ARIA label**: Descriptive labels (e.g., "Loading table...")
- **Screen reader text**: Skeletons are hidden from screen readers (`aria-hidden="true"`)
- **Focus management**: Skeletons don't interfere with keyboard navigation

### Performance

- **Memoization**: All components use `React.memo` to prevent unnecessary re-renders
- **CSS animations**: Hardware-accelerated CSS transforms for smooth 60fps animation
- **Minimal reflows**: Fixed dimensions prevent layout shifts

## Best Practices

### 1. Use Skeletons for Content Areas

Skeletons provide better UX than spinners for content loading because they show where content will appear.

```tsx
// Good: Skeleton shows content structure
{isLoading ? <TableSkeleton rows={10} /> : <Table data={data} />}

// Avoid: Generic spinner for content areas
{isLoading ? <LoadingSpinner /> : <Table data={data} />}
```

### 2. Use Spinners for Actions

Spinners are better for button loading states or quick operations.

```tsx
// Good: Spinner for button actions
<Button loading={isSubmitting} onClick={handleSubmit}>
  Save
</Button>
```

### 3. Match Skeleton to Content

The skeleton should approximate the actual content layout for smooth perceived performance.

```tsx
// Good: Matching rows and columns
<TableSkeleton rows={data?.length || 5} columns={5} showHeader />

// Avoid: Completely different structure
<TableSkeleton rows={3} /> // Actual table has 10 rows
```

### 4. Keep It Simple

Don't over-complicate skeleton designs. Simple shapes with smooth animations work best.

```tsx
// Good: Simple shimmer effect
<Skeleton className="h-4 w-32" />

// Avoid: Complex patterns that distract
<Skeleton className="complex-gradient-pattern multiple-animations" />
```

### 5. Test Loading States

Always verify loading states look good during development, especially on slower connections.

## Examples

### Card Loading

```tsx
"use client";

import { useQueryListWallets } from "@/utils/generated/hooks";
import { CardSkeleton } from "@/components/loading";
import { WalletCard } from "./WalletCard";

export function WalletList() {
  const { data, isLoading } = useQueryListWallets();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data?.wallets.map(wallet => (
        <WalletCard key={wallet.id} wallet={wallet} />
      ))}
    </div>
  );
}
```

### Table Loading

```tsx
"use client";

import { useQueryListTransactions } from "@/utils/generated/hooks";
import { TableSkeleton } from "@/components/loading";
import { TransactionTable } from "./TransactionTable";

export function TransactionList() {
  const { data, isLoading } = useQueryListTransactions();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-card p-4">
        <TableSkeleton rows={10} columns={5} showHeader />
      </div>
    );
  }

  return <TransactionTable transactions={data?.transactions || []} />;
}
```

### Portfolio Loading

```tsx
"use client";

import { PortfolioSkeleton } from "@/components/loading";
import { useQueryListWallets } from "@/utils/generated/hooks";

export default function PortfolioPage() {
  const getListWallets = useQueryListWallets(
    { pagination: { page: 1, pageSize: 100, orderBy: "created_at", order: "desc" } },
    { refetchOnMount: "always" },
  );

  if (getListWallets.isLoading || getListWallets.isPending) {
    return <PortfolioSkeleton showFilters investmentRows={5} />;
  }

  // Render actual portfolio content
  return <PortfolioContent />;
}
```

### Mixed Loading States

```tsx
"use client";

import { CardSkeleton, TextSkeleton, StatsCardSkeleton } from "@/components/loading";

export function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useSummary();
  const { data: wallets, isLoading: loadingWallets } = useWallets();

  return (
    <div className="space-y-6">
      {/* Summary section */}
      {loadingSummary ? (
        <StatsCardSkeleton cards={4} />
      ) : (
        <SummaryCards summary={summary} />
      )}

      {/* Wallets section */}
      {loadingWallets ? (
        <div className="grid gap-4 md:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <WalletGrid wallets={wallets} />
      )}
    </div>
  );
}
```

## Animation Details

### Shimmer Animation

The shimmer effect uses a CSS gradient animation that sweeps across the skeleton element:

```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-shimmer {
  animation: shimmer 1.5s infinite;
}
```

The shimmer overlay is a white gradient at 40% opacity that creates the sweeping effect:

```tsx
<div className="relative overflow-hidden">
  <div className="absolute inset-0 -translate-x-full animate-shimmer
                  bg-gradient-to-r from-transparent via-white/40 to-transparent" />
</div>
```

### Reduced Motion Support

For users who prefer reduced motion, the shimmer animation is disabled and replaced with a subtle opacity:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-shimmer {
    animation: none;
  }
  .skeleton-shimmer {
    opacity: 0.7;
  }
}
```

## Component Props Reference

### Common Props

All skeleton components support:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `""` | Additional Tailwind CSS classes |
| `style` | `React.CSSProperties` | `undefined` | Custom inline styles |

### Skeleton-Specific Props

#### `CardSkeleton`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `lines` | `number` | `3` | Number of content lines |
| `showHeader` | `boolean` | `true` | Show header section |
| `showAction` | `boolean` | `true` | Show action button |
| `padding` | `"none" \| "sm" \| "md" \| "lg"` | `"md"` | Padding variant |
| `shadow` | `"sm" \| "md" \| "lg" \| "none"` | `"md"` | Shadow variant |

#### `TableSkeleton`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `rows` | `number` | `5` | Number of data rows |
| `columns` | `number` | `3` | Number of columns per row |
| `showHeader` | `boolean` | `true` | Show header row |
| `showAvatar` | `boolean` | `false` | Show avatar column |
| `mobile` | `boolean` | `false` | Use card layout for mobile |

#### `StatsCardSkeleton`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `cards` | `number` | `4` | Number of stat cards |
| `cols` | `1 \| 2 \| 3 \| 4` | `4` | Grid column count |
| `showChange` | `boolean` | `true` | Show change indicator |

#### `ButtonSkeleton`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Button size |
| `width` | `"auto" \| "full"` | `"full"` | Button width |
| `showIcon` | `boolean` | `false` | Show icon placeholder |

#### `ChartSkeleton`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bars` | `number` | `7` | Number of bars/points |
| `height` | `string` | `"h-64"` | Chart height |
| `variant` | `"bar" \| "line" \| "pie"` | `"bar"` | Chart type |
| `showLegend` | `boolean` | `true` | Show legend |

## TypeScript Support

All components export their prop types for TypeScript users:

```tsx
import type { SkeletonProps } from "@/components/loading";

const customSkeletonProps: SkeletonProps = {
  className: "h-4 w-32",
  style: { width: "50%" },
};
```

## Migration Guide

### From `animate-pulse` to Shimmer

If you have existing skeletons using Tailwind's `animate-pulse`, they will automatically benefit from the new shimmer animation:

```tsx
// Before: Custom pulse animation
<div className="animate-pulse bg-neutral-200 rounded" />

// After: Built-in shimmer with Skeleton component
<Skeleton className="h-4 w-32" />
```

### From Legacy Skeletons

The legacy skeleton components (`ChartSkeletonNew`, `FormSkeleton`) have been replaced with enhanced versions. Update your imports:

```tsx
// Before
import { ChartSkeletonNew } from "@/components/loading/Skeleton";

// After
import { ChartSkeleton } from "@/components/loading";
```

## Troubleshooting

### Animation Not Working

If the shimmer animation isn't visible:

1. Ensure `globals.css` is imported in your layout
2. Check that the `@keyframes shimmer` rule is present
3. Verify the animation isn't being overridden by other CSS

### Skeletons Too Dark/Light

Adjust the base color by modifying the `bg-neutral-200` class:

```tsx
// Darker
<Skeleton className="bg-neutral-300 h-4 w-32" />

// Lighter
<Skeleton className="bg-neutral-100 h-4 w-32" />
```

### Performance Issues

If you experience performance issues with many skeletons:

1. Use `React.memo` on parent components
2. Limit the number of skeleton rows (e.g., 5-10 max)
3. Ensure `will-change` isn't overused

---

**Last Updated:** 2026-02-04
**Maintainer:** congdongvang.com Team
