# GitHub CI/CD Pipeline Specification

## Summary

Add comprehensive GitHub Actions CI/CD workflows to enforce quality gates on every Pull Request before merge to `main`. The pipeline covers linting, type checking, unit tests, integration tests (with PostgreSQL + Redis service containers), E2E tests (Playwright), build verification, and security scanning (vulnerability checks + dependency audit). Deployments are already automated (Vercel for frontend, Railway for backend), so CI focuses exclusively on validation — ensuring no broken code reaches `main`.

## User Stories

- As a developer, I want automated lint + type checks on every PR, so that code style and type safety issues are caught before review.
- As a developer, I want automated tests on every PR, so that regressions are caught before merge.
- As a team lead, I want all CI checks to be blocking, so that only passing code can be merged to `main`.
- As a developer, I want security vulnerability scanning, so that known CVEs in dependencies are detected early.
- As a developer, I want Dependabot auto-updates, so that dependencies stay current with minimal manual effort.
- As a developer, I want path-filtered workflows, so that backend changes don't trigger frontend CI and vice versa.

## Functional Requirements

### FR-1: Backend CI Workflow (`backend.yml`)

Triggered on PR to `main` and push to `main`, only when `src/go-backend/**` or `api/protobuf/**` files change.

**Acceptance criteria:**
- [ ] `lint` job: runs `golangci-lint` (v7 action) with the existing `.golangci.yml` config
- [ ] `test` job: spins up PostgreSQL 16 + Redis 7 service containers, creates `wealthjourney_test` database, runs `go test -v -count=1 -timeout=10m ./...` with external APIs disabled (`YAHOO_FINANCE_ENABLED=false`, `FX_ENABLED=false`)
- [ ] `build` job: runs `go build -o /dev/null ./cmd/server/main.go` to verify compilation
- [ ] All three jobs use Go 1.24 and cache Go modules via `go.sum` hash
- [ ] Jobs run in parallel (no sequential dependencies)

### FR-2: Frontend CI Workflow (`frontend.yml`)

Triggered on PR to `main` and push to `main`, only when `src/wj-client/**` files change.

**Acceptance criteria:**
- [ ] `lint-and-test` job: runs `next lint`, `tsc --noEmit`, and `jest --ci --coverage`
- [ ] `build` job: runs `npm run build` (Next.js production build)
- [ ] `e2e` job: installs Playwright Chromium, runs `playwright test --project=chromium`, uploads `playwright-report/` as artifact on failure (7-day retention)
- [ ] All jobs use Node 20 and cache `~/.npm` via `package-lock.json` hash
- [ ] E2E uses `webServer` config from `playwright.config.ts` (auto-starts dev server)

### FR-3: Security Workflow (`security.yml`)

Triggered on PR to `main`, push to `main`, and weekly schedule (Monday 9:00 UTC).

**Acceptance criteria:**
- [ ] `go-vulnerabilities` job: installs and runs `govulncheck ./...` in `src/go-backend/`
- [ ] `npm-audit` job: runs `npm audit --audit-level=high` in `src/wj-client/`
- [ ] Weekly schedule catches new CVEs even without code changes

### FR-4: Dependabot Configuration (`dependabot.yml`)

**Acceptance criteria:**
- [ ] Go modules (`src/go-backend/`): weekly updates, max 5 open PRs, grouped by production vs dev
- [ ] npm (`src/wj-client/`): weekly updates, max 5 open PRs, grouped by production vs dev
- [ ] GitHub Actions (`/`): monthly updates, max 3 open PRs

### FR-5: Branch Protection Documentation

**Acceptance criteria:**
- [ ] Document required status checks: `lint`, `test`, `build` (backend), `lint-and-test`, `build`, `e2e` (frontend), `go-vulnerabilities`, `npm-audit` (security)
- [ ] Document recommended settings: require up-to-date branches, require 1 reviewer, no direct pushes

## Non-Functional Requirements

