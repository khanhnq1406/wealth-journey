# Landing Page Performance & Loading UX Specification

## Summary

This spec merges two prior specs (`2026-03-25-landing-page-slow-ttfb-spec.md` and `2026-03-25-landing-page-loading-states-spec.md`) into a single implementable document, updated to reflect the current codebase state (as of 2026-04-01).

**Significant architectural change since the original specs:** The `GetPublicMarketTypes` backend handler no longer calls external APIs on each request. The `PriceCacheJob` now pre-populates the `asset_price` DB table every 15 minutes, and `GetPublicMarketTypes` reads from that DB table. This resolves RC-2 (external API fan-out), RC-3 (duplicate upstream calls), and RC-5 (no warmup job) from the TTFB spec. **Those backend changes are out of scope.**

**What remains unimplemented and must be delivered:**

1. **TTFB risk (FR-1):** `fetchSiteSettings()` in `landing/layout.tsx` has no timeout. If the Go backend is slow or unreachable, Next.js SSR hangs until Node.js default timeout (~5 min). Add a 3-second `AbortController` timeout with graceful fallback to static metadata.

2. **Loading UX (FR-2, FR-3):** Neither `app/[locale]/loading.tsx` (locale root splash) nor `app/[locale]/landing/loading.tsx` (full-page skeleton) exist. Visitors see a blank dark-red screen while the redirect runs and while `LandingContent` mounts its client-side React Query fetches.

---

## User Stories

- As a visitor arriving at `/vi` or `/en`, I want to see a branded loading screen instead of a blank page, so I know the site is working.
- As a visitor going directly to `/vi/landing`, I want to see the page structure immediately (skeleton), so the page feels fast even while data loads.
- As a site operator, I want the landing page to never block on external API calls, so that upstream slowness doesn't cause user-facing outages.

---

## Context: Current Architecture (Post-PriceCacheJob)

### Landing Page Data Flow (Current)

```
Browser → Vercel → Next.js SSR
  → landing/layout.tsx (async Server Component)
      → fetchSiteSettings()  ← ONLY remaining SSR blocking fetch
          → fetch(`${apiUrl}/api/v1/public/site-settings`, { revalidate: 300 })
          → ⚠️ NO timeout — can hang indefinitely if backend is slow
  → landing/page.tsx (passes through to LandingContent)

Client hydration:
  → LandingContent.tsx ("use client")
      → LandingGoldPriceTable → useQueryGetAssetDisplayPrices({ assetType: "gold" })
      → LandingSilverPriceTable → useQueryGetAssetDisplayPrices({ assetType: "silver" })
      → LandingCurrencyPriceTable → useQueryGetAssetDisplayPrices({ assetType: "currency" })
      → SentimentCard (2x)
      → TradingView chart embeds
```

**Key fact:** `landing/page.tsx` is a minimal wrapper — it does NOT fetch `market-types`. All price data is client-side via React Query. The ONLY SSR blocking call is `fetchSiteSettings()` in `layout.tsx`, used only for SEO metadata generation.

### Locale Root (`/[locale]`) Flow

```
Browser → Vercel → Next.js SSR
  → [locale]/page.tsx ("use client") returns null
  → Client JS executes: checks Redux auth state → router.push("/landing") or "/dashboard/home"
  → User sees: BLANK PAGE (bg-v2-bg-primary) while JS loads + auth check runs
```

---

## Functional Requirements

### FR-1: Add 3-second timeout to `fetchSiteSettings()` in `landing/layout.tsx`

The `fetchSiteSettings()` async function in `src/wj-client/app/[locale]/landing/layout.tsx` (lines 86–106) calls the Go backend with no timeout. If the backend is slow or unreachable, `generateMetadata()` hangs, blocking SSR for the entire `landing/layout.tsx`.

**Fix:** Add an `AbortController` with `setTimeout(3000)` to the fetch. On timeout or any error, return `null` — existing fallback (`FALLBACK_METADATA`) already handles this.

