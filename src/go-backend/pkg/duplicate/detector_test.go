package duplicate

import (
	"context"
	"testing"
	"time"

	"wealthjourney/domain/models"
	v1 "wealthjourney/protobuf/v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockTransactionRepository is a mock of TransactionRepository interface
type MockTransactionRepository struct {
	mock.Mock
}

func (m *MockTransactionRepository) FindByWalletAndDateRange(ctx context.Context, walletID int32, startDate, endDate time.Time) ([]*models.Transaction, error) {
	args := m.Called(ctx, walletID, startDate, endDate)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*models.Transaction), args.Error(1)
}

// Helper function to create test transaction
func createTestTransaction(id int32, walletID int32, amount int64, date time.Time, description string, referenceNum string) *models.Transaction {
	return &models.Transaction{
		ID:       id,
		WalletID: walletID,
		Amount:   amount,
		Date:     date,
		Note:     description,
	}
}

// Helper function to create test parsed transaction
func createTestParsedTransaction(amount int64, date int64, description string, referenceNum string) *v1.ParsedTransaction {
	return &v1.ParsedTransaction{
		Amount: &v1.Money{
			Amount:   amount,
			Currency: "VND",
		},
		Date:            date,
		Description:     description,
		ReferenceNumber: referenceNum,
	}
}

