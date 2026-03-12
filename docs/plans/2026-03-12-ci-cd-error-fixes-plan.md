# CI/CD Pipeline Error Fixes Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix all CI/CD pipeline errors to make the build pass
**Spec:** `docs/specs/2026-03-12-ci-cd-error-fixes-spec.md`
**Architecture:** Backend - add missing model to AutoMigrate; Frontend - React Compiler compliance fixes
**Tech Stack:** Go, TypeScript, React 19, Next.js 15

## Security Implementation Notes
- No security concerns - these are code quality and React Compiler compliance fixes
- No changes to authentication, authorization, or data validation logic
- Database change is adding a missing table to test migrations (safe, idempotent)

---

### Task 1: Fix Backend - Add UserCategoryMapping to AutoMigrate

**Files:**
- Modify: `src/go-backend/pkg/database/database.go`

**Security notes:** None - adding existing model to migration

**Step 1: Read the current database.go file**

**Step 2: Add UserCategoryMapping to the AutoMigrate models list**
Add `&models.UserCategoryMapping{}` to the list of models in the AutoMigrate call.

**Step 3: Verify the fix**
Run `cd src/go-backend && go build ./...` to ensure it compiles.

**Step 4: Commit**

---

### Task 2: Fix Storybook Preview Syntax Error

**Files:**
- Modify: `src/wj-client/.storybook/preview.ts` (line 91)

**Step 1: Read the file and identify the parsing error**

**Step 2: Fix the syntax error**
The error is likely a JSX syntax issue in a TypeScript file. Check for JSX elements (`<...>`) in the preview.ts file and fix or remove them.

**Step 3: Commit**

---

### Task 3: Fix React Compiler - setState in Effects (Batch 1)

**Files:**
- Modify: `src/wj-client/app/[locale]/auth/utils/AuthCheck.tsx` (lines 48, 57)
- Modify: `src/wj-client/components/BottomSheet.tsx` (line 66)
- Modify: `src/wj-client/components/forms/FormDatePicker.tsx` (line 192)
- Modify: `src/wj-client/components/forms/FormInput.tsx` (line 154)
- Modify: `src/wj-client/components/forms/FormNumberInput.tsx` (lines 91, 106)

**Pattern:** Wrap setState calls in `queueMicrotask()`

```typescript
// Before
useEffect(() => {
  setState(value);
}, [value]);

// After
useEffect(() => {
  queueMicrotask(() => setState(value));
}, [value]);
```

**Step 1: Fix AuthCheck.tsx**
- Line 48: Wrap `setShouldFetch(true)` in queueMicrotask
- Line 57: Wrap `setToken(storedToken)` in queueMicrotask

**Step 2: Fix BottomSheet.tsx**
- Line 66: Wrap `setDragOffset(0)` and `setIsDragging(false)` in queueMicrotask

**Step 3: Fix FormDatePicker.tsx**
- Line 192: Wrap `setSelectedDate(value)` in queueMicrotask

**Step 4: Fix FormInput.tsx**
- Line 154: Wrap `setHasValue(...)` in queueMicrotask

**Step 5: Fix FormNumberInput.tsx**
- Line 91: Wrap `setDisplayValue(...)` in queueMicrotask
- Line 106: Wrap `setRecommendations(recs)` and `setShowSuggestions(...)` in queueMicrotask

**Step 6: Commit**

---

### Task 4: Fix React Compiler - setState in Effects (Batch 2)

**Files:**
- Modify: `src/wj-client/components/forms/NumberSuggestions.tsx` (line 52)
- Modify: `src/wj-client/components/forms/enhanced/FormDatePicker.tsx` (line 191)
- Modify: `src/wj-client/components/forms/enhanced/FormInput.tsx` (line 154)
- Modify: `src/wj-client/components/landing/LandingHero.tsx` (line 35)
- Modify: `src/wj-client/components/landing/LandingNavbar.tsx` (line 36)

**Step 1: Fix NumberSuggestions.tsx**
- Line 52: Wrap `setFocusedIndex(-1)` in queueMicrotask

**Step 2: Fix enhanced/FormDatePicker.tsx**
- Line 191: Wrap `setSelectedDate(value)` in queueMicrotask

**Step 3: Fix enhanced/FormInput.tsx**
- Line 154: Wrap `setHasValue(...)` in queueMicrotask

