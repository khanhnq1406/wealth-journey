# V2 Design Migration — Color System & Home Page Specification

## Summary

Migrate the WealthJourney frontend from the current green-based (#008148) fintech theme to the V2 "Crimson & Gold" design system, and rebuild the home dashboard to match the V2 mockups in `design/pencil/design-v2/home.pen` and `design/pencil/design-v2/color-pattern.pen`. This is a full visual redesign covering: color palette, typography (Sora + IBM Plex Mono), home page layout (mobile + desktop), sidebar navigation, and new content sections (gold/silver price tables, PNL card, net worth display). All text uses the existing `next-intl` i18n system. New sections pull real data from existing APIs.

## User Stories

- As a user, I want the app to use a warm Crimson & Gold color scheme so the interface feels premium and culturally aligned
- As a user, I want to see my total net worth, PNL metrics (today/7D/30D), gold prices, silver prices, and wallet summary all on the home dashboard
- As a user, I want the home page to be fully responsive — a card-based vertical layout on mobile and a sidebar + two-column content area on desktop
- As a user, I want all UI text to respect my language preference (Vietnamese/English) via the existing i18n system

## Functional Requirements

### FR-1: Color System Migration

Migrate Tailwind CSS theme and CSS variables from green-based to Crimson & Gold palette.

**Color token mapping (from color-pattern.pen):**

| Token | Current (Green) | V2 (Crimson & Gold) | Usage |
|-------|----------------|---------------------|-------|
| bg-primary | #F7F8FC / various | #FAF9F7 | Page background |
| bg-surface | white | #FFFFFF | Card backgrounds |
| bg-surface-tint | — | #FDF6EE | Alternating table rows, subtle tints |
| bg-dark | — | #1C1917 | Dark backgrounds |
| border-light | — | #EDE8E1 | Subtle borders |
| border | various | #DDD8D0 | Standard borders |
| text-primary | neutral-900 | #1C1917 | Headings, primary text |
| text-secondary | neutral-600 | #57534E | Body text, descriptions |
| text-tertiary | neutral-500 | #78716C | Labels, hints, timestamps |
| text-on-dark | — | #FAF9F7 | Text on dark backgrounds |
| red-primary | — | #B91C1C | Active nav, CTAs, accent |
| red-dark | — | #7F1D1D | Hover on red elements |
| red-light | — | #FEF2F2 | Active nav background |
| red-negative | danger-600 | #DC2626 | Loss/expense indicators |
| gold-primary | — | #B8860B | Charts, price tags, data highlights |
| gold-dark | — | #92710C | Table headers, gold emphasis |
| gold-light | — | #FBF3E0 | Gold table header background |
| gold-accent | — | #D4A017 | Gold accent color |
| green-positive | success-600 | #15803D | Gain/profit indicators |
| green-light | — | #F0FDF4 | Positive badge background |
| chart-gold | — | #B8860B | Gold chart line |
| chart-red | — | #B91C1C | Red chart line |
| chart-gold-area | — | #B8860B33 | Chart area fill (20% opacity) |
| silver-primary | — | #8B929E | Silver branding |
| silver-dark | — | #374151 | Silver table headers |
| silver-light | — | #EEF0F3 | Silver table header background |
| chart-silver | — | #4B5563 | Silver chart line |

**Acceptance criteria:**
- [ ] `tailwind.config.ts` updated with V2 color palette
- [ ] `globals.css` CSS variables updated to match V2 tokens
- [ ] All existing components render correctly with new colors (no broken references)
- [ ] Dark mode tokens preserved (separate task for V2 dark mode)
- [ ] Red gradient: `#B91C1C → #991B1B` available for accent elements

### FR-2: Typography Migration

Replace current font system with Sora (headings/labels) + IBM Plex Mono (data/metrics).

**Typography system (from color-pattern.pen):**

| Font | Weights | Usage |
|------|---------|-------|
| Sora 800 | Extra Bold | Net worth hero number |
| Sora 700 | Bold | Brand/logo, page titles |
| Sora 600 | Semi Bold | Section titles, card headers |
| Sora 500 | Medium | Card labels, nav items |
| Sora 400 | Regular | Body text |
| IBM Plex Mono 700 | Bold | PNL values (green/red) |
| IBM Plex Mono 600 | Semi Bold | Amounts, labels, table headers |
| IBM Plex Mono 500 | Medium | Table data |
| IBM Plex Mono 400 | Regular | Timestamps, hints |

**Acceptance criteria:**
- [ ] Sora and IBM Plex Mono loaded via `next/font/google`
- [ ] Tailwind font family utilities configured (`font-sora`, `font-mono` for IBM Plex Mono)
- [ ] Existing `Plus Jakarta Sans` / `Inter` references replaced
- [ ] Letter spacing: Sora headings use -0.5 to -1.5px; IBM Plex Mono labels use 0.5-2px tracking

### FR-3: Desktop Sidebar Navigation

Replace the current green gradient sidebar with V2 white sidebar design.

**V2 Sidebar (260px fixed width):**
- White background (`bg-surface`) with right border (`border-light`)
- Logo: Red "W" mark (38x38, `red-primary` background, cornerRadius 10) + "WealthJourney" text (Sora 700, 19px)
- Nav items (7 items + settings):
  - Trang chủ (Home) — lucide `house` icon
  - Giao dịch (Transactions) — lucide `arrow-left-right`
  - Ví tiền (Wallets) — lucide `wallet`
  - Danh mục đầu tư (Portfolio) — lucide `chart-no-axes-combined`
  - Ngân sách (Budget) — lucide `calculator`
  - Báo cáo (Report) — lucide `chart-pie`
  - Giá cả (Prices) — lucide `circle-dollar-sign`
  - Cài đặt (Settings) — lucide `settings` (bottom section, separated by spacer + divider)
- Active state: `red-primary` text + `red-light` background, cornerRadius 12
- Inactive state: `text-secondary`, no background
- User row at bottom: Avatar (32x32) + name (Sora 500, 13px) + email (IBM Plex Mono, 11px)
- Full height, padding: 24px top, 0 horizontal

**Acceptance criteria:**
- [ ] Sidebar renders at 260px width on desktop (lg breakpoint)
- [ ] Active route highlighted with red accent
- [ ] All nav items use i18n keys from `nav` namespace
- [ ] User info displays from auth state
- [ ] Prices route added to navigation

### FR-4: Desktop Top Bar

Replace current top bar with V2 design.

**V2 Top Bar (68px height):**
- Left: Greeting text (Sora 600, 18px) + date (IBM Plex Mono 12px)
- Right: Search box (240px, `bg-primary` fill, `border` stroke, cornerRadius 12) + bell icon (lucide `bell`)
- Bottom border: `border-light`

**Acceptance criteria:**
- [ ] Greeting uses time-of-day logic (morning/afternoon/evening) via i18n
- [ ] Date formatted per locale
- [ ] Search box is a placeholder/link (not a full search implementation)

### FR-5: Mobile Header & Status Bar

**V2 Mobile Header:**
- Red accent line at top (3px, `red-primary`, full width)
- Header row (56px): Logo area (red "W" mark + "WealthJourney" text) + action icons (bell + settings)
- Clean white/warm ivory background

**Acceptance criteria:**
- [ ] Red accent line visible at page top
- [ ] Logo matches desktop sidebar logo
- [ ] Bell and settings icons are functional navigation links

### FR-6: Net Worth & PNL Display

**Mobile version:**
- Greeting section: "Chào buổi sáng, [Name]" + "TỔNG TÀI SẢN RÒNG" label + amount (Sora 800, 32px) + currency badge + change badge (green/red with trending icon)
- PNL Card: Title + date + 3 time-period tabs (7D/30D/90D with red-primary active) + 3 metric columns (today PNL / 7D PNL / 30D PNL) + area chart with gold gradient fill

**Desktop version:**
- Net Worth Row: Left side shows label + large amount (Sora 700, 42px) + currency. Right side shows 3 stat columns (Hôm nay / 7 Ngày / 30 Ngày) with percentage + absolute amount
- PNL Chart Card: Full-width chart with title + time-period selector + area chart

**Data sources:**
- Net worth: Sum of all wallet balances + portfolio value from `useQueryGetAggregatedPortfolioSummary`
- PNL metrics: From portfolio summary `totalPnlPercent` and `totalPnl`
- Chart: From `usePortfolioHistoricalValues` hook (30D default)

**Acceptance criteria:**
- [ ] Net worth aggregates cash (wallets) + investments (portfolio summary)
- [ ] PNL percentages colored green (positive) / red (negative) dynamically
- [ ] Area chart uses gold gradient fill (`chart-gold` → transparent)
- [ ] Time period tabs switch chart data range
- [ ] Currency formatted per user preference

### FR-7: Gold Price Table

**Mobile version:**
- Card with header: "Giá Vàng Hôm Nay" + timestamp
- Table: Gold-themed header row (`gold-light` bg, `gold-dark` text) with columns: LOẠI VÀNG / MUA / BÁN
- Alternating row backgrounds: white / `bg-surface-tint`
- Data rows showing gold types with buy/sell prices

**Desktop version:**
- Same table structure in a card within the "Gold Section" two-column layout (table left, chart right)
- Wider table with more padding

**Data source:** `useQueryGetMarketPrices()` → `data.gold` array of `PriceItem`

**Acceptance criteria:**
- [ ] Gold prices fetched from existing market prices API
- [ ] Prices formatted correctly (VND format with thousands separator)
- [ ] Table uses gold-themed styling (gold header background, gold-dark header text)
- [ ] Alternating row colors
- [ ] Timestamp shows last update time
- [ ] Column headers use i18n keys

### FR-8: Gold Price Chart

**Both mobile and desktop:**
- Card with header: "Biểu Đồ Giá Vàng" + gold type selector dropdown
- Buy/Sell price legend with colored dots
- Line chart with two series (buy line: `red-primary`, sell line: `green-positive`)
- Time period tabs: 24h / Tuần / Tháng / Năm (active tab uses `red-primary` pill)
- Y-axis labels, X-axis date labels, grid lines

**Note:** Gold historical price chart data is NOT currently available from the backend. The backend only provides current snapshot prices via `GetMarketPrices`. Historical gold/silver price data would require a new API endpoint. For now, this section should render the chart container with the current buy/sell price displayed, and show a placeholder/empty state for the chart itself with a note "Coming soon" or similar.

**Acceptance criteria:**
- [ ] Chart card renders with proper gold-themed styling
- [ ] Current buy/sell prices displayed in header
- [ ] Gold type selector allows switching between gold types
- [ ] Time tabs render but chart shows placeholder until historical API exists
- [ ] Tab styling matches design (active: red-primary pill, inactive: bg-surface-tint)

### FR-9: Silver Price Table

Same pattern as FR-7 but with silver theme:
- Silver header: `silver-light` bg, `silver-dark` text
- Title: "Giá Bạc Hôm Nay"
- Data source: `useQueryGetMarketPrices()` → `data.silver`

**Acceptance criteria:**
- [ ] Silver prices displayed with correct silver-themed styling
- [ ] Same alternating row pattern as gold table

### FR-10: Silver Price Chart

Same pattern as FR-8 but with silver theme:
- Buy line: `chart-silver`, active tab: `silver-dark` pill
- Same historical data limitation applies — placeholder chart

**Acceptance criteria:**
- [ ] Chart card renders with silver-themed styling
- [ ] Current buy/sell prices displayed
- [ ] Silver type selector works
- [ ] Placeholder chart until historical API exists

### FR-11: Wallets Section

**Mobile version:**
- Section header: "Ví tiền" + "Xem tất cả" link (red-primary text + chevron icon)
- Wallet cards: Rounded (cornerRadius 16), white bg, subtle shadow, showing icon + name + balance
- Two wallet types shown: Cash wallet (wallet icon) + Investment wallet (chart icon)

**Desktop version:**
- Wallets Card (340px fixed width) in the top row alongside PNL Chart
- Same wallet list but in compact card format with `bg-primary` row backgrounds

**Data source:** `useQueryListWallets` hook

**Acceptance criteria:**
- [ ] Wallets fetched from existing API
- [ ] "See all" navigates to `/dashboard/wallets`
- [ ] Wallet balance formatted per currency
- [ ] Wallet type icons differentiate basic vs investment wallets

### FR-12: Mobile Bottom Navigation

**V2 Bottom Nav:**
- White background (`bg-surface`) with top border (`border-light`)
- 5 nav items in a pill-shaped row
- Active item: `red-primary` icon/text
- Inactive: `text-tertiary`
- Height: 82px (includes safe area padding)

**Acceptance criteria:**
- [ ] Bottom nav matches V2 styling (white bg, red active state)
- [ ] Same routes as current bottom nav
- [ ] Safe area padding preserved for notched devices

### FR-13: i18n Translation Keys

New translation keys needed for V2 home page content. Add to appropriate namespaces.

**New keys for `ui.json` (dashboard section):**

| Key | Vietnamese | English |
|-----|-----------|---------|
| `dashboard.home.greeting.morning` | Chào buổi sáng | Good morning |
| `dashboard.home.greeting.afternoon` | Chào buổi chiều | Good afternoon |
| `dashboard.home.greeting.evening` | Chào buổi tối | Good evening |
| `dashboard.home.totalNetWorthLabel` | TỔNG TÀI SẢN RÒNG | TOTAL NET WORTH |
| `dashboard.home.pnlTitle` | Tài sản ròng | Net worth |
| `dashboard.home.pnlToday` | L/L HÔM NAY | P/L TODAY |
| `dashboard.home.pnl7d` | L/L 7 NGÀY | P/L 7 DAYS |
| `dashboard.home.pnl30d` | L/L 30 NGÀY | P/L 30 DAYS |
| `dashboard.home.today` | Hôm nay | Today |
| `dashboard.home.7days` | 7 Ngày | 7 Days |
| `dashboard.home.30days` | 30 Ngày | 30 Days |
| `dashboard.home.goldPriceTitle` | Giá Vàng Hôm Nay | Gold Prices Today |
| `dashboard.home.silverPriceTitle` | Giá Bạc Hôm Nay | Silver Prices Today |
| `dashboard.home.goldChartTitle` | Biểu Đồ Giá Vàng | Gold Price Chart |
| `dashboard.home.silverChartTitle` | Biểu Đồ Giá Bạc | Silver Price Chart |
| `dashboard.home.wallets` | Ví tiền | Wallets |
| `dashboard.home.seeAll` | Xem tất cả | See all |
| `dashboard.home.updated` | Cập nhật {time} | Updated {time} |
| `dashboard.home.goldType` | LOẠI VÀNG | GOLD TYPE |
| `dashboard.home.silverType` | LOẠI BẠC | SILVER TYPE |
| `dashboard.home.buy` | MUA | BUY |
| `dashboard.home.sell` | BÁN | SELL |
| `dashboard.home.period.24h` | 24h | 24h |
| `dashboard.home.period.week` | Tuần | Week |
| `dashboard.home.period.month` | Tháng | Month |
| `dashboard.home.period.year` | Năm | Year |
| `dashboard.home.comingSoon` | Sắp ra mắt | Coming soon |
| `dashboard.home.period.30d` | 30D | 30D |

**Update existing keys if needed** — check current `ui.json` and `investment.json` for overlapping keys to avoid duplication.

**Acceptance criteria:**
- [ ] All visible text on home page uses i18n keys
- [ ] Both `vi` and `en` translation files updated
- [ ] No hardcoded Vietnamese/English text in components

## Non-Functional Requirements

- **Performance:** New home page should load within 2 seconds. Gold/silver price data is cached (5min stale time). Use React Query's existing caching.
- **Responsive:** Mobile-first. Desktop breakpoint at `lg` (1024px). Current `sm` (800px) breakpoint preserved for intermediate sizes.
- **Accessibility:** Color contrast ratios must meet WCAG 2.1 AA. All interactive elements keyboard-navigable. Proper ARIA labels on price tables.
- **Bundle size:** Sora + IBM Plex Mono fonts loaded via `next/font` with subset optimization to minimize bundle impact.

## Architecture Changes (C4)

### Diagrams to Update

1. **`c4-component-frontend.md`** (L3):
   - Update Home page component to reflect new sections: NetWorthDisplay, PNLCard, GoldPriceTable, SilverPriceTable, GoldChart, SilverChart, WalletsSection
   - Add note about shared price table/chart components potentially used by both home and prices pages

### New Diagrams
No new L4 diagrams needed — this is primarily a frontend visual migration, not a new domain.

## Runtime Flow Diagrams

### Flow Diagrams to Update
No flow diagram updates needed — this feature uses existing API endpoints without new backend logic.

### New Flow Diagrams
None needed.

## Data Model Changes

No database changes. All data comes from existing APIs:
- Wallet list: `GET /api/v1/wallets`
- Portfolio summary: `GET /api/v1/investments/portfolio-summary` (aggregated)
- Market prices: `GET /api/v1/investments/market-prices`
- Historical portfolio: `GET /api/v1/investments/historical-portfolio-values`

## API Changes

No backend API changes needed. All required data is available through existing endpoints.

**Future API needed (out of scope):** Historical gold/silver price data endpoint for price charts. Currently only snapshot prices are available.

## UI/UX Changes

### Mobile Layout (393px reference width)

```
┌─────────────────────────────────┐
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ │ ← 3px red accent line
│ [W] WealthJourney    🔔 ⚙️      │ ← Header (56px)
├─────────────────────────────────┤
│ Chào buổi sáng, Khanh          │
│ TỔNG TÀI SẢN RÒNG              │
│ 1,245,680,000 VND               │
│ [↑ +2.91% 30D]                  │ ← Green badge
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Tài sản ròng    [7D][30D]  │ │ ← PNL Card
│ │ +0.91%  +8.95%  +2.91%     │ │
│ │ ~~~~ area chart ~~~~       │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Giá Vàng Hôm Nay           │ │ ← Gold Table
│ │ LOẠI VÀNG | MUA | BÁN      │ │
│ │ SJC 1L... | 95M | 95.5M    │ │
│ │ ...                        │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Biểu Đồ Giá Vàng          │ │ ← Gold Chart
│ │ ~~~~ line chart ~~~~       │ │
│ │ [24h][Tuần][Tháng][Năm]    │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Giá Bạc Hôm Nay            │ │ ← Silver Table
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Biểu Đồ Giá Bạc           │ │ ← Silver Chart
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ Ví tiền              Xem tất cả│
│ ┌─ Ví Tiền Mặt ─── 45,680,000┐│
│ ┌─ Ví Đầu Tư ── 1,200,000,000┐│
├─────────────────────────────────┤
│ 🏠  📊  💰  📈  📋             │ ← Bottom Nav
└─────────────────────────────────┘
```

### Desktop Layout (1440px reference width)

```
┌──────────┬──────────────────────────────────────────────┐
│ Sidebar  │ Top Bar: Greeting + Search + Bell            │
│ (260px)  ├──────────────────────────────────────────────┤
│          │                                              │
│ [W] Logo │ TỔNG TÀI SẢN RÒNG     +0.91%  +8.95% +2.91%│
│          │ 1,245,680,000 VND      Today   7D     30D   │
│ 🏠 Home  │                                              │
│ ↔ Txn    │ ┌─── PNL Chart Card ────────┐ ┌─ Wallets ─┐│
│ 💰 Wallet│ │  Tài sản ròng            │ │ Ví tiền    ││
│ 📈 Portf │ │  ~~~ area chart ~~~      │ │ Cash: 45M  ││
│ 🧮 Budget│ │                          │ │ Invest: 1.2B│
│ 📊 Report│ └──────────────────────────┘ └────────────┘│
│ 💲 Prices│                                              │
│          │ ┌─── Gold Table ───────────┐ ┌─ Gold Chart─┐│
│ ⚙ Settings│ │ LOẠI VÀNG | MUA | BÁN  │ │ ~~chart~~  ││
│ ─────────│ │ SJC 1L..  | 95M | 95.5M │ │ [24h][W][M]││
│ 👤 User  │ └─────────────────────────┘ └────────────┘│
│          │                                              │
│          │ ┌─── Silver Table ─────────┐ ┌─Silver Chart┐│
│          │ │ LOẠI BẠC | MUA | BÁN    │ │ ~~chart~~  ││
│          │ └─────────────────────────┘ └────────────┘│
└──────────┴──────────────────────────────────────────────┘
```

### Design system details from mockups:

- **Card styling:** cornerRadius 20, `bg-surface` fill, `border-light` 1px stroke, shadow: `blur:12, color:#0000000C, offset:0,2`
- **Table header styling:** Gold tables use `gold-light` bg with `gold-dark` text; Silver uses `silver-light` bg with `silver-dark` text
- **Active tab styling:** `red-primary` fill for gold charts; `silver-dark` fill for silver charts; both with white text, cornerRadius 10, padding 6-7px vertical / 16-18px horizontal
- **Font specifics:** IBM Plex Mono with letter-spacing 0.5-2px for labels; Sora with -0.3 to -1.5px letter-spacing for headings

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Backend API | Market prices (gold/silver) | Yes: Server → Client | Home page components | Read-only, cached |
| 2 | Backend API | Portfolio summary | Yes: Server → Client | Net worth display | Contains user financial data |
| 3 | Backend API | Wallet list + balances | Yes: Server → Client | Wallets section | Contains user financial data |
| 4 | Backend API | Historical portfolio values | Yes: Server → Client | PNL chart | Contains user financial data |
| 5 | Auth state | User name/email | No (client-side) | Greeting & sidebar | From Redux store |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Server → Client | API responses | JWT authentication, HTTPS |
| Client rendering | User financial data | No sensitive data in HTML meta/title |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 2,3 | Server → Client | Information Disclosure | Financial data exposed in network tab | Low | Already mitigated: HTTPS + JWT. No change needed. |
| T-2 | 1 | Server → Client | Spoofing | Fake market price data | Low | Backend validates from trusted sources (vang.today, Yahoo). No change needed. |
| T-3 | All | Client rendering | Tampering | XSS via rendered text | Low | React auto-escapes. Price data is numeric. Gold type names from backend. |

### Authorization Rules
No changes — all existing API endpoints already verify user ownership.

### Input Validation Rules
No new user inputs introduced (this is a read-only dashboard redesign). Gold/silver type selector uses hardcoded option list from API response.

### External Dependency Risks
- **Sora font (Google Fonts):** Low risk. Loaded via `next/font` which self-hosts. No runtime dependency.
- **IBM Plex Mono (Google Fonts):** Same as above.
- **lucide-react icons:** Already in use. No new dependency.

### Sensitive Data Handling
- Financial amounts displayed on screen — no change from current behavior
- No new data storage or transmission patterns introduced

### Issues & Risks Summary
1. **Low risk:** Large CSS/Tailwind config change may break existing pages if color tokens are renamed without updating all references. Mitigation: Use search-and-replace with verification.
2. **Low risk:** Font loading may cause FOUT (Flash of Unstyled Text). Mitigation: Use `next/font` with `display: swap` and optional font preloading.
3. **Medium risk:** Home page data loading — 4 parallel API calls on mount could cause waterfall on slow connections. Mitigation: Use React Query's parallel fetching, add skeleton loading states.

## Edge Cases & Error Handling

1. **No wallets:** Show empty state with "Create your first wallet" CTA
2. **No portfolio/investments:** Net worth shows only cash balance; PNL section shows zero with neutral styling
3. **Market prices API failure:** Show "Unable to load prices" with retry button; use cached data if available
4. **Historical data empty:** Chart shows empty state / placeholder
5. **New user (no data):** All sections show appropriate empty states
6. **Currency mismatch:** Portfolio summary already handles display currency conversion
7. **Very large numbers:** VND amounts can be 10+ digits — ensure no overflow in layout

## Dependencies & Assumptions

- All required API endpoints exist and are functional
- `next-intl` i18n system is properly configured (confirmed)
- `lucide-react` icon library is available (confirmed — already used)
- React Query is configured for data fetching (confirmed)
- Historical gold/silver price API does NOT exist — charts will show placeholder

## Out of Scope

- Dark mode for V2 color system (separate task)
- Historical gold/silver price API endpoint (backend work)
- Gold/silver price chart with real historical data (depends on API)
- Migrating other pages (transactions, wallets, portfolio, etc.) to V2 design
- V2 design for auth/login pages
- Mobile slide-out menu redesign (follows sidebar pattern but separate task)
- Search functionality in the top bar (placeholder only)
- Real-time price WebSocket updates
