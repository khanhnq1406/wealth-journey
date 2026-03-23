# FAB Introduction Card Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Extend the FloatingActionButton to auto-open on the home page and display an admin-configurable intro card (tagline + contact info) above the existing quick action buttons.

**Spec:** `docs/specs/2026-03-23-fab-intro-card-spec.md`

**Architecture:** This feature extends two existing systems — the site settings infrastructure (backend) and the FloatingActionButton component (frontend). No new API endpoints, tables, or bounded contexts. Backend adds 3 keys to the settings whitelist + validation + seed data. Frontend extends the FAB with `autoOpen` + `introContent` props, fetches settings in the dashboard layout via React Query, and adds an admin form section.

**Tech Stack:** Go (site settings service + migration), React/TypeScript (FAB component, dashboard layout, admin page), Tailwind CSS (intro card styling), React Query (settings fetch)

## Security Implementation Notes

- **Authentication**: Read is public (`GET /api/v1/public/site-settings`), write requires admin JWT (`PUT /api/v1/admin/site-settings`)
- **Authorization**: Existing admin middleware on PUT endpoint — no changes needed
- **Input validation**: Server-side key whitelist + `fab.enabled` boolean validation + 500-char limit + HTML tag stripping (all existing patterns)
- **Data sanitization**: `htmlTagRegex` strips HTML tags from all setting values (existing); React auto-escapes on render

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `FloatingActionButton` | `components/FloatingActionButton.tsx` | Base component to extend with new props |
| `BaseCard` | `components/BaseCard.tsx` | Admin form section card wrapper |
| `FormTextarea` | `components/forms/FormTextarea.tsx` | Admin intro text input (maxLength=500) |
| `FormInput` | `components/forms/FormInput.tsx` | Admin contact info input |
| `FormToggle` | `components/forms/FormToggle.tsx` | Admin enabled/disabled toggle |
| `LoadingSpinner` | `components/loading/LoadingSpinner.tsx` | Loading state (if needed) |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| `FABIntroCard` (inline) | Inside `FloatingActionButton.tsx` | Small presentational subcomponent (~15 lines JSX); renders intro text + contact in the FAB menu. Too small for its own file. No existing component matches this specific layout (bordered card inside FAB menu with gold-accent text). |

## C4 Architecture Diagram Updates

No diagram updates needed — spec confirms no structural changes to L3 frontend or backend components. The FAB is already listed as a shared component, and site settings handler already exists.

---

### Task 0: Update C4 Architecture Diagrams

**Skipped** — No structural architecture changes (spec Section "Architecture Changes" confirms this).

---

### Task N-1: Create/Update Runtime Flow Diagrams

**Skipped** — Simple settings read flow following existing site settings pattern. No branching, no multi-service coordination.

---

### Task 1: Backend — Add FAB keys to site settings whitelist + validation

**Files:**

- Modify: `src/go-backend/domain/service/site_settings_service.go:16-22` (validSettingKeys map)
- Modify: `src/go-backend/domain/service/site_settings_service.go:121-138` (validateSettingValue function)

**Security notes:** Keys must be added to whitelist to prevent arbitrary key injection. `fab.enabled` must validate as boolean string to prevent unexpected values.

**Step 1: Add FAB keys to `validSettingKeys` map (line 16-22)**

Add three new keys to the existing map:
```go
"fab.intro_text": true, "fab.contact_info": true, "fab.enabled": true,
```

**Step 2: Add `fab.enabled` validation to `validateSettingValue()` (line 121-138)**

Add a new case in the switch statement:
```go
case "fab.enabled":
    if value != "true" && value != "false" {
        return fmt.Errorf("%s must be 'true' or 'false'", key)
    }
```

**Step 3: Verify Go compiles**
```bash
cd src/go-backend && go build ./...
```

**Step 4: Commit**
```
feat(settings): add fab.intro_text, fab.contact_info, fab.enabled to site settings whitelist
```

---

### Task 2: Backend — Seed FAB default values in migration

**Files:**

- Modify: `src/go-backend/cmd/migrate-site-settings/main.go:41-59` (seeds array)

**Security notes:** Seeds use `FirstOrCreate` pattern — won't overwrite existing values. Safe for re-runs.

