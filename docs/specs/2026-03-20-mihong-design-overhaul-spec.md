# Mi Hong Design Overhaul — Full App Redesign Specification

## Summary

Complete visual redesign of all WealthJourney pages to match the design language of [mihong.vn](https://www.mihong.vn/) — a traditional Vietnamese gold shop aesthetic featuring deep crimson/maroon backgrounds, gold accent colors, ornate decorative elements, and Roboto font. This is a **frontend-only** change affecting Tailwind config, global CSS, and every page/component's styling. No API, data model, or backend changes required. Dark mode toggle will be removed since the app becomes permanently dark-themed.

## User Stories

- As a user, I want the app to feel like a traditional Vietnamese gold shop (similar to mihong.vn), so that it matches the brand identity of congdongvang.com
- As a user, I want consistent dark maroon backgrounds with gold accents across all pages, so the visual experience is cohesive
- As a user, I want ornate decorative elements (gold borders, traditional Vietnamese embellishments), so the app feels premium and culturally authentic

## Functional Requirements

### FR-1: Color Palette Migration

Replace the current V2 Crimson & Gold palette with exact mihong.vn colors extracted from the live site.

**New color mapping:**

| Token | Current Value | New Value (mihong.vn) | Usage |
|-------|--------------|----------------------|-------|
| `bg-primary` | `#FAF9F7` (warm off-white) | `#5F0202` (deep maroon) | Page backgrounds |
| `bg-surface` | `#FFFFFF` | `#580202` (slightly lighter maroon) | Card/surface backgrounds |
| `bg-surface-tint` | `#FDF6EE` | `#5A0A0A` (maroon with slight tint) | Tinted surfaces |
| `bg-dark` | `#1C1917` | `#3A0101` (darkest maroon) | Footer, deepest surfaces |
| `border-light` | `#EDE8E1` | `rgba(155, 1, 17, 0.2)` | Subtle borders |
| `border` | `#DDD8D0` | `#9B0111` (red border) | Standard borders |
| `text-primary` | `#1C1917` (near black) | `#FFFFFF` (white) | Primary text on dark bg |
| `text-secondary` | `#57534E` | `#F1BD61` (gold) | Secondary text / labels |
| `text-tertiary` | `#78716C` | `#ADB5BD` (light gray) | Muted text |
| `text-on-dark` | `#FAF9F7` | `#FFFFFF` | Text on dark (stays same) |
| `red-primary` | `#B91C1C` | `#9B0111` (mihong red) | Primary brand color |
| `red-dark` | `#7F1D1D` | `#5F0202` (deep maroon) | Hover/pressed states |
| `red-light` | `#FEF2F2` | `rgba(155, 1, 17, 0.15)` | Red tint background |
| `gold-primary` | `#B8860B` | `#D78B1C` (mihong gold) | Gold accent |
| `gold-dark` | `#92710C` | `#B8860B` (darker gold) | Gold hover |
| `gold-light` | `#FBF3E0` | `#FDE68A` (bright gold) | Gold text/highlights |
| `gold-accent` | `#D4A017` | `#F1BD61` (light gold) | Gold labels/headings |
| `green-positive` | `#15803D` | `#4ADE80` (bright green) | Gains indicator |
| `green-light` | `#F0FDF4` | `rgba(74, 222, 128, 0.15)` | Green bg tint |

**Acceptance criteria:**
- [ ] `tailwind.config.ts` updated with new color tokens
- [ ] `globals.css` CSS variables updated
- [ ] All pages render with deep maroon backgrounds
- [ ] Gold text for headings and labels
- [ ] White text for body content
- [ ] Green/red indicators remain distinguishable on dark background

### FR-2: Font Migration to Roboto

Replace all current font families with Roboto to match mihong.vn.

**Font changes:**

| Role | Current Font | New Font |
|------|-------------|----------|
| Body text | Plus Jakarta Sans | Roboto (400, 500) |
| Headings | Be Vietnam Pro (600-800) | Roboto (700, 900) |
| Financial data | JetBrains Mono | Roboto Mono (for tabular numbers) |

**Acceptance criteria:**
- [ ] Remove `Plus_Jakarta_Sans` and `Be_Vietnam_Pro` from `next/font/google` imports
- [ ] Add `Roboto` and `Roboto_Mono` imports
- [ ] Update CSS variables `--font-jakarta-sans` → `--font-roboto`, `--font-vietnam-pro` → `--font-roboto`, `--font-jetbrains-mono` → `--font-roboto-mono`
- [ ] Update Tailwind `fontFamily` config
- [ ] Update all `v2-heading-*` and `v2-data-*` CSS utility classes
- [ ] Verify Vietnamese diacritics render correctly with Roboto (Roboto has Vietnamese subset)

### FR-3: Remove Dark Mode

Remove the dark mode toggle and all dark mode conditional styling. The app becomes permanently dark-themed (maroon).

**Acceptance criteria:**
- [ ] Remove `darkMode: "class"` from tailwind.config.ts (or set to a non-functional value)
- [ ] Remove theme toggle component and its state management
- [ ] Remove all `dark:` prefixed classes throughout the codebase (or keep them as no-ops)
- [ ] Remove `themeColor` media queries from root layout metadata
- [ ] Set single `themeColor` to `#5F0202` (maroon)
- [ ] Remove `dark.*` color tokens from Tailwind config (optional cleanup)

### FR-4: Ornate Decorative Elements

Add traditional Vietnamese-style ornamental decorations matching mihong.vn's visual language.

**Elements to add:**

1. **Gold border accents on cards** — Thin gold (`#D78B1C`) top/left borders or corner accents on BaseCard
2. **Section title dividers** — Ornamental gold lines with decorative endpoints (like mihong.vn's "GIA VANG HIEN TAI" header)
3. **Sidebar decorative accents** — Diagonal red stripe pattern or gold accent lines in the sidebar
4. **Table headers** — Gold text with decorative underlines
5. **Footer** — Dark maroon footer with gold text and decorative separator
6. **Page section separators** — Ornamental gold dividers between content sections
7. **Navigation active indicators** — Gold vertical bar or decorative gold accent for active nav items

**Implementation approach:** Create reusable CSS classes and/or small SVG components for decorative elements. Avoid inline images for decorations — use CSS gradients, borders, and pseudo-elements.

**Acceptance criteria:**
- [ ] Cards have gold border accents (top or left border in gold)
- [ ] Section headings have ornamental gold divider lines
- [ ] At least 3 different decorative elements matching mihong.vn's ornate style
- [ ] Decorations are implemented via CSS (not image assets) for performance
- [ ] Decorations don't interfere with interactive elements or accessibility

### FR-5: Landing Page Redesign

Restyle the landing page to match mihong.vn's homepage aesthetic.

**Changes:**
- Full dark maroon background
- Landing navbar: maroon bg with gold logo text, gold/white nav links
- Price tables: dark background with gold headers, white data text
- Charts: gold/red color scheme on dark background
- Footer: dark maroon with gold text, matching mihong.vn footer layout

**Acceptance criteria:**
- [ ] Landing page background is deep maroon (#5F0202)
- [ ] Navbar uses maroon background with gold text
- [ ] Price tables match mihong.vn's table styling
- [ ] Footer matches mihong.vn's footer color scheme

### FR-6: Auth Pages Redesign

Restyle login and register pages.

**Changes:**
- Full maroon background (replaces current gradient)
- Auth card: slightly lighter maroon surface with gold border accent
- Form inputs: dark background with gold/white text, gold focus ring
- Buttons: gold background with dark text (primary CTA), or maroon with gold border (secondary)
- Google OAuth button: styled to match the theme

**Acceptance criteria:**
- [ ] Auth pages have dark maroon backgrounds
- [ ] Form inputs have dark styling with gold accents
- [ ] Login/Register buttons use gold color scheme
- [ ] Error states still visible (red on dark background)

### FR-7: Dashboard Layout Redesign

Restyle sidebar, header, bottom nav, and content area.

**Sidebar:**
- Background: deep maroon (#5F0202)
- Active item: gold text + gold left border accent
- Inactive items: lighter gold/cream text
- Logo area: gold-tinted
- Collapsible behavior retained

**Top bar (desktop):**
- Maroon background with gold text
- Search box: dark input with gold border

**Mobile header:**
- Maroon background
- Gold accent line (replace red line at top)
- Gold hamburger icon

**Bottom nav (mobile):**
- Maroon background with gold icons
- Active: bright gold icon with gold dot indicator

**Content area:**
- Maroon background (#580202)
- Cards: slightly lighter maroon with gold border accents

**Acceptance criteria:**
- [ ] Sidebar has consistent maroon/gold theme
- [ ] Desktop top bar matches maroon/gold scheme
- [ ] Mobile header uses maroon/gold
- [ ] Bottom nav uses maroon background with gold icons
- [ ] Content area has maroon background with visible card separation

### FR-8: All Dashboard Sub-Pages

Apply the new theme to every dashboard page:

1. **Home** — Maroon bg, gold-accented summary cards, gold headings
2. **Transactions** — Dark table with gold headers, white data
3. **Wallets** — Maroon wallet cards with gold borders
4. **Portfolio** — Dark chart backgrounds, gold/red chart colors
5. **Budget** — Maroon progress bars with gold accents
6. **Report** — Dark tables with gold formatting
7. **Prices** — Match mihong.vn's gold price table styling exactly
8. **Community** — Dark background with gold headings
9. **Finance** — Maroon-themed financial overview
10. **Settings** — Dark forms with gold accents
11. **Feedback** — Maroon-themed feedback form
12. **Admin** — Dark admin panels with gold headers

**Acceptance criteria:**
- [ ] Every dashboard page uses the maroon/gold theme
- [ ] No page has white/light backgrounds
- [ ] All text is legible on dark backgrounds
- [ ] Charts use gold/red color schemes on dark backgrounds
- [ ] Financial data (numbers) uses Roboto Mono for tabular alignment

### FR-9: Component Library Updates

Update all shared components to the new theme:

| Component | Changes |
|-----------|---------|
| BaseCard | Maroon bg, gold top/left border accent, remove white bg |
| Button (primary) | Gold bg (#D78B1C) with dark text, or red bg (#9B0111) with white |
| Button (secondary) | Transparent with gold border and gold text |
| Button (ghost) | Transparent with gold/cream text |
| FormInput | Dark bg (#3A0101), gold border on focus, white text |
| FormSelect | Dark bg, gold border, white text |
| FormNumberInput | Same as FormInput |
| BaseModal | Maroon bg, gold header border, gold title text |
| ConfirmationDialog | Maroon bg with gold accents |
| MobileTable | Dark rows, gold headers, white text |
| LoadingSpinner | Gold colored spinner |
| EmptyState | Gold icon, white text on dark bg |
| ErrorState | Red icon, white text on dark bg |
| Toast | Maroon bg with gold border |
| Charts | Dark canvas, gold/red data colors |

**Acceptance criteria:**
- [ ] All shared components use the new theme
- [ ] Components remain accessible (contrast ratios for text)
- [ ] Interactive states (hover, focus, active) are visible on dark backgrounds
- [ ] Loading states use gold colors

## Non-Functional Requirements

- **Performance**: No new JavaScript bundles. Font change (Roboto) may slightly reduce bundle since it's a common Google Font. Decorative elements must use CSS, not image assets.
- **Accessibility**: WCAG AA contrast ratios must be maintained. Gold text (#D78B1C) on maroon (#5F0202) = ~4.5:1 contrast. White text on maroon = ~13:1 contrast. Both pass AA.
- **Browser support**: Same as current (modern browsers, iOS Safari, Chrome, Edge, Firefox)
- **Bundle size**: No new dependencies. Font swap is neutral. CSS changes don't affect bundle.

## Architecture Changes (C4)

### Diagrams to Update

- **c4-component-frontend.md**: No structural changes. May add a note about the design system migration to mihong.vn aesthetic.

### New Diagrams

None required — this is a visual-only change with no architectural impact.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — no business logic changes.

### New Flow Diagrams

None — simple CRUD/display with no new branching logic.

## Data Model Changes

None. This is a frontend-only visual redesign.

## API Changes

None. This is a frontend-only visual redesign.

## UI/UX Changes

### Summary

Complete visual overhaul of every page and component from the current "Crimson & Gold modern fintech" aesthetic to a "mihong.vn traditional Vietnamese gold shop" aesthetic. The change affects:

- Color palette (warm off-white → deep maroon backgrounds)
- Typography (Jakarta Sans + Be Vietnam Pro → Roboto + Roboto Mono)
- Decorative elements (clean/minimal → ornate gold accents)
- Dark mode (removed — app is permanently dark maroon)

### Existing Component Inventory (REQUIRED)

All existing components will be **restyled**, not replaced. No new structural components needed.

| Need | Existing Component | Location |
|------|-------------------|----------|
| Page backgrounds | globals.css + tailwind.config.ts | `app/globals.css`, `tailwind.config.ts` |
| Card styling | BaseCard | `components/BaseCard.tsx` |
| Button styling | Button | `components/Button.tsx` |
| Form inputs | FormInput, FormSelect, FormNumberInput | `components/forms/` |
| Navigation | NavItem, SidebarToggle, BottomNav | `components/navigation/`, `components/BottomNav.tsx` |
| Modals | BaseModal, ConfirmationDialog | `components/modals/` |
| Tables | MobileTable, TanStackTable | `components/table/` |
| Charts | BarChart, LineChart, DonutChart | `components/charts/` |
| Loading | LoadingSpinner, Skeleton | `components/loading/` |
| Feedback | EmptyState, ErrorState, Toast | `components/feedback/` |
| Landing | LandingNavbar, LandingFooter | `components/landing/` |
| Auth layout | Auth layout.tsx | `app/[locale]/auth/layout.tsx` |
| Dashboard layout | Dashboard layout.tsx | `app/[locale]/dashboard/layout.tsx` |

### New Components (if any)

| Component | Location | Justification |
|-----------|----------|---------------|
| OrnateHeading | `components/decorative/OrnateHeading.tsx` | Reusable section heading with gold ornamental divider lines (mihong.vn style). Not achievable with existing components. |
| OrnateDivider | `components/decorative/OrnateDivider.tsx` | Gold ornamental horizontal divider. Used across many pages for section separation. |
| GoldBorderCard | `components/decorative/GoldBorderCard.tsx` | Extension of BaseCard with gold corner accents or border decorations. Could also be a variant prop on BaseCard instead. |

## Security & Risk Assessment

### Data Flow Diagram

This is a **frontend-only visual change**. No new data flows are introduced.

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Google Fonts CDN | Roboto font files | Yes: External CDN → Browser | User's browser | Standard font loading |
| 2 | User (browser) | CSS/style rendering | No | User's browser | Client-side only |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|------------------|
| Google Fonts CDN → Browser | Font file download | Subresource integrity (if self-hosting), CSP font-src directive |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | CDN → Browser | Tampering | Malicious font file served | Low | Use `next/font/google` which self-hosts fonts at build time (eliminates CDN dependency at runtime) |
| T-2 | 2 | N/A | Info Disclosure | Theme/styling could leak version info | Very Low | No version info in CSS |

### Authorization Rules

No changes — this is a visual-only redesign.

### Input Validation Rules

No new user inputs introduced.

### External Dependency Risks

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Google Fonts (Roboto) | Font unavailable at build time | `next/font/google` downloads at build; fallback to system-ui |
| No new npm packages | N/A | N/A |

### Sensitive Data Handling

No changes to data handling.

### Issues & Risks Summary

1. **Contrast ratio risk** — Gold text on dark maroon may not meet WCAG AA for small text sizes. Must verify with contrast checker. Mitigation: use white text for body, gold only for headings (larger text has lower contrast requirement).
2. **Readability regression** — Full dark background with ornate decorations could reduce readability of financial data. Mitigation: ensure Roboto Mono for numbers with sufficient contrast, test with real data.
3. **Large scope** — Touching every page and component increases risk of visual regressions. Mitigation: implement in phases (config → shared components → pages), visual review at each phase.
4. **Mobile legibility** — Small gold text on mobile screens could be hard to read. Mitigation: use white for body text on mobile, gold only for headings/labels.

## Edge Cases & Error Handling

- **Error states** — Red error text on dark maroon background needs sufficient contrast. Use bright red (`#F87171`) instead of dark red.
- **Empty states** — EmptyState and ErrorState components need gold/white text on dark backgrounds.
- **Loading states** — Skeleton shimmer needs to work on dark backgrounds (light-on-dark shimmer).
- **Toast notifications** — Must be visible on dark background (use gold border + maroon bg).
- **Charts** — All chart colors must be visible on dark canvas (avoid dark chart colors).
- **Form validation errors** — Error messages need bright red or gold accent to be visible.

## Dependencies & Assumptions

- **Roboto font** includes Vietnamese character subset (confirmed — Google Fonts serves `latin-ext` and `vietnamese` subsets)
- **next/font/google** will self-host Roboto at build time (same as current font strategy)
- **No new npm packages** required
- **Tailwind CSS** supports all needed utilities (confirmed — no Tailwind plugins needed)
- **CSS custom properties** approach (current architecture) supports the migration

## Out of Scope

- Backend changes (API, database, business logic)
- New features or functionality
- Mobile app (PWA) icon/splash screen redesign
- Logo redesign
- Content/copy changes
- Animation/motion overhaul (keep existing animations, just restyle colors)
- Internationalization changes
- SEO changes
