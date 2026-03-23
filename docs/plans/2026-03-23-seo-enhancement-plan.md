# SEO Enhancement Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Improve congdongvang.com from ~35/100 SEO score to 80+ by adding robots.txt, sitemap.xml, Vietnamese metadata, hreflang, JSON-LD structured data, OG image, noindex on private pages, and SSR for the landing page.

**Spec:** `docs/specs/2026-03-23-seo-enhancement-spec.md`

**Architecture:** Frontend-only changes to the Next.js 15 App Router. No backend changes, no new API endpoints, no database migrations. Uses existing public endpoints (`/api/v1/public/market-types`, `/api/v1/public/site-settings`) for SSR data fetching. The landing page will be converted from a fully client-side component to a server component with ISR, while interactive charts remain as `"use client"` children.

**Tech Stack:** Next.js 15 (App Router metadata API, `robots.ts`, `sitemap.ts`, ISR), TypeScript, next-intl, Tailwind CSS

## Security Implementation Notes

- **Authentication:** No changes — all affected pages are public (landing) or already auth-protected (dashboard)
- **Authorization:** No new endpoints. Dashboard noindex is additive protection only.
- **Input validation:** No new user inputs. Admin SEO settings already validated by existing backend handler.
- **Data sanitization:** JSON-LD content is hardcoded or from admin settings. Next.js escapes meta tag content and `<script>` content by default. No XSS vector.

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| LandingGoldPriceTable | `components/landing/LandingGoldPriceTable.tsx` | SSR: receives data as props instead of hook |
| LandingGoldPriceChart | `components/landing/LandingGoldPriceChart.tsx` | Remains "use client" child |
| LandingSilverPriceTable | `components/landing/LandingSilverPriceTable.tsx` | SSR: receives data as props |
| LandingSilverPriceChart | `components/landing/LandingSilverPriceChart.tsx` | Remains "use client" child |
| LandingCurrencyPriceTable | `components/landing/LandingCurrencyPriceTable.tsx` | SSR: receives data as props |
| LandingDollarIndexChart | `components/landing/LandingDollarIndexChart.tsx` | Remains "use client" child |
| LandingNavbar | `components/landing/LandingNavbar.tsx` | Unchanged |
| LandingFooter | `components/landing/LandingFooter.tsx` | Unchanged |
| LandingHero | `components/landing/LandingHero.tsx` | H1 text comes from i18n (updated) |
| LandingErrorBoundary | `components/landing/LandingErrorBoundary.tsx` | Wraps SSR page for fallback |
| SentimentCard | `components/GoldSentimentCard.tsx` | Remains "use client" child |
| OrnateDivider | `components/decorative/OrnateDivider.tsx` | Unchanged |
| OptimizedImage | `components/OptimizedImage.tsx` | Available if needed for image optimization |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| `JsonLd` | `components/seo/JsonLd.tsx` | Server component to render JSON-LD `<script>` tags. Keeps structured data logic separate from layout. Reusable across pages (landing now, potentially blog later). No existing component handles this. |

## C4 Architecture Diagram Updates

No structural changes to the architecture — no new pages, feature modules, or API endpoints. Only modifications to existing files and addition of utility files (robots.ts, sitemap.ts, JsonLd.tsx). The L3 frontend diagram does not need updating since no new bounded contexts or major components are added.

**Skip Task 0** — No C4 diagram updates needed.

## Runtime Flow Diagrams

No new multi-step business logic or API endpoints. The SSR conversion changes data fetching from client-side to server-side, but this is a standard Next.js ISR pattern, not a complex flow requiring documentation.

**Skip Task N-1 (flow diagrams)** — Simple CRUD/fetch with no branching or multi-service coordination.

---

### Task 1: Create `robots.ts`

**Files:**

- Create: `src/wj-client/app/robots.ts`

**Security notes:** Ensure dashboard and auth paths are disallowed to prevent accidental indexation of private pages. Use dynamic locale list from `i18n/request.ts` to future-proof.

**Step 1: Write the robots.ts file**

Create `app/robots.ts` using Next.js App Router convention:

```typescript
import type { MetadataRoute } from "next";
import { locales } from "@/i18n/request";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://www.congdongvang.com";

  // Generate disallow rules for all locales
  const disallowPaths = locales.flatMap((locale) => [
    `/${locale}/dashboard/`,
    `/${locale}/auth/`,
  ]);

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: disallowPaths,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

**Step 2: Verify output**

```bash
cd src/wj-client && npx next build 2>&1 | head -20
# Or test locally: curl http://localhost:3000/robots.txt
```

Expected: Valid robots.txt with Disallow for `/vi/dashboard/`, `/en/dashboard/`, `/vi/auth/`, `/en/auth/`, and Sitemap reference.

**Step 3: Commit**

---

### Task 2: Create `sitemap.ts`

**Files:**

- Create: `src/wj-client/app/sitemap.ts`

**Security notes:** Only include public pages. Never include dashboard or auth URLs.

**Step 1: Write the sitemap.ts file**

```typescript
import type { MetadataRoute } from "next";
import { locales } from "@/i18n/request";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.congdongvang.com";

  const entries: MetadataRoute.Sitemap = [];

  // Root redirect page
  entries.push({
    url: baseUrl,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.5,
  });

  // Landing pages for each locale
  for (const locale of locales) {
    entries.push({
      url: `${baseUrl}/${locale}/landing`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: locale === "vi" ? 1.0 : 0.8,
    });
  }

  return entries;
}
```

**Step 2: Verify output**

```bash
# Test locally: curl http://localhost:3000/sitemap.xml
```

Expected: Valid XML sitemap with 3 URLs (root, /vi/landing, /en/landing). No dashboard/auth URLs.

**Step 3: Commit**

---

### Task 3: Fix Title, Description, and Canonical URL to Vietnamese

**Files:**

- Modify: `src/wj-client/app/[locale]/landing/layout.tsx`

**Security notes:** Ensure no script injection through hardcoded meta content. Next.js escapes meta values by default — safe.

**Step 1: Update FALLBACK_METADATA**

Update the following fields in `FALLBACK_METADATA`:

- **title:** `"Giá Vàng Hôm Nay | Cộng Đồng Vàng - Quản Lý Tài Chính Cá Nhân"`
- **description:** `"Theo dõi giá vàng SJC, DOJI, giá bạc, ngoại tệ trực tiếp. Quản lý tài chính cá nhân, theo dõi danh mục đầu tư vàng, cổ phiếu, crypto miễn phí tại congdongvang.com"`
- **keywords:** Add Vietnamese keywords: `"giá vàng hôm nay"`, `"cộng đồng vàng"`, `"cộng đồng đầu tư"`, `"quản lý tài chính cá nhân"`, `"giá vàng SJC"`, `"giá bạc"`, `"đầu tư vàng"`, `"theo dõi danh mục đầu tư"` (prepend to existing list)
- **canonical:** Change `https://congdongvang.com` → `https://www.congdongvang.com` (all 3 occurrences: alternates.canonical, openGraph.url, dynamic fallback)
- **openGraph.title:** Match new Vietnamese title
- **openGraph.description:** Match new Vietnamese description
- **twitter.title:** Match new Vietnamese title
- **twitter.description:** Match new Vietnamese description

**Step 2: Update generateMetadata dynamic fallbacks**

Ensure the dynamic `generateMetadata()` function also uses `https://www.congdongvang.com` for the OG URL fallback (line 112).

**Step 3: Verify**

Build and check that the HTML `<head>` contains Vietnamese title and `www` canonical.

**Step 4: Commit**

---

### Task 4: Add Hreflang Tags

**Files:**

- Modify: `src/wj-client/app/[locale]/landing/layout.tsx`

**Security notes:** None — hreflang tags are informational for crawlers.

**Step 1: Add alternates.languages to FALLBACK_METADATA**

Add to the `alternates` section:

```typescript
alternates: {
  canonical: "https://www.congdongvang.com/vi/landing",
  languages: {
    "vi": "https://www.congdongvang.com/vi/landing",
    "en": "https://www.congdongvang.com/en/landing",
    "x-default": "https://www.congdongvang.com/vi/landing",
  },
},
```

**Step 2: Update generateMetadata to include languages**

Add the same `languages` map to the dynamic metadata return.