**Step 1: Add 3 new seed entries to the seeds array (after line 58)**

```go
{Key: "fab.intro_text", Value: "San choi giao luu, trao doi, kien thuc ve thi truong dau tu tai chinh"},
{Key: "fab.contact_info", Value: "Lien he quang cao: 076.897.2512"},
{Key: "fab.enabled", Value: "true"},
```

**Step 2: Verify Go compiles**
```bash
cd src/go-backend && go build ./cmd/migrate-site-settings/...
```

**Step 3: Commit**
```
feat(settings): seed FAB intro card default values in site settings migration
```

---

### Task 3: Frontend — Extend FloatingActionButton with `autoOpen` and `introContent` props

**Files:**

- Modify: `src/wj-client/components/FloatingActionButton.tsx`

**Security notes:** `introContent` is rendered as plain text via React JSX (auto-escaped, no `dangerouslySetInnerHTML`). No XSS risk.

**Step 0: Component inventory check (MANDATORY)**

- Reusing: `FloatingActionButton` (`@/components/FloatingActionButton`)
- Creating new: `FABIntroCard` inline subcomponent (justified above)

**Step 1: Extend `FABProps` interface (lines 14-16)**

Add optional props:
```typescript
interface FABProps {
  actions: FABAction[];
  introContent?: { text: string; contactInfo: string };
  autoOpen?: boolean;
}
```

**Step 2: Add `autoOpen` effect**

Inside the component, add a `useEffect` that opens the FAB on mount when `autoOpen` is true:
```typescript
useEffect(() => {
  if (autoOpen) {
    const timer = setTimeout(() => setIsOpen(true), 500);
    return () => clearTimeout(timer);
  }
}, [autoOpen]);
```

**Step 3: Add inline `FABIntroCard` subcomponent**

Above the action buttons in the expanded menu, render the intro card when `introContent` is provided:
```typescript
{isOpen && introContent && (
  <div className="bg-v2-maroon-800 border border-v2-gold-primary/30 rounded-2xl px-5 py-4 mb-1">
    <p className="text-v2-gold-accent text-sm leading-relaxed">
      {introContent.text}
    </p>
    <div className="border-t border-v2-gold-primary/20 mt-3 pt-3">
      <p className="text-v2-text-tertiary text-xs">
        {introContent.contactInfo}
      </p>
    </div>
  </div>
)}
```

This renders above the action buttons container (inside the same flex-col layout) and is NOT clickable.

**Step 4: Responsive & accessibility check**

- Mobile (375px): Card max-width matches action pills (fixed by parent flex layout)
- Not interactive: No hover/active states, no tabIndex, no role="button"
- Text wraps naturally for long content (up to 500 chars)

**Step 5: Commit**
```
feat(fab): add autoOpen and introContent props to FloatingActionButton
```

---

### Task 4: Frontend — Fetch FAB settings in dashboard layout and wire to FAB

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx:1-10` (imports)
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx:46-65` (state/hooks)
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx:691-702` (FAB render)

**Security notes:** Public endpoint, no auth needed. Graceful degradation if fetch fails (FAB works normally without intro card).

**Step 1: Add React Query import and site settings fetch**

Add imports:
```typescript
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/utils/api-client";
```

Add query inside the component (after existing state declarations):
```typescript
const fabSettings = useQuery({
  queryKey: ["fab-settings"],
  queryFn: () => apiClient.get<{ settings: { key: string; value: string }[] }>("/api/v1/public/site-settings"),
  staleTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: false,
});
```

**Step 2: Derive FAB intro content from settings**

```typescript
const fabIntroContent = useMemo(() => {
  const settings = fabSettings.data?.data?.settings;
  if (!settings) return undefined;
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  if (map["fab.enabled"] === "false") return undefined;
  const text = map["fab.intro_text"];
  const contactInfo = map["fab.contact_info"];
  if (!text && !contactInfo) return undefined;
  return { text: text || "", contactInfo: contactInfo || "" };
}, [fabSettings.data]);
```

**Step 3: Detect home page and pass props to FAB (lines 691-702)**

```typescript
<FloatingActionButton
  actions={[
    {
      label: tQuickActions("addInvestment"),
      icon: <TrendingUp className="w-6 h-6" />,
      onClick: () => {
        setModalType(ModalType.ADD_INVESTMENT);
      },
    },
  ]}
  autoOpen={path === routes.home}
  introContent={fabIntroContent}
