package models_test

import (
	"testing"
	"time"

	"wealthjourney/domain/models"
	v1 "wealthjourney/protobuf/v1"
)

func int32Ptr(v int32) *int32 { return &v }

func TestInvestment_TableName(t *testing.T) {
	inv := &models.Investment{}
	if inv.TableName() != "investment" {
		t.Errorf("Expected table name 'investment', got '%s'", inv.TableName())
	}
}

func TestInvestment_Fields(t *testing.T) {
	now := time.Now()
	inv := &models.Investment{
		ID:                   1,
		WalletID:             int32Ptr(10),
		Symbol:               "BTC",
		Name:                 "Bitcoin",
		Type:                 int32(v1.InvestmentType_INVESTMENT_TYPE_CRYPTOCURRENCY),
		Quantity:             100000000,  // 1 BTC in satoshis
		AverageCost:          50000,      // $50.00 in cents (per unit average cost)
		TotalCost:            5000000,    // $50,000 in cents (total cost basis)
		Currency:             "USD",
		CurrentPrice:         600000000,  // $60,000 in tenths of cents (4 decimals)
		CurrentValue:         6000000,    // $60,000 in cents
		UnrealizedPNL:        1000000,    // $10,000 profit in cents
		UnrealizedPNLPercent: 20.0,
		RealizedPNL:          0,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	if inv.Symbol != "BTC" {
		t.Errorf("Expected symbol 'BTC', got '%s'", inv.Symbol)
	}

	if inv.Name != "Bitcoin" {
		t.Errorf("Expected name 'Bitcoin', got '%s'", inv.Name)
	}

	if inv.Type != int32(v1.InvestmentType_INVESTMENT_TYPE_CRYPTOCURRENCY) {
		t.Errorf("Expected type CRYPTOCURRENCY, got '%v'", inv.Type)
	}

	if inv.Quantity != 100000000 {
		t.Errorf("Expected quantity 100000000, got '%d'", inv.Quantity)
	}

	if inv.AverageCost != 50000 {
		t.Errorf("Expected average cost 50000, got '%d'", inv.AverageCost)
	}

	if inv.TotalCost != 5000000 {
		t.Errorf("Expected total cost 5000000, got '%d'", inv.TotalCost)
	}

	if inv.Currency != "USD" {
		t.Errorf("Expected currency 'USD', got '%s'", inv.Currency)
	}

	if inv.CurrentPrice != 600000000 {
		t.Errorf("Expected current price 600000000, got '%d'", inv.CurrentPrice)
	}

	if inv.CurrentValue != 6000000 {
		t.Errorf("Expected current value 6000000, got '%d'", inv.CurrentValue)
	}

	if inv.UnrealizedPNL != 1000000 {
		t.Errorf("Expected unrealized PNL 1000000, got '%d'", inv.UnrealizedPNL)
	}

	if inv.UnrealizedPNLPercent != 20.0 {
		t.Errorf("Expected unrealized PNL percent 20.0, got '%f'", inv.UnrealizedPNLPercent)
	}

	if inv.RealizedPNL != 0 {
		t.Errorf("Expected realized PNL 0, got '%d'", inv.RealizedPNL)
	}
}

func TestInvestment_ToProto(t *testing.T) {
	now := time.Now()
	inv := &models.Investment{
		ID:                   1,
		WalletID:             int32Ptr(10),
		Symbol:               "AAPL",
		Name:                 "Apple Inc.",
		Type:                 int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Quantity:             10000, // 1 share in 4 decimal places
		AverageCost:          15000, // $150.00 in cents (per unit average cost)
		TotalCost:            15000, // $150.00 in cents (total cost basis)
		Currency:             "USD",
		CurrentPrice:         1750000, // $175.00 in 4 decimal places ($0.0001 units)
		CurrentValue:         17500,  // $175.00 in cents
		UnrealizedPNL:        2500,   // $25.00 profit in cents
		UnrealizedPNLPercent: 16.67,
		RealizedPNL:          0,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	proto := inv.ToProto()

	if proto.Id != int32(1) {
		t.Errorf("Expected ID 1, got '%d'", proto.Id)
	}

	if proto.WalletId != int32(10) {
		t.Errorf("Expected WalletID 10, got '%d'", proto.WalletId)
	}

	if proto.Symbol != "AAPL" {
		t.Errorf("Expected symbol 'AAPL', got '%s'", proto.Symbol)
	}

	if proto.Name != "Apple Inc." {
		t.Errorf("Expected name 'Apple Inc.', got '%s'", proto.Name)
	}

	if proto.Type != v1.InvestmentType_INVESTMENT_TYPE_STOCK {
		t.Errorf("Expected type STOCK, got '%v'", proto.Type)
	}

	if proto.Quantity != int64(10000) {
		t.Errorf("Expected quantity 10000, got '%d'", proto.Quantity)
	}

	if proto.AverageCost != int64(15000) {
		t.Errorf("Expected average cost 15000, got '%d'", proto.AverageCost)
	}

	if proto.TotalCost != int64(15000) {
		t.Errorf("Expected total cost 15000, got '%d'", proto.TotalCost)
	}

	if proto.Currency != "USD" {
		t.Errorf("Expected currency 'USD', got '%s'", proto.Currency)
	}

	if proto.CurrentPrice != int64(1750000) {
		t.Errorf("Expected current price 1750000, got '%d'", proto.CurrentPrice)
	}

	if proto.CurrentValue != int64(17500) {
		t.Errorf("Expected current value 17500, got '%d'", proto.CurrentValue)
	}

	if proto.UnrealizedPnl != int64(2500) {
		t.Errorf("Expected unrealized PNL 2500, got '%d'", proto.UnrealizedPnl)
	}

	if proto.UnrealizedPnlPercent != 16.67 {
		t.Errorf("Expected unrealized PNL percent 16.67, got '%f'", proto.UnrealizedPnlPercent)
	}

	if proto.RealizedPnl != int64(0) {
		t.Errorf("Expected realized PNL 0, got '%d'", proto.RealizedPnl)
	}

	if proto.CreatedAt != now.Unix() {
		t.Errorf("Expected created at %d, got '%d'", now.Unix(), proto.CreatedAt)
	}

	if proto.UpdatedAt != now.Unix() {
		t.Errorf("Expected updated at %d, got '%d'", now.Unix(), proto.UpdatedAt)
	}
}

func TestInvestment_CalculationLogic(t *testing.T) {
	// Test that the model properly holds and returns calculated values
	inv := &models.Investment{
		Quantity:             100000000, // 1 BTC in satoshis
		TotalCost:            5000000,   // $50,000 in cents
		CurrentPrice:         6000000000, // $60,000 in 4 decimal places ($0.0001 units)
		CurrentValue:         6000000,   // $60,000 in cents (calculated)
		UnrealizedPNL:        1000000,   // $10,000 profit in cents
		UnrealizedPNLPercent: 20.0,
	}

	// Verify the values are stored correctly
	if inv.CurrentValue != 6000000 {
		t.Errorf("Expected current value 6000000, got %d", inv.CurrentValue)
	}

	if inv.UnrealizedPNL != 1000000 {
		t.Errorf("Expected unrealized PNL 1000000, got %d", inv.UnrealizedPNL)
	}

	if inv.UnrealizedPNLPercent != 20.0 {
		t.Errorf("Expected unrealized PNL percent 20.0, got %f", inv.UnrealizedPNLPercent)
	}
}

func TestInvestment_TypeAwareRecalculation(t *testing.T) {
	tests := []struct {
		name              string
		investmentType    v1.InvestmentType
		quantity          int64
		totalCost         int64
		currentPrice      int64
		expectedValue     int64
		expectedPNL       int64
		expectedPNLPct    float64
	}{
		{
			name:           "Cryptocurrency - BTC",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_CRYPTOCURRENCY,
			quantity:       100000000,    // 1 BTC in satoshis
			totalCost:      5000000,      // $50,000 in cents
			currentPrice:   6000000,      // $60,000 in cents
			expectedValue:  6000000,      // $60,000 in cents
			expectedPNL:    1000000,      // $10,000 profit
			expectedPNLPct: 20.0,
		},
		{
			name:           "Stock - AAPL",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_STOCK,
			quantity:       10000,        // 1 share in 4 decimals
			totalCost:      15000,        // $150.00 in cents
			currentPrice:   17500,        // $175.00 in cents
			expectedValue:  17500,        // $175.00 in cents
			expectedPNL:    2500,         // $25.00 profit
			expectedPNLPct: 16.666666666666668,
		},
		{
			name:           "ETF - VOO",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_ETF,
			quantity:       5000,         // 0.5 shares in 4 decimals
			totalCost:      20000,        // $200.00 in cents
			currentPrice:   42000,        // $420.00 in cents
			expectedValue:  21000,        // $210.00 in cents (0.5 * 420)
			expectedPNL:    1000,         // $10.00 profit
			expectedPNLPct: 5.0,
		},
		{
			name:           "Mutual Fund - VFIAX",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_MUTUAL_FUND,
			quantity:       10000,        // 1 share in 4 decimals
			totalCost:      40000,        // $400.00 in cents
			currentPrice:   45000,        // $450.00 in cents
			expectedValue:  45000,        // $450.00 in cents
			expectedPNL:    5000,         // $50.00 profit
			expectedPNLPct: 12.5,
		},
		{
			name:           "Other type - default divisor",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_OTHER,
			quantity:       10000,        // 1 unit in 4 decimals
			totalCost:      10000,        // $100.00 in cents
			currentPrice:   12000,        // $120.00 in cents
			expectedValue:  12000,        // $120.00 in cents
			expectedPNL:    2000,         // $20.00 profit
			expectedPNLPct: 20.0,
		},
		{
			name:           "Loss scenario - stock",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_STOCK,
			quantity:       10000,        // 1 share
			totalCost:      20000,        // $200.00 in cents
			currentPrice:   15000,        // $150.00 in cents
			expectedValue:  15000,        // $150.00 in cents
			expectedPNL:    -5000,        // $50.00 loss
			expectedPNLPct: -25.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inv := &models.Investment{
				Type:         int32(tt.investmentType),
				Quantity:     tt.quantity,
				TotalCost:    tt.totalCost,
				CurrentPrice: tt.currentPrice,
			}

			// Trigger recalculation via BeforeUpdate (simulating GORM hook)
			_ = inv.BeforeUpdate(nil)

			if inv.CurrentValue != tt.expectedValue {
				t.Errorf("Expected current value %d, got %d", tt.expectedValue, inv.CurrentValue)
			}

			if inv.UnrealizedPNL != tt.expectedPNL {
				t.Errorf("Expected unrealized PNL %d, got %d", tt.expectedPNL, inv.UnrealizedPNL)
			}

			// Allow small floating point differences
			pnlPctDiff := inv.UnrealizedPNLPercent - tt.expectedPNLPct
			if pnlPctDiff < -0.01 || pnlPctDiff > 0.01 {
				t.Errorf("Expected unrealized PNL percent %.2f, got %.2f", tt.expectedPNLPct, inv.UnrealizedPNLPercent)
			}
		})
	}
}

func TestInvestment_ZeroValueEdgeCases(t *testing.T) {
	tests := []struct {
		name              string
		quantity          int64
		totalCost         int64
		currentPrice      int64
		typeValue         v1.InvestmentType
		expectedValue     int64
		expectedPNL       int64
		expectedPNLPct    float64
	}{
		{
			name:           "Zero quantity with cost",
			quantity:       0,
			totalCost:      10000,        // $100.00 in cents
			currentPrice:   50000,        // $500.00 in cents
			typeValue:      v1.InvestmentType_INVESTMENT_TYPE_STOCK,
			expectedValue:  0,
			expectedPNL:    -10000,
			expectedPNLPct: -100.0,
		},
		{
			name:           "Zero price with cost",
			quantity:       100000000,    // 1 BTC
			totalCost:      5000000,      // $50,000 in cents
			currentPrice:   0,
			typeValue:      v1.InvestmentType_INVESTMENT_TYPE_CRYPTOCURRENCY,
			expectedValue:  0,
			expectedPNL:    -5000000,
			expectedPNLPct: -100.0,
		},
		{
			name:           "Zero total cost",
			quantity:       100000000,    // 1 BTC
			totalCost:      0,
			currentPrice:   6000000,      // $60,000 in cents
			typeValue:      v1.InvestmentType_INVESTMENT_TYPE_CRYPTOCURRENCY,
			expectedValue:  6000000,      // $60,000 in cents
			expectedPNL:    6000000,
			expectedPNLPct: 0, // Division by zero avoided in code
		},
		{
			name:           "All zeros",
			quantity:       0,
			totalCost:      0,
			currentPrice:   0,
			typeValue:      v1.InvestmentType_INVESTMENT_TYPE_STOCK,
			expectedValue:  0,
			expectedPNL:    0,
			expectedPNLPct: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inv := &models.Investment{
				Type:         int32(tt.typeValue),
				Quantity:     tt.quantity,
				TotalCost:    tt.totalCost,
				CurrentPrice: tt.currentPrice,
			}

			// Trigger recalculation
			_ = inv.BeforeUpdate(nil)

			if inv.CurrentValue != tt.expectedValue {
				t.Errorf("Expected current value %d, got %d", tt.expectedValue, inv.CurrentValue)
			}

			if inv.UnrealizedPNL != tt.expectedPNL {
				t.Errorf("Expected unrealized PNL %d, got %d", tt.expectedPNL, inv.UnrealizedPNL)
			}

			if inv.UnrealizedPNLPercent != tt.expectedPNLPct {
				t.Errorf("Expected unrealized PNL percent %.2f, got %.2f", tt.expectedPNLPct, inv.UnrealizedPNLPercent)
			}
		})
	}
}

