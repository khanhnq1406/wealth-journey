package validator

import (
	"errors"
	"fmt"
	"net/mail"
	"regexp"
	"unicode"

	apperrors "wealthjourney/pkg/errors"
)

var (
	// ErrInvalidEmail is returned for invalid email addresses.
	ErrInvalidEmail = errors.New("invalid email address")
	// ErrInvalidName is returned for invalid names.
	ErrInvalidName = errors.New("invalid name")
	// ErrInvalidWalletName is returned for invalid wallet names.
	ErrInvalidWalletName = errors.New("invalid wallet name")
	// ErrInvalidAmount is returned for invalid amounts.
	ErrInvalidAmount = errors.New("invalid amount")
	// ErrStringTooShort is returned when a string is too short.
	ErrStringTooShort = errors.New("string too short")
	// ErrStringTooLong is returned when a string is too long.
	ErrStringTooLong = errors.New("string too long")
)

// Email validates an email address.
func Email(email string) error {
	if email == "" {
		return apperrors.NewValidationError("email is required")
	}
	if len(email) > 255 {
		return apperrors.NewValidationError("email is too long (max 255 characters)")
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return apperrors.NewValidationErrorWithCause("invalid email format", ErrInvalidEmail)
	}
	return nil
}

// Name validates a person's name.
func Name(name string) error {
	return NameWithConstraints(name, 2, 100)
}

// NameWithConstraints validates a name with custom constraints.
func NameWithConstraints(name string, minLen, maxLen int) error {
	if name == "" {
		return apperrors.NewValidationError("name is required")
	}
	if len(name) < minLen {
		return apperrors.NewValidationErrorWithCause(
			fmt.Sprintf("name must be at least %d characters", minLen),
			ErrStringTooShort,
		)
	}
	if len(name) > maxLen {
		return apperrors.NewValidationErrorWithCause(
			fmt.Sprintf("name must be at most %d characters", maxLen),
			ErrStringTooLong,
		)
	}
	return nil
}

// WalletName validates a wallet name.
func WalletName(name string) error {
	return WalletNameWithConstraints(name, 2, 50)
}

// WalletNameWithConstraints validates a wallet name with custom constraints.
func WalletNameWithConstraints(name string, minLen, maxLen int) error {
	if name == "" {
		return apperrors.NewValidationError("wallet name is required")
	}
	if len(name) < minLen {
		return apperrors.NewValidationErrorWithCause(
			fmt.Sprintf("wallet name must be at least %d characters", minLen),
			ErrStringTooShort,
		)
	}
	if len(name) > maxLen {
		return apperrors.NewValidationErrorWithCause(
			fmt.Sprintf("wallet name must be at most %d characters", maxLen),
			ErrStringTooLong,
		)
	}
	// Check for valid characters (letters, numbers, spaces, and basic punctuation)
	matched, _ := regexp.MatchString(`^[\p{L}\p{N}\s\-_.,!?()]+$`, name)
	if !matched {
		return apperrors.NewValidationErrorWithCause(
			"wallet name contains invalid characters",
			ErrInvalidWalletName,
		)
	}
	return nil
}

// Amount validates a monetary amount (in cents).
func Amount(amount int64) error {
	if amount < 0 {
		return apperrors.NewValidationErrorWithCause(
			"amount cannot be negative",
			ErrInvalidAmount,
		)
	}
	return nil
}

// PositiveAmount validates that an amount is positive.
func PositiveAmount(amount int64) error {
	if amount <= 0 {
		return apperrors.NewValidationErrorWithCause(
			"amount must be positive",
			ErrInvalidAmount,
		)
	}
	return nil
}

// Password validates a password.
func Password(password string) error {
	return PasswordWithConstraints(password, 8, 128)
}

