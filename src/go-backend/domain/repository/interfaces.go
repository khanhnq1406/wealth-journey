package repository

import (
	"context"
	"time"
	v1 "wealthjourney/protobuf/v1"
	"wealthjourney/domain/models"
)

// ListOptions represents common list query options.
type ListOptions struct {
	Limit   int
	Offset  int
	OrderBy string
	Order   string // "asc" or "desc"
}

// UserRepository defines the interface for user data operations.
type UserRepository interface {
	// Create creates a new user.
	Create(ctx context.Context, user *models.User) error

	// GetByID retrieves a user by ID.
	GetByID(ctx context.Context, id int32) (*models.User, error)

	// GetByEmail retrieves a user by email.
	GetByEmail(ctx context.Context, email string) (*models.User, error)

	// List retrieves users with pagination.
	List(ctx context.Context, opts ListOptions) ([]*models.User, int, error)

	// Update updates a user.
	Update(ctx context.Context, user *models.User) error

	// Delete soft deletes a user by ID.
	Delete(ctx context.Context, id int32) error

	// Exists checks if a user exists by email.
	ExistsByEmail(ctx context.Context, email string) (bool, error)

	// GetByUsername retrieves a user by username.
	GetByUsername(ctx context.Context, username string) (*models.User, error)

	// ListWithSearch retrieves users with optional search filter on name/email/username.
	ListWithSearch(ctx context.Context, search string, opts ListOptions) ([]*models.User, int, error)

	// GetAllUserIDs returns all user IDs.
	GetAllUserIDs(ctx context.Context) ([]int32, error)
}

// WalletRepository defines the interface for wallet data operations.
type WalletRepository interface {
	// Create creates a new wallet.
	Create(ctx context.Context, wallet *models.Wallet) error

	// GetByID retrieves a wallet by ID.
	GetByID(ctx context.Context, id int32) (*models.Wallet, error)

	// GetByIDForUser retrieves a wallet by ID, ensuring it belongs to the user.
	GetByIDForUser(ctx context.Context, walletID, userID int32) (*models.Wallet, error)

	// ListByUserID retrieves all wallets for a user.
	ListByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Wallet, int, error)

	// Update updates a wallet.
	Update(ctx context.Context, wallet *models.Wallet) error

	// UpdateBalance updates the balance of a wallet.
	// Use positive delta to add, negative to subtract.
	UpdateBalance(ctx context.Context, walletID int32, delta int64) (*models.Wallet, error)

	// UpdateBalanceWithTx updates wallet balance within a database transaction.
	UpdateBalanceWithTx(ctx context.Context, dbTx interface{}, walletID int32, delta int64) (*models.Wallet, error)

	// Delete soft deletes a wallet by ID.
	Delete(ctx context.Context, id int32) error

	// Exists checks if a wallet exists by ID and belongs to the user.
	ExistsForUser(ctx context.Context, walletID, userID int32) (bool, error)

	// CountByUserID returns the number of wallets for a user.
	CountByUserID(ctx context.Context, userID int32) (int, error)

	// GetTotalBalance calculates the sum of all wallet balances for a user.
	GetTotalBalance(ctx context.Context, userID int32) (int64, error)

	// WithTx returns a repository instance that uses the given transaction.
	WithTx(tx interface{}) WalletRepository
}

// TransactionManager defines the interface for managing database transactions.
type TransactionManager interface {
	// WithTx executes a function within a transaction.
	// If the function returns an error, the transaction is rolled back.
	// Otherwise, it is committed.
	WithTx(ctx context.Context, fn func(tm TransactionManager) error) error
}

// TransactionFilter defines filter options for listing transactions.
type TransactionFilter struct {
	WalletID   *int32
	WalletIDs  []int32 // Support multiple wallet IDs
	CategoryID *int32
	Type       *v1.TransactionType
	StartDate  *time.Time
	EndDate    *time.Time
	MinAmount  *int64
	MaxAmount  *int64
	SearchNote *string
}

