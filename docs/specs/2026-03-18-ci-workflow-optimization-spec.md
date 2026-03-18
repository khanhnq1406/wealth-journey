# CI Workflow Optimization Specification

## Summary

Optimize GitHub Actions CI pipeline runtime, primarily targeting the Frontend CI workflow (currently the biggest bottleneck within a 5-10 minute total pipeline). The goal is to reduce total CI runtime by 50-70% through caching, job restructuring, and conditional execution — without affecting test correctness or reliability.

## User Stories

- As a developer, I want CI to complete faster so that I get feedback on my PRs sooner
- As a developer, I want CI to not re-download dependencies it already has so that billable minutes are reduced
- As a developer, I want E2E tests to only run when needed so that simple backend changes don't wait for Playwright

## Functional Requirements

### FR-1: Frontend — Cache `node_modules` Across Jobs

Currently all 3 frontend jobs (`lint-and-test`, `build`, `e2e`) run `npm ci` independently, each taking 30-60s to install ~500+ packages.

**Solution:** Use `actions/cache` to persist `node_modules` with a key derived from `package-lock.json` hash. All 3 jobs restore from cache instead of running `npm ci`.

**Acceptance criteria:**
- [ ] `node_modules` is cached with key `node-modules-{hashFiles('src/wj-client/package-lock.json')}`
- [ ] Cache hit skips `npm ci`; cache miss runs `npm ci` and saves cache
- [ ] All 3 frontend jobs use the same cache
- [ ] Test results are identical with or without cache (same `package-lock.json` versions)

### FR-2: Frontend — Cache Next.js Build Output

The `build` job runs a full Next.js production build with no `.next/cache` persistence. Next.js supports incremental build caching.

**Solution:** Cache `.next/cache` directory between runs.

