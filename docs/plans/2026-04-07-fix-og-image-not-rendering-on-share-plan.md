# Fix OG Image Not Rendering on Share — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix social media link previews for congdongvang.com by replacing the unsupported SVG OG image with a static PNG (Phase 1) and then a dynamic Next.js Edge `opengraph-image.tsx` route (Phase 2).
**Spec:** `docs/specs/2026-04-07-fix-og-image-not-rendering-on-share-spec.md`
**Architecture:** Frontend-only change. Phase 1 adds a static PNG and fixes metadata URLs. Phase 2 adds Edge `opengraph-image.tsx` routes that use `next/og` `ImageResponse` to generate PNGs on-demand — these are auto-registered by Next.js file convention with no manual routing required.
**Tech Stack:** Next.js 16.2, `next/og` (ImageResponse, built-in), TypeScript, Vercel Edge Runtime, Node.js script (Sharp or resvg-js) for PNG generation.

---

## Security Implementation Notes

- **Authentication:** Not applicable — OG image routes are public assets, no auth required.
- **Authorization:** Not applicable — public asset endpoints.
- **Input validation:** `locale` path parameter in `opengraph-image.tsx` must be validated against `["vi", "en"]` allowlist. Unknown values fall back to `"vi"`.
- **Data sanitization:** No user input rendered in the image — only hardcoded brand text. No XSS surface.
- **Edge runtime safety:** No Node.js APIs (fs, crypto, etc.) inside Edge routes. Font fetch wrapped in try/catch with fallback to `sans-serif`.
- **External dependency:** Google Fonts CDN fetch at Edge render time — wrap in try/catch, fallback to no-font option (Satori renders with system font).
- **Cache:** `export const revalidate = 86400` on OG routes — 24h Edge cache prevents DoS cost spikes.

---

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| N/A | N/A | This feature creates `opengraph-image.tsx` routes and modifies layout metadata — no shared UI components involved |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| `opengraph-image.tsx` (landing) | `app/[locale]/landing/` | Next.js file-convention OG image route — no existing pattern in codebase |
| `opengraph-image.tsx` (guide) | `app/[locale]/guide/` | Same pattern for guide page — identical design, same Edge runtime |

---

## C4 Architecture Diagram Updates

- **`docs/architecture/c4-component-frontend.md` (L3):** Add `opengraph-image.tsx` as a new Edge Route component under the `Landing Page` and `Guide Page` layout sections. Describe it as a public Edge route that renders JSX → PNG using `ImageResponse` from `next/og`, served by Vercel Edge Network.

---

### Task 0: Update C4 Architecture Diagram

**Files:**

- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Read the existing diagram to find the Landing Page and Guide Page component sections.
2. Add `opengraph-image.tsx` as a new Edge Route node under each section, with a description: "Next.js file-convention Edge route; renders JSX → PNG via ImageResponse for social media crawlers."
3. Commit: `docs(c4): add opengraph-image edge routes to frontend component diagram`

---

### Task 1: Generate Static PNG OG Image (`public/og-image.png`)

> Phase 1, Step 1 — create the immediate fix PNG.

**Files:**

- Create: `src/wj-client/scripts/generate-og-image.mjs`
- Create: `src/wj-client/public/og-image.png` (generated artifact, committed to repo)

**Security notes:** Script runs at build/dev time only, not in the Edge runtime. No user input.

**Step 1: Write the failing test**

There is no unit test for a static PNG file — the "test" here is a build-time assertion. Write a Jest test that verifies the PNG exists and has the correct dimensions:

```typescript
// src/wj-client/__tests__/og-image-png.test.ts
import * as fs from "fs";
import * as path from "path";

describe("OG Image PNG", () => {
  const pngPath = path.join(process.cwd(), "public", "og-image.png");

  it("should exist at public/og-image.png", () => {
    expect(fs.existsSync(pngPath)).toBe(true);
  });

  it("should be a valid PNG file (starts with PNG magic bytes)", () => {
    const buffer = fs.readFileSync(pngPath);
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
  });

  it("should be ≤ 300KB", () => {
    const stats = fs.statSync(pngPath);
    expect(stats.size).toBeLessThanOrEqual(300 * 1024);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="og-image-png" --no-coverage
```

