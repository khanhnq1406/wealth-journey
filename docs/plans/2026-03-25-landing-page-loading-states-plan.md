# Landing Page Loading States Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add instant loading UI for `/vi` (locale root splash screen) and `/vi/landing` (full landing page skeleton) using Next.js `loading.tsx` convention.

**Spec:** `docs/specs/2026-03-25-landing-page-loading-states-spec.md`

**Architecture:** Purely additive frontend — two new `loading.tsx` files using Next.js App Router's built-in Suspense boundary convention. No backend changes, no API changes, no new dependencies. The locale root gets a minimal branded splash screen; the landing page gets a full skeleton matching `LandingContent`'s responsive layout.

**Tech Stack:** Next.js 16.2 (App Router), React 19, TypeScript 5, Tailwind CSS 3.4, existing `Skeleton` component

## Security Implementation Notes

- Authentication: N/A — loading states shown to all visitors (public pages)
- Authorization: N/A — no resource access
- Input validation: N/A — no inputs
- Data sanitization: N/A — no data flows, pure static render

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `Skeleton` | `components/loading/Skeleton.tsx` | Shimmer blocks in landing skeleton (table cells, chart placeholders) |
| `OrnateDivider` | `components/decorative/OrnateDivider.tsx` | Section dividers between gold/silver/currency in landing skeleton |
| `BaseCard` | `components/BaseCard.tsx` | Chart placeholder card container (matches real chart wrapper) |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| Locale root loading (inline) | `app/[locale]/loading.tsx` | Route-specific `loading.tsx` file; single-use; must be a server component (no `useTranslations`), so cannot use existing `Skeleton` which requires client-side i18n |
| Landing page skeleton (inline) | `app/[locale]/landing/loading.tsx` | Route-specific `loading.tsx` file; single-use; mirrors `LandingContent` layout with shimmer placeholders |

## C4 Architecture Diagram Updates

None — per spec, this is purely additive frontend files. No new services, handlers, or modules.

## Runtime Flow Diagram Updates

None — no backend changes, no new API calls. The Next.js `loading.tsx` mechanism is standard framework behavior.

---

### Task 0: Update C4 Architecture Diagrams

**Skipped** — spec explicitly states no architecture changes needed. No new services, handlers, or modules.

---

### Task N-1: Create/Update Runtime Flow Diagrams

**Skipped** — spec explicitly states no runtime flow changes. No backend changes, no new API calls.

---

### Task 1: Branded Splash Screen for Locale Root (`app/[locale]/loading.tsx`)

**Files:**

- Create: `src/wj-client/app/[locale]/loading.tsx`

**Security notes:** No security concerns — pure static render, no data, no inputs.

**Step 0: Component inventory check**

- [x] Ran Glob on `components/loading/` — found `Skeleton.tsx`, `FullPageLoading.tsx`, `LoadingSpinner.tsx`
- [x] Read `Skeleton.tsx` source — uses `useTranslations("skeleton")`, so it's a `"use client"` component
- [x] Read `FullPageLoading.tsx` source — uses `useTranslations("uiFeedback.loading")`, also client component
- [x] **Decision:** Cannot reuse existing `Skeleton` or `FullPageLoading` because FR-1 requires NO `"use client"` and NO `useTranslations`. Must use inline CSS animation.
- Reusing: None (server component constraint prevents using client-only Skeleton)
- Creating new: Inline loading component in `loading.tsx` — no `useTranslations`, no `"use client"`, uses inline Tailwind shimmer

**Step 1: Write the component**

Create `src/wj-client/app/[locale]/loading.tsx`:

```tsx
export default function LocaleRootLoading() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-v2-bg-primary z-50"
      role="status"
      aria-label="Loading"
    >
      {/* Gold spinning indicator matching FullPageLoading style */}
      <svg
        className="h-10 w-10 animate-spin text-v2-gold-primary"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}
```

