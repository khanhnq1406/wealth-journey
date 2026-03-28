# Landing Page Loading States Specification

## Summary

When users visit `/vi` (redirect route) or `/vi/landing` (direct landing page), they see either a blank red background or nothing while the server fetches data. This spec adds **instant loading UI** using Next.js App Router's built-in `loading.tsx` convention — a branded splash screen for the redirect route, and a full landing page skeleton for the landing page route. This is a complementary improvement to the existing TTFB fix spec (`2026-03-25-landing-page-slow-ttfb-spec.md`).

## User Stories

- As a visitor arriving from `congdongvang.com/vi`, I want to see a branded loading screen instead of a blank red page, so that I know the site is working.
- As a visitor going directly to `/vi/landing`, I want to see the page structure immediately (skeleton), so that I feel the page is fast even while data loads.

---

## Functional Requirements

### FR-1: Branded Splash Screen for Locale Root (`/vi`, `/en`)

Create `app/[locale]/loading.tsx` that renders instantly while the client component in `page.tsx` checks auth state and redirects.

**What it shows:**
- Full-screen dark maroon background (`bg-v2-bg-primary`)
- Centered WealthJourney logo/brand mark
- Gold spinning indicator (matching existing `FullPageLoading` style)
- No text (keep it minimal — the redirect happens in <1s on fast connections)

**Acceptance criteria:**
- [ ] `app/[locale]/loading.tsx` exists and exports a default component
- [ ] Uses `bg-v2-bg-primary` background (matches page background)
- [ ] Shows gold spinner animation (`animate-spin`, `text-v2-gold-primary`)
- [ ] Renders without `"use client"` directive (pure server component, no hooks)
- [ ] Does NOT use `useTranslations` — no i18n dependency for a loading state
- [ ] Accessible: `role="status"`, `aria-label="Loading"`

### FR-2: Landing Page Skeleton for `/vi/landing`

Create `app/[locale]/landing/loading.tsx` that renders instantly while the server component fetches market data.

**What it shows (top to bottom):**
1. **Navbar skeleton** — Dark bar at top with logo placeholder (left) + 2 button placeholders (right)
2. **Hero section skeleton** — Large heading placeholder, subtitle placeholder, 2 CTA button placeholders
3. **Price section skeletons** (matching the real layout):
   - Mobile: Vertical stack of 3 table skeletons + 3 chart placeholders
   - Desktop: 2-column grid with table skeleton (left) + chart placeholder (right), repeated 3 times
4. **Footer skeleton** — Red bar at bottom with text placeholders

**Each price table skeleton includes:**
- Gradient header bar matching the asset color (gold/silver/currency)
- 9 rows × 3 columns of shimmer blocks
- Rounded corners and border matching the real table

**Each chart placeholder includes:**
- Card container with rounded corners
- Large rectangular shimmer block (same height as TradingView widget: `h-[400px]` mobile, `min-h-[430px]` desktop)

**Acceptance criteria:**
- [ ] `app/[locale]/landing/loading.tsx` exists and exports a default component
- [ ] Skeleton layout matches the real `LandingContent` structure (mobile + desktop responsive)
- [ ] Uses existing `Skeleton` component from `@/components/loading/Skeleton` for shimmer blocks
- [ ] Gold table skeleton has gold-themed gradient header
- [ ] Silver table skeleton has silver-themed gradient header
- [ ] Currency table skeleton has currency-themed gradient header
- [ ] Desktop layout uses `grid grid-cols-2 gap-6` (same as real page)
- [ ] Mobile layout uses vertical stack with `space-y-6` (same as real page)
- [ ] Renders without API calls — pure static skeleton
- [ ] Accessible: outer container has `role="status"`, `aria-label`

### FR-3: No Changes to Existing Components

This is purely additive. No changes to `LandingContent.tsx`, `page.tsx`, or any existing component.

**Acceptance criteria:**
- [ ] No modifications to any existing file
- [ ] Only new files created: `app/[locale]/loading.tsx` and `app/[locale]/landing/loading.tsx`
- [ ] Existing inline loading states in price tables remain as fallback

---

## Non-Functional Requirements

