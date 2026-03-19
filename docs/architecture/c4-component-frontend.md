# C4 Level 3: Frontend Components

Shows the internal structure of the Next.js frontend — how pages delegate to feature modules, which use shared components and the API layer.

```mermaid
C4Component
    title WealthJourney Frontend - Component Diagram

    Container_Boundary(app, "App Router (Pages)") {
        Component(landing, "Landing Page", "app/landing", "Price teaser page: gold/silver/currency type tables with login links. Live TradingView gold/silver charts (no login required). Fetches from public /api/v1/public/market-types endpoint (no auth).")
        Component(auth_pages, "Auth Pages", "app/auth", "Login and register with Google OAuth + email/password forms")
        Component(dashboard, "Dashboard Home", "app/dashboard/home", "V2 Crimson & Gold: net worth, PNL card (self-contained with 1D/1W/1M/ALL period tabs), gold/silver TradingView charts (XAUUSD, XAGUSD), currency price table, wallets")
        Component(finance_page, "Finance Page", "app/dashboard/finance", "Unified tabbed view: FinanceTabBar switches between TransactionContent, ReportContent, BudgetContent via URL query params (?tab=transaction|report|budget). Content lazy-loaded via next/dynamic. Old routes (/transaction, /report, /budget) redirect here via middleware.")
        Component(wallet_page, "Wallet Page", "app/dashboard/wallets", "Wallet grid/list with fund operations")
        Component(portfolio_page, "Portfolio Page", "app/dashboard/portfolio", "Investment portfolio with analytics; period pill selector (1D/1W/1M/ALL) via PortfolioSummaryEnhanced. No wallet filter — queries all investments via walletId=0.")
        Component(prices_page, "Prices Page", "app/dashboard/prices", "Live gold/silver/currency/market prices with 4 tabs (Gold, Silver, Currency, Symbol Lookup). Admin users see inline price edit controls via useAuth isAdmin check.")
        Component(community_page, "Community Page", "app/dashboard/community", "Social feed with posts, comments, likes, user profiles")
        Component(settings, "Settings Pages", "app/dashboard/settings", "Sessions, import templates, language toggle, security (auth methods, set/change password)")
        Component(feedback_page, "Feedback Page", "app/dashboard/feedback", "Submit feedback form and view personal feedback history with status badges")
        Component(admin_page, "Admin CMS Page", "app/dashboard/admin", "Tabbed admin dashboard (SEO/Users/Feedback/Notifications). SEO tab: metadata editor (title, description, keywords, OG tags, Twitter cards, robots directives) and footer editor. Users tab: search users, toggle admin roles with self-protection. Feedback tab: status filter, view/update feedback with admin notes, soft-delete. Notifications tab: broadcast form (500 char limit) + price alert config form (global settings, per-category thresholds/templates/enable-disable). Admin-only access via AdminGuard.")
    }

    Container_Boundary(features, "Feature Modules (Target State)") {
        Component(auth_feat, "Auth Feature", "features/auth", "Login/register forms (Google OAuth + password), PasswordInput, PasswordStrengthIndicator, LinkPasswordForm, ChangePasswordForm, AuthMethodsCard, auth hooks, Redux auth state")
        Component(wallet_feat, "Wallet Feature", "features/wallet", "Wallet CRUD forms (type always BASIC, no type selector), wallet cards, balance display")
        Component(txn_feat, "Transaction Feature", "features/transaction", "Transaction forms, filters, cards, category management")
        Component(budget_feat, "Budget Feature", "features/budget", "Budget forms, progress cards, category breakdown")
        Component(invest_feat, "Investment Feature", "features/investment", "AddInvestmentForm: merged gold/silver type grouping (brand auto-detects VND/USD), optional purchase date, price-per-unit with market price auto-fetch + refresh. Supports CASH and FOREIGN_CURRENCY types (auto-custom mode). Detail modal, portfolio analytics, gold/silver calculators")
        Component(import_feat, "Import Feature", "features/import", "Import wizard steps, template management, file upload")
        Component(prices_feat, "Market Prices Feature", "features/market-prices", "Price display tables (gold/silver/currency), symbol lookup; hooks/usePublicMarketTypes.ts — public no-auth hook for landing page type names; CurrencyPriceTable, LandingCurrencyPriceTable components; InlinePriceEdit — inline price editing UI for admin users (click-to-edit with save/cancel); OverrideIndicator — blue dot indicator for overridden prices; hooks/usePriceOverride.ts — usePriceOverrideSet and usePriceOverrideDelete mutation hooks for admin price override CRUD")
        Component(report_feat, "Report Feature", "features/report", "Financial tables, period selectors, CSV/PDF export")
        Component(community_feat, "Community Feature", "features/community", "Posts, comments, likes, follows, profiles, topic tags; Phase 2 components: SharePostModal, SharedPostEmbed, HashtagLink, SavedPostsView, SuggestedUserCard, SuggestedUsers, TrendingTopics, ProfileView, FollowingView, UserListItem; updated: PostCard (share+save actions, onUserClick), PostBody (hashtag rendering, shared post embed), PostActions (Share/Save buttons), PostEngagement (shareCount), PostHeader (clickable avatar+name via onUserClick), CommunityFeed (onUserClick prop); hooks: useSavedPost, useNotifications (useNotificationCount, useMarkAllRead), usePushSubscription (SW registration, VAPID key fetch, subscribe/unsubscribe); utils: hashtag.ts (extractHashtags, tokenizeContent); Phase 3 components: ImageUpload, EditCommentForm, ReplyBubble, ReplyInput, ReplyList, ProfileEditModal, ProfileTabs; Phase 3 hooks: useNotificationStream (SSE-based real-time notifications with metadata + actorId=0 handling), useImageUpload (upload progress, preview, Supabase integration)")
        Component(feedback_feat, "Feedback Feature", "features/feedback", "SubmitFeedbackForm (Zod validation, rate limit handling), StatusBadge (pending/reviewed/resolved), FeedbackItem (expandable card), feedback-schema.ts")
        Component(admin_feat, "Admin Feature", "features/admin", "AdminGuard component (redirects non-admin users), AdminUsersTab (search, MobileTable, role toggle with self-protection, confirmation dialog), AdminFeedbackTab (status filter, edit panel for status/admin note, delete confirmation), AdminBroadcastForm (textarea with 500-char limit, char counter, POST /admin/broadcast), PriceAlertConfigForm (accordion-based config for global settings + per-category thresholds/templates, GET/PUT /admin/price-alert-config), Pagination component, admin-specific hooks and utilities")
    }

    Container_Boundary(shared, "Shared Layer") {
        Component(layout, "Layout Components", "shared/components/layout", "Dashboard layout, sidebar, bottom nav, active link")
        Component(forms, "Form Components", "shared/components/forms", "FormInput, FormSelect, FormNumberInput, DatePicker, Textarea, TagInput")
        Component(modals, "Modal Components", "shared/components/modals", "BaseModal, BottomSheet, ConfirmationDialog, Success")
        Component(selects, "Select Components", "shared/components/select", "Select, CreatableSelect, MultiSelect, CurrencySelector")
        Component(charts, "Chart Components", "shared/components/charts", "BarChart, LineChart, DonutChart, Sparkline, TradingViewChart (embeds TradingView Advanced Chart widget for XAUUSD/XAGUSD)")
        Component(tables, "Table Components", "shared/components/table", "MobileTable, TanStackTable, VirtualizedList")
        Component(loading, "Loading Components", "shared/components/loading", "LoadingSpinner, FullPageLoading, Skeleton variants")
        Component(feedback, "Feedback Components", "shared/components/feedback", "EmptyState, ErrorState, Toast, Notification")
        Component(notifications, "Notification Components", "shared/components/notifications", "NotificationBell, NotificationPanel, NotificationItem (supports price_alert amber + admin_broadcast blue + default community green rendering), PushPermissionBanner (iOS-aware push opt-in with platform detection, install-first logic, 7-day/permanent dismissal) — shared bell+panel widget used in dashboard layout")
        Component(icons, "Icon System", "shared/components/icons", "SVG icon library: actions, finance, navigation, ui")
        Component(hooks, "Shared Hooks", "shared/hooks", "useMobile, useDebounce, useInfiniteScroll, useExchangeRate")
        Component(contexts, "React Contexts", "shared/contexts", "CurrencyContext, NotificationContext")
        Component(gold_sentiment_card, "SentimentCard", "shared/components", "Daily asset sentiment vote & comments with landing/home variants and asset prop (gold/silver); per-asset theming, bullish/bearish vote buttons, comment list, auth-gated interaction. Exported as both SentimentCard and GoldSentimentCard (backward compat).")
        Component(utils, "Shared Utilities", "shared/utils", "cn, date, number-format, z-index, error-sanitizer")
    }

    Container_Boundary(api_layer, "API Layer") {
        Component(gen_hooks, "Generated Hooks", "utils/generated/hooks.ts", "React Query hooks auto-generated from Protobuf")
        Component(gen_api, "Generated API Client", "utils/generated/api.ts", "REST API client auto-generated from Protobuf")
        Component(gen_types, "Generated Types", "gen/protobuf/v1", "TypeScript types auto-generated from Protobuf")
        Component(rq_config, "React Query Config", "lib/react-query", "Query client setup, default options, cache config")
    }

    Container_Boundary(state, "State Management") {
        Component(redux, "Redux Store", "redux/", "Auth state only: user, token, isAuthenticated")
        Component(rq_cache, "React Query Cache", "@tanstack/react-query", "Server state: wallets, transactions, investments, etc.")
    }

    Container_Boundary(i18n, "Internationalization") {
        Component(intl_mw, "next-intl Middleware", "middleware.ts", "Intercepts all requests, resolves locale from URL/cookie/Accept-Language, redirects locale-less URLs. Also redirects old finance routes (/transaction, /report, /budget) to /dashboard/finance with ?tab= param.")
        ComponentDb(intl_catalogs, "Translation Catalogs", "messages/en.json, messages/vi.json", "Static per-locale string catalogs")
    }

    Rel(dashboard, wallet_feat, "Renders wallet list")
    Rel(dashboard, txn_feat, "Renders recent transactions")
    Rel(dashboard, gen_hooks, "PNLCard: useQueryGetAggregatedPortfolioSummary(period) + useQueryGetHistoricalPortfolioValues")
    Rel(dashboard, charts, "GoldPriceChart & SilverPriceChart use TradingViewChart (TVC:GOLD, TVC:SILVER)")
    Rel(finance_page, txn_feat, "Renders transaction tab content")
    Rel(finance_page, budget_feat, "Renders budget tab content")
    Rel(finance_page, report_feat, "Renders report tab content")
    Rel(wallet_page, wallet_feat, "Renders wallet management")
    Rel(portfolio_page, invest_feat, "Renders portfolio")
    Rel(prices_page, prices_feat, "Renders price tables")
    Rel(prices_page, auth_feat, "useAuth isAdmin check for inline price editing")
    Rel(auth_pages, auth_feat, "Renders auth forms")
    Rel(settings, import_feat, "Renders import templates")
    Rel(community_page, community_feat, "Renders social feed and profiles")
    Rel(feedback_page, feedback_feat, "Renders feedback form and history")
    Rel(admin_page, admin_feat, "Uses AdminGuard, AdminUsersTab, AdminFeedbackTab, AdminBroadcastForm")
    Rel(admin_page, forms, "Uses FormInput, FormSelect, FormTextarea, FormToggle, TagInput")
    Rel(admin_feat, tables, "Uses MobileTable for user and feedback lists")
    Rel(admin_feat, modals, "Uses ConfirmationDialog for role toggle and feedback deletion")

    Rel(wallet_feat, forms, "Uses form components")
    Rel(wallet_feat, modals, "Uses modal components")
    Rel(txn_feat, forms, "Uses form components")
    Rel(txn_feat, tables, "Uses table components")
    Rel(invest_feat, charts, "Uses chart components")
    Rel(invest_feat, modals, "Uses modal components")
    Rel(import_feat, forms, "Uses form components")
    Rel(report_feat, tables, "Uses table components")
    Rel(report_feat, charts, "Uses chart components")
    Rel(community_feat, modals, "Uses BaseModal for create/edit post and SharePostModal")
    Rel(community_feat, loading, "Uses LoadingSpinner")
    Rel(community_feat, notifications, "Feeds notification data to NotificationBell/NotificationPanel, provides usePushSubscription hook for PushPermissionBanner")

    Rel(wallet_feat, gen_hooks, "useQueryListWallets, useMutationCreateWallet, etc.")
    Rel(txn_feat, gen_hooks, "useQueryListTransactions, useMutationCreateTransaction, etc.")
    Rel(invest_feat, gen_hooks, "useQueryListInvestments, useMutationCreateInvestment, etc.")
    Rel(budget_feat, gen_hooks, "useQueryListBudgets, useMutationCreateBudget, etc.")
    Rel(prices_feat, gen_hooks, "usePriceOverrideSet, usePriceOverrideDelete (admin price override mutations)")
    Rel(import_feat, gen_hooks, "useMutationUploadFile, useMutationParseFile, etc.")
    Rel(community_feat, gen_hooks, "useQueryGetFeed, useMutationCreatePost, useMutationLikePost, useMutationFollowUser; Phase 2: useMutationSharePost, useQueryGetNotifications, useQueryGetUnreadNotificationCount, useMutationMarkNotificationsRead, useMutationSavePost, useMutationUnsavePost, useQueryGetSavedPosts, useQueryGetSuggestedUsers, useQueryGetTrendingTopics, useQueryGetFollowing, useQueryGetFollowers, useQueryGetCommunityProfile, useQueryGetUserPosts, useMutationUpdateBio; Phase 3: useMutationUploadImage, useMutationUpdateComment, useQueryGetReplies, useQueryGetLikedPosts, useMutationUpdateProfile")
    Rel(feedback_feat, gen_hooks, "useMutationSubmitFeedback, useQueryListMyFeedback")
    Rel(feedback_feat, forms, "Uses FormInput, FormTextarea")
    Rel(feedback_feat, feedback, "Uses EmptyState")
    Rel(admin_feat, redux, "Reads isAdmin from auth state")
    Rel(admin_feat, gen_hooks, "useQueryGetSiteSettings, useMutationUpdateSiteSettings")

    Rel(gen_hooks, gen_api, "Wraps API calls")
    Rel(gen_api, gen_types, "Uses request/response types")
    Rel(gen_hooks, rq_cache, "Manages server state cache")
    Rel(auth_feat, redux, "Manages auth state")

    Rel(intl_mw, dashboard, "Resolves locale, provides translations")
    Rel(intl_mw, intl_catalogs, "Loads per-locale strings")
    Rel(settings, intl_mw, "Language toggle updates locale cookie")
    Rel(landing, gold_sentiment_card, "Uses SentimentCard variant=landing for gold & silver")
    Rel(dashboard, gold_sentiment_card, "Uses SentimentCard variant=home for gold & silver (home + prices pages)")
    Rel(gold_sentiment_card, gen_hooks, "useQueryGetGoldSentiment, useMutationCastGoldVote, useQueryGetGoldSentimentComments, useMutationPostGoldSentimentComment, useMutationDeleteGoldSentimentComment")
    Rel(landing, gen_hooks, "fetchSiteSettings (SSR: generateMetadata + LandingFooter)")
    Rel(landing, prices_feat, "usePublicMarketTypes hook — fetches gold/silver/currency type names (no auth)")
```

## Feature Module Structure

Each feature module follows this internal structure:

```
features/<feature>/
├── components/          # Feature-specific React components
├── forms/               # Feature-specific form components
├── hooks/               # Feature-specific custom hooks
├── utils/               # Feature-specific utilities
├── validation/          # Zod schemas for this feature
└── index.ts             # Barrel export
```

## Import Rules

```
pages      → features    ✅  (pages delegate to features)
pages      → shared      ✅  (pages use shared layout/components)
features   → shared      ✅  (features use shared components)
features   → api         ✅  (features call generated hooks)
features   → features    ❌  (no cross-feature imports)
shared     → features    ❌  (shared must not know about features)
shared     → api         ✅  (shared hooks may use generated types)
```