/>
```

Uses existing `path` variable (line 51) and `routes.home` constant.

**Step 4: Verify no import cycle or bundle issues**

- `useQuery` and `apiClient` are already used elsewhere in the app
- `useMemo` is already imported in the layout

**Step 5: Commit**
```
feat(fab): fetch FAB settings in dashboard layout and wire auto-open on home page
```

---

### Task 5: Frontend — Add FAB settings form section in admin page

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/admin/page.tsx:35-53` (FormValues interface)
- Modify: `src/wj-client/app/[locale]/dashboard/admin/page.tsx:57-88` (settingsToForm)
- Modify: `src/wj-client/app/[locale]/dashboard/admin/page.tsx:91-111` (formToSettings)
- Modify: `src/wj-client/app/[locale]/dashboard/admin/page.tsx:309` (after Footer Content BaseCard, before Save Button)

**Security notes:** Admin-only page (wrapped in `AdminGuard`). Form values pass through existing server-side validation.

**Step 0: Component inventory check**

- Reusing: `BaseCard`, `FormTextarea`, `FormInput`, `FormToggle` (all already imported in admin page)
- Creating new: None

**Step 1: Add FAB fields to `FormValues` interface (after line 52)**

```typescript
fab_intro_text: string;
fab_contact_info: string;
fab_enabled: string;
```

**Step 2: Update `settingsToForm()` (add to return object, after line 87)**

```typescript
fab_intro_text: map["fab.intro_text"] || "San choi giao luu, trao doi, kien thuc ve thi truong dau tu tai chinh",
fab_contact_info: map["fab.contact_info"] || "Lien he quang cao: 076.897.2512",
fab_enabled: map["fab.enabled"] || "true",
```

**Step 3: Update `formToSettings()` (add to return array, after line 109)**

```typescript
{ key: "fab.intro_text", value: values.fab_intro_text },
{ key: "fab.contact_info", value: values.fab_contact_info },
{ key: "fab.enabled", value: values.fab_enabled },
```

**Step 4: Add FAB / Welcome section in JSX (after Footer Content card, before Save Button)**

Insert between line 309 (end of Footer Content BaseCard) and line 311 (Save Button div):

```tsx
{/* FAB / Welcome */}
<BaseCard padding="lg">
  <h2 className="text-lg font-semibold text-v2-gold-accent mb-4">
    FAB / Welcome
  </h2>

  <div className="space-y-1">
    <FormToggle
      name="fab_enabled"
      control={control}
      label="Enabled"
      options={[
        { value: "true", label: "Enabled" },
        { value: "false", label: "Disabled" },
      ]}
    />
    <FormTextarea
      name="fab_intro_text"
      control={control}
      label="Introduction Text"
      placeholder="San choi giao luu, trao doi..."
      rows={3}
      maxLength={500}
      showCharacterCount
    />
    <FormInput
      label="Contact Info"
      placeholder="Lien he quang cao: 076.897.2512"
      {...register("fab_contact_info")}
    />
  </div>
</BaseCard>
```

**Step 5: Responsive & accessibility check**

- Form follows existing admin page patterns (same BaseCard structure, same spacing)
- FormToggle, FormTextarea, FormInput all have built-in ARIA support
- Mobile responsive via existing `max-w-4xl` container

**Step 6: Commit**
```
feat(admin): add FAB intro card settings section to admin CMS page
```

---

## Task Dependency Order

```
Task 1 (backend whitelist) ──┐
                              ├── Task 3 (FAB component) ── Task 4 (layout wiring)
Task 2 (backend migration) ──┘                              │
                                                             └── Task 5 (admin form)
```

- **Tasks 1 & 2**: Backend changes, independent of each other, can be done in parallel
- **Task 3**: Frontend FAB extension, independent of backend (uses optional props)
- **Task 4**: Depends on Task 3 (needs new FAB props) — fetches settings and passes to FAB
- **Task 5**: Depends on Tasks 1 & 2 (backend must accept new keys) — admin form for editing
- Tasks 3-5 can technically start in parallel since they modify different files, but Task 4 requires Task 3's interface changes
