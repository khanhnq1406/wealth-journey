# Modal Swipe-to-Close Scroll Conflict Fix — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix accidental modal dismissal on mobile by restricting swipe-to-close to the drag handle area only.
**Spec:** `docs/specs/2026-03-20-modal-swipe-scroll-fix-spec.md`
**Architecture:** Pure frontend bugfix. Touch event handlers in `BaseModal.tsx` and `BottomSheet.tsx` currently attach to the entire modal content div. The fix scopes swipe gesture tracking to start only when the touch originates on the drag handle element, using a ref-based approach.
**Tech Stack:** React 19, TypeScript, Tailwind CSS

## Security Implementation Notes

No security concerns — this is a client-side UI gesture fix with no data flow, API, or authorization changes.

## C4 Architecture Diagram Updates

None — no structural changes.

---

### Task 1: Fix BaseModal swipe-to-close to only activate from drag handle

**Files:**
- Modify: `src/wj-client/components/modals/BaseModal.tsx`
- Create: `src/wj-client/components/modals/__tests__/BaseModal.test.tsx`

**Security notes:** None — pure UI gesture change.

**Step 1: Write the failing test**

Create `src/wj-client/components/modals/__tests__/BaseModal.test.tsx`:

```tsx
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BaseModal } from "../BaseModal";
import { NextIntlClientProvider } from "next-intl";

// Mock next-intl
const messages = { common: { close: "Close" } };

function renderModal(props: Partial<React.ComponentProps<typeof BaseModal>> = {}) {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: "Test Modal",
    children: <div data-testid="modal-content">Content</div>,
  };
  const merged = { ...defaultProps, ...props };
  return {
    ...render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <BaseModal {...merged} />
      </NextIntlClientProvider>
    ),
    onClose: merged.onClose,
  };
}

describe("BaseModal swipe-to-close", () => {
  beforeEach(() => {
    // Mock window.innerWidth to simulate mobile (< 800px)
    Object.defineProperty(window, "innerWidth", { value: 375, writable: true });
  });

  it("closes when swiping down on the drag handle", () => {
    const { onClose } = renderModal();
    const dragHandle = screen.getByTestId("modal-drag-handle");

    fireEvent.touchStart(dragHandle, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchMove(dragHandle, {
      touches: [{ clientX: 100, clientY: 250 }],
    });
    fireEvent.touchEnd(dragHandle, {
      changedTouches: [{ clientX: 100, clientY: 250 }],
    });

    // Wait for the close timeout
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT close when swiping down on modal content", () => {
    const { onClose } = renderModal();
    const content = screen.getByTestId("modal-content");

    fireEvent.touchStart(content, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchMove(content, {
      touches: [{ clientX: 100, clientY: 250 }],
    });
    fireEvent.touchEnd(content, {
      changedTouches: [{ clientX: 100, clientY: 250 }],
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT trigger swipe when touch starts on content and moves to handle area", () => {
    const { onClose } = renderModal();
    const content = screen.getByTestId("modal-content");

    // Touch starts in content area
    fireEvent.touchStart(content, {
      touches: [{ clientX: 100, clientY: 300 }],
    });
    // Moves upward past the handle
    fireEvent.touchMove(content, {
      touches: [{ clientX: 100, clientY: 50 }],
    });
    fireEvent.touchEnd(content, {
      changedTouches: [{ clientX: 100, clientY: 50 }],
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest components/modals/__tests__/BaseModal.test.tsx --no-coverage
```

Expected: Tests fail because `data-testid="modal-drag-handle"` doesn't exist yet and swipe currently activates from content area.

**Step 3: Implement the fix in BaseModal.tsx**

The key changes:
1. Add a `dragHandleRef` to track the drag handle element
2. Add `data-testid="modal-drag-handle"` to the drag handle div
3. Move `onTouchStart/onTouchMove/onTouchEnd` from the modal content div to the drag handle div
4. Remove the complex scroll-position detection logic from `handleTouchStart` (no longer needed since swipe is scoped to handle only)
5. Remove the scroll-based exit logic in `handleTouchMove` (same reason)
6. Ensure touch events on the content body are untouched (native scroll works freely)

