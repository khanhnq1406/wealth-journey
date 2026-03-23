package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/types"
)

// Success sends a successful response with data.
func Success(c *gin.Context, data interface{}) {
	var jsonBytes []byte
	var err error

	// Check if data is a protobuf message
	if pm, ok := data.(proto.Message); ok {
		// Use protojson for protobuf messages (respects json_name)
		opts := protojson.MarshalOptions{
			UseProtoNames:   false, // Use json_name from proto definition
			EmitUnpopulated: false, // Don't emit zero values
			UseEnumNumbers:  true,  // Serialize enums as numbers instead of strings
		}
		jsonBytes, err = opts.Marshal(pm)
	} else {
		// For non-protobuf objects, use standard JSON marshaling
		jsonBytes, err = json.Marshal(data)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, types.NewErrorResponse(types.APIError{
			Code:       "MARSHAL_ERROR",
			Message:    "failed to marshal response",
			StatusCode: http.StatusInternalServerError,
		}))
		return
	}
	c.Header("Content-Type", "application/json")
	c.Writer.WriteHeader(http.StatusOK)
	_, _ = c.Writer.Write(jsonBytes)
}

// Created sends a 201 created response with data.
func Created(c *gin.Context, data interface{}) {
	var jsonBytes []byte
	var err error

	// Check if data is a protobuf message
	if pm, ok := data.(proto.Message); ok {
		// Use protojson for protobuf messages (respects json_name)
		opts := protojson.MarshalOptions{
			UseProtoNames:   false, // Use json_name from proto definition
			EmitUnpopulated: false, // Don't emit zero values
			UseEnumNumbers:  true,  // Serialize enums as numbers instead of strings
		}
		jsonBytes, err = opts.Marshal(pm)
	} else {
		// For non-protobuf objects, use standard JSON marshaling
		jsonBytes, err = json.Marshal(data)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, types.NewErrorResponse(types.APIError{
			Code:       "MARSHAL_ERROR",
			Message:    "failed to marshal response",
			StatusCode: http.StatusInternalServerError,
		}))
		return
	}
	c.Header("Content-Type", "application/json")
	c.Writer.WriteHeader(http.StatusCreated)
	_, _ = c.Writer.Write(jsonBytes)
}

// NoContent sends a 204 no content response.
func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// BadRequest sends a 400 bad request response.
func BadRequest(c *gin.Context, err error) {
	if appErr, ok := err.(apperrors.AppError); ok {
		c.JSON(http.StatusBadRequest, types.NewErrorResponse(types.APIError{
			Code:       appErr.Code(),
			Message:    appErr.Error(),
			StatusCode: http.StatusBadRequest,
		}))
		return
	}
	c.JSON(http.StatusBadRequest, types.NewErrorResponse(types.APIError{
		Code:       "VALIDATION_ERROR",
		Message:    err.Error(),
		StatusCode: http.StatusBadRequest,
	}))
}

// Unauthorized sends a 401 unauthorized response.
func Unauthorized(c *gin.Context, message string) {
	c.JSON(http.StatusUnauthorized, types.NewErrorResponse(types.APIError{
		Code:       "UNAUTHORIZED",
		Message:    message,
		StatusCode: http.StatusUnauthorized,
	}))
}

// Forbidden sends a 403 forbidden response.
func Forbidden(c *gin.Context, message string) {
	c.JSON(http.StatusForbidden, types.NewErrorResponse(types.APIError{
		Code:       "FORBIDDEN",
		Message:    message,
		StatusCode: http.StatusForbidden,
	}))
}

// NotFound sends a 404 not found response.
func NotFound(c *gin.Context, message string) {
	c.JSON(http.StatusNotFound, types.NewErrorResponse(types.APIError{
		Code:       "NOT_FOUND",
		Message:    message,
		StatusCode: http.StatusNotFound,
	}))
}

// Conflict sends a 409 conflict response.
func Conflict(c *gin.Context, message string) {
	c.JSON(http.StatusConflict, types.NewErrorResponse(types.APIError{
		Code:       "CONFLICT",
		Message:    message,
		StatusCode: http.StatusConflict,
	}))
}

// InternalError sends a 500 internal server error response.
func InternalError(c *gin.Context, err error) {
	// Log the actual error for debugging
	// TODO: Add proper logging

	if appErr, ok := err.(apperrors.AppError); ok {
		c.JSON(appErr.StatusCode(), types.NewErrorResponse(types.APIError{
			Code:       appErr.Code(),
			Message:    apperrors.GetErrorMessage(err),
			StatusCode: appErr.StatusCode(),
		}))
		return
	}

	// Don't leak internal error details
	c.JSON(http.StatusInternalServerError, types.NewErrorResponse(types.APIError{
		Code:       "INTERNAL_ERROR",
		Message:    "An unexpected error occurred",
		StatusCode: http.StatusInternalServerError,
	}))
}