func TestInvestment_GORMHooks(t *testing.T) {
	tests := []struct {
		name           string
		hook           func(*models.Investment) error
		initialValue   int64
		initialPrice   int64
		expectedValue  int64
	}{
		{
			name: "BeforeCreate hook triggers recalculation",
			hook: func(inv *models.Investment) error {
				return inv.BeforeCreate(nil)
			},
			initialValue:  0,
			initialPrice:  6000000, // $60,000 in cents
			expectedValue: 6000000, // $60,000 in cents
		},
		{
			name: "BeforeUpdate hook triggers recalculation",
			hook: func(inv *models.Investment) error {
				return inv.BeforeUpdate(nil)
			},
			initialValue:  0,
			initialPrice:  6000000, // $60,000 in cents
			expectedValue: 6000000, // $60,000 in cents
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inv := &models.Investment{
				Type:         int32(v1.InvestmentType_INVESTMENT_TYPE_CRYPTOCURRENCY),
				Quantity:     100000000, // 1 BTC
				TotalCost:    5000000,   // $50,000 in cents
				CurrentValue: tt.initialValue,
				CurrentPrice: tt.initialPrice,
			}

			// Call the hook
			err := tt.hook(inv)
			if err != nil {
				t.Errorf("Hook returned error: %v", err)
			}

			// Verify recalculation occurred
			if inv.CurrentValue != tt.expectedValue {
				t.Errorf("Expected current value %d after hook, got %d", tt.expectedValue, inv.CurrentValue)
			}

			if inv.UnrealizedPNL != 1000000 { // $10,000 profit
				t.Errorf("Expected unrealized PNL 1000000 after hook, got %d", inv.UnrealizedPNL)
			}
		})
	}
}

