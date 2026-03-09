# V2 Design Migration — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Migrate the WealthJourney frontend from the green-based (#008148) fintech theme to the V2 "Crimson & Gold" design system, and rebuild the home dashboard to match the V2 mockups.

**Spec:** `docs/specs/2026-03-08-v2-design-migration-spec.md`

**Architecture:** Frontend-only visual redesign. No backend/API changes. The migration touches: Tailwind config, CSS variables, font system, dashboard layout (sidebar + top bar + bottom nav), and the entire home page (new sections: net worth, PNL, gold/silver tables+charts, wallets). All text uses the existing `next-intl` i18n system.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, Recharts, next/font/google, next-intl, React Query, lucide-react

## Security Implementation Notes

This is a **read-only frontend visual redesign** with no new API endpoints, data models, or user inputs. Security surface is minimal:
- **No new inputs:** All new sections display data from existing authenticated APIs
- **XSS:** React auto-escapes all rendered text. Price data is numeric. Gold/silver type names come from backend.
- **Data exposure:** No change in what financial data is displayed (already on dashboard)
- **Dependencies:** Only new dependencies are Google Fonts (self-hosted via `next/font`) — no runtime risk

## C4 Architecture Diagram Updates

Per spec: Update `docs/architecture/c4-component-frontend.md` (L3) to reflect new home page sections. No new L4 diagrams needed.

---

## Task Dependency Overview

```
Task 1: Color System (tailwind.config.ts + globals.css)
Task 2: Typography (fonts) — depends on Task 1
Task 3: i18n Translation Keys — independent
Task 4: Desktop Sidebar Redesign — depends on Tasks 1, 2
Task 5: Desktop Top Bar — depends on Tasks 1, 2
Task 6: Mobile Header & Bottom Nav — depends on Tasks 1, 2
Task 7: Net Worth & PNL Display — depends on Tasks 1, 2, 3
Task 8: Gold Price Table — depends on Tasks 1, 2, 3
Task 9: Gold Price Chart — depends on Tasks 1, 2, 3
Task 10: Silver Price Table — depends on Tasks 1, 2, 3
Task 11: Silver Price Chart — depends on Tasks 1, 2, 3
Task 12: Wallets Section — depends on Tasks 1, 2, 3
Task 13: Home Page Assembly — depends on Tasks 7-12
Task 14: Update C4 Architecture Diagrams — after Task 13
Task 15: Cleanup & Polish — after Task 13
```

**Parallelization opportunities:**
- Tasks 1, 3 can run in parallel
- Tasks 4, 5, 6 can run in parallel (after 1+2)
- Tasks 7, 8, 9, 10, 11, 12 can run in parallel (after 1+2+3)

---

### Task 1: Color System Migration

**Files:**
- Modify: `src/wj-client/tailwind.config.ts`
- Modify: `src/wj-client/app/globals.css`
- Modify: `src/wj-client/app/constants.tsx` (chart colors)
- Modify: `src/wj-client/app/layout.tsx` (theme color metadata)

**Security notes:** None — CSS-only changes.

**Step 1: Update `tailwind.config.ts` color palette**

Replace the current `colors` section in the `extend` block with the V2 Crimson & Gold palette. Keep all existing structural tokens (dark mode, z-index, animations, etc.) unchanged.

Key changes:
- Add V2 semantic tokens as a new `v2` color group (preserving existing colors for other pages):
  ```typescript
  v2: {
    "bg-primary": "#FAF9F7",
    "bg-surface": "#FFFFFF",
    "bg-surface-tint": "#FDF6EE",
    "bg-dark": "#1C1917",
    "border-light": "#EDE8E1",
    "border": "#DDD8D0",
    "text-primary": "#1C1917",
    "text-secondary": "#57534E",
    "text-tertiary": "#78716C",
    "text-on-dark": "#FAF9F7",
    "red-primary": "#B91C1C",
    "red-dark": "#7F1D1D",
    "red-light": "#FEF2F2",
    "red-negative": "#DC2626",
    "gold-primary": "#B8860B",
    "gold-dark": "#92710C",
    "gold-light": "#FBF3E0",
    "gold-accent": "#D4A017",
    "green-positive": "#15803D",
    "green-light": "#F0FDF4",
    "silver-primary": "#8B929E",
    "silver-dark": "#374151",
    "silver-light": "#EEF0F3",
  },
  ```
