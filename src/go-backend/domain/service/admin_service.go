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

type adminService struct {
	userRepo     repository.UserRepository
	feedbackRepo repository.FeedbackRepository
}

func NewAdminService(userRepo repository.UserRepository, feedbackRepo repository.FeedbackRepository) AdminService {
	return &adminService{
		userRepo:     userRepo,
		feedbackRepo: feedbackRepo,
	}
}

func (s *adminService) ListUsers(ctx context.Context, search string, params types.PaginationParams) (*v1.AdminListUsersResponse, error) {
	search = strings.TrimSpace(search)
	if len(search) > 100 {
		return nil, apperrors.NewValidationError("search query must be 100 characters or less")
	}

	opts := repository.ListOptions{
		Limit:   params.PageSize,
		Offset:  (params.Page - 1) * params.PageSize,
		OrderBy: "created_at",
		Order:   "desc",
	}

	users, total, err := s.userRepo.ListWithSearch(ctx, search, opts)
	if err != nil {
		return nil, err
	}

	items := make([]*v1.AdminUserItem, len(users))
	for i, u := range users {
		items[i] = mapUserToAdminItem(u)
	}

	totalPages := int32(0)
	if params.PageSize > 0 {
		totalPages = (int32(total) + int32(params.PageSize) - 1) / int32(params.PageSize)
	}

	return &v1.AdminListUsersResponse{
		Success: true,
		Message: "Users retrieved successfully",
		Users:   items,
		Pagination: &v1.PaginationResult{
			TotalCount: int32(total),
			TotalPages: totalPages,
			Page:       int32(params.Page),
			PageSize:   int32(params.PageSize),
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *adminService) ToggleAdminRole(ctx context.Context, adminUserID int32, req *v1.AdminToggleRoleRequest) (*v1.AdminToggleRoleResponse, error) {
	if err := validator.ID(req.UserId); err != nil {
		return nil, err
	}

	// Self-protection: admin cannot toggle their own role
	if adminUserID == req.UserId {
		return nil, apperrors.NewForbiddenError("cannot modify your own admin role")
	}

	user, err := s.userRepo.GetByID(ctx, req.UserId)
	if err != nil {
		return nil, err
	}

	user.IsAdmin = req.IsAdmin
	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}

	action := "granted"
	if !req.IsAdmin {
		action = "revoked"
	}

	return &v1.AdminToggleRoleResponse{
		Success:   true,
		Message:   "Admin role " + action + " successfully",
		User:      mapUserToAdminItem(user),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *adminService) ListFeedback(ctx context.Context, statusFilter int32, params types.PaginationParams) (*v1.AdminListFeedbackResponse, error) {
	if statusFilter < 0 || statusFilter > 3 {
		return nil, apperrors.NewValidationError("status filter must be between 0 and 3")
	}

	opts := repository.ListOptions{
		Limit:   params.PageSize,
		Offset:  (params.Page - 1) * params.PageSize,
		OrderBy: "created_at",
		Order:   "desc",
	}

	feedbacks, total, err := s.feedbackRepo.ListAll(ctx, int16(statusFilter), opts)
	if err != nil {
		return nil, err
	}

	items := make([]*v1.AdminFeedbackItem, len(feedbacks))
	for i, f := range feedbacks {
		items[i] = mapFeedbackToAdminItem(f)
	}

	totalPages := int32(0)
	if params.PageSize > 0 {
		totalPages = (int32(total) + int32(params.PageSize) - 1) / int32(params.PageSize)
	}

	return &v1.AdminListFeedbackResponse{
		Success:  true,
		Message:  "Feedback retrieved successfully",
		Feedback: items,
		Pagination: &v1.PaginationResult{
			TotalCount: int32(total),
			TotalPages: totalPages,
			Page:       int32(params.Page),
			PageSize:   int32(params.PageSize),
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *adminService) UpdateFeedback(ctx context.Context, feedbackID int32, req *v1.AdminUpdateFeedbackRequest) (*v1.AdminUpdateFeedbackResponse, error) {
	if err := validator.ID(feedbackID); err != nil {
		return nil, err
	}

	if req.Status < 1 || req.Status > 3 {
		return nil, apperrors.NewValidationError("status must be between 1 and 3")
	}

	adminNote := strings.TrimSpace(req.AdminNote)
	if len(adminNote) > 2000 {
		return nil, apperrors.NewValidationError("admin note must be 2000 characters or less")
	}
	// Strip HTML tags to prevent XSS (reuses package-level regex from site_settings_service.go)
	adminNote = htmlTagRegex.ReplaceAllString(adminNote, "")

	feedback, err := s.feedbackRepo.GetByID(ctx, feedbackID)
	if err != nil {
		return nil, err
	}

	feedback.Status = int16(req.Status)
	feedback.AdminNote = adminNote

	if err := s.feedbackRepo.Update(ctx, feedback); err != nil {
		return nil, err
	}

	return &v1.AdminUpdateFeedbackResponse{
		Success:   true,
		Message:   "Feedback updated successfully",
		Feedback:  mapFeedbackToAdminItem(feedback),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func (s *adminService) DeleteFeedback(ctx context.Context, feedbackID int32) (*v1.AdminDeleteFeedbackResponse, error) {
	if err := validator.ID(feedbackID); err != nil {
		return nil, err
	}

	// Verify feedback exists before deleting
	if _, err := s.feedbackRepo.GetByID(ctx, feedbackID); err != nil {
		return nil, err
	}

	if err := s.feedbackRepo.Delete(ctx, feedbackID); err != nil {
		return nil, err
	}

	return &v1.AdminDeleteFeedbackResponse{
		Success:   true,
		Message:   "Feedback deleted successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

func mapUserToAdminItem(u *models.User) *v1.AdminUserItem {
	username := ""
	if u.Username != nil {
		username = *u.Username
	}
	email := ""
	if u.Email != nil {
		email = *u.Email
	}
	return &v1.AdminUserItem{
		Id:           u.ID,
		Name:         u.Name,
		Email:        email,
		Username:     username,
		Picture:      u.Picture,
		AuthProvider: u.AuthProvider,
		IsAdmin:      u.IsAdmin,
		CreatedAt:    u.CreatedAt.Unix(),
	}
}

func mapFeedbackToAdminItem(f *models.Feedback) *v1.AdminFeedbackItem {
	item := &v1.AdminFeedbackItem{
		Id:        f.ID,
		UserId:    f.UserID,
		Subject:   f.Subject,
		Message:   f.Message,
		Status:    v1.FeedbackStatus(f.Status),
		AdminNote: f.AdminNote,
		CreatedAt: f.CreatedAt.Unix(),
		UpdatedAt: f.UpdatedAt.Unix(),
	}
	if f.User != nil {
		item.UserName = f.User.Name
		if f.User.Email != nil {
			item.UserEmail = *f.User.Email
		}
	}
	return item
}
