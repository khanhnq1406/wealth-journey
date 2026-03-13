package parser

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/ledongthuc/pdf"

	"wealthjourney/pkg/validator"
)

// PDFParser handles parsing of bank statement PDF files
type PDFParser struct {
	filePath      string
	columnMapping *ColumnMapping
}

// NewPDFParser creates a new PDF parser instance
func NewPDFParser(filePath string, mapping *ColumnMapping) *PDFParser {
	return &PDFParser{
		filePath:      filePath,
		columnMapping: mapping,
	}
}

// ExtractTable extracts structured table data from PDF
func (p *PDFParser) ExtractTable() ([]TableRow, error) {
	// Open PDF file (supports both URLs and local paths)
	f, err := FetchFileReaderWithSize(context.Background(), p.filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open PDF: %w", err)
	}
	defer func() { _ = f.Close() }()

	// Create PDF reader
	reader, err := pdf.NewReader(f, f.Size())
	if err != nil {
		// Try with encrypted reader (empty password)
		reader, err = pdf.NewReaderEncrypted(f, f.Size(), func() string { return "" })
		if err != nil {
			return nil, fmt.Errorf("failed to create PDF reader: %w. PDF may be password-protected", err)
		}
	}

	// Extract styled text from all pages
	texts, err := reader.GetStyledTexts()
	if err != nil {
		return nil, fmt.Errorf("failed to extract text from PDF: %w", err)
	}

	if len(texts) == 0 {
		return nil, fmt.Errorf("no text found in PDF. It may be a scanned image. Please use OCR or export as CSV")
	}

	// Convert to text elements
	var elements []TextElement
	for _, text := range texts {
		if text.S == "" {
			continue
		}

		elements = append(elements, TextElement{
			X:        text.X,
			Y:        text.Y,
			Text:     text.S,
			FontSize: text.FontSize,
		})
	}

	if len(elements) == 0 {
		return nil, fmt.Errorf("no text found in PDF. It may be a scanned image. Please use OCR or export as CSV")
	}

	// Normalize Y coordinates (PDF origin is bottom-left, we want top-to-bottom)
	maxY := 0.0
	for _, elem := range elements {
		if elem.Y > maxY {
			maxY = elem.Y
		}
	}
	for i := range elements {
		elements[i].Y = maxY - elements[i].Y
	}

	// Try horizontal table detection first
	detector := NewTableDetector(elements, nil) // Use default config
	rows, err := detector.DetectTable()
	if err != nil {
		// If horizontal detection fails, try vertical (columnar) layout
		// Some banks (e.g., Techcombank) use vertical columns instead of horizontal rows
		verticalRows, vertErr := p.detectVerticalTable(elements)
		if vertErr != nil {
			return nil, fmt.Errorf("failed to detect table structure (tried both horizontal and vertical layouts): %w. This PDF format may not be supported. Please export as CSV or Excel for better compatibility", err)
		}
		return verticalRows, nil
	}

	return rows, nil
}