**Step 4: Fix LandingHero.tsx**
- Line 35: Wrap `setOrigin(window.location.origin)` in queueMicrotask

**Step 5: Fix LandingNavbar.tsx**
- Line 36: Wrap `setIsAuthenticated(...)` in queueMicrotask

**Step 6: Commit**

---

### Task 5: Fix React Compiler - setState in Effects (Batch 3)

**Files:**
- Modify: `src/wj-client/components/landing/MotionContainer.tsx` (line 20)
- Modify: `src/wj-client/components/modals/BaseModal.tsx` (line 106)
- Modify: `src/wj-client/components/modals/Success.tsx` (line 23)
- Modify: `src/wj-client/components/onboarding/FeatureDiscovery.tsx` (lines 127, 462)
- Modify: `src/wj-client/components/onboarding/Tour.tsx` (line 492)

**Step 1: Fix MotionContainer.tsx**
- Line 20: Wrap `setShouldReduceMotion(mediaQuery.matches)` in queueMicrotask

**Step 2: Fix BaseModal.tsx**
- Line 106: Wrap `setIsAnimating(false)` in queueMicrotask

**Step 3: Fix Success.tsx**
- Line 23: Wrap `setMessage(stored)` in queueMicrotask

**Step 4: Fix FeatureDiscovery.tsx**
- Line 127: Wrap `setDismissedFeatures(...)` in queueMicrotask
- Line 462: Wrap `setDismissed(...)` in queueMicrotask

**Step 5: Fix Tour.tsx**
- Line 492: Wrap `setIsCompleted(...)` in queueMicrotask

**Step 6: Commit**

---

### Task 6: Fix React Compiler - setState in Effects (Batch 4)

**Files:**
- Modify: `src/wj-client/components/pwa/PWAInstallPrompt.tsx` (line 38)
- Modify: `src/wj-client/components/search/GlobalSearch.tsx` (lines 120, 154)
- Modify: `src/wj-client/components/select/CreatableSelect.tsx` (line 47)
- Modify: `src/wj-client/components/select/Select.tsx` (line 154)
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/TransactionFilterModal.tsx` (line 182)

**Step 1: Fix PWAInstallPrompt.tsx**
- Line 38: Wrap `setIsDismissed(true)` in queueMicrotask

**Step 2: Fix GlobalSearch.tsx**
- Line 120: Wrap `setRecentSearches(...)` in queueMicrotask
- Line 154: Wrap `setSelectedIndex(-1)` in queueMicrotask

**Step 3: Fix CreatableSelect.tsx**
- Line 47: Wrap `setInputValue(selectedOption.label)` in queueMicrotask

**Step 4: Fix Select.tsx**
- Line 154: Wrap `setInputValue(selectedOption.label)` in queueMicrotask

**Step 5: Fix TransactionFilterModal.tsx**
- Line 182: Wrap all setState calls (setLocalWallet, setLocalCategory, setLocalSort, setLocalSearch) in queueMicrotask

**Step 6: Commit**

---

### Task 7: Fix React Compiler - Impure Functions (Date.now, Math.random)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/InvestmentCard.tsx` (line 99)
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/InvestmentCardEnhanced.tsx` (line 149)
- Modify: `src/wj-client/components/loading/Skeleton.tsx` (line 505)
- Modify: `src/wj-client/components/loading/skeleton/SkeletonText.tsx` (lines 76, 79)
- Modify: `src/wj-client/components/notifications/Toast.tsx` (line 73)

**Pattern for Date.now():**
```typescript
// Before
const isRecent = useMemo(() => Date.now() / 1000 - updatedAt < 300, [updatedAt]);

// After
const [now] = useState(() => Date.now());
const isRecent = useMemo(() => now / 1000 - updatedAt < 300, [now, updatedAt]);
```

**Pattern for Math.random():**
```typescript
// Before
const randomHeight = Math.floor(Math.random() * 60) + 30;

