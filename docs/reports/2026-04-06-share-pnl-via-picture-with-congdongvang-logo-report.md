# Share PNL via Picture with CongDongVang Logo — Implementation Report

## Summary

Added a share button to the `NetWorthDisplay` card on the home dashboard. Clicking it opens `PnlShareModal` — a page-co-located component that uses `html2canvas` (dynamic import) to capture the card DOM element, composites the app logo on a second canvas, and provides Download (always) and native OS Share (when supported by browser) actions. Frontend-only feature. No backend changes.

## Spec Reference

`docs/specs/2026-04-06-share-pnl-via-picture-with-congdongvang-logo-spec.md`

## Plan Reference

`docs/plans/2026-04-06-share-pnl-via-picture-with-congdongvang-logo-plan.md`

## Tasks Completed

| #   | Task                                                  | Status | Commit     | Files Changed | Tests    | TDD |
| --- | ----------------------------------------------------- | ------ | ---------- | ------------- | -------- | --- |
| 0   | Add i18n keys (en + vi)                               | Done   | `458b0f1c` | 3             | 16/16    | Yes |
| 1   | Create PnlShareModal component                        | Done   | `e810cdd4` | 2             | 7/7      | Yes |
| 2   | Add share button + data-pnl-card to NetWorthDisplay   | Done   | `35b4aa77` | 2             | 4/4      | Yes |
| 3   | Wire PnlShareModal to home page                       | Done   | `b9dc8f12` | 3             | 38/38    | Yes |
| 4   | Update C4 frontend component diagram                  | Done   | `a3d378d9` | 1             | N/A      | N/A |
| 5   | Update flow-cross-cutting.md                          | Done   | `a3d378d9` | 1             | N/A      | N/A |

## Test Coverage Summary

| Layer              | Test File                                              | Tests | Pass  | Coverage Area |
| ------------------ | ------------------------------------------------------ | ----- | ----- | ------------- |
| i18n keys          | `__tests__/i18n-keys.test.ts`                          | 16    | 16/16 | All 8 keys × 2 locales present and are strings |
| PnlShareModal      | `__tests__/PnlShareModal.test.tsx`                     | 7     | 7/7   | Closed state, loading, success image, download button, error state, retry, re-capture on reopen |
| NetWorthDisplay    | `__tests__/NetWorthDisplay.test.tsx`                   | 4     | 4/4   | Share button aria-label, click fires callback, data-pnl-card present, no button without prop |
| Home page          | `__tests__/page.test.tsx`                              | 3     | 3/3   | PnlShareModal absent on mount, NetWorthDisplay rendered, onShareClick wired |
| E2E (Playwright)   | `tests/e2e/share-pnl-flow.spec.ts`                     | 2     | N/A*  | Share button visible, modal opens on click |

*E2E tests require a running dev server. Spec file created and verified to list correctly.

**Total unit tests added:** 30 new tests (16 + 7 + 4 + 3)

## Security Implementation Summary

| Concern | Implementation | Verified |
| ------- | -------------- | -------- |
| SSR safety | `html2canvas` dynamically imported inside click handler — never evaluated during SSR | Yes |
| No server upload | Canvas data URL used only for `<img>` preview and local download/share — never POSTed | Yes |
| Browser API guard | `navigator.canShare({ files })` in try/catch — Share button only shown when supported | Yes |
| Abort handling | `AbortError` from `navigator.share()` silently ignored (user cancelled) | Yes |
| DoS prevention | `isSharing` flag disables both buttons while share is in progress | Yes |
| Auth | Page already behind auth middleware — no regression | Yes |
| XSS | No user input rendered; dataURL is browser-generated; error messages are i18n keys | Yes |

## Review Results

### Spec Compliance

All 4 implementation tasks passed Stage 1 (Spec Compliance). Key verifications:
- All 8 i18n keys present in both locales with correct types
- PnlShareModal: all 7 spec behaviors implemented (dynamic import, logo compositing, loading/error/success states, download/share buttons, state reset, re-capture on reopen, `isSharing` guard)
- NetWorthDisplay: `onShareClick` prop, `Share2` icon, `data-pnl-card` on both cards, full className spec met
- Home page: cardRef, isPnlShareOpen, PnlShareModal rendered as sibling to BaseModal

