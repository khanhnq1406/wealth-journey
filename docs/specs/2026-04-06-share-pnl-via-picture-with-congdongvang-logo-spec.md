# Share PNL via Picture with CongDongVang Logo — Specification

## Summary

Users want to share their investment PNL results as a branded image on social media or messaging apps. The feature captures the existing `NetWorthDisplay` card (gold gradient card on the home dashboard showing total net worth + 1D/7D/30D PNL) using `html2canvas`, overlays the app logo, then presents a preview modal where the user can download the PNG or share it via the native OS share sheet. No new backend endpoints are required — all data is already available on the home dashboard.

---

## User Stories

- As a user, I want to tap a share button on the NetWorthDisplay card so I can generate a branded image of my portfolio PNL.
- As a user, I want to preview the image before sharing so I can confirm it looks correct.
- As a user, I want to download the image as a PNG to my device.
- As a user, I want to use the native OS share sheet (on mobile) to send the image directly to messaging apps or social media.

---

## Functional Requirements

### FR-1: Share Button on NetWorthDisplay Card

A share/export button is added to the `NetWorthDisplay` component (home dashboard). Tapping it opens a share preview modal.

**Acceptance criteria:**
- [ ] A share icon button is visible on the NetWorthDisplay card (bottom-right corner or top-right corner — see UI/UX section)
- [ ] Button has `min-h-[44px]` touch target
- [ ] Button triggers the PNL Share Preview Modal
- [ ] Button is only rendered client-side (no SSR issues with html2canvas)

### FR-2: Image Generation via html2canvas

When the share modal opens, the app captures the NetWorthDisplay card as a PNG using `html2canvas`.

**Acceptance criteria:**
- [ ] `html2canvas` is dynamically imported (lazy) to avoid SSR bundle impact
- [ ] The capture target is the NetWorthDisplay card DOM element (identified by a `data-pnl-card` attribute)
- [ ] The `sjc3d.webp` dragon watermark is captured correctly (local asset, no CORS issue)
- [ ] The gold gradient background is captured correctly
- [ ] A loading spinner is shown in the preview modal while capture is in progress
- [ ] On capture failure, show an error state with retry option
- [ ] Image is 2x pixel ratio (`scale: 2`) for sharp display on retina screens

### FR-3: Logo Overlay

After html2canvas capture, the app logo (`/logo.svg` or `/icons/icon-192x192.png`) is composited onto the captured canvas.

**Acceptance criteria:**
- [ ] Logo placed bottom-right corner of the image (16px margin from edges)
- [ ] Logo size: 48×48px (PNG icon) or scaled SVG
- [ ] Logo has a subtle dark semi-transparent background circle/pill behind it for readability on the gold gradient
- [ ] The composite is done on a second canvas (draw captured image first, then draw logo on top)
- [ ] Use `icon-192x192.png` from `/public/icons/` (raster, avoids SVG cross-origin issues with canvas)

### FR-4: PNL Share Preview Modal

A modal opens showing the generated image with share/download actions.

**Acceptance criteria:**
- [ ] Modal uses existing `BaseModal` component
- [ ] Shows the generated image (as `<img src={dataURL}>`) in the preview area
- [ ] While generating: shows `LoadingSpinner` centered in the preview area
- [ ] On error: shows `ErrorState` with "Retry" button
- [ ] Two action buttons:
  - **"Download"** — always shown, triggers PNG download
  - **"Share"** — shown only if `navigator.share` is supported AND `navigator.canShare({ files: [...] })` returns true; otherwise hidden
- [ ] Modal title: "Chia sẻ kết quả đầu tư" (vi) / "Share Investment Results" (en)
- [ ] Closes on backdrop click or ESC

### FR-5: Download PNG

Clicking "Download" saves the image as a PNG file.

**Acceptance criteria:**
- [ ] Filename: `pnl-congdongvang-YYYY-MM-DD.png`
- [ ] Uses the standard blob-and-link download pattern (consistent with existing export utilities)
- [ ] Revokes object URL after 100ms

### FR-6: Native Share (Web Share API)

Clicking "Share" invokes the OS native share sheet with the image as a file attachment.

