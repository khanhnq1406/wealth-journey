package service

import (
	"context"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/fx"
	"wealthjourney/pkg/types"
	v1 "wealthjourney/protobuf/v1"
)

// WalletService defines the interface for wallet business logic.
type WalletService interface {
	// CreateWallet creates a new wallet for a user.
	CreateWallet(ctx context.Context, userID int32, req *v1.CreateWalletRequest) (*v1.CreateWalletResponse, error)

	// GetWallet retrieves a wallet by ID, ensuring it belongs to the user.
	GetWallet(ctx context.Context, walletID int32, requestingUserID int32) (*v1.GetWalletResponse, error)

	// ListWallets retrieves all wallets for a user with pagination.
	ListWallets(ctx context.Context, userID int32, params types.PaginationParams) (*v1.ListWalletsResponse, error)

	// UpdateWallet updates a wallet's name.
	UpdateWallet(ctx context.Context, walletID int32, userID int32, req *v1.UpdateWalletRequest) (*v1.UpdateWalletResponse, error)

	// DeleteWallet deletes a wallet with options for handling related transactions.
	DeleteWallet(ctx context.Context, walletID int32, userID int32, req *v1.DeleteWalletRequest) (*v1.DeleteWalletResponse, error)

	// AddFunds adds funds to a wallet.
	AddFunds(ctx context.Context, walletID int32, userID int32, req *v1.AddFundsRequest) (*v1.AddFundsResponse, error)

	// WithdrawFunds withdraws funds from a wallet.
	WithdrawFunds(ctx context.Context, walletID int32, userID int32, req *v1.WithdrawFundsRequest) (*v1.WithdrawFundsResponse, error)

	// TransferFunds transfers funds between two wallets belonging to the same user.
	TransferFunds(ctx context.Context, userID int32, req *v1.TransferFundsRequest) (*v1.TransferFundsResponse, error)

	// AdjustBalance adjusts a wallet's balance and creates a transaction for audit trail.
	AdjustBalance(ctx context.Context, walletID int32, userID int32, req *v1.AdjustBalanceRequest) (*v1.AdjustBalanceResponse, error)

	// GetTotalBalance calculates the total balance across all user wallets.
	GetTotalBalance(ctx context.Context, userID int32) (*v1.GetTotalBalanceResponse, error)

	// GetBalanceHistory retrieves balance history for chart visualization.
	GetBalanceHistory(ctx context.Context, userID int32, req *v1.GetBalanceHistoryRequest) (*v1.GetBalanceHistoryResponse, error)

	// GetMonthlyDominance retrieves monthly balance data for all wallets.
	GetMonthlyDominance(ctx context.Context, userID int32, req *v1.GetMonthlyDominanceRequest) (*v1.GetMonthlyDominanceResponse, error)
}

// UserService defines the interface for user business logic.
type UserService interface {
	// GetUser retrieves a user by ID.
	GetUser(ctx context.Context, userID int32) (*v1.GetUserResponse, error)

	// GetUserByEmail retrieves a user by email.
	GetUserByEmail(ctx context.Context, email string) (*v1.GetUserByEmailResponse, error)

	// ListUsers retrieves all users with pagination.
	ListUsers(ctx context.Context, params types.PaginationParams) (*v1.ListUsersResponse, error)

	// CreateUser creates a new user.
	CreateUser(ctx context.Context, email, name, picture string) (*v1.CreateUserResponse, error)

	// UpdateUser updates a user's information.
	UpdateUser(ctx context.Context, userID int32, email, name, picture string) (*v1.UpdateUserResponse, error)

	// DeleteUser deletes a user.
	DeleteUser(ctx context.Context, userID int32) (*v1.DeleteUserResponse, error)

	// ExistsByEmail checks if a user exists by email.
	ExistsByEmail(ctx context.Context, email string) (bool, error)

	// UpdatePreferences updates a user's preferences (including currency preference).
	UpdatePreferences(ctx context.Context, userID int32, req *v1.UpdatePreferencesRequest) (*v1.UpdatePreferencesResponse, error)
}

