package parser

import (
	"bytes"
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"

	"wealthjourney/pkg/validator"
)

// ExcelParser handles parsing of bank statement Excel files (.xlsx, .xls)
type ExcelParser struct {
	filePath      string
	columnMapping *ColumnMapping
	sheetName     string // Specific sheet to parse (empty = auto-detect or first sheet)
	file          *excelize.File // Keep file open for multi-operation support
}

// NewExcelParser creates a new Excel parser instance
func NewExcelParser(filePath string, mapping *ColumnMapping) *ExcelParser {
	return &ExcelParser{
		filePath:      filePath,
		columnMapping: mapping,
		sheetName:     "", // Auto-detect or use first sheet
	}
}

// SetSheet sets the specific sheet to parse
func (p *ExcelParser) SetSheet(sheetName string) {
	p.sheetName = sheetName
}

// openFile opens the Excel file and keeps it for multiple operations
func (p *ExcelParser) openFile() error {
	if p.file != nil {
		return nil // Already open
	}

	var f *excelize.File
	var err error

	// Check if filePath is a URL or local path
	if strings.HasPrefix(p.filePath, "http://") || strings.HasPrefix(p.filePath, "https://") {
		// Download file content first for URLs
		data, err := FetchFileContent(context.Background(), p.filePath)
		if err != nil {
			return fmt.Errorf("failed to fetch Excel file: %w", err)
		}
		// Open from bytes
		f, err = excelize.OpenReader(bytes.NewReader(data))
		if err != nil {
			return fmt.Errorf("failed to open Excel file: %w", err)
		}
	} else {
		// Open from local file path
		f, err = excelize.OpenFile(p.filePath)
		if err != nil {
			return fmt.Errorf("failed to open Excel file: %w", err)
		}
	}

	p.file = f
	return nil
}

// Close closes the Excel file
func (p *ExcelParser) Close() error {
	if p.file != nil {
		err := p.file.Close()
		p.file = nil
		return err
	}
	return nil
}

// ListSheets returns all sheet names in the Excel file
func (p *ExcelParser) ListSheets() ([]string, error) {
	if err := p.openFile(); err != nil {
		return nil, err
	}

	sheetList := p.file.GetSheetList()

	// Filter out hidden sheets
	var visibleSheets []string
	for _, sheetName := range sheetList {
		if !p.isSheetHidden(sheetName) {
			visibleSheets = append(visibleSheets, sheetName)
		}
	}

	return visibleSheets, nil
}

// isSheetHidden checks if a sheet is hidden
func (p *ExcelParser) isSheetHidden(sheetName string) bool {
	if p.file == nil {
		return false
	}

	// Get sheet index
	sheetIndex, err := p.file.GetSheetIndex(sheetName)
	if err != nil || sheetIndex < 0 {
		return false
	}

	// Check if sheet is hidden (excelize provides IsSheetVisible method)
	visible, err := p.file.GetSheetVisible(sheetName)
	if err != nil {
		return false
	}

	return !visible
}

// DetectDataSheet attempts to auto-detect which sheet contains transaction data
func (p *ExcelParser) DetectDataSheet() (string, error) {
	if err := p.openFile(); err != nil {
		return "", err
	}

	sheets, err := p.ListSheets()
	if err != nil {
		return "", err
	}

	if len(sheets) == 0 {
		return "", fmt.Errorf("no visible sheets found")
	}

	// If only one sheet, use it
	if len(sheets) == 1 {
		return sheets[0], nil
	}

	// Heuristic 1: Look for sheet name keywords
	transactionKeywords := []string{
		"transaction", "statement", "detail", "history",
		"giao dịch", "sao kê", "chi tiết",
	}

	for _, sheet := range sheets {
		sheetLower := strings.ToLower(sheet)
		for _, keyword := range transactionKeywords {
			if strings.Contains(sheetLower, keyword) {
				return sheet, nil
			}
		}
	}

	// Heuristic 2: Choose sheet with most data rows
	maxRows := 0
	bestSheet := sheets[0]

	for _, sheet := range sheets {
		rows, err := p.file.GetRows(sheet)
		if err != nil {
			continue
		}

		// Count non-empty rows
		dataRows := 0
		for _, row := range rows {
			if !p.isEmptyRow(row) {
				dataRows++
			}
		}

		if dataRows > maxRows {
			maxRows = dataRows
			bestSheet = sheet
		}
	}

	return bestSheet, nil
}

