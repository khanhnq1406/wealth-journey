# C4 Level 2: Container Diagram

Shows the major runtime units of WealthJourney and how they communicate.

```mermaid
C4Container
    title WealthJourney - Container Diagram (with Trust Boundaries)

    Person(user, "User", "Finance tracker")

    System_Boundary(wj, "WealthJourney") {

        Boundary(tb_internet, "Trust Boundary: Internet/Client", "UNTRUSTED — all input must be validated") {
            Container(spa, "Single Page Application", "Next.js 15, React 19, TypeScript", "PWA with offline support. Dashboard, transactions, portfolio, budgets, reports, bank import wizard")
        }

        Boundary(tb_app, "Trust Boundary: Application Tier", "SEMI-TRUSTED — authenticated + validated requests only") {
            Container(rest, "REST API Server", "Go 1.23, Gin", "HTTP API serving 75 endpoints. Auth, wallets, transactions, investments, budgets, imports")
            Container(grpc, "gRPC Server", "Go 1.23, gRPC", "Protocol Buffer services for internal/future client communication")
            Container(gateway, "gRPC-Gateway", "Go 1.23, grpc-gateway", "HTTP-to-gRPC reverse proxy for browser clients")
            Container(scheduler, "Background Scheduler", "Go goroutines", "Periodic jobs: price updates (15m), portfolio snapshots (1h), session cleanup (6h), file cleanup (1h), DB keepalive (2m)")
            Container(worker, "Import Worker Pool", "Go goroutines + Redis queue", "Async bank statement processing: parse, categorize, detect duplicates, execute imports")
        }

        Boundary(tb_data, "Trust Boundary: Data Tier", "TRUSTED — encrypted at rest, access via connection pool only") {
            ContainerDb(postgres, "PostgreSQL 16", "Supabase", "Users, wallets, transactions, categories, budgets, investments, lots, market data, portfolio history, import batches, sessions")
            ContainerDb(redis, "Redis 7", "Cache & Queue", "JWT whitelist, session store, price cache (gold/silver/market), currency cache, rate limiting counters, import job queue")
        }
    }

    Boundary(tb_external, "Trust Boundary: External APIs", "UNTRUSTED — responses must be validated, failures expected") {
        System_Ext(google, "Google OAuth", "Identity provider")
        System_Ext(yahoo, "Yahoo Finance", "Market data")
        System_Ext(vang247, "vang.today", "Gold/silver prices")
        System_Ext(supabase_storage, "Supabase Storage", "File storage")
        System_Ext(sjc_website, "SJC Website", "SJC official gold price API")
        System_Ext(doji_website, "DOJI Website", "DOJI official gold price website")
        System_Ext(btmc_website, "BTMC Website", "BTMC official gold price website")
        System_Ext(pnj_api, "PNJ API", "PNJ official gold price API")
    }

    Rel(user, spa, "Uses", "HTTPS/TLS")
    Rel(spa, rest, "API calls", "HTTPS/JSON")
    Rel(spa, gateway, "gRPC via HTTP", "HTTPS/JSON")

    Rel(rest, postgres, "GORM queries", "TCP/SSL")
    Rel(rest, redis, "Cache/sessions", "TCP/SSL")
    Rel(rest, worker, "Enqueues jobs", "Redis queue")

    Rel(grpc, postgres, "GORM queries", "TCP/SSL")
    Rel(grpc, redis, "Sessions", "TCP/SSL")
    Rel(gateway, grpc, "Proxies", "gRPC")

    Rel(scheduler, postgres, "Reads/writes", "TCP/SSL")
    Rel(scheduler, redis, "Price cache", "TCP/SSL")
    Rel(scheduler, yahoo, "Fetch prices", "HTTPS")
    Rel(scheduler, vang247, "Fetch gold/silver", "HTTPS")
    Rel(rest, sjc_website, "fetches gold prices from", "HTTPS")
    Rel(rest, doji_website, "fetches gold prices from", "HTTPS")
    Rel(rest, btmc_website, "fetches gold prices from", "HTTPS")
    Rel(rest, pnj_api, "fetches gold prices from", "HTTPS")

    Rel(worker, postgres, "Writes transactions", "TCP/SSL")
    Rel(worker, redis, "Dequeues jobs", "TCP/SSL")

    Rel(rest, google, "Verify tokens", "HTTPS")
    Rel(rest, supabase_storage, "Upload/download files", "HTTPS")
```

## Trust Boundaries

| Boundary | Trust Level | Security Controls | Data Crossing Rules |
|----------|-------------|-------------------|---------------------|
| **Internet/Client** | UNTRUSTED | TLS termination, CORS | All input validated server-side. Never trust client-side validation alone. |
| **Application Tier** | SEMI-TRUSTED | JWT auth, rate limiting, input validation, ownership checks | Requests must be authenticated + authorized. User ID from JWT, never from request params. |
| **Data Tier** | TRUSTED | Connection pool, SSL, Supabase RLS | Only application tier accesses data stores. No direct client-to-DB connections. |
| **External APIs** | UNTRUSTED | HTTPS, response validation, timeouts, circuit breakers | Validate all responses. Cache with TTL. Graceful degradation on failure. Never expose API keys to client. |

**Key boundary-crossing rules:**
- **Client → App**: Every request crosses from UNTRUSTED to SEMI-TRUSTED. Auth middleware validates JWT before any handler runs.
- **App → Data**: Application code is the only path to data stores. GORM parameterized queries prevent injection.
- **App → External**: External API responses are untrusted data. Validate types, ranges, and sanitize before storing.
- **External → App**: Webhook/callback endpoints (if any) require signature verification.

## Container Responsibilities

### SPA (Next.js 15)
- Server-side rendered pages with App Router
- PWA support (installable, offline-capable)
- Auto-generated React Query hooks from Protobuf
- Mobile-first responsive design (800px breakpoint)
- Feature modules: auth, wallet, transaction, investment, budget, import, prices, report

### REST API Server (Gin)
- 75 REST endpoints across 10 route groups
- JWT authentication with Redis session whitelist
- Rate limiting (general + import-specific)
- CORS configuration for SPA origin

### gRPC Server
- Protobuf-defined service contracts
- Used for internal communication and future mobile clients

### gRPC-Gateway
- Auto-generated HTTP reverse proxy to gRPC services
- Enables browser clients to call gRPC services via REST

### Background Scheduler
- **Price Update Job** (every 15min): Fetches market prices for all user investments
- **Portfolio Snapshot Job** (every 1h): Records historical portfolio values
- **Session Cleanup Job** (every 6h): Removes expired sessions
- **File Cleanup Job** (every 1h): Removes orphaned upload files
- **DB Keepalive Job** (every 2min): Prevents idle connection drops

### Import Worker Pool
- Redis-backed job queue for async import processing
- Handles CSV/Excel parsing, currency conversion, duplicate detection
- Supports job cancellation and status polling