// TransactionService defines the interface for transaction business logic.
type TransactionService interface {
	// CreateTransaction creates a new transaction and updates wallet balance.
	CreateTransaction(ctx context.Context, userID int32, req *v1.CreateTransactionRequest) (*v1.CreateTransactionResponse, error)

	// GetTransaction retrieves a transaction by ID, ensuring it belongs to the user's wallet.
	GetTransaction(ctx context.Context, transactionID int32, userID int32) (*v1.GetTransactionResponse, error)

	// ListTransactions retrieves transactions with filtering and pagination.
	ListTransactions(ctx context.Context, userID int32, req *v1.ListTransactionsRequest) (*v1.ListTransactionsResponse, error)

	// UpdateTransaction updates a transaction and adjusts wallet balance accordingly.
	UpdateTransaction(ctx context.Context, transactionID int32, userID int32, req *v1.UpdateTransactionRequest) (*v1.UpdateTransactionResponse, error)

	// DeleteTransaction deletes a transaction and restores the wallet balance.
	DeleteTransaction(ctx context.Context, transactionID int32, userID int32) (*v1.DeleteTransactionResponse, error)

	// GetAvailableYears retrieves distinct years from user's transactions.
	GetAvailableYears(ctx context.Context, userID int32) (*v1.GetAvailableYearsResponse, error)

	// GetFinancialReport retrieves monthly financial breakdown for wallets in a given year.
	GetFinancialReport(ctx context.Context, userID int32, req *v1.GetFinancialReportRequest) (*v1.GetFinancialReportResponse, error)

	// GetCategoryBreakdown retrieves category-wise transaction summary for a date range.
	GetCategoryBreakdown(ctx context.Context, userID int32, req *v1.GetCategoryBreakdownRequest) (*v1.GetCategoryBreakdownResponse, error)
}

// CategoryService defines the interface for category business logic.
type CategoryService interface {
	// CreateCategory creates a new category for a user.
	CreateCategory(ctx context.Context, userID int32, req *v1.CreateCategoryRequest) (*v1.CreateCategoryResponse, error)

	// GetCategory retrieves a category by ID, ensuring it belongs to the user.
	GetCategory(ctx context.Context, categoryID int32, userID int32) (*v1.GetCategoryResponse, error)

	// ListCategories retrieves categories for a user with optional type filtering.
	ListCategories(ctx context.Context, userID int32, req *v1.ListCategoriesRequest) (*v1.ListCategoriesResponse, error)

	// UpdateCategory updates a category's name.
	UpdateCategory(ctx context.Context, categoryID int32, userID int32, req *v1.UpdateCategoryRequest) (*v1.UpdateCategoryResponse, error)

	// DeleteCategory deletes a category.
	DeleteCategory(ctx context.Context, categoryID int32, userID int32) (*v1.DeleteCategoryResponse, error)

	// CreateDefaultCategories creates default categories for a new user.
	CreateDefaultCategories(ctx context.Context, userID int32) error

	// GetOrCreateBalanceAdjustmentCategory gets or creates a balance adjustment category.
	// Based on whether the adjustment is positive (income) or negative (expense).
	GetOrCreateBalanceAdjustmentCategory(ctx context.Context, userID int32, isPositiveAdjustment bool) (*models.Category, error)

	// GetOrCreateInitialBalanceCategory gets or creates an initial balance category (income type).
	GetOrCreateInitialBalanceCategory(ctx context.Context, userID int32) (*models.Category, error)
}