// HandleError handles any error and sends the appropriate response.
// It preserves granular error codes from AppError types.
func HandleError(c *gin.Context, err error) {
	if err == nil {
		Success(c, nil)
		return
	}

	// Extract code from AppError if available
	code := apperrors.GetErrorCode(err)
	message := apperrors.GetErrorMessage(err)
	statusCode := apperrors.GetStatusCode(err)

	switch statusCode {
	case http.StatusBadRequest:
		BadRequest(c, err)
	case http.StatusUnauthorized:
		UnauthorizedWithCode(c, code, message)
	case http.StatusForbidden:
		ForbiddenWithCode(c, code, message)
	case http.StatusNotFound:
		NotFoundWithCode(c, code, message)
	case http.StatusConflict:
		ConflictWithCode(c, code, message)
	case http.StatusTooManyRequests:
		c.JSON(http.StatusTooManyRequests, types.NewErrorResponse(types.APIError{
			Code:       code,
			Message:    message,
			StatusCode: http.StatusTooManyRequests,
		}))
	default:
		InternalError(c, err)
	}
}

// GetUserID retrieves the user ID from the context.
func GetUserID(c *gin.Context) (int32, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return 0, false
	}
	id, ok := userID.(int32)
	return id, ok
}

// GetUserEmail retrieves the user email from the context.
func GetUserEmail(c *gin.Context) (string, bool) {
	email, exists := c.Get("user_email")
	if !exists {
		return "", false
	}
	e, ok := email.(string)
	return e, ok
}

// BindAndValidate binds JSON request body and validates it.
// For protobuf messages, it uses protojson to respect json_name (camelCase).
func BindAndValidate(c *gin.Context, obj interface{}) error {
	// Check if obj is a protobuf message
	if pm, ok := obj.(proto.Message); ok {
		// Use protojson for protobuf messages (respects json_name)
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			return apperrors.NewValidationErrorWithCode(apperrors.Codes.RequestBodyReadFailed, "failed to read request body")
		}
		opts := protojson.UnmarshalOptions{
			AllowPartial:   false,
			DiscardUnknown: false,
		}
		if err := opts.Unmarshal(body, pm); err != nil {
			return apperrors.NewValidationErrorWithCode(apperrors.Codes.RequestBodyFormatInvalid, "invalid request body format")
		}
		return nil
	}

	// For non-protobuf objects, use standard JSON binding
	if err := c.ShouldBindJSON(obj); err != nil {
		return apperrors.NewValidationErrorWithCode(apperrors.Codes.RequestBodyInvalid, "invalid request body")
	}
	return nil
}

// SuccessWithPath sends a successful response with data and path.
func SuccessWithPath(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, types.NewSuccessResponseWithPath(data, c.Request.URL.Path))
}

// CreatedWithPath sends a 201 created response with data and path.
func CreatedWithPath(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, types.NewSuccessResponseWithPath(data, c.Request.URL.Path))
}

// UnauthorizedWithPath sends a 401 unauthorized response with path.
func UnauthorizedWithPath(c *gin.Context, message string) {
	c.JSON(http.StatusUnauthorized, types.NewErrorResponseWithPath(types.APIError{
		Code:       "UNAUTHORIZED",
		Message:    message,
		StatusCode: http.StatusUnauthorized,
	}, c.Request.URL.Path))
}

// WithCode variants — use granular error codes for middleware and handlers.

// UnauthorizedWithCode sends a 401 unauthorized response with a granular error code.
func UnauthorizedWithCode(c *gin.Context, code, message string) {
	c.JSON(http.StatusUnauthorized, types.NewErrorResponse(types.APIError{
		Code:       code,
		Message:    message,
		StatusCode: http.StatusUnauthorized,
	}))
}

// ForbiddenWithCode sends a 403 forbidden response with a granular error code.
func ForbiddenWithCode(c *gin.Context, code, message string) {
	c.JSON(http.StatusForbidden, types.NewErrorResponse(types.APIError{
		Code:       code,
		Message:    message,
		StatusCode: http.StatusForbidden,
	}))
}

// NotFoundWithCode sends a 404 not found response with a granular error code.
func NotFoundWithCode(c *gin.Context, code, message string) {
	c.JSON(http.StatusNotFound, types.NewErrorResponse(types.APIError{
		Code:       code,
		Message:    message,
		StatusCode: http.StatusNotFound,
	}))
}

// ConflictWithCode sends a 409 conflict response with a granular error code.
func ConflictWithCode(c *gin.Context, code, message string) {
	c.JSON(http.StatusConflict, types.NewErrorResponse(types.APIError{
		Code:       code,
		Message:    message,
		StatusCode: http.StatusConflict,
	}))
}

// InternalErrorWithCode sends a 500 internal server error response with a granular error code.
func InternalErrorWithCode(c *gin.Context, code, message string) {
	c.JSON(http.StatusInternalServerError, types.NewErrorResponse(types.APIError{
		Code:       code,
		Message:    message,
		StatusCode: http.StatusInternalServerError,
	}))
}

// NotFoundWithPath sends a 404 not found response with path.
func NotFoundWithPath(c *gin.Context, message string) {
	c.JSON(http.StatusNotFound, types.NewErrorResponseWithPath(types.APIError{
		Code:       "NOT_FOUND",
		Message:    message,
		StatusCode: http.StatusNotFound,
	}, c.Request.URL.Path))
}