Expected: FAIL — `public/og-image.png` does not exist yet.

**Step 3: Create the generation script**

Create `src/wj-client/scripts/generate-og-image.mjs`. This script uses `@resvg/resvg-js` (or `sharp` as fallback) to convert the existing SVG to PNG:

```javascript
// src/wj-client/scripts/generate-og-image.mjs
/**
 * Generates public/og-image.png from public/og-image.svg.
 *
 * Run: node scripts/generate-og-image.mjs
 *
 * Requires: @resvg/resvg-js (npm install -D @resvg/resvg-js)
 * Fallback: if unavailable, use sharp with SVG input.
 *
 * Output: public/og-image.png — 1200x630px, ≤300KB
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

async function generatePng() {
  const svgPath = join(publicDir, "og-image.svg");
  const pngPath = join(publicDir, "og-image.png");

  const svgContent = readFileSync(svgPath);

  try {
    // Try @resvg/resvg-js first (best SVG fidelity)
    const { Resvg } = await import("@resvg/resvg-js");
    const resvg = new Resvg(svgContent, {
      fitTo: { mode: "width", value: 1200 },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    writeFileSync(pngPath, pngBuffer);
    console.log(`Generated og-image.png (${pngBuffer.length} bytes) via resvg`);
  } catch {
    // Fallback to sharp
    const sharp = (await import("sharp")).default;
    await sharp(svgContent)
      .resize(1200, 630)
      .png({ compressionLevel: 9, quality: 85 })
      .toFile(pngPath);
    const { statSync } = await import("fs");
    const size = statSync(pngPath).size;
    console.log(`Generated og-image.png (${size} bytes) via sharp`);
  }
}

generatePng().catch((err) => {
  console.error("Failed to generate og-image.png:", err);
  process.exit(1);
});
```

**Step 4: Install dev dependency and run script**

```bash
cd src/wj-client
npm install -D @resvg/resvg-js
node scripts/generate-og-image.mjs
```

Verify output:
- File exists: `public/og-image.png`
- Size ≤ 300KB
- Visually inspect: dark maroon background, gold text

**Step 5: Run test to verify it passes**

```bash
cd src/wj-client && npx jest --testPathPattern="og-image-png" --no-coverage
```

Expected: PASS — all 3 assertions pass.

**Step 6: Commit**

```
feat(og-image): add static og-image.png generated from SVG source

Phase 1, Task 1: PNG is required for social media crawlers (SVG not supported).
Generated via @resvg/resvg-js from public/og-image.svg (1200x630px, ≤300KB).
Script: scripts/generate-og-image.mjs
```

Staged files: `public/og-image.png`, `scripts/generate-og-image.mjs`, `__tests__/og-image-png.test.ts`
Do NOT stage: `node_modules/`, any auto-generated lock changes beyond `package.json`/`package-lock.json`.

---

### Task 2: Fix Metadata — `metadataBase` + Absolute PNG URLs (Phase 1)

> Phase 1, Step 2 — fix the URL issues in all three layout files.

**Files:**

- Modify: `src/wj-client/app/layout.tsx` (lines 4–31)
- Modify: `src/wj-client/app/[locale]/landing/layout.tsx` (lines 4–84, 127–189)
- Modify: `src/wj-client/app/[locale]/guide/layout.tsx` (lines 4–65)

**Security notes:** Hardcode the absolute URL `https://www.congdongvang.com/og-image.png` — never pass through `settings["seo.og_image"]` for the image field (DB value may still be the old SVG path).

**Step 1: Write the failing test**

