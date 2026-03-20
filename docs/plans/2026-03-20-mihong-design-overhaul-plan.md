# Mi Hong Design Overhaul — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Complete visual redesign of all WealthJourney pages to match mihong.vn's traditional Vietnamese gold shop aesthetic — deep maroon backgrounds, gold accents, Roboto font, ornate decorations.

**Spec:** `docs/specs/2026-03-20-mihong-design-overhaul-spec.md`

**Architecture:** Frontend-only CSS/Tailwind migration. No backend, API, or data model changes. The redesign replaces the current V2 Crimson & Gold light-themed palette with a permanently dark maroon theme matching mihong.vn. The existing component structure is preserved — only styling classes and CSS variables change. Dark mode infrastructure is removed since the app becomes permanently dark-themed.

**Tech Stack:** Next.js 15, Tailwind CSS 3.4, CSS custom properties, next/font/google (Roboto + Roboto Mono)

## Security Implementation Notes

This is a frontend-only visual change. No new data flows, APIs, or user inputs.

- Authentication: No changes
- Authorization: No changes
- Input validation: No changes
- Data sanitization: No changes
- Only external dependency change: Google Fonts (Roboto) — already self-hosted at build time via `next/font/google`, same trust model as current fonts

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse (restyle, not replace):**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| BaseCard | `components/BaseCard.tsx` | Restyle bg/border/shadow for maroon theme |
| Button | `components/Button.tsx` | Update color variants (gold primary, maroon secondary) |
| FormInput | `components/forms/FormInput.tsx` | Dark bg, gold focus ring, white text |
| FormSelect | `components/forms/FormSelect.tsx` | Dark bg, gold border, white text |
| FormNumberInput | `components/forms/FormNumberInput.tsx` | Same as FormInput |
| FormTextarea | `components/forms/FormTextarea.tsx` | Same as FormInput |
| FormDatePicker | `components/forms/FormDatePicker.tsx` | Dark bg with gold accents |
| BaseModal | `components/modals/BaseModal.tsx` | Maroon bg, gold header border |
| ConfirmationDialog | `components/modals/ConfirmationDialog.tsx` | Maroon bg with gold accents |
| MobileTable | `components/table/MobileTable.tsx` | Dark rows, gold headers |
| LoadingSpinner | `components/loading/LoadingSpinner.tsx` | Gold colored spinner |
| Skeleton* | `components/loading/skeleton/*.tsx` | Dark shimmer on maroon bg |
| EmptyState | `components/feedback/EmptyState.tsx` | Gold icon, white text on dark bg |
| ErrorState | `components/feedback/ErrorState.tsx` | Bright red icon on dark bg |
| Toast | `components/notifications/Toast.tsx` | Maroon bg with gold border |
| BottomNav | `components/navigation/BottomNav.tsx` | Maroon bg with gold icons |
| NavItem | `components/navigation/NavItem.tsx` | Gold active state |
| Select | `components/select/Select.tsx` | Dark dropdown styling |
| CreatableSelect | `components/select/CreatableSelect.tsx` | Dark dropdown styling |
| ThemeProvider | `components/ThemeProvider.tsx` | Remove entirely (permanent dark theme) |
| ThemeToggle | `components/ThemeToggle.tsx` | Remove entirely |
| LandingNavbar | `components/landing/LandingNavbar.tsx` | Maroon bg with gold text |
| LandingHero | `components/landing/LandingHero.tsx` | Deep maroon gradient |
| LandingCTA | `components/landing/LandingCTA.tsx` | Maroon/gold CTA section |
| Charts (all) | `components/charts/*.tsx` | Dark canvas, gold/red data colors |
| GlobalSearch | `components/search/GlobalSearch.tsx` | Dark bg with gold accents |
| SearchResults | `components/search/SearchResults.tsx` | Dark bg with gold accents |
| GoldSentimentCard | `components/GoldSentimentCard.tsx` | Update theme colors |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| OrnateHeading | `components/decorative/OrnateHeading.tsx` | Reusable section heading with gold ornamental divider lines matching mihong.vn's "GIA VANG HIEN TAI" header style. No existing component has decorative line elements. |
| OrnateDivider | `components/decorative/OrnateDivider.tsx` | Gold ornamental horizontal divider with decorative endpoints. Used for section separation across many pages. CSS-only implementation. |

> **Note:** The spec mentioned `GoldBorderCard` but this can be achieved via a variant prop or className on the existing `BaseCard` — no new component needed.

## C4 Architecture Diagram Updates

Per the spec: "No structural changes. May add a note about the design system migration."

- Modify: `docs/architecture/c4-component-frontend.md` — Add note about mihong.vn design system migration
- No new diagrams needed

## Runtime Flow Diagram Updates

None needed — this is a visual-only change with no business logic, no multi-service flows, no branching.

---

## Implementation Phases

The plan is organized into 4 phases to manage the large scope:

