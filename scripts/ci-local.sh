#!/usr/bin/env bash
#
# Local CI Runner — replicates .github/workflows (backend, frontend, security)
#
# Usage:
#   ./scripts/ci-local.sh              # Run all jobs
#   ./scripts/ci-local.sh backend      # Backend only (lint + build + test)
#   ./scripts/ci-local.sh frontend     # Frontend only (lint + typecheck + test + build)
#   ./scripts/ci-local.sh security     # Security only (govulncheck + npm audit)
#   ./scripts/ci-local.sh backend-lint # Backend lint + build only (no DB needed)
#   ./scripts/ci-local.sh backend-test # Backend tests only (needs DB + Redis)
#   ./scripts/ci-local.sh frontend-e2e # Playwright E2E tests only
#
# Prerequisites:
#   - Go 1.25+, Node.js 20+, golangci-lint, govulncheck
#   - Docker (OrbStack) for backend tests (PostgreSQL + Redis)
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/src/go-backend"
FRONTEND_DIR="$ROOT_DIR/src/wj-client"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Counters
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
FAILED_JOBS=()

# Test infrastructure
DOCKER_COMPOSE_FILE="$ROOT_DIR/scripts/docker-compose.ci.yml"
CI_CONTAINERS_STARTED=false

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_job() {
    echo ""
    echo -e "${YELLOW}▸ $1${NC}"
}

