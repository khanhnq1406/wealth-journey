---
type: feature
status: Not Started
---

## Overview

Horizontal tab selection components across the app overflow their container on mobile screens, causing content to be clipped or forced into an ugly horizontal scroll. This task aims to replace or enhance all such tab bars with mobile-friendly alternatives that are intuitive, accessible, and consistent with the WealthJourney design system.

## Details

Several pages use horizontal tab bars (e.g., `InvestmentDetailModal` tabs — Overview / Transactions / Add Transaction / Set Price; Market Prices tabs — Gold / Silver / Symbol Lookup; Settings hub tabs) that render fine on desktop but overflow on small screens (< 640px). The root cause is fixed-width tab labels with no wrapping or overflow handling.

**Current problems:**
- Tab labels are clipped or partially hidden on narrow viewports
- No horizontal scroll indicator, so users may not know more tabs exist
- Touch targets are too small on mobile (< 44px height)
- Active tab state is unclear when items are off-screen

**Implementation notes:**
- Use `v2-*` Tailwind tokens only; active tab text should use `text-v2-bg-dark` on `bg-v2-gold-primary` background
- Scrollable strip: add `overflow-x-auto scrollbar-hide` with a CSS fade-shadow overlay via `before:`/`after:` pseudo-elements
- Ensure tab state is preserved when switching (lift state to parent if needed — see existing pattern in Market Prices page)
- Min touch target: `min-h-[44px]` on all tab buttons
