# CI/CD Pipeline Error Fixes Specification

## Original Feature
GitHub CI/CD Pipeline Implementation - `docs/reports/2026-03-12-github-ci-cd-pipeline-report.md`

## Issues to Fix

### Backend Issues
| # | Issue | Source | Severity |
|---|-------|--------|----------|
| B1 | `user_category_mapping` table does not exist in test database | Backend test failures | Critical |
| B2 | Import duplicate strategy tests failing due to missing table | `import_duplicate_strategies_test.go` | Critical |

### Frontend Issues
| # | Issue | Source | Severity |
|---|-------|--------|----------|
| F1 | React Compiler: `setState` called synchronously in effects | 30+ files | Critical |
| F2 | React Compiler: Impure functions (`Date.now()`, `Math.random()`) called during render | 5+ files | Critical |
| F3 | React Compiler: Component created during render | `TransactionCard.tsx` | Critical |
| F4 | React Compiler: Variable accessed before declaration | `Tour.tsx`, `Toast.tsx` | Critical |
| F5 | React Compiler: Memoization dependency mismatches | 4+ files | Medium |
| F6 | Storybook preview.ts parsing error | `.storybook/preview.ts:91` | Medium |
| F7 | React unescaped entities | 3 files | Low |

## Root Cause Analysis

### Backend
The `user_category_mapping` table was added for the categorization feature but the migration wasn't included in the test database AutoMigrate. The `database.go` file needs to include this model in the AutoMigrate call.

### Frontend
React Compiler (enabled in Next.js 15) enforces stricter rules:
1. **setState in effects**: React Compiler forbids calling `setState` directly in effect bodies to prevent cascading renders. Solution: Wrap in `queueMicrotask()` or use `setTimeout(..., 0)`.
2. **Impure functions during render**: `Date.now()` and `Math.random()` produce unstable results. Solution: Use `useMemo` with dependency arrays or store in state.
3. **Component creation during render**: Components defined inside other components reset state on each render. Solution: Move component definition outside.
4. **Variable ordering**: Functions must be declared before they're referenced in closures. Solution: Reorder declarations.

## Fix Approach

### Backend Fixes
1. Add `UserCategoryMapping` model to AutoMigrate in `database.go`

### Frontend Fixes
1. **setState in effects pattern**:
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

2. **Impure functions pattern**:
   ```typescript
   // Before
   const isRecent = useMemo(() => Date.now() / 1000 - updatedAt < 300, [updatedAt]);

   // After
   const [now] = useState(() => Date.now());
   const isRecent = useMemo(() => now / 1000 - updatedAt < 300, [now, updatedAt]);
   ```

3. **Component creation pattern**:
   ```typescript
   // Before - inside component
   const TransactionIcon = useCallback(() => ..., []);

   // After - outside component
   function TransactionIcon({ isExpense }) { ... }
   ```

4. **Variable ordering**: Move function declarations before their usage in useEffect/useCallback.

## Regression Risks
- React Compiler fixes may change timing of state updates (now microtask-queued)
- Component extraction may affect prop drilling
- Database migration addition is safe (idempotent)

## Files to Modify

### Backend
- `src/go-backend/pkg/database/database.go` - Add UserCategoryMapping to AutoMigrate

### Frontend
- `src/wj-client/.storybook/preview.ts` - Fix syntax error
- `src/wj-client/app/[locale]/auth/utils/AuthCheck.tsx` - Fix setState in effect
- `src/wj-client/app/[locale]/dashboard/portfolio/components/InvestmentCard.tsx` - Fix Date.now()
- `src/wj-client/app/[locale]/dashboard/portfolio/components/InvestmentCardEnhanced.tsx` - Fix Date.now()
- `src/wj-client/app/[locale]/dashboard/transaction/TransactionCard.tsx` - Fix component creation
- `src/wj-client/app/[locale]/dashboard/transaction/TransactionFilterModal.tsx` - Fix setState in effect
- `src/wj-client/components/BottomSheet.tsx` - Fix setState in effect
- `src/wj-client/components/forms/FormDatePicker.tsx` - Fix setState in effect
- `src/wj-client/components/forms/FormInput.tsx` - Fix setState in effect
- `src/wj-client/components/forms/FormNumberInput.tsx` - Fix setState in effect (2x)
- `src/wj-client/components/forms/NumberSuggestions.tsx` - Fix setState in effect
- `src/wj-client/components/forms/enhanced/FormDatePicker.tsx` - Fix setState in effect
- `src/wj-client/components/forms/enhanced/FormInput.tsx` - Fix setState in effect
- `src/wj-client/components/landing/LandingHero.tsx` - Fix setState in effect
- `src/wj-client/components/landing/LandingNavbar.tsx` - Fix setState in effect
- `src/wj-client/components/landing/MotionContainer.tsx` - Fix setState in effect
- `src/wj-client/components/loading/Skeleton.tsx` - Fix Math.random()
- `src/wj-client/components/loading/skeleton/SkeletonText.tsx` - Fix Math.random() (2x)
- `src/wj-client/components/modals/BaseModal.tsx` - Fix setState in effect
- `src/wj-client/components/modals/Success.tsx` - Fix setState in effect
- `src/wj-client/components/notifications/Toast.tsx` - Fix variable ordering, Date.now()
- `src/wj-client/components/onboarding/FeatureDiscovery.tsx` - Fix setState in effect (2x), unescaped entity
- `src/wj-client/components/onboarding/Tour.tsx` - Fix variable ordering (4x), setState in effect
- `src/wj-client/components/pwa/PWAInstallPrompt.tsx` - Fix setState in effect
- `src/wj-client/components/search/GlobalSearch.tsx` - Fix setState in effect (2x)
- `src/wj-client/components/search/SearchResults.tsx` - Fix unescaped entities
- `src/wj-client/components/select/CreatableSelect.tsx` - Fix setState in effect
- `src/wj-client/components/select/Select.tsx` - Fix setState in effect
- `src/wj-client/app/[locale]/test-recommendations/page.tsx` - Fix unescaped entities

## Out of Scope
- Fixing all react-hooks/exhaustive-deps warnings (non-blocking)
- Fixing jsx-a11y warnings (non-blocking)
- Major refactoring of component architecture
