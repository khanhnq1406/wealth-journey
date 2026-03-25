package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	"wealthjourney/domain/models"
	v1 "wealthjourney/protobuf/v1"
)

// mockInvestmentService implements service.InvestmentService for handler testing.
type mockInvestmentService struct {
	editTransactionFunc func(ctx context.Context, transactionID int32, userID int32, req *v1.EditInvestmentTransactionRequest) (*v1.EditInvestmentTransactionResponse, error)
	// Stub out all other methods to satisfy the interface
	createInvestmentFunc              func(ctx context.Context, userID int32, req *v1.CreateInvestmentRequest) (*v1.CreateInvestmentResponse, error)
	getInvestmentFunc                 func(ctx context.Context, investmentID int32, requestingUserID int32) (*v1.GetInvestmentResponse, error)
	listInvestmentsFunc               func(ctx context.Context, userID int32, req *v1.ListInvestmentsRequest) (*v1.ListInvestmentsResponse, error)
	updateInvestmentFunc              func(ctx context.Context, investmentID int32, userID int32, req *v1.UpdateInvestmentRequest) (*v1.UpdateInvestmentResponse, error)
	deleteInvestmentFunc              func(ctx context.Context, investmentID int32, userID int32) (*v1.DeleteInvestmentResponse, error)
	addTransactionFunc                func(ctx context.Context, userID int32, req *v1.AddTransactionRequest) (*v1.AddTransactionResponse, error)
	listTransactionsFunc              func(ctx context.Context, userID int32, req *v1.ListInvestmentTransactionsRequest) (*v1.ListInvestmentTransactionsResponse, error)
	deleteTransactionFunc             func(ctx context.Context, transactionID int32, userID int32) (*v1.DeleteInvestmentTransactionResponse, error)
	getPortfolioSummaryFunc           func(ctx context.Context, walletID int32, userID int32, period v1.PnlPeriod) (*v1.GetPortfolioSummaryResponse, error)
	updatePricesFunc                  func(ctx context.Context, userID int32, req *v1.UpdatePricesRequest) (*v1.UpdatePricesResponse, error)
	searchSymbolsFunc                 func(ctx context.Context, query string, limit int) (*v1.SearchSymbolsResponse, error)
	listUserInvestmentsFunc           func(ctx context.Context, userID int32, req *v1.ListUserInvestmentsRequest) (*v1.ListUserInvestmentsResponse, error)
	getAggregatedPortfolioSummaryFunc func(ctx context.Context, userID int32, req *v1.GetAggregatedPortfolioSummaryRequest) (*v1.GetPortfolioSummaryResponse, error)
	listInvestmentWalletsFunc         func(ctx context.Context, userID int32) ([]*models.Wallet, error)
}