```typescript
// src/wj-client/__tests__/metadata-og-image.test.ts
/**
 * Unit tests verifying that the metadata constants/functions reference
 * the correct absolute PNG URL rather than the SVG path.
 */

// Test FALLBACK_METADATA in landing/layout.tsx
// We test by importing and inspecting the values.
// Since generateMetadata is async and depends on fetch, we test FALLBACK_METADATA directly.

describe("Landing FALLBACK_METADATA", () => {
  it("should reference og-image.png (not .svg) in openGraph.images", async () => {
    // Dynamic import to get the module
    const mod = await import("../app/[locale]/landing/layout");
    // FALLBACK_METADATA is not exported, so we test via generateMetadata
    // with a mock that makes fetchSiteSettings return null (triggering fallback)
    // We'll verify the module source doesn't reference /og-image.svg
    // This is a static analysis test
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/landing/layout.tsx"),
      "utf-8"
    );
    expect(source).not.toContain('"/og-image.svg"');
    expect(source).toContain("https://www.congdongvang.com/og-image.png");
  });
});

describe("Guide layout metadata", () => {
  it("should reference og-image.png (not .svg) in openGraph.images", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/guide/layout.tsx"),
      "utf-8"
    );
    expect(source).not.toContain('"/og-image.svg"');
    expect(source).toContain("https://www.congdongvang.com/og-image.png");
  });
});

describe("Root layout metadata", () => {
  it("should have metadataBase set to https://www.congdongvang.com", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const source = readFileSync(
      join(process.cwd(), "app/layout.tsx"),
      "utf-8"
    );
    expect(source).toContain("metadataBase");
    expect(source).toContain("https://www.congdongvang.com");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="metadata-og-image" --no-coverage
```

Expected: FAIL — source files still reference `/og-image.svg`, no `metadataBase`.

**Step 3: Update `app/layout.tsx` — add `metadataBase`**

Add `metadataBase: new URL("https://www.congdongvang.com")` to the root metadata export:

```typescript
// app/layout.tsx — add to existing metadata object
export const metadata: Metadata = {
  metadataBase: new URL("https://www.congdongvang.com"),  // ADD THIS LINE
  title: "congdongvang.com",
  // ... rest unchanged
};
```

**Step 4: Update `app/[locale]/landing/layout.tsx` — fix OG image URLs**

Four changes needed:

1. In `FALLBACK_METADATA.openGraph.images[0].url`: change `"/og-image.svg"` → `"https://www.congdongvang.com/og-image.png"`
2. In `FALLBACK_METADATA.twitter.images[0]`: change `"/og-image.svg"` → `"https://www.congdongvang.com/og-image.png"`
3. In `generateMetadata()`, `openGraph.images[0].url`: change `settings["seo.og_image"] || "/og-image.svg"` → `"https://www.congdongvang.com/og-image.png"` (hardcode, ignore `seo.og_image`)
4. In `generateMetadata()`, `twitter.images[0]`: change `settings["seo.og_image"] || "/og-image.svg"` → `"https://www.congdongvang.com/og-image.png"`

```typescript
// FALLBACK_METADATA — update these two lines:
openGraph: {
  // ...
  images: [
    {
      url: "https://www.congdongvang.com/og-image.png",  // was: "/og-image.svg"
      width: 1200,
      height: 630,
      alt: "congdongvang.com - Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính.",
    },
  ],
},
twitter: {
  // ...
  images: ["https://www.congdongvang.com/og-image.png"],  // was: ["/og-image.svg"]
  // ...
},

// In generateMetadata() — update these two lines:
openGraph: {
  // ...
  images: [
    {
      url: "https://www.congdongvang.com/og-image.png",  // was: settings["seo.og_image"] || "/og-image.svg"
      width: 1200,
      height: 630,
      alt: "congdongvang.com Gold & Silver Price Dashboard",
    },
  ],
},
twitter: {
  // ...
  images: ["https://www.congdongvang.com/og-image.png"],  // was: [settings["seo.og_image"] || "/og-image.svg"]
  // ...
},
```

**Step 5: Update `app/[locale]/guide/layout.tsx` — fix OG image URLs**

Two changes:

1. `openGraph.images[0].url`: `"/og-image.svg"` → `"https://www.congdongvang.com/og-image.png"`
2. `twitter.images[0]`: `"/og-image.svg"` → `"https://www.congdongvang.com/og-image.png"`

**Step 6: Run test to verify it passes**

