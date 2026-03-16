# UI Enhancements Batch Specification

## Summary

A batch of 5 small, independent frontend-only UI enhancements to improve user experience across wallet forms, number suggestions, sparkline charts, community posts, and navigation. No backend changes, no API changes, no new data models.

## User Stories

- As a user creating a wallet, I want to see example wallet names in the placeholder so that I know what kind of names to use
- As a user, I want number suggestion chips styled with the app's red brand pattern for visual consistency
- As a user, I want sparkline charts to show a meaningful horizontal line when there's no data or only one data point, instead of showing nothing
- As a community user, I want a "Tặng sao" (donate stars) button on posts that hints at a future feature
- As a user, I want quick access to my community profile from the navigation sidebar

## Functional Requirements

### FR-1: Wallet Name Placeholder Examples

**Description:** Update the wallet name placeholder in CreateWalletForm and EditWalletForm to show example wallet names instead of the generic "Enter wallet's name".

**Acceptance criteria:**
- [ ] English placeholder shows: `e.g. Daily Spending, Savings, Travel Fund`
- [ ] Vietnamese placeholder shows: `vd: Chi tiêu hàng ngày, Tiết kiệm, Du lịch`
- [ ] Both CreateWalletForm and EditWalletForm use the updated placeholder
- [ ] Translation keys updated in `en/wallet.json` and `vi/wallet.json`

### FR-2: NumberSuggestions Red Brand Styling

**Description:** Restyle the NumberSuggestions chip buttons from the current green pattern (`bg-v2-green-light`, `text-v2-green-positive`) to the app's red/primary brand pattern (`bg-v2-red-light`, `text-v2-red-primary`).

**Acceptance criteria:**
- [ ] Chip background: `bg-v2-red-light` (was `bg-v2-green-light`)
- [ ] Chip text: `text-v2-red-primary` (was `text-v2-green-positive`)
- [ ] Chip border: `border-v2-border` (unchanged)
- [ ] Focus ring: `focus:ring-v2-red-primary` (unchanged, already correct)
- [ ] Hover state: `hover:bg-red-100` or similar light red hover
- [ ] Dark mode: `dark:bg-red-900/20 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30`
- [ ] Label text color unchanged (gray)
- [ ] All other behavior (keyboard nav, accessibility) unchanged

### FR-3: Sparkline Empty/Single Data Point Handling

**Description:** Improve sparkline behavior in two components:
1. **Sparkline.tsx** (shared chart component): When data is empty, render a horizontal line at the vertical center. When data has only 1 point, render a horizontal line at that value.
2. **WealthCard.tsx** (inline sparkline): Same behavior — show horizontal line for 0 or 1 data points instead of rendering nothing.

**Acceptance criteria:**
- [ ] Sparkline.tsx with empty data (`[]`): renders a gray horizontal line at center height
- [ ] Sparkline.tsx with 1 data point: renders a horizontal line at that value's y-position, using the same trend color logic (default green for single point)
- [ ] WealthCard.tsx with 0-1 sparkline data points: renders a horizontal line instead of blank space
- [ ] The horizontal line uses reduced opacity (0.5) to indicate "no trend data"
- [ ] Existing behavior for 2+ data points is unchanged
- [ ] PortfolioSummaryEnhanced and other consumers that guard `sparklineData.length > 1` should be updated to allow single-point display

### FR-4: Community Post Donation Button (Coming Soon)

**Description:** Add a "Tặng sao" (donate stars) button to the PostActions component. When clicked, show a toast message indicating the feature is coming soon.

**Acceptance criteria:**
- [ ] New button appears between Share and Save buttons (or after Save)
- [ ] Icon: `Star` from lucide-react
- [ ] Label: "Tặng sao" (hidden on mobile, same pattern as other buttons)
- [ ] Click triggers a toast notification: "Tính năng sẽ sớm được ra mắt!" (Feature coming soon!)
- [ ] Button is always visible (not conditional like Share/Save)
- [ ] Styling matches existing inactive button pattern: `text-v2-text-secondary hover:bg-v2-bg-primary`
- [ ] Uses existing notification/toast system from `NotificationContext`

