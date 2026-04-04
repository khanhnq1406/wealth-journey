package service

import (
	"log"
	"os"

	"github.com/go-redis/redis/v8"

	"wealthjourney/domain/repository"
	"wealthjourney/pkg/btmcdirect"
	"wealthjourney/pkg/cache"
	"wealthjourney/pkg/doji"
	"wealthjourney/pkg/mihong"
	"wealthjourney/pkg/pnj"
	pkgredis "wealthjourney/pkg/redis"
	"wealthjourney/pkg/sjc"
	"wealthjourney/pkg/storage"
	"wealthjourney/pkg/vietcombank"
)

// Services holds all service instances.
type Services struct {
	Wallet             WalletService
	User               UserService
	Transaction        TransactionService
	Category           CategoryService
	Budget             BudgetService
	Investment         InvestmentService
	FXRate             FXRateService
	PortfolioHistory   PortfolioHistoryService
	MarketData         MarketDataService
	Import             ImportService
	Community          CommunityService
	GoldSentiment      GoldSentimentService
	Feedback           FeedbackService
	SiteSettings       SiteSettingsService
	Admin              AdminService
	Push               PushService
	PriceAlert         PriceAlertService
	Watchlist          WatchlistService
	UserPriceAlert     UserPriceAlertService
	AssetPrice         AssetPriceService
	AssetDisplayConfig AssetDisplayConfigService
}

// NewServices creates all service instances with proper dependency ordering.
// No Set* hacks — all dependencies are passed via constructors.
func NewServices(repos *Repositories, redisClient *redis.Client, storageProvider storage.StorageProvider, communityStorage storage.StorageProvider, rdb *pkgredis.RedisClient) *Services {
	// Phase 1: Services with no service dependencies
	categorySvc := NewCategoryService(repos.Category)
	fxRateSvc := NewFXRateService(repos.FXRate, redisClient)
	btmcAPIKey := os.Getenv("BTMC_API_KEY")
	if btmcAPIKey == "" {
		log.Println("[NewServices] Warning: BTMC_API_KEY not set — gold price fallback chain reduced to 2 sources")
	}
	goldPriceSvc := NewGoldPriceService(redisClient, btmcAPIKey)
	silverPriceSvc := NewSilverPriceService(redisClient)
	// AssetDisplayConfigService — wires fetch-code-based price resolution.
	// Provides the AssetDisplayConfigService to MarketDataService for DB-backed gold/silver prices.
	assetDisplayConfigSvc := NewAssetDisplayConfigService(repos.AssetDisplayConfig, repos.AssetConfigFetchCode, repos.AssetPrice, repos.Investment)
	marketDataSvc := NewMarketDataService(repos.MarketData, goldPriceSvc, silverPriceSvc, assetDisplayConfigSvc)
	currencyCache := cache.NewCurrencyCache(redisClient)

	// Phase 2: UserService (depends on categorySvc, fxRateSvc, currencyCache)
	userSvc := NewUserService(
		repos.User, categorySvc,
		repos.Wallet, repos.Transaction, repos.Budget, repos.BudgetItem, repos.Investment,
		fxRateSvc, currencyCache, redisClient,
	)

	// Phase 3: Services that depend on earlier services
	walletSvc := NewWalletService(repos.Wallet, repos.User, repos.Transaction, repos.Category, categorySvc, fxRateSvc, currencyCache, repos.Investment, redisClient)
	investmentSvc := NewInvestmentService(repos.Investment, repos.Wallet, repos.InvestmentTransaction, marketDataSvc, repos.User, fxRateSvc, currencyCache, walletSvc, repos.PortfolioHistory)
	portfolioHistorySvc := NewPortfolioHistoryService(repos.PortfolioHistory, investmentSvc, repos.User, fxRateSvc)

	// Phase 1 (cont.): GoldSentimentService — depends on vote/comment repos and Redis
	goldSentimentSvc := NewGoldSentimentService(repos.GoldVote, repos.GoldVoteComment, repos.User, redisClient)

	// Phase 1 (cont.): SiteSettingsService — depends on repo and Redis cache
	var siteSettingsSvc SiteSettingsService
	if redisClient != nil {
		siteSettingsCache := cache.NewSiteSettingsCache(redisClient)
		siteSettingsSvc = NewSiteSettingsService(repos.SiteSettings, siteSettingsCache)
	} else {
		siteSettingsSvc = NewSiteSettingsService(repos.SiteSettings, nil)
	}

	// Phase 1 (cont.): PushService — depends on push subscription repo
	pushSvc := NewPushService(repos.PushSubscription)

	// Phase 1 (cont.): AssetPriceService — depends on asset price repo and price services.
	// Real per-source gold clients wired here for direct (non-waterfall) DB cache rows.
	sjcClient := sjc.NewClient()
	dojiClient := doji.NewClient()
	btmcClient := btmcdirect.NewClient()
	pnjClient := pnj.NewClient()
	mihongClient := mihong.NewClient(waterfallSourceTimeout)

	// Feature flag: VIETCOMBANK_FX_ENABLED (default true).
	// Set to "false" to disable Vietcombank currency fetching entirely.
	var vcbFetcher CurrencyPriceFetcher
	if os.Getenv("VIETCOMBANK_FX_ENABLED") != "false" {
		vcbFetcher = NewVietcombankCurrencyFetcher(vietcombank.NewClient())
	} else {
		log.Println("[NewServices] VIETCOMBANK_FX_ENABLED=false — Vietcombank currency fetcher disabled")
	}

	assetPriceSvc := NewAssetPriceService(
		repos.AssetPrice,
		repos.AssetDisplayConfig,
		silverPriceSvc,
		NewVangSaiGonGoldFetcher(waterfallSourceTimeout),
		NewVangTodayGoldFetcher(waterfallSourceTimeout),
		NewVangSaiGonCurrencyFetcher(waterfallSourceTimeout),
		nil, // VangToday no longer provides currency data as of 2026-04
		vcbFetcher,
		sjcClient,
		dojiClient,
		btmcClient,
		pnjClient,
		mihongClient,
	)

	// Phase 1 (cont.): PriceAlertService — reads from DB cache via AssetPriceService
	var priceAlertSvc PriceAlertService
	if rdb != nil {
		priceAlertSvc = NewPriceAlertService(assetPriceSvc, repos.Notification, repos.User, rdb, pushSvc, assetDisplayConfigSvc)
	}

	// Phase 1 (cont.): WatchlistService — reads from DB cache via AssetPriceService
	watchlistSvc := NewWatchlistService(repos.Watchlist, assetPriceSvc, marketDataSvc)

	// Phase 1 (cont.): UserPriceAlertService — depends on alert repo, asset price DB cache, market data, notification repo, push service, Redis
	var userPriceAlertSvc UserPriceAlertService
	if rdb != nil {
		userPriceAlertSvc = NewUserPriceAlertService(
			repos.UserPriceAlert,
			assetPriceSvc,
			marketDataSvc,
			repos.Notification,
			pushSvc,
			rdb,
		)
	}

	// Phase 1 (cont.): CommunityService — depends on storage provider for image uploads
	communitySvc := NewCommunityService(repos.Post, repos.Comment, repos.Like, repos.Follow, repos.Report, repos.User, repos.Notification, repos.SavedPost, repos.Hashtag, communityStorage, rdb)

	return &Services{
		Wallet:           walletSvc,
		User:             userSvc,
		Transaction:      NewTransactionService(repos.Transaction, repos.Wallet, repos.Category, repos.User, fxRateSvc, currencyCache),
		Category:         categorySvc,
		Budget:           NewBudgetService(repos.Budget, repos.BudgetItem, repos.User, fxRateSvc, currencyCache),
		Investment:       investmentSvc,
		FXRate:           fxRateSvc,
		PortfolioHistory: portfolioHistorySvc,
		MarketData:       marketDataSvc,
		Import:           nil, // Created separately with job queue
		Community:        communitySvc,
		GoldSentiment:    goldSentimentSvc,
		Feedback:         NewFeedbackService(repos.Feedback),
		SiteSettings:     siteSettingsSvc,
		Admin:            NewAdminService(repos.User, repos.Feedback, repos.Notification, rdb, pushSvc),
		Push:             pushSvc,
		PriceAlert:       priceAlertSvc,
		Watchlist:        watchlistSvc,
		UserPriceAlert:    userPriceAlertSvc,
		AssetPrice:         assetPriceSvc,
		AssetDisplayConfig: assetDisplayConfigSvc,
	}
}