```bash
cd src/wj-client && npx jest --testPathPattern="metadata-og-image" --no-coverage
```

Expected: PASS — all 3 source file assertions pass.

**Step 7: Run lint**

```bash
cd src/wj-client && npm run lint
```

No new errors expected (pure text changes to metadata objects).

**Step 8: Playwright E2E Audit**

Affected pages: `/vi/landing`, `/en/landing`, `/vi/guide`, `/en/guide`

Write/update E2E test: `src/wj-client/tests/e2e/og-image-metadata.spec.ts`

```typescript
// tests/e2e/og-image-metadata.spec.ts
import { test, expect } from "@playwright/test";

/**
 * E2E Test: OG Image Metadata
 *
 * Verifies that the og:image and twitter:image meta tags on public pages
 * point to the absolute PNG URL after the Phase 1 fix.
 *
 * These tests run against the local dev server (baseURL from playwright.config.ts).
 */

test.describe("OG Image Metadata — Landing Page", () => {
  test("vi/landing should have og:image pointing to absolute PNG URL", async ({
    page,
  }) => {
    await page.goto("/vi/landing");

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute(
      "content",
      "https://www.congdongvang.com/og-image.png"
    );
  });

  test("vi/landing should have twitter:image pointing to absolute PNG URL", async ({
    page,
  }) => {
    await page.goto("/vi/landing");

    const twitterImage = page.locator('meta[name="twitter:image"]');
    await expect(twitterImage).toHaveAttribute(
      "content",
      "https://www.congdongvang.com/og-image.png"
    );
  });

  test("en/landing should have og:image pointing to absolute PNG URL", async ({
    page,
  }) => {
    await page.goto("/en/landing");

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute(
      "content",
      "https://www.congdongvang.com/og-image.png"
    );
  });
});

test.describe("OG Image Metadata — Guide Page", () => {
  test("vi/guide should have og:image pointing to absolute PNG URL", async ({
    page,
  }) => {
    await page.goto("/vi/guide");

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute(
      "content",
      "https://www.congdongvang.com/og-image.png"
    );
  });

  test("vi/guide should have twitter:image pointing to absolute PNG URL", async ({
    page,
  }) => {
    await page.goto("/vi/guide");

    const twitterImage = page.locator('meta[name="twitter:image"]');
    await expect(twitterImage).toHaveAttribute(
      "content",
      "https://www.congdongvang.com/og-image.png"
    );
  });
});

test.describe("OG Image Static PNG", () => {
  test("og-image.png should be accessible and return image/png", async ({
    page,
    request,
  }) => {
    const response = await request.get("/og-image.png");
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("image/png");
  });
});
```

Do NOT run the tests.

**Step 9: Commit**

```
fix(og-image): replace SVG with absolute PNG URLs in metadata + add metadataBase

Phase 1, Task 2:
- app/layout.tsx: add metadataBase: new URL("https://www.congdongvang.com")
- landing/layout.tsx: hardcode absolute PNG URL in both FALLBACK_METADATA and generateMetadata()
  (no longer passes through seo.og_image which may still reference the old SVG)
- guide/layout.tsx: same absolute PNG URL replacement
- Add E2E test: tests/e2e/og-image-metadata.spec.ts
```

---

### Task 3: Create `opengraph-image.tsx` for Landing Page (Phase 2)

> Phase 2, Step 1 — dynamic Edge route for landing page OG image.

**Files:**

- Create: `src/wj-client/app/[locale]/landing/opengraph-image.tsx`

**Security notes:**
- Validate `params.locale` against `["vi", "en"]` — never use it in file paths or external URLs.
- Font fetch: wrap in try/catch; if it fails, call `ImageResponse` without `fonts` option.
- Add `export const revalidate = 86400` (24h cache) to prevent DoS cost spikes.
- No user data, no financial data — only public brand text.

**Step 1: Write the failing test**

