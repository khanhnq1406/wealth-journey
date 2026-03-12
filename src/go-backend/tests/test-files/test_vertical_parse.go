//go:build ignore

package main

import (
	"fmt"
	"log"
	"os"

	"wealthjourney/pkg/parser"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run test_vertical_parse.go <pdf_file>")
		os.Exit(1)
	}

	filePath := os.Args[1]

	// Create PDF parser with nil mapping (to trigger auto-detection)
	pdfParser := parser.NewPDFParser(filePath, nil)

	fmt.Println("=== Starting PDF Parse ===")

	// Parse the PDF
	parsedRows, err := pdfParser.Parse()
	if err != nil {
		log.Fatalf("Parse error: %v", err)
	}

	fmt.Printf("\n=== Parse Results ===\n")
	fmt.Printf("Total parsed rows: %d\n\n", len(parsedRows))

	// Print first 10 parsed transactions
	for i, row := range parsedRows {
		if i >= 10 {
			break
		}
		fmt.Printf("Transaction %d:\n", i+1)
		fmt.Printf("  Date: %s\n", row.Date.Format("2006-01-02"))
		fmt.Printf("  Amount: %d\n", row.Amount)
		fmt.Printf("  Description: %s\n", row.Description)
		fmt.Printf("  Type: %s\n", row.Type)
		fmt.Printf("  Valid: %v\n", row.IsValid)
		if len(row.ValidationErrors) > 0 {
			fmt.Printf("  Errors: %v\n", row.ValidationErrors)
		}
		fmt.Println()
	}
}
