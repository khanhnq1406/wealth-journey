package service

import (
	"context"
	"strings"
	"time"

	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/types"
	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"

	v1 "wealthjourney/protobuf/v1"
)

// categoryService implements CategoryService.
type categoryService struct {
	categoryRepo repository.CategoryRepository
}

// NewCategoryService creates a new CategoryService.
func NewCategoryService(categoryRepo repository.CategoryRepository) CategoryService {
	return &categoryService{
		categoryRepo: categoryRepo,
	}
}

// CreateCategory creates a new category for a user.
func (s *categoryService) CreateCategory(ctx context.Context, userID int32, req *v1.CreateCategoryRequest) (*v1.CreateCategoryResponse, error) {
	// Validate input
	if err := s.validateCategoryName(req.Name); err != nil {
		return nil, err
	}

	if err := s.validateCategoryType(req.Type); err != nil {
		return nil, err
	}

	// Create category
	category := &models.Category{
		UserID: userID,
		Name:   strings.TrimSpace(req.Name),
		Type:   int32(req.Type),
	}

	err := s.categoryRepo.Create(ctx, category)
	if err != nil {
		return nil, err
	}

	return &v1.CreateCategoryResponse{
		Success:   true,
		Message:   "Category created successfully",
		Data:      s.modelToProto(category),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetCategory retrieves a category by ID.
func (s *categoryService) GetCategory(ctx context.Context, categoryID int32, userID int32) (*v1.GetCategoryResponse, error) {
	category, err := s.categoryRepo.GetByIDForUser(ctx, categoryID, userID)
	if err != nil {
		return nil, err
	}

	return &v1.GetCategoryResponse{
		Success:   true,
		Message:   "Category retrieved successfully",
		Data:      s.modelToProto(category),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ListCategories retrieves categories for a user with optional type filtering.
func (s *categoryService) ListCategories(ctx context.Context, userID int32, req *v1.ListCategoriesRequest) (*v1.ListCategoriesResponse, error) {
	// Parse pagination params
	params := s.parsePaginationParams(req.Pagination)

	// Get categories
	categories, total, err := s.categoryRepo.ListByUserID(ctx, userID, req.Type, repository.ListOptions{
		Limit:   params.PageSize,
		Offset:  (params.Page - 1) * params.PageSize,
		OrderBy: params.OrderBy,
		Order:   params.Order,
	})
	if err != nil {
		return nil, err
	}

	// Convert to protobuf
	protoCategories := make([]*v1.Category, len(categories))
	for i, cat := range categories {
		protoCategories[i] = s.modelToProto(cat)
	}

	// Build pagination result
	totalPages := int32(total) / int32(params.PageSize)
	if int32(total)%int32(params.PageSize) > 0 {
		totalPages++
	}

	return &v1.ListCategoriesResponse{
		Success:    true,
		Message:    "Categories retrieved successfully",
		Categories: protoCategories,
		Pagination: &v1.PaginationResult{
			Page:       int32(params.Page),
			PageSize:   int32(params.PageSize),
			TotalCount: int32(total),
			TotalPages: totalPages,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// UpdateCategory updates a category's name.
func (s *categoryService) UpdateCategory(ctx context.Context, categoryID int32, userID int32, req *v1.UpdateCategoryRequest) (*v1.UpdateCategoryResponse, error) {
	// Validate input
	if err := s.validateCategoryName(req.Name); err != nil {
		return nil, err
	}

	// Get existing category
	category, err := s.categoryRepo.GetByIDForUser(ctx, categoryID, userID)
	if err != nil {
		return nil, err
	}

	// Update category
	category.Name = strings.TrimSpace(req.Name)

	err = s.categoryRepo.Update(ctx, category)
	if err != nil {
		return nil, err
	}

	return &v1.UpdateCategoryResponse{
		Success:   true,
		Message:   "Category updated successfully",
		Data:      s.modelToProto(category),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// DeleteCategory deletes a category.
func (s *categoryService) DeleteCategory(ctx context.Context, categoryID int32, userID int32) (*v1.DeleteCategoryResponse, error) {
	// Verify ownership
	_, err := s.categoryRepo.GetByIDForUser(ctx, categoryID, userID)
	if err != nil {
		return nil, err
	}

	// Delete category
	err = s.categoryRepo.Delete(ctx, categoryID)
	if err != nil {
		return nil, err
	}

	return &v1.DeleteCategoryResponse{
		Success:   true,
		Message:   "Category deleted successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// CreateDefaultCategories creates default categories for a new user.
func (s *categoryService) CreateDefaultCategories(ctx context.Context, userID int32) error {
	return s.categoryRepo.CreateDefaultCategories(ctx, userID)
}

// GetOrCreateBalanceAdjustmentCategory gets or creates a balance adjustment category.
// Based on whether the adjustment is positive (income) or negative (expense).
func (s *categoryService) GetOrCreateBalanceAdjustmentCategory(ctx context.Context, userID int32, isPositiveAdjustment bool) (*models.Category, error) {
	categoryType := v1.CategoryType_CATEGORY_TYPE_EXPENSE
	if isPositiveAdjustment {
		categoryType = v1.CategoryType_CATEGORY_TYPE_INCOME
	}

	categoryName := "Balance Adjustment"

	// Try to get existing category
	category, err := s.categoryRepo.GetByNameAndType(ctx, userID, categoryName, categoryType)
	if err == nil && category != nil {
		return category, nil
	}

	// Create new category if it doesn't exist
	newCategory := &models.Category{
		UserID: userID,
		Name:   categoryName,
		Type:   int32(categoryType),
	}

	if err := s.categoryRepo.Create(ctx, newCategory); err != nil {
		return nil, apperrors.NewInternalErrorWithCodeAndCause(apperrors.Codes.InternalError, "failed to create balance adjustment category", err)
	}

	return newCategory, nil
}

// GetOrCreateInitialBalanceCategory gets or creates an initial balance category (income type).
func (s *categoryService) GetOrCreateInitialBalanceCategory(ctx context.Context, userID int32) (*models.Category, error) {
	categoryName := "Initial Balance"
	categoryType := v1.CategoryType_CATEGORY_TYPE_INCOME

	// Try to get existing category
	category, err := s.categoryRepo.GetByNameAndType(ctx, userID, categoryName, categoryType)
	if err == nil && category != nil {
		return category, nil
	}

	// Create new category if it doesn't exist
	newCategory := &models.Category{
		UserID: userID,
		Name:   categoryName,
		Type:   int32(categoryType),
	}

	if err := s.categoryRepo.Create(ctx, newCategory); err != nil {
		return nil, apperrors.NewInternalErrorWithCodeAndCause(apperrors.Codes.InternalError, "failed to create initial balance category", err)
	}

	return newCategory, nil
}

// Helper methods

// validateCategoryName validates the category name.
func (s *categoryService) validateCategoryName(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.CategoryNameRequired, "category name is required")
	}
	if len(name) > 100 {
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.CategoryNameTooLong, "category name must be 100 characters or less")
	}
	return nil
}

// validateCategoryType validates the category type.
func (s *categoryService) validateCategoryType(categoryType v1.CategoryType) error {
	switch categoryType {
	case v1.CategoryType_CATEGORY_TYPE_INCOME, v1.CategoryType_CATEGORY_TYPE_EXPENSE:
		return nil
	default:
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.CategoryTypeInvalid, "invalid category type")
	}
}

// parsePaginationParams converts protobuf pagination params to internal types.
func (s *categoryService) parsePaginationParams(params *v1.PaginationParams) types.PaginationParams {
	if params == nil {
		return types.NewPaginationParams()
	}

	p := types.PaginationParams{
		Page:     int(params.Page),
		PageSize: int(params.PageSize),
		OrderBy:  params.OrderBy,
		Order:    params.Order,
	}
	return p.Validate()
}

// modelToProto converts a model Category to protobuf.
func (s *categoryService) modelToProto(category *models.Category) *v1.Category {
	return &v1.Category{
		Id:        category.ID,
		UserId:    category.UserID,
		Name:      category.Name,
		Type:      v1.CategoryType(category.Type),
		CreatedAt: category.CreatedAt.Unix(),
		UpdatedAt: category.UpdatedAt.Unix(),
	}
}