1. **Phase 1: Foundation** (Tasks 0-3) — Config, fonts, CSS variables, dark mode removal
2. **Phase 2: Shared Components** (Tasks 4-10) — Restyle all shared components
3. **Phase 3: Pages** (Tasks 11-18) — Restyle all pages and layouts
4. **Phase 4: Polish** (Tasks 19-21) — Decorative elements, chart colors, final cleanup

---

## Phase 1: Foundation

### Task 0: Update C4 Architecture Documentation

**Files:**

- Modify: `docs/architecture/c4-component-frontend.md`

**Security notes:** None — documentation only.

**Step 1:** Read the existing C4 frontend component diagram.

**Step 2:** Add a note in the "Design System" section about the migration from V2 Crimson & Gold light theme to mihong.vn dark maroon theme. Reference the spec.

**Step 3: Commit**
```
docs(architecture): note mihong.vn design system migration in C4 frontend diagram
```

---

### Task 1: Update Tailwind Config — Color Palette Migration

**Files:**

- Modify: `src/wj-client/tailwind.config.ts`

**Security notes:** None — config-only change.

**Step 1: Update the v2 color tokens**

Replace the entire `v2:` color object in `tailwind.config.ts` with the new mihong.vn palette:

```typescript
v2: {
  // Backgrounds
  "bg-primary": "#5F0202",        // Deep maroon (page backgrounds)
  "bg-surface": "#580202",        // Slightly lighter maroon (card/surface)
  "bg-surface-tint": "#5A0A0A",   // Maroon with slight tint
  "bg-dark": "#3A0101",           // Darkest maroon (footer, deep surfaces)
  // Borders
  "border-light": "rgba(155, 1, 17, 0.2)", // Subtle borders
  border: "#9B0111",              // Standard red border
  // Text
  "text-primary": "#FFFFFF",      // White (primary text on dark bg)
  "text-secondary": "#F1BD61",    // Gold (labels, secondary text)
  "text-tertiary": "#ADB5BD",     // Light gray (muted text)
  "text-on-dark": "#FFFFFF",      // White text
  // Red brand
  "red-primary": "#9B0111",       // mihong red
  "red-dark": "#5F0202",          // Deep maroon (hover/pressed)
  "red-light": "rgba(155, 1, 17, 0.15)", // Red tint bg
  "red-negative": "#F87171",      // Bright red for errors (visible on dark)
  // Gold
  "gold-primary": "#D78B1C",      // mihong gold accent
  "gold-dark": "#B8860B",         // Darker gold (hover)
  "gold-light": "#FDE68A",        // Bright gold (highlights)
  "gold-accent": "#F1BD61",       // Light gold (labels/headings)
  // Green
  "green-positive": "#4ADE80",    // Bright green (gains on dark bg)
  "green-light": "rgba(74, 222, 128, 0.15)", // Green bg tint
  // Silver
  "silver-primary": "#8B929E",
  "silver-dark": "#6B7280",
  "silver-light": "rgba(139, 146, 158, 0.15)",
  // Currency
  "currency-primary": "#60A5FA",
  "currency-dark": "#3B82F6",
  "currency-light": "rgba(96, 165, 250, 0.15)",
  "currency-accent": "#93C5FD",
},
```

**Step 2: Update chart-v2 colors**

```typescript
"chart-v2": {
  gold: "#D78B1C",
  red: "#9B0111",
  "gold-area": "rgba(215, 139, 28, 0.2)",
  silver: "#8B929E",
},
```

**Step 3: Update legacy color aliases**

```typescript
bg: "#9B0111",          // Primary brand color
fg: "#5F0202",          // Background color (now dark)
hgreen: "#5F0202",      // Hover state (maroon)
lred: "#F87171",        // Error (bright red for dark bg)
hover: "#6B0303",       // Hover state on dark
modal: "rgba(0, 0, 0, 0.7)", // Darker modal backdrop
```

**Step 4: Update primary color scale**

```typescript
primary: {
  50: "rgba(155, 1, 17, 0.15)",
  100: "rgba(155, 1, 17, 0.25)",
  200: "rgba(155, 1, 17, 0.35)",
  300: "#9B0111",
  400: "#9B0111",
  500: "#9B0111",       // Primary brand
  600: "#9B0111",
  700: "#5F0202",       // Darker
  800: "#3A0101",       // Darkest
  900: "#2A0101",
  950: "#1A0101",
},
```

**Step 5: Update box shadows for dark theme**

```typescript
boxShadow: {
  card: "0 2px 8px rgba(0, 0, 0, 0.3)",
  "card-hover": "0 4px 12px rgba(0, 0, 0, 0.4)",
  "card-active": "0 1px 4px rgba(0, 0, 0, 0.2)",
  modal: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  dropdown: "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)",
  floating: "0 8px 16px rgba(0, 0, 0, 0.4)",
  focus: "0 0 0 3px rgba(215, 139, 28, 0.4)", // Gold focus ring
  // Remove separate dark-* shadows (now the default)
  "v2-card": "0 2px 12px rgba(0, 0, 0, 0.2)",
},
```