// BudgetService defines the interface for budget business logic.
type BudgetService interface {
	// GetBudget retrieves a budget by ID, ensuring it belongs to the user.
	GetBudget(ctx context.Context, budgetID int32, userID int32) (*v1.GetBudgetResponse, error)

	// ListBudgets retrieves all budgets for a user with pagination.
	ListBudgets(ctx context.Context, userID int32, params types.PaginationParams) (*v1.ListBudgetsResponse, error)

	// CreateBudget creates a new budget for a user.
	CreateBudget(ctx context.Context, userID int32, req *v1.CreateBudgetRequest) (*v1.CreateBudgetResponse, error)

	// UpdateBudget updates a budget's information.
	UpdateBudget(ctx context.Context, budgetID int32, userID int32, req *v1.UpdateBudgetRequest) (*v1.UpdateBudgetResponse, error)

	// DeleteBudget deletes a budget.
	DeleteBudget(ctx context.Context, budgetID int32, userID int32) (*v1.DeleteBudgetResponse, error)

	// GetBudgetItems retrieves all budget items for a budget.
	GetBudgetItems(ctx context.Context, budgetID int32, userID int32) (*v1.GetBudgetItemsResponse, error)

	// CreateBudgetItem creates a new budget item.
	CreateBudgetItem(ctx context.Context, budgetID int32, userID int32, req *v1.CreateBudgetItemRequest) (*v1.CreateBudgetItemResponse, error)

	// UpdateBudgetItem updates a budget item's information.
	UpdateBudgetItem(ctx context.Context, budgetID int32, itemID int32, userID int32, req *v1.UpdateBudgetItemRequest) (*v1.UpdateBudgetItemResponse, error)

	// DeleteBudgetItem deletes a budget item.
	DeleteBudgetItem(ctx context.Context, budgetID int32, itemID int32, userID int32) (*v1.DeleteBudgetItemResponse, error)
}

// InvestmentService defines the interface for investment business logic.
type InvestmentService interface {
	// CreateInvestment creates a new investment holding.
	CreateInvestment(ctx context.Context, userID int32, req *v1.CreateInvestmentRequest) (*v1.CreateInvestmentResponse, error)

	// GetInvestment retrieves an investment by ID, ensuring it belongs to the user.
	GetInvestment(ctx context.Context, investmentID int32, requestingUserID int32) (*v1.GetInvestmentResponse, error)

	// ListInvestments retrieves all investments for a wallet with pagination and filtering.
	ListInvestments(ctx context.Context, userID int32, req *v1.ListInvestmentsRequest) (*v1.ListInvestmentsResponse, error)

	// UpdateInvestment updates an investment's details.
	UpdateInvestment(ctx context.Context, investmentID int32, userID int32, req *v1.UpdateInvestmentRequest) (*v1.UpdateInvestmentResponse, error)

	// DeleteInvestment deletes an investment.
	DeleteInvestment(ctx context.Context, investmentID int32, userID int32) (*v1.DeleteInvestmentResponse, error)

	// AddTransaction adds a buy/sell transaction to an investment.
	AddTransaction(ctx context.Context, userID int32, req *v1.AddTransactionRequest) (*v1.AddTransactionResponse, error)

	// ListTransactions retrieves transactions for an investment.
	ListTransactions(ctx context.Context, userID int32, req *v1.ListInvestmentTransactionsRequest) (*v1.ListInvestmentTransactionsResponse, error)

	// EditTransaction edits an existing transaction.
	EditTransaction(ctx context.Context, transactionID int32, userID int32, req *v1.EditInvestmentTransactionRequest) (*v1.EditInvestmentTransactionResponse, error)

	// DeleteTransaction deletes a transaction.
	DeleteTransaction(ctx context.Context, transactionID int32, userID int32) (*v1.DeleteInvestmentTransactionResponse, error)

	// GetPortfolioSummary retrieves portfolio summary for a wallet.
	GetPortfolioSummary(ctx context.Context, walletID int32, userID int32, period v1.PnlPeriod) (*v1.GetPortfolioSummaryResponse, error)

	// UpdatePrices updates current prices for investments.
	UpdatePrices(ctx context.Context, userID int32, req *v1.UpdatePricesRequest) (*v1.UpdatePricesResponse, error)

	// SearchSymbols searches for investment symbols by query using Yahoo Finance search API.
	SearchSymbols(ctx context.Context, query string, limit int) (*v1.SearchSymbolsResponse, error)

	// ListUserInvestments retrieves investments across all wallets or filtered by wallet.
	ListUserInvestments(ctx context.Context, userID int32, req *v1.ListUserInvestmentsRequest) (*v1.ListUserInvestmentsResponse, error)

	// GetAggregatedPortfolioSummary retrieves portfolio summary aggregated across all wallets or for specific wallet.
	GetAggregatedPortfolioSummary(ctx context.Context, userID int32, req *v1.GetAggregatedPortfolioSummaryRequest) (*v1.GetPortfolioSummaryResponse, error)

	// ListInvestmentWallets retrieves all investment wallets for a user.
	ListInvestmentWallets(ctx context.Context, userID int32) ([]*models.Wallet, error)
}

