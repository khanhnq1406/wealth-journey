# Backend CORS Origin Restriction Specification

## Summary

The backend currently allows requests from any origin (`AllowOrigins: ["*"]`), which combined with `AllowCredentials: true` is both a security risk and technically invalid per the CORS spec (browsers reject credentialed requests to wildcard origins). This feature replaces the wildcard with a configurable allowlist read from the `CORS_ALLOWED_ORIGINS` environment variable (comma-separated), parsed in `config.go` and stored in a new `CORS` sub-struct on `Config`. The change is confined to two files: `pkg/config/config.go` and `internal/app/app.go`.

## User Stories

- As a backend operator, I want to restrict which frontend origins can call the API, so that unauthorized third-party clients cannot make credentialed requests.
- As a developer, I want to configure allowed origins via an environment variable, so that I can support production, staging, and local dev without code changes.
- As a security reviewer, I want the CORS allowlist to be explicit and auditable, so that I can verify no unintended origins are permitted.

## Functional Requirements

### FR-1: `CORS_ALLOWED_ORIGINS` Environment Variable

Parse `CORS_ALLOWED_ORIGINS` as a comma-separated list of origins (e.g., `https://app.wealthjourney.com,https://staging.wealthjourney.com`). Strip whitespace around each entry. Store as `[]string` in `Config.CORS.AllowedOrigins`.

**Acceptance criteria:**

- [ ] `CORS_ALLOWED_ORIGINS=https://a.com,https://b.com` → two origins in the allowlist
- [ ] Whitespace is trimmed: `https://a.com , https://b.com` → same result
- [ ] Empty entries from trailing commas are dropped
- [ ] If `CORS_ALLOWED_ORIGINS` is not set, default to `http://localhost:3000` (safe local dev default; no wildcard)

### FR-2: Replace Wildcard in `setupGinEngine`

Replace `AllowOrigins: []string{"*"}` with `AllowOrigins: cfg.CORS.AllowedOrigins`. No other CORS settings change.

**Acceptance criteria:**

- [ ] Requests from an origin in `AllowedOrigins` receive CORS headers
- [ ] Requests from an origin NOT in `AllowedOrigins` receive no CORS headers (browser blocks them)
- [ ] `AllowCredentials: true` is preserved
- [ ] All other CORS settings (methods, headers, expose headers, MaxAge) are unchanged

### FR-3: Config Struct Addition

Add a `CORS` sub-struct to `Config` following the existing pattern (same as `RateLimit`, `YahooFinance`, etc.).

**Acceptance criteria:**

- [ ] `Config.CORS.AllowedOrigins` is a `[]string`
- [ ] `config.go` parses the env var and populates the struct in `Load()`
- [ ] `Validate()` does NOT enforce a non-empty list (empty list is valid — just means no origin is allowed, useful for internal-only deployments)

## Non-Functional Requirements

