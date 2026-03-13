package parser

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExcelParser_HasHeader(t *testing.T) {
	parser := &ExcelParser{}

	tests := []struct {
		name     string
		row      []string
		expected bool
	}{
		{
			name:     "Header with English keywords",
			row:      []string{"Date", "Description", "Amount"},
			expected: true,
		},
		{
			name:     "Header with Vietnamese keywords",
			row:      []string{"Ngày", "Diễn giải", "Số tiền"},
			expected: true,
		},
		{
			name:     "Data row without keywords",
			row:      []string{"01/01/2026", "Coffee", "50000"},
			expected: false,
		},
		{
			name:     "Mixed case header",
			row:      []string{"TRANSACTION DATE", "Details", "Value"},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parser.hasHeader(tt.row)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestExcelParser_IsEmptyRow(t *testing.T) {
	parser := &ExcelParser{}

	assert.True(t, parser.isEmptyRow([]string{"", "", ""}))
	assert.True(t, parser.isEmptyRow([]string{"  ", "\t", " "}))
	assert.False(t, parser.isEmptyRow([]string{"", "data", ""}))
	assert.False(t, parser.isEmptyRow([]string{"01/01/2026", "", ""}))
}

func TestExcelParser_IsSummaryRow(t *testing.T) {
	parser := &ExcelParser{}

	tests := []struct {
		name     string
		row      []string
		expected bool
	}{
		{
			name:     "Total row",
			row:      []string{"Total", "1,000,000"},
			expected: true,
		},
		{
			name:     "Ending balance row",
			row:      []string{"Ending Balance", "500,000"},
			expected: true,
		},
		{
			name:     "Vietnamese total row",
			row:      []string{"Tổng cộng", "1,000,000"},
			expected: true,
		},
		{
			name:     "Data row",
			row:      []string{"01/01/2026", "Coffee", "50,000"},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parser.isSummaryRow(tt.row)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestExcelParser_DetectColumnsFromHeader(t *testing.T) {
	parser := &ExcelParser{}

	tests := []struct {
		name      string
		headerRow []string
		expected  *ColumnMapping
	}{
		{
			name:      "English header",
			headerRow: []string{"Date", "Description", "Amount", "Reference"},
			expected: &ColumnMapping{
				DateColumn:        0,
				DescriptionColumn: 1,
				AmountColumn:      2,
				ReferenceColumn:   3,
				TypeColumn:        -1,
				CategoryColumn:    -1,
				Currency:          "VND",
			},
		},
		{
			name:      "Vietnamese header",
			headerRow: []string{"Ngày", "Diễn giải", "Số tiền", "Số CT"},
			expected: &ColumnMapping{
				DateColumn:        0,
				DescriptionColumn: 1,
				AmountColumn:      2,
				ReferenceColumn:   3,
				TypeColumn:        -1,
				CategoryColumn:    -1,
				Currency:          "VND",
			},
		},
		{
			name:      "Header with type column",
			headerRow: []string{"Date", "Type", "Description", "Amount"},
			expected: &ColumnMapping{
				DateColumn:        0,
				TypeColumn:        1,
				DescriptionColumn: 2,
				AmountColumn:      3,
				ReferenceColumn:   -1,
				CategoryColumn:    -1,
				Currency:          "VND",
			},
		},
		{
			name:      "Missing required column",
			headerRow: []string{"Date", "Description"}, // Missing amount
			expected:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parser.detectColumnsFromHeader(tt.headerRow)

			if tt.expected == nil {
				assert.Nil(t, result)
			} else {
				assert.NotNil(t, result)
				assert.Equal(t, tt.expected.DateColumn, result.DateColumn)
				assert.Equal(t, tt.expected.DescriptionColumn, result.DescriptionColumn)
				assert.Equal(t, tt.expected.AmountColumn, result.AmountColumn)
				assert.Equal(t, tt.expected.ReferenceColumn, result.ReferenceColumn)
			}
		})
	}
}

func TestExcelParser_ParseDate(t *testing.T) {
	parser := &ExcelParser{}

	tests := []struct {
		name        string
		dateStr     string
		format      string
		shouldError bool
	}{
		{
			name:        "DD/MM/YYYY format",
			dateStr:     "15/01/2024",
			format:      "",
			shouldError: false,
		},
		{
			name:        "YYYY-MM-DD format",
			dateStr:     "2024-01-15",
			format:      "",
			shouldError: false,
		},
		{
			name:        "With timestamp",
			dateStr:     "2024-01-15 10:30:00",
			format:      "",
			shouldError: false,
		},
		{
			name:        "DD MMM YYYY format",
			dateStr:     "15 Jan 2024",
			format:      "",
			shouldError: false,
		},
		{
			name:        "Invalid date",
			dateStr:     "not a date",
			format:      "",
			shouldError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parser.parseDate(tt.dateStr, tt.format)
			if tt.shouldError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestExcelParser_ParseRow(t *testing.T) {
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
		name          string
		row           []string
		expectValid   bool
		expectErrors  int
		checkAmount   bool
		expectedAmount int64
	}{
		{
			name:          "Valid row",
			row:           []string{"01/01/2026", "Coffee", "50,000"},
			expectValid:   true,
			expectErrors:  0,
			checkAmount:   true,
			expectedAmount: 500000000, // 50,000 * 10000
		},
		{
			name:          "Missing date",
			row:           []string{"", "Coffee", "50,000"},
			expectValid:   false,
			expectErrors:  1,
		},
		{
			name:          "Missing amount",
			row:           []string{"01/01/2026", "Coffee", ""},
			expectValid:   false,
			expectErrors:  1,
		},
		{
			name:          "Invalid date format",
			row:           []string{"not a date", "Coffee", "50,000"},
			expectValid:   false,
			expectErrors:  1,
		},
		{
			name:          "Invalid amount format",
			row:           []string{"01/01/2026", "Coffee", "abc"},
			expectValid:   false,
			expectErrors:  1,
		},
		{
			name:          "Empty description uses default",
			row:           []string{"01/01/2026", "", "50,000"},
			expectValid:   true,
			expectErrors:  1, // Info level error about default description
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed := parser.parseRow("Sheet1", 1, tt.row, mapping)

			assert.Equal(t, tt.expectValid, parsed.IsValid, "IsValid mismatch")
			assert.Len(t, parsed.ValidationErrors, tt.expectErrors, "Unexpected number of validation errors")

			if tt.checkAmount && parsed.IsValid {
				assert.Equal(t, tt.expectedAmount, parsed.Amount, "Amount mismatch")
			}
		})
	}
}

func TestExcelParser_ParseExcelDateSerial(t *testing.T) {
	parser := &ExcelParser{}

	tests := []struct {
		name     string
		serial   float64
		expected string // Expected date in YYYY-MM-DD format
	}{
		{
			name:     "Excel serial for 2024-01-01",
			serial:   45292.0, // Excel serial for 2024-01-01
			expected: "2024-01-01",
		},
		{
			name:     "Excel serial for 2000-01-01",
			serial:   36526.0, // Excel serial for 2000-01-01
			expected: "2000-01-01",
		},
		{
			name:     "Excel serial with time (2024-06-14 12:00:00)",
			serial:   45457.5, // Excel serial for 2024-06-14 at noon
			expected: "2024-06-14",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parser.parseExcelDateSerial(tt.serial)
			resultStr := result.Format("2006-01-02")
			assert.Equal(t, tt.expected, resultStr)
		})
	}
}

func TestExcelParser_SetSheet(t *testing.T) {
	parser := NewExcelParser("test.xlsx", nil)

	assert.Equal(t, "", parser.sheetName, "Default sheet name should be empty")

	parser.SetSheet("Transactions")
	assert.Equal(t, "Transactions", parser.sheetName, "Sheet name should be set")
}

func TestParseFloat(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expected    float64
		shouldError bool
	}{
		{
			name:        "Valid integer",
			input:       "12345",
			expected:    12345.0,
			shouldError: false,
		},
		{
			name:        "Valid float",
			input:       "45292.5",
			expected:    45292.5,
			shouldError: false,
		},
		{
			name:        "Invalid string",
			input:       "not a number",
			expected:    0,
			shouldError: true,
		},
		{
			name:        "Empty string",
			input:       "",
			expected:    0,
			shouldError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseFloat(tt.input)
			if tt.shouldError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}
