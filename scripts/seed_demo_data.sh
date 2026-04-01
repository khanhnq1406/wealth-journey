#!/usr/bin/env bash
# Run create_demo_data.sql against the local development database.
# Usage: ./scripts/seed_demo_data.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-wealthjourney}"
DB_PASSWORD="${DB_PASSWORD:-password}"
DB_NAME="${DB_NAME:-wealthjourney}"

echo "==> Seeding demo data into ${DB_NAME} on ${DB_HOST}:${DB_PORT} ..."

PGPASSWORD="$DB_PASSWORD" psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --file="$SCRIPT_DIR/create_demo_data.sql"

echo "==> Done. Login with username: congdongvang.com  password: Congdongvang.1"
