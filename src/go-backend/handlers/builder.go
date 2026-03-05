package handlers

import (
	"wealthjourney/domain/auth"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/database"
	"wealthjourney/pkg/jobs"
	"wealthjourney/pkg/redis"
)

// AllHandlers contains all handler instances.
type AllHandlers struct {
	Wallet       *WalletHandlers
	User         *UserHandlers
	Auth         *AuthHandlers
	Session      *SessionHandlers
	Transaction  *TransactionHandlers
	Category     *CategoryHandlers
	Budget       *BudgetHandlers
	Investment   *InvestmentHandlers
	Gold         *GoldHandler
	Silver       *SilverHandler
	MarketPrices *MarketPricesHandler
	Import       *ImportHandler
}

// HandlerDeps holds the infrastructure dependencies needed by NewHandlers.
// This replaces the old package-level global `var deps`.
type HandlerDeps struct {
	DB      *database.Database
	RDB     *redis.RedisClient
	AuthSrv *auth.Server
}

// NewHandlers creates all handler instances with explicit dependency injection.
func NewHandlers(services *service.Services, repos *service.Repositories, deps *HandlerDeps) *AllHandlers {
	// Create FX rate service for currency conversion (for import service)
	var fxService service.FXRateService
	if deps.RDB != nil && repos.FXRate != nil {
		fxService = service.NewFXRateService(repos.FXRate, deps.RDB.GetClient())
	}

	// Create import job queue (Redis-based) with adapter
	var adaptedQueue service.ImportJobQueue
	if deps.RDB != nil {
		redisQueue := jobs.NewRedisImportQueue(deps.RDB.GetClient())
		adaptedQueue = jobs.NewImportQueueAdapter(redisQueue)
	}

	// Create market prices handler (requires Redis for price caching)
	var marketPricesHandler *MarketPricesHandler
	if deps.RDB != nil {
		marketPricesHandler = NewMarketPricesHandler(
			service.NewGoldPriceService(deps.RDB.GetClient()),
			service.NewSilverPriceService(deps.RDB.GetClient()),
		)
	}

	// Create import service with categorization and currency conversion support
	importService := service.NewImportService(
		deps.DB,
		repos.Import,
		repos.Transaction,
		repos.Wallet,
		repos.Category,
		repos.MerchantRule,
		repos.Keyword,
		repos.UserMapping,
		fxService,
		adaptedQueue,
	)

	return &AllHandlers{
		Wallet:       NewWalletHandlers(services.Wallet),
		User:         NewUserHandlers(services.User),
		Auth:         NewAuthHandlers(deps.AuthSrv),
		Session:      NewSessionHandlers(deps.AuthSrv, deps.RDB),
		Transaction:  NewTransactionHandlers(services.Transaction),
		Category:     NewCategoryHandlers(services.Category),
		Budget:       NewBudgetHandlers(services.Budget),
		Investment:   NewInvestmentHandlers(services.Investment, services.PortfolioHistory, services.MarketData),
		Gold:         NewGoldHandler(),
		Silver:       NewSilverHandler(),
		MarketPrices: marketPricesHandler,
		Import:       NewImportHandler(repos.Import, importService),
	}
}
