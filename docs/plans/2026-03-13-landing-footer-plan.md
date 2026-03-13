# Landing Page Footer — congdongvang.com Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace WealthJourney-branded footer with congdongvang.com community branding and import it into the landing page.
**Spec:** `docs/specs/2026-03-13-landing-footer-spec.md`
**Architecture:** Frontend-only change. Replace content in existing `LandingFooter.tsx` component and add its import to the landing `page.tsx`. No backend, API, or data model changes.
**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS

## Security Implementation Notes

**Risk level: Negligible** — hardcoded static Vietnamese text in JSX. No user input, no API calls, no dynamic data. No authentication, authorization, or validation concerns.

## C4 Architecture Diagram Updates

None — no new components, services, or data flows.

## Runtime Flow Diagram Updates

None — static content rendering, no business logic.

---

### Task 1: Replace LandingFooter content with congdongvang.com branding

**Files:**
- Modify: `src/wj-client/components/landing/LandingFooter.tsx` (full rewrite of component body)

**Security notes:** None — static hardcoded text only.

**Step 1: Replace component content**

Replace the entire `LandingFooter.tsx` with a simple centered footer containing three lines of text. Remove all existing WealthJourney branding, commented-out link sections, social links, copyright line, `Link` import, `useTranslations` import, and the `currentYear` variable.

New content:
```tsx
export default function LandingFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-white text-lg sm:text-xl font-semibold mb-2">
          congdongvang.com
        </p>
        <p className="text-sm sm:text-base mb-2">
          Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài
          chính
        </p>
        <p className="text-sm whitespace-nowrap">
          Liên hệ quảng cáo : 076.897.2512
        </p>
      </div>
    </footer>
  );
}
```

Key decisions:
- Dark background (`bg-gray-900`) consistent with existing footer style
- Centered text (`text-center`) per spec: "centered text, clean typography"
- `whitespace-nowrap` on phone number line per spec edge case
- Responsive text sizing: `text-lg sm:text-xl` for community name
- Removed `"use client"` — no hooks, no browser APIs, can be a server component
- Removed all imports (`Link`, `useTranslations`) — no longer needed
- Be Vietnam Pro font inherited from root layout — no explicit font class needed

**Step 2: Verify the component renders correctly**

```bash
cd src/wj-client && npx next build 2>&1 | head -30
```

Verify no build errors from the simplified component.

**Step 3: Commit**

```
feat(landing): replace footer with congdongvang.com branding
```

---

### Task 2: Import LandingFooter into landing page

**Files:**
- Modify: `src/wj-client/app/[locale]/landing/page.tsx` (add import + render)

**Security notes:** None — adding a static component to an existing page.

**Step 1: Add import and render footer**

Add the import at the top of the file (after existing landing component imports):
```tsx
import LandingFooter from "@/components/landing/LandingFooter";
```

Add `<LandingFooter />` inside the layout, after the closing `</main>` tag (line 73) and before the closing `</div>` (line 74):
```tsx
        </main>
        <LandingFooter />
      </div>
```

This places the footer below the main content but inside the `LandingErrorBoundary` and the scroll container div with `min-h-screen bg-neutral-50`.

Note: Remove `pb-24` from the mobile layout div (line 49: `className="sm:hidden px-4 py-4 pb-24 space-y-6"`) since the footer now provides bottom spacing. Change to `className="sm:hidden px-4 py-4 pb-8 space-y-6"`.

**Step 2: Verify build**

```bash
cd src/wj-client && npx next build 2>&1 | head -30
```

**Step 3: Commit**

```
feat(landing): add footer to landing page
```

---

## Acceptance Criteria Checklist

| Criteria | Task | Verification |
|----------|------|-------------|
| Footer renders all three lines | Task 1 | Visual check / build success |
| congdongvang.com is plain text (not clickable) | Task 1 | No `<a>` or `<Link>` wrapping it |
| Footer visible on mobile and desktop | Task 1 | Responsive classes (`sm:` variants) |
| Vietnamese text renders correctly | Task 1 | Be Vietnam Pro loaded in root layout |
| Footer appears at bottom of landing page | Task 2 | Placed after `</main>` |
| Footer does not overlap with other content | Task 2 | Reduced `pb-24` to `pb-8` on mobile |
