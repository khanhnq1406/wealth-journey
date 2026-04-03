# Improve Mobile Tab Overflow — Shared TabBar Component Specification

## Summary

The codebase has 8 independent inline tab implementations across pages and feature modules, each duplicating styling logic with minor inconsistencies. This feature replaces all of them with a single shared `TabBar` component placed in `components/navigation/`. The component follows WCAG 2.1 accessibility patterns (keyboard nav, ARIA roles), enforces 44px minimum touch targets, and handles overflow via scrollable tabs with hidden scrollbar. Tab labels accept strings, icons, or arbitrary React nodes (Option C). The existing `FinanceTabBar` in `finance/` will be refactored to use the new shared component, eliminating domain-specific duplication.

---

## User Stories

- As a mobile user, I want tab bars to scroll horizontally without clipping labels, so that I can see and select any tab without confusion.
- As a keyboard user, I want to navigate tabs with arrow keys and Home/End, so that I can access all tabs without a mouse.
- As a developer, I want a single `TabBar` component with a typed API, so that I never duplicate tab styling logic again.
- As a designer, I want consistent active/inactive states across all tab bars, so that the UI looks cohesive on every page.

---

## Functional Requirements

### FR-1: Shared `TabBar` Component

Create `src/wj-client/components/navigation/TabBar.tsx` — a generic, accessible, mobile-friendly tab bar.

**API:**

```typescript
export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode; // string | icon | icon+text — Option C
  disabled?: boolean;
}

export interface TabBarProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  // Optional presentation variants
  variant?: "underline" | "pill";        // default: "underline"
  size?: "sm" | "md";                    // default: "md"
  fullWidthOnMobile?: boolean;           // default: true — flex-1 per tab on mobile
  sticky?: boolean;                      // default: false — adds sticky top-0 z-sticky
  className?: string;                    // outer wrapper override
  ariaLabel?: string;                    // accessible label for the tablist
}
```

**Acceptance criteria:**

- [ ] `tabs` array accepts items with `id` (string), `label` (React node), optional `disabled`
- [ ] `activeTab` highlights the matching tab with `border-b-2 border-v2-gold-primary text-v2-gold-accent font-semibold`
- [ ] Inactive tabs show `text-v2-text-tertiary hover:text-v2-gold-accent`
- [ ] All tab buttons have `min-h-[44px]` (touch target)
- [ ] Tab bar container uses `overflow-x-auto scrollbar-hide` for horizontal scroll on overflow
- [ ] `variant="pill"` renders a pill-style segmented control (rounded buttons with `bg-v2-gold-primary` active background)
- [ ] `sticky=true` wraps in `sticky top-0 z-sticky bg-v2-bg-surface border-b border-v2-border-light`
- [ ] `fullWidthOnMobile=true` applies `flex-1 sm:flex-initial sm:px-6` per tab button
- [ ] Disabled tabs have `opacity-40 cursor-not-allowed pointer-events-none`

### FR-2: Full Keyboard Navigation

**Acceptance criteria:**

- [ ] `role="tablist"` on container, `role="tab"` on each button
- [ ] `aria-selected="true"` on active tab, `false` on others
- [ ] `aria-controls="tabpanel-{id}"` on each tab button
- [ ] `tabIndex={0}` on active tab, `tabIndex={-1}` on all others (roving tabindex)
- [ ] `ArrowRight` → moves focus and activates next tab (wraps around)
- [ ] `ArrowLeft` → moves focus and activates previous tab (wraps around)
- [ ] `Home` → moves to first tab
- [ ] `End` → moves to last tab
- [ ] Focus is managed via `useRef` array (same pattern as `FinanceTabBar`)
- [ ] Disabled tabs are skipped during keyboard navigation

### FR-3: Migrate All Existing Tab Implementations

Replace 7 inline tab implementations with `<TabBar>`. Scope:

| # | File | Current Tabs | Notes |
|---|------|-------------|-------|
| 1 | `finance/FinanceTabBar.tsx` | transaction, report, budget | Replace internals; keep exported `FinanceTabBar` wrapper for i18n compatibility |
| 2 | `features/investment/components/InvestmentDetailModal.tsx` | overview, transactions, add-transaction, set-price | 4 tabs in modal |
| 3 | `app/[locale]/dashboard/prices/page.tsx` | priceAlerts, watchlist, gold, silver, currency, symbol | 6 tabs — overflow is the primary pain point |
| 4 | `app/[locale]/dashboard/admin/page.tsx` | seo, users, feedback, notifications, gold-config | 5 tabs |
| 5 | `features/admin/components/AssetDisplayConfigTable.tsx` | gold, silver, currency | 3 tabs in admin sub-table |
| 6 | `features/community/components/ProfileTabs.tsx` | posts, likes, shared | 3 tabs |
| 7 | `features/community/components/FollowingView.tsx` | following, followers | 2 tabs with badge counts |

**Acceptance criteria per migration:**

- [ ] Inline tab `<div>` and `<button>` markup replaced with `<TabBar tabs={...} activeTab={...} onTabChange={...} />`
- [ ] Tab state management (useState / URL param) remains unchanged in parent — `TabBar` is a controlled component
- [ ] All existing tab labels preserved (including React node labels with badges/counts for FollowingView)
- [ ] Visual appearance matches existing styling (verified by screenshot or manual check)
- [ ] No cross-feature imports introduced

### FR-4: `FinanceTabBar` Backward Compatibility

`FinanceTabBar.tsx` is imported by `finance/page.tsx`. It must continue to export `FinanceTabBar` and `FinanceTab` types unchanged. Internally, it should be refactored to wrap `<TabBar>`.

**Acceptance criteria:**

- [ ] `FinanceTabBar` component still accepts `{ activeTab: FinanceTab; onTabChange: (tab: FinanceTab) => void }` props
- [ ] `FinanceTab` type still exported
- [ ] `FINANCE_TABS` array still exported
- [ ] i18n translations via `useTranslations("finance.tabs")` still applied
- [ ] `sticky=true` and `ariaLabel="Finance sections"` passed to `TabBar`

---

## Non-Functional Requirements

- **Accessibility**: WCAG 2.1 AA — ARIA tablist pattern, keyboard nav, 44px touch targets, focus visible rings
- **Performance**: No new dependencies; pure CSS/React; no bundle size increase beyond the component file
- **Mobile-first**: Works at 320px width with overflow scroll; `sm:` breakpoint at 640px
- **Bundle**: Direct import only — never from a barrel file
- **No new dependencies**: Use only existing `cn`, Tailwind classes, and React built-ins

---

## Architecture Changes (C4)

### Diagrams to Update

**L3 Frontend — `c4-component-frontend.md`:**
- Add `TabBar` to the "Shared Components" container under `components/navigation/`
- Note it replaces inline tab implementations in Investment, Prices, Admin, Community feature modules

### New Diagrams

None required (simple shared UI component, no new domain or data flow).

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — tab switching is pure UI state, no API calls involved.

### New Flow Diagrams

None required.

---

## Data Model Changes

None — purely frontend UI.

---

## API Changes

None — no backend changes.

---

## UI/UX Changes

### Design Decisions (from UX research)

From https://www.eleken.co/blog-posts/tabs-ux:

1. **Scrollable tabs for 5+ items** — never shrink text; horizontal scroll with hidden scrollbar
2. **48×48px touch target** — we use 44px (`min-h-[44px]`) per current design system minimum; acceptable
3. **Never truncate labels** — use `whitespace-nowrap` to prevent label wrap/truncation
4. **Active state uses underline + color** (not color alone) — `border-b-2 border-v2-gold-primary` + `text-v2-gold-accent`
5. **Consistent across device sizes** — same component, behavior adapts via `fullWidthOnMobile`

### Variant Styles

**`underline` variant (default)** — matches all existing implementations:
```
Container: flex overflow-x-auto scrollbar-hide border-b border-v2-border-light
Active button: border-b-2 border-v2-gold-primary text-v2-gold-accent font-semibold
Inactive button: text-v2-text-tertiary hover:text-v2-gold-accent
```

**`pill` variant** — for segmented controls (like price alerts filter tabs in `prices/page.tsx`):
```
Container: flex gap-1 p-1 bg-v2-bg-dark rounded-lg
Active button: bg-v2-gold-primary text-v2-bg-dark font-semibold rounded-md
Inactive button: text-v2-text-tertiary hover:text-v2-gold-accent rounded-md
```

### Size Variants

