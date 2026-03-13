//go:build ignore

package main

import (
	"fmt"
	"os"
	"strings"
	"time"

	"wealthjourney/pkg/parser"

	"github.com/ledongthuc/pdf"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run test_vertical_debug.go <pdf_file>")
		os.Exit(1)
	}

	filePath := os.Args[1]

	// Manually test vertical detection
	f, _ := os.Open(filePath)
	defer f.Close()
	stat, _ := f.Stat()
	reader, _ := pdf.NewReader(f, stat.Size())
	texts, _ := reader.GetStyledTexts()

	// Convert to text elements
	type TextElement struct {
		X        float64
		Y        float64
		Text     string
		FontSize float64
	}

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

	// Group by X position (columns)
	type Column struct {
		X     float64
		Cells []string
	}

	xTolerance := 2.0
	var columns []Column

	for _, elem := range elements {
		found := false
		for i := range columns {
			if abs(columns[i].X-elem.X) <= xTolerance {
				columns[i].Cells = append(columns[i].Cells, elem.Text)
				found = true
				break
			}
		}
		if !found {
			columns = append(columns, Column{X: elem.X, Cells: []string{elem.Text}})
		}
	}

	fmt.Printf("Found %d columns\n\n", len(columns))

	// Test parsing logic on first few columns
	dateParser := parser.NewDateParser("")
	amountParser := parser.NewAmountParserWithAutoDetect()

	for i, col := range columns {
		if i >= 10 { // Check first 10 columns
			break
		}

		fmt.Printf("Column %d (X=%.2f): %d cells\n", i, col.X, len(col.Cells))

		var date time.Time
		var amount int64
		var description string
		var hasDate, hasAmount bool

		for j, cell := range col.Cells {
			cellTrimmed := strings.TrimSpace(cell)
			if cellTrimmed == "" {
				continue
			}

			// Try date
			parsedDate, dateErr := dateParser.Parse(cellTrimmed)
			if dateErr == nil {
				date = parsedDate
				hasDate = true
				fmt.Printf("  [%d] DATE: %s -> %s\n", j, cellTrimmed, date.Format("2006-01-02"))
				continue
			}

			// Try amount
			if strings.Contains(cellTrimmed, ",") {
				parsedAmount, amtErr := amountParser.Parse(cellTrimmed)
				if amtErr == nil && parsedAmount > 0 {
					amount = parsedAmount
					hasAmount = true
					fmt.Printf("  [%d] AMOUNT: %s -> %d\n", j, cellTrimmed, amount)
					continue
				}
			}

			// Description
			if len(cellTrimmed) > 5 && !isNumeric(cellTrimmed) {
				if description == "" {
					description = cellTrimmed
				}
				fmt.Printf("  [%d] DESC: %s\n", j, cellTrimmed)
			} else {
				fmt.Printf("  [%d] SKIP: %s\n", j, cellTrimmed)
			}
		}

		fmt.Printf("  => hasDate=%v, hasAmount=%v\n", hasDate, hasAmount)
		if hasDate && hasAmount {
			fmt.Printf("  => VALID TRANSACTION: %s, %d, %s\n", date.Format("2006-01-02"), amount, description)
		}
		fmt.Println()
	}
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

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
