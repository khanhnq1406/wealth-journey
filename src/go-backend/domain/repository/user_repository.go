package repository

import (
	"context"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
	apperrors "wealthjourney/pkg/errors"
)

// userRepository implements UserRepository using GORM.
type userRepository struct {
	*BaseRepository
}

// NewUserRepository creates a new UserRepository.
func NewUserRepository(db *database.Database) UserRepository {
	return &userRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

// Create creates a new user.
func (r *userRepository) Create(ctx context.Context, user *models.User) error {
	result := r.db.DB.WithContext(ctx).Create(user)
	if result.Error != nil {
		return r.handleDBError(result.Error, "user", "create user")
	}
	return nil
}

// GetByID retrieves a user by ID.
func (r *userRepository) GetByID(ctx context.Context, id int32) (*models.User, error) {
	var user models.User
	err := r.executeGetByID(ctx, &user, id, "user")
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByEmail retrieves a user by email.
func (r *userRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	result := r.db.DB.WithContext(ctx).Where("email = ?", email).First(&user)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "user", "get user by email")
	}
	return &user, nil
}

// List retrieves users with pagination.
func (r *userRepository) List(ctx context.Context, opts ListOptions) ([]*models.User, int, error) {
	var users []*models.User
	var total int64

	// Get total count
	if err := r.db.DB.WithContext(ctx).Model(&models.User{}).Count(&total).Error; err != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to count users", err)
	}

	// Apply ordering and pagination
	orderClause := r.buildOrderClause(opts)
	query := r.db.DB.WithContext(ctx).Order(orderClause)
	query = r.applyPagination(query, opts)

	result := query.Find(&users)
	if result.Error != nil {
		return nil, 0, apperrors.NewInternalErrorWithCause("failed to list users", result.Error)
	}

	return users, int(total), nil
}

// Update updates a user.
func (r *userRepository) Update(ctx context.Context, user *models.User) error {
	return r.executeUpdate(ctx, user, "user")
}

// Delete soft deletes a user by ID.
func (r *userRepository) Delete(ctx context.Context, id int32) error {
	return r.executeDelete(ctx, &models.User{}, id, "user")
}

// GetByUsername retrieves a user by username.
func (r *userRepository) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	var user models.User
	result := r.db.DB.WithContext(ctx).Where("username = ?", username).First(&user)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "user", "get user by username")
	}
	return &user, nil
}

// Exists checks if a user exists by email.
func (r *userRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	var count int64
	result := r.db.DB.WithContext(ctx).Model(&models.User{}).Where("email = ?", email).Count(&count)
	if result.Error != nil {
		return false, apperrors.NewInternalErrorWithCause("failed to check user existence", result.Error)
	}
	return count > 0, nil
}