// FXRateService defines the interface for foreign exchange rate business logic.
// Extends fx.Service to provide a consistent interface across the application.
type FXRateService interface {
	fx.Service
}

// CurrencyPair represents a from-to currency pair for FX rate lookups.
// Deprecated: Use fx.CurrencyPair instead.
type CurrencyPair = fx.CurrencyPair

// PortfolioHistoryService handles historical portfolio data.
type PortfolioHistoryService interface {
	// GetHistoricalValues retrieves historical portfolio values for charts.
	GetHistoricalValues(ctx context.Context, userID int32, req *v1.GetHistoricalPortfolioValuesRequest) (*v1.GetHistoricalPortfolioValuesResponse, error)

	// CreateSnapshot creates a portfolio value snapshot.
	CreateSnapshot(ctx context.Context, userID, walletID int32) error

	// CreateAggregatedSnapshot creates snapshots for all investment wallets.
	CreateAggregatedSnapshot(ctx context.Context, userID int32) error
}

// SiteSettingsService manages CMS site settings.
type SiteSettingsService interface {
	// GetAll returns all site settings (cache-first, DB fallback).
	GetAll(ctx context.Context) ([]*models.SiteSetting, error)

	// UpdateSettings bulk-updates settings. Validates keys and values. Invalidates cache.
	UpdateSettings(ctx context.Context, adminUserID int32, settings []*models.SiteSetting) ([]*models.SiteSetting, error)
}

// GoldSentimentService handles daily gold/silver sentiment voting and comments.
type GoldSentimentService interface {
	GetSentiment(ctx context.Context, userID int32, anonymousID string, category int32) (*v1.GetGoldSentimentResponse, error)
	CastVote(ctx context.Context, userID int32, anonymousID string, req *v1.CastGoldVoteRequest) (*v1.CastGoldVoteResponse, error)
	GetComments(ctx context.Context, userID int32, req *v1.GetGoldSentimentCommentsRequest) (*v1.GetGoldSentimentCommentsResponse, error)
	PostComment(ctx context.Context, userID int32, req *v1.PostGoldSentimentCommentRequest) (*v1.PostGoldSentimentCommentResponse, error)
	DeleteComment(ctx context.Context, userID int32, commentID int32) error
}

