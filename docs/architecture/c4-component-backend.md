# C4 Level 3: Backend Components

Shows the internal structure of the Go backend — how HTTP requests flow through handlers, services, and repositories to data stores and external APIs.

```mermaid
C4Component
    title WealthJourney Backend - Component Diagram (with Trust Boundaries)

    Container_Boundary(transport, "Transport Layer — TRUST BOUNDARY: Untrusted input enters here") {
        Component(gin, "Gin HTTP Server", "gin-gonic/gin", "Request routing, CORS, middleware pipeline")
        Component(auth_mw, "Auth Middleware", "JWT + Redis", "Extracts bearer token, verifies against Redis whitelist, sets user context and is_admin flag")
        Component(admin_mw, "Admin Middleware", "handlers/middleware.go", "Checks is_admin flag in gin context, rejects non-admin requests with 403")
        Component(rate_mw, "Rate Limiter", "Token bucket", "Per-IP (public) and per-user (protected) rate limiting")
        Component(grpc_srv, "gRPC Server", "google.golang.org/grpc", "Protocol Buffer service implementations")
        Component(grpc_gw, "gRPC-Gateway", "grpc-ecosystem/grpc-gateway", "HTTP-to-gRPC reverse proxy")
    }

    Container_Boundary(handlers, "HTTP Handlers — Input validated and user authenticated at this layer") {
        Component(auth_h, "Auth Handlers", "Register, Login, Logout, Verify, Password Auth", "Google OAuth + username/password auth (register, login, link, change password, get auth methods, unlink Google)")
        Component(user_h, "User Handlers", "CRUD + Preferences", "Handles user CRUD, preferences (currency + language), and profile operations")
        Component(wallet_h, "Wallet Handlers", "CRUD + Transfer + Balance", "Wallet management and fund operations")
        Component(txn_h, "Transaction Handlers", "CRUD + Reports", "Transaction management and financial reports")
        Component(cat_h, "Category Handlers", "CRUD", "User-defined transaction categories")
        Component(budget_h, "Budget Handlers", "CRUD + Items", "Budget and budget item management")
        Component(invest_h, "Investment Handlers", "CRUD + Txn + Prices", "Investment holdings, transactions, market data")
        Component(import_h, "Import Handlers", "Upload + Parse + Execute", "Bank statement import wizard endpoints")
        Component(price_h, "Market Price Handlers", "Gold + Silver + Currency + Market", "Gold/silver/currency type codes and combined market prices. GoldHandler (handlers/gold.go) and SilverHandler (handlers/silver.go) read VND type lists from AssetDisplayConfigService.ListForInvestment() instead of static pkg/gold/types.go and pkg/silver/types.go registries; USD types (XAUUSD, XAGUSD) remain hardcoded.")
        Component(gold_chart_h, "Gold Chart Handler", "handlers/gold_chart.go", "Proxies gold price history from mihong.vn with Redis caching")
        Component(silver_chart_h, "Silver Chart Handler", "handlers/silver_chart.go", "Proxies silver price history from giabac.vn and Yahoo Finance SI=F with Redis caching")
        Component(community_h, "Community Handlers", "Posts + Comments + Likes + Follows + Reports", "Social feed, post CRUD, commenting, liking, user following, content moderation; Phase 3: UploadImage, UpdateComment, GetReplies, GetLikedPosts, UpdateProfile, StreamNotifications")
        Component(gold_sentiment_h, "GoldSentiment Handler", "handlers/gold_sentiment.go", "Daily asset sentiment vote & comments (gold/silver via category query param). Public GET with optional auth, protected POST/DELETE for voting and commenting.")
        Component(price_override_h, "PriceOverride Handler", "handlers/price_override.go", "Admin-only REST handler for price override CRUD (Set/List/Delete). Protected by AdminMiddleware.")
        Component(public_h, "Public Handlers", "handlers/public.go", "No-auth endpoint returning gold/silver/currency type names from in-memory registries. IP-rate-limited only.")
        Component(feedback_h, "Feedback Handlers", "handlers/feedback.go", "Submit feedback and list user's own feedback. Auth + rate limit middleware.")
        Component(site_settings_h, "SiteSettings Handler", "handlers/site_settings.go", "Public GET (no auth) for all site settings. Admin-only PUT for bulk-updating settings. Protected by AdminMiddleware for writes.")
        Component(admin_user_h, "AdminUser Handler", "handlers/admin_user.go", "Admin-only: list users with search, toggle admin role. Protected by AdminMiddleware. Self-protection: cannot toggle own role.")
        Component(admin_feedback_h, "AdminFeedback Handler", "handlers/admin_feedback.go", "Admin-only: list all feedback with status filter, update feedback (status + admin note), soft-delete feedback. Protected by AdminMiddleware.")
        Component(admin_broadcast_h, "AdminBroadcast Handler", "handlers/admin_broadcast.go", "Admin-only: POST /admin/broadcast. Binds message, delegates to AdminService.Broadcast, returns recipientCount. Protected by AdminMiddleware.")
        Component(price_alert_config_h, "PriceAlertConfig Handler", "handlers/price_alert_config.go", "Admin-only: GET/PUT /admin/price-alert-config. Loads config from Redis with env var defaults, merges partial updates, sanitizes HTML, validates fields. Protected by AdminMiddleware.")
        Component(push_h, "Push Handler", "handlers/push.go", "GET /push/vapid-key (public key), POST /push/subscribe (validates HTTPS endpoint, base64 keys, max 5 subs/user), DELETE /push/subscribe (by endpoint). Auth required for subscribe/unsubscribe.")
        Component(watchlist_h, "Watchlist Handler", "handlers/watchlist.go", "CRUD for user symbol watchlists. GET /watchlist (list), POST /watchlist (add symbol), DELETE /watchlist/{id} (remove). Auth required. Delegates to WatchlistService and fetches live prices on list.")
        Component(user_price_alert_h, "UserPriceAlert Handler", "handlers/user_price_alert.go", "CRUD for user-defined price alerts. GET /price-alerts (list), POST /price-alerts (create), PUT /price-alerts/{id} (update), DELETE /price-alerts/{id} (remove). Auth required. Delegates to UserPriceAlertService.")
        Component(gold_display_config_h, "AssetDisplayConfig Handler", "handlers/asset_display_config.go", "Public GET /asset-display-prices returns enabled asset types (gold/silver) joined with live prices and admin overrides. Admin CRUD: GET/POST /admin/asset-display-config (list/create), PUT/DELETE /admin/asset-display-config/{id} (update/soft-delete). Fetch code sub-resource: GET/POST /admin/asset-display-config/{id}/fetch-codes, DELETE /admin/asset-display-config/{id}/fetch-codes/{codeId}. Admin routes protected by AdminMiddleware.")
    }

    Container_Boundary(services, "Service Layer — TRUST BOUNDARY: Data considered validated after this point") {
        Component(auth_svc, "Auth Service", "domain/auth", "Google OAuth + bcrypt password auth, JWT generation, session management, password change with session invalidation")
        Component(user_svc, "User Service", "domain/service", "User CRUD, preferences (currency + language), currency conversion orchestration")
        Component(wallet_svc, "Wallet Service", "domain/service", "Balance tracking, fund transfers, multi-currency support. CreateWallet forces type to BASIC regardless of request.")
        Component(txn_svc, "Transaction Service", "domain/service", "Transaction CRUD, financial reports, category breakdowns")
        Component(cat_svc, "Category Service", "domain/service", "Category CRUD, default category seeding for new users")
        Component(budget_svc, "Budget Service", "domain/service", "Budget lifecycle, budget item tracking, spending analysis")
        Component(invest_svc, "Investment Service", "domain/service", "Holdings management, FIFO cost basis, PNL calculation. Investments owned directly by user_id; wallet association is optional (walletId=0 means no wallet).")
        Component(market_svc, "Market Data Service", "domain/service", "Price caching, Yahoo Finance integration. Gold/silver prices resolved via AssetDisplayConfigService.ResolvePrice (DB-only, no live API calls for gold/silver). Stocks/crypto/ETF prices still fetched live from Yahoo Finance.")
        Component(currency_svc, "Currency Price Service", "domain/service", "Foreign currency price fetching using 3 parallel sources: vangsaigon.vn, vang.today, and Vietcombank direct API. Each source runs concurrently; results are merged and best available price is used. Redis-cached.")
        Component(silver_ext, "External Silver Clients", "pkg/silverprice", "Multi-source silver prices: Phú Quý (HTML), Ancarat (JSON), DOJI (text)")
        Component(fx_svc, "FX Rate Service", "domain/service", "Currency conversion rates, cross-currency calculations")
        Component(import_svc, "Import Service", "domain/service", "File parsing, field mapping, duplicate detection, batch execution")
        Component(portfolio_svc, "Portfolio History Service", "domain/service", "Historical portfolio value snapshots for charts")
        Component(gold_sentiment_svc, "GoldSentiment Service", "domain/service", "Vote upsert, comments with rate limiting, Redis caching (30s TTL) with per-category key isolation (gold/silver), Vietnam TZ daily reset")
        Component(community_svc, "Community Service", "domain/service", "Social interactions: posts, comments, likes, follows, content reports; Phase 2: SharePost, GetNotifications, GetUnreadNotificationCount, MarkNotificationsRead, SavePost, UnsavePost, GetSavedPosts, GetSuggestedUsers, GetTrendingTopics, GetFollowing, GetFollowers; Phase 3: UploadImage, UpdateComment, GetReplies, GetLikedPosts, UpdateProfile, StreamNotifications")
        Component(feedback_svc, "Feedback Service", "domain/service", "Submit feedback with validation (subject 1-200, message 1-2000), rate limiting (10/user/hour), list user feedback")
        Component(site_settings_svc, "SiteSettings Service", "domain/service", "Validates setting keys against allowlist (17 keys), strips HTML from values, max 5000 chars. Cache-first reads, DB fallback.")
        Component(admin_svc, "Admin Service", "domain/service", "Admin user management (list with search, toggle role with self-protection), feedback management (list with status filter, update status/note with HTML stripping, soft-delete), and broadcast messaging (HTML stripping, rate limiting 10/hr/admin via Redis, batch notification creation, SSE publish, push delivery)")
        Component(push_svc, "Push Service", "domain/service/push_service.go", "Web Push notification delivery via VAPID/webpush-go. Concurrent fan-out with 20-worker semaphore. Returns noopPushService when VAPID keys absent. Auto-removes 410 Gone subscriptions.")
        Component(price_alert_svc, "Price Alert Service", "domain/service/price_alert_service.go", "Detects significant gold/silver price movements vs Redis baselines across 4 categories. Reads prices from AssetPriceService (DB cache). Reads PriceAlertConfig from Redis at runtime (thresholds, cooldown, topMoversCount, templates, enable/disable per category). Uses template resolution for notification title/body. Batch notification creation, SSE publish, push delivery.")
        Component(gold_price_svc, "Gold Price Service", "domain/service/gold_price_service.go", "Fetches and caches Vietnamese and world gold prices using a 4-source waterfall fallback: vangsaigon.vn (primary, 5s timeout) → vang.today (fallback #1, 5s timeout) → BTMC (fallback #2, 5s timeout) → Mihong (fallback #3, 5s timeout). Provides typed gold price lookup by type code (SJC variants, DOJI, XAU, Mihong_999). Redis-cached with 15-minute TTL.")
        Component(silver_price_svc, "Silver Price Service", "domain/service/silver_price_service.go", "Fetches and caches silver prices from multiple sources (Phú Quý, Ancarat, DOJI). Provides typed silver price lookup by type code. Redis-cached with 15-minute TTL.")
        Component(watchlist_svc, "Watchlist Service", "domain/service/watchlist_service.go", "User watchlist management: add/remove/list symbols with deduplication. Enriches list results with live prices by delegating to MarketDataService (stocks/crypto/ETFs) and AssetPriceService (gold/silver/currency type codes from DB cache). Validates symbol existence before adding.")
        Component(user_price_alert_svc, "UserPriceAlert Service", "domain/service/user_price_alert_service.go", "Manages user-defined price alerts: CRUD operations, threshold evaluation against prices from MarketDataService (stocks/crypto/ETF) and AssetDisplayConfigService.ResolvePrice (gold/silver — resolves best available price via fetch code priority). Triggers notifications via NotificationRepository and push delivery via PushService when alert conditions are met.")
        Component(asset_price_svc, "AssetPrice Service", "domain/service/asset_price_service.go", "Reads cached prices from asset_price DB table. GetAllPrices and GetMarketTypes filter by enabled asset_display_config rows before returning results (disabled or deleted configs are excluded). GetPricesByAssetType and GetPriceByTypeCode are unfiltered (used by ResolvePrice / investment pricing paths). RefreshAllPrices called by PriceCacheJob to orchestrate 10 parallel goroutines: 6 gold sources + 1 silver source + 3 currency sources (vangsaigon.vn, vang.today, Vietcombank direct API).")
        Component(gold_display_config_svc, "AssetDisplayConfig Service", "domain/service/asset_display_config_service.go", "Manages admin-configurable asset display config (gold and silver). GetDisplayPrices joins enabled configs from asset_display_config with latest prices from asset_price via fetch code priority mapping and applies PriceOverrideCache overrides. ResolvePrice(typeCode, currency) resolves price for a given display config entry using ordered fetch codes. CRUD: Create validates type_code + asset_type and detects duplicates (409), Update fetches by ID (404 if not found), Delete soft-deletes. Fetch code CRUD: add/remove/reorder AssetConfigFetchCode entries per config.")
    }

    Container_Boundary(repos, "Repository Layer (Data Access)") {
        Component(user_repo, "User Repository", "GORM", "User table CRUD with soft deletes")
        Component(wallet_repo, "Wallet Repository", "GORM", "Wallet table CRUD with balance locking")
        Component(txn_repo, "Transaction Repository", "GORM", "Transaction table with pagination and filtering")
        Component(cat_repo, "Category Repository", "GORM", "Category table with user scoping")
        Component(budget_repo, "Budget Repository", "GORM", "Budget + BudgetItem tables")
        Component(invest_repo, "Investment Repository", "GORM", "Investment + InvestmentLot tables. Queries by user_id directly (no wallet JOIN). WalletID is nullable.")
        Component(invest_txn_repo, "Investment Transaction Repository", "GORM", "Investment transaction records")
        Component(market_repo, "Market Data Repository", "GORM", "Cached market price records")
        Component(fx_repo, "FX Rate Repository", "GORM", "Exchange rate history")
        Component(import_repo, "Import Repository", "GORM", "Import batches, templates, merchant rules")
        Component(portfolio_repo, "Portfolio History Repository", "GORM", "Historical portfolio value records")
        Component(post_repo, "Post Repository", "GORM", "Community posts with content and topic tags; GetByIDs batch fetch, IncrementShareCount, hashtag filter on GetFeed")
        Component(comment_repo, "Comment Repository", "GORM", "Post comments")
        Component(like_repo, "Like Repository", "GORM", "Post likes with unique constraints")
        Component(follow_repo, "Follow Repository", "GORM", "User follow relationships; GetFriendsOfFriends, GetTopUsersByFollowers, GetFollowing, GetFollowers (paginated with Preload)")
        Component(report_repo, "Report Repository", "GORM", "Content reports for moderation")
        Component(notification_repo, "Notification Repository", "GORM", "CRUD for user notifications (like, comment, follow, share, price_alert, admin_broadcast). Supports BatchCreate for bulk notification insertion.")
        Component(push_sub_repo, "Push Subscription Repository", "GORM", "push_subscription table CRUD. CountByUserID for 5-sub cap enforcement. DeleteByEndpoint for 410 Gone cleanup.")
        Component(saved_post_repo, "Saved Post Repository", "GORM", "Save/unsave posts per user with unique constraints")
        Component(hashtag_repo, "Hashtag Repository", "GORM", "Hashtag extraction index and trending hashtag aggregations")
        Component(gold_vote_repo, "GoldVote Repository", "GORM", "Vote persistence with upsert (ON CONFLICT), count by date")
        Component(gold_vote_comment_repo, "GoldVoteComment Repository", "GORM", "Comment CRUD with soft delete, daily count for rate limiting")
        Component(feedback_repo, "Feedback Repository", "GORM", "Feedback CRUD with user scoping and rate limit counting")
        Component(site_settings_repo, "SiteSettings Repository", "GORM", "site_settings table CRUD with bulk upsert via ON CONFLICT")
        Component(watchlist_repo, "Watchlist Repository", "GORM", "watchlist table CRUD with user scoping. Enforces unique (user_id, symbol) constraint. Supports list by user_id with ordering by created_at.")
        Component(user_price_alert_repo, "UserPriceAlert Repository", "GORM", "user_price_alert table CRUD with user scoping. Stores per-user alert definitions (symbol, target_price, direction, trigger_mode, AlertStatus enum: active/triggered/paused). Supports list by user_id and lookup by id+user_id for ownership verification.")
        Component(asset_price_repo, "AssetPrice Repository", "GORM", "asset_price table CRUD. UpsertBatch via ON CONFLICT (type_code, currency) DO UPDATE for efficient bulk upsert. ListByAssetType and ListAll for handler reads. MarkStaleByAssetType sets is_stale=true for all rows of a given asset type when fetch fails.")
        Component(gold_display_config_repo, "AssetDisplayConfig Repository", "GORM", "asset_display_config table CRUD. ListAll returns all entries including disabled (for admin). ListEnabled returns only enabled=true entries ordered by display_order (for public endpoint). GetByTypeCode for duplicate detection on create. Soft-delete via gorm.DeletedAt. Unique constraint on type_code. Supports filtering by asset_type (gold/silver).")
        Component(asset_config_fetch_code_repo, "AssetConfigFetchCode Repository", "GORM", "asset_config_fetch_code join table CRUD. ListByConfigID returns ordered fetch codes for a given asset_display_config entry (ordered by priority ASC). Create/Delete for adding and removing fetch code mappings. Enforces unique (asset_display_config_id, type_code) constraint.")
    }

    Container_Boundary(scheduler, "Scheduler Layer — Background jobs") {
        Component(price_cache_job, "PriceCacheJob", "internal/scheduler/price_cache_job.go", "Runs every 15 minutes (10s startup delay). Calls AssetPriceService.RefreshAllPrices to fetch gold/silver/currency prices from external services and persist to DB. Each asset type fetched independently — one failure doesn't block others. Implements scheduler.Job interface.")
    }

    Container_Boundary(external, "External Integrations — TRUST BOUNDARY: Untrusted external responses") {
        Component(yahoo_client, "Yahoo Finance Client", "pkg/yahoo", "Market price quotes, symbol search, rate throttling")
        Component(vang_client, "vangsaigon.vn Client", "pkg/vnprice", "Vietnamese gold/silver/currency price fetching via vangsaigon.vn REST API — primary source")
        Component(vangtoday_client, "vang.today Client", "pkg/vangtoday", "Fallback gold and currency price fetching from www.vang.today/api/prices (JSON). Used when vangsaigon.vn is unavailable.")
        Component(vietcombank_client, "Vietcombank Client", "pkg/vietcombank", "Third parallel source for Vietnamese currency (FX) exchange rates via Vietcombank direct API. Runs concurrently with vangsaigon.vn and vang.today during currency price refresh.")
        Component(btmc_client, "BTMC Client", "pkg/btmc", "Secondary fallback gold price fetching from api.btmc.vn (XML). Used when both vangsaigon.vn and vang.today are unavailable. No currency data available.")
        Component(mihong_pkg_client, "Mi Hồng Client", "pkg/mihong", "Tertiary fallback gold price fetching from api.mihong.vn/v1/gold-prices (JSON, header x-market:mihong). Used when vangsaigon.vn, vang.today, and BTMC are all unavailable. Covers Mihong-exclusive symbols (Mihong_999, etc.).")
        Component(phuquy_client, "Phú Quý Client", "pkg/silverprice", "Silver prices from giabac.phuquygroup.vn (HTML parsing)")
        Component(ancarat_client, "Ancarat Client", "pkg/silverprice", "Silver prices from giabac.ancarat.com (JSON 2D array)")
        Component(doji_client, "DOJI Client", "pkg/silverprice", "Silver prices from giabac.doji.vn (pipe-delimited text)")
        Component(sjc_client, "SJC Client", "pkg/sjc", "Fetches gold prices from SJC official API")
        Component(doji_gold_client, "DOJI Client", "pkg/doji", "Scrapes gold prices from DOJI website")
        Component(btmcdirect_client, "BTMC Direct Client", "pkg/btmcdirect", "Scrapes gold prices from BTMC website")
        Component(pnj_client, "PNJ Client", "pkg/pnj", "Fetches gold prices from PNJ API")
        Component(google_client, "Google OAuth Verifier", "domain/auth", "ID token verification via Google APIs")
        Component(supabase_client, "Supabase Storage Client", "pkg/storage", "File upload/download for bank statements and community image uploads")
        Component(imaging_pkg, "Imaging Package", "pkg/imaging", "Image processing: resize, compress, format conversion for community post/profile images")
        Component(mihong_client, "mihong.vn API", "direct HTTP", "Gold price history for domestic/global market")
        Component(giabac_client, "giabac.vn API", "direct HTTP", "Domestic silver price history")
    }

    Container_Boundary(shared_pkg, "Shared Packages") {
        Component(errCodes, "ErrorCodes Registry", "Go Constants", "Centralized error code definitions (DOMAIN_ACTION_REASON pattern)")
    }

    Container_Boundary(infra, "Infrastructure") {
        ComponentDb(postgres, "PostgreSQL 16", "Supabase", "All domain tables")
        ComponentDb(redis, "Redis 7", "Cache/Queue", "Sessions, prices, queues")
        Component(redis_pubsub, "Redis Pub/Sub", "Redis channels", "Real-time notification fanout for StreamNotifications SSE endpoint; community_notifications channel")
        Component(price_override_cache, "PriceOverride Cache", "pkg/cache/price_override_cache.go", "Redis cache for admin price overrides. Set/Get/Delete/List operations with per-type-code keys.")
        Component(site_settings_cache, "SiteSettings Cache", "pkg/cache/site_settings_cache.go", "Redis cache for site settings. Single key 'site_settings:all' with 5-minute TTL.")
    }

    Rel(gin, auth_mw, "Applies to protected routes")
    Rel(gin, rate_mw, "Applies to all routes")
    Rel(gin, auth_h, "Routes /auth/*")
    Rel(gin, user_h, "Routes /users/*")
    Rel(gin, wallet_h, "Routes /wallets/*")
    Rel(gin, txn_h, "Routes /transactions/*")
    Rel(gin, cat_h, "Routes /categories/*")
    Rel(gin, budget_h, "Routes /budgets/*")
    Rel(gin, invest_h, "Routes /investments/*")
    Rel(gin, import_h, "Routes /import/*")
    Rel(gin, price_h, "Routes /investments/market-prices")
    Rel(gin, gold_chart_h, "Routes /investments/gold-chart")
    Rel(gin, silver_chart_h, "Routes /investments/silver-chart")
    Rel(gin, community_h, "Routes /community/*")
    Rel(gin, price_override_h, "Routes /admin/price-overrides/*")
    Rel(gin, admin_mw, "Applies to admin routes")
    Rel(gin, gold_sentiment_h, "Routes /public/gold-sentiment/* & /gold-sentiment/*")
    Rel(gin, feedback_h, "Routes /feedback/*")
    Rel(gin, admin_user_h, "Routes /admin/users/*")
    Rel(gin, admin_feedback_h, "Routes /admin/feedback/*")
    Rel(gin, admin_broadcast_h, "Routes /admin/broadcast")
    Rel(gin, push_h, "Routes /push/*")
    Rel(gin, price_alert_config_h, "Routes /admin/price-alert-config")
    Rel(gin, watchlist_h, "Routes /watchlist/*")
    Rel(gin, user_price_alert_h, "Routes /price-alerts/*")
    Rel(gin, gold_display_config_h, "Routes /asset-display-prices (public) and /admin/asset-display-config/* (admin)")

    Rel(auth_h, auth_svc, "Delegates auth logic")
    Rel(user_h, user_svc, "Delegates user ops")
    Rel(wallet_h, wallet_svc, "Delegates wallet ops")
    Rel(txn_h, txn_svc, "Delegates transaction ops")
    Rel(cat_h, cat_svc, "Delegates category ops")
    Rel(budget_h, budget_svc, "Delegates budget ops")
    Rel(invest_h, invest_svc, "Delegates investment ops")
    Rel(invest_h, market_svc, "Price lookups")
    Rel(invest_h, portfolio_svc, "Historical values")
    Rel(import_h, import_svc, "Delegates import ops")
    Rel(price_h, asset_price_svc, "Reads all cached prices from DB")
    Rel(price_h, price_override_cache, "Merges admin overrides into market prices")
    Rel(price_h, gold_display_config_svc, "GoldHandler + SilverHandler read VND type lists via ListForInvestment()")
    Rel(public_h, asset_price_svc, "Reads market type names + timestamps from DB")
    Rel(price_override_h, price_override_cache, "Set/List/Delete overrides")
    Rel(gin, site_settings_h, "Routes /public/site-settings (GET), /admin/site-settings (PUT)")
    Rel(gold_sentiment_h, gold_sentiment_svc, "Delegates sentiment ops")
    Rel(community_h, community_svc, "Delegates social interactions")
    Rel(feedback_h, feedback_svc, "Delegates feedback ops")
    Rel(admin_user_h, admin_svc, "Delegates admin user ops")
    Rel(admin_feedback_h, admin_svc, "Delegates admin feedback ops")
    Rel(admin_broadcast_h, admin_svc, "Delegates broadcast")
    Rel(push_h, push_svc, "VAPID key + push delivery")
    Rel(push_h, push_sub_repo, "CRUD subscriptions")
    Rel(price_alert_config_h, redis, "Loads/saves price alert config")
    Rel(community_h, redis_pubsub, "Subscribes for SSE StreamNotifications")
    Rel(gold_chart_h, redis, "Read/write price history cache")
    Rel(silver_chart_h, redis, "Read/write price history cache")

    Rel(auth_h, errCodes, "Uses error codes")
    Rel(wallet_h, errCodes, "Uses error codes")
    Rel(txn_h, errCodes, "Uses error codes")
    Rel(invest_h, errCodes, "Uses error codes")
    Rel(budget_h, errCodes, "Uses error codes")
    Rel(import_h, errCodes, "Uses error codes")
    Rel(auth_svc, errCodes, "Uses error codes")
    Rel(wallet_svc, errCodes, "Uses error codes")
    Rel(txn_svc, errCodes, "Uses error codes")
    Rel(invest_svc, errCodes, "Uses error codes")
    Rel(budget_svc, errCodes, "Uses error codes")
    Rel(import_svc, errCodes, "Uses error codes")

    Rel(wallet_svc, wallet_repo, "Persists wallets")
    Rel(wallet_svc, fx_svc, "Currency conversion")
    Rel(txn_svc, txn_repo, "Persists transactions")
    Rel(cat_svc, cat_repo, "Persists categories")
    Rel(budget_svc, budget_repo, "Persists budgets")
    Rel(invest_svc, invest_repo, "Persists investments")
    Rel(invest_svc, invest_txn_repo, "Persists inv transactions")
    Rel(invest_svc, market_svc, "Current prices for PNL")
    Rel(market_svc, market_repo, "Caches prices in DB")
    Rel(market_svc, yahoo_client, "Fetches market prices (stocks/crypto/ETF)")
    Rel(market_svc, gold_display_config_svc, "Resolves gold/silver prices via ResolvePrice (DB-only)")
    Rel(currency_svc, vang_client, "Fetches currency prices")
    Rel(gold_price_svc, vang_client, "Fetches gold prices [primary]")
    Rel(gold_price_svc, vangtoday_client, "Fetches gold prices [fallback #1]")
    Rel(gold_price_svc, btmc_client, "Fetches gold prices [fallback #2]")
    Rel(gold_price_svc, mihong_pkg_client, "Fetches gold prices [fallback #3]")
    Rel(currency_svc, vangtoday_client, "Fetches currency prices [fallback #1]")
    Rel(currency_svc, vietcombank_client, "Fetches currency prices [parallel source #3]")
    Rel(currency_svc, redis, "Currency price cache")
    Rel(silver_ext, phuquy_client, "Fetches Phú Quý silver prices")
    Rel(silver_ext, ancarat_client, "Fetches Ancarat silver prices")
    Rel(silver_ext, doji_client, "Fetches DOJI silver prices")
    Rel(fx_svc, fx_repo, "Persists FX rates")
    Rel(import_svc, import_repo, "Persists import data")
    Rel(import_svc, txn_repo, "Creates transactions")
    Rel(portfolio_svc, portfolio_repo, "Persists snapshots")
    Rel(portfolio_svc, invest_svc, "Current portfolio value")
    Rel(community_svc, redis_pubsub, "Publishes notification events")
    Rel(community_svc, supabase_client, "Stores community images")
    Rel(community_svc, imaging_pkg, "Processes images before upload")
    Rel(gold_sentiment_svc, gold_vote_repo, "Reads/Writes votes")
    Rel(gold_sentiment_svc, gold_vote_comment_repo, "Reads/Writes comments")
    Rel(feedback_svc, feedback_repo, "Persists feedback")
    Rel(admin_svc, user_repo, "Lists and updates users, gets all user IDs for broadcast")
    Rel(admin_svc, feedback_repo, "Lists, updates, and deletes feedback")
    Rel(admin_svc, notification_repo, "BatchCreate broadcast notifications")
    Rel(admin_svc, push_svc, "Push delivery for broadcasts")
    Rel(admin_svc, redis, "Rate limiting (10/hr/admin), SSE publish")
    Rel(price_alert_svc, push_svc, "Push delivery for price alerts")
    Rel(price_alert_svc, notification_repo, "BatchCreate price alert notifications")
    Rel(price_alert_svc, user_repo, "Gets all user IDs")
    Rel(price_alert_svc, redis, "Baselines, cooldowns, SSE publish")
    Rel(price_alert_svc, gold_display_config_svc, "ListAll(assetType) — filters to admin-enabled type codes before evaluation")
    Rel(price_cache_job, asset_price_svc, "Triggers RefreshAllPrices every 15 minutes")
    Rel(asset_price_svc, asset_price_repo, "Reads and upserts cached prices")
    Rel(asset_price_svc, gold_display_config_repo, "Reads enabled type codes to filter display-facing responses")
    Rel(asset_price_svc, gold_price_svc, "Fetches live gold prices for cache refresh")
    Rel(asset_price_svc, silver_price_svc, "Fetches live silver prices for cache refresh")
    Rel(asset_price_svc, currency_svc, "Fetches live currency prices for cache refresh (3 parallel sources: vangsaigon.vn, vang.today, Vietcombank)")
    Rel(asset_price_svc, vietcombank_client, "Currency prices via CurrencyPriceService parallel fetch")
    Rel(sjc_client, asset_price_svc, "provides gold prices")
    Rel(doji_gold_client, asset_price_svc, "provides gold prices")
    Rel(btmcdirect_client, asset_price_svc, "provides gold prices")
    Rel(pnj_client, asset_price_svc, "provides gold prices")
    Rel(asset_price_repo, postgres, "SQL")
    Rel(watchlist_h, watchlist_svc, "Delegates watchlist ops")
    Rel(user_price_alert_h, user_price_alert_svc, "Delegates price alert ops")
    Rel(gold_display_config_h, gold_display_config_svc, "Delegates asset display config ops")
    Rel(gold_display_config_h, price_override_cache, "Merges admin overrides into display prices")
    Rel(watchlist_svc, watchlist_repo, "Persists watchlist entries")
    Rel(watchlist_svc, market_svc, "Fetches live prices for stock/crypto/ETF symbols")
    Rel(watchlist_svc, asset_price_svc, "Fetches cached gold/silver/currency prices from DB")
    Rel(user_price_alert_svc, user_price_alert_repo, "Persists user alert definitions")
    Rel(user_price_alert_svc, market_svc, "Fetches live prices for alert evaluation (stocks/crypto/ETF)")
    Rel(user_price_alert_svc, gold_display_config_svc, "Resolves gold/silver prices via ResolvePrice(symbol, assetType) for alert threshold evaluation")
    Rel(user_price_alert_svc, notification_repo, "Creates notifications when alert conditions are met")
    Rel(user_price_alert_svc, push_svc, "Push delivery when alert conditions are met")
    Rel(gold_display_config_svc, gold_display_config_repo, "Reads and persists asset display config entries")
    Rel(gold_display_config_svc, asset_config_fetch_code_repo, "Reads and persists fetch code mappings per config")
    Rel(gold_display_config_svc, asset_price_svc, "Reads cached gold/silver prices for price resolution via fetch codes")
    Rel(price_alert_svc, asset_price_svc, "Fetches cached gold/silver prices from DB for movement detection")
    Rel(push_svc, push_sub_repo, "Fetches subscriptions for delivery")
    Rel(push_sub_repo, postgres, "SQL")
    Rel(gold_sentiment_svc, redis, "Caches vote counts (30s TTL)")
    Rel(watchlist_repo, postgres, "SQL")
    Rel(user_price_alert_repo, postgres, "SQL")
    Rel(gold_display_config_repo, postgres, "SQL")
    Rel(asset_config_fetch_code_repo, postgres, "SQL")
    Rel(community_svc, post_repo, "Persists posts")
    Rel(community_svc, comment_repo, "Persists comments")
    Rel(community_svc, like_repo, "Persists likes")
    Rel(community_svc, follow_repo, "Persists follows")
    Rel(community_svc, report_repo, "Persists reports")
    Rel(community_svc, notification_repo, "Persists notifications")
    Rel(community_svc, saved_post_repo, "Persists saved posts")
    Rel(community_svc, hashtag_repo, "Persists and queries hashtags")
    Rel(site_settings_h, site_settings_svc, "Delegates site settings ops")
    Rel(site_settings_svc, site_settings_repo, "Persists site settings")
    Rel(site_settings_svc, site_settings_cache, "Cache-first reads, invalidates on write")

    Rel(user_repo, postgres, "SQL")
    Rel(wallet_repo, postgres, "SQL")
    Rel(txn_repo, postgres, "SQL")
    Rel(post_repo, postgres, "SQL")
    Rel(comment_repo, postgres, "SQL")
    Rel(like_repo, postgres, "SQL")
    Rel(follow_repo, postgres, "SQL")
    Rel(report_repo, postgres, "SQL")
    Rel(notification_repo, postgres, "SQL")
    Rel(saved_post_repo, postgres, "SQL")
    Rel(hashtag_repo, postgres, "SQL")
    Rel(gold_vote_repo, postgres, "SQL")
    Rel(gold_vote_comment_repo, postgres, "SQL")
    Rel(feedback_repo, postgres, "SQL")
    Rel(site_settings_repo, postgres, "SQL")
    Rel(auth_svc, redis, "JWT whitelist")
    Rel(price_override_cache, redis, "Price override cache")
    Rel(site_settings_cache, redis, "Site settings cache")
    Rel(market_svc, redis, "Price cache")
    Rel(gold_price_svc, redis, "Gold price cache (15-minute TTL)")
    Rel(silver_price_svc, redis, "Silver price cache (15-minute TTL)")
    Rel(fx_svc, redis, "Rate cache")
    Rel(auth_svc, google_client, "Verify ID tokens")
    Rel(import_svc, supabase_client, "File operations")
    Rel(gold_chart_h, mihong_client, "Fetches domestic/global gold price history")
    Rel(silver_chart_h, giabac_client, "Fetches domestic silver price history")
    Rel(silver_chart_h, yahoo_client, "Fetches global SI=F silver futures history")
```

