# CI Workflow Optimization — Implementation Report

## Summary

Implemented all 8 functional requirements from the CI workflow optimization spec. Both `.github/workflows/frontend.yml` and `.github/workflows/backend.yml` have been restructured to reduce CI runtime by an estimated 50–70% through concurrency groups, job merging, dependency caching, and conditional E2E execution.

## Spec Reference

`docs/specs/2026-03-18-ci-workflow-optimization-spec.md`

## Plan Reference

`docs/plans/2026-03-18-ci-workflow-optimization-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed |
|---|------|--------|---------------|
| 1 | Add concurrency groups (FR-7) | Done | frontend.yml, backend.yml |
| 2 | Frontend — merge lint-and-test + build (FR-4) | Done | frontend.yml |
| 3 | Backend — merge lint + build (FR-8) | Done | backend.yml |
| 4 | Frontend — cache node_modules (FR-1) | Done | frontend.yml |
| 5 | Frontend — cache Next.js build output (FR-2) | Done | frontend.yml |
| 6 | Frontend — cache Playwright browsers (FR-3) | Done | frontend.yml |
| 7 | Frontend — conditional E2E execution (FR-5) | Done | frontend.yml |
| 8 | Backend — optimize Go build cache (FR-6) | Done | backend.yml |
| 9 | Verify collect-errors.yml compatibility | Done | No changes needed |
| 10 | Validate YAML syntax + write report | Done | This file |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Supply chain (dorny/paths-filter) | Pinned to commit SHA `d1c1ffe…` (v3.0.3) | Yes |
| Cache poisoning | Cache scoped to repo+branch; forks cannot poison main cache | Yes (GitHub Actions guarantee) |
| Cache key integrity | All keys derived from file content hashes (lockfiles, source files) — no user input | Yes |
| Concurrency on main | `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}` — main never cancelled | Yes |
| No new secrets | No new env vars or secrets introduced | Yes |

## Final Workflow Structure

### frontend.yml

| Job | Depends On | Runs When |
|-----|-----------|-----------|
| `changes` | — | Always (path-triggered) |
| `lint-test-build` | — | Always (path-triggered) |
| `e2e` | `changes` | Push to main only |

**Steps in `lint-test-build`:**
1. checkout
2. setup-node@v4 (no built-in cache)
3. Cache node_modules (actions/cache@v4, key: `node-modules-<lockfile-hash>`)
4. Install dependencies (conditional: skip if cache hit)
5. Run linter (id: lint)
6. Type check (id: typecheck)
7. Run unit tests (id: jest)
8. Cache Next.js build (actions/cache@v4, restore-keys fallback)
9. Build Next.js (id: nextjs-build)
10. Capture errors (if: failure(), checks step outcomes)
11. Write errors to job summary (if: failure())
12. Upload error artifact `frontend-lint-test-build-errors` (if: failure())

**Steps in `e2e`:**
1. checkout
2. setup-node@v4
3. Cache node_modules (same key — shared with lint-test-build)
4. Install dependencies (conditional: skip if cache hit)
5. Cache Playwright browsers (key: `playwright-<lockfile-hash>`)
6. Install Playwright Chromium (conditional: full install if cache miss)
7. Install Playwright system dependencies (conditional: install-deps only if cache hit)
8. Run E2E tests
9. Upload Playwright report (if: !cancelled())

### backend.yml

| Job | Depends On | Runs When |
|-----|-----------|-----------|
| `lint-and-build` | — | Always (path-triggered) |
| `test` | — | Always (path-triggered, services: postgres + redis) |

**Steps in `lint-and-build`:**
1. checkout
2. setup-go@v5 (caches ~/go/pkg/mod)
3. Cache Go build (`~/.cache/go-build`, key: go.sum + *.go hashes)
4. Run golangci-lint (id: golangci)
5. Verify compilation (id: go-build)
6. Capture errors (if: failure())
7. Write errors to job summary (if: failure())
8. Upload error artifact `backend-lint-build-errors` (if: failure())

**Steps in `test`:**
1. checkout
2. setup-go@v5
3. Cache Go build (same key as lint-and-build)
4. Run tests (`go test -v -count=1 -timeout=10m ./...`)
5. Capture test errors (if: failure())
6. Write test errors to job summary (if: failure())
7. Upload error artifact `backend-test-errors` (if: failure())

## Artifact Name Compatibility (collect-errors.yml)

`collect-errors.yml` line 68 filters artifacts with `.name.endsWith('-errors')`.

| Old Artifact Name | New Artifact Name | Compatible |
|-------------------|-------------------|------------|
| `frontend-lint-test-errors` | `frontend-lint-test-build-errors` | ✅ |
| `frontend-build-errors` | _(merged into above)_ | N/A |
| `backend-lint-errors` | `backend-lint-build-errors` | ✅ |
| `backend-build-errors` | _(merged into above)_ | N/A |
| `backend-test-errors` | `backend-test-errors` | ✅ unchanged |

No changes to `collect-errors.yml` required.

## YAML Validation

Both files validated with `python3 + pyyaml`:

```
.github/workflows/frontend.yml: OK
.github/workflows/backend.yml: OK
```

## Estimated Savings (from spec)

| Optimization | Estimated Savings |
|-------------|-------------------|
| node_modules cache (skip 2 of 3 npm ci) | 60–120s |
| Merge frontend jobs (1 fewer VM cold start) | 30–60s |
| Merge backend jobs (1 fewer VM cold start) | 20–40s |
| Playwright cache | 30–60s |
| Next.js build cache | 10–30s |
| Go build cache | 10–20s |
| Conditional E2E (when skipped) | 120–180s |
| Concurrency (cancel stale PR runs) | Variable |

**Total estimated: 50–70% reduction in CI runtime.**

## How to Test

1. Push a branch with any `src/wj-client/**` changes — verify `e2e` job is **skipped**
2. Push to main — verify both `lint-test-build` and `e2e` run
3. Push a second run for the same branch — verify the first run is **cancelled** (concurrency)
4. Introduce a lint error — verify `frontend-lint-test-build-errors` artifact appears with correct content
5. Check second run on same lockfile — verify `npm ci` step is **skipped** (cache hit)

## Commits

`8bec7a5` — ci: optimize workflows — concurrency, job merging, caching, conditional E2E

## Fix History

| Date | Fix | Severity | Commit |
|------|-----|----------|--------|
| 2026-03-18 | Restrict E2E to push on main only (`github.event_name == 'push' && github.ref == 'refs/heads/main'`) | Minor | `f72b8d7` |