// CommunityService defines the interface for community business logic.
type CommunityService interface {
	CreatePost(ctx context.Context, userID int32, req *v1.CreatePostRequest) (*v1.CreatePostResponse, error)
	UpdatePost(ctx context.Context, userID int32, req *v1.UpdatePostRequest) (*v1.UpdatePostResponse, error)
	DeletePost(ctx context.Context, userID int32, postID int32) error
	GetPost(ctx context.Context, userID int32, postID int32) (*v1.GetPostResponse, error)
	GetFeed(ctx context.Context, userID int32, req *v1.GetFeedRequest) (*v1.GetFeedResponse, error)
	GetUserPosts(ctx context.Context, userID int32, targetUserID int32, req *v1.GetUserPostsRequest) (*v1.GetUserPostsResponse, error)
	LikePost(ctx context.Context, userID int32, postID int32) error
	UnlikePost(ctx context.Context, userID int32, postID int32) error
	CreateComment(ctx context.Context, userID int32, req *v1.CreateCommentRequest) (*v1.CreateCommentResponse, error)
	// UpdateComment edits the content of an existing comment.
	// Returns 403 if the caller does not own the comment.
	UpdateComment(ctx context.Context, userID int32, req *v1.UpdateCommentRequest) (*v1.UpdateCommentResponse, error)
	DeleteComment(ctx context.Context, userID int32, commentID int32) error
	GetComments(ctx context.Context, userID int32, postID int32, req *v1.GetCommentsRequest) (*v1.GetCommentsResponse, error)
	FollowUser(ctx context.Context, followerID int32, followingID int32) error
	UnfollowUser(ctx context.Context, followerID int32, followingID int32) error
	GetProfile(ctx context.Context, userID int32, targetUserID int32) (*v1.GetCommunityProfileResponse, error)
	ReportContent(ctx context.Context, userID int32, req *v1.ReportContentRequest) error
	// Phase 2: Social Features
	SharePost(ctx context.Context, userID int32, req *v1.SharePostRequest) (*v1.SharePostResponse, error)
	GetNotifications(ctx context.Context, userID int32, req *v1.GetNotificationsRequest) (*v1.GetNotificationsResponse, error)
	GetUnreadNotificationCount(ctx context.Context, userID int32) (*v1.GetUnreadNotificationCountResponse, error)
	MarkNotificationsRead(ctx context.Context, userID int32) error
	SavePost(ctx context.Context, userID int32, postID int32) error
	UnsavePost(ctx context.Context, userID int32, postID int32) error
	GetSavedPosts(ctx context.Context, userID int32, req *v1.GetSavedPostsRequest) (*v1.GetSavedPostsResponse, error)
	GetSuggestedUsers(ctx context.Context, userID int32) (*v1.GetSuggestedUsersResponse, error)
	GetTrendingTopics(ctx context.Context) (*v1.GetTrendingTopicsResponse, error)
	GetFollowing(ctx context.Context, userID int32, targetUserID int32, req *v1.GetFollowingRequest) (*v1.GetFollowingResponse, error)
	GetFollowers(ctx context.Context, userID int32, targetUserID int32, req *v1.GetFollowersRequest) (*v1.GetFollowersResponse, error)
	// UploadImage uploads an image to storage and returns the public URL.
	UploadImage(ctx context.Context, userID int32, fileData []byte, purpose string, filename string) (string, error)
	// Phase 3: Advanced Profile
	UpdateProfile(ctx context.Context, userID int32, req *v1.UpdateProfileRequest) (*v1.UpdateProfileResponse, error)
	GetLikedPosts(ctx context.Context, viewerUserID int32, targetUserID int32, req *v1.GetLikedPostsRequest) (*v1.GetLikedPostsResponse, error)
	// Phase 3: Reply Threads
	// GetReplies returns paginated replies for a comment.
	GetReplies(ctx context.Context, viewerUserID int32, commentID int32, req *v1.GetRepliesRequest) (*v1.GetRepliesResponse, error)
}

// FeedbackService defines the interface for user feedback business logic.
type FeedbackService interface {
	SubmitFeedback(ctx context.Context, userID int32, req *v1.SubmitFeedbackRequest) (*v1.SubmitFeedbackResponse, error)
	ListMyFeedback(ctx context.Context, userID int32, params types.PaginationParams) (*v1.ListMyFeedbackResponse, error)
}

// AdminService defines admin-only business logic.
type AdminService interface {
	ListUsers(ctx context.Context, search string, params types.PaginationParams) (*v1.AdminListUsersResponse, error)
	ToggleAdminRole(ctx context.Context, adminUserID int32, req *v1.AdminToggleRoleRequest) (*v1.AdminToggleRoleResponse, error)
	ListFeedback(ctx context.Context, statusFilter int32, params types.PaginationParams) (*v1.AdminListFeedbackResponse, error)
	UpdateFeedback(ctx context.Context, feedbackID int32, req *v1.AdminUpdateFeedbackRequest) (*v1.AdminUpdateFeedbackResponse, error)
	DeleteFeedback(ctx context.Context, feedbackID int32) (*v1.AdminDeleteFeedbackResponse, error)
	Broadcast(ctx context.Context, adminUserID int32, title, message string) (int32, error)
}

// PushService handles Web Push notification delivery.
type PushService interface {
	SendToUser(ctx context.Context, userID int32, title, body, url string) error
	SendToAll(ctx context.Context, title, body, url string) error
	GetVAPIDPublicKey() string
}

// PriceAlertService detects significant price fluctuations and sends alerts.
type PriceAlertService interface {
	CheckAndAlert(ctx context.Context) error
	ForceCheckAndAlert(ctx context.Context) error
}

