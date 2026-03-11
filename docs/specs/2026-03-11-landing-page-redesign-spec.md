# Landing Page Redesign - Gold/Silver Price Teaser

## Summary

Replace the current feature-rich landing page with a clean, minimal design that showcases the gold/silver price tables and charts as the primary content. The tables display real gold/silver type names fetched from a new public backend endpoint, but price values (Buy/Sell cells) are replaced with "Vui lòng **đăng nhập** để xem giá" login links. Charts show the same card shell as the dashboard (with market toggles and period tabs all disabled/grayed out) but the chart area only renders X/Y axes with a centered login button. After login, users are redirected to the dashboard as normal.

## User Stories

- As a visitor, I want to see what gold/silver types are tracked so I understand the app's value before signing up.
- As a visitor, I want to click "đăng nhập" in the price cells to be redirected to the login page.
- As a visitor, I want to see the chart structure so I understand what data is available after login.
- As a returning user who is not logged in, I want to quickly access the login page from the landing page.

## Functional Requirements

### FR-1: New Public API Endpoint — Gold/Silver Type Names

Create a public (no auth) endpoint that returns gold and silver type names without prices.

**Endpoint:** `GET /api/v1/public/market-types`

**Response:**
```json
{
  "success": true,
  "message": "Market types retrieved successfully",
  "gold": [
    { "code": "SJC", "name": "SJC 9999", "currency": "VND" },
    { "code": "XAUUSD", "name": "Gold World (XAU/USD)", "currency": "USD" }
  ],
  "silver": [
    { "code": "GOLDENFUND_1L", "name": "Golden Fund 1 Lượng", "currency": "VND" },
    { "code": "XAGUSD", "name": "Silver World (XAG/USD)", "currency": "USD" }
  ],
  "timestamp": "2026-03-11T12:00:00+07:00"
}
```

**Acceptance criteria:**
- [ ] Endpoint does NOT require authentication (no auth middleware)
- [ ] Returns gold types from `pkg/gold.GoldTypes` registry (code, name, currency only — no prices)
- [ ] Returns silver types from `pkg/silver.SilverTypes` registry (code, name, currency only — no prices)
- [ ] Rate limited to prevent abuse (use general rate limiter, not per-user)
- [ ] Response format matches proto-generated TypeScript types

### FR-2: Landing Page — Navbar (Keep Existing)

Keep the current `LandingNavbar` component. It already handles:
- Auth-aware buttons (Dashboard if authenticated, Sign In / Get Started if not)
- Mobile hamburger menu
- Responsive layout

**Acceptance criteria:**
- [ ] Navbar unchanged from current implementation
- [ ] Login/Register links work correctly

### FR-3: Landing Page — Gold Price Table with Login Links

Display a table showing all gold type names from the public endpoint with login links in Buy/Sell cells.

**Table structure:**

| Column | Content |
|--------|---------|
| Gold Type | Type name from API (e.g., "SJC 9999", "DOJI") |
| Buy (MUA) | "Vui lòng **đăng nhập** để xem giá" — "đăng nhập" is a link to `/auth/login` |
| Sell (BÁN) | "Vui lòng **đăng nhập** để xem giá" — "đăng nhập" is a link to `/auth/login` |

**Acceptance criteria:**
- [ ] Table fetches gold types from `GET /api/v1/public/market-types`
- [ ] Each row shows the gold type name in the first column
- [ ] Buy and Sell cells show text "Vui lòng " + clickable link "đăng nhập" + " để xem giá"
- [ ] "đăng nhập" link navigates to `/auth/login`
- [ ] Table uses the same gold color theme as dashboard (`bg-v2-gold-light`, `text-v2-gold-dark` for header)
- [ ] Loading state shown while fetching types
- [ ] Mobile-responsive (stacked on mobile, side-by-side with chart on desktop)

### FR-4: Landing Page — Silver Price Table with Login Links

Same pattern as gold table but with silver types and silver color theme.

**Acceptance criteria:**
- [ ] Table fetches silver types from the same `GET /api/v1/public/market-types` endpoint
- [ ] Same login link pattern in Buy/Sell cells
- [ ] Uses silver color theme (`bg-v2-silver-light`, `text-v2-silver-dark` for header)
- [ ] Mobile-responsive

### FR-5: Landing Page — Gold Chart Shell (Disabled)