## Trust Boundaries Within Backend

| Boundary | Where | What Happens |
|----------|-------|--------------|
| **Untrusted → Auth Middleware** | Transport Layer entry | Raw HTTP request enters. JWT extracted and verified against Redis whitelist. Rate limiting applied. |
| **Auth Middleware → Handlers** | After authentication | User ID set in context (from JWT, never from request params). is_admin flag set from user record. Request is authenticated but input not yet validated. |
| **Admin Middleware → Admin Handlers** | After admin check | Verifies is_admin flag in gin context. Non-admin requests rejected with 403 Forbidden before reaching handler logic. |
| **Handlers → Service Layer** | Handler calls service method | Handler validates/parses request body. Service layer performs business validation + ownership checks. After service validation, data is considered trusted. |
| **Service Layer → Repository** | Service calls repository | Data is validated and authorized. Repository only handles persistence logic (no business rules). |
| **Service → External APIs** | Outbound to Yahoo/vangsaigon.vn/vang.today/BTMC/Google | Responses are UNTRUSTED. Must validate types, ranges, handle timeouts. Cache with TTL for resilience. Gold/currency services use waterfall fallback across 3 and 2 sources respectively. |
| **External APIs → Service** | Inbound price/token data | All external data validated before storing. Numeric ranges checked. Graceful fallback to next waterfall source on failure; stale cache used when all sources fail. |
| **Handler → External APIs (chart)** | Outbound to mihong.vn/giabac.vn/Yahoo Finance | Chart handlers call external APIs directly (no service layer). Responses are UNTRUSTED. Query params validated via allowlist. Stale cache used as fallback on failure. |