**Key constraints verified:**
- No `"use client"` directive → server component
- No `useTranslations` → no i18n dependency
- Uses `bg-v2-bg-primary` → matches page background (spec AC)
- Uses `animate-spin` + `text-v2-gold-primary` → gold spinner (spec AC)
- `role="status"` + `aria-label="Loading"` → accessible (spec AC)
- Exports default component → Next.js convention (spec AC)

**Step 2: Verify it builds**

```bash
cd src/wj-client && npx next build --no-lint 2>&1 | head -20
```

Expected: Build succeeds, `app/[locale]/loading.tsx` appears in output.

**Step 3: Commit**

```
feat(frontend): add branded splash screen for locale root loading

Create app/[locale]/loading.tsx with centered gold spinner on
dark maroon background. Renders instantly as server component
while client-side auth check and redirect happen.
```

---

### Task 2: Landing Page Skeleton (`app/[locale]/landing/loading.tsx`)

**Files:**

- Create: `src/wj-client/app/[locale]/landing/loading.tsx`

**Security notes:** No security concerns — pure static render, no data, no inputs.

**Step 0: Component inventory check**

- [x] Existing `Skeleton` component provides gold shimmer animation — reuse for all placeholder blocks
- [x] `OrnateDivider` is a pure decorative component — reuse as-is for section dividers
- [x] `BaseCard` provides card container — reuse for chart placeholders
- [x] Checked `components/icons/` — not needed (no icons in skeleton)
- Reusing: `Skeleton` (shimmer blocks), `OrnateDivider` (dividers), `BaseCard` (chart card wrapper)
- Creating new: Inline sub-components for `NavbarSkeleton`, `TableSkeleton`, `ChartSkeleton`, `SentimentSkeleton`, `FooterSkeleton` — all within the single `loading.tsx` file

**Step 1: Write the component**

Create `src/wj-client/app/[locale]/landing/loading.tsx`:

The skeleton must mirror `LandingContent.tsx`'s exact layout structure:

**Navbar skeleton:**
- Dark bar at top matching `LandingNavbar`'s `h-14 sm:h-16`
- Logo placeholder (left) + 2 button placeholders (right)

**Price table skeleton (3 variants: gold/silver/currency):**
- `rounded-lg border-2 border-{asset}/30 overflow-hidden shadow-v2-card`
- Gradient header bar matching the asset color:
  - Gold: `from-v2-gold-primary via-v2-gold-light to-v2-gold-primary`
  - Silver: `from-v2-silver-primary via-gray-300 to-v2-silver-primary`
  - Currency: `from-v2-currency-primary via-v2-currency-accent to-v2-currency-primary`
- Column header row (3 columns) with shimmer blocks
- 9 data rows for gold, 5 rows for silver, 5 rows for currency
- Alternating `bg-v2-cream-200` / `bg-v2-cream-300` row backgrounds

**Chart placeholder:**
- `BaseCard` with `padding="none"`, `rounded-[20px]`, `border border-v2-border-light`
- Header area: `px-5 pt-5 pb-2` with title shimmer
- Chart area: `h-[400px] sm:h-auto sm:flex-1 sm:min-h-[430px]` with large shimmer block

**Sentiment placeholder:**
- Card with question shimmer, 2 button shimmer blocks, sentiment bar shimmer

**Layout structure:**
```
Mobile (sm:hidden):
  px-4 py-4 pb-8 space-y-6
  - Gold table
  - Gold chart
  - Gold sentiment
  - OrnateDivider
  - Silver table
  - Silver chart
  - Silver sentiment
  - OrnateDivider
  - Currency table
  - Currency/DXY chart

Desktop (hidden sm:block):
  px-8 py-6 space-y-6
  - grid grid-cols-2 gap-6: Gold table | Gold chart
  - Gold sentiment
  - OrnateDivider
  - grid grid-cols-2 gap-6: Silver table | Silver chart
  - Silver sentiment
  - OrnateDivider
  - grid grid-cols-2 gap-6: Currency table | DXY chart
```

**Footer skeleton:**
- Red bar (`bg-v2-red-primary`) with text placeholder shimmer blocks