Display the gold chart card with the same shell structure as `GoldPriceChart` from the dashboard but:
- Market toggle buttons (domestic/global) are visible but grayed out / disabled
- Gold code selector (SJC/999) is visible but grayed out / disabled
- Period tabs (24h, week, month, year) are visible but grayed out / disabled
- Chart area shows only X and Y axis lines (no data)
- Centered login button in the chart area: "Đăng nhập để xem biểu đồ" linking to `/auth/login`

**Acceptance criteria:**
- [ ] Card structure matches dashboard GoldPriceChart (title, controls, chart area)
- [ ] All interactive controls are rendered but visually disabled (opacity, pointer-events-none)
- [ ] Chart area draws X/Y axes with no data lines
- [ ] Login button/link centered in chart area
- [ ] Same gold color theme as dashboard
- [ ] Chart height matches dashboard (400px on desktop)

### FR-6: Landing Page — Silver Chart Shell (Disabled)

Same pattern as gold chart shell but with silver theming.

**Acceptance criteria:**
- [ ] Card structure matches dashboard SilverPriceChart (title, unit selector, period tabs)
- [ ] All controls visually disabled
- [ ] Chart area shows only X/Y axes with centered login button
- [ ] Silver color theme
- [ ] Chart height matches dashboard (200px on desktop)

### FR-7: Landing Page — Overall Layout

**Layout structure:**
- Navbar (existing `LandingNavbar`)
- Content area with `pt-14 sm:pt-16` to clear fixed navbar

**Desktop (sm: 800px+):**
```
[Navbar]
[Gold Price Table]  [Gold Price Chart]     ← grid grid-cols-2 gap-6
[Silver Price Table] [Silver Price Chart]  ← grid grid-cols-2 gap-6
```

**Mobile (<800px):**
```
[Navbar]
[Gold Price Table]
[Gold Price Chart]
[Silver Price Table]
[Silver Price Chart]
```

Same layout pattern as dashboard home page for gold/silver sections.

**Acceptance criteria:**
- [ ] Desktop: 2-column grid (table + chart) for each metal, same as dashboard home
- [ ] Mobile: vertically stacked
- [ ] Padding: `px-4 py-4 pb-24` on mobile, `px-8 py-6` on desktop
- [ ] `space-y-6` between sections
- [ ] No hero section, no features section, no comparison, no footer (clean minimal)
- [ ] Remove or hide all old landing components (LandingHero, LandingFeatures, etc.)

### FR-8: Login Redirect After Auth

After successful login on `/auth/login`, redirect to `/dashboard/home` as normal (existing behavior — no changes needed).

**Acceptance criteria:**
- [ ] Existing login redirect flow unchanged
- [ ] User clicks "đăng nhập" on landing → `/auth/login` → login → `/dashboard/home`

## Non-Functional Requirements

- **Performance:** Public endpoint should respond in <100ms (serves static data from in-memory registry)
- **Security:** Public endpoint exposes only type names and currency — no prices, no user data
- **SEO:** Landing page should remain indexable. Update meta tags to reflect new content focus.
- **Accessibility:** Login links must be keyboard-navigable, have proper focus styles, and use semantic link elements.
- **i18n:** Login prompt text should use translation keys for multi-language support.

## Architecture Changes (C4)

### Diagrams to Update

1. **`docs/architecture/c4-component-backend.md`** — Add the new public route group and `MarketTypesHandler` component
2. **`docs/architecture/c4-component-frontend.md`** — Update landing page component list (remove old components, add new price teaser components)

### New Diagrams

No new L4 code diagrams needed — this is a simple handler returning static registry data.

## Runtime Flow Diagrams

### Flow Diagrams to Update

No existing flow diagrams need updating — auth flow remains unchanged.

### New Flow Diagrams

No new flow diagrams needed. The public endpoint is a simple stateless read from an in-memory registry — no multi-step business logic, no branching, no cross-service coordination.

## Data Model Changes

No database changes. The public endpoint reads from in-memory gold/silver type registries.

## API Changes

### New Endpoint

**`GET /api/v1/public/market-types`** (no auth)

**Proto definition:**
```protobuf
message MarketTypeItem {
  string code = 1;
  string name = 2;
  string currency = 3;
}

message GetPublicMarketTypesRequest {}

message GetPublicMarketTypesResponse {
  bool success = 1;
  string message = 2;
  repeated MarketTypeItem gold = 3;
  repeated MarketTypeItem silver = 4;
  string timestamp = 5;
}

// In InvestmentService:
rpc GetPublicMarketTypes(GetPublicMarketTypesRequest) returns (GetPublicMarketTypesResponse) {
  option (google.api.http) = {
    get: "/api/v1/public/market-types"
  };
}
```

