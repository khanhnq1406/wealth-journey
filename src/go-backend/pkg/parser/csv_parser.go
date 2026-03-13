package parser

import (
	"context"
	"encoding/csv"
	"fmt"
	"strings"
	"time"

	"wealthjourney/pkg/validator"
)

// CSVParser handles parsing of bank statement CSV files
type CSVParser struct {
	filePath string
	mapping  *ColumnMapping
}

// ColumnMapping defines how CSV columns map to transaction fields
type ColumnMapping struct {
	DateColumn        int
	AmountColumn      int
	DebitColumn       int // -1 if not present; for statements with separate debit/credit columns
	CreditColumn      int // -1 if not present; for statements with separate debit/credit columns
	DescriptionColumn int
	TypeColumn        int           // -1 if not present
	CategoryColumn    int           // -1 if not present
	ReferenceColumn   int           // -1 if not present
	DateFormat        string        // Optional: specific format to try first
	Currency          string
	AmountFormat      *AmountFormat // Optional: specific amount format
}

// ParsedRow represents a single parsed transaction row
type ParsedRow struct {
	RowNumber           int
	Date                time.Time
	Amount              int64  // Smallest currency unit (×10000 for 4 decimal precision)
	Description         string // Cleaned description
	OriginalDescription string // Original description from file before cleaning
	Type                string // "income" or "expense"
	CategoryID          int32
	ReferenceNum        string
	ValidationErrors    []ValidationError
	IsValid             bool
}

// ValidationError represents a validation error for a specific field
type ValidationError struct {
	Field    string
	Message  string
	Severity string // "error", "warning", "info"
}

func NewCSVParser(filePath string, mapping *ColumnMapping) *CSVParser {
	return &CSVParser{
		filePath: filePath,
		mapping:  mapping,
	}
}

func (p *CSVParser) Parse() ([]*ParsedRow, error) {
	// Open the file (supports both URLs and local paths)
	file, err := FetchFileReader(context.Background(), p.filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer func() { _ = file.Close() }()

	// Create CSV reader
	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1 // Allow variable number of fields

	// Read all rows
	rows, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV: %w", err)
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("CSV file is empty")
	}

	var parsedRows []*ParsedRow
	startRow := 0

	// Skip header row if present
	if p.hasHeader(rows[0]) {
		startRow = 1
	}

	// Parse each data row
	for i := startRow; i < len(rows); i++ {
		row := rows[i]
		rowNumber := i + 1 // 1-indexed for user display

		// Skip empty rows
		if p.isEmptyRow(row) {
			continue
		}

		// Skip summary rows
		if p.isSummaryRow(row) {
			continue
		}

		// Parse the row
		parsedRow := p.parseRow(rowNumber, row)
		parsedRows = append(parsedRows, parsedRow)
	}

	return parsedRows, nil
}