```typescript
// src/wj-client/__tests__/landing-opengraph-image.test.ts
/**
 * Unit tests for the landing opengraph-image.tsx Edge route.
 * Tests the exported constants and that the function signature is correct.
 */

describe("Landing opengraph-image exports", () => {
  it("should export runtime = 'edge'", async () => {
    const mod = await import("../app/[locale]/landing/opengraph-image");
    expect(mod.runtime).toBe("edge");
  });

  it("should export size with width 1200 and height 630", async () => {
    const mod = await import("../app/[locale]/landing/opengraph-image");
    expect(mod.size).toEqual({ width: 1200, height: 630 });
  });

  it("should export contentType = 'image/png'", async () => {
    const mod = await import("../app/[locale]/landing/opengraph-image");
    expect(mod.contentType).toBe("image/png");
  });

  it("should export a default function Image", async () => {
    const mod = await import("../app/[locale]/landing/opengraph-image");
    expect(typeof mod.default).toBe("function");
  });

  it("should export alt string", async () => {
    const mod = await import("../app/[locale]/landing/opengraph-image");
    expect(typeof mod.alt).toBe("string");
    expect((mod.alt as string).length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="landing-opengraph-image" --no-coverage
```

Expected: FAIL — module does not exist yet.

**Step 3: Create `app/[locale]/landing/opengraph-image.tsx`**

```typescript
// app/[locale]/landing/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const revalidate = 86400; // Cache for 24 hours
export const alt = "congdongvang.com - Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VALID_LOCALES = ["vi", "en"] as const;

// Brand text by locale
const TEXT = {
  vi: {
    tagline: "Cộng Đồng Vàng",
    subtitle: "Sân chơi giao lưu, trao đổi, kiến thức\nvề thị trường đầu tư tài chính",
    badges: "Giá Vàng · Giá Bạc · Ngoại Tệ · Đầu Tư · Miễn Phí",
  },
  en: {
    tagline: "Gold Community",
    subtitle: "Exchange & grow your knowledge\nabout financial investment markets",
    badges: "Gold · Silver · FX · Investment · Free",
  },
} as const;

export default async function Image({
  params,
}: {
  params: { locale: string };
}) {
  // Validate locale — never use it in file paths or external URLs
  const locale: "vi" | "en" = VALID_LOCALES.includes(params.locale as "vi" | "en")
    ? (params.locale as "vi" | "en")
    : "vi";

  const text = TEXT[locale];

  // Attempt to load Roboto font — fall back gracefully if unavailable
  let fontData: ArrayBuffer | null = null;
  try {
    fontData = await fetch(
      new URL("https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Mu4mxK.woff2")
    ).then((res) => res.arrayBuffer());
  } catch {
    // Font fetch failed — Satori will use system sans-serif
    fontData = null;
  }

  const imageResponseOptions = {
    ...size,
    ...(fontData
      ? { fonts: [{ name: "Roboto", data: fontData, weight: 700 as const }] }
      : {}),
  };

  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #3D0101, #5F0202)",
            position: "relative",
            fontFamily: fontData ? "Roboto" : "Arial, sans-serif",
          }}
        >
          {/* Top gold accent bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #b8862d, #f0d078, #b8862d)",
            }}
          />

          {/* Bottom gold accent bar */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              background: "linear-gradient(90deg, #b8862d, #f0d078, #b8862d)",
            }}
          />

          {/* Top-left corner decoration */}
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              width: 40,
              height: 4,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              width: 4,
              height: 40,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />

          {/* Top-right corner decoration */}
          <div
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 40,
              height: 4,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              width: 4,
              height: 40,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />

          {/* Bottom-left corner decoration */}
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              width: 40,
              height: 4,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              width: 4,
              height: 40,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />

          {/* Bottom-right corner decoration */}
          <div
            style={{
              position: "absolute",
              bottom: 20,
              right: 20,
              width: 40,
              height: 4,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 20,
              right: 20,
              width: 4,
              height: 40,
              background: "#d2a74b",
              opacity: 0.4,
            }}
          />

          {/* Main content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: "0 80px",
            }}
          >
            {/* Brand name */}
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: "#d2a74b",
                letterSpacing: "-1px",
              }}
            >
              congdongvang.com
            </div>

            {/* Gold divider */}
            <div
              style={{
                width: 200,
                height: 2,
                background: "linear-gradient(90deg, transparent, #d2a74b, transparent)",
              }}
            />

            {/* Tagline */}
            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: "#f0d078",
              }}
            >
              {text.tagline}
            </div>

            {/* Subtitle */}
            <div
              style={{
                fontSize: 22,
                color: "#e8c87a",
                textAlign: "center",
                opacity: 0.9,
              }}
            >
              {text.subtitle}
            </div>

            {/* Feature badges */}
            <div
              style={{
                marginTop: 16,
                fontSize: 18,
                color: "#d2a74b",
                letterSpacing: "1px",
                opacity: 0.85,
              }}
            >
              {text.badges}
            </div>
          </div>

          {/* URL at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 24,
              fontSize: 16,
              color: "#d2a74b",
              opacity: 0.6,
            }}
          >
            www.congdongvang.com
          </div>
        </div>
      ),
      imageResponseOptions,
    );
  } catch {
    // Fallback: minimal image so crawlers never get a 500
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#3D0101",
          }}
        >
          <div style={{ fontSize: 48, color: "#d2a74b", fontFamily: "Arial, sans-serif" }}>
            congdongvang.com
          </div>
        </div>
      ),
      { ...size },
    );
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx jest --testPathPattern="landing-opengraph-image" --no-coverage
```

