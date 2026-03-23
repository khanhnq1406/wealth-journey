# FAB Introduction Card Specification

## Summary

Extend the existing FloatingActionButton to auto-open on `/dashboard/home` page load, displaying an admin-configurable introduction card (tagline + contact info) above the existing quick action buttons. The intro content is managed via new `fab.*` site settings keys, editable in the admin panel.

## User Stories

- As a **user**, I want to see an introduction/welcome message when I visit the home dashboard, so that I understand what the platform offers and how to contact for advertising.
- As an **admin**, I want to configure the FAB introduction text and contact info from the admin panel, so that I can update the messaging without code changes.

## Functional Requirements

### FR-1: Auto-open FAB on Home Page

The FloatingActionButton auto-opens (expanded state) every time the user navigates to `/dashboard/home`.

**Acceptance criteria:**
- [ ] FAB opens automatically within 500ms of page mount on `/dashboard/home`
- [ ] FAB does NOT auto-open on any other dashboard page (portfolio, transactions, etc.)
- [ ] Auto-open triggers every visit (no "show once" logic)
- [ ] User can close the FAB normally (tap backdrop, tap X)
- [ ] After closing, the FAB remains as the normal collapsed button with quick actions

### FR-2: Introduction Card in FAB Expanded State

When the FAB is expanded, an intro card appears above the action buttons, visually distinct from the pill-shaped action items.

**Acceptance criteria:**
- [ ] Intro card renders above action buttons in the expanded FAB menu
- [ ] Intro card displays: intro text (from `fab.intro_text`) and contact info (from `fab.contact_info`)
- [ ] Intro card has distinct styling — bordered card with v2 theme colors, not a pill button
- [ ] Intro card is not clickable/actionable (purely informational)
- [ ] If `fab.enabled` is `false`, the intro card is hidden (action buttons still show)
- [ ] If settings fail to load, FAB works normally without the intro card (graceful degradation)

### FR-3: Admin Settings for FAB Content

New site settings keys for FAB intro content, manageable from the admin panel.

**Acceptance criteria:**
- [ ] Three new setting keys added to backend whitelist: `fab.intro_text`, `fab.contact_info`, `fab.enabled`
- [ ] `fab.enabled` validates as `"true"` or `"false"` string
- [ ] `fab.intro_text` and `fab.contact_info` have max 500 characters, HTML stripped
- [ ] Admin panel shows a new "FAB / Welcome" section in the SEO tab (below Footer Content)
- [ ] Admin can edit intro text, contact info, and toggle enabled/disabled
- [ ] Changes take effect on next page load (no real-time push needed)

### FR-4: Default Values

When settings don't exist yet (fresh deployment), sensible defaults are used.

**Acceptance criteria:**
- [ ] Default `fab.intro_text`: "San choi giao luu, trao doi, kien thuc ve thi truong dau tu tai chinh"
- [ ] Default `fab.contact_info`: "Lien he quang cao: 076.897.2512"
- [ ] Default `fab.enabled`: `"true"`
- [ ] Migration seeds these defaults into the database

## Non-Functional Requirements

- **Performance**: Fetching FAB settings should not block page render. Use React Query with stale-while-revalidate (5min staleTime, matching existing market prices pattern).
- **Security**: Settings are fetched from the public endpoint (`/api/v1/public/site-settings`) — no auth required for read. Write requires admin auth.

## Architecture Changes (C4)

### Diagrams to Update

- **L3 Frontend (`c4-component-frontend.md`)**: No structural change — FloatingActionButton is already listed as a shared component.
- **L3 Backend (`c4-component-backend.md`)**: No structural change — SiteSettingsHandler already exists.

### New Diagrams

None needed — this feature extends existing components, no new bounded contexts.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — this is a simple settings read flow that follows the existing site settings pattern already documented.

### New Flow Diagrams

None needed — simple CRUD with no branching or multi-service coordination.