**Security invariants:**
- User ID ALWAYS comes from JWT context, never from request parameters
- Every service method that accesses user data verifies ownership
- External API failures never cause data corruption (cache fallback)
- Database errors are wrapped before returning to client (no leaking internals)

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
                                                      → Wallet Repository (auto-select wallet if walletId=0)
                                                      → Investment Repository (create holding)
                                                      → Investment Lot Repository (create FIFO lot)
                                                      → Market Data Service (fetch current price)
                                   ← Investment details ←
```

### Gold/Silver Chart Data Flow
```
User → SPA → REST API → Auth MW → GoldChartHandler  → Redis (cache hit? serve immediately)
                                                      → mihong.vn (cache miss: fetch history)
                                                      → Redis (write fresh cache + stale fallback)
                                  ← chart data points ←

User → SPA → REST API → Auth MW → SilverChartHandler → Redis (cache hit? serve immediately)
                                  [domestic]           → giabac.vn (fetch history)
                                  [global]             → Yahoo Finance SI=F (fetch history)
                                                       → Redis (write fresh cache + stale fallback)
                                  ← chart data points ←
```

### Admin Price Override Flow
```
Admin → SPA → REST API → Auth MW (sets is_admin) → Admin MW (verifies is_admin)
                                                   → PriceOverride Handler → PriceOverride Cache (Redis)
                                ← override saved ←