Expected: PASS — all 5 export assertions pass.

**Step 5: TypeScript type check**

```bash
cd src/wj-client && npx tsc --noEmit
```

Expected: No new errors.

**Step 6: Playwright E2E Audit**

Update `tests/e2e/og-image-metadata.spec.ts` to add a test for the new route:

```typescript
// Add to tests/e2e/og-image-metadata.spec.ts — inside existing file

test.describe("Dynamic OG Image Route — Landing", () => {
  test("GET /vi/landing/opengraph-image should return 200", async ({
    request,
  }) => {
    const response = await request.get("/vi/landing/opengraph-image");
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("image/png");
  });

  test("GET /en/landing/opengraph-image should return 200", async ({
    request,
  }) => {
    const response = await request.get("/en/landing/opengraph-image");
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("image/png");
  });

  test("Unknown locale on opengraph-image should return 200 (fallback to vi)", async ({
    request,
  }) => {
    // Unknown locale should not crash — defaults to vi
    const response = await request.get("/xx/landing/opengraph-image");
    expect(response.status()).toBe(200);
  });
});
```

Do NOT run the tests.

**Step 7: Commit**

```
feat(og-image): add dynamic opengraph-image.tsx Edge route for landing page

Phase 2, Task 3:
- app/[locale]/landing/opengraph-image.tsx: ImageResponse with dark maroon design
- Locale validated against ["vi", "en"] allowlist; defaults to "vi"
- Font fetch with try/catch fallback to sans-serif
- 24h Edge cache (revalidate=86400)
- Fallback ImageResponse on error — never returns 500
- Update E2E: tests/e2e/og-image-metadata.spec.ts
```

---

### Task 4: Create `opengraph-image.tsx` for Guide Page (Phase 2)

> Phase 2, Step 2 — same pattern applied to the guide page.

**Files:**

- Create: `src/wj-client/app/[locale]/guide/opengraph-image.tsx`

**Security notes:** Same as Task 3 — locale validation, font fetch fallback, 24h cache.

**Step 1: Write the failing test**

```typescript
// src/wj-client/__tests__/guide-opengraph-image.test.ts
describe("Guide opengraph-image exports", () => {
  it("should export runtime = 'edge'", async () => {
    const mod = await import("../app/[locale]/guide/opengraph-image");
    expect(mod.runtime).toBe("edge");
  });

  it("should export size with width 1200 and height 630", async () => {
    const mod = await import("../app/[locale]/guide/opengraph-image");
    expect(mod.size).toEqual({ width: 1200, height: 630 });
  });

  it("should export contentType = 'image/png'", async () => {
    const mod = await import("../app/[locale]/guide/opengraph-image");
    expect(mod.contentType).toBe("image/png");
  });

  it("should export a default function Image", async () => {
    const mod = await import("../app/[locale]/guide/opengraph-image");
    expect(typeof mod.default).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="guide-opengraph-image" --no-coverage
```