### FR-5: Navbar "Hồ sơ của bạn" Navigation Item

**Description:** Add a "Hồ sơ của bạn" (Your Profile) item in the premium section of the desktop sidebar and mobile menu, below the existing Community item. Clicking navigates to the community page with the profile view active.

**Acceptance criteria:**
- [ ] New nav item appears in premium section, after Community
- [ ] Label: "Hồ sơ của bạn" (translated via i18n)
- [ ] English label: "Your Profile"
- [ ] Icon: `UserCircle` or `CircleUser` from lucide-react
- [ ] isPremium: true (matches Home, Portfolio, Community styling)
- [ ] Click navigates to `/dashboard/community` with profile view active
- [ ] Since community uses state-based navigation (not URL), we need a mechanism to signal "open profile view"
- [ ] Approach: Use URL query param `?view=profile` and read it in community page to set initial view
- [ ] Animation delay follows the existing stagger pattern (add 30ms after Community's delay)
- [ ] Appears in both desktop sidebar and mobile slide-out menu

## Architecture Changes (C4)

### Diagrams to Update
None — these are minor UI-only changes that don't affect the architectural structure.

### New Diagrams
None needed.

## Runtime Flow Diagrams

### Flow Diagrams to Update
None — no new multi-step business logic.

### New Flow Diagrams
None needed.

## Data Model Changes
None.

## API Changes
None.

## UI/UX Changes

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Wallet form input | `FormInput` | `components/forms/FormInput.tsx` |
| Number suggestion chips | `NumberSuggestions` | `components/forms/NumberSuggestions.tsx` |
| Sparkline chart | `Sparkline` | `components/charts/Sparkline.tsx` |
| Wealth card sparkline | `WealthCard` | `components/cards/WealthCard.tsx` |
| Post action buttons | `PostActions` | `features/community/components/PostActions.tsx` |
| Toast notifications | `NotificationContext` | `contexts/NotificationContext.tsx` |
| Nav items | `NavItem` | `components/navigation/NavItem.tsx` |
| Dashboard sidebar | layout.tsx | `app/[locale]/dashboard/layout.tsx` |
| Translation files | wallet.json, nav.json | `messages/en/`, `messages/vi/` |

### New Components (if any)
None — all enhancements modify existing components.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User | Button click | No | Frontend state | Toast message only |
| 2 | URL | Query param `?view=profile` | No | Frontend state | Read-only, used to set initial view |

### Trust Boundaries
No trust boundaries crossed — all changes are frontend-only, no API calls, no data persistence.

### Threats Identified (STRIDE per boundary crossing)
| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| — | — | — | — | No threats identified | — | Frontend-only UI changes |

### Authorization Rules
No changes — no new API endpoints or data access.

### Input Validation Rules
No user input is collected by these changes (placeholders are display-only, URL query param is a hardcoded enum check).

### External Dependency Risks
None — no new packages or external APIs.

### Sensitive Data Handling
None — no sensitive data involved.

### Issues & Risks Summary
1. FR-5 URL query param approach needs to be read only once on mount (not reactive) to avoid fighting with user navigation within community page
2. FR-3 sparkline changes should not affect performance since SVG rendering is lightweight

## Edge Cases & Error Handling

- FR-3: Sparkline with `null` or `undefined` values in array should be filtered out (existing behavior)
- FR-4: Toast should auto-dismiss after standard timeout
- FR-5: If user navigates to `/dashboard/community?view=profile` directly without being logged in, auth middleware redirects to login (existing behavior)

## Dependencies & Assumptions

- Lucide-react already includes `Star` and `CircleUser` icons
- `NotificationContext` has a `showNotification` or `addToast` method available
- Community page reads URL params via `useSearchParams()` from next/navigation

## Out of Scope

- Backend changes for donation feature (FR-4 is UI placeholder only)
- URL-based routing for community views (only using query param for initial view)
- i18n for toast message in FR-4 (can be hardcoded Vietnamese since the app is primarily Vietnamese)
- Updating Playwright E2E tests (these are minor visual tweaks)