func (p *CSVParser) parseRow(rowNumber int, row []string) *ParsedRow {
	parsed := &ParsedRow{
		RowNumber:        rowNumber,
		IsValid:          true,
		ValidationErrors: []ValidationError{},
	}

	// Validate column indices
	maxCol := len(row) - 1
	if p.mapping.DateColumn > maxCol {
		parsed.addError("date", "Date column index out of range", "error")
	}
	if p.mapping.AmountColumn > maxCol {
		parsed.addError("amount", "Amount column index out of range", "error")
	}
	if p.mapping.DescriptionColumn > maxCol {
		parsed.addError("description", "Description column index out of range", "error")
	}

	// Parse date using enhanced date parser
	if p.mapping.DateColumn <= maxCol {
		dateStr := strings.TrimSpace(row[p.mapping.DateColumn])
		if dateStr == "" {
			parsed.addError("date", "Date is required", "error")
		} else {
			dateParser := NewDateParser(p.mapping.DateFormat)
			date, err := dateParser.Parse(dateStr)
			if err != nil {
				parsed.addError("date", fmt.Sprintf("Invalid date format: %v", err), "error")
			} else {
				parsed.Date = date
			}
		}
	}

	// Parse amount using enhanced amount parser
	if p.mapping.AmountColumn <= maxCol {
		amountStr := strings.TrimSpace(row[p.mapping.AmountColumn])
		if amountStr == "" {
			parsed.addError("amount", "Amount is required", "error")
		} else {
			amountParser := NewAmountParser(p.mapping.AmountFormat)
			amount, err := amountParser.Parse(amountStr)
			if err != nil {
				parsed.addError("amount", fmt.Sprintf("Invalid amount format: %v", err), "error")
			} else {
				parsed.Amount = amount
			}
		}
	}

	// Parse description and clean it
	if p.mapping.DescriptionColumn <= maxCol {
		description := strings.TrimSpace(row[p.mapping.DescriptionColumn])
		if description == "" {
			parsed.Description = "Imported Transaction"
			parsed.addError("description", "Description is empty, using default", "info")
		} else {
			// Clean the description
			cleaner := NewDescriptionCleaner()
			parsed.Description = cleaner.Clean(description)
		}
	} else {
		parsed.Description = "Imported Transaction"
	}

	// Parse type using enhanced type detector
	detector := NewTypeDetector()
	parsed.Type = detector.DetectType(parsed.Description, parsed.Amount)

	// Parse reference (if column exists)
	if p.mapping.ReferenceColumn >= 0 && p.mapping.ReferenceColumn <= maxCol {
		parsed.ReferenceNum = strings.TrimSpace(row[p.mapping.ReferenceColumn])
	}

	// Parse category (if column exists)
	if p.mapping.CategoryColumn >= 0 && p.mapping.CategoryColumn <= maxCol {
		categoryStr := strings.TrimSpace(row[p.mapping.CategoryColumn])
		if categoryStr != "" {
			// Note: Actual category ID mapping would be done by the service layer
			// For now, we just store 0 as placeholder
			parsed.CategoryID = 0
		}
	}

	// Apply business rules validation (if all required fields are parsed successfully)
	if parsed.IsValid {
		validationErrors := validator.ValidateTransaction(
			parsed.Amount,
			p.mapping.Currency,
			parsed.Description,
			parsed.Date,
		)

		for _, ve := range validationErrors {
			parsed.addError(ve.Field, ve.Message, ve.Severity)
		}
	}

	return parsed
}

// parseDate is deprecated - use DateParser instead
// Kept for backward compatibility with tests
func (p *CSVParser) parseDate(dateStr string) (time.Time, error) {
	dateFormat := ""
	if p.mapping != nil {
		dateFormat = p.mapping.DateFormat
	}
	dateParser := NewDateParser(dateFormat)
	return dateParser.Parse(dateStr)
}

// parseAmount is deprecated - use AmountParser instead
// Kept for backward compatibility with other parsers
func (p *CSVParser) parseAmount(amountStr string) (int64, error) {
	var amountFormat *AmountFormat
	if p.mapping != nil {
		amountFormat = p.mapping.AmountFormat
	}
	amountParser := NewAmountParser(amountFormat)
	return amountParser.Parse(amountStr)
}

// detectType is deprecated - use TypeDetector instead
// Kept for backward compatibility with other parsers
func (p *CSVParser) detectType(typeStr string, amount int64) string {
	detector := NewTypeDetector()
	// If explicit type string provided, check it first
	if typeStr != "" {
		// Try to detect from type string
		return detector.DetectType(typeStr, amount)
	}
	return detector.DetectType("", amount)
}

func (p *CSVParser) hasHeader(row []string) bool {
	// Check if first row contains common header keywords
	headerKeywords := []string{
		"date", "amount", "description", "balance", "transaction",
		"debit", "credit", "type", "category", "reference", "memo",
	}

	// Join all cells and check for keywords
	rowText := strings.ToLower(strings.Join(row, " "))

	for _, keyword := range headerKeywords {
		if strings.Contains(rowText, keyword) {
			return true
		}
	}

	return false
}

func (p *CSVParser) isEmptyRow(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

func (p *CSVParser) isSummaryRow(row []string) bool {
	// Check if the row contains summary keywords
	summaryKeywords := []string{
		"total", "balance", "summary", "subtotal",
		"grand total", "ending balance", "closing balance",
		"opening balance", "beginning balance",
	}

	// Join all cells and check for keywords
	rowText := strings.ToLower(strings.Join(row, " "))

	for _, keyword := range summaryKeywords {
		if strings.Contains(rowText, keyword) {
			return true
		}
	}

	return false
}

// addError adds a validation error to the ParsedRow and marks it as invalid if severity is "error"
func (pr *ParsedRow) addError(field, message, severity string) {
	pr.ValidationErrors = append(pr.ValidationErrors, ValidationError{
		Field:    field,
		Message:  message,
		Severity: severity,
	})

	if severity == "error" {
		pr.IsValid = false
	}
}
