package scheduler

import (
	"context"
	"log"
	"time"

	"wealthjourney/domain/repository"
	"wealthjourney/domain/service"
	investmentv1 "wealthjourney/protobuf/v1"
)

// PortfolioSnapshotJob records historical portfolio values for performance charts.
type PortfolioSnapshotJob struct {
	userRepo     repository.UserRepository
	walletRepo   repository.WalletRepository
	portfolioSvc service.PortfolioHistoryService
}

func NewPortfolioSnapshotJob(
	userRepo repository.UserRepository,
	walletRepo repository.WalletRepository,
	portfolioSvc service.PortfolioHistoryService,
) *PortfolioSnapshotJob {
	return &PortfolioSnapshotJob{
		userRepo:     userRepo,
		walletRepo:   walletRepo,
		portfolioSvc: portfolioSvc,
	}
}

func (j *PortfolioSnapshotJob) Name() string            { return "portfolio-snapshot" }
func (j *PortfolioSnapshotJob) Interval() time.Duration  { return 1 * time.Hour }
func (j *PortfolioSnapshotJob) StartupDelay() time.Duration { return 10 * time.Second }

func (j *PortfolioSnapshotJob) Run(ctx context.Context) error {
	log.Println("Running portfolio snapshot job...")

	users, _, err := j.userRepo.List(ctx, repository.ListOptions{
		Limit: 10000,
	})
	if err != nil {
		return err
	}

	log.Printf("Creating portfolio snapshots for %d users...", len(users))

	successCount := 0
	errorCount := 0
	skippedCount := 0

	for _, user := range users {
		wallets, _, err := j.walletRepo.ListByUserID(ctx, user.ID, repository.ListOptions{
			Limit: 1000,
		})
		if err != nil {
			log.Printf("Warning: failed to list wallets for user %d: %v", user.ID, err)
			errorCount++
			continue
		}

		hasInvestmentWallets := false
		for _, wallet := range wallets {
			if wallet.Type == int32(investmentv1.WalletType_INVESTMENT) {
				hasInvestmentWallets = true
				break
			}
		}

		if !hasInvestmentWallets {
			skippedCount++
			continue
		}

		if err := j.portfolioSvc.CreateAggregatedSnapshot(ctx, user.ID); err != nil {
			log.Printf("Error: failed to create portfolio snapshot for user %d: %v", user.ID, err)
			errorCount++
			continue
		}

		successCount++
	}

	log.Printf("Portfolio snapshot job completed: %d successful, %d skipped, %d errors",
		successCount, skippedCount, errorCount)
	return nil
}
