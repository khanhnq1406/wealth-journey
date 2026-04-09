# Fix OG Image Not Rendering on Share — Specification

## Summary

When sharing a congdongvang.com URL on social media or messaging apps (Facebook, Zalo, iMessage, WhatsApp, LinkedIn, Twitter/X), the link preview shows no image. The root cause is two-fold: (1) the OG image is served as an SVG file (`/og-image.svg`), which is not supported by any major social crawler — they require PNG or JPEG; (2) the image URL in metadata is relative without a `metadataBase` set on the affected layouts, meaning crawlers may not resolve the absolute URL correctly.

The fix is delivered in two phases in the same task: **Phase 1** ships a static PNG immediately (lowest risk, fastest fix); **Phase 2** replaces it with a dynamic Next.js `opengraph-image.tsx` route using `ImageResponse` from `next/og`, which auto-injects the correct absolute URL and enables future per-locale/per-page image variants.

## User Stories

- As a user sharing the congdongvang.com landing page on Facebook/Zalo/iMessage, I want to see a branded image preview so that my shared link looks professional and trustworthy.
- As a user sharing the guide page URL, I want the link preview to show the congdongvang.com OG image so that recipients understand what the link is about before clicking.

## Functional Requirements

### FR-1: Static PNG OG Image (Phase 1)

Add a static PNG file `public/og-image.png` (1200×630px) that is visually equivalent to the current SVG design — dark maroon gradient background, gold text, decorative corner elements. This PNG is the immediate fix and is kept as a fallback even after Phase 2.

**Acceptance criteria:**
- [ ] `public/og-image.png` exists, dimensions exactly 1200×630px
- [ ] PNG file size ≤ 300KB (compress with `pngquant` or `sharp` if needed)
- [ ] Design matches the existing SVG: dark maroon background (`#3D0101`→`#5F0202`), gold brand name, tagline text, decorative elements
- [ ] (Phase 1 only) `og:image` meta tag resolves to this PNG with an absolute URL

**How to generate the PNG:** Use a Node.js script with `sharp` + `@resvg/resvg-js` to render the SVG to PNG, or use the `opengraph-image.tsx` route itself (Phase 2) to export the PNG once at build time. Do not add `inkscape` as a build dependency.

### FR-2: Absolute OG Image URL + `metadataBase` (Phase 1)

Update all metadata that references `/og-image.svg` to use the absolute PNG URL, and add `metadataBase` to the root layout as a safety net.

Affected files:
- `app/layout.tsx` — add `metadataBase: new URL("https://www.congdongvang.com")`
- `app/[locale]/landing/layout.tsx` — update `FALLBACK_METADATA` and `generateMetadata()`: replace `/og-image.svg` with `https://www.congdongvang.com/og-image.png` in both `openGraph.images` and `twitter.images`. Always use the hardcoded absolute URL — do NOT pass through `settings["seo.og_image"]` for the image field since the DB value may still be the old SVG path.
- `app/[locale]/guide/layout.tsx` — same replacement

**Acceptance criteria:**
- [ ] `app/layout.tsx` has `metadataBase: new URL("https://www.congdongvang.com")`
- [ ] `og:image` in landing page HTML = `https://www.congdongvang.com/og-image.png`
- [ ] `og:image` in guide page HTML = `https://www.congdongvang.com/og-image.png`
- [ ] `twitter:image` in both pages = same absolute PNG URL
- [ ] No `metadataBase` warning in `next build` output

### FR-3: Dynamic `opengraph-image.tsx` Route (Phase 2)

Create Next.js file-convention OG image routes using `ImageResponse` from `next/og`. These routes render JSX → PNG on-demand at the Edge, with the correct absolute URL auto-injected by Next.js — no manual `openGraph.images` config needed.

**Files to create:**

| Route | File | Serves |
| ----- | ---- | ------ |
| Landing page | `app/[locale]/landing/opengraph-image.tsx` | `/vi/landing/opengraph-image`, `/en/landing/opengraph-image` |
| Guide page | `app/[locale]/guide/opengraph-image.tsx` | `/vi/guide/opengraph-image`, `/en/guide/opengraph-image` |

**Each file must export:**
```ts
export const runtime = "edge";
export const alt = "...";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image({ params }: { params: { locale: string } }) { ... }
```