**Step 3: Verify hreflang tags in HTML output**

Expected: `<link rel="alternate" hreflang="vi" href="...">` tags in `<head>`.

**Step 4: Commit**

---

### Task 5: Create JSON-LD Structured Data Component

**Files:**

- Create: `src/wj-client/components/seo/JsonLd.tsx`
- Modify: `src/wj-client/app/[locale]/landing/layout.tsx` (import and render)

**Security notes:** JSON-LD is rendered as `<script type="application/ld+json">`. Content is hardcoded — no user input. Next.js `dangerouslySetInnerHTML` is safe here because the data is developer-controlled, not user-supplied.

**Step 1: Create JsonLd server component**

```typescript
// components/seo/JsonLd.tsx
// Server component — no "use client"

interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export function JsonLd({ data }: JsonLdProps) {
  const schemas = Array.isArray(data) ? data : [data];
  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
```

**Step 2: Define structured data schemas**

Create a helper in the same file or inline in layout:

1. **Organization** — `@type: "Organization"`, name: "Cộng Đồng Vàng", url, logo
2. **WebSite** — `@type: "WebSite"`, name: "congdongvang.com", url, inLanguage: "vi"
3. **SoftwareApplication** — `@type: "SoftwareApplication"`, name, category: "FinanceApplication", offers: { price: "0", priceCurrency: "VND" }
4. **FAQPage** — `@type: "FAQPage"` with Q&A items from the comparison section
5. **FinancialProduct** — `@type: "FinancialProduct"`, description of gold/silver tracking

**Step 3: Render in landing layout**

Update `layout.tsx` to render `<JsonLd data={schemas} />` inside the layout wrapper:

```typescript
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={landingSchemas} />
      {children}
    </>
  );
}
```

**Step 4: Validate**

Check HTML output for valid `<script type="application/ld+json">` blocks.

**Step 5: Commit**

---

### Task 6: Design and Create OG Image

**Files:**

- Create: `src/wj-client/public/og-image.png` (1200x630)
- Modify: `src/wj-client/app/[locale]/landing/layout.tsx` (change `.svg` → `.png` references)

**Security notes:** Static image — no security concerns.

**Step 1: Design OG image using Pencil MCP**

Design a 1200x630 PNG with:
- Brand colors: gold `#d2a74b`, dark red `#5F0202`
- Brand name: "congdongvang.com"
- Tagline in Vietnamese: "Cộng Đồng Vàng - Quản Lý Tài Chính Cá Nhân"
- Clean, professional layout suitable for social sharing

**Step 2: Export and optimize**

Export as PNG, optimize to < 500KB. Place at `public/og-image.png`.

**Step 3: Update metadata references**

Change all `/og-image.svg` references to `/og-image.png` in:
- `FALLBACK_METADATA.openGraph.images`
- `FALLBACK_METADATA.twitter.images`
- Dynamic `generateMetadata()` fallbacks

**Step 4: Commit**

---

### Task 7: Add noindex to Dashboard and Auth Pages

**Files:**

- Modify: `src/wj-client/app/[locale]/auth/layout.tsx`
- Create: `src/wj-client/app/[locale]/dashboard/seo-layout.tsx` (or use `<meta>` tag approach)

**Security notes:** This is additive protection — prevents search engines from indexing private pages. Belt-and-suspenders with robots.txt disallow rules.

**Step 1: Add metadata to auth layout**

The auth layout is a server component — add metadata export directly:

```typescript
import { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};
```

**Step 2: Handle dashboard layout (client component)**

The dashboard layout is `"use client"` — cannot export metadata. Options:

**Option A (recommended):** Create a server-side parent layout that exports metadata, then nests the existing client layout:
- Create `app/[locale]/dashboard/metadata.tsx` — NO, this won't work with App Router.
- Better: Add a `<meta>` tag directly in the client component's return JSX:

```tsx
// In dashboard layout.tsx, add to the return JSX:
<head>
  <meta name="robots" content="noindex, nofollow" />
</head>
```

**Option B:** Create `app/[locale]/dashboard/template.tsx` as a server component with metadata — but template.tsx also doesn't support metadata export.