- **Performance:** Total CI time under 10 minutes for the slowest path (E2E). Backend jobs under 5 minutes.
- **Reliability:** External API tests disabled in CI (`YAHOO_FINANCE_ENABLED=false`) to avoid flaky failures.
- **Cost:** Path filters prevent unnecessary job runs (backend changes don't trigger frontend CI).
- **Security:** CI secrets (none needed currently — no deploy steps). Dependabot PRs auto-created.

## Architecture Changes (C4)

### Diagrams to Update

No C4 diagram changes needed. CI/CD is infrastructure configuration, not application architecture. The C4 diagrams document the application structure, not the build pipeline.

### New Diagrams

None.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — CI/CD workflows are not application runtime flows.

### New Flow Diagrams

None.

## Data Model Changes

None. This feature is purely infrastructure configuration.

## API Changes

None.

## UI/UX Changes

None.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Developer | Code push/PR | Yes: Local → GitHub | GitHub Actions | Standard Git push |
| 2 | GitHub Actions | Source code | No | CI runner (ubuntu-latest) | Code checked out on ephemeral runner |
| 3 | CI runner | Test results | No | GitHub Actions UI | Status checks displayed on PR |
| 4 | CI runner | DB connection | No | PostgreSQL service container | Localhost connection, ephemeral |
| 5 | CI runner | Cache data | Yes: Runner → GitHub Cache | GitHub Cache service | Go modules, npm packages |
| 6 | Dependabot | Dependency PRs | Yes: GitHub → Repository | Repository PRs | Auto-created PRs for updates |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Local → GitHub | Developer code push | GitHub authentication, branch protection |
| Runner → GitHub Cache | Module/package caching | Cache key isolation per branch/hash |
| GitHub → Repository | Dependabot PRs | Same CI checks apply to Dependabot PRs |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 5 | Runner → Cache | Tampering | Cache poisoning — malicious cached dependencies | Low | Cache keys based on lock file hash; ephemeral runners |
| T-2 | 6 | GitHub → Repo | Tampering | Dependabot PR with compromised dependency | Medium | All CI checks run on Dependabot PRs; review before merge |
| T-3 | 2 | GitHub → Runner | Info Disclosure | Secrets leaked in CI logs | Low | No secrets configured; env vars are test-only values |
| T-4 | 1 | Local → GitHub | Elevation | Direct push to main bypassing CI | Medium | Branch protection rules (documented, manual setup) |

### Authorization Rules

- Only repository collaborators can push branches and create PRs
- Branch protection prevents direct pushes to `main`
- All PRs require passing CI checks before merge
- Dependabot PRs go through the same CI pipeline

### Input Validation Rules

- CI workflow files validated by GitHub Actions runner
- Path filters validated by GitHub Actions `paths` syntax
- No user input processed in CI (purely automated)

### External Dependency Risks

| Dependency | Risk | Mitigation |
|-----------|------|------------|
| `golangci/golangci-lint-action@v7` | Supply chain compromise | Pin to major version; Dependabot monitors |
| `actions/checkout@v4` | Supply chain compromise | Official GitHub action; pin to major version |
| `actions/setup-go@v5` | Supply chain compromise | Official GitHub action; pin to major version |
| `actions/setup-node@v4` | Supply chain compromise | Official GitHub action; pin to major version |
| PostgreSQL 16 service container | Outdated image | Pin to `16-alpine` tag |
| Redis 7 service container | Outdated image | Pin to `7-alpine` tag |

### Sensitive Data Handling

- **No production secrets in CI** — all env vars are test-only values
- `JWT_SECRET` in CI is a test-only string, not a real secret
- Database credentials are for ephemeral service containers only
- No deployment tokens needed (Vercel/Railway auto-deploy from main)

### Issues & Risks Summary

1. **Branch protection is manual** — must be configured in GitHub Settings after first CI run
2. **Dependabot PRs need human review** — auto-merge not enabled (intentional for security)
3. **E2E tests start a dev server** — adds ~2 min to E2E job; acceptable trade-off
4. **Go test `-count=1` disables caching** — slightly slower but more reliable in CI

## Edge Cases & Error Handling

- **Flaky E2E tests:** Playwright config already has `retries: 2` when `CI=true`
- **Service container startup:** PostgreSQL readiness check via `pg_isready` loop before tests
- **npm audit false positives:** Use `--audit-level=high` to only fail on high/critical CVEs
- **Path filter edge cases:** Changes to `api/protobuf/**` trigger backend CI (proto changes affect Go code generation)

## Dependencies & Assumptions

- GitHub repository with Actions enabled (free tier sufficient)
- Go 1.24 available in `actions/setup-go@v5`
- Node 20 available in `actions/setup-node@v4`
- `golangci-lint-action@v7` supports Go 1.24
- Playwright config supports `--project=chromium` for single-browser CI runs
- PostgreSQL 16 and Redis 7 Alpine images available on Docker Hub

## Out of Scope

- Automated deployment (already handled by Vercel/Railway auto-deploy from main)
- Code coverage thresholds (can be added later)
- Pre-commit hooks (separate concern)
- Docker image building in CI (not needed — Vercel/Railway handle builds)
- Multi-browser E2E testing in CI (Chromium only for speed; full browser matrix is local-only)
- Auto-merge for Dependabot PRs (requires separate policy decision)