func (m *mockInvestmentService) CreateInvestment(ctx context.Context, userID int32, req *v1.CreateInvestmentRequest) (*v1.CreateInvestmentResponse, error) {
	if m.createInvestmentFunc != nil {
		return m.createInvestmentFunc(ctx, userID, req)
	}
	return nil, nil
}
func (m *mockInvestmentService) GetInvestment(ctx context.Context, investmentID int32, requestingUserID int32) (*v1.GetInvestmentResponse, error) {
	if m.getInvestmentFunc != nil {
		return m.getInvestmentFunc(ctx, investmentID, requestingUserID)
	}
	return nil, nil
}
func (m *mockInvestmentService) ListInvestments(ctx context.Context, userID int32, req *v1.ListInvestmentsRequest) (*v1.ListInvestmentsResponse, error) {
	if m.listInvestmentsFunc != nil {
		return m.listInvestmentsFunc(ctx, userID, req)
	}
	return nil, nil
}
func (m *mockInvestmentService) UpdateInvestment(ctx context.Context, investmentID int32, userID int32, req *v1.UpdateInvestmentRequest) (*v1.UpdateInvestmentResponse, error) {
	if m.updateInvestmentFunc != nil {
		return m.updateInvestmentFunc(ctx, investmentID, userID, req)
	}
	return nil, nil
}
func (m *mockInvestmentService) DeleteInvestment(ctx context.Context, investmentID int32, userID int32) (*v1.DeleteInvestmentResponse, error) {
	if m.deleteInvestmentFunc != nil {
		return m.deleteInvestmentFunc(ctx, investmentID, userID)
	}
	return nil, nil
}
func (m *mockInvestmentService) AddTransaction(ctx context.Context, userID int32, req *v1.AddTransactionRequest) (*v1.AddTransactionResponse, error) {
	if m.addTransactionFunc != nil {
		return m.addTransactionFunc(ctx, userID, req)
	}
	return nil, nil
}
func (m *mockInvestmentService) ListTransactions(ctx context.Context, userID int32, req *v1.ListInvestmentTransactionsRequest) (*v1.ListInvestmentTransactionsResponse, error) {
	if m.listTransactionsFunc != nil {
		return m.listTransactionsFunc(ctx, userID, req)
	}
	return nil, nil
}
func (m *mockInvestmentService) EditTransaction(ctx context.Context, transactionID int32, userID int32, req *v1.EditInvestmentTransactionRequest) (*v1.EditInvestmentTransactionResponse, error) {
	if m.editTransactionFunc != nil {
		return m.editTransactionFunc(ctx, transactionID, userID, req)
	}
	return nil, nil
}
func (m *mockInvestmentService) DeleteTransaction(ctx context.Context, transactionID int32, userID int32) (*v1.DeleteInvestmentTransactionResponse, error) {
	if m.deleteTransactionFunc != nil {
		return m.deleteTransactionFunc(ctx, transactionID, userID)
	}
	return nil, nil
}
func (m *mockInvestmentService) GetPortfolioSummary(ctx context.Context, walletID int32, userID int32, period v1.PnlPeriod) (*v1.GetPortfolioSummaryResponse, error) {
	if m.getPortfolioSummaryFunc != nil {
		return m.getPortfolioSummaryFunc(ctx, walletID, userID, period)
	}
	return nil, nil
}
func (m *mockInvestmentService) UpdatePrices(ctx context.Context, userID int32, req *v1.UpdatePricesRequest) (*v1.UpdatePricesResponse, error) {
	if m.updatePricesFunc != nil {
		return m.updatePricesFunc(ctx, userID, req)
	}
	return nil, nil
}
func (m *mockInvestmentService) SearchSymbols(ctx context.Context, query string, limit int) (*v1.SearchSymbolsResponse, error) {
	if m.searchSymbolsFunc != nil {
		return m.searchSymbolsFunc(ctx, query, limit)
	}
	return nil, nil
}
func (m *mockInvestmentService) ListUserInvestments(ctx context.Context, userID int32, req *v1.ListUserInvestmentsRequest) (*v1.ListUserInvestmentsResponse, error) {
	if m.listUserInvestmentsFunc != nil {
		return m.listUserInvestmentsFunc(ctx, userID, req)
	}
	return nil, nil
}
func (m *mockInvestmentService) GetAggregatedPortfolioSummary(ctx context.Context, userID int32, req *v1.GetAggregatedPortfolioSummaryRequest) (*v1.GetPortfolioSummaryResponse, error) {
	if m.getAggregatedPortfolioSummaryFunc != nil {
		return m.getAggregatedPortfolioSummaryFunc(ctx, userID, req)
	}
	return nil, nil
}
func (m *mockInvestmentService) ListInvestmentWallets(ctx context.Context, userID int32) ([]*models.Wallet, error) {
	if m.listInvestmentWalletsFunc != nil {
		return m.listInvestmentWalletsFunc(ctx, userID)
	}
	return nil, nil
}

// newEditTransactionRouter creates a test router with the EditTransaction handler,
// setting user_id=1 in the context to simulate an authenticated user.
func newEditTransactionRouter(svc *mockInvestmentService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	h := NewInvestmentHandlers(svc, nil, nil)

	router.PUT("/api/v1/investment-transactions/:id", func(c *gin.Context) {
		c.Set("user_id", int32(1))
		h.EditTransaction(c)
	})
	return router
}