// TransactionRepository defines the interface for transaction data operations.
type TransactionRepository interface {
	// Create creates a new transaction.
	Create(ctx context.Context, tx *models.Transaction) error

	// GetByID retrieves a transaction by ID.
	GetByID(ctx context.Context, id int32) (*models.Transaction, error)

	// GetByIDForUser retrieves a transaction by ID, ensuring it belongs to the user's wallet.
	GetByIDForUser(ctx context.Context, txID, userID int32) (*models.Transaction, error)

	// Update updates a transaction.
	Update(ctx context.Context, tx *models.Transaction) error

	// Delete soft deletes a transaction by ID.
	Delete(ctx context.Context, id int32) error

	// DeleteWithTx deletes a transaction within a database transaction.
	DeleteWithTx(ctx context.Context, dbTx interface{}, id int32) error

	// List retrieves transactions with filtering and pagination.
	List(ctx context.Context, userID int32, filter TransactionFilter, opts ListOptions) ([]*models.Transaction, int, error)

	// GetWithWallet retrieves a transaction with its wallet relationship.
	GetWithWallet(ctx context.Context, id int32) (*models.Transaction, error)

	// GetAvailableYears retrieves distinct years from user's transactions.
	GetAvailableYears(ctx context.Context, userID int32) ([]int32, error)

	// CountByWalletID returns the number of transactions for a wallet.
	CountByWalletID(ctx context.Context, walletID int32) (int32, error)

	// GetSumAmounts returns the sum of all transaction amounts for a wallet (signed).
	// Positive values indicate income, negative values indicate expense.
	GetSumAmounts(ctx context.Context, walletID int32) (int64, error)

	// TransferToWallet transfers all transactions from one wallet to another.
	TransferToWallet(ctx context.Context, fromWalletID, toWalletID int32) error

	// GetCategoryBreakdown retrieves category-wise transaction summary grouped by currency.
	GetCategoryBreakdown(ctx context.Context, userID int32, filter TransactionFilter) ([]*CategoryBreakdownByCurrency, error)

	// BulkCreate creates multiple transactions atomically with wallet balance updates.
	BulkCreate(ctx context.Context, transactions []*models.Transaction) ([]int32, error)

	// FindByWalletAndDateRange retrieves transactions for a wallet within a date range.
	// This method benefits from the composite index (wallet_id, date, amount).
	FindByWalletAndDateRange(ctx context.Context, walletID int32, startDate, endDate time.Time) ([]*models.Transaction, error)

	// FindByExternalID retrieves a transaction by its external reference ID.
	// This method benefits from the composite index (wallet_id, external_id).
	FindByExternalID(ctx context.Context, walletID int32, externalID string) (*models.Transaction, error)
}

// CategoryBreakdownItem represents category-wise transaction summary
type CategoryBreakdownItem struct {
	CategoryID       int32
	CategoryName     string
	Type             int32
	TotalAmount      int64
	TransactionCount int32
	Currency         string // Currency of the total amount
}

// CategoryBreakdownByCurrency represents category-wise transaction summary grouped by currency
type CategoryBreakdownByCurrency struct {
	CategoryID        int32
	CategoryName      string
	Type              int32
	AmountsByCurrency map[string]int64 // Map of currency code to amount
	TransactionCount  int32
}