// extractCurrencyFromPDF extracts currency code from PDF metadata/header section
// Looks for "Loại tiền" / "Currency:" labels and extracts the 3-letter ISO code
func (p *PDFParser) extractCurrencyFromPDF() string {
	// Open PDF file (supports both URLs and local paths)
	f, err := FetchFileReaderWithSize(context.Background(), p.filePath)
	if err != nil {
		return "" // Fail silently, will use default
	}
	defer func() { _ = f.Close() }()

	// Create PDF reader
	reader, err := pdf.NewReader(f, f.Size())
	if err != nil {
		// Try with encrypted reader
		reader, err = pdf.NewReaderEncrypted(f, f.Size(), func() string { return "" })
		if err != nil {
			return ""
		}
	}

	// Extract text from all pages
	texts, err := reader.GetStyledTexts()
	if err != nil {
		return ""
	}

	// Convert to text elements with positions
	type TextWithPos struct {
		Text string
		X    float64
		Y    float64
	}
	var elements []TextWithPos
	for _, text := range texts {
		if text.S != "" {
			elements = append(elements, TextWithPos{
				Text: strings.TrimSpace(text.S),
				X:    text.X,
				Y:    text.Y,
			})
		}
	}

	// Sort by Y position (top to bottom), then by X position (left to right)
	sort.Slice(elements, func(i, j int) bool {
		// Group by Y with tolerance (±2 points for same line)
		yDiff := elements[i].Y - elements[j].Y
		if yDiff < 0 {
			yDiff = -yDiff
		}
		if yDiff < 2.0 {
			return elements[i].X < elements[j].X
		}
		return elements[i].Y < elements[j].Y
	})

	// Currency keywords to search for (Vietnamese and English)
	currencyKeywords := []string{
		"loại tiền", "loai tien",
		"currency:",
		"tiền tệ", "tien te",
		"mã tiền", "ma tien",
	}

	// Valid ISO 4217 currency codes (3 uppercase letters)
	validCurrencies := map[string]bool{
		"VND": true, "USD": true, "EUR": true, "GBP": true,
		"JPY": true, "CNY": true, "KRW": true, "THB": true,
		"SGD": true, "MYR": true, "AUD": true, "CAD": true,
		"CHF": true, "HKD": true, "NZD": true, "SEK": true,
		// Add more as needed
	}

	// Search for currency field in the first 100 text elements (header section)
	searchLimit := 100
	if len(elements) < searchLimit {
		searchLimit = len(elements)
	}

	for i := 0; i < searchLimit; i++ {
		text := elements[i].Text
		textLower := strings.ToLower(text)

		// Check if this element contains a currency keyword
		foundKeyword := false
		for _, keyword := range currencyKeywords {
			if strings.Contains(textLower, keyword) {
				foundKeyword = true
				break
			}
		}

		if !foundKeyword {
			continue
		}

		// Found a currency label! Now look for the currency value
		// It could be in the same text element (e.g., "Currency: VND")
		// Or in the next element (e.g., "Currency:" followed by "VND")

		// Try to extract from the same text
		parts := strings.Fields(text)
		for _, part := range parts {
			partUpper := strings.ToUpper(strings.Trim(part, "/:,"))
			if len(partUpper) == 3 && validCurrencies[partUpper] {
				return partUpper
			}
		}

		// Try the next few elements (on the same line or nearby)
		for j := i + 1; j < i+5 && j < len(elements); j++ {
			nextText := strings.ToUpper(strings.TrimSpace(elements[j].Text))
			// Check if it's a valid 3-letter currency code
			if len(nextText) == 3 && validCurrencies[nextText] {
				return nextText
			}
			// Also check if it's a longer string that starts with currency code
			if len(nextText) >= 3 {
				prefix := nextText[:3]
				if validCurrencies[prefix] {
					return prefix
				}
			}
		}
	}

	return "" // Not found, will use default
}

// Parse converts PDF table to ParsedRow format (matching CSV parser output)
func (p *PDFParser) Parse() ([]*ParsedRow, error) {
	// Extract table from PDF
	tableRows, err := p.ExtractTable()
	if err != nil {
		return nil, err
	}

	if len(tableRows) == 0 {
		return nil, fmt.Errorf("no data rows found in PDF")
	}

	// Find header row
	detector := NewTableDetector(nil, nil) // Just need the config
	headerIndex := detector.FindHeaderRow(tableRows)

	// Skip header row if found
	startRow := 0
	if headerIndex >= 0 && headerIndex < len(tableRows) {
		startRow = headerIndex + 1
	}

	// If no explicit column mapping, try to auto-detect columns from header
	mapping := p.columnMapping
	if mapping == nil && headerIndex >= 0 {
		mapping = p.detectColumnsFromHeader(tableRows[headerIndex])
	}

	// If still no mapping, try to parse as vertical format (Techcombank-style)
	// Need to re-extract with vertical detection
	if mapping == nil {
		return p.parseVerticalFormatFromFile()
	}

	// Parse each data row
	var parsedRows []*ParsedRow
	for i := startRow; i < len(tableRows); i++ {
		row := tableRows[i]
		rowNumber := i + 1 // 1-indexed for user display

		// Skip empty rows
		if p.isEmptyRow(row.Cells) {
			continue
		}

		// Skip summary rows
		if p.isSummaryRow(row.Cells) {
			continue
		}

		// Parse the row
		parsedRow := p.parseRow(rowNumber, row.Cells, mapping)
		parsedRows = append(parsedRows, parsedRow)
	}

	// If no valid transactions were parsed with horizontal layout, try vertical format
	// This handles cases where a CSV template was used but the PDF has vertical layout
	if len(parsedRows) == 0 {
		return p.parseVerticalFormatFromFile()
	}

	// Store the detected mapping for later retrieval
	p.columnMapping = mapping

	return parsedRows, nil
}

