# WealthJourney - Personal Financial Management

## Priority Rule #1

**Re-check the root cause first if the command run error. DON'T retry immediately. If retry error more than 5 times, ask first before continue retry.**

## Tech Stack

- **Frontend**: Next.js 16.2 (App Router + i18n via next-intl), React 19, TypeScript 5, Tailwind CSS 3.4, Redux Toolkit, React Query v5
- **Backend**: Go 1.25, Gin (HTTP), gRPC, GORM (PostgreSQL ORM)
- **Database**: PostgreSQL 16 (Supabase), Redis 7 (caching/sessions)
- **API Layer**: Protocol Buffers (single source of truth), REST + gRPC dual protocol support

## Project Structure

```
Personal_Financial_Management/
├── api/protobuf/v1/       # Proto definitions (single source of truth)
├── src/
│   ├── go-backend/        # Go backend (Railway)
│   └── wj-client/         # Next.js frontend (Vercel)
├── docs/architecture/     # C4 diagrams & ADRs
└── Taskfile.yml
```

See `src/go-backend/.claude/CLAUDE.md`, `src/wj-client/.claude/CLAUDE.md`, `docs/CLAUDE.md` for detailed guides.

## Critical Patterns (Non-Obvious)

### Backend Response Format
- Use helpers from `pkg/handler/response.go` — NOT raw `gin.H{}`
  - `handler.Success(c, result)` → HTTP 200, raw body (no envelope)
  - `handler.Created(c, result)` → HTTP 201
  - `handler.HandleError(c, err)` / `handler.BadRequest(c, err)` / `handler.Unauthorized(c, msg)`
- Success: data serialized directly (no wrapper) via `protojson.Marshal` or `json.Marshal`
- Errors: `{success: false, error: {code, message, details}, timestamp}`
- Proto fields use `json_name` camelCase annotations (`protojson.MarshalOptions{UseProtoNames: false}`)

### Proto Hook Response Access
- Generated hooks return raw JSON mapped to proto TS interface — **no `data` envelope**
- Access fields directly: `data?.wallets` — NOT `data?.data?.wallets`

### golangci-lint Depguard
- Domain/service layer must NOT import `gorm.io/gorm`, `go-redis`, or `gin-gonic/gin`
- Only repository layer touches GORM; only handlers touch Gin
- Violations fail `task ci:backend-lint`

### i18n Routing (next-intl)
- All pages under `app/[locale]/` — never create pages directly under `app/dashboard/`
- Server components: `getTranslations()` from `next-intl/server`
- Client components: `useTranslations()` hook

## Protobuf-First Workflow

All API changes start in `api/protobuf/v1/`. After editing `.proto` files:

```bash
task proto:all   # Generates Go types + TS types + React Query hooks
```

**Key proto files:**
- `investment.proto` — investments, price alerts, asset display config, market prices RPCs
- `transaction.proto` — transactions AND categories (no separate category.proto)
- `common.proto` — Money, Pagination shared types

## Task Commands

```bash
# Dev
task dev                  # Docker + backend + frontend
task backend:dev          # Backend only
task frontend:dev         # Frontend only
task docker:up / docker:down

# Proto
task proto:all            # Generate all
task proto:build / proto:types / proto:api

# CI
task ci:backend           # lint + build + test
task ci:backend-lint      # lint + build (no DB needed)
task ci:frontend
task ci:frontend-e2e      # Playwright

# Build
task build:all / backend:build / frontend:build

# Deploy
task deploy:backend
task deploy:backend:preview

# Migrations
task backend:migrate-categories
task backend:migrate-investments
task backend:migrate-sessions
task backend:migrate-import
task backend:migrate-fx
task backend:migrate-portfolio-history
task backend:migrate-user-price-alerts
task backend:migrate-asset-prices
task backend:migrate-asset-display-config
task backend:migrate-asset-config-fetch-code
task backend:migrate-vietcombank-currency
```

## Data Conventions

- **Money**: `int64` in smallest currency unit — never float
- **Currency**: ISO 4217 codes (default `"VND"`)
- **Dates**: Unix timestamps (seconds) in API
- **Deletes**: Soft deletes with `gorm.DeletedAt`
- **Pagination**: `{ page, pageSize, orderBy, order }`
