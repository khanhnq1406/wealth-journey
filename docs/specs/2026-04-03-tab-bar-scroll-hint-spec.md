# TabBar Scroll Hint — Specification

## Summary

When the `TabBar` (underline variant) contains more tabs than fit in the visible container, users on mobile or narrow viewports cannot tell that additional tabs exist — the tab list scrolls silently. This fix adds a scroll-hint UX to the `TabBar` underline variant: a gradient fade overlay at the overflowing edge(s) plus a clickable chevron button (`<` / `>`) that scrolls the tab list by a fixed amount. The pill variant is not affected (it uses `w-fit` and does not overflow). The approach uses a `ResizeObserver` + `scroll` event listener on the scroll container to track `canScrollLeft` / `canScrollRight` state.

## User Stories

- As a mobile user, I want to see a visual hint (gradient + chevron) when more tabs are hidden to the right, so I know I can scroll to reveal them.
- As a mobile user, I want to click the `>` chevron to scroll the tab list right without having to swipe, so tab navigation is easy with one hand.
- As a desktop user with many tabs, I want the same gradient + chevron hint when tabs overflow the container width.
- As a keyboard user, I should not be disrupted — the chevron buttons must not steal focus during Arrow-key navigation.

## Functional Requirements

### FR-1: Overflow Detection

The `TabBar` (underline variant) wraps its scrollable `div` in a new relative-positioned container. On mount and on every `resize` / `scroll` event, the component computes:

- `canScrollLeft = scrollLeft > 0`
- `canScrollRight = scrollLeft + clientWidth < scrollWidth - 1` (−1 tolerance for sub-pixel rounding)

**Acceptance criteria:**
- [ ] On initial render with no overflow: both flags are `false`, no chevrons shown.
- [ ] On initial render with right overflow: `canScrollRight = true`, right chevron shown.
- [ ] After scrolling to the end: `canScrollRight = false`, right chevron hidden.
- [ ] After scrolling past the start: `canScrollLeft = true`, left chevron shown.
- [ ] On window/container resize that removes overflow: chevrons hidden automatically.

### FR-2: Gradient Fade Overlay

When `canScrollLeft` is true, a left gradient (`from-v2-bg-surface to-transparent`) is rendered as an absolute overlay over the left edge of the tab list. When `canScrollRight` is true, a right gradient (`from-transparent to-v2-bg-surface`) is rendered over the right edge. The gradient width is `w-12` (48px). Overlays are `pointer-events-none` — they do not block tab clicks.

**Acceptance criteria:**
- [ ] Left gradient overlay present when `canScrollLeft = true`.
- [ ] Right gradient overlay present when `canScrollRight = true`.
- [ ] Overlays do not intercept clicks on the underlying tabs.
- [ ] Gradient color matches the sticky wrapper background when `sticky=true`.

### FR-3: Clickable Chevron Buttons

A `<` chevron button is rendered inside the left gradient area when `canScrollLeft = true`. A `>` chevron button is rendered inside the right gradient area when `canScrollRight = true`. Clicking a chevron scrolls the tab list by `scrollAmount` (default: 120px) using `scrollBy({ left: ±scrollAmount, behavior: "smooth" })`.

**Acceptance criteria:**
- [ ] Clicking `>` scrolls the tab list right by ~120px.
- [ ] Clicking `<` scrolls the tab list left by ~120px.
- [ ] Chevron buttons have `aria-label="Scroll tabs left"` / `"Scroll tabs right"` and `aria-hidden="true"` on the icon.
- [ ] Chevron buttons have `tabIndex={-1}` so they don't disrupt roving tabindex keyboard navigation.
- [ ] Chevron buttons meet `min-h-[44px] min-w-[44px]` touch target requirement.

### FR-4: Pill Variant Unchanged

The pill variant (`variant="pill"`) is not affected. It uses `w-fit` with no `overflow-x-auto` and never overflows. No scroll hint is added.

**Acceptance criteria:**
- [ ] Pill variant renders identically to before — no gradient, no chevrons.

### FR-5: Sticky Wrapper Compatibility

When `sticky=true`, the outer wrapper already has `bg-v2-bg-surface`. The gradient overlay must use the same background color token to seamlessly blend. The relative wrapper for overflow detection must be placed inside the sticky wrapper.