// GetDetectedMapping returns the column mapping that was detected during parsing
// This includes the extracted currency from the file metadata
func (p *PDFParser) GetDetectedMapping() *ColumnMapping {
	return p.columnMapping
}

// parseRow converts a table row to ParsedRow format
func (p *PDFParser) parseRow(rowNumber int, cells []string, mapping *ColumnMapping) *ParsedRow {
	parsed := &ParsedRow{
		RowNumber:        rowNumber,
		IsValid:          true,
		ValidationErrors: []ValidationError{},
	}

	// Validate column indices
	maxCol := len(cells) - 1

	// Parse date using enhanced date parser
	if mapping.DateColumn <= maxCol {
		dateStr := strings.TrimSpace(cells[mapping.DateColumn])
		if dateStr == "" {
			parsed.addError("date", "Date is required", "error")
		} else {
			dateParser := NewDateParser(mapping.DateFormat)
			date, err := dateParser.Parse(dateStr)
			if err != nil {
				parsed.addError("date", fmt.Sprintf("Invalid date format: %v", err), "error")
			} else {
				parsed.Date = date
			}
		}
	} else {
		parsed.addError("date", "Date column not found", "error")
	}

	// Parse amount using enhanced amount parser
	if mapping.AmountColumn <= maxCol {
		amountStr := strings.TrimSpace(cells[mapping.AmountColumn])
		if amountStr == "" {
			parsed.addError("amount", "Amount is required", "error")
		} else {
			amountParser := NewAmountParser(mapping.AmountFormat)
			amount, err := amountParser.Parse(amountStr)
			if err != nil {
				parsed.addError("amount", fmt.Sprintf("Invalid amount format: %v", err), "error")
			} else {
				parsed.Amount = amount
			}
		}
	} else {
		parsed.addError("amount", "Amount column not found", "error")
	}

	// Parse description and clean it
	if mapping.DescriptionColumn <= maxCol {
		description := strings.TrimSpace(cells[mapping.DescriptionColumn])
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
		parsed.ReferenceNum = strings.TrimSpace(cells[mapping.ReferenceColumn])
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

// detectColumnsFromHeader attempts to auto-detect column mapping from header row
func (p *PDFParser) detectColumnsFromHeader(headerRow TableRow) *ColumnMapping {
	// Try to extract currency from PDF metadata first
	extractedCurrency := p.extractCurrencyFromPDF()
	if extractedCurrency == "" {
		extractedCurrency = "VND" // Fallback to VND if not found
	}

	mapping := &ColumnMapping{
		DateColumn:        -1,
		AmountColumn:      -1,
		DescriptionColumn: -1,
		TypeColumn:        -1,
		CategoryColumn:    -1,
		ReferenceColumn:   -1,
		Currency:          extractedCurrency,
	}

	// Keywords for each column type (English + Vietnamese)
	dateKeywords := []string{"date", "ngày", "ngay", "posting date", "transaction date"}
	descKeywords := []string{"description", "diễn giải", "dien giai", "mô tả", "mo ta", "particulars", "details"}
	amountKeywords := []string{"amount", "số tiền", "so tien", "debit", "credit", "withdrawals", "deposits"}
	refKeywords := []string{"reference", "số ct", "so ct", "ref", "transaction id", "ref no"}

	for i, cell := range headerRow.Cells {
		cellLower := strings.ToLower(cell)

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

		// Check for amount column
		for _, keyword := range amountKeywords {
			if strings.Contains(cellLower, keyword) && mapping.AmountColumn == -1 {
				mapping.AmountColumn = i
				break
			}
		}

		// Check for reference column
		for _, keyword := range refKeywords {
			if strings.Contains(cellLower, keyword) && mapping.ReferenceColumn == -1 {
				mapping.ReferenceColumn = i
				break
			}
		}
	}

	// Validate that required columns were found
	if mapping.DateColumn == -1 || mapping.AmountColumn == -1 || mapping.DescriptionColumn == -1 {
		return nil
	}

	return mapping
}

//nolint:unused
// parseDate is deprecated - use DateParser instead
func (p *PDFParser) parseDate(dateStr string, preferredFormat string) (time.Time, error) {
	dateParser := NewDateParser(preferredFormat)
	return dateParser.Parse(dateStr)
}

//nolint:unused
// parseAmount is deprecated - use AmountParser instead
func (p *PDFParser) parseAmount(amountStr string) (int64, error) {
	amountParser := NewAmountParserWithAutoDetect()
	return amountParser.Parse(amountStr)
}

//nolint:unused
// detectType is deprecated - use TypeDetector instead
func (p *PDFParser) detectType(typeStr string, amount int64) string {
	detector := NewTypeDetector()
	if typeStr != "" {
		return detector.DetectType(typeStr, amount)
	}
	return detector.DetectType("", amount)
}

// isEmptyRow checks if a row is empty
func (p *PDFParser) isEmptyRow(cells []string) bool {
	for _, cell := range cells {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

// isSummaryRow checks if a row contains summary keywords
func (p *PDFParser) isSummaryRow(cells []string) bool {
	summaryKeywords := []string{
		"total", "balance", "summary", "subtotal",
		"grand total", "ending balance", "closing balance",
		"opening balance", "beginning balance",
		// Vietnamese keywords
		"tổng", "tổng cộng", "số dư", "cộng dồn",
		"số dư đầu kỳ", "số dư cuối kỳ",
	}

	rowText := strings.ToLower(strings.Join(cells, " "))

	for _, keyword := range summaryKeywords {
		if strings.Contains(rowText, keyword) {
			return true
		}
	}

	return false
}

// detectVerticalTable handles PDFs where transactions are arranged in vertical columns
// instead of horizontal rows (e.g., Techcombank format)
func (p *PDFParser) detectVerticalTable(elements []TextElement) ([]TableRow, error) {
	// Group elements by X position (vertical columns)
	type Column struct {
		X        float64
		Elements []TextElement
	}

	xTolerance := 5.0 // Increased to handle slight column misalignment in Techcombank PDFs
	var columns []Column

	for _, elem := range elements {
		found := false
		for i := range columns {
			if absFloat(columns[i].X-elem.X) <= xTolerance {
				columns[i].Elements = append(columns[i].Elements, elem)
				found = true
				break
			}
		}
		if !found {
			columns = append(columns, Column{X: elem.X, Elements: []TextElement{elem}})
		}
	}

	// Need at least 3 columns (date, description, amount at minimum)
	if len(columns) < 3 {
		return nil, fmt.Errorf("insufficient columns for vertical layout: found %d, need at least 3", len(columns))
	}

	// Sort columns by X position (left to right)
	sort.Slice(columns, func(i, j int) bool {
		return columns[i].X < columns[j].X
	})

	// Each column represents a transaction
	// Convert each column to a TableRow
	var rows []TableRow

	for _, col := range columns {
		if len(col.Elements) == 0 {
			continue
		}

		// Sort elements in column by Y position (top to bottom)
		sort.Slice(col.Elements, func(i, j int) bool {
			return col.Elements[i].Y < col.Elements[j].Y
		})

		// Extract cells from column elements
		var cells []string
		for _, elem := range col.Elements {
			if elem.Text != "" {
				cells = append(cells, elem.Text)
			}
		}

		if len(cells) > 0 {
			rows = append(rows, TableRow{
				Y:          col.X, // Use X as "row" identifier
				Cells:      cells,
				CellBounds: []float64{col.X},
			})
		}
	}

	return rows, nil
}

// absFloat returns absolute value of float64
func absFloat(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

// abs returns absolute value of int
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// parseVerticalFormatFromFile re-extracts PDF with vertical detection and parses
func (p *PDFParser) parseVerticalFormatFromFile() ([]*ParsedRow, error) {
	// Re-extract text elements from PDF (supports both URLs and local paths)
	f, err := FetchFileReaderWithSize(context.Background(), p.filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open PDF: %w", err)
	}
	defer func() { _ = f.Close() }()

	reader, err := pdf.NewReader(f, f.Size())
	if err != nil {
		reader, err = pdf.NewReaderEncrypted(f, f.Size(), func() string { return "" })
		if err != nil {
			return nil, fmt.Errorf("failed to create PDF reader: %w", err)
		}
	}

	texts, err := reader.GetStyledTexts()
	if err != nil {
		return nil, fmt.Errorf("failed to extract text from PDF: %w", err)
	}

	// Convert to text elements
	var elements []TextElement
	for _, text := range texts {
		if text.S == "" {
			continue
		}
		elements = append(elements, TextElement{
			X:        text.X,
			Y:        text.Y,
			Text:     text.S,
			FontSize: text.FontSize,
		})
	}

	// Detect vertical columns
	verticalRows, err := p.detectVerticalTable(elements)
	if err != nil {
		return nil, err
	}

	return p.parseVerticalFormat(verticalRows)
}

// parseVerticalFormat parses transactions from vertical column layout (Techcombank-style)
// Each TableRow represents a vertical column with cells arranged from top to bottom
func (p *PDFParser) parseVerticalFormat(tableRows []TableRow) ([]*ParsedRow, error) {
	var parsedRows []*ParsedRow

	// Common patterns in Techcombank vertical format:
	// - Date: DD/MM/YYYY format
	// - Amount: numbers with comma separators in Debit or Credit columns
	// - Description: text fields
	// - Debit/Credit: Detected from column headers "Nợ TKTT"/"Debit" vs "Có TKTT"/"Credit"

	// First pass: Find the header column to identify debit and credit positions
	debitKeywordY := -1
	creditKeywordY := -1

	for _, row := range tableRows {
		for i, cell := range row.Cells {
			cellLower := strings.ToLower(strings.TrimSpace(cell))

			// Look for debit column header keywords
			if (strings.Contains(cellLower, "nợ") && strings.Contains(cellLower, "tktt")) ||
			   (cellLower == "debit" && !strings.Contains(cellLower, "credit")) {
				// Remember which cell index this is (approximate Y position in vertical layout)
				debitKeywordY = i
			}

			// Look for credit column header keywords
			if (strings.Contains(cellLower, "có") && strings.Contains(cellLower, "tktt")) ||
			   (strings.Contains(cellLower, "credit") && !strings.Contains(cellLower, "debit")) {
				creditKeywordY = i
			}
		}
	}

	for i, row := range tableRows {
		if len(row.Cells) < 3 {
			// Need at least 3 cells to form a transaction
			continue
		}

		// Try to extract date, description, and amount from the column
		var date time.Time
		var amount int64
		var description string
		var hasDate, hasAmount bool
		var amountCellIndex int

		dateParser := NewDateParser("")
		amountParser := NewAmountParserWithAutoDetect()

		// Scan cells in the column for date, description, and amount
		// Note: Take FIRST valid amount to avoid capturing balance instead of transaction amount
		for cellIdx, cell := range row.Cells {
			cellTrimmed := strings.TrimSpace(cell)
			if cellTrimmed == "" {
				continue
			}

			// Try to parse as date
			if !hasDate {
				parsedDate, err := dateParser.Parse(cellTrimmed)
				if err == nil {
					date = parsedDate
					hasDate = true
					continue
				}
			}

			// Try to parse as amount (look for numbers with commas)
			// Take FIRST valid amount only (transaction amount, not balance)
			if !hasAmount && strings.Contains(cellTrimmed, ",") {
				parsedAmount, err := amountParser.Parse(cellTrimmed)
				if err == nil && parsedAmount > 0 {
					amount = parsedAmount
					hasAmount = true
					amountCellIndex = cellIdx // Remember which cell had the amount

					continue // Skip adding amount to description
				}
			}

			// Collect description text (skip very short cells, dates, and pure numbers)
			if len(cellTrimmed) > 5 && !isNumeric(cellTrimmed) {
				if description == "" {
					description = cellTrimmed
				} else if len(description) < 200 { // Limit description length
					description += " " + cellTrimmed
				}
			}
		}

		// Determine if this is debit or credit based on which column the amount came from
		// If we found the header positions, use them to determine debit/credit
		isDebit := false
		if hasAmount && debitKeywordY >= 0 && creditKeywordY >= 0 {
			// Check if amount is closer to debit or credit column
			debitDist := abs(amountCellIndex - debitKeywordY)
			creditDist := abs(amountCellIndex - creditKeywordY)
			isDebit = debitDist < creditDist
		} else if hasAmount {
			// Fallback: use description keywords if header positions not found
			isDebit = p.isDebitAmount(row.Cells, "")
		}

		// If amount should be negative (debit/expense), negate it
		if hasAmount && isDebit {
			amount = -amount
		}

		// Only create a transaction if we have at least date and amount
		if hasDate && hasAmount {
			parsed := &ParsedRow{
				RowNumber:           i + 1,
				Date:                date,
				Amount:              amount,
				Description:         description,
				OriginalDescription: description, // Store original before any cleaning
				Type:                "", // Will be detected
				IsValid:             true,
				ValidationErrors:    []ValidationError{},
			}

			// Set default description if empty
			if parsed.Description == "" {
				parsed.Description = "Imported Transaction"
			}

			// Detect transaction type
			detector := NewTypeDetector()
			parsed.Type = detector.DetectType(parsed.Description, parsed.Amount)

			// Validate
			validationErrors := validator.ValidateTransaction(
				parsed.Amount,
				"VND", // Default currency
				parsed.Description,
				parsed.Date,
			)

			for _, ve := range validationErrors {
				parsed.addError(ve.Field, ve.Message, ve.Severity)
			}

			parsedRows = append(parsedRows, parsed)
		}
	}

	if len(parsedRows) == 0 {
		return nil, fmt.Errorf("no valid transactions found in vertical format. The PDF may not follow a supported layout")
	}

	return parsedRows, nil
}

// isNumeric checks if a string contains only numbers, commas, and periods
func isNumeric(s string) bool {
	for _, r := range s {
		if r != '0' && r != '1' && r != '2' && r != '3' && r != '4' &&
			r != '5' && r != '6' && r != '7' && r != '8' && r != '9' &&
			r != ',' && r != '.' && r != ' ' {
			return false
		}
	}
	return true
}

// isDebitAmount checks if an amount in a vertical column is a debit (expense)
// In Techcombank format, look for debit-related keywords in the description
func (p *PDFParser) isDebitAmount(cells []string, amountCell string) bool {
	// Keywords that indicate expense/debit transactions
	debitKeywords := []string{
		"rut tien", "rút tiền", "rut", "withdraw",
		"atm", "pos", "thanh toan", "payment",
		"chuyen di", "chuyển đi", "transfer to",
		"phi", "phí", "fee", "charge",
		"mua", "purchase", "buy",
	}

	// Search all cells in this column for debit indicators
	columnText := strings.ToLower(strings.Join(cells, " "))

	for _, keyword := range debitKeywords {
		if strings.Contains(columnText, keyword) {
			return true
		}
	}

	// Default to credit (income) if no debit indicators found
	return false
}
