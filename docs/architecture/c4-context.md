# C4 Level 1: System Context

Shows WealthJourney in its environment — the user and all external systems it interacts with.

```mermaid
C4Context
    title WealthJourney - System Context Diagram

    Person(user, "User", "Manages personal finances, tracks investments, imports bank statements")

    System(wj, "WealthJourney", "Personal finance management platform: wallets, transactions, budgets, investments, bank imports, analytics")

    System_Ext(google, "Google OAuth", "Identity provider for user authentication")
    System_Ext(yahoo, "Yahoo Finance API", "Real-time stock/ETF/crypto market prices and symbol search")
    System_Ext(vang247, "vang.today API", "Vietnamese gold and silver price data")
    System_Ext(supabase_storage, "Supabase Storage", "File storage for bank statement uploads (CSV/Excel/PDF)")

    SystemDb_Ext(postgres, "PostgreSQL (Supabase)", "Primary data store: users, wallets, transactions, investments, budgets")
    SystemDb_Ext(redis, "Redis", "Session store, JWT whitelist, price cache, rate limiting, job queues")

    Rel(user, wj, "Uses", "HTTPS / PWA")
    Rel(wj, google, "Verifies identity tokens", "HTTPS")
    Rel(wj, yahoo, "Fetches market prices & symbol search", "HTTPS")
    Rel(wj, vang247, "Fetches gold/silver prices", "HTTPS")
    Rel(wj, supabase_storage, "Uploads/downloads import files", "HTTPS")
    Rel(wj, postgres, "Reads/writes all domain data", "TCP/SSL")
    Rel(wj, redis, "Sessions, caching, queues", "TCP/SSL")
```

## External System Details

| System | Purpose | Protocol | Rate Limits |
|--------|---------|----------|-------------|
| Google OAuth | User authentication via ID tokens | HTTPS | N/A |
| Yahoo Finance | Market prices, symbol search | HTTPS | 120 req/min (self-imposed) |
| vang.today | Gold & silver prices (Vietnam market) | HTTPS | 15-min cache TTL |
| Supabase Storage | Bank statement file upload/download | HTTPS | Per-project limits |
| PostgreSQL | All persistent domain data | TCP/SSL (port 5432) | Connection pool: 10 |
| Redis | Ephemeral data: sessions, cache, queues | TCP/SSL (port 6379) | N/A |