**Design (JSX, Satori-compatible):** Port the existing SVG design to JSX with inline styles:
- Background: `background: "linear-gradient(135deg, #3D0101, #5F0202)"` on a full-size `<div>`
- Top/bottom gold accent bars: 4px `<div>` with `background: "linear-gradient(90deg, #b8862d, #f0d078, #b8862d)"`
- Decorative corner L-shapes: absolute-positioned `<div>` elements (4px wide/tall, gold, 0.4 opacity)
- Brand name: `congdongvang.com` in large bold text, gold gradient simulated via solid `#d2a74b`
- Tagline: `Cộng Đồng Vàng` in gold
- Subtitle: Vietnamese subtitle text, lighter gold
- Feature badges row: `Giá Vàng · Giá Bạc · Ngoại Tệ · Đầu Tư · Miễn Phí`

**Font loading:** Roboto is loaded via `next/font/google` in the app but is not available to Edge functions directly. Load it at render time:
```ts
const robotoFont = await fetch(
  new URL("https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Mu4mxK.woff2")
).then((res) => res.arrayBuffer());
```
Use `fonts: [{ name: "Roboto", data: robotoFont, weight: 700 }]` in `ImageResponse` options. As a simpler fallback, system-safe fonts (`Arial`, `sans-serif`) can be used without loading — acceptable given Satori's font rendering is for OG images only.

**After Phase 2 is done:** Remove `openGraph.images` and `twitter.images` entries from `landing/layout.tsx` and `guide/layout.tsx` — Next.js will auto-inject the correct `og:image` tag from the file convention. Keep `metadataBase` in root layout.

**Acceptance criteria:**
- [ ] `GET /vi/landing/opengraph-image` returns `Content-Type: image/png`, 1200×630
- [ ] `GET /en/landing/opengraph-image` returns the same (locale param accepted)
- [ ] `GET /vi/guide/opengraph-image` returns `Content-Type: image/png`, 1200×630
- [ ] `og:image` in landing page HTML auto-points to the absolute `/vi/landing/opengraph-image` URL (no manual images array needed)
- [ ] No manual `openGraph.images` or `twitter.images` entry needed in the layout after the file convention is in place
- [ ] Image visually matches the `og-image.png` design (dark maroon background, gold text)
- [ ] Edge runtime — no Node.js APIs used inside the image route

## Non-Functional Requirements

