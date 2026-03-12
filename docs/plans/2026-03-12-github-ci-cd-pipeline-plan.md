# GitHub CI/CD Pipeline Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add GitHub Actions CI/CD workflows for automated quality gates on every PR to `main`.
**Spec:** `docs/specs/2026-03-12-github-ci-cd-pipeline-spec.md`
**Architecture:** Infrastructure-only change — four new YAML files in `.github/` and a documentation file. No application code, data model, or API changes. All existing tooling (golangci-lint, Jest, Playwright, Go test) is already configured; workflows simply orchestrate them.
**Tech Stack:** GitHub Actions, Go 1.24, Node 20, PostgreSQL 16 (service container), Redis 7 (service container), golangci-lint v7, govulncheck, Playwright, Jest

## Security Implementation Notes

- **No production secrets** — CI uses only test-only environment variables (ephemeral DB, throwaway JWT secret)
- **External APIs disabled** — `YAHOO_FINANCE_ENABLED=false`, `FX_ENABLED=false` prevent flaky external calls
- **Action pinning** — All third-party actions pinned to major version tags (v4, v5, v7)
- **Service containers** — PostgreSQL and Redis run as ephemeral containers on the runner, no network exposure
- **Branch protection** — Documented for manual setup in GitHub Settings (cannot be automated via workflow files)

## C4 Architecture Diagram Updates

None. CI/CD is infrastructure configuration, not application architecture.

## Runtime Flow Diagram Updates

None. CI/CD workflows are not application runtime flows.

---

### Task 1: Create Backend CI Workflow (`backend.yml`)

**Files:**
- Create: `.github/workflows/backend.yml`

**Security notes:** No secrets needed. Test DB credentials are throwaway values for ephemeral service containers. External APIs disabled via env vars.

**Step 1: Create `.github/workflows/` directory and `backend.yml`**

```yaml
name: Backend CI

on:
  push:
    branches: [main]
    paths:
      - 'src/go-backend/**'
      - 'api/protobuf/**'
  pull_request:
    branches: [main]
    paths:
      - 'src/go-backend/**'
      - 'api/protobuf/**'

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/go-backend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.24'
          cache-dependency-path: src/go-backend/go.sum

      - name: Run golangci-lint
        uses: golangci/golangci-lint-action@v7
        with:
          version: latest
          working-directory: src/go-backend

  test:
    name: Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/go-backend

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: wealthjourney_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DB_HOST: localhost
      DB_PORT: 5432
      DB_USER: testuser
      DB_PASSWORD: testpass
      DB_NAME: wealthjourney_test
      REDIS_URL: localhost:6379
      REDIS_PASSWORD: ""
      JWT_SECRET: ci-test-secret-not-real
      JWT_EXPIRATION: 168h
      YAHOO_FINANCE_ENABLED: "false"
      FX_ENABLED: "false"
      STORAGE_PROVIDER: local
      UPLOAD_DIR: /tmp/wealthjourney-uploads

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.24'
          cache-dependency-path: src/go-backend/go.sum

      - name: Run tests
        run: go test -v -count=1 -timeout=10m ./...

  build:
    name: Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/go-backend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.24'
          cache-dependency-path: src/go-backend/go.sum

      - name: Verify compilation
        run: go build -o /dev/null ./cmd/server/main.go
```

**Step 2: Verify YAML syntax is valid**

Run `cat .github/workflows/backend.yml` and visually inspect indentation. GitHub Actions is strict about YAML format.

**Step 3: Commit**

```
feat(ci): add backend CI workflow with lint, test, and build jobs
```

---

### Task 2: Create Frontend CI Workflow (`frontend.yml`)

**Files:**
- Create: `.github/workflows/frontend.yml`

**Security notes:** No secrets needed. E2E tests auto-start a dev server on localhost. Playwright report uploaded as artifact only on failure.

**Step 1: Create `frontend.yml`**

```yaml
name: Frontend CI

on:
  push:
    branches: [main]
    paths:
      - 'src/wj-client/**'
  pull_request:
    branches: [main]
    paths:
      - 'src/wj-client/**'

jobs:
  lint-and-test:
    name: Lint & Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/wj-client
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: src/wj-client/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npx next lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Run unit tests
        run: npx jest --ci --coverage

  build:
    name: Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/wj-client
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: src/wj-client/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build Next.js
        run: npm run build

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/wj-client
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: src/wj-client/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Chromium
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npx playwright test --project=chromium

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: src/wj-client/playwright-report/
          retention-days: 7
```

**Step 2: Commit**

```
feat(ci): add frontend CI workflow with lint, type check, tests, build, and E2E
```

---

### Task 3: Create Security Workflow (`security.yml`)

**Files:**
- Create: `.github/workflows/security.yml`

**Security notes:** This workflow IS the security scanning itself. `govulncheck` detects known Go vulnerabilities. `npm audit` detects known npm CVEs. Weekly schedule catches newly disclosed CVEs.

**Step 1: Create `security.yml`**

```yaml
name: Security

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    # Weekly: Monday at 9:00 UTC
    - cron: '0 9 * * 1'

jobs:
  go-vulnerabilities:
    name: Go Vulnerability Check
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/go-backend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.24'
          cache-dependency-path: src/go-backend/go.sum

      - name: Install govulncheck
        run: go install golang.org/x/vuln/cmd/govulncheck@latest

      - name: Run govulncheck
        run: govulncheck ./...

  npm-audit:
    name: npm Audit
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/wj-client
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: src/wj-client/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run npm audit
        run: npm audit --audit-level=high
```

