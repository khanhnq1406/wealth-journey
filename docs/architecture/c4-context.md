# C4 Level 1: System Context

Shows WealthJourney in its environment — the user and all external systems it interacts with.

```mermaid
C4Context
    title WealthJourney - System Context Diagram

    Person(user, "User", "Manages personal finances, tracks investments, imports bank statements")

    System(wj, "WealthJourney", "Personal finance management platform: wallets, transactions, budgets, investments, bank imports, analytics")

    System_Ext(google, "Google OAuth", "Identity provider for user authentication")
    System_Ext(yahoo, "Yahoo Finance API", "Real-time stock/ETF/crypto market prices and symbol search")
    System_Ext(vangsaigon, "vangsaigon.vn Price API", "Primary source for Vietnamese gold, silver, and currency prices [JSON]")
    System_Ext(vangtodayPriceAPI, "vang.today Price API", "Fallback source for Vietnamese gold and currency prices in JSON format")
    System_Ext(vietcombankAPI, "Vietcombank API", "Third source for Vietnamese currency (FX) exchange rates via Vietcombank direct API")
    System_Ext(btmcPriceAPI, "BTMC Price API", "Secondary fallback source for gold prices (Bao Tin Minh Chau) in XML format")
    System_Ext(mihong, "Mi Hồng Price API", "api.mihong.vn — GET /v1/gold-prices?market=domestic\nHTTPS, header: x-market:mihong")
    System_Ext(supabase_storage, "Supabase Storage", "File storage for bank statement uploads (CSV/Excel/PDF)")

    SystemDb_Ext(postgres, "PostgreSQL (Supabase)", "Primary data store: users, wallets, transactions, investments, budgets")
    SystemDb_Ext(redis, "Redis", "Session store, JWT whitelist, price cache, rate limiting, job queues")

    Rel(user, wj, "Uses", "HTTPS / PWA")
    Rel(wj, google, "Verifies identity tokens", "HTTPS")
    Rel(wj, yahoo, "Fetches market prices & symbol search", "HTTPS")
    Rel(wj, vangsaigon, "Fetches gold/silver/currency prices [primary]", "HTTPS/JSON")
    Rel(wj, vangtodayPriceAPI, "Fetches gold/currency prices [fallback]", "HTTPS/JSON")
    Rel(wj, vietcombankAPI, "Fetches currency exchange rates [parallel source]", "HTTPS/JSON")
    Rel(wj, btmcPriceAPI, "Fetches gold prices [fallback]", "HTTP/XML")
    Rel(wj, mihong, "Fetches Mihong-exclusive gold prices", "HTTPS/JSON (fallback #4)")
    Rel(wj, supabase_storage, "Uploads/downloads import files", "HTTPS")
    Rel(wj, postgres, "Reads/writes all domain data", "TCP/SSL")
    Rel(wj, redis, "Sessions, caching, queues", "TCP/SSL")
```

## External System Details

| System | Purpose | Protocol | Rate Limits |
|--------|---------|----------|-------------|
| Google OAuth | User authentication via ID tokens | HTTPS | N/A |
| Yahoo Finance | Market prices, symbol search | HTTPS | 120 req/min (self-imposed) |
| vangsaigon.vn | Gold, silver & currency prices (Vietnam market) — **primary source** | HTTPS/JSON | 15-min cache TTL |
| vang.today | Gold & currency prices — **fallback source #1** (waterfall after vangsaigon.vn fails) | HTTPS/JSON | 5-sec per-request timeout |
| Vietcombank API | Currency (FX) exchange rates — **third parallel currency source** (runs concurrently with vangsaigon.vn and vang.today) | HTTPS/JSON | 5-sec per-request timeout |
| BTMC | Gold prices (Bao Tin Minh Chau) — **fallback source #2** (waterfall after vang.today fails) | HTTP/XML | 5-sec per-request timeout |
| Mi Hồng Price API | Mihong-exclusive gold prices (`Mihong_999` etc.) — **fallback source #3** (waterfall after BTMC fails); header `x-market: mihong` required | HTTPS/JSON | 5-sec per-request timeout |
| Supabase Storage | Bank statement file upload/download | HTTPS | Per-project limits |
| PostgreSQL | All persistent domain data | TCP/SSL (port 5432) | Connection pool: 10 |
| Redis | Ephemeral data: sessions, cache, queues | TCP/SSL (port 6379) | N/A |