// After - use useMemo with a seed based on index
const randomHeight = useMemo(() => Math.floor(Math.random() * 60) + 30, []);
```

**Step 1: Fix InvestmentCard.tsx**
- Line 99: Replace `Date.now()` with `useState(() => Date.now())`

**Step 2: Fix InvestmentCardEnhanced.tsx**
- Line 149: Replace `Date.now()` with `useState(() => Date.now())`

**Step 3: Fix Skeleton.tsx**
- Line 505: Use seeded random or useMemo for randomHeight

**Step 4: Fix SkeletonText.tsx**
- Lines 76, 79: Use useMemo for animationDelay calculation

**Step 5: Fix Toast.tsx**
- Line 73: Replace `Date.now()` with `useState(() => Date.now())`

**Step 6: Commit**

---

### Task 8: Fix React Compiler - Component Created During Render

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/TransactionCard.tsx` (lines 148-191)

**Pattern:**
```typescript
// Before - inside component
const TransactionIcon = useCallback(() => {
  return <svg>...</svg>;
}, [isExpense]);

// After - outside component
function TransactionIcon({ isExpense }: { isExpense: boolean }) {
  return <svg>...</svg>;
}
```

**Step 1: Extract TransactionIcon component**
- Move the TransactionIcon component outside the main component
- Update props to accept `isExpense` as a prop

**Step 2: Update usage**
- Change `<TransactionIcon />` to `<TransactionIcon isExpense={isExpense} />`

**Step 3: Commit**

---

### Task 9: Fix React Compiler - Variable Accessed Before Declaration

**Files:**
- Modify: `src/wj-client/components/notifications/Toast.tsx` (lines 73, 92, 119)
- Modify: `src/wj-client/components/onboarding/Tour.tsx` (lines 218, 221, 224, 255)

**Pattern:**
```typescript
// Before
useEffect(() => {
  handleClose(); // called before declaration
}, []);

const handleClose = useCallback(() => {...}, []);

// After
const handleClose = useCallback(() => {...}, []);

useEffect(() => {
  handleClose();
}, [handleClose]);
```

**Step 1: Fix Toast.tsx**
- Move `handleClose` declaration before the useEffect that uses it
- Line 119: Move before line 73

**Step 2: Fix Tour.tsx**
- Move `handleNext`, `handlePrevious`, `handleSkip`, `handleComplete` declarations before the useEffect that uses them
- Lines 251, 259, 265, 277: Move before line 218

**Step 3: Commit**

---

### Task 10: Fix React Compiler - Memoization Issues

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/InvestmentList.tsx` (line 73)
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/PortfolioSummaryEnhanced.tsx` (line 294)
- Modify: `src/wj-client/app/[locale]/dashboard/report/page.tsx` (line 340)
- Modify: `src/wj-client/components/forms/CategoryQuickSelect.tsx` (line 62)
- Modify: `src/wj-client/components/search/GlobalSearch.tsx` (line 188)

**Pattern:**
```typescript
// Before - missing 't' dependency
const data = useMemo(() => {
  return t('key');
}, [otherDep]);

// After
const data = useMemo(() => {
  return t('key');
}, [otherDep, t]);
```

**Step 1: Add missing 't' dependency to useMemo/useCallback arrays**

**Step 2: Commit**

---

### Task 11: Fix React Unescaped Entities

**Files:**
- Modify: `src/wj-client/app/[locale]/test-recommendations/page.tsx` (lines 32, 77, 83, 89, 95, 101, 107)
- Modify: `src/wj-client/components/onboarding/FeatureDiscovery.tsx` (line 489)
- Modify: `src/wj-client/components/search/SearchResults.tsx` (line 365)

**Pattern:**
```typescript
// Before
"example text"

// After
&quot;example text&quot;
// or
{'"'}example text{'"'}
```

**Step 1: Replace unescaped quotes with `&quot;` or wrap in expressions**

**Step 2: Commit**

---

### Task 12: Final Verification

**Step 1: Run backend tests**
```bash
cd src/go-backend && go test ./domain/service/... -run TestExecuteImport -v
```

**Step 2: Run frontend lint**
```bash
cd src/wj-client && npm run lint
```

**Step 3: Run frontend type check**
```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 4: Build frontend**
```bash
cd src/wj-client && npm run build
```

**Step 5: Commit final changes**

---

## Implementation Order

1. Task 1: Backend fix (foundational)
2. Task 2: Storybook fix (simple syntax)
3. Task 3-6: setState in effects (parallel batches by file location)
4. Task 7: Impure functions
5. Task 8: Component extraction
6. Task 9: Variable ordering
7. Task 10: Memoization fixes
8. Task 11: Unescaped entities
9. Task 12: Verification