Expected: FAIL — module does not exist yet.

**Step 3: Create `app/[locale]/guide/opengraph-image.tsx`**

Identical structure to the landing version. Differentiate only with the `alt` text:

```typescript
// app/[locale]/guide/opengraph-image.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const revalidate = 86400;
export const alt = "Hướng dẫn sử dụng congdongvang.com";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ... (same VALID_LOCALES, TEXT map, and Image function as landing version)
// The TEXT.vi.tagline may say "Hướng Dẫn Sử Dụng" for the guide page variant,
// but per spec the design is identical — use the same brand text as landing.
```

> Note: The guide page `opengraph-image.tsx` uses the same brand design as landing. The only difference is `alt` text. Copy the full implementation from Task 3, change `alt` to `"Hướng dẫn sử dụng congdongvang.com"`.

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx jest --testPathPattern="guide-opengraph-image" --no-coverage
```

Expected: PASS.

**Step 5: Playwright E2E Audit**

Update `tests/e2e/og-image-metadata.spec.ts` to add guide route tests:

```typescript
// Add to tests/e2e/og-image-metadata.spec.ts

test.describe("Dynamic OG Image Route — Guide", () => {
  test("GET /vi/guide/opengraph-image should return 200", async ({
    request,
  }) => {
    const response = await request.get("/vi/guide/opengraph-image");
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("image/png");
  });

  test("GET /en/guide/opengraph-image should return 200", async ({
    request,
  }) => {
    const response = await request.get("/en/guide/opengraph-image");
    expect(response.status()).toBe(200);
  });
});
```

Do NOT run the tests.

**Step 6: Commit**

```
feat(og-image): add dynamic opengraph-image.tsx Edge route for guide page

Phase 2, Task 4: Same ImageResponse design as landing. Different alt text.
Update E2E: tests/e2e/og-image-metadata.spec.ts (add guide route tests)
```

---

### Task 5: Remove Manual OG Image Arrays from Layouts (Phase 2 Cleanup)

> Phase 2, Step 3 — remove redundant `openGraph.images` and `twitter.images` entries now that file convention handles them automatically.

**Files:**

- Modify: `src/wj-client/app/[locale]/landing/layout.tsx`
- Modify: `src/wj-client/app/[locale]/guide/layout.tsx`

**Why:** Once `opengraph-image.tsx` is in place, Next.js auto-injects the correct `og:image` tag. Keeping manual `images` arrays causes duplicate `og:image` tags in HTML `<head>`.

**Security notes:** No security impact. The `metadataBase` in root layout stays — needed for other image references.

**Step 1: Write the failing test**

```typescript
// src/wj-client/__tests__/no-duplicate-og-image.test.ts
/**
 * Verifies that landing/layout.tsx and guide/layout.tsx no longer have
 * manual openGraph.images or twitter.images entries (cleanup after Phase 2).
 */
import { readFileSync } from "fs";
import { join } from "path";

