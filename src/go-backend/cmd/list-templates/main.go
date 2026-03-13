package main

import (
	"encoding/json"
	"fmt"
	"log"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
)

func main() {
	fmt.Println("Listing bank templates...")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize database
	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

	// Query templates
	var templates []models.BankTemplate
	if err := db.DB.Find(&templates).Error; err != nil {
		log.Fatalf("Failed to query templates: %v", err)
	}

	fmt.Printf("\nFound %d bank templates:\n", len(templates))
	fmt.Println(string(make([]byte, 80)) + "=")

	for _, t := range templates {
		fmt.Printf("\nID: %s\n", t.ID)
		fmt.Printf("Name: %s\n", t.Name)
		fmt.Printf("Bank Code: %s\n", t.BankCode)
		fmt.Printf("Statement Type: %s\n", t.StatementType)
		fmt.Printf("Currency: %s\n", t.Currency)
		fmt.Printf("Region: %s\n", t.Region)
		fmt.Printf("Active: %v\n", t.IsActive)

		// Pretty print JSON fields
		var columnMapping map[string]interface{}
		if err := json.Unmarshal(t.ColumnMapping, &columnMapping); err == nil {
			fmt.Printf("Column Mapping: %v\n", columnMapping)
		}

		fmt.Println(string(make([]byte, 80)) + "-")
	}
}