**Step 6: Remove the `dark:` color object entirely** (no longer needed)

**Step 7: Remove `darkMode: "class"` from config** (or set to a no-op value)

**Step 8: Verify build passes**

```bash
cd src/wj-client && npx next build --no-lint 2>&1 | head -20
```

**Step 9: Commit**
```
feat(theme): migrate Tailwind color palette to mihong.vn maroon/gold theme
```

---

### Task 2: Font Migration — Roboto + Roboto Mono

**Files:**

- Modify: `src/wj-client/app/[locale]/layout.tsx`
- Modify: `src/wj-client/app/globals.css`
- Modify: `src/wj-client/tailwind.config.ts` (fontFamily section)

**Security notes:** Font loading via `next/font/google` self-hosts at build time — no runtime CDN dependency.

**Step 1: Update font imports in layout.tsx**

Replace the three font imports:

```typescript
import { Roboto, Roboto_Mono } from "next/font/google";

const roboto = Roboto({
  subsets: ["latin", "latin-ext", "vietnamese"],
  variable: "--font-roboto",
  weight: ["400", "500", "700", "900"],
  preload: true,
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin", "latin-ext", "vietnamese"],
  variable: "--font-roboto-mono",
  weight: ["400", "500", "600", "700"],
  preload: true,
  display: "swap",
});
```

Update the `<body>` className:
```typescript
<body className={`${roboto.variable} ${robotoMono.variable} antialiased h-dvh`}>
```

**Step 2: Update CSS variables in globals.css**

Replace font variable references:
- `var(--font-jakarta-sans)` → `var(--font-roboto)`
- `var(--font-vietnam-pro)` → `var(--font-roboto)`
- `var(--font-jetbrains-mono)` → `var(--font-roboto-mono)`

**Step 3: Update Tailwind fontFamily config**

```typescript
fontFamily: {
  vietnam: ["var(--font-roboto)", "system-ui", "sans-serif"],      // Migration alias
  jetbrains: ["var(--font-roboto-mono)", "ui-monospace", "monospace"], // Migration alias
  jakarta: ["var(--font-roboto)", "system-ui", "sans-serif"],      // Migration alias
  roboto: ["var(--font-roboto)", "system-ui", "sans-serif"],       // New canonical
  "roboto-mono": ["var(--font-roboto-mono)", "ui-monospace", "monospace"], // New canonical
},
```

**Step 4: Update v2 typography classes in globals.css**

```css
.v2-heading-hero { font-family: var(--font-roboto); font-weight: 900; letter-spacing: -1.5px; }
.v2-heading-lg { font-family: var(--font-roboto); font-weight: 700; letter-spacing: -1px; }
.v2-heading-md { font-family: var(--font-roboto); font-weight: 700; letter-spacing: -0.5px; }
.v2-heading-sm { font-family: var(--font-roboto); font-weight: 500; letter-spacing: -0.3px; }
.v2-body { font-family: var(--font-roboto); font-weight: 400; }
.v2-data-bold { font-family: var(--font-roboto-mono); font-weight: 700; letter-spacing: 0.5px; }
.v2-data-semibold { font-family: var(--font-roboto-mono); font-weight: 600; letter-spacing: 1px; }
.v2-data-medium { font-family: var(--font-roboto-mono); font-weight: 500; letter-spacing: 0.5px; }
.v2-data-regular { font-family: var(--font-roboto-mono); font-weight: 400; letter-spacing: 0.5px; }
```

**Step 5: Verify build**

```bash
cd src/wj-client && npx next build --no-lint 2>&1 | head -20
```

**Step 6: Commit**
```
feat(fonts): migrate from Jakarta Sans/Vietnam Pro to Roboto/Roboto Mono
```

---

### Task 3: Update globals.css — Base Styles & Remove Dark Mode CSS

**Files:**

- Modify: `src/wj-client/app/globals.css`
- Modify: `src/wj-client/app/layout.tsx` (themeColor metadata)

**Security notes:** None — CSS-only changes.

**Step 1: Update `:root` CSS variables**

```css
:root {
  --background: #5F0202;
  --foreground: #FFFFFF;
  --btn-green: #D78B1C;        /* Gold primary CTA */
  --btn-green-hover: #B8860B;  /* Gold hover */
  --white: #ffffff;
  --primary-green: #9B0111;    /* mihong red */
  --accent-green: #D78B1C;     /* Gold accent */
  --teal-accent: #F1BD61;      /* Light gold */
  /* V2 mihong.vn */
  --v2-bg-primary: #5F0202;
  --v2-bg-surface: #580202;
  --v2-red-primary: #9B0111;
  --v2-red-dark: #5F0202;
  --v2-gold-primary: #D78B1C;
}
```