// Parse converts Excel file to ParsedRow format (matching CSV parser output)
func (p *ExcelParser) Parse() ([]*ParsedRow, error) {
	// Open Excel file
	if err := p.openFile(); err != nil {
		return nil, err
	}

	// Determine which sheet to parse
	sheetName := p.sheetName
	if sheetName == "" {
		// Auto-detect best sheet
		detected, err := p.DetectDataSheet()
		if err != nil {
			return nil, fmt.Errorf("failed to detect data sheet: %w", err)
		}
		sheetName = detected
	}

	// Validate sheet exists and is visible
	if p.isSheetHidden(sheetName) {
		return nil, fmt.Errorf("sheet '%s' is hidden", sheetName)
	}

	// Get all rows from the sheet
	rows, err := p.file.GetRows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to read rows from sheet '%s': %w", sheetName, err)
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("excel file is empty")
	}

	var parsedRows []*ParsedRow
	startRow := 0

	// If no explicit column mapping, search for header row
	mapping := p.columnMapping
	if mapping == nil {
		// Extract currency from Excel metadata first (search first 50 rows)
		extractedCurrency := p.extractCurrencyFromExcel(sheetName, 50)

		// Search for header row (up to first 50 rows to handle bank statement headers)
		maxHeaderSearch := 50
		if len(rows) < maxHeaderSearch {
			maxHeaderSearch = len(rows)
		}

		for i := 0; i < maxHeaderSearch; i++ {
			if p.hasHeader(rows[i]) {
				mapping = p.detectColumnsFromHeader(rows[i])
				if mapping != nil {
					// Override currency with extracted value if found
					if extractedCurrency != "" {
						mapping.Currency = extractedCurrency
					}
					startRow = i + 1 // Start parsing after header
					break
				}
			}
		}

		// If still no mapping found, return error
		if mapping == nil {
			return nil, fmt.Errorf("column mapping is required. Either provide bankTemplateId or customMapping")
		}
	}

	// Parse each data row
	for i := startRow; i < len(rows); i++ {
		row := rows[i]
		rowNumber := i + 1 // 1-indexed for user display

		// Skip hidden rows
		if p.isRowHidden(sheetName, rowNumber) {
			continue
		}

		// Skip empty rows
		if p.isEmptyRow(row) {
			continue
		}

		// Skip summary rows
		if p.isSummaryRow(row) {
			continue
		}

		// Parse the row
		parsedRow := p.parseRow(sheetName, rowNumber, row, mapping)
		parsedRows = append(parsedRows, parsedRow)
	}

	// Store the detected mapping for later retrieval
	p.columnMapping = mapping

	return parsedRows, nil
}

// GetDetectedMapping returns the column mapping that was detected during parsing
// This includes the extracted currency from the file metadata
func (p *ExcelParser) GetDetectedMapping() *ColumnMapping {
	return p.columnMapping
}

// isRowHidden checks if a specific row is hidden
func (p *ExcelParser) isRowHidden(sheetName string, rowNumber int) bool {
	if p.file == nil {
		return false
	}

	// Get row style to check if hidden
	// Note: excelize doesn't provide direct IsRowHidden method, but we can check row height
	height, err := p.file.GetRowHeight(sheetName, rowNumber)
	if err != nil {
		return false
	}

	// A row with height 0 is considered hidden
	return height == 0
}

// parseExcelDateSerial converts Excel date serial to time.Time
// Excel dates are stored as days since 1899-12-30 (with a leap year bug)
func (p *ExcelParser) parseExcelDateSerial(serial float64) time.Time {
	// Excel's epoch is 1899-12-30 (accounting for the 1900 leap year bug)
	excelEpoch := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)

	// Add the number of days
	days := int(serial)
	fractionalDay := serial - float64(days)

	// Calculate date
	date := excelEpoch.AddDate(0, 0, days)

	// Add time component (fractional part of the day)
	if fractionalDay > 0 {
		seconds := int(fractionalDay * 86400) // 86400 seconds in a day
		date = date.Add(time.Duration(seconds) * time.Second)
	}

	return date
}

