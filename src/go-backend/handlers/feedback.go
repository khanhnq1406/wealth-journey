package handlers

import (
	"github.com/gin-gonic/gin"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/handler"
	v1 "wealthjourney/protobuf/v1"
)

type FeedbackHandlers struct {
	feedbackService service.FeedbackService
}

func NewFeedbackHandlers(feedbackService service.FeedbackService) *FeedbackHandlers {
	return &FeedbackHandlers{
		feedbackService: feedbackService,
	}
}

func (h *FeedbackHandlers) SubmitFeedback(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req v1.SubmitFeedbackRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.feedbackService.SubmitFeedback(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

func (h *FeedbackHandlers) ListMyFeedback(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	params := parsePaginationParams(c)

	result, err := h.feedbackService.ListMyFeedback(c.Request.Context(), userID, params)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}
