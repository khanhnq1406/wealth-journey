package gold

import (
	"context"
	"testing"

	"wealthjourney/pkg/fx"
	investmentv1 "wealthjourney/protobuf/v1"
)

// mockFXRateService is a mock implementation for testing
type mockFXRateService struct{}

func (m *mockFXRateService) GetRate(ctx context.Context, fromCurrency, toCurrency string) (float64, error) {
	// Mock rate: 1 USD = 25,000 VND (common rate for testing)
	if fromCurrency == "USD" && toCurrency == "VND" {
		return 25000.0, nil
	}
	if fromCurrency == "VND" && toCurrency == "USD" {
		return 1.0 / 25000.0, nil
	}
	return 1.0, nil
}

func (m *mockFXRateService) ConvertAmount(ctx context.Context, amount int64, fromCurrency, toCurrency string) (int64, error) {
	if fromCurrency == toCurrency {
		return amount, nil
	}
	rate, _ := m.GetRate(ctx, fromCurrency, toCurrency)
	fromMultiplier := fx.GetDecimalMultiplier(fromCurrency)
	toMultiplier := fx.GetDecimalMultiplier(toCurrency)
	amountInBase := float64(amount) / float64(fromMultiplier)
	converted := amountInBase * rate
	return int64(converted * float64(toMultiplier)), nil
}

func (m *mockFXRateService) ConvertAmountWithRate(ctx context.Context, amount int64, rate float64, fromCurrency, toCurrency string) (int64, error) {
	fromMultiplier := fx.GetDecimalMultiplier(fromCurrency)
	toMultiplier := fx.GetDecimalMultiplier(toCurrency)
	amountInBase := float64(amount) / float64(fromMultiplier)
	converted := amountInBase * rate
	return int64(converted * float64(toMultiplier)), nil
}

func (m *mockFXRateService) BatchGetRates(ctx context.Context, pairs []fx.CurrencyPair) (map[fx.CurrencyPair]float64, error) {
	result := make(map[fx.CurrencyPair]float64)
	for _, pair := range pairs {
		rate, _ := m.GetRate(ctx, pair.From, pair.To)
		result[pair] = rate
	}
	return result, nil
}

func (m *mockFXRateService) UpdateRate(ctx context.Context, fromCurrency, toCurrency string) error {
	return nil
}

func (m *mockFXRateService) IsSupportedCurrency(currency string) bool {
	return currency == "USD" || currency == "VND"
}

func (m *mockFXRateService) GetSupportedCurrencies() []string {
	return []string{"USD", "VND"}
}

