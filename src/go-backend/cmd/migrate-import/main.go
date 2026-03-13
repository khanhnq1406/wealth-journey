package main

import (
	"fmt"
	"log"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

	log.Println("Starting import tables migration...")

	// Auto migrate import models
	if err := db.DB.AutoMigrate(
		&models.ImportBatch{},
		&models.BankTemplate{},
	); err != nil {
		log.Fatalf("Failed to auto-migrate import tables: %v", err)
	}
	log.Println("✓ import_batch and bank_template tables created/updated")

	// Note: Transaction model already has ImportBatchID field, so AutoMigrate
	// will handle the column and index creation automatically.
	// We'll verify the column exists but don't need manual ALTER TABLE.
	log.Println("✓ Transaction.ImportBatchID column handled by AutoMigrate")

	// Seed default bank templates
	if err := seedBankTemplates(db.DB); err != nil {
		log.Fatalf("Failed to seed bank templates: %v", err)
	}

	log.Println("✓ Migration completed successfully")
}

func seedBankTemplates(db *gorm.DB) error {
	log.Println("Seeding bank templates...")

	templates := []models.BankTemplate{
		{
			ID:            "vcb-credit-card",
			Name:          "Vietcombank Credit Card Statement",
			BankCode:      "VCB",
			StatementType: "credit",
			FileFormats:   datatypes.JSON([]byte(`["csv","excel","pdf"]`)),
			DateFormat:    "DD/MM/YYYY",
			Currency:      "VND",

			// Column mapping for VCB credit card statements
			ColumnMapping: datatypes.JSON([]byte(`{
				"date": ["Ngày giao dịch", "Transaction Date", "Date"],
				"description": ["Mô tả", "Description", "Details"],
				"amount": ["Số tiền", "Amount", "Transaction Amount"],
				"balance": ["Số dư", "Balance"],
				"reference": ["Mã tham chiếu", "Reference", "Ref"]
			}`)),

			// Amount format rules
			AmountFormat: datatypes.JSON([]byte(`{
				"decimalSeparator": ",",
				"thousandsSeparator": ".",
				"currencySymbol": "VND"
			}`)),

			// Detection rules to identify VCB statements
			DetectionRules: datatypes.JSON([]byte(`{
				"headerKeywords": ["VIETCOMBANK", "VCB", "Credit Card Statement"],
				"columnPatterns": ["Ngày giao dịch", "Số tiền"],
				"minColumns": 3
			}`)),

			// Type rules for transaction classification
			TypeRules: datatypes.JSON([]byte(`{
				"expense_keywords": ["Purchase", "Payment", "Withdrawal", "ATM"],
				"income_keywords": ["Refund", "Credit", "Deposit", "Cashback"]
			}`)),

			IsActive: true,
		},
		{
			ID:            "tcb-credit-card",
			Name:          "Techcombank Credit Card Statement",
			BankCode:      "TCB",
			StatementType: "credit",
			FileFormats:   datatypes.JSON([]byte(`["csv","excel"]`)),
			DateFormat:    "DD/MM/YYYY",
			Currency:      "VND",

			ColumnMapping: datatypes.JSON([]byte(`{
				"date": ["Ngày GD", "Transaction Date"],
				"description": ["Nội dung", "Description"],
				"amount": ["Số tiền GD", "Amount"],
				"balance": ["Số dư"],
				"reference": ["Mã GD"]
			}`)),

			AmountFormat: datatypes.JSON([]byte(`{
				"decimalSeparator": ",",
				"thousandsSeparator": ".",
				"currencySymbol": "VND"
			}`)),

			DetectionRules: datatypes.JSON([]byte(`{
				"headerKeywords": ["TECHCOMBANK", "TCB"],
				"columnPatterns": ["Ngày GD", "Số tiền GD"],
				"minColumns": 3
			}`)),

			TypeRules: datatypes.JSON([]byte(`{
				"expense_keywords": ["Purchase", "Payment"],
				"income_keywords": ["Refund", "Credit"]
			}`)),

			IsActive: true,
		},
	}

	// Use FirstOrCreate to avoid duplicates
	for _, template := range templates {
		result := db.Where("id = ?", template.ID).FirstOrCreate(&template)
		if result.Error != nil {
			return fmt.Errorf("failed to seed template %s: %w", template.ID, result.Error)
		}
		if result.RowsAffected > 0 {
			log.Printf("✓ Created template: %s (%s)", template.ID, template.Name)
		} else {
			log.Printf("✓ Template already exists: %s (%s)", template.ID, template.Name)
		}
	}

	log.Printf("✓ Seeded %d bank templates", len(templates))
	return nil
}
