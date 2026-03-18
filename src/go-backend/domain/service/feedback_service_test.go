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

// mockFeedbackRepo implements repository.FeedbackRepository for testing.
type mockFeedbackRepo struct {
	mock.Mock
}

func (m *mockFeedbackRepo) Create(ctx context.Context, feedback *models.Feedback) error {
	args := m.Called(ctx, feedback)
	if args.Error(0) == nil {
		// Simulate DB setting ID and timestamps
		feedback.ID = 1
		feedback.CreatedAt = time.Now()
		feedback.UpdatedAt = time.Now()
	}
	return args.Error(0)
}

func (m *mockFeedbackRepo) ListByUserID(ctx context.Context, userID int32, opts repository.ListOptions) ([]*models.Feedback, int, error) {
	args := m.Called(ctx, userID, opts)
	return args.Get(0).([]*models.Feedback), args.Int(1), args.Error(2)
}

func (m *mockFeedbackRepo) CountRecentByUserID(ctx context.Context, userID int32, since time.Time) (int, error) {
	args := m.Called(ctx, userID, since)
	return args.Int(0), args.Error(1)
}

func TestSubmitFeedback_Success(t *testing.T) {
	repo := new(mockFeedbackRepo)
	svc := NewFeedbackService(repo)
	ctx := context.Background()

	repo.On("CountRecentByUserID", ctx, int32(1), mock.AnythingOfType("time.Time")).Return(0, nil)
	repo.On("Create", ctx, mock.AnythingOfType("*models.Feedback")).Return(nil)

	resp, err := svc.SubmitFeedback(ctx, 1, &v1.SubmitFeedbackRequest{
		Subject: "Test subject",
		Message: "Test message body",
	})

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.NotNil(t, resp.Feedback)
	assert.Equal(t, "Test subject", resp.Feedback.Subject)
	assert.Equal(t, "Test message body", resp.Feedback.Message)
	assert.Equal(t, v1.FeedbackStatus_FEEDBACK_STATUS_PENDING, resp.Feedback.Status)
	repo.AssertExpectations(t)
}

func TestSubmitFeedback_EmptySubject(t *testing.T) {
	repo := new(mockFeedbackRepo)
	svc := NewFeedbackService(repo)
	ctx := context.Background()

	resp, err := svc.SubmitFeedback(ctx, 1, &v1.SubmitFeedbackRequest{
		Subject: "",
		Message: "Test message",
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "subject is required")
}

func TestSubmitFeedback_SubjectTooLong(t *testing.T) {
	repo := new(mockFeedbackRepo)
	svc := NewFeedbackService(repo)
	ctx := context.Background()

	resp, err := svc.SubmitFeedback(ctx, 1, &v1.SubmitFeedbackRequest{
		Subject: strings.Repeat("a", 201),
		Message: "Test message",
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "200 characters")
}

func TestSubmitFeedback_EmptyMessage(t *testing.T) {
	repo := new(mockFeedbackRepo)
	svc := NewFeedbackService(repo)
	ctx := context.Background()

	resp, err := svc.SubmitFeedback(ctx, 1, &v1.SubmitFeedbackRequest{
		Subject: "Test subject",
		Message: "",
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "message is required")
}

func TestSubmitFeedback_MessageTooLong(t *testing.T) {
	repo := new(mockFeedbackRepo)
	svc := NewFeedbackService(repo)
	ctx := context.Background()

	resp, err := svc.SubmitFeedback(ctx, 1, &v1.SubmitFeedbackRequest{
		Subject: "Test subject",
		Message: strings.Repeat("a", 2001),
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "2000 characters")
}

func TestSubmitFeedback_RateLimited(t *testing.T) {
	repo := new(mockFeedbackRepo)
	svc := NewFeedbackService(repo)
	ctx := context.Background()

	repo.On("CountRecentByUserID", ctx, int32(1), mock.AnythingOfType("time.Time")).Return(10, nil)

	resp, err := svc.SubmitFeedback(ctx, 1, &v1.SubmitFeedbackRequest{
		Subject: "Test subject",
		Message: "Test message",
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Equal(t, 429, apperrors.GetStatusCode(err))
	repo.AssertExpectations(t)
}

func TestSubmitFeedback_WhitespaceOnlySubject(t *testing.T) {
	repo := new(mockFeedbackRepo)
	svc := NewFeedbackService(repo)
	ctx := context.Background()

	resp, err := svc.SubmitFeedback(ctx, 1, &v1.SubmitFeedbackRequest{
		Subject: "   ",
		Message: "Test message",
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "subject is required")
}

func TestListMyFeedback_Success(t *testing.T) {
	repo := new(mockFeedbackRepo)
	svc := NewFeedbackService(repo)
	ctx := context.Background()

	now := time.Now()
	feedbacks := []*models.Feedback{
		{ID: 1, UserID: 1, Subject: "First", Message: "First msg", Status: 1, CreatedAt: now, UpdatedAt: now},
		{ID: 2, UserID: 1, Subject: "Second", Message: "Second msg", Status: 2, CreatedAt: now, UpdatedAt: now},
	}

	repo.On("ListByUserID", ctx, int32(1), mock.AnythingOfType("repository.ListOptions")).Return(feedbacks, 2, nil)

	resp, err := svc.ListMyFeedback(ctx, 1, types.PaginationParams{Page: 1, PageSize: 10})

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Len(t, resp.Feedback, 2)
	assert.Equal(t, "First", resp.Feedback[0].Subject)
	assert.Equal(t, int32(2), resp.Pagination.TotalCount)
	assert.Equal(t, int32(1), resp.Pagination.TotalPages)
	repo.AssertExpectations(t)
}

func TestListMyFeedback_Empty(t *testing.T) {
	repo := new(mockFeedbackRepo)
	svc := NewFeedbackService(repo)
	ctx := context.Background()

	repo.On("ListByUserID", ctx, int32(1), mock.AnythingOfType("repository.ListOptions")).Return([]*models.Feedback{}, 0, nil)

	resp, err := svc.ListMyFeedback(ctx, 1, types.PaginationParams{Page: 1, PageSize: 10})

	assert.NoError(t, err)
	assert.True(t, resp.Success)
	assert.Len(t, resp.Feedback, 0)
	assert.Equal(t, int32(0), resp.Pagination.TotalCount)
	repo.AssertExpectations(t)
}

func TestSubmitFeedback_InvalidUserID(t *testing.T) {
	repo := new(mockFeedbackRepo)
	svc := NewFeedbackService(repo)
	ctx := context.Background()

	resp, err := svc.SubmitFeedback(ctx, 0, &v1.SubmitFeedbackRequest{
		Subject: "Test",
		Message: "Test message",
	})

	assert.Nil(t, resp)
	assert.Error(t, err)
}