**Acceptance criteria:**
- [ ] `.next/cache` is cached with key `nextjs-{hashFiles('src/wj-client/package-lock.json')}-{hashFiles('src/wj-client/**/*.ts', 'src/wj-client/**/*.tsx')}`
- [ ] Cache uses restore-keys for partial matches (so changing one file doesn't invalidate entire cache)
- [ ] Build output is identical with or without cache

### FR-3: Frontend — Cache Playwright Browser

The E2E job downloads Chromium + system dependencies every run (~30-60s).

**Solution:** Cache Playwright browsers with key derived from Playwright version.

**Acceptance criteria:**
- [ ] Playwright browsers cached with key `playwright-{hashFiles('src/wj-client/package-lock.json')}`
- [ ] Cache includes `~/.cache/ms-playwright` directory
- [ ] System dependencies (`--with-deps`) only installed on cache miss
- [ ] On cache hit, skip browser download entirely

### FR-4: Frontend — Merge lint-and-test + Build Into Single Job

Running separate `lint-and-test` and `build` jobs means 2 separate VM cold starts, 2 checkouts, 2 Node setups, 2 npm installs. Since they don't depend on each other, merge them.

**Solution:** Combine into a single `lint-test-build` job that runs lint, typecheck, jest, and build sequentially in one VM.

**Acceptance criteria:**
- [ ] Single job runs: lint -> typecheck -> jest -> build
- [ ] Each step still captures errors independently (separate error capture steps)
- [ ] Job fails fast on first failure (lint fails -> skip build)
- [ ] Error artifacts are still uploaded for each failing step
- [ ] E2E remains a separate job (it needs Playwright, which is heavy)

### FR-5: Frontend — Conditional E2E Execution

E2E tests are the heaviest frontend job (Playwright + Chromium). They don't need to run on every push to main if only backend files changed. The path filter already handles this, but E2E should also be skippable for documentation-only changes.

**Solution:** Add path-based conditions so E2E only runs when frontend source files change (not just any file under `src/wj-client/`).

**Acceptance criteria:**
- [ ] E2E job runs on: changes to `src/wj-client/app/**`, `src/wj-client/components/**`, `src/wj-client/features/**`, `src/wj-client/hooks/**`, `src/wj-client/contexts/**`, `src/wj-client/lib/**`, `src/wj-client/utils/**`
- [ ] E2E job skips on: changes only to docs, config files, test files, type definitions
- [ ] E2E always runs on PRs to main (safety net)
- [ ] Implementation uses `dorny/paths-filter` or a `changes` job with output

### FR-6: Backend — Optimize Go Module Cache

`setup-go` already caches the Go module download cache. But the Go build cache (`~/.cache/go-build`) is not explicitly cached.

**Solution:** Add explicit caching for Go build cache alongside module cache.

**Acceptance criteria:**
- [ ] Go build cache (`~/.cache/go-build`) is cached
- [ ] Cache key includes `go.sum` hash
- [ ] All 3 backend jobs benefit from build cache
- [ ] `go test -count=1` still forces test re-execution (not affected by build cache)

### FR-7: Add Concurrency Groups

Multiple CI runs for the same branch/PR should cancel older runs when a new commit is pushed.

**Solution:** Add `concurrency` to both backend and frontend workflows.

**Acceptance criteria:**
- [ ] Pushing a new commit cancels in-progress CI for the same PR/branch
- [ ] Runs on `main` branch are NOT cancelled (only queued)
- [ ] Concurrency group key: `{workflow}-{ref}`
- [ ] `cancel-in-progress: true` for PRs, `false` for main

### FR-8: Backend — Merge Lint + Build Into Single Job

Similar to FR-4, backend `lint` and `build` are independent lightweight jobs that each cold-start a VM. Merging saves a VM spin-up.

**Solution:** Merge into `lint-and-build` job. Keep `test` separate (it needs Postgres + Redis services).

**Acceptance criteria:**
- [ ] Single `lint-and-build` job runs: lint -> build
- [ ] `test` job remains separate with its services
- [ ] Error capture still works for both lint and build failures
- [ ] Lint failure skips build step

## Non-Functional Requirements

- **Performance:** Target 50-70% reduction in total CI runtime (from ~5-10 min to ~2-5 min)
- **Correctness:** Zero impact on test results — caches only affect download/compilation speed
- **Cost:** Reduced billable minutes on GitHub Actions (fewer jobs = fewer VM-seconds)
- **Reliability:** Cache misses gracefully fall back to full install (no failures from missing cache)

## Architecture Changes (C4)

### Diagrams to Update
None. CI workflows are infrastructure, not application architecture. The C4 diagrams cover runtime components only.

### New Diagrams
None needed.

## Runtime Flow Diagrams

### Flow Diagrams to Update
None. CI is not a runtime flow of the application.

### New Flow Diagrams
None needed.

## Data Model Changes
None.

## API Changes
None.

## UI/UX Changes
None.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | GitHub Cache | node_modules, .next/cache, go-build cache | No: same GitHub-hosted runner environment | CI job | Cache is scoped to repo, branch-safe |
| 2 | npm registry | Package tarballs | Yes: Internet -> GitHub runner | npm cache | Only on cache miss, same as current behavior |
| 3 | Playwright CDN | Chromium binary | Yes: Internet -> GitHub runner | Playwright cache | Only on cache miss |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| GitHub Cache -> Runner | Cache restore | GitHub scopes cache to repository; forks cannot poison main branch cache |
| Internet -> Runner | npm/Playwright downloads | package-lock.json integrity check (npm ci), checksum verification |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Cache -> Runner | Tampering | Poisoned cache with malicious node_modules | Low | GitHub cache is repo-scoped; cache key includes lockfile hash; `npm ci` validates integrity |
| T-2 | 1 | Cache -> Runner | Tampering | Stale cache with outdated dependencies | Low | Cache key includes `package-lock.json` hash — any dependency change busts cache |
| T-3 | 2 | Internet -> Runner | Tampering | Compromised npm package | Medium | No change from current behavior — `npm ci` already runs. npm audit workflow catches known vulnerabilities |

### Authorization Rules
No changes — CI uses existing GitHub Actions permissions.

### Input Validation Rules
No user input involved — all cache keys are derived from file hashes.

### External Dependency Risks

| Dependency | Risk | Mitigation |
|-----------|------|------------|
| `actions/cache@v4` | GitHub-maintained, widely used | Pin to v4 (major version) |
| `dorny/paths-filter@v3` | Third-party action for path filtering | Pin to specific SHA for supply chain safety |

### Sensitive Data Handling
No sensitive data involved. Caches contain only build artifacts and dependencies.

### Issues & Risks Summary
1. **Cache poisoning is extremely low risk** — GitHub scopes caches to the repository and branch, and cache keys include content hashes
2. **Cache storage limits** — GitHub provides 10GB per repo. Monitor usage to avoid eviction of important caches
3. **Stale cache on lockfile change** — Handled by hash-based cache keys. Lockfile change = new cache key = full reinstall

## Edge Cases & Error Handling

1. **Cache miss:** Falls back to full install (npm ci, Playwright download, Go module download). No failure.
2. **Partial cache hit (restore-keys):** Next.js build uses restore-keys for partial matches. Older cache is better than no cache.
3. **Cache eviction:** GitHub evicts least-recently-used caches when repo hits 10GB limit. Old branch caches naturally expire.
4. **Concurrency cancellation during test:** Cancelled run is marked as "cancelled" (not "failed"). No false failure signals.
5. **Merging jobs and one step fails:** Subsequent steps in the same job are skipped (default `if: success()` behavior). Error artifacts for the failing step are still uploaded via `if: failure()`.

## Dependencies & Assumptions

- GitHub Actions cache v4 is available and functional
- Repository is under 10GB cache limit
- `setup-go@v5` and `setup-node@v4` continue to support cache options
- No custom runner configuration needed (uses `ubuntu-latest`)

## Out of Scope

- Self-hosted runners (would require infrastructure changes)
- Docker layer caching (not used in CI, only in local dev)
- Splitting test suites (e.g., running Go tests in parallel shards) — could be a future optimization
- Migration to different CI providers (e.g., BuildJet, Namespace)
- Turborepo or Nx-style build orchestration
- Caching for security workflow (runs weekly, low priority)
