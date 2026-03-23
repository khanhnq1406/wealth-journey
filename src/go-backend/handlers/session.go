package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/auth"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/handler"
	"wealthjourney/pkg/redis"
	sessionv1 "wealthjourney/protobuf/v1"
)

// SessionHandlers handles session management HTTP requests.
type SessionHandlers struct {
	authSrv *auth.Server
	rdb     *redis.RedisClient
}

// NewSessionHandlers creates session handlers with injected dependencies.
func NewSessionHandlers(authSrv *auth.Server, rdb *redis.RedisClient) *SessionHandlers {
	return &SessionHandlers{
		authSrv: authSrv,
		rdb:     rdb,
	}
}

// ListSessions lists all active sessions for the authenticated user
func (h *SessionHandlers) ListSessions(c *gin.Context) {
	// Get user ID from context (set by AuthMiddleware)
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.UnauthorizedWithPath(c, "User not authenticated")
		return
	}

	// Get current session ID from token
	token, tokenOk := ExtractBearerToken(c)
	if !tokenOk {
		handler.UnauthorizedWithPath(c, "Invalid token")
		return
	}

	claims, err := h.authSrv.ParseToken(token)
	if err != nil {
		handler.UnauthorizedWithPath(c, "Invalid token")
		return
	}

	currentSessionID := claims.SessionID

	// Get all sessions for user from Redis (keyed by userID)
	sessionIDs, err := h.rdb.GetUserSessions(userID)
	if err != nil {
		log.Printf("[SESSION] Failed to get sessions: %v", err)
		handler.HandleError(c, apperrors.NewInternalErrorWithCode(apperrors.Codes.SessionListFailed, "Failed to retrieve sessions"))
		return
	}

	// Build session info list
	sessions := make([]*sessionv1.SessionInfo, 0, len(sessionIDs))
	for _, sessionID := range sessionIDs {
		metadata, err := h.rdb.GetSession(sessionID)
		if err != nil {
			log.Printf("[SESSION] Failed to get metadata for session %s: %v", sessionID, err)
			continue
		}

		sessions = append(sessions, &sessionv1.SessionInfo{
			SessionId:    sessionID,
			DeviceName:   metadata.DeviceName,
			DeviceType:   metadata.DeviceType,
			IpAddress:    metadata.IPAddress,
			CreatedAt:    metadata.CreatedAt.Unix(),
			LastActiveAt: metadata.LastActiveAt.Unix(),
			ExpiresAt:    metadata.ExpiresAt.Unix(),
			IsCurrent:    sessionID == currentSessionID,
		})
	}

	response := &sessionv1.ListSessionsResponse{
		Success:   true,
		Message:   "Sessions retrieved successfully",
		Sessions:  sessions,
		Timestamp: time.Now().Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, response)
}

// RevokeSession revokes a specific session
func (h *SessionHandlers) RevokeSession(c *gin.Context) {
	sessionID := c.Param("session_id")
	if sessionID == "" {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.SessionIdRequired, "session_id is required"))
		return
	}

	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.UnauthorizedWithPath(c, "User not authenticated")
		return
	}

	// Get current session ID to prevent self-revocation
	token, tokenOk := ExtractBearerToken(c)
	if !tokenOk {
		handler.UnauthorizedWithPath(c, "Invalid token")
		return
	}

	claims, err := h.authSrv.ParseToken(token)
	if err != nil {
		handler.UnauthorizedWithPath(c, "Invalid token")
		return
	}

	currentSessionID := claims.SessionID

	// Prevent revoking current session (use logout instead)
	if sessionID == currentSessionID {
		handler.BadRequest(c, apperrors.NewValidationErrorWithCode(apperrors.Codes.SessionRevokeCurrent, "Cannot revoke current session. Use logout instead."))
		return
	}

	// Verify session belongs to user (keyed by userID)
	exists, err := h.rdb.SessionExists(userID, sessionID)
	if err != nil {
		log.Printf("[SESSION] Error checking session: %v", err)
		handler.HandleError(c, apperrors.NewInternalErrorWithCode(apperrors.Codes.SessionVerifyFailed, "Failed to verify session"))
		return
	}

	if !exists {
		handler.NotFoundWithCode(c, apperrors.Codes.SessionNotFound, "Session not found")
		return
	}

	// Revoke session (keyed by userID)
	if err := h.rdb.RemoveSession(userID, sessionID); err != nil {
		log.Printf("[SESSION] Failed to revoke session: %v", err)
		handler.HandleError(c, apperrors.NewInternalErrorWithCode(apperrors.Codes.SessionRevokeFailed, "Failed to revoke session"))
		return
	}

	response := &sessionv1.RevokeSessionResponse{
		Success:   true,
		Message:   "Session revoked successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, response)
}

// RevokeAllSessions revokes all sessions except the current one
func (h *SessionHandlers) RevokeAllSessions(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.UnauthorizedWithPath(c, "User not authenticated")
		return
	}

	// Get current session ID
	token, tokenOk := ExtractBearerToken(c)
	if !tokenOk {
		handler.UnauthorizedWithPath(c, "Invalid token")
		return
	}

	claims, err := h.authSrv.ParseToken(token)
	if err != nil {
		handler.UnauthorizedWithPath(c, "Invalid token")
		return
	}

	currentSessionID := claims.SessionID

	// Get all sessions (keyed by userID)
	sessionIDs, err := h.rdb.GetUserSessions(userID)
	if err != nil {
		log.Printf("[SESSION] Failed to get sessions: %v", err)
		handler.HandleError(c, apperrors.NewInternalErrorWithCode(apperrors.Codes.SessionListFailed, "Failed to retrieve sessions"))
		return
	}

	// Revoke all except current
	revokedCount := 0
	for _, sessionID := range sessionIDs {
		if sessionID != currentSessionID {
			if err := h.rdb.RemoveSession(userID, sessionID); err != nil {
				log.Printf("[SESSION] Failed to revoke session %s: %v", sessionID, err)
				continue
			}
			revokedCount++
		}
	}

	response := &sessionv1.RevokeAllSessionsResponse{
		Success:      true,
		Message:      "Sessions revoked successfully",
		RevokedCount: int32(revokedCount),
		Timestamp:    time.Now().Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, response)
}