**Option C (simplest, correct):** Move the metadata into a separate server layout file. Create `app/[locale]/dashboard/layout.tsx` as server wrapper that imports the client layout component. But this requires refactoring the existing 749-line file.

**Recommended approach:** Use `<meta>` tag injection via Next.js `<head>` component in the client layout. In Next.js App Router, you can use the `metadata` built-in by creating a new file `app/[locale]/dashboard/not-found.tsx` — NO.

**Final approach:** The simplest and most maintainable approach is to use Next.js `Metadata` by splitting the dashboard layout into a thin server layout + client component:

1. Rename `app/[locale]/dashboard/layout.tsx` → `app/[locale]/dashboard/DashboardLayout.tsx` (client component)
2. Create new `app/[locale]/dashboard/layout.tsx` (server component) that exports metadata and renders `<DashboardLayout>{children}</DashboardLayout>`

This is a clean separation. The metadata is handled server-side, the UI remains client-side.

**Step 3: Verify**

Check HTML `<head>` for `<meta name="robots" content="noindex, nofollow">` on dashboard and auth pages.

**Step 4: Commit**

---

### Task 8: Convert Landing Page to SSR with ISR

**Files:**

- Modify: `src/wj-client/app/[locale]/landing/page.tsx` (remove "use client", server-side fetch)
- Create: `src/wj-client/app/[locale]/landing/LandingContent.tsx` (client component for interactive parts)

**Security notes:** Server-side fetch to own backend API — no SSRF risk (hardcoded internal URL). Price data is public, no sensitive information exposed. Validate API response structure before rendering.

**Step 1: Create server-side fetch function**

In `page.tsx`, add a server-side fetch with ISR:

```typescript
import { PublicMarketTypesResponse } from "@/features/market-prices/hooks/usePublicMarketTypes";

async function fetchMarketTypes(): Promise<PublicMarketTypesResponse | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "";
    const res = await fetch(`${apiUrl}/api/v1/public/market-types`, {
      next: { revalidate: 300 }, // 5-minute ISR
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success) return null;
    return data;
  } catch {
    return null;
  }
}
```

**Step 2: Extract client-only parts to LandingContent.tsx**

Move the interactive rendering (charts, sentiment cards, error/retry logic) to a `"use client"` child component. The page itself becomes a server component that passes pre-fetched data as props.

```typescript
// page.tsx (server component — no "use client")
export default async function LandingPage() {
  const data = await fetchMarketTypes();
  return <LandingContent initialData={data} />;
}
```

```typescript
// LandingContent.tsx ("use client")
// Contains existing page logic but receives initialData as prop
// Falls back to client-side fetch if initialData is null
```

**Step 3: Verify SSR output**

```bash
# View HTML source — price data should be visible
curl -s http://localhost:3000/vi/landing | grep -o "SJC\|gold\|vàng" | head -5
```

Expected: Price table data visible in initial HTML response (not behind JS hydration).

**Step 4: Test error handling**

Verify that when the API is unreachable during ISR, the page still serves stale cached HTML.

**Step 5: Commit**

---

### Task 9: Update H1 Text in i18n Messages

**Files:**

- Modify: `src/wj-client/messages/vi/nav.json`
- Modify: `src/wj-client/messages/en/nav.json`

**Security notes:** None — i18n string change only.

**Step 1: Update Vietnamese H1**

In `messages/vi/nav.json`, update:
```json
"hero": {
  "title": "congdongvang.com - Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính"
}
```

**Step 2: Update English H1**

In `messages/en/nav.json`, update:
```json
"hero": {
  "title": "congdongvang.com - A Community for Sharing Knowledge About Financial Investment Markets"
}
```

**Step 3: Check visual rendering**

The longer text may need responsive font size adjustment in `LandingHero.tsx`. Current classes: `text-3xl sm:text-4xl md:text-5xl lg:text-6xl`. May need to reduce to `text-2xl sm:text-3xl md:text-4xl lg:text-5xl` if the text overflows.

**Step 4: Commit**

---

### Task 10: Improve Image Alt Texts

**Files:**

