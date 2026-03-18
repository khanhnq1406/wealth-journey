# CI Workflow Optimization Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Reduce CI pipeline runtime by 50-70% through caching, job merging, conditional execution, and concurrency groups.
**Spec:** `docs/specs/2026-03-18-ci-workflow-optimization-spec.md`
**Architecture:** Infrastructure-only changes to `.github/workflows/backend.yml` and `.github/workflows/frontend.yml`. No application code changes. Artifact naming changes require updating `collect-errors.yml` to match.
**Tech Stack:** GitHub Actions, `actions/cache@v4`, `dorny/paths-filter@v3`

## Security Implementation Notes

- **No application security changes** — CI workflows only
- **Supply chain:** Pin `dorny/paths-filter` to a specific SHA (not just major version tag) to prevent supply chain attacks via tag mutation
- **Cache isolation:** GitHub Actions cache is scoped per repository + branch; forks cannot poison main branch cache
- **Secrets:** No new secrets introduced; existing env vars unchanged
- **Cache keys:** Derived exclusively from file content hashes (lockfiles, source files) — no user input

## C4 Architecture Diagram Updates

None — CI is infrastructure, not application architecture.

## Runtime Flow Diagram Updates

None — CI is not a runtime flow.

---

### Task 1: Add Concurrency Groups to Both Workflows (FR-7)

**Files:**
- Modify: `.github/workflows/frontend.yml` (lines 1-11)
- Modify: `.github/workflows/backend.yml` (lines 1-13)

**Security notes:** Concurrency cancellation only affects in-progress runs for the same branch/PR. Main branch runs are never cancelled (`cancel-in-progress: false` for main).

**Step 1: Add concurrency block to `frontend.yml`**

Add after the `on:` block (before `jobs:`):

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

**Step 2: Add concurrency block to `backend.yml`**

Same block, same position.

**Step 3: Verify YAML syntax**

```bash
cd .github/workflows && python3 -c "import yaml; yaml.safe_load(open('frontend.yml')); yaml.safe_load(open('backend.yml')); print('OK')"
```

**Step 4: Commit**

```
ci: add concurrency groups to cancel stale PR runs (FR-7)
```

---

### Task 2: Frontend — Merge lint-and-test + build Into Single Job (FR-4)

**Files:**
- Modify: `.github/workflows/frontend.yml` (replace `lint-and-test` and `build` jobs with single `lint-test-build` job)

**Security notes:** No security impact — same steps, fewer VMs.

**Step 1: Replace jobs `lint-and-test` and `build` with a single `lint-test-build` job**

The merged job runs lint → typecheck → jest → build sequentially. Each step uses `if: success()` (default) so failure in any step skips the rest. Error capture covers all possible failures.

New job structure:

```yaml
  lint-test-build:
    name: Lint, Test & Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/wj-client
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: src/wj-client/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        id: lint
        run: |
          mkdir -p /tmp/ci-errors
          npm run lint 2>&1 | tee /tmp/ci-errors/lint-output.txt
          exit ${PIPESTATUS[0]}

      - name: Type check
        id: typecheck
        run: |
          npx tsc --noEmit 2>&1 | tee /tmp/ci-errors/typecheck-output.txt
          exit ${PIPESTATUS[0]}

      - name: Run unit tests
        id: jest
        run: |
          npx jest --ci --coverage 2>&1 | tee /tmp/ci-errors/jest-output.txt
          exit ${PIPESTATUS[0]}

      - name: Build Next.js
        id: nextjs-build
        run: |
          npm run build 2>&1 | tee /tmp/ci-errors/build-output.txt
          exit ${PIPESTATUS[0]}

      - name: Capture errors
        if: failure()
        run: |
          {
            echo "## Frontend Lint, Test & Build Errors"
            echo "Job: ${{ github.job }} | Run: ${{ github.run_id }}"
            echo ""
            if [ -s /tmp/ci-errors/lint-output.txt ] && [ "${{ steps.lint.outcome }}" == "failure" ]; then
              echo "### ESLint errors:"
              cat /tmp/ci-errors/lint-output.txt
              echo ""
            fi
            if [ -s /tmp/ci-errors/typecheck-output.txt ] && [ "${{ steps.typecheck.outcome }}" == "failure" ]; then
              echo "### TypeScript errors:"
              cat /tmp/ci-errors/typecheck-output.txt
              echo ""
            fi
            if [ -s /tmp/ci-errors/jest-output.txt ] && [ "${{ steps.jest.outcome }}" == "failure" ]; then
              echo "### Jest test failures:"
              grep -E "^(FAIL|●|✕|×)" /tmp/ci-errors/jest-output.txt || cat /tmp/ci-errors/jest-output.txt
              echo ""
            fi
            if [ -s /tmp/ci-errors/build-output.txt ] && [ "${{ steps.nextjs-build.outcome }}" == "failure" ]; then
              echo "### Build errors:"
              grep -E "^(Error|Failed|error TS)" /tmp/ci-errors/build-output.txt | head -50 || cat /tmp/ci-errors/build-output.txt | tail -50
            fi
          } > /tmp/ci-errors/errors.txt

      - name: Write errors to job summary
        if: failure()
        run: |
          echo "## ❌ Frontend Lint, Test & Build Failed" >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY
          cat /tmp/ci-errors/errors.txt >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY

      - name: Upload error artifact
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: frontend-lint-test-build-errors
          path: /tmp/ci-errors/errors.txt
          retention-days: 7
```

