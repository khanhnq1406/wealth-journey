package parser

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// TestCSVParser_WithTransactionValidation tests that business rules validation is applied during parsing
func TestCSVParser_WithTransactionValidation(t *testing.T) {
	mapping := &ColumnMapping{
		DateColumn:        0,
		AmountColumn:      1,
		DescriptionColumn: 2,
		Currency:          "VND",
		TypeColumn:        -1,
		ReferenceColumn:   -1,
		DebitColumn:       -1,
		CreditColumn:      -1,
	}

	tests := []struct {
		name               string
		row                []string
		rowNumber          int
		expectValid        bool
		expectWarnings     int
		expectErrors       int
		checkValidationMsg string
	}{
		{
			name:           "Valid transaction - no validation issues",
			row:            []string{"01/01/2026", "1000000", "Coffee shop"},
			rowNumber:      1,
			expectValid:    true,
			expectWarnings: 0,
			expectErrors:   0,
		},
		{
			name:               "Zero amount - should have error",
			row:                []string{"01/01/2026", "0", "Free item"},
			rowNumber:          2,
			expectValid:        false, // Error makes it invalid
			expectWarnings:     0,
			expectErrors:       1,
			checkValidationMsg: "Amount cannot be zero",
		},
		{
			name:               "Large amount - should have warning",
			row:                []string{"01/01/2026", "1500000000", "Expensive purchase"}, // 1.5B VND
			rowNumber:          3,
			expectValid:        true, // Warnings don't invalidate
			expectWarnings:     1,
			expectErrors:       0,
			checkValidationMsg: "Amount is very large",
		},
		{
			name:               "Old date - should have warning",
			row:                []string{"01/01/2023", "100000", "Old transaction"}, // 3+ years old
			rowNumber:          4,
			expectValid:        true, // Warnings don't invalidate
			expectWarnings:     1,
			expectErrors:       0,
			checkValidationMsg: "Date is older than 1 year",
		},
		{
			name:               "Description too short - should have error",
			row:                []string{"01/01/2026", "100000", "A"},
			rowNumber:          5,
			expectValid:        false,
			expectWarnings:     0,
			expectErrors:       1,
			checkValidationMsg: "Description must be at least 2 characters",
		},
		{
			name:               "Future date - parser catches it first",
			row:                []string{"01/01/2030", "100000", "Future transaction"},
			rowNumber:          6,
			expectValid:        false,
			expectWarnings:     0,
			expectErrors:       1,
			checkValidationMsg: "Invalid date", // Date parser catches it before validation
		},
		{
			name:               "Multiple validation issues",
			row:                []string{"01/01/2023", "1500000000", "A"}, // Old date + large amount + short description
			rowNumber:          7,
			expectValid:        false, // Error (short description) makes it invalid
			expectWarnings:     2,     // Old date + large amount
			expectErrors:       1,     // Short description
			checkValidationMsg: "Description must be at least 2 characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parser := &CSVParser{mapping: mapping}
			parsed := parser.parseRow(tt.rowNumber, tt.row)

			assert.Equal(t, tt.expectValid, parsed.IsValid, "IsValid mismatch")

			// Count warnings and errors
			warnings := 0
			errors := 0
			for _, ve := range parsed.ValidationErrors {
				switch ve.Severity {
				case "warning":
					warnings++
				case "error":
					errors++
				}
			}

			assert.Equal(t, tt.expectWarnings, warnings, "Warning count mismatch")
			assert.Equal(t, tt.expectErrors, errors, "Error count mismatch")

			// Check for specific validation message if provided
			if tt.checkValidationMsg != "" {
				found := false
				for _, ve := range parsed.ValidationErrors {
					if contains(ve.Message, tt.checkValidationMsg) {
						found = true
						break
					}
				}
				assert.True(t, found, "Expected validation message not found: %s", tt.checkValidationMsg)
			}
		})
	}
}