User → SPA → REST API → Auth MW → Market Price Handler → Market Data Service (fetch prices)
                                                        → PriceOverride Cache (list overrides)
                                                        → Merge: overrides replace matching type codes
                                ← merged prices with isOverridden flags ←
```

### Admin Broadcast Flow
```
Admin → SPA → REST API → Auth MW → Admin MW → AdminBroadcast Handler → AdminService.Broadcast
                                                                       → Validate message (500 char max, strip HTML)
                                                                       → Rate limit (10/hr/admin via Redis INCR)
                                                                       → UserRepository.GetAllUserIDs
                                                                       → NotificationRepository.BatchCreate
                                                                       → Redis PUBLISH (SSE per user)
                                                                       → PushService.SendToAll (Web Push)
                                  ← recipientCount ←
```

### Price Alert Detection Flow
```
Scheduler (every 15min) → PriceAlertService.CheckAndAlert
                        → Redis GET price_alert:config (LoadPriceAlertConfig)
                        → GoldPriceService.FetchAllPrices
                        → SilverPriceService.FetchAllPrices
                        → Skip disabled categories (catCfg.Enabled)
                        → Redis GET (baselines per typeCode)
                        → Calculate % change, filter by catCfg.ThresholdPct
                        → Redis EXISTS (cooldown check, cfg.CooldownMinutes)
                        → UserRepository.GetAllUserIDs
                        → ResolvePlaceholders(catCfg.TitleTemplate, values)
                        → NotificationRepository.BatchCreate
                        → Redis PUBLISH (SSE per user)
                        → PushService.SendToAll (Web Push)
                        → Redis SET (cooldown + updated baselines)