**Step 2: Verify YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/frontend.yml')); print('OK')"
```

**Step 3: Commit**

```
ci(frontend): merge lint-and-test + build into single job (FR-4)
```

---

### Task 3: Backend — Merge Lint + Build Into Single Job (FR-8)

**Files:**
- Modify: `.github/workflows/backend.yml` (replace `lint` and `build` jobs with single `lint-and-build` job)

**Security notes:** No security impact — same steps, fewer VMs.

**Step 1: Replace jobs `lint` and `build` with a single `lint-and-build` job**

New job structure:

```yaml
  lint-and-build:
    name: Lint & Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/go-backend
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-go@v5
        with:
          go-version: '1.25'
          cache-dependency-path: src/go-backend/go.sum

      - name: Run golangci-lint
        id: golangci
        uses: golangci/golangci-lint-action@v7
        with:
          version: latest
          working-directory: src/go-backend

      - name: Verify compilation
        id: go-build
        run: |
          mkdir -p /tmp/ci-errors
          go build -o /dev/null ./cmd/server/main.go 2>&1 | tee /tmp/ci-errors/build-output.txt
          exit ${PIPESTATUS[0]}

      - name: Capture errors
        if: failure()
        run: |
          mkdir -p /tmp/ci-errors
          {
            echo "## Backend Lint & Build Errors"
            echo "Job: ${{ github.job }} | Run: ${{ github.run_id }}"
            echo ""
            if [ "${{ steps.golangci.outcome }}" == "failure" ]; then
              echo "### Lint errors:"
              echo "golangci-lint failed. Check the 'Run golangci-lint' step logs above for details."
              echo ""
            fi
            if [ -s /tmp/ci-errors/build-output.txt ] && [ "${{ steps.go-build.outcome }}" == "failure" ]; then
              echo "### Build errors:"
              cat /tmp/ci-errors/build-output.txt
            fi
          } > /tmp/ci-errors/errors.txt

      - name: Write errors to job summary
        if: failure()
        run: |
          echo "## ❌ Backend Lint & Build Failed" >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY
          cat /tmp/ci-errors/errors.txt >> $GITHUB_STEP_SUMMARY
          echo '```' >> $GITHUB_STEP_SUMMARY

      - name: Upload error artifact
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: backend-lint-build-errors
          path: /tmp/ci-errors/errors.txt
          retention-days: 7
```

**Step 2: Verify YAML syntax**

**Step 3: Commit**

```
ci(backend): merge lint + build into single job (FR-8)
```

---

### Task 4: Frontend — Cache node_modules Across Jobs (FR-1)

**Files:**
- Modify: `.github/workflows/frontend.yml` (both `lint-test-build` and `e2e` jobs)

**Security notes:** Cache key derived from `package-lock.json` hash — dependency changes always bust the cache. `npm ci` validates integrity on cache miss.

**Step 1: Replace `setup-node` npm cache with `actions/cache` for `node_modules`**

In both `lint-test-build` and `e2e` jobs, after the checkout step:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          # Remove 'cache' and 'cache-dependency-path' — using explicit node_modules cache instead

      - name: Cache node_modules
        id: cache-node-modules
        uses: actions/cache@v4
        with:
          path: src/wj-client/node_modules
          key: node-modules-${{ hashFiles('src/wj-client/package-lock.json') }}

      - name: Install dependencies
        if: steps.cache-node-modules.outputs.cache-hit != 'true'
        run: npm ci
```

