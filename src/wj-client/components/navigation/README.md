# Navigation Components Documentation

## Overview

congdongvang.com's navigation system provides a responsive, accessible navigation experience across all device sizes. The system automatically switches between desktop sidebar navigation and mobile menu navigation based on screen size.

## Desktop Navigation (Collapsible Sidebar)

### Features

- **Collapsible sidebar**: Toggle between expanded (240px) and collapsed (64px) states
- **Icon-only mode**: When collapsed, shows only icons with tooltips on hover
- **Smooth animations**: CSS transitions for collapse/expand
- **State persistence**: Collapse state saved to localStorage
- **Keyboard accessible**: Full keyboard navigation support

### Components

#### DesktopNav

Main sidebar component for desktop screens (≥800px).

**Props:**
```typescript
interface DesktopNavProps {
  items: NavItem[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
}
```

**File:** `src/wj-client/components/navigation/DesktopNav.tsx`

#### Behavior

- Renders a fixed sidebar on the left side
- Shows icons and labels when expanded
- Shows only icons when collapsed
- Active route highlighted with background color
- Collapse button at the bottom

### Styling

- **Expanded width**: 240px
- **Collapsed width**: 64px
- **Transition**: 300ms ease-in-out
- **Background**: White with shadow
- **Active state**: Light green background (#e8f5e9)

## Mobile Navigation

### Features

- **Bottom sheet menu**: Slides up from bottom of screen
- **Backdrop overlay**: Semi-transparent dark overlay
- **Touch gestures**: Swipe down to close
- **Focus trap**: Keeps focus within menu when open
- **Body scroll lock**: Prevents background scrolling

### Components

#### MobileNav

Bottom sheet navigation for mobile screens (<800px).

**Props:**
```typescript
interface MobileNavProps {
  items: NavItem[];
  isOpen: boolean;
  onClose: () => void;
}
```

**File:** `src/wj-client/components/navigation/MobileNav.tsx`

#### Behavior

- Hidden by default
- Opens from bottom with slide-up animation
- Closes on backdrop click, ESC key, or nav item click
- Automatically closes when route changes

### Styling

- **Sheet height**: Auto (fits content)
- **Max height**: 80vh
- **Border radius**: 16px (top corners)
- **Animation**: Slide up 300ms
- **Backdrop**: rgba(0, 0, 0, 0.5)

## Usage

### Basic Setup

```typescript
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { DesktopNav } from "@/components/navigation/DesktopNav";
import { MobileNav } from "@/components/navigation/MobileNav";
import { useNavigation } from "@/components/navigation/useNavigation";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isCollapsed, toggleCollapse } = useNavigation();

  const navItems = [
    { href: "/dashboard/home", icon: <HomeIcon />, label: "Home" },
    { href: "/dashboard/transaction", icon: <ListIcon />, label: "Transactions" },
    // ... more items
  ];

  return (
    <div className="flex h-screen">
      {/* Desktop Navigation */}
      <div className="hidden sm:block">
        <DesktopNav
          items={navItems}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>

      {/* Mobile Navigation */}
      <div className="sm:hidden">
        <MobileNav
          items={navItems}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
      </div>

      {/* Main Content */}
      <main className={/* ... */}>
        {children}
      </main>
    </div>
  );
}
```

### Using the Navigation Hook

```typescript
import { useNavigation } from "@/components/navigation/useNavigation";

function MyComponent() {
  const { isCollapsed, toggleCollapse, setCollapsed } = useNavigation();

  return (
    <button onClick={toggleCollapse}>
      {isCollapsed ? "Expand" : "Collapse"}
    </button>
  );
}
```

### Creating Nav Items

```typescript
import { Home, Wallet, TrendingUp, List, PieChart } from "lucide-react";

const navItems = [
  {
    href: "/dashboard/home",
    icon: <Home className="w-5 h-5" />,
    label: "Home",
  },
  {
    href: "/dashboard/wallets",
    icon: <Wallet className="w-5 h-5" />,
    label: "Wallets",
  },
  {
    href: "/dashboard/transaction",
    icon: <List className="w-5 h-5" />,
    label: "Transactions",
  },
  {
    href: "/dashboard/budget",
    icon: <PieChart className="w-5 h-5" />,
    label: "Budget",
  },
  {
    href: "/dashboard/portfolio",
    icon: <TrendingUp className="w-5 h-5" />,
    label: "Portfolio",
  },
];
```

## Accessibility

### Keyboard Navigation

- **Tab**: Move between navigation items
- **Enter/Space**: Activate navigation link
- **Escape**: Close mobile menu

### Screen Readers

- All navigation items have descriptive labels
- Active route announced with `aria-current="page"`
- Mobile menu has `role="dialog"` and `aria-modal="true"`
- Collapse button has descriptive `aria-label`

### Focus Management

- Focus trap in mobile menu when open
- Focus returns to trigger button when menu closes
- Visible focus indicators on all interactive elements

## Responsive Behavior

| Screen Size | Breakpoint | Navigation Type | Features |
|-------------|------------|-----------------|----------|
| Mobile      | < 800px    | Bottom Sheet    | Slide-up menu, backdrop overlay |
| Desktop     | ≥ 800px    | Sidebar         | Collapsible, persistent, icon mode |

## State Persistence

The desktop sidebar collapse state is persisted to `localStorage`:

**Key:** `nav-collapsed`
**Values:** `"true"` or `"false"`

This ensures users' navigation preferences persist across sessions.

## Performance

- **No layout shift**: Fixed sidebar width prevents content reflow
- **CSS transitions**: Hardware-accelerated animations
- **Conditional rendering**: Only renders active navigation component
- **Lazy state**: LocalStorage reads only on mount

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires CSS Grid and Flexbox support
- localStorage API for state persistence
- CSS transitions for animations

---

**Last Updated:** 2026-02-09
**Version:** 1.0.0
