package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/types"
	v1 "wealthjourney/protobuf/v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// mockAdminUserRepo implements repository.UserRepository for admin service testing.
type mockAdminUserRepo struct {
	mock.Mock
}

func (m *mockAdminUserRepo) Create(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *mockAdminUserRepo) GetByID(ctx context.Context, id int32) (*models.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *mockAdminUserRepo) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *mockAdminUserRepo) List(ctx context.Context, opts repository.ListOptions) ([]*models.User, int, error) {
	args := m.Called(ctx, opts)
	return args.Get(0).([]*models.User), args.Int(1), args.Error(2)
}

func (m *mockAdminUserRepo) Update(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *mockAdminUserRepo) Delete(ctx context.Context, id int32) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *mockAdminUserRepo) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	args := m.Called(ctx, email)
	return args.Bool(0), args.Error(1)
}

func (m *mockAdminUserRepo) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	args := m.Called(ctx, username)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *mockAdminUserRepo) ListWithSearch(ctx context.Context, search string, opts repository.ListOptions) ([]*models.User, int, error) {
	args := m.Called(ctx, search, opts)
	return args.Get(0).([]*models.User), args.Int(1), args.Error(2)
}

// newAdminService creates an admin service with the given mocks for testing.
func newTestAdminService(userRepo *mockAdminUserRepo, feedbackRepo *mockFeedbackRepo) AdminService {
	return NewAdminService(userRepo, feedbackRepo)
}

// --- ListUsers tests ---

func TestAdminService_ListUsers_Success(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	email := "user@test.com"
	users := []*models.User{
		{ID: 1, Name: "Alice", Email: &email, IsAdmin: true, CreatedAt: time.Now()},
		{ID: 2, Name: "Bob", Email: &email, IsAdmin: false, CreatedAt: time.Now()},
	}

	userRepo.On("ListWithSearch", ctx, "", mock.AnythingOfType("repository.ListOptions")).Return(users, 2, nil)

	resp, err := svc.ListUsers(ctx, "", types.PaginationParams{Page: 1, PageSize: 10})

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Len(t, resp.Users, 2)
	assert.Equal(t, "Alice", resp.Users[0].Name)
	assert.Equal(t, int32(2), resp.Pagination.TotalCount)
	assert.Equal(t, int32(1), resp.Pagination.TotalPages)
	userRepo.AssertExpectations(t)
}

func TestAdminService_ListUsers_EmptyResult(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	userRepo.On("ListWithSearch", ctx, "", mock.AnythingOfType("repository.ListOptions")).Return([]*models.User{}, 0, nil)

	resp, err := svc.ListUsers(ctx, "", types.PaginationParams{Page: 1, PageSize: 10})

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Len(t, resp.Users, 0)
	assert.Equal(t, int32(0), resp.Pagination.TotalCount)
	userRepo.AssertExpectations(t)
}

func TestAdminService_ListUsers_SearchTrimmed(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	// Search with whitespace should be trimmed
	userRepo.On("ListWithSearch", ctx, "alice", mock.AnythingOfType("repository.ListOptions")).Return([]*models.User{}, 0, nil)

	resp, err := svc.ListUsers(ctx, "  alice  ", types.PaginationParams{Page: 1, PageSize: 10})

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	userRepo.AssertExpectations(t)
}

func TestAdminService_ListUsers_SearchTooLong(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	longSearch := strings.Repeat("a", 101)
	resp, err := svc.ListUsers(ctx, longSearch, types.PaginationParams{Page: 1, PageSize: 10})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "100 characters")
	assert.Equal(t, 400, apperrors.GetStatusCode(err))
}

// --- ToggleAdminRole tests ---

func TestAdminService_ToggleAdminRole_GrantAdmin(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	user := &models.User{ID: 2, Name: "Bob", IsAdmin: false, CreatedAt: time.Now()}
	userRepo.On("GetByID", ctx, int32(2)).Return(user, nil)
	userRepo.On("Update", ctx, mock.AnythingOfType("*models.User")).Return(nil)

	resp, err := svc.ToggleAdminRole(ctx, 1, &v1.AdminToggleRoleRequest{UserId: 2, IsAdmin: true})

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Contains(t, resp.Message, "granted")
	assert.True(t, resp.User.IsAdmin)
	userRepo.AssertExpectations(t)
}

func TestAdminService_ToggleAdminRole_RevokeAdmin(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	user := &models.User{ID: 2, Name: "Bob", IsAdmin: true, CreatedAt: time.Now()}
	userRepo.On("GetByID", ctx, int32(2)).Return(user, nil)
	userRepo.On("Update", ctx, mock.AnythingOfType("*models.User")).Return(nil)

	resp, err := svc.ToggleAdminRole(ctx, 1, &v1.AdminToggleRoleRequest{UserId: 2, IsAdmin: false})

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Contains(t, resp.Message, "revoked")
	assert.False(t, resp.User.IsAdmin)
	userRepo.AssertExpectations(t)
}

func TestAdminService_ToggleAdminRole_SelfProtection(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	// Admin (ID=1) tries to modify their own role
	resp, err := svc.ToggleAdminRole(ctx, 1, &v1.AdminToggleRoleRequest{UserId: 1, IsAdmin: false})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cannot modify your own admin role")
	assert.Equal(t, 403, apperrors.GetStatusCode(err))
}

func TestAdminService_ToggleAdminRole_UserNotFound(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	userRepo.On("GetByID", ctx, int32(99)).Return(nil, apperrors.NewNotFoundError("user"))

	resp, err := svc.ToggleAdminRole(ctx, 1, &v1.AdminToggleRoleRequest{UserId: 99, IsAdmin: true})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Equal(t, 404, apperrors.GetStatusCode(err))
	userRepo.AssertExpectations(t)
}