// CategoryRepository defines the interface for category data operations.
type CategoryRepository interface {
	// Create creates a new category.
	Create(ctx context.Context, category *models.Category) error

	// GetByID retrieves a category by ID.
	GetByID(ctx context.Context, id int32) (*models.Category, error)

	// GetByIDForUser retrieves a category by ID, ensuring it belongs to the user.
	GetByIDForUser(ctx context.Context, categoryID, userID int32) (*models.Category, error)

	// GetByIDs retrieves multiple categories by their IDs in a single query.
	GetByIDs(ctx context.Context, ids []int32) (map[int32]*models.Category, error)

	// GetByNameAndType retrieves a category by name and type for a user.
	// Returns the category if found, or creates it if it doesn't exist.
	GetByNameAndType(ctx context.Context, userID int32, name string, categoryType v1.CategoryType) (*models.Category, error)

	// Update updates a category.
	Update(ctx context.Context, category *models.Category) error

	// Delete soft deletes a category by ID.
	Delete(ctx context.Context, id int32) error

	// ListByUserID retrieves all categories for a user with optional type filtering.
	ListByUserID(ctx context.Context, userID int32, categoryType *v1.CategoryType, opts ListOptions) ([]*models.Category, int, error)

	// ExistsForUser checks if a category exists by ID and belongs to the user.
	ExistsForUser(ctx context.Context, categoryID, userID int32) (bool, error)

	// CountByUserID returns the number of categories for a user.
	CountByUserID(ctx context.Context, userID int32) (int, error)

	// CreateDefaultCategories creates default categories for a new user.
	CreateDefaultCategories(ctx context.Context, userID int32) error
}

// BudgetRepository defines the interface for budget data operations.
type BudgetRepository interface {
	// Create creates a new budget.
	Create(ctx context.Context, budget *models.Budget) error

	// GetByID retrieves a budget by ID.
	GetByID(ctx context.Context, id int32) (*models.Budget, error)

	// GetByIDForUser retrieves a budget by ID, ensuring it belongs to the user.
	GetByIDForUser(ctx context.Context, budgetID, userID int32) (*models.Budget, error)

	// ListByUserID retrieves all budgets for a user.
	ListByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Budget, int, error)

	// Update updates a budget.
	Update(ctx context.Context, budget *models.Budget) error

	// Delete soft deletes a budget by ID.
	Delete(ctx context.Context, id int32) error

	// ExistsForUser checks if a budget exists by ID and belongs to the user.
	ExistsForUser(ctx context.Context, budgetID, userID int32) (bool, error)

	// CountByUserID returns the number of budgets for a user.
	CountByUserID(ctx context.Context, userID int32) (int, error)
}

// BudgetItemRepository defines the interface for budget item data operations.
type BudgetItemRepository interface {
	// Create creates a new budget item.
	Create(ctx context.Context, item *models.BudgetItem) error

	// GetByID retrieves a budget item by ID.
	GetByID(ctx context.Context, id int32) (*models.BudgetItem, error)

	// GetByIDForBudget retrieves a budget item by ID, ensuring it belongs to the budget.
	GetByIDForBudget(ctx context.Context, itemID, budgetID int32) (*models.BudgetItem, error)

	// ListByBudgetID retrieves all budget items for a budget.
	ListByBudgetID(ctx context.Context, budgetID int32) ([]*models.BudgetItem, error)

	// Update updates a budget item.
	Update(ctx context.Context, item *models.BudgetItem) error

	// Delete soft deletes a budget item by ID.
	Delete(ctx context.Context, id int32) error

	// DeleteByBudgetID deletes all budget items for a budget.
	DeleteByBudgetID(ctx context.Context, budgetID int32) error

	// CountByBudgetID returns the number of budget items for a budget.
	CountByBudgetID(ctx context.Context, budgetID int32) (int, error)
}

// MarketDataRepository defines the interface for market data operations.
type MarketDataRepository interface {
	// GetBySymbolAndCurrency retrieves the latest market data for a symbol.
	GetBySymbolAndCurrency(ctx context.Context, symbol, currency string) (*models.MarketData, error)

	// Create creates a new market data entry.
	Create(ctx context.Context, data *models.MarketData) error

	// Update updates an existing market data entry.
	Update(ctx context.Context, data *models.MarketData) error

	// Delete soft deletes a market data entry by ID.
	Delete(ctx context.Context, id int32) error

	// List retrieves market data with pagination.
	List(ctx context.Context, opts ListOptions) ([]*models.MarketData, int, error)
}