**Acceptance criteria:**
- [ ] Converts canvas data URL to a `File` object (`image/png`)
- [ ] Calls `navigator.share({ files: [file], title: "Kết quả đầu tư - CongDongVang" })`
- [ ] On `AbortError` (user dismissed share sheet): silently ignore
- [ ] On other errors: show a toast error message
- [ ] Share button is hidden (not disabled) on browsers/platforms where `navigator.canShare({ files })` returns false

---

## Non-Functional Requirements

- **Performance:** html2canvas capture should complete in < 2 seconds on a mid-range mobile device. Dynamic import ensures it doesn't affect initial page load.
- **Bundle size:** `html2canvas` (~250KB minified) loaded only on demand via dynamic import.
- **Accessibility:** Share button has `aria-label="Share PNL"`. Modal follows existing `BaseModal` accessibility (focus trap, ESC, aria-modal).
- **i18n:** All user-visible strings added to `messages/vi/dashboard.json` and `messages/en/dashboard.json`.
- **Mobile-first:** Preview modal image fits within viewport on small screens (`max-w-full`, `max-h-[60vh]`).

---

## Architecture Changes (C4)

### Diagrams to Update

- **c4-component-frontend.md (L3):** Add `PnlShareModal` component under the `home` feature area. No new feature module — this lives in `app/[locale]/dashboard/home/` as a page-co-located component (not a reusable feature module, since it's tightly coupled to `NetWorthDisplay`).

### New Diagrams

None — feature is frontend-only, no new backend components.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **flow-cross-cutting.md:** Add a short sequence diagram for "Share PNL as Image" showing: User clicks share → html2canvas capture → logo composite → preview modal → download/share actions.

### New Flow Diagrams

None required — single-page client-side flow, no multi-service coordination.

---

## Data Model Changes

None. No new database tables, backend models, or API changes.

---

## API Changes

None. All PNL data is already present on the home dashboard via existing hooks.

---

## UI/UX Changes

### Share Button Placement

The share button is placed on the **NetWorthDisplay card** — bottom-right corner on mobile, top-right corner on desktop — using absolute positioning within the card's relative container.

- Icon: `Share2` from `lucide-react`
- Style: small semi-transparent dark circle button (`bg-black/30 hover:bg-black/50 rounded-full p-2`)
- Positioned with `absolute bottom-3 right-3 z-20` on mobile, `absolute top-3 right-3 z-20` on desktop

### Preview Modal Layout

```
┌─────────────────────────────────┐
│  Chia sẻ kết quả đầu tư     ✕  │
├─────────────────────────────────┤
│                                  │
│   [Generated image preview]      │
│   (gold card + logo overlay)     │
│                                  │
├─────────────────────────────────┤
│  [Download PNG]   [Share ↗]     │
└─────────────────────────────────┘
```

- Image preview: `rounded-xl overflow-hidden shadow-modal`
- Action buttons: side-by-side, `Button` component from `@/components/Button`
- Download: `ButtonType.SECONDARY`
- Share: `ButtonType.PRIMARY` (only shown if Web Share API supports files)

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Modal container | `BaseModal` | `components/modals/BaseModal.tsx` |
| Loading state | `LoadingSpinner` | `components/loading/` |
| Error state | `ErrorState` | `components/feedback/` |
| Action buttons | `Button` | `components/Button.tsx` |
| Share icon | `Share2` (lucide-react) | lucide-react |
| Toast on error | `Toast` / notification via context | `components/feedback/` |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| `PnlShareModal.tsx` | `app/[locale]/dashboard/home/PnlShareModal.tsx` | Page-co-located; tightly coupled to NetWorthDisplay card shape and data. Not reusable across features. |

### i18n Keys to Add

```json
// messages/vi/dashboard.json — under "home"
"sharePnl": {
  "buttonAriaLabel": "Chia sẻ kết quả",
  "modalTitle": "Chia sẻ kết quả đầu tư",
  "generating": "Đang tạo ảnh...",
  "download": "Tải về",
  "share": "Chia sẻ",
  "shareTitle": "Kết quả đầu tư - CongDongVang",
  "errorCapture": "Không thể tạo ảnh. Vui lòng thử lại.",
  "errorShare": "Không thể chia sẻ. Vui lòng tải về."
}
```

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | `NetWorthDisplay` DOM | Rendered HTML/CSS | No | `html2canvas` (browser) | Local DOM capture only |
| 2 | `/public/icons/icon-192x192.png` | Static PNG asset | No | Canvas compositor | Same-origin static asset |
| 3 | Canvas | PNG data URL | No | Browser memory | Never sent to server |
| 4 | User | Click "Download" | No | `<a download>` | Browser file system |
| 5 | User | Click "Share" | No | `navigator.share()` | OS share sheet |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Initial page load (existing) | JWT auth (existing) |
| App → OS | `navigator.share()` | Browser sandboxed API |
| App → File System | `<a download>` | Browser sandboxed |

**No new trust boundaries introduced.** This feature is entirely client-side.

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | Canvas → Share | App → OS | Info Disclosure | PNL data shared unintentionally | Low | User explicitly initiates share; preview shown before action |
| T-2 | html2canvas | Browser | Info Disclosure | Canvas may capture sensitive data beyond the card | Low | Capture target scoped to specific `data-pnl-card` element only; no other DOM captured |
| T-3 | PNG download | App → FS | Info Disclosure | Image saved to device shows financial data | Low | User action; consistent with all financial apps |
| T-4 | `navigator.share` | App → OS | DoS | Rapid repeated share attempts | Very Low | Button disabled while share is in progress |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated |
|-----------|-------|-----------|----------------|
| Generate image | Allowed (their own data) | N/A (client-side only) | N/A (page requires auth) |
| Download image | Allowed | N/A | N/A |
| Share image | Allowed | N/A | N/A |

No authorization changes needed — this feature is purely client-side using already-rendered data.

### Input Validation Rules

No user inputs to validate. The feature has no form fields — it captures a DOM element and provides download/share actions.

### External Dependency Risks

| Package | Version | Risk | Assessment |
|---------|---------|------|------------|
| `html2canvas` | 1.4.1 (already in deps) | Low | Well-maintained, widely used. Already a project dependency. No new surface area. |

No new dependencies introduced.

### Sensitive Data Handling

- The generated image contains financial data (net worth, PNL values). This is **intentional** — the user is choosing to share it.
- The image is **never sent to any server** — it lives only in browser memory and is shared via OS APIs.
- No PII beyond what the user chooses to share (their financial performance, not account details).

### Issues & Risks Summary

1. **html2canvas cross-origin images:** `sjc3d.webp` is local (`/public/`), so no CORS. The logo icon is also local. Risk: **None**.
2. **`navigator.share` file support varies:** Not all browsers support `canShare({ files })`. Mitigated by feature-detecting and hiding the Share button when unsupported (Download always available).
3. **Gold gradient CSS-to-canvas fidelity:** `html2canvas` may not perfectly reproduce `linear-gradient` + `radial-gradient` layering. Risk: Low — these are standard CSS properties. Test on target browsers. Fallback: if capture looks poor, use `scale: 2` and `useCORS: false`.
4. **SSR crash:** html2canvas uses `window`/`document`. Must use dynamic import with `{ ssr: false }` or call only in `useEffect`/event handlers.

---

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|---------|
| html2canvas fails (exception) | Show `ErrorState` with retry button in modal |
| `navigator.share` throws `AbortError` | Silently ignore (user cancelled) |
| `navigator.share` throws other error | Show toast: "Không thể chia sẻ. Vui lòng tải về." |
| Logo image fails to load | Skip logo overlay (still show card image without logo) |
| Modal opened before image is ready | Show `LoadingSpinner`; buttons disabled |
| User re-opens modal | Re-capture fresh image each time modal opens |

---

## Dependencies & Assumptions

- `html2canvas` v1.4.1 is already in `package.json` — no new dependency needed.
- `lucide-react` is already used throughout the app (`Share2` icon available).
- `BaseModal`, `Button`, `LoadingSpinner`, `ErrorState` all exist in `components/`.
- The `NetWorthDisplay` component is rendered on the home dashboard page and has access to all PNL data it displays.
- `navigator.share` with file support works on iOS Safari 15+, Android Chrome 89+, and is absent on most desktops — this is acceptable.
- The home page is behind authentication — no unauthenticated access concern.
- `/public/icons/icon-192x192.png` exists (confirmed from PWA manifest).

---

## Out of Scope

- Sharing portfolio breakdown per-investment (only the top-level NetWorthDisplay card)
- Server-side image generation (no backend changes)
- Custom text/caption editing before share
- Sharing to specific platforms directly (Facebook, Twitter) — handled by OS share sheet
- Animated GIF or video generation
- Historical PNL chart inclusion in the image