// UserPriceAlertService handles user price alert CRUD and evaluation.
type UserPriceAlertService interface {
	CreateAlert(ctx context.Context, userID int32, req *v1.CreateUserPriceAlertRequest) (*v1.CreateUserPriceAlertResponse, error)
	ListAlerts(ctx context.Context, userID int32, req *v1.ListUserPriceAlertsRequest) (*v1.ListUserPriceAlertsResponse, error)
	UpdateAlert(ctx context.Context, alertID int32, userID int32, req *v1.UpdateUserPriceAlertRequest) (*v1.UpdateUserPriceAlertResponse, error)
	DeleteAlert(ctx context.Context, alertID int32, userID int32) (*v1.DeleteUserPriceAlertResponse, error)
	EvaluateAlerts(ctx context.Context) error
}

// WatchlistService defines the interface for watchlist business logic.
type WatchlistService interface {
	CreateItem(ctx context.Context, userID int32, req *v1.CreateWatchlistItemRequest) (*v1.CreateWatchlistItemResponse, error)
	ListItems(ctx context.Context, userID int32) (*v1.ListWatchlistResponse, error)
	UpdateItem(ctx context.Context, itemID int32, userID int32, req *v1.UpdateWatchlistItemRequest) (*v1.UpdateWatchlistItemResponse, error)
	DeleteItem(ctx context.Context, itemID int32, userID int32) (*v1.DeleteWatchlistItemResponse, error)
	ReorderItems(ctx context.Context, userID int32, req *v1.ReorderWatchlistRequest) (*v1.ReorderWatchlistResponse, error)
	CheckItem(ctx context.Context, userID int32, symbol string) (*v1.CheckWatchlistItemResponse, error)
}

// AssetPriceService manages the DB-backed price cache for gold, silver, and currency.
// It is the single point of truth for the price cache job and for handlers that
// serve prices from the database instead of live APIs.
type AssetPriceService interface {
	// RefreshAllPrices fetches fresh prices from gold/silver/currency price services
	// and persists them in the asset_price table. Each asset type is fetched
	// independently so a single-source failure does not abort the others.
	// On failure for a type, that type's rows are marked stale.
	RefreshAllPrices(ctx context.Context) error

	// GetAllPrices reads all rows from the DB and groups them by asset type.
	GetAllPrices(ctx context.Context) (*AllAssetPrices, error)

	// GetPricesByAssetType reads DB rows for a single asset type ("gold", "silver", "currency").
	GetPricesByAssetType(ctx context.Context, assetType string) ([]*AssetPriceDTO, error)

	// GetMarketTypes reads all DB rows and returns the list of type codes per
	// asset type together with the latest FetchedAt timestamp per group.
	GetMarketTypes(ctx context.Context) (*MarketTypesDTO, error)

	// GetPriceByTypeCode looks up a single cached price row by typeCode.
	// Returns nil, nil when not found (cold-start: price not yet in DB).
	GetPriceByTypeCode(ctx context.Context, typeCode string) (*AssetPriceDTO, error)
}