// FXRateRepository defines the interface for foreign exchange rate operations.
type FXRateRepository interface {
	// GetByPair retrieves the latest FX rate for a currency pair.
	GetByPair(ctx context.Context, fromCurrency, toCurrency string) (*models.FXRate, error)

	// Create creates a new FX rate entry.
	Create(ctx context.Context, rate *models.FXRate) error

	// Update updates an existing FX rate entry.
	Update(ctx context.Context, rate *models.FXRate) error

	// Delete soft deletes an FX rate entry by ID.
	Delete(ctx context.Context, id int32) error

	// List retrieves FX rates with pagination.
	List(ctx context.Context, opts ListOptions) ([]*models.FXRate, int, error)

	// GetLatestRates retrieves the latest rates for a given from currency.
	GetLatestRates(ctx context.Context, fromCurrency string) ([]*models.FXRate, error)
}

// PostRepository defines the interface for community post data operations.
type PostRepository interface {
	Create(ctx context.Context, post *models.Post) error
	GetByID(ctx context.Context, id int32) (*models.Post, error)
	GetByIDs(ctx context.Context, ids []int32) ([]*models.Post, error)
	Update(ctx context.Context, post *models.Post) error
	SoftDelete(ctx context.Context, id int32) error
	GetFeed(ctx context.Context, userIDs []int32, opts ListOptions, hashtag string) ([]*models.Post, int, error)
	GetByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Post, int, error)
	IncrementLikeCount(ctx context.Context, postID int32, delta int32) error
	IncrementCommentCount(ctx context.Context, postID int32, delta int32) error
	IncrementShareCount(ctx context.Context, postID int32, delta int32) error
	CountByUserID(ctx context.Context, userID int32) (int32, error)
}

// CommentRepository defines the interface for community comment data operations.
type CommentRepository interface {
	Create(ctx context.Context, comment *models.Comment) error
	GetByID(ctx context.Context, id int32) (*models.Comment, error)
	// Update updates a comment (content and metadata).
	Update(ctx context.Context, comment *models.Comment) error
	SoftDelete(ctx context.Context, id int32) error
	GetByPostID(ctx context.Context, postID int32, opts ListOptions) ([]*models.Comment, int, error)
	// GetByParentID returns replies for a parent comment (paginated).
	GetByParentID(ctx context.Context, parentID int32, opts ListOptions) ([]*models.Comment, int, error)
	// IncrementReplyCount atomically increments (positive) or decrements (negative) the reply_count.
	IncrementReplyCount(ctx context.Context, commentID int32, delta int32) error
}

// LikeRepository defines the interface for post like data operations.
type LikeRepository interface {
	Create(ctx context.Context, like *models.PostLike) error
	Delete(ctx context.Context, userID, postID int32) error
	Exists(ctx context.Context, userID, postID int32) (bool, error)
	GetLikedPostIDs(ctx context.Context, userID int32, postIDs []int32) ([]int32, error)
	// GetLikedPostsByUser returns IDs of posts liked by a user (paginated, ordered by creation time DESC).
	GetLikedPostsByUser(ctx context.Context, userID int32, opts ListOptions) ([]int32, int, error)
}

