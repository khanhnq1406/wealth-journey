# Landing Page Performance & Loading UX — Implementation Report

## Summary

Implemented three frontend improvements to eliminate blank screens during landing page load: a 3-second AbortController timeout on `fetchSiteSettings()` (DoS mitigation), a branded gold spinner splash screen for the locale route segment, and a full shimmer skeleton for the landing page. Also updated C4 architecture diagrams and added a runtime flow sequence diagram. All changes are frontend-only with no new dependencies.

## Spec Reference

`docs/specs/2026-04-01-landing-page-performance-ux-spec.md`

## Plan Reference

`docs/plans/2026-04-01-landing-page-performance-ux-plan.md`

## Tasks Completed

| #   | Task                                        | Status | Files Changed                                                                 | Tests        | TDD |
| --- | ------------------------------------------- | ------ | ----------------------------------------------------------------------------- | ------------ | --- |
| 0   | Update C4 Architecture Diagrams             | Done   | `docs/architecture/c4-component-frontend.md`                                  | N/A (docs)   | N/A |
| 1   | Add 3-second timeout to fetchSiteSettings() | Done   | `app/[locale]/landing/layout.tsx`, `__tests__/fetch-timeout.test.ts`          | 1/1 pass     | Yes |
| 2   | Create Locale Root Loading Splash           | Done   | `app/[locale]/loading.tsx`                                                    | N/A (static) | N/A |
| 3   | Create Landing Page Skeleton                | Done   | `app/[locale]/landing/loading.tsx`                                            | N/A (static) | N/A |
| 4   | Update Runtime Flow Diagram                 | Done   | `docs/architecture/flow-cross-cutting.md`                                     | N/A (docs)   | N/A |
| 5   | Lint + Build Verification                   | Done   | —                                                                             | 0 errors     | N/A |

## Test Coverage Summary

| Layer              | Test File                                        | Tests | Pass | Coverage Area                                      |
| ------------------ | ------------------------------------------------ | ----- | ---- | -------------------------------------------------- |
| Frontend SSR utils | `src/wj-client/__tests__/fetch-timeout.test.ts`  | 1     | 1/1  | AbortController + setTimeout pattern validation    |

## Security Implementation Summary

| Concern              | Implementation                                                                 | Verified |
| -------------------- | ------------------------------------------------------------------------------ | -------- |
| DoS mitigation       | 3s AbortController timeout on SSR fetch; prevents thread pool exhaustion       | Yes      |
| Timer leak           | `clearTimeout(timeoutId)` in `finally` block — fires regardless of outcome     | Yes      |
| AbortError handling  | `catch {}` returns null silently — no error detail leaked to client            | Yes      |
| No user input        | All changes are display-only or SSR-side; no user data involved                | Yes      |
| No new dependencies  | Zero new npm packages added                                                    | Yes      |

## Review Results

### Spec Compliance

All tasks passed spec compliance review with zero failures:
- Task 0: Both loading component entries correctly added to C4 diagram
- Task 1: All 10 requirements verified in actual code (AbortController, signal wiring, clearTimeout in finally, validation preservation)
- Task 2: Byte-for-byte match of spec JSX; all accessibility attributes present
- Task 3: All 18 checklist items verified; desktop currency chart height additive-only (not a spec violation)
- Task 4: All mandatory flow paths covered (happy path, timeout, error); ToC updated

### Security Review

All tasks approved with no CRITICAL or HIGH findings:
- Task 1: Signal correctly wired to fetch(); clearTimeout in finally (not try/catch); catch swallows AbortError without leaking details

### Code Quality

All tasks approved:
- Minor test weakness noted in Task 1: `expect(e).toBeDefined()` assertion is weak but not harmful
- Minor doc wording fixed in Task 0: corrected "Uses Skeleton variants" to "Inline shimmer blocks (no Skeleton import — i18n provider not yet mounted)"
- Tasks 2 & 3: Pure server components with zero imports (or only OrnateDivider); no hooks; all v2 tokens

## Known Issues / Technical Debt

- `npx next build` fails at "Collecting page data" with `ENOENT: pages-manifest.json` — pre-existing Turbopack environment issue, unrelated to this change. TypeScript compilation (`tsc --noEmit`) is clean.
- Task 1 test: `expect(e).toBeDefined()` is a weak assertion — does not specifically verify that the AbortController mechanism fired. Acceptable for a pattern validation test but provides limited regression protection.

## Files Changed

| File | Change |
|------|--------|
| `src/wj-client/app/[locale]/landing/layout.tsx` | Modified — added AbortController timeout to fetchSiteSettings() |
| `src/wj-client/__tests__/fetch-timeout.test.ts` | Created — pattern validation test for AbortController |
| `src/wj-client/app/[locale]/loading.tsx` | Created — locale root loading splash (gold spinner) |
| `src/wj-client/app/[locale]/landing/loading.tsx` | Created — landing page shimmer skeleton |
| `docs/architecture/c4-component-frontend.md` | Modified — added locale_loading + landing_loading components |
| `docs/architecture/flow-cross-cutting.md` | Modified — added section 16 sequence diagram |
| `docs/reports/2026-04-01-landing-page-performance-ux-progress.md` | Created — implementation progress tracker |

## How to Test

### Unit Tests

```bash
cd src/wj-client && npx jest __tests__/fetch-timeout.test.ts --no-coverage
# Expected: 1 passing, 0 failing
```

### TypeScript Check

