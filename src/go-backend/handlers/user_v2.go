package handlers

import (
	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
	"wealthjourney/protobuf/v1"
)

// UserHandlers handles user-related HTTP requests.
type UserHandlers struct {
	userService service.UserService
}

// NewUserHandlers creates a new UserHandlers instance.
func NewUserHandlers(userService service.UserService) *UserHandlers {
	return &UserHandlers{
		userService: userService,
	}
}

// GetUser retrieves the authenticated user's profile.
// @Summary Get current user
// @Tags users
// @Produce json
// @Success 200 {object} types.APIResponse{data=protobufv1.User}
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/users [get]
func (h *UserHandlers) GetUser(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Call service
	result, err := h.userService.GetUser(c.Request.Context(), userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetUserByEmail retrieves a user by email.
// @Summary Get user by email
// @Tags users
// @Produce json
// @Param email path string true "User email"
// @Success 200 {object} types.APIResponse{data=protobufv1.User}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/users/{email} [get]
func (h *UserHandlers) GetUserByEmail(c *gin.Context) {
	email := c.Param("email")

	// Call service
	result, err := h.userService.GetUserByEmail(c.Request.Context(), email)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// ListUsers lists all users with pagination.
// @Summary List all users
// @Tags users
// @Produce json
// @Param page query int false "Page number (default: 1)"
// @Param page_size query int false "Page size (default: 20, max: 100)"
// @Param order_by query string false "Order by field (default: id)"
// @Param order query string false "Order direction (asc or desc, default: asc)"
// @Success 200 {object} types.APIResponse{data=map[string]interface{}}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/users/all [get]
func (h *UserHandlers) ListUsers(c *gin.Context) {
	// Parse pagination parameters
	params := parsePaginationParams(c)

	// Call service
	result, err := h.userService.ListUsers(c.Request.Context(), params)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, gin.H{
		"users":      result.Users,
		"pagination": result.Pagination,
	})
}

// CreateUser creates a new user.
// @Summary Create a new user
// @Tags users
// @Accept json
// @Produce json
// @Param request body object{email:string,name:string,picture:string} true "User creation request"
// @Success 201 {object} types.APIResponse{data=protobufv1.User}
// @Failure 400 {object} types.APIResponse
// @Failure 409 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/users [post]
func (h *UserHandlers) CreateUser(c *gin.Context) {
	var req struct {
		Email   string `json:"email" binding:"required,email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}

	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Call service
	result, err := h.userService.CreateUser(c.Request.Context(), req.Email, req.Name, req.Picture)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

// UpdateUser updates a user's information.
// @Summary Update current user
// @Tags users
// @Accept json
// @Produce json
// @Param request body object{email:string,name:string,picture:string} true "User update request"
// @Success 200 {object} types.APIResponse{data=protobufv1.User}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 409 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/users [put]
func (h *UserHandlers) UpdateUser(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req struct {
		Email   string `json:"email" binding:"omitempty,email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}

	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Call service
	result, err := h.userService.UpdateUser(c.Request.Context(), userID, req.Email, req.Name, req.Picture)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// DeleteUser deletes a user.
// @Summary Delete current user
// @Tags users
// @Produce json
// @Success 204
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/users [delete]
func (h *UserHandlers) DeleteUser(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Call service
	_, err := h.userService.DeleteUser(c.Request.Context(), userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.NoContent(c)
}

// UpdatePreferences updates a user's preferences, including currency preference.
// @Summary Update user preferences
// @Tags users
// @Accept json
// @Produce json
// @Param request body object{preferences:object{preferredCurrency:string}} true "User preferences update request"
// @Success 200 {object} types.APIResponse{data=protobufv1.User}
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 409 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/users/preferences [put]
func (h *UserHandlers) UpdatePreferences(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req struct {
		Preferences *struct {
			PreferredCurrency string `json:"preferredCurrency"`
			Language          string `json:"language"`
		} `json:"preferences" binding:"required"`
	}

	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Build protobuf request
	protoReq := &v1.UpdatePreferencesRequest{
		Preferences: &v1.UserPreferences{
			PreferredCurrency: req.Preferences.PreferredCurrency,
			Language:          req.Preferences.Language,
		},
	}

	// Call service
	result, err := h.userService.UpdatePreferences(c.Request.Context(), userID, protoReq)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}