// FollowRepository defines the interface for user follow data operations.
type FollowRepository interface {
	Create(ctx context.Context, follow *models.UserFollow) error
	Delete(ctx context.Context, followerID, followingID int32) error
	Exists(ctx context.Context, followerID, followingID int32) (bool, error)
	GetFollowingIDs(ctx context.Context, userID int32) ([]int32, error)
	// GetFollowedAuthorIDs returns the subset of authorIDs that followerID is following.
	GetFollowedAuthorIDs(ctx context.Context, followerID int32, authorIDs []int32) ([]int32, error)
	GetFollowerCount(ctx context.Context, userID int32) (int32, error)
	GetFollowingCount(ctx context.Context, userID int32) (int32, error)
	// GetFriendsOfFriends returns users followed by people I follow, ordered by mutual count.
	GetFriendsOfFriends(ctx context.Context, userID int32, excludeIDs []int32, limit int) ([]FriendOfFriend, error)
	// GetTopUsersByFollowers returns users with most followers excluding specified IDs.
	GetTopUsersByFollowers(ctx context.Context, excludeIDs []int32, limit int) ([]UserFollowerCount, error)
	// GetRecentUsers returns recently-registered users excluding specified IDs.
	// Used as a cold-start fallback when there is no social graph data yet.
	GetRecentUsers(ctx context.Context, excludeIDs []int32, limit int) ([]int32, error)
	// GetFollowing returns paginated list of users that userID follows, with preloaded User data.
	GetFollowing(ctx context.Context, userID int32, opts ListOptions) ([]*models.UserFollow, int, error)
	// GetFollowers returns paginated list of users who follow userID, with preloaded User data.
	GetFollowers(ctx context.Context, userID int32, opts ListOptions) ([]*models.UserFollow, int, error)
}

// ReportRepository defines the interface for content report data operations.
type ReportRepository interface {
	Create(ctx context.Context, report *models.ContentReport) error
	ExistsByUser(ctx context.Context, userID int32, targetType string, targetID int32) (bool, error)
}

// NotificationRepository defines the interface for notification data operations.
type NotificationRepository interface {
	Create(ctx context.Context, notification *models.Notification) error
	BatchCreate(ctx context.Context, notifications []*models.Notification) error
	GetByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Notification, int, error)
	GetUnreadCount(ctx context.Context, userID int32) (int32, error)
	MarkAllRead(ctx context.Context, userID int32) error
	MarkRead(ctx context.Context, id int32, userID int32) error
}

// SavedPostRepository defines the interface for saved post data operations.
type SavedPostRepository interface {
	Create(ctx context.Context, savedPost *models.SavedPost) error
	Delete(ctx context.Context, userID, postID int32) error
	Exists(ctx context.Context, userID, postID int32) (bool, error)
	GetByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.SavedPost, int, error)
	GetSavedPostIDs(ctx context.Context, userID int32, postIDs []int32) ([]int32, error)
}

// GoldVoteRepository handles gold sentiment vote persistence.
type GoldVoteRepository interface {
	Upsert(ctx context.Context, vote *models.GoldVote) error
	GetByUserAndDate(ctx context.Context, userID int32, voteDate time.Time, category int32) (*models.GoldVote, error)
	CountByDate(ctx context.Context, voteDate time.Time, category int32) (bullish int32, bearish int32, err error)
	UpsertAnonymous(ctx context.Context, vote *models.GoldVote) error
	GetByAnonymousIDAndDate(ctx context.Context, anonymousID string, voteDate time.Time, category int32) (*models.GoldVote, error)
	DeleteByAnonymousIDAndDate(ctx context.Context, anonymousID string, voteDate time.Time, category int32) error
}

// GoldVoteCommentRepository handles gold sentiment comment persistence.
type GoldVoteCommentRepository interface {
	Create(ctx context.Context, comment *models.GoldVoteComment) error
	GetByID(ctx context.Context, id int32) (*models.GoldVoteComment, error)
	ListByDate(ctx context.Context, voteDate time.Time, category int32, limit, offset int) ([]*models.GoldVoteComment, int, error)
	Delete(ctx context.Context, id int32) error
	CountByUserAndDate(ctx context.Context, userID int32, voteDate time.Time, category int32) (int, error)
}

// HashtagRepository defines the interface for hashtag data operations.
type HashtagRepository interface {
	CreateBatch(ctx context.Context, postID int32, hashtags []string, createdAt time.Time) error
	DeleteByPostID(ctx context.Context, postID int32) error
	GetByPostID(ctx context.Context, postID int32) ([]string, error)
	GetTrending(ctx context.Context, since time.Time, limit int) ([]TrendingHashtag, error)
	GetPostIDsByHashtag(ctx context.Context, hashtag string, opts ListOptions) ([]int32, int, error)
}