// getCellStyle returns the style information for a cell
func (p *ExcelParser) getCellStyle(sheetName string, cellRef string) (*excelize.Style, error) {
	if p.file == nil {
		return nil, fmt.Errorf("file not open")
	}

	styleID, err := p.file.GetCellStyle(sheetName, cellRef)
	if err != nil {
		return nil, err
	}

	style, err := p.file.GetStyle(styleID)
	if err != nil {
		return nil, err
	}

	return style, nil
}

// isCellRed checks if a cell has red font color (indicating negative amount)
func (p *ExcelParser) isCellRed(sheetName string, cellRef string) bool {
	style, err := p.getCellStyle(sheetName, cellRef)
	if err != nil {
		return false
	}

	if style == nil || style.Font == nil {
		return false
	}

	// Check for red color codes
	// Common red colors: FF0000, DC143C, C00000, FF (short form)
	color := strings.ToUpper(style.Font.Color)
	redColors := []string{"FF0000", "DC143C", "C00000", "FF", "RED"}

	for _, redColor := range redColors {
		if strings.Contains(color, redColor) {
			return true
		}
	}

	return false
}

//nolint:unused
// getCellValueWithFormula gets the calculated value of a cell (evaluating formulas)
func (p *ExcelParser) getCellValueWithFormula(sheetName string, cellRef string) (string, error) {
	if p.file == nil {
		return "", fmt.Errorf("file not open")
	}

	// GetCellValue automatically evaluates formulas and returns the result
	value, err := p.file.GetCellValue(sheetName, cellRef)
	if err != nil {
		return "", err
	}

	return value, nil
}