- **No new dependencies** — uses only `strings.Split` + `strings.TrimSpace` from the standard library
- **Zero downtime change** — only config parsing and middleware setup; no database, no protocol changes
- **Backward compatible** — existing deployments without `CORS_ALLOWED_ORIGINS` get `localhost:3000` default (they lose the old wildcard, but that wildcard was already broken with `AllowCredentials: true`)

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-backend.md` (L3 Backend)** — No structural change needed; CORS config is already represented as part of the Gin middleware setup. No new component is introduced.
- **`c4-container.md` (L2)** — No change; no new runtime unit.

### New Diagrams

None. This is a config-only change with no new domain, service, or repository.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`flow-auth.md`** — No change to auth flow itself; CORS is a pre-flight layer, not part of auth logic.

### New Flow Diagrams

None. CORS preflight is handled entirely by `gin-contrib/cors` middleware; no custom branching logic is introduced.

## Data Model Changes

None. No database tables, migrations, or model changes.

## API Changes

No new endpoints. No request/response shape changes. The change is purely in which origins receive CORS response headers.

## UI/UX Changes

None. This is a backend-only change. The frontend (`wj-client`) has no code changes.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser (any origin) | HTTP request with `Origin` header | Yes: Internet → App | Gin CORS middleware | Middleware checks origin before routing |
| 2 | Gin CORS middleware | Allowed origin decision | No (same process) | Route handler | Only proceeds if origin matches |
| 3 | Route handler | Response + CORS headers | Yes: App → Browser | Browser | `Access-Control-Allow-Origin` set to matched origin |
| 4 | Deployment environment | `CORS_ALLOWED_ORIGINS` env var | Yes: Infra → App | `config.Load()` | Trusted infra boundary; set in Railway dashboard |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | All HTTP requests | `gin-contrib/cors` origin check before handler dispatch |
| Infra → App config | `CORS_ALLOWED_ORIGINS` env var | Set in Railway; not in source code |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Attacker forges `Origin` header to bypass CORS check | Low | CORS is a browser policy; server-side JWT auth is the real auth layer — CORS does not replace it |
| T-2 | 1 | Internet → App | Elevation | Malicious frontend from unauthorized origin makes credentialed request | Medium | Fixed by this feature: only listed origins receive `Access-Control-Allow-Credentials: true` |
| T-3 | 4 | Infra → App | Tampering | `CORS_ALLOWED_ORIGINS` set to wildcard or wrong value by misconfiguration | Medium | Document that `*` must not be used; Validate() can log a warning if `*` is detected |
| T-4 | 3 | App → Browser | Info Disclosure | Error response reveals internal details to cross-origin attacker | Low | Existing error handler (`handler.HandleError`) already sanitizes error messages |

### Authorization Rules

CORS is not an authorization mechanism. All protected endpoints still require JWT via `AuthMiddleware`. CORS only controls which browser origins can initiate the request. Server-side authorization is unchanged.

### Input Validation Rules

| Input | Type | Constraints | Validation Location |
|-------|------|-------------|---------------------|
| `CORS_ALLOWED_ORIGINS` | string (env var) | Comma-separated valid origin URLs | `config.go` Load() — split + trim; no URL format enforcement needed (invalid origins simply won't match) |

### External Dependency Risks

No new external dependencies. `github.com/gin-contrib/cors` is already in use; no version change required.

### Sensitive Data Handling

The `CORS_ALLOWED_ORIGINS` value is not sensitive (it lists public frontend URLs). It is safe to include in application logs at startup.

### Issues & Risks Summary

1. **Breaking change for existing deployments** — Any deployment that relies on `AllowOrigins: ["*"]` (e.g., mobile apps, API testing tools, Postman) will need to add their origin to `CORS_ALLOWED_ORIGINS`. Document this clearly in the env var description.
2. **The current config is already broken** — `AllowOrigins: ["*"]` with `AllowCredentials: true` is rejected by all modern browsers per the CORS spec. The app works today only because non-browser clients (like curl, Postman, the Next.js server-side) don't enforce CORS. This fix is strictly an improvement.
3. **gRPC-Gateway server** — The gRPC-Gateway on port 8081 has no CORS headers at all (confirmed in `domain/gateway/server.go`). This feature does not address that server. It is out of scope because the gateway is not used by the frontend in production (the frontend calls the Gin REST server on port 5000).

## Edge Cases & Error Handling

- **Empty `CORS_ALLOWED_ORIGINS`** — Default to `http://localhost:3000`. Log a warning at startup that no production origin is configured.
- **Trailing comma** — `https://a.com,` → `["https://a.com"]` (empty entry dropped).
- **Single origin** — Works identically to the multi-origin case.
- **Origin with port** — `http://localhost:3000` and `http://localhost:3001` are distinct; both must be listed if needed.

## Dependencies & Assumptions

- `github.com/gin-contrib/cors` is already in `go.mod` — no new dependency.
- `CORS_ALLOWED_ORIGINS` will be set in the Railway dashboard for production deployment.
- The frontend (`wj-client`) runs on a known, stable Vercel domain — operator knows the URL to put in the env var.
- gRPC-Gateway CORS is a separate concern and explicitly out of scope.

## Out of Scope

- gRPC-Gateway CORS configuration (`domain/gateway/server.go`)
- Wildcard subdomain support (e.g., `https://*.vercel.app`)
- Automatic `localhost` bypass in debug mode (Approach C — not selected)
- CORS for the health endpoint (`/health`) — it is public and does not require credentials