// FeedbackRepository defines the interface for feedback data operations.
type FeedbackRepository interface {
	Create(ctx context.Context, feedback *models.Feedback) error
	ListByUserID(ctx context.Context, userID int32, opts ListOptions) ([]*models.Feedback, int, error)
	CountRecentByUserID(ctx context.Context, userID int32, since time.Time) (int, error)
	// Admin methods
	GetByID(ctx context.Context, id int32) (*models.Feedback, error)
	ListAll(ctx context.Context, statusFilter int16, opts ListOptions) ([]*models.Feedback, int, error)
	Update(ctx context.Context, feedback *models.Feedback) error
	Delete(ctx context.Context, id int32) error
}

// PushSubscriptionRepository defines the interface for push subscription data operations.
type PushSubscriptionRepository interface {
	Create(ctx context.Context, sub *models.PushSubscription) error
	DeleteByEndpoint(ctx context.Context, endpoint string) error
	GetByUserID(ctx context.Context, userID int32) ([]*models.PushSubscription, error)
	GetAll(ctx context.Context) ([]*models.PushSubscription, error)
	CountByUserID(ctx context.Context, userID int32) (int, error)
	DeleteByID(ctx context.Context, id int32) error
}

// AssetConfigFetchCodeRepository defines the interface for asset config fetch code data operations.
// It manages the ordered list of type codes used to resolve prices for a given asset display config.
type AssetConfigFetchCodeRepository interface {
	// ListByConfigID retrieves all active fetch codes for a config, ordered by priority ASC.
	// Soft-deleted rows are excluded automatically.
	ListByConfigID(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error)

	// GetByID retrieves a single fetch code by primary key.
	// Returns nil, nil if the record does not exist.
	GetByID(ctx context.Context, id int32) (*models.AssetConfigFetchCode, error)

	// Create inserts a new fetch code record.
	Create(ctx context.Context, fc *models.AssetConfigFetchCode) error

	// Update saves all fields of an existing fetch code record (e.g., priority change).
	Update(ctx context.Context, fc *models.AssetConfigFetchCode) error

	// Delete soft-deletes a fetch code by primary key.
	// Returns apperrors.NotFoundError if no row was affected.
	Delete(ctx context.Context, id int32) error

	// CountByConfigID returns the count of active (non-deleted) fetch codes for a config.
	CountByConfigID(ctx context.Context, configID int32) (int64, error)
}

// WatchlistRepository defines the interface for watchlist data operations.
type WatchlistRepository interface {
	// Create creates a new watchlist item.
	Create(ctx context.Context, item *models.WatchlistItem) error

	// GetByIDForUser retrieves a watchlist item by ID, ensuring it belongs to the user.
	GetByIDForUser(ctx context.Context, itemID, userID int32) (*models.WatchlistItem, error)

	// GetBySymbolForUser retrieves a watchlist item by symbol for a user.
	GetBySymbolForUser(ctx context.Context, symbol string, userID int32) (*models.WatchlistItem, error)

	// ListByUserID retrieves all watchlist items for a user, ordered by sort_order ASC, created_at ASC.
	ListByUserID(ctx context.Context, userID int32) ([]*models.WatchlistItem, error)

	// CountByUserID returns the number of watchlist items for a user.
	CountByUserID(ctx context.Context, userID int32) (int64, error)

	// Update updates a watchlist item (full model update).
	Update(ctx context.Context, item *models.WatchlistItem) error

	// Delete soft deletes a watchlist item by ID.
	Delete(ctx context.Context, itemID int32) error

	// ReorderItems updates sort_order for a list of item IDs within a transaction.
	// All IDs must belong to the given user; ownership is validated via the UPDATE clause.
	ReorderItems(ctx context.Context, userID int32, itemIDs []int32) error

	// GetMaxSortOrder returns the maximum sort_order value for a user's watchlist,
	// or -1 if the watchlist is empty.
	GetMaxSortOrder(ctx context.Context, userID int32) (int32, error)
}
