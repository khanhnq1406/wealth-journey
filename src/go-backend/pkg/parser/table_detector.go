package parser

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

// TextElement represents a piece of text with its position in the PDF
type TextElement struct {
	X        float64 // Horizontal position
	Y        float64 // Vertical position (normalized, top-to-bottom)
	Width    float64
	Text     string
	FontSize float64
}

// TableRow represents a row in the detected table
type TableRow struct {
	Y          float64  // Vertical position
	Cells      []string // Column values
	CellBounds []float64 // X positions of each cell
}

// TableDetectorConfig holds configuration for table detection
type TableDetectorConfig struct {
	YTolerance     float64  // Row grouping tolerance (default: 2.0)
	MinColumns     int      // Minimum columns to consider table (default: 3)
	MinRows        int      // Minimum rows to consider table (default: 5)
	HeaderKeywords []string // Keywords for header detection
}

// DefaultTableDetectorConfig provides default configuration
var DefaultTableDetectorConfig = TableDetectorConfig{
	YTolerance: 5.0, // Increased from 2.0 to handle more row variations
	MinColumns: 3,
	MinRows:    3,   // Reduced from 5 to support shorter statements
	HeaderKeywords: []string{
		"date", "ngày", "ngay", "posting date", "transaction date",
		"description", "diễn giải", "dien giai", "mô tả", "mo ta", "particulars",
		"amount", "số tiền", "so tien", "debit", "credit", "withdrawals", "deposits",
		"balance", "số dư", "so du",
		"reference", "số ct", "so ct", "ref", "transaction id",
	},
}

// TableDetector analyzes text elements and extracts structured table data
type TableDetector struct {
	elements []TextElement
	config   TableDetectorConfig
}

// NewTableDetector creates a new table detector with given elements and config
func NewTableDetector(elements []TextElement, config *TableDetectorConfig) *TableDetector {
	if config == nil {
		cfg := DefaultTableDetectorConfig
		config = &cfg
	}

	return &TableDetector{
		elements: elements,
		config:   *config,
	}
}

// DetectTable analyzes text elements and returns structured rows
func (td *TableDetector) DetectTable() ([]TableRow, error) {
	if len(td.elements) == 0 {
		return nil, fmt.Errorf("no text elements to analyze")
	}

	// Step 1: Group elements by Y position (rows)
	rows := td.groupElementsByRow()

	if len(rows) < td.config.MinRows {
		return nil, fmt.Errorf("insufficient rows detected (%d), minimum required: %d. The PDF may have too few transaction rows or complex formatting", len(rows), td.config.MinRows)
	}

	// Step 2: Detect column boundaries across all rows
	columnBoundaries := td.detectColumnBoundaries(rows)

	if len(columnBoundaries) < td.config.MinColumns {
		// Provide diagnostic information
		totalElements := 0
		for _, row := range rows {
			totalElements += len(row)
		}

		return nil, fmt.Errorf("insufficient columns detected (%d), minimum required: %d. Found %d text elements in %d rows. This PDF may have inconsistent column alignment, merged cells, or may be a scanned image. Try exporting as CSV for better results",
			len(columnBoundaries), td.config.MinColumns, totalElements, len(rows))
	}

	// Step 3: Align cells to columns
	tableRows := td.alignCellsToColumns(rows, columnBoundaries)

	return tableRows, nil
}

// groupElementsByRow groups text elements that share similar Y coordinates
func (td *TableDetector) groupElementsByRow() [][]TextElement {
	// Sort elements by Y position first
	sorted := make([]TextElement, len(td.elements))
	copy(sorted, td.elements)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Y < sorted[j].Y
	})

	var rows [][]TextElement
	var currentRow []TextElement
	var currentY float64

	for i, elem := range sorted {
		if i == 0 {
			currentRow = []TextElement{elem}
			currentY = elem.Y
			continue
		}

		// Check if element belongs to current row (within tolerance)
		if math.Abs(elem.Y-currentY) <= td.config.YTolerance {
			currentRow = append(currentRow, elem)
		} else {
			// Start new row
			if len(currentRow) > 0 {
				rows = append(rows, currentRow)
			}
			currentRow = []TextElement{elem}
			currentY = elem.Y
		}
	}

	// Add last row
	if len(currentRow) > 0 {
		rows = append(rows, currentRow)
	}

	// Sort elements within each row by X position
	for i := range rows {
		sort.Slice(rows[i], func(a, b int) bool {
			return rows[i][a].X < rows[i][b].X
		})
	}

	return rows
}