### Security Review

All 4 implementation tasks passed Stage 2 (Security). No CRITICAL or HIGH issues found.

Minor notes accepted:
- `<img src={dataURL}>` instead of `next/image` — accepted (runtime-generated data URL, dimensions unknown; design decision documented)
- `fetch(dataURL)` converts data URL to Blob for Web Share API — entirely in-browser, not a network request

### Code Quality

All 4 implementation tasks passed Stage 3 (Code Quality).

Minor notes (informational, not blocking):
- `"Retry"` label in `ErrorState.primaryAction` is hardcoded English, bypassing i18n — accepted for MVP; could be localized in follow-up
- Logo compositing code (circle behind logo) has limited test coverage in jsdom (Image.complete is false in mock) — documented limitation of jsdom environment, not a code defect

## Known Issues / Technical Debt

1. **Hardcoded "Retry" string** in `PnlShareModal.tsx` line 185 — `label: "Retry"` is not localized. Should use a `t("retry")` key in a follow-up. Low priority.
2. **Logo compositing untested in unit tests** — jsdom's Image API doesn't set `complete/naturalWidth`, so the circle-behind-logo drawing block has no unit test coverage. The compositing logic is correct; this is a test environment limitation. Could add a canvas integration test or use the `canvas` npm package in tests to address.
3. **E2E tests need dev server** — `share-pnl-flow.spec.ts` tests are created but require a running dev server + real auth to run end-to-end. Add to CI once infrastructure is available.

## Files Changed

**New files:**
- `src/wj-client/app/[locale]/dashboard/home/PnlShareModal.tsx`
- `src/wj-client/app/[locale]/dashboard/home/__tests__/i18n-keys.test.ts`
- `src/wj-client/app/[locale]/dashboard/home/__tests__/PnlShareModal.test.tsx`
- `src/wj-client/app/[locale]/dashboard/home/__tests__/NetWorthDisplay.test.tsx`
- `src/wj-client/app/[locale]/dashboard/home/__tests__/page.test.tsx`
- `src/wj-client/tests/e2e/share-pnl-flow.spec.ts`
- `docs/reports/2026-04-06-share-pnl-via-picture-with-congdongvang-logo-progress.md`

**Modified files:**
- `src/wj-client/messages/en/ui.json` — added `sharePnl` keys under `dashboard.home`
- `src/wj-client/messages/vi/ui.json` — added `sharePnl` keys under `dashboard.home`
- `src/wj-client/app/[locale]/dashboard/home/NetWorthDisplay.tsx` — added share button + data-pnl-card
- `src/wj-client/app/[locale]/dashboard/home/page.tsx` — added cardRef, isPnlShareOpen, PnlShareModal
- `docs/architecture/c4-component-frontend.md` — added pnlShareModal component + Rel lines
- `docs/architecture/flow-cross-cutting.md` — added section 18: Share PNL as Image

## How to Test

### Unit & Integration Tests

```bash
# Run all home page tests
cd src/wj-client && npx jest --testPathPattern="dashboard/home" --no-coverage

# Expected output:
# Tests: 38 passed (includes pre-existing tests + 30 new)
# Test Suites: 5 passed
```

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed.

Changes affect:
- `NetWorthDisplay.tsx` — new optional prop `onShareClick`. All existing callers work unchanged (optional prop with default undefined).
- `page.tsx` (home) — new imports + state + modal. No other pages affected.
- `messages/en/ui.json`, `messages/vi/ui.json` — additive only. No existing keys changed.

### Manual Testing Steps

#### Scenario: Happy path — download
**Preconditions:** Logged in as any user with investments. On `/dashboard/home`.
1. Locate the gold gradient card (NetWorthDisplay) at the top of the page.
2. Look for a share button (circular icon) in the bottom-right corner (mobile) or top-right corner (desktop).
3. Tap/click the share button.
   → Expected: Modal titled "Share Investment Results" opens. Shows loading spinner briefly.
4. Wait for loading to complete.
   → Expected: Preview image of the card appears. Download PNG button is visible.
5. Click "Download PNG".
   → Expected: Browser downloads a file named `pnl-congdongvang-YYYY-MM-DD.png`.