Specific changes to `BaseModal.tsx`:

a. **Add `dragHandleRef`** alongside existing refs:
```tsx
const dragHandleRef = useRef<HTMLDivElement>(null);
```

b. **Simplify `handleTouchStart`** — remove scroll detection logic:
```tsx
const handleTouchStart = useCallback((e: React.TouchEvent) => {
  const touch = e.touches[0];
  startY.current = touch.clientY;
  startX.current = touch.clientX;
  currentY.current = touch.clientY;
  startTime.current = Date.now();
  setIsDragging(true);

  if (rafId.current !== null) {
    cancelAnimationFrame(rafId.current);
    rafId.current = null;
  }
}, []);
```

c. **Simplify `handleTouchMove`** — remove scroll position checks:
```tsx
const handleTouchMove = useCallback(
  (e: React.TouchEvent) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    currentY.current = touch.clientY;
    const deltaY = currentY.current - startY.current;
    const deltaX = Math.abs(touch.clientX - startX.current);

    // If horizontal movement is greater, it's likely a scroll, not a swipe
    if (deltaX > Math.abs(deltaY)) {
      setIsDragging(false);
      return;
    }

    // Only allow dragging downward
    if (deltaY > 0) {
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          setDragY(deltaY);
          rafId.current = null;
        });
      }

      if (e.cancelable && deltaY > 10) {
        e.preventDefault();
      }
    }
  },
  [isDragging],
);
```

d. **Move touch event handlers from modal content div to drag handle div**:

Remove from the `modalContentRef` div (line ~520-522):
```tsx
// REMOVE these from the modalContentRef div:
onTouchStart={closeOnSwipe ? handleTouchStart : undefined}
onTouchMove={closeOnSwipe ? handleTouchMove : undefined}
onTouchEnd={closeOnSwipe ? handleTouchEnd : undefined}
```

Add to the drag handle div (the `sm:hidden flex justify-center pt-3 pb-2` div), and expand its touch target to at least 44px:
```tsx
{bottomSheetOnMobile && !fullScreenOnMobile && variant !== "full" && (
  <div
    ref={dragHandleRef}
    data-testid="modal-drag-handle"
    className="sm:hidden flex justify-center pt-3 pb-4 cursor-grab active:cursor-grabbing"
    onTouchStart={closeOnSwipe ? handleTouchStart : undefined}
    onTouchMove={closeOnSwipe ? handleTouchMove : undefined}
    onTouchEnd={closeOnSwipe ? handleTouchEnd : undefined}
  >
    <div
      className={cn(
        "w-12 h-1.5 rounded-full transition-colors duration-200",
        isDragging && dragY > 0
          ? dragY > swipeThreshold
            ? "bg-danger-500 dark:bg-danger-600"
            : "bg-v2-red-primary"
          : "bg-neutral-300 dark:bg-dark-border",
      )}
    />
  </div>
)}
```

e. **Keep transform/drag styles on `modalContentRef` div** — the drag handle's touch events still set `dragY` state, which drives the `style={{ transform: translateY(...) }}` on the outer modal content div. This ensures the whole modal slides when dragging the handle.

f. **Remove `touch-none` class from `modalContentRef`** during drag — since the content area no longer receives touch events for swipe, the `touch-none` class is only needed on the drag handle:
```tsx
// In modalContentRef className, REMOVE:
isDragging && "touch-none",
```

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx jest components/modals/__tests__/BaseModal.test.tsx --no-coverage
```

Expected: All 3 tests pass.

**Step 5: Verify drag handle touch target is >= 44px**

The drag handle div has `pt-3 pb-4` (12px + 16px = 28px padding) plus the 6px bar = 34px. That's below 44px. Increase to `pt-4 pb-5` (16px + 20px = 36px + 6px = 42px) — close, but let's use `min-h-[44px]` to guarantee it:

```tsx
<div
  ref={dragHandleRef}
  data-testid="modal-drag-handle"
  className="sm:hidden flex justify-center items-center min-h-[44px] cursor-grab active:cursor-grabbing"
  ...
