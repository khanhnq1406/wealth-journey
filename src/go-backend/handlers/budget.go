package handlers

import (
	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/handler"
	"wealthjourney/pkg/types"
	budgetv1 "wealthjourney/protobuf/v1"
)

// BudgetHandlers handles budget-related HTTP requests.
type BudgetHandlers struct {
	budgetService service.BudgetService
}

// NewBudgetHandlers creates a new BudgetHandlers instance.
func NewBudgetHandlers(budgetService service.BudgetService) *BudgetHandlers {
	return &BudgetHandlers{
		budgetService: budgetService,
	}
}

// CreateBudget creates a new budget.
// @Summary Create a new budget
// @Tags budgets
// @Accept json
// @Produce json
// @Param request body budgetv1.CreateBudgetRequest true "Budget creation request"
// @Success 201 {object} types.APIResponse{data=budgetv1.Budget}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/budgets [post]
func (h *BudgetHandlers) CreateBudget(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Bind and validate request
	var req budgetv1.CreateBudgetRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Validate budget name
	if req.Name == "" {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.BudgetNameRequired, "budget name is required"))
		return
	}

	// Set default currency if not provided
	if req.Total != nil && req.Total.Currency == "" {
		req.Total.Currency = types.VND
	}

	// Set default currency for items if not provided
	for i := range req.Items {
		if req.Items[i].Total != nil && req.Items[i].Total.Currency == "" {
			req.Items[i].Total.Currency = types.VND
		}
	}

	// Call service
	result, err := h.budgetService.CreateBudget(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

// ListBudgets lists all budgets for the authenticated user.
// @Summary List user budgets
// @Tags budgets
// @Produce json
// @Param page query int false "Page number (default: 1)"
// @Param page_size query int false "Page size (default: 20, max: 100)"
// @Param order_by query string false "Order by field (default: created_at)"
// @Param order query string false "Order direction (asc or desc, default: desc)"
// @Success 200 {object} types.APIResponse{data=budgetv1.ListBudgetsResponse}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/budgets [get]
func (h *BudgetHandlers) ListBudgets(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse pagination parameters
	params := parsePaginationParams(c)

	// Call service
	result, err := h.budgetService.ListBudgets(c.Request.Context(), userID, params)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetBudget retrieves a budget by ID.
// @Summary Get a budget
// @Tags budgets
// @Produce json
// @Param id path int true "Budget ID"
// @Success 200 {object} types.APIResponse{data=budgetv1.Budget}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/budgets/{id} [get]
func (h *BudgetHandlers) GetBudget(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse budget ID
	budgetID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Call service
	result, err := h.budgetService.GetBudget(c.Request.Context(), budgetID, userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// UpdateBudget updates a budget's information.
// @Summary Update a budget
// @Tags budgets
// @Accept json
// @Produce json
// @Param id path int true "Budget ID"
// @Param request body budgetv1.UpdateBudgetRequest true "Budget update request"
// @Success 200 {object} types.APIResponse{data=budgetv1.Budget}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/budgets/{id} [put]
func (h *BudgetHandlers) UpdateBudget(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse budget ID
	budgetID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Bind and validate request
	var req budgetv1.UpdateBudgetRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Validate budget name
	if req.Name == "" {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.BudgetNameRequired, "budget name is required"))
		return
	}

	// Set budget ID from URL parameter
	req.BudgetId = budgetID

	// Call service
	result, err := h.budgetService.UpdateBudget(c.Request.Context(), budgetID, userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// DeleteBudget deletes a budget.
// @Summary Delete a budget
// @Tags budgets
// @Produce json
// @Param id path int true "Budget ID"
// @Success 200 {object} types.APIResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/budgets/{id} [delete]
func (h *BudgetHandlers) DeleteBudget(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse budget ID
	budgetID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Call service
	result, err := h.budgetService.DeleteBudget(c.Request.Context(), budgetID, userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetBudgetItems retrieves all budget items for a budget.
// @Summary Get budget items
// @Tags budgets
// @Produce json
// @Param id path int true "Budget ID"
// @Success 200 {object} types.APIResponse{data=[]budgetv1.BudgetItem}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/budgets/{id}/items [get]
func (h *BudgetHandlers) GetBudgetItems(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse budget ID
	budgetID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Call service
	result, err := h.budgetService.GetBudgetItems(c.Request.Context(), budgetID, userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// CreateBudgetItem creates a new budget item.
// @Summary Create a budget item
// @Tags budgets
// @Accept json
// @Produce json
// @Param id path int true "Budget ID"
// @Param request body budgetv1.CreateBudgetItemRequest true "Budget item creation request"
// @Success 201 {object} types.APIResponse{data=budgetv1.BudgetItem}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/budgets/{id}/items [post]
func (h *BudgetHandlers) CreateBudgetItem(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse budget ID
	budgetID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Bind and validate request
	var req budgetv1.CreateBudgetItemRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Validate item name
	if req.Name == "" {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.BudgetItemNameRequired, "budget item name is required"))
		return
	}

	// Set default currency if not provided
	if req.Total != nil && req.Total.Currency == "" {
		req.Total.Currency = types.VND
	}

	// Set budget ID from URL parameter
	req.BudgetId = budgetID

	// Call service
	result, err := h.budgetService.CreateBudgetItem(c.Request.Context(), budgetID, userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

// UpdateBudgetItem updates a budget item's information.
// @Summary Update a budget item
// @Tags budgets
// @Accept json
// @Produce json
// @Param id path int true "Budget ID"
// @Param itemId path int true "Budget Item ID"
// @Param request body budgetv1.UpdateBudgetItemRequest true "Budget item update request"
// @Success 200 {object} types.APIResponse{data=budgetv1.BudgetItem}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/budgets/{id}/items/{itemId} [put]
func (h *BudgetHandlers) UpdateBudgetItem(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse budget ID
	budgetID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Parse item ID
	itemID, err := parseIDParam(c, "itemId")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Bind and validate request
	var req budgetv1.UpdateBudgetItemRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Validate item name
	if req.Name == "" {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.BudgetItemNameRequired, "budget item name is required"))
		return
	}

	// Set IDs from URL parameters
	req.BudgetId = budgetID
	req.ItemId = itemID

	// Call service
	result, err := h.budgetService.UpdateBudgetItem(c.Request.Context(), budgetID, itemID, userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// DeleteBudgetItem deletes a budget item.
// @Summary Delete a budget item
// @Tags budgets
// @Produce json
// @Param id path int true "Budget ID"
// @Param itemId path int true "Budget Item ID"
// @Success 200 {object} types.APIResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/budgets/{id}/items/{itemId} [delete]
func (h *BudgetHandlers) DeleteBudgetItem(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse budget ID
	budgetID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Parse item ID
	itemID, err := parseIDParam(c, "itemId")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Call service
	result, err := h.budgetService.DeleteBudgetItem(c.Request.Context(), budgetID, itemID, userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}