// detectColumnBoundaries analyzes X positions across all rows to find column boundaries
func (td *TableDetector) detectColumnBoundaries(rows [][]TextElement) []float64 {
	// Collect all X positions with more lenient rounding
	xPositions := make(map[float64]int) // position -> frequency

	for _, row := range rows {
		for _, elem := range row {
			// Round to nearest 5.0 to handle more variations in alignment
			roundedX := math.Round(elem.X / 5.0) * 5.0
			xPositions[roundedX]++
		}
	}

	// Find positions that appear in multiple rows (likely column starts)
	var boundaries []float64
	// More lenient: 15% of rows OR at least 2 rows (whichever is lower)
	minFrequency := len(rows) / 7 // ~15% of rows
	if minFrequency < 2 {
		minFrequency = 2
	}

	for pos, freq := range xPositions {
		if freq >= minFrequency {
			boundaries = append(boundaries, pos)
		}
	}

	// Sort boundaries
	sort.Float64s(boundaries)

	// Merge boundaries that are too close together (within 10 units)
	if len(boundaries) > 1 {
		merged := []float64{boundaries[0]}
		for i := 1; i < len(boundaries); i++ {
			if boundaries[i]-merged[len(merged)-1] > 10 {
				merged = append(merged, boundaries[i])
			}
		}
		boundaries = merged
	}

	return boundaries
}

// alignCellsToColumns assigns text elements to appropriate columns
func (td *TableDetector) alignCellsToColumns(rows [][]TextElement, columnBoundaries []float64) []TableRow {
	var tableRows []TableRow

	for _, row := range rows {
		if len(row) == 0 {
			continue
		}

		// Calculate average Y for this row
		avgY := 0.0
		for _, elem := range row {
			avgY += elem.Y
		}
		avgY /= float64(len(row))

		// Assign each element to a column
		cells := make([]string, len(columnBoundaries))
		cellBounds := make([]float64, len(columnBoundaries))

		copy(cellBounds, columnBoundaries)

		for _, elem := range row {
			// Find closest column boundary
			colIndex := td.findColumnIndex(elem.X, columnBoundaries)
			if colIndex >= 0 && colIndex < len(cells) {
				// Append text to cell (handle multi-part cells)
				if cells[colIndex] != "" {
					cells[colIndex] += " " + elem.Text
				} else {
					cells[colIndex] = elem.Text
				}
			}
		}

		// Clean up cells
		for i := range cells {
			cells[i] = strings.TrimSpace(cells[i])
		}

		tableRows = append(tableRows, TableRow{
			Y:          avgY,
			Cells:      cells,
			CellBounds: cellBounds,
		})
	}

	return tableRows
}

// findColumnIndex finds the appropriate column index for a given X position
func (td *TableDetector) findColumnIndex(x float64, boundaries []float64) int {
	if len(boundaries) == 0 {
		return -1
	}

	// Find the closest boundary
	minDist := math.MaxFloat64
	closestIndex := 0

	for i, boundary := range boundaries {
		dist := math.Abs(x - boundary)
		if dist < minDist {
			minDist = dist
			closestIndex = i
		}
	}

	// Only assign if within reasonable distance (e.g., 50 units)
	if minDist > 50 {
		return -1
	}

	return closestIndex
}

// FindHeaderRow attempts to identify the header row in the table
func (td *TableDetector) FindHeaderRow(rows []TableRow) int {
	if len(rows) == 0 {
		return -1
	}

	// Strategy 1: Look for rows with most header keywords
	maxKeywordCount := 0
	headerIndex := -1

	for i, row := range rows {
		keywordCount := 0
		rowText := strings.ToLower(strings.Join(row.Cells, " "))

		for _, keyword := range td.config.HeaderKeywords {
			if strings.Contains(rowText, keyword) {
				keywordCount++
			}
		}

		if keywordCount > maxKeywordCount {
			maxKeywordCount = keywordCount
			headerIndex = i
		}
	}

	// If found header with at least 2 keywords, return it
	if maxKeywordCount >= 2 {
		return headerIndex
	}

	// Strategy 2: First row with most non-empty cells
	maxCells := 0
	for i, row := range rows {
		nonEmptyCount := 0
		for _, cell := range row.Cells {
			if cell != "" {
				nonEmptyCount++
			}
		}

		if nonEmptyCount > maxCells {
			maxCells = nonEmptyCount
			headerIndex = i
		}
	}

	return headerIndex
}
