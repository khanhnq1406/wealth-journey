# ADR-001: Manual DI Provider Functions over Google Wire

## Status
Accepted

## Context
The backend's `cmd/server/main.go` had grown to 677+ lines with manual wiring of 16+ repositories, 12+ services, background jobs, and multiple servers. We evaluated dependency injection frameworks to simplify bootstrapping:

- **Google Wire** — compile-time code generation, type-safe
- **Uber fx** — runtime reflection-based DI container
- **Manual provider functions** — explicit functions grouped in `internal/app/providers.go`

## Decision
Use **manual provider functions** in `internal/app/providers.go` with a bootstrap orchestrator in `internal/app/app.go`.

## Rationale
1. **No external dependency** — Wire requires `wire` CLI tool and build step; manual DI is plain Go
2. **Debuggable** — No generated code to step through; all wiring is explicit and readable
3. **Sufficient for our scale** — With ~16 repos and ~12 services, the wiring fits in ~220 lines
4. **Easy onboarding** — New contributors read Go functions, not Wire provider sets
5. **Compile-time safety** — Go's type system already catches missing dependencies

## Consequences
- `cmd/server/main.go` reduced from 677 lines to 7 lines
- All wiring logic lives in `internal/app/` (providers.go + app.go)
- Adding a new service requires adding a provider function and calling it in `app.Run()`
- No code generation step needed in the build pipeline
