package service

import (
	"context"
	"fmt"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/validator"
	investmentv1 "wealthjourney/protobuf/v1"
)

// PortfolioHistoryService handles historical portfolio data
type portfolioHistoryService struct {
	historyRepo   repository.PortfolioHistoryRepository
	investmentSvc InvestmentService
	userRepo      repository.UserRepository
	fxRateSvc     FXRateService
}

// NewPortfolioHistoryService creates a new PortfolioHistoryService
func NewPortfolioHistoryService(
	historyRepo repository.PortfolioHistoryRepository,
	investmentSvc InvestmentService,
	userRepo repository.UserRepository,
	fxRateSvc FXRateService,
) PortfolioHistoryService {
	return &portfolioHistoryService{
		historyRepo:   historyRepo,
		investmentSvc: investmentSvc,
		userRepo:      userRepo,
		fxRateSvc:     fxRateSvc,
	}
}

// GetHistoricalValues retrieves historical portfolio values for charts
func (s *portfolioHistoryService) GetHistoricalValues(ctx context.Context, userID int32, req *investmentv1.GetHistoricalPortfolioValuesRequest) (*investmentv1.GetHistoricalPortfolioValuesResponse, error) {
	// 1. Validate inputs
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	days := req.Days
	if days <= 0 || days > 365 {
		days = 30 // Default to 30 days
	}

	points := req.Points
	if points <= 0 || points > 100 {
		points = 10 // Default to 10 points
	}

	// 2. Get user's preferred currency
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return nil, apperrors.NewNotFoundError("user")
	}
	userCurrency := user.PreferredCurrency

	// 3. Calculate time range
	to := time.Now()
	from := to.AddDate(0, 0, -int(days))

	// 4. Fetch historical data
	var histories []*models.PortfolioHistory

	if req.WalletId == 0 {
		// Aggregated across all investment wallets
		histories, err = s.historyRepo.GetAggregatedHistory(ctx, userID, from, to, int(points)*4) // Get more points for sampling
		if err != nil {
			return nil, fmt.Errorf("failed to fetch historical data: %w", err)
		}
	} else {
		// Specific wallet
		histories, err = s.historyRepo.GetHistoryByWallet(ctx, userID, req.WalletId, from, to, int(points)*4)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch historical data: %w", err)
		}
	}

	// 5. Sample the data to requested number of points
	sampled := s.sampleData(histories, int(points))

	// 6. Convert to protobuf format with currency conversion
	data := make([]*investmentv1.HistoricalPortfolioValue, len(sampled))
	for i, h := range sampled {
		displayValue := h.TotalValue
		displayCurrency := h.Currency

		// Convert to user's preferred currency if different
		if userCurrency != h.Currency {
			rate, err := s.fxRateSvc.GetRate(ctx, h.Currency, userCurrency)
			if err == nil && rate > 0 {
				displayValue = int64(float64(h.TotalValue) * rate)
				displayCurrency = userCurrency
			}
		}

		data[i] = &investmentv1.HistoricalPortfolioValue{
			Timestamp: h.Timestamp.Unix(),
			TotalValue: h.TotalValue,
			DisplayTotalValue: &investmentv1.Money{
				Amount:   displayValue,
				Currency: displayCurrency,
			},
		}
	}

	return &investmentv1.GetHistoricalPortfolioValuesResponse{
		Success:   true,
		Message:   "Historical values retrieved successfully",
		Data:      data,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// sampleData reduces the dataset to the requested number of points using time-based sampling
func (s *portfolioHistoryService) sampleData(histories []*models.PortfolioHistory, points int) []*models.PortfolioHistory {
	if len(histories) <= points {
		return histories
	}

	// Calculate step size
	step := len(histories) / points
	if step < 1 {
		step = 1
	}

	// Sample at regular intervals
	result := make([]*models.PortfolioHistory, 0, points)
	for i := 0; i < len(histories) && len(result) < points; i += step {
		result = append(result, histories[i])
	}

	// Always include the latest data point
	if len(result) > 0 && result[len(result)-1] != histories[len(histories)-1] {
		result = append(result, histories[len(histories)-1])
	}

	return result
}

// CreateSnapshot creates a portfolio value snapshot for a specific wallet
func (s *portfolioHistoryService) CreateSnapshot(ctx context.Context, userID, walletID int32) error {
	// Get current portfolio summary for this wallet
	summary, err := s.investmentSvc.GetPortfolioSummary(ctx, walletID, userID, 0)
	if err != nil {
		return fmt.Errorf("failed to get portfolio summary: %w", err)
	}

	if summary.Data == nil {
		return fmt.Errorf("no portfolio data available")
	}

	data := summary.Data

	// Create snapshot
	history := &models.PortfolioHistory{
		UserID:     userID,
		WalletID:    walletID,
		TotalValue:  data.TotalValue,
		TotalCost:   data.TotalCost,
		TotalPnl:    data.TotalPnl,
		Currency:    data.Currency,
		Timestamp:   time.Now(),
	}

	_, err = s.historyRepo.CreateSnapshotIfNotDuplicate(ctx, history)
	return err
}

// CreateAggregatedSnapshot creates snapshots for all investment wallets
func (s *portfolioHistoryService) CreateAggregatedSnapshot(ctx context.Context, userID int32) error {
	// Get all investment wallets for the user
	wallets, err := s.investmentSvc.ListInvestmentWallets(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to list investment wallets: %w", err)
	}

	// Create snapshot for each wallet
	for _, wallet := range wallets {
		if err := s.CreateSnapshot(ctx, userID, wallet.ID); err != nil {
			// Log error but continue with other wallets
			fmt.Printf("Warning: failed to create snapshot for wallet %d: %v\n", wallet.ID, err)
		}
	}

	return nil
}
