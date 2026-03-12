package yahoo

import (
	"context"
	"fmt"
)

//nolint:unused
// exampleClientUsage demonstrates how to use the Yahoo Finance client.
// This is intentionally not an Example* function to avoid making real
// network calls during go test runs.
func exampleClientUsage() {
	// Create a new client for a stock symbol
	client := NewClient("AAPL")
	// Fetch current quote data
	ctx := context.Background()
	quote, err := client.GetQuote(ctx)
	if err != nil {
		fmt.Printf("Error fetching quote: %v\n", err)
		return
	}

	// Use the quote data
	fmt.Printf("Symbol: %s\n", quote.Symbol)
	fmt.Printf("Price: $%d.%02d\n", quote.Price/100, quote.Price%100)
	fmt.Printf("Volume (24h): %d\n", quote.Volume24h)
}
