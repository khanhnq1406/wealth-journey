package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"

	"gorm.io/datatypes"
)

// TemplateJSON represents the JSON structure of a bank template seed file
type TemplateJSON struct {
	ID             string                 `json:"id"`
	Name           string                 `json:"name"`
	BankCode       string                 `json:"bankCode"`
	StatementType  string                 `json:"statementType"`
	FileFormats    []string               `json:"fileFormats"`
	ColumnMapping  map[string]interface{} `json:"columnMapping"`
	DateFormat     string                 `json:"dateFormat"`
	AmountFormat   map[string]interface{} `json:"amountFormat"`
	Currency       string                 `json:"currency"`
	DetectionRules map[string]interface{} `json:"detectionRules"`
	TypeRules      map[string]interface{} `json:"typeRules"`
	Region         string                 `json:"region"`
	IsActive       bool                   `json:"isActive"`
	Description    string                 `json:"description"`
}

func main() {
	fmt.Println("🚀 Starting bank template migration...")
	fmt.Println()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("❌ Failed to load config: %v", err)
	}

	// Initialize database
	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

	// Auto-migrate tables
	fmt.Println("📊 Creating/updating database tables...")
	if err := db.DB.AutoMigrate(
		&models.BankTemplate{},
		&models.UserTemplate{},
	); err != nil {
		log.Fatalf("❌ Failed to migrate tables: %v", err)
	}
	fmt.Println("✓ Database tables migrated")
	fmt.Println()

	// Load templates from JSON seed files
	ctx := context.Background()
	templates, err := loadTemplatesFromSeedFiles()
	if err != nil {
		log.Fatalf("❌ Failed to load templates: %v", err)
	}

	if len(templates) == 0 {
		log.Println("⚠️  No templates found in seeds directory")
		log.Println("   Please add JSON seed files to: cmd/migrate-templates/seeds/")
		return
	}

	fmt.Printf("📦 Found %d bank template(s) to seed\n", len(templates))
	fmt.Println()

	// Seed templates
	successCount := 0
	updateCount := 0
	errorCount := 0

	for _, template := range templates {
		// Check if template already exists
		var existing models.BankTemplate
		result := db.DB.WithContext(ctx).Where("id = ?", template.ID).First(&existing)

		if result.Error == nil {
			// Update existing template
			template.CreatedAt = existing.CreatedAt
			template.UpdatedAt = time.Now()
			if err := db.DB.WithContext(ctx).Save(&template).Error; err != nil {
				log.Printf("❌ Failed to update template %s: %v", template.ID, err)
				errorCount++
				continue
			}
			fmt.Printf("✓ Updated: %s (ID: %s)\n", template.Name, template.ID)
			updateCount++
		} else {
			// Create new template
			template.CreatedAt = time.Now()
			template.UpdatedAt = time.Now()
			if err := db.DB.WithContext(ctx).Create(&template).Error; err != nil {
				log.Printf("❌ Failed to create template %s: %v", template.ID, err)
				errorCount++
				continue
			}
			fmt.Printf("✓ Created: %s (ID: %s)\n", template.Name, template.ID)
			successCount++
		}
	}

	fmt.Println()
	fmt.Println("📊 Migration Summary:")
	fmt.Printf("   - Created: %d templates\n", successCount)
	fmt.Printf("   - Updated: %d templates\n", updateCount)
	fmt.Printf("   - Errors:  %d templates\n", errorCount)
	fmt.Println()

	if errorCount > 0 {
		fmt.Println("⚠️  Migration completed with errors. Please review the logs above.")
	} else {
		fmt.Println("✅ Bank template migration completed successfully!")
	}
}

