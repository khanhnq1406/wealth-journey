# FetchCode TypeCode Autocomplete Specification

## Summary

Replace the flat button grid of available type codes in the FetchCodeList "Add Fetch Code" form with a new autocomplete component. When the admin types in the typeCode input, a filtered dropdown appears showing matching available codes. Selecting an option fills the input, but the admin can also type a custom code that doesn't exist in the suggestions. The input behaves like a free-text field with optional suggestions — never cleared or reset by the component.

## User Stories

- As an admin, I want to search available type codes by typing a pattern, so that I can quickly find the right code without scanning a long button grid.
- As an admin, I want to enter a custom type code that doesn't exist in the available list, so that I'm not limited to only pre-existing codes.

## Functional Requirements

### FR-1: FilterableAutocomplete Component

Create a new shared component `FilterableAutocomplete` in `components/forms/` that combines a free-text input with a filtered suggestion dropdown.

**Behavior:**
- Input is always freely editable (plain text field)
- On focus or typing, a dropdown appears with suggestions filtered by the input value (case-insensitive substring match)
- Clicking a suggestion or pressing Enter on a highlighted suggestion fills the input
- If no suggestions match, the dropdown shows "No matches" but the input keeps the typed value
- On blur (clicking outside) or pressing Escape, the dropdown closes — input value is never cleared
- Tab closes the dropdown and moves focus normally
- Arrow Up/Down navigate highlighted suggestions
- The component does NOT own form submission — it only manages the text value via `value`/`onChange` props (controlled component)

**Acceptance criteria:**
- [ ] Dropdown filters suggestions as user types (case-insensitive substring)
- [ ] Clicking a suggestion sets the input value
- [ ] Keyboard navigation works (ArrowUp/Down, Enter, Escape, Tab)
- [ ] Custom text that doesn't match any suggestion stays in the input
- [ ] Input value is never cleared/reset by the component on blur
- [ ] Dropdown closes on blur, Escape, and Tab
- [ ] Shows loading state when `isLoading` is true
- [ ] Shows "No matches" when filter produces empty results
- [ ] Meets min 44px touch target
- [ ] Proper ARIA attributes (combobox role, aria-expanded, aria-autocomplete)

### FR-2: Integrate into FetchCodeList

Replace the typeCode `<input>` and the available codes button grid in `FetchCodeList.tsx` with the new `FilterableAutocomplete`.

**Changes:**
- Remove the button grid section (lines 219-237 of current FetchCodeList)
- Replace the plain `<input type="text">` for typeCode (lines 245-251) with `FilterableAutocomplete`
- Pass `availableCodesData?.typeCodes` mapped to suggestions
- Pass `typeCodeInput` / `setTypeCodeInput` as value/onChange
- Pass `availableCodesLoading` as `isLoading`

**Acceptance criteria:**
- [ ] Available codes button grid is removed
- [ ] TypeCode input uses FilterableAutocomplete with available codes as suggestions
- [ ] Form submission still works (typeCode value sent to create mutation)
- [ ] Both existing and custom type codes can be submitted
- [ ] Loading state shows while available codes are being fetched

## Non-Functional Requirements

- **Performance:** Client-side filtering only — no additional API calls. The available codes list (typically 10-50 items) is already fetched and cached by React Query.
- **Accessibility:** ARIA combobox pattern, keyboard navigable, min 44px touch targets.
- **Security:** No new API endpoints, no new data flows. Frontend-only change.

## Architecture Changes (C4)

### Diagrams to Update

None — this is a UI-only change to an existing admin component. No new services, handlers, or repositories.

### New Diagrams

None needed.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — no backend changes, no new API calls.

### New Flow Diagrams

None needed.

## Data Model Changes

None.

## API Changes

None — the existing `GET /api/v1/admin/asset-price-type-codes?assetType=` endpoint continues to serve available codes unchanged.

## UI/UX Changes

### Existing Component Inventory

