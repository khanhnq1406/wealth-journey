package errors

import (
	"errors"
	"fmt"
	"net/http"
)

// Standard error types for the application.
// These provide type-safe error handling and prevent leaking internal details.

// AppError is the base interface for all application errors.
type AppError interface {
	error
	StatusCode() int
	Code() string
}

// BaseError implements the AppError interface.
type BaseError struct {
	code       string
	message    string
	statusCode int
	cause      error
}

// NewError creates a new BaseError.
func NewError(code, message string, statusCode int) BaseError {
	return BaseError{
		code:       code,
		message:    message,
		statusCode: statusCode,
	}
}

// WrapError creates a new BaseError wrapping another error.
func WrapError(code, message string, statusCode int, cause error) BaseError {
	return BaseError{
		code:       code,
		message:    message,
		statusCode: statusCode,
		cause:      cause,
	}
}

// Error returns the error message.
func (e BaseError) Error() string {
	if e.cause != nil {
		return fmt.Sprintf("%s: %v", e.message, e.cause)
	}
	return e.message
}

// Unwrap returns the underlying cause error.
func (e BaseError) Unwrap() error {
	return e.cause
}

// StatusCode returns the HTTP status code.
func (e BaseError) StatusCode() int {
	return e.statusCode
}

// Code returns the error code.
func (e BaseError) Code() string {
	return e.code
}

// Common error constructors

// ValidationError represents a validation error.
type ValidationError struct {
	BaseError
}

// NewValidationError creates a new validation error.
func NewValidationError(message string) ValidationError {
	return ValidationError{
		BaseError: NewError("VALIDATION_ERROR", message, http.StatusBadRequest),
	}
}

// NewValidationErrorWithCause creates a validation error with a cause.
func NewValidationErrorWithCause(message string, cause error) ValidationError {
	return ValidationError{
		BaseError: WrapError("VALIDATION_ERROR", message, http.StatusBadRequest, cause),
	}
}

// UnauthorizedError represents an authentication error.
type UnauthorizedError struct {
	BaseError
}

// NewUnauthorizedError creates a new unauthorized error.
func NewUnauthorizedError(message string) UnauthorizedError {
	return UnauthorizedError{
		BaseError: NewError("UNAUTHORIZED", message, http.StatusUnauthorized),
	}
}

// NewUnauthorizedErrorWithCause creates an unauthorized error with a cause.
func NewUnauthorizedErrorWithCause(message string, cause error) UnauthorizedError {
	return UnauthorizedError{
		BaseError: WrapError("UNAUTHORIZED", message, http.StatusUnauthorized, cause),
	}
}

// ForbiddenError represents an authorization error.
type ForbiddenError struct {
	BaseError
}

// NewForbiddenError creates a new forbidden error.
func NewForbiddenError(message string) ForbiddenError {
	return ForbiddenError{
		BaseError: NewError("FORBIDDEN", message, http.StatusForbidden),
	}
}

// NotFoundError represents a resource not found error.
type NotFoundError struct {
	BaseError
}

// NewNotFoundError creates a new not found error.
func NewNotFoundError(resource string) NotFoundError {
	return NotFoundError{
		BaseError: NewError("NOT_FOUND", resource+" not found", http.StatusNotFound),
	}
}

// NewNotFoundErrorWithMessage creates a not found error with a custom message.
func NewNotFoundErrorWithMessage(message string) NotFoundError {
	return NotFoundError{
		BaseError: NewError("NOT_FOUND", message, http.StatusNotFound),
	}
}

// ConflictError represents a conflict error (e.g., duplicate resource).
type ConflictError struct {
	BaseError
}

// NewConflictError creates a new conflict error.
func NewConflictError(message string) ConflictError {
	return ConflictError{
		BaseError: NewError("CONFLICT", message, http.StatusConflict),
	}
}