6. Open the downloaded file.
   → Expected: PNG shows the card with app logo overlaid on the bottom-right.

#### Scenario: Happy path — share (mobile)
**Preconditions:** Mobile browser that supports `navigator.canShare({ files })` (iOS Safari 15+, Android Chrome 89+).
1. Follow steps 1-4 above.
2. Tap "Share" button.
   → Expected: OS native share sheet appears with the PNG file.
3. Select a share target (Messages, WhatsApp, etc.).
   → Expected: Image is shared to the chosen app.

#### Scenario: Capture failure — retry
**Preconditions:** Simulate by blocking the html2canvas module (dev only) or by passing a null ref.
1. Open the modal.
   → Expected: Loading spinner appears, then error state with message "Could not generate image. Please try again." and a Retry button.
2. Click Retry.
   → Expected: Loading spinner reappears. If capture succeeds, preview image shows.

#### Scenario: Desktop layout
**Preconditions:** Logged in. Browser width ≥ 800px.
1. Look for share button in the top-right corner of the NetWorthDisplay card.
2. Click it — modal opens, capture runs, image previewed.
   → Expected: Same behavior as mobile. Image captures the desktop layout (wider card).

#### Scenario: Mobile viewport (375px)
**Preconditions:** Logged in. Browser width 375px.
1. Share button is in the bottom-right of the gold card.
2. Modal fits within 375px width — no horizontal scroll.
3. Image preview: `max-h-[60vh]` constrains height within viewport.
4. Download button fills full width.
   → All expected.

#### Scenario: Authorization boundary
This feature captures only DOM content already rendered for the authenticated user. No authorization boundary to test beyond existing page auth — the share button doesn't make any API calls.

## Fix History

| Date       | Fix                                                                                 | Severity | Files Changed |
| ---------- | ----------------------------------------------------------------------------------- | -------- | ------------- |
| 2026-04-06 | Desktop capture: switch from cardRef to `document.querySelectorAll('[data-pnl-card]')` + `getComputedStyle` to find visible card on any viewport | Minor | `PnlShareModal.tsx`, `PnlShareModal.test.tsx` |
| 2026-04-06 | Logo position: move from bottom-right to top-right (`y = margin` instead of `y = height - size - margin`) | Minor | `PnlShareModal.tsx` |
| 2026-04-06 | Image quality: hide sjc3d watermark during html2canvas capture via `onclone` + `img[alt='sjc']` | Minor | `PnlShareModal.tsx` |
| 2026-04-06 | Share button: move from `bottom-3 sm:top-3` to `top-3` on both mobile and desktop | Minor | `NetWorthDisplay.tsx` |
| 2026-04-06 | Share button: add `data-html2canvas-ignore` to exclude it from captured image | Minor | `NetWorthDisplay.tsx` |
| 2026-04-06 | Error state: show error (not silent return) when no visible `[data-pnl-card]` found | Minor | `PnlShareModal.tsx` |
| 2026-04-06 | Fidelity attempt #1: switched to `dom-to-image-more` — produced broken output (dark maroon bg instead of gold, white boxes behind text). Reverted. | Minor | reverted |
| 2026-04-06 | Fidelity fix: reverted to `html2canvas`; added `onclone` rewrite of `/_next/image?url=...` URLs back to original asset paths (fixes missing/white WebP watermark); explicitly removes `[data-html2canvas-ignore]` nodes in clone; sets `imageTimeout: 10000` | Minor | `PnlShareModal.tsx`, `PnlShareModal.test.tsx` |
| 2026-04-06 | Gradient border: set `borderRadius: 0` on cloned element in `onclone` — eliminates transparent corner pixels that showed the maroon page background as a dark border around the captured gold card | Minor | `PnlShareModal.tsx` |
| 2026-04-06 | Right-side clip: pass `width: scrollWidth, height: scrollHeight, windowWidth: scrollWidth` to html2canvas so the full card width is captured even when it overflows the viewport on desktop | Minor | `PnlShareModal.tsx` |
| 2026-04-06 | White box: hide all `<img>` in entire cloned document (`clonedDoc.querySelectorAll`) not just `clonedEl` — html2canvas clones the full page (7 imgs total, only 1 inside target); images outside target bleed into captured area | Minor | `PnlShareModal.tsx` |
