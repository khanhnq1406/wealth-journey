//go:build ignore

package main

import (
	"fmt"
	"os"

	"github.com/ledongthuc/pdf"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run debug_pdf.go <pdf_file>")
		os.Exit(1)
	}

	filePath := os.Args[1]

	// Open PDF file
	f, err := os.Open(filePath)
	if err != nil {
		fmt.Printf("Failed to open PDF: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	// Get file size
	stat, err := f.Stat()
	if err != nil {
		fmt.Printf("Failed to get file info: %v\n", err)
		os.Exit(1)
	}

	// Create PDF reader
	reader, err := pdf.NewReader(f, stat.Size())
	if err != nil {
		// Try with encrypted reader (empty password)
		reader, err = pdf.NewReaderEncrypted(f, stat.Size(), func() string { return "" })
		if err != nil {
			fmt.Printf("Failed to create PDF reader: %v\n", err)
			os.Exit(1)
		}
	}

	fmt.Printf("PDF Pages: %d\n", reader.NumPage())

	// Extract styled text from all pages
	texts, err := reader.GetStyledTexts()
	if err != nil {
		fmt.Printf("Failed to extract text: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Total text elements: %d\n\n", len(texts))

	// Print first 50 elements to understand structure
	fmt.Println("First 50 text elements:")
	fmt.Println("---")
	for i, text := range texts {
		if i >= 50 {
			break
		}
		fmt.Printf("[%d] X:%.2f Y:%.2f Font:%.2f Text: %q\n", i, text.X, text.Y, text.FontSize, text.S)
	}

	// Group by Y position to see row structure
	fmt.Println("\n\nGrouping by Y position (tolerance 2.0):")
	fmt.Println("---")

	type Row struct {
		Y     float64
		Texts []string
	}

	var rows []Row
	tolerance := 5.0

	for _, text := range texts {
		if text.S == "" {
			continue
		}

		// Find existing row or create new
		found := false
		for i := range rows {
			if abs(rows[i].Y-text.Y) <= tolerance {
				rows[i].Texts = append(rows[i].Texts, text.S)
				found = true
				break
			}
		}

		if !found {
			rows = append(rows, Row{Y: text.Y, Texts: []string{text.S}})
		}
	}

	fmt.Printf("Found %d rows\n\n", len(rows))

	// Print first 20 rows
	for i, row := range rows {
		if i >= 20 {
			break
		}
		fmt.Printf("Row %d (Y=%.2f): %d cells\n", i, row.Y, len(row.Texts))
		for j, text := range row.Texts {
			fmt.Printf("  [%d] %q\n", j, text)
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