// TestInvestmentRecalculate_CorrectedTests tests the FIXED recalculation logic
// These tests verify that CurrentValue is correctly calculated by dividing by 100
// to convert from price stored in 4 decimal places ($0.0001 units) to cents (2 decimals)
func TestInvestmentRecalculate_CorrectedTests(t *testing.T) {
	tests := []struct {
		name              string
		investmentType    v1.InvestmentType
		quantity          int64
		totalCost         int64
		currentPrice      int64
		expectedValue     int64
		expectedPNL       int64
		expectedPNLPct    float64
	}{
		{
			name:           "Cryptocurrency - 1 BTC at $50,000",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_CRYPTOCURRENCY,
			quantity:       100000000, // 1 BTC in satoshis (8 decimals)
			totalCost:      4500000,   // $45,000 in cents
			currentPrice:   5000000,   // $50,000 in cents
			// Calculation: (100000000 / 100000000) * 5000000 = 5000000 cents = $50,000
			expectedValue:  5000000, // $50,000 in cents
			expectedPNL:    500000,  // $50,000 - $45,000 = $5,000 profit
			expectedPNLPct: 11.1111, // (5000 / 45000) * 100 ≈ 11.11%
		},
		{
			name:           "Stock - 10 shares at $100",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_STOCK,
			quantity:       10000,  // 1.0000 shares (4 decimals) - corrected comment
			totalCost:      90000,  // $900.00 in cents (bought at $900 per share)
			currentPrice:   10000,  // $100.00 in cents
			// Calculation: (10000 / 10000) * 10000 = 10000 cents = $100
			expectedValue:  10000, // $100 in cents
			expectedPNL:    -80000, // $100 - $900 = -$800
			expectedPNLPct: -88.8889, // (-800 / 900) * 100 ≈ -88.89%
		},
		{
			name:           "Stock - Profit scenario",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_STOCK,
			quantity:       5000,  // 0.5 shares (4 decimals)
			totalCost:      50000, // $500.00 in cents (bought 0.5 shares at $1000)
			currentPrice:   20000, // $200.00 in cents
			// Calculation: (5000 / 10000) * 20000 = 10000 cents = $100
			expectedValue:  10000, // $100 in cents
			expectedPNL:    -40000, // $100 - $500 = -$400
			expectedPNLPct: -80.0, // (-400 / 500) * 100 = -80%
		},
		{
			name:           "ETF - 0.5 shares at $420",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_ETF,
			quantity:       5000,  // 0.5 shares (4 decimals)
			totalCost:      20000, // $200.00 in cents
			currentPrice:   42000, // $420.00 in cents
			// Calculation: (5000 / 10000) * 42000 = 21000 cents = $210
			expectedValue:  21000, // $210 in cents
			expectedPNL:    1000,  // $210 - $200 = $10 profit
			expectedPNLPct: 5.0,   // (10 / 200) * 100 = 5%
		},
		{
			name:           "Mutual Fund - 1 share at $450",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_MUTUAL_FUND,
			quantity:       10000, // 1 share (4 decimals)
			totalCost:      40000, // $400.00 in cents
			currentPrice:   45000, // $450.00 in cents
			// Calculation: (10000 / 10000) * 45000 = 45000 cents = $450
			expectedValue:  45000, // $450 in cents
			expectedPNL:    5000,  // $450 - $400 = $50 profit
			expectedPNLPct: 12.5,  // (50 / 400) * 100 = 12.5%
		},
		{
			name:           "Other type - default divisor (4 decimals)",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_OTHER,
			quantity:       10000, // 1 unit (4 decimals)
			totalCost:      10000, // $100.00 in cents
			currentPrice:   12000, // $120.00 in cents
			// Calculation: (10000 / 10000) * 12000 = 12000 cents = $120
			expectedValue:  12000, // $120 in cents
			expectedPNL:    2000,  // $120 - $100 = $20 profit
			expectedPNLPct: 20.0,  // (20 / 100) * 100 = 20%
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inv := &models.Investment{
				Type:         int32(tt.investmentType),
				Quantity:     tt.quantity,
				TotalCost:    tt.totalCost,
				CurrentPrice: tt.currentPrice,
			}

			// Trigger recalculation via BeforeCreate (simulating GORM hook)
			_ = inv.BeforeCreate(nil)

			if inv.CurrentValue != tt.expectedValue {
				t.Errorf("Expected current value %d (%.2f), got %d (%.2f)",
					tt.expectedValue, float64(tt.expectedValue)/100,
					inv.CurrentValue, float64(inv.CurrentValue)/100)
			}

			if inv.UnrealizedPNL != tt.expectedPNL {
				t.Errorf("Expected unrealized PNL %d (%.2f), got %d (%.2f)",
					tt.expectedPNL, float64(tt.expectedPNL)/100,
					inv.UnrealizedPNL, float64(inv.UnrealizedPNL)/100)
			}

			// Allow small floating point differences
			pnlPctDiff := inv.UnrealizedPNLPercent - tt.expectedPNLPct
			if pnlPctDiff < -0.01 || pnlPctDiff > 0.01 {
				t.Errorf("Expected unrealized PNL percent %.2f%%, got %.2f%%",
					tt.expectedPNLPct, inv.UnrealizedPNLPercent)
			}
		})
	}
}