// Repositories holds all repository instances.
type Repositories struct {
	Wallet                repository.WalletRepository
	User                  repository.UserRepository
	Transaction           repository.TransactionRepository
	Category              repository.CategoryRepository
	Budget                repository.BudgetRepository
	BudgetItem            repository.BudgetItemRepository
	Investment            repository.InvestmentRepository
	InvestmentTransaction repository.InvestmentTransactionRepository
	MarketData            repository.MarketDataRepository
	FXRate                repository.FXRateRepository
	ExchangeRate          repository.ExchangeRateRepository
	PortfolioHistory      repository.PortfolioHistoryRepository
	Import                repository.ImportRepository
	MerchantRule          repository.MerchantRuleRepository
	Keyword               repository.KeywordRepository
	UserMapping           repository.UserMappingRepository
	Post                  repository.PostRepository
	Comment               repository.CommentRepository
	Like                  repository.LikeRepository
	Follow                repository.FollowRepository
	Report                repository.ReportRepository
	Notification          repository.NotificationRepository
	SavedPost             repository.SavedPostRepository
	Hashtag               repository.HashtagRepository
	GoldVote              repository.GoldVoteRepository
	GoldVoteComment       repository.GoldVoteCommentRepository
	Feedback              repository.FeedbackRepository
	SiteSettings          repository.SiteSettingsRepository
	PushSubscription      repository.PushSubscriptionRepository
	Watchlist             repository.WatchlistRepository
	UserPriceAlert        repository.UserPriceAlertRepository
	AssetPrice            repository.AssetPriceRepository
	GoldDisplayConfig     repository.GoldDisplayConfigRepository
	AssetDisplayConfig    repository.AssetDisplayConfigRepository
	AssetConfigFetchCode  repository.AssetConfigFetchCodeRepository
}

// NewRepositories creates all repository instances.
func NewRepositories(repos *Repositories) *Repositories {
	return repos
}