**Acceptance criteria:**
- [ ] Gradient blends correctly with sticky wrapper background.

## Non-Functional Requirements

- Performance: `ResizeObserver` observes only the scroll container element, not the document. Disconnect on unmount.
- Accessibility: Chevron buttons have `tabIndex={-1}` (WCAG 2.1 — does not disrupt roving tabindex pattern). `aria-label` describes the action.
- No new npm dependencies — uses native browser APIs only.
- All existing 14 TabBar unit tests must continue to pass.

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-frontend.md`** — Update `TabBar` component description to note "scroll-hint overlay with chevron buttons for overflow detection (underline variant only)".

### New Diagrams

None required — this is a self-contained UI enhancement to an existing component.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — no new API endpoints or multi-service coordination. Pure frontend presentational logic.

## Data Model Changes

None.

## API Changes

None.

## UI/UX Changes

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Tab bar container | `TabBar` | `components/navigation/TabBar.tsx` |
| Chevron icons | `ChevronLeft`, `ChevronRight` from `lucide-react` | Available |
| Gradient overlay | inline Tailwind classes | N/A |

### New Components

None — all changes are within `TabBar.tsx`.

### Visual Design

```
┌─────────────────────────────────────────────────────────┐
│ [<] Gold │ Silver │ Currency │ Symbol Lookup │ Watch [>] │
│  ◀grad                                          grad▶    │
└─────────────────────────────────────────────────────────┘
```

- Left chevron: `ChevronLeft` icon, 16px, gold color, inside a 44×44 button
- Right chevron: `ChevronRight` icon, 16px, gold color, inside a 44×44 button
- Gradient: 48px wide, uses `bg-gradient-to-r from-v2-bg-surface` (left) / `to-v2-bg-surface` (right)
- Chevron button color: `text-v2-gold-accent hover:text-v2-gold-primary`
- Chevron button background: transparent

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | Browser DOM | `scrollLeft`, `scrollWidth`, `clientWidth` | No | React state | Read-only DOM geometry; no user input |
| 2 | User click | Scroll intent | No | `scrollBy()` call | No data persisted or sent |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|------------|-----------------|
| None | N/A | Pure presentational component, no API calls, no auth |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | DOM geometry read | None | Tampering | Attacker modifies DOM to fake overflow state | Low | No security consequence — only affects scroll hint visibility |

### Authorization Rules

None — `TabBar` is a pure UI component with no authorization surface.

### Input Validation Rules

None — no user text input.

### External Dependency Risks

`lucide-react` is already a project dependency. `ResizeObserver` is a standard browser API (supported in all modern browsers including Safari 13.1+).

### Sensitive Data Handling

None — no financial or personal data involved.

### Issues & Risks Summary

1. Sub-pixel rounding in browsers can cause `scrollLeft + clientWidth` to never exactly equal `scrollWidth` — mitigated by a −1px tolerance in `canScrollRight` check.
2. `ResizeObserver` not cleaning up on unmount causes memory leaks — mitigated by `disconnect()` in `useEffect` cleanup.
3. Gradient color mismatch if consumer passes a custom `className` that changes background — accepted; spec uses `v2-bg-surface` which covers all current usage sites.

## Edge Cases & Error Handling

- **Zero tabs**: no overflow, no chevrons shown — handled by existing empty-tabs behavior.
- **One tab**: no overflow possible.
- **All tabs fit**: both flags false, no chevrons. ✓
- **Resize from narrow → wide**: `ResizeObserver` fires, flags recomputed, chevrons hidden if no longer needed.
- **Tab content changes dynamically** (badge count updates): `ResizeObserver` fires on container resize, not on content-only changes. Accepted — badge updates don't change tab count.
- **RTL locales**: `scrollLeft` behaves differently in RTL. Out of scope — app uses LTR only.

## Dependencies & Assumptions

- `lucide-react` is already installed.
- `ResizeObserver` is available in all target browsers (Chrome, Safari, Firefox — all modern versions).
- App uses LTR text direction only.
- Pill variant consumers do not need scroll hints.

## Out of Scope

- RTL scroll hint support.
- Pill variant scroll hints.
- Auto-scrolling the active tab into view on tab change (separate enhancement).
- Touch swipe gesture detection (native `overflow-x-auto` already handles this).
