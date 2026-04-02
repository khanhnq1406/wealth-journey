---
type: feature
status: Not Started
---

## Overview

**Currently, the tabs in other components have different style. I wan to align them into one reused component**

Horizontal tab selection components across the app overflow their container on mobile screens, causing content to be clipped or forced into an ugly horizontal scroll. This task replaces or enhances all such tab bars with mobile-friendly alternatives that are intuitive, accessible, and consistent with the WealthJourney design system.

## Details

Several pages use horizontal tab bars (e.g., `InvestmentDetailModal` tabs — Overview / Transactions / Add Transaction / Set Price; Market Prices tabs — Gold / Silver / Symbol Lookup; Settings hub tabs) that render fine on desktop but overflow on small screens (< 640px). The root cause is fixed-width tab labels with no wrapping or overflow handling.

**Current problems:**

- Tab labels are clipped or partially hidden on narrow viewports
- No horizontal scroll indicator, so users may not know more tabs exist
- Touch targets are too small on mobile (< 44px height)
- Active tab state is unclear when items are off-screen

**Expected:** All tab bars on mobile use a scrollable strip with `overflow-x-auto scrollbar-hide`, fade-shadow overlay, `min-h-[44px]` touch targets, and v2 design tokens.

## Resources

https://www.eleken.co/blog-posts/tabs-ux