// TestEditTransactionHandler_InvalidType_Rejected verifies that passing a type
// outside the allowed set {0,1,2,3} returns HTTP 400.
func TestEditTransactionHandler_InvalidType_Rejected(t *testing.T) {
	svc := &mockInvestmentService{}
	router := newEditTransactionRouter(svc)

	body := map[string]interface{}{
		"quantity":        100000,
		"price":           50000,
		"fees":            0,
		"transactionDate": time.Now().Add(-time.Hour).Unix(),
		"type":            99, // invalid — only 0,1,2,3 allowed
	}
	bodyBytes, _ := json.Marshal(body)

	req, _ := http.NewRequest("PUT", "/api/v1/investment-transactions/1", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusBadRequest, resp.Code, "expected 400 for invalid type enum")

	var respBody map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &respBody)
	assert.NoError(t, err)
	assert.Equal(t, false, respBody["success"])
}

// TestEditTransactionHandler_TypeSplit_Rejected verifies that type=4 (SPLIT)
// is also rejected with HTTP 400.
func TestEditTransactionHandler_TypeSplit_Rejected(t *testing.T) {
	svc := &mockInvestmentService{}
	router := newEditTransactionRouter(svc)

	body := map[string]interface{}{
		"quantity":        100000,
		"price":           50000,
		"fees":            0,
		"transactionDate": time.Now().Add(-time.Hour).Unix(),
		"type":            4, // SPLIT — not allowed in edit
	}
	bodyBytes, _ := json.Marshal(body)

	req, _ := http.NewRequest("PUT", "/api/v1/investment-transactions/1", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusBadRequest, resp.Code, "expected 400 for SPLIT type")
}