| Need | Existing Component | Location | Decision |
|------|--------------------|----------|----------|
| Autocomplete with free text | `CreatableSelect` (close but has "Create" prompt) | `components/select/CreatableSelect.tsx` | Inspiration only — its "Create" UX is unwanted |
| Autocomplete (select-only) | `Select` | `components/select/Select.tsx` | Inspiration only — resets input on blur |
| Debounce | `useDebounce` | `hooks/useDebounce.ts` | Not needed — filtering is synchronous on a small list |
| Confirmation dialog | `ConfirmationDialog` | `components/modals/ConfirmationDialog.tsx` | Already used, no change |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| `FilterableAutocomplete` | `components/forms/FilterableAutocomplete.tsx` | Existing Select resets on blur; CreatableSelect has unwanted "Create" prompt. A lightweight free-text input with suggestion dropdown is needed as a reusable shared component. |

### Component Props

```typescript
interface FilterableAutocompleteProps {
  suggestions: string[];        // List of suggestion strings
  value: string;                // Controlled input value
  onChange: (value: string) => void;  // Called on every input change AND on suggestion select
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;          // Shows loading indicator
  noMatchText?: string;         // Text when no suggestions match (default: "No matches")
  className?: string;
}
```

### Visual Design

- Input: Same styling as current typeCode input (`bg-v2-bg-dark`, `border-v2-border`, `text-v2-text-secondary`, `min-h-[44px]`)
- Dropdown: `bg-v2-bg-surface`, `border-v2-border-light`, `rounded-md`, `shadow-dropdown`, `max-h-60 overflow-auto`, `z-dropdown`
- Suggestion item: `text-sm font-mono text-v2-text-secondary`, hover: `bg-v2-bg-surface-tint text-v2-gold-accent`
- Highlighted item (keyboard): `bg-v2-bg-surface-tint text-v2-gold-primary`
- No match text: `text-v2-text-tertiary text-sm`
- Loading: Small spinner (same as CreatableSelect pattern)

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | Admin (browser) | typeCode text | No (client-side only) | FilterableAutocomplete state | Local state, no API call |
| 2 | Available codes (cached) | string[] | No (already in React Query cache) | FilterableAutocomplete suggestions | Data already fetched, just filtered client-side |
| 3 | Admin (browser) | typeCode + priority | Yes: Internet -> App | POST create fetch code | Existing flow, unchanged |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet -> App | Create fetch code POST (existing) | JWT + AdminMiddleware + input validation |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 3 | Internet -> App | Tampering | Admin sends malicious typeCode | Low | Existing server-side validation: typeCode 1-50 chars, must exist in asset_price table |

No new trust boundaries are introduced. The only data flow crossing a boundary (create fetch code POST) is unchanged.

### Authorization Rules

Unchanged — admin-only access enforced by `AuthMiddleware` + `AdminMiddleware`.

### Input Validation Rules

No change — server-side validation on typeCode (1-50 chars, must exist in asset_price) remains. The autocomplete is purely a UI convenience.

### External Dependency Risks

None — no new packages or external APIs.

### Sensitive Data Handling

No sensitive data involved. Type codes are non-sensitive configuration values.

### Issues & Risks Summary

1. **Low risk:** None identified. This is a frontend-only UI enhancement to an admin-only feature.

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| Available codes list is empty (cold start) | Dropdown shows "No matches" for any input; admin can still type custom code |
| Available codes still loading | Input shows loading spinner; dropdown not shown until loaded |
| Admin types very long string | Input accepts it; server rejects if > 50 chars (existing validation) |
| Rapid typing | Filtering is synchronous on a small array — instant, no debounce needed |
| Multiple FetchCodeList instances on page | Each has its own state; no conflict |

## Dependencies & Assumptions

- Available codes endpoint (`GET /api/v1/admin/asset-price-type-codes`) continues to work as-is
- The available codes list is small enough for client-side filtering (typically 10-50 items)
- `CreatableSelect` and `Select` patterns provide proven UX patterns to draw from

## Out of Scope

- Server-side search/filtering of type codes (not needed for small lists)
- Changes to the create fetch code API
- Changes to the available type codes API
- Priority input changes (remains a plain number input)
- Any backend changes