// NewConflictErrorWithCause creates a conflict error with a cause.
func NewConflictErrorWithCause(message string, cause error) ConflictError {
	return ConflictError{
		BaseError: WrapError("CONFLICT", message, http.StatusConflict, cause),
	}
}

// InternalError represents an internal server error.
type InternalError struct {
	BaseError
}

// NewInternalError creates a new internal error.
func NewInternalError(message string) InternalError {
	return InternalError{
		BaseError: NewError("INTERNAL_ERROR", message, http.StatusInternalServerError),
	}
}

// NewInternalErrorWithCause creates an internal error with a cause.
func NewInternalErrorWithCause(message string, cause error) InternalError {
	return InternalError{
		BaseError: WrapError("INTERNAL_ERROR", message, http.StatusInternalServerError, cause),
	}
}

// ServiceUnavailableError represents a service unavailable error.
type ServiceUnavailableError struct {
	BaseError
}

// NewServiceUnavailableError creates a new service unavailable error.
func NewServiceUnavailableError(message string) ServiceUnavailableError {
	return ServiceUnavailableError{
		BaseError: NewError("SERVICE_UNAVAILABLE", message, http.StatusServiceUnavailable),
	}
}

// IsAppError checks if an error is an application error.
func IsAppError(err error) bool {
	var appErr AppError
	return errors.As(err, &appErr)
}

// GetStatusCode returns the HTTP status code for an error.
// Returns 500 for non-application errors.
func GetStatusCode(err error) int {
	if err == nil {
		return http.StatusOK
	}
	var appErr AppError
	if errors.As(err, &appErr) {
		return appErr.StatusCode()
	}
	return http.StatusInternalServerError
}

// GetErrorCode returns the error code for an error.
// Returns "INTERNAL_ERROR" for non-application errors.
func GetErrorCode(err error) string {
	if err == nil {
		return ""
	}
	var appErr AppError
	if errors.As(err, &appErr) {
		return appErr.Code()
	}
	return "INTERNAL_ERROR"
}

// GetErrorMessage returns a safe error message for the user.
// Internal details are stripped for non-application errors.
func GetErrorMessage(err error) string {
	if err == nil {
		return "An unexpected error occurred"
	}
	var appErr AppError
	if errors.As(err, &appErr) {
		return appErr.Error()
	}
	// Don't leak internal error details
	return "An unexpected error occurred"
}

// Auth-specific error types for security

// InvalidCredentialsError represents a failed authentication attempt.
// This provides a safe, generic message that doesn't leak whether username or password was wrong.
type InvalidCredentialsError struct {
	BaseError
}

// NewInvalidCredentialsError creates an error for authentication failures.
func NewInvalidCredentialsError() InvalidCredentialsError {
	return InvalidCredentialsError{
		BaseError: NewError("INVALID_CREDENTIALS", "invalid credentials", http.StatusUnauthorized),
	}
}

// TokenError represents a token-related failure.
type TokenError struct {
	BaseError
}

// NewTokenError creates an error for token-related failures.
// operation: "verification", "generation", "extraction", etc.
func NewTokenError(operation string) TokenError {
	return TokenError{
		BaseError: NewError("TOKEN_ERROR", fmt.Sprintf("token %s failed", operation), http.StatusUnauthorized),
	}
}

// NewTokenErrorWithCause wraps an underlying token error with a safe message.
func NewTokenErrorWithCause(operation string, cause error) TokenError {
	return TokenError{
		BaseError: WrapError("TOKEN_ERROR", fmt.Sprintf("token %s failed", operation), http.StatusUnauthorized, cause),
	}
}

// RegistrationError represents a registration failure.
type RegistrationError struct {
	BaseError
}

// NewRegistrationErrorWithCause creates a safe error for registration failures.
// The cause is logged server-side but not exposed to client.
func NewRegistrationErrorWithCause(cause error) RegistrationError {
	return RegistrationError{
		BaseError: WrapError("REGISTRATION_FAILED", "registration failed", http.StatusInternalServerError, cause),
	}
}