```

### Admin Price Alert Config Flow
```
Admin → SPA → REST API → Auth MW → Admin MW → PriceAlertConfig Handler
                                               → GET: LoadPriceAlertConfig(Redis) → defaults fallback
                                               → PUT: BindJSON → mergeConfig → SanitizePriceAlertConfig
                                                                             → ValidatePriceAlertConfig
                                                                             → SavePriceAlertConfig(Redis)
                                ← config JSON ←
```

### Background Price Update Flow
```
Scheduler (every 15min) → User Repository (list all users)
                        → Investment Repository (list user investments)
                        → Market Data Service → Yahoo Finance (stocks/ETFs/crypto)
                                              → vangsaigon.vn → vang.today → BTMC (gold, waterfall)
                                              → vangsaigon.vn → vang.today (currency, waterfall)
                                              → Phú Quý / Ancarat / DOJI (silver)
                                              → Redis (update price cache)
                                              → Market Data Repository (persist to DB)
```

### Watchlist List Flow (with Live Price Enrichment)
```
User → SPA → REST API → Auth MW → Watchlist Handler → WatchlistService.ListByUserID
                                                      → WatchlistRepository (fetch entries by user_id)
                                                      → Parallel price enrichment:
                                                        → MarketDataService (stocks/crypto/ETF symbols → Yahoo Finance / Redis)
                                                        → GoldPriceService (gold type codes → vangsaigon.vn / Redis)
                                                        → SilverPriceService (silver type codes → multi-source / Redis)
                                  ← enriched watchlist with live prices ←
```

### Watchlist Add Symbol Flow
```
User → SPA → REST API → Auth MW → Watchlist Handler → WatchlistService.AddSymbol
                                                      → Validate symbol type (stock/gold/silver/currency)
                                                      → Validate existence (price lookup via appropriate service)
                                                      → Check 50-item limit (WatchlistRepository.CountByUserID)
                                                      → Check deduplication (unique user_id+symbol constraint)
                                                      → WatchlistRepository.Create
                                  ← watchlist entry ←
```

### Admin CMS Settings Flow
```
Admin → SPA → REST API → Auth MW → Admin MW → SiteSettings Handler → SiteSettings Service
                                                                     → Validate keys (allowlist)
                                                                     → Strip HTML tags
                                                                     → SiteSettings Repository (DB upsert)
                                                                     → SiteSettings Cache (invalidate)
                                ← Updated settings ←

Landing → SSR (generateMetadata) → GET /public/site-settings → SiteSettings Handler
                                                               → SiteSettings Cache (hit? return)
                                                               → SiteSettings Repository (miss: load from DB)
                                                               → SiteSettings Cache (set with 5min TTL)
                                   ← SEO metadata + footer ←
```
