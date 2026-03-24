package handlers

import (
	"strings"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/handler"
	v1 "wealthjourney/protobuf/v1"
)

// WatchlistHandler handles watchlist-related HTTP requests.
type WatchlistHandler struct {
	watchlistSvc service.WatchlistService
}

// NewWatchlistHandler creates a new WatchlistHandler instance.
func NewWatchlistHandler(watchlistSvc service.WatchlistService) *WatchlistHandler {
	return &WatchlistHandler{
		watchlistSvc: watchlistSvc,
	}
}

// CreateWatchlistItem adds a new symbol to the user's watchlist.
// POST /api/v1/watchlist
func (h *WatchlistHandler) CreateWatchlistItem(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req v1.CreateWatchlistItemRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	if strings.TrimSpace(req.Symbol) == "" {
		handler.BadRequest(c, apperrors.NewValidationError("symbol is required"))
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		handler.BadRequest(c, apperrors.NewValidationError("name is required"))
		return
	}

	result, err := h.watchlistSvc.CreateItem(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Created(c, result)
}

// ListWatchlist retrieves all watchlist items for the authenticated user.
// GET /api/v1/watchlist
func (h *WatchlistHandler) ListWatchlist(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	result, err := h.watchlistSvc.ListItems(c.Request.Context(), userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// UpdateWatchlistItem updates a watchlist item's note.
// PUT /api/v1/watchlist/:id
func (h *WatchlistHandler) UpdateWatchlistItem(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	itemID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	var req v1.UpdateWatchlistItemRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.watchlistSvc.UpdateItem(c.Request.Context(), itemID, userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// DeleteWatchlistItem soft-deletes a watchlist item.
// DELETE /api/v1/watchlist/:id
func (h *WatchlistHandler) DeleteWatchlistItem(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	itemID, err := parseIDParam(c, "id")
	if err != nil {
		handler.BadRequest(c, err)
		return
	}

	result, err := h.watchlistSvc.DeleteItem(c.Request.Context(), itemID, userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// ReorderWatchlist updates the sort order of watchlist items.
// PUT /api/v1/watchlist/reorder
func (h *WatchlistHandler) ReorderWatchlist(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	var req v1.ReorderWatchlistRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	if len(req.ItemIds) == 0 {
		handler.BadRequest(c, apperrors.NewValidationError("itemIds must not be empty"))
		return
	}

	result, err := h.watchlistSvc.ReorderItems(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// CheckWatchlistItem checks whether a symbol is already in the user's watchlist.
// GET /api/v1/watchlist/check?symbol=AAPL
func (h *WatchlistHandler) CheckWatchlistItem(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	symbol := strings.TrimSpace(c.Query("symbol"))
	if symbol == "" {
		handler.BadRequest(c, apperrors.NewValidationError("symbol query parameter is required"))
		return
	}

	resp, err := h.watchlistSvc.CheckItem(c.Request.Context(), userID, symbol)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, resp)
}