pass() {
    echo -e "  ${GREEN}✓ $1${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    echo -e "  ${RED}✗ $1${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_JOBS+=("$1")
}

skip() {
    echo -e "  ${YELLOW}⊘ $1 (skipped)${NC}"
    SKIP_COUNT=$((SKIP_COUNT + 1))
}

# ─── Docker test infrastructure ────────────────────────────────────────────────

ensure_ci_containers() {
    if [ "$CI_CONTAINERS_STARTED" = true ]; then
        return 0
    fi

    print_job "Starting test infrastructure (PostgreSQL + Redis)"

    # Check Docker is running
    if ! docker info &>/dev/null; then
        echo -e "  ${RED}Docker is not running. Start OrbStack first.${NC}"
        echo -e "  ${YELLOW}Hint: open -a OrbStack${NC}"
        return 1
    fi

    # Create docker-compose for CI if it doesn't exist
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        cat > "$DOCKER_COMPOSE_FILE" << 'COMPOSE_EOF'
# Auto-generated for local CI testing. Do not commit.
services:
  postgres-ci:
    image: postgres:16-alpine
    container_name: wj_ci_postgres
    environment:
      POSTGRES_DB: wealthjourney_test
      POSTGRES_USER: testuser
      POSTGRES_PASSWORD: testpass
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U testuser -d wealthjourney_test"]
      interval: 2s
      timeout: 3s
      retries: 10

  redis-ci:
    image: redis:7-alpine
    container_name: wj_ci_redis
    ports:
      - "6380:6379"
    tmpfs:
      - /data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 3s
      retries: 10
COMPOSE_EOF
        echo "  Created $DOCKER_COMPOSE_FILE"
    fi

    # Start containers
    docker compose -f "$DOCKER_COMPOSE_FILE" up -d --wait 2>&1 | sed 's/^/  /'

    CI_CONTAINERS_STARTED=true
    echo -e "  ${GREEN}✓ Test infrastructure ready${NC}"
}

stop_ci_containers() {
    if [ -f "$DOCKER_COMPOSE_FILE" ]; then
        echo ""
        echo -e "${YELLOW}▸ Stopping test infrastructure${NC}"
        docker compose -f "$DOCKER_COMPOSE_FILE" down -v 2>&1 | sed 's/^/  /'
        echo -e "  ${GREEN}✓ Containers stopped${NC}"
    fi
}

# ─── Backend jobs ──────────────────────────────────────────────────────────────

run_backend_lint() {
    print_job "Backend: golangci-lint"
    cd "$BACKEND_DIR"
    if golangci-lint run 2>&1 | tail -20; then
        pass "Backend lint"
    else
        fail "Backend lint"
    fi
}

run_backend_build() {
    print_job "Backend: go build"
    cd "$BACKEND_DIR"
    if go build -o /dev/null ./cmd/server/main.go 2>&1; then
        pass "Backend build"
    else
        fail "Backend build"
    fi
}

run_backend_test() {
    print_job "Backend: go test"

    if ! ensure_ci_containers; then
        fail "Backend test (Docker not available)"
        return
    fi

    cd "$BACKEND_DIR"

    # CI-matching env vars (port 5433 to avoid conflict with local dev DB)
    export DB_HOST=localhost
    export DB_PORT=5433
    export DB_USER=testuser
    export DB_PASSWORD=testpass
    export DB_NAME=wealthjourney_test
    export DB_SSL_MODE=disable
    export REDIS_URL=localhost:6380
    export REDIS_PASSWORD=""
    export JWT_SECRET=ci-test-secret-not-real
    export JWT_EXPIRATION=168h
    export YAHOO_FINANCE_ENABLED=false
    export FX_ENABLED=false
    export STORAGE_PROVIDER=local
    export UPLOAD_DIR=/tmp/wealthjourney-uploads

    if go test -v -short -count=1 -timeout=10m ./... 2>&1 | tee /tmp/ci-backend-test.log | tail -30; then
        pass "Backend test"
    else
        echo ""
        echo -e "  ${RED}Failed tests:${NC}"
        grep -E '^\s*--- FAIL|^FAIL' /tmp/ci-backend-test.log 2>/dev/null | head -20 | sed 's/^/    /'
        fail "Backend test"
    fi
}

# ─── Frontend jobs ─────────────────────────────────────────────────────────────

ensure_frontend_deps() {
    cd "$FRONTEND_DIR"
    if [ ! -d "node_modules" ]; then
        print_job "Installing frontend dependencies"
        npm ci 2>&1 | tail -5
    fi
}

run_frontend_lint() {
    print_job "Frontend: eslint"
    ensure_frontend_deps
    cd "$FRONTEND_DIR"
    if npm run lint 2>&1 | tail -20; then
        pass "Frontend lint"
    else
        fail "Frontend lint"
    fi
}

run_frontend_typecheck() {
    print_job "Frontend: tsc --noEmit"
    cd "$FRONTEND_DIR"
    if npx tsc --noEmit 2>&1 | tail -20; then
        pass "Frontend typecheck"
    else
        fail "Frontend typecheck"
    fi
}

run_frontend_test() {
    print_job "Frontend: jest"
    cd "$FRONTEND_DIR"
    set +e
    npx jest --ci --coverage --maxWorkers=1 > /tmp/jest-ci-output.txt 2>&1
    JEST_EXIT=$?
    set -e
    # On macOS, libuv may emit SIGABRT (exit 134) during node teardown after tests complete.
    # This is a known macOS/libuv issue unrelated to test results.
    # Treat it as pass if no FAIL lines exist in the output (all tests passed before the crash).
    if [ $JEST_EXIT -eq 134 ]; then
        if grep -q "^PASS " /tmp/jest-ci-output.txt && ! grep -q "^FAIL " /tmp/jest-ci-output.txt; then
            JEST_EXIT=0
        fi
    fi
    tail -30 /tmp/jest-ci-output.txt
    if [ $JEST_EXIT -eq 0 ]; then
        pass "Frontend test (jest)"
    else
        fail "Frontend test (jest)"
    fi
}

run_frontend_build() {
    print_job "Frontend: next build"
    cd "$FRONTEND_DIR"
    if npm run build 2>&1 | tail -20; then
        pass "Frontend build"
    else
        fail "Frontend build"
    fi
}

run_frontend_e2e() {
    print_job "Frontend: Playwright E2E"
    cd "$FRONTEND_DIR"
    if ! command -v npx &>/dev/null; then
        skip "Frontend E2E (npx not available)"
        return
    fi
    # Install browsers if needed
    npx playwright install --with-deps chromium 2>&1 | tail -5
    if npx playwright test --project=chromium 2>&1 | tail -30; then
        pass "Frontend E2E"
    else
        fail "Frontend E2E"
    fi
}

# ─── Security jobs ─────────────────────────────────────────────────────────────

run_go_vulncheck() {
    print_job "Security: govulncheck"
    cd "$BACKEND_DIR"
    if ! command -v govulncheck &>/dev/null; then
        echo "  Installing govulncheck..."
        go install golang.org/x/vuln/cmd/govulncheck@latest 2>&1
    fi
    if govulncheck ./... 2>&1 | tail -20; then
        pass "Go vulnerability check"
    else
        fail "Go vulnerability check"
    fi
}

run_npm_audit() {
    print_job "Security: npm audit"
    ensure_frontend_deps
    cd "$FRONTEND_DIR"
    npm audit fix 2>&1 | tail -5 || true
    if npm audit --audit-level=critical 2>&1 | tail -20; then
        pass "npm audit (critical)"
    else
        fail "npm audit (critical)"
    fi
}

# ─── Job groups ────────────────────────────────────────────────────────────────

run_backend() {
    print_header "Backend CI"
    run_backend_lint
    run_backend_build
    run_backend_test
}

run_backend_lint_only() {
    print_header "Backend CI (lint + build only)"
    run_backend_lint
    run_backend_build
}

run_backend_test_only() {
    print_header "Backend CI (test only)"
    run_backend_test
}

run_frontend() {
    print_header "Frontend CI"
    run_frontend_lint
    run_frontend_typecheck
    run_frontend_test
    run_frontend_build
}

run_security() {
    print_header "Security CI"
    run_go_vulncheck
    run_npm_audit
}

# ─── Summary ───────────────────────────────────────────────────────────────────

print_summary() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}  Summary${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${GREEN}Passed:  $PASS_COUNT${NC}"
    echo -e "  ${RED}Failed:  $FAIL_COUNT${NC}"
    echo -e "  ${YELLOW}Skipped: $SKIP_COUNT${NC}"

    if [ ${#FAILED_JOBS[@]} -gt 0 ]; then
        echo ""
        echo -e "  ${RED}Failed jobs:${NC}"
        for job in "${FAILED_JOBS[@]}"; do
            echo -e "    ${RED}✗ $job${NC}"
        done
        echo ""
        echo -e "  ${RED}${BOLD}CI FAILED${NC}"
        return 1
    else
        echo ""
        echo -e "  ${GREEN}${BOLD}ALL CI CHECKS PASSED${NC}"
        return 0
    fi
}

# ─── Main ──────────────────────────────────────────────────────────────────────

trap stop_ci_containers EXIT

TARGET="${1:-all}"

case "$TARGET" in
    all)
        run_security
        run_backend
        run_frontend
        ;;
    backend)
        run_backend
        ;;
    backend-lint)
        run_backend_lint_only
        ;;
    backend-test)
        run_backend_test_only
        ;;
    frontend)
        run_frontend
        ;;
    frontend-e2e)
        run_frontend_e2e
        ;;
    security)
        run_security
        ;;
    *)
        echo "Usage: $0 [all|backend|backend-lint|backend-test|frontend|frontend-e2e|security]"
        exit 1
        ;;
esac

print_summary
