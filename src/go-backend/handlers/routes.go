package handlers

import (
	"wealthjourney/domain/auth"
	appmiddleware "wealthjourney/pkg/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes registers all API routes.
// This function supports both rate limited (main server) and non-rate limited (vercel) setups.
// If rateLimiter is nil, rate limiting middleware is skipped.
func RegisterRoutes(
	v1 *gin.RouterGroup,
	h *AllHandlers,
	authSrv *auth.Server,
	rateLimiter *appmiddleware.RateLimiter,
	importRateLimiter interface{}, // Can be *ImportRateLimiter or *RedisImportRateLimiter
) {
	// Public routes (no auth required)
	publicGroup := v1.Group("/public")
	if rateLimiter != nil {
		publicGroup.Use(appmiddleware.RateLimitByIP(rateLimiter))
	}
	{
		publicGroup.GET("/market-types", h.Public.GetPublicMarketTypes)
		if h.SiteSettings != nil {
			publicGroup.GET("/site-settings", h.SiteSettings.GetSiteSettings)
		}
	}

	// Gold Sentiment — Public routes (no auth, optional auth for user_vote)
	goldSentimentPublic := v1.Group("/public/gold-sentiment")
	if rateLimiter != nil {
		goldSentimentPublic.Use(appmiddleware.RateLimitByIP(rateLimiter))
	}
	{
		goldSentimentPublic.GET("", h.GoldSentiment.GetGoldSentiment)
		goldSentimentPublic.GET("/comments", h.GoldSentiment.GetGoldSentimentComments)
		goldSentimentPublic.POST("/vote", h.GoldSentiment.CastGoldVote)
	}

	// Gold Sentiment — Protected routes (auth required for comments)
	goldSentiment := v1.Group("/gold-sentiment")
	if rateLimiter != nil {
		goldSentiment.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	goldSentiment.Use(AuthMiddleware(authSrv))
	{
		goldSentiment.POST("/comments", h.GoldSentiment.PostGoldSentimentComment)
		goldSentiment.DELETE("/comments/:comment_id", h.GoldSentiment.DeleteGoldSentimentComment)
	}

	// Admin routes (auth + admin required)
	admin := v1.Group("/admin")
	if rateLimiter != nil {
		admin.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	admin.Use(AuthMiddleware(authSrv))
	admin.Use(AdminMiddleware())
	{
		if h.PriceOverride != nil {
			admin.POST("/price-overrides", h.PriceOverride.SetPriceOverride)
			admin.GET("/price-overrides", h.PriceOverride.ListPriceOverrides)
			admin.DELETE("/price-overrides", h.PriceOverride.DeletePriceOverride)
		}
		if h.SiteSettings != nil {
			admin.PUT("/site-settings", h.SiteSettings.UpdateSiteSettings)
		}
		// Admin user management
		if h.AdminUser != nil {
			admin.GET("/users", h.AdminUser.ListUsers)
			admin.PUT("/users/:id/role", h.AdminUser.ToggleRole)
		}
		// Admin feedback management
		if h.AdminFeedback != nil {
			admin.GET("/feedback", h.AdminFeedback.ListFeedback)
			admin.PUT("/feedback/:id", h.AdminFeedback.UpdateFeedback)
			admin.DELETE("/feedback/:id", h.AdminFeedback.DeleteFeedback)
		}
		// Admin broadcast
		if h.AdminBroadcast != nil {
			admin.POST("/broadcast", h.AdminBroadcast.SendBroadcast)
		}
		// Price alert configuration
		if h.PriceAlertConfig != nil {
			admin.GET("/price-alert-config", h.PriceAlertConfig.GetConfig)
			admin.PUT("/price-alert-config", h.PriceAlertConfig.UpdateConfig)
		}
	}

	// Push notification routes
	push := v1.Group("/push")
	push.Use(AuthMiddleware(authSrv))
	if rateLimiter != nil {
		push.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	{
		if h.Push != nil {
			push.GET("/vapid-key", h.Push.GetVAPIDKey)
			push.POST("/subscribe", h.Push.Subscribe)
			push.DELETE("/subscribe", h.Push.Unsubscribe)
		}
	}

	// Auth routes (higher rate limit allowed for auth)
	authGroup := v1.Group("/auth")
	if rateLimiter != nil {
		authGroup.Use(appmiddleware.RateLimitByIP(rateLimiter))
	}
	{
		authGroup.POST("/register", h.Auth.Register)
		authGroup.POST("/login", h.Auth.Login)
		authGroup.POST("/logout", h.Auth.Logout)
		authGroup.GET("/verify", h.Auth.VerifyAuth)
		authGroup.POST("/register-password", h.Auth.RegisterWithPassword)
		authGroup.POST("/login-password", h.Auth.LoginWithPassword)
	}

	// Protected auth routes (require authentication)
	authProtected := v1.Group("/auth")
	authProtected.Use(AuthMiddleware(authSrv))
	if rateLimiter != nil {
		authProtected.Use(appmiddleware.RateLimitByIP(rateLimiter))
	}
	{
		authProtected.GET("", h.Auth.GetAuth) // Get current authenticated user
		authProtected.POST("/link-password", h.Auth.LinkPassword)
		authProtected.POST("/link-google", h.Auth.LinkGoogle)
		authProtected.POST("/change-password", h.Auth.ChangePassword)
		authProtected.GET("/methods", h.Auth.GetAuthMethods)
	}

	// Session management endpoints (protected)
	sessions := v1.Group("/sessions")
	sessions.Use(AuthMiddleware(authSrv))
	if rateLimiter != nil {
		sessions.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	{
		sessions.GET("", h.Session.ListSessions)
		sessions.DELETE("/:session_id", h.Session.RevokeSession)
		sessions.DELETE("", h.Session.RevokeAllSessions)
	}

	// User routes (protected)
	users := v1.Group("/users")
	if rateLimiter != nil {
		users.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	users.Use(AuthMiddleware(authSrv))
	{
		users.GET("", h.User.GetUser)           // Get current user
		users.GET("/all", h.User.ListUsers)     // List all users (admin)
		users.PUT("/preferences", h.User.UpdatePreferences) // Update user preferences
		users.GET("/:email", h.User.GetUserByEmail)
		users.POST("", h.User.CreateUser)
		users.PUT("", h.User.UpdateUser)
		users.DELETE("", h.User.DeleteUser)
	}

	// Wallet routes (protected)
	wallets := v1.Group("/wallets")
	if rateLimiter != nil {
		wallets.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	wallets.Use(AuthMiddleware(authSrv))
	{
		wallets.POST("", h.Wallet.CreateWallet)
		wallets.GET("", h.Wallet.ListWallets)
		// Specific routes must come before :id parameterized route
		wallets.GET("/total-balance", h.Wallet.GetTotalBalance)
		wallets.GET("/balance-history", h.Wallet.GetBalanceHistory)
		wallets.GET("/monthly-dominance", h.Wallet.GetMonthlyDominance)
		wallets.POST("/transfer", h.Wallet.TransferFunds)
		// Wallet investment routes (must come before :id parameterized route)
		wallets.GET("/:id/investments", h.Investment.ListInvestments)
		wallets.GET("/:id/portfolio-summary", h.Investment.GetPortfolioSummary)
		// Parameterized routes
		wallets.GET("/:id", h.Wallet.GetWallet)
		wallets.PUT("/:id", h.Wallet.UpdateWallet)
		wallets.POST("/:id/delete", h.Wallet.DeleteWallet)
		wallets.POST("/:id/add", h.Wallet.AddFunds)
		wallets.POST("/:id/withdraw", h.Wallet.WithdrawFunds)
		wallets.POST("/:id/adjust", h.Wallet.AdjustBalance)
	}

	// Transaction routes (protected)
	transactions := v1.Group("/transactions")
	if rateLimiter != nil {
		transactions.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	transactions.Use(AuthMiddleware(authSrv))
	{
		transactions.POST("", h.Transaction.CreateTransaction)
		transactions.GET("", h.Transaction.ListTransactions)
		// Specific routes must come before :id parameterized route
		transactions.GET("/available-years", h.Transaction.GetAvailableYears)
		transactions.GET("/financial-report", h.Transaction.GetFinancialReport)
		transactions.GET("/category-breakdown", h.Transaction.GetCategoryBreakdown)
		// Parameterized routes
		transactions.GET("/:id", h.Transaction.GetTransaction)
		transactions.PUT("/:id", h.Transaction.UpdateTransaction)
		transactions.DELETE("/:id", h.Transaction.DeleteTransaction)
	}

	// Category routes (protected)
	categories := v1.Group("/categories")
	if rateLimiter != nil {
		categories.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	categories.Use(AuthMiddleware(authSrv))
	{
		categories.POST("", h.Category.CreateCategory)
		categories.GET("", h.Category.ListCategories)
		categories.GET("/:id", h.Category.GetCategory)
		categories.PUT("/:id", h.Category.UpdateCategory)
		categories.DELETE("/:id", h.Category.DeleteCategory)
	}

	// Budget routes (protected)
	budgets := v1.Group("/budgets")
	if rateLimiter != nil {
		budgets.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	budgets.Use(AuthMiddleware(authSrv))
	{
		budgets.POST("", h.Budget.CreateBudget)
		budgets.GET("", h.Budget.ListBudgets)
		budgets.GET("/:id", h.Budget.GetBudget)
		budgets.PUT("/:id", h.Budget.UpdateBudget)
		budgets.DELETE("/:id", h.Budget.DeleteBudget)
		budgets.GET("/:id/items", h.Budget.GetBudgetItems)
		budgets.POST("/:id/items", h.Budget.CreateBudgetItem)
		budgets.PUT("/:id/items/:itemId", h.Budget.UpdateBudgetItem)
		budgets.DELETE("/:id/items/:itemId", h.Budget.DeleteBudgetItem)
	}

	// Investment routes (protected)
	investments := v1.Group("/investments")
	if rateLimiter != nil {
		investments.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	investments.Use(AuthMiddleware(authSrv))
	{
		// Investment management routes
		investments.GET("", h.Investment.ListUserInvestments) // NEW: List all user investments across all wallets
		investments.POST("", h.Investment.CreateInvestment)
		investments.POST("/update-prices", h.Investment.UpdatePrices)
		// Symbol search routes (must come before :id parameterized route)
		investments.GET("/symbols/search", h.Investment.SearchSymbols)
		// Market price lookup (must come before :id parameterized route)
		investments.GET("/market-price", h.Investment.GetMarketPrice)
		// Gold type codes (must come before :id parameterized route)
		investments.GET("/gold-types", h.Gold.GetGoldTypeCodes)
		// Silver type codes (must come before :id parameterized route)
		investments.GET("/silver-types", h.Silver.GetSilverTypeCodes)
		// Market prices (gold + silver combined, must come before :id parameterized route)
		if h.MarketPrices != nil {
			investments.GET("/market-prices", h.MarketPrices.GetMarketPrices)
		}
		// Gold chart (must come before :id parameterized route)
		if h.GoldChart != nil {
			investments.GET("/gold-chart", h.GoldChart.GetGoldChart)
		}
		// Silver chart (must come before :id parameterized route)
		if h.SilverChart != nil {
			investments.GET("/silver-chart", h.SilverChart.GetSilverChart)
		}
		// Specific routes must come before :id parameterized route
		// Investment transaction routes (use :id to be consistent with other routes)
		investments.GET("/:id/transactions", h.Investment.ListTransactions)
		investments.POST("/:id/transactions", h.Investment.AddTransaction)
		// Parameterized investment routes
		investments.GET("/:id", h.Investment.GetInvestment)
		investments.PUT("/:id", h.Investment.UpdateInvestment)
		investments.DELETE("/:id", h.Investment.DeleteInvestment)
	}

	// Investment transaction routes (protected)
	investmentTransactions := v1.Group("/investment-transactions")
	if rateLimiter != nil {
		investmentTransactions.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	investmentTransactions.Use(AuthMiddleware(authSrv))
	{
		investmentTransactions.PUT("/:id", h.Investment.EditTransaction)
		investmentTransactions.DELETE("/:id", h.Investment.DeleteTransaction)
	}

	// Aggregated portfolio summary route (protected)
	// This is a top-level route for getting summary across all wallets
	portfolioSummary := v1.Group("/portfolio-summary")
	if rateLimiter != nil {
		portfolioSummary.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	portfolioSummary.Use(AuthMiddleware(authSrv))
	{
		portfolioSummary.GET("", h.Investment.GetAggregatedPortfolioSummary)
	}

	// Historical portfolio values route (protected)
	// This is a top-level route for getting historical portfolio values for charts
	portfolio := v1.Group("/portfolio")
	if rateLimiter != nil {
		portfolio.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	portfolio.Use(AuthMiddleware(authSrv))
	{
		portfolio.GET("/historical-values", h.Investment.GetHistoricalPortfolioValues)
	}

	// Community SSE route — no rate limiter (long-lived connection), token auth via query param
	communitySSE := v1.Group("/community")
	{
		communitySSE.GET("/notifications/stream", h.Community.StreamNotifications)
	}

	// Community routes (protected)
	community := v1.Group("/community")
	community.Use(AuthMiddleware(authSrv))
	if rateLimiter != nil {
		community.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	{
		// Feed
		community.GET("/feed", h.Community.GetFeed)

		// Posts — specific routes first
		community.POST("/posts", h.Community.CreatePost)
		community.GET("/posts/:post_id", h.Community.GetPost)
		community.PUT("/posts/:post_id", h.Community.UpdatePost)
		community.DELETE("/posts/:post_id", h.Community.DeletePost)

		// Likes
		community.POST("/posts/:post_id/like", h.Community.LikePost)
		community.DELETE("/posts/:post_id/like", h.Community.UnlikePost)

		// Comments
		community.POST("/posts/:post_id/comments", h.Community.CreateComment)
		community.GET("/posts/:post_id/comments", h.Community.GetComments)
		community.DELETE("/comments/:comment_id", h.Community.DeleteComment)
		community.PUT("/comments/:comment_id", h.Community.UpdateComment)
		community.GET("/comments/:comment_id/replies", h.Community.GetReplies)

		// Users — specific routes first
		community.GET("/users/:user_id/posts", h.Community.GetUserPosts)
		community.GET("/users/:user_id/profile", h.Community.GetProfile)
		community.POST("/users/:user_id/follow", h.Community.FollowUser)
		community.DELETE("/users/:user_id/follow", h.Community.UnfollowUser)
		community.GET("/users/:user_id/following", h.Community.GetFollowing)
		community.GET("/users/:user_id/followers", h.Community.GetFollowers)
		community.GET("/users/:user_id/liked-posts", h.Community.GetLikedPosts)

		// Profile
		community.PUT("/profile", h.Community.UpdateProfile)

		// Report
		community.POST("/report", h.Community.ReportContent)

		// Upload
		community.POST("/upload", h.Community.UploadImage)

		// Phase 2: Share / Repost
		community.POST("/posts/:post_id/share", h.Community.SharePost)

		// Phase 2: Notifications
		community.GET("/notifications", h.Community.GetNotifications)
		community.GET("/notifications/unread-count", h.Community.GetUnreadNotificationCount)
		community.PUT("/notifications/read", h.Community.MarkNotificationsRead)

		// Phase 2: Saved Posts
		community.POST("/posts/:post_id/save", h.Community.SavePost)
		community.DELETE("/posts/:post_id/save", h.Community.UnsavePost)
		community.GET("/saved", h.Community.GetSavedPosts)

		// Phase 2: Discovery
		community.GET("/suggested-users", h.Community.GetSuggestedUsers)
		community.GET("/trending", h.Community.GetTrendingTopics)
	}

	// Feedback routes (protected)
	feedback := v1.Group("/feedback")
	feedback.Use(AuthMiddleware(authSrv))
	if rateLimiter != nil {
		feedback.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	{
		feedback.POST("", h.Feedback.SubmitFeedback)
		feedback.GET("", h.Feedback.ListMyFeedback)
	}

	// Import routes (protected)
	imports := v1.Group("/import")
	if rateLimiter != nil {
		imports.Use(appmiddleware.RateLimitByUser(rateLimiter))
	}
	imports.Use(AuthMiddleware(authSrv))
	{
		imports.GET("/templates", h.Import.ListBankTemplates)
		imports.GET("/excel-sheets/:file_id", h.Import.ListExcelSheets)
		imports.GET("/history", h.Import.ListImportBatches)
		// User template routes (must come before :id parameterized route)
		imports.GET("/user-templates", h.Import.ListUserTemplates)
		imports.POST("/user-templates", h.Import.CreateUserTemplate)
		imports.GET("/user-templates/:template_id", h.Import.GetUserTemplate)
		imports.PUT("/user-templates/:template_id", h.Import.UpdateUserTemplate)
		imports.DELETE("/user-templates/:template_id", h.Import.DeleteUserTemplate)
		// Background job routes
		imports.GET("/jobs", h.Import.ListUserJobs)
		imports.GET("/jobs/:job_id", h.Import.GetJobStatus)
		imports.POST("/jobs/:job_id/cancel", h.Import.CancelJob)
		// Parameterized routes
		imports.GET("/:id", h.Import.GetImportBatch)
	}

	// Import operations with strict rate limiting
	// Supports both in-memory (ImportRateLimiter) and Redis-based (RedisImportRateLimiter) rate limiting
	importsRestricted := v1.Group("/import")
	importsRestricted.Use(AuthMiddleware(authSrv))
	if importRateLimiter != nil {
		// Check type and apply appropriate middleware
		switch limiter := importRateLimiter.(type) {
		case *appmiddleware.ImportRateLimiter:
			// In-memory rate limiter (legacy)
			importsRestricted.Use(appmiddleware.ImportRateLimitMiddleware(limiter))
		case *appmiddleware.RedisImportRateLimiter:
			// Redis-based rate limiter (new, distributed)
			importsRestricted.Use(appmiddleware.RedisImportRateLimitMiddleware(limiter))
		}
	}
	{
		importsRestricted.POST("/upload", h.Import.UploadFile)
		importsRestricted.POST("/parse", h.Import.ParseFile)
		importsRestricted.POST("/convert-currency", h.Import.ConvertCurrency)
		importsRestricted.POST("/detect-duplicates", h.Import.DetectDuplicates)
		importsRestricted.POST("/execute", h.Import.ConfirmImport) // Changed from /confirm to match protobuf
		importsRestricted.POST("/:id/undo", h.Import.UndoImport)
	}
}
