# Backend CORS Origin Restriction Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace `AllowOrigins: ["*"]` with a configurable allowlist read from `CORS_ALLOWED_ORIGINS` env var, confined to two files: `pkg/config/config.go` and `internal/app/app.go`.
**Spec:** `docs/specs/2026-04-03-add-cors-allow-from-backend-spec.md`
**Architecture:** No new components, no new layers. Config parsing change in `pkg/config/config.go` adds a `CORS` sub-struct to `Config`. Gin setup change in `internal/app/app.go` reads `cfg.CORS.AllowedOrigins` instead of the hardcoded wildcard. Change is purely in config parsing and middleware wiring.
**Tech Stack:** Go stdlib (`strings.Split`, `strings.TrimSpace`), existing `github.com/gin-contrib/cors` package (no new dep).

## Security Implementation Notes

- **Authentication:** Unchanged — all protected endpoints still require JWT via `AuthMiddleware`
- **Authorization:** Unchanged — CORS is a browser pre-flight policy, not an authorization mechanism
- **Input validation:** `CORS_ALLOWED_ORIGINS` env var is split+trimmed; no URL format enforcement needed (invalid origins just won't match). Log the final allowlist at startup so operators can audit it.
- **Data sanitization:** Not applicable — no user input flows through this change
- **Critical concern (T-3):** If `*` is passed as an origin string it will be stored as-is and could re-introduce the wildcard problem. The spec calls for a startup warning log if `*` is detected in the allowlist.

## Component Reuse Inventory (Frontend Tasks)

_This is a backend-only change. No frontend components involved._

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| N/A | N/A | No frontend work |

**New components needed:** None.

## C4 Architecture Diagram Updates

Per the spec (Architecture Changes section): **No diagram changes needed.** CORS config is already part of Gin middleware setup in the existing C4 Component Backend diagram. No new component is introduced.

---

### Task 0: Skip — No C4 or flow diagrams to update

Per spec: no structural change, no new runtime flow. This task is explicitly a skip.

---

### Task 1: Add `CORS` sub-struct to `Config` and parse `CORS_ALLOWED_ORIGINS`

**Files:**

- Modify: `src/go-backend/pkg/config/config.go` (add `CORS` struct + field + parsing in `Load()`)
- Modify: `src/go-backend/pkg/config/config_test.go` (add tests for CORS parsing)

**Security notes:** Log the final `AllowedOrigins` slice at startup (done in Task 2 in `app.go`). Warn if `*` is in the list (T-3 threat). `Validate()` does NOT enforce non-empty (per spec FR-3).

**Step 1: Write the failing test**

Add to `src/go-backend/pkg/config/config_test.go`:

```go
func TestLoadConfig_CORS_MultipleOrigins(t *testing.T) {
    _ = os.Setenv("JWT_SECRET", "test-secret-key-12345")
    _ = os.Setenv("CORS_ALLOWED_ORIGINS", "https://a.com,https://b.com")
    defer func() {
        _ = os.Unsetenv("JWT_SECRET")
        _ = os.Unsetenv("CORS_ALLOWED_ORIGINS")
    }()

    cfg, err := Load()
    if err != nil {
        t.Fatalf("Failed to load config: %v", err)
    }
    if len(cfg.CORS.AllowedOrigins) != 2 {
        t.Errorf("Expected 2 origins, got %d", len(cfg.CORS.AllowedOrigins))
    }
    if cfg.CORS.AllowedOrigins[0] != "https://a.com" {
        t.Errorf("Expected first origin 'https://a.com', got %s", cfg.CORS.AllowedOrigins[0])
    }
    if cfg.CORS.AllowedOrigins[1] != "https://b.com" {
        t.Errorf("Expected second origin 'https://b.com', got %s", cfg.CORS.AllowedOrigins[1])
    }
}

func TestLoadConfig_CORS_WhitespaceTrimmed(t *testing.T) {
    _ = os.Setenv("JWT_SECRET", "test-secret-key-12345")
    _ = os.Setenv("CORS_ALLOWED_ORIGINS", "  https://a.com , https://b.com  ")
    defer func() {
        _ = os.Unsetenv("JWT_SECRET")
        _ = os.Unsetenv("CORS_ALLOWED_ORIGINS")
    }()

    cfg, err := Load()
    if err != nil {
        t.Fatalf("Failed to load config: %v", err)
    }
    if len(cfg.CORS.AllowedOrigins) != 2 {
        t.Errorf("Expected 2 origins after trimming, got %d", len(cfg.CORS.AllowedOrigins))
    }
    if cfg.CORS.AllowedOrigins[0] != "https://a.com" {
        t.Errorf("Expected trimmed origin 'https://a.com', got %s", cfg.CORS.AllowedOrigins[0])
    }
}

func TestLoadConfig_CORS_TrailingCommaDropped(t *testing.T) {
    _ = os.Setenv("JWT_SECRET", "test-secret-key-12345")
    _ = os.Setenv("CORS_ALLOWED_ORIGINS", "https://a.com,")
    defer func() {
        _ = os.Unsetenv("JWT_SECRET")
        _ = os.Unsetenv("CORS_ALLOWED_ORIGINS")
    }()

    cfg, err := Load()
    if err != nil {
        t.Fatalf("Failed to load config: %v", err)
    }
    if len(cfg.CORS.AllowedOrigins) != 1 {
        t.Errorf("Expected 1 origin (trailing comma dropped), got %d", len(cfg.CORS.AllowedOrigins))
    }
}

func TestLoadConfig_CORS_DefaultLocalhost(t *testing.T) {
    _ = os.Setenv("JWT_SECRET", "test-secret-key-12345")
    _ = os.Unsetenv("CORS_ALLOWED_ORIGINS") // ensure not set
    defer func() {
        _ = os.Unsetenv("JWT_SECRET")
    }()

    cfg, err := Load()
    if err != nil {
        t.Fatalf("Failed to load config: %v", err)
    }
    if len(cfg.CORS.AllowedOrigins) != 1 {
        t.Errorf("Expected 1 default origin, got %d", len(cfg.CORS.AllowedOrigins))
    }
    if cfg.CORS.AllowedOrigins[0] != "http://localhost:3000" {
        t.Errorf("Expected default 'http://localhost:3000', got %s", cfg.CORS.AllowedOrigins[0])
    }
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test ./pkg/config/... -run TestLoadConfig_CORS -v
```

Expected: `cfg.CORS` field does not exist → compile error (red).

**Step 3: Write minimal implementation**

In `src/go-backend/pkg/config/config.go`:

1. Add the `CORS` struct after the `Storage` struct:

```go
type CORS struct {
    AllowedOrigins []string
}
```

2. Add `CORS CORS` field to `Config` struct after `Storage Storage`.

3. Add a helper function (after `getEnv`) to parse the env var:

```go
func parseCORSAllowedOrigins(raw string) []string {
    parts := strings.Split(raw, ",")
    result := make([]string, 0, len(parts))
    for _, p := range parts {
        trimmed := strings.TrimSpace(p)
        if trimmed != "" {
            result = append(result, trimmed)
        }
    }
    return result
}
```

4. Add `"strings"` to the import block.

5. In `Load()`, add CORS parsing before the `cfg := &Config{...}` block:

```go
corsAllowedOrigins := parseCORSAllowedOrigins(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"))
```

6. In `cfg := &Config{...}`, add:

```go
CORS: CORS{
    AllowedOrigins: corsAllowedOrigins,
},
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test ./pkg/config/... -run TestLoadConfig_CORS -v
```

Expected: all 4 CORS tests pass.

**Step 5: Run all config tests**

```bash
cd src/go-backend && go test ./pkg/config/... -v
```

Expected: all tests pass (including existing `TestLoadConfig_SupabaseStorage`).

**Step 6: Build to verify no compile errors**

```bash
cd src/go-backend && go build ./...
```

**Step 7: Commit**

```
feat(config): add CORS.AllowedOrigins parsed from CORS_ALLOWED_ORIGINS env var

Adds CORS sub-struct to Config with AllowedOrigins []string.
Parses comma-separated CORS_ALLOWED_ORIGINS env var, trims whitespace,
drops empty entries. Defaults to http://localhost:3000 if not set.
```

---

### Task 2: Replace wildcard with `cfg.CORS.AllowedOrigins` in `setupGinEngine`

**Files:**

- Modify: `src/go-backend/internal/app/app.go` (replace `AllowOrigins: []string{"*"}` with `cfg.CORS.AllowedOrigins` + add startup log + wildcard warning)

**Security notes:** Closing T-2 (unauthorized origin making credentialed request). Add a startup `log.Printf` to log the active allowlist so operators can audit on deploy. Add a `log.Printf` warning if `*` is in the list (T-3 mitigation, per spec).

**Step 1: Write the failing test**

There is no existing unit test for `setupGinEngine`. Add a smoke test in `src/go-backend/internal/app/app_cors_test.go`:

```go
package app

import (
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/gin-contrib/cors"
    "github.com/gin-gonic/gin"
)

// TestSetupGinEngine_CORSOriginAllowed verifies that a request from
// an allowed origin receives CORS headers.
func TestSetupGinEngine_CORSOriginAllowed(t *testing.T) {
    gin.SetMode(gin.TestMode)

    r := gin.New()
    r.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"https://app.example.com"},
        AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
        AllowCredentials: true,
    }))
    r.GET("/health", func(c *gin.Context) { c.Status(http.StatusOK) })

    w := httptest.NewRecorder()
    req, _ := http.NewRequest("OPTIONS", "/health", nil)
    req.Header.Set("Origin", "https://app.example.com")
    req.Header.Set("Access-Control-Request-Method", "GET")
    r.ServeHTTP(w, req)

    if w.Header().Get("Access-Control-Allow-Origin") != "https://app.example.com" {
        t.Errorf("Expected CORS header for allowed origin, got: %q", w.Header().Get("Access-Control-Allow-Origin"))
    }
}

// TestSetupGinEngine_CORSOriginBlocked verifies that a request from
// an unlisted origin does NOT receive CORS headers.
func TestSetupGinEngine_CORSOriginBlocked(t *testing.T) {
    gin.SetMode(gin.TestMode)

    r := gin.New()
    r.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"https://app.example.com"},
        AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
        AllowCredentials: true,
    }))
    r.GET("/health", func(c *gin.Context) { c.Status(http.StatusOK) })

    w := httptest.NewRecorder()
    req, _ := http.NewRequest("OPTIONS", "/health", nil)
    req.Header.Set("Origin", "https://evil.example.com")
    req.Header.Set("Access-Control-Request-Method", "GET")
    r.ServeHTTP(w, req)

    if w.Header().Get("Access-Control-Allow-Origin") != "" {
        t.Errorf("Expected no CORS header for unlisted origin, got: %q", w.Header().Get("Access-Control-Allow-Origin"))
    }
}
```

**Step 2: Run test to verify it passes (these tests are already correct behavior against gin-contrib/cors)**

```bash
cd src/go-backend && go test ./internal/app/... -run TestSetupGinEngine_CORS -v
```

These tests verify the CORS behavior directly on `gin-contrib/cors` config, not on the full `setupGinEngine`. They document the expected behavior and will serve as regression tests.

**Step 3: Write the implementation**

In `src/go-backend/internal/app/app.go`, in `setupGinEngine`:

Replace:
```go
app.Use(cors.New(cors.Config{
    AllowOrigins:     []string{"*"},
    AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
    AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
    ExposeHeaders:    []string{"Content-Length", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"},
    AllowCredentials: true,
    MaxAge:           12 * time.Hour,
}))
```

With:
```go
// Log CORS allowlist at startup for operator audit
log.Printf("CORS AllowedOrigins: %v", cfg.CORS.AllowedOrigins)
for _, origin := range cfg.CORS.AllowedOrigins {
    if origin == "*" {
        log.Printf("WARNING: CORS_ALLOWED_ORIGINS contains '*' — this is insecure with AllowCredentials: true and will be rejected by browsers")
    }
}
app.Use(cors.New(cors.Config{
    AllowOrigins:     cfg.CORS.AllowedOrigins,
    AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
    AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
    ExposeHeaders:    []string{"Content-Length", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"},
    AllowCredentials: true,
    MaxAge:           12 * time.Hour,
}))
```

**Step 4: Run build to verify it compiles**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Run lint**

```bash
cd src/go-backend && task ci:backend-lint
```

**Step 6: Run all backend tests**

```bash
cd src/go-backend && go test -short ./...
```

**Step 7: Commit**

```
fix(cors): replace wildcard AllowOrigins with cfg.CORS.AllowedOrigins

Reads the allowed origins from Config.CORS.AllowedOrigins (populated
from CORS_ALLOWED_ORIGINS env var). Logs the allowlist at startup and
warns if '*' is present. AllowCredentials: true is preserved unchanged.
Fixes the CORS spec violation where '*' + credentials is browser-rejected.
```

---

## Task Execution Order

1. **Task 1** — Config struct + parsing + tests (no deps)
2. **Task 2** — `setupGinEngine` update (depends on Task 1: needs `cfg.CORS.AllowedOrigins`)

Both tasks touch different files; no conflict risk.

## Acceptance Criteria Checklist

From spec:

- [ ] `CORS_ALLOWED_ORIGINS=https://a.com,https://b.com` → two origins (Task 1 test)
- [ ] Whitespace trimmed (Task 1 test)
- [ ] Trailing comma dropped (Task 1 test)
- [ ] Default `http://localhost:3000` when env var not set (Task 1 test)
- [ ] Allowed origin → receives CORS headers (Task 2 test)
- [ ] Unlisted origin → no CORS headers (Task 2 test)
- [ ] `AllowCredentials: true` preserved (Task 2 implementation)
- [ ] All other CORS settings unchanged (Task 2 implementation)
- [ ] `Config.CORS.AllowedOrigins` is `[]string` (Task 1)
- [ ] `config.go` parses env var and populates struct in `Load()` (Task 1)
- [ ] `Validate()` does NOT enforce non-empty (Task 1 — no validation added)
