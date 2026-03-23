package service

import (
	"context"
	"strings"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/types"
	"wealthjourney/pkg/validator"
	v1 "wealthjourney/protobuf/v1"
)

const maxFeedbackPerHour = 10

type feedbackService struct {
	feedbackRepo repository.FeedbackRepository
}

func NewFeedbackService(feedbackRepo repository.FeedbackRepository) FeedbackService {
	return &feedbackService{
		feedbackRepo: feedbackRepo,
	}
}

func (s *feedbackService) SubmitFeedback(ctx context.Context, userID int32, req *v1.SubmitFeedbackRequest) (*v1.SubmitFeedbackResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Trim and validate subject
	subject := strings.TrimSpace(req.Subject)
	if subject == "" {
		return nil, apperrors.NewValidationError("subject is required")
	}
	if len(subject) > 200 {
		return nil, apperrors.NewValidationError("subject must be 200 characters or less")
	}

	// Trim and validate message
	message := strings.TrimSpace(req.Message)
	if message == "" {
		return nil, apperrors.NewValidationError("message is required")
	}
	if len(message) > 2000 {
		return nil, apperrors.NewValidationError("message must be 2000 characters or less")
	}

	// Rate limit check
	oneHourAgo := time.Now().Add(-1 * time.Hour)
	count, err := s.feedbackRepo.CountRecentByUserID(ctx, userID, oneHourAgo)
	if err != nil {
		return nil, err
	}
	if count >= maxFeedbackPerHour {
		return nil, apperrors.NewRateLimitErrorWithCode(apperrors.Codes.FeedbackRateLimited, "Maximum 10 feedback submissions per hour. Please try again later.")
	}

	feedback := &models.Feedback{
		UserID:  userID,
		Subject: subject,
		Message: message,
		Status:  1, // pending
	}

	if err := s.feedbackRepo.Create(ctx, feedback); err != nil {
		return nil, err
	}

	return &v1.SubmitFeedbackResponse{
		Success: true,
		Message: "Feedback submitted successfully",
		Feedback: &v1.FeedbackItem{
			Id:        feedback.ID,
			Subject:   feedback.Subject,
			Message:   feedback.Message,
			Status:    v1.FeedbackStatus(feedback.Status),
			CreatedAt: feedback.CreatedAt.Unix(),
			UpdatedAt: feedback.UpdatedAt.Unix(),
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *feedbackService) ListMyFeedback(ctx context.Context, userID int32, params types.PaginationParams) (*v1.ListMyFeedbackResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	opts := repository.ListOptions{
		Limit:   params.PageSize,
		Offset:  (params.Page - 1) * params.PageSize,
		OrderBy: "created_at",
		Order:   "desc",
	}

	feedbacks, total, err := s.feedbackRepo.ListByUserID(ctx, userID, opts)
	if err != nil {
		return nil, err
	}

	items := make([]*v1.FeedbackItem, len(feedbacks))
	for i, f := range feedbacks {
		items[i] = &v1.FeedbackItem{
			Id:        f.ID,
			Subject:   f.Subject,
			Message:   f.Message,
			Status:    v1.FeedbackStatus(f.Status),
			CreatedAt: f.CreatedAt.Unix(),
			UpdatedAt: f.UpdatedAt.Unix(),
		}
	}

	totalPages := int32(0)
	if params.PageSize > 0 {
		totalPages = (int32(total) + int32(params.PageSize) - 1) / int32(params.PageSize)
	}

	return &v1.ListMyFeedbackResponse{
		Success:  true,
		Message:  "Feedback retrieved successfully",
		Feedback: items,
		Pagination: &v1.PaginationResult{
			TotalCount:  int32(total),
			TotalPages:  totalPages,
			Page:        int32(params.Page),
			PageSize:    int32(params.PageSize),
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