// parseRow converts an Excel row to ParsedRow format
func (p *ExcelParser) parseRow(sheetName string, rowNumber int, row []string, mapping *ColumnMapping) *ParsedRow {
	parsed := &ParsedRow{
		RowNumber:        rowNumber,
		IsValid:          true,
		ValidationErrors: []ValidationError{},
	}

	// Validate column indices
	maxCol := len(row) - 1

	// Parse date using enhanced date parser
	if mapping.DateColumn <= maxCol {
		dateStr := strings.TrimSpace(row[mapping.DateColumn])
		if dateStr == "" {
			parsed.addError("date", "Date is required", "error")
		} else {
			// Try to parse as Excel date serial first
			if serial, err := parseFloat(dateStr); err == nil && serial > 1 && serial < 100000 {
				// Looks like an Excel date serial (reasonable range: 1900-2100)
				parsed.Date = p.parseExcelDateSerial(serial)
			} else {
				// Parse as text date
				dateParser := NewDateParser(mapping.DateFormat)
				date, err := dateParser.Parse(dateStr)
				if err != nil {
					parsed.addError("date", fmt.Sprintf("Invalid date format: %v", err), "error")
				} else {
					parsed.Date = date
				}
			}
		}
	} else {
		parsed.addError("date", "Date column not found", "error")
	}

	// Parse amount using enhanced amount parser
	// Handle both single amount column and separate debit/credit columns
	if mapping.DebitColumn != -1 && mapping.CreditColumn != -1 {
		// Bank statement with separate debit/credit columns
		debitStr := ""
		creditStr := ""

		if mapping.DebitColumn <= maxCol {
			debitStr = strings.TrimSpace(row[mapping.DebitColumn])
		}
		if mapping.CreditColumn <= maxCol {
			creditStr = strings.TrimSpace(row[mapping.CreditColumn])
		}

		amountParser := NewAmountParser(mapping.AmountFormat)

		// Try debit first (negative amount)
		if debitStr != "" {
			amount, err := amountParser.Parse(debitStr)
			if err != nil {
				parsed.addError("amount", fmt.Sprintf("Invalid debit amount format: %v", err), "error")
			} else {
				// Debit is negative (expense/withdrawal)
				parsed.Amount = -amount
			}
		} else if creditStr != "" {
			// Try credit (positive amount)
			amount, err := amountParser.Parse(creditStr)
			if err != nil {
				parsed.addError("amount", fmt.Sprintf("Invalid credit amount format: %v", err), "error")
			} else {
				// Credit is positive (income/deposit)
				parsed.Amount = amount
			}
		} else {
			parsed.addError("amount", "Amount is required", "error")
		}
	} else if mapping.AmountColumn != -1 && mapping.AmountColumn <= maxCol {
		// Single amount column
		amountStr := strings.TrimSpace(row[mapping.AmountColumn])
		if amountStr == "" {
			parsed.addError("amount", "Amount is required", "error")
		} else {
			amountParser := NewAmountParser(mapping.AmountFormat)
			amount, err := amountParser.Parse(amountStr)
			if err != nil {
				parsed.addError("amount", fmt.Sprintf("Invalid amount format: %v", err), "error")
			} else {
				// Check if cell has red font (negative amount)
				cellRef, _ := excelize.CoordinatesToCellName(mapping.AmountColumn+1, rowNumber)
				if cellRef != "" && p.isCellRed(sheetName, cellRef) {
					// Make amount negative if it's red and currently positive
					if amount > 0 {
						amount = -amount
					}
				}
				parsed.Amount = amount
			}
		}
	} else {
		parsed.addError("amount", "Amount column not found", "error")
	}

	// Parse description and clean it
	if mapping.DescriptionColumn <= maxCol {
		description := strings.TrimSpace(row[mapping.DescriptionColumn])
		if description == "" {
			parsed.Description = "Imported Transaction"
			parsed.OriginalDescription = ""
			parsed.addError("description", "Description is empty, using default", "info")
		} else {
			// Store original description before cleaning
			parsed.OriginalDescription = description
			// Clean the description
			cleaner := NewDescriptionCleaner()
			parsed.Description = cleaner.Clean(description)
		}
	} else {
		parsed.Description = "Imported Transaction"
		parsed.OriginalDescription = ""
		parsed.addError("description", "Description column not found", "info")
	}

	// Parse type using enhanced type detector
	detector := NewTypeDetector()
	parsed.Type = detector.DetectType(parsed.Description, parsed.Amount)

	// Parse reference (if column exists)
	if mapping.ReferenceColumn >= 0 && mapping.ReferenceColumn <= maxCol {
		parsed.ReferenceNum = strings.TrimSpace(row[mapping.ReferenceColumn])
	}

	// Apply business rules validation (if all required fields are parsed successfully)
	if parsed.IsValid {
		validationErrors := validator.ValidateTransaction(
			parsed.Amount,
			mapping.Currency,
			parsed.Description,
			parsed.Date,
		)

		for _, ve := range validationErrors {
			parsed.addError(ve.Field, ve.Message, ve.Severity)
		}
	}

	return parsed
}

// hasHeader checks if the first row contains header keywords
func (p *ExcelParser) hasHeader(row []string) bool {
	headerKeywords := []string{
		"date", "amount", "description", "balance", "transaction",
		"debit", "credit", "type", "category", "reference", "memo",
		// Vietnamese keywords
		"ngày", "số tiền", "diễn giải", "mô tả", "số dư",
	}

	rowText := strings.ToLower(strings.Join(row, " "))

	for _, keyword := range headerKeywords {
		if strings.Contains(rowText, keyword) {
			return true
		}
	}

	return false
}

