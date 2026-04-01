# Landing Page Performance & Loading UX Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add a 3-second timeout to `fetchSiteSettings()`, create a branded splash screen for locale root, and create a full landing page skeleton — eliminating blank screens during load.

**Spec:** `docs/specs/2026-04-01-landing-page-performance-ux-spec.md`

**Architecture:** Frontend-only changes. One modification to `landing/layout.tsx` (AbortController timeout) and two new `loading.tsx` files (Next.js Suspense boundaries). No backend changes. No new dependencies.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS (v2 tokens), `animate-shimmer` from `globals.css`

## Security Implementation Notes

- Authentication: N/A — all pages and endpoints are public (`/api/v1/public/*`)
- Authorization: N/A — no user data involved
- Input validation: Existing validation in `fetchSiteSettings()` unchanged (`res.ok`, `data?.success`, `Array.isArray`)
- Data sanitization: N/A — no user input in loading states
- DoS mitigation: 3s `AbortController` timeout prevents SSR thread pool exhaustion (T-1 from spec)

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `OrnateDivider` | `components/decorative/OrnateDivider.tsx` | Section separators in landing skeleton (pure CSS/SVG, no hooks — safe in `loading.tsx`) |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| Locale root spinner | Inline in `app/[locale]/loading.tsx` | Single-use route loading file; cannot import `FullPageLoading` or `Skeleton` (both use `useTranslations` which throws before next-intl provider mounts) |
| `ShimmerBlock` helper | Inline in `app/[locale]/landing/loading.tsx` | Cannot import `Skeleton.tsx` (uses `useTranslations`); inline helper avoids hook dependency |
| Price table skeleton helpers | Inline in `app/[locale]/landing/loading.tsx` | Route-specific; replicates table structure with shimmer blocks; no reuse need outside this file |

**Components explicitly NOT used (and why):**

| Component | Location | Why Not |
|-----------|----------|---------|
| `Skeleton` | `components/loading/Skeleton.tsx` | Uses `useTranslations("skeleton")` — throws "missing next-intl provider" in `loading.tsx` |
| `FullPageLoading` | `components/loading/FullPageLoading.tsx` | Uses `useTranslations` — same issue |
| `SkeletonTable` | `components/loading/skeleton/SkeletonTable.tsx` | Uses `useTranslations` via Skeleton base — same issue |

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-frontend.md`: Add `app/[locale]/loading.tsx` and `app/[locale]/landing/loading.tsx` to the App Router pages section
- No backend C4 changes needed

---

### Task 0: Update C4 Architecture Diagrams

**Files:**

- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Read `docs/architecture/c4-component-frontend.md`
2. Add `loading.tsx` (locale root) and `landing/loading.tsx` to the App Router pages Mermaid diagram
3. Commit diagram changes

---

### Task 1: Add 3-second timeout to `fetchSiteSettings()` (FR-1)

**Files:**

- Modify: `src/wj-client/app/[locale]/landing/layout.tsx:86-106`

**Security notes:** This is the primary DoS mitigation — prevents SSR thread pool exhaustion when backend is slow/unreachable. The 3s timeout guarantees TTFB < 3s at p95.

**Step 1: Write the failing test**

This is an SSR-only server function. No React component test applicable. Verification is via build + manual test.

Create a minimal unit test for the timeout behavior pattern:

```typescript
// src/wj-client/__tests__/fetch-timeout.test.ts
describe("fetchSiteSettings timeout pattern", () => {
  it("should abort fetch after 3 seconds", async () => {
    // Verify AbortController + setTimeout pattern works
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50); // 50ms for test speed

    try {
      await fetch("http://localhost:1", { signal: controller.signal });
    } catch (e: unknown) {
      // Should be either AbortError or connection refused
      expect(e).toBeDefined();
    } finally {
      clearTimeout(timeoutId);
    }
  });
});
```

**Step 2: Run test to verify it passes** (this is a pattern validation test)

```bash
cd src/wj-client && npx jest __tests__/fetch-timeout.test.ts --no-coverage
```

**Step 3: Modify `fetchSiteSettings()` in `layout.tsx`**

Replace lines 86-106 with AbortController timeout:

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
    const data = await res.json();
    if (!data?.success) return null;
    const settings = data?.data?.settings;
    if (!Array.isArray(settings)) return null;
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Step 4: Verify build passes**

```bash
cd src/wj-client && npx next build 2>&1 | head -30
```

**Step 5: Commit**

---

### Task 2: Create Locale Root Loading Splash (FR-2)

**Files:**

- Create: `src/wj-client/app/[locale]/loading.tsx`

**Security notes:** No security concerns — purely static HTML with no data, no inputs, no API calls.

**Step 1: Write the component**

This is a simple presentational component. Create the file:

```tsx
export default function LocaleLoading() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-v2-bg-primary"
      role="status"
      aria-label="Loading"
    >
      <svg
        className="h-10 w-10 animate-spin text-v2-gold-primary"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
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