## UI/UX Changes

### Components to Create

1. **`LandingGoldPriceTable`** — Gold type table with login links in Buy/Sell cells
2. **`LandingGoldPriceChart`** — Disabled gold chart shell with axes + login button
3. **`LandingSilverPriceTable`** — Silver type table with login links in Buy/Sell cells
4. **`LandingSilverPriceChart`** — Disabled silver chart shell with axes + login button

### Components to Remove/Hide

Remove from the landing page render (keep files for potential future use):
- `LandingHero`
- `LandingFeatures`
- `LandingInvestmentFeatures`
- `LandingBankImport`
- `LandingComparison`
- `LandingHowItWorks`
- `LandingCTA`
- `LandingFooter`
- `PWAInstallPrompt` (from landing only)

### Design Notes

- **Gold table header:** `bg-v2-gold-light` background, `text-v2-gold-dark` text (matches dashboard)
- **Silver table header:** `bg-v2-silver-light` background, `text-v2-silver-dark` text (matches dashboard)
- **Login link style:** Text "Vui lòng " (normal) + "đăng nhập" (link styled, underlined, primary color) + " để xem giá" (normal)
- **Chart login button:** Centered in chart area, styled as a prominent button or link
- **Disabled controls:** `opacity-50 pointer-events-none` or similar visual treatment
- **Mobile-first:** Default stacked layout, grid layout at `sm:` breakpoint (800px)

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser (anonymous) | GET request | Yes: Internet → App | Public API endpoint | No auth required |
| 2 | Go backend | Gold/silver type names | No (internal) | In-memory registry → Handler | Static data |
| 3 | Handler | JSON response (type names only) | Yes: App → Internet | Browser | No sensitive data |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Anonymous GET request | Rate limiting, no auth needed |
| App → Internet | JSON response | Type names only, no prices or user data |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | DoS | Excessive requests to public endpoint | Low | Rate limiter on public route group |
| T-2 | 3 | App → Internet | Information Disclosure | Leaking internal details | Low | Response contains only type names/currency — no prices, IDs, or internal data |
| T-3 | 1 | Internet → App | Spoofing | Fake requests | Low | Endpoint is read-only, no state changes, no auth bypass risk |

### Authorization Rules

- Public endpoint: NO authorization required (by design)
- Protected endpoints (prices, charts): Require JWT auth (unchanged)
- The login links on the landing page redirect to `/auth/login` — standard OAuth flow

### Input Validation Rules

- Public endpoint accepts no user input (empty request body, no query params)
- No validation needed beyond rate limiting

### External Dependency Risks

None — the public endpoint reads from in-memory registries, no external API calls.

### Sensitive Data Handling

No sensitive data exposed. Type names and currency codes are public knowledge (gold type listings are publicly available information).

### Issues & Risks Summary

1. **Low risk:** Public endpoint could be scraped, but data is not sensitive
2. **Low risk:** Rate limiting should prevent DoS — use IP-based rate limiter since there's no user context
3. **Negligible:** Removing old landing page sections may affect SEO — mitigated by updating meta tags

## Edge Cases & Error Handling

1. **Public API fails to load types:** Show a generic "Could not load data" message with retry button
2. **Empty type registries:** Show "No data available" message (unlikely — registries are hardcoded)
3. **User already authenticated visiting landing:** Existing behavior — root redirector sends to `/dashboard/home`
4. **Translation missing:** Fall back to hardcoded Vietnamese text

## Dependencies & Assumptions

- Gold types registry (`pkg/gold.GoldTypes`) is populated on server startup
- Silver types registry (`pkg/silver.SilverTypes`) is populated on server startup
- `LandingNavbar` component works correctly (existing, no changes needed)
- Existing login/redirect flow works correctly
- v2 color theme variables (`v2-gold-light`, `v2-gold-dark`, `v2-silver-light`, `v2-silver-dark`) are defined in Tailwind config

## Out of Scope

- Showing real price data on the landing page
- Creating chart data public endpoints
- Changing the authentication flow
- Modifying the dashboard prices page
- Deleting old landing page component files (keep for potential future use)
- PWA install prompt on landing page
- Footer or CTA sections
