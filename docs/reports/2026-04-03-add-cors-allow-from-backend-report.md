# Backend CORS Origin Restriction — Implementation Report

## Summary

Replaced the hardcoded `AllowOrigins: []string{"*"}` wildcard in the Gin CORS middleware with a configurable allowlist read from the `CORS_ALLOWED_ORIGINS` environment variable. The change is confined to two files: `pkg/config/config.go` (config parsing) and `internal/app/app.go` (middleware wiring). Default value is `http://localhost:3000` when the env var is not set.

## Spec Reference

`docs/specs/2026-04-03-add-cors-allow-from-backend-spec.md`

## Plan Reference

`docs/plans/2026-04-03-add-cors-allow-from-backend-plan.md`

## Tasks Completed

| #   | Task | Status | Files Changed | Tests | TDD |
| --- | ---- | ------ | ------------- | ----- | --- |
| 0   | Skip — No C4/flow diagrams to update | Skipped | — | — | — |
| 1   | Add CORS sub-struct to Config and parse CORS_ALLOWED_ORIGINS | Done | `config.go`, `config_test.go` | 5/5 pass | Yes |
| 2   | Replace wildcard with cfg.CORS.AllowedOrigins in setupGinEngine | Done | `app.go`, `app_cors_test.go` | 2/2 pass | Yes |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
| ----- | --------- | ----- | ---- | ------------- |
| Backend Config | `pkg/config/config_test.go` | 5 | 5/5 | Multiple origins, whitespace trimming, trailing comma, default value, pre-existing Supabase test |
| Backend App | `internal/app/app_cors_test.go` | 2 | 2/2 | Allowed origin receives CORS header, unlisted origin blocked |

## Security Implementation Summary

| Concern | Implementation | Verified |
| ------- | -------------- | -------- |
| CORS wildcard removed | `AllowOrigins` now reads from `cfg.CORS.AllowedOrigins` | Yes |
| Wildcard re-introduction guard | Startup warning log if `*` detected in allowlist | Yes |
| Operator auditability | Startup log prints active allowlist | Yes |
| AllowCredentials preserved | `AllowCredentials: true` unchanged | Yes |
| Safe default | Defaults to `http://localhost:3000` (not wildcard) | Yes |
| Input handling | `parseCORSAllowedOrigins` splits, trims, drops empty entries | Yes |

## Review Results

### Spec Compliance

Both tasks passed Stage 1 on the first review pass. All acceptance criteria verified in code:
- Multiple origins parsed correctly
- Whitespace trimmed, trailing commas dropped
- Default `http://localhost:3000` when env var unset
- Wildcard replaced with `cfg.CORS.AllowedOrigins`
- All other CORS settings preserved unchanged
- `AllowCredentials: true` preserved

### Security Review

Both tasks APPROVED. The change closes threat T-2 (wildcard CORS allowing any origin with credentialed requests). T-3 (operator re-introducing `*`) is mitigated by the startup warning log. `AllowedOrigins` values are public-facing URLs — logging them at startup is safe and improves operator auditability.

### Code Quality

Both tasks APPROVED. Minor notes from reviewer (non-blocking):
- Test function names `TestSetupGinEngine_CORS*` imply they test `setupGinEngine` directly, but they actually test `gin-contrib/cors` middleware behavior due to heavy dependencies on the full function. Functionally correct; naming could be improved in a future cleanup to `TestCORSMiddleware_*`.
- Test configs in `app_cors_test.go` omit `ExposeHeaders` and `MaxAge` relative to production — acceptable for smoke tests.

## Known Issues / Technical Debt

None. The change is minimal and self-contained.

## Files Changed

| File | Change |
| ---- | ------ |
| `src/go-backend/pkg/config/config.go` | Added `CORS` struct, `CORS CORS` field on `Config`, `parseCORSAllowedOrigins` helper, `"strings"` import, wired into `Load()` |
| `src/go-backend/pkg/config/config_test.go` | Added 4 CORS parsing tests |
| `src/go-backend/internal/app/app.go` | Replaced `[]string{"*"}` with `cfg.CORS.AllowedOrigins`, added startup log + wildcard warning |
| `src/go-backend/internal/app/app_cors_test.go` | Created with 2 CORS smoke tests |

## How to Test

### Unit & Integration Tests

```bash
# Config parsing tests
cd src/go-backend && go test -v ./pkg/config/... -run TestLoadConfig_CORS

# CORS middleware smoke tests
cd src/go-backend && go test -v ./internal/app/... -run TestSetupGinEngine_CORS

# Full short test suite
cd src/go-backend && go test -short ./...
```

Expected: all pass, 0 failures.

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed.

Changed symbols:
- `Config.CORS` (new field) — additive, no existing callers broken
- `parseCORSAllowedOrigins` (new unexported function) — no external callers
- `setupGinEngine` (modified) — called only from `App.Run()` in `internal/app/app.go`; change is backward-compatible (same function signature)

### Manual Testing Steps

#### Scenario: Allowed origin receives CORS headers

**Preconditions:** Backend running with `CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app`

1. Make an OPTIONS preflight request:
   ```
   curl -i -X OPTIONS http://localhost:5000/api/v1/wallets \
     -H "Origin: https://your-frontend.vercel.app" \
     -H "Access-Control-Request-Method: GET"
   ```
2. Expected: Response contains `Access-Control-Allow-Origin: https://your-frontend.vercel.app`

#### Scenario: Unlisted origin is blocked

**Preconditions:** Backend running with `CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app`

1. Make a preflight from an unlisted origin:
   ```
   curl -i -X OPTIONS http://localhost:5000/api/v1/wallets \
     -H "Origin: https://evil.example.com" \
     -H "Access-Control-Request-Method: GET"
   ```
2. Expected: Response does NOT contain `Access-Control-Allow-Origin` header

#### Scenario: Default value (no env var set)

**Preconditions:** Backend running without `CORS_ALLOWED_ORIGINS` set

1. Check startup logs → Expected: `CORS AllowedOrigins: [http://localhost:3000]`
2. Preflight from `http://localhost:3000` → Expected: CORS headers present
3. Preflight from `https://other.com` → Expected: no CORS headers

#### Scenario: Wildcard warning

**Preconditions:** Backend running with `CORS_ALLOWED_ORIGINS=*`

1. Check startup logs → Expected: warning `WARNING: CORS_ALLOWED_ORIGINS contains '*' — this is insecure...`
