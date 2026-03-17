package handlers

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/fx"
	"wealthjourney/pkg/handler"
	"wealthjourney/pkg/types"
	investmentv1 "wealthjourney/protobuf/v1"
)

// InvestmentHandlers handles investment-related HTTP requests.
type InvestmentHandlers struct {
	investmentService   service.InvestmentService
	portfolioHistorySvc service.PortfolioHistoryService
	marketDataService   service.MarketDataService
}

// NewInvestmentHandlers creates a new InvestmentHandlers instance.
func NewInvestmentHandlers(investmentService service.InvestmentService, portfolioHistorySvc service.PortfolioHistoryService, marketDataService service.MarketDataService) *InvestmentHandlers {
	return &InvestmentHandlers{
		investmentService:   investmentService,
		portfolioHistorySvc: portfolioHistorySvc,
		marketDataService:   marketDataService,
	}
}

// CreateInvestment creates a new investment holding.
// @Summary Create a new investment
// @Tags investments
// @Accept json
// @Produce json
// @Param request body investmentv1.CreateInvestmentRequest true "Investment creation request"
// @Success 201 {object} types.APIResponse{data=investmentv1.Investment}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/investments [post]
func (h *InvestmentHandlers) CreateInvestment(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Bind and validate request
	var req investmentv1.CreateInvestmentRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Validate wallet ID: 0 means no wallet association, positive means explicit
	if req.WalletId < 0 {
		handler.BadRequest(c, apperrors.NewValidationError("invalid wallet ID"))
		return
	}

	// Validate symbol
	if req.Symbol == "" {
		handler.BadRequest(c, apperrors.NewValidationError("symbol is required"))
		return
	}

	// Validate investment type
	if req.Type == investmentv1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED {
		handler.BadRequest(c, apperrors.NewValidationError("investment type is required"))
		return
	}

	// Set default currency if not provided
	if req.Currency == "" {
		req.Currency = types.USD
	}

	// NOTE: Decimal field conversion is handled by the service layer
	// The service layer properly converts using currency-aware and type-aware functions
	// Do NOT convert here to avoid double conversion

	// Call service
	result, err := h.investmentService.CreateInvestment(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

// GetInvestment retrieves an investment by ID.
// @Summary Get an investment
// @Tags investments
// @Produce json
// @Param id path int true "Investment ID"
// @Success 200 {object} types.APIResponse{data=investmentv1.Investment}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/investments/{id} [get]
func (h *InvestmentHandlers) GetInvestment(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse investment ID
	investmentID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Call service
	result, err := h.investmentService.GetInvestment(c.Request.Context(), investmentID, userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// ListInvestments lists all investments for a wallet.
// @Summary List investments for a wallet
// @Tags investments
// @Produce json
// @Param id path int true "Wallet ID"
// @Param page query int false "Page number (default: 1)"
// @Param page_size query int false "Page size (default: 20, max: 100)"
// @Param order_by query string false "Order by field (default: created_at)"
// @Param order query string false "Order direction (asc or desc, default: desc)"
// @Param typeFilter query int false "Filter by investment type"
// @Success 200 {object} types.APIResponse{data=[]investmentv1.Investment}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/wallets/{id}/investments [get]
func (h *InvestmentHandlers) ListInvestments(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse wallet ID
	walletID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Build request
	var req investmentv1.ListInvestmentsRequest
	req.WalletId = walletID

	// Parse pagination parameters
	pagination := parsePaginationParams(c)
	req.Pagination = &investmentv1.PaginationParams{
		Page:     int32(pagination.Page),
		PageSize: int32(pagination.PageSize),
		OrderBy:  pagination.OrderBy,
		Order:    pagination.Order,
	}

	// Parse type filter if provided
	if typeFilterStr := c.Query("typeFilter"); typeFilterStr != "" {
		typeFilter, err := strconv.ParseInt(typeFilterStr, 10, 32)
		if err != nil {
			handler.BadRequest(c, apperrors.NewValidationError("invalid typeFilter parameter"))
			return
		}
		req.TypeFilter = investmentv1.InvestmentType(typeFilter)
	}

	// Call service
	result, err := h.investmentService.ListInvestments(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// UpdateInvestment updates an investment's details.
// @Summary Update an investment
// @Tags investments
// @Accept json
// @Produce json
// @Param id path int true "Investment ID"
// @Param request body investmentv1.UpdateInvestmentRequest true "Investment update request"
// @Success 200 {object} types.APIResponse{data=investmentv1.Investment}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/investments/{id} [put]
func (h *InvestmentHandlers) UpdateInvestment(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse investment ID
	investmentID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Bind and validate request
	var req investmentv1.UpdateInvestmentRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Set ID from path parameter
	req.Id = investmentID

	// Validate name if provided
	if req.Name == "" {
		handler.BadRequest(c, apperrors.NewValidationError("name is required"))
		return
	}

	// Call service
	result, err := h.investmentService.UpdateInvestment(c.Request.Context(), investmentID, userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// DeleteInvestment deletes an investment.
// @Summary Delete an investment
// @Tags investments
// @Produce json
// @Param id path int true "Investment ID"
// @Success 200 {object} types.APIResponse{data=investmentv1.DeleteInvestmentResponse}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/investments/{id} [delete]
func (h *InvestmentHandlers) DeleteInvestment(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse investment ID
	investmentID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Call service
	result, err := h.investmentService.DeleteInvestment(c.Request.Context(), investmentID, userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// AddTransaction adds a buy/sell transaction to an investment.
// @Summary Add a transaction to an investment
// @Tags investments
// @Accept json
// @Produce json
// @Param id path int true "Investment ID"
// @Param request body investmentv1.AddTransactionRequest true "Transaction request"
// @Success 201 {object} types.APIResponse{data=investmentv1.AddTransactionResponse}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/investments/{id}/transactions [post]
func (h *InvestmentHandlers) AddTransaction(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse investment ID
	investmentID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Bind and validate request
	var req investmentv1.AddTransactionRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Set investment ID from path parameter
	req.InvestmentId = investmentID

	// Validate transaction type
	if req.Type == investmentv1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_UNSPECIFIED {
		handler.BadRequest(c, apperrors.NewValidationError("transaction type is required"))
		return
	}

	// Validate quantity
	if req.Quantity <= 0 {
		handler.BadRequest(c, apperrors.NewValidationError("quantity must be positive"))
		return
	}

	// Validate price
	if req.Price <= 0 {
		handler.BadRequest(c, apperrors.NewValidationError("price must be positive"))
		return
	}

	// Validate fees
	if req.Fees < 0 {
		handler.BadRequest(c, apperrors.NewValidationError("fees cannot be negative"))
		return
	}

	// Set default transaction date if not provided
	if req.TransactionDate == 0 {
		req.TransactionDate = time.Now().Unix()
	}

	// Call service
	result, err := h.investmentService.AddTransaction(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

// ListTransactions retrieves transactions for an investment.
// @Summary List transactions for an investment
// @Tags investments
// @Produce json
// @Param id path int true "Investment ID"
// @Param page query int false "Page number (default: 1)"
// @Param page_size query int false "Page size (default: 20, max: 100)"
// @Param order_by query string false "Order by field (default: created_at)"
// @Param order query string false "Order direction (asc or desc, default: desc)"
// @Param typeFilter query int false "Filter by transaction type"
// @Success 200 {object} types.APIResponse{data=[]investmentv1.InvestmentTransaction}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/investments/{id}/transactions [get]
func (h *InvestmentHandlers) ListTransactions(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse investment ID
	investmentID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Build request
	var req investmentv1.ListInvestmentTransactionsRequest
	req.InvestmentId = investmentID

	// Parse pagination parameters
	pagination := parsePaginationParams(c)
	req.Pagination = &investmentv1.PaginationParams{
		Page:     int32(pagination.Page),
		PageSize: int32(pagination.PageSize),
		OrderBy:  pagination.OrderBy,
		Order:    pagination.Order,
	}

	// Parse type filter if provided
	if typeFilterStr := c.Query("typeFilter"); typeFilterStr != "" {
		typeFilter, err := strconv.ParseInt(typeFilterStr, 10, 32)
		if err != nil {
			handler.BadRequest(c, apperrors.NewValidationError("invalid typeFilter parameter"))
			return
		}
		req.TypeFilter = investmentv1.InvestmentTransactionType(typeFilter)
	}

	// Call service
	result, err := h.investmentService.ListTransactions(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// EditTransaction edits an existing transaction.
// @Summary Edit an investment transaction
// @Tags investments
// @Accept json
// @Produce json
// @Param id path int true "Transaction ID"
// @Param request body investmentv1.EditInvestmentTransactionRequest true "Transaction edit request"
// @Success 200 {object} types.APIResponse{data=investmentv1.InvestmentTransaction}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/investment-transactions/{id} [put]
func (h *InvestmentHandlers) EditTransaction(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse transaction ID
	transactionID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Bind and validate request
	var req investmentv1.EditInvestmentTransactionRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Set ID from path parameter
	req.Id = transactionID

	// Validate quantity
	if req.Quantity <= 0 {
		handler.BadRequest(c, apperrors.NewValidationError("quantity must be positive"))
		return
	}

	// Validate price
	if req.Price <= 0 {
		handler.BadRequest(c, apperrors.NewValidationError("price must be positive"))
		return
	}

	// Validate fees
	if req.Fees < 0 {
		handler.BadRequest(c, apperrors.NewValidationError("fees cannot be negative"))
		return
	}

	// Set default transaction date if not provided
	if req.TransactionDate == 0 {
		req.TransactionDate = time.Now().Unix()
	}

	// Call service
	result, err := h.investmentService.EditTransaction(c.Request.Context(), transactionID, userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// DeleteTransaction deletes a transaction.
// @Summary Delete an investment transaction
// @Tags investments
// @Produce json
// @Param id path int true "Transaction ID"
// @Success 200 {object} types.APIResponse{data=investmentv1.DeleteInvestmentTransactionResponse}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/investment-transactions/{id} [delete]
func (h *InvestmentHandlers) DeleteTransaction(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse transaction ID
	transactionID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Call service
	result, err := h.investmentService.DeleteTransaction(c.Request.Context(), transactionID, userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetPortfolioSummary retrieves portfolio summary for a wallet.
// @Summary Get portfolio summary for a wallet
// @Tags investments
// @Produce json
// @Param id path int true "Wallet ID"
// @Success 200 {object} types.APIResponse{data=investmentv1.PortfolioSummary}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/wallets/{id}/portfolio-summary [get]
func (h *InvestmentHandlers) GetPortfolioSummary(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse wallet ID
	walletID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Parse period parameter — only accept 0–4, anything else defaults to 0 (PERIOD_ALL)
	var period investmentv1.PnlPeriod
	periodStr := c.Query("period")
	if periodStr != "" {
		periodVal, err := strconv.ParseInt(periodStr, 10, 32)
		if err == nil && periodVal >= 0 && periodVal <= 4 {
			period = investmentv1.PnlPeriod(int32(periodVal))
		}
	}

	// Call service
	result, err := h.investmentService.GetPortfolioSummary(c.Request.Context(), walletID, userID, period)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// UpdatePrices updates current prices for investments.
// @Summary Update current prices for investments
// @Tags investments
// @Accept json
// @Produce json
// @Param request body investmentv1.UpdatePricesRequest true "Update prices request"
// @Success 200 {object} types.APIResponse{data=investmentv1.UpdatePricesResponse}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/investments/update-prices [post]
func (h *InvestmentHandlers) UpdatePrices(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Bind and validate request
	var req investmentv1.UpdatePricesRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Call service
	result, err := h.investmentService.UpdatePrices(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// SearchSymbols searches for investment symbols by query.
// @Summary Search for investment symbols
// @Tags investments
// @Produce json
// @Param query query string true "Search query"
// @Param limit query int false "Max results (default: 10, max: 20)"
// @Success 200 {object} types.APIResponse{data=investmentv1.SearchSymbolsResponse}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/investments/symbols/search [get]
func (h *InvestmentHandlers) SearchSymbols(c *gin.Context) {
	// Get user ID from context
	_, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Get query parameter
	query := c.Query("query")
	if query == "" {
		handler.BadRequest(c, apperrors.NewValidationError("query parameter is required"))
		return
	}

	// Get limit parameter
	limitStr := c.DefaultQuery("limit", "10")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 10
	}
	if limit > 20 {
		limit = 20
	}

	// Call service
	result, err := h.investmentService.SearchSymbols(c.Request.Context(), query, limit)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// ListUserInvestments lists all investments across all user's investment wallets.
// @Summary List all user investments across all wallets
// @Tags investments
// @Produce json
// @Param page query int false "Page number (default: 1)"
// @Param page_size query int false "Page size (default: 100, max: 100)"
// @Param order_by query string false "Order by field (default: symbol)"
// @Param order query string false "Order direction (asc or desc, default: asc)"
// @Param typeFilter query int false "Filter by investment type"
// @Param walletId query int false "Filter by specific wallet (optional)"
// @Success 200 {object} types.APIResponse{data=investmentv1.ListUserInvestmentsResponse}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/investments [get]
func (h *InvestmentHandlers) ListUserInvestments(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Build request
	var req investmentv1.ListUserInvestmentsRequest

	// Parse pagination parameters
	pagination := parsePaginationParams(c)
	req.Pagination = &investmentv1.PaginationParams{
		Page:     int32(pagination.Page),
		PageSize: int32(pagination.PageSize),
		OrderBy:  pagination.OrderBy,
		Order:    pagination.Order,
	}

	// Parse optional walletId (support both snake_case and camelCase)
	walletIDStr := c.Query("walletId")
	if walletIDStr == "" {
		walletIDStr = c.Query("wallet_id") // Fallback to snake_case
	}
	if walletIDStr != "" {
		walletID, err := strconv.ParseInt(walletIDStr, 10, 32)
		if err != nil {
			handler.BadRequest(c, apperrors.NewValidationError("invalid walletId parameter"))
			return
		}
		req.WalletId = int32(walletID)
	}

	// Parse type filter if provided (support both snake_case and camelCase)
	typeFilterStr := c.Query("typeFilter")
	if typeFilterStr == "" {
		typeFilterStr = c.Query("type_filter") // Fallback to snake_case
	}
	if typeFilterStr != "" {
		typeFilter, err := strconv.ParseInt(typeFilterStr, 10, 32)
		if err != nil {
			handler.BadRequest(c, apperrors.NewValidationError("invalid typeFilter parameter"))
			return
		}
		req.TypeFilter = investmentv1.InvestmentType(typeFilter)
	}

	// Call service
	result, err := h.investmentService.ListUserInvestments(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetAggregatedPortfolioSummary retrieves aggregated portfolio summary across all investment wallets.
// @Summary Get aggregated portfolio summary
// @Tags investments
// @Produce json
// @Param walletId query int false "Filter by specific wallet (optional, 0 or omitted = all wallets)"
// @Param typeFilter query int false "Filter by investment type"
// @Success 200 {object} types.APIResponse{data=investmentv1.PortfolioSummary}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/portfolio-summary [get]
func (h *InvestmentHandlers) GetAggregatedPortfolioSummary(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Build request
	var req investmentv1.GetAggregatedPortfolioSummaryRequest

	// Parse optional walletId (support both snake_case and camelCase)
	walletIDStr := c.Query("walletId")
	if walletIDStr == "" {
		walletIDStr = c.Query("wallet_id") // Fallback to snake_case
	}
	if walletIDStr != "" {
		walletID, err := strconv.ParseInt(walletIDStr, 10, 32)
		if err != nil {
			handler.BadRequest(c, apperrors.NewValidationError("invalid walletId parameter"))
			return
		}
		req.WalletId = int32(walletID)
	}

	// Parse type filter if provided (support both snake_case and camelCase)
	typeFilterStr := c.Query("typeFilter")
	if typeFilterStr == "" {
		typeFilterStr = c.Query("type_filter") // Fallback to snake_case
	}
	if typeFilterStr != "" {
		typeFilter, err := strconv.ParseInt(typeFilterStr, 10, 32)
		if err != nil {
			handler.BadRequest(c, apperrors.NewValidationError("invalid typeFilter parameter"))
			return
		}
		req.TypeFilter = investmentv1.InvestmentType(typeFilter)
	}

	// Parse period parameter — only accept 0–4, anything else defaults to 0 (PERIOD_UNSPECIFIED/ALL)
	periodStr := c.Query("period")
	if periodStr == "" {
		periodStr = c.Query("pnl_period") // Fallback to snake_case
	}
	if periodStr != "" {
		periodVal, err := strconv.ParseInt(periodStr, 10, 32)
		if err != nil || periodVal < 0 || periodVal > 4 {
			req.Period = investmentv1.PnlPeriod_PNL_PERIOD_UNSPECIFIED
		} else {
			req.Period = investmentv1.PnlPeriod(int32(periodVal))
		}
	}

	// Call service
	result, err := h.investmentService.GetAggregatedPortfolioSummary(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetHistoricalPortfolioValues retrieves historical portfolio values for charts.
// @Summary Get historical portfolio values
// @Tags investments
// @Produce json
// @Param walletId query int false "Filter by specific wallet (optional, 0 or omitted = all wallets)"
// @Param days query int false "Number of days to look back (default: 30, max: 365)"
// @Param points query int false "Number of data points to return (default: 10, max: 100)"
// @Success 200 {object} types.APIResponse{data=investmentv1.GetHistoricalPortfolioValuesResponse}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/portfolio/historical-values [get]
func (h *InvestmentHandlers) GetHistoricalPortfolioValues(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Build request
	var req investmentv1.GetHistoricalPortfolioValuesRequest

	// Parse optional walletId (support both snake_case and camelCase)
	walletIDStr := c.Query("walletId")
	if walletIDStr == "" {
		walletIDStr = c.Query("wallet_id") // Fallback to snake_case
	}
	if walletIDStr != "" {
		walletID, err := strconv.ParseInt(walletIDStr, 10, 32)
		if err != nil {
			handler.BadRequest(c, apperrors.NewValidationError("invalid walletId parameter"))
			return
		}
		req.WalletId = int32(walletID)
	}

	// Parse days parameter
	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.ParseInt(daysStr, 10, 32)
	if err != nil || days <= 0 || days > 365 {
		days = 30 // Default to 30 days
	}
	req.Days = int32(days)

	// Parse points parameter
	pointsStr := c.DefaultQuery("points", "10")
	points, err := strconv.ParseInt(pointsStr, 10, 32)
	if err != nil || points <= 0 || points > 100 {
		points = 10 // Default to 10 points
	}
	req.Points = int32(points)

	// Call service
	result, err := h.portfolioHistorySvc.GetHistoricalValues(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetMarketPrice retrieves current market price for a symbol.
// @Summary Get current market price for display
// @Tags investments
// @Produce json
// @Param symbol query string true "Symbol (e.g., AAPL, BTC-USD, SJL1L10)"
// @Param currency query string true "Currency code (e.g., USD, VND)"
// @Param type query int false "Investment type (default: 2 for stock)"
// @Success 200 {object} types.APIResponse{data=investmentv1.MarketPrice}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/investments/market-price [get]
func (h *InvestmentHandlers) GetMarketPrice(c *gin.Context) {
	// Get user ID from context (for authentication check)
	_, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse query parameters
	symbol := c.Query("symbol")
	currency := c.Query("currency")
	typeStr := c.Query("type")

	// Validate required parameters
	if symbol == "" || currency == "" {
		handler.BadRequest(c, apperrors.NewValidationError("symbol and currency are required"))
		return
	}

	// Parse investment type (default to stock)
	investmentType := investmentv1.InvestmentType_INVESTMENT_TYPE_STOCK
	if typeStr != "" {
		typeInt, err := strconv.ParseInt(typeStr, 10, 32)
		if err != nil {
			handler.BadRequest(c, apperrors.NewValidationError("invalid type parameter"))
			return
		}
		investmentType = investmentv1.InvestmentType(typeInt)
	}

	// Fetch price with 15-minute cache tolerance
	maxAge := 15 * time.Minute
	priceData, err := h.marketDataService.GetPrice(c.Request.Context(), symbol, currency, investmentType, maxAge)

	if err != nil {
		// Return user-friendly error message
		c.JSON(200, &investmentv1.GetMarketPriceResponse{
			Success:   false,
			Message:   fmt.Sprintf("Price unavailable for %s", symbol),
			Timestamp: time.Now().Format(time.RFC3339),
		})
		return
	}

	// Determine display unit based on investment type and symbol
	displayUnit := getDisplayUnitForType(investmentType, symbol)

	// Check if data is from cache (older than 5 minutes)
	isCached := time.Since(priceData.Timestamp) > 5*time.Minute

	// For gold/silver, price is stored per gram/oz but needs to be displayed per tael/kg/oz
	// Convert price from storage unit to display unit based on symbol
	displayPrice := convertPriceForDisplay(priceData.Price, currency, investmentType, symbol)

	// Convert price to decimal for frontend convenience
	priceDecimal := convertToDecimal(displayPrice, currency)

	// Build successful response
	response := &investmentv1.GetMarketPriceResponse{
		Success: true,
		Message: "Market price retrieved",
		Data: &investmentv1.MarketPrice{
			Symbol:       priceData.Symbol,
			Currency:     priceData.Currency,
			Price:        displayPrice,
			PriceDecimal: priceDecimal,
			Timestamp:    priceData.Timestamp.Unix(),
			IsCached:     isCached,
			DisplayUnit:  displayUnit,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}

	handler.Success(c, response)
}

// getDisplayUnitForType returns the appropriate display unit for an investment type and symbol.
func getDisplayUnitForType(investmentType investmentv1.InvestmentType, symbol string) string {
	switch investmentType {
	case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND:
		return "mace"
	case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD:
		return "oz"
	case investmentv1.InvestmentType_INVESTMENT_TYPE_SILVER_VND:
		// For VND silver, unit depends on symbol suffix
		if len(symbol) >= 2 && symbol[len(symbol)-2:] == "KG" {
			return "kg"
		}
		return "tael"
	case investmentv1.InvestmentType_INVESTMENT_TYPE_SILVER_USD:
		return "oz"
	default:
		return "unit"
	}
}

// convertToDecimal converts amount from smallest currency unit to decimal.
func convertToDecimal(amount int64, currency string) float64 {
	multiplier := float64(fx.GetDecimalMultiplier(currency))
	return float64(amount) / multiplier
}

// convertPriceForDisplay converts price from storage format to display format.
// For gold VND: storage is per gram, display is per mace (×3.75)
// For gold USD: storage is per oz, display is per oz (no conversion)
// For silver VND: storage is per gram, display depends on symbol suffix:
//   - *_L symbols: display per tael (×37.5)
//   - *_KG symbols: display per kg (×1000)
// For silver USD: storage is per oz, display is per oz (no conversion)
func convertPriceForDisplay(storagePrice int64, currency string, investmentType investmentv1.InvestmentType, symbol string) int64 {
	const gramsPerMace = 3.75
	const gramsPerTael = 37.5
	const gramsPerKg = 1000.0

	switch investmentType {
	case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND:
		// Gold VND: Storage per gram, Display per mace (chỉ)
		return int64(float64(storagePrice) * gramsPerMace)

	case investmentv1.InvestmentType_INVESTMENT_TYPE_SILVER_VND:
		// Silver VND: Storage per gram, Display depends on symbol suffix
		if len(symbol) >= 2 && symbol[len(symbol)-2:] == "KG" {
			return int64(float64(storagePrice) * gramsPerKg)
		}
		return int64(float64(storagePrice) * gramsPerTael)

	case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD, investmentv1.InvestmentType_INVESTMENT_TYPE_SILVER_USD:
		// Storage: per oz, Display: per oz (no conversion needed)
		return storagePrice

	default:
		// Other investment types: no conversion needed
		return storagePrice
	}
}