**Accessibility:**
- Outer container: `role="status"`, `aria-label="Loading landing page"`

**Step 2: Verify it builds**

```bash
cd src/wj-client && npx next build --no-lint 2>&1 | head -20
```

Expected: Build succeeds, `app/[locale]/landing/loading.tsx` appears in output.

**Step 3: Visual verification**

Manually check responsive layout at:
- Mobile (375px): Vertical stack, `space-y-6`
- Desktop (640px+): 2-column grid with `gap-6`

Verify:
- Gold table skeleton has gold gradient header
- Silver table skeleton has silver gradient header
- Currency table skeleton has currency gradient header
- Charts have correct heights (`h-[400px]` mobile, `sm:min-h-[430px]` desktop)
- `OrnateDivider` renders between sections

**Step 4: Commit**

```
feat(frontend): add landing page skeleton loading state

Create app/[locale]/landing/loading.tsx with full responsive
skeleton matching LandingContent layout. Uses existing Skeleton
component for shimmer blocks, OrnateDivider for section dividers,
and BaseCard for chart containers.
```

---

### Task 3: Build Verification & Lint Check

**Files:**

- No file changes — verification only

**Step 1: Run frontend lint**

```bash
cd src/wj-client && npm run lint
```

Verify no ESLint errors in the new files.

**Step 2: Run frontend build**

```bash
cd src/wj-client && npx next build
```

Verify:
- Build succeeds
- No TypeScript errors
- `app/[locale]/loading` and `app/[locale]/landing/loading` appear in build output
- No increase in bundle size beyond expected (~5KB per file)

**Step 3: Verify no existing files were modified**

```bash
git diff --name-only HEAD
```

Expected: Only new files created:
- `src/wj-client/app/[locale]/loading.tsx`
- `src/wj-client/app/[locale]/landing/loading.tsx`

No modifications to `LandingContent.tsx`, `page.tsx`, or any existing component (FR-3).

---

## Task Summary

| Task | Description | Dependencies | Parallel-safe? |
|------|-------------|-------------|----------------|
| 1 | Locale root splash screen (`loading.tsx`) | None | Yes |
| 2 | Landing page skeleton (`landing/loading.tsx`) | None | Yes |
| 3 | Build verification & lint check | Tasks 1-2 | No (sequential after 1-2) |

**Tasks 1 and 2 are independent** — they create separate files in separate directories with no shared state. They can be implemented in parallel.

**Task 3 must run after 1-2** — it verifies the combined build.

---

## Implementation Notes

### Why Task 1 cannot use existing `Skeleton` component

The `Skeleton` component at `components/loading/Skeleton.tsx` has `"use client"` and calls `useTranslations("skeleton")`. FR-1 requires:
- No `"use client"` directive (pure server component)
- No `useTranslations` (no i18n dependency)

Therefore Task 1 uses an inline SVG spinner with Tailwind animation classes — matching the `FullPageLoading` spinner style but without the i18n text.

### Why Task 2 CAN use existing `Skeleton` component

FR-2 doesn't require server component rendering. The `Skeleton` component using `"use client"` is acceptable — Next.js `loading.tsx` works with both server and client components (spec LOW risk #1). The `loading.tsx` file will implicitly become a client component when importing `Skeleton`.

### Chart height matching

Real chart heights from `LandingGoldPriceChart.tsx`:
- Mobile: `h-[400px]`
- Desktop: `sm:h-auto sm:flex-1 sm:min-h-[430px]`

Silver/currency charts use `sm:min-h-[500px]` instead of `430px`. The skeleton must match these exact values.

### Table row counts

- Gold table: 9 rows (filtered by `GOLD_TABLE_FILTER` to show exactly 9 types)
- Silver table: ~5 rows (API returns all silver types, typically 3-5)
- Currency table: ~5 rows (API returns all currency types, typically 5-8)

For the skeleton, use 9 rows for gold and 5 rows for silver/currency as reasonable placeholders.