- Add chart colors for V2:
  ```typescript
  "chart-v2": {
    gold: "#B8860B",
    red: "#B91C1C",
    "gold-area": "#B8860B33",
    silver: "#4B5563",
  },
  ```
- Update `boxShadow` to add V2 card shadow:
  ```typescript
  "v2-card": "0 2px 12px rgba(0, 0, 0, 0.047)", // #0000000C
  ```

**Step 2: Update `globals.css` CSS variables**

Add V2 CSS variables alongside existing ones (don't remove old ones yet — other pages still use them):
```css
:root {
  /* ... existing variables ... */
  /* V2 Crimson & Gold */
  --v2-bg-primary: #FAF9F7;
  --v2-bg-surface: #FFFFFF;
  --v2-red-primary: #B91C1C;
  --v2-red-dark: #7F1D1D;
  --v2-gold-primary: #B8860B;
}
```

Update focus ring color to V2 red-primary:
```css
*:focus-visible {
  outline: 2px solid #B91C1C; /* V2 red-primary */
}
```

**Step 3: Update chart colors in `app/constants.tsx`**

Add V2 chart color arrays alongside existing ones:
```typescript
export const v2ChartColors = [
  "#B8860B", // Gold primary
  "#B91C1C", // Red primary
  "#15803D", // Green positive
  "#D4A017", // Gold accent
  "#8B929E", // Silver primary
  "#374151", // Silver dark
  "#92710C", // Gold dark
  "#7F1D1D", // Red dark
];
```

**Step 4: Update `app/layout.tsx` theme color**

Change the `themeColor` from `#008148` to `#B91C1C` (V2 red-primary):
```typescript
themeColor: [
  { media: "(prefers-color-scheme: light)", color: "#B91C1C" },
  { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
],
```

**Step 5: Commit**
```
feat(v2): add Crimson & Gold color palette to Tailwind and CSS variables
```

---

### Task 2: Typography Migration

**Files:**
- Modify: `src/wj-client/app/[locale]/layout.tsx`
- Modify: `src/wj-client/tailwind.config.ts`
- Modify: `src/wj-client/app/globals.css`

**Security notes:** None — font loading only.

**Step 1: Add Sora and IBM Plex Mono fonts**

In `src/wj-client/app/[locale]/layout.tsx`:
```typescript
import { Sora, IBM_Plex_Mono } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700", "800"],
  preload: true,
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600", "700"],
  preload: true,
  display: "swap",
});
```

Keep `Plus_Jakarta_Sans` for backward compatibility on non-migrated pages.

Update `<body>` className:
```typescript
<body className={`${plusJakartaSans.variable} ${sora.variable} ${ibmPlexMono.variable} antialiased h-dvh`}>
```

**Step 2: Add font family utilities to Tailwind**

In `tailwind.config.ts`, add under `extend`:
```typescript
fontFamily: {
  sora: ["var(--font-sora)", "system-ui", "sans-serif"],
  "ibm-mono": ["var(--font-ibm-plex-mono)", "ui-monospace", "monospace"],
  jakarta: ["var(--font-jakarta-sans)", "system-ui", "sans-serif"],
},
```

**Step 3: Update `globals.css`**

Keep existing `font-family: var(--font-jakarta-sans)` on body — individual V2 components will use `font-sora` and `font-ibm-mono` classes explicitly. This avoids breaking non-migrated pages.

Add V2 typography utility classes:
```css
/* V2 Typography Utilities */
.v2-heading-hero { font-family: var(--font-sora); font-weight: 800; letter-spacing: -1.5px; }
.v2-heading-lg { font-family: var(--font-sora); font-weight: 700; letter-spacing: -1px; }
.v2-heading-md { font-family: var(--font-sora); font-weight: 600; letter-spacing: -0.5px; }
.v2-heading-sm { font-family: var(--font-sora); font-weight: 500; letter-spacing: -0.3px; }
.v2-body { font-family: var(--font-sora); font-weight: 400; }
.v2-data-bold { font-family: var(--font-ibm-plex-mono); font-weight: 700; letter-spacing: 0.5px; }
.v2-data-semibold { font-family: var(--font-ibm-plex-mono); font-weight: 600; letter-spacing: 1px; }
.v2-data-medium { font-family: var(--font-ibm-plex-mono); font-weight: 500; letter-spacing: 0.5px; }
.v2-data-regular { font-family: var(--font-ibm-plex-mono); font-weight: 400; letter-spacing: 0.5px; }
```

**Step 4: Commit**
```
feat(v2): add Sora and IBM Plex Mono font system
```

---

### Task 3: i18n Translation Keys

**Files:**
- Modify: `src/wj-client/messages/vi/ui.json`
- Modify: `src/wj-client/messages/en/ui.json`

**Security notes:** None — static translation strings.

**Step 1: Add V2 home page translation keys**

Add new keys under `dashboard.home` in both `vi/ui.json` and `en/ui.json`. Keep existing keys intact.

**Vietnamese (`vi/ui.json`)** — add to the existing `dashboard.home` object:
```json
"greeting": {
  "morning": "Chào buổi sáng",
  "afternoon": "Chào buổi chiều",
  "evening": "Chào buổi tối"
},
"totalNetWorthLabel": "TỔNG TÀI SẢN RÒNG",
"pnlTitle": "Tài sản ròng",
"pnlToday": "L/L HÔM NAY",
"pnl7d": "L/L 7 NGÀY",
"pnl30d": "L/L 30 NGÀY",
"today": "Hôm nay",
"7days": "7 Ngày",
"30days": "30 Ngày",
"goldPriceTitle": "Giá Vàng Hôm Nay",
"silverPriceTitle": "Giá Bạc Hôm Nay",
"goldChartTitle": "Biểu Đồ Giá Vàng",
"silverChartTitle": "Biểu Đồ Giá Bạc",
"wallets": "Ví tiền",
"seeAll": "Xem tất cả",
"updated": "Cập nhật {time}",
"goldType": "LOẠI VÀNG",
"silverType": "LOẠI BẠC",
"buy": "MUA",
"sell": "BÁN",
"period": {
  "24h": "24h",
  "week": "Tuần",
  "month": "Tháng",
  "year": "Năm",
  "30d": "30D"
},
"comingSoon": "Sắp ra mắt"
```

**English (`en/ui.json`)** — same structure:
```json
"greeting": {
  "morning": "Good morning",
  "afternoon": "Good afternoon",
  "evening": "Good evening"
},
"totalNetWorthLabel": "TOTAL NET WORTH",
"pnlTitle": "Net worth",
"pnlToday": "P/L TODAY",
"pnl7d": "P/L 7 DAYS",
"pnl30d": "P/L 30 DAYS",
"today": "Today",
"7days": "7 Days",
"30days": "30 Days",
"goldPriceTitle": "Gold Prices Today",
"silverPriceTitle": "Silver Prices Today",
"goldChartTitle": "Gold Price Chart",
"silverChartTitle": "Silver Price Chart",
"wallets": "Wallets",
"seeAll": "See all",
"updated": "Updated {time}",
"goldType": "GOLD TYPE",
"silverType": "SILVER TYPE",
"buy": "BUY",
"sell": "SELL",
"period": {
  "24h": "24h",
  "week": "Week",
  "month": "Month",
  "year": "Year",
  "30d": "30D"
},
"comingSoon": "Coming soon"
```

**Step 2: Commit**
```
feat(v2): add i18n translation keys for V2 home dashboard
```

---

### Task 4: Desktop Sidebar Redesign

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`
- Modify: `src/wj-client/components/navigation/NavItem.tsx`
- Modify: `src/wj-client/components/navigation/SidebarToggle.tsx`

**Security notes:** None — visual changes only.

**Step 1: Redesign NavItem for V2 styling**

In `NavItem.tsx`, update the active/inactive states:
- Active: `text-v2-red-primary bg-v2-red-light rounded-xl` (cornerRadius 12)
- Inactive: `text-v2-text-secondary hover:bg-v2-bg-primary`
- Font: `font-sora text-[14px] font-medium`

**Step 2: Replace inline SVG icons with lucide-react**

Install `lucide-react` if not already a dependency. Replace all inline SVG nav icons in `layout.tsx` with lucide components:
- Home → `<House size={20} />`
- Transactions → `<ArrowLeftRight size={20} />`
- Wallets → `<Wallet size={20} />`
- Portfolio → `<ChartNoAxesCombined size={20} />`
- Budget → `<Calculator size={20} />`
- Report → `<ChartPie size={20} />`
- Prices → `<CircleDollarSign size={20} />`
- Settings → `<Settings size={20} />`

**Step 3: Update desktop sidebar in `layout.tsx`**

Replace the current green gradient sidebar with V2 white sidebar:
- Background: `bg-white` (not gradient) with right border `border-r border-v2-border-light`
- Fixed width: 260px (remove collapsible behavior for V2, or keep as enhancement)
- Logo: Red "W" mark (38x38, `bg-v2-red-primary rounded-[10px]`) + "WealthJourney" text (`font-sora font-bold text-[19px]`)
- Nav items: Use updated NavItem with V2 styling
- Add Settings nav item at bottom, separated by spacer + divider
- Replace logout button with Settings link
- User row at bottom: Avatar (32x32) + name (`font-sora text-[13px] font-medium`) + email (`font-ibm-mono text-[11px]`)
- Padding: 24px top, 0px horizontal (nav items have their own padding)

**Step 4: Update mobile slide-out menu**

Replace green gradient with white background, update nav item styling to match V2:
- Background: `bg-white` instead of `from-primary-600 to-primary-700`
- Text colors: `text-v2-text-secondary` (inactive), `text-v2-red-primary` (active)
- Logo: Same red "W" mark as desktop

**Step 5: Commit**
```
feat(v2): redesign sidebar navigation with Crimson & Gold theme
```

---

### Task 5: Desktop Top Bar

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`

**Security notes:** None — display only.

**Step 1: Add V2 top bar to main content area**

Insert a top bar between the sidebar and the main content. This is a new `<header>` element inside the main content area, NOT replacing the mobile header.

V2 Top Bar (68px height):
- Left side: Greeting text (`font-sora font-semibold text-[18px]`) + date (`font-ibm-mono text-[12px] text-v2-text-tertiary`)
- Right side: Search box (240px, `bg-v2-bg-primary border border-v2-border rounded-xl px-4 py-2`) + bell icon (`<Bell size={20} />`)
- Bottom border: `border-b border-v2-border-light`
- Only visible on `sm:` breakpoint and above (desktop/tablet)

Greeting logic:
- Use current hour to determine morning (<12) / afternoon (<18) / evening
- Use i18n key `dashboard.home.greeting.{morning|afternoon|evening}`
- Append user name from auth state

Date formatting:
- Use `Intl.DateTimeFormat` with current locale
- Format: "Thứ Hai, 08 tháng 03 2026" (vi) / "Monday, March 08, 2026" (en)

Search box:
- Placeholder text only — clicking opens the existing GlobalSearch (`setIsSearchOpen(true)`)
- Display search icon + "Tìm kiếm..." placeholder

**Step 2: Commit**
```
feat(v2): add desktop top bar with greeting and search
```

---

### Task 6: Mobile Header & Bottom Nav Redesign

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`
- Modify: `src/wj-client/components/navigation/BottomNav.tsx`

**Security notes:** None — visual changes only.

**Step 1: Update mobile header in `layout.tsx`**

V2 Mobile Header:
- Add red accent line at top: `<div className="h-[3px] bg-v2-red-primary w-full" />` before the header
- Header row (56px): Logo area (red "W" mark + "WealthJourney" text) + action icons (bell + settings)
- Remove hamburger menu button — replace with bell and settings icons on the right
- Background: warm ivory `bg-v2-bg-primary`
- Remove user avatar from header (it's in the sidebar/bottom area)

**Step 2: Update BottomNav styling**

In `BottomNav.tsx`:
- Background: `bg-white` (already white, keep it)
- Top border: `border-v2-border-light`
- Active state: `text-v2-red-primary` icon/text (replace current `text-primary-600`)
- Inactive: `text-v2-text-tertiary`
- Keep existing 6-item layout and safe area padding

**Step 3: Commit**
```
feat(v2): update mobile header with red accent and bottom nav styling
```

---

### Task 7: Net Worth & PNL Display Components

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/home/NetWorthDisplay.tsx`
- Create: `src/wj-client/app/[locale]/dashboard/home/PNLCard.tsx`

**Security notes:** Financial data display — use existing hooks (already authenticated). No new inputs.

**Step 1: Create NetWorthDisplay component**

This component shows:

**Mobile version:**
- Greeting: "[greeting], [Name]" — `font-sora font-medium text-v2-text-secondary`
- Label: "TỔNG TÀI SẢN RÒNG" — `font-ibm-mono font-semibold text-[11px] tracking-[2px] text-v2-text-tertiary`
- Amount: e.g., "1,245,680,000" — `font-sora font-extrabold text-[32px] tracking-[-1.5px] text-v2-text-primary`
- Currency badge: "VND" — small rounded badge
- Change badge: "+2.91% 30D" — green/red with trending icon

**Desktop version:**
- Net Worth Row: Left shows label + large amount (`font-sora font-bold text-[42px]`)
- Right shows 3 stat columns (Today / 7D / 30D) each with percentage + absolute amount
- Percentage: `font-ibm-mono font-bold` colored green (positive) / red (negative)
- Amount: `font-ibm-mono font-medium text-v2-text-secondary`

**Data sources:**
- `useQueryGetAggregatedPortfolioSummary({})` → `totalPnlPercent`, `totalPnl`, `totalValue`
- `useQueryListWallets({...})` → sum of wallet balances for cash
- Net worth = total cash + total portfolio value

**Step 2: Create PNLCard component**

This component shows:
- Card with V2 styling: `bg-white rounded-[20px] border border-v2-border-light shadow-v2-card`
- Title: "Tài sản ròng" + date
- Time period tabs: 7D / 30D / 90D — active tab: `bg-v2-red-primary text-white rounded-[10px]`
- 3 metric columns: today PNL / 7D PNL / 30D PNL
  - Value: `font-ibm-mono font-bold` + green/red coloring
  - Label: `font-ibm-mono font-medium text-[11px] text-v2-text-tertiary`
- Area chart: Gold gradient fill using Recharts `<AreaChart>` from existing LineChart component
  - Line color: `chart-v2.gold` (#B8860B)
  - Area fill: gradient from `#B8860B33` to transparent

**Data source:** `useQueryGetHistoricalPortfolioValues` hook with period parameter

**Step 3: Commit**
```
feat(v2): add NetWorthDisplay and PNLCard components
```

---

### Task 8: Gold Price Table Component

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/home/GoldPriceTable.tsx`

**Security notes:** None — read-only display from existing API.

**Step 1: Create GoldPriceTable component**

Design:
- Card with V2 styling (rounded-[20px], border, shadow)
- Header: "Giá Vàng Hôm Nay" + timestamp (`font-ibm-mono text-[11px]`)
- Table header row: `bg-v2-gold-light` background, `text-v2-gold-dark font-ibm-mono font-semibold text-[11px] tracking-[1px]`
  - Columns: LOẠI VÀNG / MUA / BÁN
- Table body: alternating `bg-white` / `bg-v2-bg-surface-tint` rows
  - Gold type name: `font-sora font-medium text-[13px]`
  - Prices: `font-ibm-mono font-medium text-[13px]`
- Data source: `useQueryGetMarketPrices({})` → `data?.gold`
- Reuse `formatPriceValue` from `dashboard/prices/helpers.ts`

**Step 2: Commit**
```
feat(v2): add GoldPriceTable component for home dashboard
```

---

### Task 9: Gold Price Chart Component

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/home/GoldPriceChart.tsx`

**Security notes:** None — display only.

**Step 1: Create GoldPriceChart component**

Design:
- Card with V2 styling
- Header: "Biểu Đồ Giá Vàng" + gold type selector dropdown
- Buy/Sell price legend with colored dots (buy: `v2-red-primary`, sell: `v2-green-positive`)
- Current buy/sell prices displayed in header
- Time period tabs: 24h / Tuần / Tháng / Năm
  - Active tab: `bg-v2-red-primary text-white rounded-[10px] py-1.5 px-4`
  - Inactive: `bg-v2-bg-surface-tint text-v2-text-secondary rounded-[10px] py-1.5 px-4`
- Chart area: Placeholder with "Sắp ra mắt" / "Coming soon" message
  - Styled container with `bg-v2-bg-surface-tint` and centered text
  - When historical API exists, replace with Recharts line chart (two series)

**Data source:** `useQueryGetMarketPrices({})` → `data?.gold` for current prices and type list

**Step 2: Commit**
```
feat(v2): add GoldPriceChart component with placeholder
```

---

### Task 10: Silver Price Table Component

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/home/SilverPriceTable.tsx`

**Security notes:** None.

**Step 1: Create SilverPriceTable component**

Same pattern as GoldPriceTable but with silver theme:
- Header bg: `bg-v2-silver-light`
- Header text: `text-v2-silver-dark`
- Title: "Giá Bạc Hôm Nay"
- Data source: `useQueryGetMarketPrices({})` → `data?.silver`

**Step 2: Commit**
```
feat(v2): add SilverPriceTable component for home dashboard
```

---

### Task 11: Silver Price Chart Component

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/home/SilverPriceChart.tsx`

**Security notes:** None.

**Step 1: Create SilverPriceChart component**

Same pattern as GoldPriceChart but with silver theme:
- Active tab: `bg-v2-silver-dark text-white`
- Buy line color: `chart-v2.silver` (#4B5563)
- Title: "Biểu Đồ Giá Bạc"
- Placeholder chart until historical API exists
- Data source: `useQueryGetMarketPrices({})` → `data?.silver`

**Step 2: Commit**
```
feat(v2): add SilverPriceChart component with placeholder
```

---

### Task 12: Wallets Section Component

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/home/WalletsSection.tsx`

**Security notes:** None — uses existing wallet API with auth.

**Step 1: Create WalletsSection component**

**Mobile version:**
- Section header: "Ví tiền" (`font-sora font-semibold`) + "Xem tất cả" link (`text-v2-red-primary font-sora font-medium` + chevron icon)
- Wallet cards: `rounded-2xl bg-white border border-v2-border-light shadow-v2-card`
  - Icon: wallet icon (basic) / chart icon (investment)
  - Name: `font-sora font-medium text-[14px]`
  - Balance: `font-ibm-mono font-semibold text-[14px]`

**Desktop version:**
- Compact card format: fixed width (340px) designed to sit alongside PNL chart
- Same wallet list but with `bg-v2-bg-primary` row backgrounds
- "Ví tiền" header + "Xem tất cả" link

**Data source:** `useQueryListWallets` hook

**Step 2: Commit**
```
feat(v2): add WalletsSection component for home dashboard
```

---

### Task 13: Home Page Assembly

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/page.tsx`

**Security notes:** None — composing existing components.

**Step 1: Rebuild home page layout**

Replace the current home page with the V2 layout. Keep existing components (Wallets, TotalBalance, etc.) importable but build new page structure.

**Mobile layout (vertical stack):**
```
1. Greeting + Net Worth section (NetWorthDisplay)
2. PNL Card
3. Gold Price Table
4. Gold Price Chart
5. Silver Price Table
6. Silver Price Chart
7. Wallets Section
```

**Desktop layout:**
```
Row 1: Net Worth full-width bar (label + amount left, 3 stat columns right)
Row 2: PNL Chart Card (flex-1) + Wallets Card (340px fixed)
Row 3: Gold Table (50%) + Gold Chart (50%)
Row 4: Silver Table (50%) + Silver Chart (50%)
```

Page background: `bg-v2-bg-primary`
Page padding: mobile `px-4 py-4`, desktop `px-8 py-6`
Bottom padding: `pb-24` on mobile (for bottom nav clearance)

**Step 2: Wire up all data fetching**

```typescript
const { data: marketPrices } = useQueryGetMarketPrices({}, { staleTime: 5 * 60 * 1000 });
const { data: portfolioSummary } = useQueryGetAggregatedPortfolioSummary({});
const { data: walletsData } = useQueryListWallets({ pagination: { page: 1, pageSize: 20, orderBy: "", order: "" } });
const { data: historicalData } = useQueryGetHistoricalPortfolioValues({ period: selectedPeriod });
```

**Step 3: Remove old desktop sidebar content**

Remove the current right-side desktop panel (User, TotalBalance, FunctionalButton) — this is replaced by the new layout.

Keep modals (add-transaction, transfer-money, create-wallet) functional.

**Step 4: Commit**
```
feat(v2): assemble V2 home dashboard with all new sections
```

---

### Task 14: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md`

**Step 1: Update L3 frontend component diagram**

Add new home page sub-components to the diagram:
- NetWorthDisplay
- PNLCard
- GoldPriceTable / SilverPriceTable
- GoldPriceChart / SilverPriceChart
- WalletsSection

Note that these are page-specific components co-located in `app/[locale]/dashboard/home/`, not shared components.

**Step 2: Commit**
```
docs(v2): update C4 frontend component diagram for V2 home page
```

---

### Task 15: Cleanup & Polish

**Files:**
- Various — based on visual review

**Step 1: Visual review**

Run the app locally (`task frontend:dev`) and verify:
- [ ] Color tokens render correctly on home page
- [ ] Fonts load without FOUT
- [ ] Sidebar matches V2 design (white bg, red accents)
- [ ] Mobile header has red accent line
- [ ] Bottom nav has red active state
- [ ] Net worth displays correctly
- [ ] Gold/silver tables render with correct theming
- [ ] Charts show placeholder state
- [ ] Wallets section links work
- [ ] All text uses i18n (no hardcoded strings)
- [ ] Responsive layout works at mobile (393px) and desktop (1440px)

**Step 2: Fix any visual issues found**

**Step 3: Ensure no regressions on other pages**

Verify that transaction, wallet, portfolio, budget, report, and prices pages still render correctly with the color system additions (we preserved existing colors, so they should be fine).

**Step 4: Final commit**
```
fix(v2): polish V2 home dashboard visual details
```

---

## Summary of All Files Changed

### Modified files:
| File | Task |
|------|------|
| `src/wj-client/tailwind.config.ts` | 1, 2 |
| `src/wj-client/app/globals.css` | 1, 2 |
| `src/wj-client/app/constants.tsx` | 1 |
| `src/wj-client/app/layout.tsx` | 1 |
| `src/wj-client/app/[locale]/layout.tsx` | 2 |
| `src/wj-client/messages/vi/ui.json` | 3 |
| `src/wj-client/messages/en/ui.json` | 3 |
| `src/wj-client/app/[locale]/dashboard/layout.tsx` | 4, 5, 6 |
| `src/wj-client/components/navigation/NavItem.tsx` | 4 |
| `src/wj-client/components/navigation/SidebarToggle.tsx` | 4 |
| `src/wj-client/components/navigation/BottomNav.tsx` | 6 |
| `src/wj-client/app/[locale]/dashboard/home/page.tsx` | 13 |
| `docs/architecture/c4-component-frontend.md` | 14 |

### New files:
| File | Task |
|------|------|
| `src/wj-client/app/[locale]/dashboard/home/NetWorthDisplay.tsx` | 7 |
| `src/wj-client/app/[locale]/dashboard/home/PNLCard.tsx` | 7 |
| `src/wj-client/app/[locale]/dashboard/home/GoldPriceTable.tsx` | 8 |
| `src/wj-client/app/[locale]/dashboard/home/GoldPriceChart.tsx` | 9 |
| `src/wj-client/app/[locale]/dashboard/home/SilverPriceTable.tsx` | 10 |
| `src/wj-client/app/[locale]/dashboard/home/SilverPriceChart.tsx` | 11 |
| `src/wj-client/app/[locale]/dashboard/home/WalletsSection.tsx` | 12 |

## Test Strategy

This is primarily a **visual migration** — the primary "tests" are visual verification:

1. **Visual regression:** Manual review at mobile (393px) and desktop (1440px) viewports
2. **i18n verification:** Switch between vi/en locales and verify all text renders correctly
3. **Data verification:** Confirm API data displays correctly (mock data if APIs unavailable locally)
4. **Responsive verification:** Test at sm (640px), md (768px), lg (1024px), xl (1280px) breakpoints
5. **Build verification:** `next build` succeeds without errors
6. **No regressions:** Other pages (transactions, wallets, portfolio, etc.) render correctly

**Build test command:**
```bash
cd src/wj-client && npx next build
```

## Risk Mitigation

1. **Preserving existing styles:** V2 colors added as `v2.*` tokens alongside existing colors — no existing pages break
2. **Font loading:** Using `next/font` with `display: "swap"` and preload — minimal FOUT risk
3. **Incremental migration:** Other pages continue using old color tokens until explicitly migrated
4. **Data fetching:** All hooks already exist and are cached — no new API load
