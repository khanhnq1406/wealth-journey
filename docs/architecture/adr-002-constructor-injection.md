# ADR-002: Constructor Injection over Late-Binding Set* Methods

## Status
Accepted

## Context
Several services used late-binding `Set*` methods to resolve circular dependencies:

- `UserService.SetCategoryService()` — needed for default category creation during registration
- `UserService.SetRepositories()` — injected 8 repo dependencies after construction
- `AuthServer.SetServices()` — injected UserService and CategoryService post-construction

These patterns created hidden coupling, made dependencies non-obvious, and risked nil pointer panics if `Set*` was called in the wrong order.

## Decision
Replace all `Set*` methods with **constructor injection**. Pass all dependencies upfront in `New*()` constructors.

## Rationale
1. **Explicit dependencies** — Constructor signature documents exactly what a service needs
2. **Compile-time safety** — Missing dependencies cause build errors, not runtime panics
3. **No circular imports** — Reordering service construction in `NewServices()` into dependency phases eliminates the need for late binding
4. **Testability** — Integration tests pass all deps (or nil) explicitly

## Resolution of Circular Dependencies
The apparent circular dependency `UserService ↔ CategoryService` was not a Go import cycle. It was a construction-order problem solved by:

1. Phase 1: Create `CategoryService` (no service dependencies)
2. Phase 2: Create `UserService` (receives `CategoryService` in constructor)
3. Phase 3: Create remaining services

## Consequences
- `NewUserService()` now takes 10 parameters (all deps upfront)
- `NewServer()` (auth) now takes 5 parameters
- `grep -r "SetServices\|SetCategoryService\|SetRepositories" .` returns nothing
- All `if us, ok := userSvc.(*userService)` type-cast hacks removed from `services.go`