- Modify: `src/wj-client/components/landing/LandingNavbar.tsx` (line 83)
- Modify: `src/wj-client/components/landing/LandingHero.tsx` (line 59)
- Modify: `src/wj-client/app/[locale]/auth/layout.tsx` (lines 17, 27)

**Security notes:** None — alt text changes only.

**Step 1: Update alt texts**

| File | Current Alt | New Alt |
|------|------------|---------|
| `LandingNavbar.tsx:83` | `"congdongvang.com"` | `"Logo congdongvang.com - Cộng đồng đầu tư tài chính"` |
| `LandingHero.tsx:59` | `"dashboard"` | `"Bảng điều khiển quản lý tài chính congdongvang.com"` |
| `auth/layout.tsx:17` | `"Logo"` | `"Logo congdongvang.com - Cộng đồng đầu tư tài chính"` |
| `auth/layout.tsx:27` | `"Login picture"` | `"Minh họa đăng nhập congdongvang.com"` |

**Step 2: Add aria-labels to chart components** (if applicable)

Check if chart components in `components/landing/` need aria-labels. Charts are typically wrapped in containers — add `aria-label` to the wrapper div.

**Step 3: Commit**

---

### Task 11: Add Preconnect to API Domain

**Files:**

- Modify: `src/wj-client/app/[locale]/layout.tsx`

**Security notes:** None — preconnect is a performance hint only.

**Step 1: Add preconnect link**

In the locale layout's `<head>` section, add:

```tsx
{process.env.NEXT_PUBLIC_API_URL && (
  <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL} />
)}
```

**Step 2: Verify in HTML output**

Check that `<link rel="preconnect" href="...">` appears in the `<head>`.

**Step 3: Commit**

---

### Task 12: Phase 4 Documentation (No Code)

**Files:**

- Verify: `docs/specs/2026-03-23-seo-enhancement-spec.md` (Phase 4 section already documented)

**Step 1: Verify Phase 4 roadmap is complete in spec**

The spec already contains P4-1 through P4-6. No additional code changes needed.

**Step 2: Commit** (skip if no changes)

---

## Task Dependency Order

```
Task 1 (robots.ts)         ─┐
Task 2 (sitemap.ts)         ├─ Independent, can run in parallel
Task 3 (title/desc/canon)   │
Task 4 (hreflang)          ─┘ Depends on Task 3 (modifies same file)
Task 5 (JSON-LD)            ─ Independent (new file + layout modification)
Task 6 (OG image)           ─ Independent (new file + layout modification)
Task 7 (noindex)            ─ Independent
Task 8 (SSR/ISR)            ─ Independent (major refactor of page.tsx)
Task 9 (H1 text)            ─ Independent (i18n files only)
Task 10 (alt texts)         ─ Independent (component modifications)
Task 11 (preconnect)        ─ Independent (locale layout modification)
Task 12 (docs)              ─ Independent (no code)
```

**Recommended execution order:**

1. **Tasks 1-2** (robots + sitemap) — Quick wins, independent files
2. **Tasks 3-4** (metadata + hreflang) — Same file, do together
3. **Task 5** (JSON-LD) — New component + layout integration
4. **Task 6** (OG image) — Design + metadata update
5. **Task 7** (noindex) — Dashboard/auth layout changes
6. **Task 8** (SSR/ISR) — Largest change, most risk
7. **Tasks 9-11** (H1, alt texts, preconnect) — Small changes, low risk
8. **Task 12** (docs) — Verify only

**Parallel-safe groups:**
- Group A: Tasks 1, 2 (different new files)
- Group B: Tasks 9, 10, 11 (different files, no overlap)
- All other tasks modify `landing/layout.tsx` and should be sequential

## Estimated Scope

- **Total tasks:** 12 (11 code + 1 doc verification)
- **New files:** 4 (`robots.ts`, `sitemap.ts`, `JsonLd.tsx`, `LandingContent.tsx`)
- **Modified files:** ~8 (`landing/layout.tsx`, `landing/page.tsx`, `auth/layout.tsx`, `dashboard/layout.tsx`, `[locale]/layout.tsx`, 2 nav.json files, landing components)
- **Backend changes:** 0
- **Database changes:** 0
- **Risk level:** Medium (SSR refactor in Task 8 is the riskiest)
