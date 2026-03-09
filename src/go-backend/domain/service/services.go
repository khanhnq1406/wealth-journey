package service

import (
	"github.com/go-redis/redis/v8"

	"wealthjourney/domain/repository"
	"wealthjourney/pkg/cache"
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
}

// NewServices creates all service instances with proper dependency ordering.
// No Set* hacks — all dependencies are passed via constructors.
func NewServices(repos *Repositories, redisClient *redis.Client) *Services {
	// Phase 1: Services with no service dependencies
	categorySvc := NewCategoryService(repos.Category)
	fxRateSvc := NewFXRateService(repos.FXRate, redisClient)
	goldPriceSvc := NewGoldPriceService(redisClient)
	silverPriceSvc := NewSilverPriceService(redisClient)
	marketDataSvc := NewMarketDataService(repos.MarketData, goldPriceSvc, silverPriceSvc)
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
}

// NewRepositories creates all repository instances.
func NewRepositories(repos *Repositories) *Repositories {
	return repos
}
