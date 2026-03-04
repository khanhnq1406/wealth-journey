# C4 Level 3: Backend Components

Shows the internal structure of the Go backend — how HTTP requests flow through handlers, services, and repositories to data stores and external APIs.

```mermaid
C4Component
    title WealthJourney Backend - Component Diagram

    Container_Boundary(transport, "Transport Layer") {
        Component(gin, "Gin HTTP Server", "gin-gonic/gin", "Request routing, CORS, middleware pipeline")
        Component(auth_mw, "Auth Middleware", "JWT + Redis", "Extracts bearer token, verifies against Redis whitelist, sets user context")
        Component(rate_mw, "Rate Limiter", "Token bucket", "Per-IP (public) and per-user (protected) rate limiting")
        Component(grpc_srv, "gRPC Server", "google.golang.org/grpc", "Protocol Buffer service implementations")
        Component(grpc_gw, "gRPC-Gateway", "grpc-ecosystem/grpc-gateway", "HTTP-to-gRPC reverse proxy")
    }

    Container_Boundary(handlers, "HTTP Handlers") {
        Component(auth_h, "Auth Handlers", "Register, Login, Logout, Verify", "Google OAuth token verification, JWT issuance")
        Component(wallet_h, "Wallet Handlers", "CRUD + Transfer + Balance", "Wallet management and fund operations")
        Component(txn_h, "Transaction Handlers", "CRUD + Reports", "Transaction management and financial reports")
        Component(cat_h, "Category Handlers", "CRUD", "User-defined transaction categories")
        Component(budget_h, "Budget Handlers", "CRUD + Items", "Budget and budget item management")
        Component(invest_h, "Investment Handlers", "CRUD + Txn + Prices", "Investment holdings, transactions, market data")
        Component(import_h, "Import Handlers", "Upload + Parse + Execute", "Bank statement import wizard endpoints")
        Component(price_h, "Market Price Handlers", "Gold + Silver + Market", "Gold/silver type codes and combined market prices")
    }

    Container_Boundary(services, "Service Layer (Business Logic)") {
        Component(auth_svc, "Auth Service", "domain/auth", "Google token verification, JWT generation, session management")
        Component(user_svc, "User Service", "domain/service", "User CRUD, preferences, currency conversion orchestration")
        Component(wallet_svc, "Wallet Service", "domain/service", "Balance tracking, fund transfers, multi-currency support")
        Component(txn_svc, "Transaction Service", "domain/service", "Transaction CRUD, financial reports, category breakdowns")
        Component(cat_svc, "Category Service", "domain/service", "Category CRUD, default category seeding for new users")
        Component(budget_svc, "Budget Service", "domain/service", "Budget lifecycle, budget item tracking, spending analysis")
        Component(invest_svc, "Investment Service", "domain/service", "Holdings management, FIFO cost basis, PNL calculation")
        Component(market_svc, "Market Data Service", "domain/service", "Price caching, Yahoo Finance integration, gold/silver normalization")
        Component(fx_svc, "FX Rate Service", "domain/service", "Currency conversion rates, cross-currency calculations")
        Component(import_svc, "Import Service", "domain/service", "File parsing, field mapping, duplicate detection, batch execution")
        Component(portfolio_svc, "Portfolio History Service", "domain/service", "Historical portfolio value snapshots for charts")
    }

    Container_Boundary(repos, "Repository Layer (Data Access)") {
        Component(user_repo, "User Repository", "GORM", "User table CRUD with soft deletes")
        Component(wallet_repo, "Wallet Repository", "GORM", "Wallet table CRUD with balance locking")
        Component(txn_repo, "Transaction Repository", "GORM", "Transaction table with pagination and filtering")
        Component(cat_repo, "Category Repository", "GORM", "Category table with user scoping")
        Component(budget_repo, "Budget Repository", "GORM", "Budget + BudgetItem tables")
        Component(invest_repo, "Investment Repository", "GORM", "Investment + InvestmentLot tables")
        Component(invest_txn_repo, "Investment Transaction Repository", "GORM", "Investment transaction records")
        Component(market_repo, "Market Data Repository", "GORM", "Cached market price records")
        Component(fx_repo, "FX Rate Repository", "GORM", "Exchange rate history")
        Component(import_repo, "Import Repository", "GORM", "Import batches, templates, merchant rules")
        Component(portfolio_repo, "Portfolio History Repository", "GORM", "Historical portfolio value records")
    }

    Container_Boundary(external, "External Integrations") {
        Component(yahoo_client, "Yahoo Finance Client", "pkg/yahoo", "Market price quotes, symbol search, rate throttling")
        Component(vang_client, "vang.today Client", "pkg/gold + pkg/silver", "Vietnamese gold/silver price fetching")
        Component(google_client, "Google OAuth Verifier", "domain/auth", "ID token verification via Google APIs")
        Component(supabase_client, "Supabase Storage Client", "pkg/storage", "File upload/download for bank statements")
    }

    Container_Boundary(infra, "Infrastructure") {
        ComponentDb(postgres, "PostgreSQL 16", "Supabase", "All domain tables")
        ComponentDb(redis, "Redis 7", "Cache/Queue", "Sessions, prices, queues")
    }

    Rel(gin, auth_mw, "Applies to protected routes")
    Rel(gin, rate_mw, "Applies to all routes")
    Rel(gin, auth_h, "Routes /auth/*")
    Rel(gin, wallet_h, "Routes /wallets/*")
    Rel(gin, txn_h, "Routes /transactions/*")
    Rel(gin, cat_h, "Routes /categories/*")
    Rel(gin, budget_h, "Routes /budgets/*")
    Rel(gin, invest_h, "Routes /investments/*")
    Rel(gin, import_h, "Routes /import/*")
    Rel(gin, price_h, "Routes /investments/market-prices")

    Rel(auth_h, auth_svc, "Delegates auth logic")
    Rel(wallet_h, wallet_svc, "Delegates wallet ops")
    Rel(txn_h, txn_svc, "Delegates transaction ops")
    Rel(cat_h, cat_svc, "Delegates category ops")
    Rel(budget_h, budget_svc, "Delegates budget ops")
    Rel(invest_h, invest_svc, "Delegates investment ops")
    Rel(invest_h, market_svc, "Price lookups")
    Rel(invest_h, portfolio_svc, "Historical values")
    Rel(import_h, import_svc, "Delegates import ops")
    Rel(price_h, market_svc, "Combined gold/silver prices")

    Rel(wallet_svc, wallet_repo, "Persists wallets")
    Rel(wallet_svc, fx_svc, "Currency conversion")
    Rel(txn_svc, txn_repo, "Persists transactions")
    Rel(cat_svc, cat_repo, "Persists categories")
    Rel(budget_svc, budget_repo, "Persists budgets")
    Rel(invest_svc, invest_repo, "Persists investments")
    Rel(invest_svc, invest_txn_repo, "Persists inv transactions")
    Rel(invest_svc, market_svc, "Current prices for PNL")
    Rel(market_svc, market_repo, "Caches prices in DB")
    Rel(market_svc, yahoo_client, "Fetches market prices")
    Rel(market_svc, vang_client, "Fetches gold/silver prices")
    Rel(fx_svc, fx_repo, "Persists FX rates")
    Rel(import_svc, import_repo, "Persists import data")
    Rel(import_svc, txn_repo, "Creates transactions")
    Rel(portfolio_svc, portfolio_repo, "Persists snapshots")
    Rel(portfolio_svc, invest_svc, "Current portfolio value")

    Rel(user_repo, postgres, "SQL")
    Rel(wallet_repo, postgres, "SQL")
    Rel(txn_repo, postgres, "SQL")
    Rel(auth_svc, redis, "JWT whitelist")
    Rel(market_svc, redis, "Price cache")
    Rel(fx_svc, redis, "Rate cache")
    Rel(auth_svc, google_client, "Verify ID tokens")
    Rel(import_svc, supabase_client, "File operations")
```

## Data Flow Examples

### Authentication Flow
```
User → SPA → REST API → Auth Middleware → Auth Service → Google OAuth (verify)
                                                       → Redis (session)
                                                       → PostgreSQL (user record)
                                        ← JWT token ←
```

### Create Investment Flow
```
User → SPA → REST API → Auth MW → Investment Handler → Investment Service
                                                      → Wallet Service (verify wallet ownership)
                                                      → Investment Repository (create holding)
                                                      → Investment Lot Repository (create FIFO lot)
                                                      → Market Data Service (fetch current price)
                                   ← Investment details ←
```

### Background Price Update Flow
```
Scheduler (every 15min) → User Repository (list all users)
                        → Investment Repository (list user investments)
                        → Market Data Service → Yahoo Finance (stocks/ETFs/crypto)
                                              → vang.today (gold/silver)
                                              → Redis (update price cache)
                                              → Market Data Repository (persist to DB)
```