- **Performance:** Static PNG ≤ 300KB. Dynamic `ImageResponse` must respond within 1s (Edge, no DB calls).
- **Correctness:** Both static and dynamic images must pass Facebook Sharing Debugger without warnings.
- **Graceful degradation:** If `ImageResponse` throws (e.g., font fetch fails), it must not crash the page metadata — the static PNG fallback in `public/` handles this.
- **No regressions:** Existing metadata (title, description, canonical, keywords, JSON-LD) must remain unchanged.

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-frontend.md` (L3):** Add `opengraph-image.tsx` as a new Edge Route component under the `app/[locale]/landing/` and `app/[locale]/guide/` sections.

### New Diagrams

None — this is frontend-only with no new backend components or domain models.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — `opengraph-image.tsx` is a static Edge render triggered by crawler crawl, not an interactive user flow.

### New Flow Diagrams

None — simple single-step: crawler requests URL → Edge function renders JSX → returns PNG.

## Data Model Changes

None.

## API Changes

Two new public Edge endpoints (auto-created by Next.js file convention, no manual routing needed):

| Endpoint | Method | Auth | Response |
| -------- | ------ | ---- | -------- |
| `/[locale]/landing/opengraph-image` | GET | None (public) | `image/png` 1200×630 |
| `/[locale]/guide/opengraph-image` | GET | None (public) | `image/png` 1200×630 |

No backend changes.

## UI/UX Changes

No visible in-app UI changes. The OG image is only shown in external link previews.

### Existing Component Inventory

| Need | Existing Component | Location |
| ---- | ------------------ | -------- |
| OG image file | `og-image.svg` → add `og-image.png` alongside | `public/` |
| Dynamic image route | NEW — no existing pattern | `app/[locale]/landing/opengraph-image.tsx` |

### New Components

| Component | Location | Justification |
| --------- | -------- | ------------- |
| `opengraph-image.tsx` (landing) | `app/[locale]/landing/` | Next.js file convention for dynamic OG PNG generation |
| `opengraph-image.tsx` (guide) | `app/[locale]/guide/` | Same pattern for guide page |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
| - | ------ | ---- | ----------------------- | ----------- | ----- |
| 1 | `public/og-image.png` | Static PNG file | No | Social crawler | Served by Vercel CDN |
| 2 | HTML `<meta og:image>` | Absolute image URL string | Yes: App → Internet | Social crawler | Hardcoded URL, no user input |
| 3 | Social crawler | `GET /[locale]/landing/opengraph-image` | Yes: Internet → Edge | `ImageResponse` handler | No user input parsed — only `locale` from path |
| 4 | Google Fonts CDN | Roboto font binary (woff2) | Yes: External → Edge | `ImageResponse` renderer | Font loaded at render time |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
| -------- | ---------- | ---------------- |
| Internet → App | Crawler GET on opengraph-image route | No auth required (public). `locale` param validated against allowlist. |
| App → External | Font fetch from `fonts.gstatic.com` | Read-only fetch, no secrets, timeout needed |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
| - | --------- | -------- | ------ | ------ | -------- | ---------- |
| T-1 | 3 | Internet → Edge | DoS | OG image route bombarded with requests, causing Edge function invocation cost spike | Low | Vercel Edge caching — Next.js `opengraph-image.tsx` routes are cached by default. Add `export const revalidate = 86400` (24h cache). |
| T-2 | 3 | Internet → Edge | Tampering | Attacker passes invalid `locale` value trying path traversal | Low | Validate `locale` against `["vi", "en"]` allowlist; return default image for unknown locales (never use locale in file paths or external URLs) |
| T-3 | 4 | External → Edge | Info Disclosure / Supply Chain | Malicious font file from Google Fonts CDN | Very Low | Google Fonts is a trusted CDN; font binary is only used for Satori rendering, not executed. Use `arrayBuffer()` only. |

No authentication, financial data, or user-specific content involved. Security surface is minimal.

### Authorization Rules

Not applicable — OG image routes are public assets, no auth required.

### Input Validation Rules

| Input | Source | Validation |
| ----- | ------ | ---------- |
| `locale` path param | URL path | Validate against `["vi", "en"]`; use `"vi"` as default for unknown values |

### External Dependency Risks

| Dependency | Use | Risk | Mitigation |
| ---------- | --- | ---- | ---------- |
| `next/og` (`ImageResponse`) | Built into Next.js 16.2 | None — already a dependency | N/A |
| Google Fonts CDN (`fonts.gstatic.com`) | Load Roboto font at Edge render time | Font fetch failure → `ImageResponse` throws | Wrap in try/catch; fall back to `sans-serif` (no font array) if fetch fails |

### Sensitive Data Handling

None — OG image contains only public branding text. No user data, no financial data.

### Issues & Risks Summary

1. **Font fetch latency:** Fetching Roboto from Google Fonts at Edge render time adds ~50–200ms on first render. Mitigated by Vercel Edge caching (the image is cached after first render).
2. **Satori CSS subset:** Satori does not support all CSS. `linear-gradient` on text is not supported — use solid gold color for text instead. No `border-radius` on certain layouts, no `overflow: hidden` on flex containers. Test visually after implementation.
3. **SVG animation lost in static PNG:** The `<animate>` element in the SVG won't carry over. Static frame is captured — this is acceptable for an OG image.
4. **Phase 1 → Phase 2 transition:** After creating `opengraph-image.tsx`, the manual `openGraph.images` in `layout.tsx` must be removed to avoid duplicate `og:image` tags in the HTML head.

## Edge Cases & Error Handling

- **`ImageResponse` throws:** Wrap the entire `Image()` function in try/catch; return a minimal fallback `ImageResponse` with just the brand name on a dark background — never let it crash and return a 500 (which would make the OG image tag broken).
- **Font fetch fails:** Catch the font fetch error; call `ImageResponse` without the `fonts` option — Satori will use a system sans-serif. The image still renders, just without Roboto.
- **Unknown locale:** If `params.locale` is not `"vi"` or `"en"`, render with Vietnamese text (default).
- **Crawler cache:** After Phase 1 deploy, force-refresh via Facebook Sharing Debugger "Scrape Again". Twitter/X updates naturally within 7 days.
- **`og-image.svg` retained:** Do not delete the SVG file — keep it in `public/` as a source-of-truth for future design updates and to avoid 404s on any cached old URLs.

## Dependencies & Assumptions

- Next.js 16.2 — `next/og` (`ImageResponse`) built in, Edge runtime supported on Vercel ✓
- Vercel deployment — Edge functions supported; `opengraph-image.tsx` cached automatically ✓
- Production domain `https://www.congdongvang.com` confirmed from existing metadata ✓
- Roboto available on `fonts.gstatic.com` — Google Fonts CDN is reliable; fallback to sans-serif if unavailable ✓
- No new `npm` packages needed — `next/og` is already bundled with Next.js ✓

## Out of Scope

- Per-page dynamic OG images with real data (e.g., portfolio share image showing user's PNL) — separate feature
- OG images for dashboard/auth pages (those are `robots: noindex`, crawlers don't visit them)
- Backend changes to `site-settings` API or database values
- Twitter `twitter:image` custom route (Twitter/X also reads `og:image` — the same route works for both)