**Step 2: Remove the `@media (prefers-color-scheme: dark)` block** (no longer needed)

**Step 3: Update body styles**

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-roboto);
  touch-action: manipulation;
  position: relative;
  min-height: 100vh;
}
```

**Step 4: Remove `.dark` class styles** — Remove the entire `.dark { color-scheme: dark; }` block

**Step 5: Remove dark mode scrollbar styles** — Remove `.dark ::-webkit-scrollbar*` blocks

**Step 6: Update light scrollbar to maroon theme**

```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #3A0101; }
::-webkit-scrollbar-thumb { background: #6B0303; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #9B0111; }
```

**Step 7: Remove `.dark .custom-input` block**

**Step 8: Update `.custom-btn` to gold**

```css
.custom-btn {
  background-color: var(--btn-green);
  color: #3A0101;
  /* ... rest stays */
}
```

**Step 9: Remove `.dark .required` block** and update `.required` to bright red:

```css
.required { color: #F87171; font-size: 0.9em; }
```

**Step 10: Update focus ring color**

```css
*:focus-visible {
  outline: 2px solid #D78B1C;  /* Gold focus ring */
  outline-offset: 2px;
}
```

**Step 11: Update skeleton shimmer for dark background**

The shimmer gradient should be light-on-dark (maroon to slightly lighter maroon).

**Step 12: Remove theme transition styles**

Remove the global `* { transition-property: color, background-color, border-color; }` block and the `.theme-toggle` no-transition block — no longer needed since there's no theme switching.

**Step 13: Update themeColor metadata in layout.tsx**

```typescript
themeColor: "#5F0202",  // Single maroon theme color
```

Remove the media query array.

**Step 14: Verify build**

**Step 15: Commit**
```
feat(theme): update globals.css for mihong.vn dark maroon theme and remove dark mode
```

---

## Phase 2: Shared Components

### Task 4: Remove ThemeProvider and ThemeToggle

**Files:**

- Delete: `src/wj-client/components/ThemeProvider.tsx`
- Delete: `src/wj-client/components/ThemeToggle.tsx`
- Modify: All files importing ThemeProvider/ThemeToggle/useTheme

**Security notes:** None.

**Step 1: Search for all imports of ThemeProvider, ThemeToggle, useTheme**

```bash
grep -r "ThemeProvider\|ThemeToggle\|useTheme" src/wj-client --include="*.tsx" --include="*.ts" -l
```

**Step 2: Remove ThemeProvider wrapper** from wherever it's used (likely in providers.tsx or layout.tsx)

**Step 3: Remove ThemeToggle** from wherever it's rendered (likely in sidebar/header)

**Step 4: Replace `useTheme()` calls** — Any component using `const { theme } = useTheme()` should have that logic removed. If it was used for conditional dark styling, just use the maroon theme directly.

**Step 5: Delete the two files**

**Step 6: Verify build**

**Step 7: Commit**
```
refactor(theme): remove ThemeProvider and ThemeToggle (permanent dark maroon theme)
```

---

### Task 5: Strip `dark:` Prefixed Classes from All Components

**Files:**

- Modify: ~101 files across `components/`, `app/`, `features/`

**Security notes:** None — class removal only.

**Step 1: Systematically remove `dark:` classes**

Go through each file that has `dark:` prefixed classes and remove them. This is a large batch operation but each removal is mechanical — delete the `dark:*` class from the className string.

**Strategy:** Use search-and-replace to remove `dark:` class patterns. Be careful not to remove classes that happen to contain "dark" as part of their name (e.g., `bg-v2-bg-dark` is a legitimate class, `dark:bg-dark-surface` is to be removed).

**Pattern to remove:** Any class starting with `dark:` (e.g., `dark:bg-*`, `dark:text-*`, `dark:border-*`, `dark:hover:*`, `dark:shadow-*`)

**Step 2: Process in batches by directory:**
1. `components/` — largest batch (~60 files)
2. `app/` — page files (~15 files)
3. `features/` — feature components (~26 files)

**Step 3: Verify build after each batch**

**Step 4: Commit**
```
refactor(theme): remove all dark: prefixed Tailwind classes (1402 occurrences across 101 files)
```

---

### Task 6: Restyle BaseCard Component

**Files:**

- Modify: `src/wj-client/components/BaseCard.tsx`

**Security notes:** None.

**Step 0: Read the current BaseCard implementation**

**Step 1: Update base styling**

Change the card's base classes:
- Background: `bg-white` → `bg-v2-bg-surface` (maroon surface)
- Border: Add `border border-v2-border-light` (subtle red border)
- Add gold top border accent: `border-t-2 border-t-v2-gold-primary`
- Shadow: Update to dark-appropriate shadow
- Text color: Ensure white text default

**Step 2: Update hover state** if applicable
- Hover bg: `hover:bg-v2-bg-surface-tint`

**Step 3: Verify the component renders correctly in context**

**Step 4: Commit**
```
feat(BaseCard): restyle for mihong.vn dark maroon theme with gold border accent
```

---

### Task 7: Restyle Button Component

**Files:**

- Modify: `src/wj-client/components/Button.tsx`

**Security notes:** None.

**Step 0: Read current Button implementation**

**Step 1: Update color variants**

- **Primary:** `bg-v2-gold-primary text-v2-bg-dark` → `hover:bg-v2-gold-dark` (Gold button with dark text)
- **Secondary:** `bg-transparent border-2 border-v2-gold-primary text-v2-gold-primary` → `hover:bg-v2-gold-primary/10` (Gold outlined)
- **Ghost:** `bg-transparent text-v2-gold-accent` → `hover:bg-v2-bg-surface-tint` (Gold text on transparent)
- **Danger:** `bg-danger-600 text-white` → keep as-is (red on dark works)
- **Success:** `bg-success-600 text-white` → keep green but ensure brightness

**Step 2: Update focus ring** to gold: `focus-visible:ring-v2-gold-primary`

**Step 3: Update disabled state** for dark background visibility

**Step 4: Commit**
```
feat(Button): restyle variants for mihong.vn gold/maroon theme
```

---

### Task 8: Restyle Form Components

**Files:**

- Modify: `src/wj-client/components/forms/FormInput.tsx`
- Modify: `src/wj-client/components/forms/FormSelect.tsx`
- Modify: `src/wj-client/components/forms/FormNumberInput.tsx`
- Modify: `src/wj-client/components/forms/FormTextarea.tsx`
- Modify: `src/wj-client/components/forms/FormDatePicker.tsx`
- Modify: `src/wj-client/components/forms/FormDateTimePicker.tsx`
- Modify: `src/wj-client/components/forms/FormToggle.tsx`
- Modify: `src/wj-client/components/forms/AmountKeypad.tsx`
- Modify: `src/wj-client/components/forms/CategoryQuickSelect.tsx`
- Modify: `src/wj-client/components/forms/Label.tsx`
- Modify: `src/wj-client/components/forms/FormField.tsx`
- Modify: `src/wj-client/components/forms/FormWizard.tsx`
- Modify: `src/wj-client/components/forms/NumberSuggestions.tsx`
- Modify: `src/wj-client/components/forms/TagInput.tsx`
- Modify: `src/wj-client/components/forms/enhanced/FormInput.tsx`
- Modify: `src/wj-client/components/forms/enhanced/FormSelect.tsx`
- Modify: `src/wj-client/components/forms/enhanced/FormDatePicker.tsx`
- Modify: `src/wj-client/components/forms/enhanced/FormField.tsx`

**Security notes:** None — styling only.

**Step 1: Define common form styling pattern**

All form inputs should use:
- Background: `bg-v2-bg-dark` (#3A0101 — darkest maroon)
- Text: `text-white`
- Placeholder: `placeholder:text-v2-text-tertiary`
- Border: `border border-v2-border-light`
- Focus: `focus:border-v2-gold-primary focus:ring-1 focus:ring-v2-gold-primary`
- Error: `border-v2-red-negative` (bright red)
- Label: `text-v2-text-secondary` (gold)

**Step 2: Apply to each form component** — update className strings

**Step 3: Update enhanced form variants** in `forms/enhanced/`

**Step 4: Verify build**

**Step 5: Commit**
```
feat(forms): restyle all form components for dark maroon theme with gold accents
```

---

### Task 9: Restyle Modal, BottomSheet, Toast, Feedback Components

**Files:**

- Modify: `src/wj-client/components/modals/BaseModal.tsx`
- Modify: `src/wj-client/components/modals/ConfirmationDialog.tsx`
- Modify: `src/wj-client/components/BottomSheet.tsx`
- Modify: `src/wj-client/components/notifications/Toast.tsx`
- Modify: `src/wj-client/components/feedback/EmptyState.tsx`
- Modify: `src/wj-client/components/feedback/ErrorState.tsx`
- Modify: `src/wj-client/components/loading/LoadingSpinner.tsx`
- Modify: `src/wj-client/components/loading/skeleton/*.tsx` (all 5 skeleton files)

**Security notes:** None.

**Step 1: BaseModal** — maroon bg (`bg-v2-bg-surface`), gold header border (`border-b border-v2-gold-primary/30`), gold title text (`text-v2-gold-accent`), white body text

**Step 2: ConfirmationDialog** — inherit BaseModal styling, gold accent buttons

**Step 3: BottomSheet** — maroon bg, gold drag handle

**Step 4: Toast** — maroon bg with gold border, adjust variant colors for visibility on dark

**Step 5: EmptyState** — gold icon color, white text

**Step 6: ErrorState** — bright red (`#F87171`) icon, white text

**Step 7: LoadingSpinner** — gold color (`text-v2-gold-primary`)

**Step 8: Skeletons** — update shimmer gradient from light-on-light to light-on-dark (maroon to slightly lighter maroon)

**Step 9: Commit**
```
feat(components): restyle modals, toast, feedback, and loading components for maroon theme
```

---

### Task 10: Restyle Navigation Components (Sidebar, BottomNav, Header)

**Files:**

- Modify: `src/wj-client/components/navigation/BottomNav.tsx`
- Modify: `src/wj-client/components/navigation/NavItem.tsx`
- Modify: `src/wj-client/components/navigation/SidebarToggle.tsx`
- Modify: `src/wj-client/components/navigation/NavTooltip.tsx`
- Modify: `src/wj-client/components/ActiveLink.tsx`
- Modify: `src/wj-client/components/search/GlobalSearch.tsx`
- Modify: `src/wj-client/components/search/SearchResults.tsx`
- Modify: `src/wj-client/components/select/Select.tsx`
- Modify: `src/wj-client/components/select/CreatableSelect.tsx`

**Security notes:** None.

**Step 1: BottomNav**
- Background: `bg-v2-bg-primary` (maroon)
- Border: `border-t border-v2-border`
- Active icon: `text-v2-gold-primary` with gold dot indicator
- Inactive icon: `text-v2-text-tertiary`

**Step 2: NavItem (sidebar)**
- Active: `text-v2-gold-primary` with gold left border (`border-l-3 border-v2-gold-primary`)
- Inactive: `text-v2-gold-accent/70`
- Hover: `bg-v2-bg-surface-tint`

**Step 3: SidebarToggle** — gold hamburger icon on maroon

**Step 4: GlobalSearch & SearchResults** — dark bg, gold accents

**Step 5: Select/CreatableSelect dropdowns** — dark bg, white text, gold accent

**Step 6: Commit**
```
feat(navigation): restyle sidebar, bottom nav, and search for maroon/gold theme
```

---

## Phase 3: Pages & Layouts

### Task 11: Restyle Dashboard Layout

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`

**Security notes:** None.

**Step 0: Read current dashboard layout**

**Step 1: Update sidebar styling**
- Background: `bg-v2-bg-primary` (deep maroon)
- Logo area: gold-tinted
- Divider: gold accent line

**Step 2: Update content area**
- Background: `bg-v2-bg-surface` (#580202)

**Step 3: Update mobile header**
- Maroon background
- Gold accent line (replace any red line)
- Gold hamburger icon

**Step 4: Commit**
```
feat(dashboard): restyle dashboard layout for maroon/gold theme
```

---

### Task 12: Restyle Landing Page Components

**Files:**

- Modify: `src/wj-client/app/[locale]/landing/page.tsx`
- Modify: `src/wj-client/components/landing/LandingNavbar.tsx`
- Modify: `src/wj-client/components/landing/LandingHero.tsx`
- Modify: `src/wj-client/components/landing/LandingCTA.tsx`
- Modify: `src/wj-client/components/landing/LandingFeatures.tsx`
- Modify: `src/wj-client/components/landing/LandingBankImport.tsx`
- Modify: `src/wj-client/components/landing/LandingTestimonials.tsx`
- Modify: `src/wj-client/components/landing/LandingGoldPriceTable.tsx`
- Modify: `src/wj-client/components/landing/LandingSilverPriceTable.tsx`
- Modify: `src/wj-client/components/landing/LandingGoldPriceChart.tsx`
- Modify: `src/wj-client/components/landing/LandingSilverPriceChart.tsx`
- Modify: `src/wj-client/components/landing/LandingDollarIndexChart.tsx`

**Security notes:** None.

**Step 1: Landing page background** — full dark maroon (`bg-v2-bg-primary`)

**Step 2: LandingNavbar** — maroon bg with gold logo text, gold/white nav links

**Step 3: LandingHero** — dark maroon gradient, gold heading text

**Step 4: Price tables** — match mihong.vn's table styling (gold headers, white data)

**Step 5: Charts** — dark canvas with gold/red color scheme

**Step 6: LandingCTA** — maroon/gold gradient instead of red

**Step 7: Features/Testimonials/BankImport** — dark cards with gold accents

**Step 8: Commit**
```
feat(landing): restyle entire landing page for mihong.vn maroon/gold theme
```

---

### Task 13: Restyle Auth Pages

**Files:**

- Modify: `src/wj-client/app/[locale]/auth/login/page.tsx`
- Modify: `src/wj-client/app/[locale]/auth/register/page.tsx`
- Modify: `src/wj-client/features/auth/forms/LoginPasswordForm.tsx`
- Modify: `src/wj-client/features/auth/forms/RegisterPasswordForm.tsx`
- Modify: `src/wj-client/features/auth/forms/LinkPasswordForm.tsx`
- Modify: `src/wj-client/features/auth/forms/ChangePasswordForm.tsx`
- Modify: `src/wj-client/features/auth/components/AuthMethodsCard.tsx`
- Modify: `src/wj-client/features/auth/components/PasswordStrengthIndicator.tsx`

**Security notes:** Ensure error states remain clearly visible on dark background. Use bright red (#F87171) for error messages.

**Step 1: Login page** — full maroon bg (replace gradient), card with lighter maroon surface + gold border accent

**Step 2: Register page** — same treatment

**Step 3: Auth forms** — dark inputs with gold focus rings, gold submit buttons

**Step 4: Google OAuth button** — style to match theme

**Step 5: Password strength indicator** — adjust colors for dark bg visibility

**Step 6: Commit**
```
feat(auth): restyle login and register pages for maroon/gold theme
```

---

### Task 14: Restyle Dashboard Home Page

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/home/page.tsx`
- Modify: Related home page components (NetWorthDisplay, PNLCard, WalletsSection, etc.)

**Security notes:** None.

**Step 1: Read current home page and identify all components used**

**Step 2: Update page background and section headings** — gold headings, maroon bg

**Step 3: Summary cards** — maroon surface with gold border accents

**Step 4: Commit**
```
feat(home): restyle dashboard home page for maroon/gold theme
```

---

### Task 15: Restyle Prices Page & Market Data Components

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/prices/page.tsx`
- Modify: `src/wj-client/features/market-prices/components/*.tsx`
- Modify: `src/wj-client/components/GoldSentimentCard.tsx`

**Security notes:** None.

**Step 1: Match mihong.vn's gold price table styling** — gold headers, white data text, dark rows with subtle dividers

**Step 2: Tab colors** — gold for gold tab, silver stays, currency gets lighter blue

**Step 3: Change indicators** — bright green/red for visibility on dark

**Step 4: Sentiment card** — update for maroon theme

**Step 5: Commit**
```
feat(prices): restyle prices page to match mihong.vn gold price table styling
```

---

### Task 16: Restyle Transaction, Wallets, Portfolio Pages

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/transaction/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/TransactionCard.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/TransactionFilterModal.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/QuickFilterChips.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/wallets/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/wallets/WalletListView.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/*.tsx`
- Modify: `src/wj-client/components/cards/TransactionCard.tsx`
- Modify: `src/wj-client/components/cards/WealthCard.tsx`

**Security notes:** None.

**Step 1: Transaction page** — dark table, gold headers, white data, filter chips with gold accents

**Step 2: Wallets page** — maroon wallet cards with gold borders

**Step 3: Portfolio page** — dark chart backgrounds, gold/red chart colors

**Step 4: TransactionCard, WealthCard** — update for dark theme

**Step 5: Commit**
```
feat(pages): restyle transaction, wallets, and portfolio pages for maroon/gold theme
```

---

### Task 17: Restyle Budget, Report, Finance, Community Pages

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/budget/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/report/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/report/PeriodSelector.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/finance/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/finance/FinanceTabBar.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/community/page.tsx` (if exists)

**Security notes:** None.

**Step 1: Budget page** — maroon progress bars with gold accents

**Step 2: Report page** — dark tables with gold formatting

**Step 3: Finance page** — maroon-themed financial overview

**Step 4: Community page** — dark background with gold headings

**Step 5: Commit**
```
feat(pages): restyle budget, report, finance, and community pages for maroon/gold theme
```

---

### Task 18: Restyle Settings, Feedback, Admin Pages

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/settings/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/settings/security/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/admin/page.tsx`
- Modify: `src/wj-client/features/admin/components/AdminUsersTab.tsx`
- Modify: `src/wj-client/features/admin/components/AdminFeedbackTab.tsx`
- Modify: `src/wj-client/features/admin/components/Pagination.tsx`
- Modify: `src/wj-client/features/settings/components/LanguageSelector.tsx`
- Modify: Import feature components in `features/import/components/*.tsx` (12+ files)

**Security notes:** None.

**Step 1: Settings page** — dark forms with gold accents, remove theme toggle reference

**Step 2: Admin page** — dark admin panels with gold headers

**Step 3: Import feature components** — all 12+ files need dark theme update

**Step 4: Commit**
```
feat(pages): restyle settings, admin, and import pages for maroon/gold theme
```

---

## Phase 4: Polish & Decorations

### Task 19: Create Decorative Components (OrnateHeading, OrnateDivider)

**Files:**

- Create: `src/wj-client/components/decorative/OrnateHeading.tsx`
- Create: `src/wj-client/components/decorative/OrnateDivider.tsx`

**Security notes:** CSS-only decorations, no user input, no XSS risk.

**Step 0: Component inventory check**
- Verified: No existing decorative components in `components/`
- These are new components justified by mihong.vn's ornate style

**Step 1: OrnateHeading** — Section heading with gold ornamental divider lines

```tsx
// Renders: ——— HEADING TEXT ———
// With decorative gold lines on each side, matching mihong.vn's "GIA VANG HIEN TAI" header
interface OrnateHeadingProps {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}
```

Implementation: CSS `::before` and `::after` pseudo-elements with gold gradient lines, diamond/dot decorative endpoints.

**Step 2: OrnateDivider** — Gold horizontal divider

```tsx
interface OrnateDividerProps {
  className?: string;
  variant?: "simple" | "ornate" | "diamond";
}
```

Implementation: CSS gradients and pseudo-elements for decorative patterns.

**Step 3: Responsive check** — decorations scale properly on mobile

**Step 4: Commit**
```
feat(decorative): add OrnateHeading and OrnateDivider components for mihong.vn style
```

---

### Task 20: Apply Decorative Elements Across Pages

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/prices/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/home/page.tsx`
- Modify: `src/wj-client/app/[locale]/landing/page.tsx`
- Modify: Other pages as appropriate

**Security notes:** None — decoration only.

**Step 1: Add OrnateHeading** to section titles on prices page (matching mihong.vn's "GIA VANG HIEN TAI")

**Step 2: Add OrnateDivider** between content sections on home page

**Step 3: Add gold corner accents** on key cards via CSS pseudo-elements

**Step 4: Landing page** — add ornate dividers between sections

**Step 5: Commit**
```
feat(decorative): apply ornate gold decorations across key pages
```

---

### Task 21: Chart Color Updates & Final Visual Audit

**Files:**

- Modify: `src/wj-client/components/charts/LineChart.tsx`
- Modify: `src/wj-client/components/charts/BarChart.tsx`
- Modify: `src/wj-client/components/charts/DonutChart.tsx`
- Modify: `src/wj-client/components/charts/DonutChartSVG.tsx`
- Modify: `src/wj-client/components/charts/Sparkline.tsx`
- Modify: `src/wj-client/components/charts/TradingViewChart.tsx`
- Modify: `src/wj-client/components/charts/ChartWrapper.tsx`
- Modify: Additional components flagged during visual audit

**Security notes:** None.

**Step 1: Update chart default colors** — gold/red scheme on dark canvas
- Line/area fills: gold primary with alpha
- Grid lines: subtle maroon
- Axes: gold/white text
- Tooltip: maroon bg with gold border

**Step 2: Update ChartWrapper** — ensure dark canvas background

**Step 3: TradingViewChart** — update theme config for dark maroon

**Step 4: Visual audit** — go through each page and fix any remaining light-theme artifacts:
- Check for hardcoded white backgrounds (`bg-white`)
- Check for dark text on dark backgrounds
- Check for invisible borders
- Verify contrast ratios

**Step 5: Commit**
```
feat(charts): update all chart colors for dark maroon/gold theme and complete visual audit
```

---

## Task Dependency Graph

```
Task 0 (docs)          — independent, do first
Task 1 (Tailwind)      — foundation, blocks all component tasks
Task 2 (fonts)         — foundation, blocks all component tasks
Task 3 (globals.css)   — foundation, blocks all component tasks
  ↓
Task 4 (ThemeProvider)  — depends on Tasks 1-3
Task 5 (dark: removal) — depends on Tasks 1-3, can parallel with Task 4
  ↓
Tasks 6-10 (components) — depend on Tasks 1-5, can run in parallel with each other
  ↓
Tasks 11-18 (pages)    — depend on Tasks 6-10, can run in parallel with each other
  ↓
Tasks 19-21 (polish)   — depend on all above
```

## Parallel-Safe Task Groups

These task groups have no file conflicts and can be implemented by parallel agents:

- **Group A:** Tasks 6 + 7 (BaseCard + Button)
- **Group B:** Tasks 8 + 9 (Forms + Modals/Feedback)
- **Group C:** Tasks 11 + 12 + 13 (Dashboard layout + Landing + Auth)
- **Group D:** Tasks 14 + 15 + 16 + 17 + 18 (All dashboard sub-pages)
- **Group E:** Tasks 19 + 20 + 21 (Decorations + Charts)

## Verification Checklist

After all tasks complete:

- [ ] Every page has deep maroon background (no white/light backgrounds)
- [ ] All text is legible: white body text, gold headings/labels
- [ ] Gold border accents on cards
- [ ] Ornate decorative dividers on key pages
- [ ] Roboto font renders Vietnamese diacritics correctly
- [ ] Financial numbers use Roboto Mono with tabular-nums
- [ ] Green/red gain/loss indicators visible on dark background
- [ ] Form inputs have dark backgrounds with gold focus rings
- [ ] Error states clearly visible (bright red on dark)
- [ ] Charts use gold/red colors on dark canvas
- [ ] Loading spinners are gold
- [ ] No remaining `dark:` prefixed classes
- [ ] No ThemeProvider or ThemeToggle references
- [ ] Build succeeds without errors
- [ ] Mobile responsive layouts still work
- [ ] Touch targets >= 44px maintained
- [ ] Focus rings visible (gold) for accessibility
