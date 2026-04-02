# FAB Loading State Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Show a skeleton placeholder in the FAB popup's intro section while site settings are loading, keeping action buttons always visible.

**Spec:** `docs/specs/2026-04-02-fab-loading-state-spec.md`

**Architecture:** Frontend-only change. Add `isLoading` prop to `FloatingActionButton`, pass `fabSettings.isPending` from `DashboardLayout`, render skeleton in intro area when loading.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 3.4, React Query v5

## Security Implementation Notes

- Authentication: N/A — no auth changes
- Authorization: N/A — no server-side changes
- Input validation: N/A — `isLoading` is a boolean from React Query internals, not user input
- Data sanitization: N/A — no user-generated content involved

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `Skeleton` | `components/loading/Skeleton.tsx` | Base shimmer skeleton for intro placeholder lines |
| `FloatingActionButton` | `components/FloatingActionButton.tsx` | Modified to accept `isLoading` prop |

**New components needed (with justification):**

None. The skeleton lines are simple enough to inline using the existing `Skeleton` component — no new component warranted.

## C4 Architecture Diagram Updates

None. Per spec: minor UI behavior change, no new components/services/data flows.

## Runtime Flow Diagrams

None. Per spec: no new API endpoints or business logic.

---

### Task 0: Update C4 Architecture Diagrams

**Skipped.** No architectural changes.

---

### Task 1: Add `isLoading` prop and skeleton to FloatingActionButton

**Files:**

- Modify: `src/wj-client/components/FloatingActionButton.tsx`

**Security notes:** None — purely presentational change.

**Step 1: Add `isLoading` prop to FABProps interface**

Add optional `isLoading?: boolean` to the `FABProps` interface:

```typescript
interface FABProps {
  actions: FABAction[];
  introContent?: { title: string; text: string; contactInfo: string };
  autoOpen?: boolean;
  isLoading?: boolean;
}
```

**Step 2: Import Skeleton and update component**

Import `Skeleton` from `@/components/loading/Skeleton` and destructure `isLoading` from props.

**Step 3: Add skeleton rendering in intro section**

Replace the current intro section conditional:

```typescript
{/* Current */}
{isOpen && introContent && (
  <div className="px-5 pt-4 pb-3">...</div>
)}
```

With:

```typescript
{/* Loading skeleton */}
{isOpen && isLoading && !introContent && (
  <div className="px-5 pt-4 pb-3" aria-busy="true">
    <Skeleton className="h-5 w-32 mb-2" />
    <Skeleton className="h-4 w-full mb-1" />
    <div className="border-t border-v2-gold-primary/20 mt-3 pt-3">
      <Skeleton className="h-3 w-1/2" />
    </div>
  </div>
)}

{/* Actual intro content */}
{isOpen && introContent && (
  <div className="px-5 pt-4 pb-3">...</div>
)}
```

**Step 4: Verify build**

```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 5: Commit**

---

### Task 2: Pass `isPending` from DashboardLayout to FloatingActionButton

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx` (line ~749-761)

**Security notes:** None — forwarding existing React Query state.

**Step 1: Add `isLoading` prop to the FAB usage**

Change the `<FloatingActionButton>` invocation to include `isLoading`:

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
  isLoading={fabSettings.isPending}
/>
```

**Step 2: Verify build**

```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 3: Commit**

---

### Task 3: Manual verification and edge case testing

**Files:** None (verification only)

**Step 1: Verify acceptance criteria**

Manually verify against the spec's acceptance criteria:

- [ ] `FloatingActionButton` accepts `isLoading?: boolean` prop
- [ ] When `isLoading=true` and popup is open, skeleton renders in intro area
- [ ] Action buttons render and are clickable regardless of `isLoading` value
- [ ] When `isLoading` transitions to `false`, skeleton replaced by actual content (or hidden)
- [ ] When `isLoading=false` and `introContent` is `undefined`, no intro section renders
- [ ] Auto-open timing unchanged (500ms)
- [ ] Skeleton area has `aria-busy="true"`

**Step 2: Run lint**

```bash
cd src/wj-client && npm run lint
```

**Step 3: Commit (if lint fixes needed)**