This means:
- Cache hit → skip `npm ci` entirely (saves 30-60s per job)
- Cache miss → run `npm ci` and save `node_modules` to cache
- Both `lint-test-build` and `e2e` use the same cache key

**Step 2: Verify YAML syntax**

**Step 3: Commit**

```
ci(frontend): cache node_modules across jobs (FR-1)
```

---

### Task 5: Frontend — Cache Next.js Build Output (FR-2)

**Files:**
- Modify: `.github/workflows/frontend.yml` (`lint-test-build` job, before the build step)

**Security notes:** Build cache only affects compilation speed. Build output is deterministic given same source files.

**Step 1: Add `.next/cache` caching step before the build step**

```yaml
      - name: Cache Next.js build
        uses: actions/cache@v4
        with:
          path: src/wj-client/.next/cache
          key: nextjs-${{ hashFiles('src/wj-client/package-lock.json') }}-${{ hashFiles('src/wj-client/**/*.ts', 'src/wj-client/**/*.tsx') }}
          restore-keys: |
            nextjs-${{ hashFiles('src/wj-client/package-lock.json') }}-
```

Place this step immediately before the "Build Next.js" step in the `lint-test-build` job.

**Step 2: Verify YAML syntax**

**Step 3: Commit**

```
ci(frontend): cache Next.js build output (FR-2)
```

---

### Task 6: Frontend — Cache Playwright Browser (FR-3)

**Files:**
- Modify: `.github/workflows/frontend.yml` (`e2e` job)

**Security notes:** Playwright browsers are downloaded from official Microsoft CDN. Cache key tied to `package-lock.json` hash ensures version changes bust the cache.

**Step 1: Add Playwright cache and conditional install**

Replace the existing "Install Playwright Chromium" step with:

```yaml
      - name: Cache Playwright browsers
        id: cache-playwright
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ hashFiles('src/wj-client/package-lock.json') }}

      - name: Install Playwright Chromium
        if: steps.cache-playwright.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps chromium

      - name: Install Playwright system dependencies
        if: steps.cache-playwright.outputs.cache-hit == 'true'
        run: npx playwright install-deps chromium
```

Note: On cache hit, we still need system dependencies (browser libs installed at the OS level are not cached). `install-deps` (without `--with-deps`) only installs system deps, not the browser binary.

**Step 2: Verify YAML syntax**

**Step 3: Commit**

```
ci(frontend): cache Playwright browsers (FR-3)
```

---

### Task 7: Frontend — Conditional E2E Execution (FR-5)

**Files:**
- Modify: `.github/workflows/frontend.yml` (add `changes` job, add condition to `e2e` job)

**Security notes:** Pin `dorny/paths-filter` to a specific commit SHA for supply chain safety. E2E always runs on PRs to main as a safety net.

**Step 1: Add a `changes` job to detect which files changed**

Add before the `lint-test-build` job:

```yaml
  changes:
    name: Detect Changes
    runs-on: ubuntu-latest
    outputs:
      frontend-src: ${{ steps.filter.outputs.frontend-src }}
    steps:
      - uses: actions/checkout@v6

      - uses: dorny/paths-filter@d1c1ffe0248fe513906c8e24db8ea791d46f8590  # v3.0.3
        id: filter
        with:
          filters: |
            frontend-src:
              - 'src/wj-client/app/**'
              - 'src/wj-client/components/**'
              - 'src/wj-client/features/**'
              - 'src/wj-client/hooks/**'
              - 'src/wj-client/contexts/**'
              - 'src/wj-client/lib/**'
              - 'src/wj-client/utils/**'
```

**Step 2: Add condition to `e2e` job**

```yaml
  e2e:
    name: E2E Tests
    needs: [changes]
    if: ${{ needs.changes.outputs.frontend-src == 'true' || github.event_name == 'push' }}
    runs-on: ubuntu-latest
```

This means:
- E2E runs when frontend source files change (PR filter)
- E2E always runs on push to main (safety net, via `github.event_name == 'push'`)
- E2E skips for docs-only, config-only, or test-only changes in PRs

**Step 3: Verify YAML syntax**

**Step 4: Commit**

```
ci(frontend): conditional E2E execution with path filter (FR-5)
```

---

### Task 8: Backend — Optimize Go Build Cache (FR-6)