// PasswordWithConstraints validates a password with custom constraints.
func PasswordWithConstraints(password string, minLen, maxLen int) error {
	if len(password) < minLen {
		return apperrors.NewValidationErrorWithCause(
			fmt.Sprintf("password must be at least %d characters", minLen),
			ErrStringTooShort,
		)
	}
	if len(password) > maxLen {
		return apperrors.NewValidationErrorWithCause(
			fmt.Sprintf("password must be at most %d characters", maxLen),
			ErrStringTooLong,
		)
	}
	// Check for at least one uppercase letter
	hasUpper := false
	hasLower := false
	hasDigit := false
	for _, char := range password {
		if unicode.IsUpper(char) {
			hasUpper = true
		}
		if unicode.IsLower(char) {
			hasLower = true
		}
		if unicode.IsDigit(char) {
			hasDigit = true
		}
	}
	if !hasUpper {
		return apperrors.NewValidationError("password must contain at least one uppercase letter")
	}
	if !hasLower {
		return apperrors.NewValidationError("password must contain at least one lowercase letter")
	}
	if !hasDigit {
		return apperrors.NewValidationError("password must contain at least one digit")
	}
	return nil
}

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

// Username validates a username (3-30 chars, alphanumeric + underscore only).
func Username(username string) error {
	if username == "" {
		return apperrors.NewValidationError("username is required")
	}
	if len(username) < 3 {
		return apperrors.NewValidationError("username must be at least 3 characters")
	}
	if len(username) > 30 {
		return apperrors.NewValidationError("username must be at most 30 characters")
	}
	if !usernameRegex.MatchString(username) {
		return apperrors.NewValidationError("username can only contain letters, numbers, and underscores")
	}
	return nil
}

// StrongPassword validates a password with strict requirements (min 10 chars, 1 upper, 1 lower, 1 digit, 1 special).
func StrongPassword(password string) error {
	return StrongPasswordWithConstraints(password, 10, 72)
}

// StrongPasswordWithConstraints validates a password with custom length and strict character requirements.
func StrongPasswordWithConstraints(password string, minLen, maxLen int) error {
	if len(password) < minLen {
		return apperrors.NewValidationError(fmt.Sprintf("password must be at least %d characters", minLen))
	}
	if len(password) > maxLen {
		return apperrors.NewValidationError(fmt.Sprintf("password must be at most %d characters", maxLen))
	}
	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasDigit = true
		case !unicode.IsLetter(char) && !unicode.IsDigit(char):
			hasSpecial = true
		}
	}
	if !hasUpper {
		return apperrors.NewValidationError("password must contain at least one uppercase letter")
	}
	if !hasLower {
		return apperrors.NewValidationError("password must contain at least one lowercase letter")
	}
	if !hasDigit {
		return apperrors.NewValidationError("password must contain at least one digit")
	}
	if !hasSpecial {
		return apperrors.NewValidationError("password must contain at least one special character")
	}
	return nil
}

// Required validates that a string is not empty.
func Required(field, value string) error {
	if value == "" {
		return apperrors.NewValidationError(field + " is required")
	}
	return nil
}

// Length validates string length.
func Length(field, value string, minLen, maxLen int) error {
	if len(value) < minLen {
		return apperrors.NewValidationErrorWithCause(
			fmt.Sprintf("%s must be at least %d characters", field, minLen),
			ErrStringTooShort,
		)
	}
	if len(value) > maxLen {
		return apperrors.NewValidationErrorWithCause(
			fmt.Sprintf("%s must be at most %d characters", field, maxLen),
			ErrStringTooLong,
		)
	}
	return nil
}

// URL validates a URL string (basic validation).
func URL(url string) error {
	if url == "" {
		return nil // Empty is allowed (optional field)
	}
	matched, _ := regexp.MatchString(`^https?://[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=]+$`, url)
	if !matched {
		return apperrors.NewValidationError("invalid URL format")
	}
	return nil
}

// Currency validates a currency code (ISO 4217).
func Currency(currency string) error {
	if currency == "" {
		return apperrors.NewValidationError("currency is required")
	}
	matched, _ := regexp.MatchString(`^[A-Z]{3}$`, currency)
	if !matched {
		return apperrors.NewValidationError("invalid currency code (use ISO 4217 format, e.g., USD)")
	}
	return nil
}

// ID validates an ID is positive.
func ID(id int32) error {
	if id <= 0 {
		return apperrors.NewValidationError("invalid ID")
	}
	return nil
}

// PaginationParams validates pagination parameters.
func PaginationParams(page, pageSize int) error {
	if page < 1 {
		return apperrors.NewValidationError("page must be at least 1")
	}
	if pageSize < 1 {
		return apperrors.NewValidationError("page size must be at least 1")
	}
	if pageSize > 100 {
		return apperrors.NewValidationError("page size cannot exceed 100")
	}
	return nil
}