**Step 2: Commit**

```
feat(ci): add security workflow with govulncheck and npm audit
```

---

### Task 4: Create Dependabot Configuration (`dependabot.yml`)

**Files:**
- Create: `.github/dependabot.yml`

**Security notes:** Dependabot PRs go through the same CI pipeline. Auto-merge is NOT enabled — human review required for all dependency updates.

**Step 1: Create `dependabot.yml`**

```yaml
version: 2
updates:
  # Go modules
  - package-ecosystem: "gomod"
    directory: "/src/go-backend"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    groups:
      production:
        patterns:
          - "*"
        exclude-patterns:
          - "github.com/stretchr/testify"
      dev:
        patterns:
          - "github.com/stretchr/testify"

  # npm (frontend)
  - package-ecosystem: "npm"
    directory: "/src/wj-client"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    groups:
      production:
        dependency-type: "production"
      dev:
        dependency-type: "development"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
    open-pull-requests-limit: 3
```

**Step 2: Commit**

```
feat(ci): add Dependabot configuration for Go, npm, and GitHub Actions
```

---

### Task 5: Document Branch Protection Setup

**Files:**
- Create: `docs/guides/branch-protection-setup.md`

**Security notes:** Branch protection is the enforcement mechanism that makes CI checks mandatory. Without it, PRs can be merged with failing CI. This is a manual GitHub Settings step — cannot be automated via workflow files.

**Step 1: Create the documentation file**

```markdown
# Branch Protection Setup Guide

## Overview

After the CI workflows are merged to `main`, configure branch protection rules in GitHub
to enforce all CI checks as required status checks before merging.

## Required Status Checks

Configure these as **required** status checks for the `main` branch:

### Backend CI (`backend.yml`)
- `Lint`
- `Test`
- `Build`

### Frontend CI (`frontend.yml`)
- `Lint & Test`
- `Build`
- `E2E Tests`

### Security (`security.yml`)
- `Go Vulnerability Check`
- `npm Audit`

## How to Configure

1. Go to **Settings** > **Branches** in your GitHub repository
2. Click **Add branch protection rule** (or edit the existing `main` rule)
3. Set **Branch name pattern** to `main`
4. Enable **Require a pull request before merging**
   - Set **Required approvals** to `1`
5. Enable **Require status checks to pass before merging**
   - Enable **Require branches to be up to date before merging**
   - Search for and add each status check listed above
6. Enable **Do not allow bypassing the above settings**
7. Click **Save changes**

## Recommended Additional Settings

- **Require conversation resolution before merging** — ensures all review comments are addressed
- **Require signed commits** — optional, adds commit authenticity verification
- **Restrict who can push to matching branches** — limit to maintainers only

## Notes

- Status checks only appear in the search dropdown after the workflow has run at least once
- The first PR that adds these workflows will NOT have the checks enforced (they don't exist yet)
- After the first successful CI run on `main`, configure the branch protection rules
- Dependabot PRs are subject to the same branch protection rules
```

**Step 2: Commit**

```
docs(ci): add branch protection setup guide
```

---

### Task 6: Verify All Workflows (Local Validation)

**Files:**
- Read: All four files created in Tasks 1-5

**Security notes:** Validate that no secrets, credentials, or sensitive data appear in any workflow file.

**Step 1: Validate YAML syntax for all workflow files**

Run `yamllint` or use `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/backend.yml'))"` for each file to verify valid YAML.

Alternatively, verify with `actionlint` if installed:
```bash
actionlint .github/workflows/backend.yml
actionlint .github/workflows/frontend.yml
actionlint .github/workflows/security.yml
```

**Step 2: Security audit of all workflow files**

Manually verify:
- [ ] No hardcoded secrets (only test-only values: `ci-test-secret-not-real`, `testuser`, `testpass`)
- [ ] External APIs disabled (`YAHOO_FINANCE_ENABLED=false`, `FX_ENABLED=false`)
- [ ] No `GITHUB_TOKEN` permissions escalation
- [ ] No `pull_request_target` trigger (prevents PRs from forks running with repo secrets)
- [ ] Artifacts don't contain sensitive data (only Playwright HTML reports)
- [ ] All third-party actions pinned to major version tags

**Step 3: Verify path filters are correct**

- Backend paths: `src/go-backend/**` and `api/protobuf/**`
- Frontend paths: `src/wj-client/**`
- Security: No path filters (runs on all changes + weekly schedule)

**Step 4: Final commit if any corrections were needed**

```
fix(ci): address validation findings
```

---

## Task Summary

| # | Task | Files | Estimated Time |
|---|------|-------|---------------|
| 1 | Backend CI workflow | `.github/workflows/backend.yml` | 3 min |
| 2 | Frontend CI workflow | `.github/workflows/frontend.yml` | 3 min |
| 3 | Security workflow | `.github/workflows/security.yml` | 2 min |
| 4 | Dependabot config | `.github/dependabot.yml` | 2 min |
| 5 | Branch protection docs | `docs/guides/branch-protection-setup.md` | 2 min |
| 6 | Validation & security audit | All files above | 3 min |

**Total: 6 tasks, ~15 minutes**

**Parallelization:** Tasks 1-5 are independent (different files) and can be executed in parallel. Task 6 depends on all previous tasks.

## Post-Implementation: Manual Steps

After merging to `main`:
1. Verify all three workflows run successfully on `main`
2. Configure branch protection rules per `docs/guides/branch-protection-setup.md`
3. Verify Dependabot creates its first batch of PRs within a week