>
```

**Step 6: Commit**

```
fix(modal): restrict swipe-to-close to drag handle only in BaseModal

Moves touch event handlers from the entire modal content area to the
drag handle element. Content scrolling now works independently without
triggering accidental modal dismissal on mobile.
```

---

### Task 2: Fix BottomSheet swipe-to-close to only activate from drag handle

**Files:**
- Modify: `src/wj-client/components/BottomSheet.tsx`
- Create: `src/wj-client/components/__tests__/BottomSheet.test.tsx`

**Security notes:** None — pure UI gesture change.

**Step 1: Write the failing test**

Create `src/wj-client/components/__tests__/BottomSheet.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { BottomSheet } from "../BottomSheet";

function renderSheet(props: Partial<React.ComponentProps<typeof BottomSheet>> = {}) {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: "Test Sheet",
    children: <div data-testid="sheet-content">Content</div>,
  };
  const merged = { ...defaultProps, ...props };
  return {
    ...render(<BottomSheet {...merged} />),
    onClose: merged.onClose,
  };
}

describe("BottomSheet swipe-to-close", () => {
  it("closes when swiping down on the drag handle", () => {
    const { onClose } = renderSheet();
    const dragHandle = screen.getByTestId("bottom-sheet-drag-handle");

    fireEvent.touchStart(dragHandle, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchMove(dragHandle, {
      touches: [{ clientX: 100, clientY: 250 }],
    });
    fireEvent.touchEnd(dragHandle, {
      changedTouches: [{ clientX: 100, clientY: 250 }],
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("does NOT close when swiping down on content", () => {
    const { onClose } = renderSheet();
    const content = screen.getByTestId("sheet-content");

    fireEvent.touchStart(content, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchMove(content, {
      touches: [{ clientX: 100, clientY: 250 }],
    });
    fireEvent.touchEnd(content, {
      changedTouches: [{ clientX: 100, clientY: 250 }],
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest components/__tests__/BottomSheet.test.tsx --no-coverage
```

Expected: Tests fail because swipe currently activates from the entire sheet.

**Step 3: Implement the fix in BottomSheet.tsx**

The changes mirror BaseModal:

a. **Move touch handlers from the sheet container to the drag handle div**:

Remove from the sheet div (line ~165-167):
```tsx
// REMOVE these from the sheetRef div:
onTouchStart={handleTouchStart}
onTouchMove={handleTouchMove}
onTouchEnd={handleTouchEnd}
```

b. **Add touch handlers and testid to the drag handle div**:
```tsx
{/* Handle bar - visual indicator and swipe zone */}
<div
  data-testid="bottom-sheet-drag-handle"
  className="flex justify-center items-center min-h-[44px] cursor-grab active:cursor-grabbing touch-none"
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
>
  <div className="w-12 h-1.5 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
</div>
```

c. **Keep transform on the outer sheet div** — `dragOffset` state still drives the `style={{ transform }}` on the sheet container, so the whole sheet slides when dragging the handle.

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx jest components/__tests__/BottomSheet.test.tsx --no-coverage
```

Expected: Both tests pass.

**Step 5: Commit**

```
fix(bottom-sheet): restrict swipe-to-close to drag handle only

Same fix as BaseModal — moves touch event handlers to the drag handle
element so content scrolling works independently.
```

---

### Task 3: Run all tests and verify no regressions

**Files:**
- None (verification only)

**Step 1: Run all frontend tests**

```bash
cd src/wj-client && npx jest --no-coverage
```

Expected: All tests pass, no regressions.

**Step 2: Run lint check**

```bash
cd src/wj-client && npx next lint
```

Expected: No lint errors.

**Step 3: Build check**

```bash
cd src/wj-client && npx next build
```

Expected: Build succeeds.

**Step 4: Commit (if any lint/build fixes needed)**

Only if fixes were required. Otherwise, no commit needed.