**Files:**
- Modify: `.github/workflows/backend.yml` (both `lint-and-build` and `test` jobs)

**Security notes:** Build cache only affects compilation speed. `go test -count=1` still forces test re-execution regardless of build cache. Cache key includes `go.sum` hash.

**Step 1: Add explicit Go build cache to both jobs**

After the `setup-go` step in both `lint-and-build` and `test` jobs:

```yaml
      - name: Cache Go build
        uses: actions/cache@v4
        with:
          path: ~/.cache/go-build
          key: go-build-${{ hashFiles('src/go-backend/go.sum') }}-${{ hashFiles('src/go-backend/**/*.go') }}
          restore-keys: |
            go-build-${{ hashFiles('src/go-backend/go.sum') }}-
            go-build-
```

Note: `setup-go@v5` already caches `~/go/pkg/mod` (module download cache). This adds `~/.cache/go-build` (compilation cache) which is not cached by `setup-go`.

**Step 2: Verify YAML syntax**

**Step 3: Commit**

```
ci(backend): cache Go build output (FR-6)
```

---

### Task 9: Update Error Collector for New Artifact Names

**Files:**
- Modify: `.github/workflows/collect-errors.yml` (artifact name matching)

**Security notes:** No security impact — the collector already only processes artifacts ending with `-errors`.

**Step 1: Verify artifact name compatibility**

The collector uses `artifact.name.endsWith('-errors')` to filter. Our new artifact names:
- `frontend-lint-test-build-errors` (was `frontend-lint-test-errors` + `frontend-build-errors`)
- `backend-lint-build-errors` (was `backend-lint-errors` + `backend-build-errors`)

The `-errors` suffix matching still works. No code changes needed in the collector.

**Step 2: Verify by reading the filter logic**

Line 68: `if (!artifact.name.endsWith('-errors')) continue;`

This will match both old and new artifact names. No change needed.

**Step 3: Commit**

Skip — no changes needed. Document in the report that the collector is compatible.

---

### Task 10: Validate Complete Workflow Files

**Files:**
- Read: `.github/workflows/frontend.yml` (final state)
- Read: `.github/workflows/backend.yml` (final state)

**Step 1: Validate YAML syntax for both files**

```bash
cd /path/to/repo && python3 -c "
import yaml
for f in ['.github/workflows/frontend.yml', '.github/workflows/backend.yml']:
    yaml.safe_load(open(f))
    print(f'{f}: OK')
"
```

**Step 2: Review final job structure**

Expected final state:

**frontend.yml:**
- `concurrency` group
- `changes` job (path filter)
- `lint-test-build` job (merged, with node_modules cache + Next.js cache)
- `e2e` job (conditional, with node_modules cache + Playwright cache)

**backend.yml:**
- `concurrency` group
- `lint-and-build` job (merged, with Go build cache)
- `test` job (unchanged except Go build cache added)

**Step 3: Verify artifact names for collect-errors compatibility**

All artifact names end with `-errors`: compatible with collector.

**Step 4: Final commit (if any remaining fixes)**

```
ci: final validation and cleanup
```

---

## Expected Results

### Before (Current)

| Workflow | Jobs | Cold Starts | npm ci Runs | Time (est.) |
|----------|------|-------------|-------------|-------------|
| Frontend | 3 (lint-test, build, e2e) | 3 | 3 | 5-10 min |
| Backend | 3 (lint, build, test) | 3 | N/A | 3-5 min |

### After (Optimized)

| Workflow | Jobs | Cold Starts | npm ci Runs | Time (est.) |
|----------|------|-------------|-------------|-------------|
| Frontend | 2-3 (changes, lint-test-build, e2e?) | 2-3 | 0-1 (cache) | 2-4 min |
| Backend | 2 (lint-and-build, test) | 2 | N/A | 2-3 min |

### Savings Breakdown

| Optimization | Estimated Savings |
|-------------|-------------------|
| node_modules cache (skip 2 of 3 npm ci) | 60-120s |
| Merge frontend jobs (1 fewer VM) | 30-60s |
| Merge backend jobs (1 fewer VM) | 20-40s |
| Playwright cache | 30-60s |
| Next.js build cache | 10-30s |
| Go build cache | 10-20s |
| Conditional E2E (when skipped) | 120-180s |
| Concurrency (cancel stale) | Variable |

**Total estimated savings: 50-70% of current runtime.**