## Data Model Changes

No new tables. Three new rows in the existing `site_settings` table:

| Key | Value (default) | Type |
|-----|----------------|------|
| `fab.intro_text` | "San choi giao luu, trao doi, kien thuc ve thi truong dau tu tai chinh" | string (max 500) |
| `fab.contact_info` | "Lien he quang cao: 076.897.2512" | string (max 500) |
| `fab.enabled` | `"true"` | boolean string |

## API Changes

No new endpoints. Existing endpoints are reused:

- `GET /api/v1/public/site-settings` — already returns all settings (will include new `fab.*` keys)
- `PUT /api/v1/admin/site-settings` — already handles bulk upsert (will accept new `fab.*` keys after whitelist update)

**Backend changes:**
1. Add `fab.intro_text`, `fab.contact_info`, `fab.enabled` to `validSettingKeys` map in `site_settings_service.go`
2. Add `fab.enabled` validation (must be `"true"` or `"false"`) in `validateSettingValue()`
3. Add default seed values in `migrate-site-settings/main.go`

## UI/UX Changes

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|-------------------|----------|
| Floating action button | `FloatingActionButton` | `components/FloatingActionButton.tsx` |
| Card styling | `BaseCard` | `components/BaseCard.tsx` |
| Form inputs (admin) | `FormInput`, `FormTextarea`, `FormToggle` | `components/forms/` |
| Admin guard | `AdminGuard` | `features/admin/components/AdminGuard.tsx` |
| Site settings fetch | Existing pattern in admin page | `app/[locale]/dashboard/admin/page.tsx` |

### New Components (if any)

| Component | Location | Justification |
|-----------|----------|---------------|
| `FABIntroCard` | `components/FloatingActionButton.tsx` (inline, not separate file) | Small presentational subcomponent within the FAB — renders the intro card with distinct styling. Too small for its own file. |

### Component Changes

**1. `FloatingActionButton.tsx`** — Add props:
- `introContent?: { text: string; contactInfo: string }` — optional intro card data
- `autoOpen?: boolean` — whether to auto-open on mount
- New internal `FABIntroCard` subcomponent rendered above action buttons when `introContent` is provided

**2. Dashboard layout (`app/[locale]/dashboard/layout.tsx`)** — No changes needed. The FAB is rendered here but the `autoOpen` and `introContent` props will be passed conditionally.

**3. Home page (`app/[locale]/dashboard/home/page.tsx`)** — Does NOT render the FAB (layout does). The auto-open needs to be communicated from the home page context to the layout.

**Approach for auto-open communication:**
- Add a `fabAutoOpen` state to the dashboard layout
- Use `usePathname()` in the layout to detect when the user is on `/dashboard/home`
- When pathname matches home, set `autoOpen={true}` on the FAB
- Fetch FAB settings in the layout (they apply globally to the FAB) using React Query from the public site settings endpoint

**4. Admin page (`app/[locale]/dashboard/admin/page.tsx`)** — Add a "FAB / Welcome" section below the "Footer Content" card in the SEO tab with:
- `FormTextarea` for intro text
- `FormInput` for contact info
- `FormToggle` for enabled/disabled

### Visual Design

**FAB Intro Card (inside expanded FAB menu):**
```
┌─────────────────────────────────┐
│  Intro text here...             │  ← v2-gold-accent text
│                                 │
│  ────────────────────────────   │  ← subtle divider
│  Contact info here              │  ← v2-text-tertiary, smaller font
└─────────────────────────────────┘
   [ 📈 Add Investment          ]   ← existing action pill

           (●)                      ← FAB button (open state)
```

