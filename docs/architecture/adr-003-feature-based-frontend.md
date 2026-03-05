# ADR-003: Feature-Based Frontend Module Organization

## Status
Accepted

## Context
The frontend had 100+ components in flat directories (`components/modals/forms/`, `components/import/`, `lib/validation/`). Related files were scattered:

- Investment forms in `components/modals/forms/`
- Investment validation in `lib/validation/`
- Investment utils in `lib/utils/`
- Investment hooks in `hooks/`

This made it hard to understand feature boundaries and led to accidental coupling between unrelated features.

## Decision
Organize frontend code into **feature-based modules** under `features/`:

```
features/
├── auth/          # hooks/, store/
├── wallet/        # components/, forms/, utils/
├── transaction/   # forms/, hooks/, utils/
├── budget/        # forms/, utils/
├── investment/    # components/, forms/, hooks/, utils/
├── import/        # components/, forms/
├── market-prices/ # (future)
└── report/        # utils/export/
```

## Rationale
1. **Bounded contexts** — Each feature module owns its components, forms, hooks, utils, and validation schemas
2. **Discoverability** — All investment-related code lives in `features/investment/`
3. **Encapsulation** — Feature modules can evolve independently
4. **Import clarity** — `@/features/investment/forms/AddInvestmentForm` is self-documenting

## Migration Strategy
- Used `git mv` to preserve file history
- Re-exported moved files from original barrel exports (e.g., `hooks/index.ts`) for backwards compatibility
- Added ESLint `no-restricted-imports` rules to warn against importing from old paths
- Deleted 11 dead code files (examples, demos, backups, deprecated components)

## Consequences
- Shared components remain in `components/` (Button, BaseCard, BaseModal, etc.)
- Feature-specific code lives in `features/<domain>/`
- Cross-feature imports go through `@/features/<domain>/` paths
- 101 files restructured, 2,848 lines of dead code removed
