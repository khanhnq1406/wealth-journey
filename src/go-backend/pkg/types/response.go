package types

import (
	"encoding/json"
	"time"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

// protoMessage is used for type assertion to detect protobuf messages
type protoMessage interface {
	ProtoMessage()
}

// APIResponse is a standardized response wrapper for all API endpoints.
type APIResponse struct {
	Success   bool        `json:"success"`
	Data      interface{} `json:"data,omitempty"`
	Error     *APIError   `json:"error,omitempty"`
	Message   string      `json:"message,omitempty"`
	Timestamp string      `json:"timestamp"`
	Path      string      `json:"path,omitempty"`
}

// MarshalJSON implements json.Marshaler for APIResponse.
// It uses protojson for protobuf messages to respect json_name option (camelCase).
func (r APIResponse) MarshalJSON() ([]byte, error) {
	// Define a local type to avoid infinite recursion
	type alias APIResponse

	// If Data is a protobuf message, marshal it with protojson
	if r.Data != nil {
		if pm, ok := r.Data.(protoMessage); ok {
			opts := protojson.MarshalOptions{
				EmitUnpopulated: false,
				UseProtoNames:   false, // Use json_name instead of protobuf field names
			}
			protoJSONBytes, err := opts.Marshal(pm.(proto.Message))
			if err != nil {
				return nil, err
			}
			// Create a new response with raw JSON data
			return json.Marshal(struct {
				Success   bool            `json:"success"`
				Data      json.RawMessage `json:"data,omitempty"`
				Error     *APIError       `json:"error,omitempty"`
				Message   string          `json:"message,omitempty"`
				Timestamp string          `json:"timestamp"`
				Path      string          `json:"path,omitempty"`
			}{
				Success:   r.Success,
				Data:      json.RawMessage(protoJSONBytes),
				Error:     r.Error,
				Message:   r.Message,
				Timestamp: r.Timestamp,
				Path:      r.Path,
			})
		}
	}

	// For non-protobuf data, use standard JSON marshaling
	return json.Marshal(alias(r))
}

// NewSuccessResponse creates a successful API response.
func NewSuccessResponse(data interface{}) APIResponse {
	return APIResponse{
		Success:   true,
		Data:      data,
		Timestamp: time.Now().Format(time.RFC3339),
	}
}

// NewSuccessMessageResponse creates a successful API response with a message.
func NewSuccessMessageResponse(message string) APIResponse {
	return APIResponse{
		Success:   true,
		Message:   message,
		Timestamp: time.Now().Format(time.RFC3339),
	}
}

// NewErrorResponse creates an error API response.
func NewErrorResponse(err APIError) APIResponse {
	return APIResponse{
		Success:   false,
		Error:     &err,
		Timestamp: time.Now().Format(time.RFC3339),
	}
}

// APIError represents detailed error information.
type APIError struct {
	Code       string            `json:"code"`              // Application-specific error code
	Message    string            `json:"message"`           // User-friendly error message
	Details    string            `json:"details,omitempty"` // Additional error details (optional)
	Params     map[string]string `json:"params,omitempty"`  // Interpolation params for i18n translations
	StatusCode int               `json:"-"`                 // HTTP status code (not serialized)
}

// Error implements the error interface.
func (e APIError) Error() string {
	if e.Details != "" {
		return e.Message + ": " + e.Details
	}
	return e.Message
}

// Common error constructors
func NewValidationError(message string) APIError {
	return APIError{
		Code:       "VALIDATION_ERROR",
		Message:    message,
		StatusCode: 400,
	}
}

func NewUnauthorizedError(message string) APIError {
	return APIError{
		Code:       "UNAUTHORIZED",
		Message:    message,
		StatusCode: 401,
	}
}

func NewForbiddenError(message string) APIError {
	return APIError{
		Code:       "FORBIDDEN",
		Message:    message,
		StatusCode: 403,
	}
}

func NewNotFoundError(message string) APIError {
	return APIError{
		Code:       "NOT_FOUND",
		Message:    message,
		StatusCode: 404,
	}
}

func NewConflictError(message string) APIError {
	return APIError{
		Code:       "CONFLICT",
		Message:    message,
		StatusCode: 409,
	}
}

func NewInternalError(message string) APIError {
	return APIError{
		Code:       "INTERNAL_ERROR",
		Message:    message,
		StatusCode: 500,
	}
}

func NewServiceUnavailableError(message string) APIError {
	return APIError{
		Code:       "SERVICE_UNAVAILABLE",
		Message:    message,
		StatusCode: 503,
	}
}

// PaginationParams represents pagination parameters for list requests.
type PaginationParams struct {
	Page     int    `json:"page" form:"page"`          // Page number (1-indexed)
	PageSize int    `json:"pageSize" form:"page_size"` // Items per page
	OrderBy  string `json:"orderBy" form:"order_by"`   // Field to order by
	Order    string `json:"order" form:"order"`        // "asc" or "desc"
}

// NewPaginationParams creates default pagination parameters.
func NewPaginationParams() PaginationParams {
	return PaginationParams{
		Page:     1,
		PageSize: 20,
		OrderBy:  "created_at",
		Order:    "desc",
	}
}

// Validate checks if pagination parameters are valid.
func (p PaginationParams) Validate() PaginationParams {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PageSize < 1 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100 // Max page size
	}
	if p.Order != "asc" && p.Order != "desc" {
		p.Order = "desc"
	}
	return p
}