**Intro card styling:**
- Background: `bg-v2-maroon-800` with `border border-v2-gold-primary/30`
- Rounded corners: `rounded-2xl`
- Padding: `px-5 py-4`
- Text: `text-v2-gold-accent` for intro, `text-v2-text-tertiary text-xs` for contact
- Max width matches action pills
- No hover/active states (not interactive)

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Admin (browser) | FAB settings (text, contact, enabled) | Yes: Internet → App | REST Handler (`PUT /admin/site-settings`) | Untrusted input, admin-authenticated |
| 2 | REST Handler | Validated settings | Yes: App → DB | PostgreSQL (site_settings table) | Parameterized via GORM |
| 3 | User (browser) | Page load request | Yes: Internet → App | REST Handler (`GET /public/site-settings`) | No auth, public endpoint |
| 4 | PostgreSQL | All site settings | Yes: DB → App | REST Handler | Includes FAB + SEO + footer settings |
| 5 | REST Handler | Settings JSON | Yes: App → Internet | User browser | Public data, no sensitive fields |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App (admin write) | Admin updating FAB settings | JWT auth + admin role check + input validation + HTML stripping |
| Internet → App (public read) | Any user fetching settings | No auth needed (public data), rate limiting via existing middleware |
| App → DB | GORM queries | Parameterized queries, key whitelist validation |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Non-admin pretends to be admin | High | JWT + admin role middleware (existing) |
| T-2 | 1 | Internet → App | Tampering | XSS payload in intro text | Medium | HTML tag stripping (existing `htmlTagRegex`), React auto-escapes on render |
| T-3 | 1 | Internet → App | Elevation | Regular user tries admin endpoint | High | Admin middleware rejects non-admin JWT (existing) |
| T-4 | 3 | Internet → App | DoS | Excessive requests to public settings | Low | Existing rate limiting + Redis cache (15min TTL) |
| T-5 | 5 | App → Internet | Info Disclosure | Settings response leaks admin user IDs | Low | `toSiteSettingDTOs()` already strips `updatedBy` field |

### Authorization Rules

| Operation | Admin | Regular User | Unauthenticated |
|-----------|-------|-------------|-----------------|
| Read FAB settings | Yes | Yes | Yes (public endpoint) |
| Update FAB settings | Yes | No (403) | No (401) |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| `fab.intro_text` | string | max 500 chars, no HTML | Key whitelist + length check + HTML strip (existing) |
| `fab.contact_info` | string | max 500 chars, no HTML | Key whitelist + length check + HTML strip (existing) |
| `fab.enabled` | string | must be `"true"` or `"false"` | Custom validation in `validateSettingValue()` |

### External Dependency Risks

No new external dependencies. This feature only extends existing site settings infrastructure.

### Sensitive Data Handling

No sensitive data. FAB intro text and contact info are public-facing content, intentionally served from the unauthenticated endpoint.

### Issues & Risks Summary

1. **Low risk**: XSS via intro text — mitigated by existing HTML stripping + React auto-escape
2. **Low risk**: Public endpoint abuse — mitigated by existing Redis cache + rate limiting
3. **No financial data involved** — this feature handles display text only

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|------------------|
| Settings not yet seeded (fresh deploy) | FAB shows with hardcoded defaults |
| Settings API fails/timeout | FAB works normally without intro card |
| `fab.enabled` is `"false"` | FAB opens normally with action buttons only, no intro card |
| Admin clears intro text then saves | Backend rejects empty value (existing validation) |
| Very long intro text (500 chars) | Text wraps naturally within the card; card grows vertically |
| User navigates away from home then back | FAB auto-opens again on re-mount |

## Dependencies & Assumptions

- Existing site settings infrastructure (service, handler, cache, admin UI) is working
- The public settings endpoint returns all settings including new `fab.*` keys
- Dashboard layout has access to `usePathname()` for route detection

## Out of Scope

- Rich text / markdown in intro content (plain text only)
- Real-time settings push (changes require page reload)
- Per-user FAB customization
- Analytics/tracking of FAB interactions
- i18n for FAB intro content (admin enters the text in the desired language)
- Auto-open animation delay customization (hardcoded 500ms)