func TestLevenshteinDistance(t *testing.T) {
	tests := []struct {
		name     string
		s1       string
		s2       string
		expected int
	}{
		{
			name:     "identical strings",
			s1:       "hello",
			s2:       "hello",
			expected: 0,
		},
		{
			name:     "one insertion",
			s1:       "hello",
			s2:       "hellow",
			expected: 1,
		},
		{
			name:     "one deletion",
			s1:       "hello",
			s2:       "hell",
			expected: 1,
		},
		{
			name:     "one substitution",
			s1:       "hello",
			s2:       "hallo",
			expected: 1,
		},
		{
			name:     "completely different",
			s1:       "abc",
			s2:       "xyz",
			expected: 3,
		},
		{
			name:     "empty strings",
			s1:       "",
			s2:       "",
			expected: 0,
		},
		{
			name:     "one empty string",
			s1:       "hello",
			s2:       "",
			expected: 5,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := levenshteinDistance(tt.s1, tt.s2)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestStringSimilarity(t *testing.T) {
	tests := []struct {
		name     string
		s1       string
		s2       string
		minScore float64 // Minimum expected similarity
	}{
		{
			name:     "identical strings",
			s1:       "hello world",
			s2:       "hello world",
			minScore: 100.0,
		},
		{
			name:     "minor typo",
			s1:       "PAYMENT TO STARBUCKS",
			s2:       "PAYMENT TO STARBUCKS COFFEE",
			minScore: 70.0,
		},
		{
			name:     "case difference",
			s1:       "Coffee Shop",
			s2:       "coffee shop",
			minScore: 100.0,
		},
		{
			name:     "completely different",
			s1:       "Apple Store",
			s2:       "Pizza Hut",
			minScore: 0.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := stringSimilarity(tt.s1, tt.s2)
			switch tt.minScore {
			case 100.0:
				assert.Equal(t, 100.0, result)
			case 0.0:
				assert.Less(t, result, 50.0)
			default:
				assert.GreaterOrEqual(t, result, tt.minScore)
			}
		})
	}
}

func TestExtractMerchantName(t *testing.T) {
	tests := []struct {
		name        string
		description string
		expected    string
	}{
		{
			name:        "simple merchant name",
			description: "PAYMENT TO STARBUCKS",
			expected:    "STARBUCKS",
		},
		{
			name:        "with location",
			description: "PURCHASE AT VINMART HA NOI",
			expected:    "VINMART",
		},
		{
			name:        "online payment",
			description: "PAYMENT TO LAZADA.VN",
			expected:    "LAZADA",
		},
		{
			name:        "ATM withdrawal",
			description: "ATM WITHDRAWAL 1000000 VND",
			expected:    "ATM WITHDRAWAL",
		},
		{
			name:        "no merchant identifiable",
			description: "SALARY PAYMENT JANUARY 2024",
			expected:    "SALARY",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractMerchantName(tt.description)
			assert.Contains(t, result, tt.expected)
		})
	}
}

func TestLevel1Match_ExactMatch(t *testing.T) {
	mockRepo := new(MockTransactionRepository)
	detector := NewDetector(mockRepo)

	// Test date
	testDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	walletID := int32(1)

	// Existing transaction with reference in note
	existingTx := createTestTransaction(1, walletID, 100000, testDate, "PAYMENT TO STARBUCKS (Ref: REF123)", "")

	// Parsed transaction with matching reference
	parsedTx := createTestParsedTransaction(100000, testDate.Unix(), "PAYMENT TO STARBUCKS", "REF123")

	// Mock repository to return existing transaction
	mockRepo.On("FindByWalletAndDateRange", mock.Anything, walletID, mock.Anything, mock.Anything).
		Return([]*models.Transaction{existingTx}, nil)

	// Detect duplicates
	matches, err := detector.DetectDuplicates(context.Background(), walletID, []*v1.ParsedTransaction{parsedTx})

	assert.NoError(t, err)
	assert.Len(t, matches, 1)
	assert.Equal(t, int32(99), matches[0].Confidence)
	assert.Contains(t, matches[0].MatchReason, "Exact match")
}

func TestLevel2Match_StrongMatch(t *testing.T) {
	mockRepo := new(MockTransactionRepository)
	detector := NewDetector(mockRepo)

	// Test date
	testDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	existingDate := testDate.Add(-24 * time.Hour) // 1 day earlier
	walletID := int32(1)

	// Existing transaction with very similar description (>80% similarity required)
	existingTx := createTestTransaction(1, walletID, 100000, existingDate, "PAYMENT TO STARBUCKS #12345", "")

	// Parsed transaction with similar description, same amount, date ±1 day
	parsedTx := createTestParsedTransaction(100000, testDate.Unix(), "PAYMENT TO STARBUCKS #12345", "")

	// Mock repository
	mockRepo.On("FindByWalletAndDateRange", mock.Anything, walletID, mock.Anything, mock.Anything).
		Return([]*models.Transaction{existingTx}, nil)

	// Detect duplicates
	matches, err := detector.DetectDuplicates(context.Background(), walletID, []*v1.ParsedTransaction{parsedTx})

	assert.NoError(t, err)
	assert.Len(t, matches, 1)
	assert.GreaterOrEqual(t, matches[0].Confidence, int32(90))
	assert.LessOrEqual(t, matches[0].Confidence, int32(95))
	assert.Contains(t, matches[0].MatchReason, "Strong match")
}

func TestLevel3Match_LikelyMatch(t *testing.T) {
	mockRepo := new(MockTransactionRepository)
	detector := NewDetector(mockRepo)

	// Test date
	testDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	existingDate := testDate.Add(-48 * time.Hour) // 2 days earlier
	walletID := int32(1)

	// Existing transaction with amount within 5% (100000 * 1.03 = 103000)
	existingTx := createTestTransaction(1, walletID, 103000, existingDate, "STARBUCKS COFFEE SHOP", "")

	// Parsed transaction with similar description (>60% similarity), amount ±5%, date ±3 days
	parsedTx := createTestParsedTransaction(100000, testDate.Unix(), "STARBUCKS COFFEE", "")

	// Mock repository
	mockRepo.On("FindByWalletAndDateRange", mock.Anything, walletID, mock.Anything, mock.Anything).
		Return([]*models.Transaction{existingTx}, nil)

	// Detect duplicates
	matches, err := detector.DetectDuplicates(context.Background(), walletID, []*v1.ParsedTransaction{parsedTx})

	assert.NoError(t, err)
	assert.Len(t, matches, 1)
	assert.GreaterOrEqual(t, matches[0].Confidence, int32(70))
	assert.LessOrEqual(t, matches[0].Confidence, int32(85))
	assert.Contains(t, matches[0].MatchReason, "Likely match")
}

func TestLevel4Match_PossibleMatch(t *testing.T) {
	mockRepo := new(MockTransactionRepository)
	detector := NewDetector(mockRepo)

	// Test date
	testDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	existingDate := testDate.Add(-5 * 24 * time.Hour) // 5 days earlier
	walletID := int32(1)

	// Existing transaction with amount within 10% (100000 * 1.08 = 108000)
	existingTx := createTestTransaction(1, walletID, 108000, existingDate, "PAYMENT TO CIRCLE K STORE", "")

	// Parsed transaction with merchant match, amount ±10%, date ±7 days
	parsedTx := createTestParsedTransaction(100000, testDate.Unix(), "PURCHASE AT CIRCLE K", "")

	// Mock repository
	mockRepo.On("FindByWalletAndDateRange", mock.Anything, walletID, mock.Anything, mock.Anything).
		Return([]*models.Transaction{existingTx}, nil)

	// Detect duplicates
	matches, err := detector.DetectDuplicates(context.Background(), walletID, []*v1.ParsedTransaction{parsedTx})

	assert.NoError(t, err)
	assert.Len(t, matches, 1)
	assert.GreaterOrEqual(t, matches[0].Confidence, int32(50))
	assert.LessOrEqual(t, matches[0].Confidence, int32(65))
	assert.Contains(t, matches[0].MatchReason, "Possible match")
}

func TestNoMatch_DifferentTransactions(t *testing.T) {
	mockRepo := new(MockTransactionRepository)
	detector := NewDetector(mockRepo)

	// Test date
	testDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	walletID := int32(1)

	// Existing transaction
	existingTx := createTestTransaction(1, walletID, 500000, testDate, "PAYMENT TO APPLE STORE", "")

	// Parsed transaction completely different
	parsedTx := createTestParsedTransaction(100000, testDate.Unix(), "PAYMENT TO STARBUCKS", "")

	// Mock repository
	mockRepo.On("FindByWalletAndDateRange", mock.Anything, walletID, mock.Anything, mock.Anything).
		Return([]*models.Transaction{existingTx}, nil)

	// Detect duplicates
	matches, err := detector.DetectDuplicates(context.Background(), walletID, []*v1.ParsedTransaction{parsedTx})

	assert.NoError(t, err)
	assert.Len(t, matches, 0) // No matches expected
}

func TestDetectDuplicates_MultipleTransactions(t *testing.T) {
	mockRepo := new(MockTransactionRepository)
	detector := NewDetector(mockRepo)

	// Test date
	testDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	walletID := int32(1)

	// Existing transactions
	existingTx1 := createTestTransaction(1, walletID, 100000, testDate, "PAYMENT TO STARBUCKS", "REF123")
	existingTx2 := createTestTransaction(2, walletID, 200000, testDate.Add(-24*time.Hour), "PURCHASE AT VINMART #456", "")

	// Parsed transactions
	parsedTx1 := createTestParsedTransaction(100000, testDate.Unix(), "PAYMENT TO STARBUCKS", "REF123")
	parsedTx2 := createTestParsedTransaction(200000, testDate.Unix(), "PURCHASE AT VINMART #456", "") // Should match Level 2
	parsedTx3 := createTestParsedTransaction(50000, testDate.Unix(), "COFFEE SHOP", "") // No match

	// Mock repository
	mockRepo.On("FindByWalletAndDateRange", mock.Anything, walletID, mock.Anything, mock.Anything).
		Return([]*models.Transaction{existingTx1, existingTx2}, nil)

	// Detect duplicates
	matches, err := detector.DetectDuplicates(context.Background(), walletID, []*v1.ParsedTransaction{parsedTx1, parsedTx2, parsedTx3})

	assert.NoError(t, err)
	assert.Len(t, matches, 2) // Should find 2 matches
}

func TestDetectDuplicates_EmptyExistingTransactions(t *testing.T) {
	mockRepo := new(MockTransactionRepository)
	detector := NewDetector(mockRepo)

	// Test date
	testDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	walletID := int32(1)

	// Parsed transaction
	parsedTx := createTestParsedTransaction(100000, testDate.Unix(), "PAYMENT TO STARBUCKS", "")

	// Mock repository - no existing transactions
	mockRepo.On("FindByWalletAndDateRange", mock.Anything, walletID, mock.Anything, mock.Anything).
		Return([]*models.Transaction{}, nil)

	// Detect duplicates
	matches, err := detector.DetectDuplicates(context.Background(), walletID, []*v1.ParsedTransaction{parsedTx})

	assert.NoError(t, err)
	assert.Len(t, matches, 0) // No matches expected
}

func TestPerformance_LevenshteinDistance(t *testing.T) {
	// Test that Levenshtein distance calculation is fast
	s1 := "PAYMENT TO STARBUCKS COFFEE SHOP IN HANOI"
	s2 := "PAYMENT TO STARBUCKS COFFEE SHOP IN SAIGON"

	start := time.Now()
	for i := 0; i < 1000; i++ {
		levenshteinDistance(s1, s2)
	}
	duration := time.Since(start)

	// Should complete 1000 comparisons in less than 100ms
	assert.Less(t, duration.Milliseconds(), int64(100), "Levenshtein distance should be fast")
}

// Test Level 1 matching with reference numbers
func TestLevel1Match_WithMatchingReferences(t *testing.T) {
	mockRepo := new(MockTransactionRepository)
	detector := NewDetector(mockRepo)

	testDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	walletID := int32(1)

	// Existing transaction with reference in note
	existingTx := createTestTransaction(1, walletID, 100000, testDate, "Bank transfer (Ref: FT123456789)", "")

	// Parsed transaction with matching reference
	parsedTx := createTestParsedTransaction(100000, testDate.Unix(), "Transfer payment", "FT123456789")

	mockRepo.On("FindByWalletAndDateRange", mock.Anything, walletID, mock.Anything, mock.Anything).
		Return([]*models.Transaction{existingTx}, nil)

	matches, err := detector.DetectDuplicates(context.Background(), walletID, []*v1.ParsedTransaction{parsedTx})

	assert.NoError(t, err)
	assert.Len(t, matches, 1)
	assert.Equal(t, int32(99), matches[0].Confidence)
	assert.Contains(t, matches[0].MatchReason, "Exact match")
	assert.Contains(t, matches[0].MatchReason, "reference number")
}

func TestLevel1Match_NoReferences(t *testing.T) {
	mockRepo := new(MockTransactionRepository)
	detector := NewDetector(mockRepo)

	testDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	walletID := int32(1)

	// Existing transaction without reference
	existingTx := createTestTransaction(1, walletID, 100000, testDate, "Coffee shop purchase", "")

	// Parsed transaction without reference
	parsedTx := createTestParsedTransaction(100000, testDate.Unix(), "Coffee shop purchase", "")

	mockRepo.On("FindByWalletAndDateRange", mock.Anything, walletID, mock.Anything, mock.Anything).
		Return([]*models.Transaction{existingTx}, nil)

	matches, err := detector.DetectDuplicates(context.Background(), walletID, []*v1.ParsedTransaction{parsedTx})

	assert.NoError(t, err)
	// Should fall through to Level 2 match (description similarity >80%)
	if len(matches) > 0 {
		assert.NotEqual(t, int32(99), matches[0].Confidence, "Should not be Level 1 match without reference")
	}
}

func TestLevel1Match_OnlyOneHasReference(t *testing.T) {
	mockRepo := new(MockTransactionRepository)
	detector := NewDetector(mockRepo)

	testDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	walletID := int32(1)

	// Existing transaction without reference
	existingTx := createTestTransaction(1, walletID, 100000, testDate, "Bank transfer", "")

	// Parsed transaction with reference
	parsedTx := createTestParsedTransaction(100000, testDate.Unix(), "Bank transfer", "FT123456789")

	mockRepo.On("FindByWalletAndDateRange", mock.Anything, walletID, mock.Anything, mock.Anything).
		Return([]*models.Transaction{existingTx}, nil)

	matches, err := detector.DetectDuplicates(context.Background(), walletID, []*v1.ParsedTransaction{parsedTx})

	assert.NoError(t, err)
	// Should fall through to Level 2 match (description match)
	if len(matches) > 0 {
		assert.NotEqual(t, int32(99), matches[0].Confidence, "Should not be Level 1 match when only one has reference")
	}
}

func TestLevel1Match_DifferentReferences(t *testing.T) {
	mockRepo := new(MockTransactionRepository)
	detector := NewDetector(mockRepo)

	testDate := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	walletID := int32(1)

	// Existing transaction with reference
	existingTx := createTestTransaction(1, walletID, 100000, testDate, "Transfer (Ref: FT111111111)", "")

	// Parsed transaction with different reference
	parsedTx := createTestParsedTransaction(100000, testDate.Unix(), "Transfer payment", "FT999999999")

	mockRepo.On("FindByWalletAndDateRange", mock.Anything, walletID, mock.Anything, mock.Anything).
		Return([]*models.Transaction{existingTx}, nil)

	matches, err := detector.DetectDuplicates(context.Background(), walletID, []*v1.ParsedTransaction{parsedTx})

	assert.NoError(t, err)
	// Should not match at Level 1 due to different reference numbers
	// May fall through to lower levels depending on description similarity
	if len(matches) > 0 {
		assert.NotEqual(t, int32(99), matches[0].Confidence, "Should not be Level 1 match with different references")
	}
}

func TestExtractReferenceFromNote(t *testing.T) {
	detector := NewDetector(nil)

	tests := []struct {
		name     string
		note     string
		expected string
	}{
		{
			name:     "reference with parentheses",
			note:     "Bank transfer (Ref: FT123456789)",
			expected: "FT123456789",
		},
		{
			name:     "reference with pipe separator",
			note:     "Online payment | Ref: PAY987654321",
			expected: "PAY987654321",
		},
		{
			name:     "reference with extra spaces",
			note:     "Transfer (Ref:   ABC123   )",
			expected: "ABC123",
		},
		{
			name:     "no reference",
			note:     "Coffee shop purchase",
			expected: "",
		},
		{
			name:     "multiple possible patterns, take first",
			note:     "Transfer (Ref: FIRST123) | Ref: SECOND456",
			expected: "FIRST123",
		},
		{
			name:     "reference at end of note",
			note:     "BIDV transfer | Ref: FT20240115123",
			expected: "FT20240115123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := detector.extractReferenceFromNote(tt.note)
			assert.Equal(t, tt.expected, result)
		})
	}
}