**Step 2: Verify build passes**

```bash
cd src/wj-client && npx next build 2>&1 | head -30
```

**Step 3: Verify no forbidden imports**

```bash
grep -n "useTranslations\|Skeleton\|FullPageLoading" src/wj-client/app/\[locale\]/loading.tsx
# Expected: no matches
```

**Step 4: Commit**

---

### Task 3: Create Landing Page Skeleton (FR-3)

**Files:**

- Create: `src/wj-client/app/[locale]/landing/loading.tsx`

**Security notes:** No security concerns — purely static HTML skeleton. No API calls, no user input. `OrnateDivider` import is safe (pure CSS/SVG).

**Step 0: Component inventory check**

- [x] `OrnateDivider` at `components/decorative/OrnateDivider.tsx` — safe, no hooks
- [x] `Skeleton` at `components/loading/Skeleton.tsx` — CANNOT use (has `useTranslations`)
- [x] `animate-shimmer` keyframe — available in `globals.css` lines 236-246
- [x] Verified chart heights: Gold `h-[400px] sm:min-h-[430px]`, Silver/Currency `h-[400px] sm:min-h-[500px]`
- [x] Navbar height: `h-14 sm:h-16`

**Step 1: Create the skeleton file**

Structure mirrors `LandingContent.tsx` exactly:

```tsx
import { OrnateDivider } from "@/components/decorative/OrnateDivider";

/** Inline shimmer block — replaces Skeleton import (which uses useTranslations) */
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

/** Skeleton for a price table section */
function TableSkeleton({
  gradientFrom,
  rows = 9,
}: {
  gradientFrom: string;
  rows?: number;
}) {
  return (
    <div className="bg-v2-bg-surface rounded-lg overflow-hidden shadow-card">
      {/* Header */}
      <div className={`h-10 bg-gradient-to-r ${gradientFrom} to-transparent`} />
      {/* Rows */}
      <div className="divide-y divide-v2-border-light/20">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <ShimmerBlock className="h-4 w-1/3" />
            <ShimmerBlock className="h-4 w-1/4 ml-auto" />
            <ShimmerBlock className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for a chart placeholder */
function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`bg-v2-bg-surface rounded-lg overflow-hidden shadow-card flex flex-col ${className ?? ""}`}
    >
      {/* Chart title area */}
      <div className="px-4 pt-3 pb-2">
        <ShimmerBlock className="h-5 w-1/3" />
      </div>
      {/* Chart area */}
      <div className="flex-1 px-2 pb-2">
        <ShimmerBlock className="h-full w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Skeleton for sentiment card */
function SentimentSkeleton() {
  return (
    <div className="bg-v2-bg-surface rounded-lg p-4 shadow-card">
      <ShimmerBlock className="h-5 w-1/4 mb-3" />
      <ShimmerBlock className="h-10 w-full" />
    </div>
  );
}

/** Skeleton for navbar */
function NavbarSkeleton() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-v2-bg-surface/95 backdrop-blur-sm border-b border-v2-border-light/20">
      <div className="flex justify-between items-center h-14 sm:h-16 px-4 sm:px-8">
        <ShimmerBlock className="h-8 w-28" />
        <div className="flex items-center gap-3">
          <ShimmerBlock className="h-9 w-20 rounded-md hidden sm:block" />
          <ShimmerBlock className="h-9 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for footer */
function FooterSkeleton() {
  return (
    <div className="bg-v2-bg-surface border-t border-v2-border-light/20 py-6 px-4 sm:px-8">
      <div className="flex flex-col items-center gap-2">
        <ShimmerBlock className="h-5 w-40" />
        <ShimmerBlock className="h-4 w-64" />
      </div>
    </div>
  );
}

export default function LandingLoading() {
  return (
    <div
      className="min-h-screen bg-v2-bg-primary"
      role="status"
      aria-label="Loading landing page"
    >
      <NavbarSkeleton />

      <main className="pt-14 sm:pt-16">
        {/* Mobile Layout */}
        <div className="sm:hidden px-4 py-4 pb-8 space-y-6">
          <TableSkeleton gradientFrom="from-v2-gold-primary/30" />
          <ChartSkeleton className="h-[400px]" />
          <SentimentSkeleton />
          <OrnateDivider variant="ornate" className="my-6" />
          <TableSkeleton gradientFrom="from-v2-silver-primary/30" />
          <ChartSkeleton className="h-[400px]" />
          <SentimentSkeleton />
          <OrnateDivider variant="ornate" className="my-6" />
          <TableSkeleton gradientFrom="from-v2-currency-accent/30" />
          <ChartSkeleton className="h-[400px]" />
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:block px-8 py-6 space-y-6">
          {/* Row 1: Gold */}
          <div className="grid grid-cols-2 gap-6">
            <TableSkeleton gradientFrom="from-v2-gold-primary/30" />
            <ChartSkeleton className="min-h-[430px]" />
          </div>
          <SentimentSkeleton />
          <OrnateDivider variant="ornate" className="my-6" />
          {/* Row 2: Silver */}
          <div className="grid grid-cols-2 gap-6">
            <TableSkeleton gradientFrom="from-v2-silver-primary/30" />
            <ChartSkeleton className="min-h-[500px]" />
          </div>
          <SentimentSkeleton />
          <OrnateDivider variant="ornate" className="my-6" />
          {/* Row 3: Currency */}
          <div className="grid grid-cols-2 gap-6">
            <TableSkeleton gradientFrom="from-v2-currency-accent/30" />
            <ChartSkeleton className="min-h-[500px]" />
          </div>
        </div>
      </main>

      <FooterSkeleton />
    </div>
  );
}
```

**Step 2: Verify no forbidden imports**

```bash
grep -n "useTranslations\|from.*Skeleton\|FullPageLoading" src/wj-client/app/\[locale\]/landing/loading.tsx
# Expected: no matches (OrnateDivider is allowed)
```

**Step 3: Verify build passes**

```bash
cd src/wj-client && npx next build 2>&1 | head -30
```

**Step 4: Commit**

---

### Task 4: Create/Update Runtime Flow Diagram

**Files:**

- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**

1. Read `docs/architecture/flow-cross-cutting.md`
2. Add sequence diagram: "Landing Page Load with Timeout + Skeleton"
3. Diagram covers:
   - Browser → Vercel → Next.js SSR → `generateMetadata` → `fetchSiteSettings` with 3s timeout
   - Timeout path: returns `FALLBACK_METADATA`
   - Loading state transition: `loading.tsx` → `LandingContent` mounts → React Query fetches
4. Commit diagram changes

---

### Task 5: Lint + Build Verification

**Files:** None (verification only)

**Steps:**

1. Run `cd src/wj-client && npm run lint` — verify no ESLint errors in new/modified files
2. Run `cd src/wj-client && npx next build` — verify full build succeeds with no TypeScript errors
3. Verify only expected files changed:
   - Modified: `app/[locale]/landing/layout.tsx`
   - Created: `app/[locale]/loading.tsx`
   - Created: `app/[locale]/landing/loading.tsx`
   - Modified: `docs/architecture/c4-component-frontend.md`
   - Modified: `docs/architecture/flow-cross-cutting.md`

---

## Task Dependency Graph

```
Task 0 (C4 diagrams)     ──┐
Task 1 (timeout)          ──┤
Task 2 (locale loading)   ──┼── All parallel (no dependencies between them)
Task 3 (landing skeleton) ──┤
Task 4 (flow diagram)     ──┘
                            │
                            ▼
                    Task 5 (lint + build) ── Must run after all above
```

Tasks 0-4 are fully parallelizable — they touch different files with zero overlap.