// AssetDisplayConfigService manages the admin-configurable asset display config table.
// It supersedes GoldDisplayConfigService and adds support for multiple asset types
// (gold, silver, etc.) as well as fetch-code-based price resolution.
type AssetDisplayConfigService interface {
	// GetDisplayPrices returns enabled configs for assetType joined with latest prices via fetch codes.
	GetDisplayPrices(ctx context.Context, assetType string) ([]*AssetDisplayPriceDTO, error)
	// ListAll returns all configs (including disabled) for admin.
	ListAll(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error)
	// Create adds a new asset display config entry.
	Create(ctx context.Context, typeCode, displayName, assetType string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error)
	// Update modifies an existing config entry.
	Update(ctx context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error)
	// Delete soft-deletes a config entry.
	Delete(ctx context.Context, id int32) error

	// ResolvePrice resolves the best available buy and sell prices for a typeCode + assetType pair
	// by iterating fetch codes in priority order. Returns isStale=true if all sources
	// are stale. Returns an error if no fetch codes or no asset_price rows are found.
	ResolvePrice(ctx context.Context, typeCode, assetType string) (buy int64, sell int64, isStale bool, err error)

	// ListFetchCodes retrieves all active fetch codes for a config ordered by priority ASC.
	ListFetchCodes(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error)
	// CreateFetchCode adds a fetch code to a config. Validates type_code, priority, max 10 cap,
	// and type_code existence in asset_price table.
	CreateFetchCode(ctx context.Context, configID int32, typeCode string, priority int32) (*models.AssetConfigFetchCode, error)
	// UpdateFetchCode updates the priority of an existing fetch code.
	UpdateFetchCode(ctx context.Context, id int32, priority int32) (*models.AssetConfigFetchCode, error)
	// DeleteFetchCode soft-deletes a fetch code by id.
	DeleteFetchCode(ctx context.Context, id int32) error
	// ListAvailableTypeCodes returns all distinct type_codes in the asset_price table
	// that are relevant for the given assetType.
	ListAvailableTypeCodes(ctx context.Context, assetType string) ([]string, error)

	// GetFetchCodesByAssetType returns a map from fetch code (asset_price.type_code) to the
	// AssetDisplayConfig that owns it, for all enabled configs of the given assetType.
	// Configs with no fetch codes are excluded.
	// Returns empty map (not error) if no configs are found (cold-start / unconfigured).
	GetFetchCodesByAssetType(ctx context.Context, assetType string) (map[string]*models.AssetDisplayConfig, error)

	// ListForInvestment returns enabled configs where show_in_investment = true for the given assetType,
	// ordered by display_order ASC. Used by gold/silver investment handlers to populate type options.
	ListForInvestment(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error)
}

// AssetDisplayPriceDTO is the combined config + price data returned by the public endpoint.
type AssetDisplayPriceDTO struct {
	TypeCode         string
	AssetType        string
	DisplayName      string
	DisplayOrder     int32
	Enabled          bool
	ShowInInvestment bool
	Buy              int64
	Sell             int64
	IsStale          bool
}

// GoldDisplayConfigService manages the admin-configurable gold display config table.
type GoldDisplayConfigService interface {
	// GetDisplayPrices returns enabled gold configs joined with latest prices and admin overrides.
	GetDisplayPrices(ctx context.Context) ([]*GoldDisplayPriceDTO, error)
	// ListAll returns all configs (including disabled) for admin.
	ListAll(ctx context.Context) ([]*models.GoldDisplayConfig, error)
	// Create adds a new gold display config entry.
	Create(ctx context.Context, typeCode, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.GoldDisplayConfig, error)
	// Update modifies an existing config entry.
	Update(ctx context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.GoldDisplayConfig, error)
	// Delete soft-deletes a config entry.
	Delete(ctx context.Context, id int32) error
}

// GoldDisplayPriceDTO is the combined config + price data returned by the public endpoint.
type GoldDisplayPriceDTO struct {
	TypeCode         string
	DisplayName      string
	Buy              int64
	Sell             int64
	ChangeBuy        int64
	ChangeSell       int64
	Currency         string
	UpdatedAt        int64
	IsStale          bool
	ShowInInvestment bool
	DisplayOrder     int32
}

// AllAssetPrices groups DB-backed prices by asset class.
type AllAssetPrices struct {
	Gold     []*AssetPriceDTO
	Silver   []*AssetPriceDTO
	Currency []*AssetPriceDTO
}

// AssetPriceDTO is the service-layer view of a single asset price row.
type AssetPriceDTO struct {
	TypeCode   string
	Name       string
	Buy        int64
	Sell       int64
	ChangeBuy  int64
	ChangeSell int64
	Currency   string
	IsStale    bool
	FetchedAt  time.Time
}

// MarketTypeItem is a lightweight descriptor for a single tradable type.
type MarketTypeItem struct {
	Code     string
	Name     string
	Currency string
}

// MarketTypesDTO contains the full set of market types per asset class together
// with the freshness timestamps (Unix seconds) for each group.
type MarketTypesDTO struct {
	Gold              []MarketTypeItem
	Silver            []MarketTypeItem
	Currency          []MarketTypeItem
	GoldUpdatedAt     int64
	SilverUpdatedAt   int64
	CurrencyUpdatedAt int64
}
