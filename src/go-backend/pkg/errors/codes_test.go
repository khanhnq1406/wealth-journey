package errors

import (
	"reflect"
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestErrorCodes(t *testing.T) {
	t.Run("all error code constants are non-empty strings", func(t *testing.T) {
		codesType := reflect.TypeOf(Codes)
		codesValue := reflect.ValueOf(Codes)

		for i := 0; i < codesType.NumField(); i++ {
			field := codesType.Field(i)
			value := codesValue.Field(i).String()
			assert.NotEmpty(t, value, "error code %s should not be empty", field.Name)
		}
	})

	t.Run("no duplicate error code values", func(t *testing.T) {
		seen := make(map[string]string)
		codesType := reflect.TypeOf(Codes)
		codesValue := reflect.ValueOf(Codes)

		for i := 0; i < codesType.NumField(); i++ {
			field := codesType.Field(i)
			value := codesValue.Field(i).String()

			if existingField, exists := seen[value]; exists {
				t.Errorf("duplicate error code value %q: used by both %s and %s", value, existingField, field.Name)
			}
			seen[value] = field.Name
		}
	})

	t.Run("all codes follow UPPER_SNAKE_CASE naming convention", func(t *testing.T) {
		pattern := regexp.MustCompile(`^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$`)
		codesType := reflect.TypeOf(Codes)
		codesValue := reflect.ValueOf(Codes)

		for i := 0; i < codesType.NumField(); i++ {
			field := codesType.Field(i)
			value := codesValue.Field(i).String()
			assert.Regexp(t, pattern, value, "error code %s value %q should follow UPPER_SNAKE_CASE", field.Name, value)
		}
	})

	t.Run("Codes variable is initialized", func(t *testing.T) {
		assert.NotEmpty(t, Codes.RequestBodyInvalid)
		assert.NotEmpty(t, Codes.WalletIdRequired)
		assert.NotEmpty(t, Codes.TransactionAmountRequired)
		assert.NotEmpty(t, Codes.AuthInvalidCredentials)
		assert.NotEmpty(t, Codes.InternalError)
	})
}
