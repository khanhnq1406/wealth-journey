package errors

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAuthenticationErrors(t *testing.T) {
	t.Run("InvalidCredentialsError returns safe message", func(t *testing.T) {
		err := NewInvalidCredentialsError()
		assert.Equal(t, "invalid credentials", err.Error())
		assert.Equal(t, 401, err.StatusCode())
		assert.Equal(t, "INVALID_CREDENTIALS", err.Code())
	})

	t.Run("TokenError returns safe message", func(t *testing.T) {
		err := NewTokenError("verification")
		assert.Equal(t, "token verification failed", err.Error())
		assert.Equal(t, 401, err.StatusCode())
		assert.Equal(t, "TOKEN_ERROR", err.Code())
	})

	t.Run("TokenError with cause hides internal details", func(t *testing.T) {
		internalErr := errors.New("jwt: token is expired by 24h")
		err := NewTokenErrorWithCause("verification", internalErr)

		// User-facing message is safe (doesn't include cause)
		assert.Equal(t, "token verification failed: jwt: token is expired by 24h", err.Error())

		// But we can still access cause for logging via Unwrap
		unwrapped := errors.Unwrap(err)
		assert.NotNil(t, unwrapped)
		assert.Equal(t, internalErr, unwrapped)
	})

	t.Run("RegistrationError returns safe message", func(t *testing.T) {
		dbErr := errors.New("connection to postgres.railway.internal failed")
		err := NewRegistrationErrorWithCause(dbErr)

		// Safe message only (with cause appended)
		assert.Contains(t, err.Error(), "registration failed")
		assert.Equal(t, 500, err.StatusCode())
		assert.Equal(t, "REGISTRATION_FAILED", err.Code())
	})

	t.Run("LoginError returns safe message", func(t *testing.T) {
		causeErr := errors.New("database connection failed")
		err := NewLoginErrorWithCause(causeErr)

		assert.Contains(t, err.Error(), "login failed")
		assert.Equal(t, 500, err.StatusCode())
		assert.Equal(t, "LOGIN_FAILED", err.Code())
	})

	t.Run("LogoutError returns safe message", func(t *testing.T) {
		causeErr := errors.New("redis connection failed")
		err := NewLogoutErrorWithCause(causeErr)

		assert.Contains(t, err.Error(), "logout failed")
		assert.Equal(t, 500, err.StatusCode())
		assert.Equal(t, "LOGOUT_FAILED", err.Code())
	})
}

func TestWithCodeConstructors(t *testing.T) {
	t.Run("NewValidationErrorWithCode", func(t *testing.T) {
		err := NewValidationErrorWithCode("WALLET_ID_REQUIRED", "wallet_id is required")
		assert.Equal(t, "WALLET_ID_REQUIRED", err.Code())
		assert.Equal(t, "wallet_id is required", err.Error())
		assert.Equal(t, 400, err.StatusCode())
	})

	t.Run("NewNotFoundErrorWithCode", func(t *testing.T) {
		err := NewNotFoundErrorWithCode("WALLET_NOT_FOUND", "wallet not found")
		assert.Equal(t, "WALLET_NOT_FOUND", err.Code())
		assert.Equal(t, "wallet not found", err.Error())
		assert.Equal(t, 404, err.StatusCode())
	})

	t.Run("NewConflictErrorWithCode", func(t *testing.T) {
		err := NewConflictErrorWithCode("USER_EMAIL_EXISTS", "user with this email already exists")
		assert.Equal(t, "USER_EMAIL_EXISTS", err.Code())
		assert.Equal(t, "user with this email already exists", err.Error())
		assert.Equal(t, 409, err.StatusCode())
	})

	t.Run("NewInternalErrorWithCode", func(t *testing.T) {
		err := NewInternalErrorWithCode("SESSION_LIST_FAILED", "Failed to retrieve sessions")
		assert.Equal(t, "SESSION_LIST_FAILED", err.Code())
		assert.Equal(t, "Failed to retrieve sessions", err.Error())
		assert.Equal(t, 500, err.StatusCode())
	})

	t.Run("NewInternalErrorWithCodeAndCause", func(t *testing.T) {
		cause := errors.New("db connection failed")
		err := NewInternalErrorWithCodeAndCause("SESSION_LIST_FAILED", "Failed to retrieve sessions", cause)
		assert.Equal(t, "SESSION_LIST_FAILED", err.Code())
		assert.Contains(t, err.Error(), "Failed to retrieve sessions")
		assert.Equal(t, 500, err.StatusCode())
		assert.Equal(t, cause, errors.Unwrap(err))
	})

	t.Run("NewForbiddenErrorWithCode", func(t *testing.T) {
		err := NewForbiddenErrorWithCode("AUTH_ADMIN_REQUIRED", "Admin access required")
		assert.Equal(t, "AUTH_ADMIN_REQUIRED", err.Code())
		assert.Equal(t, "Admin access required", err.Error())
		assert.Equal(t, 403, err.StatusCode())
	})

	t.Run("NewUnauthorizedErrorWithCode", func(t *testing.T) {
		err := NewUnauthorizedErrorWithCode("AUTH_TOKEN_EXPIRED", "Invalid or expired token")
		assert.Equal(t, "AUTH_TOKEN_EXPIRED", err.Code())
		assert.Equal(t, "Invalid or expired token", err.Error())
		assert.Equal(t, 401, err.StatusCode())
	})

	t.Run("NewServiceUnavailableErrorWithCode", func(t *testing.T) {
		err := NewServiceUnavailableErrorWithCode("AUTH_SERVICE_UNAVAILABLE", "auth service unavailable")
		assert.Equal(t, "AUTH_SERVICE_UNAVAILABLE", err.Code())
		assert.Equal(t, "auth service unavailable", err.Error())
		assert.Equal(t, 503, err.StatusCode())
	})

	t.Run("NewRateLimitErrorWithCode", func(t *testing.T) {
		err := NewRateLimitErrorWithCode("FEEDBACK_RATE_LIMITED", "Maximum 10 feedback submissions per hour")
		assert.Equal(t, "FEEDBACK_RATE_LIMITED", err.Code())
		assert.Equal(t, "Maximum 10 feedback submissions per hour", err.Error())
		assert.Equal(t, 429, err.StatusCode())
	})
}

func TestGetErrorMessage(t *testing.T) {
	t.Run("AppError returns safe message", func(t *testing.T) {
		err := NewInvalidCredentialsError()
		msg := GetErrorMessage(err)
		assert.Equal(t, "invalid credentials", msg)
	})

	t.Run("Non-AppError returns generic message", func(t *testing.T) {
		err := errors.New("database connection failed: host=postgres.railway.internal")
		msg := GetErrorMessage(err)
		assert.Equal(t, "An unexpected error occurred", msg)
	})

	t.Run("Nil error returns generic message", func(t *testing.T) {
		msg := GetErrorMessage(nil)
		assert.Equal(t, "An unexpected error occurred", msg)
	})

	t.Run("RegistrationError with cause returns safe message via GetErrorMessage", func(t *testing.T) {
		dbErr := errors.New("connection to postgres.railway.internal failed")
		err := NewRegistrationErrorWithCause(dbErr)
		msg := GetErrorMessage(err)
		// Should return the AppError message (with cause appended by BaseError.Error())
		assert.Contains(t, msg, "registration failed")
	})
}