- **Instant render**: Both loading files must render with zero network requests (no data fetching, no API calls)
- **Bundle size**: Loading components should be lightweight (<5KB each). Use existing `Skeleton` component, no new dependencies.
- **Accessibility**: `role="status"`, `aria-label`, respect `prefers-reduced-motion` (inherited from existing Skeleton's shimmer animation)
- **Visual consistency**: Skeleton colors use existing `v2-*` design tokens only. No hardcoded colors.

---

## Architecture Changes (C4)

### Diagrams to Update

None — this is purely additive frontend files. No new services, handlers, or modules.

### New Diagrams

None needed.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — no backend changes, no new API calls.

### New Flow Diagrams

None needed. The Next.js `loading.tsx` mechanism is standard framework behavior, not custom business logic.

---

## Data Model Changes

None.

---

## API Changes

None.

---

## UI/UX Changes

### Two new loading screens

**1. Locale root loading (`/vi`)**

```
┌─────────────────────────────┐
│                             │
│       bg-v2-bg-primary      │
│                             │
│         [Gold Spinner]      │
│                             │
│                             │
└─────────────────────────────┘
```

**2. Landing page skeleton (`/vi/landing`)**

```
Mobile:                        Desktop:
┌─────────────┐               ┌──────────────────────────┐
│ [Nav Bar]   │               │ [Nav Bar]                │
│ [Hero]      │               │ [Hero]                   │
│ [Gold Tbl]  │               │ [Gold Tbl] [Gold Chart]  │
│ [Gold Chart]│               │ [Sentiment]              │
│ [Sentiment] │               │ ─── ornate divider ───   │
│ ── divider ─│               │ [Slvr Tbl] [Slvr Chart]  │
│ [Slvr Tbl]  │               │ [Sentiment]              │
│ [Slvr Chart]│               │ ─── ornate divider ───   │
│ [Sentiment] │               │ [Curr Tbl] [DXY Chart]   │
│ ── divider ─│               │ [Footer]                 │
│ [Curr Tbl]  │               └──────────────────────────┘
│ [DXY Chart] │
│ [Footer]    │
└─────────────┘
```

### Existing Component Inventory

| Need | Existing Component | Location |
|------|-------------------|----------|
| Shimmer block | `Skeleton` | `components/loading/Skeleton.tsx` |
| Full-page spinner style | `FullPageLoading` (reference for design) | `components/loading/FullPageLoading.tsx` |
| Card container | `BaseCard` | `components/cards/BaseCard.tsx` |
| Ornate divider | `OrnateDivider` | `components/decorative/OrnateDivider.tsx` |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| `LandingPageSkeleton` | Inline in `app/[locale]/landing/loading.tsx` | Route-specific loading file; no need for separate component file — it's used in exactly one place |
| Locale root loading | Inline in `app/[locale]/loading.tsx` | Same — single-use loading file |

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| — | — | — | — | — | No data flows. These are static skeleton components with zero API calls, zero user input, zero server interaction. |

### Trust Boundaries

No trust boundaries crossed. These components render static HTML/CSS only.

### Threats Identified (STRIDE)

| # | Threat | Applies? | Notes |
|---|--------|----------|-------|
| T-1 | All STRIDE categories | No | No data flow, no user input, no API calls, no auth, no state changes. Pure static render. |

### Authorization Rules

None — loading states are shown to all visitors (public pages).

### Input Validation Rules

None — no inputs.

### External Dependency Risks

None — no new dependencies. Uses only existing `Skeleton` component and Tailwind CSS classes.

### Sensitive Data Handling

None — no data involved.

### Issues & Risks Summary

1. **LOW**: If the `Skeleton` component is a `"use client"` component (it is), importing it in `loading.tsx` will make the loading file a client component. This is acceptable — Next.js `loading.tsx` works with both server and client components.
2. **LOW**: The landing skeleton may briefly flash before the real content appears on fast connections (< 200ms). This is standard behavior and preferable to a blank screen.

---

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| Fast SSR (< 200ms) | Skeleton may flash briefly, then real content appears. Acceptable. |
| Slow SSR (> 3s) | Skeleton stays visible until SSR completes. This is the primary use case. |
| SSR returns null (timeout from TTFB fix) | Skeleton disappears, `LandingContent` renders with empty data, client-side hook fetches. Existing inline loading states take over. |
| JavaScript disabled | `loading.tsx` is SSR-rendered HTML — skeleton still appears as static content. |
| `/vi` redirect on fast connection | Splash screen flashes briefly before redirect to `/landing` or `/dashboard/home`. |
| `/vi` redirect on slow connection | Splash screen stays visible while auth check + redirect happens. |

---

## Dependencies & Assumptions

- Next.js App Router's `loading.tsx` convention works as documented (React Suspense boundary)
- The existing `Skeleton` component from `components/loading/Skeleton.tsx` can be imported in the loading files
- `OrnateDivider` can be used in the landing skeleton for visual fidelity (it's a pure CSS component)
- No i18n is needed in loading states (skeletons have no text content, spinner has no text)

---

## Out of Scope

- TTFB fixes (covered by separate spec `2026-03-25-landing-page-slow-ttfb-spec.md`)
- Streaming SSR with per-section Suspense boundaries (Approach B — future optimization)
- Enhanced inline skeletons in `LandingContent` (Approach C — future optimization)
- Custom error.tsx boundary pages
- Loading states for dashboard pages (separate concern)