**`md` (default):** `py-3 text-sm font-medium` — current standard
**`sm`:** `py-2 text-xs font-medium` — for compact contexts (inside modals, sub-tables)

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Shared tab bar | `FinanceTabBar` | `finance/FinanceTabBar.tsx` — domain-specific, not reusable |
| Generic tab bar | **NEW — create** | `components/navigation/TabBar.tsx` |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| `TabBar` | `components/navigation/TabBar.tsx` | Generic reusable tab component; `FinanceTabBar` is hardcoded to finance domain |

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User interaction (click/keyboard) | Tab ID (string) | No | Component state / URL param | Pure UI state, no network call |
| 2 | Parent component | `tabs` prop (array of tab items) | No | TabBar render | Labels are React nodes — see T-1 |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | User input (tab click) | Pure UI — no server interaction |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|-----------|
| T-1 | Props → render | Component | Tampering | `label` is `React.ReactNode` — a caller could pass unsanitized HTML if using `dangerouslySetInnerHTML` inside a label | Low | `TabBar` itself never uses `dangerouslySetInnerHTML`; React's JSX rendering escapes text nodes automatically; only applies if callers do something unusual in their label nodes |
| T-2 | Keyboard events | Component | Tampering | Malformed keyboard events manipulate focus unexpectedly | Low | Only standard key codes handled (`ArrowRight`, `ArrowLeft`, `Home`, `End`); all others ignored with early return |

### Authorization Rules

None — tab visibility is controlled by the parent (e.g., admin tabs only rendered on admin page which is already route-protected).

### Input Validation Rules

- `tabs` array: no validation needed — TypeScript enforces `TabItem<T>[]`
- `activeTab`: TypeScript enforces `T` matches tab ids — no runtime check needed
- Disabled tabs: guarded by `pointer-events-none` + keyboard nav skip

### External Dependency Risks

None — no new external dependencies.

### Sensitive Data Handling

None — tab bar contains no financial data or PII.

### Issues & Risks Summary

1. **FollowingView badge counts in labels**: `FollowingView` currently renders follower/following counts inside tab labels as React nodes. The `label: React.ReactNode` type handles this cleanly — pass `<span>Following <Badge>{count}</Badge></span>` as the label.
2. **FinanceTabBar i18n coupling**: The wrapper approach (FR-4) preserves backward compatibility without touching `finance/page.tsx`.
3. **Admin page typo**: Current `admin/page.tsx` has a suspected `text-bg` typo in active tab class — will be fixed as part of migration.
4. **`pill` variant for prices filter tabs**: The nested price alert filter tabs in `prices/page.tsx` use `aria-pressed` (segmented control pattern), not `aria-selected` (tab pattern). The `pill` variant will still use `role="tab"` + `aria-selected` for consistency; the visual distinction is sufficient.

---

## Edge Cases & Error Handling

- **Empty `tabs` array**: Render empty container (no crash). TypeScript will warn callers.
- **`activeTab` not in `tabs`**: No tab appears active; no crash. Callers should keep state in sync.
- **Single tab**: Renders fine; keyboard nav wraps to same tab (no-op).
- **Long labels on mobile**: `whitespace-nowrap` prevents wrapping; overflow-x-auto handles overflow.
- **Disabled tab is `activeTab`**: Allowed (parent controls state); disabled styling applied but tab renders as selected.

---

## Dependencies & Assumptions

- `cn` utility at `@/lib/utils/cn` — already available
- `scrollbar-hide` CSS class — defined in `globals.css`
- No i18n dependency in `TabBar` itself — callers pass translated strings
- `FinanceTabBar` wrapper handles its own i18n before passing to `TabBar`
- Tailwind `sm:` breakpoint is `640px` (confirmed in `tailwind.config.ts`)

---

## Out of Scope

- **Vertical tab layout** — not needed in current app
- **Animated tab indicator** (sliding underline) — adds complexity, not in current designs
- **URL state management** — `TabBar` is a controlled component; URL sync stays in parent pages
- **Settings hub** — already uses card-based navigation, not tabs; no change needed
- **New i18n translation keys** — `TabBar` accepts pre-translated React nodes; no new keys needed
- **Removing `FinanceTabBar.tsx` file** — keep it as a wrapper to avoid import changes in `finance/page.tsx`