// isEmptyRow checks if a row is empty
func (p *ExcelParser) isEmptyRow(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

// isSummaryRow checks if a row contains summary keywords
func (p *ExcelParser) isSummaryRow(row []string) bool {
	summaryKeywords := []string{
		"total", "balance", "summary", "subtotal",
		"grand total", "ending balance", "closing balance",
		"opening balance", "beginning balance",
		// Vietnamese keywords
		"tổng", "tổng cộng", "số dư",
		// Footer/explanation keywords
		"phiếu này được in", "this statement", "description:", "diễn giải:",
		"ngày giao dịch:", "transaction date:", "ghi chú", "note:",
		"được in từ", "printed from",
	}

	rowText := strings.ToLower(strings.Join(row, " "))

	for _, keyword := range summaryKeywords {
		if strings.Contains(rowText, keyword) {
			return true
		}
	}

	return false
}

// extractCurrencyFromExcel extracts currency code from Excel metadata/header section
// Looks for "Loại tiền" / "Currency" labels and extracts the 3-letter ISO code
func (p *ExcelParser) extractCurrencyFromExcel(sheetName string, maxRows int) string {
	if p.file == nil {
		return ""
	}

	// Valid ISO 4217 currency codes (3 uppercase letters)
	validCurrencies := map[string]bool{
		"VND": true, "USD": true, "EUR": true, "GBP": true,
		"JPY": true, "CNY": true, "KRW": true, "THB": true,
		"SGD": true, "MYR": true, "AUD": true, "CAD": true,
		"CHF": true, "HKD": true, "NZD": true, "SEK": true,
		// Add more as needed
	}

	// Currency keywords to search for (Vietnamese and English)
	currencyKeywords := []string{
		"loại tiền", "loai tien",
		"currency",
		"tiền tệ", "tien te",
		"mã tiền", "ma tien",
	}

	// Get all rows from the sheet
	rows, err := p.file.GetRows(sheetName)
	if err != nil {
		return ""
	}

	// Search first N rows for currency metadata (before transaction table)
	searchLimit := maxRows
	if len(rows) < searchLimit {
		searchLimit = len(rows)
	}

	for rowIdx := 0; rowIdx < searchLimit; rowIdx++ {
		row := rows[rowIdx]

		for colIdx, cellValue := range row {
			cellLower := strings.ToLower(strings.TrimSpace(cellValue))

			// Check if this cell contains a currency keyword
			foundKeyword := false
			for _, keyword := range currencyKeywords {
				if strings.Contains(cellLower, keyword) {
					foundKeyword = true
					break
				}
			}

			if !foundKeyword {
				continue
			}

			// Found a currency label! Now look for the currency value
			// It could be in the same cell (e.g., "Currency: VND")
			// Or in adjacent cells (next column or next row)

			// Try to extract from the same cell
			parts := strings.Fields(cellValue)
			for _, part := range parts {
				partUpper := strings.ToUpper(strings.Trim(part, "/:,"))
				if len(partUpper) == 3 && validCurrencies[partUpper] {
					return partUpper
				}
			}

			// Try the next cell in the same row (right adjacent)
			if colIdx+1 < len(row) {
				nextCell := strings.ToUpper(strings.TrimSpace(row[colIdx+1]))
				if len(nextCell) == 3 && validCurrencies[nextCell] {
					return nextCell
				}
				// Also check if it's a longer string that starts with currency code
				if len(nextCell) >= 3 {
					prefix := nextCell[:3]
					if validCurrencies[prefix] {
						return prefix
					}
				}
			}

			// Try the cell below (next row, same column)
			if rowIdx+1 < len(rows) {
				nextRow := rows[rowIdx+1]
				if colIdx < len(nextRow) {
					belowCell := strings.ToUpper(strings.TrimSpace(nextRow[colIdx]))
					if len(belowCell) == 3 && validCurrencies[belowCell] {
						return belowCell
					}
					if len(belowCell) >= 3 {
						prefix := belowCell[:3]
						if validCurrencies[prefix] {
							return prefix
						}
					}
				}
			}

			// Try diagonal (next row, next column)
			if rowIdx+1 < len(rows) && colIdx+1 < len(rows[rowIdx+1]) {
				diagonalCell := strings.ToUpper(strings.TrimSpace(rows[rowIdx+1][colIdx+1]))
				if len(diagonalCell) == 3 && validCurrencies[diagonalCell] {
					return diagonalCell
				}
			}
		}
	}

	return "" // Not found, will use default
}

// detectColumnsFromHeader attempts to auto-detect column mapping from header row
func (p *ExcelParser) detectColumnsFromHeader(headerRow []string) *ColumnMapping {
	mapping := &ColumnMapping{
		DateColumn:        -1,
		AmountColumn:      -1,
		DebitColumn:       -1,
		CreditColumn:      -1,
		DescriptionColumn: -1,
		TypeColumn:        -1,
		CategoryColumn:    -1,
		ReferenceColumn:   -1,
		Currency:          "VND", // Default to VND
	}

	// Keywords for each column type (English + Vietnamese)
	dateKeywords := []string{"date", "ngày", "ngay", "posting date", "transaction date"}
	descKeywords := []string{"description", "diễn giải", "dien giai", "mô tả", "mo ta", "particulars", "details", "memo"}
	amountKeywords := []string{"amount", "số tiền", "so tien", "withdrawals", "deposits", "value"}
	// Note: "nợ" without spaces, not "no" (to avoid matching "Transaction No")
	debitKeywords := []string{"debit", "nợ tktt", "nợ", "withdraw", "rút"}
	creditKeywords := []string{"credit", "có tktt", "có", "deposit", "nạp"}
	refKeywords := []string{"reference", "số ct", "so ct", "ref", "transaction id", "ref no", "số bút toán", "transaction no"}
	typeKeywords := []string{"type", "loại", "loai", "transaction type"}

	for i, cell := range headerRow {
		// Normalize cell text: replace newlines with spaces for better matching
		cellNormalized := strings.ReplaceAll(cell, "\n", " ")
		cellLower := strings.ToLower(cellNormalized)

		// Check for date column
		for _, keyword := range dateKeywords {
			if strings.Contains(cellLower, keyword) && mapping.DateColumn == -1 {
				mapping.DateColumn = i
				break
			}
		}

		// Check for description column
		for _, keyword := range descKeywords {
			if strings.Contains(cellLower, keyword) && mapping.DescriptionColumn == -1 {
				mapping.DescriptionColumn = i
				break
			}
		}

		// Check for debit column (specific check before general amount)
		for _, keyword := range debitKeywords {
			if strings.Contains(cellLower, keyword) && mapping.DebitColumn == -1 {
				mapping.DebitColumn = i
				break
			}
		}

		// Check for credit column (specific check before general amount)
		for _, keyword := range creditKeywords {
			if strings.Contains(cellLower, keyword) && mapping.CreditColumn == -1 {
				mapping.CreditColumn = i
				break
			}
		}

		// Check for general amount column (only if debit/credit not found)
		if mapping.DebitColumn == -1 && mapping.CreditColumn == -1 {
			for _, keyword := range amountKeywords {
				if strings.Contains(cellLower, keyword) && mapping.AmountColumn == -1 {
					mapping.AmountColumn = i
					break
				}
			}
		}

		// Check for reference column
		for _, keyword := range refKeywords {
			if strings.Contains(cellLower, keyword) && mapping.ReferenceColumn == -1 {
				mapping.ReferenceColumn = i
				break
			}
		}

		// Check for type column
		for _, keyword := range typeKeywords {
			if strings.Contains(cellLower, keyword) && mapping.TypeColumn == -1 {
				mapping.TypeColumn = i
				break
			}
		}
	}

	// Validate that required columns were found
	// Either AmountColumn OR (DebitColumn AND CreditColumn) must be present
	hasAmount := mapping.AmountColumn != -1
	hasDebitCredit := mapping.DebitColumn != -1 && mapping.CreditColumn != -1

	if mapping.DateColumn == -1 || mapping.DescriptionColumn == -1 {
		return nil
	}

	if !hasAmount && !hasDebitCredit {
		return nil
	}

	return mapping
}

// parseDate is deprecated - use DateParser instead
func (p *ExcelParser) parseDate(dateStr string, preferredFormat string) (time.Time, error) {
	dateParser := NewDateParser(preferredFormat)
	return dateParser.Parse(dateStr)
}

//nolint:unused
// parseAmount is deprecated - use AmountParser instead
func (p *ExcelParser) parseAmount(amountStr string) (int64, error) {
	amountParser := NewAmountParserWithAutoDetect()
	return amountParser.Parse(amountStr)
}

//nolint:unused
// detectType is deprecated - use TypeDetector instead
func (p *ExcelParser) detectType(typeStr string, amount int64) string {
	detector := NewTypeDetector()
	if typeStr != "" {
		return detector.DetectType(typeStr, amount)
	}
	return detector.DetectType("", amount)
}

// parseFloat safely parses a string to float64
func parseFloat(s string) (float64, error) {
	return strconv.ParseFloat(s, 64)
}