// TestExcelParser_WithTransactionValidation tests Excel parser validation integration
func TestExcelParser_WithTransactionValidation(t *testing.T) {
	parser := &ExcelParser{}
	mapping := &ColumnMapping{
		DateColumn:        0,
		DescriptionColumn: 1,
		AmountColumn:      2,
		Currency:          "VND",
		TypeColumn:        -1,
		ReferenceColumn:   -1,
		DebitColumn:       -1,
		CreditColumn:      -1,
	}

	tests := []struct {
		name           string
		row            []string
		expectValid    bool
		expectWarnings int
	}{
		{
			name:           "Valid transaction",
			row:            []string{"01/01/2026", "Coffee", "50000"},
			expectValid:    true,
			expectWarnings: 0,
		},
		{
			name:           "Zero amount warning",
			row:            []string{"01/01/2026", "Free coffee", "0"},
			expectValid:    false, // Zero amount is an error by default
			expectWarnings: 0,
		},
		{
			name:           "Large amount warning",
			row:            []string{"01/01/2026", "Expensive item", "1500000000"},
			expectValid:    true,
			expectWarnings: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed := parser.parseRow("Sheet1", 1, tt.row, mapping)

			assert.Equal(t, tt.expectValid, parsed.IsValid)

			warnings := 0
			for _, ve := range parsed.ValidationErrors {
				if ve.Severity == "warning" {
					warnings++
				}
			}
			assert.Equal(t, tt.expectWarnings, warnings)
		})
	}
}

// TestPDFParser_WithTransactionValidation tests PDF parser validation integration
func TestPDFParser_WithTransactionValidation(t *testing.T) {
	parser := &PDFParser{}
	mapping := &ColumnMapping{
		DateColumn:        0,
		DescriptionColumn: 1,
		AmountColumn:      2,
		Currency:          "VND",
		TypeColumn:        -1,
		ReferenceColumn:   -1,
		DebitColumn:       -1,
		CreditColumn:      -1,
	}

	tests := []struct {
		name           string
		cells          []string
		expectValid    bool
		expectWarnings int
	}{
		{
			name:           "Valid transaction",
			cells:          []string{"01/01/2026", "Coffee", "50000"},
			expectValid:    true,
			expectWarnings: 0,
		},
		{
			name:           "Large amount warning",
			cells:          []string{"01/01/2026", "Large purchase", "1500000000"},
			expectValid:    true,
			expectWarnings: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed := parser.parseRow(1, tt.cells, mapping)

			assert.Equal(t, tt.expectValid, parsed.IsValid)

			warnings := 0
			for _, ve := range parsed.ValidationErrors {
				if ve.Severity == "warning" {
					warnings++
				}
			}
			assert.Equal(t, tt.expectWarnings, warnings)
		})
	}
}

// TestValidationConfig_ZeroAmountPolicy tests different zero amount policies
func TestValidationConfig_ZeroAmountPolicy(t *testing.T) {
	// Note: This test is conceptual - actual config integration would require
	// passing config to the parser, which would need to be implemented if
	// we want runtime-configurable validation policies
	t.Skip("Config integration not yet implemented - validator uses default config")
}

// Helper function to check if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || containsRecursive(s, substr))
}

func containsRecursive(s, substr string) bool {
	if len(s) < len(substr) {
		return false
	}
	if s[:len(substr)] == substr {
		return true
	}
	return containsRecursive(s[1:], substr)
}

// TestDateAgeValidation_Boundary tests the boundary condition for date age validation
func TestDateAgeValidation_Boundary(t *testing.T) {
	parser := &CSVParser{
		mapping: &ColumnMapping{
			DateColumn:        0,
			AmountColumn:      1,
			DescriptionColumn: 2,
			Currency:          "VND",
			DebitColumn:       -1,
			CreditColumn:      -1,
		},
	}

	now := time.Now()

	tests := []struct {
		name        string
		date        string
		expectError bool
	}{
		{
			name:        "Today - no warning",
			date:        now.Format("02/01/2006"),
			expectError: false,
		},
		{
			name:        "364 days ago - no warning",
			date:        now.AddDate(0, 0, -364).Format("02/01/2006"),
			expectError: false,
		},
		{
			name:        "366 days ago - should warn",
			date:        now.AddDate(0, 0, -366).Format("02/01/2006"),
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			row := []string{tt.date, "100000", "Test transaction"}
			parsed := parser.parseRow(1, row)

			hasDateWarning := false
			for _, ve := range parsed.ValidationErrors {
				if ve.Field == "date" && ve.Severity == "warning" {
					hasDateWarning = true
					break
				}
			}

			if tt.expectError {
				assert.True(t, hasDateWarning, "Expected date age warning")
			} else {
				assert.False(t, hasDateWarning, "Did not expect date age warning")
			}
		})
	}
}