// Offset calculates the database offset.
func (p PaginationParams) Offset() int {
	return (p.Page - 1) * p.PageSize
}

// Limit returns the page size.
func (p PaginationParams) Limit() int {
	return p.PageSize
}

// PaginationResult contains pagination metadata for list responses.
type PaginationResult struct {
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	TotalCount int `json:"totalCount"`
	TotalPages int `json:"totalPages"`
}

// NewPaginationResult creates pagination metadata.
func NewPaginationResult(page, pageSize, totalCount int) PaginationResult {
	totalPages := (totalCount + pageSize - 1) / pageSize
	if totalPages < 1 {
		totalPages = 1
	}
	return PaginationResult{
		Page:       page,
		PageSize:   pageSize,
		TotalCount: totalCount,
		TotalPages: totalPages,
	}
}

// HasNext returns true if there's a next page.
func (p PaginationResult) HasNext() bool {
	return p.Page < p.TotalPages
}

// HasPrev returns true if there's a previous page.
func (p PaginationResult) HasPrev() bool {
	return p.Page > 1
}

// PaginatedResponse wraps data with pagination metadata.
type PaginatedResponse struct {
	Data       interface{}      `json:"data"`
	Pagination PaginationResult `json:"pagination"`
}

// NewPaginatedResponse creates a paginated response.
func NewPaginatedResponse(data interface{}, pagination PaginationResult) APIResponse {
	return NewSuccessResponse(PaginatedResponse{
		Data:       data,
		Pagination: pagination,
	})
}

// NewSuccessResponseWithPath creates a successful API response with path.
func NewSuccessResponseWithPath(data interface{}, path string) APIResponse {
	return APIResponse{
		Success:   true,
		Data:      data,
		Timestamp: time.Now().Format(time.RFC3339),
		Path:      path,
	}
}

// NewSuccessMessageResponseWithPath creates a successful API response with message and path.
func NewSuccessMessageResponseWithPath(message, path string) APIResponse {
	return APIResponse{
		Success:   true,
		Message:   message,
		Timestamp: time.Now().Format(time.RFC3339),
		Path:      path,
	}
}

// NewErrorResponseWithPath creates an error API response with path.
func NewErrorResponseWithPath(err APIError, path string) APIResponse {
	return APIResponse{
		Success:   false,
		Error:     &err,
		Timestamp: time.Now().Format(time.RFC3339),
		Path:      path,
	}
}