describe("Phase 2 cleanup — no manual OG image arrays", () => {
  it("landing/layout.tsx should not have openGraph.images array", () => {
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/landing/layout.tsx"),
      "utf-8"
    );
    // After cleanup, openGraph should not contain an 'images' key
    // The opengraph-image.tsx file handles this via Next.js file convention
    expect(source).not.toContain("openGraph: {");
    // OR: more targeted — openGraph block must not contain 'images:'
    // Use the simpler check: the PNG URL should no longer appear in layout
    expect(source).not.toMatch(/openGraph\.images|openGraph:\s*\{[^}]*images/s);
  });

  it("guide/layout.tsx should not have openGraph.images array", () => {
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/guide/layout.tsx"),
      "utf-8"
    );
    expect(source).not.toMatch(/openGraph\.images|openGraph:\s*\{[^}]*images/s);
  });
});
```

> Note: The test above uses a regex that may be brittle. A simpler approach: assert the absolute PNG URL no longer appears in layout (since it's now handled by the `opengraph-image.tsx` route):

```typescript
it("landing/layout.tsx should not contain manual og-image.png URL", () => {
  const source = readFileSync(
    join(process.cwd(), "app/[locale]/landing/layout.tsx"),
    "utf-8"
  );
  expect(source).not.toContain("og-image.png");
});
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="no-duplicate-og-image" --no-coverage
```

Expected: FAIL — layouts still reference `og-image.png`.

**Step 3: Update `landing/layout.tsx` — remove manual images arrays**

In `FALLBACK_METADATA.openGraph`: remove the `images` key entirely.
In `FALLBACK_METADATA.twitter`: remove the `images` key entirely.
In `generateMetadata().openGraph`: remove the `images` key entirely.
In `generateMetadata().twitter`: remove the `images` key entirely.

Keep everything else (title, description, url, siteName, card, creator, etc.) unchanged.

**Step 4: Update `guide/layout.tsx` — remove manual images arrays**

Same: remove `images` from both `openGraph` and `twitter` objects.

**Step 5: Run test to verify it passes**

```bash
cd src/wj-client && npx jest --testPathPattern="no-duplicate-og-image" --no-coverage
```

Expected: PASS.

**Step 6: Run lint + TypeScript check**

```bash
cd src/wj-client && npm run lint && npx tsc --noEmit
```

**Step 7: Playwright E2E Audit**

Update `tests/e2e/og-image-metadata.spec.ts` — remove the static PNG URL assertions added in Task 2 (they are now superseded by the dynamic route). Replace with assertions that verify the `og:image` tag auto-points to the `/opengraph-image` route:

```typescript
// Update og-image-metadata.spec.ts — replace static URL assertions

test.describe("OG Image Auto-Injection (Phase 2)", () => {
  test("vi/landing og:image should point to /vi/landing/opengraph-image", async ({
    page,
  }) => {
    await page.goto("/vi/landing");

    const ogImage = page.locator('meta[property="og:image"]');
    const content = await ogImage.getAttribute("content");
    expect(content).toContain("/vi/landing/opengraph-image");
  });

  test("vi/guide og:image should point to /vi/guide/opengraph-image", async ({
    page,
  }) => {
    await page.goto("/vi/guide");

    const ogImage = page.locator('meta[property="og:image"]');
    const content = await ogImage.getAttribute("content");
    expect(content).toContain("/vi/guide/opengraph-image");
  });
});
```

Do NOT run the tests.

**Step 8: Commit**

```
fix(og-image): remove manual openGraph.images arrays after Phase 2 opengraph-image.tsx

Phase 2, Task 5 cleanup:
- landing/layout.tsx: remove openGraph.images + twitter.images (Next.js file convention handles this)
- guide/layout.tsx: same removal
- Prevents duplicate og:image tags in HTML head
- Update E2E: og-image-metadata.spec.ts (update assertions for auto-injected URL)
```

---

## Summary

| Task | Phase | Files | Type |
|------|-------|-------|------|
| 0 — C4 diagram update | — | `docs/architecture/c4-component-frontend.md` | Docs |
| 1 — Generate `og-image.png` | Phase 1 | `public/og-image.png`, `scripts/generate-og-image.mjs` | Build artifact |
| 2 — Fix metadata URLs + `metadataBase` | Phase 1 | `app/layout.tsx`, `landing/layout.tsx`, `guide/layout.tsx` | Metadata fix |
| 3 — `opengraph-image.tsx` for landing | Phase 2 | `app/[locale]/landing/opengraph-image.tsx` | Edge route |
| 4 — `opengraph-image.tsx` for guide | Phase 2 | `app/[locale]/guide/opengraph-image.tsx` | Edge route |
| 5 — Remove redundant image arrays | Phase 2 cleanup | `landing/layout.tsx`, `guide/layout.tsx` | Cleanup |

**Dependency order:** Task 0 → Task 1 → Task 2 → Task 3 → Task 4 → Task 5 (strictly sequential — Phase 1 must ship before Phase 2 cleanup removes the static URL).