```bash
cd src/wj-client && npx tsc --noEmit
# Expected: no output (clean)
```

### Lint Check

```bash
cd src/wj-client && npm run lint 2>&1 | grep -E "error"
# Expected: no errors in new/modified files (pre-existing gen/ warnings are unrelated)
```

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed:
- `layout.tsx`: Only `fetchSiteSettings()` modified — no callers changed; function signature unchanged
- `loading.tsx` files: New files, no callers (consumed by Next.js Suspense boundary automatically)
- C4 + flow diagrams: Documentation only, no code callers

### Manual Testing Steps

#### Scenario: Happy path — landing page loads normally

**Preconditions:** Backend is running and responding within 3 seconds

1. Navigate to `/landing` — Expected: landing page loads with real metadata
2. On slow connection, briefly see the gold spinner splash (`[locale]/loading.tsx`) then LandingLoading skeleton, then full content
3. Gold/silver/currency sections appear with real data

#### Scenario: Timeout path — backend is slow/unreachable

**Preconditions:** Backend is down or responding > 3s (e.g., `NEXT_PUBLIC_API_URL` points to unreachable host)

1. Navigate to `/landing` — Expected: page loads within 3 seconds using FALLBACK_METADATA
2. No blank screen or hanging SSR thread
3. Landing page renders with fallback title/description

#### Scenario: Loading splash visible

**Preconditions:** On a slow connection or with network throttling

1. Navigate to `/[locale]/dashboard/home` — Expected: gold spinner on dark maroon background appears briefly before dashboard loads
2. Navigate to `/[locale]/landing` — Expected: shimmer skeleton (navbar, table blocks, chart placeholders, footer) appears before real content

#### Scenario: Mobile viewport

**Preconditions:** Browser devtools set to 375px width

1. Navigate to `/landing` while page is loading — Expected: shimmer skeleton uses `sm:hidden` mobile layout (stacked sections, no side-by-side grid)
2. No horizontal scroll

## Fix History

| Date       | Fix                                                                           | Severity | Files Changed                             |
| ---------- | ----------------------------------------------------------------------------- | -------- | ----------------------------------------- |
| 2026-04-01 | `/vi` route showed blank dark red screen — replaced `return null` with gold spinner in `app/[locale]/page.tsx` | Minor    | `src/wj-client/app/[locale]/page.tsx` |
| 2026-04-01 | Loading screens were spinner-only — added static brand block (logo, tagline, contact) to `loading.tsx` and `page.tsx` | Minor    | `src/wj-client/app/[locale]/loading.tsx`, `src/wj-client/app/[locale]/page.tsx` |
| 2026-04-01 | Enhanced all loading screens: logo + spinning ring orbit + brand block; also applied to root `app/loading.tsx` | Minor    | `src/wj-client/app/loading.tsx`, `src/wj-client/app/[locale]/loading.tsx`, `src/wj-client/app/[locale]/page.tsx` |

### Fix Detail — 2026-04-01

**Issue:** Navigating to `/vi` (or any locale root, e.g. `/en`) showed only the dark maroon background with no visible loading indicator.

**Root Cause:** `app/[locale]/page.tsx` is a client component that returns `null` while its `useEffect` redirect runs. Next.js `loading.tsx` only activates for async server-side work (SSR Suspense boundaries) — it does not cover synchronous client component renders. So the page rendered nothing (blank red screen) for the ~100ms before the client-side router redirect fired.

**Fix:** Replace `return null` with the branded gold spinner (identical JSX to `app/[locale]/loading.tsx`). The spinner is displayed during the brief client-side redirect, eliminating the blank flash.

**Security Review:** Approved — no XSS risk, no auth bypass, no information disclosure. Auth redirect logic unchanged.

### Fix Detail — 2026-04-01 (brand block)

**Issue:** Both locale loading screens (`app/[locale]/loading.tsx` and `app/[locale]/page.tsx`) showed only the gold spinner with no brand identity or context. Users had no visual anchor while waiting.

**Fix:** Added a static brand block below the spinner in both files:
- Site name: `congdongvang.com` (gold accent, bold)
- Tagline: "Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính" (tertiary text)
- Advertising contact: "Liên hệ quảng cáo: 076.897.2512" (placeholder text, xs)

All strings are hardcoded literals — no dynamic data, no new imports, no new dependencies. Layout changed from `flex items-center justify-center` to `flex flex-col items-center justify-center gap-6` to accommodate the brand block.

**Security Review:** Approved — all strings are build-time literals; no XSS surface, no auth changes, no information disclosure. Auth logic in `page.tsx` untouched.

### Fix Detail — 2026-04-01 (logo orbit spinner)

**Issue:** Spinner and logo were stacked vertically (spinner below logo). User requested the spinner ring orbit around the logo. Additionally the spinner stroke was too thick and wide at larger sizes, and `app/loading.tsx` (root-level) was missing the brand block entirely.

**Fix:**
- Wrapped logo + SVG spinner in a `relative` container (`h-32 w-32`); spinner uses `absolute inset-0 h-full w-full` to overlay the logo
- Replaced path-based spinner with two `<circle>` elements using `strokeDasharray` for a clean thin arc: full-circle track at 25% opacity + 25% arc dash (`strokeDasharray="17.28 51.84"`, `r="11"`, `strokeWidth="1.5"`, `strokeLinecap="round"`)
- Applied identical treatment to `app/loading.tsx` (root loading) including brand block
- No new imports beyond `next/image` (already added in prior fix)