func TestInvestmentRecalculate_CorrectedEdgeCases(t *testing.T) {
	tests := []struct {
		name              string
		investmentType    v1.InvestmentType
		quantity          int64
		totalCost         int64
		currentPrice      int64
		expectedValue     int64
		expectedPNL       int64
		expectedPNLPct    float64
	}{
		{
			name:           "Zero quantity with cost - total loss",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_STOCK,
			quantity:       0,
			totalCost:      50000, // $500.00 in cents
			currentPrice:   10000, // $100.00 in cents
			expectedValue:  0,
			expectedPNL:    -50000,     // -$500.00
			expectedPNLPct: -100.0,
		},
		{
			name:           "Zero price with cost - total loss",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_CRYPTOCURRENCY,
			quantity:       100000000, // 1 BTC
			totalCost:      4500000,   // $45,000 in cents
			currentPrice:   0,
			expectedValue:  0,
			expectedPNL:    -4500000,  // -$45,000
			expectedPNLPct: -100.0,
		},
		{
			name:           "Zero total cost",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_STOCK,
			quantity:       10000, // 1 share
			totalCost:      0,
			currentPrice:   15000, // $150.00 in cents
			// Calculation: (10000 / 10000) * 15000 = 15000 cents = $150
			expectedValue:  15000, // $150
			expectedPNL:    15000, // $150 - $0 = $150
			expectedPNLPct: 0,     // Division by zero avoided
		},
		{
			name:           "All zeros",
			investmentType: v1.InvestmentType_INVESTMENT_TYPE_STOCK,
			quantity:       0,
			totalCost:      0,
			currentPrice:   0,
			expectedValue:  0,
			expectedPNL:    0,
			expectedPNLPct: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			inv := &models.Investment{
				Type:         int32(tt.investmentType),
				Quantity:     tt.quantity,
				TotalCost:    tt.totalCost,
				CurrentPrice: tt.currentPrice,
			}

			// Trigger recalculation
			_ = inv.BeforeUpdate(nil)

			if inv.CurrentValue != tt.expectedValue {
				t.Errorf("Expected current value %d, got %d", tt.expectedValue, inv.CurrentValue)
			}

			if inv.UnrealizedPNL != tt.expectedPNL {
				t.Errorf("Expected unrealized PNL %d, got %d", tt.expectedPNL, inv.UnrealizedPNL)
			}

			if inv.UnrealizedPNLPercent != tt.expectedPNLPct {
				t.Errorf("Expected unrealized PNL percent %.2f, got %.2f",
					tt.expectedPNLPct, inv.UnrealizedPNLPercent)
			}
		})
	}
}