**Acceptance criteria:**
- [ ] `fetchSiteSettings()` creates an `AbortController` and passes `signal` to `fetch()`
- [ ] `setTimeout(3000)` aborts the controller after 3 seconds
- [ ] `clearTimeout` is called in a `finally` block to avoid memory leaks
- [ ] On abort or error, function returns `null` (existing behavior unchanged)
- [ ] `generateMetadata()` continues to work correctly with null settings (uses `FALLBACK_METADATA`)
- [ ] No change to the response parsing logic (lines 93–105 remain intact)
- [ ] TypeScript strict mode — no `any` introduced

**Code pattern:**
```typescript
async function fetchSiteSettings(): Promise<Record<string, string> | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
    if (!apiUrl) return null;
    const res = await fetch(`${apiUrl}/api/v1/public/site-settings`, {
      next: { revalidate: 300 },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    // ... rest of response parsing unchanged
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

---

### FR-2: Branded Splash Screen for Locale Root (`/vi`, `/en`)

Create `src/wj-client/app/[locale]/loading.tsx`. This file is displayed by Next.js App Router as the Suspense boundary fallback while `[locale]/page.tsx` (a "use client" component) loads and runs its redirect logic.

**What it shows:**
- Full-screen `bg-v2-bg-primary` background
- Centered gold spinning indicator (`animate-spin` with `text-v2-gold-primary`)
- No text — the redirect happens in <1s on normal connections

**Implementation constraints:**
- **MUST NOT import `Skeleton`** — `Skeleton` uses `useTranslations("skeleton")` which requires the next-intl provider context. `loading.tsx` renders before the locale provider is mounted, so `useTranslations` will throw a "missing provider" error.
- **MUST NOT use `useTranslations` or any i18n hook** — same reason above
- Use an inline SVG spinner or Tailwind `animate-spin` directly — no hook-dependent components
- The component can be either server or client (client is fine since it has no hooks, just renders a spinner)

**Acceptance criteria:**
- [ ] File exists at `src/wj-client/app/[locale]/loading.tsx`
- [ ] Uses `bg-v2-bg-primary` for full-screen background
- [ ] Shows a gold `animate-spin` spinner centered on screen
- [ ] Does NOT import `Skeleton`, `FullPageLoading`, or any component that calls `useTranslations`
- [ ] Accessible: outer `<div>` has `role="status"` and `aria-label="Loading"`
- [ ] No TypeScript errors

---

### FR-3: Full Landing Page Skeleton for `/vi/landing`

Create `src/wj-client/app/[locale]/landing/loading.tsx`. This shows while `LandingContent.tsx` (client component) is mounting and its React Query fetches are in-flight. It mirrors the `LandingContent` layout structure exactly.

**Structure (top to bottom, matching `LandingContent.tsx` lines 15–64):**

1. **Navbar skeleton** — dark bar at top (`h-14 sm:h-16`), logo placeholder left, 2 button placeholders right
2. **Main content area** (`pt-14 sm:pt-16`):

   **Mobile layout** (`sm:hidden px-4 py-4 pb-8 space-y-6`):
   - Gold table skeleton (gradient header + 9 rows × 3 columns shimmer)
   - Gold chart placeholder (`h-[400px]`)
   - Sentiment card skeleton
   - `OrnateDivider variant="ornate"`
   - Silver table skeleton (silver gradient header + 9 rows × 3 columns)
   - Silver chart placeholder (`h-[400px]`)
   - Sentiment card skeleton
   - `OrnateDivider variant="ornate"`
   - Currency table skeleton (currency gradient header + 9 rows × 3 columns)
   - Currency chart placeholder (`h-[400px]`)

   **Desktop layout** (`hidden sm:block px-8 py-6 space-y-6`):
   - `grid grid-cols-2 gap-6`: Gold table skeleton | Gold chart placeholder (`min-h-[430px]`)
   - Sentiment card skeleton (full width)
   - `OrnateDivider variant="ornate"`
   - `grid grid-cols-2 gap-6`: Silver table skeleton | Silver chart placeholder
   - Sentiment card skeleton (full width)
   - `OrnateDivider variant="ornate"`
   - `grid grid-cols-2 gap-6`: Currency table skeleton | Dollar index chart placeholder

3. **Footer skeleton** — brand-colored bar at bottom, text placeholders

**Implementation constraints:**
- **MUST NOT import `Skeleton`** — same reason as FR-2 (`useTranslations` not available in `loading.tsx` before provider mounts)
- Use inline `animate-pulse` or custom shimmer blocks built with plain Tailwind classes
- `OrnateDivider` can be imported — it is a pure CSS/SVG component with no hooks
- The file is a client component (acceptable; Next.js `loading.tsx` supports both)
- Build inline reusable helpers (e.g. `function PriceSectionSkeleton({ color })`) rather than importing from Skeleton.tsx

**Acceptance criteria:**
- [ ] File exists at `src/wj-client/app/[locale]/landing/loading.tsx`
- [ ] Does NOT import `Skeleton`, `TableSkeleton`, `ChartSkeleton`, `CardSkeleton`, or any variant from `components/loading/Skeleton.tsx`
- [ ] Layout matches `LandingContent.tsx` structure for both mobile and desktop breakpoints
- [ ] Gold table skeleton uses a gold-themed gradient header (`from-v2-gold-primary/30 to-v2-gold-primary/10` or similar)
- [ ] Silver table skeleton uses silver-themed gradient header (`from-v2-silver-primary/30` or similar)
- [ ] Currency table skeleton uses currency-themed gradient header (`from-v2-currency-accent/30` or similar)
- [ ] Each chart placeholder matches the actual chart container height (`h-[400px]` mobile, `min-h-[430px]` desktop)
- [ ] `OrnateDivider` between sections (matches real page)
- [ ] Outer container has `role="status"` and `aria-label` for accessibility
- [ ] No TypeScript errors
- [ ] No API calls — purely static skeleton

**Shimmer implementation (no Skeleton import needed):**
```tsx
// Inline shimmer block — use instead of importing Skeleton
function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={`bg-v2-bg-dark rounded relative overflow-hidden ${className ?? ""}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-v2-gold-primary/20 to-transparent" />
    </div>
  );
}
```

---

### FR-4: No Changes to Existing Components

This is purely additive. No modifications to any existing file except `landing/layout.tsx` (FR-1).

**Acceptance criteria:**
- [ ] Only files created new: `app/[locale]/loading.tsx`, `app/[locale]/landing/loading.tsx`
- [ ] Only file modified: `app/[locale]/landing/layout.tsx` (3-second timeout addition)
- [ ] No modifications to `LandingContent.tsx`, any landing component, `Skeleton.tsx`, or any other file
- [ ] `npm run lint` passes (no ESLint errors in new or modified files)
- [ ] `npx next build` succeeds with no TypeScript errors

---

## Non-Functional Requirements

- **TTFB**: Landing page must achieve TTFB < 3 seconds in 95th percentile (guaranteed by 3s timeout on `fetchSiteSettings`)
- **Instant render**: Both `loading.tsx` files must render with zero network requests
- **Bundle size**: Loading components should be lightweight (<5KB each) — no new dependencies
- **Accessibility**: `role="status"`, `aria-label` on all loading containers
- **Visual consistency**: All colors use `v2-*` design tokens only — no hardcoded hex values
- **Graceful degradation**: If backend is unreachable, landing page renders with fallback SEO metadata; prices load client-side via React Query

---

## Architecture Changes (C4)

### Diagrams to Update

**`c4-component-frontend.md` (L3 Frontend):**
- Add `app/[locale]/loading.tsx` to the App Router pages section (locale root loading state)
- Add `app/[locale]/landing/loading.tsx` to the landing section

No backend C4 changes required (all backend work was already done).

### New Diagrams

None needed.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-cross-cutting.md`** — Add a new sequence diagram: "Landing Page Load with Timeout + Skeleton"

Describe:
- Browser → Vercel → Next.js SSR → `generateMetadata` → `fetchSiteSettings` with 3s timeout
- Timeout path: returns `FALLBACK_METADATA`; SSR continues; `loading.tsx` shown; `LandingContent` mounts; React Query fetches prices
- Happy path (cache hit): `fetchSiteSettings` returns in <100ms; metadata set; page renders immediately
- Loading state transition: `loading.tsx` visible → `LandingContent` mounts + skeleton inline states appear → prices populate

### New Flow Diagrams

None needed.

---

## Data Model Changes

None.

---

## API Changes

None. All changes are in the frontend.

---

## UI/UX Changes

### Three changes to visible behavior

**1. `fetchSiteSettings` timeout (FR-1)**
No visible UI change. If timeout fires, metadata falls back to `FALLBACK_METADATA` — SEO tags stay populated. User sees no difference.

**2. Locale root loading (`/vi`, `/en`) — FR-2**

```
Before:               After:
┌─────────────┐       ┌─────────────┐
│             │       │             │
│  (BLANK)    │  →    │ bg-v2-bg-   │
│             │       │  primary    │
│             │       │  [spinner]  │
│             │       │             │
└─────────────┘       └─────────────┘
```

**3. Landing page skeleton (`/vi/landing`) — FR-3**

```
Before:                     After (mobile):
┌─────────────┐             ┌─────────────┐
│ bg-v2-bg-   │             │ [Nav bar]   │
│   primary   │             │ [Gold Tbl]  │
│ (per-table  │    →        │ [Gold Chart]│
│  shimmer    │             │ [Sentiment] │
│  appears    │             │ [divider]   │
│  late)      │             │ [Slvr Tbl]  │
│             │             │ ...         │
└─────────────┘             └─────────────┘
```

### Existing Component Inventory

| Need | Existing Component | Location | Usable in loading.tsx? |
|------|-------------------|----------|----------------------|
| Shimmer block | `Skeleton` | `components/loading/Skeleton.tsx` | ❌ Uses `useTranslations` — cannot use |
| Gold spinner style | `FullPageLoading` | `components/loading/FullPageLoading.tsx` | ❌ Uses `useTranslations` — cannot use |
| Ornate divider | `OrnateDivider` | `components/decorative/OrnateDivider.tsx` | ✅ Pure CSS/SVG, no hooks |
| Section separator | `OrnateDivider` | same | ✅ Can use in landing/loading.tsx |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| Locale root loading | Inline in `app/[locale]/loading.tsx` | Single-use loading file; inline SVG spinner avoids import of hook-dependent components |
| `LandingPageSkeleton` | Inline in `app/[locale]/landing/loading.tsx` | Route-specific; inline `ShimmerBlock` helper avoids Skeleton import |

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | GET /vi/landing | No (public page) | Vercel CDN → Next.js SSR | Public, no auth |
| 2 | Next.js SSR | GET /api/v1/public/site-settings | Yes: Vercel → Railway | Go backend | No auth, revalidate: 300 |
| 3 | Client browser | GET /api/v1/public/asset-display-prices | Yes: Browser → Railway | Go backend (via React Query) | No auth, client-side |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → Vercel | User browser | Vercel DDoS protection |
| Vercel → Railway | SSR fetch (site-settings) | IP allowlist on Railway |
| Browser → Railway | React Query price fetches | IP rate limiting |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|---------|--------|--------|---------|------------|
| T-1 | 2 | Vercel→Railway | DoS | Slow backend causes SSR thread pool exhaustion via hanging `fetchSiteSettings` | High | 3s AbortController timeout (FR-1) |
| T-2 | 3 | Browser→Railway | DoS | Attacker floods `/api/v1/public/asset-display-prices` from browser | Low | Already rate-limited on Railway; client-side, no SSR impact |

### Authorization Rules

- All endpoints touched are `/api/v1/public/*` — no authentication required
- No user data involved; no authorization gaps

### Input Validation Rules

- `fetchSiteSettings()` already validates `res.ok`, `data?.success`, `Array.isArray(settings)` — no change needed
- No user input in loading states

### External Dependency Risks

| Dependency | Risk | Mitigation |
|------------|------|-----------|
| Go backend (`/api/v1/public/site-settings`) | Slow/down causes SSR hang | 3s AbortController timeout + fallback metadata |
| `@/components/decorative/OrnateDivider` | Used in `landing/loading.tsx` | Pure CSS component, no external deps |

### Sensitive Data Handling

No sensitive data. SEO metadata and price data are public information.

### Issues & Risks Summary

1. **PRIMARY**: `fetchSiteSettings()` has no timeout — backend slowness can delay SSR by up to Node.js default timeout (~5 min). **Fix: FR-1.**
2. **HIGH**: Skeleton component uses `useTranslations` — importing it in `loading.tsx` will throw "missing next-intl provider" error before the locale is mounted. **Fix: Use inline shimmer blocks in FR-2 and FR-3.**
3. **LOW**: The locale root `loading.tsx` may flash briefly on fast connections before redirect completes. This is acceptable — any visual is better than blank.
4. **LOW**: The landing page skeleton may briefly flash before the real `LandingContent` appears on fast connections. Standard behavior, preferable to blank screen.

---

## Edge Cases & Error Handling

| Scenario | Current Behavior | Target Behavior |
|----------|-----------------|----------------|
| Backend slow (>3s) for site-settings | SSR hangs, TTFB = backend timeout | 3s abort → fallback metadata → page renders with static SEO tags |
| Backend unreachable from Vercel | SSR hangs ~5 min | 3s abort → fallback metadata |
| Cold start for React Query price caches | Price tables show inline loading shimmer | `landing/loading.tsx` shows full-page skeleton first, then inline shimmer |
| Fast SSR (<200ms) | Page renders before client hydration | `loading.tsx` may flash briefly, then real content |
| JavaScript disabled | LandingContent client component doesn't render | `loading.tsx` is SSR-rendered HTML — skeleton visible as static content |
| `/vi` fast redirect (<200ms) | Blank screen flashes | Splash spinner shows, then redirect |
| `/vi` slow connection | Blank screen | Spinner visible throughout redirect |

---

## Dependencies & Assumptions

- The `animate-shimmer` keyframe is already defined in `tailwind.config.ts` (used by `Skeleton.tsx`) — verify before using in inline shimmer blocks
- `OrnateDivider` component has no `useTranslations` or hooks — safe to import in `loading.tsx`
- `NEXT_PUBLIC_API_URL` is always set in production Vercel environment
- Next.js App Router's `loading.tsx` convention works as documented (React Suspense boundary)
- The `bg-v2-*` Tailwind design tokens are available at build time (defined in `tailwind.config.ts`)

---

## Out of Scope

- Backend `GetPublicMarketTypes` context timeout — **already mitigated** by DB-cache architecture (PriceCacheJob); handler reads from DB, not external APIs
- `PublicPriceWarmupJob` — **already implemented** via `PriceCacheJob` (15-minute interval, 10s startup delay)
- `singleflight` deduplication pattern for external API calls — no longer needed (DB cache)
- Adding the Hero section, Features section, or any marketing content to the landing skeleton (keep it simple — price tables + charts only, matching actual LandingContent)
- Streaming SSR with React Suspense per-section boundaries
- Loading states for dashboard pages
- Custom `error.tsx` boundary pages

---

## Implementation Checklist

| Task | File(s) Changed | Dependencies | Parallelizable? |
|------|----------------|--------------|----------------|
| T1: Add timeout to `fetchSiteSettings` | `app/[locale]/landing/layout.tsx` | None | Yes |
| T2: Create locale root loading | `app/[locale]/loading.tsx` (NEW) | None | Yes |
| T3: Create landing page skeleton | `app/[locale]/landing/loading.tsx` (NEW) | Must verify `animate-shimmer` keyframe exists | Yes (parallel with T1, T2) |
| T4: Lint + build verification | — | T1, T2, T3 | After all tasks |