// TestConvertQuantity tests unit conversion
func TestConvertQuantity(t *testing.T) {
	tests := []struct {
		name     string
		quantity float64
		from     GoldUnit
		to       GoldUnit
		expected float64
	}{
		{"Mace to Gram", 20.0, UnitMace, UnitGram, 75.0},
		{"Gram to Mace", 75.0, UnitGram, UnitMace, 20.0},
		{"Ounce to Gram", 1.0, UnitOunce, UnitGram, GramsPerOunce},
		{"Gram to Ounce", GramsPerOunce, UnitGram, UnitOunce, 1.0},
		{"Mace to Mace", 1.0, UnitMace, UnitMace, 1.0},
		{"Gram to Gram", 1.0, UnitGram, UnitGram, 1.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ConvertQuantity(tt.quantity, tt.from, tt.to)
			if mathAbs(result-tt.expected) > 0.0001 {
				t.Errorf("ConvertQuantity() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// TestConvertPricePerUnit tests price per unit conversion
func TestConvertPricePerUnit(t *testing.T) {
	tests := []struct {
		name     string
		price    float64
		from     GoldUnit
		to       GoldUnit
		expected float64
	}{
		{"Mace to Gram", 7500000.0, UnitMace, UnitGram, 2000000.0}, // 7.5M/mace / 3.75 = 2M/gram
		{"Gram to Mace", 2000000.0, UnitGram, UnitMace, 7500000.0},
		{"Mace to Mace", 8500000.0, UnitMace, UnitMace, 8500000.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ConvertPricePerUnit(tt.price, tt.from, tt.to)
			if mathAbs(result-tt.expected) > 0.01 {
				t.Errorf("ConvertPricePerUnit() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// TestNormalizeQuantityForStorage tests storage normalization
func TestNormalizeQuantityForStorage(t *testing.T) {
	converter := NewGoldConverter(&mockFXRateService{})

	tests := []struct {
		name           string
		quantity       float64
		inputUnit      GoldUnit
		investmentType investmentv1.InvestmentType
		expected       int64
	}{
		{
			name:           "VND Gold: 20 mace to grams",
			quantity:       20.0,
			inputUnit:      UnitMace,
			investmentType: investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
			expected:       750000, // 20 mace × 3.75g = 75g × 10000
		},
		{
			name:           "VND Gold: 100 grams to grams",
			quantity:       100.0,
			inputUnit:      UnitGram,
			investmentType: investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
			expected:       1000000, // 100g * 10000
		},
		{
			name:           "USD Gold: 1 ounce to ounces",
			quantity:       1.0,
			inputUnit:      UnitOunce,
			investmentType: investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD,
			expected:       10000, // 1oz * 10000
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := converter.NormalizeQuantityForStorage(tt.quantity, tt.inputUnit, tt.investmentType)
			if err != nil {
				t.Errorf("NormalizeQuantityForStorage() error = %v", err)
			}
			if result != tt.expected {
				t.Errorf("NormalizeQuantityForStorage() = %v, want %v", result, tt.expected)
			}
		})
	}
}

// TestDenormalizeQuantityForDisplay tests display denormalization
func TestDenormalizeQuantityForDisplay(t *testing.T) {
	converter := NewGoldConverter(&mockFXRateService{})

	tests := []struct {
		name             string
		storedQuantity   int64
		investmentType   investmentv1.InvestmentType
		displayUnit      GoldUnit
		expectedQuantity float64
	}{
		{
			name:             "VND Gold: 750000 stored to mace",
			storedQuantity:   750000, // 75g * 10000
			investmentType:   investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
			displayUnit:      UnitMace,
			expectedQuantity: 20.0, // 75g / 3.75 = 20 mace
		},
		{
			name:             "VND Gold: 750000 stored to grams",
			storedQuantity:   750000,
			investmentType:   investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
			displayUnit:      UnitGram,
			expectedQuantity: 75.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := converter.DenormalizeQuantityForDisplay(tt.storedQuantity, tt.investmentType, tt.displayUnit)
			if mathAbs(result-tt.expectedQuantity) > 0.0001 {
				t.Errorf("DenormalizeQuantityForDisplay() = %v, want %v", result, tt.expectedQuantity)
			}
		})
	}
}

// TestProcessMarketPrice tests market price processing
func TestProcessMarketPrice(t *testing.T) {
	converter := NewGoldConverter(&mockFXRateService{})

	tests := []struct {
		name           string
		marketPrice    int64
		marketCurrency string
		investmentType investmentv1.InvestmentType
		expected       int64
	}{
		{
			name:           "VND Gold: price per lượng to price per gram",
			marketPrice:    85000000000, // 85M VND per lượng (from vang.today API)
			marketCurrency: "VND",
			investmentType: investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
			expected:       2266666667, // 85M / 37.5 ≈ 2.2666M per gram (in VND dong)
		},
		{
			name:           "USD Gold: price per ounce unchanged",
			marketPrice:    270000, // $2700 per ounce (in cents)
			marketCurrency: "USD",
			investmentType: investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD,
			expected:       270000, // No conversion needed
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := converter.ProcessMarketPrice(tt.marketPrice, tt.marketCurrency, tt.investmentType)
			// Allow some tolerance for rounding
			diff := result - tt.expected
			if diff < 0 {
				diff = -diff
			}
			if diff > 100 { // Allow 100 unit tolerance for rounding
				t.Errorf("ProcessMarketPrice() = %v, want %v (diff=%v)", result, tt.expected, diff)
			}
		})
	}
}

// TestGetNativeStorageInfo tests storage info retrieval
func TestGetNativeStorageInfo(t *testing.T) {
	tests := []struct {
		name                 string
		investmentType       investmentv1.InvestmentType
		expectedUnit         GoldUnit
		expectedCurrency     string
	}{
		{
			name:             "VND Gold stored in grams",
			investmentType:   investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
			expectedUnit:     UnitGram,
			expectedCurrency: "VND",
		},
		{
			name:             "USD Gold stored in ounces",
			investmentType:   investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_USD,
			expectedUnit:     UnitOunce,
			expectedCurrency: "USD",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			unit, currency := GetNativeStorageInfo(tt.investmentType)
			if unit != tt.expectedUnit {
				t.Errorf("GetNativeStorageInfo() unit = %v, want %v", unit, tt.expectedUnit)
			}
			if currency != tt.expectedCurrency {
				t.Errorf("GetNativeStorageInfo() currency = %v, want %v", currency, tt.expectedCurrency)
			}
		})
	}
}

// Helper function for float comparison
func mathAbs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