// --- ListFeedback tests ---

func TestAdminService_ListFeedback_AllStatuses(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	now := time.Now()
	feedbacks := []*models.Feedback{
		{ID: 1, UserID: 1, Subject: "Bug", Message: "Bug report", Status: 1, CreatedAt: now, UpdatedAt: now},
		{ID: 2, UserID: 2, Subject: "Feature", Message: "Feature request", Status: 2, CreatedAt: now, UpdatedAt: now},
	}

	feedbackRepo.On("ListAll", ctx, int16(0), mock.AnythingOfType("repository.ListOptions")).Return(feedbacks, 2, nil)

	resp, err := svc.ListFeedback(ctx, 0, types.PaginationParams{Page: 1, PageSize: 10})

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Len(t, resp.Feedback, 2)
	assert.Equal(t, int32(2), resp.Pagination.TotalCount)
	feedbackRepo.AssertExpectations(t)
}

func TestAdminService_ListFeedback_WithFilter(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	now := time.Now()
	feedbacks := []*models.Feedback{
		{ID: 1, UserID: 1, Subject: "Bug", Message: "Bug report", Status: 1, CreatedAt: now, UpdatedAt: now},
	}

	feedbackRepo.On("ListAll", ctx, int16(1), mock.AnythingOfType("repository.ListOptions")).Return(feedbacks, 1, nil)

	resp, err := svc.ListFeedback(ctx, 1, types.PaginationParams{Page: 1, PageSize: 10})

	assert.NoError(t, err)
	assert.Len(t, resp.Feedback, 1)
	assert.Equal(t, v1.FeedbackStatus(1), resp.Feedback[0].Status)
	feedbackRepo.AssertExpectations(t)
}

func TestAdminService_ListFeedback_InvalidStatus(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	resp, err := svc.ListFeedback(ctx, 4, types.PaginationParams{Page: 1, PageSize: 10})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "status filter must be between 0 and 3")
	assert.Equal(t, 400, apperrors.GetStatusCode(err))
}

// --- UpdateFeedback tests ---

func TestAdminService_UpdateFeedback_Success(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	now := time.Now()
	feedback := &models.Feedback{ID: 1, UserID: 1, Subject: "Bug", Message: "msg", Status: 1, CreatedAt: now, UpdatedAt: now}
	feedbackRepo.On("GetByID", ctx, int32(1)).Return(feedback, nil)
	feedbackRepo.On("Update", ctx, mock.AnythingOfType("*models.Feedback")).Return(nil)

	resp, err := svc.UpdateFeedback(ctx, 1, &v1.AdminUpdateFeedbackRequest{
		FeedbackId: 1,
		Status:     2,
		AdminNote:  "Reviewing this",
	})

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Contains(t, resp.Message, "updated")
	assert.NotNil(t, resp.Feedback)
	feedbackRepo.AssertExpectations(t)
}

func TestAdminService_UpdateFeedback_InvalidStatus(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	resp, err := svc.UpdateFeedback(ctx, 1, &v1.AdminUpdateFeedbackRequest{
		FeedbackId: 1,
		Status:     0,
		AdminNote:  "",
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "status must be between 1 and 3")
	assert.Equal(t, 400, apperrors.GetStatusCode(err))
}

func TestAdminService_UpdateFeedback_StripHTMLTags(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	now := time.Now()
	feedback := &models.Feedback{ID: 1, UserID: 1, Subject: "Bug", Message: "msg", Status: 1, CreatedAt: now, UpdatedAt: now}
	feedbackRepo.On("GetByID", ctx, int32(1)).Return(feedback, nil)
	feedbackRepo.On("Update", ctx, mock.MatchedBy(func(f *models.Feedback) bool {
		// Verify HTML tags were stripped
		return f.AdminNote == "alert('xss')" && f.Status == 2
	})).Return(nil)

	resp, err := svc.UpdateFeedback(ctx, 1, &v1.AdminUpdateFeedbackRequest{
		FeedbackId: 1,
		Status:     2,
		AdminNote:  "<script>alert('xss')</script>",
	})

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	feedbackRepo.AssertExpectations(t)
}

func TestAdminService_UpdateFeedback_AdminNoteTooLong(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	longNote := strings.Repeat("a", 2001)
	resp, err := svc.UpdateFeedback(ctx, 1, &v1.AdminUpdateFeedbackRequest{
		FeedbackId: 1,
		Status:     2,
		AdminNote:  longNote,
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "2000 characters")
	assert.Equal(t, 400, apperrors.GetStatusCode(err))
}

// --- DeleteFeedback tests ---

func TestAdminService_DeleteFeedback_Success(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	now := time.Now()
	feedback := &models.Feedback{ID: 1, UserID: 1, Subject: "Bug", Message: "msg", Status: 1, CreatedAt: now, UpdatedAt: now}
	feedbackRepo.On("GetByID", ctx, int32(1)).Return(feedback, nil)
	feedbackRepo.On("Delete", ctx, int32(1)).Return(nil)

	resp, err := svc.DeleteFeedback(ctx, 1)

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Contains(t, resp.Message, "deleted")
	feedbackRepo.AssertExpectations(t)
}

func TestAdminService_DeleteFeedback_NotFound(t *testing.T) {
	userRepo := new(mockAdminUserRepo)
	feedbackRepo := new(mockFeedbackRepo)
	svc := newTestAdminService(userRepo, feedbackRepo)
	ctx := context.Background()

	feedbackRepo.On("GetByID", ctx, int32(99)).Return(nil, apperrors.NewNotFoundError("feedback"))

	resp, err := svc.DeleteFeedback(ctx, 99)

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Equal(t, 404, apperrors.GetStatusCode(err))
	feedbackRepo.AssertExpectations(t)
}
