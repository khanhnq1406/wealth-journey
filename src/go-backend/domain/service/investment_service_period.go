package service

import (
	"context"
	"log"
	"time"

	investmentv1 "wealthjourney/protobuf/v1"
)

// periodToDays converts a PnlPeriod to the lookback duration in days from now.
// Returns 0 for PERIOD_ALL or PERIOD_UNSPECIFIED (no snapshot query needed).
func periodToDays(period investmentv1.PnlPeriod) int {
	switch period {
	case investmentv1.PnlPeriod_PNL_PERIOD_1D:
		return 1
	case investmentv1.PnlPeriod_PNL_PERIOD_1W:
		return 7
	case investmentv1.PnlPeriod_PNL_PERIOD_1M:
		return 30
	default: // PNL_PERIOD_ALL, PNL_PERIOD_UNSPECIFIED
		return 0
	}
}

// computePeriodPnl fetches the start-of-period snapshot and computes the periodPnl delta.
// Falls back to (totalPnl, totalPnlPercent) when no snapshot is available or period is ALL.
func (s *investmentService) computePeriodPnl(
	ctx context.Context,
	userID int32,
	period investmentv1.PnlPeriod,
	currentTotalPnl int64,
	currentTotalPnlPercent float64,
) (periodPnl int64, periodPnlPercent float64, err error) {
	days := periodToDays(period)
	if days == 0 {
		// PERIOD_ALL or PERIOD_UNSPECIFIED — mirror all-time values
		return currentTotalPnl, currentTotalPnlPercent, nil
	}

	from := time.Now().AddDate(0, 0, -days)
	snapshot, err := s.portfolioHistoryRepo.GetPeriodStartSnapshot(ctx, userID, from)
	if err != nil {
		log.Printf("Warning: failed to fetch period start snapshot: %v", err)
		// Non-fatal — fall back to all-time
		return currentTotalPnl, currentTotalPnlPercent, nil
	}
	if snapshot == nil {
		// No history for the period — fallback to all-time
		return currentTotalPnl, currentTotalPnlPercent, nil
	}

	periodPnl = currentTotalPnl - snapshot.TotalPnl
	if snapshot.TotalValue > 0 {
		periodPnlPercent = float64(periodPnl) / float64(snapshot.TotalValue) * 100
	}
	return periodPnl, periodPnlPercent, nil
}