// TestEditTransactionHandler_ValidType_PassesThrough verifies that all valid
// type values {0=UNSPECIFIED, 1=BUY, 2=SELL, 3=DIVIDEND} are accepted.
func TestEditTransactionHandler_ValidType_PassesThrough(t *testing.T) {
	validTypes := []int{0, 1, 2, 3}

	for _, txType := range validTypes {
		txType := txType // capture
		t.Run("type="+string(rune('0'+txType)), func(t *testing.T) {
			var capturedType v1.InvestmentTransactionType
			svc := &mockInvestmentService{
				editTransactionFunc: func(ctx context.Context, transactionID int32, userID int32, req *v1.EditInvestmentTransactionRequest) (*v1.EditInvestmentTransactionResponse, error) {
					capturedType = req.Type
					return &v1.EditInvestmentTransactionResponse{
						Success: true,
						Message: "ok",
						Data: &v1.InvestmentTransaction{
							Id:   transactionID,
							Type: req.Type,
						},
						UpdatedInvestment: &v1.Investment{Id: 1},
					}, nil
				},
			}
			router := newEditTransactionRouter(svc)

			body := map[string]interface{}{
				"quantity":        100000,
				"price":           50000,
				"fees":            0,
				"transactionDate": time.Now().Add(-time.Hour).Unix(),
				"type":            txType,
			}
			bodyBytes, _ := json.Marshal(body)

			req, _ := http.NewRequest("PUT", "/api/v1/investment-transactions/1", bytes.NewBuffer(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			assert.Equal(t, http.StatusOK, resp.Code, "type=%d should be accepted", txType)
			assert.Equal(t, v1.InvestmentTransactionType(txType), capturedType, "type should be passed to service")
		})
	}
}

// TestEditTransactionHandler_ResponseIncludesUpdatedInvestment verifies that the
// response includes the updatedInvestment field returned by the service.
func TestEditTransactionHandler_ResponseIncludesUpdatedInvestment(t *testing.T) {
	svc := &mockInvestmentService{
		editTransactionFunc: func(ctx context.Context, transactionID int32, userID int32, req *v1.EditInvestmentTransactionRequest) (*v1.EditInvestmentTransactionResponse, error) {
			return &v1.EditInvestmentTransactionResponse{
				Success: true,
				Message: "transaction updated",
				Data: &v1.InvestmentTransaction{
					Id:   transactionID,
					Type: v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_BUY,
				},
				UpdatedInvestment: &v1.Investment{
					Id:     42,
					Symbol: "VCB",
				},
			}, nil
		},
	}
	router := newEditTransactionRouter(svc)

	body := map[string]interface{}{
		"quantity":        100000,
		"price":           50000,
		"fees":            0,
		"transactionDate": time.Now().Add(-time.Hour).Unix(),
		"type":            1, // BUY
	}
	bodyBytes, _ := json.Marshal(body)

	req, _ := http.NewRequest("PUT", "/api/v1/investment-transactions/1", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)

	var respBody map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &respBody)
	assert.NoError(t, err)

	// updatedInvestment should be present in the response
	updatedInvestment, ok := respBody["updatedInvestment"]
	assert.True(t, ok, "response should contain 'updatedInvestment' field")
	assert.NotNil(t, updatedInvestment, "'updatedInvestment' should not be nil")

	investmentMap, ok := updatedInvestment.(map[string]interface{})
	assert.True(t, ok)
	// protojson serializes int32 as float64 in JSON
	assert.Equal(t, float64(42), investmentMap["id"])
	assert.Equal(t, "VCB", investmentMap["symbol"])
}

// TestEditTransactionHandler_AllFieldsPassedToService verifies that all editable
// fields (quantity, price, fees, transactionDate, notes, type) are correctly
// forwarded to the service layer.
func TestEditTransactionHandler_AllFieldsPassedToService(t *testing.T) {
	var capturedReq *v1.EditInvestmentTransactionRequest

	svc := &mockInvestmentService{
		editTransactionFunc: func(ctx context.Context, transactionID int32, userID int32, req *v1.EditInvestmentTransactionRequest) (*v1.EditInvestmentTransactionResponse, error) {
			capturedReq = req
			return &v1.EditInvestmentTransactionResponse{
				Success: true,
				Data:    &v1.InvestmentTransaction{Id: transactionID},
			}, nil
		},
	}
	router := newEditTransactionRouter(svc)

	txDate := time.Now().Add(-24 * time.Hour).Unix()
	body := map[string]interface{}{
		"quantity":        200000,
		"price":           85000,
		"fees":            1000,
		"transactionDate": txDate,
		"notes":           "edited note",
		"type":            2, // SELL
	}
	bodyBytes, _ := json.Marshal(body)

	req, _ := http.NewRequest("PUT", "/api/v1/investment-transactions/7", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusOK, resp.Code)
	assert.NotNil(t, capturedReq)
	assert.Equal(t, int32(7), capturedReq.Id)
	assert.Equal(t, int64(200000), capturedReq.Quantity)
	assert.Equal(t, int64(85000), capturedReq.Price)
	assert.Equal(t, int64(1000), capturedReq.Fees)
	assert.Equal(t, txDate, capturedReq.TransactionDate)
	assert.Equal(t, "edited note", capturedReq.Notes)
	assert.Equal(t, v1.InvestmentTransactionType_INVESTMENT_TRANSACTION_TYPE_SELL, capturedReq.Type)
}

// TestEditTransactionHandler_Unauthenticated verifies that a missing user ID
// returns HTTP 401.
func TestEditTransactionHandler_Unauthenticated(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := &mockInvestmentService{}
	h := NewInvestmentHandlers(svc, nil, nil)

	router := gin.New()
	// No user_id set in context — simulates missing JWT
	router.PUT("/api/v1/investment-transactions/:id", h.EditTransaction)

	body := map[string]interface{}{
		"quantity": 100000,
		"price":    50000,
		"fees":     0,
	}
	bodyBytes, _ := json.Marshal(body)

	req, _ := http.NewRequest("PUT", "/api/v1/investment-transactions/1", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	assert.Equal(t, http.StatusUnauthorized, resp.Code)
}