// LoginError represents a login failure.
type LoginError struct {
	BaseError
}

// NewLoginErrorWithCause creates a safe error for login failures.
func NewLoginErrorWithCause(cause error) LoginError {
	return LoginError{
		BaseError: WrapError("LOGIN_FAILED", "login failed", http.StatusInternalServerError, cause),
	}
}

// LogoutError represents a logout failure.
type LogoutError struct {
	BaseError
}

// NewLogoutErrorWithCause creates a safe error for logout failures.
func NewLogoutErrorWithCause(cause error) LogoutError {
	return LogoutError{
		BaseError: WrapError("LOGOUT_FAILED", "logout failed", http.StatusInternalServerError, cause),
	}
}

// RateLimitError represents a rate limit exceeded error.
type RateLimitError struct {
	BaseError
}

// NewRateLimitError creates a new rate limit error.
func NewRateLimitError(message string) RateLimitError {
	return RateLimitError{
		BaseError: NewError("RATE_LIMIT_EXCEEDED", message, http.StatusTooManyRequests),
	}
}

// NewRateLimitErrorWithRetry creates a rate limit error with retry-after information.
func NewRateLimitErrorWithRetry(message string, retryAfter int) RateLimitError {
	fullMessage := fmt.Sprintf("%s. Retry after %d seconds", message, retryAfter)
	return RateLimitError{
		BaseError: NewError("RATE_LIMIT_EXCEEDED", fullMessage, http.StatusTooManyRequests),
	}
}

// WithCode constructors — use granular error codes from codes.go instead of generic categories.

// NewValidationErrorWithCode creates a validation error with a granular error code.
func NewValidationErrorWithCode(code, message string) ValidationError {
	return ValidationError{
		BaseError: NewError(code, message, http.StatusBadRequest),
	}
}

// NewNotFoundErrorWithCode creates a not found error with a granular error code.
func NewNotFoundErrorWithCode(code, message string) NotFoundError {
	return NotFoundError{
		BaseError: NewError(code, message, http.StatusNotFound),
	}
}

// NewConflictErrorWithCode creates a conflict error with a granular error code.
func NewConflictErrorWithCode(code, message string) ConflictError {
	return ConflictError{
		BaseError: NewError(code, message, http.StatusConflict),
	}
}

// NewInternalErrorWithCode creates an internal error with a granular error code.
func NewInternalErrorWithCode(code, message string) InternalError {
	return InternalError{
		BaseError: NewError(code, message, http.StatusInternalServerError),
	}
}

// NewInternalErrorWithCodeAndCause creates an internal error with a granular code and cause.
func NewInternalErrorWithCodeAndCause(code, message string, cause error) InternalError {
	return InternalError{
		BaseError: WrapError(code, message, http.StatusInternalServerError, cause),
	}
}

// NewForbiddenErrorWithCode creates a forbidden error with a granular error code.
func NewForbiddenErrorWithCode(code, message string) ForbiddenError {
	return ForbiddenError{
		BaseError: NewError(code, message, http.StatusForbidden),
	}
}

// NewUnauthorizedErrorWithCode creates an unauthorized error with a granular error code.
func NewUnauthorizedErrorWithCode(code, message string) UnauthorizedError {
	return UnauthorizedError{
		BaseError: NewError(code, message, http.StatusUnauthorized),
	}
}

// NewServiceUnavailableErrorWithCode creates a service unavailable error with a granular error code.
func NewServiceUnavailableErrorWithCode(code, message string) ServiceUnavailableError {
	return ServiceUnavailableError{
		BaseError: NewError(code, message, http.StatusServiceUnavailable),
	}
}

// NewRateLimitErrorWithCode creates a rate limit error with a granular error code.
func NewRateLimitErrorWithCode(code, message string) RateLimitError {
	return RateLimitError{
		BaseError: NewError(code, message, http.StatusTooManyRequests),
	}
}
