package main

import (
	"fmt"
	"log"

	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
)

type ColumnInfo struct {
	ColumnName string
	DataType   string
}

func main() {
	fmt.Println("Checking bank_template schema...")

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

	// Query column information
	var columns []ColumnInfo
	query := `
		SELECT column_name, data_type
		FROM information_schema.columns
		WHERE table_name = 'bank_template'
		AND table_schema = CURRENT_SCHEMA()
		ORDER BY ordinal_position
	`
	if err := db.DB.Raw(query).Scan(&columns).Error; err != nil {
		log.Fatalf("Failed to query schema: %v", err)
	}

	fmt.Println("\nbank_template columns:")
	fmt.Println("=" + string(make([]byte, 60)))
	for _, col := range columns {
		fmt.Printf("%-25s | %s\n", col.ColumnName, col.DataType)
	}

	fmt.Println("=" + string(make([]byte, 60)))
}
