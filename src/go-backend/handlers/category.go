package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/handler"
	transactionv1 "wealthjourney/protobuf/v1"
)

// CategoryHandlers handles category-related HTTP requests.
type CategoryHandlers struct {
	categoryService service.CategoryService
}

// NewCategoryHandlers creates a new CategoryHandlers instance.
func NewCategoryHandlers(categoryService service.CategoryService) *CategoryHandlers {
	return &CategoryHandlers{
		categoryService: categoryService,
	}
}

// CreateCategory creates a new category.
// @Summary Create a new category
// @Tags categories
// @Accept json
// @Produce json
// @Param request body transactionv1.CreateCategoryRequest true "Category creation request"
// @Success 201 {object} types.APIResponse{data=transactionv1.Category}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/categories [post]
func (h *CategoryHandlers) CreateCategory(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Bind and validate request
	var req transactionv1.CreateCategoryRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Validate required fields
	if req.Name == "" {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.CategoryNameRequired, "name is required"))
		return
	}

	if req.Type == transactionv1.CategoryType_CATEGORY_TYPE_UNSPECIFIED {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.TransactionTypeRequired, "type is required (Income or Expense)"))
		return
	}

	// Call service
	result, err := h.categoryService.CreateCategory(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

// GetCategory retrieves a category by ID.
// @Summary Get a category
// @Tags categories
// @Produce json
// @Param id path int true "Category ID"
// @Success 200 {object} types.APIResponse{data=transactionv1.Category}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/categories/{id} [get]
func (h *CategoryHandlers) GetCategory(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse category ID
	categoryID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Call service
	result, err := h.categoryService.GetCategory(c.Request.Context(), categoryID, userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// ListCategories lists categories with optional type filtering and pagination.
// @Summary List categories
// @Tags categories
// @Produce json
// @Param page query int false "Page number (default: 1)"
// @Param page_size query int false "Page size (default: 20, max: 100)"
// @Param type query string false "Filter by type (Income, Expense)"
// @Success 200 {object} types.APIResponse{data=transactionv1.ListCategoriesResponse}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/categories [get]
func (h *CategoryHandlers) ListCategories(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Build request from query parameters
	req := &transactionv1.ListCategoriesRequest{
		Pagination: parsePaginationParamsProto(c),
		Type:       parseCategoryTypeFilter(c),
	}

	// Call service
	result, err := h.categoryService.ListCategories(c.Request.Context(), userID, req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// UpdateCategory updates a category's name.
// @Summary Update a category
// @Tags categories
// @Accept json
// @Produce json
// @Param id path int true "Category ID"
// @Param request body transactionv1.UpdateCategoryRequest true "Category update request"
// @Success 200 {object} types.APIResponse{data=transactionv1.Category}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/categories/{id} [put]
func (h *CategoryHandlers) UpdateCategory(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse category ID
	categoryID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Bind and validate request
	var req transactionv1.UpdateCategoryRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Validate required fields
	if req.Name == "" {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.CategoryNameRequired, "name is required"))
		return
	}

	// Call service
	result, err := h.categoryService.UpdateCategory(c.Request.Context(), categoryID, userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// DeleteCategory deletes a category.
// @Summary Delete a category
// @Tags categories
// @Produce json
// @Param id path int true "Category ID"
// @Success 200 {object} types.APIResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 403 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/categories/{id} [delete]
func (h *CategoryHandlers) DeleteCategory(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse category ID
	categoryID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Call service
	result, err := h.categoryService.DeleteCategory(c.Request.Context(), categoryID, userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// Helper functions for parsing query parameters

// parseCategoryTypeFilter parses the category type filter from query string.
// Supports numeric enum values (1 = INCOME, 2 = EXPENSE).
func parseCategoryTypeFilter(c *gin.Context) *transactionv1.CategoryType {
	if typeStr := c.Query("type"); typeStr != "" {
		if typeNum, err := strconv.ParseInt(typeStr, 10, 32); err == nil {
			switch transactionv1.CategoryType(typeNum) {
			case transactionv1.CategoryType_CATEGORY_TYPE_INCOME:
				categoryType := transactionv1.CategoryType_CATEGORY_TYPE_INCOME
				return &categoryType
			case transactionv1.CategoryType_CATEGORY_TYPE_EXPENSE:
				categoryType := transactionv1.CategoryType_CATEGORY_TYPE_EXPENSE
				return &categoryType
			}
		}
	}
	return nil
}