// loadTemplatesFromSeedFiles reads all JSON files from the seeds directory
func loadTemplatesFromSeedFiles() ([]models.BankTemplate, error) {
	seedsDir := filepath.Join("cmd", "migrate-templates", "seeds")

	// Check if seeds directory exists
	if _, err := os.Stat(seedsDir); os.IsNotExist(err) {
		return nil, fmt.Errorf("seeds directory not found: %s", seedsDir)
	}

	// Read all JSON files in seeds directory
	files, err := filepath.Glob(filepath.Join(seedsDir, "*.json"))
	if err != nil {
		return nil, fmt.Errorf("failed to read seeds directory: %w", err)
	}

	var templates []models.BankTemplate

	for _, file := range files {
		// Skip README.md and other non-JSON files
		if filepath.Ext(file) != ".json" {
			continue
		}

		// Read JSON file
		data, err := os.ReadFile(file)
		if err != nil {
			log.Printf("⚠️  Skipping %s: failed to read file: %v", filepath.Base(file), err)
			continue
		}

		// Parse JSON
		var templateJSON TemplateJSON
		if err := json.Unmarshal(data, &templateJSON); err != nil {
			log.Printf("⚠️  Skipping %s: invalid JSON: %v", filepath.Base(file), err)
			continue
		}

		// Convert to BankTemplate model
		template, err := convertJSONToTemplate(templateJSON)
		if err != nil {
			log.Printf("⚠️  Skipping %s: conversion error: %v", filepath.Base(file), err)
			continue
		}

		templates = append(templates, template)
	}

	return templates, nil
}

// convertJSONToTemplate converts TemplateJSON to models.BankTemplate
func convertJSONToTemplate(tj TemplateJSON) (models.BankTemplate, error) {
	// Validate required fields
	if tj.ID == "" {
		return models.BankTemplate{}, fmt.Errorf("template ID is required")
	}
	if tj.Name == "" {
		return models.BankTemplate{}, fmt.Errorf("template name is required")
	}
	if tj.BankCode == "" {
		return models.BankTemplate{}, fmt.Errorf("bank code is required")
	}

	// Convert file formats to JSON
	fileFormatsJSON, err := json.Marshal(tj.FileFormats)
	if err != nil {
		return models.BankTemplate{}, fmt.Errorf("failed to marshal file formats: %w", err)
	}

	// Convert column mapping to JSON
	columnMappingJSON, err := json.Marshal(tj.ColumnMapping)
	if err != nil {
		return models.BankTemplate{}, fmt.Errorf("failed to marshal column mapping: %w", err)
	}

	// Convert amount format to JSON
	amountFormatJSON, err := json.Marshal(tj.AmountFormat)
	if err != nil {
		return models.BankTemplate{}, fmt.Errorf("failed to marshal amount format: %w", err)
	}

	// Convert detection rules to JSON
	detectionRulesJSON, err := json.Marshal(tj.DetectionRules)
	if err != nil {
		return models.BankTemplate{}, fmt.Errorf("failed to marshal detection rules: %w", err)
	}

	// Convert type rules to JSON
	typeRulesJSON, err := json.Marshal(tj.TypeRules)
	if err != nil {
		return models.BankTemplate{}, fmt.Errorf("failed to marshal type rules: %w", err)
	}

	// Set defaults
	region := tj.Region
	if region == "" {
		region = "VN"
	}

	isActive := tj.IsActive
	// Default to true if not specified
	if !isActive && tj.IsActive {
		isActive = true
	}

	return models.BankTemplate{
		ID:             tj.ID,
		Name:           tj.Name,
		BankCode:       tj.BankCode,
		StatementType:  tj.StatementType,
		FileFormats:    datatypes.JSON(fileFormatsJSON),
		ColumnMapping:  datatypes.JSON(columnMappingJSON),
		DateFormat:     tj.DateFormat,
		AmountFormat:   datatypes.JSON(amountFormatJSON),
		Currency:       tj.Currency,
		DetectionRules: datatypes.JSON(detectionRulesJSON),
		TypeRules:      datatypes.JSON(typeRulesJSON),
		Region:         region,
		IsActive:       isActive,
	}, nil
}
